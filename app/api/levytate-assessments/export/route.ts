import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { levytateBetaSessionCookie } from "@/lib/levytate/config/beta-access";
import { readAuthorisedLevyTateBetaSession } from "@/lib/server/levytate-authorised-session";
import { getAssessmentCampaignExportForSession, LevyTateAssessmentError } from "@/lib/server/levytate-assessments";

export async function GET(request: Request) {
  const store = await cookies();
  const session = await readAuthorisedLevyTateBetaSession(store.get(levytateBetaSessionCookie)?.value);
  if (!session) return NextResponse.json({ message: "Unauthorised." }, { status: 401 });
  const campaignId = new URL(request.url).searchParams.get("campaignId")?.trim() || "";
  try {
    const csv = await getAssessmentCampaignExportForSession(session, campaignId);
    return new NextResponse(csv, { status: 200, headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": "attachment; filename=levytate-assessment-report.csv", "Cache-Control": "private, no-store, max-age=0", "X-Robots-Tag": "noindex, nofollow" } });
  } catch (error) {
    const status = error instanceof LevyTateAssessmentError ? error.status : 503;
    return NextResponse.json({ message: error instanceof LevyTateAssessmentError ? error.message : "Assessment export is temporarily unavailable." }, { status, headers: { "Cache-Control": "private, no-store, max-age=0" } });
  }
}
