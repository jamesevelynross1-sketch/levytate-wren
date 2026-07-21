import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { levytateBetaSessionCookie } from "@/lib/levytate/config/beta-access";
import { readAuthorisedLevyTateBetaSession } from "@/lib/server/levytate-authorised-session";
import {
  LevyTateLearnerLifecycleError,
  LevyTateLearnerLifecyclePermissionError,
  getOrganisationLearnerLifecycleRecordDetail,
  listOrganisationLearnerLifecycleSummaries,
} from "@/lib/server/levytate-learner-lifecycle";
import { buildLearnerListSummary } from "@/lib/levytate/mvp/learner-record-view";

async function getSession() {
  const cookieStore = await cookies();
  return readAuthorisedLevyTateBetaSession(cookieStore.get(levytateBetaSessionCookie)?.value);
}

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: "Unauthorised." }, { status: 401 });
  }

  const url = new URL(request.url);
  const learnerRecordId = url.searchParams.get("learnerRecordId")?.trim();

  try {
    if (learnerRecordId) {
      const learner = await getOrganisationLearnerLifecycleRecordDetail(session, learnerRecordId);
      return NextResponse.json({ ok: true, source: "supabase", learner });
    }

    const learners = await listOrganisationLearnerLifecycleSummaries(session);
    return NextResponse.json({
      ok: true,
      source: "supabase",
      summary: buildLearnerListSummary(learners),
      learners,
    });
  } catch (error) {
    const status = error instanceof LevyTateLearnerLifecyclePermissionError
      ? 403
      : error instanceof LevyTateLearnerLifecycleError
        ? 404
        : 500;

    return NextResponse.json({ message: messageFor(error, status) }, { status });
  }
}

function messageFor(error: unknown, status: number) {
  if (status === 403) return "You do not have access to organisation learner records.";
  if (status === 404) return "Learner record was not found.";
  if (error instanceof Error) return error.message;
  return "Learner lifecycle records are temporarily unavailable.";
}
