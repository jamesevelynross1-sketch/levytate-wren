import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  applicationName: "LevyTate Explore",
  manifest: "/explore/manifest.webmanifest",
  icons: {
    icon: [{ url: "/brand/pwa/levytate-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/brand/pwa/levytate-192.png", sizes: "192x192", type: "image/png" }],
  },
  appleWebApp: { capable: true, title: "Explore", statusBarStyle: "default" },
};

export const viewport: Viewport = { themeColor: "#102c3d" };

export default function ExploreLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <div className="levytate-explore min-h-screen bg-[#f5f6f2] text-[#102c3d]">{children}</div>;
}
