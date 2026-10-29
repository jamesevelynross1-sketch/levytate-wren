import { randomUUID } from "node:crypto";
import type { LevyTateBetaSession } from "@/lib/levytate/config/beta-access";
import { normaliseBetaEmail } from "@/lib/levytate/config/beta-access";
import { normaliseMvpUserRole, parseMvpUserRole, type MvpUserRole } from "@/lib/levytate/mvp/rbac";
import { findAuthIdentityByEmail } from "@/lib/server/levytate-auth-directory";
import { validateIdentityMembership } from "@/lib/server/levytate-identity-policy";
import { invitationDisplayState, type ClientInvitationFields } from "@/lib/levytate/mvp/invitations";
import { getAuthenticationDeliveryStatus, recordAuthenticationEmailAccepted, recordAuthenticationEmailRequest, shouldSuppressAuthenticationEmail } from "@/lib/server/levytate-auth-email-delivery";
import { checkMagicLinkRequestLimits } from "@/lib/server/levytate-auth-rate-limit";
import { getLearnerLifecycleServerContext } from "@/lib/server/levytate-learner-lifecycle";
import { getLevyTateSupabaseConfig, supabaseDelete, supabaseInsert, supabaseSelect, supabaseSelectAll, supabaseUpdate } from "@/lib/server/levytate-supabase";

const organisationsTable = "levytate_organisations";
const usersTable = "levytate_users";
const employerRoles = new Set<MvpUserRole>(["Employer Admin", "Apprenticeship Lead", "Line Manager", "Employee"]);

type OrganisationRow = { id: string; name: string; slug: string; workspace_name: string; primary_contact: string; contact_email: string; status: string; created_at: string; updated_at: string };
type UserRow = ClientInvitationFields & { id: string; organisation_id: string; email: string; role: MvpUserRole; access_level: string; display_name: string; active: boolean; auth_subject: string | null; auth_binding_status: string; created_at: string; updated_at: string };
type AuthUser = { id: string; email?: string };
const userColumns = "id,organisation_id,email,role,access_level,display_name,active,auth_subject,auth_binding_status,created_at,updated_at,invitation_status,invitation_requested_at,invitation_expires_at,invitation_request_reference,invitation_generation";
export type ClientWorkspaceUser = { id: string; email: string; displayName: string; role: MvpUserRole; active: boolean; authBindingStatus: string; invitationStatus: string; invitationExpiresAt: string | null; invitationGeneration: number; deliveryStatus: string };

export type ClientWorkspaceSummary = {
  id: string;
  name: string;
  slug: string;
  workspaceName: string;
  status: string;
  createdAt: string;
  users: ClientWorkspaceUser[];
};

export class ClientWorkspaceAdminError extends Error {
  constructor(message: string, public status = 400) { super(message); this.name = "ClientWorkspaceAdminError"; }
}

export async function listClientWorkspaces(session: LevyTateBetaSession) {
  await requirePlatformAdmin(session);
  const organisations = await supabaseSelectAll<OrganisationRow>(config(), organisationsTable, new URLSearchParams({ select: "id,name,slug,workspace_name,primary_contact,contact_email,status,created_at,updated_at", workspace_template: "eq.levytate-client-v1", order: "created_at.desc,id.asc" }));
  const users = await supabaseSelectAll<UserRow>(config(), usersTable, new URLSearchParams({ select: userColumns, order: "created_at.asc,id.asc" }));
  return Promise.all(organisations.map((organisation) => toSummary(organisation, users.filter((user) => user.organisation_id === organisation.id))));
}

