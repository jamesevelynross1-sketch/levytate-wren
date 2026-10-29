import { beforeEach, describe, expect, it, vi } from "vitest";
const fake = vi.hoisted(() => ({ select: vi.fn(), update: vi.fn(), insert: vi.fn(), remove: vi.fn(), actor: vi.fn(), policy: vi.fn(), delivery: vi.fn(), suppress: vi.fn(), request: vi.fn(), accepted: vi.fn(), limit: vi.fn() }));
vi.mock("@/lib/server/levytate-supabase", () => ({ getLevyTateSupabaseConfig: () => ({ url: "http://127.0.0.1:54321", serviceRoleKey: "synthetic-unit-test" }), supabaseSelect: fake.select, supabaseSelectAll: fake.select, supabaseInsert: fake.insert, supabaseUpdate: fake.update, supabaseDelete: fake.remove }));
vi.mock("@/lib/server/levytate-learner-lifecycle", () => ({ getLearnerLifecycleServerContext: fake.actor }));
vi.mock("@/lib/server/levytate-identity-policy", () => ({ validateIdentityMembership: fake.policy }));
vi.mock("@/lib/server/levytate-auth-rate-limit", () => ({ checkMagicLinkRequestLimits: fake.limit }));
vi.mock("@/lib/server/levytate-auth-email-delivery", () => ({ getAuthenticationDeliveryStatus: fake.delivery, shouldSuppressAuthenticationEmail: fake.suppress, recordAuthenticationEmailRequest: fake.request, recordAuthenticationEmailAccepted: fake.accepted }));
import { inviteClientWorkspaceUser, provisionClientWorkspaceUser, updateClientWorkspaceUser } from "../lib/server/levytate-client-workspace-admin";
import { invitationAllowsActivation, invitationDisplayState } from "../lib/levytate/mvp/invitations";
import type { LevyTateBetaSession } from "../lib/levytate/config/beta-access";

const session = { email: "lead@example.test", authMode: "supabase_email", authSubject: "lead-auth", accessLevel: "beta_user", issuedAt: 1, expiresAt: 9999999999999 } as LevyTateBetaSession;
const callback = "http://localhost:3000/levytate/auth/callback";
const request = new Request("http://localhost:3000/api/levytate-workspace/invitations", { method: "POST", headers: { origin: "http://localhost:3000" } });
const requestId = "00000000-0000-4000-8000-000000000001";
let user: Record<string, unknown>;
let send: ReturnType<typeof vi.fn>;
beforeEach(() => {
  vi.clearAllMocks();
  user = { id: "member", organisation_id: "tenant-a", email: "employee@example.test", role: "Employee", display_name: "Fictional Employee", access_level: "beta_user", active: false, auth_subject: null, auth_binding_status: "pending", invitation_status: "not_requested", invitation_requested_at: null, invitation_expires_at: null, invitation_request_reference: null, invitation_generation: 0 };
  fake.actor.mockResolvedValue({ organisation: { id: "tenant-a" }, user: { id: "lead", role: "Apprenticeship Lead", email: session.email } });
  fake.policy.mockResolvedValue({ role: "Employee", employeeId: "person" });
  fake.suppress.mockResolvedValue(false); fake.limit.mockResolvedValue({ allowed: true });
  fake.delivery.mockResolvedValue({ status: "accepted" }); fake.request.mockResolvedValue(requestId); fake.accepted.mockResolvedValue(undefined);
  fake.insert.mockImplementation(async (_config, _table, rows) => rows);
  fake.select.mockImplementation(async (_config, table, query: URLSearchParams) => {
    if (table === "levytate_organisations") return [{ id: "tenant-a", status: "Active" }];
    if (table === "levytate_users") return [...query.entries()].some(([key, value]) => key !== "select" && key !== "limit" && key !== "order" && value.startsWith("eq.") && String(user[key]) !== value.slice(3)) ? [] : [{ ...user }];
    return [];
  });
  fake.update.mockImplementation(async (_config, _table, query: string, patch) => {
    if ([...new URLSearchParams(query)].some(([key, value]) => value.startsWith("eq.") && String(user[key]) !== value.slice(3))) return [];
    user = { ...user, ...patch }; return [{ ...user }];
  });
  send = vi.fn(async (url: string) => new Response(JSON.stringify(url.includes("admin/users") ? { users: [{ id: "auth-employee", email: user.email }] } : {})));
  vi.stubGlobal("fetch", send);
});

