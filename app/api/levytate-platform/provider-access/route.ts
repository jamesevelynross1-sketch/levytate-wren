import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { levytateBetaSessionCookie } from "@/lib/levytate/config/beta-access";
import { readAuthorisedLevyTateBetaSession } from "@/lib/server/levytate-authorised-session";
import { BoundedJsonBodyError, readBoundedJson } from "@/lib/server/bounded-json";
import {
  LevyTateProviderAccessAdminError,
  listProviderAccessForAdmin,
  provisionProviderAccess,
  updateProviderAccess,
} from "@/lib/server/levytate-provider-access-admin";

const responseHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  "X-Robots-Tag": "noindex, nofollow",
};
const maximumRequestBodyBytes = 16 * 1024;

export async function GET() {
  const session = await currentSession();
  if (!session) return reply({ message: "Unauthorised." }, 401);
  try {
    return reply({ ok: true, providers: await listProviderAccessForAdmin(session) });
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: Request) {
  const session = await currentSession();
  if (!session) return reply({ message: "Unauthorised." }, 401);
  if (!hasSameOrigin(request)) return reply({ message: "Forbidden." }, 403);
  try {
    const body = await readObject(request, "A provider access request is required.");
    return reply({ ok: true, membership: await provisionProviderAccess(session, body) }, 201);
  } catch (error) {
    return failure(error);
  }
}

export async function PATCH(request: Request) {
  const session = await currentSession();
  if (!session) return reply({ message: "Unauthorised." }, 401);
  if (!hasSameOrigin(request)) return reply({ message: "Forbidden." }, 403);
  try {
    const body = await readObject(request, "A provider access update is required.");
    return reply({ ok: true, membership: await updateProviderAccess(session, body) });
  } catch (error) {
    return failure(error);
  }
}

async function currentSession() {
  const store = await cookies();
  return readAuthorisedLevyTateBetaSession(store.get(levytateBetaSessionCookie)?.value);
}

function failure(error: unknown) {
  const status = error instanceof LevyTateProviderAccessAdminError ? error.status : 503;
  const message = error instanceof LevyTateProviderAccessAdminError
    ? error.message
    : "Provider access administration is temporarily unavailable.";
  if (!(error instanceof LevyTateProviderAccessAdminError)) {
    console.error("LevyTate provider access administration failed", error instanceof Error ? error.name : "unknown");
  }
  return reply({ message }, status);
}

function reply(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: responseHeaders });
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hasSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return origin === new URL(request.url).origin;
}

async function readObject(request: Request, message: string) {
  try {
    const value = await readBoundedJson(request, maximumRequestBodyBytes);
    if (isObject(value)) return value;
  } catch (error) {
    if (error instanceof BoundedJsonBodyError && error.tooLarge) {
      throw new LevyTateProviderAccessAdminError("The provider access request is too large.", 413);
    }
    if (error instanceof LevyTateProviderAccessAdminError) throw error;
    // Return the same bounded client error for malformed and non-object JSON.
  }
  throw new LevyTateProviderAccessAdminError(message, 400);
}
