import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ExploreRoutePathways } from "@/components/levytate-explore/ExploreRoutePathways";
import { loadExplorePathways } from "@/lib/server/levytate-explore-pathways";
import { createExploreCatalogue } from "@/lib/levytate/explore/catalogue";
import {
  UNCATEGORISED_ROUTE_SLUG,
  getExploreRouteBySlug, standardsForExploreRoute,
} from "@/lib/levytate/explore/occupational-routes";
import { loadLevyTateStandards } from "@/lib/server/levytate-apprenticeship-standards";

type RoutePageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: RoutePageProps): Promise<Metadata> {
  const { slug } = await params;
  const route = getExploreRouteBySlug(slug);
  if (!route) return { title: "Apprenticeship routes | LevyTate Explore", robots: { index: false, follow: false } };
  return {
    title: route.name + " apprenticeships | LevyTate Explore",
    description: "Explore the official occupational pathways within " + route.name.toLowerCase() + ", choose an apprenticeship and discover what it means with LevyTate Unpacked.",
    alternates: { canonical: "/explore/routes/" + route.slug },
  };
}

export default async function ExploreOccupationalRoutePage({ params }: RoutePageProps) {
  const { slug } = await params;
  const route = getExploreRouteBySlug(slug);
  if (!route && slug !== UNCATEGORISED_ROUTE_SLUG) notFound();

  // Keep the legacy uncategorised link usable without falsely presenting it
  // as a Skills England route or inventing missing official pathway metadata.
  if (!route) {
    const { ExploreRouteStandards } = await import("@/components/levytate-explore/ExploreRouteStandards");
    const source = await loadLevyTateStandards({
      status: "Approved for delivery",
      programmeType: "Apprenticeship standard",
    });
    const catalogue = createExploreCatalogue(source.standards);
    const standards = standardsForExploreRoute(catalogue, slug);
    if (!standards.length) notFound();
    return <ExploreRouteStandards route={null} standards={standards} />;
  }

  const source = await loadLevyTateStandards({
    status: "Approved for delivery",
    programmeType: "Apprenticeship standard",
  });
  const catalogue = createExploreCatalogue(source.standards);
  const routeStandards = standardsForExploreRoute(catalogue, slug);
  const mapping = await loadExplorePathways(route, routeStandards);
  return <ExploreRoutePathways route={route} mapping={mapping} />;
}
