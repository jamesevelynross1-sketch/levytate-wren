import { randomUUID } from "node:crypto";
import type { LevyTateBetaSession } from "@/lib/levytate/config/beta-access";
import {
  acceptSignalAsOperationalAction,
  analyseProgressReviewIntelligence,
  reconcileIntelligenceSignals,
  type IntelligenceDismissalReason,
  type IntelligenceSignal,
  type IntelligenceSignalStatus,
} from "@/lib/levytate/intelligence/progress-review";
import { operationalPriorityRanks } from "@/lib/levytate/mvp/operations-centre";
import { hasMvpPermission, normaliseMvpUserRole } from "@/lib/levytate/mvp/rbac";
import { getLearnerLifecycleServerContext, listOrganisationLearnerLifecycleDetails, LevyTateLearnerLifecyclePermissionError } from "@/lib/server/levytate-learner-lifecycle";
import { listOperationalActions } from "@/lib/server/levytate-operational-actions";
import { getLevyTateSupabaseConfig, supabaseInsert, supabaseSelect, supabaseUpdate } from "@/lib/server/levytate-supabase";

const signalsTable = "levytate_intelligence_signals";
const eventsTable = "levytate_intelligence_signal_events";

type SignalRow = {
  organisation_id: string; id: string; fingerprint: string; entity_type: IntelligenceSignal["entityType"]; entity_id: string;
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
  const rows = await selectSignalRows(context.organisation.id);
  return rows.map(signalFromRow).filter((signal) => !["dismissed", "resolved"].includes(signal.status));
}

