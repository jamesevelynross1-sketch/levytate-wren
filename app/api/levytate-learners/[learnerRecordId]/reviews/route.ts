import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { levytateBetaSessionCookie } from "@/lib/levytate/config/beta-access";
import { readAuthorisedLevyTateBetaSession } from "@/lib/server/levytate-authorised-session";
import { learnerReviewTypeLabels } from "@/lib/levytate/mvp/learner-lifecycle";
import { lifecycleErrorResponse } from "@/lib/server/levytate-learner-api";
import {
  addLearnerReview,
  getOrganisationLearnerLifecycleRecordDetail,
  type LearnerReviewInput,
} from "@/lib/server/levytate-learner-lifecycle";

async function getSession() {
  const cookieStore = await cookies();
  return readAuthorisedLevyTateBetaSession(cookieStore.get(levytateBetaSessionCookie)?.value);
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
    return NextResponse.json({ ok: true, source: "supabase", reviews: learner.reviewHistory, summaries: learner.reviewSummaries, activityVersion: learner.activityVersion });
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
    const input = await request.json() as LearnerReviewInput;
    const result = await addLearnerReview(session, learnerRecordId, input);
    const label = learnerReviewTypeLabels[result.record.reviewType];
    return NextResponse.json({ ok: true, source: "supabase", message: result.created ? `${label} recorded.` : `${label} already recorded.`, ...result });
  } catch (error) {
    return lifecycleErrorResponse(error);
  }
}
