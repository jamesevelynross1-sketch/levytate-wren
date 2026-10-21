"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, ArrowUpRight, Search, WandSparkles, X } from "lucide-react";
import { ExploreInstallAction } from "./ExploreInstallAction";
import type { ExploreStandard } from "@/lib/levytate/explore/catalogue";

export function ExploreHeader() {
  return (
    <header className="border-b border-[#102c3d]/10 bg-[#f8f8f5]">
      <div className="mx-auto flex min-h-[76px] max-w-[1120px] items-center justify-between gap-3 px-5 sm:px-8">
        <Link href="/explore" className="flex min-w-0 items-center gap-3" aria-label="LevyTate Explore home">
          <Image
            src="/brand/levytate-logo-supplied.png"
            alt="LevyTate"
            width={131}
            height={46}
            className="h-[39px] w-auto max-w-[132px] object-contain"
            priority
          />
          <span className="h-6 w-px bg-[#102c3d]/20" aria-hidden="true" />
          <span className="text-[11px] font-bold uppercase tracking-[.18em] text-[#102c3d] sm:text-xs">Explore</span>
        </Link>
        <div className="flex shrink-0 items-center gap-2 sm:gap-4">
          <a
            href="https://www.levytate.co.uk/"
            className="hidden min-h-[42px] items-center gap-2 text-xs font-semibold text-[#102c3d]/70 hover:text-[#102c3d] md:inline-flex"
          >
            For employers <ArrowUpRight size={14} aria-hidden="true" />
          </a>
          <ExploreInstallAction />
        </div>
      </div>
    </header>
  );
}

export function ExploreHome({ standards }: { standards: ExploreStandard[] }) {
  const [search, setSearch] = useState("");
  const [visibleCount, setVisibleCount] = useState(50);
  const results = useMemo(() => {
    const query = search.toLowerCase().trim();
    if (!query) return standards;
    const terms = query.split(/\s+/).filter(Boolean).slice(0, 8);
    return standards.filter(item => {
      const searchable = [item.title, item.code, item.route, ...(item.jobTitles || [])].join(" ").toLowerCase();
      return terms.every(term => searchable.includes(term));
    });
  }, [search, standards]);
  const visible = results.slice(0, visibleCount);

  return (
    <>
      <ExploreHeader />
      <main className="mx-auto max-w-[960px] px-5 pb-24 pt-12 sm:px-8 sm:pt-16">
        <div className="max-w-[730px]">
          <div className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.17em] text-[#117f70]">
            <WandSparkles size={17} aria-hidden="true" /> LevyTate Explore
          </div>
          <h1 className="mt-5 text-[clamp(2.55rem,6vw,4.7rem)] font-semibold leading-[1.05] tracking-[-.062em]">
            Apprenticeships,
            <span className="block font-serif font-normal italic text-[#117f70]">without the jargon.</span>
          </h1>
          <p className="mt-6 max-w-xl text-[15px] leading-8 text-[#102c3d]/65 sm:text-[17px]">
            Already working and want to develop? Find an apprenticeship standard below.
            Tap its name and our AI will translate the official information into plain English.
          </p>
        </div>

        <section aria-labelledby="explore-list-heading" className="mt-11">
          <label htmlFor="standard-search" className="relative flex h-[58px] items-center gap-3 rounded-[15px] border border-[#102c3d]/15 bg-white px-4 focus-within:border-[#117f70] focus-within:ring-2 focus-within:ring-[#117f70]/10">
            <Search size={20} className="shrink-0 text-[#102c3d]/40" aria-hidden="true" />
            <span className="sr-only">Search apprenticeship standards</span>
            <input
              id="standard-search"
              type="search"
              autoComplete="off"
              spellCheck={false}
              placeholder="Search apprenticeship standard names..."
              className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-[#102c3d]/40"
              value={search}
              onChange={event => { setSearch(event.target.value); setVisibleCount(50); }}
            />
            {search ? (
              <button type="button" className="grid h-8 w-8 place-items-center rounded-full hover:bg-[#e9efeb]" onClick={() => { setSearch(""); setVisibleCount(50); }} aria-label="Clear search">
                <X size={18} aria-hidden="true" />
              </button>
            ) : null}
          </label>

          <div className="mt-8 flex items-end justify-between gap-4">
            <h2 id="explore-list-heading" className="text-xl font-semibold tracking-[-.035em]">Apprenticeship standards</h2>
            <p role="status" aria-live="polite" className="shrink-0 text-xs text-[#102c3d]/55">
              {results.length} {results.length === 1 ? "standard" : "standards"}
            </p>
          </div>

          {results.length ? (
            <div className="mt-4 overflow-hidden rounded-[18px] border border-[#102c3d]/10 bg-white">
              <ul className="divide-y divide-[#102c3d]/10">
                {visible.map(standard => (
                  <li key={standard.code}>
                    <Link
                      href={"/explore/" + standard.code.toLowerCase()}
                      className="group flex min-h-[70px] items-center justify-between gap-4 px-5 py-4 transition hover:bg-[#eff5f0] focus-visible:bg-[#eff5f0] focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#117f70] sm:px-6"
                      prefetch={false}
                    >
                      <span className="min-w-0">
                        <span className="block text-[15px] font-semibold leading-6 tracking-[-.01em] text-[#102c3d] sm:text-[16px]">{standard.title}</span>
                        <span className="mt-1 block text-[12px] text-[#102c3d]/50">Level {standard.level} · {standard.code}</span>
                      </span>
                      <ArrowRight size={19} className="shrink-0 text-[#117f70] transition-transform group-hover:translate-x-1" aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ul>
              {results.length > visibleCount ? (
                <div className="border-t border-[#102c3d]/10 p-4 text-center">
                  <button type="button" onClick={() => setVisibleCount(count => count + 50)} className="min-h-[43px] rounded-full border border-[#102c3d]/20 px-6 text-xs font-bold hover:bg-[#eff5f0]">
                    Show more standards
                  </button>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="mt-4 rounded-[18px] border border-[#102c3d]/10 bg-white px-6 py-12 text-center">
              <p className="font-semibold">No matching standards</p>
              <p className="mt-2 text-sm leading-6 text-[#102c3d]/60">Try a different name or a broader search.</p>
              <button type="button" onClick={() => setSearch("")} className="mt-4 rounded-full bg-[#102c3d] px-5 py-3 text-xs font-semibold text-white">Show all standards</button>
            </div>
          )}
          <p className="mt-5 text-xs leading-6 text-[#102c3d]/50">
            Based on LevyTate&apos;s Skills England apprenticeship catalogue. Approval status and funding can change; always check the original official record before making a decision.
          </p>
        </section>
      </main>
      <footer className="border-t border-[#102c3d]/10 bg-[#102c3d] px-5 py-7 text-white/60">
        <div className="mx-auto flex max-w-[960px] flex-wrap items-center justify-between gap-3 text-xs">
          <span>LevyTate Explore · Discover what you&apos;re capable of.</span>
          <div className="flex items-center gap-5">
            <Link href="/explore/privacy" className="hover:text-white">Privacy</Link>
            <a href="https://occupational-maps.skillsengland.education.gov.uk/public-api/" rel="noopener noreferrer" target="_blank" className="hover:text-white">Skills England</a>
            <a href="https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/" rel="noopener noreferrer" target="_blank" className="hover:text-white">Open Government Licence</a>
          </div>
        </div>
        <p className="mx-auto mt-3 max-w-[960px] text-[11px]">© Skills England 2025. Source information licensed under Open Government Licence v3.0. Humanised AI explanations are produced by LevyTate.</p>
      </footer>
    </>
  );
}
