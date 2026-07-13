import type { LevyTateBetaSession } from "@/lib/levytate/config/beta-access";
import {
  buildOrganisationOperationalItems,
  groupOperationalQueues,
  operationalDueTiming,
  operationalPriorityRanks,
  operationalQueueLabels,
  type OperationalDueStatus,
  type OperationalItem,
  type OperationalOwnerType,
  type OperationalPriorityLevel,
  type OperationalQueueType,
  type OperationsFilterOptions,
  type OperationsResponse,
} from "@/lib/levytate/mvp/operations-centre";
import { getLearnerLifecycleServerContext, listOrganisationLearnerLifecycleDetails } from "@/lib/server/levytate-learner-lifecycle";
import { listOperationalActions, synchroniseOrganisationOperationalActions } from "@/lib/server/levytate-operational-actions";

export type OperationsQuery = {
  priority?: string;
  queue?: string;
  learner?: string;
  programme?: string;
  provider?: string;
  site?: string;
  department?: string;
  owner?: string;
  dueStatus?: string;
  status?: string;
  actionType?: string;
  assignment?: "all" | "mine" | "unassigned" | "shared";
  search?: string;
};

export async function getOrganisationOperationsSummary(
  session: LevyTateBetaSession,
  query: OperationsQuery = {},
  options: { synchronise?: boolean } = {},
): Promise<OperationsResponse> {
  if (options.synchronise) await synchroniseOrganisationOperationalActions(session);
  const [details, actionContext] = await Promise.all([
    listOrganisationLearnerLifecycleDetails(session),
    getLearnerLifecycleServerContext(session),
  ]);
  const derived = buildOrganisationOperationalItems(details);
  const activeActions = await listOperationalActions(session);
  const actionBySource = new Map(activeActions.map((action) => [action.sourceKey, action]));
  const currentItems = derived.items.map((item) => {
    const action = actionBySource.get(item.sourceKey);
    if (!action) return item;
    const persistentTiming = operationalDueTiming(action.dueDate);
    return {
      ...item,
      persistentActionId: action.id,
      persistentActionStatus: action.status,
      persistentDetectedAt: action.detectedAt,
      persistentAcknowledgedAt: action.acknowledgedAt,
      persistentDueDate: action.dueDate,
      persistentOwnerUserId: action.ownerUserId,
      persistentOwnerDisplayName: action.ownerDisplayName,
      ownerType: action.ownerType,
      dueDate: action.dueDate,
      dueStatus: persistentTiming.status,
      daysOverdue: persistentTiming.daysOverdue || null,
      timingLabel: persistentTiming.label,
    };
  });
  const filtered = currentItems.filter((item) => matchesQuery(item, query, actionContext.user.id));
  return {
    source: "supabase",
    generatedAt: new Date().toISOString(),
    summary: derived.summary,
    queues: groupOperationalQueues(filtered),
    recentActivity: derived.recentActivity,
    filterOptions: buildFilterOptions(currentItems),
    totalAttentionItems: filtered.length,
  };
}

export async function getOrganisationOperationalItems(session: LevyTateBetaSession, query: OperationsQuery = {}) {
  const response = await getOrganisationOperationsSummary(session, query);
  return Object.values(response.queues).flat();
}

function matchesQuery(item: OperationalItem, query: OperationsQuery, currentUserId: string) {
  const equals = (actual: string, expected?: string) => !expected || expected === "All" || actual.toLowerCase() === expected.toLowerCase();
  if (!equals(item.priorityLevel, query.priority)) return false;
  if (!equals(item.queueType, query.queue)) return false;
  if (!equals(item.learnerName, query.learner)) return false;
  if (!equals(item.programmeName, query.programme)) return false;
  if (!equals(item.providerName, query.provider)) return false;
  if (!equals(item.site, query.site)) return false;
  if (!equals(item.department, query.department)) return false;
  if (!equals(item.ownerType, query.owner)) return false;
  if (!equals(item.dueStatus, query.dueStatus)) return false;
  if (!equals(item.persistentActionStatus ?? "open", query.status)) return false;
  if (!equals(item.persistentActionType, query.actionType)) return false;
  if (query.assignment === "mine" && !(item.persistentOwnerUserId === currentUserId || (item.ownerType === "Apprenticeship Lead" && !item.persistentOwnerUserId))) return false;
  if (query.assignment === "unassigned" && (item.persistentOwnerUserId || item.ownerType === "Shared")) return false;
  if (query.assignment === "shared" && item.ownerType !== "Shared") return false;
  const search = query.search?.trim().toLowerCase();
  return !search || [item.learnerName, item.programmeName, item.providerName, item.department, item.site, item.reason, item.persistentOwnerDisplayName ?? "", item.persistentActionType.replace(/_/g, " ")]
    .some((value) => value.toLowerCase().includes(search));
}

function buildFilterOptions(items: OperationalItem[]): OperationsFilterOptions {
  const unique = (values: string[]) => Array.from(new Set(values.filter(Boolean))).sort((left, right) => left.localeCompare(right));
  return {
    priorities: (Object.keys(operationalPriorityRanks) as OperationalPriorityLevel[]).sort((left, right) => operationalPriorityRanks[left] - operationalPriorityRanks[right]),
    queues: (Object.keys(operationalQueueLabels) as OperationalQueueType[]).map((value) => ({ value, label: operationalQueueLabels[value] })),
    learners: unique(items.map((item) => item.learnerName)),
    programmes: unique(items.map((item) => item.programmeName)),
    providers: unique(items.map((item) => item.providerName)),
    sites: unique(items.map((item) => item.site)),
    departments: unique(items.map((item) => item.department)),
    owners: unique(items.map((item) => item.ownerType as OperationalOwnerType)),
    actionTypes: unique(items.map((item) => item.persistentActionType)),
  };
}

export function isOperationalDueStatus(value: string): value is OperationalDueStatus {
  return ["Overdue", "Due today", "Due soon", "No due date"].includes(value);
}
