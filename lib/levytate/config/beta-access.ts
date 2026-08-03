export const levytateBetaSessionCookie = "levytate_beta_session";

export const levytateBetaAdminEmails = ["hello@levytate.co.uk"] as const;
export const levytateBetaSessionMaxAge = 60 * 60 * 8;
export const levytateEarlyAccessApprovalTokenMaxAge = 60 * 60 * 24 * 30;

export type LevyTateBetaAccessLevel = "beta_admin" | "beta_user";
export type LevyTateApprovalStatus = "Approved" | "Onboarded";

export type LevyTateBetaSession = {
  email: string;
  accessLevel: LevyTateBetaAccessLevel;
  authMode?: "internal_beta" | "supabase_email";
  authSubject?: string;
  issuedAt: number;
  expiresAt: number;
};

export type LevyTateApprovalToken = {
  email: string;
  status: LevyTateApprovalStatus;
  issuedAt: number;
  expiresAt: number;
};

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function getLevyTateBetaAccessCode() {
  return process.env.LEVYTATE_BETA_CODE ?? "LEVYTATE-BETA";
}

export function isInternalBetaLoginEnabled() {
  const configured = process.env.LEVYTATE_BETA_LOGIN_ENABLED?.trim().toLowerCase();
  if (configured === "true") return true;
  if (configured === "false") return false;
  return process.env.NODE_ENV !== "production";
}

export function isInternalValidationEmail(email: string) {
  const normalised = normaliseBetaEmail(email);
  return normalised.endsWith(".test") || isAdminBetaEmail(normalised);
}

export function normaliseBetaEmail(email: string) {
  return email.trim().toLowerCase();
}

export function isAdminBetaEmail(email: string) {
  const normalised = normaliseBetaEmail(email);
  return levytateBetaAdminEmails.some((allowedEmail) => allowedEmail.toLowerCase() === normalised);
}

export function isLevyTateBetaAccessLevel(value: unknown): value is LevyTateBetaAccessLevel {
  return value === "beta_admin" || value === "beta_user";
}

export function isLevyTateApprovalStatus(value: unknown): value is LevyTateApprovalStatus {
  return value === "Approved" || value === "Onboarded";
}

function getLevyTateBetaSessionSecret() {
  const secret = process.env.LEVYTATE_BETA_SESSION_SECRET?.trim();
  if (secret) return secret;

  if (process.env.NODE_ENV === "production") {
    throw new Error("LEVYTATE_BETA_SESSION_SECRET must be configured in production.");
  }

  return "levytate-local-development-session-secret";
}

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlToBytes(value: string) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function getSessionSigningKey(usage: KeyUsage) {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(getLevyTateBetaSessionSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    [usage],
  );
}

async function signPayload<T extends object>(payloadData: T) {
  const payload = bytesToBase64Url(encoder.encode(JSON.stringify(payloadData)));
  const key = await getSessionSigningKey("sign");
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return `${payload}.${bytesToBase64Url(new Uint8Array(signature))}`;
}

async function readSignedPayload(token: string | undefined | null) {
  if (!token) return null;

  const parts = token.split(".");
  if (parts.length !== 2) return null;

  const [payload, signature] = parts;
  const key = await getSessionSigningKey("verify");
  const validSignature = await crypto.subtle.verify(
    "HMAC",
    key,
    base64UrlToBytes(signature),
    encoder.encode(payload),
  );
  if (!validSignature) return null;

  return JSON.parse(decoder.decode(base64UrlToBytes(payload))) as Record<string, unknown>;
}

export async function createLevyTateBetaSession(email: string, accessLevel: LevyTateBetaAccessLevel, identity?: { authMode: "internal_beta" | "supabase_email"; authSubject?: string }) {
  const normalisedEmail = normaliseBetaEmail(email);

  if (accessLevel === "beta_admin" && !isAdminBetaEmail(normalisedEmail)) {
    throw new Error("Email is not approved for beta admin access.");
  }

  const issuedAt = Date.now();
  const session: LevyTateBetaSession = {
    email: normalisedEmail,
    accessLevel,
    authMode: identity?.authMode ?? "internal_beta",
    authSubject: identity?.authSubject,
    issuedAt,
    expiresAt: issuedAt + levytateBetaSessionMaxAge * 1000,
  };

  return signPayload(session);
}

export async function createLevyTateApprovalToken(email: string, status: LevyTateApprovalStatus) {
  const issuedAt = Date.now();
  const token: LevyTateApprovalToken = {
    email: normaliseBetaEmail(email),
    status,
    issuedAt,
    expiresAt: issuedAt + levytateEarlyAccessApprovalTokenMaxAge * 1000,
  };

  return signPayload(token);
}

export async function readLevyTateBetaSession(token: string | undefined | null) {
  try {
    const session = (await readSignedPayload(token)) as Partial<LevyTateBetaSession> | null;
    if (!session) return null;

    if (
      typeof session.email !== "string" ||
      !isLevyTateBetaAccessLevel(session.accessLevel) ||
      typeof session.issuedAt !== "number" ||
      typeof session.expiresAt !== "number" ||
      session.expiresAt <= Date.now()
    ) {
      return null;
    }

    if (session.authMode === "supabase_email" && typeof session.authSubject !== "string") return null;

    if (session.accessLevel === "beta_admin" && !isAdminBetaEmail(session.email)) {
      return null;
    }

    return {
      ...session,
      email: normaliseBetaEmail(session.email),
    } as LevyTateBetaSession;
  } catch {
    return null;
  }
}

export async function readLevyTateApprovalToken(token: string | undefined | null) {
  try {
    const approval = (await readSignedPayload(token)) as Partial<LevyTateApprovalToken> | null;
    if (!approval) return null;

    if (
      typeof approval.email !== "string" ||
      !isLevyTateApprovalStatus(approval.status) ||
      typeof approval.issuedAt !== "number" ||
      typeof approval.expiresAt !== "number" ||
      approval.expiresAt <= Date.now()
    ) {
      return null;
    }

    return {
      ...approval,
      email: normaliseBetaEmail(approval.email),
    } as LevyTateApprovalToken;
  } catch {
    return null;
  }
}
