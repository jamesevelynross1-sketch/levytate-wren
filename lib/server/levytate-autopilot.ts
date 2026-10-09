import { randomUUID } from "node:crypto";
import type { MicrosoftCopilotActor } from "@/lib/levytate/microsoft-copilot";
import type { LevyTateBetaSession } from "@/lib/levytate/config/beta-access";
import { interpretAutopilotSignal } from "@/lib/levytate/autopilot/ai";
import {
  analyseOperationsAutopilot,
  autopilotAnalyserVersion,
  buildOperationsBrief,
  reconcileAutopilotSignals,
  type AutopilotActionInput,
  type AutopilotApplicationInput,
  type AutopilotLane,
  type AutopilotPersistedSignal,
  type DetectedAutopilotSignal,
} from "@/lib/levytate/autopilot/operations-autopilot";
import { hasMvpPermission, normaliseMvpUserRole } from "@/lib/levytate/mvp/rbac";
import { deriveApplicationWorkflowCompatibility } from "@/lib/levytate/application-workflows/compatibility";
import type { OperationalOwnerType, OperationalPriorityLevel } from "@/lib/levytate/mvp/operations-centre";
import { getLearnerLifecycleServerContext, listOrganisationLearnerLifecycleDetails, LevyTateLearnerLifecyclePermissionError } from "@/lib/server/levytate-learner-lifecycle";
import { listOperationalActions } from "@/lib/server/levytate-operational-actions";
import { getLevyTateSupabaseConfig, supabaseInsert, supabaseSelect, supabaseUpdate } from "@/lib/server/levytate-supabase";
import { getWorkspaceBootstrapForMicrosoftCopilotActor, getWorkspaceBootstrapForSession } from "@/lib/server/levytate-workspace";

const signalsTable = "levytate_intelligence_signals";
const eventsTable = "levytate_intelligence_signal_events";
const priorityMap: Record<DetectedAutopilotSignal["priority"], OperationalPriorityLevel> = { action_now: "High", this_week: "Medium", upcoming: "Low" };
const priorityRank: Record<OperationalPriorityLevel, number> = { Critical: 0, High: 1, Medium: 2, Low: 3, Informational: 4 };
const ownerTypes: OperationalOwnerType[] = ["Employee", "Line Manager", "Apprenticeship Lead", "HR", "Provider", "Shared"];
const actionTypes = new Set(["record_provider_review", "record_l_and_d_check_in", "record_manager_check_in", "review_application", "confirm_provider"]);

type SignalRow = {
  organisation_id: string; id: string; fingerprint: string; signal_key: string; entity_type: DetectedAutopilotSignal["entityType"]; entity_id: string;
  learner_record_id: string | null; provider_id: string | null; programme_id: string | null; category: DetectedAutopilotSignal["category"];
  signal_type: DetectedAutopilotSignal["signalType"]; lane: DetectedAutopilotSignal["lane"]; autopilot_priority: DetectedAutopilotSignal["priority"];
  title: string; summary: string; evidence: DetectedAutopilotSignal["evidence"]; confidence: "High"; priority: OperationalPriorityLevel;
  recommended_action: string; suggested_owner_type: OperationalOwnerType; suggested_due_date: string | null; suggested_action_type: string;
  deterministic_payload: Record<string, unknown>; ai_interpretation: DetectedAutopilotSignal["interpretation"] | null; communication_draft: string;
  status: AutopilotPersistedSignal["status"]; linked_operational_action_id: string | null; analyser_version: string; model_identifier: string;
  detected_at: string; last_evaluated_at: string; resolved_at: string | null; acknowledged_by: string; acknowledged_at: string | null;
  dismissed_by: string; dismissed_at: string | null; dismissal_reason: string; created_at?: string; updated_at?: string;
};

type LearnerLinkRow = { employee_id: string; application_id: string };
type ExistingActionRow = { id: string };
type MicrosoftActionRow = {
  id: string; learner_record_id: string | null; application_id: string; employee_id: string; title: string; description: string;
  action_type: string; owner_type: OperationalOwnerType; due_date: string | null; status: string; source_url: string; updated_at: string;
};

export class LevyTateAutopilotError extends Error {
  constructor(message: string, public readonly status = 400) { super(message); this.name = "LevyTateAutopilotError"; }
}

