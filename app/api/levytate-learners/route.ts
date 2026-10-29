import { readAuthenticatedJson, ClientRequestError } from "@/lib/server/levytate-request-boundary";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { levytateBetaSessionCookie } from "@/lib/levytate/config/beta-access";
import { readAuthorisedLevyTateBetaSession } from "@/lib/server/levytate-authorised-session";
import {
  LevyTateLearnerLifecycleError,
  LevyTateLearnerLifecycleConflictError,
  LevyTateLearnerLifecyclePermissionError,
  LevyTateLearnerLifecycleValidationError,
  createLearnerRecord,
  getOrganisationLearnerLifecycleRecordDetail,
  listOrganisationLearnerLifecycleSummaries,
} from "@/lib/server/levytate-learner-lifecycle";
import { buildLearnerListSummary } from "@/lib/levytate/mvp/learner-record-view";

const headers = { "Cache-Control": "private, no-store, max-age=0" };

async function getSession() {
  const cookieStore = await cookies();
  return readAuthorisedLevyTateBetaSession(cookieStore.get(levytateBetaSessionCookie)?.value);
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ message: "Unauthorised." }, { status: 401, headers });
    const body = await readAuthenticatedJson(request, session.email) as Parameters<typeof createLearnerRecord>[1] | null;
    if (!body) return NextResponse.json({ message: "A valid learner onboarding request is required." }, { status: 400, headers });
    const record = await createLearnerRecord(session, { ...body, demonstrationRecord: false });
    const learner = await getOrganisationLearnerLifecycleRecordDetail(session, record.id);
    return NextResponse.json({ ok: true, source: "supabase", learner }, { status: 201, headers });
  } catch (error) {
    if (error instanceof ClientRequestError) return NextResponse.json({ message: error.message }, { status: error.status, headers });
    const status = error instanceof LevyTateLearnerLifecyclePermissionError ? 403 : error instanceof LevyTateLearnerLifecycleConflictError ? 409 : error instanceof LevyTateLearnerLifecycleValidationError ? 400 : 503;
    return NextResponse.json({ message: status === 403 ? "You do not have permission to create learner records." : [400, 409].includes(status) ? (error as Error).message : "The learner record could not be created. Please try again." }, { status, headers });
  }
}

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ message: "Unauthorised." }, { status: 401, headers });
    const learnerRecordId = new URL(request.url).searchParams.get("learnerRecordId")?.trim();
    if (learnerRecordId) {
      const learner = await getOrganisationLearnerLifecycleRecordDetail(session, learnerRecordId);
      return NextResponse.json({ ok: true, source: "supabase", learner }, { headers });
    }

    const learners = await listOrganisationLearnerLifecycleSummaries(session);
    return NextResponse.json({
      ok: true,
      source: "supabase",
      summary: buildLearnerListSummary(learners),
      learners,
    }, { headers });
  } catch (error) {
    const status = error instanceof LevyTateLearnerLifecyclePermissionError
      ? 403
      : error instanceof LevyTateLearnerLifecycleError
        ? 404
        : 503;

    return NextResponse.json({ message: messageFor(status) }, { status, headers });
  }
}

function messageFor(status: number) {
  if (status === 403) return "You do not have access to organisation learner records.";
  if (status === 404) return "Learner record was not found.";
  return "Learner lifecycle records are temporarily unavailable.";
}
