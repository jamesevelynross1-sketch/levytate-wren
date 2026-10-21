import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ExploreRouteStandards } from "@/components/levytate-explore/ExploreRouteStandards";
import { createExploreCatalogue } from "@/lib/levytate/explore/catalogue";
import {
  getExploreRouteBySlug, standardsForExploreRoute,
} from "@/lib/levytate/explore/occupational-routes";
import {
  standardsForPathway, unmappedStandardsForPathways,
} from "@/lib/levytate/explore/official-pathways";
import { loadLevyTateStandards } from "@/lib/server/levytate-apprenticeship-standards";
import { loadExplorePathways } from "@/lib/server/levytate-explore-pathways";

type Params = { params: Promise<{ slug: string; pathway: string }> };
const UNMAPPED = "unmapped";

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug, pathway } = await params;
  const route = getExploreRouteBySlug(slug);
  if (!route || !/^[a-z0-9-]{1,100}$/.test(pathway)) {
    return { title: "Apprenticeship pathway | LevyTate Explore", robots: { index: false } };
  }
  if (pathway === UNMAPPED) {
    return { title: "Standards awaiting pathway classification | LevyTate Explore", robots: { index: false } };
  }
  return {
    title: "Apprenticeships in " + route.name + " | LevyTate Explore",
    description: "Discover apprenticeship standards in a verified occupational pathway within " + route.name + ". Select a standard to open Unpacked.",
    alternates: { canonical: "/explore/routes/" + route.slug + "/pathways/" + pathway },
  };
}

export default async function ExplorePathwayPage({ params }: Params) {
  const { slug, pathway } = await params;
  const route = getExploreRouteBySlug(slug);
  if (!route || !/^[a-z0-9-]{1,100}$/.test(pathway)) notFound();

  const response = await loadLevyTateStandards({
    status: "Approved for delivery",
    programmeType: "Apprenticeship standard",
  });
  const catalogue = createExploreCatalogue(response.standards);
  const routeStandards = standardsForExploreRoute(catalogue, route.slug);
  const mapping = await loadExplorePathways(route, routeStandards);

  if (pathway === UNMAPPED) {
    const standards = unmappedStandardsForPathways(routeStandards, mapping);
    if (!standards.length) notFound();
    return <ExploreRouteStandards
      route={route}
      standards={standards}
      pathwayName={mapping.source === "not-connected"
        ? "All standards — pathways not yet connected"
        : "Standards awaiting pathway verification"}
      pathwaySource={mapping.source}
    />;
  }

  const group = mapping.groups.find(item => item.slug === pathway);
  if (!group) notFound();
  const standards = standardsForPathway(routeStandards, mapping, group.slug);
  return <ExploreRouteStandards
    route={route}
    standards={standards}
    pathwayName={group.name}
    pathwaySource={mapping.source}
  />;
}
