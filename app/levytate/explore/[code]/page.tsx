import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ExploreDetail } from "@/components/levytate-explore/ExploreDetail";
import { createExploreCatalogue } from "@/lib/levytate/explore/catalogue";
import { loadLevyTateStandards } from "@/lib/server/levytate-apprenticeship-standards";

type Props = { params: Promise<{ code: string }>; searchParams: Promise<{ audience?: string; from?: string }> };

async function getStandard(code: string) {
  if (!/^ST\d{4}$/i.test(code)) return null;
  const result = await loadLevyTateStandards({ status: "Approved for delivery", programmeType: "Apprenticeship standard" });
  return createExploreCatalogue(result.standards).find(item => item.code === code.toUpperCase()) || null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { code } = await params;
  const standard = await getStandard(code);
  if (!standard) return { title: "Apprenticeship not found | LevyTate Explore", robots: { index: false } };
  return {
    title: standard.title + " | LevyTate Explore",
    description: "Discover " + standard.title + ", unpacked by LevyTate AI. Understand the real-world skills and bring the opportunity to your manager.",
    alternates: { canonical: "/explore/" + standard.code.toLowerCase() },
  };
}

export default async function ExploreStandardPage({ params, searchParams }: Props) {
  const { code } = await params;
  const standard = await getStandard(code);
  if (!standard) notFound();

  const query = await searchParams;
  const sourceRoute = standard.route.toLowerCase().replace(/\s*&\s*/g, " and ");
  const { getExploreRouteByName, getExploreRouteHref } = await import("@/lib/levytate/explore/occupational-routes");
  const route = getExploreRouteByName(sourceRoute);
  const prefix = route ? getExploreRouteHref(route) + "/pathways/" : null;
  const returnHref = prefix && query.from?.startsWith(prefix) &&
    /^\/explore\/routes\/[a-z0-9-]{1,100}\/pathways\/[a-z0-9-]{1,100}$/.test(query.from)
      ? query.from
      : null;
  return <ExploreDetail
    standard={standard}
    managerView={query.audience === "manager"}
    returnHref={returnHref}
    enquiriesEnabled={process.env.LEVYTATE_EXPLORE_SUBMISSIONS_ENABLED === "true"}
  />;
}
