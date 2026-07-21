import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { levytateBetaSessionCookie } from "@/lib/levytate/config/beta-access";
import { readAuthorisedLevyTateBetaSession } from "@/lib/server/levytate-authorised-session";
import { lifecycleErrorResponse } from "@/lib/server/levytate-learner-api";
import { getOrganisationLearnerLifecycleRecordDetail, startBreakInLearning, type StartBreakInLearningInput } from "@/lib/server/levytate-learner-lifecycle";

async function getSession() {
  const cookieStore = await cookies();
  return readAuthorisedLevyTateBetaSession(cookieStore.get(levytateBetaSessionCookie)?.value);
}

export async function GET(_request: Request, { params }: { params: Promise<{ learnerRecordId: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: "Unauthorised." }, { status: 401 });
  try {
    const { learnerRecordId } = await params;
    const learner = await getOrganisationLearnerLifecycleRecordDetail(session, learnerRecordId);
    return NextResponse.json({ ok: true, source: "supabase", activeBreak: learner.activeBreak, breakHistory: learner.breaksInLearning, breakAttention: learner.breakAttention, activityVersion: learner.activityVersion });
  } catch (error) {
    return lifecycleErrorResponse(error);
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ learnerRecordId: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: "Unauthorised." }, { status: 401 });
  try {
    const { learnerRecordId } = await params;
    const result = await startBreakInLearning(session, learnerRecordId, await request.json() as StartBreakInLearningInput);
    return NextResponse.json({ ok: true, source: "supabase", message: result.created ? "Break in learning started." : "Break in learning already recorded.", ...result });
  } catch (error) {
    return lifecycleErrorResponse(error);
  }
}
