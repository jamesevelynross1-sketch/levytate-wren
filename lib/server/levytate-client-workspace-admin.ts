import type { LevyTateBetaSession } from "@/lib/levytate/config/beta-access";
import { normaliseBetaEmail } from "@/lib/levytate/config/beta-access";
import { normaliseMvpUserRole, parseMvpUserRole, type MvpUserRole } from "@/lib/levytate/mvp/rbac";
import { findAuthIdentityByEmail } from "@/lib/server/levytate-auth-directory";
import { validateIdentityMembership } from "@/lib/server/levytate-identity-policy";
import { invitationDisplayState, type ClientInvitationFields } from "@/lib/levytate/mvp/invitations";
import { getAuthenticationDeliveryStatus, getAuthenticationSendOutcome, recordAuthenticationEmailAccepted, recordAuthenticationEmailRequest, shouldSuppressAuthenticationEmail } from "@/lib/server/levytate-auth-email-delivery";
import { checkMagicLinkRequestLimits } from "@/lib/server/levytate-auth-rate-limit";
import { getLearnerLifecycleServerContext } from "@/lib/server/levytate-learner-lifecycle";
import { getLevyTateSupabaseConfig, supabaseFetchJson, supabaseSelect, supabaseSelectAll } from "@/lib/server/levytate-supabase";

const organisationsTable = "levytate_organisations";
const usersTable = "levytate_users";
const employerRoles = new Set<MvpUserRole>(["Employer Admin", "Apprenticeship Lead", "Line Manager", "Employee"]);

type OrganisationRow = { id: string; name: string; slug: string; workspace_name: string; primary_contact: string; contact_email: string; status: string; created_at: string; updated_at: string };
type UserRow = ClientInvitationFields & { id: string; organisation_id: string; email: string; role: MvpUserRole; access_level: string; display_name: string; active: boolean; auth_subject: string | null; auth_binding_status: string; created_at: string; updated_at: string };
type AuthUser = { id: string; email?: string; email_confirmed_at?: string | null };
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

export async function createClientWorkspace(session: LevyTateBetaSession, input: { requestId?: unknown; name?: unknown; workspaceName?: unknown; primaryContact?: unknown; contactEmail?: unknown; initialRole?: unknown }) {
  const actor = await requireWorkspaceManager(session);
  const name = requiredText(input.name, "Organisation name", 160);
  const workspaceName = optionalText(input.workspaceName, 160) || `${name} Apprenticeship Workspace`.slice(0, 160);
  const primaryContact = requiredText(input.primaryContact, "Primary contact", 160);
  const email = validEmail(input.contactEmail);
  if (actor.user.role !== "Platform Admin") throw new ClientWorkspaceAdminError("Only Platform Admin can create client workspaces.", 403);
  const initialRole = employerRole(input.initialRole, "Apprenticeship Lead");
  if (initialRole !== "Employer Admin" && initialRole !== "Apprenticeship Lead") throw new ClientWorkspaceAdminError("The initial user must be an Apprenticeship Lead or Employer Admin.");
  const slug = slugify(name);
  const receipt = await accountCommand(actor.user.id, input.requestId, "create_workspace", { name, workspaceName, primaryContact, email, role: initialRole, slug });
  if (!receipt.organisation?.id || receipt.organisation.id !== receipt.user.organisation_id) throw new ClientWorkspaceAdminError("Workspace creation could not be confirmed. Retry the same request.", 503);
  return toSummary(receipt.organisation, [receipt.user]);
}

export async function provisionClientWorkspaceUser(session: LevyTateBetaSession, input: { requestId?: unknown; organisationId?: unknown; email?: unknown; displayName?: unknown; role?: unknown }) {
  const actor = await requireWorkspaceManager(session);
  const organisationId = requiredText(input.organisationId, "Organisation", 80);
  const email = validEmail(input.email);
  const displayName = requiredText(input.displayName, "Display name", 160);
  const role = employerRole(input.role, "Employee");
  assertManagedScope(actor, organisationId, role);
  const receipt = await accountCommand(actor.user.id, input.requestId, "provision_user", { organisationId, email, displayName, role });
  return summariseUser(receipt.user);
}

