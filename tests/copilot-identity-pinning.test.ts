import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ session: vi.fn(), select: vi.fn(), config: vi.fn(), limits: vi.fn(), writes: vi.fn(), workspace: vi.fn(), operational: vi.fn(), signals: vi.fn(), analyse: vi.fn(), update: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: "synthetic-session" }) }) }));
vi.mock("@/lib/server/levytate-authorised-session", () => ({ readAuthorisedLevyTateBetaSession: mocks.session }));
vi.mock("@/lib/server/levytate-supabase", () => ({ getLevyTateSupabaseConfig: mocks.config, supabaseSelect: mocks.select }));
vi.mock("@/lib/server/levytate-auth-rate-limit", () => ({ checkLevyTateCopilotLimits: mocks.limits, checkAuthenticatedWriteLimit: mocks.writes, LevyTateRateLimitStoreError: class extends Error {} }));
vi.mock("@/lib/server/levytate-workspace", () => ({ getWorkspaceBootstrapForSession: mocks.workspace }));
vi.mock("@/lib/server/levytate-copilot-tools", () => ({ routeOperationalCopilotQuery: mocks.operational }));
vi.mock("@/lib/server/levytate-guidance-sources", () => ({ getCopilotGuidanceItems: vi.fn() }));
vi.mock("@/lib/levytate/ai/openai", () => ({ levyTateAiEnabled: () => false, requestLevyTateOpenAI: vi.fn() }));
vi.mock("@/lib/server/levytate-intelligence-signals", () => ({ listIntelligenceSignals: mocks.signals, analyseAndPersistIntelligenceSignals: mocks.analyse, updateIntelligenceSignal: mocks.update }));
vi.mock("@/lib/server/levytate-learner-lifecycle", () => ({ LevyTateLearnerLifecyclePermissionError: class extends Error {} }));
import { POST as copilot } from "@/app/api/levytate-ai/route";
import { GET as signals, POST as signalWrite } from "@/app/api/levytate-intelligence/signals/route";
import { LevyTateLearnerLifecyclePermissionError } from "@/lib/server/levytate-learner-lifecycle";
import { createEmptyMvpWorkspace } from "@/lib/levytate/mvp/workspace";
const email = "lead@fictional.example", tenant = "10000000-0000-4000-8000-000000000001", origin = "https://candidate.vercel.app";
const pin = { "X-LevyTate-Account": email, "X-LevyTate-Organisation": tenant };
const request = (kind: string, headers: Record<string, string> = pin) => new Request(`${origin}/api/synthetic`, {
  method: kind === "signals" ? "GET" : "POST", headers: { origin, "content-type": "application/json", ...headers },
  ...(kind === "signals" ? {} : { body: JSON.stringify(kind === "Copilot" ? { role: "Apprenticeship Lead", selectedSite: "Synthetic site", currentSection: "Reports", employerContext: "Synthetic employer", userMessage: "Show my report", conversationHistory: [] } : { action: "analyse" }) }),
});
beforeEach(() => {
  vi.resetAllMocks(); vi.stubEnv("VERCEL_ENV", "preview"); vi.stubEnv("VERCEL_URL", "candidate.vercel.app");
  mocks.session.mockResolvedValue({ email, accessLevel: "approved" }); mocks.config.mockReturnValue({ url: "https://synthetic.invalid", serviceRoleKey: "synthetic-not-a-credential" });
  mocks.select.mockResolvedValue([{ email, organisation_id: tenant, active: true }]); mocks.limits.mockResolvedValue({ allowed: true }); mocks.writes.mockResolvedValue({ allowed: true });
  mocks.workspace.mockResolvedValue({ data: createEmptyMvpWorkspace(), meta: { organisationId: tenant, userEmail: email, userRole: "Apprenticeship Lead", storageMode: "supabase" } });
  mocks.operational.mockResolvedValue({ source: "deterministic", assistantMessage: "Synthetic permitted answer" }); mocks.signals.mockResolvedValue([]); mocks.analyse.mockResolvedValue({ signals: [] });
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });
describe.each([["Copilot", copilot], ["signals", signals], ["signal write", signalWrite]] as const)("%s original identity boundary", (kind, route) => {
  it.each([{ ...pin, "X-LevyTate-Account": "previous@fictional.example" }, { ...pin, "X-LevyTate-Organisation": "20000000-0000-4000-8000-000000000002" }])("rejects changed identity before budget, live context or mutation", async headers => {
    expect((await route(request(kind, headers))).status).toBe(409);
    for (const fn of [mocks.limits, mocks.writes, mocks.workspace, mocks.operational, mocks.signals, mocks.analyse, mocks.update]) expect(fn).not.toHaveBeenCalled();
  });
  it("fails closed if canonical membership cannot be checked", async () => {
    mocks.select.mockRejectedValue(new Error("private diagnostic")); const result = await route(request(kind));
    expect(result.status).toBe(503); expect(await result.text()).not.toContain("private diagnostic"); expect(mocks.workspace).not.toHaveBeenCalled(); expect(mocks.signals).not.toHaveBeenCalled(); expect(mocks.analyse).not.toHaveBeenCalled();
  });
  it("requires the authorised session and contains an Auth outage", async () => {
    mocks.session.mockResolvedValueOnce(null); expect((await route(request(kind))).status).toBe(401);
    mocks.session.mockRejectedValue(new Error("private Auth diagnostic")); const result = await route(request(kind)); expect(result.status).toBe(503); expect(await result.text()).not.toContain("private Auth");
  });
  it("preserves exact current identity and existing read or abuse-budget policy", async () => {
    const result = await route(request(kind)); expect(result.status).toBe(200); expect(result.headers.get("cache-control")).toContain("no-store"); expect(mocks.select).toHaveBeenCalledOnce();
    if (kind === "Copilot") { expect(mocks.limits).toHaveBeenCalledOnce(); expect(mocks.writes).not.toHaveBeenCalled(); }
    else if (kind === "signals") { expect(mocks.limits).not.toHaveBeenCalled(); expect(mocks.writes).not.toHaveBeenCalled(); }
    else { expect(mocks.writes).toHaveBeenCalledOnce(); expect(mocks.limits).not.toHaveBeenCalled(); }
  });
});
it("continues to deny organisation signals outside the existing authorised role", async () => {
  mocks.signals.mockRejectedValue(new LevyTateLearnerLifecyclePermissionError("Current organisation role required")); expect((await signals(request("signals"))).status).toBe(403);
});
it("keeps the dedicated Copilot rate limit effective after the identity check", async () => {
  mocks.limits.mockResolvedValue({ allowed: false }); expect((await copilot(request("Copilot"))).status).toBe(429); expect(mocks.workspace).not.toHaveBeenCalled();
});
