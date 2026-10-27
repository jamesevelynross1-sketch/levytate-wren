import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { LevyTatePwaBootstrap } from "@/components/levytate-pwa/LevyTatePwa";
import { isLevyTatePlatformHost, requestHostname } from "@/lib/levytate/hosts";

export const metadata: Metadata = {
  applicationName: "LevyTate",
  manifest: "/levytate/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/brand/pwa/levytate-192.png", type: "image/png", sizes: "192x192" },
      { url: "/brand/pwa/levytate-512.png", type: "image/png", sizes: "512x512" },
    ],
    apple: [{ url: "/brand/pwa/levytate-192.png", type: "image/png", sizes: "192x192" }],
  },
  appleWebApp: {
    capable: true,
    title: "LevyTate",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  themeColor: "#17325C",
};

export default async function LevyTateLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const host = requestHostname((await headers()).get("host"));
  const scope = isLevyTatePlatformHost(host) ? "/" : "/levytate/";

  return (
    <>
      <LevyTatePwaBootstrap scope={scope} />
      {children}
    </>
  );
}
