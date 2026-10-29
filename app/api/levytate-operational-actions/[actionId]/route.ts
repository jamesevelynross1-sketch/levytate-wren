import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { levytateBetaSessionCookie } from "@/lib/levytate/config/beta-access";
import { readAuthorisedLevyTateBetaSession } from "@/lib/server/levytate-authorised-session";
import { LevyTateLearnerLifecyclePermissionError } from "@/lib/server/levytate-learner-lifecycle";
import {
  acknowledgeOperationalAction,
  assignOperationalActionOwner,
  cancelOperationalAction,
  completeOperationalAction,
  dismissOperationalAction,
  getOperationalAction,
  getOperationalActionManagementDetail,
  getOperationalActionHistory,
  LevyTateOperationalActionConflictError,
  LevyTateOperationalActionError,
  startOperationalAction,
  updateOperationalActionDueDate,
} from "@/lib/server/levytate-operational-actions";
import { logLevyTateServerError } from "@/lib/server/levytate-safe-api-error";
import { ClientRequestError, readAuthenticatedJson } from "@/lib/server/levytate-request-boundary";
import { operationalActionInput, parseAction } from "@/lib/server/levytate-operational-input";

type RouteContext = { params: Promise<{ actionId: string }> };

async function sessionFromCookie() {
  const cookieStore = await cookies();
  return readAuthorisedLevyTateBetaSession(cookieStore.get(levytateBetaSessionCookie)?.value);
}

export async function GET(request: Request, context: RouteContext) {
  const session = await sessionFromCookie();
  if (!session) return NextResponse.json({ message: "Unauthorised." }, { status: 401 });
  const { actionId } = await context.params;
  try {
    if (new URL(request.url).searchParams.get("management") === "true") {
      const detail = await getOperationalActionManagementDetail(session, actionId);
      return NextResponse.json({ ok: true, ...detail });
    }
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
    const body = parseAction(operationalActionInput, await readAuthenticatedJson(request, session.email));
    let action;
    if (body.command === "acknowledge") action = await acknowledgeOperationalAction(session, actionId, body.expectedVersion!);
    else if (body.command === "start") action = await startOperationalAction(session, actionId, body.expectedVersion!);
    else if (body.command === "complete") action = await completeOperationalAction(session, actionId, body.expectedVersion!, body.completionNote, body.resolvedOutsideLevyTate);
    else if (body.command === "dismiss" && body.dismissalKind) action = await dismissOperationalAction(session, actionId, body.expectedVersion!, body.dismissalReason ?? "", body.dismissalKind);
    else if (body.command === "assign" && body.ownerType) action = await assignOperationalActionOwner(session, actionId, body.expectedVersion!, { ownerType: body.ownerType, ownerUserId: body.ownerUserId, ownerDisplayName: body.ownerDisplayName });
    else if (body.command === "due_date") action = await updateOperationalActionDueDate(session, actionId, body.expectedVersion!, body.dueDate ?? "", body.dueDateReason);
    else if (body.command === "cancel" && body.cancellationKind) action = await cancelOperationalAction(session, actionId, body.expectedVersion!, body.cancellationReason ?? "", body.cancellationKind);
    else throw new LevyTateOperationalActionError("A supported action command is required.");
    return NextResponse.json({ ok: true, action });
  } catch (error) {
    return actionErrorResponse(error);
  }
}

function actionErrorResponse(error: unknown) {
  if (error instanceof ClientRequestError) return NextResponse.json({ message: error.message }, { status: error.status });
  const status = error instanceof LevyTateLearnerLifecyclePermissionError
    ? 403
    : error instanceof LevyTateOperationalActionConflictError
      ? 409
      : error instanceof LevyTateOperationalActionError
        ? 400
        : 500;
  if (status === 500) {
    logLevyTateServerError("operational-action-detail", error);
    return NextResponse.json({ error: "operational_action_update_failed", message: "The operational action could not be updated. Please try again." }, { status });
  }
  const message = status === 403
    ? "You do not have access to that operational action."
    : error instanceof Error
      ? error.message
      : "Operational action update failed.";
  return NextResponse.json({ message }, { status });
}
