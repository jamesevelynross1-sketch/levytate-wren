import { beforeEach, describe, expect, it, vi } from "vitest";
const fake = vi.hoisted(() => ({ select: vi.fn(), update: vi.fn(), insert: vi.fn() }));
vi.mock("@/lib/server/levytate-supabase", () => ({ getLevyTateSupabaseConfig: () => ({ url: "http://localhost:54321", serviceRoleKey: "synthetic-unit-test" }), supabaseSelect: fake.select, supabaseUpdate: fake.update, supabaseInsert: fake.insert }));
vi.mock("@/lib/server/levytate-prospect-access", () => ({ checkProspectSessionAccess: vi.fn(async () => true) }));
vi.mock("@/lib/server/levytate-auth-email-delivery", () => ({ recordAuthenticationEmailAccepted: vi.fn(), recordAuthenticationEmailRequest: vi.fn(), shouldSuppressAuthenticationEmail: vi.fn(async () => false) }));
import { refreshEmployerAuth, revalidateEmployerSession, verifyEmployerMagicLink } from "../lib/server/levytate-auth";
import { readLevyTateBetaSession } from "../lib/levytate/config/beta-access";

let members: Array<Record<string, unknown>>;
let people: Array<Record<string, unknown>>;
let organisationStatus: string;
const authIdentity = { id: "auth-employee", email: "employee@example.test" };
beforeEach(() => {
  vi.clearAllMocks();
  members = [{ id: "member", organisation_id: "tenant-a", email: authIdentity.email, role: "Employee", access_level: "beta_user", active: true, auth_subject: null, auth_binding_status: "pending", auth_bound_at: null, invitation_status: "accepted", invitation_expires_at: new Date(Date.now() + 60_000).toISOString(), invitation_generation: 1 }];
  people = [{ id: "person", organisation_id: "tenant-a", email: authIdentity.email, platform_role: "Employee", status: "Active" }];
  organisationStatus = "Active";
  fake.select.mockImplementation(async (_config, table, query: URLSearchParams) => {
    if (table === "levytate_organisations") return [{ id: "tenant-a", status: organisationStatus }];
    if (table === "levytate_employees") return people;
    if (table === "levytate_users") return members.filter((row) => [...query].every(([key, value]) => !value.startsWith("eq.") || String(row[key]) === value.slice(3))).map((row) => ({ ...row }));
    return [];
  });
  fake.update.mockImplementation(async (_config, _table, query: string, patch) => {
    const matches = members.filter((row) => [...new URLSearchParams(query)].every(([key, value]) => value === "is.null" ? row[key] == null : !value.startsWith("eq.") || String(row[key]) === value.slice(3)));
    for (const row of matches) Object.assign(row, patch);
    return matches.map((row) => ({ ...row }));
  });
  fake.insert.mockResolvedValue([]);
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ access_token: "synthetic-provider-access", refresh_token: "synthetic-provider-refresh", expires_in: 3600, user: authIdentity }))));
});

