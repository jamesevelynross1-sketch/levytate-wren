import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { levytateBetaSessionCookie } from "@/lib/levytate/config/beta-access";
import { readAuthorisedLevyTateBetaSession } from "@/lib/server/levytate-authorised-session";
import { ClientRequestError, readAuthenticatedJson } from "@/lib/server/levytate-request-boundary";
import { guidanceSourcePatch, parseAction } from "@/lib/server/levytate-operational-input";
import {
  GuidanceSourcePermissionError,
  getGuidanceSources,
  updateGuidanceSourceForSession,
} from "@/lib/server/levytate-guidance-sources";
import { LevyTateSupabaseError } from "@/lib/server/levytate-supabase";

async function getSession() {
  const cookieStore = await cookies();
  return readAuthorisedLevyTateBetaSession(cookieStore.get(levytateBetaSessionCookie)?.value);
}

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: "Unauthorised." }, { status: 401 });
  }

  if (session.accessLevel !== "beta_admin") {
    return NextResponse.json({ message: "Forbidden." }, { status: 403 });
  }

  return NextResponse.json({ ok: true, registry: await getGuidanceSources() });
}

export async function PATCH(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: "Unauthorised." }, { status: 401 });
  }

  try {
    const body = parseAction(guidanceSourcePatch, await readAuthenticatedJson(request, session.email));
    if (typeof body.id !== "string" || !body.id.trim()) {
      return NextResponse.json({ message: "Trusted source id is required." }, { status: 400 });
    }

    const source = await updateGuidanceSourceForSession(session, body.id, body.patch ?? {});
    return NextResponse.json({ ok: true, source, registry: await getGuidanceSources() });
  } catch (error) {
    if (error instanceof ClientRequestError) return NextResponse.json({ message: error.message }, { status: error.status });
    const status = error instanceof GuidanceSourcePermissionError ? 403 : error instanceof LevyTateSupabaseError ? 503 : 500;
    return NextResponse.json(
      { message: status === 403 ? "Only an authorised administrator may update trusted sources." : "Trusted source registry could not be updated." },
      { status },
    );
  }
}
