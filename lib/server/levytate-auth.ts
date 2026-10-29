import { randomUUID } from "node:crypto";
import { createLevyTateBetaSession, normaliseBetaEmail, type LevyTateBetaAccessLevel, type LevyTateBetaSession } from "@/lib/levytate/config/beta-access";
import { parseMvpUserRole } from "@/lib/levytate/mvp/rbac";
import { validateIdentityMembership } from "@/lib/server/levytate-identity-policy";
import { invitationAllowsActivation, type ClientInvitationFields } from "@/lib/levytate/mvp/invitations";
import { getLevyTateSupabaseConfig, supabaseInsert, supabaseSelect, supabaseUpdate } from "@/lib/server/levytate-supabase";
import { checkProspectSessionAccess } from "@/lib/server/levytate-prospect-access";
import { recordAuthenticationEmailAccepted, recordAuthenticationEmailRequest, shouldSuppressAuthenticationEmail } from "@/lib/server/levytate-auth-email-delivery";

export const levytateSupabaseAccessCookie = "levytate_auth_access";
export const levytateSupabaseRefreshCookie = "levytate_auth_refresh";
export const levytateAuthCookieMaxAge = 60 * 60 * 8;
export const genericSignInRequestMessage = "If this email is authorised for LevyTate, you’ll receive a secure sign-in link.";

type MembershipRow = Partial<ClientInvitationFields> & { id: string; organisation_id: string; email: string; role: string; access_level: string; active: boolean; auth_subject: string | null; auth_binding_status?: string; auth_bound_at?: string | null; };
const membershipColumns = "id,organisation_id,email,role,access_level,active,auth_subject,auth_binding_status,auth_bound_at,invitation_status,invitation_expires_at,invitation_generation";
type AuthUser = { id: string; email?: string };
type AuthSessionResponse = { access_token: string; refresh_token: string; expires_in?: number; user: AuthUser };
export type EmployerLogoutResult = { attempted: boolean; invalidated: boolean };

export class LevyTateAuthError extends Error {
  constructor(public code: "invalid_link" | "unauthorised" | "inactive" | "conflict" | "configuration", message: string, public status = 403) { super(message); this.name = "LevyTateAuthError"; }
}

function config() {
  const value = getLevyTateSupabaseConfig();
  if (!value) throw new LevyTateAuthError("configuration", "Authentication is unavailable.", 503);
  return value;
}

async function authFetch(path: string, init: RequestInit = {}) {
  const value = config();
  return fetch(`${value.url}/auth/v1/${path}`, { ...init, headers: { apikey: value.serviceRoleKey, Authorization: `Bearer ${value.serviceRoleKey}`, "Content-Type": "application/json", ...(init.headers ?? {}) }, cache: "no-store" });
}

export async function requestEmployerSignIn(emailInput: string, redirectTo: string) {
  const email = normaliseBetaEmail(emailInput);
  const membership = await findMembershipByEmail(email);
  await audit(membership, email, "auth.sign_in_requested", "requested");
  if (!membership || !invitationAllowsActivation(membership) || !(await validateIdentityMembership(membership)) || !(await checkProspectSessionAccess(email))) return;
  if (await shouldSuppressAuthenticationEmail(email)) {
    await audit(membership, email, "auth.email_delivery_suppressed", "safe_suppression_active");
    return;
  }
  let requestReference: string | null = null;
  try {
    requestReference = await recordAuthenticationEmailRequest(email);
  } catch {
    console.error("LevyTate authentication delivery evidence unavailable", { outcome: "request_not_recorded" });
  }
  try {
    const response = await authFetch(`otp?redirect_to=${encodeURIComponent(redirectTo)}`, { method: "POST", body: JSON.stringify({ email, create_user: false, gotrue_meta_security: { captcha_token: undefined } }) });
    if (requestReference) {
      try { await recordAuthenticationEmailAccepted(email, requestReference, response.ok); }
      catch { console.error("LevyTate authentication delivery evidence unavailable", { outcome: "acceptance_not_recorded" }); }
    }
    await audit(membership, email, response.ok ? "auth.email_delivery_accepted" : "auth.email_delivery_failed", response.ok ? "accepted_by_provider" : "delivery_not_started");
  } catch (error) {
    if (requestReference) {
      try { await recordAuthenticationEmailAccepted(email, requestReference, false); }
      catch { console.error("LevyTate authentication delivery evidence unavailable", { outcome: "failure_not_recorded" }); }
    }
    await audit(membership, email, "auth.email_delivery_failed", "provider_unavailable");
    throw error;
  }
}

