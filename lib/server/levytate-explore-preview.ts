import { createHash } from "node:crypto";
import { unstable_cache } from "next/cache";
import type { ExploreStandard } from "@/lib/levytate/explore/catalogue";
import { EXPLORE_NARRATIVE_VERSION, type ExploreNarrative } from "@/lib/levytate/explore/narrative";
import type { ExploreSourceEvidence } from "@/lib/levytate/explore/source-evidence";
import { generateExploreNarrative, hasExploreGatewayAccess } from "@/lib/server/levytate-explore-generate";
import { fetchExploreSourceEvidence } from "@/lib/server/levytate-explore-official";

/**
 * This path is for the Vercel-authenticated, protected Explore Preview ONLY.
 * It deliberately avoids borrowing the employer database/service-role secret.
 *
 * Public launch requires the previously designed Supabase atomic cache,
 * durable global quotas, abuse testing and explicit commercial approval.
 */
export function isUnpackedPreviewEnabled() {
  return process.env.VERCEL_ENV === "preview" &&
    process.env.VERCEL_GIT_COMMIT_REF === "feature/levytate-explore-public-pwa" &&
    process.env.LEVYTATE_EXPLORE_AI_ENABLED === "true" &&
    process.env.LEVYTATE_EXPLORE_AI_RUNTIME === "gateway-preview";
}

export type PreviewUnpackedResult = {
  narrative: ExploreNarrative;
  generatedAt: string;
  fromCache: boolean;
  occupationCode: string;
};

type StoredNarrative = Omit<PreviewUnpackedResult, "fromCache">;

const REVALIDATE = 7 * 24 * 3600;
const MAX_NEW_GENERATIONS_PER_INSTANCE_DAY = 12;
const inFlight = new Map<string, Promise<StoredNarrative>>();
let usageDay = "";
let generatedToday = 0;

function debitPreviewGeneration() {
  const day = new Date().toISOString().slice(0, 10);
  if (day !== usageDay) {
    usageDay = day;
    generatedToday = 0;
  }
  if (generatedToday >= MAX_NEW_GENERATIONS_PER_INSTANCE_DAY) {
    throw new Error("PREVIEW_INSTANCE_DAILY_LIMIT");
  }
  generatedToday += 1;
}

/**
 * Cached output key includes all model inputs (including current official
 * evidence). No personal, employer or manager information is sent to AI.
 * Next.js/Vercel Data Cache avoids repeat bills on subsequent page opens.
 */
function createCachedGenerator(vercelRequestOidcToken: string | null) {
  // Capture the short-lived OIDC token in a per-request server-only closure.
  // It is NEVER passed as an unstable_cache argument, key or returned value.
  return unstable_cache(
    async (standard: ExploreStandard, evidence: ExploreSourceEvidence): Promise<StoredNarrative> => {
      debitPreviewGeneration(); // runs only on an actual cache miss
      const narrative = await generateExploreNarrative(standard, evidence, vercelRequestOidcToken);
      return {
        narrative,
        generatedAt: new Date().toISOString(),
        occupationCode: evidence.occupationCode,
      };
    },
    ["levytate-unpacked-preview", EXPLORE_NARRATIVE_VERSION, "structured-v3"],
    { revalidate: REVALIDATE },
  );
}

export class PreviewUnpackedUnavailable extends Error {
  constructor(public readonly reason: "not_configured" | "source_unavailable" | "model_unavailable") {
    super(reason);
    this.name = "PreviewUnpackedUnavailable";
  }
}

export async function generateUnpackedPreview(standard: ExploreStandard, request: Request): Promise<PreviewUnpackedResult> {
  const requestToken = request.headers.get("x-vercel-oidc-token");
  if (!isUnpackedPreviewEnabled() || !hasExploreGatewayAccess(requestToken)) {
    throw new PreviewUnpackedUnavailable("not_configured");
  }

  let evidence: ExploreSourceEvidence;
  try {
    evidence = await fetchExploreSourceEvidence(standard.code, standard.title);
  } catch {
    throw new PreviewUnpackedUnavailable("source_unavailable");
  }
  if (evidence.standardCode !== standard.code || !/^OCC\d{4}[A-Z]?$/i.test(evidence.occupationCode)) {
    throw new PreviewUnpackedUnavailable("source_unavailable");
  }

  // Avoid comparing missing version metadata. The underlying source must
  // still provide an explicit exact ST product relationship.
  const fingerprint = createHash("sha256")
    .update(JSON.stringify({
      code: standard.code,
      version: standard.version,
      model: "openai/gpt-5.4-mini",
      prompt: EXPLORE_NARRATIVE_VERSION,
      official: evidence,
    }))
    .digest("hex");
  const key = standard.code + ":" + fingerprint;

  let job = inFlight.get(key);
  if (!job) {
    job = createCachedGenerator(requestToken)(standard, evidence);
    inFlight.set(key, job);
    void job.finally(() => {
      if (inFlight.get(key) === job) inFlight.delete(key);
    }).catch(() => undefined);
  }

  try {
    const content = await job;
    return {
      ...content,
      fromCache: Date.now() - Date.parse(content.generatedAt) > 10000,
    };
  } catch {
    throw new PreviewUnpackedUnavailable("model_unavailable");
  }
}
