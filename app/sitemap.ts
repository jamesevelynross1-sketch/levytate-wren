import type { MetadataRoute } from "next";
import { insightArticles } from "@/lib/insights";

const siteUrl = "https://mprconsulting.co.uk";

export default function sitemap(): MetadataRoute.Sitemap {
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
