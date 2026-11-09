import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { levytateBetaSessionCookie } from "@/lib/levytate/config/beta-access";
import { readAuthorisedLevyTateBetaSession } from "@/lib/server/levytate-authorised-session";
import { lifecycleErrorResponse } from "@/lib/server/levytate-learner-api";
import { getOrganisationLearnerLifecycleRecordDetail, getLearnerLifecycleServerContext } from "@/lib/server/levytate-learner-lifecycle";

import { assertExpectedAccount } from "@/lib/server/levytate-request-boundary";

async function getSession() {
  const cookieStore = await cookies();
  return readAuthorisedLevyTateBetaSession(cookieStore.get(levytateBetaSessionCookie)?.value);
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ learnerRecordId: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: "Unauthorised." }, { status: 401 });
  }

  try {
    assertExpectedAccount(request, session.email);
    const { organisation } = await getLearnerLifecycleServerContext(session);
    const { learnerRecordId } = await params;
    const learner = await getOrganisationLearnerLifecycleRecordDetail(session, learnerRecordId);
    return NextResponse.json({ ok: true, source: "supabase", organisationId: organisation.id, learner });
  } catch (error) {
    return lifecycleErrorResponse(error);
  }
}
