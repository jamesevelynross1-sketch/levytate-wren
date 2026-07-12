import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { levytateBetaSessionCookie, readLevyTateBetaSession } from "@/lib/levytate/config/beta-access";
import { lifecycleErrorResponse } from "@/lib/server/levytate-learner-api";
import { markLearnerAsEnrolled } from "@/lib/server/levytate-learner-lifecycle";

async function getSession() {
  const cookieStore = await cookies();
  return readLevyTateBetaSession(cookieStore.get(levytateBetaSessionCookie)?.value);
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ learnerRecordId: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: "Unauthorised." }, { status: 401 });
  }

  try {
    const { learnerRecordId } = await params;
    const learner = await markLearnerAsEnrolled(session, learnerRecordId);
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
