import { randomUUID } from "node:crypto";
import type { LevyTateBetaSession } from "@/lib/levytate/config/beta-access";
import { normaliseBetaEmail } from "@/lib/levytate/config/beta-access";
import { normaliseMvpUserRole, type MvpUserRole } from "@/lib/levytate/mvp/rbac";
import { getLearnerLifecycleServerContext } from "@/lib/server/levytate-learner-lifecycle";
import { getLevyTateSupabaseConfig, supabaseDelete, supabaseInsert, supabaseSelect, supabaseUpdate } from "@/lib/server/levytate-supabase";

const organisationsTable = "levytate_organisations";
const usersTable = "levytate_users";
const employerRoles = new Set<MvpUserRole>(["Employer Admin", "Apprenticeship Lead", "Line Manager", "Employee"]);

type OrganisationRow = { id: string; name: string; slug: string; workspace_name: string; primary_contact: string; contact_email: string; status: string; created_at: string; updated_at: string };
type UserRow = { id: string; organisation_id: string; email: string; role: MvpUserRole; access_level: string; display_name: string; active: boolean; auth_subject: string | null; auth_binding_status: string; created_at: string; updated_at: string };
type AuthUser = { id: string; email?: string };

export type ClientWorkspaceSummary = {
  id: string;
  name: string;
  slug: string;
  workspaceName: string;
  status: string;
  createdAt: string;
  users: Array<{ id: string; email: string; displayName: string; role: MvpUserRole; active: boolean; authBindingStatus: string }>;
};

export class ClientWorkspaceAdminError extends Error {
  constructor(message: string, public status = 400) { super(message); this.name = "ClientWorkspaceAdminError"; }
}

export async function listClientWorkspaces(session: LevyTateBetaSession) {
  await requirePlatformAdmin(session);
  const organisations = await supabaseSelect<OrganisationRow>(config(), organisationsTable, new URLSearchParams({ select: "id,name,slug,workspace_name,primary_contact,contact_email,status,created_at,updated_at", workspace_template: "eq.levytate-client-v1", order: "created_at.desc" }));
  const users = await supabaseSelect<UserRow>(config(), usersTable, new URLSearchParams({ select: "id,organisation_id,email,role,access_level,display_name,active,auth_subject,auth_binding_status,created_at,updated_at", order: "created_at.asc" }));
  return organisations.map((organisation) => toSummary(organisation, users.filter((user) => user.organisation_id === organisation.id)));
}

export async function createClientWorkspace(session: LevyTateBetaSession, input: { name?: unknown; workspaceName?: unknown; primaryContact?: unknown; contactEmail?: unknown; initialRole?: unknown }) {
  const actor = await requirePlatformAdmin(session);
  const name = requiredText(input.name, "Organisation name", 160);
  const workspaceName = optionalText(input.workspaceName, 160) || `${name} Apprenticeship Workspace`;
  const primaryContact = requiredText(input.primaryContact, "Primary contact", 160);
  const email = validEmail(input.contactEmail);
  const initialRole = employerRole(input.initialRole, "Apprenticeship Lead");
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
  const actor = await requirePlatformAdmin(session);
  const organisationId = requiredText(input.organisationId, "Organisation", 80);
  const email = validEmail(input.email);
  const displayName = requiredText(input.displayName, "Display name", 160);
  const role = employerRole(input.role, "Employee");
  const organisation = (await supabaseSelect<OrganisationRow>(config(), organisationsTable, new URLSearchParams({ select: "id,name,slug,workspace_name,primary_contact,contact_email,status,created_at,updated_at", id: `eq.${organisationId}`, workspace_template: "eq.levytate-client-v1", status: "eq.Active", limit: "1" })))[0];
  if (!organisation) throw new ClientWorkspaceAdminError("The active client workspace was not found.", 404);
  if (await findMembership(email)) throw new ClientWorkspaceAdminError("This email already has LevyTate organisation access.", 409);
  const now = new Date().toISOString();
  const auth = await ensureAuthUser(email);
  try {
    const row = membershipRow(organisation.id, email, displayName, role, now);
    await supabaseInsert<UserRow>(config(), usersTable, [row]);
    await audit(organisation.id, actor.user.email, "client_workspace.user_provisioned", row.id, `Client workspace user provisioned as ${role}.`);
    return { id: row.id, email: row.email, displayName: row.display_name, role: row.role, active: row.active, authBindingStatus: row.auth_binding_status };
  } catch (error) {
    if (auth.created) await authRequest(`admin/users/${encodeURIComponent(auth.user.id)}`, { method: "DELETE" }).catch(() => undefined);
    throw error;
  }
}

