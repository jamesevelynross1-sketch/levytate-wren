import type { LevyTateBetaSession } from "@/lib/levytate/config/beta-access";
import { getApprenticeshipStandard, type RequestStatus } from "@/lib/levytate/domain";
import {
  getApplicationReviewOccurrence,
  isManagerReviewableApplication,
} from "@/lib/levytate/mvp/application-review-actions";
import {
  canTransitionOperationalAction,
  isCriticalOperationalBlocker,
  isOperationalActionTerminal,
  nonTerminalOperationalActionStatuses,
  type OperationalActionEvent,
  type OperationalActionEventType,
  type OperationalActionMetadata,
  type OperationalActionStatus,
  type PersistentOperationalAction,
} from "@/lib/levytate/mvp/operational-actions";
import {
  buildOrganisationOperationalItems,
  operationsPolicy,
  operationalPriorityRanks,
  type OperationalItem,
  type OperationalOwnerType,
} from "@/lib/levytate/mvp/operations-centre";
import { hasMvpPermission, normaliseMvpUserRole } from "@/lib/levytate/mvp/rbac";
import type { LearnerRecordDetail } from "@/lib/levytate/mvp/learner-record-view";
import type { MvpApplicationHistoryEntry, MvpApplicationOwner } from "@/lib/levytate/mvp/workspace";
import {
  isManagerRelevantOperationalItem,
  isManagerRelevantPersistentAction,
} from "@/lib/levytate/mvp/manager-operational-actions";
import { createMvpId } from "@/lib/levytate/mvp/workspace";
import {
  getLearnerLifecycleServerContext,
  listManagerDirectReportLearnerLifecycleDetails,
  listOrganisationLearnerLifecycleDetails,
  LevyTateLearnerLifecyclePermissionError,
} from "@/lib/server/levytate-learner-lifecycle";
import {
  getManagerDirectReportContext,
  listManagerDirectReportApplications,
  type ManagerDirectReportApplication,
  type ManagerDirectReportContext,
} from "@/lib/server/levytate-manager-scope";
import {
  getLevyTateSupabaseConfig,
  LevyTateSupabaseError,
  supabaseInsert,
  supabaseSelect,
  supabaseUpdate,
} from "@/lib/server/levytate-supabase";

const actionsTable = "levytate_operational_actions";
const eventsTable = "levytate_operational_action_events";

type OperationalActionRow = {
  organisation_id: string;
  id: string;
  learner_record_id: string | null;
  application_id: string;
  employee_id: string;
  source_type: PersistentOperationalAction["sourceType"];
  source_key: string;
  action_type: PersistentOperationalAction["actionType"];
  title: string;
  description: string;
  priority: PersistentOperationalAction["priority"];
  priority_rank: number;
  status: OperationalActionStatus;
  owner_type: OperationalOwnerType;
  owner_user_id: string;
  owner_display_name: string;
  due_date: string | null;
  detected_at: string;
  acknowledged_at: string | null;
  acknowledged_by: string;
  started_at: string | null;
  started_by: string;
  completed_at: string | null;
  completed_by: string;
  completion_method: PersistentOperationalAction["completionMethod"];
  completion_note: string;
  dismissed_at: string | null;
  dismissed_by: string;
  dismissal_reason: string;
  source_url: string;
  metadata: OperationalActionMetadata | null;
  version: number;
  created_at: string;
  updated_at: string;
};

type ApplicationReviewRow = {
  id: string;
  employee_id: string;
  apprenticeship_standard_id: string;
  status: RequestStatus;
  current_owner: MvpApplicationOwner;
  reason: string;
  submitted_at: string;
  updated_at: string;
};

type ApplicationReviewHistoryRow = {
  id: string;
  application_id: string;
  status: RequestStatus;
  owner: MvpApplicationOwner;
  note: string;
  created_at: string;
};

type ApplicationReviewEmployeeRow = {
  id: string;
  name: string;
  email: string;
  job_title: string;
  role_id: string;
  manager_id: string;
  department: string;
  site: string;
  status: string;
};

type ApplicationReviewUserRow = {
  id: string;
  email: string;
};

export type ApplicationReviewActionSource = {
  application: ManagerDirectReportApplication;
  sourceKey: string;
  sourceCondition: string;
  submittedVersion: number;
  submittedAt: string;
  occurrenceId: string;
  manager: { employeeId: string; userId: string; name: string };
};

type OperationalActionEventRow = {
  organisation_id: string;
  id: string;
  operational_action_id: string;
  event_type: OperationalActionEventType;
  previous_status: OperationalActionStatus | "";
  new_status: OperationalActionStatus | "";
  actor_user_id: string;
  actor_name: string;
  event_date: string;
  summary: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

type ActionContext = Awaited<ReturnType<typeof getLearnerLifecycleServerContext>> & { actorDisplayName: string };

export class LevyTateOperationalActionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LevyTateOperationalActionError";
  }
}

export class LevyTateOperationalActionConflictError extends LevyTateOperationalActionError {
  constructor(message: string) {
    super(message);
    this.name = "LevyTateOperationalActionConflictError";
  }
}

export class LevyTateManagerOperationalActionAccessError extends LevyTateOperationalActionError {
  constructor() {
    super("This action is not available in your current direct-report scope.");
    this.name = "LevyTateManagerOperationalActionAccessError";
  }
}

export type OperationalActionListQuery = {
  learnerRecordId?: string;
  status?: OperationalActionStatus;
  sourceKey?: string;
  includeTerminal?: boolean;
};

export type OperationalActionOwnerOption = {
  ownerType: OperationalOwnerType;
  ownerUserId: string;
  label: string;
  accessNote: string;
};

export type OperationalActionManagementDetail = {
  action: PersistentOperationalAction;
  history: OperationalActionEvent[];
  previousOccurrences: PersistentOperationalAction[];
  context: {
    learnerName: string;
    jobTitle: string;
    department: string;
    site: string;
    managerName: string;
    programmeName: string;
    providerName: string;
    sourceReason: string;
    sourceFacts: Array<{ label: string; value: string }>;
    workflowLabel: string;
    workflowActionType: OperationalItem["actionType"];
    dueDateOrigin: "Source workflow" | "Manual override" | "No source date";
    terminalProtection: boolean;
  };
  ownerOptions: OperationalActionOwnerOption[];
};

export type OperationalActionSynchronisationResult = {
  organisationId: string;
  detectedConditions: number;
  created: number;
  updated: number;
  completed: number;
  suppressedDismissals: number;
  unchanged: number;
  actions: PersistentOperationalAction[];
};

export async function synchroniseOrganisationOperationalActions(
  session: LevyTateBetaSession,
): Promise<OperationalActionSynchronisationResult> {
  const [context, details] = await Promise.all([
    requireOperationalActionContext(session, "write"),
    listOrganisationLearnerLifecycleDetails(session),
  ]);
  const organisationId = context.organisation.id;
  const now = new Date().toISOString();
  const derived = buildOrganisationOperationalItems(details, new Date(now));
  const currentItems = uniqueSourceItems(derived.items);
  const existing = await selectActions(organisationId, { includeTerminal: true });
  const lifecycleExisting = existing.filter((action) => action.actionType !== "review_application");
  const activeBySource = new Map(lifecycleExisting.filter((action) => !isOperationalActionTerminal(action.status)).map((action) => [action.sourceKey, action]));
  const latestBySource = latestActionsBySource(lifecycleExisting);
  const detailByLearner = new Map(details.map((detail) => [detail.learnerRecordId, detail]));
  const currentSourceKeys = new Set(currentItems.map((item) => item.sourceKey));
  const result: OperationalActionSynchronisationResult = {
    organisationId,
    detectedConditions: currentItems.length,
    created: 0,
    updated: 0,
    completed: 0,
    suppressedDismissals: 0,
    unchanged: 0,
    actions: [],
  };

  for (const item of currentItems) {
    const active = activeBySource.get(item.sourceKey);
    if (active) {
      const updated = await updateActionFromDerivedCondition(context, active, item);
      result.actions.push(updated.action);
      if (updated.changed) result.updated += 1;
      else result.unchanged += 1;
      continue;
    }

    const latest = latestBySource.get(item.sourceKey);
    if (latest?.status === "dismissed" && !latest.metadata.conditionClearedAt) {
      result.suppressedDismissals += 1;
      continue;
    }

    const detail = detailByLearner.get(item.learnerRecordId);
    if (!detail) continue;
    const created = await createActionForCondition(context, item, {
      applicationId: detail.programme.applicationReference,
      employeeId: detail.learner.id,
      priorActionId: latest?.id,
    });
    result.actions.push(created);
    result.created += 1;
  }

  for (const active of activeBySource.values()) {
    if (currentSourceKeys.has(active.sourceKey)) continue;
    const completed = await transitionSystemResolvedAction(context, active, now);
    result.actions.push(completed);
    result.completed += 1;
  }

  for (const action of lifecycleExisting) {
    if (action.status !== "dismissed" || currentSourceKeys.has(action.sourceKey) || action.metadata.conditionClearedAt) continue;
    await markDismissedConditionCleared(context, action, now);
  }

  const applicationReviews = await synchroniseApplicationReviewActionsForContext(context);
  result.detectedConditions += applicationReviews.detectedConditions;
  result.created += applicationReviews.created;
  result.updated += applicationReviews.updated;
  result.completed += applicationReviews.completed;
  result.unchanged += applicationReviews.unchanged;
  result.actions.push(...applicationReviews.actions);

  return result;
}

