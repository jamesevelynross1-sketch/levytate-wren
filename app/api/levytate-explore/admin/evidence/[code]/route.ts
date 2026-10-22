import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { levytateBetaSessionCookie } from "@/lib/levytate/config/beta-access";
import { createExploreCatalogue } from "@/lib/levytate/explore/catalogue";
import { readAuthorisedLevyTateBetaSession } from "@/lib/server/levytate-authorised-session";
import { loadLevyTateStandards } from "@/lib/server/levytate-apprenticeship-standards";
import { ExploreOfficialSourceError, fetchExploreSourceEvidence } from "@/lib/server/levytate-explore-official";

const headers = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" };

/** Internal source evidence viewer for future reviewed De-fluff authoring. */
export async function GET(_request: Request, { params }: { params: Promise<{ code: string }> }) {
  const cookieStore = await cookies();
  const session = await readAuthorisedLevyTateBetaSession(
    cookieStore.get(levytateBetaSessionCookie)?.value,
  );
  if (!session) return NextResponse.json({ message: "Unauthorised." }, { status: 401, headers });
  if (session.accessLevel !== "beta_admin") {
    return NextResponse.json({ message: "Forbidden." }, { status: 403, headers });
  }

  const { code } = await params;
  if (!/^ST\d{4}$/i.test(code)) {
    return NextResponse.json({ message: "Unknown apprenticeship standard." }, { status: 404, headers });
  }
  try {
    const standards = await loadLevyTateStandards({
      status: "Approved for delivery",
      programmeType: "Apprenticeship standard",
    });
    const item = createExploreCatalogue(standards.standards).find(
      record => record.code === code.toUpperCase(),
    );
    if (!item) return NextResponse.json({ message: "Not in the approved catalogue." }, { status: 404, headers });

    const evidence = await fetchExploreSourceEvidence(item.code);
    return NextResponse.json({ ok: true, evidence }, { headers });
  } catch (cause) {
    if (cause instanceof ExploreOfficialSourceError) {
      const status = cause.reason === "not_configured" ? 503 : cause.reason === "not_found" ? 404 : 502;
      return NextResponse.json({
        message: cause.reason === "not_configured"
          ? "Skills England API access has not been configured."
          : cause.reason === "not_found"
            ? "No adequately matched official occupational evidence was returned. Do not generate a guide by title alone."
            : "The official evidence source is temporarily unavailable.",
      }, { status, headers });
    }
    return NextResponse.json({ message: "Official evidence lookup is unavailable." }, { status: 503, headers });
  }
}
