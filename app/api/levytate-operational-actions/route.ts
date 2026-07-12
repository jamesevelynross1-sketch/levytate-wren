import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { levytateBetaSessionCookie, readLevyTateBetaSession } from "@/lib/levytate/config/beta-access";
import { LevyTateLearnerLifecyclePermissionError } from "@/lib/server/levytate-learner-lifecycle";
import {
  listOperationalActions,
  synchroniseOrganisationOperationalActions,
} from "@/lib/server/levytate-operational-actions";

async function sessionFromCookie() {
  const cookieStore = await cookies();
  return readLevyTateBetaSession(cookieStore.get(levytateBetaSessionCookie)?.value);
}

export async function GET(request: Request) {
  const session = await sessionFromCookie();
  if (!session) return NextResponse.json({ message: "Unauthorised." }, { status: 401 });
  const url = new URL(request.url);
  try {
    const actions = await listOperationalActions(session, {
      learnerRecordId: url.searchParams.get("learnerRecordId")?.trim() || undefined,
      includeTerminal: url.searchParams.get("includeTerminal") === "true",
    });
    return NextResponse.json({ ok: true, actions });
  } catch (error) {
    return actionErrorResponse(error);
  }
}

export async function POST() {
  const session = await sessionFromCookie();
  if (!session) return NextResponse.json({ message: "Unauthorised." }, { status: 401 });
  try {
    const result = await synchroniseOrganisationOperationalActions(session);
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    return actionErrorResponse(error);
  }
}

function actionErrorResponse(error: unknown) {
  const status = error instanceof LevyTateLearnerLifecyclePermissionError ? 403 : 500;
  return NextResponse.json({ message: status === 403 ? "You do not have access to organisation operational actions." : error instanceof Error ? error.message : "Operational actions are unavailable." }, { status });
}
