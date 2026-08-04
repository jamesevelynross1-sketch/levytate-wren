import type { Metadata } from "next";
import Link from "next/link";
import { PublicFooter, PublicHeader } from "@/components/levytate-public/PublicHeader";
import { getPublicReadiness } from "@/lib/server/levytate-service-health";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: { absolute: "Service status | LevyTate" },
  description: "Current LevyTate service availability.",
  alternates: { canonical: "https://www.levytate.co.uk/status" },
};

export default async function Page() {
  let readiness: Awaited<ReturnType<typeof getPublicReadiness>> | null = null;
  try { readiness = await getPublicReadiness(); } catch { readiness = null; }
  const display = !readiness ? { title: "Status temporarily unavailable", copy: "The latest service check could not be displayed. Please try again shortly.", tone: "bg-[#fff7e8] text-[#71531c]", symbol: "?" }
    : readiness.status === "operational" ? { title: "Operational", copy: "LevyTate is available and its critical service checks are completing normally.", tone: "bg-[#e8f7f1] text-[#0b6f63]", symbol: "✓" }
    : readiness.status === "degraded" ? { title: "Operational", copy: "Core LevyTate access is available, with limited internal diagnostic reporting.", tone: "bg-[#fff7e8] text-[#71531c]", symbol: "!" }
    : { title: "Service disruption", copy: "A critical service check is not completing. Protected LevyTate access may be unavailable.", tone: "bg-[#fff0f2] text-[#a8324a]", symbol: "!" };
  return <div className="min-h-screen overflow-x-hidden bg-[#f6fbf8] text-[#102c3d]">
    <PublicHeader />
    <main id="main-content" className="mx-auto w-full max-w-4xl px-5 py-12 sm:px-8 sm:py-16">
      <header className="rounded-[1.6rem] bg-[#102c3d] px-6 py-8 text-white sm:px-10 sm:py-11">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8fe0d2]">Service health</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-[-0.035em] sm:text-5xl">LevyTate status</h1>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-white/72 sm:text-base">A current check of the essential services needed to access LevyTate.</p>
      </header>
      <section aria-live="polite" aria-atomic="true" className="mt-6 rounded-[1.4rem] border border-[#102c3d]/[0.08] bg-white p-6 shadow-[0_12px_30px_rgba(16,44,61,0.035)] sm:p-8">
        <div className={`grid h-12 w-12 place-items-center rounded-full text-lg font-bold ${display.tone}`} aria-hidden="true">{display.symbol}</div>
        <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#102c3d]/45">Current status</p>
        <h2 className="mt-2 text-2xl font-semibold">{display.title}</h2>
        <p className="mt-3 text-sm leading-7 text-[#102c3d]/65">{display.copy}</p>
        <p className="mt-5 text-xs font-medium text-[#102c3d]/48">Last checked: {readiness ? new Date(readiness.checkedAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "medium", timeZone: "Europe/London" }) : "Not available"}</p>
      </section>
      <nav aria-label="Status help" className="mt-6 grid gap-3 sm:grid-cols-2">
        <Link href="/levytate/support" className="flex min-h-12 items-center justify-center rounded-full bg-[#102c3d] px-5 text-sm font-semibold text-white focus:outline-none focus:ring-4 focus:ring-[#159b8f]/25">Contact Support</Link>
        <Link href="/levytate/account-help" className="flex min-h-12 items-center justify-center rounded-full bg-white px-5 text-sm font-semibold text-[#102c3d] ring-1 ring-[#102c3d]/10 focus:outline-none focus:ring-4 focus:ring-[#159b8f]/25">Account Help</Link>
      </nav>
      <p className="mt-7 text-xs leading-6 text-[#102c3d]/48">This page reports current checks only. LevyTate does not currently publish historical uptime or a formal service-level commitment.</p>
    </main>
    <PublicFooter />
  </div>;
}
