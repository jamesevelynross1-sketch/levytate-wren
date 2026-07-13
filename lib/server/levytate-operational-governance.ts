import type { LevyTateBetaSession } from "@/lib/levytate/config/beta-access";
import {
  completionMethodLabel,
  deriveActionAgeing,
  deriveResolutionTiming,
  isTerminalStatus,
  medianDuration,
  operationalAgeingBands,
  operationalGovernancePolicy,
  type OperationalAgeingBand,
} from "@/lib/levytate/mvp/operational-governance";
import {
  operationalActionStatusLabels,
  type OperationalActionCompletionMethod,
  type OperationalActionStatus,
  type PersistentOperationalAction,
} from "@/lib/levytate/mvp/operational-actions";
import { operationalPriorityRanks, type OperationalOwnerType, type OperationalPriorityLevel } from "@/lib/levytate/mvp/operations-centre";
import type { LearnerRecordDetail } from "@/lib/levytate/mvp/learner-record-view";
import { getLearnerLifecycleServerContext, listOrganisationLearnerLifecycleDetails } from "@/lib/server/levytate-learner-lifecycle";
import { listOperationalActions } from "@/lib/server/levytate-operational-actions";
import { getLevyTateSupabaseConfig, supabaseSelect } from "@/lib/server/levytate-supabase";

export type OperationalGovernanceView = "summary" | "overdue" | "unacknowledged" | "stalled" | "owners" | "closed";
export type OperationalGovernancePeriod = "30" | "90" | "365" | "custom";

export type OperationalGovernanceQuery = {
  view?: OperationalGovernanceView;
  status?: string;
  priority?: string;
  owner?: string;
  actionType?: string;
  sourceType?: string;
  learner?: string;
  programme?: string;
  provider?: string;
  ageingBand?: string;
  overdue?: string;
  completionMethod?: string;
  datePeriod?: OperationalGovernancePeriod;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  page?: number;
  pageSize?: number;
};

export type OperationalGovernanceItem = {
  id: string;
  title: string;
  learnerName: string;
  programmeName: string;
  providerName: string;
  sourceType: string;
  actionType: string;
  sourceReason: string;
  priority: OperationalPriorityLevel;
  status: OperationalActionStatus;
  statusLabel: string;
  ownerType: OperationalOwnerType;
  ownerName: string;
  dueDate: string;
  detectedAt: string;
  ageInDays: number;
  ageingBand: OperationalAgeingBand;
  daysOverdue: number;
  acknowledgedAt: string;
  acknowledgementDuration: number | null;
  startedAt: string;
  inProgressDuration: number | null;
  lastMeaningfulUpdate: string;
  daysWithoutMovement: number;
  closedAt: string;
  closedBy: string;
  resolutionDuration: number | null;
  completionMethod: OperationalActionCompletionMethod | "";
  completionMethodLabel: string;
  outcomeSummary: string;
  previousOccurrences: number;
};

export type OwnerOperationalSummary = {
  owner: string;
  ownerType: string;
  accessNote: string;
  activeActions: number;
  overdueActions: number;
  unacknowledgedActions: number;
  inProgressActions: number;
  oldestActiveDays: number;
  highestPriority: OperationalPriorityLevel | "None";
};

export type OperationalGovernanceResponse = {
  source: "supabase";
  generatedAt: string;
  view: OperationalGovernanceView;
  period: { value: OperationalGovernancePeriod; from: string; to: string };
  summary: {
    activeActions: number;
    overdueActions: number;
    awaitingAcknowledgement: number;
    stalledInProgress: number;
    actionsClosed: number;
    medianAcknowledgementDays: number | null;
    medianResolutionDays: number | null;
    completedAutomatically: number;
    completedManually: number;
    dismissed: number;
    cancelled: number;
  };
  ageing: Array<{ band: OperationalAgeingBand; count: number }>;
  overdue: OperationalGovernanceItem[];
  unacknowledged: OperationalGovernanceItem[];
  stalled: OperationalGovernanceItem[];
  owners: OwnerOperationalSummary[];
  closed: { items: OperationalGovernanceItem[]; total: number; page: number; pageSize: number; totalPages: number };
  filterOptions: {
    priorities: string[];
    owners: string[];
    actionTypes: string[];
    sourceTypes: string[];
    learners: string[];
    programmes: string[];
    providers: string[];
    completionMethods: string[];
    ageingBands: readonly OperationalAgeingBand[];
  };
  policy: { acknowledgementDays: typeof operationalGovernancePolicy.acknowledgementDays; stalledInProgressDays: number };
  scaleNote: string;
};