describe("controlled individual invitations (service boundary)", () => {
  it("records provider acceptance separately from delivery and retries without a second send", async () => {
    const input = { userId: "member", requestId, expectedGeneration: 0 };
    const result = await inviteClientWorkspaceUser(session, input, callback, request);
    expect(result).toMatchObject({ active: true, invitationStatus: "accepted", deliveryStatus: "accepted", invitationGeneration: 1 });
    await inviteClientWorkspaceUser(session, input, callback, request);
    expect(send.mock.calls.filter(([url]) => url.includes("/otp?"))).toHaveLength(1);
    expect(fake.request).toHaveBeenCalledWith("employee@example.test", requestId);
  });
  it("keeps provider refusal as failed and inactive", async () => {
    send.mockImplementation(async (url: string) => url.includes("admin/users") ? new Response(JSON.stringify({ users: [{ id: "auth", email: user.email }] })) : new Response("{}", { status: 503 }));
    const result = await inviteClientWorkspaceUser(session, { userId: "member", requestId, expectedGeneration: 0 }, callback, request);
    expect(result).toMatchObject({ active: false, invitationStatus: "failed" });
    expect(invitationAllowsActivation(user)).toBe(false);
  });
  it("does not send when People linkage is absent or delivery is suppressed", async () => {
    fake.policy.mockResolvedValueOnce(null);
    await expect(inviteClientWorkspaceUser(session, { userId: "member", requestId, expectedGeneration: 0 }, callback, request)).rejects.toMatchObject({ status: 409 });
    fake.suppress.mockResolvedValueOnce(true);
    await expect(inviteClientWorkspaceUser(session, { userId: "member", requestId, expectedGeneration: 0 }, callback, request)).rejects.toMatchObject({ status: 409 });
    expect(send).not.toHaveBeenCalled();
  });
  it("permits only one concurrent reservation", async () => {
    const outcomes = await Promise.allSettled([
      inviteClientWorkspaceUser(session, { userId: "member", requestId, expectedGeneration: 0 }, callback, request),
      inviteClientWorkspaceUser(session, { userId: "member", requestId: "00000000-0000-4000-8000-000000000002", expectedGeneration: 0 }, callback, request),
    ]);
    expect(outcomes.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(send.mock.calls.filter(([url]) => url.includes("/otp?"))).toHaveLength(1);
  });
  it("cannot reactivate a user revoked while the email is in flight", async () => {
    let finish!: (response: Response) => void;
    let sending!: () => void;
    const started = new Promise<void>((resolve) => { sending = resolve; });
    send.mockImplementation(async (url: string) => {
      if (url.includes("admin/users")) return new Response(JSON.stringify({ users: [{ id: "auth", email: user.email }] }));
      sending(); return new Promise<Response>((resolve) => { finish = resolve; });
    });
    const invitation = inviteClientWorkspaceUser(session, { userId: "member", requestId, expectedGeneration: 0 }, callback, request);
    await started;
    await updateClientWorkspaceUser(session, { userId: "member", active: false });
    finish(new Response("{}"));
    await expect(invitation).rejects.toMatchObject({ status: 409 });
    expect(user).toMatchObject({ active: false, invitation_status: "revoked", auth_subject: null });
  });
  it("denies other tenant and employee callers before contacting Auth", async () => {
    user.organisation_id = "tenant-b";
    await expect(inviteClientWorkspaceUser(session, { userId: "member", requestId, expectedGeneration: 0 }, callback, request)).rejects.toMatchObject({ status: 404 });
    fake.actor.mockResolvedValueOnce({ organisation: { id: "tenant-a" }, user: { id: "employee", role: "Employee", email: "employee@example.test" } });
    await expect(inviteClientWorkspaceUser(session, { userId: "member", requestId, expectedGeneration: 0 }, callback, request)).rejects.toMatchObject({ status: 403 });
    expect(send).not.toHaveBeenCalled();
  });
  it("denies unknown roles and administrator escalation during provisioning", async () => {
    await expect(provisionClientWorkspaceUser(session, { organisationId: "tenant-a", email: "new@example.test", displayName: "New", role: "Department Head" })).rejects.toMatchObject({ status: 400 });
    await expect(provisionClientWorkspaceUser(session, { organisationId: "tenant-a", email: "new@example.test", displayName: "New", role: "Employer Admin" })).rejects.toMatchObject({ status: 403 });
    expect(send).not.toHaveBeenCalled();
  });
  it("expires pending activation without disabling already bound accounts", () => {
    const expired = { invitation_status: "accepted" as const, invitation_expires_at: "2020-01-01T00:00:00Z", auth_binding_status: "pending", active: true };
    expect(invitationAllowsActivation(expired)).toBe(false);
    expect(invitationDisplayState(expired)).toBe("expired");
    expect(invitationAllowsActivation({ ...expired, auth_binding_status: "bound" })).toBe(true);
  });
});
