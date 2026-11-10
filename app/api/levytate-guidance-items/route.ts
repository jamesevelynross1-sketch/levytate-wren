import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { levytateBetaSessionCookie } from "@/lib/levytate/config/beta-access";
import { readAuthorisedLevyTateBetaSession } from "@/lib/server/levytate-authorised-session";
import { ClientRequestError, readAuthenticatedJson } from "@/lib/server/levytate-request-boundary";
import { guidanceItemPatch, guidanceItemSave, parseAction } from "@/lib/server/levytate-operational-input";
import {
  GuidanceSourcePermissionError,
  getGuidanceItemsForSession,
  saveGuidanceItemForSession,
  updateGuidanceItemStatusForSession,
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

  return NextResponse.json({ ok: true, registry: await getGuidanceItemsForSession(session) });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: "Unauthorised." }, { status: 401 });
  }

  try {
    const body = parseAction(guidanceItemSave, await readAuthenticatedJson(request, session.email));
    if (!body.item || !Array.isArray(body.sourceIds)) {
      return NextResponse.json({ message: "Guidance item and source ids are required." }, { status: 400 });
    }

    return NextResponse.json({ ok: true, registry: await saveGuidanceItemForSession(session, body.item, body.sourceIds) });
  } catch (error) {
    return NextResponse.json(
      { message: getMessage(error) },
      { status: getStatus(error) },
    );
  }
}

export async function PATCH(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: "Unauthorised." }, { status: 401 });
  }

  try {
    const body = parseAction(guidanceItemPatch, await readAuthenticatedJson(request, session.email));
    if (typeof body.id !== "string" || !body.id.trim()) {
      return NextResponse.json({ message: "Guidance item id is required." }, { status: 400 });
    }

    return NextResponse.json({ ok: true, registry: await updateGuidanceItemStatusForSession(session, body.id, body.patch ?? {}) });
  } catch (error) {
    return NextResponse.json(
      { message: getMessage(error) },
      { status: getStatus(error) },
    );
  }
}

function getStatus(error: unknown) {
  if (error instanceof ClientRequestError) return error.status;
  if (error instanceof GuidanceSourcePermissionError) return 403;
  if (error instanceof LevyTateSupabaseError) return 503;
  return 500;
}

function getMessage(error: unknown) {
  if (error instanceof ClientRequestError) return error.message;
  if (error instanceof GuidanceSourcePermissionError) return "Only an authorised administrator may update guidance.";
  return "Guidance items could not be updated.";
}
