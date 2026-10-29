import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { levytateBetaSessionCookie } from "@/lib/levytate/config/beta-access";
import { readAuthorisedLevyTateBetaSession } from "@/lib/server/levytate-authorised-session";
import { ClientRequestError, readAuthenticatedJson } from "@/lib/server/levytate-request-boundary";
import { applyLiftActionForSession, getLiftWorkspaceForSession, LevyTateLiftError } from "@/lib/server/levytate-lift";
import { LiftTransactionError } from "@/lib/server/levytate-lift-transaction";

export async function GET() {
  const session = await currentSession();
  if (!session) return reply({ message: "Unauthorised." }, 401);
  try { return reply({ ok: true, workspace: await getLiftWorkspaceForSession(session) }); }
  catch (error) { return failure(error); }
}

export async function POST(request: Request) {
  const session = await currentSession();
  if (!session) return reply({ message: "Unauthorised." }, 401);
  try { return reply({ ok: true, workspace: await applyLiftActionForSession(session, await readAuthenticatedJson(request, session.email, 96 * 1024)) }); }
  catch (error) { if (error instanceof ClientRequestError) return reply({ message: error.message }, error.status); return failure(error); }
}

async function currentSession() { const store = await cookies(); return readAuthorisedLevyTateBetaSession(store.get(levytateBetaSessionCookie)?.value); }
function failure(error: unknown) { if (error instanceof LevyTateLiftError || error instanceof LiftTransactionError) return reply({ message: error.message }, error.status); console.error("LevyTate Lift route failed", error instanceof Error ? error.name : "unknown"); return reply({ message: "Lift is temporarily unavailable." }, 503); }
function reply(body: unknown, status = 200) { return NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store, max-age=0", "X-Robots-Tag": "noindex, nofollow" } }); }
