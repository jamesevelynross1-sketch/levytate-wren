import type { ExploreStandard } from "@/lib/levytate/explore/catalogue";
import { getExploreRouteByName, type ExploreRoute } from "@/lib/levytate/explore/occupational-routes";

/**
 * Pure normalization of Skills England Occupational Maps API responses.
 *
 * Authoritative shape (OAS3): GET /api/v1/Routes/{id}
 * Route → Pathway → ClusterGroup → Cluster → Occupation → Product.
 *
 * An OCC occupation reference is NOT an ST apprenticeship reference.
 * We assign a standard to a pathway only when the API explicitly includes
 * its ST productCode nested under the exact official route and pathway.
 */
export type SkillsEnglandRoutePayload = {
  routeId?: number | null;
  name?: string | null;
  pathways?: Array<{
    id?: number | null;
    name?: string | null;
    sequence?: number | null;
    clusterGroups?: Array<{
      clusters?: Array<{
        occupations?: Array<{
          stdCode?: string | null;
          products?: Array<{ productCode?: string | null; typeName?: string | null }> | null;
        }> | null;
      }> | null;
    }> | null;
  }> | null;
};

export type ExplorePathwayGroup = {
  slug: string;
  name: string;
  officialId: number | null;
  order: number;
  standardCodes: string[];
};

export type ExplorePathwayMap = {
  routeSlug: string;
  routeName: string;
  source: "live-official-api" | "historical-official-map" | "not-connected";
  sourceUrl: string | null;
  checkedAt: string | null;
  groups: ExplorePathwayGroup[];
  unmappedCodes: string[];
  totalRouteStandards: number;
};

export const HISTORICAL_MAP_SOURCE =
  "https://skillsengland.education.gov.uk/media/3181/sales-marketing-procurement-may-19.pdf";

function canonical(value: string) {
  return value.toLowerCase().replace(/\s*&\s*/g, " and ").replace(/[^a-z0-9]+/g, " ").trim();
}
export function explorePathwaySlug(name: string) {
  return name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}

export function mapPathwayGroups(
  route: ExploreRoute,
  approvedStandards: ExploreStandard[],
  payload: SkillsEnglandRoutePayload,
  checkedAt: string,
): ExplorePathwayMap | null {
  if (!payload || canonical(payload.name || "") !== canonical(route.name) ||
      !Array.isArray(payload.pathways) || !payload.pathways.length) return null;

  // The standard catalogue is the eligibility filter. Government maps
  // contain other products (T Levels, units, retired standards) which must
  // not silently become active apprenticeship recommendations.
  const allowed = new Set(
    approvedStandards
      .filter(s => getExploreRouteByName(s.route)?.slug === route.slug)
      .map(s => s.code.toUpperCase()),
  );

  const groups: ExplorePathwayGroup[] = [];
  const takenSlugs = new Set<string>();
  const mapped = new Set<string>();

  for (const pathway of payload.pathways) {
    if (typeof pathway.name !== "string" || !pathway.name.trim()) return null;
    const name = pathway.name.trim().replace(/\s+/g, " ");
    const slug = explorePathwaySlug(name);
    if (!slug || takenSlugs.has(slug)) return null;
    takenSlugs.add(slug);

    const codeSet = new Set<string>();
    for (const group of pathway.clusterGroups || []) {
      for (const cluster of group.clusters || []) {
        for (const occupation of cluster.occupations || []) {
          if (!/^OCC\d{4}[A-Z]?$/i.test(occupation.stdCode || "")) continue;
          for (const product of occupation.products || []) {
            const code = (product.productCode || "").toUpperCase();
            if (/^ST\d{4}$/.test(code) && allowed.has(code)) codeSet.add(code);
          }
        }
      }
    }

    const standardCodes = [...codeSet].sort();
    standardCodes.forEach(c => mapped.add(c));
    groups.push({
      slug,
      name,
      officialId: typeof pathway.id === "number" && Number.isInteger(pathway.id) ? pathway.id : null,
      order: typeof pathway.sequence === "number" ? pathway.sequence : groups.length,
      standardCodes,
    });
  }
  groups.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));

  return {
    routeSlug: route.slug,
    routeName: route.name,
    source: "live-official-api",
    sourceUrl: "https://occupational-maps.skillsengland.education.gov.uk/",
    checkedAt,
    groups,
    unmappedCodes: [...allowed].filter(code => !mapped.has(code)).sort(),
    totalRouteStandards: allowed.size,
  };
}

/**
 * A small, explicitly dated archive-backed seed to make the problematic
 * Sales/Marketing route navigable in a protected Preview with no API key.
 *
 * These names/assignments come from Skills England's May 2019 occupational
 * map (two-page PDF above), NOT a current API response. The app makes that
 * distinction visible and leaves all later/unverified standards unmapped.
 * This is removed/replaced automatically when live official API data arrives.
 */
const historicalSalesMap: Array<{ name: string; codes: string[] }> = [
  { name: "Customer Service", codes: ["ST0071", "ST0072", "ST0584", "ST0594"] },
  { name: "Marketing", codes: ["ST0644", "ST0481"] },
  { name: "Procurement", codes: ["ST0056"] },
  { name: "Retail", codes: ["ST0077", "ST0078", "ST0194", "ST0683", "ST0668", "ST0325", "ST0547", "ST0423", "ST0572", "ST0327", "ST0334", "ST0340"] },
];

export function historicalExplorePathwayMap(
  route: ExploreRoute,
  approvedStandards: ExploreStandard[],
): ExplorePathwayMap | null {
  if (route.slug !== "sales-marketing-and-procurement") return null;

  const allowed = new Set(
    approvedStandards
      .filter(s => getExploreRouteByName(s.route)?.slug === route.slug)
      .map(s => s.code),
  );
  const mapped = new Set<string>();
  const groups = historicalSalesMap.map(({ name, codes }, order) => {
    const standardCodes = codes.filter(c => allowed.has(c));
    standardCodes.forEach(c => mapped.add(c));
    return { slug: explorePathwaySlug(name), name, officialId: null, order, standardCodes };
  });

  return {
    routeSlug: route.slug,
    routeName: route.name,
    source: "historical-official-map",
    sourceUrl: HISTORICAL_MAP_SOURCE,
    checkedAt: "2019-05-01",
    groups,
    unmappedCodes: [...allowed].filter(c => !mapped.has(c)).sort(),
    totalRouteStandards: allowed.size,
  };
}

export function unavailableExplorePathwayMap(route: ExploreRoute, approved: ExploreStandard[]): ExplorePathwayMap {
  const allowed = approved.filter(s => getExploreRouteByName(s.route)?.slug === route.slug);
  return {
    routeSlug: route.slug,
    routeName: route.name,
    source: "not-connected",
    sourceUrl: null,
    checkedAt: null,
    groups: [],
    unmappedCodes: allowed.map(s => s.code).sort(),
    totalRouteStandards: allowed.length,
  };
}

export function standardsForPathway(
  routeStandards: ExploreStandard[],
  mapping: ExplorePathwayMap,
  pathwaySlug: string,
): ExploreStandard[] {
  const group = mapping.groups.find(g => g.slug === pathwaySlug);
  if (!group) return [];
  const membership = new Set(group.standardCodes);
  return routeStandards.filter(s => membership.has(s.code));
}

export function unmappedStandardsForPathways(
  routeStandards: ExploreStandard[], mapping: ExplorePathwayMap,
): ExploreStandard[] {
  const membership = new Set(mapping.unmappedCodes);
  return routeStandards.filter(s => membership.has(s.code));
}
