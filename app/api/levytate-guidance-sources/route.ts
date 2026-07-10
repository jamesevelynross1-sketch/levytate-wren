import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { levytateBetaSessionCookie, readLevyTateBetaSession } from "@/lib/levytate/config/beta-access";
import type { GuidanceReviewStatus, GuidanceSourceStatus } from "@/lib/levytate/guidance/source-registry";
import {
  GuidanceSourcePermissionError,
  getGuidanceSources,
  updateGuidanceSourceForSession,
} from "@/lib/server/levytate-guidance-sources";
import { LevyTateSupabaseError } from "@/lib/server/levytate-supabase";

async function getSession() {
  const cookieStore = await cookies();
  return readLevyTateBetaSession(cookieStore.get(levytateBetaSessionCookie)?.value);
}

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: "Unauthorised." }, { status: 401 });
  }

  return NextResponse.json({ ok: true, registry: await getGuidanceSources() });
}

type PatchRequest = {
  id?: unknown;
  patch?: {
    reviewStatus?: GuidanceReviewStatus;
    sourceStatus?: GuidanceSourceStatus;
    copilotApproved?: boolean;
    notes?: string;
    lastChangeSummary?: string;
    monitoringNotes?: string;
  };
};

export async function PATCH(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: "Unauthorised." }, { status: 401 });
  }

  try {
    const body = (await request.json()) as PatchRequest;
    if (typeof body.id !== "string" || !body.id.trim()) {
      return NextResponse.json({ message: "Trusted source id is required." }, { status: 400 });
    }

    const source = await updateGuidanceSourceForSession(session, body.id, body.patch ?? {});
    return NextResponse.json({ ok: true, source, registry: await getGuidanceSources() });
  } catch (error) {
    const status = error instanceof GuidanceSourcePermissionError ? 403 : error instanceof LevyTateSupabaseError ? 503 : 500;
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Trusted source registry could not be updated." },
      { status },
    );
  }
}
