import type { MicrosoftCopilotActor } from "@/lib/levytate/microsoft-copilot";
import type { LevyTateBetaSession } from "@/lib/levytate/config/beta-access";
import { interpretAutopilotSignal } from "@/lib/levytate/autopilot/ai";
import {
  analyseOperationsAutopilot,
  analyseLearningTimeAutopilot,
  autopilotApplicationDestination,
  autopilotAnalyserVersion,
  buildOperationsBrief,
  reconcileAutopilotSignals,
  type AutopilotActionInput,
  type AutopilotApplicationInput,
  type AutopilotLane,
  type AutopilotPersistedSignal,
  type DetectedAutopilotSignal,
  type AutopilotSignalType,
} from "@/lib/levytate/autopilot/operations-autopilot";
import { hasMvpPermission, normaliseMvpUserRole } from "@/lib/levytate/mvp/rbac";
import { deriveApplicationWorkflowCompatibility } from "@/lib/levytate/application-workflows/compatibility";
import type { OperationalOwnerType, OperationalPriorityLevel } from "@/lib/levytate/mvp/operations-centre";
import { getLearnerLifecycleServerContext, listOrganisationLearnerLifecycleDetails, LevyTateLearnerLifecyclePermissionError } from "@/lib/server/levytate-learner-lifecycle";
import { listOperationalActions } from "@/lib/server/levytate-operational-actions";
import { getLevyTateSupabaseConfig, supabaseSelect } from "@/lib/server/levytate-supabase";
import { getWorkspaceBootstrapForMicrosoftCopilotActor, getWorkspaceBootstrapForSession, microsoftCopilotActorSession } from "@/lib/server/levytate-workspace";
import { getLearningTimeWorkspace } from "@/lib/server/levytate-off-the-job";

const signalsTable = "levytate_intelligence_signals";
import { assertIntelligenceExpectedOrganisation, assertIntelligenceSourceCoverage, intelligenceCommand, intelligenceWorkspaceState, IntelligenceCommandError, type IntelligenceActorScope, type IntelligenceCommandKey, type IntelligenceDecisionKey, type IntelligenceCommandResult } from "@/lib/server/levytate-intelligence-commands";
function actorScope(context: Awaited<ReturnType<typeof getLearnerLifecycleServerContext>>): IntelligenceActorScope { return { organisationId: context.organisation.id, userId: context.user.id, userEmail: context.user.email, role: context.user.role }; }
function presentReceipt(result: IntelligenceCommandResult) {
  const scope = { organisationId: result.confirmation.organisationId, userEmail: result.confirmation.userEmail, role: result.confirmation.role };
  return { ...presentWorkspace(result.signals.map(row => fromRow(row as SignalRow)), result.state.reconciled_at, result.state.revision, scope), confirmation: result.confirmation };
}
const priorityMap: Record<DetectedAutopilotSignal["priority"], OperationalPriorityLevel> = { action_now: "High", this_week: "Medium", upcoming: "Low" };

type SignalRow = {
  organisation_id: string; id: string; revision: number; fingerprint: string; signal_key: string; entity_type: DetectedAutopilotSignal["entityType"]; entity_id: string;
  learner_record_id: string | null; provider_id: string | null; programme_id: string | null; category: DetectedAutopilotSignal["category"];
  signal_type: DetectedAutopilotSignal["signalType"]; lane: DetectedAutopilotSignal["lane"]; autopilot_priority: DetectedAutopilotSignal["priority"];
  title: string; summary: string; evidence: DetectedAutopilotSignal["evidence"]; confidence: "High"; priority: OperationalPriorityLevel;
  recommended_action: string; suggested_owner_type: OperationalOwnerType; suggested_due_date: string | null; suggested_action_type: string;
  deterministic_payload: Record<string, unknown>; ai_interpretation: DetectedAutopilotSignal["interpretation"] | null; communication_draft: string;
  status: AutopilotPersistedSignal["status"]; linked_operational_action_id: string | null; analyser_version: string; model_identifier: string;
  detected_at: string; last_evaluated_at: string; resolved_at: string | null; acknowledged_by: string; acknowledged_at: string | null;
  dismissed_by: string; dismissed_at: string | null; dismissal_reason: string; created_at?: string; updated_at?: string;
};