export async function getAutopilotWorkspace(session: LevyTateBetaSession) {
  const context = await autopilotContext(session, false);
  const rows = await selectRows(context.organisation.id);
  const cutoff = Date.now() - 14 * 86_400_000;
  const signals = rows.map(fromRow).filter((signal) => signal.status !== "dismissed" && (signal.status !== "resolved" || Date.parse(signal.resolvedAt ?? "") >= cutoff));
  return presentWorkspace(signals, new Date().toISOString());
}

export async function getAutopilotWorkspaceForMicrosoftCopilotActor(actor: MicrosoftCopilotActor) {
  await getWorkspaceBootstrapForMicrosoftCopilotActor(actor);
  assertMicrosoftCopilotAutopilotRole(actor, false);
  const rows = await selectRows(actor.organisationId);
  const cutoff = Date.now() - 14 * 86_400_000;
  const signals = rows.map(fromRow).filter((signal) => signal.status !== "dismissed" && (signal.status !== "resolved" || Date.parse(signal.resolvedAt ?? "") >= cutoff));
  return presentWorkspace(signals, new Date().toISOString());
}

export async function refreshAutopilotWorkspace(session: LevyTateBetaSession) {
  const context = await autopilotContext(session, true);
  const [details, actions, bootstrap, existingRows] = await Promise.all([
    listOrganisationLearnerLifecycleDetails(session),
    listOperationalActions(session, { includeTerminal: true }),
    getWorkspaceBootstrapForSession(session),
    selectRows(context.organisation.id),
  ]);
  const now = new Date().toISOString();
  const employees = new Map(bootstrap.data.employees.map((employee) => [employee.id, employee.name]));
  const actionInputs: AutopilotActionInput[] = actions.map((action) => ({
    id: action.id, learnerRecordId: action.learnerRecordId, applicationId: action.applicationId, employeeId: action.employeeId,
    title: action.title, description: action.description, actionType: action.actionType, ownerType: action.ownerType, dueDate: action.dueDate,
    status: action.status, sourceUrl: action.sourceUrl, updatedAt: action.updatedAt,
  }));
  const applicationInputs: AutopilotApplicationInput[] = bootstrap.data.applications.map((application) => {
    const workflow = deriveApplicationWorkflowCompatibility(application);
    return {
      id: application.id, employeeId: application.employeeId, employeeName: employees.get(application.employeeId) ?? "Employee",
      status: workflow.status, currentOwner: workflow.currentOwner, updatedAt: workflow.lastProgressedAt,
      currentStepLabel: workflow.currentStepLabel, currentResponsibleRole: workflow.currentResponsibleRole,
    };
  });
  const detected = analyseOperationsAutopilot({
    organisationId: context.organisation.id, now,
    learners: details.map((detail) => ({
      learnerRecordId: detail.learnerRecordId, learnerName: detail.learner.name,
      providerId: detail.programme.providerId, providerName: detail.programme.providerName,
      programmeId: detail.programme.programmeId, programmeName: detail.programme.programmeName,
      reviews: detail.reviewHistory
        .filter((review) => ["provider_review", "l_and_d_check_in", "manager_check_in"].includes(review.reviewType))
        .map((review) => ({ id: review.id, type: review.reviewType as "provider_review" | "l_and_d_check_in" | "manager_check_in", nextReviewDate: review.nextReviewDate, reviewDate: review.reviewDate, status: review.status })),
    })),
    actions: actionInputs, applications: applicationInputs,
  });
  const existing = existingRows.map(fromRow);
  const existingByKey = new Map(existing.map((signal) => [signal.signalKey, signal]));
  const enriched = await Promise.all(detected.map(async (signal) => {
    const prior = existingByKey.get(signal.signalKey);
    if (prior && prior.fingerprint === signal.fingerprint) return { ...signal, interpretation: prior.interpretation };
    return { ...signal, interpretation: await interpretAutopilotSignal(signal) };
  }));
  const reconciled = reconcileAutopilotSignals(existing, enriched, now);
  await persistReconciliation(context.organisation.id, context.user.id, context.user.email, existing, reconciled);
  return presentWorkspace(reconciled.filter((signal) => signal.status !== "dismissed"), now);
}

