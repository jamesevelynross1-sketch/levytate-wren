import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ session: vi.fn(), service: vi.fn(), budget: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: "synthetic" }) }) }));
vi.mock("@/lib/server/levytate-authorised-session", () => ({ readAuthorisedLevyTateBetaSession: mocks.session }));
vi.mock("@/lib/server/levytate-provider-auth", () => ({ readAuthorisedLevyTateProviderSession: mocks.session, levytateProviderSessionCookie: "synthetic-provider" }));
vi.mock("@/lib/server/levytate-auth-rate-limit", () => ({ checkAuthenticatedWriteLimit: mocks.budget, LevyTateRateLimitStoreError: class extends Error {} }));
vi.mock("@/lib/server/levytate-service-requests", () => ({ LevyTateServiceRequestError: class extends Error {}, applyEmployerRequestActionForSession: mocks.service, getEmployerRequestsWorkspaceForSession: mocks.service, applyProviderRequestActionForSession: mocks.service, getProviderWorkspaceBootstrapForSession: mocks.service }));
vi.mock("@/lib/server/levytate-provider-access-admin", () => ({ LevyTateProviderAccessAdminError: class extends Error {}, listProviderAccessForAdmin: mocks.service, provisionProviderAccess: mocks.service, updateProviderAccess: mocks.service }));
vi.mock("@/lib/server/levytate-learner-lifecycle", () => ({ LevyTateLearnerLifecyclePermissionError: class extends Error {} }));
vi.mock("@/lib/server/levytate-operational-actions", () => ({
  LevyTateOperationalActionError: class extends Error {}, LevyTateOperationalActionConflictError: class extends Error {}, LevyTateManagerOperationalActionAccessError: class extends Error {},
  acknowledgeOperationalAction: mocks.service, assignOperationalActionOwner: mocks.service, cancelOperationalAction: mocks.service, completeOperationalAction: mocks.service, dismissOperationalAction: mocks.service,
  getOperationalAction: mocks.service, getOperationalActionManagementDetail: mocks.service, getOperationalActionHistory: mocks.service, startOperationalAction: mocks.service, updateOperationalActionDueDate: mocks.service,
}));
import * as employer from "@/app/api/levytate-requests/route";
import * as provider from "@/app/api/levytate-provider/opportunities/route";
import * as access from "@/app/api/levytate-platform/provider-access/route";
import * as action from "@/app/api/levytate-operational-actions/[actionId]/route";
import { LevyTateManagerOperationalActionAccessError } from "@/lib/server/levytate-operational-actions";

function request(method = "POST", body: unknown = {}) {
  return new Request("https://candidate.vercel.app/api/synthetic", { method, headers: { origin: "https://candidate.vercel.app", "content-type": "application/json" }, ...(method === "GET" ? {} : { body: JSON.stringify(body) }) });
}
const context = { params: Promise.resolve({ actionId: "synthetic-action" }) };
const routes = [
  ["employer GET", () => employer.GET(request("GET"))], ["employer POST", () => employer.POST(request())],
  ["provider GET", () => provider.GET()], ["provider POST", () => provider.POST(request())],
  ["access GET", () => access.GET()], ["access POST", () => access.POST(request())], ["access PATCH", () => access.PATCH(request("PATCH"))],
  ["action GET", () => action.GET(request("GET"), context)], ["action PATCH", () => action.PATCH(request("PATCH", { command: "acknowledge", expectedVersion: 1 }), context)],
] as const;
beforeEach(() => {
  vi.resetAllMocks(); vi.stubEnv("VERCEL_ENV", "preview"); vi.stubEnv("VERCEL_URL", "candidate.vercel.app");
  mocks.session.mockResolvedValue({ email: "fictional@example.invalid" }); mocks.budget.mockResolvedValue({ allowed: true }); mocks.service.mockResolvedValue({});
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });
describe("private client HTTP outage boundaries (unit, not real authentication)", () => {
  it.each(routes)("%s handles authentication dependency failure without leaking diagnostics", async (_name, invoke) => {
    const error = new Error("secret-like diagnostic"); error.name = "secret-like diagnostic";
    mocks.session.mockRejectedValue(error);
    const response = await invoke();
    expect(response.status).toBe(503); expect(response.headers.get("cache-control")).toContain("no-store");
    expect(await response.text()).not.toContain("secret-like"); expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain("secret-like");
    expect(mocks.service).not.toHaveBeenCalled();
  });
  it.each(routes)("%s handles a missing session before reading data or writing", async (_name, invoke) => {
    mocks.session.mockResolvedValue(null);
    const response = await invoke(); expect(response.status).toBe(401); expect(response.headers.get("cache-control")).toContain("no-store"); expect(mocks.service).not.toHaveBeenCalled();
  });
  it("returns403 for a manager who no longer owns the action", async () => {
    const denied = new LevyTateManagerOperationalActionAccessError(); denied.message = "private scope";
    mocks.service.mockRejectedValue(denied);
    const response = await action.GET(request("GET"), context);
    expect(response.status).toBe(403); expect(await response.text()).not.toContain("private scope");
  });
  it("does not broaden provider access payloads while handling errors", async () => {
    const response = await access.POST(request("POST", { organisationId: "foreign" }));
    expect(response.status).toBe(400); expect(mocks.service).not.toHaveBeenCalled();
  });
});