type MicrosoftActionRow = {
  id: string; learner_record_id: string | null; application_id: string; employee_id: string; title: string; description: string;
  action_type: string; owner_type: OperationalOwnerType; due_date: string | null; status: string; source_url: string; updated_at: string;
};

export class LevyTateAutopilotError extends Error {
  constructor(message: string, public readonly status = 400) { super(message); this.name = "LevyTateAutopilotError"; }
}

export async function getAutopilotWorkspace(session: LevyTateBetaSession) {
  const context = await autopilotContext(session, false);
  const scope = actorScope(context);
  const [rows, state] = await Promise.all([selectRows(context.organisation.id), intelligenceWorkspaceState(scope, autopilotAnalyserVersion)]);
  const cutoff = Date.now() - 14 * 86_400_000;
  const signals = rows.map(fromRow).filter((signal) => signal.status !== "dismissed" && (signal.status !== "resolved" || Date.parse(signal.resolvedAt ?? "") >= cutoff));
  return presentWorkspace(signals, state.reconciled_at, state.revision, scope);
}

export async function getAutopilotWorkspaceForMicrosoftCopilotActor(actor: MicrosoftCopilotActor) {
  await getWorkspaceBootstrapForMicrosoftCopilotActor(actor);
  assertMicrosoftCopilotAutopilotRole(actor, false);
  const scope = { organisationId: actor.organisationId, userId: actor.userId, userEmail: actor.email, role: actor.role };
  const [rows, state] = await Promise.all([selectRows(actor.organisationId), intelligenceWorkspaceState(scope, autopilotAnalyserVersion)]);
  const cutoff = Date.now() - 14 * 86_400_000;
  const signals = rows.map(fromRow).filter((signal) => signal.status !== "dismissed" && (signal.status !== "resolved" || Date.parse(signal.resolvedAt ?? "") >= cutoff));
  return presentWorkspace(signals, state.reconciled_at, state.revision, scope);
}

