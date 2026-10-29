import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { levytateBetaSessionCookie } from "@/lib/levytate/config/beta-access";
import { readAuthorisedLevyTateBetaSession } from "@/lib/server/levytate-authorised-session";
import { acceptCurrentEarlyAccessTerms, EarlyAccessTermsError } from "@/lib/server/levytate-early-access-terms";
import { ClientRequestError, readBrowserForm } from "@/lib/server/levytate-request-boundary";
import { levyTateAppHomePath, levyTateEmployerSignInPath } from "@/lib/levytate/hosts";

export async function POST(request: Request) {
  const { origin, hostname } = new URL(request.url);
  let body: URLSearchParams;
  try { body = await readBrowserForm(request, 1024); }
  catch (error) { return NextResponse.json({ message: "A valid same-origin terms submission is required." }, { status: error instanceof ClientRequestError ? error.status : 400 }); }
  const cookieStore = await cookies();
  const session = await readAuthorisedLevyTateBetaSession(cookieStore.get(levytateBetaSessionCookie)?.value, { allowTermsPending: true });
  if (!session) return NextResponse.redirect(new URL(levyTateEmployerSignInPath(hostname), origin), 303);
  try {
    if (body.getAll("acknowledged").length !== 1 || body.get("acknowledged") !== "yes" || [...body.keys()].some((key) => key !== "acknowledged")) return NextResponse.redirect(new URL("/levytate/accept-terms?error=acknowledgement", origin), 303);
    await acceptCurrentEarlyAccessTerms(session);
    return NextResponse.redirect(new URL(levyTateAppHomePath(hostname), origin), 303);
  } catch (error) {
    const reason = error instanceof EarlyAccessTermsError ? error.code : "unavailable";
    return NextResponse.redirect(new URL(`/levytate/accept-terms?error=${encodeURIComponent(reason)}`, origin), 303);
  }
}
