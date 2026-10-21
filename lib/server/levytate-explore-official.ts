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
export async function fetchExploreSourceEvidence(standardCode: string): Promise<ExploreSourceEvidence> {
  if (!/^ST\d{4}$/i.test(standardCode)) throw new ExploreOfficialSourceError("not_found");

  const apiKey = process.env.SKILLS_ENGLAND_API_KEY?.trim();
  if (!apiKey) throw new ExploreOfficialSourceError("not_configured");

  const endpoint = new URL("https://occupational-maps-api.skillsengland.education.gov.uk/api/v1/SearchOccupations");
  endpoint.searchParams.set("searchTerm", standardCode.toUpperCase());
  endpoint.searchParams.set("expand", "occupation.summary,occupation.overview,occupation.dutiesKSB,occupation.products");
  endpoint.searchParams.set("pageSize", "25");
  endpoint.searchParams.set("pageNumber", "1");

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "GET",
      headers: { "X-API-KEY": apiKey, Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(12000),
    });
  } catch {
    throw new ExploreOfficialSourceError("unavailable");
  }

  if (!response.ok) throw new ExploreOfficialSourceError(response.status === 404 ? "not_found" : "unavailable");
  if (Number(response.headers.get("content-length") || 0) > 1_500_000) throw new ExploreOfficialSourceError("unavailable");

  let body: OccupationalSearchPayload;
  try {
    const raw = await response.text();
    if (raw.length > 1_500_000) throw new Error("oversize");
    body = JSON.parse(raw) as OccupationalSearchPayload;
  } catch {
    throw new ExploreOfficialSourceError("unavailable");
  }

  const source = normaliseExploreSource(standardCode, body);
  if (!source) throw new ExploreOfficialSourceError("not_found");
  return source;
}