export async function updateClientWorkspaceUser(session: LevyTateBetaSession, input: { userId?: unknown; role?: unknown; active?: unknown }) {
  const actor = await requirePlatformAdmin(session);
  const userId = requiredText(input.userId, "User", 80);
  const current = (await supabaseSelect<UserRow>(config(), usersTable, new URLSearchParams({ select: "id,organisation_id,email,role,access_level,display_name,active,auth_subject,auth_binding_status,created_at,updated_at", id: `eq.${userId}`, limit: "1" })))[0];
  if (!current) throw new ClientWorkspaceAdminError("The client workspace user was not found.", 404);
  const organisation = (await supabaseSelect<{ id: string }>(config(), organisationsTable, new URLSearchParams({ select: "id", id: `eq.${current.organisation_id}`, workspace_template: "eq.levytate-client-v1", limit: "1" })))[0];
  if (!organisation) throw new ClientWorkspaceAdminError("The client workspace user was not found.", 404);
  const role = input.role === undefined ? current.role : employerRole(input.role, current.role);
  const active = typeof input.active === "boolean" ? input.active : current.active;
  const updated = (await supabaseUpdate<UserRow>(config(), usersTable, `id=eq.${encodeURIComponent(userId)}&organisation_id=eq.${current.organisation_id}`, { role, active, updated_at: new Date().toISOString() }))[0];
  if (!updated) throw new ClientWorkspaceAdminError("The client workspace user could not be updated.", 409);
  await audit(current.organisation_id, actor.user.email, active ? "client_workspace.user_updated" : "client_workspace.user_revoked", userId, `Client workspace user set to ${role} and ${active ? "active" : "inactive"}.`);
  return { id: updated.id, email: updated.email, displayName: updated.display_name, role: normaliseMvpUserRole(updated.role), active: updated.active, authBindingStatus: updated.auth_binding_status };
}

function membershipRow(organisationId: string, email: string, displayName: string, role: MvpUserRole, now: string): UserRow {
  return { id: randomUUID(), organisation_id: organisationId, email, role, access_level: "beta_user", display_name: displayName, active: true, auth_subject: null, auth_binding_status: "pending", created_at: now, updated_at: now };
}

async function requirePlatformAdmin(session: LevyTateBetaSession) {
  const context = await getLearnerLifecycleServerContext(session);
  if (normaliseMvpUserRole(context.user.role) !== "Platform Admin") throw new ClientWorkspaceAdminError("Only Platform Admin can manage client workspaces.", 403);
  return context;
}

async function findMembership(email: string) {
  return (await supabaseSelect<UserRow>(config(), usersTable, new URLSearchParams({ select: "id,organisation_id,email,role,access_level,display_name,active,auth_subject,auth_binding_status,created_at,updated_at", email: `eq.${email}`, limit: "1" })))[0] ?? null;
}

async function ensureAuthUser(email: string) {
  const response = await authRequest("admin/users?page=1&per_page=1000");
  if (!response.ok) throw new ClientWorkspaceAdminError("The authentication directory could not be checked.", 503);
  const payload = await response.json() as { users?: AuthUser[] };
  const existing = payload.users?.find((user) => normaliseBetaEmail(user.email ?? "") === email);
  if (existing) return { user: existing, created: false };
  const created = await authRequest("admin/users", { method: "POST", body: JSON.stringify({ email, email_confirm: true, user_metadata: { levytate_client_access: true } }) });
  if (!created.ok) throw new ClientWorkspaceAdminError("The passwordless authentication identity could not be prepared.", 503);
  return { user: await created.json() as AuthUser, created: true };
}

async function authRequest(path: string, init: RequestInit = {}) {
  const value = config();
  return fetch(`${value.url}/auth/v1/${path}`, { ...init, headers: { apikey: value.serviceRoleKey, Authorization: `Bearer ${value.serviceRoleKey}`, "Content-Type": "application/json", ...(init.headers ?? {}) }, cache: "no-store" });
}

async function audit(organisationId: string, actorEmail: string, action: string, entityId: string, summary: string) {
  await supabaseInsert(config(), "levytate_audit_events", [{ id: randomUUID(), organisation_id: organisationId, actor_email: actorEmail, actor_role: "Platform Admin", entity_type: "client_workspace", entity_id: entityId, action, summary, metadata: {}, created_at: new Date().toISOString() }]);
}

function toSummary(organisation: OrganisationRow, users: UserRow[]): ClientWorkspaceSummary {
  return { id: organisation.id, name: organisation.name, slug: organisation.slug, workspaceName: organisation.workspace_name, status: organisation.status, createdAt: organisation.created_at, users: users.map((user) => ({ id: user.id, email: user.email, displayName: user.display_name, role: normaliseMvpUserRole(user.role), active: user.active, authBindingStatus: user.auth_binding_status })) };
}

function config() { const value = getLevyTateSupabaseConfig(); if (!value) throw new ClientWorkspaceAdminError("Client workspace administration is unavailable.", 503); return value; }
function optionalText(value: unknown, max: number) { return typeof value === "string" ? value.trim().slice(0, max) : ""; }
function requiredText(value: unknown, label: string, max: number) { const result = optionalText(value, max); if (!result) throw new ClientWorkspaceAdminError(`${label} is required.`); return result; }
function validEmail(value: unknown) { const email = normaliseBetaEmail(typeof value === "string" ? value : ""); if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ClientWorkspaceAdminError("A valid work email is required."); return email; }
function employerRole(value: unknown, fallback: MvpUserRole) { const role = normaliseMvpUserRole(typeof value === "string" ? value : fallback); if (!employerRoles.has(role)) throw new ClientWorkspaceAdminError("Choose a supported employer role."); return role; }
function slugify(value: string) { const slug = value.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 72); if (!slug) throw new ClientWorkspaceAdminError("Organisation name must contain letters or numbers."); return slug; }
