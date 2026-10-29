import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { levytateBetaSessionCookie } from "@/lib/levytate/config/beta-access";
import { readAuthorisedLevyTateBetaSession } from "@/lib/server/levytate-authorised-session";
import { ClientRequestError, readAuthenticatedJson } from "@/lib/server/levytate-request-boundary";
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
  try {
    const action = await readAuthenticatedJson(request, session.email, 20 * 1024);
    return reply({ ok: true, workspace: await applyPastoralMutationForSession(session, action) });
  } catch (error) {
    if (error instanceof ClientRequestError) return reply({ message: error.message }, error.status);
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