export type ManagerOperationalActionScopeResult = {
  scope: ManagerDirectReportContext;
  details: LearnerRecordDetail[];
  applicationSources: ApplicationReviewActionSource[];
  actions: PersistentOperationalAction[];
};

export async function synchroniseManagerDirectReportOperationalActions(
  session: LevyTateBetaSession,
): Promise<ManagerOperationalActionScopeResult> {
  const context = await managerOperationalActionContext(session);
  const { scope, details, applications } = context;
  const now = new Date().toISOString();
  const applicationReviews = await synchroniseApplicationReviewActionsForContext(context, applications);
  const currentItems = uniqueSourceItems(buildOrganisationOperationalItems(details, new Date(now)).items.filter(isManagerRelevantOperationalItem));
  const allExisting = await selectActions(scope.organisation.id, { includeTerminal: true });
  const directReportIds = new Set(scope.directReports.map((employee) => employee.id));
  const scopedExisting = allExisting.filter((action) => directReportIds.has(action.employeeId));
  const scopedLifecycleExisting = scopedExisting.filter((action) => action.actionType !== "review_application");
  const activeBySource = new Map(scopedLifecycleExisting.filter((action) => !isOperationalActionTerminal(action.status)).map((action) => [action.sourceKey, action]));
  const latestBySource = latestActionsBySource(scopedLifecycleExisting);
  const detailByLearner = new Map(details.map((detail) => [detail.learnerRecordId, detail]));
  const currentSourceKeys = new Set(currentItems.map((item) => item.sourceKey));

  for (const item of currentItems) {
    const active = activeBySource.get(item.sourceKey);
    if (active) {
      if (isManagerRelevantPersistentAction(active, scope.user.id) || !active.metadata.ownershipOverride) {
        await updateActionFromDerivedCondition(context, active, item);
      }
      continue;
    }

    const latest = latestBySource.get(item.sourceKey);
    if (latest?.status === "dismissed" && !latest.metadata.conditionClearedAt) continue;
    const detail = detailByLearner.get(item.learnerRecordId);
    if (!detail) continue;
    await createActionForCondition(context, item, {
      applicationId: detail.programme.applicationReference,
      employeeId: detail.learner.id,
      priorActionId: latest?.id,
    });
  }

  for (const action of scopedLifecycleExisting) {
    if (isOperationalActionTerminal(action.status)) continue;
    if (!isManagerRelevantPersistentAction(action, scope.user.id)) continue;
    if (currentSourceKeys.has(action.sourceKey)) continue;
    await transitionSystemResolvedAction(context, action, now);
  }

  const actions = (await selectActions(scope.organisation.id, { includeTerminal: true }))
    .filter((action) => directReportIds.has(action.employeeId) && isManagerRelevantPersistentAction(action, scope.user.id));
  return { scope, details, applicationSources: applicationReviews.sources, actions };
}

export async function listManagerDirectReportOperationalActions(session: LevyTateBetaSession) {
  const result = await synchroniseManagerDirectReportOperationalActions(session);
  return {
    ...result,
    actions: result.actions.filter((action) => !isOperationalActionTerminal(action.status)),
  };
}

export async function getManagerDirectReportOperationalAction(session: LevyTateBetaSession, actionId: string) {
  const context = await managerOperationalActionContext(session);
  const action = await requireManagerScopedAction(context, actionId);
  const source = requireManagerActionAccess(context, action);
  const history = await selectActionHistory(context.scope.organisation.id, action.id);
  return { scope: context.scope, action, source, history };
}

export async function acknowledgeManagerDirectReportOperationalAction(
  session: LevyTateBetaSession,
  actionId: string,
  expectedVersion: number,
) {
  const context = await managerOperationalActionContext(session);
  const action = await requireManagerScopedAction(context, actionId);
  requireManagerActionAccess(context, action);
  if (action.status === "acknowledged") return action;
  if (isOperationalActionTerminal(action.status)) throw new LevyTateOperationalActionConflictError("This action is already closed.");
  if (action.status !== "open") throw new LevyTateOperationalActionError("Only open actions can be acknowledged.");
  assertVersion(action, expectedVersion);
  return transitionScopedAction(context, action, "acknowledged", {}, `${context.actorDisplayName} acknowledged the action.`);
}

export async function startManagerDirectReportOperationalAction(
  session: LevyTateBetaSession,
  actionId: string,
  expectedVersion: number,
  note = "",
) {
  const context = await managerOperationalActionContext(session);
  const action = await requireManagerScopedAction(context, actionId);
  requireManagerActionAccess(context, action);
  if (action.status === "in_progress") return action;
  if (isOperationalActionTerminal(action.status)) throw new LevyTateOperationalActionConflictError("This action is already closed.");
  if (action.status !== "open" && action.status !== "acknowledged") {
    throw new LevyTateOperationalActionError("Only open or acknowledged actions can be started.");
  }
  assertVersion(action, expectedVersion);
  const cleanNote = note.trim();
  if (cleanNote.length > 240) throw new LevyTateOperationalActionError("Keep the start-work note to 240 characters or fewer.");
  const metadata = cleanNote ? { ...action.metadata, managerStartNote: cleanNote } : action.metadata;
  const summary = cleanNote
    ? `${context.actorDisplayName} started work: ${cleanNote}`
    : `${context.actorDisplayName} started work on the action.`;
  return transitionScopedAction(context, action, "in_progress", { metadata }, summary);
}

export async function synchroniseApplicationReviewOperationalActions(
  session: LevyTateBetaSession,
  applicationIds?: string[],
) {
  const context = await applicationReviewActionContext(session);
  return synchroniseApplicationReviewActionsForContext(context, undefined, applicationIds);
}

type ApplicationReviewSynchronisationResult = {
  detectedConditions: number;
  created: number;
  updated: number;
  completed: number;
  unchanged: number;
  sources: ApplicationReviewActionSource[];
  actions: PersistentOperationalAction[];
};

async function synchroniseApplicationReviewActionsForContext(
  context: ActionContext,
  providedApplications?: ManagerDirectReportApplication[],
  applicationIds?: string[],
): Promise<ApplicationReviewSynchronisationResult> {
  const applications = providedApplications ?? await loadOrganisationApplicationReviewApplications(context.organisation.id, applicationIds);
  const scopedIds = new Set(applications.map((application) => application.id));
  const sources = applicationReviewSources(applications, context);
  const existing = (await selectActions(context.organisation.id, { includeTerminal: true }))
    .filter((action) => action.actionType === "review_application" && scopedIds.has(action.applicationId));
  const active = existing.filter((action) => !isOperationalActionTerminal(action.status));
  const currentByApplication = new Map(sources.map((source) => [source.application.id, source]));
  const result: ApplicationReviewSynchronisationResult = {
    detectedConditions: sources.length,
    created: 0,
    updated: 0,
    completed: 0,
    unchanged: 0,
    sources,
    actions: [],
  };

  for (const action of active) {
    const source = currentByApplication.get(action.applicationId);
    if (source?.sourceKey === action.sourceKey) continue;
    const application = applications.find((item) => item.id === action.applicationId);
    const closed = await closeApplicationReviewAction(context, action, application?.status);
    result.actions.push(closed);
    result.completed += 1;
  }

  const refreshed = (await selectActions(context.organisation.id, { includeTerminal: true }))
    .filter((action) => action.actionType === "review_application" && scopedIds.has(action.applicationId));
  const activeBySource = new Map(refreshed.filter((action) => !isOperationalActionTerminal(action.status)).map((action) => [action.sourceKey, action]));
  const latestByApplication = new Map<string, PersistentOperationalAction>();
  for (const action of [...refreshed].sort((left, right) => right.createdAt.localeCompare(left.createdAt))) {
    if (!latestByApplication.has(action.applicationId)) latestByApplication.set(action.applicationId, action);
  }

  for (const source of sources) {
    const current = activeBySource.get(source.sourceKey);
    if (current) {
      const update = await updateApplicationReviewAction(context, current, source);
      result.actions.push(update.action);
      if (update.changed) result.updated += 1;
      else result.unchanged += 1;
      continue;
    }
    const created = await createApplicationReviewAction(context, source, latestByApplication.get(source.application.id)?.id);
    result.actions.push(created);
    result.created += 1;
  }

  return result;
}

