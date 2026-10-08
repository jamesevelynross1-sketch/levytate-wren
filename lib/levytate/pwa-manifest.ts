import type { MetadataRoute } from "next";

export const levytateManifest: MetadataRoute.Manifest = {
  id: "/levytate/",
  name: "LevyTate",
  short_name: "LevyTate",
  description: "The apprenticeship operations platform for employers.",
  start_url: "/levytate/login",
  scope: "/levytate/",
  display: "standalone",
  background_color: "#FFFFFF",
  theme_color: "#17325C",
  categories: ["business", "productivity"],
  icons: [
    {
      src: "/brand/pwa/levytate-192.png",
      sizes: "192x192",
      type: "image/png",
      purpose: "any",
    },
    {
      src: "/brand/pwa/levytate-512.png",
      sizes: "512x512",
      type: "image/png",
      purpose: "any",
    },
    {
      src: "/brand/pwa/levytate-maskable-192.png",
      sizes: "192x192",
      type: "image/png",
      purpose: "maskable",
    },
    {
      src: "/brand/pwa/levytate-maskable-512.png",
      sizes: "512x512",
      type: "image/png",
      purpose: "maskable",
    },
  ],
};
