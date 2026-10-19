import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { levytateBetaSessionCookie } from "@/lib/levytate/config/beta-access";
import { readAuthorisedLevyTateBetaSession } from "@/lib/server/levytate-authorised-session";
import { BoundedJsonBodyError, readBoundedJson } from "@/lib/server/bounded-json";
import {
  applyAssessmentActionForSession,
  getAssessmentWorkspaceForSession,
  LevyTateAssessmentError,
} from "@/lib/server/levytate-assessments";

export async function GET() {
  const session = await employerSession();
  if (!session) return reply({ message: "Unauthorised." }, 401);
  try {
    return reply({ ok: true, workspace: await getAssessmentWorkspaceForSession(session) });
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: Request) {
  const session = await employerSession();
  if (!session) return reply({ message: "Unauthorised." }, 401);
  if (request.headers.get("origin") !== new URL(request.url).origin) return reply({ message: "Forbidden." }, 403);
  try {
    const action = await readBoundedJson(request, 64 * 1024);
    return reply({ ok: true, workspace: await applyAssessmentActionForSession(session, action) });
  } catch (error) {
    if (error instanceof BoundedJsonBodyError) return reply({ message: error.tooLarge ? "The assessment action is too large." : "A valid assessment action is required." }, error.tooLarge ? 413 : 400);
    return failure(error);
  }
}

async function employerSession() {
  const store = await cookies();
  return readAuthorisedLevyTateBetaSession(store.get(levytateBetaSessionCookie)?.value);
}

function failure(error: unknown) {
  if (error instanceof LevyTateAssessmentError) return reply({ message: error.message }, error.status);
  console.error("LevyTate Assessments route failed", error instanceof Error ? error.name : "unknown");
  return reply({ message: "Assessments are temporarily unavailable." }, 503);
}

function reply(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store, max-age=0", "X-Robots-Tag": "noindex, nofollow" } });
}
