import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { levytateBetaSessionCookie } from "@/lib/levytate/config/beta-access";
import { assertExpectedWorkspace, ClientRequestError, readAuthenticatedJson } from "@/lib/server/levytate-request-boundary";
import { intelligenceActionInput, parseAction } from "@/lib/server/levytate-operational-input";
import { readAuthorisedLevyTateBetaSession } from "@/lib/server/levytate-authorised-session";
import { analyseAndPersistIntelligenceSignals, listIntelligenceSignals, updateIntelligenceSignal } from "@/lib/server/levytate-intelligence-signals";
import { IntelligenceCommandError } from "@/lib/server/levytate-intelligence-commands";
import { LevyTateLearnerLifecyclePermissionError } from "@/lib/server/levytate-learner-lifecycle";

async function sessionFromCookie() {
  const store = await cookies();
  return readAuthorisedLevyTateBetaSession(store.get(levytateBetaSessionCookie)?.value);
}

export async function GET(request: Request) {
  try {
    const session = await sessionFromCookie();
    if (!session) return response({ message: "Unauthorised." }, 401);
    await assertExpectedWorkspace(request, session.email);
    const workspace = await listIntelligenceSignals(session);
    assertReturnedReadScope(request, workspace.scope);
    return response({ ok: true, ...workspace });
  }
  catch (error) { return errorResponse(error); }
}

export async function POST(request: Request) {
  try {
    const session = await sessionFromCookie();
    if (!session) return response({ message: "Unauthorised." }, 401);
    const body = parseAction(intelligenceActionInput, await readAuthenticatedJson(request, session.email));
    const expectedOrganisationId = request.headers.get("x-levytate-organisation") ?? undefined;
    if (body.action === "analyse") return response({ ok: true, ...(await analyseAndPersistIntelligenceSignals(session, { idempotencyKey: body.idempotencyKey }, expectedOrganisationId)) });
    return response({ ok: true, ...(await updateIntelligenceSignal(session, body.signalId, body.action, body.action === "dismiss" ? body.reason : undefined, { idempotencyKey: body.idempotencyKey, expectedRevision: body.expectedRevision }, expectedOrganisationId)) });
  } catch (error) { return errorResponse(error); }
}

function errorResponse(error: unknown) {
  if (error instanceof ClientRequestError) return response({ message: error.message }, error.status);
  if (error instanceof IntelligenceCommandError) return response({ message: error.message }, error.status);
  const status = error instanceof LevyTateLearnerLifecyclePermissionError ? 403 : 503;
  return response({ message: status === 403 ? "You do not have access to organisation Intelligence." : "LevyTate Intelligence is temporarily unavailable." }, status);
}
function response(body: unknown, status = 200) { return NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store, max-age=0" } }); }

/** A canonical membership may change between the initial pin check and the read. */
function assertReturnedReadScope(request: Request, value: unknown) {
  const expectedOrganisation = request.headers.get("x-levytate-organisation");
  const expectedAccount = request.headers.get("x-levytate-account");
  if (expectedOrganisation === null && expectedAccount === null) return;
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new ClientRequestError("The workspace response could not be verified. Try loading again.", 503);
  const scope = value as Record<string, unknown>;
  if (typeof scope.organisationId !== "string" || !scope.organisationId || typeof scope.userEmail !== "string" || !scope.userEmail) throw new ClientRequestError("The workspace response could not be verified. Try loading again.", 503);
  if ((expectedOrganisation !== null && expectedOrganisation.trim().toLowerCase() !== scope.organisationId.toLowerCase())
    || (expectedAccount !== null && expectedAccount.trim().toLowerCase() !== scope.userEmail.trim().toLowerCase())) {
    throw new ClientRequestError("Your workspace has changed. Reload to reconnect.", 409);
  }
}
