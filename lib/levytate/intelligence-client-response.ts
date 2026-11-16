import { z } from 'zod';
import { autopilotLanes } from '@/lib/levytate/autopilot/operations-autopilot';
import { intelligenceSignalCategories, progressReviewSignalTypes } from '@/lib/levytate/intelligence/progress-review';
import { decodeOperationsValue, operationalCount, operationalDate, operationalId, operationalOwner, operationalPath, operationalText, operationalTimestamp, operationsScopeSchema, requireOperationsScope, type OperationsClientScope } from '@/lib/levytate/operations-client-response';

const status = z.enum(['new', 'acknowledged', 'accepted', 'dismissed', 'resolved']);
const optionalId = operationalText.optional();
const intelligenceSignal = z.object({ id: operationalId, fingerprint: operationalId, organisationId: operationalId, revision: operationalCount, entityType: z.enum(['learner', 'provider', 'programme', 'organisation']), entityId: operationalId, learnerRecordId: optionalId, providerId: optionalId, programmeId: optionalId, category: z.enum(intelligenceSignalCategories), signalType: z.enum(progressReviewSignalTypes), title: operationalText, summary: operationalText, evidence: z.array(z.object({ sourceType: z.enum(['provider_review', 'manager_check_in', 'l_and_d_check_in', 'progress_update', 'operational_action']), sourceId: operationalId, sourceDate: operationalTimestamp, label: operationalText, excerpt: operationalText.optional(), metric: z.object({ label: operationalText, value: z.union([operationalText, z.number()]) }).optional() })), confidence: z.enum(['High', 'Medium', 'Low']), priority: z.enum(['Critical', 'High', 'Medium', 'Low']), recommendedAction: operationalText.optional(), suggestedOwnerType: operationalOwner.optional(), suggestedDueDate: operationalDate.optional(), status, linkedOperationalActionId: optionalId, detectedAt: operationalTimestamp, lastEvaluatedAt: operationalTimestamp, resolvedAt: operationalTimestamp.optional(), analyserVersion: operationalId, modelIdentifier: operationalText.optional(), acknowledgedBy: operationalText.optional(), acknowledgedAt: operationalTimestamp.optional(), dismissedBy: operationalText.optional(), dismissedAt: operationalTimestamp.optional(), dismissalReason: z.enum(["Already resolved", "Incorrect interpretation", "No action required", "Planned intervention already exists", "Other"]).optional() });
export type ClientIntelligenceSignal = z.infer<typeof intelligenceSignal>;
const intelligenceWorkspace = z.object({ scope: operationsScopeSchema, organisationId: operationalId, signals: z.array(intelligenceSignal), revision: operationalCount, lastAnalysedAt: operationalTimestamp.nullable(), checked: z.boolean() });
const confirmation = operationsScopeSchema.extend({ idempotencyKey: z.string().uuid(), action: operationalId, signalId: operationalId.nullable(), revision: operationalCount });
export type IntelligenceClientCommand = { action: 'analyse' | 'refresh' | 'acknowledge' | 'dismiss' | 'accept' | 'create_action'; idempotencyKey: string; signalId?: string; expectedRevision?: number };
function valid(condition: boolean) { if (!condition) throw new Error('The saved Intelligence response does not match the original account and command. Retry the original update or reload saved state.'); }
function verifyConfirmation(value: z.infer<typeof confirmation>, expected: IntelligenceClientCommand, scope: OperationsClientScope, revision: number) {
  requireOperationsScope(value, scope);
  valid(value.idempotencyKey === expected.idempotencyKey && value.action === expected.action && value.signalId === (expected.signalId ?? null) && value.revision === revision);
  if (expected.expectedRevision !== undefined) valid(revision === expected.expectedRevision + 1);
}
function verifyIntelligenceWorkspace(value: z.infer<typeof intelligenceWorkspace>, scope: OperationsClientScope) {
  requireOperationsScope(value.scope, scope);
  valid(value.organisationId === scope.organisationId && value.signals.every(signal => signal.organisationId === scope.organisationId) && value.checked === (value.lastAnalysedAt !== null));
  return value;
}
export function decodeIntelligenceRead(value: unknown, scope: OperationsClientScope) {
  return verifyIntelligenceWorkspace(decodeOperationsValue(intelligenceWorkspace.extend({ ok: z.literal(true) }), value), scope);
}
export function decodeIntelligenceAnalysis(value: unknown, scope: OperationsClientScope, expected: IntelligenceClientCommand) {
  const result = verifyIntelligenceWorkspace(decodeOperationsValue(intelligenceWorkspace.extend({ ok: z.literal(true), learnersAnalysed: operationalCount, confirmation }), value), scope);
  // Keep the exact receipt alongside the validated read model, even for zero results.
  const receipt = decodeOperationsValue(z.object({ confirmation }), value).confirmation;
  valid(result.checked); verifyConfirmation(receipt, expected, scope, result.revision);
  return result;
}
export function decodeIntelligenceDecision(value: unknown, scope: OperationsClientScope, expected: IntelligenceClientCommand) {
  const result = decodeOperationsValue(z.object({ ok: z.literal(true), signal: intelligenceSignal, confirmation }), value);
  const next = expected.action === 'accept' ? 'accepted' : expected.action === 'dismiss' ? 'dismissed' : 'acknowledged';
  valid(result.signal.id === expected.signalId && result.signal.organisationId === scope.organisationId && result.signal.status === next);
  if (expected.action === 'accept') valid(Boolean(result.signal.linkedOperationalActionId));
  verifyConfirmation(result.confirmation, expected, scope, result.signal.revision);
  return result.signal;
}

