import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { InsightArticlePage } from "@/components/sections/InsightArticlePage";
import { cleanDisplayText } from "@/lib/html-text";
import { getInsightArticle, insightArticles } from "@/lib/insights";

type InsightArticleRouteProps = {
  params: Promise<{
    slug: string;
  }>;
};

export function generateStaticParams() {
  return insightArticles.map((article) => ({
    slug: article.slug,
  }));
}

export async function generateMetadata({
  params,
}: InsightArticleRouteProps): Promise<Metadata> {
  const { slug } = await params;
  const article = getInsightArticle(slug);

  if (!article) {
    return {};
  }

  return {
    title: cleanDisplayText(article.title),
    description: cleanDisplayText(article.subtitle),
  };
}

export default async function InsightArticleRoute({
  params,
}: InsightArticleRouteProps) {
  const { slug } = await params;
  const article = getInsightArticle(slug);

  if (!article) {
    notFound();
  }

  return <InsightArticlePage article={article} />;
}
