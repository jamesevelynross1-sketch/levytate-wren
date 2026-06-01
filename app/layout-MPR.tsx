import type { Metadata } from "next";
import { SiteChrome } from "@/components/layout/SiteChrome";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://mprconsulting.co.uk"),
  title: {
    default: "MPR Consulting",
    template: "%s | MPR Consulting",
  },
  description:
    "Independent apprenticeship consultancy for employers, covering apprenticeship strategy, levy advice, provider matching and workforce capability.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en-GB">
      <body className="font-sans antialiased">
        <SiteChrome>{children}</SiteChrome>
      </body>
    </html>
  );
}
