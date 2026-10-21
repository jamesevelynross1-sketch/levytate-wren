"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Search, X } from "lucide-react";
import type { ExploreStandard } from "@/lib/levytate/explore/catalogue";
import {
  getExploreRouteHref, type ExploreRoute,
} from "@/lib/levytate/explore/occupational-routes";
import { ExploreFooter, ExploreHeader } from "./ExploreHome";

type Props = {
  route: ExploreRoute | null;
  standards: ExploreStandard[];
  pathwayName?: string;
  pathwaySource?: "live-official-api" | "historical-official-map" | "not-connected";
};

export function ExploreRouteStandards({ route, standards, pathwayName, pathwaySource }: Props) {
  const [search, setSearch] = useState("");
  const [level, setLevel] = useState(0);
  const [visibleCount, setVisibleCount] = useState(40);

  const filtered = useMemo(() => {
    const tokens = search.toLowerCase().trim().split(/\s+/).filter(Boolean).slice(0, 8);
    return standards.filter(standard => {
      if (level && standard.level !== level) return false;
      if (!tokens.length) return true;
      const content = [standard.title, standard.code, ...(standard.jobTitles || [])].join(" ").toLowerCase();
      return tokens.every(token => content.includes(token));
    });
  }, [standards, search, level]);

  function reset() {
    setSearch("");
    setLevel(0);
    setVisibleCount(40);
  }

  const title = pathwayName || route?.name || "Standards awaiting classification";
  const description = pathwayName
    ? "Explore the apprenticeships listed under this pathway in " + (route?.name || "the occupational map")
    : route?.description || "These standards have not yet been matched to one of the 15 official occupational routes in our catalogue.";
  const routeHref = route ? getExploreRouteHref(route) : "/explore";

  return (
    <>
      <ExploreHeader />
      <main className="mx-auto max-w-[980px] px-5 pb-24 pt-8 sm:px-8 sm:pt-12">
        <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-xs text-[#102c3d]/55">
          <Link href="/explore" className="inline-flex min-h-9 items-center gap-2 font-semibold text-[#117f70] hover:underline">
            <ArrowLeft size={14} aria-hidden="true" /> All routes
          </Link>
          {route ? (
            <>
              <span aria-hidden="true" className="text-[#102c3d]/25">/</span>
              {pathwayName ? (
                <Link href={routeHref} className="font-medium text-[#117f70] hover:underline">{route.name}</Link>
              ) : <span aria-current="page">{route.name}</span>}
            </>
          ) : null}
          {pathwayName || !route ? (
            <>
              <span aria-hidden="true" className="text-[#102c3d]/25">/</span>
              <span aria-current="page">{title}</span>
            </>
          ) : null}
        </nav>

        <section className="mt-8 max-w-[830px]">
          <p className="text-[11px] font-bold uppercase tracking-[.18em] text-[#117f70]">
            {pathwayName ? "Official occupational pathway" : "Apprenticeship routes"}
          </p>
          <h1 className="mt-4 text-[clamp(2.15rem,5.5vw,4rem)] font-semibold leading-[1.05] tracking-[-.06em] text-[#102c3d]">
            {title}
          </h1>
          <p className="mt-5 text-[15px] leading-8 text-[#102c3d]/65">
            {description}. Choose a standard to see what it could mean for your working life with Unpacked.
          </p>
        </section>

        <section aria-labelledby="route-programme-list" className="mt-10 sm:mt-12">
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[#102c3d]/10 pb-5">
            <h2 id="route-programme-list" className="text-xl font-semibold tracking-[-.035em]">
              Apprenticeship standards
            </h2>
            <p className="text-xs text-[#102c3d]/55">
              {standards.length} {standards.length === 1 ? "standard" : "standards"} {pathwayName ? "in this pathway" : "in this route"}
            </p>
          </div>

          <div className="mt-5 flex flex-wrap items-stretch gap-3">
            <label htmlFor="explore-route-search" className="relative flex h-[54px] min-w-[235px] flex-1 items-center gap-3 rounded-[14px] border border-[#102c3d]/15 bg-white px-4 focus-within:border-[#117f70] focus-within:ring-2 focus-within:ring-[#117f70]/10">
              <Search size={19} className="shrink-0 text-[#102c3d]/40" aria-hidden="true" />
              <span className="sr-only">Find a standard in {title}</span>
              <input
                id="explore-route-search"
                type="search"
                placeholder="Search standards in this route..."
                autoComplete="off"
                className="h-12 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[#102c3d]/40"
                value={search}
                onChange={event => { setSearch(event.target.value); setVisibleCount(40); }}
              />
              {search ? <button type="button" onClick={() => { setSearch(""); setVisibleCount(40); }} className="grid h-8 w-8 place-items-center rounded-full hover:bg-[#e8f1eb]" aria-label="Clear standard search"><X size={16} aria-hidden="true" /></button> : null}
            </label>
            <label htmlFor="explore-route-level" className="flex h-[54px] min-w-[165px] items-center justify-between gap-2 rounded-[14px] border border-[#102c3d]/15 bg-white px-4 text-sm font-medium text-[#102c3d]/65">
              Level
              <select
                id="explore-route-level"
                value={level}
                onChange={event => { setLevel(Number(event.target.value)); setVisibleCount(40); }}
                className="min-h-10 bg-transparent pl-2 text-sm font-semibold text-[#102c3d] outline-none"
              >
                <option value={0}>All</option>
                {[2, 3, 4, 5, 6, 7].map(value => <option value={value} key={value}>{value}</option>)}
              </select>
            </label>
          </div>

          {pathwaySource === "historical-official-map" ? (
            <p className="mt-4 rounded-xl border border-[#bb9b69]/25 bg-[#fff9eb] px-4 py-3 text-xs leading-6 text-[#705e40]">
              Preview mapping from a May 2019 official occupational map. A current government API check is required before public launch.
            </p>
          ) : null}
          <p role="status" aria-live="polite" className="mt-4 text-xs text-[#102c3d]/55">
            {filtered.length} {filtered.length === 1 ? "matching apprenticeship" : "matching apprenticeships"}
          </p>
          {filtered.length ? (
            <div className="mt-3 overflow-hidden rounded-[18px] border border-[#102c3d]/10 bg-white">
              <ul className="divide-y divide-[#102c3d]/10">
                {filtered.slice(0, visibleCount).map(standard => (
                  <li key={standard.code}>
                    <Link
                      prefetch={false}
                      href={"/explore/" + standard.code.toLowerCase()}
                      className="group flex min-h-[71px] items-center justify-between gap-4 px-5 py-4 transition hover:bg-[#eff5f0] focus-visible:bg-[#eff5f0] focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#117f70] sm:px-6"
                    >
                      <span className="min-w-0">
                        <span className="block text-[15px] font-semibold leading-6 tracking-[-.015em] text-[#102c3d] sm:text-[16px]">
                          {standard.title}
                        </span>
                        <span className="mt-1 block text-xs text-[#102c3d]/50">
                          Level {standard.level} <span className="px-1.5" aria-hidden="true">·</span> {standard.code}
                        </span>
                      </span>
                      <ArrowRight size={19} aria-hidden="true" className="shrink-0 text-[#117f70] transition group-hover:translate-x-1" />
                    </Link>
                  </li>
                ))}
              </ul>
              {filtered.length > visibleCount ? (
                <div className="border-t border-[#102c3d]/10 p-4 text-center">
                  <button type="button" onClick={() => setVisibleCount(n => n + 40)} className="min-h-[44px] rounded-full border border-[#102c3d]/20 px-6 text-xs font-semibold transition hover:bg-[#eff5f0]">
                    Show more standards
                  </button>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="mt-4 rounded-[18px] border border-[#102c3d]/10 bg-white p-10 text-center">
              <p className="font-semibold">No standards found</p>
              <p className="mt-2 text-sm leading-6 text-[#102c3d]/60">
                Try different wording, another level or choose another occupational route.
              </p>
              <div className="mt-5 flex flex-wrap justify-center gap-3">
                <button type="button" onClick={reset} className="min-h-10 rounded-full bg-[#102c3d] px-5 text-xs font-semibold text-white">Reset search</button>
                <Link href="/explore" className="inline-flex min-h-10 items-center rounded-full border border-[#102c3d]/20 px-5 text-xs font-semibold">All routes</Link>
              </div>
            </div>
          )}

          <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-[#102c3d]/10 pt-6 text-xs text-[#102c3d]/55">
            <span>Standards are based on our Skills England catalogue. Status and eligibility must be confirmed against the current official record.</span>
            <Link href={routeHref} className="shrink-0 font-semibold text-[#117f70] underline underline-offset-2">
              {pathwayName ? "All pathways" : "Browse other routes"}
            </Link>
          </div>
        </section>
      </main>
      <ExploreFooter />
    </>
  );
}
