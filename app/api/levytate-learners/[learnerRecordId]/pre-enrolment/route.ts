import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { levytateBetaSessionCookie } from "@/lib/levytate/config/beta-access";
import { readAuthorisedLevyTateBetaSession } from "@/lib/server/levytate-authorised-session";
import { lifecycleErrorResponse } from "@/lib/server/levytate-learner-api";
import { updateLearnerPreEnrolmentProgress, type PreEnrolmentUpdateInput } from "@/lib/server/levytate-learner-lifecycle";

async function getSession() {
  const cookieStore = await cookies();
  return readAuthorisedLevyTateBetaSession(cookieStore.get(levytateBetaSessionCookie)?.value);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ learnerRecordId: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: "Unauthorised." }, { status: 401 });
  }

  try {
    const body = (await request.json()) as PreEnrolmentUpdateInput;
    const { learnerRecordId } = await params;
    const learner = await updateLearnerPreEnrolmentProgress(session, learnerRecordId, body);
    return NextResponse.json({ ok: true, source: "supabase", learner, readiness: learner.enrolmentReadiness });
  } catch (error) {
    return lifecycleErrorResponse(error);
  }
}
