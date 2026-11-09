import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ session: vi.fn(), select: vi.fn(), config: vi.fn(), list: vi.fn(), detail: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: "synthetic-session" }) }) }));
vi.mock("@/lib/server/levytate-authorised-session", () => ({ readAuthorisedLevyTateBetaSession: mocks.session }));
vi.mock("@/lib/server/levytate-supabase", () => ({ getLevyTateSupabaseConfig: mocks.config, supabaseSelect: mocks.select }));
vi.mock("@/lib/server/levytate-auth-rate-limit", () => ({ checkAuthenticatedWriteLimit: vi.fn(), LevyTateRateLimitStoreError: class extends Error {} }));
vi.mock("@/lib/server/levytate-learner-lifecycle", () => ({
  listOrganisationLearnerLifecycleSummaries: mocks.list, getOrganisationLearnerLifecycleRecordDetail: mocks.detail, createLearnerRecord: vi.fn(),
  LevyTateLearnerLifecycleError: class extends Error {}, LevyTateLearnerLifecycleConflictError: class extends Error {},
  LevyTateLearnerLifecyclePermissionError: class extends Error {}, LevyTateLearnerLifecycleValidationError: class extends Error {},
}));
vi.mock("@/lib/levytate/mvp/learner-record-view", () => ({ buildLearnerListSummary: () => ({ total: 0 }) }));
import { GET } from "@/app/api/levytate-learners/route";
const email = "lead@example.invalid", tenant = "10000000-0000-4000-8000-000000000001";
beforeEach(() => {
  vi.resetAllMocks(); mocks.session.mockResolvedValue({ email });
  mocks.config.mockReturnValue({ url: "https://synthetic.invalid", serviceRoleKey: "synthetic-only" });
  mocks.select.mockResolvedValue([{ email, organisation_id: tenant, active: true }]);
  mocks.list.mockResolvedValue([]); mocks.detail.mockResolvedValue({ learnerRecordId: "synthetic-record" });
});
describe.each(["", "?learnerRecordId=synthetic-record"])("retained learner read %s", (query) => {
  const read = (headers: Record<string, string>) => GET(new Request(`https://candidate.vercel.app/api/levytate-learners${query}`, { headers }));
  it("rejects a previous signed-in account before reading learner data", async () => {
    expect((await read({ "X-LevyTate-Account": "previous@example.invalid" })).status).toBe(409);
    expect(mocks.list).not.toHaveBeenCalled(); expect(mocks.detail).not.toHaveBeenCalled();
  });
  it("rejects a retained different employer before reading learner data", async () => {
    expect((await read({ "X-LevyTate-Organisation": "20000000-0000-4000-8000-000000000002" })).status).toBe(409);
    expect(mocks.list).not.toHaveBeenCalled(); expect(mocks.detail).not.toHaveBeenCalled();
  });
  it("preserves the exact current identity and no-store response", async () => {
    const result = await read({ "X-LevyTate-Account": email, "X-LevyTate-Organisation": tenant });
    expect(result.status).toBe(200); expect(result.headers.get("cache-control")).toContain("private, no-store");
    expect(query ? mocks.detail : mocks.list).toHaveBeenCalledOnce();
  });
  it("returns unavailable without disclosure when canonical membership cannot be checked", async () => {
    mocks.select.mockRejectedValue(new Error("private database diagnostic"));
    const result = await read({ "X-LevyTate-Organisation": tenant }); expect(result.status).toBe(503);
    expect(await result.text()).not.toContain("private database diagnostic");
    expect(mocks.list).not.toHaveBeenCalled(); expect(mocks.detail).not.toHaveBeenCalled();
  });
  it("requires a genuine authorised session", async () => {
    mocks.session.mockResolvedValue(null); expect((await read({ "X-LevyTate-Organisation": tenant })).status).toBe(401);
    expect(mocks.select).not.toHaveBeenCalled(); expect(mocks.list).not.toHaveBeenCalled(); expect(mocks.detail).not.toHaveBeenCalled();
  });
});