const autopilotSignal = z.object({ id: operationalId, signalKey: operationalId, fingerprint: operationalId, organisationId: operationalId, revision: operationalCount, entityType: z.enum(['learner', 'application', 'review', 'operational_action']), entityId: operationalId, learnerRecordId: optionalId, applicationId: optionalId, employeeId: optionalId, providerId: optionalId, programmeId: optionalId, subjectLabel: operationalText, category: z.enum(['reviews', 'actions', 'manager_actions', 'applications', 'provider_dependencies', 'learning_time']), signalType: z.enum(['review_overdue', 'review_due_with_outstanding_actions', 'review_upcoming', 'operational_action_overdue', 'manager_action_overdue', 'manager_action_due_soon', 'application_stalled', 'application_awaiting_manager', 'application_awaiting_provider', 'provider_dependency_overdue', 'otj_plan_missing', 'otj_activity_needs_information', 'otj_submission_awaiting_employer_check', 'otj_provider_confirmation_pending', 'otj_working_hours_clarification', 'otj_no_recent_activity']), lane: z.enum(autopilotLanes), priority: z.enum(['action_now', 'this_week', 'upcoming']), title: operationalText, summary: operationalText, recommendedAction: operationalText, suggestedOwnerType: operationalOwner, suggestedDueDate: operationalDate, suggestedActionType: operationalText, evidence: z.array(z.object({ sourceType: z.enum(['application', 'learner_review', 'operational_action', 'learning_time']), sourceId: operationalId, sourceDate: operationalTimestamp, label: operationalText, value: operationalText, url: operationalPath })), deterministicPayload: z.record(z.string(), z.unknown()), interpretation: z.object({ headline: operationalText, whyItMatters: operationalText, suggestedNextStep: operationalText, draftCommunication: operationalText, evidenceSummary: z.array(operationalText), source: z.enum(['deterministic', 'ai']), modelIdentifier: operationalText }), linkedOperationalActionId: optionalId, detectedAt: operationalTimestamp, lastEvaluatedAt: operationalTimestamp, status, resolvedAt: operationalTimestamp.optional(), dismissedAt: operationalTimestamp.optional(), dismissedBy: operationalText.optional(), dismissalReason: operationalText.optional() });
export type ClientAutopilotSignal = z.infer<typeof autopilotSignal>;
const autopilotWorkspace = z.object({ scope: operationsScopeSchema, organisationId: operationalId, revision: operationalCount, generatedAt: operationalTimestamp.nullable(), checked: z.boolean(), analyserVersion: operationalId, brief: z.object({ actionNow: operationalCount, thisWeek: operationalCount, upcoming: operationalCount, waitingExternally: operationalCount, preparedNextActions: operationalCount, total: operationalCount }), lanes: z.object({ needs_your_decision: z.array(autopilotSignal), ready_to_action: z.array(autopilotSignal), waiting_externally: z.array(autopilotSignal), upcoming: z.array(autopilotSignal), recently_resolved: z.array(autopilotSignal) }), confirmation: confirmation.optional() });
export type ClientAutopilotWorkspace = z.infer<typeof autopilotWorkspace>;
function verifyAutopilotWorkspace(result: ClientAutopilotWorkspace, scope: OperationsClientScope) {
  requireOperationsScope(result.scope, scope);
  valid(result.organisationId === scope.organisationId && result.checked === (result.generatedAt !== null));
  valid(Object.entries(result.lanes).every(([lane, signals]) => signals.every(signal => signal.organisationId === scope.organisationId && signal.lane === lane)));
  return result;
}
export function decodeAutopilotRead(value: unknown, scope: OperationsClientScope) {
  const result = decodeOperationsValue(z.object({ ok: z.literal(true), workspace: autopilotWorkspace }), value);
  return verifyAutopilotWorkspace(result.workspace, scope);
}
export function decodeAutopilotMutation(value: unknown, scope: OperationsClientScope, expected: IntelligenceClientCommand) {
  const result = decodeOperationsValue(z.object({ ok: z.literal(true), workspace: autopilotWorkspace, operationalActionId: operationalId.optional(), reused: z.boolean().optional(), confirmation: confirmation.optional() }), value);
  const workspace = verifyAutopilotWorkspace(result.workspace, scope);
  const receipt = result.confirmation ?? workspace.confirmation;
  valid(Boolean(receipt));
  if (expected.action === 'refresh') { valid(workspace.checked); verifyConfirmation(receipt!, expected, scope, workspace.revision); }
  else {
    verifyConfirmation(receipt!, expected, scope, expected.expectedRevision! + 1);
    const signal = Object.values(workspace.lanes).flat().find(item => item.id === expected.signalId);
    if (expected.action === 'create_action') valid(Boolean(result.operationalActionId) && Boolean(signal) && signal?.status === 'accepted' && signal.revision === receipt!.revision && signal.linkedOperationalActionId === result.operationalActionId);
    else valid(!signal || signal.status === 'dismissed' && signal.revision === receipt!.revision);
  }
  return result;
}
