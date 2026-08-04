import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { levytateBetaSessionCookie } from "@/lib/levytate/config/beta-access";
import { readAuthorisedLevyTateBetaSession } from "@/lib/server/levytate-authorised-session";
import { acceptCurrentEarlyAccessTerms, EarlyAccessTermsError } from "@/lib/server/levytate-early-access-terms";

export async function POST(request: Request) {
  const origin = new URL(request.url).origin;
  const cookieStore = await cookies();
  const session = await readAuthorisedLevyTateBetaSession(cookieStore.get(levytateBetaSessionCookie)?.value, { allowTermsPending: true });
  if (!session) return NextResponse.redirect(new URL("/levytate/login", origin), 303);
  try {
    const body = await request.formData();
    if (body.get("acknowledged") !== "yes") return NextResponse.redirect(new URL("/levytate/accept-terms?error=acknowledgement", origin), 303);
    await acceptCurrentEarlyAccessTerms(session);
    return NextResponse.redirect(new URL("/levytate/app", origin), 303);
  } catch (error) {
    const reason = error instanceof EarlyAccessTermsError ? error.code : "unavailable";
    return NextResponse.redirect(new URL(`/levytate/accept-terms?error=${encodeURIComponent(reason)}`, origin), 303);
  }
}
