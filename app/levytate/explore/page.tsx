import type { Metadata } from "next";
import { ExploreHome } from "@/components/levytate-explore/ExploreHome";
import { createExploreCatalogue } from "@/lib/levytate/explore/catalogue";
import { loadLevyTateStandards } from "@/lib/server/levytate-apprenticeship-standards";

export const metadata: Metadata = {
  title: "Explore | Discover what you're capable of | LevyTate",
  description: "Explore Skills England’s 15 occupational routes, find approved apprenticeships in each area and discover what they mean for your working life with LevyTate Unpacked.",
  alternates: { canonical: "/explore" },
  openGraph: { title: "LevyTate Explore — Your job isn't your limit", description: "Career development made human. Explore apprenticeships without the jargon or the job hunt.", url: "/explore", type: "website" },
};

export default async function ExploreLandingPage() {
  const response = await loadLevyTateStandards({ status: "Approved for delivery", programmeType: "Apprenticeship standard" });
  const catalogue = createExploreCatalogue(response.standards);

  return <ExploreHome standards={catalogue} />;
}
