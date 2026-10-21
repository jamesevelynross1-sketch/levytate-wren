import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { EXPLORE_ENQUIRY_STATUSES, type ExploreEnquiryStatus } from "@/lib/levytate/explore/policy";
import { levytateBetaSessionCookie } from "@/lib/levytate/config/beta-access";
import { readAuthorisedLevyTateBetaSession } from "@/lib/server/levytate-authorised-session";
import { listExploreEnquiries } from "@/lib/server/levytate-explore";

const headers = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" };

export async function GET(request: Request) {
  const sessionCookies = await cookies();
  const session = await readAuthorisedLevyTateBetaSession(
    sessionCookies.get(levytateBetaSessionCookie)?.value,
  );
  if (!session) return NextResponse.json({ message: "Unauthorised." }, { status: 401, headers });
  if (session.accessLevel !== "beta_admin") {
    return NextResponse.json({ message: "Forbidden." }, { status: 403, headers });
  }

  const url = new URL(request.url);
  const requestedStatus = url.searchParams.get("status") || "";
  const status = EXPLORE_ENQUIRY_STATUSES.includes(requestedStatus as ExploreEnquiryStatus)
    ? requestedStatus as ExploreEnquiryStatus : undefined;
  try {
    const enquiries = await listExploreEnquiries(status, 100);
    return NextResponse.json({ ok: true, enquiries }, { headers });
  } catch {
    return NextResponse.json({ message: "Enquiries are unavailable. The private lead store may not be configured." }, { status: 503, headers });
  }
}
