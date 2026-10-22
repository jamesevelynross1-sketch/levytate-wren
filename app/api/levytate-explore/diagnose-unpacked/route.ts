import { NextResponse } from "next/server";
import { createExploreCatalogue } from "@/lib/levytate/explore/catalogue";
import { loadLevyTateStandards } from "@/lib/server/levytate-apprenticeship-standards";
import { fetchExploreSourceEvidence } from "@/lib/server/levytate-explore-official";
import { hasExploreGatewayAccess } from "@/lib/server/levytate-explore-generate";
import { isUnpackedPreviewEnabled, generateUnpackedPreview } from "@/lib/server/levytate-explore-preview";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Safe, temporary Preview-only probe. Never returns keys or raw official evidence. */
export async function GET(request: Request) {
  if (process.env.VERCEL_ENV !== "preview" ||
      process.env.VERCEL_GIT_COMMIT_REF !== "feature/levytate-explore-public-pwa") {
    return new NextResponse(null, { status: 404 });
  }
  const code = new URL(request.url).searchParams.get("code")?.toUpperCase() || "ST0078";
  if (!/^ST\d{4}$/.test(code)) return new NextResponse(null, { status: 400 });
  try {
    const source = await loadLevyTateStandards({
      status: "Approved for delivery", programmeType: "Apprenticeship standard",
    });
    const standard = createExploreCatalogue(source.standards).find(s => s.code === code);
    if (!standard) return NextResponse.json({ ok: false, code, reason: "not_in_catalogue" }, { status: 404 });
    // Temporary single-standard smoke test for the protected Preview only.
    // No personal information enters the model. Remove after successful QA.
    if (code === "ST0118" && new URL(request.url).searchParams.get("smoke") === "1") {
      if (!isUnpackedPreviewEnabled()) {
        return NextResponse.json({ ok: false, reason: "preview_not_enabled" }, { status: 503 });
      }
      const output = await generateUnpackedPreview(standard, request);
      return NextResponse.json({
        ok: true, code, model: "openai/gpt-5.4-mini",
        cached: output.fromCache,
        occupation: output.occupationCode,
        generatedAt: output.generatedAt,
        narrative: output.narrative,
      }, { headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });
    }
    const evidence = await fetchExploreSourceEvidence(code, standard.title);
    return NextResponse.json({
      ok: true, code, occupation: evidence.occupationCode,
      gatewayIdentityAvailable: hasExploreGatewayAccess(request.headers.get("x-vercel-oidc-token")),
      unpackedPreviewEnabled: isUnpackedPreviewEnabled(),
      productVersion: evidence.apprenticeshipProductVersion,
      summaryLength: evidence.summary.length, duties: evidence.duties.length,
      knowledge: evidence.knowledge.length, skills: evidence.skills.length,
      behaviours: evidence.behaviours.length,
    }, { headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });
  } catch (error) {
    return NextResponse.json({
      ok: false, code,
      reason: error instanceof Error ? error.name : "source_unavailable",
      detail: error instanceof Error && "diagnostic" in error ? String(error.diagnostic) : (error instanceof Error && "reason" in error ? String(error.reason) : "unavailable"),
    }, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
}
