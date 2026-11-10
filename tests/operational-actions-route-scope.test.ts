import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ session: vi.fn(), synchronise: vi.fn(), budget: vi.fn(), membership: vi.fn() }));
vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => ({ value: 'synthetic-session' }) }) }));
vi.mock('@/lib/server/levytate-authorised-session', () => ({ readAuthorisedLevyTateBetaSession: mocks.session }));
vi.mock('@/lib/server/levytate-supabase', () => ({ getLevyTateSupabaseConfig: () => ({}), supabaseSelect: mocks.membership }));
vi.mock('@/lib/server/levytate-auth-rate-limit', () => ({ checkAuthenticatedWriteLimit: mocks.budget, LevyTateRateLimitStoreError: class extends Error {} }));
vi.mock('@/lib/server/levytate-learner-lifecycle', () => ({ LevyTateLearnerLifecycleConflictError: class extends Error {}, LevyTateLearnerLifecyclePermissionError: class extends Error {} }));
vi.mock('@/lib/server/levytate-operational-actions', () => ({ listOperationalActions: vi.fn(), synchroniseOrganisationOperationalActions: mocks.synchronise, LevyTateOperationalActionConflictError: class extends Error {} }));
import { POST } from '@/app/api/levytate-operational-actions/route';
import { LevyTateOperationalActionConflictError } from '@/lib/server/levytate-operational-actions';
const organisationId = '10000000-0000-4000-8000-000000000001';
const session = { email: 'lead@fictional.invalid' };
function request(tenant?: string) { return new Request('https://candidate.vercel.app/api/levytate-operational-actions', { method: 'POST', headers: { origin: 'https://candidate.vercel.app', ...(tenant ? { 'x-levytate-organisation': tenant } : {}) } }); }
beforeEach(() => { vi.resetAllMocks(); vi.stubEnv('VERCEL_ENV', 'preview'); vi.stubEnv('VERCEL_URL', 'candidate.vercel.app'); mocks.session.mockResolvedValue(session); mocks.budget.mockResolvedValue({ allowed: true }); mocks.membership.mockResolvedValue([{ email: session.email, organisation_id: organisationId, active: true }]); mocks.synchronise.mockResolvedValue({ organisationId }); });
afterEach(() => vi.unstubAllEnvs());
describe('targetless Operational Actions POST tenant binding (unit)', () => {
  it('passes the original validated tenant separately from the authenticated session', async () => {
    expect((await POST(request(organisationId))).status).toBe(200); expect(mocks.synchronise).toHaveBeenCalledWith(session, organisationId);
  });
  it('preserves authorised callers without an optional pin', async () => {
    expect((await POST(request())).status).toBe(200); expect(mocks.synchronise).toHaveBeenCalledWith(session, undefined); expect(mocks.membership).not.toHaveBeenCalled();
  });
  it('returns a generic conflict when canonical context changes after a valid initial pin', async () => {
    mocks.synchronise.mockRejectedValueOnce(new LevyTateOperationalActionConflictError('private membership detail'));
    const response = await POST(request(organisationId)); expect(response.status).toBe(409); expect(await response.text()).not.toContain('private membership');
  });
  it('still rejects a stale initial pin before invoking synchronisation', async () => {
    const response = await POST(request('20000000-0000-4000-8000-000000000002')); expect(response.status).toBe(409); expect(mocks.synchronise).not.toHaveBeenCalled(); expect(mocks.budget).not.toHaveBeenCalled();
  });
});
