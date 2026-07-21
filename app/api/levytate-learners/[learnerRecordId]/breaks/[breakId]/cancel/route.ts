import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { levytateBetaSessionCookie } from "@/lib/levytate/config/beta-access";
import { readAuthorisedLevyTateBetaSession } from "@/lib/server/levytate-authorised-session";
import { lifecycleErrorResponse } from "@/lib/server/levytate-learner-api";
import { cancelBreakInLearning, type CancelBreakInput } from "@/lib/server/levytate-learner-lifecycle";

export async function POST(request: Request, { params }: { params: Promise<{ learnerRecordId: string; breakId: string }> }) {
  const cookieStore = await cookies();
  const session = await readAuthorisedLevyTateBetaSession(cookieStore.get(levytateBetaSessionCookie)?.value);
  if (!session) return NextResponse.json({ message: "Unauthorised." }, { status: 401 });
  try {
    const { learnerRecordId, breakId } = await params;
    const result = await cancelBreakInLearning(session, learnerRecordId, breakId, await request.json() as CancelBreakInput);
    return NextResponse.json({ ok: true, source: "supabase", message: result.created ? "Break in learning record cancelled." : "Break cancellation already recorded.", ...result });
  } catch (error) {
    return lifecycleErrorResponse(error);
  }
}