export async function updateClientWorkspaceUser(session: LevyTateBetaSession, input: { requestId?: unknown; expectedGeneration?: unknown; userId?: unknown; role?: unknown; active?: unknown }) {
  const actor = await requireWorkspaceManager(session);
  const userId = requiredText(input.userId, "User", 80);
  const current = await managedUser(actor, userId);
  if (!current) throw new ClientWorkspaceAdminError("The client workspace user was not found.", 404);
  const role = input.role === undefined ? current.role : employerRole(input.role, current.role);
  assertManagedScope(actor, current.organisation_id, role);
  if (current.id === actor.user.id && (role !== current.role || input.active === false)) throw new ClientWorkspaceAdminError("Ask another authorised administrator to change your own access.", 409);
  if (input.active !== undefined && typeof input.active !== "boolean") throw new ClientWorkspaceAdminError("Active must be true or false.");
  const active = typeof input.active === "boolean" ? input.active : current.active;
  if (!Number.isSafeInteger(input.expectedGeneration) || (input.expectedGeneration as number) < 0) throw new ClientWorkspaceAdminError("Refresh account access before editing. Your input has been kept.", 409);
  // Do not reject the old generation here: a lost successful response must reach
  // the database receipt before the compare-and-swap is evaluated.
  const receipt = await accountCommand(actor.user.id, input.requestId, "update_user", { userId, role, active, expectedGeneration: input.expectedGeneration });
  return summariseUser(receipt.user);
}

type AccountCommandReceipt = { requestId: string; command: string; organisation?: OrganisationRow; user: UserRow };
async function accountCommand(actorId: string, request: unknown, command: string, payload: Record<string, unknown>) {
  const requestId = requiredText(request, "Request identifier", 80);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId)) throw new ClientWorkspaceAdminError("A valid request identifier is required.");
  try {
    const receipt = await supabaseFetchJson<AccountCommandReceipt>(config(), "rpc/levytate_client_admin_command", { method: "POST", body: JSON.stringify({ p_actor_user_id: actorId, p_request_id: requestId, p_command: command, p_payload: payload }) });
    if (receipt?.requestId !== requestId || receipt.command !== command || !receipt.user?.id || !parseMvpUserRole(receipt.user.role)) throw new ClientWorkspaceAdminError("The account save could not be confirmed. Retry the same request.", 503);
    return receipt;
  } catch (error) {
    if (error instanceof ClientWorkspaceAdminError) throw error;
    const code = error instanceof Error ? error.message : "";
    if (/^(PT403|42501)/.test(code)) throw new ClientWorkspaceAdminError("You cannot make this account change.", 403);
    if (code.startsWith("PT404")) throw new ClientWorkspaceAdminError("The active workspace account was not found.", 404);
    if (/^(PT409|23505|40001|40P01)/.test(code)) throw new ClientWorkspaceAdminError("Account access changed, the address is already in use, or the People linkage does not match. Refresh before changing the request.", 409);
    if (/^(PT422|23514|23503|22)/.test(code)) throw new ClientWorkspaceAdminError("Check the account details. No partial account change was applied.", 422);
    throw new ClientWorkspaceAdminError("The account save could not be confirmed. Keep your input and retry the same request.", 503);
  }
}

