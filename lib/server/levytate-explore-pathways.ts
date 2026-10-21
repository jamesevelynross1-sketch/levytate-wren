import type { ExploreStandard } from "@/lib/levytate/explore/catalogue";
import type { ExploreRoute } from "@/lib/levytate/explore/occupational-routes";
import {
  historicalExplorePathwayMap,
  mapPathwayGroups,
  unavailableExplorePathwayMap,
  type ExplorePathwayMap,
  type SkillsEnglandRoutePayload,
} from "@/lib/levytate/explore/official-pathways";

type RouteSummary = { routeId?: number | null; name?: string | null };

const API = "https://occupational-maps-api.skillsengland.education.gov.uk/api/v1";
const MAX_RESPONSE_BYTES = 6_000_000;
const LIVE_TTL_SECONDS = 12 * 60 * 60;

function normaliseName(value: string) {
  return value.toLowerCase().replace(/\s*&\s*/g, " and ").replace(/[^a-z0-9]+/g, " ").trim();
}

/** Server-only Skills England API reader. Never place the key in public props. */
async function officialJSON(url: string, apiKey: string): Promise<unknown> {
  const response = await fetch(url, {
    headers: { "X-API-KEY": apiKey, Accept: "application/json" },
    next: { revalidate: LIVE_TTL_SECONDS },
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw new Error("OFFICIAL_ROUTE_API_UNAVAILABLE");
  if (Number(response.headers.get("content-length") || 0) > MAX_RESPONSE_BYTES) {
    throw new Error("OFFICIAL_ROUTE_TOO_LARGE");
  }
  const data = await response.text();
  if (data.length > MAX_RESPONSE_BYTES) throw new Error("OFFICIAL_ROUTE_TOO_LARGE");
  return JSON.parse(data) as unknown;
}

async function querySkillsEnglandPathways(
  route: ExploreRoute, approvedStandards: ExploreStandard[], key: string,
): Promise<ExplorePathwayMap | null> {
  const routeList = await officialJSON(API + "/Routes", key);
  if (!Array.isArray(routeList)) return null;

  const match = (routeList as RouteSummary[]).find(item =>
    typeof item.name === "string" &&
    normaliseName(item.name) === normaliseName(route.name) &&
    typeof item.routeId === "number" && Number.isInteger(item.routeId) && item.routeId > 0,
  );
  if (!match?.routeId) return null;

  const endpoint = new URL(API + "/Routes/" + match.routeId);
  endpoint.searchParams.set("expand", "occupation.products");
  const record = await officialJSON(endpoint.toString(), key);
  if (!record || typeof record !== "object" || Array.isArray(record)) return null;
  return mapPathwayGroups(route, approvedStandards, record as SkillsEnglandRoutePayload, new Date().toISOString());
}

/**
 * Returns only source-backed groupings. No AI classification or fuzzy matching.
 * Existing public browsing remains available without an official API key;
 * Sales has explicitly labelled, historical government map examples only.
 */
export async function loadExplorePathways(
  route: ExploreRoute, approvedStandards: ExploreStandard[],
): Promise<ExplorePathwayMap> {
  const key = process.env.SKILLS_ENGLAND_API_KEY?.trim();
  if (key) {
    try {
      const current = await querySkillsEnglandPathways(route, approvedStandards, key);
      if (current) return current;
    } catch (error) {
      // Degrade safely. Do not print API credentials or full provider responses.
      console.warn("Explore official pathway map unavailable", {
        routeSlug: route.slug,
        outcome: error instanceof Error ? error.message.slice(0, 50) : "lookup_failed",
      });
    }
  }
  return historicalExplorePathwayMap(route, approvedStandards)
    || unavailableExplorePathwayMap(route, approvedStandards);
}