export async function analyseAndPersistIntelligenceSignals(session: LevyTateBetaSession) {
  const context = await intelligenceContext(session, true);
  const [details, actions, existingRows] = await Promise.all([
    listOrganisationLearnerLifecycleDetails(session),
    listOperationalActions(session, { includeTerminal: true }),
    selectSignalRows(context.organisation.id),
  ]);
  const existing = existingRows.map(signalFromRow);
  const now = new Date().toISOString();
  const detected = details.flatMap((detail) => analyseProgressReviewIntelligence({
    organisationId: context.organisation.id,
    learnerRecordId: detail.learnerRecordId,
    learnerLabel: detail.learner.name,
    providerId: detail.programme.providerId,
    programmeId: detail.programme.programmeId,
    reviews: detail.reviewHistory,
    progressUpdates: detail.progressHistory,
    operationalActions: actions.filter((action) => action.learnerRecordId === detail.learnerRecordId).map((action) => ({
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

  for (const signal of reconciled) {
    const previous = existing.find((item) => item.id === signal.id);
    await supabaseInsert<SignalRow>(requireConfig(), signalsTable, [signalToRow(signal)], {
      query: "on_conflict=organisation_id,id",
      prefer: "resolution=merge-duplicates,return=minimal",
    });
    const eventType = !previous ? "detected" : previous.status !== signal.status && signal.status === "resolved" ? "resolved" : previous.lastEvaluatedAt !== signal.lastEvaluatedAt ? "updated" : null;
    if (eventType) await recordSignalEvent(context.organisation.id, signal, eventType, previous?.status ?? "", signal.status, context.user.id, context.user.email);
  }
  return { learnersAnalysed: details.length, signals: reconciled.filter((signal) => !["dismissed", "resolved"].includes(signal.status)) };
}

export async function updateIntelligenceSignal(session: LevyTateBetaSession, signalId: string, action: "acknowledge" | "dismiss" | "accept", reason?: IntelligenceDismissalReason) {
  const context = await intelligenceContext(session, true);
  const rows = await supabaseSelect<SignalRow>(requireConfig(), signalsTable, new URLSearchParams({
    select: "*", organisation_id: `eq.${context.organisation.id}`, id: `eq.${signalId}`, limit: "1",
  }));
  const current = rows[0] ? signalFromRow(rows[0]) : null;
  if (!current) throw new LevyTateIntelligenceError("The Intelligence signal was not found.");
  if (["dismissed", "resolved"].includes(current.status)) throw new LevyTateIntelligenceError("The Intelligence signal is no longer active.");
  const now = new Date().toISOString();
  let status: IntelligenceSignalStatus;
  let linkedOperationalActionId = current.linkedOperationalActionId;
  if (action === "accept") {
    linkedOperationalActionId = await createOperationalAction(context, current);
    status = "accepted";
  } else if (action === "dismiss") {
    if (!reason) throw new LevyTateIntelligenceError("A dismissal reason is required.");
    status = "dismissed";
  } else {
    status = "acknowledged";
  }
  await supabaseUpdate(requireConfig(), signalsTable, `organisation_id=eq.${context.organisation.id}&id=eq.${signalId}`, {
    status,
    linked_operational_action_id: linkedOperationalActionId || null,
    acknowledged_by: action === "acknowledge" ? context.user.id : current.acknowledgedBy ?? "",
    acknowledged_at: action === "acknowledge" ? now : current.acknowledgedAt ?? null,
    dismissed_by: action === "dismiss" ? context.user.id : current.dismissedBy ?? "",
    dismissed_at: action === "dismiss" ? now : current.dismissedAt ?? null,
    dismissal_reason: action === "dismiss" ? reason : current.dismissalReason ?? "",
    updated_at: now,
  }, { prefer: "return=minimal" });
  const updated = { ...current, status, linkedOperationalActionId, acknowledgedBy: action === "acknowledge" ? context.user.id : current.acknowledgedBy, acknowledgedAt: action === "acknowledge" ? now : current.acknowledgedAt, dismissedBy: action === "dismiss" ? context.user.id : current.dismissedBy, dismissedAt: action === "dismiss" ? now : current.dismissedAt, dismissalReason: action === "dismiss" ? reason : current.dismissalReason };
  await recordSignalEvent(context.organisation.id, updated, status === "accepted" ? "accepted" : status === "dismissed" ? "dismissed" : "acknowledged", current.status, status, context.user.id, context.user.email);
  return updated;
}

async function createOperationalAction(context: Awaited<ReturnType<typeof getLearnerLifecycleServerContext>>, signal: IntelligenceSignal) {
  const input = acceptSignalAsOperationalAction(signal);
  const learnerRows = await supabaseSelect<{ employee_id: string; application_id: string }>(requireConfig(), "levytate_learner_records", new URLSearchParams({
    select: "employee_id,application_id", organisation_id: `eq.${context.organisation.id}`, id: `eq.${input.learnerRecordId}`, limit: "1",
  }));
  const learner = learnerRows[0];
  if (!learner) throw new LevyTateIntelligenceError("The learner linked to this signal was not found.");
  const now = new Date().toISOString();
  const created = await supabaseInsert<{ id: string }>(requireConfig(), "levytate_operational_actions", [{
    organisation_id: context.organisation.id, id: input.id, learner_record_id: input.learnerRecordId, application_id: learner.application_id,
    employee_id: learner.employee_id, source_type: input.sourceType, source_key: input.sourceKey, action_type: input.actionType,
    title: input.title, description: input.description, priority: input.priority, priority_rank: operationalPriorityRanks[input.priority],
    status: "open", owner_type: input.ownerType, owner_user_id: context.user.id, owner_display_name: context.user.email,
    due_date: input.dueDate || null, detected_at: now, source_url: `/levytate/app?module=Operations&learner=${encodeURIComponent(input.learnerRecordId)}`,
    metadata: { sourceCondition: "intelligence_signal_accepted", signalId: signal.id, signalFingerprint: signal.fingerprint }, version: 1, created_at: now, updated_at: now,
  }], { query: "on_conflict=organisation_id,id", prefer: "resolution=ignore-duplicates,return=representation" });
  if (created.length) {
    await supabaseInsert(requireConfig(), "levytate_operational_action_events", [{ organisation_id: context.organisation.id, id: randomUUID(), operational_action_id: input.id, event_type: "detected", previous_status: "", new_status: "open", actor_user_id: context.user.id, actor_name: context.user.email, event_date: now, summary: "Intelligence signal accepted as an operational action.", metadata: { signalId: signal.id }, created_at: now }]);
  }
  return input.id;
}

async function selectSignalRows(organisationId: string) {
  return supabaseSelect<SignalRow>(requireConfig(), signalsTable, new URLSearchParams({ select: "*", organisation_id: `eq.${organisationId}`, order: "detected_at.desc", limit: "1000" }));
}

function signalToRow(signal: IntelligenceSignal): SignalRow {
  return { organisation_id: signal.organisationId, id: signal.id, fingerprint: signal.fingerprint, entity_type: signal.entityType, entity_id: signal.entityId, learner_record_id: signal.learnerRecordId ?? null, provider_id: signal.providerId ?? null, programme_id: signal.programmeId ?? null, category: signal.category, signal_type: signal.signalType, title: signal.title, summary: signal.summary, evidence: signal.evidence, confidence: signal.confidence, priority: signal.priority, recommended_action: signal.recommendedAction ?? "", suggested_owner_type: signal.suggestedOwnerType ?? "", suggested_due_date: signal.suggestedDueDate ?? null, status: signal.status, linked_operational_action_id: signal.linkedOperationalActionId ?? null, analyser_version: signal.analyserVersion, model_identifier: signal.modelIdentifier ?? "", detected_at: signal.detectedAt, last_evaluated_at: signal.lastEvaluatedAt, resolved_at: signal.resolvedAt ?? null, acknowledged_by: signal.acknowledgedBy ?? "", acknowledged_at: signal.acknowledgedAt ?? null, dismissed_by: signal.dismissedBy ?? "", dismissed_at: signal.dismissedAt ?? null, dismissal_reason: signal.dismissalReason ?? "", updated_at: new Date().toISOString() };
}

function signalFromRow(row: SignalRow): IntelligenceSignal {
  return { id: row.id, fingerprint: row.fingerprint, organisationId: row.organisation_id, entityType: row.entity_type, entityId: row.entity_id, learnerRecordId: row.learner_record_id ?? undefined, providerId: row.provider_id ?? undefined, programmeId: row.programme_id ?? undefined, category: row.category, signalType: row.signal_type, title: row.title, summary: row.summary, evidence: Array.isArray(row.evidence) ? row.evidence : [], confidence: row.confidence, priority: row.priority, recommendedAction: row.recommended_action || undefined, suggestedOwnerType: row.suggested_owner_type as IntelligenceSignal["suggestedOwnerType"], suggestedDueDate: row.suggested_due_date ?? undefined, status: row.status, linkedOperationalActionId: row.linked_operational_action_id ?? undefined, detectedAt: row.detected_at, lastEvaluatedAt: row.last_evaluated_at, resolvedAt: row.resolved_at ?? undefined, analyserVersion: row.analyser_version, modelIdentifier: row.model_identifier || undefined, acknowledgedBy: row.acknowledged_by || undefined, acknowledgedAt: row.acknowledged_at ?? undefined, dismissedBy: row.dismissed_by || undefined, dismissedAt: row.dismissed_at ?? undefined, dismissalReason: row.dismissal_reason as IntelligenceDismissalReason || undefined };
}

async function recordSignalEvent(organisationId: string, signal: IntelligenceSignal, eventType: string, previousStatus: string, newStatus: string, actorUserId: string, actorName: string) {
  const now = new Date().toISOString();
  await supabaseInsert(requireConfig(), eventsTable, [{ organisation_id: organisationId, id: randomUUID(), signal_id: signal.id, event_type: eventType, previous_status: previousStatus, new_status: newStatus, actor_user_id: actorUserId, actor_name: actorName, event_date: now, summary: `Intelligence signal ${eventType}.`, metadata: {}, created_at: now }]);
}
