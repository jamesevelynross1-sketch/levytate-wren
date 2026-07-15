import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { levytateBetaSessionCookie, readLevyTateBetaSession } from "@/lib/levytate/config/beta-access";
import type { ManagerCheckInInput } from "@/lib/levytate/mvp/manager-check-in";
import {
  LevyTateManagerCheckInAccessError,
  LevyTateManagerCheckInConflictError,
  LevyTateManagerCheckInValidationError,
  recordManagerDirectReportCheckIn,
} from "@/lib/server/levytate-manager-check-ins";
import { getManagerDirectReportLearnerDetail } from "@/lib/server/levytate-manager-learner-detail";
import { logLevyTateServerError } from "@/lib/server/levytate-safe-api-error";

export async function POST(request: Request, { params }: { params: Promise<{ employeeId: string }> }) {
  const cookieStore = await cookies();
  const session = await readLevyTateBetaSession(cookieStore.get(levytateBetaSessionCookie)?.value);
  if (!session) return NextResponse.json({ message: "Unauthorised." }, { status: 401 });

  try {
    const { employeeId } = await params;
    const input = await request.json() as ManagerCheckInInput;
    const result = await recordManagerDirectReportCheckIn(session, employeeId, input);
    const detail = await getManagerDirectReportLearnerDetail(session, employeeId);
    return NextResponse.json({
      ok: true,
      source: "supabase",
      message: "Manager check-in recorded.",
      created: result.created,
      record: result.record,
      detail,
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof LevyTateManagerCheckInAccessError) {
      return NextResponse.json({ message: "This employee is no longer within your direct-report scope." }, { status: 403 });
    }
    if (error instanceof LevyTateManagerCheckInValidationError) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }
    if (error instanceof LevyTateManagerCheckInConflictError) {
      return NextResponse.json({ message: error.message }, { status: 409 });
    }
    logLevyTateServerError("manager-check-in", error);
    return NextResponse.json({
      error: "manager_check_in_failed",
      message: "This check-in could not be recorded. Refresh the learner record and try again.",
    }, { status: 500 });
  }
}
