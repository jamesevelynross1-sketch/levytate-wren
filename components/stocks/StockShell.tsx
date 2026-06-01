import Link from "next/link";
import { SignalBadge } from "./SignalBadge";

const nav = [
  ["Overview", "/stocks"],
  ["Watchlist", "/stocks/watchlist"],
  ["History", "/stocks/history"],
  ["Portfolio", "/stocks/portfolio"],
  ["Settings", "/stocks/settings"],
] as const;

export function StockShell({ children }: { children: React.ReactNode }) {
  return (
    <section className="min-h-screen bg-[#050914] text-slate-100">
      <div className="border-b border-white/10 bg-[#070d1a]/95">
        <div className="container-px mx-auto flex max-w-7xl flex-col gap-5 py-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-300">MPR / James</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-normal text-white md:text-4xl">Stock Signal Dashboard</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
              Daily decision-support rankings for short-term equity opportunities, with risk controls and catalyst monitoring.
            </p>
          </div>
          <nav className="flex gap-2 overflow-x-auto rounded-lg border border-white/10 bg-white/[0.03] p-1">
            {nav.map(([label, href]) => (
              <Link key={href} href={href} className="whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium text-slate-300 transition hover:bg-white/10 hover:text-white">
                {label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
      <div className="container-px mx-auto max-w-7xl py-6">
        <div className="mb-6 rounded-lg border border-amber-300/25 bg-amber-300/10 px-4 py-3 text-sm text-amber-100">
          This dashboard provides research and decision-support only. It is not financial advice and does not guarantee returns.
        </div>
        <div className="mb-6 flex flex-wrap items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3">
          <span className="mr-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Signals</span>
          <SignalBadge signal="Strong Buy" />
          <SignalBadge signal="Buy" />
          <SignalBadge signal="Watch" />
          <SignalBadge signal="Avoid" />
          <SignalBadge signal="Sell" />
        </div>
        {children}
      </div>
    </section>
  );
}
