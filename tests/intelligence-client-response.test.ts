import { describe, expect, it, vi } from 'vitest';
import { analyseProgressReviewIntelligence } from '@/lib/levytate/intelligence/progress-review';
import { progressReviewDemoScenarios } from '@/lib/levytate/intelligence/demo-progress-review';
import { analyseOperationsAutopilot, buildOperationsBrief, autopilotLanes } from '@/lib/levytate/autopilot/operations-autopilot';
import { decodeAutopilotMutation, decodeAutopilotRead, decodeIntelligenceAnalysis, decodeIntelligenceDecision, decodeIntelligenceRead, type ClientAutopilotSignal, type IntelligenceClientCommand } from '@/lib/levytate/intelligence-client-response';
import { createOperationsClientCommand } from '@/lib/levytate/operations-client-command';
const scope = { organisationId: 'tenant-a', userEmail: 'lead@fictional.invalid', role: 'Apprenticeship Lead' };
const now = '2026-11-10T12:00:00Z'; const key = '10000000-0000-4000-8000-000000000001';
function signal() { return { ...analyseProgressReviewIntelligence({ ...progressReviewDemoScenarios[0], organisationId: scope.organisationId, now }).signals[0], revision: 1 }; }
function intelligence() { return { ok: true, scope, organisationId: scope.organisationId, signals: [signal()], revision: 1, lastAnalysedAt: now, checked: true }; }
function automatic(): ClientAutopilotSignal {
  const detected = analyseOperationsAutopilot({ organisationId: scope.organisationId, now, learners: [], actions: [], applications: [{ id: 'application-a', employeeId: 'person-a', employeeName: 'Fictional Employee', status: 'Awaiting Manager Review', currentOwner: 'Line Manager', updatedAt: '2026-10-01T12:00:00Z' }] });
  return { ...detected[0], revision: 1, status: 'new' };
}
function workspace(signals: ClientAutopilotSignal[] = [automatic()]) {
  return { scope, organisationId: scope.organisationId, revision: 1, generatedAt: now, checked: true, analyserVersion: 'operations-autopilot-v1', brief: buildOperationsBrief(signals), lanes: Object.fromEntries(autopilotLanes.map(lane => [lane, signals.filter(signal => signal.lane === lane)])) };
}
function confirmation(command: IntelligenceClientCommand, revision: number) { return { ...scope, idempotencyKey: command.idempotencyKey, action: command.action, signalId: command.signalId ?? null, revision }; }
describe('Intelligence actual deterministic-model response contracts (fictional unit data)', () => {
  it('accepts populated generated evidence and validates successful empty recorded checks', () => {
    expect(decodeIntelligenceRead(intelligence(), scope).signals).toHaveLength(1);
    expect(Object.values(decodeAutopilotRead({ ok: true, workspace: workspace() }, scope).lanes).flat()).toHaveLength(1);
    expect(decodeAutopilotRead({ ok: true, workspace: workspace([]) }, scope).checked).toBe(true);
    const command = { action: 'analyse' as const, idempotencyKey: key };
    expect(decodeIntelligenceAnalysis({ ...intelligence(), signals: [], learnersAnalysed: 0, confirmation: confirmation(command, 1) }, scope, command).checked).toBe(true);
  });
  it('distinguishes never-checked from a completed zero-result analysis without inventing a timestamp', () => {
    const fresh = { ...workspace([]), generatedAt: null, checked: false, revision: 0 };
    expect(decodeAutopilotRead({ ok: true, workspace: fresh }, scope).generatedAt).toBeNull();
    for (const change of [{ generatedAt: now }, { checked: true }]) expect(() => decodeAutopilotRead({ ok: true, workspace: { ...fresh, ...change } }, scope)).toThrow();
    expect(() => decodeIntelligenceRead({ ...intelligence(), checked: false }, scope)).toThrow();
  });
  it.each([{ scope: { ...scope, role: 'Employee' } }, { scope: { ...scope, userEmail: 'other@fictional.invalid' } }, { organisationId: 'tenant-b' }, { signals: [{ ...signal(), organisationId: 'tenant-b' }] }, { signals: [{ ...signal(), evidence: [null] }] }, { signals: [{ ...signal(), evidence: [{ sourceType: 'provider_review' }] }] }, { signals: [{ ...signal(), revision: '1' }] }, { signals: [{ ...signal(), detectedAt: 'invalid' }] }])('rejects unsafe Intelligence read %j', change => { expect(() => decodeIntelligenceRead({ ...intelligence(), ...change }, scope)).toThrow(); });
  it.each([{ lanes: {} }, { brief: {} }, { scope: { ...scope, organisationId: 'tenant-b' } }, { lanes: { ...workspace().lanes, [automatic().lane]: [{ ...automatic(), interpretation: {} }] } }, { lanes: { ...workspace().lanes, [automatic().lane]: [{ ...automatic(), evidence: [{ ...automatic().evidence[0], url: 'https://foreign.invalid/' }] }] } }, { lanes: { ...workspace().lanes, [automatic().lane]: [{ ...automatic(), organisationId: 'tenant-b' }] } }, { lanes: { ...workspace().lanes, [automatic().lane]: [{ ...automatic(), lane: 'upcoming' }] } }])('rejects unsafe Autopilot read %j', change => { expect(() => decodeAutopilotRead({ ok: true, workspace: { ...workspace(), ...change } }, scope)).toThrow(); });
  it.each(['acknowledge', 'dismiss', 'accept'] as const)('requires exact %s target/revision/key/scope and linked action when accepted', action => {
    const command = { action, signalId: signal().id, expectedRevision: 1, idempotencyKey: key };
    const value = { ok: true, signal: { ...signal(), revision: 2, status: action === 'accept' ? 'accepted' : action === 'dismiss' ? 'dismissed' : 'acknowledged', linkedOperationalActionId: action === 'accept' ? 'action-a' : undefined }, confirmation: confirmation(command, 2) };
    expect(decodeIntelligenceDecision(value, scope, command).revision).toBe(2);
    for (const change of [{ idempotencyKey: '20000000-0000-4000-8000-000000000002' }, { signalId: 'foreign' }, { revision: 3 }, { organisationId: 'tenant-b' }, { userEmail: 'other@fictional.invalid' }, { action: 'analyse' }]) expect(() => decodeIntelligenceDecision({ ...value, confirmation: { ...value.confirmation, ...change } }, scope, command)).toThrow();
    expect(() => decodeIntelligenceDecision({ ...value, signal: { ...value.signal, revision: 1 } }, scope, command)).toThrow();
    if (action === 'accept') expect(() => decodeIntelligenceDecision({ ...value, signal: { ...value.signal, linkedOperationalActionId: undefined } }, scope, command)).toThrow();
  });
  it('validates Autopilot refresh/dismiss/create receipts and exact action linkage', () => {
    const refresh = { action: 'refresh' as const, idempotencyKey: key };
    expect(decodeAutopilotMutation({ ok: true, workspace: { ...workspace(), confirmation: confirmation(refresh, 1) } }, scope, refresh).workspace.checked).toBe(true);
    const dismiss = { action: 'dismiss' as const, idempotencyKey: key, signalId: automatic().id, expectedRevision: 1 };
    expect(decodeAutopilotMutation({ ok: true, workspace: { ...workspace([]), confirmation: confirmation(dismiss, 2) } }, scope, dismiss).workspace.checked).toBe(true);
    const create = { ...dismiss, action: 'create_action' as const }; const accepted = { ...automatic(), revision: 2, status: 'accepted' as const, linkedOperationalActionId: 'action-a' };
    const value = { ok: true, workspace: workspace([accepted]), operationalActionId: 'action-a', reused: false, confirmation: confirmation(create, 2) };
    expect(decodeAutopilotMutation(value, scope, create).operationalActionId).toBe('action-a');
    for (const change of [{ operationalActionId: 'foreign' }, { confirmation: undefined }, { workspace: workspace([{ ...accepted, revision: 1 }]) }]) expect(() => decodeAutopilotMutation({ ...value, ...change }, scope, create)).toThrow();
  });
  it.each(['analyse', 'refresh', 'acknowledge', 'dismiss', 'accept', 'create_action'] as const)('retains the original %s command after ambiguous transport, without replacing input or identity', async action => {
    const body = { action, idempotencyKey: key, ...(action === 'analyse' || action === 'refresh' ? {} : { signalId: 'signal-a', expectedRevision: 1 }), reason: 'Original reason' }; let attempts = 0;
    const sent: { path: string; body: unknown; identity: unknown }[] = [];
    const fetcher = vi.fn(async (path, init, identity) => { sent.push({ path, body: init?.body, identity: { ...identity } }); attempts++; if (attempts === 1) throw new Error('Lost after upstream commit (simulated transport only)'); return Response.json({ verified: true }); });
    const command = createOperationsClientCommand({ email: scope.userEmail, organisationId: scope.organisationId }, fetcher); const confirmed = vi.fn();
    await expect(command.execute('/api/levytate-autopilot', body, value => value, confirmed)).rejects.toThrow(); body.reason = 'Changed input';
    await command.retry(); expect(fetcher.mock.calls).toHaveLength(2); expect(sent[1]).toEqual(sent[0]); expect(JSON.parse(String(sent[1]?.body)).reason).toBe('Original reason');
    expect(confirmed).toHaveBeenCalledOnce(); expect(command.pending).toBe(false);
  });
});
