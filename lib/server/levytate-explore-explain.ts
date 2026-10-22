import { createHash } from "node:crypto";
import { EXPLORE_NARRATIVE_VERSION, exploreNarrativeSchema, type ExploreNarrative } from "@/lib/levytate/explore/narrative";
import type { ExploreStandard } from "@/lib/levytate/explore/catalogue";
import type { ExploreSourceEvidence } from "@/lib/levytate/explore/source-evidence";
import { getLevyTateRateLimitEnvironment } from "@/lib/server/levytate-auth-rate-limit-config";
import { networkRateLimitKey, rateLimitKey } from "@/lib/server/levytate-auth-rate-limit";
import { generateExploreNarrative } from "@/lib/server/levytate-explore-generate";
import { fetchExploreSourceEvidence } from "@/lib/server/levytate-explore-official";
import { getLevyTateSupabaseConfig, supabaseSelect, supabaseFetchJson } from "@/lib/server/levytate-supabase";

export type ExploreGenerationResult =
  | { kind: "ready"; narrative: ExploreNarrative; sourceCheckedAt: string; fromCache: boolean }
  | { kind: "generating"; retryAfterSeconds: 3 }
  | { kind: "cooldown" };

export class ExploreGenerationUnavailable extends Error {
  constructor(public readonly reason: "not_configured" | "rate_limited" | "source_unavailable" | "generation_unavailable") {
    super(reason);
    this.name = "ExploreGenerationUnavailable";
  }
}

type CachedRow = { content: unknown; generated_at: string | null };
type ClaimRow = { claim_state: string; claim_token: string | null; cached_content: unknown };
type RateRow = { allowed: boolean };

function requireConfig() {
  const config = getLevyTateSupabaseConfig();
  if (!config) throw new ExploreGenerationUnavailable("not_configured");
  return config;
}
function sourceDigest(source: ExploreSourceEvidence) {
  return createHash("sha256").update(JSON.stringify(source)).digest("hex");
}
function parseNarrative(value: unknown) {
  return exploreNarrativeSchema.safeParse(value);
}

/** Treat version 1, 1.0 and v1.0 as equivalent; never infer a match for "Current". */
export function normaliseExploreVersion(raw: string): string | null {
  const candidate = raw.trim().toLowerCase().replace(/^v/, "");
  if (!/^\d+(?:[.-]\d+)*$/.test(candidate)) return null;
  const parts = candidate.split(/[.-]/).map(value => Number(value));
  while (parts.length > 1 && parts[parts.length - 1] === 0) parts.pop();
  return parts.join(".");
}

/**
 * Persisted budget: max 5 new AI generations per network per day, 20 in total
 * per deployment environment. Cache hits do not consume this allowance.
 * This feature does not spend anything unless explicitly enabled in env.
 */
async function checkGenerationBudget(request: Request) {
  const config = requireConfig();
  const rules = [
    { action: "explore.ai.network.day", key: networkRateLimitKey(request), limit: 5 },
    { action: "explore.ai.global.day", key: rateLimitKey("explore-ai-global", "all"), limit: 20 },
  ];
  for (const rule of rules) {
    let rows: RateRow[];
    try {
      rows = await supabaseFetchJson<RateRow[]>(config, "rpc/levytate_consume_auth_rate_limit", {
        method: "POST",
        body: JSON.stringify({
          p_environment_namespace: getLevyTateRateLimitEnvironment(),
          p_action: rule.action,
          p_key_hash: rule.key,
          p_window_seconds: 86400,
          p_limit: rule.limit,
          p_route: "/api/levytate-explore/de-fluff",
          p_event_type: "explore_ai_generation_rate_limited",
        }),
      });
    } catch {
      throw new ExploreGenerationUnavailable("not_configured");
    }
    if (!rows[0]?.allowed) throw new ExploreGenerationUnavailable("rate_limited");
  }
}

/** Finds only recent ready narratives; older entries are checked against source again. */
async function findRecentNarrative(standard: ExploreStandard) {
  const config = requireConfig();
  const query = new URLSearchParams({
    select: "content,generated_at",
    standard_code: "eq." + standard.code,
    standard_version: "eq." + standard.version,
    prompt_version: "eq." + EXPLORE_NARRATIVE_VERSION,
    status: "eq.ready",
    order: "generated_at.desc",
    limit: "1",
  });
  let rows: CachedRow[];
  try {
    rows = await supabaseSelect<CachedRow>(config, "levytate_explore_ai_narratives", query);
  } catch {
    throw new ExploreGenerationUnavailable("not_configured");
  }
  const row = rows[0];
  if (!row?.generated_at || Date.now() - Date.parse(row.generated_at) > 7 * 24 * 3600 * 1000) return null;
  const narrative = parseNarrative(row.content);
  return narrative.success ? { narrative: narrative.data, generatedAt: row.generated_at } : null;
}

async function findPendingNarrative(standard: ExploreStandard): Promise<"generating" | "cooldown" | null> {
  const config = requireConfig();
  const query = new URLSearchParams({
    select: "status,claimed_at,updated_at",
    standard_code: "eq." + standard.code,
    standard_version: "eq." + standard.version,
    prompt_version: "eq." + EXPLORE_NARRATIVE_VERSION,
    status: "in.(generating,failed)",
    order: "updated_at.desc",
    limit: "1",
  });
  try {
    const rows = await supabaseSelect<ArrayNever>(config, "levytate_explore_ai_narratives", query);
    const row = rows[0];
    if (!row) return null;
    if (row.status === "generating" && row.claimed_at &&
        Date.now() - Date.parse(row.claimed_at) < 75_000) return "generating";
    if (row.status === "failed" && row.updated_at &&
        Date.now() - Date.parse(row.updated_at) < 15 * 60_000) return "cooldown";
    return null;
  } catch {
    throw new ExploreGenerationUnavailable("not_configured");
  }
}
type ArrayNever = { status: "generating" | "failed"; claimed_at: string | null; updated_at: string };

