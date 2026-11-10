import type { LevyTateBetaSession } from "@/lib/levytate/config/beta-access";
import {
  analyseProgressReviewIntelligence,
  reconcileIntelligenceSignals,
  type IntelligenceDismissalReason,
  type IntelligenceSignal,
  type IntelligenceSignalStatus,
} from "@/lib/levytate/intelligence/progress-review";
import { hasMvpPermission, normaliseMvpUserRole } from "@/lib/levytate/mvp/rbac";
import { getLearnerLifecycleServerContext, listOrganisationLearnerLifecycleDetails, LevyTateLearnerLifecyclePermissionError } from "@/lib/server/levytate-learner-lifecycle";
import { listOperationalActions } from "@/lib/server/levytate-operational-actions";
import { getLevyTateSupabaseConfig, supabaseSelect } from "@/lib/server/levytate-supabase";

const signalsTable = "levytate_intelligence_signals";
const family = "progress-review-v1";
import { assertIntelligenceExpectedOrganisation, assertIntelligenceSourceCoverage, intelligenceCommand, intelligenceWorkspaceState, IntelligenceCommandError, type IntelligenceActorScope, type IntelligenceCommandKey, type IntelligenceDecisionKey, type IntelligenceCommandResult } from "@/lib/server/levytate-intelligence-commands";
function actorScope(context: Awaited<ReturnType<typeof getLearnerLifecycleServerContext>>): IntelligenceActorScope { return { organisationId: context.organisation.id, userId: context.user.id, userEmail: context.user.email, role: context.user.role }; }
function present(result: IntelligenceCommandResult) {
  const scope = { organisationId: result.confirmation.organisationId, userEmail: result.confirmation.userEmail, role: result.confirmation.role };
  return { signals: result.signals.map(row => signalFromRow(row as SignalRow)).filter(signal => !["dismissed", "resolved"].includes(signal.status)), scope, organisationId: scope.organisationId, revision: result.state.revision, lastAnalysedAt: result.state.reconciled_at, checked: result.state.reconciled_at !== null, confirmation: result.confirmation };
}

type SignalRow = {
  organisation_id: string; id: string; revision: number; fingerprint: string; entity_type: IntelligenceSignal["entityType"]; entity_id: string;
  learner_record_id: string | null; provider_id: string | null; programme_id: string | null; category: IntelligenceSignal["category"];
  signal_type: IntelligenceSignal["signalType"]; title: string; summary: string; evidence: IntelligenceSignal["evidence"];
  confidence: IntelligenceSignal["confidence"]; priority: IntelligenceSignal["priority"]; recommended_action: string;
  suggested_owner_type: string; suggested_due_date: string | null; status: IntelligenceSignalStatus; linked_operational_action_id: string | null;
  analyser_version: string; model_identifier: string; detected_at: string; last_evaluated_at: string; resolved_at: string | null;
  acknowledged_by: string; acknowledged_at: string | null; dismissed_by: string; dismissed_at: string | null; dismissal_reason: string;
  created_at?: string; updated_at?: string;
};

export class LevyTateIntelligenceError extends Error {
  constructor(message: string) { super(message); this.name = "LevyTateIntelligenceError"; }
}

function requireConfig() {
  const config = getLevyTateSupabaseConfig();
  if (!config) throw new LevyTateIntelligenceError("Intelligence persistence is unavailable.");
  return config;
}

async function intelligenceContext(session: LevyTateBetaSession, write = false) {
  const context = await getLearnerLifecycleServerContext(session);
  const role = normaliseMvpUserRole(context.user.role);
  const permission = write ? "operationalActions:write" : "operationalActions:read";
  if (!["Employer Admin", "Apprenticeship Lead"].includes(role) || !hasMvpPermission(role, permission)) {
    throw new LevyTateLearnerLifecyclePermissionError(`${role} cannot access organisation Intelligence.`);
  }
  return context;
}

export async function listIntelligenceSignals(session: LevyTateBetaSession) {
  const context = await intelligenceContext(session);
  const scope = actorScope(context);
  const [rows, state] = await Promise.all([selectSignalRows(context.organisation.id), intelligenceWorkspaceState(scope, family)]);
  return { signals: rows.map(signalFromRow).filter((signal) => !["dismissed", "resolved"].includes(signal.status)), scope: { organisationId: scope.organisationId, userEmail: scope.userEmail, role: scope.role }, organisationId: scope.organisationId, revision: state.revision, lastAnalysedAt: state.reconciled_at, checked: state.reconciled_at !== null };
}

