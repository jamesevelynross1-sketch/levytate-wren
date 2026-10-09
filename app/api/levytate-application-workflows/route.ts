import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { levytateBetaSessionCookie } from "@/lib/levytate/config/beta-access";
import type { ApplicationWorkflowStep } from "@/lib/levytate/application-workflows/domain";
import { readAuthorisedLevyTateBetaSession } from "@/lib/server/levytate-authorised-session";
import { BoundedJsonBodyError, readBoundedJson } from "@/lib/server/bounded-json";
import {
  ApplicationWorkflowServiceError,
  createApplicationWorkflowDraft,
  getApplicationWorkflowAdminState,
  publishApplicationWorkflowDraft,
  startApplicationWorkflow,
  transitionApplicationWorkflowForSession,
  updateApplicationWorkflowDraft,
} from "@/lib/server/levytate-application-workflows";

export async function GET() {
  const session = await authorisedSession();
  if (!session) return reply({ message: "Unauthorised." }, 401);
  try { return reply(await getApplicationWorkflowAdminState(session)); } catch (error) { return failure(error); }
}

export async function POST(request: Request) {
  const session = await authorisedSession();
  if (!session) return reply({ message: "Unauthorised." }, 401);
  if (request.headers.get("origin") !== new URL(request.url).origin) return reply({ message: "Forbidden." }, 403);
  try {
    const body = await readBoundedJson(request, 32 * 1024) as { action?: string; transitionAction?: string; versionId?: string; steps?: ApplicationWorkflowStep[]; applicationId?: string; idempotencyKey?: string; note?: string; expectedLockVersion?: number };
    if (body.action === "create_draft") return reply({ draft: await createApplicationWorkflowDraft(session) }, 201);
    if (body.action === "start" && body.applicationId && body.idempotencyKey) return reply({ instance: await startApplicationWorkflow(session, body.applicationId, body.idempotencyKey) }, 201);
    if (body.action === "transition" && body.applicationId && body.idempotencyKey && typeof body.expectedLockVersion === "number") return reply({ instance: await transitionApplicationWorkflowForSession(session, { applicationId: body.applicationId, action: String(body.transitionAction ?? ""), note: body.note, idempotencyKey: body.idempotencyKey, expectedLockVersion: body.expectedLockVersion }) });
    if (!body.versionId) return reply({ message: "versionId is required." }, 400);
    if (body.action === "save_draft" && Array.isArray(body.steps)) return reply({ draft: await updateApplicationWorkflowDraft(session, body.versionId, body.steps) });
    if (body.action === "publish") return reply({ published: await publishApplicationWorkflowDraft(session, body.versionId) });
    return reply({ message: "Unsupported workflow action." }, 400);
  } catch (error) {
    if (error instanceof BoundedJsonBodyError) return reply({ message: error.tooLarge ? "The workflow action is too large." : "A valid workflow action is required." }, error.tooLarge ? 413 : 400);
    return failure(error);
  }
}

async function authorisedSession() {
  const store = await cookies();
  return readAuthorisedLevyTateBetaSession(store.get(levytateBetaSessionCookie)?.value);
}

function failure(error: unknown) {
  const status = error instanceof ApplicationWorkflowServiceError ? error.status : 500;
  if (!(error instanceof ApplicationWorkflowServiceError)) console.error("Application workflow route failed", error instanceof Error ? error.name : "unknown");
  return reply({ message: error instanceof ApplicationWorkflowServiceError ? error.message : "Application workflows are temporarily unavailable." }, status);
}

function reply(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store, max-age=0" } });
}