export async function getOperationalGovernanceSummary(
  session: LevyTateBetaSession,
  query: OperationalGovernanceQuery = {},
  now = new Date(),
): Promise<OperationalGovernanceResponse> {
  const [context, actions, learners] = await Promise.all([
    getLearnerLifecycleServerContext(session),
    listOperationalActions(session, { includeTerminal: true }),
    listOrganisationLearnerLifecycleDetails(session),
  ]);
  const actorNames = await loadActorNames(context.organisation.id);
  const previousOccurrenceCounts = countPreviousOccurrences(actions);
  const learnerById = new Map(learners.map((learner) => [learner.learnerRecordId, learner]));
  const rows = actions.map((action) => governanceItem(action, learnerById.get(action.learnerRecordId), actorNames, previousOccurrenceCounts.get(action.id) ?? 0, now));
  const activeRows = rows.filter((row) => !isTerminalStatus(row.status));
  const period = periodFor(query, now);
  const periodClosed = rows.filter((row) => isTerminalStatus(row.status) && inPeriod(row.closedAt, period.from, period.to));
  const filteredActive = activeRows.filter((row) => matchesGovernanceQuery(row, query, "active"));
  const filteredClosed = periodClosed.filter((row) => matchesGovernanceQuery(row, query, "closed"));
  const overdue = listOverdueOperationalActions(filteredActive);
  const unacknowledged = listUnacknowledgedOperationalActions(filteredActive);
  const stalled = listStalledOperationalActions(filteredActive);
  const owners = getOwnerOperationalSummary(filteredActive);
  const pageSize = Math.min(operationalGovernancePolicy.maximumPageSize, Math.max(1, query.pageSize ?? operationalGovernancePolicy.defaultPageSize));
  const page = Math.max(1, query.page ?? 1);
  const sortedClosed = listClosedOperationalActions(filteredClosed);
  const closedItems = sortedClosed.slice((page - 1) * pageSize, page * pageSize);
  return {
    source: "supabase",
    generatedAt: now.toISOString(),
    view: query.view ?? "summary",
    period,
    summary: {
      activeActions: filteredActive.length,
      overdueActions: overdue.length,
      awaitingAcknowledgement: unacknowledged.length,
      stalledInProgress: stalled.length,
      actionsClosed: filteredClosed.length,
      medianAcknowledgementDays: medianDuration(filteredClosed.map((row) => row.acknowledgementDuration)),
      medianResolutionDays: medianDuration(filteredClosed.map((row) => row.resolutionDuration)),
      completedAutomatically: filteredClosed.filter((row) => row.status === "completed" && row.completionMethod === "source_condition_resolved").length,
      completedManually: filteredClosed.filter((row) => row.status === "completed" && row.completionMethod === "user_completed").length,
      dismissed: filteredClosed.filter((row) => row.status === "dismissed").length,
      cancelled: filteredClosed.filter((row) => row.status === "cancelled").length,
    },
    ageing: operationalAgeingBands.map((band) => ({ band, count: filteredActive.filter((row) => row.ageingBand === band).length })),
    overdue: overdue.slice(0, 50),
    unacknowledged: unacknowledged.slice(0, 50),
    stalled: stalled.slice(0, 50),
    owners,
    closed: {
      items: closedItems,
      total: sortedClosed.length,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(sortedClosed.length / pageSize)),
    },
    filterOptions: buildFilterOptions(rows),
    policy: {
      acknowledgementDays: operationalGovernancePolicy.acknowledgementDays,
      stalledInProgressDays: operationalGovernancePolicy.stalledInProgressDays,
    },
    scaleNote: `Organisation action reads are bounded to ${operationalGovernancePolicy.maximumOrganisationActions.toLocaleString("en-GB")} records. Closed rows are returned to the browser in pages of ${pageSize}. Keyset pagination and materialised summaries are the next scale step.`,
  };
}

export function listOverdueOperationalActions(rows: OperationalGovernanceItem[]) {
  return rows.filter((row) => row.daysOverdue > 0).sort((left, right) =>
    criticalRank(left.priority) - criticalRank(right.priority)
    || right.daysOverdue - left.daysOverdue
    || left.detectedAt.localeCompare(right.detectedAt)
    || left.learnerName.localeCompare(right.learnerName),
  );
}

export function listUnacknowledgedOperationalActions(rows: OperationalGovernanceItem[]) {
  return rows.filter((row) => {
    const threshold = operationalGovernancePolicy.acknowledgementDays[row.priority];
    return row.status === "open" && threshold !== null && row.ageInDays > threshold;
  }).sort((left, right) => criticalRank(left.priority) - criticalRank(right.priority) || right.ageInDays - left.ageInDays);
}

