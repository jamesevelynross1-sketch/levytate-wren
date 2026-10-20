import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { levytateBetaSessionCookie } from "@/lib/levytate/config/beta-access";
import { readAuthorisedLevyTateBetaSession } from "@/lib/server/levytate-authorised-session";
import { BoundedJsonBodyError, readBoundedJson } from "@/lib/server/bounded-json";
import {
  applyPastoralMutationForSession,
  getPastoralWorkspaceForSession,
  LevyTatePastoralError,
} from "@/lib/server/levytate-pastoral";

export async function GET() {
  const session = await authorisedSession();
  if (!session) return reply({ message: "Unauthorised." }, 401);
  try {
    return reply({ ok: true, workspace: await getPastoralWorkspaceForSession(session) });
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: Request) {
  const session = await authorisedSession();
  if (!session) return reply({ message: "Unauthorised." }, 401);
  if (request.headers.get("origin") !== new URL(request.url).origin) return reply({ message: "Forbidden." }, 403);
  try {
    const action = await readBoundedJson(request, 20 * 1024);
    return reply({ ok: true, workspace: await applyPastoralMutationForSession(session, action) });
  } catch (error) {
    if (error instanceof BoundedJsonBodyError) return reply({ message: error.tooLarge ? "The My Support action is too large." : "A valid My Support action is required." }, error.tooLarge ? 413 : 400);
    return failure(error);
  }
}

async function authorisedSession() {
  const store = await cookies();
  return readAuthorisedLevyTateBetaSession(store.get(levytateBetaSessionCookie)?.value);
}

function failure(error: unknown) {
  if (error instanceof LevyTatePastoralError) return reply({ message: error.message }, error.status);
  console.error("LevyTate My Support route failed", error instanceof Error ? error.name : "unknown");
  return reply({ message: "My Support is temporarily unavailable." }, 503);
}

function reply(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store, max-age=0", "X-Robots-Tag": "noindex, nofollow" } });
}
