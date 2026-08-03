import { randomUUID } from "node:crypto";
import { createLevyTateBetaSession, normaliseBetaEmail, type LevyTateBetaAccessLevel, type LevyTateBetaSession } from "@/lib/levytate/config/beta-access";
import { normaliseMvpUserRole } from "@/lib/levytate/mvp/rbac";
import { getLevyTateSupabaseConfig, supabaseInsert, supabaseSelect, supabaseUpdate } from "@/lib/server/levytate-supabase";
import { checkProspectSessionAccess } from "@/lib/server/levytate-prospect-access";

export const levytateSupabaseAccessCookie = "levytate_auth_access";
export const levytateSupabaseRefreshCookie = "levytate_auth_refresh";
export const levytateAuthCookieMaxAge = 60 * 60 * 8;
export const genericSignInRequestMessage = "If this email is authorised for LevyTate, you’ll receive a secure sign-in link.";

type MembershipRow = { id: string; organisation_id: string; email: string; role: string; access_level: string; active: boolean; auth_subject: string | null; auth_binding_status?: string; };
type AuthUser = { id: string; email?: string };
type AuthSessionResponse = { access_token: string; refresh_token: string; expires_in?: number; user: AuthUser };

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
  if (!membership?.active || !(await checkProspectSessionAccess(email))) return;
  try {
    const response = await authFetch(`otp?redirect_to=${encodeURIComponent(redirectTo)}`, { method: "POST", body: JSON.stringify({ email, create_user: false, gotrue_meta_security: { captcha_token: undefined } }) });
    await audit(membership, email, response.ok ? "auth.email_delivery_accepted" : "auth.email_delivery_failed", response.ok ? "accepted_by_provider" : "delivery_not_started");
  } catch (error) {
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

export async function refreshEmployerAuth(refreshToken: string) {
  const response = await authFetch("token?grant_type=refresh_token", { method: "POST", body: JSON.stringify({ refresh_token: refreshToken }) });
  if (!response.ok) throw new LevyTateAuthError("invalid_link", "Your session has ended. Sign in again to continue.", 401);
  return bindVerifiedIdentity(await response.json() as AuthSessionResponse);
}

async function bindVerifiedIdentity(auth: AuthSessionResponse) {
  const email = normaliseBetaEmail(auth.user.email ?? "");
  if (!email || !auth.user.id) throw new LevyTateAuthError("unauthorised", "This email is not currently authorised for LevyTate.");
  const membership = await findMembershipByEmail(email);
  if (!membership) throw new LevyTateAuthError("unauthorised", "This email is not currently authorised for LevyTate.");
  if (!membership.active) throw new LevyTateAuthError("inactive", "Your LevyTate account is not currently active.");
  if (membership.auth_subject && membership.auth_subject !== auth.user.id) throw new LevyTateAuthError("conflict", "This email is not currently authorised for LevyTate.");
  const subjectOwner = await findMembershipBySubject(auth.user.id);
  if (subjectOwner && subjectOwner.id !== membership.id) throw new LevyTateAuthError("conflict", "This email is not currently authorised for LevyTate.");
  const now = new Date().toISOString();
  await supabaseUpdate(config(), "levytate_users", `id=eq.${encodeURIComponent(membership.id)}`, { auth_subject: auth.user.id, auth_binding_status: "bound", auth_bound_at: membership.auth_subject ? undefined : now, last_authentication_at: now, last_login_at: now, updated_at: now });
  const accessLevel: LevyTateBetaAccessLevel = normaliseMvpUserRole(membership.role) === "Platform Admin" ? "beta_admin" : "beta_user";
  const sessionToken = await createLevyTateBetaSession(email, accessLevel, { authMode: "supabase_email", authSubject: auth.user.id });
  await audit(membership, email, "auth.email_identity_verified", "verified");
  if (!membership.auth_subject) await audit(membership, email, "auth.identity_bound", "successful");
  await audit(membership, email, "auth.sign_in_successful", "successful");
  return { ...auth, sessionToken, membership };
}

export async function revalidateEmployerSession(session: LevyTateBetaSession): Promise<LevyTateBetaSession | null> {
  if (session.authMode !== "supabase_email") return session;
  const membership = await findMembershipBySubject(session.authSubject ?? "");
  if (!membership || !membership.active || normaliseBetaEmail(membership.email) !== session.email) return null;
  const accessLevel: LevyTateBetaAccessLevel = normaliseMvpUserRole(membership.role) === "Platform Admin" ? "beta_admin" : "beta_user";
  return { ...session, accessLevel };
}

async function findMembershipByEmail(email: string) {
  return (await supabaseSelect<MembershipRow>(config(), "levytate_users", new URLSearchParams({ select: "id,organisation_id,email,role,access_level,active,auth_subject,auth_binding_status", email: `eq.${email}`, limit: "2" })))[0] ?? null;
}
async function findMembershipBySubject(subject: string) {
  if (!subject) return null;
  return (await supabaseSelect<MembershipRow>(config(), "levytate_users", new URLSearchParams({ select: "id,organisation_id,email,role,access_level,active,auth_subject,auth_binding_status", auth_subject: `eq.${subject}`, limit: "2" })))[0] ?? null;
}
async function audit(membership: MembershipRow | null, email: string, action: string, outcome: string) {
  if (!membership) return;
  await supabaseInsert(config(), "levytate_audit_events", [{ id: randomUUID(), organisation_id: membership.organisation_id, actor_email: email, actor_role: membership.role, entity_type: "authentication", entity_id: membership.id, action, summary: action.replaceAll("_", " "), metadata: { outcome }, created_at: new Date().toISOString() }]);
}
