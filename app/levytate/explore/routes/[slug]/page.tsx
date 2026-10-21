import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ExploreRouteStandards } from "@/components/levytate-explore/ExploreRouteStandards";
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
    description: "Explore approved " + route.name.toLowerCase() + " apprenticeship standards. Select a programme to get an easy-to-understand explanation with LevyTate Unpacked.",
    alternates: { canonical: "/explore/routes/" + route.slug },
  };
}

export default async function ExploreOccupationalRoutePage({ params }: RoutePageProps) {
  const { slug } = await params;
  const route = getExploreRouteBySlug(slug);
  if (!route && slug !== UNCATEGORISED_ROUTE_SLUG) notFound();

  const source = await loadLevyTateStandards({
    status: "Approved for delivery",
    programmeType: "Apprenticeship standard",
  });
  const catalogue = createExploreCatalogue(source.standards);
  const standards = standardsForExploreRoute(catalogue, slug);

  if (!route && !standards.length) notFound();
  return <ExploreRouteStandards route={route} standards={standards} />;
}
