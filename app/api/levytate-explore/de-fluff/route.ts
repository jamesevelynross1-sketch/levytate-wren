import { NextResponse } from "next/server";
import { z } from "zod";
import { createExploreCatalogue } from "@/lib/levytate/explore/catalogue";
import { loadLevyTateStandards } from "@/lib/server/levytate-apprenticeship-standards";
import { explainExploreStandard, ExploreGenerationUnavailable } from "@/lib/server/levytate-explore-explain";
import { generateUnpackedPreview, isUnpackedPreviewEnabled, PreviewUnpackedUnavailable } from "@/lib/server/levytate-explore-preview";
import { getLevyTateRateLimitEnvironment } from "@/lib/server/levytate-auth-rate-limit-config";
import { networkRateLimitKey, rateLimitKey } from "@/lib/server/levytate-auth-rate-limit";
import { getLevyTateSupabaseConfig, supabaseFetchJson } from "@/lib/server/levytate-supabase";

export const runtime = "nodejs";
export const maxDuration = 45;
export const dynamic = "force-dynamic";

const inputSchema = z.object({ code: z.string().regex(/^ST\d{4}$/i) }).strict();
const responseHeaders = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
};

function reply(message: string, status: number, additional: Record<string, unknown> = {}) {
  return NextResponse.json({ message, ...additional }, { status, headers: responseHeaders });
}

async function enforcePublicRequestLimit(request: Request) {
  const config = getLevyTateSupabaseConfig();
  if (!config) throw new ExploreGenerationUnavailable("not_configured");

  const rules = [
    { action: "explore.ai.requests.network.hour", key: networkRateLimitKey(request), limit: 60 },
    { action: "explore.ai.requests.global.hour", key: rateLimitKey("explore-ai-requests", "all"), limit: 1000 },
  ];
  for (const rule of rules) {
    const rows = await supabaseFetchJson<Array<{ allowed: boolean }>>(
      config, "rpc/levytate_consume_auth_rate_limit", {
        method: "POST",
        body: JSON.stringify({
          p_environment_namespace: getLevyTateRateLimitEnvironment(),
          p_action: rule.action,
          p_key_hash: rule.key,
          p_window_seconds: 3600,
          p_limit: rule.limit,
          p_route: "/api/levytate-explore/de-fluff",
          p_event_type: "explore_ai_request_rate_limited",
        }),
      },
    );
    if (!rows[0]?.allowed) throw new ExploreGenerationUnavailable("rate_limited");
  }
}

export async function POST(request: Request) {
  // This endpoint may incur actual AI charges. The feature is disabled by
  // default and only runs after explicit server-side configuration.
  if (process.env.LEVYTATE_EXPLORE_AI_ENABLED !== "true") {
    return reply("Live AI explanations are not enabled in this Preview yet.", 503, { code: "not_configured" });
  }
  if (!request.headers.get("origin") || request.headers.get("origin") !== new URL(request.url).origin) {
    return reply("This request must come from LevyTate Explore.", 403);
  }
  if (!(request.headers.get("content-type") || "").toLowerCase().startsWith("application/json")) {
    return reply("Please send a valid request.", 415);
  }
  if (Number(request.headers.get("content-length") || 0) > 2048) {
    return reply("Request too large.", 413);
  }

  let body: unknown;
  try {
    const raw = await request.text();
    if (raw.length > 2048) return reply("Request too large.", 413);
    body = JSON.parse(raw);
  } catch {
    return reply("Invalid programme request.", 400);
  }
  const parsed = inputSchema.safeParse(body);
  if (!parsed.success) return reply("Invalid apprenticeship reference.", 400);

  const previewGeneration = isUnpackedPreviewEnabled();
  // The protected, branch-scoped Preview has no employer database credentials.
  // Public/production operation must use the existing durable rate limiter.
  if (!previewGeneration) try {
    await enforcePublicRequestLimit(request);
  } catch (error) {
    if (error instanceof ExploreGenerationUnavailable && error.reason === "rate_limited") {
      return reply("Please try again later.", 429, { code: "rate_limited" });
    }
    return reply("AI explanations are not configured for this environment.", 503, { code: "not_configured" });
  }

  try {
    const payload = await loadLevyTateStandards({
      status: "Approved for delivery",
      programmeType: "Apprenticeship standard",
    });
    const standard = createExploreCatalogue(payload.standards)
      .find(item => item.code === parsed.data.code.toUpperCase());
    if (!standard) return reply("This apprenticeship is not available for a new application.", 404);

    if (previewGeneration) {
      // No employee details and no tenant data are involved in generation.
      const result = await generateUnpackedPreview(standard);
      return NextResponse.json({
        state: "ready",
        narrative: result.narrative,
        source: {
          title: standard.title,
          code: standard.code,
          version: standard.version,
          officialUrl: standard.officialUrl,
          sourceLastVerified: standard.sourceVerified,
          generatedAt: result.generatedAt,
          cached: result.fromCache,
        },
      }, { headers: responseHeaders });
    }

    const result = await explainExploreStandard(request, standard);
    if (result.kind === "generating") {
      return NextResponse.json(
        { state: "generating", retryAfterSeconds: result.retryAfterSeconds },
        { status: 202, headers: { ...responseHeaders, "Retry-After": "3" } },
      );
    }
    if (result.kind === "cooldown") {
      return reply("An explanation is being prepared. Please try again a little later.", 503, { code: "cooldown" });
    }

    return NextResponse.json({
      state: "ready",
      narrative: result.narrative,
      source: {
        title: standard.title,
        code: standard.code,
        version: standard.version,
        officialUrl: standard.officialUrl,
        sourceLastVerified: standard.sourceVerified,
        generatedAt: result.sourceCheckedAt,
        cached: result.fromCache,
      },
    }, { headers: responseHeaders });
  } catch (error) {
    if (error instanceof PreviewUnpackedUnavailable) {
      if (error.reason === "not_configured") {
        return reply("Unpacked is not configured for this Preview.", 503, { code: "not_configured" });
      }
      if (error.reason === "source_unavailable") {
        return reply("The official apprenticeship evidence could not be verified. Please refer to the Skills England standard.", 503, { code: "source_unavailable" });
      }
      return reply("Unpacked couldn't finish the explanation just now. Please try again.", 503, { code: "generation_unavailable" });
    }
    if (error instanceof ExploreGenerationUnavailable) {
      if (error.reason === "rate_limited") return reply("The daily AI allowance has been reached. Please try again tomorrow.", 429, { code: "rate_limited" });
      if (error.reason === "source_unavailable") return reply("We cannot verify the full official standard yet, so we won't invent an explanation.", 503, { code: "source_unavailable" });
      if (error.reason === "not_configured") return reply("Live AI explanations aren't available in this Preview yet.", 503, { code: "not_configured" });
    }
    return reply("The AI explanation could not be generated safely right now. Please try again.", 503, { code: "generation_unavailable" });
  }
}