async function applicationReviewActionContext(session: LevyTateBetaSession): Promise<ActionContext> {
  const context = await getLearnerLifecycleServerContext(session);
  const config = requireConfig();
  const actors = await supabaseSelect<{ name: string }>(config, "levytate_employees", new URLSearchParams({
    select: "name",
    organisation_id: `eq.${context.organisation.id}`,
    email: `eq.${context.user.email}`,
    limit: "1",
  }));
  return { ...context, actorDisplayName: actors[0]?.name || context.user.email };
}

async function loadOrganisationApplicationReviewApplications(organisationId: string, applicationIds?: string[]) {
  const config = requireConfig();
  const applicationQuery = new URLSearchParams({
    select: "id,employee_id,apprenticeship_standard_id,status,current_owner,reason,submitted_at,updated_at",
    organisation_id: `eq.${organisationId}`,
    order: "submitted_at.desc",
    limit: "5000",
  });
  if (applicationIds?.length) applicationQuery.set("id", `in.(${applicationIds.join(",")})`);
  const applications = await supabaseSelect<ApplicationReviewRow>(config, "levytate_applications", applicationQuery);
  if (!applications.length) return [];
  const employeeIds = [...new Set(applications.map((application) => application.employee_id))];
  const employees = await supabaseSelect<ApplicationReviewEmployeeRow>(config, "levytate_employees", new URLSearchParams({
    select: "id,name,email,job_title,role_id,manager_id,department,site,status",
    organisation_id: `eq.${organisationId}`,
    id: `in.(${employeeIds.join(",")})`,
    limit: "5000",
  }));
  const managerIds = [...new Set(employees.map((employee) => employee.manager_id).filter(Boolean))];
  const managers = managerIds.length ? await supabaseSelect<ApplicationReviewEmployeeRow>(config, "levytate_employees", new URLSearchParams({
    select: "id,name,email,job_title,role_id,manager_id,department,site,status",
    organisation_id: `eq.${organisationId}`,
    id: `in.(${managerIds.join(",")})`,
    status: "eq.Active",
    limit: "5000",
  })) : [];
  const users = managers.length ? await supabaseSelect<ApplicationReviewUserRow>(config, "levytate_users", new URLSearchParams({
    select: "id,email",
    organisation_id: `eq.${organisationId}`,
    email: `in.(${managers.map((manager) => manager.email).join(",")})`,
    limit: "5000",
  })) : [];
  const history = await supabaseSelect<ApplicationReviewHistoryRow>(config, "levytate_application_history", new URLSearchParams({
    select: "id,application_id,status,owner,note,created_at",
    organisation_id: `eq.${organisationId}`,
    application_id: `in.(${applications.map((application) => application.id).join(",")})`,
    order: "created_at.asc",
    limit: "10000",
  }));
  const employeeById = new Map(employees.map((employee) => [employee.id, employee]));
  const managerById = new Map(managers.map((manager) => [manager.id, manager]));
  const userByEmail = new Map(users.map((user) => [user.email.trim().toLowerCase(), user]));

  return applications.flatMap((application): ManagerDirectReportApplication[] => {
    const employee = employeeById.get(application.employee_id);
    const manager = employee ? managerById.get(employee.manager_id) : undefined;
    if (!employee || employee.status !== "Active" || !manager) return [];
    return [{
      id: application.id,
      employee: {
        id: employee.id,
        name: employee.name,
        email: employee.email,
        jobTitle: employee.job_title,
        roleId: employee.role_id,
        managerId: employee.manager_id,
        department: employee.department,
        site: employee.site,
      },
      apprenticeshipStandardId: application.apprenticeship_standard_id,
      status: application.status,
      currentOwner: application.current_owner,
      reason: application.reason,
      careerGoal: "",
      supportRequired: "",
      managerNote: "",
      submittedAt: application.submitted_at,
      updatedAt: application.updated_at,
      history: history.filter((entry) => entry.application_id === application.id).map(applicationHistoryFromRow),
    }];
  }).map((application) => {
    const manager = managerById.get(application.employee.managerId)!;
    const user = userByEmail.get(manager.email.trim().toLowerCase());
    return Object.assign(application, { managerOwner: { employeeId: manager.id, userId: user?.id ?? "", name: manager.name } });
  });
}

function applicationReviewSources(applications: ManagerDirectReportApplication[], context: ActionContext): ApplicationReviewActionSource[] {
  return applications.flatMap((application) => {
    const occurrence = getApplicationReviewOccurrence(application);
    if (!occurrence || !isManagerReviewableApplication(application)) return [];
    const storedOwner = (application as ManagerDirectReportApplication & { managerOwner?: ApplicationReviewActionSource["manager"] }).managerOwner;
    const manager = storedOwner ?? {
      employeeId: application.employee.managerId,
      userId: context.user.id,
      name: context.actorDisplayName,
    };
    return [{ application, ...occurrence, manager }];
  });
}

function applicationHistoryFromRow(row: ApplicationReviewHistoryRow): MvpApplicationHistoryEntry {
  return { id: row.id, status: row.status, owner: row.owner, note: row.note, createdAt: row.created_at };
}

async function createApplicationReviewAction(context: ActionContext, source: ApplicationReviewActionSource, priorActionId?: string) {
  const config = requireConfig();
  const now = new Date().toISOString();
  const id = createMvpId("operational-action");
  const row = {
    organisation_id: context.organisation.id,
    id,
    learner_record_id: null,
    application_id: source.application.id,
    employee_id: source.application.employee.id,
    source_type: "application_workflow",
    source_key: source.sourceKey,
    action_type: "review_application",
    title: "Review application",
    description: source.application.reason.trim() || "A direct-report application requires a Line Manager decision.",
    priority: "High",
    priority_rank: operationalPriorityRanks.High,
    status: "open",
    owner_type: "Line Manager",
    owner_user_id: source.manager.userId,
    owner_display_name: source.manager.name,
    due_date: null,
    detected_at: now,
    source_url: `/levytate/app?module=Approvals&application=${encodeURIComponent(source.application.id)}`,
    metadata: {
      sourceCondition: source.sourceCondition,
      submittedVersion: source.submittedVersion,
      submittedAt: source.submittedAt,
      occurrenceId: source.occurrenceId,
      apprenticeshipStandardId: source.application.apprenticeshipStandardId,
      ...(priorActionId ? { priorActionId } : {}),
    },
    version: 1,
  };
  let inserted: OperationalActionRow[];
  try {
    inserted = await supabaseInsert<OperationalActionRow>(config, actionsTable, row);
  } catch (error) {
    if (!(error instanceof LevyTateSupabaseError) || !/duplicate|23505/i.test(error.message)) throw error;
    const concurrent = await selectActions(context.organisation.id, { sourceKey: source.sourceKey });
    const active = concurrent.find((action) => !isOperationalActionTerminal(action.status));
    if (!active) throw error;
    return active;
  }
  const created = actionFromRow(inserted[0]);
  await recordEvent(context, created, "detected", "", "open", "Application submitted for Line Manager review.");
  if (priorActionId) {
    await recordEvent(context, created, "regenerated", "", "open", "A new application review occurrence was created after employee resubmission.", { priorActionId });
  }
  return created;
}

async function updateApplicationReviewAction(context: ActionContext, action: PersistentOperationalAction, source: ApplicationReviewActionSource) {
  const changes: Record<string, unknown> = {};
  const nextUrl = `/levytate/app?module=Approvals&application=${encodeURIComponent(source.application.id)}`;
  if (action.ownerType !== "Line Manager" || action.ownerUserId !== source.manager.userId || action.ownerDisplayName !== source.manager.name) {
    changes.owner_type = "Line Manager";
    changes.owner_user_id = source.manager.userId;
    changes.owner_display_name = source.manager.name;
  }
  if (action.employeeId !== source.application.employee.id) changes.employee_id = source.application.employee.id;
  if (action.sourceUrl !== nextUrl) changes.source_url = nextUrl;
  if (action.description !== source.application.reason) changes.description = source.application.reason;
  if (!Object.keys(changes).length) return { action, changed: false };
  const updated = await versionedUpdate(context, action, changes);
  if ("owner_user_id" in changes) {
    await recordEvent(context, updated, "owner_changed", action.status, updated.status, `Owner updated to ${source.manager.name}, the employee's current Line Manager.`);
  }
  return { action: updated, changed: true };
}

