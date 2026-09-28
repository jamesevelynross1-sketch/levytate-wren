import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { levytateBetaSessionCookie } from "@/lib/levytate/config/beta-access";
import { readAuthorisedLevyTateBetaSession } from "@/lib/server/levytate-authorised-session";
import { BoundedJsonBodyError, readBoundedJson } from "@/lib/server/bounded-json";
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
  if (request.headers.get("origin") !== new URL(request.url).origin) return noStore({ message: "Forbidden." }, 403);
  try {
    const body = await readBody(request);
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

type AutopilotRequest = { action?: "refresh" | "dismiss" | "create_action"; signalId?: string; reason?: string; title?: string; ownerType?: string; dueDate?: string; communicationDraft?: string };

async function readBody(request: Request): Promise<AutopilotRequest> {
  try { return await readBoundedJson(request, 16 * 1024) as AutopilotRequest; }
  catch (error) {
    if (error instanceof BoundedJsonBodyError && error.tooLarge) throw new LevyTateAutopilotError("The Autopilot action is too large.", 413);
    throw new LevyTateAutopilotError("A valid Autopilot action is required.", 400);
  }
}
async function sessionFromCookie() { const store = await cookies(); return readAuthorisedLevyTateBetaSession(store.get(levytateBetaSessionCookie)?.value); }
function safeError(error: unknown) {
  if (error instanceof LevyTateAutopilotError) return noStore({ message: error.message }, error.status);
  if (error instanceof LevyTateLearnerLifecyclePermissionError) return noStore({ message: "You do not have access to organisation Operations Autopilot." }, 403);
  console.error("LevyTate Operations Autopilot route failed", error instanceof Error ? error.name : "unknown");
  return noStore({ message: "Operations Autopilot is temporarily unavailable." }, 503);
}
function noStore(body: unknown, status = 200) { return NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store, max-age=0" } }); }
