import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const dependencies = vi.hoisted(() => ({ session: vi.fn(), personal: vi.fn(), limit: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: "fictional-session" }) }) }));
vi.mock("@/lib/server/levytate-authorised-session", () => ({ readAuthorisedLevyTateBetaSession: dependencies.session }));
vi.mock("@/lib/server/levytate-auth-rate-limit", () => ({ checkAuthenticatedWriteLimit: dependencies.limit, LevyTateRateLimitStoreError: class extends Error {} }));
vi.mock("@/lib/server/levytate-programme-discovery", () => ({ personalProgrammeState: dependencies.personal }));
import { GET, POST } from "@/app/api/levytate-programme-discovery/route";
const origin = "https://candidate.vercel.app";
function request(method: string, account = "own@example.test", source = origin) { return new Request(`${origin}/api/levytate-programme-discovery`, { method, headers: { origin: source, "content-type": "application/json", "x-levytate-account": account }, ...(method === "POST" ? { body: JSON.stringify({ action: "save", programmeId: "fictional", requestId: "stable", expectedRevision: 0 }) } : {}) }); }
beforeEach(() => { vi.resetAllMocks(); vi.stubEnv("VERCEL_ENV", "preview"); vi.stubEnv("VERCEL_URL", "candidate.vercel.app"); dependencies.session.mockResolvedValue({ email: "own@example.test" }); dependencies.limit.mockResolvedValue({ allowed: true }); dependencies.personal.mockResolvedValue({ employeeId: "own", savedProgrammeIds: [], comparedProgrammeIds: [], revision: 0 }); });
afterEach(() => vi.unstubAllEnvs());
describe("personal programme HTTP boundary", () => {
  it.each([GET, POST])("rejects stale account before any personal read or write", async (handler) => {
    expect((await handler(request(handler === GET ? "GET" : "POST", "previous@example.test"))).status).toBe(409);
    expect(dependencies.personal).not.toHaveBeenCalled();
  });
  it("requires authentication before returning personal choices", async () => { dependencies.session.mockResolvedValue(null); expect((await GET(request("GET"))).status).toBe(401); expect(dependencies.personal).not.toHaveBeenCalled(); });
  it("rejects a cross-origin mutation", async () => { expect((await POST(request("POST", "own@example.test", "https://untrusted.example.test"))).status).toBe(403); expect(dependencies.personal).not.toHaveBeenCalled(); });
  it("does not cache individual choices", async () => { const response = await GET(request("GET")); expect(response.status).toBe(200); expect(response.headers.get("cache-control")).toContain("private, no-store"); expect(response.headers.get("vary")).toBe("Cookie"); });
  it("truthfully reports dependency failure without diagnostic leakage", async () => { dependencies.session.mockRejectedValue(new Error("private provider credentials")); const response = await GET(request("GET")); expect(response.status).toBe(503); expect(await response.text()).not.toMatch(/credentials|private provider/); });
});
