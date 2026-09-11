import { normaliseBetaEmail } from "@/lib/levytate/config/beta-access";
import { providerMembershipRoles, type ProviderMembershipRole } from "@/lib/levytate/requests/domain";
import { checkCallbackAttemptLimit } from "@/lib/server/levytate-auth-rate-limit";
import { isRequestsEnabledForOrganisation, isRequestsEnvironmentEnabled } from "@/lib/server/levytate-request-capability";
import {
  getLevyTateSupabaseConfig,
  readRuntimeEnv,
  supabaseSelect,
  supabaseUpdate,
} from "@/lib/server/levytate-supabase";

export const levytateProviderSessionCookie = "levytate_provider_session";
export const levytateProviderSupabaseAccessCookie = "levytate_provider_auth_access";
export const levytateProviderSupabaseRefreshCookie = "levytate_provider_auth_refresh";
export const levytateProviderAuthCookieMaxAge = 60 * 60 * 8;
export const genericProviderSignInMessage = "If this email is authorised for LevyTate Opportunities, you’ll receive a secure sign-in link.";

type ProviderMembershipRow = {
  id: string;
  provider_id: string;
  email: string;
  display_name: string | null;
  role: string;
  active: boolean;
  auth_subject: string | null;
  auth_binding_status: string | null;
};

type SupabaseAuthResult = {
  access_token: string;
  refresh_token: string;
  expires_in?: number;
  user: { id: string; email?: string };
};

export type LevyTateProviderSession = {
  membershipId: string;
  providerId: string;
  email: string;
  role: ProviderMembershipRole;
  authSubject: string;
  issuedAt: number;
  expiresAt: number;
};

export class LevyTateProviderAuthError extends Error {
  constructor(
    public code: "invalid_link" | "unauthorised" | "inactive" | "conflict" | "configuration",
    message: string,
    public status = 403,
  ) {
    super(message);
    this.name = "LevyTateProviderAuthError";
  }
}

function config() {
  const value = getLevyTateSupabaseConfig();
  if (!value) throw new LevyTateProviderAuthError("configuration", "Provider authentication is unavailable.", 503);
  return value;
}

