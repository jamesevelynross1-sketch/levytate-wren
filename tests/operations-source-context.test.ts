import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ select: vi.fn(), selectAll: vi.fn(), rpc: vi.fn(), insert: vi.fn(), update: vi.fn() }));
vi.mock('@/lib/server/levytate-supabase', () => ({ getLevyTateSupabaseConfig: () => ({}), supabaseSelect: mocks.select, supabaseSelectAll: mocks.selectAll, supabaseFetchJson: mocks.rpc, supabaseInsert: mocks.insert, supabaseUpdate: mocks.update, LevyTateSupabaseError: class extends Error {} }));
import { synchroniseOrganisationOperationalActions, getOperationalActionManagementDetail, completeOperationalAction, updateOperationalActionDueDate } from '@/lib/server/levytate-operational-actions';
import { listOrganisationLearnerLifecycleDetails, LevyTateLearnerLifecycleConflictError } from '@/lib/server/levytate-learner-lifecycle';
import { getOrganisationOperationsSummary } from '@/lib/server/levytate-operations';
const tenantA = '10000000-0000-4000-8000-000000000001', tenantB = '20000000-0000-4000-8000-000000000002';
const session = { email: 'lead@fictional.invalid' } as Parameters<typeof synchroniseOrganisationOperationalActions>[0];
const row = { organisation_id: tenantA, id: 'existing-action', learner_record_id: 'fictional-learner', application_id: 'fictional-application', employee_id: 'fictional-person', action_type: 'add_progress_update', source_type: 'learner_record', source_key: 'fictional-source', status: 'open', version: 1, metadata: {}, created_at: '2026-11-10T00:00:00Z' };
let memberships: string[];
beforeEach(() => {
  vi.clearAllMocks(); memberships = [tenantA, tenantB, tenantA, tenantA];
  mocks.select.mockImplementation(async (_config, table, query: URLSearchParams) => {
    if (table === 'levytate_users') return [{ id: 'current-actor', organisation_id: memberships.shift() ?? tenantA, email: session.email, role: 'Apprenticeship Lead' }];
    if (table === 'levytate_organisations') return [{ id: query.get('id')!.slice(3), name: 'Fictional employer' }];
    if (table === 'levytate_operational_actions') return [row];
    if (table === 'levytate_employees') return [{ id: 'fictional-person', name: 'Fictional Lead', email: session.email, department: 'Fictional department', manager_id: '' }];
    return [];
  });
  mocks.selectAll.mockImplementation(async (_config, table) => table === 'levytate_operational_actions' ? [row] : []);
  mocks.rpc.mockResolvedValue({ ...row, status: 'completed', version: 2 });
});
describe('actual Operations and learner source loaders across transient tenant reassignment (unit transport)', () => {
  it.each([{ rows: [] }, { rows: [{ id: 'foreign-record', organisation_id: tenantB, record_status: 'Active' }] }])('rejects another canonical employer before reading either empty or populated learner sets', async ({ rows: foreignRows }) => {
    memberships = [tenantB]; mocks.selectAll.mockResolvedValue(foreignRows);
    await expect(listOrganisationLearnerLifecycleDetails(session, tenantA)).rejects.toBeInstanceOf(LevyTateLearnerLifecycleConflictError);
    expect(mocks.selectAll).not.toHaveBeenCalled(); expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it('keeps unpinned internal learner-list callers and same-tenant empty results valid', async () => {
    memberships = [tenantB, tenantA];
    await expect(listOrganisationLearnerLifecycleDetails(session)).resolves.toEqual([]);
    await expect(listOrganisationLearnerLifecycleDetails(session, tenantA)).resolves.toEqual([]);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it('never resolves tenant A actions using an independently resolved empty tenant B learner set', async () => {
    let failure: unknown;
    try { await synchroniseOrganisationOperationalActions(session, tenantA); } catch (error) { failure = error; }
    expect.soft(mocks.rpc).not.toHaveBeenCalled(); expect(failure).toBeInstanceOf(Error);
    expect(mocks.selectAll.mock.calls.some(call => call[1] === 'levytate_learner_records')).toBe(false);
  });
  it('never labels an empty tenant B learner result as tenant A even if final membership returns to A', async () => {
    await expect(getOrganisationOperationsSummary(session, {}, { expectedOrganisationId: tenantA })).rejects.toThrow();
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.selectAll.mock.calls.some(call => call[1] === 'levytate_learner_records')).toBe(false);
  });
  it.each(['detail', 'complete', 'due_date'] as const)('binds the %s source read to the existing action context, never the newly resolved employer', async operation => {
    mocks.rpc.mockImplementation(async (_config, _path, init) => JSON.parse(init.body).p_probe ? null : { ...row, version: 2 });
    const pending = operation === 'detail' ? getOperationalActionManagementDetail(session, row.id)
      : operation === 'complete' ? completeOperationalAction(session, row.id, 1, 'Fictional completion explanation', true)
      : updateOperationalActionDueDate(session, row.id, 1, '2026-12-01', 'Fictional due date explanation');
    await expect(pending).rejects.toBeInstanceOf(LevyTateLearnerLifecycleConflictError);
    expect(mocks.selectAll.mock.calls.some(call => call[1] === 'levytate_learner_records')).toBe(false);
    expect(mocks.rpc.mock.calls.filter(call => !JSON.parse(call[2].body).p_probe)).toHaveLength(0);
  });
  it('retains successful same-tenant source reconciliation and read-only summary', async () => {
    memberships = Array(12).fill(tenantA);
    const result = await synchroniseOrganisationOperationalActions(session, tenantA); expect(result.completed).toBe(1); expect(mocks.rpc).toHaveBeenCalledOnce();
    mocks.rpc.mockClear();
    const summary = await getOrganisationOperationsSummary(session, {}, { expectedOrganisationId: tenantA }); expect(summary.scope.organisationId).toBe(tenantA); expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.insert).not.toHaveBeenCalled(); expect(mocks.update).not.toHaveBeenCalled();
  });
});
