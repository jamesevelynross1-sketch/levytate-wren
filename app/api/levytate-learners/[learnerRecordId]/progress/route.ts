import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { levytateBetaSessionCookie, readLevyTateBetaSession } from "@/lib/levytate/config/beta-access";
import { lifecycleErrorResponse } from "@/lib/server/levytate-learner-api";
import {
  addProgressUpdate,
  getOrganisationLearnerLifecycleRecordDetail,
  type ProgressUpdateInput,
} from "@/lib/server/levytate-learner-lifecycle";

async function getSession() {
  const cookieStore = await cookies();
  return readLevyTateBetaSession(cookieStore.get(levytateBetaSessionCookie)?.value);
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ learnerRecordId: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: "Unauthorised." }, { status: 401 });

  try {
    const { learnerRecordId } = await params;
    const learner = await getOrganisationLearnerLifecycleRecordDetail(session, learnerRecordId);
    return NextResponse.json({ ok: true, source: "supabase", progress: learner.progressHistory, latest: learner.latestProgress, progressPosition: learner.progressPosition, activityVersion: learner.activityVersion });
  } catch (error) {
    return lifecycleErrorResponse(error);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ learnerRecordId: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: "Unauthorised." }, { status: 401 });

  try {
    const { learnerRecordId } = await params;
    const input = await request.json() as ProgressUpdateInput;
    const result = await addProgressUpdate(session, learnerRecordId, input);
    return NextResponse.json({ ok: true, source: "supabase", message: result.created ? "Progress update recorded." : "Progress update already recorded.", ...result });
  } catch (error) {
    return lifecycleErrorResponse(error);
  }
}
