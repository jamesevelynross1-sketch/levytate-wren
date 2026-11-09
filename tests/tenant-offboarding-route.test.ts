import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ session: vi.fn(), list: vi.fn(), controls: vi.fn(), run: vi.fn(), limit: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: "synthetic-session" }) }) }));
vi.mock("@/lib/server/levytate-authorised-session", () => ({ readAuthorisedLevyTateBetaSession: state.session }));
vi.mock("@/lib/server/levytate-auth-rate-limit", () => ({ checkAuthenticatedWriteLimit: state.limit, LevyTateRateLimitStoreError: class extends Error {} }));
vi.mock("@/lib/server/levytate-tenant-offboarding", () => ({ listTenantOffboarding: state.list, tenantLifecycleControls: state.controls, runTenantOffboarding: state.run }));
import { GET, POST } from "@/app/api/levytate-platform/offboarding/route";
const origin = "https://candidate.vercel.app";
function request(method: string, account: string, body?: unknown) { return new Request(`${origin}/api/levytate-platform/offboarding`, { method, headers: { origin, "content-type": "application/json", "x-levytate-account": account }, ...(body ? { body: JSON.stringify(body) } : {}) }); }
beforeEach(() => { vi.resetAllMocks(); vi.stubEnv("VERCEL_ENV", "preview"); vi.stubEnv("VERCEL_URL", "candidate.vercel.app"); state.session.mockResolvedValue({ email: "current@example.test" }); state.limit.mockResolvedValue({ allowed: true }); state.list.mockResolvedValue([]); state.controls.mockResolvedValue({ owners: [], reactivations: [] }); });
afterEach(() => vi.unstubAllEnvs());
describe("retained lifecycle account boundary (route unit tests)", () => {
  it("does not replace a retained lifecycle view with another account's data", async () => {
    expect((await GET(request("GET", "previous@example.test"))).status).toBe(409);
    expect(state.list).not.toHaveBeenCalled(); expect(state.controls).not.toHaveBeenCalled();
  });
  it("blocks stale-account disposal before write budget or privileged mutation", async () => {
    expect((await POST(request("POST", "previous@example.test", { action: "execute_delete", caseId: "fictional" }))).status).toBe(409);
    expect(state.run).not.toHaveBeenCalled(); expect(state.limit).not.toHaveBeenCalled();
  });
  it("preserves the exact original command for the same normalised account", async () => {
    const body = { action: "approve_reactivation", reactivationId: "fictional", requestId: "stable-request", approvalReference: "approved-reference" };
    state.run.mockResolvedValue({ reactivation: { evidence: { status: "approved" } } });
    expect((await POST(request("POST", " CURRENT@example.test ", body))).status).toBe(200);
    expect(state.run.mock.calls[0][1]).toEqual(body);
  });
  it("reports genuine authentication failure without provider details or lifecycle reads", async () => {
    state.session.mockRejectedValue(new Error("private-provider-diagnostic"));
    const response = await GET(request("GET", "current@example.test"));
    expect(response.status).toBe(503); expect(await response.text()).not.toContain("private-provider");
    expect(state.list).not.toHaveBeenCalled(); expect(state.run).not.toHaveBeenCalled();
  });
});
