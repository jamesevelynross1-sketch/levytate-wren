import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ session: vi.fn(), service: vi.fn(), budget: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: "synthetic" }) }) }));
vi.mock("@/lib/server/levytate-authorised-session", () => ({ readAuthorisedLevyTateBetaSession: mocks.session }));
vi.mock("@/lib/server/levytate-auth-rate-limit", () => ({ checkAuthenticatedWriteLimit: mocks.budget, LevyTateRateLimitStoreError: class extends Error {} }));
vi.mock("@/lib/server/levytate-pastoral", () => ({ LevyTatePastoralError: class extends Error {}, applyPastoralMutationForSession: mocks.service, getPastoralWorkspaceForSession: mocks.service }));
vi.mock("@/lib/server/levytate-pastoral-assistant", () => ({ runPastoralAssistant: mocks.service }));
import * as workspace from "@/app/api/levytate-pastoral/route";
import * as assistant from "@/app/api/levytate-pastoral/assistant/route";
function request(body: unknown = {}, origin = "https://candidate.vercel.app") {
  return new Request("https://candidate.vercel.app/api/levytate-pastoral", { method: "POST", headers: { origin, "content-type": "application/json" }, body: JSON.stringify(body) });
}
const routes = [["workspace GET", () => workspace.GET()], ["workspace POST", () => workspace.POST(request())], ["assistant POST", () => assistant.POST(request())]] as const;
beforeEach(() => {
  vi.resetAllMocks(); vi.stubEnv("VERCEL_ENV", "preview"); vi.stubEnv("VERCEL_URL", "candidate.vercel.app");
  mocks.session.mockResolvedValue({ email: "fictional@example.invalid" }); mocks.budget.mockResolvedValue({ allowed: true }); mocks.service.mockResolvedValue({});
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });
describe("private support HTTP boundaries (mocked Auth, never feature activation)", () => {
  it.each(routes)("%s contains an Auth dependency failure without diagnostic leakage", async (_name, invoke) => {
    const error = new Error("private diagnostic"); error.name = "private diagnostic"; mocks.session.mockRejectedValue(error);
    const response = await invoke();
    expect(response.status).toBe(503); expect(response.headers.get("cache-control")).toContain("no-store");
    expect(await response.text()).not.toContain("private diagnostic"); expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain("private diagnostic");
    expect(mocks.service).not.toHaveBeenCalled();
  });
  it.each(routes)("%s rejects an absent session before content access", async (_name, invoke) => {
    mocks.session.mockResolvedValue(null); const response = await invoke();
    expect(response.status).toBe(401); expect(response.headers.get("cache-control")).toContain("no-store"); expect(mocks.service).not.toHaveBeenCalled();
  });
  it.each([workspace.POST, assistant.POST])("rejects sibling-origin writes before the service", async (post) => {
    expect((await post(request({}, "https://sibling.candidate.vercel.app"))).status).toBe(403); expect(mocks.service).not.toHaveBeenCalled();
  });
  it.each([workspace.POST, assistant.POST])("rejects oversized Unicode bodies before the service", async (post) => {
    expect((await post(request({ message: "🙂".repeat(9000) }))).status).toBe(413); expect(mocks.service).not.toHaveBeenCalled();
  });
});
