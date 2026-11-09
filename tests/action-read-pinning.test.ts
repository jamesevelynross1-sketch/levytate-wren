import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ session: vi.fn(), select: vi.fn(), config: vi.fn(), list: vi.fn(), detail: vi.fn(), management: vi.fn(), history: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: "synthetic-session" }) }) }));
vi.mock("@/lib/server/levytate-authorised-session", () => ({ readAuthorisedLevyTateBetaSession: mocks.session }));
vi.mock("@/lib/server/levytate-supabase", () => ({ getLevyTateSupabaseConfig: mocks.config, supabaseSelect: mocks.select }));
vi.mock("@/lib/server/levytate-auth-rate-limit", () => ({ checkAuthenticatedWriteLimit: vi.fn(), LevyTateRateLimitStoreError: class extends Error {} }));
vi.mock("@/lib/server/levytate-manager-scope", () => ({ LevyTateManagerScopeError: class extends Error {} }));
vi.mock("@/lib/server/levytate-learner-lifecycle", () => ({ LevyTateLearnerLifecyclePermissionError: class extends Error {} }));
vi.mock("@/lib/server/levytate-manager-actions", () => ({ listManagerActions: mocks.list, getManagerAction: mocks.detail }));
vi.mock("@/lib/server/levytate-operational-actions", () => ({
  getOperationalAction: mocks.detail, getOperationalActionManagementDetail: mocks.management, getOperationalActionHistory: mocks.history,
  acknowledgeOperationalAction: vi.fn(), assignOperationalActionOwner: vi.fn(), cancelOperationalAction: vi.fn(), completeOperationalAction: vi.fn(), dismissOperationalAction: vi.fn(), startOperationalAction: vi.fn(), updateOperationalActionDueDate: vi.fn(),
  LevyTateManagerOperationalActionAccessError: class extends Error {}, LevyTateOperationalActionConflictError: class extends Error {}, LevyTateOperationalActionError: class extends Error {},
}));
import { GET as list } from "@/app/api/levytate-manager/actions/route";
import { GET as detail } from "@/app/api/levytate-manager/actions/[actionId]/route";
import { GET as operational } from "@/app/api/levytate-operational-actions/[actionId]/route";
import { LevyTateManagerScopeError } from "@/lib/server/levytate-manager-scope";
import { LevyTateManagerOperationalActionAccessError } from "@/lib/server/levytate-operational-actions";
const email = "manager@fictional.example", tenant = "10000000-0000-4000-8000-000000000001";
const context = { params: Promise.resolve({ actionId: "synthetic-action" }) };
const routes = [
  ["manager list", (request: Request) => list(request)],
  ["manager detail", (request: Request) => detail(request, context)],
  ["action detail", (request: Request) => operational(request, context)],
  ["action history", (request: Request) => operational(new Request(`${request.url}?history=true`, request), context)],
  ["action management", (request: Request) => operational(new Request(`${request.url}?management=true`, request), context)],
] as const;
const pin = { "X-LevyTate-Account": email, "X-LevyTate-Organisation": tenant };
const request = (headers: Record<string, string> = pin) => new Request("https://candidate.vercel.app/api/synthetic", { headers });
const untouched = () => { for (const read of [mocks.list, mocks.detail, mocks.management, mocks.history]) expect(read).not.toHaveBeenCalled(); };
beforeEach(() => {
  vi.resetAllMocks(); mocks.session.mockResolvedValue({ email }); mocks.config.mockReturnValue({ url: "https://synthetic.invalid", serviceRoleKey: "synthetic-not-a-credential" });
  mocks.select.mockResolvedValue([{ email, organisation_id: tenant, active: true }]);
  mocks.list.mockResolvedValue({ actions: [], summary: { open: 0 } }); mocks.detail.mockResolvedValue({ actionId: "synthetic-action", version: 4 }); mocks.management.mockResolvedValue({ action: { id: "synthetic-action" }, context: {}, history: [] }); mocks.history.mockResolvedValue([]);
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());
describe.each(routes)("%s retained read boundary (unit route, not browser authentication)", (_label, get) => {
  it("rejects the previous account before any action read", async () => {
    expect((await get(request({ ...pin, "X-LevyTate-Account": "previous@fictional.example" }))).status).toBe(409); untouched(); expect(mocks.select).not.toHaveBeenCalled();
  });
  it("rejects a changed canonical employer before reading even the same action ID", async () => {
    mocks.select.mockResolvedValue([{ email, organisation_id: "20000000-0000-4000-8000-000000000002", active: true }]);
    expect((await get(request())).status).toBe(409); untouched();
  });
  it("requires one active canonical membership", async () => {
    mocks.select.mockResolvedValue([{ email, organisation_id: tenant, active: false }]);
    expect((await get(request())).status).toBe(409); untouched();
  });
  it("returns unavailable without private diagnostics when the identity store fails", async () => {
    mocks.select.mockRejectedValue(new Error("private upstream detail")); const response = await get(request());
    expect(response.status).toBe(503); expect(await response.text()).not.toContain("private upstream"); expect(response.headers.get("cache-control")).toContain("no-store"); untouched();
  });
  it("handles authorised-session dependency failure as unavailable", async () => {
    mocks.session.mockRejectedValue(new Error("private identity detail")); const response = await get(request());
    expect(response.status).toBe(503); expect(await response.text()).not.toContain("private identity"); expect(response.headers.get("cache-control")).toContain("no-store"); untouched();
  });
  it("requires an authorised session before resolving membership", async () => {
    mocks.session.mockResolvedValue(null); const response = await get(request()); expect(response.status).toBe(401); expect(response.headers.get("cache-control")).toContain("no-store"); expect(mocks.select).not.toHaveBeenCalled(); untouched();
  });
  it("preserves an exact current identity and does not cache its data", async () => {
    const response = await get(request()); expect(response.status).toBe(200); expect(mocks.select).toHaveBeenCalledOnce(); expect(response.headers.get("cache-control")).toContain("private, no-store");
  });
  it("preserves authorised nonbrowser callers without optional identity pins", async () => {
    expect((await get(request({}))).status).toBe(200); expect(mocks.select).not.toHaveBeenCalled();
  });
  it("still denies service-level current role or direct-report failures", async () => {
    const denied = _label.startsWith("manager") ? new LevyTateManagerScopeError("Current manager scope required") : new LevyTateManagerOperationalActionAccessError();
    for (const read of [mocks.list, mocks.detail, mocks.management]) read.mockRejectedValue(denied);
    const response = await get(request()); expect(response.status).toBe(403); expect(response.headers.get("cache-control")).toContain("no-store");
  });
});
