import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { levytateBetaSessionCookie } from "@/lib/levytate/config/beta-access";
import { readAuthorisedLevyTateBetaSession } from "@/lib/server/levytate-authorised-session";
import { assertExpectedWorkspace, ClientRequestError, readAuthenticatedJson } from "@/lib/server/levytate-request-boundary";
import { autopilotActionInput, parseAction } from "@/lib/server/levytate-operational-input";
import { createAutopilotAction, dismissAutopilotSignal, getAutopilotWorkspace, LevyTateAutopilotError, refreshAutopilotWorkspace } from "@/lib/server/levytate-autopilot";
import { IntelligenceCommandError } from "@/lib/server/levytate-intelligence-commands";
import { logLevyTateServerError } from "@/lib/server/levytate-safe-api-error";
import { LevyTateLearnerLifecyclePermissionError } from "@/lib/server/levytate-learner-lifecycle";

export async function GET(request: Request) {
  try {
    const session = await sessionFromCookie();
    if (!session) return noStore({ message: "Unauthorised." }, 401);
    await assertExpectedWorkspace(request, session.email);
    return noStore({ ok: true, workspace: await getAutopilotWorkspace(session) });
  } catch (error) { return safeError(error); }
}

export async function POST(request: Request) {
  try {
    const session = await sessionFromCookie();
    if (!session) return noStore({ message: "Unauthorised." }, 401);
    const body = parseAction(autopilotActionInput, await readAuthenticatedJson(request, session.email, 16 * 1024));
    if (body.action === "refresh") return noStore({ ok: true, workspace: await refreshAutopilotWorkspace(session, { idempotencyKey: body.idempotencyKey }) });
    if (body.action === "dismiss" && body.signalId) return noStore({ ok: true, workspace: await dismissAutopilotSignal(session, body.signalId, body.reason, { idempotencyKey: body.idempotencyKey, expectedRevision: body.expectedRevision }) });
    if (body.action === "create_action" && body.signalId) {
      return noStore({ ok: true, ...(await createAutopilotAction(session, body.signalId, {
        title: body.title ?? "", ownerType: body.ownerType ?? "", dueDate: body.dueDate ?? "", communicationDraft: body.communicationDraft ?? "",
      }, { idempotencyKey: body.idempotencyKey, expectedRevision: body.expectedRevision })) });
    }
    return noStore({ message: "A valid Autopilot action is required." }, 400);
  } catch (error) { return safeError(error); }
}

async function sessionFromCookie() { const store = await cookies(); return readAuthorisedLevyTateBetaSession(store.get(levytateBetaSessionCookie)?.value); }
function safeError(error: unknown) {
  if (error instanceof ClientRequestError) return noStore({ message: error.message }, error.status);
  if (error instanceof IntelligenceCommandError) return noStore({ message: error.message }, error.status);
  if (error instanceof LevyTateAutopilotError) return noStore({ message: error.message }, error.status);
  if (error instanceof LevyTateLearnerLifecyclePermissionError) return noStore({ message: "You do not have access to organisation Operations Autopilot." }, 403);
  logLevyTateServerError("operations-autopilot", error);
  return noStore({ message: "Operations Autopilot is temporarily unavailable." }, 503);
}
function noStore(body: unknown, status = 200) { return NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store, max-age=0" } }); }
