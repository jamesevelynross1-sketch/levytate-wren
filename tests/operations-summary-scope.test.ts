import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ context: vi.fn(), details: vi.fn(), actions: vi.fn(), synchronise: vi.fn() }));
vi.mock('@/lib/server/levytate-learner-lifecycle', () => ({ getLearnerLifecycleServerContext: mocks.context, listOrganisationLearnerLifecycleDetails: mocks.details }));
vi.mock('@/lib/server/levytate-operational-actions', () => ({ listOperationalActions: mocks.actions, synchroniseOrganisationOperationalActions: mocks.synchronise, LevyTateOperationalActionConflictError: class extends Error {} }));
import { getOrganisationOperationsSummary } from '@/lib/server/levytate-operations';
import { LevyTateOperationalActionConflictError } from '@/lib/server/levytate-operational-actions';
const tenantA = '10000000-0000-4000-8000-000000000001', tenantB = '20000000-0000-4000-8000-000000000002';
const user = { id: 'lead-a', email: 'lead@fictional.invalid', role: 'Apprenticeship Lead' };
const session = { email: user.email } as Parameters<typeof getOrganisationOperationsSummary>[0];
beforeEach(() => { vi.clearAllMocks(); mocks.context.mockResolvedValue({ organisation: { id: tenantA }, user }); mocks.details.mockResolvedValue([]); mocks.actions.mockResolvedValue([]); mocks.synchronise.mockResolvedValue({ organisationId: tenantA }); });
describe('Operations summary read provenance (unit)', () => {
  it('retains the original optional tenant through the synchronisation service', async () => {
    const response = await getOrganisationOperationsSummary(session, {}, { synchronise: true, expectedOrganisationId: tenantA });
    expect(mocks.synchronise).toHaveBeenCalledWith(session, tenantA); expect(mocks.details).toHaveBeenCalledWith(session, tenantA); expect(response.scope).toEqual({ organisationId: tenantA, userEmail: user.email, role: user.role });
  });
  it('does not read a newly assigned organisation after synchronising the original tenant', async () => {
    mocks.context.mockResolvedValue({ organisation: { id: tenantB }, user });
    await expect(getOrganisationOperationsSummary(session, {}, { synchronise: true })).rejects.toBeInstanceOf(LevyTateOperationalActionConflictError);
    expect(mocks.details).not.toHaveBeenCalled(); expect(mocks.actions).not.toHaveBeenCalled();
  });
  it('rejects a retained original tenant before loading another organisation', async () => {
    await expect(getOrganisationOperationsSummary(session, {}, { expectedOrganisationId: tenantB })).rejects.toBeInstanceOf(LevyTateOperationalActionConflictError);
    expect(mocks.synchronise).not.toHaveBeenCalled(); expect(mocks.details).not.toHaveBeenCalled();
  });
  it('does not combine actions from another independently resolved tenant', async () => {
    mocks.actions.mockResolvedValue([{ organisationId: tenantB, sourceKey: 'foreign-source' }]);
    await expect(getOrganisationOperationsSummary(session)).rejects.toBeInstanceOf(LevyTateOperationalActionConflictError);
  });
  it.each([
    { organisation: { id: tenantB }, user },
    { organisation: { id: tenantA }, user: { ...user, id: 'another-member' } },
    { organisation: { id: tenantA }, user: { ...user, role: 'Department Head' } },
    { organisation: { id: tenantA }, user: { ...user, email: 'other@fictional.invalid' } },
  ])('fails closed when the final canonical read context changes, including empty action sets', async current => {
    mocks.context.mockResolvedValueOnce({ organisation: { id: tenantA }, user }).mockResolvedValueOnce(current);
    await expect(getOrganisationOperationsSummary(session)).rejects.toBeInstanceOf(LevyTateOperationalActionConflictError);
  });
  it('preserves unpinned read-only internal callers', async () => {
    const response = await getOrganisationOperationsSummary(session); expect(response.scope.organisationId).toBe(tenantA); expect(response.totalAttentionItems).toBe(0); expect(mocks.synchronise).not.toHaveBeenCalled();
  });
});