async function closeApplicationReviewAction(context: ActionContext, action: PersistentOperationalAction, status?: RequestStatus) {
  if (isOperationalActionTerminal(action.status)) return action;
  const now = new Date().toISOString();
  if (status === "Withdrawn" || status === "Cancelled") {
    return transitionScopedAction(context, action, "cancelled", {
      completed_at: now,
      completed_by: context.user.id,
      completion_method: "system_cancelled",
      completion_note: `Application review cancelled because the application is ${status.toLowerCase()}.`,
    }, `Application review cancelled because the application is ${status.toLowerCase()}.`);
  }
  return transitionScopedAction(context, action, "completed", {
    completion_method: "source_condition_resolved",
    completion_note: status ? `Application moved to ${status}.` : "The application no longer requires this manager review occurrence.",
  }, status ? `Application review completed through the source workflow: ${status}.` : "Application review completed through the source workflow.");
}

export async function listOperationalActions(session: LevyTateBetaSession, query: OperationalActionListQuery = {}) {
  const context = await requireOperationalActionContext(session, "read");
  return selectActions(context.organisation.id, query);
}

export async function getOperationalAction(session: LevyTateBetaSession, actionId: string) {
  const context = await requireOperationalActionContext(session, "read");
  return requireScopedAction(context, actionId);
}

export async function getOperationalActionManagementDetail(
  session: LevyTateBetaSession,
  actionId: string,
): Promise<OperationalActionManagementDetail> {
  const context = await requireOperationalActionContext(session, "read");
  const action = await requireScopedAction(context, actionId);
  if (action.actionType === "review_application") {
    const [applications, history, allOccurrences, ownerOptions] = await Promise.all([
      loadOrganisationApplicationReviewApplications(context.organisation.id, [action.applicationId]),
      selectActionHistory(context.organisation.id, actionId),
      selectActions(context.organisation.id, { includeTerminal: true }),
      buildOwnerOptions(context, action),
    ]);
    const application = applications.find((item) => item.id === action.applicationId);
    if (!application) throw new LevyTateOperationalActionError("The application context for this action was not found.");
    const standard = getApprenticeshipStandard(application.apprenticeshipStandardId);
    return {
      action,
      history,
      previousOccurrences: allOccurrences.filter((item) => item.actionType === "review_application" && item.applicationId === action.applicationId && item.id !== action.id && isOperationalActionTerminal(item.status)),
      context: {
        learnerName: application.employee.name,
        jobTitle: application.employee.jobTitle,
        department: application.employee.department,
        site: application.employee.site,
        managerName: action.ownerDisplayName,
        programmeName: standard?.title ?? application.apprenticeshipStandardId,
        providerName: "Confirmed after approval",
        sourceReason: action.description,
        sourceFacts: [
          { label: "Current role", value: application.employee.jobTitle || "Not recorded" },
          { label: "Submitted", value: String(action.metadata.submittedAt || application.submittedAt) },
          { label: "Submitted version", value: `Version ${Number(action.metadata.submittedVersion || 1)}` },
        ],
        workflowLabel: "Review application",
        workflowActionType: "open_learner",
        dueDateOrigin: "No source date",
        terminalProtection: true,
      },
      ownerOptions,
    };
  }
  const [details, history, occurrences, ownerOptions] = await Promise.all([
    listOrganisationLearnerLifecycleDetails(session),
    selectActionHistory(context.organisation.id, actionId),
    selectActions(context.organisation.id, { sourceKey: action.sourceKey, includeTerminal: true }),
    buildOwnerOptions(context, action),
  ]);
  const learner = details.find((item) => item.learnerRecordId === action.learnerRecordId);
  if (!learner) throw new LevyTateOperationalActionError("The learner context for this action was not found.");
  const derived = buildOrganisationOperationalItems(details).items.find((item) => item.sourceKey === action.sourceKey);
  const sourceFacts = sourceFactsForAction(action, learner);
  const dueOverride = action.metadata.dueDateOverride;
  return {
    action,
    history,
    previousOccurrences: occurrences.filter((item) => item.id !== action.id && isOperationalActionTerminal(item.status)),
    context: {
      learnerName: learner.learner.name,
      jobTitle: learner.learner.jobTitle,
      department: learner.learner.department,
      site: learner.learner.site,
      managerName: learner.learner.managerName,
      programmeName: learner.programme.programmeName,
      providerName: learner.programme.providerName,
      sourceReason: derived?.reason ?? action.description,
      sourceFacts,
      workflowLabel: derived?.actionLabel ?? workflowLabelForAction(action.actionType),
      workflowActionType: derived?.actionType ?? workflowActionForAction(action.actionType),
      dueDateOrigin: dueOverride?.date ? "Manual override" : derived?.dueDate ? "Source workflow" : "No source date",
      terminalProtection: isCriticalOperationalBlocker(action.metadata.sourceCondition ?? action.sourceKey, action.priority),
    },
    ownerOptions,
  };
}

export async function acknowledgeOperationalAction(session: LevyTateBetaSession, actionId: string, expectedVersion: number) {
  return transitionAction(session, actionId, expectedVersion, "acknowledged", {});
}

export async function startOperationalAction(session: LevyTateBetaSession, actionId: string, expectedVersion: number) {
  return transitionAction(session, actionId, expectedVersion, "in_progress", {});
}

export async function completeOperationalAction(
  session: LevyTateBetaSession,
  actionId: string,
  expectedVersion: number,
  completionNote = "",
  resolvedOutsideLevyTate = false,
) {
  const context = await requireOperationalActionContext(session, "write");
  const action = await requireScopedAction(context, actionId);
  if (action.status === "completed") return action;
  assertNotApplicationSourceManaged(action);
  assertVersion(action, expectedVersion);
  const details = await listOrganisationLearnerLifecycleDetails(session);
  const currentKeys = new Set(uniqueSourceItems(buildOrganisationOperationalItems(details).items).map((item) => item.sourceKey));
  if (currentKeys.has(action.sourceKey)) {
    throw new LevyTateOperationalActionError("The underlying learner condition is still active. Resolve it in the learner workflow before completing this action.");
  }
  const cleanNote = completionNote.trim();
  if (!resolvedOutsideLevyTate) throw new LevyTateOperationalActionError("Confirm that the issue was resolved outside LevyTate before manually completing this action.");
  if (cleanNote.length < 12) throw new LevyTateOperationalActionError("A completion note of at least 12 characters is required.");
  return transitionScopedAction(context, action, "completed", {
    completion_method: "user_completed",
    completion_note: cleanNote,
  });
}

export type OperationalActionDismissalKind = "not_applicable" | "duplicate_administrative_warning" | "managed_outside_levytate" | "incorrect_source_data" | "no_action_required" | "other";
export type OperationalActionCancellationKind = "duplicate_legacy_action" | "invalidly_generated" | "superseded_administrative_action";
const operationalActionDismissalKinds: OperationalActionDismissalKind[] = ["not_applicable", "duplicate_administrative_warning", "managed_outside_levytate", "incorrect_source_data", "no_action_required", "other"];
const operationalActionCancellationKinds: OperationalActionCancellationKind[] = ["duplicate_legacy_action", "invalidly_generated", "superseded_administrative_action"];

export async function assignOperationalActionOwner(
  session: LevyTateBetaSession,
  actionId: string,
  expectedVersion: number,
  owner: { ownerType: OperationalOwnerType; ownerUserId?: string; ownerDisplayName?: string },
) {
  const context = await requireOperationalActionContext(session, "write");
  const action = await requireScopedAction(context, actionId);
  assertNotApplicationSourceManaged(action);
  assertVersion(action, expectedVersion);
  if (isOperationalActionTerminal(action.status)) throw new LevyTateOperationalActionError("Terminal actions cannot be reassigned.");
  const validOwnerTypes: OperationalOwnerType[] = ["Employee", "Line Manager", "Apprenticeship Lead", "HR", "Provider", "Shared"];
  if (!validOwnerTypes.includes(owner.ownerType)) throw new LevyTateOperationalActionError("A supported owner type is required.");
  const options = await buildOwnerOptions(context, action);
  const requestedUserId = owner.ownerUserId?.trim() ?? "";
  const selected = options.find((option) => option.ownerType === owner.ownerType && option.ownerUserId === requestedUserId);
  if (!selected) throw new LevyTateOperationalActionError("The selected owner is not valid for this action or organisation.");
  const ownerUserId = selected.ownerUserId;
  const ownerDisplayName = selected.label;
  if (action.ownerType === owner.ownerType && action.ownerUserId === ownerUserId && action.ownerDisplayName === ownerDisplayName) return action;
  const updated = await versionedUpdate(context, action, {
    owner_type: owner.ownerType,
    owner_user_id: ownerUserId,
    owner_display_name: ownerDisplayName,
    metadata: {
      ...action.metadata,
      ownershipOverride: {
        ownerType: owner.ownerType,
        ownerUserId,
        ownerDisplayName,
        assignedAt: new Date().toISOString(),
        assignedBy: context.user.id,
      },
    },
  });
  await recordEvent(context, updated, "owner_changed", action.status, action.status, `Action reassigned to ${ownerDisplayName}.`);
  return updated;
}

