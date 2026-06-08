"use client";

import { usePathname } from "next/navigation";
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";

export function SiteChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isStockDashboard = pathname.startsWith("/stocks");
  const isStandaloneDemo = pathname.startsWith("/portakabin-apprenticeship-hub");

  if (isStockDashboard || isStandaloneDemo) {
    return <main>{children}</main>;
  }

  return (
    <>
      <Header />
      <main>{children}</main>
      <Footer />
    </>
  );
}
