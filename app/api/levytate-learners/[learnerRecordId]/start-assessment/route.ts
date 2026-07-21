import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { levytateBetaSessionCookie } from "@/lib/levytate/config/beta-access";
import { readAuthorisedLevyTateBetaSession } from "@/lib/server/levytate-authorised-session";
import { lifecycleErrorResponse } from "@/lib/server/levytate-learner-api";
import { startLearnerAssessment, type StartAssessmentInput } from "@/lib/server/levytate-learner-lifecycle";

export async function POST(request: Request, { params }: { params: Promise<{ learnerRecordId: string }> }) {
  const cookieStore = await cookies();
  const session = await readAuthorisedLevyTateBetaSession(cookieStore.get(levytateBetaSessionCookie)?.value);
  if (!session) return NextResponse.json({ message: "Unauthorised." }, { status: 401 });
  try {
    const { learnerRecordId } = await params;
    const result = await startLearnerAssessment(session, learnerRecordId, await request.json() as StartAssessmentInput);
    return NextResponse.json({ ok: true, source: "supabase", ...result, message: "Learner marked as in assessment." });
  } catch (error) {
    return lifecycleErrorResponse(error);
  }
}
