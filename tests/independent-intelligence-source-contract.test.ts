import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { analyseProgressReviewIntelligence, progressReviewSignalTypes, reconcileIntelligenceSignals, type IntelligenceSignal } from '@/lib/levytate/intelligence/progress-review';
import { progressReviewDemoScenarios } from '@/lib/levytate/intelligence/demo-progress-review';
import { analyseLearningTimeAutopilot, analyseOperationsAutopilot, reconcileAutopilotSignals, type AutopilotActionInput, type AutopilotAnalysisInput, type DetectedAutopilotSignal } from '@/lib/levytate/autopilot/operations-autopilot';
import { deriveApplicationWorkflowCompatibility } from '@/lib/levytate/application-workflows/compatibility';
import { decodeAutopilotRead, decodeIntelligenceRead } from '@/lib/levytate/intelligence-client-response';
const mocks = vi.hoisted(() => ({ select: vi.fn(), context: vi.fn() }));
vi.mock('@/lib/server/levytate-supabase', () => ({ getLevyTateSupabaseConfig: () => ({ url: 'https://synthetic.invalid', serviceRoleKey: 'fictional-unit-only' }), supabaseSelect: mocks.select, supabaseFetchJson: () => { throw new Error('No RPC execution is allowed in this source-contract suite'); }, supabaseInsert: () => { throw new Error('No writes are allowed in this source-contract suite'); }, supabaseUpdate: () => { throw new Error('No writes are allowed in this source-contract suite'); } }));
vi.mock('@/lib/server/levytate-learner-lifecycle', () => ({ getLearnerLifecycleServerContext: mocks.context, LevyTateLearnerLifecyclePermissionError: class extends Error {} }));
vi.mock('@/lib/levytate/autopilot/ai', () => ({ interpretAutopilotSignal: () => { throw new Error('No model execution is allowed in this source-contract suite'); } }));
import { getAutopilotWorkspace } from '@/lib/server/levytate-autopilot';
import { listIntelligenceSignals } from '@/lib/server/levytate-intelligence-signals';
const now = '2026-11-10T12:00:00Z';
const organisationId = '10000000-0000-4000-8000-000000000001';
const scope = { organisationId, userEmail: 'lead@fictional.invalid', role: 'Apprenticeship Lead' };
const session = { email: scope.userEmail } as Parameters<typeof getAutopilotWorkspace>[0];
function action(id: string, ownerType: AutopilotActionInput['ownerType'], dueDate = '2026-11-01', learnerRecordId = 'learner-action'): AutopilotActionInput {
  return { id, learnerRecordId, applicationId: 'application-action', employeeId: 'employee-action', title: 'Fictional action', description: 'Recorded fictional action', actionType: 'address_progress_exception', ownerType, dueDate, status: 'open', sourceUrl: '/levytate/app?module=Operations', updatedAt: now };
}
function sourceInput(): AutopilotAnalysisInput {
  return { organisationId, now, learners: [{ learnerRecordId: 'learner-review', learnerName: 'Fictional learner', providerId: 'provider-a', providerName: 'Fictional provider', programmeId: 'programme-a', programmeName: 'Fictional programme', reviews: [
    { id: 'review-provider', type: 'provider_review', nextReviewDate: '2026-11-09', reviewDate: '2026-10-01', status: 'completed', createdAt: '2026-10-01T12:00:00Z' },
    { id: 'review-manager', type: 'manager_check_in', nextReviewDate: '2026-11-13', reviewDate: '2026-10-01', status: 'action_required', createdAt: '2026-10-01T12:00:00Z' },
    { id: 'review-lead', type: 'l_and_d_check_in', nextReviewDate: '2026-11-20', reviewDate: '2026-10-01', status: 'completed', createdAt: '2026-10-01T12:00:00Z' },
  ] }], actions: [action('review-related', 'Apprenticeship Lead', '2026-11-14', 'learner-review'), action('provider-action', 'Provider'), action('manager-overdue', 'Line Manager'), action('manager-upcoming', 'Line Manager', '2026-11-12'), action('generic-action', 'Apprenticeship Lead'), action('application-only-action', 'Line Manager', '2026-11-01', '')], applications: [
    { id: 'application-manager', employeeId: 'employee-manager', employeeName: 'Fictional employee', status: 'Awaiting Manager Review', currentOwner: 'Line Manager', updatedAt: '2026-10-01T12:00:00Z' },
    { id: 'application-provider', employeeId: 'employee-provider', employeeName: 'Fictional employee', status: 'Approved for Enrolment', currentOwner: 'Provider Partner', updatedAt: '2026-10-01T12:00:00Z' },
    { id: 'application-stalled', employeeId: 'employee-stalled', employeeName: 'Fictional employee', status: 'Awaiting Final Approval', currentOwner: 'Apprenticeship Lead', updatedAt: '2026-10-01T12:00:00Z' },
  ] };
}
const learningTypes = ['otj_plan_missing', 'otj_activity_needs_information', 'otj_submission_awaiting_employer_check', 'otj_provider_confirmation_pending', 'otj_working_hours_clarification', 'otj_no_recent_activity'] as const;
function learningSignals() { return analyseLearningTimeAutopilot({ organisationId, now, learners: [{ learnerRecordId: 'learner-learning', learnerName: 'Fictional learner', providerId: 'provider-a', programmeId: 'programme-a', attention: learningTypes.map(type => ({ type, label: 'Recorded attention item', detail: 'Fictional recorded evidence' })) }] }); }
function progressSignals() { return progressReviewDemoScenarios.flatMap(input => analyseProgressReviewIntelligence({ ...input, organisationId, now }).signals); }

