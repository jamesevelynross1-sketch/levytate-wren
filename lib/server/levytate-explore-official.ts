import {
  normaliseExploreSource,
  type ExploreSourceEvidence, type OccupationalSearchPayload,
} from "@/lib/levytate/explore/source-evidence";

export class ExploreOfficialSourceError extends Error {
  constructor(public readonly reason: "not_configured" | "not_found" | "unavailable") {
    super(reason);
    this.name = "ExploreOfficialSourceError";
  }
}

/**
 * Server-only official Skills England Occupational Maps API integration.
 * The occupation API is not the apprenticeship approvals register; we only
 * use it for evidence after checking the ST product-code relationship.
 * Requires an approved Skills England X-API-KEY. No scraping or invented KSBs.
 */
export async function fetchExploreSourceEvidence(
  standardCode: string,
  standardTitle = "",
): Promise<ExploreSourceEvidence> {
  if (!/^ST\d{4}$/i.test(standardCode)) throw new ExploreOfficialSourceError("not_found");

  const apiKey = process.env.SKILLS_ENGLAND_API_KEY?.trim();
  if (!apiKey) throw new ExploreOfficialSourceError("not_configured");

  // The occupational search index can match both official standard codes and
  // occupational titles. We attempt at most two queries, but require an exact
  // linked ST productCode before trusting any result.
  const searches = [standardCode.toUpperCase(), standardTitle.trim().slice(0, 130)]
    .filter((item, index, all) => item && all.indexOf(item) === index);

  for (const searchTerm of searches) {
    const endpoint = new URL("https://occupational-maps-api.skillsengland.education.gov.uk/api/v1/SearchOccupations");
    endpoint.searchParams.set("searchTerm", searchTerm);
    endpoint.searchParams.set("expand", "occupation.summary,occupation.overview,occupation.dutiesKSB,occupation.products");
    endpoint.searchParams.set("pageSize", "50");
    endpoint.searchParams.set("pageNumber", "1");

    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: "GET",
        headers: { "X-API-KEY": apiKey, Accept: "application/json" },
        cache: "no-store",
        signal: AbortSignal.timeout(9000),
      });
    } catch {
      throw new ExploreOfficialSourceError("unavailable");
    }
    if (!response.ok) {
      // Key or rate-limit problems must never be treated as an empty
      // standard, or silently fall through into lower-quality evidence.
      if (response.status === 404) continue;
      throw new ExploreOfficialSourceError("unavailable");
    }

    const length = Number(response.headers.get("content-length") || 0);
    if (length > 2_000_000) throw new ExploreOfficialSourceError("unavailable");
    let body: OccupationalSearchPayload;
    try {
      const raw = await response.text();
      if (raw.length > 2_000_000) throw new Error("oversize");
      body = JSON.parse(raw) as OccupationalSearchPayload;
    } catch {
      throw new ExploreOfficialSourceError("unavailable");
    }

    const evidence = normaliseExploreSource(standardCode, body);
    if (evidence) return evidence;
  }
  throw new ExploreOfficialSourceError("not_found");
}
