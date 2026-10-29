import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ session: vi.fn(), mutate: vi.fn(), bootstrap: vi.fn(), financeImport: vi.fn(), balance: vi.fn(), financeState: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: "synthetic-session" }) }) }));
vi.mock("@/lib/server/levytate-authorised-session", () => ({ readAuthorisedLevyTateBetaSession: mocks.session }));
vi.mock("@/lib/server/levytate-workspace", () => ({
  applyWorkspaceMutationForSession: mocks.mutate, getWorkspaceBootstrapForSession: mocks.bootstrap,
  LevyTateWorkspacePermissionError: class extends Error {}, LevyTateWorkspacePersistenceError: class extends Error {},
}));
vi.mock("@/lib/server/levytate-finance", () => ({ importOrganisationFinance: mocks.financeImport, confirmOrganisationFinanceBalance: mocks.balance, getOrganisationFinanceState: mocks.financeState, LevyTateFinanceError: class extends Error {} }));
vi.mock("@/lib/server/levytate-learner-lifecycle", () => ({ LevyTateLearnerLifecyclePermissionError: class extends Error {} }));
import { POST as workspacePost, GET as workspaceGet } from "@/app/api/levytate-workspace/route";
import { POST as financePost } from "@/app/api/levytate-finance/route";
function request(body: unknown, origin = "https://candidate.vercel.app", contentType = "application/json") {
  return new Request("https://candidate.vercel.app/api/write", { method: "POST", headers: { origin, "content-type": contentType }, body: JSON.stringify(body) });
}
beforeEach(() => { vi.resetAllMocks(); mocks.session.mockResolvedValue({ email: "synthetic@example.invalid" }); mocks.mutate.mockResolvedValue({}); mocks.balance.mockResolvedValue({}); });

describe("actual cookie-authenticated mutation routes", () => {
  it.each([workspacePost, financePost])("denies sibling-origin writes without calling persistence", async (post) => {
    expect((await post(request({ action: "balance", amountPence: 0 }, "https://sibling.vercel.app"))).status).toBe(403);
    expect(mocks.mutate).not.toHaveBeenCalled(); expect(mocks.balance).not.toHaveBeenCalled(); expect(mocks.financeImport).not.toHaveBeenCalled();
  });
  it("rejects an unauthenticated mutation before parsing it", async () => {
    mocks.session.mockResolvedValue(null);
    expect((await workspacePost(request({ type: "archiveEmployee", id: "one" }))).status).toBe(401);
    expect(mocks.mutate).not.toHaveBeenCalled();
  });
  it("rejects malformed types and simple-request content types", async () => {
    expect((await workspacePost(request({ type: "saveEmployee", employee: [] }))).status).toBe(400);
    expect((await financePost(request({ action: "balance", amountPence: "10" }))).status).toBe(400);
    expect((await workspacePost(request({}, undefined, "text/plain"))).status).toBe(415);
    expect(mocks.mutate).not.toHaveBeenCalled(); expect(mocks.balance).not.toHaveBeenCalled();
  });
  it("does not expose provider diagnostics on reads or writes", async () => {
    const secret = "provider diagnostic with private credential";
    mocks.mutate.mockRejectedValue(new Error(secret)); mocks.bootstrap.mockRejectedValue(new Error(secret));
    for (const response of [await workspacePost(request({ type: "archiveEmployee", id: "one" })), await workspaceGet()]) {
      expect(response.status).toBe(503); expect(await response.text()).not.toContain(secret);
      expect(response.headers.get("cache-control")).toContain("no-store");
    }
  });
  it("passes only validated actions to the authenticated tenant service", async () => {
    expect((await financePost(request({ action: "balance", amountPence: 0 }))).status).toBe(200);
    expect(mocks.balance).toHaveBeenCalledWith({ email: "synthetic@example.invalid" }, 0);
  });
});
