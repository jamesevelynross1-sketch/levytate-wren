import { beforeEach, expect, it, vi } from 'vitest';
import { operationalDetail } from './helpers/operational-action-fixture';
const mocks = vi.hoisted(() => ({ acknowledge: vi.fn(), start: vi.fn(), read: vi.fn() }));
vi.mock('@/lib/server/levytate-operational-actions', () => ({ acknowledgeManagerDirectReportOperationalAction: mocks.acknowledge, startManagerDirectReportOperationalAction: mocks.start, getManagerDirectReportOperationalAction: mocks.read }));
import { acknowledgeManagerAction, startManagerAction } from '@/lib/server/levytate-manager-actions';
const session = { email: 'manager@fictional.invalid' } as Parameters<typeof acknowledgeManagerAction>[0];
beforeEach(() => {
  vi.resetAllMocks();
  mocks.read.mockResolvedValue({ scope: { organisation: { id: 'tenant-a' }, user: { email: session.email } }, action: { ...operationalDetail().action, version: 5, status: 'completed' }, source: { kind: 'learner', detail: { learner: { name: 'Fictional Learner', jobTitle: '', department: '', site: '' }, programme: { programmeName: 'Fictional Programme', providerName: '' } } }, history: [] });
});
it.each(['acknowledge', 'start'] as const)('keeps the original %s receipt distinct from a subsequently advanced read model', async command => {
  const write = command === 'acknowledge' ? mocks.acknowledge : mocks.start;
  const invoke = command === 'acknowledge' ? acknowledgeManagerAction : startManagerAction;
  const receipt = { ...operationalDetail().action, version: 3, status: command === 'acknowledge' ? 'acknowledged' : 'in_progress' };
  write.mockResolvedValue(receipt);
  const first = await invoke(session, 'action-a', 2); const replay = await invoke(session, 'action-a', 2);
  expect(first.confirmation).toEqual({ actionId: 'action-a', version: 3, status: receipt.status }); expect(replay.confirmation).toEqual(first.confirmation);
  expect(replay.action.version).toBe(5); expect(replay.action.status).toBe('completed'); expect(replay.action.scope).toEqual({ organisationId: 'tenant-a', userEmail: session.email, role: 'Line Manager' });
});
it('cannot return a receipt when the underlying current-permission check denies replay', async () => {
  mocks.acknowledge.mockRejectedValue(new Error('Current manager access denied'));
  await expect(acknowledgeManagerAction(session, 'action-a', 2)).rejects.toThrow('Current manager'); expect(mocks.read).not.toHaveBeenCalled();
});
