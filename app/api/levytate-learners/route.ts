import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { levytateBetaSessionCookie } from "@/lib/levytate/config/beta-access";
import { readAuthorisedLevyTateBetaSession } from "@/lib/server/levytate-authorised-session";
import {
  LevyTateLearnerLifecycleError,
  LevyTateLearnerLifecyclePermissionError,
  LevyTateLearnerLifecycleValidationError,
  createLearnerRecord,
  getOrganisationLearnerLifecycleRecordDetail,
  listOrganisationLearnerLifecycleSummaries,
} from "@/lib/server/levytate-learner-lifecycle";
import { buildLearnerListSummary } from "@/lib/levytate/mvp/learner-record-view";

async function getSession() {
  const cookieStore = await cookies();
  return readAuthorisedLevyTateBetaSession(cookieStore.get(levytateBetaSessionCookie)?.value);
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: "Unauthorised." }, { status: 401 });
  try {
    const body = await request.json().catch(() => null) as Parameters<typeof createLearnerRecord>[1] | null;
    if (!body) return NextResponse.json({ message: "A valid learner onboarding request is required." }, { status: 400 });
    const record = await createLearnerRecord(session, { ...body, demonstrationRecord: false });
    const learner = await getOrganisationLearnerLifecycleRecordDetail(session, record.id);
    return NextResponse.json({ ok: true, source: "supabase", learner }, { status: 201 });
  } catch (error) {
    const status = error instanceof LevyTateLearnerLifecyclePermissionError ? 403 : error instanceof LevyTateLearnerLifecycleValidationError ? 400 : 500;
    return NextResponse.json({ message: status === 403 ? "You do not have permission to create learner records." : status === 400 ? (error as Error).message : "The learner record could not be created." }, { status });
  }
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