export async function updateOperationalActionDueDate(
  session: LevyTateBetaSession,
  actionId: string,
  expectedVersion: number,
  dueDate: string,
  reason = "",
) {
  const context = await requireOperationalActionContext(session, "write");
  const action = await requireScopedAction(context, actionId);
  assertNotApplicationSourceManaged(action);
  assertVersion(action, expectedVersion);
  if (isOperationalActionTerminal(action.status)) throw new LevyTateOperationalActionError("Terminal actions cannot have their due date changed.");
  const cleanDate = dueDate.trim();
  if (cleanDate && !/^\d{4}-\d{2}-\d{2}$/.test(cleanDate)) throw new LevyTateOperationalActionError("Enter a valid due date.");
  const details = await listOrganisationLearnerLifecycleDetails(session);
  const derived = buildOrganisationOperationalItems(details).items.find((item) => item.sourceKey === action.sourceKey);
  const sourceDate = derived?.dueDate ?? "";
  const cleanReason = reason.trim();
  if (sourceDate && cleanDate !== sourceDate && cleanReason.length < 12) {
    throw new LevyTateOperationalActionError("Explain why the source-derived due date is being overridden.");
  }
  if (sourceDate && cleanDate && cleanDate < sourceDate) {
    throw new LevyTateOperationalActionError("The manual due date cannot be earlier than the source workflow date.");
  }
  if (action.dueDate === cleanDate && (!action.metadata.dueDateOverride || action.metadata.dueDateOverride.reason === cleanReason)) return action;
  const now = new Date().toISOString();
  const metadata: OperationalActionMetadata = { ...action.metadata };
  if (cleanDate && cleanDate !== sourceDate) {
    metadata.dueDateOverride = { date: cleanDate, reason: cleanReason, sourceDate, setAt: now, setBy: context.user.id };
  } else {
    delete metadata.dueDateOverride;
  }
  const updated = await versionedUpdate(context, action, { due_date: cleanDate || null, metadata });
  await recordEvent(
    context,
    updated,
    "due_date_changed",
    action.status,
    action.status,
    cleanDate ? `Due date changed to ${cleanDate}${cleanReason ? `: ${cleanReason}` : "."}` : "Manual due date removed.",
  );
  return updated;
}

export async function cancelOperationalAction(
  session: LevyTateBetaSession,
  actionId: string,
  expectedVersion: number,
  reason: string,
  category: OperationalActionCancellationKind,
) {
  const context = await requireOperationalActionContext(session, "write");
  const action = await requireScopedAction(context, actionId);
  assertNotApplicationSourceManaged(action);
  if (action.status === "cancelled") return action;
  assertVersion(action, expectedVersion);
  if (!operationalActionCancellationKinds.includes(category)) throw new LevyTateOperationalActionError("A supported cancellation category is required.");
  const cleanReason = reason.trim();
  if (cleanReason.length < 12) throw new LevyTateOperationalActionError("A cancellation reason of at least 12 characters is required.");
  if (isCriticalOperationalBlocker(action.metadata.sourceCondition ?? action.sourceKey, action.priority)) {
    throw new LevyTateOperationalActionError("Critical compliance blockers cannot be cancelled. Resolve the underlying learner condition.");
  }
  const now = new Date().toISOString();
  return transitionScopedAction(context, action, "cancelled", {
    completed_at: now,
    completed_by: context.user.id,
    completion_method: "system_cancelled",
    completion_note: cleanReason,
    metadata: {
      ...action.metadata,
      cancellation: { category, reason: cleanReason, cancelledAt: now, cancelledBy: context.user.id },
    },
  });
}

export async function dismissOperationalAction(
  session: LevyTateBetaSession,
  actionId: string,
  expectedVersion: number,
  reason: string,
  dismissalKind: OperationalActionDismissalKind,
) {
  const context = await requireOperationalActionContext(session, "write");
  const action = await requireScopedAction(context, actionId);
  assertNotApplicationSourceManaged(action);
  if (action.status === "dismissed") return action;
  assertVersion(action, expectedVersion);
  if (!operationalActionDismissalKinds.includes(dismissalKind)) throw new LevyTateOperationalActionError("A supported dismissal category is required.");
  const cleanReason = reason.trim();
  if (cleanReason.length < 12) throw new LevyTateOperationalActionError("A clear dismissal reason of at least 12 characters is required.");
  if (isCriticalOperationalBlocker(action.metadata.sourceCondition ?? action.sourceKey, action.priority)) {
    throw new LevyTateOperationalActionError("Critical compliance blockers cannot be dismissed. Resolve the underlying learner condition.");
  }
  return transitionScopedAction(context, action, "dismissed", {
    completion_method: "dismissed",
    dismissal_reason: cleanReason,
    metadata: { ...action.metadata, dismissalKind, dismissalSuppressesUntilConditionClears: true },
  });
}

export async function getOperationalActionHistory(session: LevyTateBetaSession, actionId: string) {
  const context = await requireOperationalActionContext(session, "read");
  await requireScopedAction(context, actionId);
  return selectActionHistory(context.organisation.id, actionId);
}

async function selectActionHistory(organisationId: string, actionId: string) {
  const config = requireConfig();
  const rows = await supabaseSelect<OperationalActionEventRow>(config, eventsTable, new URLSearchParams({
    select: "*",
    organisation_id: `eq.${organisationId}`,
    operational_action_id: `eq.${actionId}`,
    order: "event_date.asc",
  }));
  return rows.map(eventFromRow);
}

export async function resolveActionsForLearnerConditionChange(session: LevyTateBetaSession, learnerRecordId: string) {
  const result = await synchroniseOrganisationOperationalActions(session);
  return result.actions.filter((action) => action.learnerRecordId === learnerRecordId);
}

export async function resolveManagerCheckInActionsForDirectReport(
  session: LevyTateBetaSession,
  employeeId: string,
  learnerRecordId: string,
) {
  const scope = await getManagerDirectReportContext(session);
  if (!scope.directReports.some((employee) => employee.id === employeeId)) {
    throw new LevyTateLearnerLifecyclePermissionError("This employee is no longer within your direct-report scope.");
  }
  const lifecycleContext = await getLearnerLifecycleServerContext(session);
  if (lifecycleContext.organisation.id !== scope.organisation.id) {
    throw new LevyTateLearnerLifecyclePermissionError("This employee is no longer within your direct-report scope.");
  }
  const details = await listManagerDirectReportLearnerLifecycleDetails(session, scope);
  const detail = details.find((item) => item.learnerRecordId === learnerRecordId && item.learner.id === employeeId);
  if (!detail) throw new LevyTateLearnerLifecyclePermissionError("This employee is no longer within your direct-report scope.");

  const activeSourceKeys = new Set(
    buildOrganisationOperationalItems([detail]).items
      .filter((item) => item.ownerType === "Line Manager" && item.persistentActionType === "record_manager_check_in")
      .map((item) => item.sourceKey),
  );
  const actions = await selectActions(scope.organisation.id, { learnerRecordId, includeTerminal: true });
  const context: ActionContext = { ...lifecycleContext, actorDisplayName: scope.manager.name };
  const now = new Date().toISOString();
  const resolved: PersistentOperationalAction[] = [];

  for (const action of actions) {
    if (isOperationalActionTerminal(action.status)) continue;
    if (action.ownerType !== "Line Manager" || action.actionType !== "record_manager_check_in") continue;
    if (activeSourceKeys.has(action.sourceKey)) continue;
    resolved.push(await transitionSystemResolvedAction(context, action, now));
  }
  return resolved;
}

