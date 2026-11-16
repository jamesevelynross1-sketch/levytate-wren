import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ context: vi.fn(), details: vi.fn(), select: vi.fn(), selectAll: vi.fn(), rpc: vi.fn() }));
vi.mock('@/lib/server/levytate-supabase', () => ({ getLevyTateSupabaseConfig: () => ({}), supabaseSelect: mocks.select, supabaseSelectAll: mocks.selectAll, supabaseFetchJson: mocks.rpc, LevyTateSupabaseError: class extends Error {} }));
vi.mock('@/lib/server/levytate-learner-lifecycle', () => ({ getLearnerLifecycleServerContext: mocks.context, listOrganisationLearnerLifecycleDetails: mocks.details, LevyTateLearnerLifecyclePermissionError: class extends Error {} }));
vi.mock('@/lib/server/levytate-manager-scope', () => ({ getManagerDirectReportContext: vi.fn(), listManagerDirectReportApplications: vi.fn() }));
import { synchroniseOrganisationOperationalActions, LevyTateOperationalActionConflictError } from '@/lib/server/levytate-operational-actions';
const tenantA = '10000000-0000-4000-8000-000000000001', tenantB = '20000000-0000-4000-8000-000000000002';
const session = { email: 'lead@fictional.invalid' } as Parameters<typeof synchroniseOrganisationOperationalActions>[0];
const row = { organisation_id: tenantB, id: 'existing-action', learner_record_id: 'fictional-learner', application_id: 'fictional-application', employee_id: 'fictional-person', action_type: 'add_progress_update', source_type: 'learner_record', source_key: 'fictional-source', status: 'open', version: 1, metadata: {}, created_at: '2026-11-10T00:00:00Z' };
beforeEach(() => {
  vi.clearAllMocks();
  mocks.context.mockResolvedValue({ organisation: { id: tenantB }, user: { id: 'current-actor', email: session.email, role: 'Apprenticeship Lead' } });
  mocks.details.mockResolvedValue([]);
  mocks.select.mockImplementation(async (_config, table) => table === 'levytate_employees' ? [{ name: 'Fictional Lead' }] : []);
  mocks.selectAll.mockResolvedValue([row]);
  mocks.rpc.mockResolvedValue({ ...row, status: 'completed', version: 2 });
});
describe('actual Operations synchronisation entry tenant binding (unit, no database)', () => {
  it('rejects canonical tenant B against retained tenant A before any source write', async () => {
    let failure: unknown;
    try { await synchroniseOrganisationOperationalActions(session, tenantA); }
    catch (error) { failure = error; }
    expect.soft(mocks.rpc).not.toHaveBeenCalled();
    expect(failure).toBeInstanceOf(LevyTateOperationalActionConflictError);
    expect(mocks.details).not.toHaveBeenCalled();
    expect(mocks.selectAll).not.toHaveBeenCalled();
  });
  it.each([undefined, tenantB, ` ${tenantB.toUpperCase()} `])('preserves explicitly current and internal callers: %s', async expected => {
    const result = await synchroniseOrganisationOperationalActions(session, expected);
    expect(mocks.details).toHaveBeenCalledWith(session, tenantB); expect(result.organisationId).toBe(tenantB); expect(result.completed).toBe(1);
    expect(mocks.rpc).toHaveBeenCalledOnce();
    expect(JSON.parse(mocks.rpc.mock.calls[0][2].body)).toMatchObject({ p_organisation_id: tenantB, p_actor_user_id: 'current-actor', p_operation: 'source_resolve' });
  });
});
