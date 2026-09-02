import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { levytateBetaSessionCookie } from "@/lib/levytate/config/beta-access";
import type { IntelligenceDismissalReason } from "@/lib/levytate/intelligence/progress-review";
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
    const body = await request.json().catch(() => ({})) as { action?: "analyse" | "acknowledge" | "dismiss" | "accept"; signalId?: string; reason?: IntelligenceDismissalReason };
    if (body.action === "analyse") return response({ ok: true, ...(await analyseAndPersistIntelligenceSignals(session)) });
    if (!body.signalId || !body.action || !["acknowledge", "dismiss", "accept"].includes(body.action)) return response({ message: "A valid signal action is required." }, 400);
    return response({ ok: true, signal: await updateIntelligenceSignal(session, body.signalId, body.action as "acknowledge" | "dismiss" | "accept", body.reason) });
  } catch (error) { return errorResponse(error); }
}

function errorResponse(error: unknown) {
  const status = error instanceof LevyTateLearnerLifecyclePermissionError ? 403 : 500;
  return response({ message: status === 403 ? "You do not have access to organisation Intelligence." : "LevyTate Intelligence is temporarily unavailable." }, status);
}
function response(body: unknown, status = 200) { return NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store, max-age=0" } }); }
