export const levytateBetaSessionCookie = "levytate_beta_session";

export const levytateBetaAllowedEmails = ["hello@levytate.co.uk"] as const;
export const levytateBetaAccessLevel = "beta_admin" as const;
export const levytateBetaSessionMaxAge = 60 * 60 * 8;

export type LevyTateBetaSession = {
  email: (typeof levytateBetaAllowedEmails)[number];
  accessLevel: typeof levytateBetaAccessLevel;
  issuedAt: number;
  expiresAt: number;
};

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function getLevyTateBetaAccessCode() {
  return process.env.LEVYTATE_BETA_CODE ?? "LEVYTATE-BETA";
}

export function isAllowedBetaEmail(email: string) {
  const normalised = email.trim().toLowerCase();
  return levytateBetaAllowedEmails.some((allowedEmail) => allowedEmail.toLowerCase() === normalised);
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

export async function createLevyTateBetaSession(email: string) {
  const normalisedEmail = email.trim().toLowerCase();
  if (!isAllowedBetaEmail(normalisedEmail)) throw new Error("Email is not approved for beta access.");

  const issuedAt = Date.now();
  const session: LevyTateBetaSession = {
    email: normalisedEmail as LevyTateBetaSession["email"],
    accessLevel: levytateBetaAccessLevel,
    issuedAt,
    expiresAt: issuedAt + levytateBetaSessionMaxAge * 1000,
  };
  const payload = bytesToBase64Url(encoder.encode(JSON.stringify(session)));
  const key = await getSessionSigningKey("sign");
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));

  return `${payload}.${bytesToBase64Url(new Uint8Array(signature))}`;
}

export async function readLevyTateBetaSession(token: string | undefined | null) {
  if (!token) return null;

  try {
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

    const session = JSON.parse(decoder.decode(base64UrlToBytes(payload))) as Partial<LevyTateBetaSession>;
    if (
      typeof session.email !== "string" ||
      session.accessLevel !== levytateBetaAccessLevel ||
      typeof session.issuedAt !== "number" ||
      typeof session.expiresAt !== "number" ||
      session.expiresAt <= Date.now() ||
      !isAllowedBetaEmail(session.email)
    ) {
      return null;
    }

    return session as LevyTateBetaSession;
  } catch {
    return null;
  }
}