export async function refreshAutopilotWorkspace(session: LevyTateBetaSession, key: IntelligenceCommandKey, expectedOrganisationId?: string) {
  const context = await autopilotContext(session, true);
  const scope = actorScope(context), command = { action: "refresh", idempotencyKey: key.idempotencyKey };
  assertIntelligenceExpectedOrganisation(scope, expectedOrganisationId);
  const prepared = await intelligenceCommand(scope, autopilotAnalyserVersion, command, undefined, undefined, true);
  if ("receipt" in prepared) return presentReceipt(prepared.receipt);
  const [details, actions, bootstrap] = await Promise.all([
    listOrganisationLearnerLifecycleDetails(session),
    listOperationalActions(session, { includeTerminal: true }),
    getWorkspaceBootstrapForSession(session),
  ]);
  assertIntelligenceSourceCoverage(prepared, { learnerIds: details.map(detail => detail.learnerRecordId), actionIds: actions.map(action => action.id), applicationIds: bootstrap.data.applications.map(application => application.id) });
  const now = new Date().toISOString();
  const learningTime = bootstrap.meta.offTheJobAssistantEnabled ? await getLearningTimeWorkspace(session) : null;
  const employees = new Map(bootstrap.data.employees.map((employee) => [employee.id, employee.name]));
  const actionInputs: AutopilotActionInput[] = actions.filter(action => prepared.eligibleActionIds.includes(action.id)).map((action) => ({
    id: action.id, learnerRecordId: action.learnerRecordId, applicationId: action.applicationId, employeeId: action.employeeId,
    title: action.title, description: action.description, actionType: action.actionType, ownerType: action.ownerType, dueDate: action.dueDate,
    status: action.status, sourceUrl: action.sourceUrl, updatedAt: action.updatedAt,
  }));
  const applicationInputs: AutopilotApplicationInput[] = bootstrap.data.applications.filter(application => prepared.eligibleApplicationIds.includes(application.id)).map((application) => {
    const workflow = deriveApplicationWorkflowCompatibility(application);
    return {
      id: application.id, employeeId: application.employeeId, employeeName: employees.get(application.employeeId) ?? "Employee",
      status: workflow.status, currentOwner: workflow.currentOwner, updatedAt: workflow.lastProgressedAt,
      currentStepLabel: workflow.currentStepLabel, currentResponsibleRole: workflow.currentResponsibleRole,
    };
  });
  const detected = [
    ...analyseOperationsAutopilot({
    organisationId: context.organisation.id, now,
    learners: details.filter(detail => prepared.eligibleLearnerIds.includes(detail.learnerRecordId)).map((detail) => ({
      learnerRecordId: detail.learnerRecordId, learnerName: detail.learner.name,
      providerId: detail.programme.providerId, providerName: detail.programme.providerName,
      programmeId: detail.programme.programmeId, programmeName: detail.programme.programmeName,
      reviews: detail.reviewHistory
        .filter((review) => ["provider_review", "l_and_d_check_in", "manager_check_in"].includes(review.reviewType))
        .map((review) => ({ id: review.id, type: review.reviewType as "provider_review" | "l_and_d_check_in" | "manager_check_in", nextReviewDate: review.nextReviewDate, reviewDate: review.reviewDate, status: review.status })),
    })),
      actions: actionInputs, applications: applicationInputs,
    }),
    ...(learningTime ? analyseLearningTimeAutopilot({
      organisationId: context.organisation.id, now,
      learners: learningTime.learners.filter(learner => prepared.eligibleLearnerIds.includes(learner.learnerRecordId)).map((learner) => ({
        learnerRecordId: learner.learnerRecordId, learnerName: learner.learnerName,
        providerId: learner.providerId, programmeId: learner.programmeId,
        attention: learner.attention.map((item) => ({ ...item, type: item.type as AutopilotSignalType })),
      })),
    }) : []),
  ];
  const existing = prepared.signals.map(row => fromRow(row as SignalRow));
  const existingByKey = new Map(existing.map((signal) => [signal.signalKey, signal]));
  const enriched = await Promise.all(detected.map(async (signal) => {
    const prior = existingByKey.get(signal.signalKey);
    if (prior && prior.fingerprint === signal.fingerprint) return { ...signal, interpretation: prior.interpretation };
    return { ...signal, interpretation: await interpretAutopilotSignal(signal) };
  }));
  const reconciled = reconcileAutopilotSignals(existing, enriched, now);
  const completed = await intelligenceCommand(scope, autopilotAnalyserVersion, command, prepared, reconciled.map(toRow));
  if (!("receipt" in completed)) throw new IntelligenceCommandError("The analysis could not be confirmed.");
  return presentReceipt(completed.receipt);
}

