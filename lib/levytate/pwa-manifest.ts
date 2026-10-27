import type { MetadataRoute } from "next";
import { isLevyTatePlatformHost, requestHostname } from "@/lib/levytate/hosts";

const sharedManifest: Omit<MetadataRoute.Manifest, "id" | "start_url" | "scope"> = {
  name: "LevyTate",
  short_name: "LevyTate",
  description: "The apprenticeship operations platform for employers.",
  display: "standalone" as const,
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

export const levytateManifest: MetadataRoute.Manifest = {
  ...sharedManifest,
  id: "/levytate/",
  start_url: "/levytate/login",
  scope: "/levytate/",
};

export const levytatePlatformManifest: MetadataRoute.Manifest = {
  ...sharedManifest,
  id: "/",
  start_url: "/login",
  scope: "/",
};

export function levytateManifestForHost(host: string | null | undefined) {
  return isLevyTatePlatformHost(requestHostname(host)) ? levytatePlatformManifest : levytateManifest;
}
