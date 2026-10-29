import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { levytateBetaSessionCookie } from "@/lib/levytate/config/beta-access";
import { readAuthorisedLevyTateBetaSession } from "@/lib/server/levytate-authorised-session";
import { readAuthenticatedJson } from "@/lib/server/levytate-request-boundary";
import { parseAction, learnerOutcomeInput } from "@/lib/server/levytate-operational-input";
import { lifecycleErrorResponse } from "@/lib/server/levytate-learner-api";
import { recordLearnerOutcome } from "@/lib/server/levytate-learner-lifecycle";

export async function POST(request: Request, { params }: { params: Promise<{ learnerRecordId: string }> }) {
  const store = await cookies();
  const session = await readAuthorisedLevyTateBetaSession(store.get(levytateBetaSessionCookie)?.value);
  if (!session) return NextResponse.json({ message: "Unauthorised." }, { status: 401 });
  try {
    const input = parseAction(learnerOutcomeInput, await readAuthenticatedJson(request, session.email, 16 * 1024));
    const { learnerRecordId } = await params;
    return NextResponse.json({ ok: true, learner: await recordLearnerOutcome(session, learnerRecordId, input) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return lifecycleErrorResponse(error); }
}
