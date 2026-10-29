import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ session: vi.fn(), intelligence: vi.fn(), audit: vi.fn(), budget: vi.fn(), config: vi.fn(), context: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: "synthetic-token" }) }) }));
vi.mock("@/lib/server/levytate-authorised-session", () => ({ readAuthorisedLevyTateBetaSession: mocks.session }));
vi.mock("@/lib/server/levytate-employer-intelligence", () => ({ getEmployerIntelligenceForSession: mocks.intelligence }));
vi.mock("@/lib/server/levytate-supabase", () => ({ getLevyTateSupabaseConfig: mocks.config, supabaseInsert: mocks.audit }));
vi.mock("@/lib/server/levytate-auth-rate-limit", () => ({ checkAuthenticatedWriteLimit: mocks.budget, LevyTateRateLimitStoreError: class extends Error {} }));
vi.mock("@/lib/server/levytate-learner-lifecycle", () => ({ getLearnerLifecycleServerContext: mocks.context, LevyTateLearnerLifecyclePermissionError: class extends Error {} }));
import { POST } from "@/app/api/levytate-employer-insights/export/route";
import { LevyTateLearnerLifecyclePermissionError } from "@/lib/server/levytate-learner-lifecycle";
import { buildEmployerIntelligence } from "@/lib/levytate/intelligence/build";
import { createEmptyMvpWorkspace } from "@/lib/levytate/mvp/workspace";
import type { LevyTateWorkspaceBootstrap } from "@/lib/levytate/mvp/api";
function request(body: unknown = {}, origin = "https://candidate.vercel.app") { return new Request("https://candidate.vercel.app/api/levytate-employer-insights/export", { method: "POST", headers: { origin, "content-type": "application/json" }, body: JSON.stringify(body) }); }
beforeEach(() => {
  vi.resetAllMocks(); vi.stubEnv("VERCEL_ENV", "preview"); vi.stubEnv("VERCEL_URL", "candidate.vercel.app");
  mocks.session.mockResolvedValue({ email: "lead@fictional.invalid" }); mocks.budget.mockResolvedValue({ allowed: true }); mocks.config.mockReturnValue({});
  mocks.context.mockResolvedValue({ organisation: { id: "fictional-a" }, user: { role: "Apprenticeship Lead" } });
  const unavailable = { ok: false as const, message: "unavailable" };
  mocks.intelligence.mockResolvedValue(buildEmployerIntelligence({ workspace: { ok: true, value: { data: createEmptyMvpWorkspace(), meta: { organisationId: "fictional-a", organisationName: "Fictional A", userRole: "Apprenticeship Lead" } } as LevyTateWorkspaceBootstrap }, finance: unavailable, assessments: unavailable, operations: unavailable }));
  mocks.audit.mockImplementation(async (_config, _table, rows) => [{ id: rows[0].id }]);
});
afterEach(() => vi.unstubAllEnvs());
describe("authorised aggregate export HTTP boundary (unit)", () => {
  it("delivers only server-derived evidence with a confirmed audit and matching digest", async () => {
    const response = await POST(request()); const text = await response.text();
    expect(response.status).toBe(200); expect(JSON.parse(text).organisationId).toBe("fictional-a");
    expect(response.headers.get("cache-control")).toContain("no-store"); expect(response.headers.get("content-disposition")).toContain("attachment");
    const sha256 = createHash("sha256").update(text).digest("hex"); expect(response.headers.get("x-levytate-evidence-sha256")).toBe(sha256);
    expect(mocks.audit.mock.calls[0][2][0]).toMatchObject({ organisation_id: "fictional-a", actor_email: "lead@fictional.invalid", metadata: { sha256 }, action: "employer_evidence.prepared" });
  });
  it("rejects caller-controlled tenant or field selection", async () => {
    expect((await POST(request({ organisationId: "fictional-b" }))).status).toBe(400); expect(mocks.intelligence).not.toHaveBeenCalled();
  });
  it("rejects cross-origin requests before reading data", async () => {
    expect((await POST(request({}, "https://other.vercel.app"))).status).toBe(403); expect(mocks.intelligence).not.toHaveBeenCalled();
  });
  it("denies unauthenticated and unauthorised roles", async () => {
    mocks.session.mockResolvedValueOnce(null); expect((await POST(request())).status).toBe(401);
    mocks.intelligence.mockRejectedValue(new LevyTateLearnerLifecyclePermissionError("Wrong role")); expect((await POST(request())).status).toBe(403); expect(mocks.audit).not.toHaveBeenCalled();
  });
  it("does not deliver after session revocation during source loading", async () => {
    mocks.session.mockResolvedValueOnce({ email: "lead@fictional.invalid" }).mockResolvedValueOnce(null);
    expect((await POST(request())).status).toBe(401); expect(mocks.audit).not.toHaveBeenCalled();
  });
  it("does not claim success when audit persistence is missing", async () => {
    mocks.audit.mockResolvedValue([]); const response = await POST(request());
    expect(response.status).toBe(503); expect(response.headers.has("content-disposition")).toBe(false);
  });
  it.each([{ organisation: { id: "fictional-b" }, user: { role: "Apprenticeship Lead" } }, { organisation: { id: "fictional-a" }, user: { role: "Line Manager" } }])("rejects changed tenant or role at delivery", async (context) => {
    mocks.context.mockResolvedValue(context); expect((await POST(request())).status).toBe(403); expect(mocks.audit).not.toHaveBeenCalled();
  });
  it("suppresses infrastructure diagnostics", async () => {
    mocks.audit.mockRejectedValue(new Error("private credential detail")); const response = await POST(request());
    expect(response.status).toBe(503); expect(await response.text()).not.toContain("private");
  });
  it("enforces the persistent export budget", async () => {
    mocks.budget.mockResolvedValue({ allowed: false }); expect((await POST(request())).status).toBe(429); expect(mocks.intelligence).not.toHaveBeenCalled();
  });
});
