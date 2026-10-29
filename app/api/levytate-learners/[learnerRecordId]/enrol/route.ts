import { cookies } from "next/headers";
import { readAuthenticatedJson, requireActionKeys } from "@/lib/server/levytate-request-boundary";
import { NextResponse } from "next/server";
import { levytateBetaSessionCookie } from "@/lib/levytate/config/beta-access";
import { readAuthorisedLevyTateBetaSession } from "@/lib/server/levytate-authorised-session";
import { lifecycleErrorResponse } from "@/lib/server/levytate-learner-api";
import { markLearnerAsEnrolled, type EnrolmentConfirmationInput } from "@/lib/server/levytate-learner-lifecycle";

async function getSession() {
  const cookieStore = await cookies();
  return readAuthorisedLevyTateBetaSession(cookieStore.get(levytateBetaSessionCookie)?.value);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ learnerRecordId: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: "Unauthorised." }, { status: 401 });
  }

  try {
    const input = await readAuthenticatedJson(request, session.email);
    requireActionKeys(input, ["idempotencyKey", "expectedActivityVersion", "initialProgress", "firstReviewDate", "firstReviewerName"]);
    const { learnerRecordId } = await params;
    const learner = await markLearnerAsEnrolled(session, learnerRecordId, input as EnrolmentConfirmationInput);
    return NextResponse.json({
      ok: true,
      source: "supabase",
      learner,
      message: "Learner marked as enrolled. The lifecycle record is now active.",
    });
  } catch (error) {
    return lifecycleErrorResponse(error);
  }
}
