import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { levytateBetaSessionCookie } from "@/lib/levytate/config/beta-access";
import { readAuthorisedLevyTateBetaSession } from "@/lib/server/levytate-authorised-session";
import type { GuidanceItem, GuidanceItemReviewStatus } from "@/lib/levytate/guidance/source-registry";
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

type PostBody = {
  item?: GuidanceItem;
  sourceIds?: string[];
};

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: "Unauthorised." }, { status: 401 });
  }

  try {
    const body = (await request.json()) as PostBody;
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

type PatchBody = {
  id?: unknown;
  patch?: {
    reviewStatus?: GuidanceItemReviewStatus;
    copilotApproved?: boolean;
  };
};

export async function PATCH(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: "Unauthorised." }, { status: 401 });
  }

  try {
    const body = (await request.json()) as PatchBody;
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
  if (error instanceof GuidanceSourcePermissionError) return 403;
  if (error instanceof LevyTateSupabaseError) return 503;
  return 500;
}

function getMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return "Guidance items could not be updated.";
}
