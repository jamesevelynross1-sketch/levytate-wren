import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { levytateBetaSessionCookie } from "@/lib/levytate/config/beta-access";
import { readAuthorisedLevyTateBetaSession } from "@/lib/server/levytate-authorised-session";
import { ClientRequestError, readAuthenticatedJson } from "@/lib/server/levytate-request-boundary";
import { autopilotActionInput, parseAction } from "@/lib/server/levytate-operational-input";
import { createAutopilotAction, dismissAutopilotSignal, getAutopilotWorkspace, LevyTateAutopilotError, refreshAutopilotWorkspace } from "@/lib/server/levytate-autopilot";
import { LevyTateLearnerLifecyclePermissionError } from "@/lib/server/levytate-learner-lifecycle";

export async function GET() {
  const session = await sessionFromCookie();
  if (!session) return noStore({ message: "Unauthorised." }, 401);
  try { return noStore({ ok: true, workspace: await getAutopilotWorkspace(session) }); }
  catch (error) { return safeError(error); }
}

export async function POST(request: Request) {
  const session = await sessionFromCookie();
  if (!session) return noStore({ message: "Unauthorised." }, 401);
  try {
    const body = parseAction(autopilotActionInput, await readAuthenticatedJson(request, session.email, 16 * 1024));
    if (body.action === "refresh") return noStore({ ok: true, workspace: await refreshAutopilotWorkspace(session) });
    if (body.action === "dismiss" && body.signalId) return noStore({ ok: true, workspace: await dismissAutopilotSignal(session, body.signalId, body.reason ?? "") });
    if (body.action === "create_action" && body.signalId) {
      return noStore({ ok: true, ...(await createAutopilotAction(session, body.signalId, {
        title: body.title ?? "", ownerType: body.ownerType ?? "", dueDate: body.dueDate ?? "", communicationDraft: body.communicationDraft ?? "",
      })) });
    }
    return noStore({ message: "A valid Autopilot action is required." }, 400);
  } catch (error) { return safeError(error); }
}

async function sessionFromCookie() { const store = await cookies(); return readAuthorisedLevyTateBetaSession(store.get(levytateBetaSessionCookie)?.value); }
function safeError(error: unknown) {
  if (error instanceof ClientRequestError) return noStore({ message: error.message }, error.status);
  if (error instanceof LevyTateAutopilotError) return noStore({ message: error.message }, error.status);
  if (error instanceof LevyTateLearnerLifecyclePermissionError) return noStore({ message: "You do not have access to organisation Operations Autopilot." }, 403);
  console.error("LevyTate Operations Autopilot route failed", error instanceof Error ? error.name : "unknown");
  return noStore({ message: "Operations Autopilot is temporarily unavailable." }, 503);
}
function noStore(body: unknown, status = 200) { return NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store, max-age=0" } }); }
