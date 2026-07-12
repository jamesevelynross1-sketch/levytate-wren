import type { LevyTateBetaSession } from "@/lib/levytate/config/beta-access";
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
import { createMvpId } from "@/lib/levytate/mvp/workspace";
import {
  getLearnerLifecycleServerContext,
  listOrganisationLearnerLifecycleDetails,
  LevyTateLearnerLifecyclePermissionError,
} from "@/lib/server/levytate-learner-lifecycle";
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
  learner_record_id: string;
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

type ActionContext = Awaited<ReturnType<typeof getLearnerLifecycleServerContext>>;

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

export type OperationalActionListQuery = {
  learnerRecordId?: string;
  status?: OperationalActionStatus;
  sourceKey?: string;
  includeTerminal?: boolean;
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
  const activeBySource = new Map(existing.filter((action) => !isOperationalActionTerminal(action.status)).map((action) => [action.sourceKey, action]));
  const latestBySource = latestActionsBySource(existing);
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

  for (const action of existing) {
    if (action.status !== "dismissed" || currentSourceKeys.has(action.sourceKey) || action.metadata.conditionClearedAt) continue;
    await markDismissedConditionCleared(context, action, now);
  }

  return result;
}

export async function listOperationalActions(session: LevyTateBetaSession, query: OperationalActionListQuery = {}) {
  const context = await requireOperationalActionContext(session, "read");
  return selectActions(context.organisation.id, query);
}

export async function getOperationalAction(session: LevyTateBetaSession, actionId: string) {
  const context = await requireOperationalActionContext(session, "read");
  return requireScopedAction(context, actionId);
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
) {
  const context = await requireOperationalActionContext(session, "write");
  const action = await requireScopedAction(context, actionId);
  if (action.status === "completed") return action;
  assertVersion(action, expectedVersion);
  const details = await listOrganisationLearnerLifecycleDetails(session);
  const currentKeys = new Set(uniqueSourceItems(buildOrganisationOperationalItems(details).items).map((item) => item.sourceKey));
  if (currentKeys.has(action.sourceKey)) {
    throw new LevyTateOperationalActionError("The underlying learner condition is still active. Resolve it in the learner workflow before completing this action.");
  }
  return transitionScopedAction(context, action, "completed", {
    completion_method: "user_completed",
    completion_note: completionNote.trim(),
  });
}

export type OperationalActionDismissalKind = "not_applicable" | "duplicate_administrative_warning" | "managed_outside_levytate";

export async function assignOperationalActionOwner(
  session: LevyTateBetaSession,
  actionId: string,
  expectedVersion: number,
  owner: { ownerType: OperationalOwnerType; ownerUserId?: string; ownerDisplayName?: string },
) {
  const context = await requireOperationalActionContext(session, "write");
  const action = await requireScopedAction(context, actionId);
  assertVersion(action, expectedVersion);
  if (isOperationalActionTerminal(action.status)) throw new LevyTateOperationalActionError("Terminal actions cannot be reassigned.");
  const ownerUserId = owner.ownerUserId?.trim() ?? "";
  let ownerDisplayName = owner.ownerDisplayName?.trim() || owner.ownerType;
  if (ownerUserId) {
    if (owner.ownerType === "Provider") throw new LevyTateOperationalActionError("Provider ownership does not grant provider platform access.");
    const config = requireConfig();
    const users = await supabaseSelect<{ id: string; email: string }>(config, "levytate_users", new URLSearchParams({
      select: "id,email",
      organisation_id: `eq.${context.organisation.id}`,
      id: `eq.${ownerUserId}`,
      limit: "1",
    }));
    if (!users.length) throw new LevyTateOperationalActionError("The selected owner is not an active member of this organisation.");
    ownerDisplayName = users[0].email;
  }
  if (action.ownerType === owner.ownerType && action.ownerUserId === ownerUserId && action.ownerDisplayName === ownerDisplayName) return action;
  const updated = await versionedUpdate(context, action, {
    owner_type: owner.ownerType,
    owner_user_id: ownerUserId,
    owner_display_name: ownerDisplayName,
  });
  await recordEvent(context, updated, "owner_changed", action.status, action.status, `Action reassigned to ${ownerDisplayName}.`);
  return updated;
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
  if (action.status === "dismissed") return action;
  assertVersion(action, expectedVersion);
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
  const config = requireConfig();
  const rows = await supabaseSelect<OperationalActionEventRow>(config, eventsTable, new URLSearchParams({
    select: "*",
    organisation_id: `eq.${context.organisation.id}`,
    operational_action_id: `eq.${actionId}`,
    order: "event_date.asc",
  }));
  return rows.map(eventFromRow);
}

export async function resolveActionsForLearnerConditionChange(session: LevyTateBetaSession, learnerRecordId: string) {
  const result = await synchroniseOrganisationOperationalActions(session);
  return result.actions.filter((action) => action.learnerRecordId === learnerRecordId);
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
  if (action.status === target) return action;
  assertVersion(action, expectedVersion);
  return transitionScopedAction(context, action, target, extra);
}

async function transitionScopedAction(
  context: ActionContext,
  action: PersistentOperationalAction,
  target: OperationalActionStatus,
  extra: Record<string, unknown>,
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
  await recordEvent(context, updated, eventTypeForStatus(target), action.status, target, `${actor} marked the action ${target.replace("_", " ")}.`);
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
  if (action.ownerType !== item.ownerType) {
    changes.owner_type = item.ownerType;
    changes.owner_display_name = item.ownerType;
    changes.owner_user_id = "";
    events.push({ type: "owner_changed", summary: `Owner updated from ${action.ownerType} to ${item.ownerType}.` });
  }
  const dueDate = persistentDueDate(item, action.detectedAt);
  if ((action.dueDate || null) !== dueDate) {
    changes.due_date = dueDate;
    events.push({ type: "due_date_changed", summary: dueDate ? `Due date updated to ${dueDate}.` : "Due date removed because the source workflow no longer supplies one." });
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
  return context;
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

function requireConfig() {
  const config = getLevyTateSupabaseConfig();
  if (!config) throw new LevyTateOperationalActionError("Operational actions require the configured Supabase service connection.");
  return config;
}

function actorName(context: ActionContext) {
  return context.user.email;
}

function actionFromRow(row: OperationalActionRow): PersistentOperationalAction {
  return {
    organisationId: row.organisation_id,
    id: row.id,
    learnerRecordId: row.learner_record_id,
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
