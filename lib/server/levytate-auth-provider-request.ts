import { readBoundedJson } from "@/lib/server/bounded-json";

export class AuthenticationDependencyError extends Error {
  constructor(readonly status: 429 | 503 = 503) {
    super(status === 429 ? "Please wait before trying secure sign-in again." : "Secure sign-in is temporarily unavailable. Please try again shortly.");
    this.name = "AuthenticationDependencyError";
  }
}

const invalidCredentialCodes = new Set([
  "otp_expired", "invite_not_found", "flow_state_expired", "flow_state_not_found",
  "refresh_token_not_found", "refresh_token_already_used", "session_not_found", "session_expired",
  "invalid_credentials", "user_banned", "user_not_found", "bad_jwt",
]);

/** Never turn provider outages, throttling or malformed replies into an expired
 * session. Only explicit credential rejection may trigger client reauthentication.
 */
export async function authProviderRequest(url: string, init: RequestInit): Promise<Response> {
  let response: Response;
  try { response = await fetch(url, { ...init, signal: init.signal ?? AbortSignal.timeout(10_000) }); }
  catch { throw new AuthenticationDependencyError(); }
  if (response.ok) return response;
  if (response.status === 429) throw new AuthenticationDependencyError(429);
  if (response.status >= 500) throw new AuthenticationDependencyError();
  let body: unknown;
  try { body = await readBoundedJson(response, 16 * 1024); }
  catch { throw new AuthenticationDependencyError(); }
  // GoTrue's wire format may carry a numeric HTTP `code` alongside the
  // machine-readable `error_code`. Do not mistake that status for an Auth code.
  const error = body && typeof body === "object" ? body as { code?: unknown; error_code?: unknown } : undefined;
  const code = typeof error?.error_code === "string" ? error.error_code : error?.code;
  if (typeof code !== "string" || !invalidCredentialCodes.has(code)) throw new AuthenticationDependencyError();
  return response;
}
