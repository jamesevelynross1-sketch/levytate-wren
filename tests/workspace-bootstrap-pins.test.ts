import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ session: vi.fn(), select: vi.fn(), config: vi.fn(), bootstrap: vi.fn(), mutate: vi.fn(), budget: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: "fictional-session" }) }) }));
vi.mock("@/lib/server/levytate-authorised-session", () => ({ readAuthorisedLevyTateBetaSession: mocks.session }));
vi.mock("@/lib/server/levytate-supabase", () => ({ getLevyTateSupabaseConfig: mocks.config, supabaseSelect: mocks.select }));
vi.mock("@/lib/server/levytate-auth-rate-limit", () => ({ checkAuthenticatedWriteLimit: mocks.budget, LevyTateRateLimitStoreError: class extends Error {} }));
vi.mock("@/lib/server/levytate-workspace", () => ({ getWorkspaceBootstrapForSession: mocks.bootstrap, applyWorkspaceMutationForSession: mocks.mutate, LevyTateWorkspacePermissionError: class extends Error {} }));
import { GET } from "@/app/api/levytate-workspace/route";

const email = "fictional.manager@example.invalid";
const organisationId = "10000000-0000-4000-8000-000000000001";
const otherOrganisationId = "20000000-0000-4000-8000-000000000002";
const member = { email, organisation_id: organisationId, active: true };
function request(headers: Record<string, string> = { "X-LevyTate-Account": email, "X-LevyTate-Organisation": organisationId }) {
  return new Request("https://candidate.vercel.app/api/levytate-workspace", { headers });
}
beforeEach(() => {
  vi.resetAllMocks();
  mocks.session.mockResolvedValue({ email });
  mocks.config.mockReturnValue({ url: "https://fictional.invalid", serviceRoleKey: "fictional-not-a-credential" });
  mocks.select.mockResolvedValue([member]);
  mocks.bootstrap.mockResolvedValue({ meta: { userEmail: email, organisationId }, data: { privateMarker: "actual-current-workspace" } });
});

describe("actual workspace bootstrap rejects stale retained account scope before reading data", () => {
  it.each([
    { "X-LevyTate-Account": "previous.employee@example.invalid", "X-LevyTate-Organisation": organisationId },
    { "X-LevyTate-Account": email, "X-LevyTate-Organisation": otherOrganisationId },
    { "X-LevyTate-Account": email, "X-LevyTate-Organisation": "not-a-tenant" },
  ])("rejects a different account or employer pin", async headers => {
    const response = await GET(request(headers));
    expect(response.status).toBe(409);
    expect(response.headers.get("cache-control")).toContain("private, no-store");
    expect(await response.text()).not.toContain("actual-current-workspace");
    expect(mocks.bootstrap).not.toHaveBeenCalled();
    expect(mocks.mutate).not.toHaveBeenCalled();
    expect(mocks.budget).not.toHaveBeenCalled();
  });
  it("checks current membership when the same email moves to a different employer", async () => {
    mocks.select.mockResolvedValue([{ ...member, organisation_id: otherOrganisationId }]);
    expect((await GET(request())).status).toBe(409);
    expect(mocks.bootstrap).not.toHaveBeenCalled();
  });
  it("withholds a newly resolved employer if membership changes between the scope check and bootstrap", async () => {
    mocks.bootstrap.mockResolvedValue({ meta: { userEmail: email, organisationId: otherOrganisationId }, data: { privateMarker: "actual-current-workspace" } });
    const response = await GET(request());
    expect(response.status).toBe(409);
    expect(await response.text()).not.toContain("actual-current-workspace");
    expect(mocks.select).toHaveBeenCalledOnce();
    expect(mocks.bootstrap).toHaveBeenCalledOnce();
  });
  it.each([[], [member, member], [{ ...member, active: false }]].map(members => ({ members })))("rejects an unknown, ambiguous or inactive membership", async ({ members }) => {
    mocks.select.mockResolvedValue(members);
    expect((await GET(request())).status).toBe(409);
    expect(mocks.bootstrap).not.toHaveBeenCalled();
  });
  it("does not leak membership dependency diagnostics or load private data during an outage", async () => {
    mocks.select.mockRejectedValue(new Error("private fictional dependency diagnostic"));
    const response = await GET(request());
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("private fictional dependency diagnostic");
    expect(mocks.bootstrap).not.toHaveBeenCalled();
  });
  it("allows the exact canonical account without requiring a write origin or spending a write budget", async () => {
    const response = await GET(request({ "X-LevyTate-Account": `  ${email.toUpperCase()}  `, "X-LevyTate-Organisation": organisationId }));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, workspace: { meta: { userEmail: email, organisationId } } });
    expect(mocks.bootstrap).toHaveBeenCalledWith({ email });
    expect(mocks.budget).not.toHaveBeenCalled();
  });
  it("keeps initial unpinned bootstrap authorised by the genuine session", async () => {
    expect((await GET(request({}))).status).toBe(200);
    expect(mocks.bootstrap).toHaveBeenCalledWith({ email });
    expect(mocks.select).not.toHaveBeenCalled();
  });
  it("rejects an unauthenticated read before checking caller-supplied scope", async () => {
    mocks.session.mockResolvedValue(null);
    expect((await GET(request())).status).toBe(401);
    expect(mocks.select).not.toHaveBeenCalled();
    expect(mocks.bootstrap).not.toHaveBeenCalled();
  });
});
