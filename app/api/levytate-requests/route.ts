import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { levytateBetaSessionCookie } from "@/lib/levytate/config/beta-access";
import { readAuthorisedLevyTateBetaSession } from "@/lib/server/levytate-authorised-session";
import { ClientRequestError, readAuthenticatedJson } from "@/lib/server/levytate-request-boundary";
import {
  LevyTateServiceRequestError,
  applyEmployerRequestActionForSession,
  getEmployerRequestsWorkspaceForSession,
} from "@/lib/server/levytate-service-requests";

export async function GET() {
  const session = await employerSession();
  if (!session) return noStore({ message: "Unauthorised." }, 401);
  try {
    return noStore({ ok: true, workspace: await getEmployerRequestsWorkspaceForSession(session) });
  } catch (error) {
    return safeError(error);
  }
}

export async function POST(request: Request) {
  const session = await employerSession();
  if (!session) return noStore({ message: "Unauthorised." }, 401);
  try {
    const action = await readAuthenticatedJson(request, session.email);
    return noStore({ ok: true, workspace: await applyEmployerRequestActionForSession(session, action) });
  } catch (error) {
    return safeError(error);
  }
}

async function employerSession() {
  const store = await cookies();
  return readAuthorisedLevyTateBetaSession(store.get(levytateBetaSessionCookie)?.value);
}

function safeError(error: unknown) {
  if (error instanceof ClientRequestError) return noStore({ message: error.message }, error.status);
  if (error instanceof LevyTateServiceRequestError) return noStore({ message: error.message }, error.status);
  console.error("LevyTate Requests route failed", error instanceof Error ? error.name : "unknown");
  return noStore({ message: "Requests are temporarily unavailable." }, 503);
}

function noStore(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store, max-age=0" } });
}