export async function refreshAutopilotWorkspaceForMicrosoftCopilotActor(actor: MicrosoftCopilotActor) {
  assertMicrosoftCopilotAutopilotRole(actor, true);
  const [{ data }, actionRows, existingRows] = await Promise.all([
    getWorkspaceBootstrapForMicrosoftCopilotActor(actor),
    supabaseSelect<MicrosoftActionRow>(requireConfig(), "levytate_operational_actions", new URLSearchParams({
      select: "id,learner_record_id,application_id,employee_id,title,description,action_type,owner_type,due_date,status,source_url,updated_at",
      organisation_id: `eq.${actor.organisationId}`,
      order: "updated_at.desc",
      limit: "1000",
    })),
    selectRows(actor.organisationId),
  ]);
  const now = new Date().toISOString();
  const employees = new Map(data.employees.map((employee) => [employee.id, employee.name]));
  const programmes = new Map(data.providerProgrammes.map((programme) => [programme.id, programme]));
  const detected = analyseOperationsAutopilot({
    organisationId: actor.organisationId,
    now,
    learners: data.learnerRecords.map((record) => {
      const programme = programmes.get(record.programmeId);
      return {
        learnerRecordId: record.id,
        learnerName: employees.get(record.employeeId) ?? "Employee",
        providerId: record.providerId,
        providerName: data.providers.find((provider) => provider.providerId === record.providerId)?.providerName ?? "Provider",
        programmeId: record.programmeId,
        programmeName: programme?.programmeName ?? "Programme",
        reviews: data.learnerReviews
          .filter((review) => review.learnerRecordId === record.id && ["provider_review", "l_and_d_check_in", "manager_check_in"].includes(review.reviewType))
          .map((review) => ({ id: review.id, type: review.reviewType as "provider_review" | "l_and_d_check_in" | "manager_check_in", nextReviewDate: review.nextReviewDate, reviewDate: review.reviewDate, status: review.status })),
      };
    }),
    actions: actionRows.map((action) => ({
      id: action.id, learnerRecordId: action.learner_record_id ?? "", applicationId: action.application_id, employeeId: action.employee_id,
      title: action.title, description: action.description, actionType: action.action_type, ownerType: action.owner_type,
      dueDate: action.due_date ?? "", status: action.status, sourceUrl: action.source_url, updatedAt: action.updated_at,
    })),
    applications: data.applications.map((application) => {
      const workflow = deriveApplicationWorkflowCompatibility(application);
      return { id: application.id, employeeId: application.employeeId, employeeName: employees.get(application.employeeId) ?? "Employee", status: workflow.status, currentOwner: workflow.currentOwner, updatedAt: workflow.lastProgressedAt, currentStepLabel: workflow.currentStepLabel, currentResponsibleRole: workflow.currentResponsibleRole };
    }),
  });
  const existing = existingRows.map(fromRow);
  const existingByKey = new Map(existing.map((signal) => [signal.signalKey, signal]));
  const enriched = await Promise.all(detected.map(async (signal) => {
    const prior = existingByKey.get(signal.signalKey);
    if (prior && prior.fingerprint === signal.fingerprint) return { ...signal, interpretation: prior.interpretation };
    return { ...signal, interpretation: await interpretAutopilotSignal(signal) };
  }));
  const reconciled = reconcileAutopilotSignals(existing, enriched, now);
  await persistReconciliation(actor.organisationId, actor.userId, actor.email, existing, reconciled);
  return presentWorkspace(reconciled.filter((signal) => signal.status !== "dismissed"), now);
}

export async function dismissAutopilotSignal(session: LevyTateBetaSession, signalId: string, reason: string) {
  const context = await autopilotContext(session, true);
  const signal = await requireSignal(context.organisation.id, signalId);
  if (["dismissed", "resolved"].includes(signal.status)) throw new LevyTateAutopilotError("This signal is no longer active.", 409);
  const cleanedReason = reason.replace(/\s+/g, " ").trim().slice(0, 240);
  if (!cleanedReason) throw new LevyTateAutopilotError("A dismissal reason is required.");
  const now = new Date().toISOString();
  await supabaseUpdate(requireConfig(), signalsTable, `organisation_id=eq.${context.organisation.id}&id=eq.${encodeURIComponent(signal.id)}`, {
    status: "dismissed", dismissed_by: context.user.id, dismissed_at: now, dismissal_reason: cleanedReason, updated_at: now,
  }, { prefer: "return=minimal" });
  await recordEvent(context.organisation.id, signal, "dismissed", signal.status, "dismissed", context.user.id, context.user.email, { reason: cleanedReason });
  return getAutopilotWorkspace(session);
}

