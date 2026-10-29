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
  LevyTateManagerOperationalActionAccessError,
  startOperationalAction,
  updateOperationalActionDueDate,
} from "@/lib/server/levytate-operational-actions";
import { logLevyTateServerError } from "@/lib/server/levytate-safe-api-error";
import { ClientRequestError, readAuthenticatedJson } from "@/lib/server/levytate-request-boundary";
import { operationalActionInput, parseAction } from "@/lib/server/levytate-operational-input";

type RouteContext = { params: Promise<{ actionId: string }> };
const responseHeaders = { "Cache-Control": "private, no-store, max-age=0" };
function reply(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: responseHeaders });
}

async function sessionFromCookie() {
  const cookieStore = await cookies();
  return readAuthorisedLevyTateBetaSession(cookieStore.get(levytateBetaSessionCookie)?.value);
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const session = await sessionFromCookie();
    if (!session) return reply({ message: "Unauthorised." }, 401);
    const { actionId } = await context.params;
    if (new URL(request.url).searchParams.get("management") === "true") {
      const detail = await getOperationalActionManagementDetail(session, actionId);
      return reply({ ok: true, ...detail });
    }
    const action = await getOperationalAction(session, actionId);
    const history = new URL(request.url).searchParams.get("history") === "true" ? await getOperationalActionHistory(session, actionId) : undefined;
    return reply({ ok: true, action, ...(history ? { history } : {}) });
  } catch (error) {
    return actionErrorResponse(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const session = await sessionFromCookie();
    if (!session) return reply({ message: "Unauthorised." }, 401);
    const { actionId } = await context.params;
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
    return reply({ ok: true, action });
  } catch (error) {
    return actionErrorResponse(error);
  }
}

function actionErrorResponse(error: unknown) {
  if (error instanceof ClientRequestError) return reply({ message: error.message }, error.status);
  const status = error instanceof LevyTateLearnerLifecyclePermissionError || error instanceof LevyTateManagerOperationalActionAccessError
    ? 403
    : error instanceof LevyTateOperationalActionConflictError
      ? 409
      : error instanceof LevyTateOperationalActionError
        ? 400
        : 503;
  if (status === 503) {
    logLevyTateServerError("operational-action-detail", error);
    return reply({ error: "operational_action_unavailable", message: "Operational actions are temporarily unavailable. Please try again." }, status);
  }
  const message = status === 403
    ? "You do not have access to that operational action."
    : error instanceof Error
      ? error.message
      : "Operational action update failed.";
  return reply({ message }, status);
}
