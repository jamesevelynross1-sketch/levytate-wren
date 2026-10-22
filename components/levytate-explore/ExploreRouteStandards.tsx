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
  pathwaySlug?: string;
};

export function ExploreRouteStandards({ route, standards, pathwayName, pathwaySource, pathwaySlug }: Props) {
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
      <main className="mx-auto max-w-[1100px] px-4 pb-24 pt-6 sm:px-8 sm:pt-9">
        <nav aria-label="Breadcrumb" className="flex min-h-11 flex-wrap items-center gap-2 text-xs text-[#142f3a]/65">
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

        <section className="explore-directory-hero mt-5">
          <p className="explore-eyebrow text-[#125f52]">
            {pathwayName ? "Official occupational pathway" : "Apprenticeship routes"}
          </p>
          <h1 className="explore-display mt-5 max-w-[820px] text-[clamp(2.4rem,6vw,4.7rem)]">
            {title}
          </h1>
          <p className="mt-5 max-w-[720px] text-[15px] leading-[1.85] text-[#142f3a]/80 sm:text-[17px]">
            {description}. Choose a standard to see what it could mean for your working life with Unpacked.
          </p>
        </section>

        <section aria-labelledby="route-programme-list" className="mt-11 sm:mt-14">
          <div className="explore-section-lead">
            <h2 id="route-programme-list" className="text-[clamp(24px,3vw,33px)] font-extrabold tracking-[-.055em]">
              Apprenticeship standards
            </h2>
            <p className="text-xs text-[#102c3d]/55">
              {standards.length} {standards.length === 1 ? "standard" : "standards"} {pathwayName ? "in this pathway" : "in this route"}
            </p>
          </div>

          <div className="mt-5 flex flex-wrap items-stretch gap-3">
            <label htmlFor="explore-route-search" className="explore-search-box relative flex min-w-[235px] flex-1 items-center gap-3 px-4">
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
            <label htmlFor="explore-route-level" className="explore-search-box flex min-w-[165px] items-center justify-between gap-2 px-4 text-sm font-semibold text-[#142f3a]/75">
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
          <p role="status" aria-live="polite" className="mt-4 text-xs font-medium text-[#142f3a]/60">
            {filtered.length} {filtered.length === 1 ? "matching apprenticeship" : "matching apprenticeships"}
          </p>
          {filtered.length ? (
            <div className="explore-directory-list mt-3">
              <ul className="divide-y divide-[#102c3d]/10">
                {filtered.slice(0, visibleCount).map(standard => (
                  <li key={standard.code}>
                    <Link
                      prefetch={false}
                      href={"/explore/" + standard.code.toLowerCase() + (route && pathwaySlug ? "?from=" + encodeURIComponent(getExploreRouteHref(route) + "/pathways/" + pathwaySlug) : "")}
                      className="explore-directory-row group focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#117f70]"
                    >
                      <span className="min-w-0">
                        <span className="block text-[16px] font-extrabold leading-[1.45] tracking-[-.025em] text-[#142f3a] sm:text-[17px]">
                          {standard.title}
                        </span>
                        <span className="mt-1 block text-[12px] font-medium text-[#142f3a]/60">
                          Level {standard.level} <span className="px-1.5" aria-hidden="true">·</span> {standard.code}
                        </span>
                      </span>
                      <ArrowRight size={19} aria-hidden="true" className="shrink-0 text-[#13715d] transition group-hover:translate-x-1" />
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
