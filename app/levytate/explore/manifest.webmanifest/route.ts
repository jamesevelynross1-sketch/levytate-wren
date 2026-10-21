import type { MetadataRoute } from "next";

const manifest: MetadataRoute.Manifest = {
  id: "/explore",
  name: "LevyTate Explore",
  short_name: "Explore",
  description: "Discover what you're capable of. Find apprenticeships in plain English.",
  start_url: "/explore",
  scope: "/explore/",
  display: "standalone",
  background_color: "#f5f6f2",
  theme_color: "#102c3d",
  categories: ["education", "business", "productivity"],
  icons: [
    { src: "/brand/pwa/levytate-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
    { src: "/brand/pwa/levytate-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    { src: "/brand/pwa/levytate-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
    { src: "/brand/pwa/levytate-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
  ],
};

export function GET() {
  return Response.json(manifest, { headers: {
    "Content-Type": "application/manifest+json; charset=utf-8",
    "Cache-Control": "public, max-age=0, must-revalidate",
    "X-Content-Type-Options": "nosniff",
  } });
}
