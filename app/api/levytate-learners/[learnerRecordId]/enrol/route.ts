import { cookies } from "next/headers";
import { readAuthenticatedJson } from "@/lib/server/levytate-request-boundary";
import { parseAction, learnerEnrolmentInput } from "@/lib/server/levytate-operational-input";
import { NextResponse } from "next/server";
import { levytateBetaSessionCookie } from "@/lib/levytate/config/beta-access";
import { readAuthorisedLevyTateBetaSession } from "@/lib/server/levytate-authorised-session";
import { lifecycleErrorResponse } from "@/lib/server/levytate-learner-api";
import { markLearnerAsEnrolled } from "@/lib/server/levytate-learner-lifecycle";

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
    const input = parseAction(learnerEnrolmentInput, await readAuthenticatedJson(request, session.email, 16 * 1024));
    const { learnerRecordId } = await params;
    const learner = await markLearnerAsEnrolled(session, learnerRecordId, input);
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
