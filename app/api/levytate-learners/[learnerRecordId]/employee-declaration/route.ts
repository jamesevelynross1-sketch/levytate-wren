import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { levytateBetaSessionCookie } from "@/lib/levytate/config/beta-access";
import { readAuthorisedLevyTateBetaSession } from "@/lib/server/levytate-authorised-session";
import { readBrowserJson, requireActionKeys } from "@/lib/server/levytate-request-boundary";
import { lifecycleErrorResponse } from "@/lib/server/levytate-learner-api";
import { confirmEmployeeEligibility, type EmployeeDeclarationInput } from "@/lib/server/levytate-learner-lifecycle";

export async function POST(request: Request, { params }: { params: Promise<{ learnerRecordId: string }> }) {
  const store = await cookies();
  const session = await readAuthorisedLevyTateBetaSession(store.get(levytateBetaSessionCookie)?.value);
  if (!session) return NextResponse.json({ message: "Unauthorised." }, { status: 401 });
  try {
    const input = await readBrowserJson(request);
    requireActionKeys(input, ["idempotencyKey", "expectedUpdatedAt", "confirmed", "expectedEnglandWorkingHoursPercentage"]);
    const { learnerRecordId } = await params;
    return NextResponse.json({ ok: true, learner: await confirmEmployeeEligibility(session, learnerRecordId, input as EmployeeDeclarationInput) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return lifecycleErrorResponse(error); }
}