describe("employer authentication service boundary", () => {
  it("binds a verified individual only after persisted membership and People checks", async () => {
    const result = await verifyEmployerMagicLink("synthetic-one-use-token", "email");
    expect(members[0]).toMatchObject({ auth_subject: authIdentity.id, auth_binding_status: "bound", invitation_status: "consumed" });
    expect(await readLevyTateBetaSession(result.sessionToken)).toMatchObject({ email: authIdentity.email, authMode: "supabase_email", authSubject: authIdentity.id, accessLevel: "beta_user" });
    expect(fake.update.mock.calls[0][2]).toContain("invitation_generation=eq.1");
  });
  it("allows a lead without manufacturing an employee", async () => {
    members[0].role = "Apprenticeship Lead"; people = [];
    expect((await verifyEmployerMagicLink("synthetic-token", "email")).membership.role).toBe("Apprenticeship Lead");
  });
  it.each(["Department Head", "Unknown"])("denies unsupported role %s before binding", async (role) => {
    members[0].role = role;
    await expect(verifyEmployerMagicLink("synthetic-token", "email")).rejects.toMatchObject({ code: "unauthorised" });
    expect(fake.update).not.toHaveBeenCalled();
  });
  it("denies ambiguous memberships and People", async () => {
    members.push({ ...members[0], id: "second", organisation_id: "tenant-b" });
    await expect(verifyEmployerMagicLink("synthetic-token", "email")).rejects.toMatchObject({ code: "unauthorised" });
    members.pop(); people.push({ ...people[0], id: "duplicate" });
    await expect(verifyEmployerMagicLink("synthetic-token", "email")).rejects.toMatchObject({ code: "unauthorised" });
  });
  it("rejects a duplicate subject owner instead of treating it as unused", async () => {
    members[0].auth_subject = authIdentity.id;
    members.push({ ...members[0], id: "second", email: "other@example.test" });
    await expect(verifyEmployerMagicLink("synthetic-token", "email")).rejects.toMatchObject({ code: "conflict" });
  });
  it("denies missing, expired and revoked invitations", async () => {
    for (const invitation of [
      { invitation_status: "not_requested" }, { invitation_status: "revoked" },
      { invitation_status: "accepted", invitation_expires_at: "2000-01-01T00:00:00Z" },
    ]) {
      Object.assign(members[0], invitation);
      await expect(verifyEmployerMagicLink("synthetic-token", "email")).rejects.toMatchObject({ code: "unauthorised" });
    }
  });
  it("never issues a session after an empty persistence result", async () => {
    fake.update.mockResolvedValueOnce([]);
    await expect(verifyEmployerMagicLink("synthetic-token", "email")).rejects.toMatchObject({ code: "conflict" });
  });
  it("denies suspended tenant at callback and refresh", async () => {
    const result = await verifyEmployerMagicLink("synthetic-token", "email");
    const session = await readLevyTateBetaSession(result.sessionToken);
    organisationStatus = "Suspended";
    await expect(verifyEmployerMagicLink("synthetic-token", "email")).rejects.toMatchObject({ code: "unauthorised" });
    await expect(refreshEmployerAuth("synthetic-refresh", session!)).rejects.toMatchObject({ code: "unauthorised" });
  });
  it("denies the previous session after reactivation creates a new binding", async () => {
    const result = await verifyEmployerMagicLink("synthetic-token", "email");
    const old = await readLevyTateBetaSession(result.sessionToken);
    members[0].auth_bound_at = new Date(old!.issuedAt + 1000).toISOString();
    expect(await revalidateEmployerSession(old!)).toBeNull();
    await expect(refreshEmployerAuth("synthetic-refresh", old!)).rejects.toMatchObject({ code: "unauthorised" });
  });
  it("does not accept an old provider refresh credential as a pending reinvitation", async () => {
    const result = await verifyEmployerMagicLink("synthetic-token", "email");
    const old = await readLevyTateBetaSession(result.sessionToken);
    Object.assign(members[0], { auth_subject: null, auth_binding_status: "pending", invitation_status: "accepted", invitation_generation: 3 });
    vi.mocked(fetch).mockClear();
    await expect(refreshEmployerAuth("synthetic-refresh", old!)).rejects.toMatchObject({ code: "unauthorised" });
    expect(fetch).not.toHaveBeenCalled();
  });
  it("refreshes a current binding without accepting a swapped provider identity", async () => {
    const result = await verifyEmployerMagicLink("synthetic-token", "email");
    const session = await readLevyTateBetaSession(result.sessionToken);
    expect((await refreshEmployerAuth("synthetic-refresh", session!)).membership.id).toBe("member");
    vi.mocked(fetch).mockResolvedValueOnce(Response.json({ user: { id: "other", email: authIdentity.email } }));
    await expect(refreshEmployerAuth("synthetic-refresh", session!)).rejects.toMatchObject({ code: "unauthorised" });
  });
  it("checks membership, People and organisation on each request", async () => {
    const result = await verifyEmployerMagicLink("synthetic-token", "email");
    const session = await readLevyTateBetaSession(result.sessionToken);
    expect(await revalidateEmployerSession(session!)).not.toBeNull();
    people[0].status = "Archived";
    expect(await revalidateEmployerSession(session!)).toBeNull();
  });
});
