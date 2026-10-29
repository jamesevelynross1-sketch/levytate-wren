import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ session: vi.fn(), limits: vi.fn(), workspace: vi.fn(), operational: vi.fn(), guidance: vi.fn(), generate: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: "synthetic-cookie" }) }) }));
vi.mock("@/lib/server/levytate-authorised-session", () => ({ readAuthorisedLevyTateBetaSession: mocks.session }));
vi.mock("@/lib/server/levytate-auth-rate-limit", () => ({ checkLevyTateCopilotLimits: mocks.limits, checkAuthenticatedWriteLimit: vi.fn(), LevyTateRateLimitStoreError: class extends Error {} }));
vi.mock("@/lib/server/levytate-workspace", () => ({ getWorkspaceBootstrapForSession: mocks.workspace }));
vi.mock("@/lib/server/levytate-copilot-tools", () => ({ routeOperationalCopilotQuery: mocks.operational }));
vi.mock("@/lib/server/levytate-guidance-sources", () => ({ getCopilotGuidanceItems: mocks.guidance }));
vi.mock("@/lib/levytate/ai/openai", () => ({ levyTateAiEnabled: () => true, requestLevyTateOpenAI: mocks.generate }));
import { POST } from "@/app/api/levytate-ai/route";
import { LevyTateRateLimitStoreError } from "@/lib/server/levytate-auth-rate-limit";

function request(overrides: Record<string, unknown> = {}, origin = "https://candidate.vercel.app") {
  return new Request("https://candidate.vercel.app/api/levytate-ai", { method: "POST", headers: { origin, "content-type": "application/json" }, body: JSON.stringify({ role: "Apprenticeship Lead", selectedSite: "forged site", currentSection: "Reports", userMessage: "Show my report", employerContext: "forged employer", conversationHistory: [], ...overrides }) });
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("VERCEL_ENV", "preview"); vi.stubEnv("VERCEL_URL", "candidate.vercel.app");
  mocks.session.mockResolvedValue({ email: "synthetic@example.invalid", accessLevel: "approved" });
  mocks.limits.mockResolvedValue({ allowed: true });
  mocks.workspace.mockRejectedValue(new Error("private provider diagnostic"));
});
afterEach(() => vi.unstubAllEnvs());
describe("Copilot security and grounding failures", () => {
  it("rejects sibling-origin queries before loading platform data", async () => {
    expect((await POST(request({}, "https://sibling.vercel.app"))).status).toBe(403);
    expect(mocks.workspace).not.toHaveBeenCalled(); expect(mocks.limits).not.toHaveBeenCalled();
  });
  it("fails closed when persistent abuse controls are unavailable", async () => {
    mocks.limits.mockRejectedValue(new LevyTateRateLimitStoreError());
    expect((await POST(request())).status).toBe(503);
    expect(mocks.workspace).not.toHaveBeenCalled(); expect(mocks.generate).not.toHaveBeenCalled();
  });
  it("returns 429 at the shared budget without generating an answer", async () => {
    mocks.limits.mockResolvedValue({ allowed: false });
    expect((await POST(request())).status).toBe(429);
    expect(mocks.workspace).not.toHaveBeenCalled();
  });
  it("never generates a fallback from forged client context after a workspace failure", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const response = await POST(request());
    const body = await response.text();
    expect(response.status).toBe(503);
    expect(body).not.toMatch(/forged|private provider|assistantMessage/);
    expect(mocks.operational).not.toHaveBeenCalled(); expect(mocks.generate).not.toHaveBeenCalled();
    expect(JSON.stringify(log.mock.calls)).not.toContain("private provider");
    log.mockRestore();
  });
  it("bounds the complete JSON payload before context parsing", async () => {
    expect((await POST(request({ userMessage: "x".repeat(300000) }))).status).toBe(413);
    expect(mocks.generate).not.toHaveBeenCalled();
  });
});