export async function refreshAutopilotWorkspaceForMicrosoftCopilotActor(actor: MicrosoftCopilotActor, key: IntelligenceCommandKey) {
  assertMicrosoftCopilotAutopilotRole(actor, true);
  // The explicit seed/connector caller still verifies its external binding;
  // requesting a refresh never authorises creation of an operational action.
  await getWorkspaceBootstrapForMicrosoftCopilotActor(actor);
  const scope = { organisationId: actor.organisationId, userId: actor.userId, userEmail: actor.email, role: actor.role }, command = { action: "refresh", idempotencyKey: key.idempotencyKey };
  const prepared = await intelligenceCommand(scope, autopilotAnalyserVersion, command, undefined, undefined, true);
  if ("receipt" in prepared) return presentReceipt(prepared.receipt);
  const [bootstrap, actionRows] = await Promise.all([
    getWorkspaceBootstrapForMicrosoftCopilotActor(actor),
    supabaseSelect<MicrosoftActionRow>(requireConfig(), "levytate_operational_actions", new URLSearchParams({
      select: "id,learner_record_id,application_id,employee_id,title,description,action_type,owner_type,due_date,status,source_url,updated_at",
      organisation_id: `eq.${actor.organisationId}`,
      order: "updated_at.desc",
      limit: "1000",
    })),
  ]);
  const { data, meta } = bootstrap;
  assertIntelligenceSourceCoverage(prepared, { learnerIds: data.learnerRecords.map(record => record.id), actionIds: actionRows.map(action => action.id), applicationIds: data.applications.map(application => application.id) });
  const now = new Date().toISOString();
  const learningTime = meta.offTheJobAssistantEnabled
    ? await getLearningTimeWorkspace(microsoftCopilotActorSession(actor))
    : null;
  const employees = new Map(data.employees.map((employee) => [employee.id, employee.name]));
  const programmes = new Map(data.providerProgrammes.map((programme) => [programme.id, programme]));
  const detected = [
    ...analyseOperationsAutopilot({
    organisationId: actor.organisationId,
    now,
    learners: data.learnerRecords.filter(record => prepared.eligibleLearnerIds.includes(record.id)).map((record) => {
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
    actions: actionRows.filter(action => prepared.eligibleActionIds.includes(action.id)).map((action) => ({
      id: action.id, learnerRecordId: action.learner_record_id ?? "", applicationId: action.application_id, employeeId: action.employee_id,
      title: action.title, description: action.description, actionType: action.action_type, ownerType: action.owner_type,
      dueDate: action.due_date ?? "", status: action.status, sourceUrl: action.source_url, updatedAt: action.updated_at,
    })),
    applications: data.applications.filter(application => prepared.eligibleApplicationIds.includes(application.id)).map((application) => {
      const workflow = deriveApplicationWorkflowCompatibility(application);
      return { id: application.id, employeeId: application.employeeId, employeeName: employees.get(application.employeeId) ?? "Employee", status: workflow.status, currentOwner: workflow.currentOwner, updatedAt: workflow.lastProgressedAt, currentStepLabel: workflow.currentStepLabel, currentResponsibleRole: workflow.currentResponsibleRole };
      }),
    }),
    ...(learningTime ? analyseLearningTimeAutopilot({
      organisationId: actor.organisationId, now,
      learners: learningTime.learners.filter(learner => prepared.eligibleLearnerIds.includes(learner.learnerRecordId)).map((learner) => ({
        learnerRecordId: learner.learnerRecordId, learnerName: learner.learnerName,
        providerId: learner.providerId, programmeId: learner.programmeId,
        attention: learner.attention.map((item) => ({ ...item, type: item.type as AutopilotSignalType })),
      })),
    }) : []),
  ];
  const existing = prepared.signals.map(row => fromRow(row as SignalRow));
  const existingByKey = new Map(existing.map((signal) => [signal.signalKey, signal]));
  const enriched = await Promise.all(detected.map(async (signal) => {
    const prior = existingByKey.get(signal.signalKey);
    if (prior && prior.fingerprint === signal.fingerprint) return { ...signal, interpretation: prior.interpretation };
    return { ...signal, interpretation: await interpretAutopilotSignal(signal) };
  }));
  const reconciled = reconcileAutopilotSignals(existing, enriched, now);
  const completed = await intelligenceCommand(scope, autopilotAnalyserVersion, command, prepared, reconciled.map(toRow));
  if (!("receipt" in completed)) throw new IntelligenceCommandError("The analysis could not be confirmed.");
  return presentReceipt(completed.receipt);
}

export async function dismissAutopilotSignal(session: LevyTateBetaSession, signalId: string, reason: string, key: IntelligenceDecisionKey, expectedOrganisationId?: string) {
  const context = await autopilotContext(session, true);
  assertIntelligenceExpectedOrganisation(actorScope(context), expectedOrganisationId);
  const completed = await intelligenceCommand(actorScope(context), autopilotAnalyserVersion, { action: "dismiss", signalId, reason, ...key });
  if (!("receipt" in completed)) throw new IntelligenceCommandError("The signal decision could not be confirmed.");
  return presentReceipt(completed.receipt);
}

export async function createAutopilotAction(session: LevyTateBetaSession, signalId: string, input: { title: string; ownerType: string; dueDate: string; communicationDraft: string }, key: IntelligenceDecisionKey, expectedOrganisationId?: string) {
  const context = await autopilotContext(session, true);
  assertIntelligenceExpectedOrganisation(actorScope(context), expectedOrganisationId);
  const rows = await supabaseSelect<SignalRow>(requireConfig(), signalsTable, new URLSearchParams({ select: "*", organisation_id: `eq.${context.organisation.id}`, analyser_version: `eq.${autopilotAnalyserVersion}`, id: `eq.${signalId}`, limit: "2" }));
  if (rows.length === 0) throw new LevyTateAutopilotError("The Autopilot signal is unavailable.", 404);
  if (rows.length !== 1 || rows[0].organisation_id !== context.organisation.id || rows[0].analyser_version !== autopilotAnalyserVersion || rows[0].id !== signalId) throw new LevyTateAutopilotError("The Autopilot source could not be confirmed.", 503);
  const destination = autopilotApplicationDestination(fromRow(rows[0]));
  if (destination) throw new LevyTateAutopilotError(destination.instruction, 409);
  const completed = await intelligenceCommand(actorScope(context), autopilotAnalyserVersion, { action: "create_action", signalId, ...input, ...key });
  if (!("receipt" in completed) || !completed.receipt.operationalActionId) throw new IntelligenceCommandError("The accepted action could not be confirmed.");
  return { workspace: presentReceipt(completed.receipt), operationalActionId: completed.receipt.operationalActionId, reused: completed.receipt.reused, confirmation: completed.receipt.confirmation };
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

async function selectRows(organisationId: string) {
  return supabaseSelect<SignalRow>(requireConfig(), signalsTable, new URLSearchParams({ select: "*", organisation_id: `eq.${organisationId}`, analyser_version: `eq.${autopilotAnalyserVersion}`, order: "last_evaluated_at.desc", limit: "1000" }));
}

function presentWorkspace(signals: AutopilotPersistedSignal[], generatedAt: string | null, revision: number, scope: Pick<IntelligenceActorScope, "organisationId" | "userEmail" | "role">) {
  const cutoff = Date.now() - 14 * 86_400_000;
  signals = signals.filter(signal => signal.status !== "dismissed" && (signal.status !== "resolved" || Date.parse(signal.resolvedAt ?? "") >= cutoff));
  const lanes = Object.fromEntries((["needs_your_decision", "ready_to_action", "waiting_externally", "upcoming", "recently_resolved"] as AutopilotLane[]).map((lane) => [lane, signals.filter((signal) => signal.lane === lane)])) as Record<AutopilotLane, AutopilotPersistedSignal[]>;
  return { generatedAt, checked: generatedAt !== null, revision, scope, organisationId: scope.organisationId, analyserVersion: autopilotAnalyserVersion, brief: buildOperationsBrief(signals), lanes };
}

function toRow(signal: AutopilotPersistedSignal): SignalRow {
  const payload = { ...signal.deterministicPayload, subjectLabel: signal.subjectLabel, applicationId: signal.applicationId ?? "", employeeId: signal.employeeId ?? "" };
  return {
    organisation_id: signal.organisationId, id: signal.id, revision: signal.revision, fingerprint: signal.fingerprint, signal_key: signal.signalKey,
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
    id: row.id, revision: row.revision, signalKey: row.signal_key, fingerprint: row.fingerprint, organisationId: row.organisation_id,
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

function requireConfig() { const config = getLevyTateSupabaseConfig(); if (!config) throw new LevyTateAutopilotError("Operations Autopilot persistence is unavailable.", 503); return config; }