async function providerAuthFetch(path: string, init: RequestInit = {}) {
  const value = config();
  return fetch(`${value.url}/auth/v1/${path}`, {
    ...init,
    headers: {
      apikey: value.serviceRoleKey,
      Authorization: `Bearer ${value.serviceRoleKey}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });
}

export async function requestProviderSignIn(emailInput: string, redirectTo: string) {
  if (!isRequestsEnvironmentEnabled()) return false;
  const email = normaliseBetaEmail(emailInput);
  const memberships = await findProviderMembershipsByEmail(email);
  if (memberships.length !== 1 || !memberships[0].active) return false;
  if (!(await hasCapabilityEnabledInvitation(memberships[0]))) return false;

  const response = await providerAuthFetch(`otp?redirect_to=${encodeURIComponent(redirectTo)}`, {
    method: "POST",
    body: JSON.stringify({
      email,
      create_user: false,
      gotrue_meta_security: { captcha_token: undefined },
    }),
  });
  if (!response.ok) throw new LevyTateProviderAuthError("configuration", "Secure sign-in is temporarily unavailable.", 503);
  return true;
}

export async function completeLevyTateProviderMagicLinkCallback(request: Request) {
  const url = new URL(request.url);
  const callbackLimit = await checkCallbackAttemptLimit(request);
  if (!callbackLimit.allowed) throw new LevyTateProviderAuthError("invalid_link", "This sign-in link is invalid or has expired.", 429);
  const tokenHash = url.searchParams.get("token_hash") ?? "";
  const type = url.searchParams.get("type") ?? "email";
  if (!tokenHash || !["email", "magiclink"].includes(type)) {
    throw new LevyTateProviderAuthError("invalid_link", "This sign-in link is invalid or has expired.", 400);
  }

  const response = await providerAuthFetch("verify", {
    method: "POST",
    body: JSON.stringify({ token_hash: tokenHash, type }),
  });
  if (!response.ok) throw new LevyTateProviderAuthError("invalid_link", "This sign-in link is invalid or has expired.", 401);
  const auth = await response.json() as SupabaseAuthResult;
  const email = normaliseBetaEmail(auth.user.email ?? "");
  const memberships = await findProviderMembershipsByEmail(email);
  if (!email || !auth.user.id || memberships.length !== 1) {
    throw new LevyTateProviderAuthError("unauthorised", "This email is not authorised for LevyTate Opportunities.");
  }
  const membership = memberships[0];
  if (!membership.active) throw new LevyTateProviderAuthError("inactive", "This provider account is not active.");
  if (membership.auth_subject && membership.auth_subject !== auth.user.id) {
    throw new LevyTateProviderAuthError("conflict", "This email is not authorised for LevyTate Opportunities.");
  }
  const subjectOwners = await findProviderMembershipsBySubject(auth.user.id);
  if (subjectOwners.some((owner) => owner.id !== membership.id)) {
    throw new LevyTateProviderAuthError("conflict", "This email is not authorised for LevyTate Opportunities.");
  }
  if (!(await hasCapabilityEnabledInvitation(membership))) {
    throw new LevyTateProviderAuthError("unauthorised", "This email is not authorised for LevyTate Opportunities.");
  }

  const now = new Date().toISOString();
  await supabaseUpdate(
    config(),
    "levytate_provider_memberships",
    `id=eq.${encodeURIComponent(membership.id)}`,
    {
      auth_subject: auth.user.id,
      auth_binding_status: "bound",
      auth_bound_at: membership.auth_subject ? undefined : now,
      last_login_at: now,
      updated_at: now,
    },
    { prefer: "return=minimal" },
  );

  const session: LevyTateProviderSession = {
    membershipId: membership.id,
    providerId: membership.provider_id,
    email,
    role: normaliseProviderRole(membership.role),
    authSubject: auth.user.id,
    issuedAt: Date.now(),
    expiresAt: Date.now() + levytateProviderAuthCookieMaxAge * 1000,
  };
  return {
    sessionToken: await signProviderSession(session),
    accessToken: auth.access_token,
    refreshToken: auth.refresh_token,
    expiresIn: auth.expires_in,
  };
}

export async function readAuthorisedLevyTateProviderSession(token: string | undefined | null) {
  if (!isRequestsEnvironmentEnabled()) return null;
  const session = await readProviderSession(token);
  if (!session) return null;
  const rows = await supabaseSelect<ProviderMembershipRow>(
    config(),
    "levytate_provider_memberships",
    new URLSearchParams({
      select: "id,provider_id,email,display_name,role,active,auth_subject,auth_binding_status",
      id: `eq.${session.membershipId}`,
      provider_id: `eq.${session.providerId}`,
      auth_subject: `eq.${session.authSubject}`,
      auth_binding_status: "eq.bound",
      active: "eq.true",
      limit: "1",
    }),
  );
  const membership = rows[0];
  if (!membership || normaliseBetaEmail(membership.email) !== session.email) return null;
  return { ...session, role: normaliseProviderRole(membership.role) };
}

export async function invalidateProviderAuthSession(accessToken?: string, refreshToken?: string) {
  if (!accessToken && !refreshToken) return true;
  let token = accessToken;
  if (!token && refreshToken) token = await exchangeRefreshToken(refreshToken);
  if (!token) return false;
  let response = await providerAuthFetch("logout?scope=local", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok && refreshToken) {
    token = await exchangeRefreshToken(refreshToken);
    if (token) {
      response = await providerAuthFetch("logout?scope=local", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
    }
  }
  return response.ok;
}

async function exchangeRefreshToken(refreshToken: string) {
  const response = await providerAuthFetch("token?grant_type=refresh_token", {
    method: "POST",
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  if (!response.ok) return undefined;
  const body = await response.json() as Partial<SupabaseAuthResult>;
  return typeof body.access_token === "string" ? body.access_token : undefined;
}

async function findProviderMembershipsByEmail(email: string) {
  if (!email) return [];
  return supabaseSelect<ProviderMembershipRow>(
    config(),
    "levytate_provider_memberships",
    new URLSearchParams({
      select: "id,provider_id,email,display_name,role,active,auth_subject,auth_binding_status",
      email: `eq.${email}`,
      limit: "2",
    }),
  );
}

async function findProviderMembershipsBySubject(subject: string) {
  if (!subject) return [];
  return supabaseSelect<ProviderMembershipRow>(
    config(),
    "levytate_provider_memberships",
    new URLSearchParams({
      select: "id,provider_id,email,display_name,role,active,auth_subject,auth_binding_status",
      auth_subject: `eq.${subject}`,
      limit: "2",
    }),
  );
}

async function hasCapabilityEnabledInvitation(membership: ProviderMembershipRow) {
  const rows = await supabaseSelect<{ organisation_id: string }>(
    config(),
    "levytate_service_request_invitations",
    new URLSearchParams({
      select: "organisation_id",
      provider_id: `eq.${membership.provider_id}`,
      status: "in.(sent,viewed,responded)",
      limit: "20",
    }),
  );
  const organisationIds = [...new Set(rows.map((row) => row.organisation_id))];
  const enabled = await Promise.all(organisationIds.map(isRequestsEnabledForOrganisation));
  return enabled.some(Boolean);
}

function normaliseProviderRole(role: string): ProviderMembershipRole {
  return providerMembershipRoles.includes(role as ProviderMembershipRole)
    ? role as ProviderMembershipRole
    : "Provider User";
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function providerSessionSecret() {
  const secret = readRuntimeEnv("LEVYTATE_PROVIDER_SESSION_SECRET");
  if (secret.length >= 32) return secret;
  if (secret) {
    throw new LevyTateProviderAuthError("configuration", "Provider authentication is unavailable.", 503);
  }
  if (process.env.NODE_ENV === "production") {
    throw new LevyTateProviderAuthError("configuration", "Provider authentication is unavailable.", 503);
  }
  return "levytate-local-provider-session-secret";
}

async function signingKey(usage: KeyUsage) {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(providerSessionSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    [usage],
  );
}

async function signProviderSession(session: LevyTateProviderSession) {
  const payload = bytesToBase64Url(encoder.encode(JSON.stringify(session)));
  const signature = await crypto.subtle.sign("HMAC", await signingKey("sign"), encoder.encode(payload));
  return `${payload}.${bytesToBase64Url(new Uint8Array(signature))}`;
}

async function readProviderSession(token: string | undefined | null) {
  try {
    if (!token) return null;
    const [payload, signature, extra] = token.split(".");
    if (!payload || !signature || extra) return null;
    const verified = await crypto.subtle.verify(
      "HMAC",
      await signingKey("verify"),
      base64UrlToBytes(signature),
      encoder.encode(payload),
    );
    if (!verified) return null;
    const value = JSON.parse(decoder.decode(base64UrlToBytes(payload))) as Partial<LevyTateProviderSession>;
    if (
      typeof value.membershipId !== "string" ||
      typeof value.providerId !== "string" ||
      typeof value.email !== "string" ||
      typeof value.authSubject !== "string" ||
      typeof value.issuedAt !== "number" ||
      typeof value.expiresAt !== "number" ||
      value.expiresAt <= Date.now()
    ) return null;
    return { ...value, email: normaliseBetaEmail(value.email), role: normaliseProviderRole(String(value.role ?? "")) } as LevyTateProviderSession;
  } catch {
    return null;
  }
}

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlToBytes(value: string) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "="));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}
