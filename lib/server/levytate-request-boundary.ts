import { BoundedJsonBodyError, readBoundedJson } from "@/lib/server/bounded-json";
import { checkAuthenticatedWriteLimit, LevyTateRateLimitStoreError } from "@/lib/server/levytate-auth-rate-limit";
import { applicationRequestOrigin } from "@/lib/server/levytate-request-origin";
import { getLevyTateWebsiteOrigin } from "@/lib/levytate/hosts";

export class ClientRequestError extends Error {
  constructor(message: string, readonly status: 400 | 403 | 404 | 409 | 413 | 415 | 422 | 429 | 503) {
    super(message);
    this.name = "ClientRequestError";
  }
}

export async function readAuthenticatedJson(request: Request, actorEmail: string, maximumBytes = 64 * 1024) {
  const body = await readBrowserJson(request, maximumBytes);
  await assertAuthenticatedWrite(request, actorEmail);
  return body;
}

export async function assertAuthenticatedWrite(request: Request, actorEmail: string) {
  assertBrowserOrigin(request);
  try {
    if (!(await checkAuthenticatedWriteLimit(request, actorEmail)).allowed) {
      throw new ClientRequestError("Too many changes in a short time. Wait a minute before retrying.", 429);
    }
  } catch (error) {
    if (error instanceof LevyTateRateLimitStoreError) throw new ClientRequestError("Security controls are temporarily unavailable. No change has been made.", 503);
    throw error;
  }
}

/** Cookie-authenticated writes require the browser's exact application origin.
 * Signed webhooks and bearer-token integrations use their own trust boundary.
 */
export function assertBrowserOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const site = request.headers.get("sec-fetch-site");
  let expectedOrigin: string;
  try { expectedOrigin = applicationRequestOrigin(request); }
  catch { throw new ClientRequestError("This application host is not authorised.", 403); }
  if (origin !== expectedOrigin || (site !== null && site !== "same-origin" && site !== "none")) {
    throw new ClientRequestError("This request did not originate from this application. Reload and try again.", 403);
  }
}

export async function readBrowserJson(request: Request, maximumBytes = 64 * 1024): Promise<Record<string, unknown>> {
  assertBrowserOrigin(request);
  return readJsonObject(request, maximumBytes);
}

/** Public marketing forms intentionally allow the configured website origin.
 * They do not use authenticated cookies; this exception must not guard app writes.
 */
export async function readPublicBrowserJson(request: Request, maximumBytes = 8 * 1024): Promise<Record<string, unknown>> {
  if (request.headers.get("origin") !== getLevyTateWebsiteOrigin()) assertBrowserOrigin(request);
  return readJsonObject(request, maximumBytes);
}

async function readJsonObject(request: Request, maximumBytes: number): Promise<Record<string, unknown>> {
  if (request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase() !== "application/json") {
    throw new ClientRequestError("Send this action as JSON.", 415);
  }
  try {
    const body = await readBoundedJson(request, maximumBytes);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      throw new ClientRequestError("A valid action object is required.", 400);
    }
    return body as Record<string, unknown>;
  } catch (error) {
    if (error instanceof BoundedJsonBodyError) {
      throw new ClientRequestError(error.message, error.tooLarge ? 413 : 400);
    }
    throw error;
  }
}

export async function readBrowserForm(request: Request, maximumBytes = 8 * 1024): Promise<URLSearchParams> {
  assertBrowserOrigin(request);
  if (request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase() !== "application/x-www-form-urlencoded") {
    throw new ClientRequestError("A valid form submission is required.", 415);
  }
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maximumBytes) throw new ClientRequestError("Request body is too large.", 413);
  if (!request.body) throw new ClientRequestError("A form submission is required.", 400);
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      length += chunk.value.byteLength;
      if (length > maximumBytes) {
        await reader.cancel();
        throw new ClientRequestError("Request body is too large.", 413);
      }
      chunks.push(chunk.value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try { return new URLSearchParams(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); }
  catch { throw new ClientRequestError("A valid form submission is required.", 400); }
}

/** Reject unexpected action fields instead of silently accepting forged state. */
export function requireActionKeys(body: Record<string, unknown>, allowed: readonly string[]) {
  if (Object.keys(body).some((key) => !allowed.includes(key))) {
    throw new ClientRequestError("The action contains unsupported fields.", 400);
  }
}