async function transitionAction(
  session: LevyTateBetaSession,
  actionId: string,
  expectedVersion: number,
  target: "acknowledged" | "in_progress",
  extra: Record<string, unknown>,
) {
  const context = await requireOperationalActionContext(session, "write");
  const action = await requireScopedAction(context, actionId);
  assertNotApplicationSourceManaged(action);
  if (action.status === target) return action;
  assertVersion(action, expectedVersion);
  return transitionScopedAction(context, action, target, extra);
}

async function transitionScopedAction(
  context: ActionContext,
  action: PersistentOperationalAction,
  target: OperationalActionStatus,
  extra: Record<string, unknown>,
  eventSummary?: string,
) {
  if (!canTransitionOperationalAction(action.status, target)) {
    throw new LevyTateOperationalActionError(`${action.status} actions cannot transition to ${target}.`);
  }
  const now = new Date().toISOString();
  const actor = actorName(context);
  const timestamps: Record<string, unknown> = target === "acknowledged"
    ? { acknowledged_at: now, acknowledged_by: context.user.id }
    : target === "in_progress"
      ? { started_at: now, started_by: context.user.id }
      : target === "completed"
        ? { completed_at: now, completed_by: context.user.id }
        : target === "dismissed"
          ? { dismissed_at: now, dismissed_by: context.user.id }
          : {};
  const updated = await versionedUpdate(context, action, { status: target, ...timestamps, ...extra });
  await recordEvent(context, updated, eventTypeForStatus(target), action.status, target, eventSummary ?? `${actor} marked the action ${target.replace("_", " ")}.`);
  return updated;
}

async function updateActionFromDerivedCondition(context: ActionContext, action: PersistentOperationalAction, item: OperationalItem) {
  const changes: Record<string, unknown> = {};
  const events: Array<{ type: OperationalActionEventType; summary: string }> = [];
  if (action.priority !== item.priorityLevel || action.priorityRank !== item.priorityRank) {
    changes.priority = item.priorityLevel;
    changes.priority_rank = item.priorityRank;
    events.push({ type: "priority_changed", summary: `Priority updated from ${action.priority} to ${item.priorityLevel}.` });
  }
  if (!action.metadata.ownershipOverride && action.ownerType !== item.ownerType) {
    changes.owner_type = item.ownerType;
    changes.owner_display_name = item.ownerType;
    changes.owner_user_id = "";
    events.push({ type: "owner_changed", summary: `Owner updated from ${action.ownerType} to ${item.ownerType}.` });
  }
  const sourceDueDate = persistentDueDate(item, action.detectedAt);
  const override = action.metadata.dueDateOverride;
  const overrideRemainsValid = Boolean(override?.date && (!sourceDueDate || override.date >= sourceDueDate));
  const dueDate = overrideRemainsValid ? override!.date : sourceDueDate;
  if ((action.dueDate || null) !== dueDate) {
    changes.due_date = dueDate;
    events.push({ type: "due_date_changed", summary: dueDate ? `Due date updated to ${dueDate}.` : "Due date removed because the source workflow no longer supplies one." });
  }
  if (override && !overrideRemainsValid) {
    const metadata = { ...action.metadata };
    delete metadata.dueDateOverride;
    changes.metadata = metadata;
  } else if (override && override.sourceDate !== (sourceDueDate ?? "")) {
    changes.metadata = { ...action.metadata, dueDateOverride: { ...override, sourceDate: sourceDueDate ?? "" } };
  }
  if (action.title !== actionTitle(item) || action.description !== item.reason || action.sourceUrl !== item.actionUrl || action.actionType !== item.persistentActionType) {
    changes.title = actionTitle(item);
    changes.description = item.reason;
    changes.source_url = item.actionUrl;
    changes.action_type = item.persistentActionType;
  }
  if (!Object.keys(changes).length) return { action, changed: false };
  let updated: PersistentOperationalAction;
  try {
    updated = await versionedUpdate(context, action, changes);
  } catch (error) {
    if (!(error instanceof LevyTateOperationalActionConflictError)) throw error;
    return { action: await requireScopedAction(context, action.id), changed: false };
  }
  for (const event of events) await recordEvent(context, updated, event.type, action.status, updated.status, event.summary);
  return { action: updated, changed: true };
}

async function createActionForCondition(
  context: ActionContext,
  item: OperationalItem,
  references: { applicationId: string; employeeId: string; priorActionId?: string },
) {
  const config = requireConfig();
  const now = new Date().toISOString();
  const id = createMvpId("operational-action");
  const metadata: OperationalActionMetadata = {
    sourceCondition: item.sourceCondition,
    ...(references.priorActionId ? { priorActionId: references.priorActionId } : {}),
  };
  const row = {
    organisation_id: context.organisation.id,
    id,
    learner_record_id: item.learnerRecordId,
    application_id: references.applicationId,
    employee_id: references.employeeId,
    source_type: item.sourceType,
    source_key: item.sourceKey,
    action_type: item.persistentActionType,
    title: actionTitle(item),
    description: item.reason,
    priority: item.priorityLevel,
    priority_rank: operationalPriorityRanks[item.priorityLevel],
    status: "open",
    owner_type: item.ownerType,
    owner_user_id: "",
    owner_display_name: item.ownerType,
    due_date: persistentDueDate(item, now),
    detected_at: now,
    source_url: item.actionUrl,
    metadata,
    version: 1,
  };
  let inserted: OperationalActionRow[];
  try {
    inserted = await supabaseInsert<OperationalActionRow>(config, actionsTable, row);
  } catch (error) {
    if (!(error instanceof LevyTateSupabaseError) || !/duplicate|23505/i.test(error.message)) throw error;
    const concurrent = await selectActions(context.organisation.id, { sourceKey: item.sourceKey });
    const active = concurrent.find((action) => !isOperationalActionTerminal(action.status));
    if (!active) throw error;
    return active;
  }
  const created = actionFromRow(inserted[0]);
  await recordEvent(context, created, "detected", "", "open", "Operational condition detected.");
  if (references.priorActionId) {
    await recordEvent(context, created, "regenerated", "", "open", "A new occurrence was created after the previous condition had resolved.", { priorActionId: references.priorActionId });
  }
  return created;
}

async function transitionSystemResolvedAction(context: ActionContext, action: PersistentOperationalAction, now: string) {
  if (isOperationalActionTerminal(action.status)) return action;
  let updated: PersistentOperationalAction;
  try {
    updated = await versionedUpdate(context, action, {
      status: "completed",
      completed_at: now,
      completed_by: "system",
      completion_method: "source_condition_resolved",
      completion_note: "The underlying lifecycle condition no longer applies.",
    });
  } catch (error) {
    if (!(error instanceof LevyTateOperationalActionConflictError)) throw error;
    const concurrent = await requireScopedAction(context, action.id);
    if (isOperationalActionTerminal(concurrent.status)) return concurrent;
    throw error;
  }
  await recordEvent(context, updated, "completed", action.status, "completed", "Underlying learner condition resolved automatically.");
  return updated;
}

async function markDismissedConditionCleared(context: ActionContext, action: PersistentOperationalAction, now: string) {
  try {
    await versionedUpdate(context, action, { metadata: { ...action.metadata, conditionClearedAt: now } });
  } catch (error) {
    if (!(error instanceof LevyTateOperationalActionConflictError)) throw error;
  }
}

async function versionedUpdate(context: ActionContext, action: PersistentOperationalAction, changes: Record<string, unknown>) {
  const config = requireConfig();
  const query = new URLSearchParams({
    organisation_id: `eq.${context.organisation.id}`,
    id: `eq.${action.id}`,
    version: `eq.${action.version}`,
  }).toString();
  const rows = await supabaseUpdate<OperationalActionRow>(config, actionsTable, query, { ...changes, version: action.version + 1 });
  if (!rows.length) throw new LevyTateOperationalActionConflictError("The action changed in another session. Refresh and try again.");
  return actionFromRow(rows[0]);
}

async function requireScopedAction(context: ActionContext, actionId: string) {
  const config = requireConfig();
  const rows = await supabaseSelect<OperationalActionRow>(config, actionsTable, new URLSearchParams({
    select: "*",
    organisation_id: `eq.${context.organisation.id}`,
    id: `eq.${actionId}`,
    limit: "1",
  }));
  if (!rows.length) throw new LevyTateOperationalActionError("Operational action was not found.");
  return actionFromRow(rows[0]);
}