export async function createClientWorkspace(session: LevyTateBetaSession, input: { name?: unknown; workspaceName?: unknown; primaryContact?: unknown; contactEmail?: unknown; initialRole?: unknown }) {
  const actor = await requireWorkspaceManager(session);
  const name = requiredText(input.name, "Organisation name", 160);
  const workspaceName = optionalText(input.workspaceName, 160) || `${name} Apprenticeship Workspace`;
  const primaryContact = requiredText(input.primaryContact, "Primary contact", 160);
  const email = validEmail(input.contactEmail);
  if (actor.user.role !== "Platform Admin") throw new ClientWorkspaceAdminError("Only Platform Admin can create client workspaces.", 403);
  const initialRole = employerRole(input.initialRole, "Apprenticeship Lead");
  if (initialRole !== "Employer Admin" && initialRole !== "Apprenticeship Lead") throw new ClientWorkspaceAdminError("The initial user must be an Apprenticeship Lead or Employer Admin.");
  const slug = slugify(name);
  const existingOrganisation = await supabaseSelect<OrganisationRow>(config(), organisationsTable, new URLSearchParams({ select: "id", slug: `eq.${slug}`, limit: "1" }));
  if (existingOrganisation.length) throw new ClientWorkspaceAdminError("An employer workspace already uses this organisation name.", 409);
  const existingMembership = await findMembership(email);
  if (existingMembership) throw new ClientWorkspaceAdminError("This email already has LevyTate organisation access.", 409);

  const now = new Date().toISOString();
  const organisation: OrganisationRow & { workspace_template: string; sites: string[]; departments: string[]; priorities: never[]; default_site: string } = {
    id: randomUUID(), name, slug, workspace_name: workspaceName, primary_contact: primaryContact, contact_email: email,
    default_site: "", sites: [], departments: [], priorities: [], workspace_template: "levytate-client-v1", status: "Active", created_at: now, updated_at: now,
  };
  let auth: { user: AuthUser; created: boolean } | null = null;
  try {
    await supabaseInsert(config(), organisationsTable, [organisation]);
    auth = await ensureAuthUser(email);
    await supabaseInsert<UserRow>(config(), usersTable, [membershipRow(organisation.id, email, primaryContact, initialRole, now)]);
    await audit(organisation.id, actor.user.email, "client_workspace.created", organisation.id, "Blank Client V1 employer workspace created.");
    const user = await findMembership(email);
    return toSummary(organisation, user ? [user] : []);
  } catch (error) {
    await supabaseDelete(config(), usersTable, `organisation_id=eq.${organisation.id}`).catch(() => undefined);
    if (auth?.created) await authRequest(`admin/users/${encodeURIComponent(auth.user.id)}`, { method: "DELETE" }).catch(() => undefined);
    await supabaseDelete(config(), organisationsTable, `id=eq.${organisation.id}`).catch(() => undefined);
    throw error;
  }
}

export async function provisionClientWorkspaceUser(session: LevyTateBetaSession, input: { organisationId?: unknown; email?: unknown; displayName?: unknown; role?: unknown }) {
  const actor = await requireWorkspaceManager(session);
  const organisationId = requiredText(input.organisationId, "Organisation", 80);
  const email = validEmail(input.email);
  const displayName = requiredText(input.displayName, "Display name", 160);
  const role = employerRole(input.role, "Employee");
  assertManagedScope(actor, organisationId, role);
  const organisation = (await supabaseSelect<OrganisationRow>(config(), organisationsTable, new URLSearchParams({ select: "id,name,slug,workspace_name,primary_contact,contact_email,status,created_at,updated_at", id: `eq.${organisationId}`, workspace_template: "eq.levytate-client-v1", status: "eq.Active", limit: "1" })))[0];
  if (!organisation) throw new ClientWorkspaceAdminError("The active client workspace was not found.", 404);
  if (await findMembership(email)) throw new ClientWorkspaceAdminError("This email already has LevyTate organisation access.", 409);
  if (!(await validateIdentityMembership({ id: "pending", organisation_id: organisationId, email, role, active: true }))) {
    throw new ClientWorkspaceAdminError("Create exactly one active People record with the same email and role before provisioning Employee or Line Manager access.", 409);
  }
  const now = new Date().toISOString();
  const auth = await ensureAuthUser(email);
  try {
    const row = membershipRow(organisation.id, email, displayName, role, now);
    await supabaseInsert<UserRow>(config(), usersTable, [row]);
    await audit(organisation.id, actor.user.email, "client_workspace.user_provisioned", row.id, `Client workspace user provisioned as ${role}.`, actor.user.role);
    return summariseUser(row);
  } catch (error) {
    if (auth.created) await authRequest(`admin/users/${encodeURIComponent(auth.user.id)}`, { method: "DELETE" }).catch(() => undefined);
    throw error;
  }
}

