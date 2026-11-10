import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ session: vi.fn(), membership: vi.fn(), budget: vi.fn(), list: vi.fn(), analyse: vi.fn(), decide: vi.fn(), workspace: vi.fn(), refresh: vi.fn(), dismiss: vi.fn(), create: vi.fn(), CommandError: class extends Error { constructor(message: string, readonly status: number) { super(message); } } }));
vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => ({ value: 'synthetic-session' }) }) }));
vi.mock('@/lib/server/levytate-authorised-session', () => ({ readAuthorisedLevyTateBetaSession: mocks.session }));
vi.mock('@/lib/server/levytate-supabase', () => ({ getLevyTateSupabaseConfig: () => ({}), supabaseSelect: mocks.membership }));
vi.mock('@/lib/server/levytate-auth-rate-limit', () => ({ checkAuthenticatedWriteLimit: mocks.budget, LevyTateRateLimitStoreError: class extends Error {} }));
vi.mock('@/lib/server/levytate-intelligence-commands', () => ({ IntelligenceCommandError: mocks.CommandError }));
vi.mock('@/lib/server/levytate-intelligence-signals', () => ({ listIntelligenceSignals: mocks.list, analyseAndPersistIntelligenceSignals: mocks.analyse, updateIntelligenceSignal: mocks.decide }));
vi.mock('@/lib/server/levytate-autopilot', () => ({ getAutopilotWorkspace: mocks.workspace, refreshAutopilotWorkspace: mocks.refresh, dismissAutopilotSignal: mocks.dismiss, createAutopilotAction: mocks.create, LevyTateAutopilotError: class extends Error {} }));
vi.mock('@/lib/server/levytate-learner-lifecycle', () => ({ LevyTateLearnerLifecyclePermissionError: class extends Error {} }));
import { GET as intelligenceGet, POST as intelligencePost } from '@/app/api/levytate-intelligence/signals/route';
import { GET as autopilotGet, POST as autopilotPost } from '@/app/api/levytate-autopilot/route';
const email = 'lead@fictional.invalid', organisationId = '10000000-0000-4000-8000-000000000001', idempotencyKey = '20000000-0000-4000-8000-000000000002';
const pin = { 'X-LevyTate-Account': email, 'X-LevyTate-Organisation': organisationId };
function request(body?: unknown, headers: Record<string, string> = pin) { return new Request('https://candidate.vercel.app/api/levytate-test', { headers: { ...headers, ...(body === undefined ? {} : { origin: 'https://candidate.vercel.app', 'content-type': 'application/json' }) }, ...(body === undefined ? {} : { method: 'POST', body: JSON.stringify(body) }) }); }
const commands = [
  ['analyse', intelligencePost, mocks.analyse, { action: 'analyse', idempotencyKey }, [{ email }, { idempotencyKey }]],
  ['acknowledge', intelligencePost, mocks.decide, { action: 'acknowledge', signalId: 'signal-a', expectedRevision: 2, idempotencyKey }, [{ email }, 'signal-a', 'acknowledge', undefined, { idempotencyKey, expectedRevision: 2 }]],
  ['accept', intelligencePost, mocks.decide, { action: 'accept', signalId: 'signal-a', expectedRevision: 2, idempotencyKey }, [{ email }, 'signal-a', 'accept', undefined, { idempotencyKey, expectedRevision: 2 }]],
  ['dismiss intelligence', intelligencePost, mocks.decide, { action: 'dismiss', signalId: 'signal-a', expectedRevision: 2, idempotencyKey, reason: 'No action required' }, [{ email }, 'signal-a', 'dismiss', 'No action required', { idempotencyKey, expectedRevision: 2 }]],
  ['refresh', autopilotPost, mocks.refresh, { action: 'refresh', idempotencyKey }, [{ email }, { idempotencyKey }]],
  ['dismiss autopilot', autopilotPost, mocks.dismiss, { action: 'dismiss', signalId: 'signal-a', expectedRevision: 2, idempotencyKey, reason: 'Fictional resolution' }, [{ email }, 'signal-a', 'Fictional resolution', { idempotencyKey, expectedRevision: 2 }]],
  ['create action', autopilotPost, mocks.create, { action: 'create_action', signalId: 'signal-a', expectedRevision: 2, idempotencyKey, title: 'Fictional action', ownerType: 'Line Manager', dueDate: '2026-11-11', communicationDraft: '' }, [{ email }, 'signal-a', { title: 'Fictional action', ownerType: 'Line Manager', dueDate: '2026-11-11', communicationDraft: '' }, { idempotencyKey, expectedRevision: 2 }]],
] as const;
beforeEach(() => { vi.resetAllMocks(); vi.stubEnv('VERCEL_ENV', 'preview'); vi.stubEnv('VERCEL_URL', 'candidate.vercel.app'); mocks.session.mockResolvedValue({ email }); mocks.membership.mockResolvedValue([{ email, organisation_id: organisationId, active: true }]); mocks.budget.mockResolvedValue({ allowed: true }); for (const service of [mocks.list, mocks.analyse, mocks.decide, mocks.workspace, mocks.refresh, mocks.dismiss, mocks.create]) service.mockResolvedValue({ confirmation: { idempotencyKey }, revision: 3, scope: { organisationId, userEmail: email, role: "Apprenticeship Lead" } }); vi.spyOn(console, 'error').mockImplementation(() => {}); });
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });
describe.each(commands)('%s exact HTTP command contract (unit service transport)', (_label, post, service, body, args) => {
  it('preserves the original key and revision on every request, without generating a replacement', async () => {
    for (let i = 0; i < 2; i++) { const result = await post(request(body)); expect(result.status).toBe(200); expect(result.headers.get('cache-control')).toContain('no-store'); }
    expect(service).toHaveBeenCalledTimes(2); expect(service.mock.calls[0]).toEqual([...args, organisationId]); expect(service.mock.calls[1]).toEqual([...args, organisationId]);
  });
  it('requires the key, rejects hidden actor/tenant and malformed revision before the service', async () => {
    for (const change of [{ idempotencyKey: undefined }, { idempotencyKey: 'not-uuid' }, { actorId: 'foreign' }, { organisationId: 'foreign' }, { expectedRevision: '2' }, { expectedRevision: -1 }]) expect((await post(request({ ...body, ...change }))).status).toBe(400);
    expect(service).not.toHaveBeenCalled();
  });
  it('denies stale identity before any command execution', async () => { expect((await post(request(body, { ...pin, 'X-LevyTate-Account': 'other@fictional.invalid' }))).status).toBe(409); expect(service).not.toHaveBeenCalled(); expect(mocks.budget).not.toHaveBeenCalled(); });
  it.each([400, 403, 404, 409, 503])('preserves atomic command HTTP%s failure instead of falsely confirming', async status => { service.mockRejectedValueOnce(new mocks.CommandError('Public command failure', status)); const result = await post(request(body)); expect(result.status).toBe(status); expect(await result.json()).toEqual({ message: 'Public command failure' }); });
});
describe.each([['Intelligence', intelligenceGet, mocks.list], ['Autopilot', autopilotGet, mocks.workspace]] as const)('%s read boundary', (_label, get, service) => {
  it('rejects stale account or employer before loading data', async () => { expect((await get(request(undefined, { ...pin, 'X-LevyTate-Account': 'other@fictional.invalid' }))).status).toBe(409); mocks.membership.mockResolvedValue([{ email, organisation_id: '30000000-0000-4000-8000-000000000003', active: true }]); expect((await get(request())).status).toBe(409); expect(service).not.toHaveBeenCalled(); });
  it.each([
    { scope: { organisationId: "30000000-0000-4000-8000-000000000003", userEmail: email }, status: 409 },
    { scope: { organisationId, userEmail: "other@fictional.invalid" }, status: 409 },
    { scope: undefined, status: 503 },
  ])("withholds the response when the service resolves a different or unverifiable scope after precheck", async ({ scope, status }) => {
    service.mockResolvedValue({ scope, privateMarker: "foreign-tenant-data" });
    const result = await get(request()); expect(service).toHaveBeenCalledOnce(); expect(result.status).toBe(status); expect(await result.text()).not.toContain("foreign-tenant-data");
  });
  it('retains the current canonical scope and does not issue an analysis write', async () => { expect((await get(request())).status).toBe(200); expect(service).toHaveBeenCalledOnce(); expect(mocks.budget).not.toHaveBeenCalled(); for (const writer of [mocks.refresh, mocks.analyse, mocks.decide, mocks.dismiss, mocks.create]) expect(writer).not.toHaveBeenCalled(); });
  it('returns unavailable for session or membership failures without private diagnostics', async () => { mocks.session.mockRejectedValueOnce(new Error('Private upstream detail')); const result = await get(request()); expect(result.status).toBe(503); expect(await result.text()).not.toContain('Private'); expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain('Private'); expect(service).not.toHaveBeenCalled(); });
});