async function requirePlatformAdmin(session: LevyTateBetaSession) {
  const context = await getLearnerLifecycleServerContext(session);
  if (normaliseMvpUserRole(context.user.role) !== "Platform Admin") throw new ClientWorkspaceAdminError("Only Platform Admin can manage client workspaces.", 403);
  return context;
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
  if (current.invitation_request_reference === requestId) {
    if (current.invitation_status === "sending") {
      const outcome = await getAuthenticationSendOutcome(current.email, requestId);
      if (outcome !== null) return summariseUser((await invitationCommand(actor.user.id, current.id, requestId, current.invitation_generation, "finish", outcome)).user);
    }
    return summariseUser(current);
  }
  if (!Number.isSafeInteger(input.expectedGeneration) || input.expectedGeneration !== current.invitation_generation) throw new ClientWorkspaceAdminError("Access changed. Refresh the users before sending an invitation.", 409);
  if (current.invitation_status === "sending" && Date.parse(current.invitation_requested_at ?? "") > Date.now() - 120_000) throw new ClientWorkspaceAdminError("An invitation is already being sent. Refresh to check its outcome.", 409);
  if (!(await validateIdentityMembership({ ...current, active: true }))) throw new ClientWorkspaceAdminError("Create exactly one matching active People record before inviting this user.", 409);
  if (!(await checkMagicLinkRequestLimits(request, current.email)).allowed) throw new ClientWorkspaceAdminError("Please wait before sending another invitation.", 429);
  if (await shouldSuppressAuthenticationEmail(current.email)) throw new ClientWorkspaceAdminError("Delivery is suppressed for this address. Resolve the delivery failure before reinviting.", 409);
  const claim = await invitationCommand(actor.user.id, current.id, requestId, current.invitation_generation, "reserve");
  if (!claim.sendAllowed) return summariseUser(claim.user);
  let accepted = false;
  try {
    const auth = await ensureAuthUser(current.email);
    await recordAuthenticationEmailRequest(current.email, requestId);
    // Closed registration must stay closed. GoTrue's public OTP route treats an
    // unconfirmed identity as signup even when create_user=false; the admin invite
    // route is the supported way to verify that invited identity's first email.
    const confirmed = Boolean(auth.user.email_confirmed_at);
    const response = await authRequest(`${confirmed ? "otp" : "invite"}?redirect_to=${encodeURIComponent(redirectTo)}`, { method: "POST", body: JSON.stringify({ email: current.email, ...(confirmed ? { create_user: false } : {}) }) });
    accepted = response.ok;
    await recordAuthenticationEmailAccepted(current.email, requestId, accepted);
  } catch {
    accepted = false;
    // An unknown transport/evidence outcome must never be labelled delivered or retried automatically.
    await recordAuthenticationEmailAccepted(current.email, requestId, false).catch(() => undefined);
  }
  const saved = await invitationCommand(actor.user.id, current.id, requestId, claim.user.invitation_generation, "finish", accepted);
  return summariseUser(saved.user);
}

async function invitationCommand(actorId: string, userId: string, requestId: string, generation: number, phase: "reserve" | "finish", accepted: boolean | null = null) {
  try {
    const result = await supabaseFetchJson<{ user: UserRow; sendAllowed: boolean }>(config(), "rpc/levytate_client_invitation_command", { method: "POST", body: JSON.stringify({ p_actor_user_id: actorId, p_user_id: userId, p_request_id: requestId, p_expected_generation: generation, p_phase: phase, p_accepted: accepted }) });
    if (result?.user?.id !== userId || result.user.invitation_request_reference !== requestId || typeof result.sendAllowed !== "boolean") throw new ClientWorkspaceAdminError("Invitation outcome could not be confirmed. Retry the same request; do not send another automatically.", 503);
    return result;
  } catch (error) {
    if (error instanceof ClientWorkspaceAdminError) throw error;
    const code = error instanceof Error ? error.message : "";
    if (/^(PT403|42501)/.test(code)) throw new ClientWorkspaceAdminError("You cannot manage this invitation.", 403);
    if (code.startsWith("PT404")) throw new ClientWorkspaceAdminError("The invitation account was not found.", 404);
    if (/^(PT409|23505|40001|40P01)/.test(code)) throw new ClientWorkspaceAdminError("Access changed while this invitation was being processed. Refresh to check its recorded outcome.", 409);
    throw new ClientWorkspaceAdminError("Invitation outcome could not be confirmed. Retry the same request; no automatic resend will occur.", 503);
  }
}

function config() { const value = getLevyTateSupabaseConfig(); if (!value) throw new ClientWorkspaceAdminError("Client workspace administration is unavailable.", 503); return value; }
function optionalText(value: unknown, max: number) { if (value !== undefined && typeof value !== "string") throw new ClientWorkspaceAdminError("Text fields must contain text."); const result = typeof value === "string" ? value.trim() : ""; if (result.length > max) throw new ClientWorkspaceAdminError(`Text fields must not exceed ${max} characters.`); return result; }
function requiredText(value: unknown, label: string, max: number) { const result = optionalText(value, max); if (!result) throw new ClientWorkspaceAdminError(`${label} is required.`); return result; }
function validEmail(value: unknown) { const email = normaliseBetaEmail(typeof value === "string" ? value : ""); if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ClientWorkspaceAdminError("A valid work email is required."); return email; }
function employerRole(value: unknown, fallback: MvpUserRole) { const role = parseMvpUserRole(value === undefined ? fallback : value); if (!role || !employerRoles.has(role)) throw new ClientWorkspaceAdminError("Choose a supported employer role."); return role; }
function slugify(value: string) { const slug = value.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 72); if (!slug) throw new ClientWorkspaceAdminError("Organisation name must contain letters or numbers."); return slug; }
