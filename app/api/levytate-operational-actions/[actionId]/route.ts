import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { levytateBetaSessionCookie, readLevyTateBetaSession } from "@/lib/levytate/config/beta-access";
import { LevyTateLearnerLifecyclePermissionError } from "@/lib/server/levytate-learner-lifecycle";
import {
  acknowledgeOperationalAction,
  assignOperationalActionOwner,
  completeOperationalAction,
  dismissOperationalAction,
  getOperationalAction,
  getOperationalActionHistory,
  LevyTateOperationalActionConflictError,
  LevyTateOperationalActionError,
  startOperationalAction,
  type OperationalActionDismissalKind,
} from "@/lib/server/levytate-operational-actions";

type RouteContext = { params: Promise<{ actionId: string }> };

async function sessionFromCookie() {
  const cookieStore = await cookies();
  return readLevyTateBetaSession(cookieStore.get(levytateBetaSessionCookie)?.value);
}

export async function GET(request: Request, context: RouteContext) {
  const session = await sessionFromCookie();
  if (!session) return NextResponse.json({ message: "Unauthorised." }, { status: 401 });
  const { actionId } = await context.params;
  try {
    const action = await getOperationalAction(session, actionId);
    const history = new URL(request.url).searchParams.get("history") === "true" ? await getOperationalActionHistory(session, actionId) : undefined;
    return NextResponse.json({ ok: true, action, ...(history ? { history } : {}) });
  } catch (error) {
    return actionErrorResponse(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const session = await sessionFromCookie();
  if (!session) return NextResponse.json({ message: "Unauthorised." }, { status: 401 });
  const { actionId } = await context.params;
  try {
    const body = await request.json() as {
      command?: "acknowledge" | "start" | "complete" | "dismiss" | "assign";
      expectedVersion?: number;
      completionNote?: string;
      dismissalReason?: string;
      dismissalKind?: OperationalActionDismissalKind;
      organisationId?: string;
      actorUserId?: string;
      ownerType?: "Employee" | "Line Manager" | "Apprenticeship Lead" | "HR" | "Provider" | "Shared";
      ownerUserId?: string;
      ownerDisplayName?: string;
    };
    if (!Number.isInteger(body.expectedVersion)) throw new LevyTateOperationalActionError("A valid expectedVersion is required.");
    let action;
    if (body.command === "acknowledge") action = await acknowledgeOperationalAction(session, actionId, body.expectedVersion!);
    else if (body.command === "start") action = await startOperationalAction(session, actionId, body.expectedVersion!);
    else if (body.command === "complete") action = await completeOperationalAction(session, actionId, body.expectedVersion!, body.completionNote);
    else if (body.command === "dismiss" && body.dismissalKind) action = await dismissOperationalAction(session, actionId, body.expectedVersion!, body.dismissalReason ?? "", body.dismissalKind);
    else if (body.command === "assign" && body.ownerType) action = await assignOperationalActionOwner(session, actionId, body.expectedVersion!, { ownerType: body.ownerType, ownerUserId: body.ownerUserId, ownerDisplayName: body.ownerDisplayName });
    else throw new LevyTateOperationalActionError("A supported action command is required.");
    return NextResponse.json({ ok: true, action });
  } catch (error) {
    return actionErrorResponse(error);
  }
}

function actionErrorResponse(error: unknown) {
  const status = error instanceof LevyTateLearnerLifecyclePermissionError
    ? 403
    : error instanceof LevyTateOperationalActionConflictError
      ? 409
      : error instanceof LevyTateOperationalActionError
        ? 400
        : 500;
  return NextResponse.json({ message: status === 403 ? "You do not have access to that operational action." : error instanceof Error ? error.message : "Operational action update failed." }, { status });
}
