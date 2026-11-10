import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LevyTateBetaSession } from "@/lib/levytate/config/beta-access";
const mocks = vi.hoisted(() => ({ context: vi.fn(), rpc: vi.fn() }));
vi.mock("@/lib/server/levytate-learner-lifecycle", () => ({ getLearnerLifecycleServerContext: mocks.context }));
vi.mock("@/lib/server/levytate-supabase", () => ({ readRuntimeEnv: () => "", getLevyTateSupabaseConfig: () => ({ url: "http://127.0.0.1", serviceRoleKey: "synthetic" }), supabaseFetchJson: mocks.rpc }));
import { suspendClientTenant } from "@/lib/server/levytate-tenant-lifecycle";
const session = { email: "platform@example.invalid" } as LevyTateBetaSession;
const input = { action: "suspend_workspace", organisationId: "09009000-0000-4000-8000-000000000001", reason: "Fictional suspension test", requestId: "09009000-0000-4000-8000-000000000002" };
beforeEach(() => {
  vi.resetAllMocks();
  mocks.context.mockResolvedValue({ user: { id: "09009000-0000-4000-8000-000000000003", role: "Platform Admin" } });
  mocks.rpc.mockResolvedValue({ organisationId: input.organisationId, status: "Suspended", membershipsRevoked: 3, suspendedAt: "2026-10-29T00:00:00Z" });
});
describe("tenant suspension service (mocked database)", () => {
  it("derives actor from the current server context and submits one atomic command", async () => {
    expect((await suspendClientTenant(session, input)).status).toBe("Suspended");
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    const [, path, init] = mocks.rpc.mock.calls[0];
    expect(path).toBe("rpc/levytate_suspend_client_tenant");
    expect(JSON.parse(init.body)).toMatchObject({ p_organisation_id: input.organisationId, p_actor_user_id: "09009000-0000-4000-8000-000000000003", p_request_id: input.requestId });
  });
  it.each(["Employee", "Line Manager", "Apprenticeship Lead", "Employer Admin"])("denies %s without invoking the command", async (role) => {
    mocks.context.mockResolvedValue({ user: { id: "not-platform", role } });
    await expect(suspendClientTenant(session, input)).rejects.toMatchObject({ status: 403 });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it.each([{ ...input, reason: "short" }, { ...input, actorId: "forged" }, { ...input, organisationId: "not-an-id" }])("rejects malformed or forged input", async (body) => {
    await expect(suspendClientTenant(session, body)).rejects.toMatchObject({ status: 400 });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("does not claim success without a matching confirmed result", async () => {
    mocks.rpc.mockResolvedValue({ organisationId: "another-tenant", status: "Suspended", membershipsRevoked: 3 });
    await expect(suspendClientTenant(session, input)).rejects.toMatchObject({ status: 503 });
  });
  it("maps concurrent database rejection without exposing internal detail", async () => {
    mocks.rpc.mockRejectedValueOnce(new Error("PT409 / private database detail"));
    await expect(suspendClientTenant(session, input)).rejects.toMatchObject({ status: 409, message: "The workspace or request changed. Refresh before continuing." });
  });
});
