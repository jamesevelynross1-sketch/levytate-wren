import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { levytateBetaSessionCookie } from "@/lib/levytate/config/beta-access";
import { ClientRequestError, readAuthenticatedJson } from "@/lib/server/levytate-request-boundary";
import { intelligenceActionInput, parseAction } from "@/lib/server/levytate-operational-input";
import { readAuthorisedLevyTateBetaSession } from "@/lib/server/levytate-authorised-session";
import { analyseAndPersistIntelligenceSignals, listIntelligenceSignals, updateIntelligenceSignal } from "@/lib/server/levytate-intelligence-signals";
import { LevyTateLearnerLifecyclePermissionError } from "@/lib/server/levytate-learner-lifecycle";

async function sessionFromCookie() {
  const store = await cookies();
  return readAuthorisedLevyTateBetaSession(store.get(levytateBetaSessionCookie)?.value);
}

export async function GET() {
  const session = await sessionFromCookie();
  if (!session) return response({ message: "Unauthorised." }, 401);
  try { return response({ ok: true, signals: await listIntelligenceSignals(session) }); }
  catch (error) { return errorResponse(error); }
}

export async function POST(request: Request) {
  const session = await sessionFromCookie();
  if (!session) return response({ message: "Unauthorised." }, 401);
  try {
    const body = parseAction(intelligenceActionInput, await readAuthenticatedJson(request, session.email));
    if (body.action === "analyse") return response({ ok: true, ...(await analyseAndPersistIntelligenceSignals(session)) });
    return response({ ok: true, signal: await updateIntelligenceSignal(session, body.signalId, body.action, body.action === "dismiss" ? body.reason : undefined) });
  } catch (error) { return errorResponse(error); }
}

function errorResponse(error: unknown) {
  if (error instanceof ClientRequestError) return response({ message: error.message }, error.status);
  const status = error instanceof LevyTateLearnerLifecyclePermissionError ? 403 : 500;
  return response({ message: status === 403 ? "You do not have access to organisation Intelligence." : "LevyTate Intelligence is temporarily unavailable." }, status);
}
function response(body: unknown, status = 200) { return NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store, max-age=0" } }); }
