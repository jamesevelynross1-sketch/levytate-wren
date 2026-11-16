import { describe, expect, it, vi } from 'vitest';
import { createOperationsClientCommand } from '@/lib/levytate/operations-client-command';
import { decodeManagerAction, decodeManagerActions, decodeManagerMutation, decodeOperationalDetail, decodeOperationalMutation, decodeOperationsSummary } from '@/lib/levytate/operations-client-response';
import { operationalDetail } from './helpers/operational-action-fixture';
const scope = { organisationId: 'tenant-a', userEmail: 'manager@fictional.invalid', role: 'Line Manager' };
const identity = { organisationId: scope.organisationId, email: scope.userEmail };
const manager = () => ({ scope, actionId: 'action-a', title: 'Review', employeeName: 'Fictional Learner', programmeName: 'Fictional Programme', priority: 'High', status: 'acknowledged', statusLabel: 'Acknowledged', dueDate: '', timingLabel: 'No due date', overdue: false, reason: 'Review', kind: 'manager_support', submittedDate: '', submittedVersion: null, primaryAction: 'Start work', sourceUrl: '/levytate/app/my-team/person-a', version: 3, employee: { name: 'Fictional Learner', jobTitle: '', department: '', site: '' }, programme: { name: 'Fictional Programme', providerName: '' }, ownerLabel: 'Line Manager', detectedAt: '2026-11-10T12:00:00Z', nextStep: 'Start work', history: [] });
describe('strict Operations confirmation and read models', () => {
  it('accepts the complete management model and matching atomic receipt', () => {
    const detail = operationalDetail(); expect(decodeOperationalDetail({ ok: true, ...detail }, { actionId: detail.action.id, organisationId: identity.organisationId })).toEqual({ ok: true, ...detail });
    expect(decodeOperationalMutation({ ok: true, action: { ...detail.action, status: 'acknowledged', version: 3 } }, { action: detail.action, command: 'acknowledge', payload: {} }).version).toBe(3);
  });
  it.each([{}, { ok: false }, { action: {} }, { action: null }])('rejects malformed HTTP200 %j', value => { expect(() => decodeOperationalMutation(value, { action: operationalDetail().action, command: 'acknowledge', payload: {} })).toThrow(); });
  it.each([{ id: 'foreign' }, { organisationId: 'foreign' }, { version: 2 }, { version: 4 }, { status: 'open' }, { metadata: { cancellation: {} } }, { sourceUrl: 'https://foreign.invalid/' }])('rejects a misleading or unsafe returned action %j', change => {
    expect(() => decodeOperationalMutation({ ok: true, action: { ...operationalDetail().action, status: 'acknowledged', version: 3, ...change } }, { action: operationalDetail().action, command: 'acknowledge', payload: {} })).toThrow();
  });
  it.each([{ context: { ...operationalDetail().context, sourceFacts: [null] } }, { history: [{}] }, { ownerOptions: [{}] }, { previousOccurrences: [{ ...operationalDetail().action, organisationId: 'foreign' }] }])('validates every rendered detail child %j', change => { expect(() => decodeOperationalDetail({ ok: true, ...operationalDetail(), ...change }, { actionId: 'action-a', organisationId: 'tenant-a' })).toThrow(); });
  it('validates manager children, tenant/account/role and original confirmation after the current action advances', () => {
    expect(decodeManagerAction({ ok: true, action: manager() }, scope, 'action-a').version).toBe(3);
    for (const change of [{ employee: null }, { history: [{}] }, { detectedAt: 'invalid' }, { scope: { ...scope, organisationId: 'tenant-b' } }, { scope: { ...scope, userEmail: 'other@fictional.invalid' } }, { scope: { ...scope, role: 'Employee' } }]) expect(() => decodeManagerAction({ ok: true, action: { ...manager(), ...change } }, scope, 'action-a')).toThrow();
    const value = { ok: true, action: { ...manager(), version: 4, status: 'in_progress' }, confirmation: { actionId: 'action-a', version: 3, status: 'acknowledged' } };
    expect(decodeManagerMutation(value, scope, { actionId: 'action-a', version: 2, command: 'acknowledge' }).version).toBe(4);
    for (const change of [{ actionId: 'foreign' }, { version: 4 }, { status: 'in_progress' }]) expect(() => decodeManagerMutation({ ...value, confirmation: { ...value.confirmation, ...change } }, scope, { actionId: 'action-a', version: 2, command: 'acknowledge' })).toThrow();
  });
  it('does not interpret malformed lists or an unscoped empty list as zero work', () => {
    const list = { scope, source: 'supabase', generatedAt: '2026-11-10T12:00:00Z', summary: { open: 0, acknowledged: 1, inProgress: 0, overdue: 0 }, actions: [manager()] };
    expect(decodeManagerActions(list, scope).actions).toHaveLength(1);
    for (const change of [{ scope: undefined }, { summary: {} }, { actions: [null] }]) expect(() => decodeManagerActions({ ...list, ...change }, scope)).toThrow();
    expect(() => decodeOperationsSummary({ ok: true, summary: {}, queues: {}, filterOptions: {}, recentActivity: [] }, scope)).toThrow();
  });
});
describe('one retained original Operations command (transport fault injection)', () => {
  it.each(['lost', 'malformed', 'expired', 'conflict'])('preserves path/body/actor and rejects replacement after %s response', async failure => {
    const originalIdentity = { ...identity }; const sent: { path: string; body: unknown; identity: unknown }[] = [];
    const transport = vi.fn(async (path, init, expected) => { sent.push({ path, body: init?.body, identity: { ...expected } }); if (sent.length === 1) { if (failure === 'lost') throw new Error('Connection interrupted'); return Response.json(failure === 'malformed' ? {} : { message: 'Unavailable' }, { status: failure === 'expired' ? 401 : failure === 'conflict' ? 409 : 200 }); } return Response.json({ ok: true, action: { ...operationalDetail().action, version: 3, status: 'acknowledged' } }); });
    const command = createOperationsClientCommand(originalIdentity, transport); const confirmed = vi.fn(); const body = { command: 'acknowledge', expectedVersion: 2 };
    await expect(command.execute('/api/levytate-operational-actions/action-a', body, value => decodeOperationalMutation(value, { action: operationalDetail().action, command: 'acknowledge', payload: {} }), confirmed, 'PATCH')).rejects.toThrow();
    expect(command.pending).toBe(true); expect(confirmed).not.toHaveBeenCalled();
    body.expectedVersion = 99; originalIdentity.organisationId = 'tenant-b'; originalIdentity.email = 'other@fictional.invalid';
    await expect(command.execute('/foreign', {}, () => null, vi.fn())).rejects.toThrow();
    await command.retry(); expect(sent).toHaveLength(2); expect(sent[1]).toEqual(sent[0]); expect(sent[1]?.identity).toEqual(identity); expect(confirmed).toHaveBeenCalledOnce(); expect(command.pending).toBe(false);
  });
});