async function claimGeneration(
  standard: ExploreStandard,
  source: ExploreSourceEvidence,
  digest: string,
) {
  const config = requireConfig();
  const rows = await supabaseFetchJson<ClaimRow[]>(config, "rpc/levytate_claim_explore_narrative", {
    method: "POST",
    body: JSON.stringify({
      p_standard_code: standard.code,
      p_standard_version: standard.version,
      p_source_digest: digest,
      p_prompt_version: EXPLORE_NARRATIVE_VERSION,
      p_source_occupation: source.occupationCode,
    }),
  });
  return rows[0] ?? null;
}

async function finishGeneration(
  standard: ExploreStandard, digest: string, claimToken: string,
  narrative: ExploreNarrative | null, errorCode = "",
) {
  const config = requireConfig();
  const result = await supabaseFetchJson<boolean>(config, "rpc/levytate_complete_explore_narrative", {
    method: "POST",
    body: JSON.stringify({
      p_standard_code: standard.code,
      p_standard_version: standard.version,
      p_source_digest: digest,
      p_prompt_version: EXPLORE_NARRATIVE_VERSION,
      p_claim_token: claimToken,
      p_success: Boolean(narrative),
      p_content: narrative,
      p_error_code: errorCode,
    }),
  });
  return result === true;
}

export async function explainExploreStandard(
  request: Request,
  standard: ExploreStandard,
): Promise<ExploreGenerationResult> {
  // The gate prevents accidental paid API traffic and keeps unreviewed AI
  // output off public pages. Do not enable until Skills England access, rate
  // limits and isolated narrative-cache table have been tested.
  if (process.env.LEVYTATE_EXPLORE_AI_ENABLED !== "true") {
    throw new ExploreGenerationUnavailable("not_configured");
  }
  if (!process.env.OPENAI_API_KEY || !process.env.SKILLS_ENGLAND_API_KEY) {
    throw new ExploreGenerationUnavailable("not_configured");
  }

  const ready = await findRecentNarrative(standard);
  if (ready) return {
    kind: "ready",
    narrative: ready.narrative,
    sourceCheckedAt: ready.generatedAt,
    fromCache: true,
  };

  // Polls and concurrent viewers should not repeatedly hit the government API.
  const pending = await findPendingNarrative(standard);
  if (pending === "generating") return { kind: "generating", retryAfterSeconds: 3 };
  if (pending === "cooldown") return { kind: "cooldown" };

  let source: ExploreSourceEvidence;
  try {
    source = await fetchExploreSourceEvidence(standard.code, standard.title);
  } catch {
    throw new ExploreGenerationUnavailable("source_unavailable");
  }
  // Product/version linkage must be explicit; never match on title.
  if (source.standardCode !== standard.code) throw new ExploreGenerationUnavailable("source_unavailable");
  const sourceVersion = normaliseExploreVersion(source.apprenticeshipProductVersion);
  const catalogueVersion = normaliseExploreVersion(standard.version);
  if (sourceVersion && catalogueVersion && sourceVersion !== catalogueVersion) {
    throw new ExploreGenerationUnavailable("source_unavailable");
  }

  const digest = sourceDigest(source);
  // Check the official evidence fingerprint first. A ready result is safe
  // even if the last cache-verification timestamp is past the seven-day TTL.
  let claim: ClaimRow | null;
  try {
    claim = await claimGeneration(standard, source, digest);
  } catch (error) {
    if (error instanceof ExploreGenerationUnavailable) throw error;
    throw new ExploreGenerationUnavailable("not_configured");
  }
  if (claim?.claim_state === "ready") {
    const parsed = parseNarrative(claim.cached_content);
    if (parsed.success) return {
      kind: "ready",
      narrative: parsed.data,
      sourceCheckedAt: new Date().toISOString(),
      fromCache: true,
    };
    throw new ExploreGenerationUnavailable("generation_unavailable");
  }
  if (claim?.claim_state === "in_progress") return { kind: "generating", retryAfterSeconds: 3 };
  if (claim?.claim_state === "cooldown" || claim?.claim_state === "limit_reached") return { kind: "cooldown" };
  if (claim?.claim_state !== "claimed" || !claim.claim_token) {
    throw new ExploreGenerationUnavailable("not_configured");
  }

  // Spend the generation budget only for the single successfully claimed
  // first-generation worker; cache hits and concurrent viewers are free.
  try {
    await checkGenerationBudget(request);
  } catch (error) {
    await finishGeneration(standard, digest, claim.claim_token, null, "generation_budget_denied")
      .catch(() => undefined);
    if (error instanceof ExploreGenerationUnavailable) throw error;
    throw new ExploreGenerationUnavailable("generation_unavailable");
  }

  let narrative: ExploreNarrative | null = null;
  let failure = "generation_unavailable";
  try {
    narrative = await generateExploreNarrative(standard, source);
  } catch {
    failure = "model_or_validation_error";
  }

  try {
    const finished = await finishGeneration(standard, digest, claim.claim_token, narrative, narrative ? "" : failure);
    if (!finished) throw new ExploreGenerationUnavailable("generation_unavailable");
  } catch {
    // A stale lease can eventually be recovered; never return an unpersisted
    // AI response as a confirmed transformation.
    throw new ExploreGenerationUnavailable("generation_unavailable");
  }
  if (!narrative) throw new ExploreGenerationUnavailable("generation_unavailable");
  return { kind: "ready", narrative, sourceCheckedAt: new Date().toISOString(), fromCache: false };
}
