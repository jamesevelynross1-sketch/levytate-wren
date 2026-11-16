import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ session: vi.fn(), context: vi.fn(), detail: vi.fn(), declare: vi.fn(), limit: vi.fn(), memberships: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: "synthetic-session" }) }) }));
vi.mock("@/lib/server/levytate-supabase", async (original) => ({ ...await original<typeof import("@/lib/server/levytate-supabase")>(), getLevyTateSupabaseConfig: () => ({}), supabaseSelect: state.memberships }));
vi.mock("@/lib/server/levytate-authorised-session", () => ({ readAuthorisedLevyTateBetaSession: state.session }));
vi.mock("@/lib/server/levytate-auth-rate-limit", () => ({ checkAuthenticatedWriteLimit: state.limit, LevyTateRateLimitStoreError: class extends Error {} }));
vi.mock("@/lib/server/levytate-learner-lifecycle", async (original) => ({ ...await original<typeof import("@/lib/server/levytate-learner-lifecycle")>(), getLearnerLifecycleServerContext: state.context, getOrganisationLearnerLifecycleRecordDetail: state.detail, confirmEmployeeEligibility: state.declare }));
import { GET } from "@/app/api/levytate-learners/[learnerRecordId]/route";
import { POST } from "@/app/api/levytate-learners/[learnerRecordId]/employee-declaration/route";
const params = { params: Promise.resolve({ learnerRecordId: "fictional-learner" }) };
const origin = "https://candidate.vercel.app";
function request(method: string, account: string, body?: unknown) { return new Request(`${origin}/api/levytate-learners/fictional-learner/employee-declaration`, { method, headers: { origin, "content-type": "application/json", "x-levytate-account": account }, ...(body ? { body: JSON.stringify(body) } : {}) }); }
const command = { confirmed: true, expectedUpdatedAt: "2026-11-09T18:00:00.000Z", expectedEnglandWorkingHoursPercentage: 75, idempotencyKey: "declaration-original-key" };
beforeEach(() => { vi.resetAllMocks(); vi.stubEnv("VERCEL_ENV", "preview"); vi.stubEnv("VERCEL_URL", "candidate.vercel.app"); state.session.mockResolvedValue({ email: "current@example.test" }); state.limit.mockResolvedValue({ allowed: true }); state.context.mockResolvedValue({ organisation: { id: "fictional-a" } }); state.detail.mockResolvedValue({ learnerRecordId: "fictional-learner" }); state.declare.mockResolvedValue({ learnerRecordId: "fictional-learner" }); });
afterEach(() => vi.unstubAllEnvs());
describe("personal declaration account boundary (route units)", () => {
  it("denies a stale-account read before loading learner data", async () => {
    expect((await GET(request("GET", "previous@example.test"), params)).status).toBe(409);
    expect(state.detail).not.toHaveBeenCalled(); expect(state.context).not.toHaveBeenCalled();
  });
  it("denies a stale-account declaration before write budget or mutation", async () => {
    expect((await POST(request("POST", "previous@example.test", command), params)).status).toBe(409);
    expect(state.declare).not.toHaveBeenCalled(); expect(state.limit).not.toHaveBeenCalled();
  });
  it("denies a retained learner read after the same account moves workspace", async () => {
    state.memberships.mockResolvedValue([{ email: "current@example.test", organisation_id: "71000000-0000-4000-8000-000000000002", active: true }]);
    const retained = request("GET", "current@example.test"); retained.headers.set("x-levytate-organisation", "71000000-0000-4000-8000-000000000001");
    expect((await GET(retained, params)).status).toBe(409);
    expect(state.detail).not.toHaveBeenCalled(); expect(state.context).not.toHaveBeenCalled();
  });
  it("returns the authoritative tenant envelope for the own read", async () => {
    const result = await GET(request("GET", "current@example.test"), params);
    expect(result.status).toBe(200); expect(await result.json()).toMatchObject({ organisationId: "fictional-a", learner: { learnerRecordId: "fictional-learner" } });
  });
  it("preserves the command and tenant envelope for an accepted route unit response", async () => {
    const result = await POST(request("POST", "current@example.test", command), params);
    expect(result.status).toBe(200); expect(state.declare.mock.calls[0][2]).toEqual(command);
    expect(await result.json()).toMatchObject({ organisationId: "fictional-a" });
  });
});