async function selectActions(organisationId: string, query: OperationalActionListQuery) {
  const config = requireConfig();
  const params = new URLSearchParams({
    select: "*",
    organisation_id: `eq.${organisationId}`,
    order: "created_at.desc",
    limit: "5000",
  });
  if (query.learnerRecordId) params.set("learner_record_id", `eq.${query.learnerRecordId}`);
  if (query.sourceKey) params.set("source_key", `eq.${query.sourceKey}`);
  if (query.status) params.set("status", `eq.${query.status}`);
  else if (!query.includeTerminal) params.set("status", `in.(${nonTerminalOperationalActionStatuses.join(",")})`);
  const rows = await supabaseSelect<OperationalActionRow>(config, actionsTable, params);
  return rows.map(actionFromRow);
}

async function recordEvent(
  context: ActionContext,
  action: PersistentOperationalAction,
  eventType: OperationalActionEventType,
  previousStatus: OperationalActionStatus | "",
  newStatus: OperationalActionStatus | "",
  summary: string,
  metadata: Record<string, unknown> = {},
) {
  const config = requireConfig();
  const now = new Date().toISOString();
  await supabaseInsert<OperationalActionEventRow>(config, eventsTable, {
    organisation_id: context.organisation.id,
    id: `${action.id}:${action.version}:${eventType}`,
    operational_action_id: action.id,
    event_type: eventType,
    previous_status: previousStatus,
    new_status: newStatus,
    actor_user_id: eventType === "detected" || eventType === "regenerated" ? "system" : context.user.id,
    actor_name: eventType === "detected" || eventType === "regenerated" ? "LevyTate" : actorName(context),
    event_date: now,
    summary,
    metadata,
    created_at: now,
  }, { prefer: "resolution=ignore-duplicates,return=representation" });
}

async function requireOperationalActionContext(session: LevyTateBetaSession, access: "read" | "write") {
  const context = await getLearnerLifecycleServerContext(session);
  const permission = access === "read" ? "operationalActions:read" : "operationalActions:write";
  if (!hasMvpPermission(context.user.role, permission)) {
    throw new LevyTateLearnerLifecyclePermissionError(`${normaliseMvpUserRole(context.user.role)} cannot access organisation operational actions.`);
  }
  const config = requireConfig();
  const actors = await supabaseSelect<{ name: string }>(config, "levytate_employees", new URLSearchParams({
    select: "name",
    organisation_id: `eq.${context.organisation.id}`,
    email: `eq.${context.user.email}`,
    limit: "1",
  }));
  return { ...context, actorDisplayName: actors[0]?.name || context.user.email };
}

type ManagerActionContext = ActionContext & {
  scope: ManagerDirectReportContext;
  details: LearnerRecordDetail[];
  applications: ManagerDirectReportApplication[];
};

async function managerOperationalActionContext(session: LevyTateBetaSession): Promise<ManagerActionContext> {
  const scope = await getManagerDirectReportContext(session);
  const [lifecycleContext, details, applications] = await Promise.all([
    getLearnerLifecycleServerContext(session),
    listManagerDirectReportLearnerLifecycleDetails(session, scope),
    listManagerDirectReportApplications(session, scope),
  ]);
  if (lifecycleContext.organisation.id !== scope.organisation.id || lifecycleContext.user.id !== scope.user.id) {
    throw new LevyTateManagerOperationalActionAccessError();
  }
  return { ...lifecycleContext, actorDisplayName: scope.manager.name, scope, details, applications };
}

function requireManagerActionAccess(context: ManagerActionContext, action: PersistentOperationalAction) {
  if (!isManagerRelevantPersistentAction(action, context.scope.user.id)) {
    throw new LevyTateManagerOperationalActionAccessError();
  }
  const directReport = context.scope.directReports.find((employee) => employee.id === action.employeeId);
  if (!directReport) {
    throw new LevyTateManagerOperationalActionAccessError();
  }
  if (action.actionType === "review_application") {
    const application = context.applications.find((item) => item.id === action.applicationId && item.employee.id === action.employeeId);
    if (!application) throw new LevyTateManagerOperationalActionAccessError();
    return { kind: "application_review" as const, application };
  }
  const detail = context.details.find((item) => item.learnerRecordId === action.learnerRecordId && item.learner.id === action.employeeId);
  if (!detail) throw new LevyTateManagerOperationalActionAccessError();
  return { kind: "learner" as const, detail };
}

async function requireManagerScopedAction(context: ManagerActionContext, actionId: string) {
  try {
    return await requireScopedAction(context, actionId);
  } catch (error) {
    if (error instanceof LevyTateOperationalActionConflictError) throw error;
    throw new LevyTateManagerOperationalActionAccessError();
  }
}

type ActionEmployeeRow = {
  id: string;
  name: string;
  email: string;
  manager_id: string;
  department: string;
  platform_role: string;
  status: string;
};

type ActionUserRow = { id: string; email: string; role: string };

async function buildOwnerOptions(context: ActionContext, action: PersistentOperationalAction): Promise<OperationalActionOwnerOption[]> {
  const config = requireConfig();
  const [employees, users, learnerRows] = await Promise.all([
    supabaseSelect<ActionEmployeeRow>(config, "levytate_employees", new URLSearchParams({
      select: "id,name,email,manager_id,department,platform_role,status",
      organisation_id: `eq.${context.organisation.id}`,
      status: "eq.Active",
      limit: "5000",
    })),
    supabaseSelect<ActionUserRow>(config, "levytate_users", new URLSearchParams({
      select: "id,email,role",
      organisation_id: `eq.${context.organisation.id}`,
      limit: "5000",
    })),
    supabaseSelect<{ provider_id: string }>(config, "levytate_learner_records", new URLSearchParams({
      select: "provider_id",
      organisation_id: `eq.${context.organisation.id}`,
      id: `eq.${action.learnerRecordId}`,
      limit: "1",
    })),
  ]);
  const userByEmail = new Map(users.map((user) => [user.email.toLowerCase(), user]));
  const employee = employees.find((item) => item.id === action.employeeId);
  const manager = employee?.manager_id ? employees.find((item) => item.id === employee.manager_id) : undefined;
  const providerId = learnerRows[0]?.provider_id ?? "";
  const providerRows = providerId ? await supabaseSelect<{ provider_name: string }>(config, "levytate_providers", new URLSearchParams({
    select: "provider_name",
    organisation_id: `eq.${context.organisation.id}`,
    provider_id: `eq.${providerId}`,
    limit: "1",
  })) : [];
  const options: OperationalActionOwnerOption[] = [];
  if (employee) {
    const user = userByEmail.get(employee.email.toLowerCase());
    options.push({ ownerType: "Employee", ownerUserId: user?.id ?? "", label: employee.name, accessNote: user ? "Platform user" : "Accountability only, no platform account" });
  }
  if (manager) {
    const user = userByEmail.get(manager.email.toLowerCase());
    options.push({ ownerType: "Line Manager", ownerUserId: user?.id ?? "", label: manager.name, accessNote: user ? "Platform user" : "Accountability only, no platform account" });
  }
  for (const user of users.filter((item) => ["Apprenticeship Lead", "Employer Admin"].includes(normaliseMvpUserRole(item.role)))) {
    const person = employees.find((item) => item.email.toLowerCase() === user.email.toLowerCase());
    options.push({ ownerType: "Apprenticeship Lead", ownerUserId: user.id, label: person?.name || user.email, accessNote: "Authorised organisation user" });
  }
  const hrPeople = employees.filter((item) => /^(hr|people)/i.test(item.department));
  if (hrPeople.length) {
    for (const person of hrPeople) {
      const user = userByEmail.get(person.email.toLowerCase());
      options.push({ ownerType: "HR", ownerUserId: user?.id ?? "", label: person.name, accessNote: user ? "Platform user" : "Accountability only, no platform account" });
    }
  } else {
    options.push({ ownerType: "HR", ownerUserId: "", label: "HR", accessNote: "Accountability label, no platform access implied" });
  }
  options.push({ ownerType: "Provider", ownerUserId: "", label: providerRows[0]?.provider_name || "Approved delivery partner", accessNote: "Accountability label, no provider access implied" });
  options.push({ ownerType: "Shared", ownerUserId: "", label: "Shared", accessNote: "Shared organisation accountability" });
  return options.filter((option, index, all) => all.findIndex((item) => item.ownerType === option.ownerType && item.ownerUserId === option.ownerUserId && item.label === option.label) === index);
}