export async function verifyEmployerMagicLink(tokenHash: string, type: string) {
  if (!tokenHash || !["email", "magiclink", "signup"].includes(type)) throw new LevyTateAuthError("invalid_link", "This sign-in link is invalid or has expired.", 400);
  const response = await authFetch("verify", { method: "POST", body: JSON.stringify({ token_hash: tokenHash, type }) });
  if (!response.ok) throw new LevyTateAuthError("invalid_link", "This sign-in link is invalid or has expired.", 401);
  const auth = await response.json() as AuthSessionResponse;
  return bindVerifiedIdentity(auth);
}

export async function refreshEmployerAuth(refreshToken: string, session: LevyTateBetaSession) {
  if (!session || session.authMode !== "supabase_email" || session.expiresAt <= Date.now() || !(await revalidateEmployerSession(session))) {
    throw new LevyTateAuthError("unauthorised", "Your session has ended. Sign in again to continue.", 401);
  }
  const response = await authFetch("token?grant_type=refresh_token", { method: "POST", body: JSON.stringify({ refresh_token: refreshToken }) });
  if (!response.ok) throw new LevyTateAuthError("invalid_link", "Your session has ended. Sign in again to continue.", 401);
  return bindVerifiedIdentity(await response.json() as AuthSessionResponse, session);
}

export async function invalidateEmployerAuthSession(accessToken?: string, refreshToken?: string): Promise<EmployerLogoutResult> {
  if (!accessToken && !refreshToken) return { attempted: false, invalidated: true };
  let currentAccessToken = accessToken;
  if (!currentAccessToken && refreshToken) currentAccessToken = (await exchangeRefreshToken(refreshToken)) ?? undefined;

  if (currentAccessToken && await revokeCurrentSession(currentAccessToken)) {
    return { attempted: true, invalidated: true };
  }

  if (refreshToken) {
    currentAccessToken = (await exchangeRefreshToken(refreshToken)) ?? undefined;
    if (currentAccessToken && await revokeCurrentSession(currentAccessToken)) {
      return { attempted: true, invalidated: true };
    }
  }

  return { attempted: true, invalidated: false };
}

export async function recordEmployerLogoutEvent(session: LevyTateBetaSession, action: string, outcome: string) {
  const membership = session.authSubject
    ? await findMembershipBySubject(session.authSubject)
    : await findMembershipByEmail(session.email);
  await audit(membership, session.email, action, outcome);
}

async function exchangeRefreshToken(refreshToken: string) {
  const response = await authFetch("token?grant_type=refresh_token", { method: "POST", body: JSON.stringify({ refresh_token: refreshToken }) });
  if (!response.ok) return null;
  const body = await response.json() as Partial<AuthSessionResponse>;
  return typeof body.access_token === "string" ? body.access_token : null;
}

async function revokeCurrentSession(accessToken: string) {
  const response = await authFetch("logout?scope=local", { method: "POST", headers: { Authorization: `Bearer ${accessToken}` } });
  return response.ok;
}

