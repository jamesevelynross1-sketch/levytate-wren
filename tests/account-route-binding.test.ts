import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const boundary = vi.hoisted(() => ({ session: vi.fn(), write: vi.fn(), list: vi.fn(), limit: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: "synthetic-session" }) }) }));
vi.mock("@/lib/server/levytate-authorised-session", () => ({ readAuthorisedLevyTateBetaSession: boundary.session }));
vi.mock("@/lib/server/levytate-auth-rate-limit", () => ({ checkAuthenticatedWriteLimit: boundary.limit, LevyTateRateLimitStoreError: class extends Error {} }));
vi.mock("@/lib/server/levytate-client-workspace-admin", () => ({
  ClientWorkspaceAdminError: class extends Error {}, createClientWorkspace: boundary.write, inviteClientWorkspaceUser: boundary.write,
  listClientWorkspaces: boundary.list, listWorkspaceUsers: boundary.list, provisionClientWorkspaceUser: boundary.write, updateClientWorkspaceUser: boundary.write,
}));
vi.mock("@/lib/server/levytate-tenant-lifecycle", () => ({ suspendClientTenant: boundary.write }));
import { GET as employerGet, POST as employerPost } from "@/app/api/levytate-workspace/invitations/route";
import { GET as platformGet, POST as platformPost, PATCH as platformPatch } from "@/app/api/levytate-platform/workspaces/route";

const origin = "https://candidate.vercel.app";
function request(method: string, body?: unknown, account = "previous@example.test") {
  return new Request(`${origin}/api/account`, { method, headers: { origin, "content-type": "application/json", "x-levytate-account": account }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
}
beforeEach(() => {
  vi.resetAllMocks(); vi.stubEnv("VERCEL_ENV", "preview"); vi.stubEnv("VERCEL_URL", "candidate.vercel.app");
  boundary.session.mockResolvedValue({ email: "current@example.test" }); boundary.limit.mockResolvedValue({ allowed: true });
});
afterEach(() => vi.unstubAllEnvs());

describe("retained account-administration forms", () => {
  it.each([employerPost, platformPost])("denies a stale account before budget, lookup or mutation", async (post) => {
    const response = await post(request("POST", { action: "invite_user" }));
    expect(response.status).toBe(409); expect(await response.text()).toContain("different account");
    expect(boundary.limit).not.toHaveBeenCalled(); expect(boundary.list).not.toHaveBeenCalled(); expect(boundary.write).not.toHaveBeenCalled();
  });
  it("denies a retained access change after another account signs in", async () => {
    expect((await platformPatch(request("PATCH", { userId: "synthetic" }))).status).toBe(409);
    expect(boundary.write).not.toHaveBeenCalled(); expect(boundary.limit).not.toHaveBeenCalled();
  });
  it.each([employerGet, platformGet])("does not replace a retained account view with another account's data", async (get) => {
    expect((await get(request("GET"))).status).toBe(409); expect(boundary.list).not.toHaveBeenCalled();
  });
  it("preserves a confirmed retry for the same normalised account", async () => {
    boundary.write.mockResolvedValue({ id: "confirmed-user" });
    const body = { action: "invite_user", userId: "synthetic", requestId: "same-request", expectedGeneration: 1 };
    expect((await employerPost(request("POST", body, " CURRENT@example.test "))).status).toBe(200);
    expect(boundary.write).toHaveBeenCalledOnce(); expect(boundary.write.mock.calls[0][1]).toEqual(body);
  });
  it("reports an authentication outage without exposing provider details or performing writes", async () => {
    boundary.session.mockRejectedValue(new Error("private provider diagnostic"));
    for (const response of [await employerPost(request("POST", {})), await platformPatch(request("PATCH", {})), await employerGet(request("GET"))]) {
      expect(response.status).toBe(503); expect(await response.text()).not.toContain("private provider diagnostic");
    }
    expect(boundary.write).not.toHaveBeenCalled();
  });
});