export async function analyseAndPersistIntelligenceSignals(session: LevyTateBetaSession, key: IntelligenceCommandKey, expectedOrganisationId?: string) {
  const context = await intelligenceContext(session, true);
  const scope = actorScope(context), command = { action: "analyse", idempotencyKey: key.idempotencyKey };
  assertIntelligenceExpectedOrganisation(scope, expectedOrganisationId);
  const prepared = await intelligenceCommand(scope, family, command, undefined, undefined, true);
  if ("receipt" in prepared) return { ...present(prepared.receipt), learnersAnalysed: Number(prepared.receipt.learnerCount) };
  const [details, actions] = await Promise.all([
    listOrganisationLearnerLifecycleDetails(session),
    listOperationalActions(session, { includeTerminal: true }),
  ]);
  assertIntelligenceSourceCoverage(prepared, { learnerIds: details.map(detail => detail.learnerRecordId), actionIds: actions.map(action => action.id) });
  const existing = prepared.signals.map(row => signalFromRow(row as SignalRow));
  const now = new Date().toISOString();
  const detected = details.filter(detail => prepared.eligibleLearnerIds.includes(detail.learnerRecordId)).flatMap((detail) => analyseProgressReviewIntelligence({
    organisationId: context.organisation.id,
    learnerRecordId: detail.learnerRecordId,
    learnerLabel: detail.learner.name,
    providerId: detail.programme.providerId,
    programmeId: detail.programme.programmeId,
    reviews: detail.reviewHistory,
    progressUpdates: detail.progressHistory,
    operationalActions: actions.filter((action) => prepared.eligibleActionIds.includes(action.id) && action.learnerRecordId === detail.learnerRecordId).map((action) => ({
      id: action.id,
      status: action.status,
      title: action.title,
      dueDate: action.dueDate,
      sourceDate: action.detectedAt,
    })),
    assessmentReadinessAligned: detail.assessmentReadinessResult.readyForAssessment,
    now,
  }).signals);
  const reconciled = reconcileIntelligenceSignals(existing, detected, now);

  const completed = await intelligenceCommand(scope, family, command, prepared, reconciled.map(signalToRow));
  if (!("receipt" in completed)) throw new IntelligenceCommandError("The analysis could not be confirmed.");
  return { ...present(completed.receipt), learnersAnalysed: Number(completed.receipt.learnerCount) };
}

export async function updateIntelligenceSignal(session: LevyTateBetaSession, signalId: string, action: "acknowledge" | "dismiss" | "accept", reason: IntelligenceDismissalReason | undefined, key: IntelligenceDecisionKey, expectedOrganisationId?: string) {
  const context = await intelligenceContext(session, true);
  assertIntelligenceExpectedOrganisation(actorScope(context), expectedOrganisationId);
  const completed = await intelligenceCommand(actorScope(context), family, { action, signalId, ...key, ...(action === "dismiss" ? { reason } : {}) });
  if (!("receipt" in completed) || !completed.receipt.signal) throw new IntelligenceCommandError("The signal decision could not be confirmed.");
  return { signal: signalFromRow(completed.receipt.signal as SignalRow), confirmation: completed.receipt.confirmation };
}

async function selectSignalRows(organisationId: string) {
  return supabaseSelect<SignalRow>(requireConfig(), signalsTable, new URLSearchParams({ select: "*", organisation_id: `eq.${organisationId}`, analyser_version: `eq.${family}`, order: "detected_at.desc", limit: "1000" }));
}

function signalToRow(signal: IntelligenceSignal): SignalRow {
  return { organisation_id: signal.organisationId, id: signal.id, revision: signal.revision, fingerprint: signal.fingerprint, entity_type: signal.entityType, entity_id: signal.entityId, learner_record_id: signal.learnerRecordId ?? null, provider_id: signal.providerId ?? null, programme_id: signal.programmeId ?? null, category: signal.category, signal_type: signal.signalType, title: signal.title, summary: signal.summary, evidence: signal.evidence, confidence: signal.confidence, priority: signal.priority, recommended_action: signal.recommendedAction ?? "", suggested_owner_type: signal.suggestedOwnerType ?? "", suggested_due_date: signal.suggestedDueDate ?? null, status: signal.status, linked_operational_action_id: signal.linkedOperationalActionId ?? null, analyser_version: signal.analyserVersion, model_identifier: signal.modelIdentifier ?? "", detected_at: signal.detectedAt, last_evaluated_at: signal.lastEvaluatedAt, resolved_at: signal.resolvedAt ?? null, acknowledged_by: signal.acknowledgedBy ?? "", acknowledged_at: signal.acknowledgedAt ?? null, dismissed_by: signal.dismissedBy ?? "", dismissed_at: signal.dismissedAt ?? null, dismissal_reason: signal.dismissalReason ?? "", updated_at: new Date().toISOString() };
}

function signalFromRow(row: SignalRow): IntelligenceSignal {
  return { id: row.id, revision: row.revision, fingerprint: row.fingerprint, organisationId: row.organisation_id, entityType: row.entity_type, entityId: row.entity_id, learnerRecordId: row.learner_record_id ?? undefined, providerId: row.provider_id ?? undefined, programmeId: row.programme_id ?? undefined, category: row.category, signalType: row.signal_type, title: row.title, summary: row.summary, evidence: Array.isArray(row.evidence) ? row.evidence : [], confidence: row.confidence, priority: row.priority, recommendedAction: row.recommended_action || undefined, suggestedOwnerType: row.suggested_owner_type as IntelligenceSignal["suggestedOwnerType"], suggestedDueDate: row.suggested_due_date ?? undefined, status: row.status, linkedOperationalActionId: row.linked_operational_action_id ?? undefined, detectedAt: row.detected_at, lastEvaluatedAt: row.last_evaluated_at, resolvedAt: row.resolved_at ?? undefined, analyserVersion: row.analyser_version, modelIdentifier: row.model_identifier || undefined, acknowledgedBy: row.acknowledged_by || undefined, acknowledgedAt: row.acknowledged_at ?? undefined, dismissedBy: row.dismissed_by || undefined, dismissedAt: row.dismissed_at ?? undefined, dismissalReason: row.dismissal_reason as IntelligenceDismissalReason || undefined };
}