function sourceFactsForAction(action: PersistentOperationalAction, detail: LearnerRecordDetail) {
  const facts: Array<{ label: string; value: string }> = [];
  const add = (label: string, value: string | number | null | undefined, suffix = "") => {
    if (value === undefined || value === null || value === "") return;
    facts.push({ label, value: `${value}${suffix}` });
  };
  if (action.actionType === "record_provider_review") {
    add("Latest provider review", detail.latestProviderReview?.reviewDate);
    add("Expected next review", detail.reviewSummaries.provider.nextDate);
    add("Provider", detail.programme.providerName);
  } else if (["add_progress_update", "address_progress_exception"].includes(action.actionType)) {
    add("Target progress", detail.latestProgress?.targetProgressPercentage, "%");
    add("Actual progress", detail.latestProgress?.actualProgressPercentage, "%");
    add("Variance", detail.latestProgress?.variancePercentage, " percentage points");
    add("Latest update", detail.latestProgress?.updateDate);
    add("Support action", detail.latestProgress?.supportAction);
  } else if (["manage_break_in_learning", "confirm_return_date", "return_learner", "record_post_return_review"].includes(action.actionType)) {
    add("Break started", detail.latestBreak?.startDate);
    add("Expected return", detail.latestBreak?.expectedReturnDate);
    add("Actual return", detail.latestBreak?.actualReturnDate);
    add("Days on break", detail.breakAttention.daysOnBreak, " days");
    add("Confirmation status", detail.breakAttention.label);
  } else if (["complete_employee_declaration", "verify_england_working_hours", "confirm_probation", "obtain_hr_approval", "confirm_programme", "confirm_provider", "complete_pre_enrolment", "complete_enrolment", "send_guides"].includes(action.actionType)) {
    add("Outstanding check", action.title.replace(/ for .+$/, ""));
    add("Current position", action.description);
    add("Responsible owner", action.ownerDisplayName || action.ownerType);
  }
  if (!facts.length) add("Current position", action.description);
  return facts;
}

function workflowActionForAction(actionType: PersistentOperationalAction["actionType"]): OperationalItem["actionType"] {
  if (actionType === "complete_enrolment") return "complete_enrolment";
  if (["record_provider_review", "record_l_and_d_check_in", "record_manager_check_in", "record_post_return_review"].includes(actionType)) return "record_review";
  if (["add_progress_update", "address_progress_exception"].includes(actionType)) return "add_progress";
  if (actionType === "return_learner") return "return_learner";
  if (["manage_break_in_learning", "confirm_return_date"].includes(actionType)) return "manage_break";
  if (["confirm_assessment_model", "confirm_assessment_organisation", "complete_assessment_readiness", "obtain_provider_readiness_confirmation", "obtain_manager_readiness_confirmation", "obtain_learner_readiness_confirmation", "record_gateway", "move_learner_to_assessment"].includes(actionType)) return "manage_assessment";
  return "complete_pre_enrolment";
}

function workflowLabelForAction(actionType: PersistentOperationalAction["actionType"]) {
  const action = workflowActionForAction(actionType);
  return {
    open_learner: "Open learner record",
    complete_pre_enrolment: actionType === "send_guides" ? "Send guides record" : "Complete pre-enrolment",
    complete_enrolment: "Complete enrolment",
    record_review: actionType === "record_provider_review" ? "Record provider review" : "Record check-in",
    add_progress: "Add progress update",
    manage_break: "Manage break",
    return_learner: "Return learner",
    manage_assessment: "Manage assessment readiness",
  }[action];
}

function uniqueSourceItems(items: OperationalItem[]) {
  const bySource = new Map<string, OperationalItem>();
  for (const item of items) {
    const existing = bySource.get(item.sourceKey);
    if (!existing || item.priorityRank < existing.priorityRank || (item.daysOverdue ?? 0) > (existing.daysOverdue ?? 0)) {
      bySource.set(item.sourceKey, item);
    }
  }
  return Array.from(bySource.values());
}

function latestActionsBySource(actions: PersistentOperationalAction[]) {
  const latest = new Map<string, PersistentOperationalAction>();
  for (const action of actions) if (!latest.has(action.sourceKey)) latest.set(action.sourceKey, action);
  return latest;
}

function actionTitle(item: OperationalItem) {
  const labels: Record<PersistentOperationalAction["actionType"], string> = {
    complete_employee_declaration: "Complete employee declaration",
    verify_england_working_hours: "Verify England working hours",
    confirm_probation: "Confirm probation",
    obtain_hr_approval: "Obtain HR approval",
    confirm_programme: "Confirm programme",
    confirm_provider: "Confirm provider",
    complete_pre_enrolment: "Complete pre-enrolment",
    complete_enrolment: "Complete enrolment",
    record_provider_review: "Record provider review",
    record_l_and_d_check_in: "Record L&D check-in",
    record_manager_check_in: "Record manager check-in",
    add_progress_update: "Add progress update",
    address_progress_exception: "Address progress exception",
    manage_break_in_learning: "Manage Break in Learning",
    confirm_return_date: "Confirm return date",
    return_learner: "Return learner",
    record_post_return_review: "Record post-return review",
    send_guides: "Send learner and manager guides",
    resolve_lifecycle_inconsistency: "Resolve lifecycle inconsistency",
    confirm_assessment_model: "Confirm assessment model",
    confirm_assessment_organisation: "Confirm assessment organisation",
    complete_assessment_readiness: "Complete assessment readiness",
    obtain_provider_readiness_confirmation: "Obtain provider readiness confirmation",
    obtain_manager_readiness_confirmation: "Obtain manager readiness confirmation",
    obtain_learner_readiness_confirmation: "Obtain learner readiness confirmation",
    record_gateway: "Record gateway",
    move_learner_to_assessment: "Move learner to assessment",
    review_application: "Review application",
  };
  return `${labels[item.persistentActionType]} for ${item.learnerName}`;
}

function persistentDueDate(item: OperationalItem, detectedAt: string) {
  if (item.sourceCondition !== "ready_to_enrol") return item.dueDate || null;
  const due = new Date(detectedAt);
  due.setUTCDate(due.getUTCDate() + operationsPolicy.enrolmentReadyHighPriorityAfterDays);
  return due.toISOString().slice(0, 10);
}

function eventTypeForStatus(status: OperationalActionStatus): OperationalActionEventType {
  if (status === "acknowledged") return "acknowledged";
  if (status === "in_progress") return "started";
  return status as Extract<OperationalActionEventType, "completed" | "dismissed" | "cancelled">;
}

function assertVersion(action: PersistentOperationalAction, expectedVersion: number) {
  if (!Number.isInteger(expectedVersion) || expectedVersion !== action.version) {
    throw new LevyTateOperationalActionConflictError("The action changed in another session. Refresh and try again.");
  }
}

function assertNotApplicationSourceManaged(action: PersistentOperationalAction) {
  if (action.actionType === "review_application") {
    throw new LevyTateOperationalActionError("Application review actions are resolved only through the authoritative Approvals workflow.");
  }
}

function requireConfig() {
  const config = getLevyTateSupabaseConfig();
  if (!config) throw new LevyTateOperationalActionError("Operational actions require the configured Supabase service connection.");
  return config;
}

function actorName(context: ActionContext) {
  return context.actorDisplayName;
}

function actionFromRow(row: OperationalActionRow): PersistentOperationalAction {
  return {
    organisationId: row.organisation_id,
    id: row.id,
    learnerRecordId: row.learner_record_id ?? "",
    applicationId: row.application_id,
    employeeId: row.employee_id,
    sourceType: row.source_type,
    sourceKey: row.source_key,
    actionType: row.action_type,
    title: row.title,
    description: row.description,
    priority: row.priority,
    priorityRank: row.priority_rank,
    status: row.status,
    ownerType: row.owner_type,
    ownerUserId: row.owner_user_id,
    ownerDisplayName: row.owner_display_name,
    dueDate: row.due_date ?? "",
    detectedAt: row.detected_at,
    acknowledgedAt: row.acknowledged_at ?? "",
    acknowledgedBy: row.acknowledged_by,
    startedAt: row.started_at ?? "",
    startedBy: row.started_by,
    completedAt: row.completed_at ?? "",
    completedBy: row.completed_by,
    completionMethod: row.completion_method,
    completionNote: row.completion_note,
    dismissedAt: row.dismissed_at ?? "",
    dismissedBy: row.dismissed_by,
    dismissalReason: row.dismissal_reason,
    sourceUrl: row.source_url,
    metadata: row.metadata ?? {},
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function eventFromRow(row: OperationalActionEventRow): OperationalActionEvent {
  return {
    organisationId: row.organisation_id,
    id: row.id,
    operationalActionId: row.operational_action_id,
    eventType: row.event_type,
    previousStatus: row.previous_status,
    newStatus: row.new_status,
    actorUserId: row.actor_user_id,
    actorName: row.actor_name,
    eventDate: row.event_date,
    summary: row.summary,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
  };
}
