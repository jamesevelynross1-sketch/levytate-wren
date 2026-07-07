import type { Metadata } from "next";
import { headers } from "next/headers";
import { SiteChrome } from "@/components/layout/SiteChrome";
import "./globals.css";

const levytateHosts = new Set(["levytate.co.uk", "www.levytate.co.uk"]);

async function getRequestHost() {
  const requestHeaders = await headers();
  return requestHeaders.get("host")?.split(":")[0]?.toLowerCase() ?? "";
}

export async function generateMetadata(): Promise<Metadata> {
  const host = await getRequestHost();

  if (levytateHosts.has(host)) {
    return {
      metadataBase: new URL("https://www.levytate.co.uk"),
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
  const isLevyTateHost = levytateHosts.has(host);

  return (
    <html lang="en-GB">
      <body className="font-sans antialiased">
        {isLevyTateHost ? <main>{children}</main> : <SiteChrome>{children}</SiteChrome>}
      </body>
    </html>
  );
}