export async function updateClientWorkspaceUser(session: LevyTateBetaSession, input: { userId?: unknown; role?: unknown; active?: unknown }) {
  const actor = await requireWorkspaceManager(session);
  const userId = requiredText(input.userId, "User", 80);
  const current = await managedUser(actor, userId);
  if (!current) throw new ClientWorkspaceAdminError("The client workspace user was not found.", 404);
  const organisation = (await supabaseSelect<{ id: string }>(config(), organisationsTable, new URLSearchParams({ select: "id", id: `eq.${current.organisation_id}`, workspace_template: "eq.levytate-client-v1", limit: "1" })))[0];
  if (!organisation) throw new ClientWorkspaceAdminError("The client workspace user was not found.", 404);
  const role = input.role === undefined ? current.role : employerRole(input.role, current.role);
  assertManagedScope(actor, current.organisation_id, role);
  if (current.id === actor.user.id && (role !== current.role || input.active === false)) throw new ClientWorkspaceAdminError("Ask another authorised administrator to change your own access.", 409);
  if (input.active !== undefined && typeof input.active !== "boolean") throw new ClientWorkspaceAdminError("Active must be true or false.");
  const active = typeof input.active === "boolean" ? input.active : current.active;
  if (active && !current.active) throw new ClientWorkspaceAdminError("Send a new invitation to reactivate this account.", 409);
  if (active && !(await validateIdentityMembership({ ...current, role, active }))) throw new ClientWorkspaceAdminError("This role requires exactly one matching active People record.", 409);
  const updated = (await supabaseUpdate<UserRow>(config(), usersTable, new URLSearchParams({ id: `eq.${userId}`, organisation_id: `eq.${current.organisation_id}`, invitation_generation: `eq.${current.invitation_generation}` }).toString(), {
    role, active, invitation_generation: current.invitation_generation + 1, ...(!active ? { auth_subject: null, auth_binding_status: "pending", auth_bound_at: null, invitation_status: "revoked", invitation_expires_at: null } : {}), updated_at: new Date().toISOString(),
  }))[0];
  if (!updated) throw new ClientWorkspaceAdminError("The client workspace user could not be updated.", 409);
  await audit(current.organisation_id, actor.user.email, active ? "client_workspace.user_updated" : "client_workspace.user_revoked", userId, `Client workspace user set to ${role} and ${active ? "active" : "inactive"}.`, actor.user.role);
  return summariseUser(updated);
}

function membershipRow(organisationId: string, email: string, displayName: string, role: MvpUserRole, now: string): UserRow {
  return { id: randomUUID(), organisation_id: organisationId, email, role, access_level: "beta_user", display_name: displayName, active: false, auth_subject: null, auth_binding_status: "pending", created_at: now, updated_at: now, invitation_status: "not_requested", invitation_generation: 0, invitation_request_reference: null, invitation_expires_at: null, invitation_requested_at: null };
}

async function requirePlatformAdmin(session: LevyTateBetaSession) {
  const context = await getLearnerLifecycleServerContext(session);
  if (normaliseMvpUserRole(context.user.role) !== "Platform Admin") throw new ClientWorkspaceAdminError("Only Platform Admin can manage client workspaces.", 403);
  return context;
}

async function findMembership(email: string) {
  const rows = await supabaseSelect<UserRow>(config(), usersTable, new URLSearchParams({ select: userColumns, email: `eq.${email}`, limit: "2" }));
  if (rows.length > 1) throw new ClientWorkspaceAdminError("This email has conflicting LevyTate memberships. Resolve access before continuing.", 409);
  return rows[0] ?? null;
}

async function ensureAuthUser(email: string) {
  let existing: AuthUser | null;
  try { existing = await findAuthIdentityByEmail(email, authRequest); }
  catch { throw new ClientWorkspaceAdminError("The authentication directory could not be checked.", 503); }
  if (existing) return { user: existing, created: false };
  const created = await authRequest("admin/users", { method: "POST", body: JSON.stringify({ email, email_confirm: false }) });
  if (!created.ok) throw new ClientWorkspaceAdminError("The passwordless authentication identity could not be prepared.", 503);
  return { user: await created.json() as AuthUser, created: true };
}

async function authRequest(path: string, init: RequestInit = {}) {
  const value = config();
  return fetch(`${value.url}/auth/v1/${path}`, { ...init, headers: { apikey: value.serviceRoleKey, Authorization: `Bearer ${value.serviceRoleKey}`, "Content-Type": "application/json", ...(init.headers ?? {}) }, cache: "no-store" });
}

async function audit(organisationId: string, actorEmail: string, action: string, entityId: string, summary: string, actorRole = "Platform Admin") {
  await supabaseInsert(config(), "levytate_audit_events", [{ id: randomUUID(), organisation_id: organisationId, actor_email: actorEmail, actor_role: actorRole, entity_type: "client_workspace", entity_id: entityId, action, summary, metadata: {}, created_at: new Date().toISOString() }]);
}

