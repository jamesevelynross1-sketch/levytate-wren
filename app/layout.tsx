import type { Metadata } from "next";
import { headers } from "next/headers";
import { SiteChrome } from "@/components/layout/SiteChrome";
import {
  getLevyTatePlatformOrigin,
  getLevyTateWebsiteOrigin,
  isLevyTateMarketingHost,
  isLevyTateProductHost,
  requestHostname,
} from "@/lib/levytate/hosts";
import "./globals.css";

async function getRequestHost() {
  const requestHeaders = await headers();
  return requestHostname(requestHeaders.get("host"));
}

async function isLevyTateRequest() {
  const requestHeaders = await headers();
  return isLevyTateProductHost(requestHostname(requestHeaders.get("host"))) || requestHeaders.get("x-levytate-route") === "1";
}

export async function generateMetadata(): Promise<Metadata> {
  if (await isLevyTateRequest()) {
    const host = await getRequestHost();
    return {
      metadataBase: new URL(isLevyTateMarketingHost(host) ? getLevyTateWebsiteOrigin() : getLevyTatePlatformOrigin()),
      title: {
        default: "LevyTate",
        template: "%s | LevyTate",
      },
      description: "LevyTate helps employers manage apprenticeships, workforce development and provider matching in one place.",
    };
  }

  return {
    metadataBase: new URL("https://mprconsulting.co.uk"),
    title: {
      default: "MPR Consulting",
      template: "%s | MPR Consulting",
    },
    description:
      "Independent apprenticeship consultancy for employers, covering strategy, levy advice, provider matching and access to 130+ apprenticeship programmes.",
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const host = await getRequestHost();
  const isLevyTateHost = isLevyTateProductHost(host) || (await headers()).get("x-levytate-route") === "1";

  return (
    <html lang="en-GB">
      <body className="font-sans antialiased">
        {isLevyTateHost ? <main>{children}</main> : <SiteChrome>{children}</SiteChrome>}
      </body>
    </html>
  );
}
