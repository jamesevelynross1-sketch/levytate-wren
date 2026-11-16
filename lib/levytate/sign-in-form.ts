/** A generic acknowledgement never asserts account existence or email delivery. */
export function isSignInRequestAcknowledgement(value: unknown): value is { ok: true; message: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const body = value as Record<string, unknown>;
  return Object.keys(body).length === 2 && Object.keys(body).every(key => key === "ok" || key === "message") && body.ok === true
    && typeof body.message === "string" && body.message.trim().length > 0 && body.message.length <= 512;
}