async function toSummary(organisation: OrganisationRow, users: UserRow[]): Promise<ClientWorkspaceSummary> {
  return { id: organisation.id, name: organisation.name, slug: organisation.slug, workspaceName: organisation.workspace_name, status: organisation.status, createdAt: organisation.created_at, users: await Promise.all(users.map(summariseUser)) };
}

async function summariseUser(user: UserRow): Promise<ClientWorkspaceUser> {
  let deliveryStatus = "not_requested";
  if (user.invitation_request_reference) {
    try { deliveryStatus = (await getAuthenticationDeliveryStatus(user.invitation_request_reference)).status; }
    catch { deliveryStatus = "unavailable"; }
  }
  return { id: user.id, email: user.email, displayName: user.display_name, role: normaliseMvpUserRole(user.role), active: user.active, authBindingStatus: user.auth_binding_status,
    invitationStatus: invitationDisplayState(user), invitationExpiresAt: user.invitation_expires_at, invitationGeneration: user.invitation_generation, deliveryStatus };
}

async function requireWorkspaceManager(session: LevyTateBetaSession) {
  const context = await getLearnerLifecycleServerContext(session);
  if (!["Platform Admin", "Employer Admin", "Apprenticeship Lead"].includes(context.user.role)) throw new ClientWorkspaceAdminError("You cannot manage workspace access.", 403);
  return context;
}

type ManagerContext = Awaited<ReturnType<typeof requireWorkspaceManager>>;
function assertManagedScope(actor: ManagerContext, organisationId: string, role: string) {
  if (role === "Platform Admin") throw new ClientWorkspaceAdminError("Platform administrator access is not managed through employer invitations.", 403);
  if (actor.user.role === "Platform Admin") return;
  if (actor.organisation.id !== organisationId || role === "Platform Admin") throw new ClientWorkspaceAdminError("The workspace user was not found.", 404);
  if (actor.user.role === "Apprenticeship Lead" && role === "Employer Admin") throw new ClientWorkspaceAdminError("Only Employer Admin can manage administrator access.", 403);
}

async function managedUser(actor: ManagerContext, userId: string) {
  const query = new URLSearchParams({ select: userColumns, id: `eq.${userId}`, limit: "2" });
  if (actor.user.role !== "Platform Admin") query.set("organisation_id", `eq.${actor.organisation.id}`);
  const rows = await supabaseSelect<UserRow>(config(), usersTable, query);
  if (rows.length !== 1) throw new ClientWorkspaceAdminError("The workspace user was not found.", 404);
  assertManagedScope(actor, rows[0].organisation_id, rows[0].role);
  return rows[0];
}

export async function listWorkspaceUsers(session: LevyTateBetaSession) {
  const actor = await requireWorkspaceManager(session);
  if (actor.user.role === "Platform Admin") throw new ClientWorkspaceAdminError("Use client workspace administration to choose an employer.", 403);
  const rows = await supabaseSelectAll<UserRow>(config(), usersTable, new URLSearchParams({ select: userColumns, organisation_id: `eq.${actor.organisation.id}`, order: "display_name.asc,id.asc" }));
  return { organisationId: actor.organisation.id, users: await Promise.all(rows.map(summariseUser)), roles: actor.user.role === "Apprenticeship Lead" ? ["Employee", "Line Manager", "Apprenticeship Lead"] : [...employerRoles] };
}