export async function createAutopilotAction(session: LevyTateBetaSession, signalId: string, input: { title: string; ownerType: string; dueDate: string; communicationDraft: string }) {
  const context = await autopilotContext(session, true);
  const signal = await requireSignal(context.organisation.id, signalId);
  if (["dismissed", "resolved"].includes(signal.status)) throw new LevyTateAutopilotError("This signal is no longer active.", 409);
  if (signal.linkedOperationalActionId) {
    await acceptSignal(context.organisation.id, signal, signal.linkedOperationalActionId, context.user.id, context.user.email);
    return { workspace: await getAutopilotWorkspace(session), operationalActionId: signal.linkedOperationalActionId, reused: true };
  }
  const ownerType = ownerTypes.includes(input.ownerType as OperationalOwnerType) ? input.ownerType as OperationalOwnerType : signal.suggestedOwnerType;
  const title = input.title.replace(/\s+/g, " ").trim().slice(0, 160);
  const dueDate = /^\d{4}-\d{2}-\d{2}$/.test(input.dueDate) ? input.dueDate : signal.suggestedDueDate;
  const communicationDraft = input.communicationDraft.replace(/\s+/g, " ").trim().slice(0, 1000);
  if (!title) throw new LevyTateAutopilotError("An action title is required.");
  if (!actionTypes.has(signal.suggestedActionType)) throw new LevyTateAutopilotError("This signal does not support creation of a new operational action.", 409);
  const sourceKey = `autopilot:${signal.signalKey}`;
  const existingActions = await supabaseSelect<ExistingActionRow>(requireConfig(), "levytate_operational_actions", new URLSearchParams({
    select: "id", organisation_id: `eq.${context.organisation.id}`, source_key: `eq.${sourceKey}`, status: "in.(open,acknowledged,in_progress)", limit: "1",
  }));
  let actionId = existingActions[0]?.id;
  if (!actionId) {
    const link = await sourceLink(context.organisation.id, signal);
    actionId = randomUUID();
    const now = new Date().toISOString();
    const priority = priorityMap[signal.priority];
    await supabaseInsert(requireConfig(), "levytate_operational_actions", [{
      organisation_id: context.organisation.id, id: actionId, learner_record_id: signal.learnerRecordId || null,
      application_id: link.applicationId, employee_id: link.employeeId,
      source_type: signal.entityType === "application" ? "application_workflow" : "review_due", source_key: sourceKey,
      action_type: signal.suggestedActionType, title, description: signal.interpretation.suggestedNextStep,
      priority, priority_rank: priorityRank[priority], status: "open", owner_type: ownerType,
      owner_user_id: ownerType === "Apprenticeship Lead" ? context.user.id : "", owner_display_name: ownerType,
      due_date: dueDate || null, detected_at: now, source_url: signal.evidence[0]?.url ?? "/levytate/app?module=Operations",
      metadata: { sourceCondition: "autopilot_signal_accepted", signalId: signal.id, signalKey: signal.signalKey, communicationDraft, communicationSent: false },
      version: 1, created_at: now, updated_at: now,
    }]);
    await supabaseInsert(requireConfig(), "levytate_operational_action_events", [{
      organisation_id: context.organisation.id, id: randomUUID(), operational_action_id: actionId, event_type: "detected", previous_status: "", new_status: "open",
      actor_user_id: context.user.id, actor_name: context.user.email, event_date: now,
      summary: "Autopilot suggestion approved as an operational action by an authorised user.", metadata: { signalId: signal.id, communicationSent: false }, created_at: now,
    }]);
  }
  await acceptSignal(context.organisation.id, signal, actionId, context.user.id, context.user.email);
  return { workspace: await getAutopilotWorkspace(session), operationalActionId: actionId, reused: Boolean(existingActions.length) };
}

async function autopilotContext(session: LevyTateBetaSession, write: boolean) {
  const context = await getLearnerLifecycleServerContext(session);
  const role = normaliseMvpUserRole(context.user.role);
  const permission = write ? "operationalActions:write" : "operationalActions:read";
  if (!(["Employer Admin", "Apprenticeship Lead"] as string[]).includes(role) || !hasMvpPermission(role, permission)) {
    throw new LevyTateLearnerLifecyclePermissionError(`${role} cannot access organisation Operations Autopilot.`);
  }
  return context;
}

