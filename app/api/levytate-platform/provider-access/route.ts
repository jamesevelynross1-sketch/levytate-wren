import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { levytateBetaSessionCookie } from "@/lib/levytate/config/beta-access";
import { readAuthorisedLevyTateBetaSession } from "@/lib/server/levytate-authorised-session";
import { ClientRequestError, readAuthenticatedJson, requireActionKeys } from "@/lib/server/levytate-request-boundary";
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
  try {
    const body = await readAuthenticatedJson(request, session.email, maximumRequestBodyBytes);
    requireActionKeys(body, ["providerId", "email", "displayName", "role"]);
    return reply({ ok: true, membership: await provisionProviderAccess(session, body) }, 201);
  } catch (error) {
    return failure(error);
  }
}

export async function PATCH(request: Request) {
  const session = await currentSession();
  if (!session) return reply({ message: "Unauthorised." }, 401);
  try {
    const body = await readAuthenticatedJson(request, session.email, maximumRequestBodyBytes);
    requireActionKeys(body, ["membershipId", "operation", "role", "displayName"]);
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
  if (error instanceof ClientRequestError) return reply({ message: error.message }, error.status);
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
