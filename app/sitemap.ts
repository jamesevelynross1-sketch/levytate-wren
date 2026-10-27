import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { insightArticles } from "@/lib/insights";
import { levyTatePublicSitemap, requestHostname } from "@/lib/levytate/hosts";

const siteUrl = "https://mprconsulting.co.uk";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const host = requestHostname((await headers()).get("host"));
  const productUrls = levyTatePublicSitemap(host);
  if (productUrls) {
    return productUrls.map((url) => ({ url, lastModified: new Date() }));
  }

  const staticRoutes = [
    "",
    "/framework",
    "/levy-health-check",
    "/provider-matching",
    "/services",
    "/case-studies",
    "/case-studies/ground-control",
    "/about",
    "/insights",
    "/contact",
    "/scorecard",
    "/neet-on-our-watch",
  ];

  const insightRoutes = insightArticles.map(
    (article) => `/insights/${article.slug}`,
  );

  return [...staticRoutes, ...insightRoutes].map((route) => ({
    url: `${siteUrl}${route}`,
    lastModified: new Date(),
  }));
}