function assertMicrosoftCopilotAutopilotRole(actor: MicrosoftCopilotActor, write: boolean) {
  const permission = write ? "operationalActions:write" : "operationalActions:read";
  if (!["Employer Admin", "Apprenticeship Lead"].includes(actor.role) || !hasMvpPermission(actor.role, permission)) {
    throw new LevyTateLearnerLifecyclePermissionError(`${actor.role} cannot access organisation Operations Autopilot.`);
  }
}

async function persistReconciliation(organisationId: string, actorUserId: string, actorName: string, existing: AutopilotPersistedSignal[], reconciled: AutopilotPersistedSignal[]) {
  const priorById = new Map(existing.map((signal) => [signal.id, signal]));
  for (const signal of reconciled) {
    const prior = priorById.get(signal.id);
    await supabaseInsert<SignalRow>(requireConfig(), signalsTable, [toRow(signal)], { query: "on_conflict=organisation_id,id", prefer: "resolution=merge-duplicates,return=minimal" });
    const eventType = !prior ? "detected" : prior.status !== signal.status && signal.status === "resolved" ? "resolved" : prior.fingerprint !== signal.fingerprint ? "regenerated" : null;
    if (eventType) await recordEvent(organisationId, signal, eventType, prior?.status ?? "", signal.status, actorUserId, actorName);
  }
}

async function acceptSignal(organisationId: string, signal: AutopilotPersistedSignal, actionId: string, actorUserId: string, actorName: string) {
  const now = new Date().toISOString();
  await supabaseUpdate(requireConfig(), signalsTable, `organisation_id=eq.${organisationId}&id=eq.${encodeURIComponent(signal.id)}`, { status: "accepted", lane: signal.suggestedOwnerType === "Provider" ? "waiting_externally" : "ready_to_action", linked_operational_action_id: actionId, updated_at: now }, { prefer: "return=minimal" });
  await recordEvent(organisationId, signal, "accepted", signal.status, "accepted", actorUserId, actorName, { operationalActionId: actionId });
}

async function sourceLink(organisationId: string, signal: AutopilotPersistedSignal) {
  if (signal.entityType === "application") return { applicationId: String(signal.deterministicPayload.applicationId ?? signal.entityId), employeeId: String(signal.deterministicPayload.employeeId ?? "") };
  if (!signal.learnerRecordId) return { applicationId: "", employeeId: "" };
  const rows = await supabaseSelect<LearnerLinkRow>(requireConfig(), "levytate_learner_records", new URLSearchParams({ select: "employee_id,application_id", organisation_id: `eq.${organisationId}`, id: `eq.${signal.learnerRecordId}`, limit: "1" }));
  if (!rows[0]) throw new LevyTateAutopilotError("The learner linked to this signal was not found.", 404);
  return { applicationId: rows[0].application_id, employeeId: rows[0].employee_id };
}

async function requireSignal(organisationId: string, signalId: string) {
  const rows = await supabaseSelect<SignalRow>(requireConfig(), signalsTable, new URLSearchParams({ select: "*", organisation_id: `eq.${organisationId}`, id: `eq.${signalId}`, analyser_version: `eq.${autopilotAnalyserVersion}`, limit: "1" }));
  if (!rows[0]) throw new LevyTateAutopilotError("The Autopilot signal was not found.", 404);
  return fromRow(rows[0]);
}
async function selectRows(organisationId: string) {
  return supabaseSelect<SignalRow>(requireConfig(), signalsTable, new URLSearchParams({ select: "*", organisation_id: `eq.${organisationId}`, analyser_version: `eq.${autopilotAnalyserVersion}`, order: "last_evaluated_at.desc", limit: "1000" }));
}

function presentWorkspace(signals: AutopilotPersistedSignal[], generatedAt: string) {
  const lanes = Object.fromEntries((["needs_your_decision", "ready_to_action", "waiting_externally", "upcoming", "recently_resolved"] as AutopilotLane[]).map((lane) => [lane, signals.filter((signal) => signal.lane === lane)])) as Record<AutopilotLane, AutopilotPersistedSignal[]>;
  return { generatedAt, analyserVersion: autopilotAnalyserVersion, brief: buildOperationsBrief(signals), lanes };
}

