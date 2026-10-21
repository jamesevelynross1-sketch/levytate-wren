import type { Metadata } from "next";
import { ExploreHome } from "@/components/levytate-explore/ExploreHome";
import { createExploreCatalogue } from "@/lib/levytate/explore/catalogue";
import { loadLevyTateStandards } from "@/lib/server/levytate-apprenticeship-standards";

export const metadata: Metadata = {
  title: "Explore | Discover what you're capable of | LevyTate",
  description: "Already working? Discover apprenticeship pathways that could help you grow in your role. Understand your options in plain English and start a conversation with your manager.",
  alternates: { canonical: "/explore" },
  openGraph: { title: "LevyTate Explore — Your job isn't your limit", description: "Career development made human. Explore apprenticeships without the jargon or the job hunt.", url: "/explore", type: "website" },
};

export default async function ExploreLandingPage() {
  const response = await loadLevyTateStandards({ status: "Approved for delivery", programmeType: "Apprenticeship standard" });
  const catalogue = createExploreCatalogue(response.standards);

  return <ExploreHome standards={catalogue} />;
}
