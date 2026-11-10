import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ session: vi.fn(), select: vi.fn(), config: vi.fn(), budget: vi.fn(), read: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: "synthetic-session" }) }) }));
vi.mock("@/lib/server/levytate-authorised-session", () => ({ readAuthorisedLevyTateBetaSession: mocks.session }));
vi.mock("@/lib/server/levytate-supabase", () => ({ getLevyTateSupabaseConfig: mocks.config, supabaseSelect: mocks.select }));
vi.mock("@/lib/server/levytate-auth-rate-limit", () => ({ checkAuthenticatedWriteLimit: mocks.budget, LevyTateRateLimitStoreError: class extends Error {} }));
vi.mock("@/lib/server/levytate-learner-lifecycle", () => ({ LevyTateLearnerLifecyclePermissionError: class extends Error {} }));
vi.mock("@/lib/server/levytate-finance", () => ({ getOrganisationFinanceState: mocks.read, importOrganisationFinance: vi.fn(), confirmOrganisationFinanceBalance: vi.fn(), LevyTateFinanceError: class extends Error {} }));
vi.mock("@/lib/server/levytate-employer-intelligence", () => ({ getEmployerIntelligenceForSession: mocks.read, LevyTateEmployerIntelligenceError: class extends Error {} }));
vi.mock("@/lib/server/levytate-off-the-job", () => ({ getLearningTimeWorkspace: mocks.read, addLearningTimePriority: vi.fn(), createLearningTimePlanDraft: vi.fn(), publishLearningTimePlan: vi.fn(), recordLearningTimeConfirmation: vi.fn(), saveLearningTimeActivity: vi.fn(), submitLearningTimeActivity: vi.fn(), transitionLearningTimeActivity: vi.fn(), LevyTateLearningTimeError: class extends Error {} }));
vi.mock("@/lib/server/levytate-service-requests", () => ({ getEmployerRequestsWorkspaceForSession: mocks.read, applyEmployerRequestActionForSession: vi.fn(), LevyTateServiceRequestError: class extends Error {} }));
vi.mock("@/lib/server/levytate-lift", () => ({ getLiftWorkspaceForSession: mocks.read, applyLiftActionForSession: vi.fn(), LevyTateLiftError: class extends Error {} }));
vi.mock("@/lib/server/levytate-lift-transaction", () => ({ LiftTransactionError: class extends Error {} }));
vi.mock("@/lib/server/levytate-assessments", () => ({ getAssessmentWorkspaceForSession: mocks.read, applyAssessmentActionForSession: vi.fn(), LevyTateAssessmentError: class extends Error {} }));
import { GET as finance } from "@/app/api/levytate-finance/route";
import { GET as insights } from "@/app/api/levytate-employer-insights/route";
import { GET as learning } from "@/app/api/levytate-learning-time/route";
import { GET as requests } from "@/app/api/levytate-requests/route";
import { GET as lift } from "@/app/api/levytate-lift/route";
import { GET as assessments } from "@/app/api/levytate-assessments/route";

const routes: [string, (request: Request) => Promise<Response>][] = [["Finance", finance], ["Insights", insights], ["Learning Time", learning], ["Requests", requests], ["Lift", lift], ["Assessments", assessments]];
const email = "current@example.invalid", tenant = "10000000-0000-4000-8000-000000000001", changed = "20000000-0000-4000-8000-000000000002";
const member = () => ({ email, organisation_id: tenant, active: true });
const request = (headers: Record<string, string> = {}) => new Request("https://candidate.vercel.app/api/synthetic", { headers });
beforeEach(() => {
  vi.resetAllMocks(); mocks.session.mockResolvedValue({ email }); mocks.config.mockReturnValue({ url: "https://synthetic.invalid", serviceRoleKey: "synthetic-not-a-credential" }); mocks.select.mockResolvedValue([member()]); mocks.read.mockResolvedValue({ source: "actual-service-boundary" });
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe.each(routes)("%s actual GET boundary", (_name, get) => {
  it("rejects a retained account before any module data read", async () => {
    const response = await get(request({ "X-LevyTate-Account": "previous@example.invalid" }));
    expect(response.status).toBe(409); expect(mocks.read).not.toHaveBeenCalled(); expect(mocks.select).not.toHaveBeenCalled();
  });
  it("rejects a changed canonical tenant on the very first request", async () => {
    mocks.select.mockResolvedValue([{ ...member(), organisation_id: changed }]);
    const response = await get(request({ "X-LevyTate-Account": email, "X-LevyTate-Organisation": tenant }));
    expect(response.status).toBe(409); expect(mocks.read).not.toHaveBeenCalled();
  });
  it("preserves authenticated callers without optional retained-identity headers", async () => {
    const response = await get(request()); expect(response.status).toBe(200); expect(mocks.read).toHaveBeenCalledExactlyOnceWith({ email }); expect(mocks.select).not.toHaveBeenCalled(); expect(mocks.budget).not.toHaveBeenCalled();
    expect(response.headers.get("cache-control")).toContain("private, no-store");
  });
  it("accepts exact current canonical account and tenant before loading service data", async () => {
    const response = await get(request({ "X-LevyTate-Account": email, "X-LevyTate-Organisation": tenant }));
    expect(response.status).toBe(200); expect(mocks.select).toHaveBeenCalledOnce(); expect(mocks.read).toHaveBeenCalledOnce();
    expect(mocks.select.mock.invocationCallOrder[0]).toBeLessThan(mocks.read.mock.invocationCallOrder[0]);
    expect(mocks.budget).not.toHaveBeenCalled();
  });
  it("requires a genuine authorised session before canonical lookup", async () => {
    mocks.session.mockResolvedValue(null); expect((await get(request({ "X-LevyTate-Organisation": tenant }))).status).toBe(401); expect(mocks.select).not.toHaveBeenCalled(); expect(mocks.read).not.toHaveBeenCalled();
  });
  it("fails closed on malformed tenant headers", async () => {
    expect((await get(request({ "X-LevyTate-Organisation": "not-a-tenant" }))).status).toBe(409); expect(mocks.select).not.toHaveBeenCalled(); expect(mocks.read).not.toHaveBeenCalled();
  });
  it.each([{ rows: [] }, { rows: [member(), member()] }, { rows: [{ ...member(), active: false }] }])("denies absent, ambiguous or inactive canonical membership", async ({ rows }) => {
    mocks.select.mockResolvedValue(rows); expect((await get(request({ "X-LevyTate-Organisation": tenant }))).status).toBe(409); expect(mocks.read).not.toHaveBeenCalled();
  });
  it("fails closed on a malformed canonical lookup payload", async () => {
    mocks.select.mockResolvedValue({ email, organisation_id: tenant, active: true });
    expect((await get(request({ "X-LevyTate-Organisation": tenant }))).status).toBe(503); expect(mocks.read).not.toHaveBeenCalled();
  });
  it("reports canonical-store outage503 without data or upstream diagnostic leakage", async () => {
    mocks.select.mockRejectedValue(new Error("private upstream diagnostic"));
    const response = await get(request({ "X-LevyTate-Organisation": tenant })); expect(response.status).toBe(503); expect(await response.text()).not.toContain("private upstream"); expect(mocks.read).not.toHaveBeenCalled();
  });
  it("fails closed when canonical connection configuration is unavailable", async () => {
    mocks.config.mockReturnValue(null); expect((await get(request({ "X-LevyTate-Organisation": tenant }))).status).toBe(503); expect(mocks.read).not.toHaveBeenCalled();
  });
});