/** Reserve one attempt durably before making the external send; retries reuse its result. */
export async function inviteClientWorkspaceUser(session: LevyTateBetaSession, input: { userId?: unknown; requestId?: unknown; expectedGeneration?: unknown }, redirectTo: string, request: Request) {
  const actor = await requireWorkspaceManager(session);
  const userId = requiredText(input.userId, "User", 80);
  const requestId = requiredText(input.requestId, "Invitation request", 80);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId)) throw new ClientWorkspaceAdminError("A valid invitation request is required.");
  const current = await managedUser(actor, userId);
  if (current.invitation_request_reference === requestId) return summariseUser(current);
  if (!Number.isSafeInteger(input.expectedGeneration) || input.expectedGeneration !== current.invitation_generation) throw new ClientWorkspaceAdminError("Access changed. Refresh the users before sending an invitation.", 409);
  if (current.invitation_status === "sending" && Date.parse(current.invitation_requested_at ?? "") > Date.now() - 120_000) throw new ClientWorkspaceAdminError("An invitation is already being sent. Refresh to check its outcome.", 409);
  if (!(await validateIdentityMembership({ ...current, active: true }))) throw new ClientWorkspaceAdminError("Create exactly one matching active People record before inviting this user.", 409);
  if (!(await checkMagicLinkRequestLimits(request, current.email)).allowed) throw new ClientWorkspaceAdminError("Please wait before sending another invitation.", 429);
  if (await shouldSuppressAuthenticationEmail(current.email)) throw new ClientWorkspaceAdminError("Delivery is suppressed for this address. Resolve the delivery failure before reinviting.", 409);
  await ensureAuthUser(current.email);
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  const generation = current.invitation_generation + 1;
  const claim = await supabaseUpdate<UserRow>(config(), usersTable, new URLSearchParams({ id: `eq.${current.id}`, organisation_id: `eq.${current.organisation_id}`, invitation_generation: `eq.${current.invitation_generation}` }).toString(), {
    invitation_generation: generation, invitation_status: "sending", invitation_request_reference: requestId,
    invitation_requested_at: now, invitation_expires_at: expiresAt, updated_at: now,
  });
  if (claim.length !== 1) throw new ClientWorkspaceAdminError("Another access change completed first. Refresh before retrying.", 409);
  let accepted = false;
  try {
    await recordAuthenticationEmailRequest(current.email, requestId);
    await audit(current.organisation_id, actor.user.email, "client_workspace.invitation_requested", current.id, "A controlled individual invitation was requested.", actor.user.role);
    const response = await authRequest(`otp?redirect_to=${encodeURIComponent(redirectTo)}`, { method: "POST", body: JSON.stringify({ email: current.email, create_user: false }) });
    accepted = response.ok;
    await recordAuthenticationEmailAccepted(current.email, requestId, accepted);
  } catch {
    accepted = false;
    // An unknown transport/evidence outcome must never be labelled delivered or retried automatically.
    await recordAuthenticationEmailAccepted(current.email, requestId, false).catch(() => undefined);
  }
  const saved = await supabaseUpdate<UserRow>(config(), usersTable, new URLSearchParams({ id: `eq.${current.id}`, organisation_id: `eq.${current.organisation_id}`, invitation_generation: `eq.${generation}`, invitation_request_reference: `eq.${requestId}`, invitation_status: "eq.sending" }).toString(), {
    invitation_status: accepted ? "accepted" : "failed", active: accepted || current.active, updated_at: new Date().toISOString(),
  });
  if (saved.length !== 1) throw new ClientWorkspaceAdminError("Access changed while the invitation was sending. Refresh to check its recorded outcome.", 409);
  await audit(current.organisation_id, actor.user.email, accepted ? "client_workspace.invitation_accepted" : "client_workspace.invitation_failed", current.id, accepted ? "Invitation accepted by authentication provider; inbox delivery is not yet confirmed." : "Invitation delivery could not be confirmed. No automatic resend was attempted.", actor.user.role);
  return summariseUser(saved[0]);
}

function config() { const value = getLevyTateSupabaseConfig(); if (!value) throw new ClientWorkspaceAdminError("Client workspace administration is unavailable.", 503); return value; }
function optionalText(value: unknown, max: number) { if (value !== undefined && typeof value !== "string") throw new ClientWorkspaceAdminError("Text fields must contain text."); const result = typeof value === "string" ? value.trim() : ""; if (result.length > max) throw new ClientWorkspaceAdminError(`Text fields must not exceed ${max} characters.`); return result; }
function requiredText(value: unknown, label: string, max: number) { const result = optionalText(value, max); if (!result) throw new ClientWorkspaceAdminError(`${label} is required.`); return result; }
function validEmail(value: unknown) { const email = normaliseBetaEmail(typeof value === "string" ? value : ""); if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ClientWorkspaceAdminError("A valid work email is required."); return email; }
function employerRole(value: unknown, fallback: MvpUserRole) { const role = parseMvpUserRole(value === undefined ? fallback : value); if (!role || !employerRoles.has(role)) throw new ClientWorkspaceAdminError("Choose a supported employer role."); return role; }
function slugify(value: string) { const slug = value.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 72); if (!slug) throw new ClientWorkspaceAdminError("Organisation name must contain letters or numbers."); return slug; }
