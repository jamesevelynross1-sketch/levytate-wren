import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ session: vi.fn(), summary: vi.fn(), budget: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: "synthetic-session" }) }) }));
vi.mock("@/lib/server/levytate-authorised-session", () => ({ readAuthorisedLevyTateBetaSession: mocks.session }));
vi.mock("@/lib/server/levytate-operations", () => ({ getOrganisationOperationsSummary: mocks.summary }));
vi.mock("@/lib/server/levytate-auth-rate-limit", () => ({ checkAuthenticatedWriteLimit: mocks.budget, LevyTateRateLimitStoreError: class extends Error {} }));
vi.mock("@/lib/server/levytate-learner-lifecycle", () => ({ LevyTateLearnerLifecyclePermissionError: class extends Error {}, LevyTateLearnerLifecycleError: class extends Error {} }));
import { GET, POST } from "@/app/api/levytate-operations/route";
import { LevyTateRateLimitStoreError } from "@/lib/server/levytate-auth-rate-limit";
import { LevyTateLearnerLifecyclePermissionError } from "@/lib/server/levytate-learner-lifecycle";
import { logLevyTateServerError } from "@/lib/server/levytate-safe-api-error";
function post(body: unknown = {}, origin = "https://candidate.vercel.app") {
  return new Request("https://candidate.vercel.app/api/levytate-operations?priority=Critical", { method: "POST", headers: { origin, "content-type": "application/json" }, body: JSON.stringify(body) });
}
beforeEach(() => {
  vi.resetAllMocks(); vi.stubEnv("VERCEL_ENV", "preview"); vi.stubEnv("VERCEL_URL", "candidate.vercel.app");
  mocks.session.mockResolvedValue({ email: "lead@fictional.invalid" }); mocks.budget.mockResolvedValue({ allowed: true }); mocks.summary.mockResolvedValue({ source: "supabase" });
});
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });
describe("Operations HTTP boundary (unit)", () => {
  it("GET is read-only and cannot opt into synchronisation", async () => {
    const response = await GET(new Request("https://candidate.vercel.app/api/levytate-operations?priority=Critical"));
    expect(response.status).toBe(200); expect(response.headers.get("cache-control")).toContain("no-store");
    expect(mocks.summary).toHaveBeenCalledWith({ email: "lead@fictional.invalid" }, expect.objectContaining({ priority: "Critical" }), { synchronise: false });
    mocks.summary.mockClear();
    expect((await GET(new Request("https://candidate.vercel.app/api/levytate-operations?synchronise=true"))).status).toBe(400);
    expect(mocks.summary).not.toHaveBeenCalled(); expect(mocks.budget).not.toHaveBeenCalled();
  });
  it("explicit POST synchronises only after a bounded same-origin budgeted request", async () => {
    expect((await POST(post())).status).toBe(200);
    expect(mocks.budget).toHaveBeenCalledOnce();
    expect(mocks.summary).toHaveBeenCalledWith({ email: "lead@fictional.invalid" }, expect.objectContaining({ priority: "Critical" }), { synchronise: true });
  });
  it("rejects cross-origin, tenant override, oversize and malformed JSON", async () => {
    expect((await POST(post({}, "https://other.vercel.app"))).status).toBe(403);
    expect((await POST(post({ organisationId: "foreign" }))).status).toBe(400);
    expect((await POST(post({ extra: "x".repeat(1024) }))).status).toBe(413);
    const invalid = new Request(post(), { body: "{" });
    expect((await POST(invalid)).status).toBe(400); expect(mocks.summary).not.toHaveBeenCalled();
  });
  it("enforces the write budget and fails closed when the budget store fails", async () => {
    mocks.budget.mockResolvedValueOnce({ allowed: false }); expect((await POST(post())).status).toBe(429);
    mocks.budget.mockRejectedValueOnce(new LevyTateRateLimitStoreError()); expect((await POST(post())).status).toBe(503);
    expect(mocks.summary).not.toHaveBeenCalled();
  });
  it("denies missing sessions and unauthorised roles", async () => {
    mocks.session.mockResolvedValueOnce(null); expect((await POST(post())).status).toBe(401); expect(mocks.summary).not.toHaveBeenCalled();
    mocks.summary.mockRejectedValueOnce(new LevyTateLearnerLifecyclePermissionError("Private scope"));
    const response = await POST(post()); expect(response.status).toBe(403); expect(await response.text()).not.toContain("Private scope");
  });
  it.each(["session", "summary"] as const)("returns a private generic unavailable response for %s outages", async (source) => {
    const output = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks[source].mockRejectedValueOnce(new Error("sensitive URL or record"));
    const response = await GET(new Request("https://candidate.vercel.app/api/levytate-operations"));
    expect(response.status).toBe(503); expect(response.headers.get("cache-control")).toContain("no-store");
    expect(await response.text()).not.toContain("sensitive"); expect(JSON.stringify(output.mock.calls)).not.toContain("sensitive");
  });
  it("never serialises an error, stack, overridden name or object in diagnostics", () => {
    const output = vi.spyOn(console, "error").mockImplementation(() => {});
    const error = new Error("sensitive credential"); error.name = "sensitive credential";
    logLevyTateServerError("operations-summary", error);
    logLevyTateServerError("unsafe?token=sensitive", { secret: "sensitive credential" });
    expect(output.mock.calls).toEqual([["[LevyTate:operations-summary]", "dependency_failure"], ["[LevyTate:server]", "dependency_failure"]]);
  });
});