// This fixture represents the Data API wire row, not a SQL executor. The tests
// exercise the real server read adapters and strict client decoders; native SQL
// authorization/rollback evidence belongs to the independent database suite.
function wire(signal: IntelligenceSignal | DetectedAutopilotSignal): Record<string, unknown> {
  const auto = 'interpretation' in signal;
  return { organisation_id: signal.organisationId, id: signal.id, revision: 1, analyser_version: auto ? 'operations-autopilot-v1' : signal.analyserVersion, fingerprint: signal.fingerprint, entity_type: signal.entityType, entity_id: signal.entityId, learner_record_id: signal.learnerRecordId ?? null, provider_id: signal.providerId ?? null, programme_id: signal.programmeId ?? null, category: signal.category, signal_type: signal.signalType, title: signal.title, summary: signal.summary, evidence: signal.evidence, confidence: auto ? 'High' : signal.confidence, priority: auto ? ({ action_now: 'High', this_week: 'Medium', upcoming: 'Low' }[signal.priority]) : signal.priority, recommended_action: signal.recommendedAction ?? '', suggested_owner_type: signal.suggestedOwnerType ?? '', suggested_due_date: signal.suggestedDueDate || null, status: 'new', linked_operational_action_id: signal.linkedOperationalActionId ?? null, detected_at: now, last_evaluated_at: now, resolved_at: null, acknowledged_at: null, acknowledged_by: '', dismissed_at: null, dismissed_by: '', dismissal_reason: '', model_identifier: '', ...(auto ? { signal_key: signal.signalKey, lane: signal.lane, autopilot_priority: signal.priority, suggested_action_type: signal.suggestedActionType, deterministic_payload: { ...signal.deterministicPayload, subjectLabel: signal.subjectLabel, applicationId: signal.applicationId ?? '', employeeId: signal.employeeId ?? '' }, ai_interpretation: null, communication_draft: '' } : {}) };
}
beforeEach(() => { vi.resetAllMocks(); vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(now)); mocks.context.mockResolvedValue({ organisation: { id: organisationId }, user: { id: 'actor-a', email: scope.userEmail, role: scope.role } }); });
afterEach(() => vi.useRealTimers());
describe('independent generator provenance against reviewed candidate27 source predicates', () => {
  it('covers every current progress signal and ties every emitted review/progress ID to its actual source', () => {
    const all = progressSignals(); expect(new Set(all.map(signal => signal.signalType))).toEqual(new Set(progressReviewSignalTypes));
    for (const signal of all) {
      expect(signal.entityType).toBe('learner'); expect(signal.entityId).toBe(signal.learnerRecordId);
      const input = progressReviewDemoScenarios.find(input => input.learnerRecordId === signal.learnerRecordId)!;
      for (const evidence of signal.evidence) {
        const review = input.reviews.find(review => review.id === evidence.sourceId);
        if (review) expect(evidence.sourceType).toBe(review.reviewType);
        else { expect(evidence.sourceType).toBe('progress_update'); expect(input.progressUpdates.find(update => update.id === evidence.sourceId)?.learnerRecordId).toBe(signal.learnerRecordId); }
      }
    }
  });
  it.each(['other', 'manager_check_in', 'l_and_d_check_in'] as const)('does not mislabel %s as provider-review evidence (the fallback is currently unreachable)', reviewType => {
    for (const example of progressReviewDemoScenarios) {
      const input = { ...example, organisationId, reviews: example.reviews.map(review => ({ ...review, reviewType })) };
      const result = analyseProgressReviewIntelligence(input); expect(result.facts.providerReviews).toHaveLength(0);
      const reviewIds = new Set(input.reviews.map(review => review.id));
      expect(result.signals.flatMap(signal => signal.evidence).some(evidence => reviewIds.has(evidence.sourceId))).toBe(false);
    }
  });
  it('emits the complete Autopilot entity/evidence matrix without inventing learner links on action signals', () => {
    const input = sourceInput(), signals = [...analyseOperationsAutopilot(input), ...learningSignals()];
    expect(new Set(signals.map(signal => signal.entityType))).toEqual(new Set(['review', 'operational_action', 'application', 'learner']));
    expect(new Set(signals.flatMap(signal => signal.evidence.map(evidence => evidence.sourceType)))).toEqual(new Set(['learner_review', 'operational_action', 'application', 'learning_time']));
    expect(new Set(signals.map(signal => signal.signalType))).toEqual(new Set(['review_overdue', 'review_due_with_outstanding_actions', 'review_upcoming', 'provider_dependency_overdue', 'manager_action_overdue', 'manager_action_due_soon', 'operational_action_overdue', 'application_awaiting_manager', 'application_awaiting_provider', 'application_stalled', ...learningTypes]));
    for (const signal of signals) for (const evidence of signal.evidence) {
      if (evidence.sourceType === 'learner_review') expect(input.learners.find(learner => learner.learnerRecordId === signal.learnerRecordId)?.reviews.some(review => review.id === evidence.sourceId)).toBe(true);
      if (evidence.sourceType === 'operational_action') { const source = input.actions.find(action => action.id === evidence.sourceId); expect(source).toBeDefined(); if (signal.entityType === 'operational_action') { expect(signal.entityId).toBe(source!.id); expect(signal.linkedOperationalActionId).toBe(source!.id); expect(signal.learnerRecordId).toBeUndefined(); } else expect(source!.learnerRecordId).toBe(signal.learnerRecordId); }
      if (evidence.sourceType === 'application') expect(input.applications.find(application => application.id === evidence.sourceId)?.id).toBe(signal.entityId);
      if (evidence.sourceType === 'learning_time') expect(evidence.sourceId).toBe(signal.learnerRecordId);
    }
  });
  it('keeps already-resolved Intelligence history in subsequent complete reconciliation snapshots', () => {
    const first = progressSignals(); const resolved = reconcileIntelligenceSignals(first, [], now);
    expect(resolved).toHaveLength(first.length); expect(resolved.every(signal => signal.status === 'resolved')).toBe(true);
    const again = reconcileIntelligenceSignals(resolved, [], '2026-11-11T12:00:00Z');
    expect(again.map(signal => signal.id).sort()).toEqual(resolved.map(signal => signal.id).sort());
    expect(again.every(signal => signal.resolvedAt === now)).toBe(true);
  });
  it('keeps already-resolved Autopilot history in subsequent complete reconciliation snapshots', () => {
    const initial = reconcileAutopilotSignals([], analyseOperationsAutopilot(sourceInput()), now);
    const resolved = reconcileAutopilotSignals(initial, [], now); const again = reconcileAutopilotSignals(resolved, [], '2026-12-10T12:00:00Z');
    expect(again.map(signal => signal.id).sort()).toEqual(resolved.map(signal => signal.id).sort());
    expect(again.every(signal => signal.resolvedAt === now)).toBe(true);
  });
  it.each(['Declined by Line Manager', 'Declined by Apprenticeship Lead'] as const)('does not manufacture an application-stalled signal from terminal %s workflow data', status => {
    const application = { status, currentOwner: 'Completed' as const, updatedAt: '2026-10-01T12:00:00Z' };
    const workflow = deriveApplicationWorkflowCompatibility(application);
    const signals = analyseOperationsAutopilot({ organisationId, now, learners: [], actions: [], applications: [{ id: 'closed-application', employeeId: 'employee-a', employeeName: 'Fictional employee', status: workflow.status, currentOwner: workflow.currentOwner, updatedAt: workflow.lastProgressedAt }] });
    expect(signals).toEqual([]);
  });
});
describe('full server read adapter to strict client decoder compatibility (mocked Data API, no DB execution)', () => {
  it('reads every generated progress signal through the actual row adapter and complete scoped envelope', async () => {
    const generated = progressSignals(); mocks.select.mockImplementation(async (_config, table) => table === 'levytate_intelligence_workspaces' ? [{ revision: 1, reconciled_at: now }] : generated.map(wire));
    const response = { ok: true, ...await listIntelligenceSignals(session) };
    const decoded = decodeIntelligenceRead(response, scope); expect(decoded.signals).toHaveLength(generated.length); expect(decoded.checked).toBe(true);
  });
  it('reads every generated Autopilot entity and evidence family through the actual row adapter', async () => {
    const generated = [...analyseOperationsAutopilot(sourceInput()), ...learningSignals()]; mocks.select.mockImplementation(async (_config, table) => table === 'levytate_intelligence_workspaces' ? [{ revision: 1, reconciled_at: now }] : generated.map(wire));
    const response = { ok: true, workspace: await getAutopilotWorkspace(session) };
    const decoded = decodeAutopilotRead(response, scope); expect(Object.values(decoded.lanes).flat()).toHaveLength(generated.length); expect(decoded.checked).toBe(true);
  });
});