export function listStalledOperationalActions(rows: OperationalGovernanceItem[]) {
  return rows.filter((row) => row.status === "in_progress" && row.daysWithoutMovement > operationalGovernancePolicy.stalledInProgressDays)
    .sort((left, right) => right.daysWithoutMovement - left.daysWithoutMovement || criticalRank(left.priority) - criticalRank(right.priority));
}

export function listClosedOperationalActions(rows: OperationalGovernanceItem[]) {
  return [...rows].sort((left, right) => right.closedAt.localeCompare(left.closedAt) || left.title.localeCompare(right.title) || left.id.localeCompare(right.id));
}

export function getOwnerOperationalSummary(rows: OperationalGovernanceItem[]): OwnerOperationalSummary[] {
  const groups = new Map<string, OperationalGovernanceItem[]>();
  for (const row of rows) {
    const owner = ownerGroup(row);
    groups.set(owner, [...(groups.get(owner) ?? []), row]);
  }
  return Array.from(groups, ([owner, items]) => ({
    owner,
    ownerType: items[0]?.ownerType ?? "Unassigned",
    accessNote: ownerAccessNote(items[0]),
    activeActions: items.length,
    overdueActions: items.filter((item) => item.daysOverdue > 0).length,
    unacknowledgedActions: listUnacknowledgedOperationalActions(items).length,
    inProgressActions: items.filter((item) => item.status === "in_progress").length,
    oldestActiveDays: Math.max(...items.map((item) => item.ageInDays), 0),
    highestPriority: items.sort((left, right) => criticalRank(left.priority) - criticalRank(right.priority))[0]?.priority ?? "None",
  })).sort((left, right) => right.overdueActions - left.overdueActions || right.activeActions - left.activeActions || left.owner.localeCompare(right.owner));
}

function governanceItem(
  action: PersistentOperationalAction,
  learner: LearnerRecordDetail | undefined,
  actorNames: Map<string, string>,
  previousOccurrences: number,
  now: Date,
): OperationalGovernanceItem {
  const timing = deriveActionAgeing(action, now);
  const resolution = deriveResolutionTiming(action, now);
  return {
    id: action.id,
    title: action.title,
    learnerName: learner?.learner.name || "Learner record unavailable",
    programmeName: learner?.programme.programmeName || "Programme unavailable",
    providerName: learner?.programme.providerName || "Provider not recorded",
    sourceType: action.sourceType,
    actionType: action.actionType,
    sourceReason: action.description,
    priority: action.priority,
    status: action.status,
    statusLabel: operationalActionStatusLabels[action.status],
    ownerType: action.ownerType,
    ownerName: action.ownerDisplayName.trim() || (action.ownerUserId ? action.ownerType : "Unassigned"),
    dueDate: action.dueDate,
    detectedAt: action.detectedAt,
    ageInDays: timing.ageInDays,
    ageingBand: timing.ageingBand,
    daysOverdue: timing.daysOverdue,
    acknowledgedAt: action.acknowledgedAt,
    acknowledgementDuration: timing.acknowledgementDuration,
    startedAt: action.startedAt,
    inProgressDuration: timing.inProgressDuration,
    lastMeaningfulUpdate: timing.lastMeaningfulUpdate,
    daysWithoutMovement: timing.daysWithoutMovement,
    closedAt: resolution.closedAt,
    closedBy: actorLabel(resolution.closedBy, actorNames),
    resolutionDuration: resolution.resolutionDuration,
    completionMethod: action.completionMethod,
    completionMethodLabel: completionMethodLabel(action.completionMethod),
    outcomeSummary: resolution.outcomeSummary,
    previousOccurrences,
  };
}

function matchesGovernanceQuery(row: OperationalGovernanceItem, query: OperationalGovernanceQuery, state: "active" | "closed") {
  const equals = (actual: string, expected?: string) => !expected || expected === "All" || actual.toLowerCase() === expected.toLowerCase();
  if (state === "closed" && !equals(row.status, query.status)) return false;
  if (!equals(row.priority, query.priority)) return false;
  if (query.owner && query.owner !== "All" && ![row.ownerName, row.ownerType, ownerGroup(row)].some((value) => value.toLowerCase() === query.owner!.toLowerCase())) return false;
  if (!equals(row.actionType, query.actionType)) return false;
  if (!equals(row.sourceType, query.sourceType)) return false;
  if (!equals(row.learnerName, query.learner)) return false;
  if (!equals(row.programmeName, query.programme)) return false;
  if (!equals(row.providerName, query.provider)) return false;
  if (state === "active" && !equals(row.ageingBand, query.ageingBand)) return false;
  if (query.overdue === "overdue" && row.daysOverdue <= 0) return false;
  if (query.overdue === "not_overdue" && row.daysOverdue > 0) return false;
  if (state === "closed" && !equals(row.completionMethod, query.completionMethod)) return false;
  const search = query.search?.trim().toLowerCase();
  return !search || [row.title, row.learnerName, row.programmeName, row.providerName, row.ownerName, row.sourceReason, row.outcomeSummary]
    .some((value) => value.toLowerCase().includes(search));
}

