import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const fake = vi.hoisted(() => ({ actor: vi.fn(), select: vi.fn(), rpc: vi.fn(), insert: vi.fn(), update: vi.fn(), remove: vi.fn() }));
vi.mock("@/lib/server/levytate-supabase", () => ({ getLevyTateSupabaseConfig: () => ({ url: "http://localhost:54321", serviceRoleKey: "synthetic-only" }), supabaseSelect: fake.select, supabaseSelectAll: fake.select, supabaseFetchJson: fake.rpc, supabaseInsert: fake.insert, supabaseUpdate: fake.update, supabaseDelete: fake.remove }));
vi.mock("@/lib/server/levytate-learner-lifecycle", () => ({ getLearnerLifecycleServerContext: fake.actor }));
vi.mock("@/lib/server/levytate-auth-email-delivery", () => ({ getAuthenticationDeliveryStatus: vi.fn(), shouldSuppressAuthenticationEmail: vi.fn(), recordAuthenticationEmailRequest: vi.fn(), recordAuthenticationEmailAccepted: vi.fn() }));
import { createClientWorkspace, provisionClientWorkspaceUser, updateClientWorkspaceUser } from "../lib/server/levytate-client-workspace-admin";
import type { LevyTateBetaSession } from "../lib/levytate/config/beta-access";
const session = { email: "platform@example.test" } as LevyTateBetaSession;
const requestId = "00000000-0000-4000-8000-000000000001";
const user = { id: "member", organisation_id: "tenant", email: "member@example.test", display_name: "Member", role: "Employee", active: false, auth_binding_status: "pending", invitation_status: "not_requested", invitation_generation: 0 };
const provision = { requestId, organisationId: "tenant", email: "member@example.test", displayName: "Member", role: "Employee" };
beforeEach(() => {
  vi.resetAllMocks(); vi.stubGlobal("fetch", vi.fn());
  fake.actor.mockResolvedValue({ organisation: { id: "internal" }, user: { id: "actor", role: "Platform Admin", email: session.email } });
  fake.select.mockResolvedValue([{ ...user }]);
  fake.rpc.mockImplementation(async (_config, _path, init) => { const input = JSON.parse(init.body); return { requestId: input.p_request_id, command: input.p_command, user: { ...user }, organisation: { id: "tenant", name: "Blank", slug: "blank", workspace_name: "Blank", status: "Active" } }; });
});
afterEach(() => vi.unstubAllGlobals());
describe("atomic client-account service contract (RPC transport mocks, not database acceptance)", () => {
  it("prepares a membership with one RPC and no Auth or split audit writes", async () => {
    expect(await provisionClientWorkspaceUser(session, provision)).toMatchObject({ id: "member", active: false });
    expect(fake.rpc).toHaveBeenCalledTimes(1); expect(fetch).not.toHaveBeenCalled();
    expect(fake.insert).not.toHaveBeenCalled(); expect(fake.update).not.toHaveBeenCalled(); expect(fake.remove).not.toHaveBeenCalled();
  });
  it("creates a blank workspace and never compensates by deleting committed state", async () => {
    expect(await createClientWorkspace(session, { requestId, name: "Blank", primaryContact: "Lead", contactEmail: "lead@example.test" })).toMatchObject({ id: "tenant", users: [{ id: "member" }] });
    expect(fetch).not.toHaveBeenCalled(); expect(fake.remove).not.toHaveBeenCalled();
  });
  it("retries the identical request after a lost response without a pre-read duplicate rejection", async () => {
    fake.rpc.mockRejectedValueOnce(new Error("transport unavailable"));
    await expect(provisionClientWorkspaceUser(session, provision)).rejects.toMatchObject({ status: 503 });
    await provisionClientWorkspaceUser(session, provision);
    expect(fake.rpc.mock.calls[0][2].body).toBe(fake.rpc.mock.calls[1][2].body);
    expect(fake.select).not.toHaveBeenCalled(); expect(fake.remove).not.toHaveBeenCalled();
  });
  it("allows the database to replay the original generation before checking stale changes", async () => {
    fake.select.mockResolvedValue([{ ...user, invitation_generation: 8, invitation_status: "revoked" }]);
    await updateClientWorkspaceUser(session, { requestId, userId: "member", role: "Employee", active: false, expectedGeneration: 7 });
    expect(JSON.parse(fake.rpc.mock.calls[0][2].body).p_payload.expectedGeneration).toBe(7);
    expect(fake.update).not.toHaveBeenCalled(); expect(fake.insert).not.toHaveBeenCalled();
  });
  it.each([["PT403",403],["PT404",404],["PT409",409],["23505",409],["40P01",409],["PT422",422],["55000",503]])("maps %s without exposing provider diagnostics", async (code, status) => {
    fake.rpc.mockRejectedValue(new Error(`${code}: private provider detail`));
    await expect(provisionClientWorkspaceUser(session, provision)).rejects.toMatchObject({ status });
    await expect(provisionClientWorkspaceUser(session, provision)).rejects.not.toThrow("private provider detail");
  });
  it("denies unconfirmed receipts without compensation or false success", async () => {
    fake.rpc.mockResolvedValue({ requestId: "other", command: "provision_user", user });
    await expect(provisionClientWorkspaceUser(session, provision)).rejects.toMatchObject({ status: 503 });
    expect(fake.remove).not.toHaveBeenCalled(); expect(fetch).not.toHaveBeenCalled();
  });
  it("requires a retry identifier and pinned editor generation", async () => {
    await expect(provisionClientWorkspaceUser(session, { ...provision, requestId: undefined })).rejects.toMatchObject({ status: 400 });
    await expect(updateClientWorkspaceUser(session, { userId: "member", role: "Employee", active: false, requestId })).rejects.toMatchObject({ status: 409 });
    expect(fake.rpc).not.toHaveBeenCalled();
  });
});
