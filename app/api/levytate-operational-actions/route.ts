import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { levytateBetaSessionCookie } from "@/lib/levytate/config/beta-access";
import { readAuthorisedLevyTateBetaSession } from "@/lib/server/levytate-authorised-session";
import { LevyTateLearnerLifecyclePermissionError } from "@/lib/server/levytate-learner-lifecycle";
import {
  listOperationalActions,
  synchroniseOrganisationOperationalActions,
} from "@/lib/server/levytate-operational-actions";
import { logLevyTateServerError, operationalActionsRefreshError } from "@/lib/server/levytate-safe-api-error";

async function sessionFromCookie() {
  const cookieStore = await cookies();
  return readAuthorisedLevyTateBetaSession(cookieStore.get(levytateBetaSessionCookie)?.value);
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
  if (status === 500) {
    logLevyTateServerError("operational-actions", error);
    return NextResponse.json(operationalActionsRefreshError, { status });
  }
  return NextResponse.json({ message: "You do not have access to organisation operational actions." }, { status });
}