function buildFilterOptions(rows: OperationalGovernanceItem[]) {
  const unique = (values: string[]) => Array.from(new Set(values.filter(Boolean))).sort((left, right) => left.localeCompare(right));
  return {
    priorities: (Object.keys(operationalPriorityRanks) as OperationalPriorityLevel[]).sort((left, right) => criticalRank(left) - criticalRank(right)),
    owners: unique(rows.map(ownerGroup)),
    actionTypes: unique(rows.map((row) => row.actionType)),
    sourceTypes: unique(rows.map((row) => row.sourceType)),
    learners: unique(rows.map((row) => row.learnerName)),
    programmes: unique(rows.map((row) => row.programmeName)),
    providers: unique(rows.map((row) => row.providerName)),
    completionMethods: unique(rows.filter((row) => isTerminalStatus(row.status)).map((row) => row.completionMethod)),
    ageingBands: operationalAgeingBands,
  };
}

function periodFor(query: OperationalGovernanceQuery, now: Date) {
  const value = query.datePeriod ?? "90";
  const end = query.dateTo && /^\d{4}-\d{2}-\d{2}$/.test(query.dateTo) ? new Date(`${query.dateTo}T23:59:59.999Z`) : now;
  if (value === "custom" && query.dateFrom && /^\d{4}-\d{2}-\d{2}$/.test(query.dateFrom)) {
    return { value, from: new Date(`${query.dateFrom}T00:00:00.000Z`).toISOString(), to: end.toISOString() };
  }
  const days = Number(value);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - Math.max(0, days - 1));
  start.setUTCHours(0, 0, 0, 0);
  return { value: value === "custom" ? "90" : value, from: start.toISOString(), to: end.toISOString() } as const;
}

function inPeriod(value: string, from: string, to: string) {
  return Boolean(value && value >= from && value <= to);
}

function criticalRank(priority: OperationalPriorityLevel) {
  return operationalPriorityRanks[priority];
}

function ownerGroup(row: Pick<OperationalGovernanceItem, "ownerType" | "ownerName">) {
  if (row.ownerName === "Unassigned") return "Unassigned";
  if (row.ownerType === "Apprenticeship Lead" && row.ownerName !== "Apprenticeship Lead") return row.ownerName;
  return row.ownerType;
}

function ownerAccessNote(row: OperationalGovernanceItem | undefined) {
  if (!row) return "Workflow accountability only";
  if (row.ownerName === "Unassigned") return "No current owner";
  if (row.ownerType === "Apprenticeship Lead") return "Authorised organisation user";
  if (["HR", "Provider", "Shared"].includes(row.ownerType)) return "Accountability label, platform access not implied";
  return "Workflow accountability only";
}

function countPreviousOccurrences(actions: PersistentOperationalAction[]) {
  const result = new Map<string, number>();
  const groups = new Map<string, PersistentOperationalAction[]>();
  for (const action of actions) groups.set(action.sourceKey, [...(groups.get(action.sourceKey) ?? []), action]);
  for (const occurrences of groups.values()) {
    occurrences.sort((left, right) => left.detectedAt.localeCompare(right.detectedAt) || left.id.localeCompare(right.id));
    occurrences.forEach((action, index) => result.set(action.id, index));
  }
  return result;
}

async function loadActorNames(organisationId: string) {
  const config = getLevyTateSupabaseConfig();
  if (!config) return new Map<string, string>();
  const [users, employees] = await Promise.all([
    supabaseSelect<{ id: string; email: string }>(config, "levytate_users", new URLSearchParams({ select: "id,email", organisation_id: `eq.${organisationId}`, limit: "5000" })),
    supabaseSelect<{ name: string; email: string }>(config, "levytate_employees", new URLSearchParams({ select: "name,email", organisation_id: `eq.${organisationId}`, limit: "5000" })),
  ]);
  const employeeByEmail = new Map(employees.map((employee) => [employee.email.toLowerCase(), employee.name]));
  return new Map(users.map((user) => [user.id, employeeByEmail.get(user.email.toLowerCase()) || user.email]));
}

function actorLabel(actorId: string, actors: Map<string, string>) {
  if (!actorId) return "Not recorded";
  if (actorId === "system") return "LevyTate";
  return actors.get(actorId) || "Authorised user";
}
