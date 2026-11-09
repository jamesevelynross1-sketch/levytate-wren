import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { levytateBetaSessionCookie } from "@/lib/levytate/config/beta-access";
import { readAuthorisedLevyTateBetaSession } from "@/lib/server/levytate-authorised-session";
import { assertExpectedWorkspace, ClientRequestError, readAuthenticatedJson } from "@/lib/server/levytate-request-boundary";
import { logLevyTateServerError } from "@/lib/server/levytate-safe-api-error";
import {
  LevyTateServiceRequestError,
  applyEmployerRequestActionForSession,
  getEmployerRequestsWorkspaceForSession,
} from "@/lib/server/levytate-service-requests";

export async function GET(request: Request) {
  try {
    const session = await employerSession();
    if (!session) return noStore({ message: "Unauthorised." }, 401);
    await assertExpectedWorkspace(request, session.email);
    return noStore({ ok: true, workspace: await getEmployerRequestsWorkspaceForSession(session) });
  } catch (error) {
    return safeError(error);
  }
}

export async function POST(request: Request) {
  try {
    const session = await employerSession();
    if (!session) return noStore({ message: "Unauthorised." }, 401);
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
  logLevyTateServerError("employer-requests", error);
  return noStore({ message: "Requests are temporarily unavailable." }, 503);
}

function noStore(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store, max-age=0" } });
}
