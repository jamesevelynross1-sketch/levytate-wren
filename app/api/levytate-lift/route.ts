import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { levytateBetaSessionCookie } from "@/lib/levytate/config/beta-access";
import { readAuthorisedLevyTateBetaSession } from "@/lib/server/levytate-authorised-session";
import { BoundedJsonBodyError, readBoundedJson } from "@/lib/server/bounded-json";
import { applyLiftActionForSession, getLiftWorkspaceForSession, LevyTateLiftError } from "@/lib/server/levytate-lift";

export async function GET() {
  const session = await currentSession();
  if (!session) return reply({ message: "Unauthorised." }, 401);
  try { return reply({ ok: true, workspace: await getLiftWorkspaceForSession(session) }); }
  catch (error) { return failure(error); }
}

export async function POST(request: Request) {
  const session = await currentSession();
  if (!session) return reply({ message: "Unauthorised." }, 401);
  if (request.headers.get("origin") !== new URL(request.url).origin) return reply({ message: "Forbidden." }, 403);
  try { return reply({ ok: true, workspace: await applyLiftActionForSession(session, await readBoundedJson(request, 96 * 1024)) }); }
  catch (error) { if (error instanceof BoundedJsonBodyError) return reply({ message: error.tooLarge ? "The Lift action is too large." : "A valid Lift action is required." }, error.tooLarge ? 413 : 400); return failure(error); }
}

async function currentSession() { const store = await cookies(); return readAuthorisedLevyTateBetaSession(store.get(levytateBetaSessionCookie)?.value); }
function failure(error: unknown) { if (error instanceof LevyTateLiftError) return reply({ message: error.message }, error.status); console.error("LevyTate Lift route failed", error instanceof Error ? error.name : "unknown"); return reply({ message: "Lift is temporarily unavailable." }, 503); }
function reply(body: unknown, status = 200) { return NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store, max-age=0", "X-Robots-Tag": "noindex, nofollow" } }); }