async function bindVerifiedIdentity(auth: AuthSessionResponse, refreshingSession?: LevyTateBetaSession) {
  const email = normaliseBetaEmail(auth.user.email ?? "");
  if (!email || !auth.user.id) throw new LevyTateAuthError("unauthorised", "This email is not currently authorised for LevyTate.");
  const membership = await findMembershipByEmail(email);
  if (!membership) throw new LevyTateAuthError("unauthorised", "This email is not currently authorised for LevyTate.");
  if (!membership.active) throw new LevyTateAuthError("inactive", "Your LevyTate account is not currently active.");
  if (refreshingSession && (refreshingSession.authSubject !== auth.user.id || refreshingSession.email !== email || membership.auth_subject !== auth.user.id || membership.auth_binding_status !== "bound" || (membership.auth_bound_at && Date.parse(membership.auth_bound_at) > refreshingSession.issuedAt))) {
    throw new LevyTateAuthError("unauthorised", "Your session has ended. Sign in again to continue.", 401);
  }
  if (!invitationAllowsActivation(membership)) throw new LevyTateAuthError("unauthorised", "This invitation is not active. Ask your Apprenticeship Lead to send a new invitation.");
  const identity = await validateIdentityMembership(membership);
  if (!identity) throw new LevyTateAuthError("unauthorised", "This email is not currently authorised for LevyTate.");
  if (membership.auth_subject && membership.auth_subject !== auth.user.id) throw new LevyTateAuthError("conflict", "This email is not currently authorised for LevyTate.");
  const subjectOwners = await supabaseSelect<MembershipRow>(config(), "levytate_users", new URLSearchParams({ select: "id", auth_subject: `eq.${auth.user.id}`, limit: "2" }));
  if (subjectOwners.length > 1 || subjectOwners.some((owner) => owner.id !== membership.id)) throw new LevyTateAuthError("conflict", "This email is not currently authorised for LevyTate.");
  const now = new Date().toISOString();
  const bindingQuery = new URLSearchParams({
    id: `eq.${membership.id}`, organisation_id: `eq.${membership.organisation_id}`, email: `eq.${email}`,
    active: "eq.true", role: `eq.${membership.role}`,
    auth_subject: membership.auth_subject ? `eq.${membership.auth_subject}` : "is.null",
  });
  if (membership.auth_binding_status !== "bound") {
    bindingQuery.set("invitation_status", "eq.accepted");
    bindingQuery.set("invitation_generation", `eq.${membership.invitation_generation}`);
    bindingQuery.set("invitation_expires_at", `gt.${now}`);
  }
  const saved = await supabaseUpdate<MembershipRow>(config(), "levytate_users", bindingQuery.toString(), { auth_subject: auth.user.id, auth_binding_status: "bound", auth_bound_at: membership.auth_subject ? membership.auth_bound_at ?? now : now, ...(membership.auth_binding_status !== "bound" ? { invitation_status: "consumed" } : {}), last_authentication_at: now, last_login_at: now, updated_at: now });
  if (saved.length !== 1 || saved[0].auth_subject !== auth.user.id || !saved[0].active || !(await validateIdentityMembership(saved[0]))) {
    throw new LevyTateAuthError("conflict", "This email is not currently authorised for LevyTate.");
  }
  const accessLevel: LevyTateBetaAccessLevel = identity.role === "Platform Admin" ? "beta_admin" : "beta_user";
  const sessionToken = await createLevyTateBetaSession(email, accessLevel, { authMode: "supabase_email", authSubject: auth.user.id });
  try {
    await audit(membership, email, "auth.email_identity_verified", "verified");
    if (!membership.auth_subject) await audit(membership, email, "auth.identity_bound", "successful");
    await audit(membership, email, "auth.sign_in_successful", "successful");
  } catch {
    // Binding is already confirmed. An audit outage must not consume the one-use
    // link and then report a false invalid-link outcome to an authenticated user.
    console.error("LevyTate authentication audit unavailable", { outcome: "identity_bound_audit_unavailable" });
  }
  return { ...auth, sessionToken, membership };
}

export async function revalidateEmployerSession(session: LevyTateBetaSession): Promise<LevyTateBetaSession | null> {
  if (session.authMode !== "supabase_email") return session;
  const membership = await findMembershipBySubject(session.authSubject ?? "");
  if (!membership || !membership.active || membership.auth_binding_status !== "bound" || normaliseBetaEmail(membership.email) !== session.email) return null;
  if (membership.auth_bound_at && Date.parse(membership.auth_bound_at) > session.issuedAt) return null;
  if (!(await validateIdentityMembership(membership))) return null;
  const accessLevel: LevyTateBetaAccessLevel = parseMvpUserRole(membership.role) === "Platform Admin" ? "beta_admin" : "beta_user";
  return { ...session, accessLevel };
}

async function findMembershipByEmail(email: string) {
  const rows = await supabaseSelect<MembershipRow>(config(), "levytate_users", new URLSearchParams({ select: membershipColumns, email: `eq.${email}`, limit: "2" }));
  return rows.length === 1 ? rows[0] : null;
}
async function findMembershipBySubject(subject: string) {
  if (!subject) return null;
  const rows = await supabaseSelect<MembershipRow>(config(), "levytate_users", new URLSearchParams({ select: membershipColumns, auth_subject: `eq.${subject}`, limit: "2" }));
  return rows.length === 1 ? rows[0] : null;
}
async function audit(membership: MembershipRow | null, email: string, action: string, outcome: string) {
  if (!membership) return;
  await supabaseInsert(config(), "levytate_audit_events", [{ id: randomUUID(), organisation_id: membership.organisation_id, actor_email: email, actor_role: membership.role, entity_type: "authentication", entity_id: membership.id, action, summary: action.replaceAll("_", " "), metadata: { outcome }, created_at: new Date().toISOString() }]);
}