function toRow(signal: AutopilotPersistedSignal): SignalRow {
  const payload = { ...signal.deterministicPayload, subjectLabel: signal.subjectLabel, applicationId: signal.applicationId ?? "", employeeId: signal.employeeId ?? "" };
  return {
    organisation_id: signal.organisationId, id: signal.id, fingerprint: signal.fingerprint, signal_key: signal.signalKey,
    entity_type: signal.entityType, entity_id: signal.entityId, learner_record_id: signal.learnerRecordId ?? null,
    provider_id: signal.providerId ?? null, programme_id: signal.programmeId ?? null, category: signal.category, signal_type: signal.signalType,
    lane: signal.lane, autopilot_priority: signal.priority, title: signal.interpretation.headline, summary: signal.interpretation.whyItMatters,
    evidence: signal.evidence, confidence: "High", priority: priorityMap[signal.priority], recommended_action: signal.interpretation.suggestedNextStep,
    suggested_owner_type: signal.suggestedOwnerType, suggested_due_date: signal.suggestedDueDate || null, suggested_action_type: signal.suggestedActionType,
    deterministic_payload: payload, ai_interpretation: signal.interpretation.source === "ai" ? signal.interpretation : null,
    communication_draft: signal.interpretation.draftCommunication, status: signal.status,
    linked_operational_action_id: signal.linkedOperationalActionId ?? null, analyser_version: autopilotAnalyserVersion,
    model_identifier: signal.interpretation.modelIdentifier, detected_at: signal.detectedAt, last_evaluated_at: signal.lastEvaluatedAt,
    resolved_at: signal.resolvedAt ?? null, acknowledged_by: "", acknowledged_at: null,
    dismissed_by: signal.dismissedBy ?? "", dismissed_at: signal.dismissedAt ?? null, dismissal_reason: signal.dismissalReason ?? "", updated_at: new Date().toISOString(),
  };
}

function fromRow(row: SignalRow): AutopilotPersistedSignal {
  const payload = row.deterministic_payload ?? {};
  const interpretation = row.ai_interpretation ?? {
    headline: row.title, whyItMatters: row.summary, suggestedNextStep: row.recommended_action,
    draftCommunication: row.communication_draft, evidenceSummary: (Array.isArray(row.evidence) ? row.evidence : []).map((item) => `${item.label}: ${item.value}`),
    source: "deterministic" as const, modelIdentifier: "",
  };
  return {
    id: row.id, signalKey: row.signal_key, fingerprint: row.fingerprint, organisationId: row.organisation_id,
    entityType: row.entity_type, entityId: row.entity_id, learnerRecordId: row.learner_record_id ?? undefined,
    applicationId: String(payload.applicationId || "") || undefined, employeeId: String(payload.employeeId || "") || undefined,
    providerId: row.provider_id ?? undefined, programmeId: row.programme_id ?? undefined,
    subjectLabel: String(payload.subjectLabel || row.title), category: row.category, signalType: row.signal_type,
    lane: row.lane, priority: row.autopilot_priority, title: row.title, summary: row.summary,
    recommendedAction: row.recommended_action, suggestedOwnerType: row.suggested_owner_type,
    suggestedDueDate: row.suggested_due_date ?? "", suggestedActionType: row.suggested_action_type,
    evidence: Array.isArray(row.evidence) ? row.evidence : [], deterministicPayload: payload, interpretation,
    linkedOperationalActionId: row.linked_operational_action_id ?? undefined, detectedAt: row.detected_at,
    lastEvaluatedAt: row.last_evaluated_at, status: row.status, resolvedAt: row.resolved_at ?? undefined,
    dismissedAt: row.dismissed_at ?? undefined, dismissedBy: row.dismissed_by || undefined, dismissalReason: row.dismissal_reason || undefined,
  };
}

async function recordEvent(organisationId: string, signal: Pick<AutopilotPersistedSignal, "id">, eventType: string, previousStatus: string, newStatus: string, actorUserId: string, actorName: string, metadata: Record<string, unknown> = {}) {
  const now = new Date().toISOString();
  await supabaseInsert(requireConfig(), eventsTable, [{ organisation_id: organisationId, id: randomUUID(), signal_id: signal.id, event_type: eventType, previous_status: previousStatus, new_status: newStatus, actor_user_id: actorUserId, actor_name: actorName, event_date: now, summary: `Operations Autopilot signal ${eventType}.`, metadata, created_at: now }]);
}
function requireConfig() { const config = getLevyTateSupabaseConfig(); if (!config) throw new LevyTateAutopilotError("Operations Autopilot persistence is unavailable.", 503); return config; }
