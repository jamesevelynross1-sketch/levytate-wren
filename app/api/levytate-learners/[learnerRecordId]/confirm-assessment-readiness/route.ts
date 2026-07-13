import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { levytateBetaSessionCookie, readLevyTateBetaSession } from "@/lib/levytate/config/beta-access";
import { lifecycleErrorResponse } from "@/lib/server/levytate-learner-api";
import { confirmLearnerAssessmentReadiness, type ConfirmAssessmentReadinessInput } from "@/lib/server/levytate-learner-lifecycle";

export async function POST(request: Request, { params }: { params: Promise<{ learnerRecordId: string }> }) {
  const cookieStore = await cookies();
  const session = await readLevyTateBetaSession(cookieStore.get(levytateBetaSessionCookie)?.value);
  if (!session) return NextResponse.json({ message: "Unauthorised." }, { status: 401 });
  try {
    const { learnerRecordId } = await params;
    const result = await confirmLearnerAssessmentReadiness(session, learnerRecordId, await request.json() as ConfirmAssessmentReadinessInput);
    return NextResponse.json({ ok: true, source: "supabase", ...result, message: result.created ? "Assessment readiness confirmed." : "Assessment readiness is already confirmed." });
  } catch (error) {
    return lifecycleErrorResponse(error);
  }
}
