import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ExploreDetail } from "@/components/levytate-explore/ExploreDetail";
import { createExploreCatalogue } from "@/lib/levytate/explore/catalogue";
import { loadLevyTateStandards } from "@/lib/server/levytate-apprenticeship-standards";

type Props = { params: Promise<{ code: string }> };

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
    description: "What could " + standard.title + " mean for your working life? Read the plain-English guide and bring the opportunity to your manager.",
    alternates: { canonical: "/explore/" + standard.code.toLowerCase() },
  };
}

export default async function ExploreStandardPage({ params }: Props) {
  const { code } = await params;
  const standard = await getStandard(code);
  if (!standard) notFound();

  return <ExploreDetail standard={standard} />;
}
