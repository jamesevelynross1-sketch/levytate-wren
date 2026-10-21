import type { ExploreStandard } from "@/lib/levytate/explore/catalogue";

/**
 * Exact Skills England occupational route names.
 * Source: https://occupational-maps.skillsengland.education.gov.uk/
 * These are routes, not inferred career-pathway or provider categories.
 */
export const SKILLS_ENGLAND_ROUTES = [
  { slug: "agriculture-environmental-and-animal-care", name: "Agriculture, environmental and animal care", description: "Land, environment and animal care", icon: "leaf", tone: "mint" },
  { slug: "business-and-administration", name: "Business and administration", description: "Business operations and workplace services", icon: "briefcase", tone: "cream" },
  { slug: "care-services", name: "Care services", description: "Supporting people and communities", icon: "heart-handshake", tone: "rose" },
  { slug: "catering-and-hospitality", name: "Catering and hospitality", description: "Food, hospitality and guest experiences", icon: "utensils", tone: "peach" },
  { slug: "construction-and-the-built-environment", name: "Construction and the built environment", description: "Building, infrastructure and places", icon: "hard-hat", tone: "cream" },
  { slug: "creative-and-design", name: "Creative and design", description: "Creative production and design disciplines", icon: "palette", tone: "lavender" },
  { slug: "digital", name: "Digital", description: "Technology, data and digital systems", icon: "monitor", tone: "mint" },
  { slug: "education-and-early-years", name: "Education and early years", description: "Teaching, learning and early development", icon: "graduation-cap", tone: "lavender" },
  { slug: "engineering-and-manufacturing", name: "Engineering and manufacturing", description: "Engineering, production and innovation", icon: "factory", tone: "slate" },
  { slug: "hair-and-beauty", name: "Hair and beauty", description: "Personal care, styling and wellbeing", icon: "scissors", tone: "rose" },
  { slug: "health-and-science", name: "Health and science", description: "Healthcare, medicine and scientific work", icon: "heart-pulse", tone: "mint" },
  { slug: "legal-finance-and-accounting", name: "Legal, finance and accounting", description: "Professional, financial and legal services", icon: "scale", tone: "slate" },
  { slug: "protective-services", name: "Protective services", description: "Safety, emergency and protective roles", icon: "shield-check", tone: "slate" },
  { slug: "sales-marketing-and-procurement", name: "Sales, marketing and procurement", description: "Customers, commercial growth and buying", icon: "megaphone", tone: "peach" },
  { slug: "transport-and-logistics", name: "Transport and logistics", description: "Movement of goods, people and services", icon: "truck", tone: "cream" },
] as const;

export type ExploreRoute = (typeof SKILLS_ENGLAND_ROUTES)[number];
export type ExploreRouteGroup = { route: ExploreRoute; count: number };
export const UNCATEGORISED_ROUTE_SLUG = "uncategorised";

function routeKey(value: string) {
  return value.toLowerCase().replace(/\s*&\s*/g, " and ").replace(/\s+/g, " ").trim();
}

const historicAliases: Record<string, string> = {
  "education and childcare": "education and early years",
};

export function getExploreRouteByName(name: string): ExploreRoute | null {
  const normalised = routeKey(name);
  const known = historicAliases[normalised] || normalised;
  return SKILLS_ENGLAND_ROUTES.find(route => routeKey(route.name) === known) || null;
}

export function getExploreRouteBySlug(slug: string): ExploreRoute | null {
  return SKILLS_ENGLAND_ROUTES.find(route => route.slug === slug) || null;
}

export function getExploreRouteHref(route: ExploreRoute) {
  return "/explore/routes/" + route.slug;
}

export function getExploreRouteGroups(standards: ExploreStandard[]): ExploreRouteGroup[] {
  const counts = new Map<string, number>();
  for (const standard of standards) {
    const route = getExploreRouteByName(standard.route);
    if (route) counts.set(route.slug, (counts.get(route.slug) || 0) + 1);
  }
  return SKILLS_ENGLAND_ROUTES.map(route => ({
    route, count: counts.get(route.slug) || 0,
  }));
}

export function standardsForExploreRoute(standards: ExploreStandard[], slug: string) {
  if (slug === UNCATEGORISED_ROUTE_SLUG) {
    return standards.filter(standard => !getExploreRouteByName(standard.route));
  }
  const route = getExploreRouteBySlug(slug);
  if (!route) return [];
  return standards.filter(standard => getExploreRouteByName(standard.route)?.slug === route.slug);
}

export function countUncategorisedStandards(standards: ExploreStandard[]): number {
  return standards.filter(standard => !getExploreRouteByName(standard.route)).length;
}
