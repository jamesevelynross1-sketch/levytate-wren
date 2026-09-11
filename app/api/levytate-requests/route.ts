import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { levytateBetaSessionCookie } from "@/lib/levytate/config/beta-access";
import { readAuthorisedLevyTateBetaSession } from "@/lib/server/levytate-authorised-session";
import { BoundedJsonBodyError, readBoundedJson } from "@/lib/server/bounded-json";
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
  if (!hasSameOrigin(request)) return noStore({ message: "Forbidden." }, 403);
  try {
    const action = await readJson(request);
    return noStore({ ok: true, workspace: await applyEmployerRequestActionForSession(session, action) });
  } catch (error) {
    return safeError(error);
  }
}

async function readJson(request: Request): Promise<unknown> {
  try {
    return await readBoundedJson(request, 64 * 1024);
  } catch (error) {
    if (error instanceof BoundedJsonBodyError && error.tooLarge) {
      throw new LevyTateServiceRequestError("The Request action is too large.", 413);
    }
    throw new LevyTateServiceRequestError("A valid Request action is required.", 400);
  }
}

function hasSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return origin === new URL(request.url).origin;
}

async function employerSession() {
  const store = await cookies();
  return readAuthorisedLevyTateBetaSession(store.get(levytateBetaSessionCookie)?.value);
}

function safeError(error: unknown) {
  if (error instanceof LevyTateServiceRequestError) return noStore({ message: error.message }, error.status);
  console.error("LevyTate Requests route failed", error instanceof Error ? error.name : "unknown");
  return noStore({ message: "Requests are temporarily unavailable." }, 503);
}

function noStore(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store, max-age=0" } });
}
