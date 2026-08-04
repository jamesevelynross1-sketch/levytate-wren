import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { publicTrustPages } from "@/lib/levytate/public-trust-content";
import { levytateBetaSessionCookie } from "@/lib/levytate/config/beta-access";
import { readAuthorisedLevyTateBetaSession } from "@/lib/server/levytate-authorised-session";
import { getPublicTrustGovernance } from "@/lib/server/levytate-public-trust-governance";

export async function GET() {
  const cookieStore = await cookies();
  const session = await readAuthorisedLevyTateBetaSession(cookieStore.get(levytateBetaSessionCookie)?.value);
  if (!session) return NextResponse.json({ message: "Unauthorised." }, { status: 401 });
  if (session.accessLevel !== "beta_admin") return NextResponse.json({ message: "Forbidden." }, { status: 403 });
  const governance = getPublicTrustGovernance();
  const publications = Object.values(publicTrustPages).map((page) => ({ slug: page.slug, title: page.title, version: page.version, effectiveDate: page.effectiveDate, lastReviewedDate: page.lastReviewedDate, ...governance[page.slug] }));
  return NextResponse.json({ ok: true, publications });
}
