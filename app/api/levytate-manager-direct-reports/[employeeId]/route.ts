import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { levytateBetaSessionCookie } from "@/lib/levytate/config/beta-access";
import { readAuthorisedLevyTateBetaSession } from "@/lib/server/levytate-authorised-session";
import { getManagerDirectReportLearnerDetail } from "@/lib/server/levytate-manager-learner-detail";

export async function GET(_request: Request, context: { params: Promise<{ employeeId: string }> }) {
  const cookieStore = await cookies();
  const session = await readAuthorisedLevyTateBetaSession(cookieStore.get(levytateBetaSessionCookie)?.value);
  if (!session) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  try {
    const { employeeId } = await context.params;
    const detail = await getManagerDirectReportLearnerDetail(session, employeeId);
    return NextResponse.json({ detail }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "This employee record could not be opened." }, { status: 404 });
  }
}
