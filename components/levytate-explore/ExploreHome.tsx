"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowDown, ArrowUpRight, BookOpen, Check, ChevronRight,
  Compass, Lightbulb, Search, Sparkles, Users, WandSparkles, X,
} from "lucide-react";
import {
  EXPLORER_INTERESTS, searchExploreCatalogue, type ExploreStandard,
} from "@/lib/levytate/explore/catalogue";

export function ExploreHeader() {
  return (
    <header className="border-b border-[#102c3d]/10 bg-[#f5f6f2]">
      <div className="mx-auto flex min-h-[82px] max-w-[1330px] items-center justify-between gap-4 px-5 sm:px-9">
        <Link href="/explore" className="flex items-center gap-3" aria-label="LevyTate Explore home">
          <Image src="/brand/levytate-logo-supplied.png" alt="LevyTate" width={131} height={46} className="h-[42px] w-auto max-w-[135px] object-contain" priority />
          <span className="h-6 w-px bg-[#102c3d]/20" aria-hidden="true" />
          <span className="text-[12px] font-bold uppercase tracking-[0.21em] text-[#102c3d]">Explore</span>
        </Link>
        <div className="flex items-center gap-3 sm:gap-7">
          <a href="/explore#how-it-works" className="hidden text-sm font-medium text-[#102c3d]/65 transition hover:text-[#102c3d] sm:inline">How it works</a>
          <a href="https://www.levytate.co.uk/" className="inline-flex min-h-[42px] items-center gap-2 rounded-full border border-[#102c3d]/15 px-4 text-xs font-semibold transition hover:border-[#102c3d]/40 hover:bg-white sm:px-5">
            For employers <ArrowUpRight size={15} aria-hidden="true" />
          </a>
        </div>
      </div>
    </header>
  );
}

function standardTags(standard: ExploreStandard) {
  return [standard.story?.theme || standard.route, "Level " + standard.level, standard.duration];
}

function StandardCard({ standard, index }: { standard: ExploreStandard; index: number }) {
  const accents = [
    "bg-[#e5f2eb] text-[#146c60]",
    "bg-[#f9e7e4] text-[#914b54]",
    "bg-[#e8ecf6] text-[#50618b]",
    "bg-[#f7ebd9] text-[#8c6238]",
  ];
  return (
    <Link href={"/explore/" + standard.code.toLowerCase()} className="group flex min-h-[270px] flex-col justify-between rounded-[22px] border border-[#102c3d]/10 bg-white p-5 transition-all duration-200 hover:-translate-y-1 hover:border-[#102c3d]/30 hover:shadow-[0_16px_38px_rgba(16,44,61,.09)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[#159b8f] sm:p-6">
      <div>
        <div className="flex items-start justify-between gap-3">
          <span className={"rounded-full px-3 py-1.5 text-[10px] font-bold tracking-[.045em] " + accents[index % accents.length]}>
            {standard.story ? standard.story.theme : standard.route}
          </span>
          <ArrowUpRight size={20} className="text-[#102c3d]/35 transition group-hover:text-[#159b8f]" aria-hidden="true" />
        </div>
        <h3 className="mt-5 text-[22px] font-semibold leading-tight tracking-[-.035em] text-[#102c3d] sm:text-[23px]">{standard.title}</h3>
        <p className="mt-3 text-sm leading-6 text-[#102c3d]/60">
          {standard.story?.hook || "See what this recognised apprenticeship could mean for your next step."}
        </p>
      </div>
      <div className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-[#102c3d]/10 pt-4 text-xs text-[#102c3d]/65">
        <span className="font-bold text-[#102c3d]">Level {standard.level}</span>
        <span className="h-1 w-1 rounded-full bg-[#102c3d]/30" aria-hidden="true" />
        <span>{standard.duration}</span>
        <span className="ml-auto text-[11px] font-semibold text-[#14796c]">{standard.story ? "De-fluffed" : "Explore"}</span>
      </div>
    </Link>
  );
}

export function ExploreHome({ standards }: { standards: ExploreStandard[] }) {
  const [query, setQuery] = useState("");
  const [interest, setInterest] = useState("");
  const [level, setLevel] = useState(0);
  const [visibleCount, setVisibleCount] = useState(9);
  const filtered = useMemo(() => searchExploreCatalogue(standards, query, interest, level || undefined), [standards, query, interest, level]);
  const visible = filtered.slice(0, visibleCount);
  const isFiltered = Boolean(query || interest || level);

  function clearFilters() {
    setQuery("");
    setInterest("");
    setLevel(0);
    setVisibleCount(9);
  }

  return (
    <>
      <ExploreHeader />
      <main>
        <section className="mx-auto max-w-[1330px] px-3 pt-3 sm:px-9 sm:pt-7">
          <div className="relative isolate overflow-hidden rounded-[26px] bg-[#102c3d] px-6 pb-9 pt-12 text-white sm:rounded-[30px] sm:px-12 sm:pb-14 sm:pt-16 lg:px-[7%]">
            <div aria-hidden="true" className="pointer-events-none absolute -right-24 -top-44 h-[390px] w-[390px] rounded-full border-[95px] border-[#c1eadb]/15 lg:right-[4%] lg:top-[-45%] lg:h-[650px] lg:w-[650px] lg:border-[145px]" />
            <div aria-hidden="true" className="pointer-events-none absolute -bottom-48 right-24 h-64 w-64 rounded-full bg-[#cf7280]/12 blur-[60px]" />
            <div className="relative z-10 max-w-[830px]">
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[.22em] text-[#c8ebdf]">
                <span className="h-2 w-2 rounded-full bg-[#d87c81]" /> A new way to grow at work
              </div>
              <h1 className="mt-6 max-w-[780px] text-[clamp(3.1rem,7.5vw,6.7rem)] font-semibold leading-[.99] tracking-[-.071em]">
                Your job isn&apos;t <span className="font-serif font-normal italic text-[#b9e7d5]">your limit.</span>
              </h1>
              <p className="mt-7 max-w-[540px] text-[16px] leading-[1.75] text-[#eff9f4]/77 sm:text-lg">
                You don&apos;t have to find a new job to find a new direction. Discover apprenticeships that could help you grow, right where you are.
              </p>
              <div className="mt-9 flex flex-wrap items-center gap-4">
                <a href="#discover" className="inline-flex min-h-[51px] items-center gap-3 rounded-full bg-[#c6ebdd] px-6 text-sm font-bold text-[#102c3d] transition hover:bg-white">
                  Find your next possibility <ArrowDown size={17} aria-hidden="true" />
                </a>
                <a href="#how-it-works" className="inline-flex min-h-[51px] items-center gap-2 text-sm font-semibold text-white/85 transition hover:text-white">
                  How Explore works <ChevronRight size={16} aria-hidden="true" />
                </a>
              </div>
            </div>
            <div className="relative z-10 mt-12 flex flex-wrap items-center gap-x-7 gap-y-3 border-t border-white/15 pt-5 text-xs text-white/70">
              <span className="flex items-center gap-2"><Check size={15} className="text-[#b9e7d5]" /> Free to explore</span>
              <span className="flex items-center gap-2"><Check size={15} className="text-[#b9e7d5]" /> No job search</span>
              <span className="flex items-center gap-2"><Check size={15} className="text-[#b9e7d5]" /> No account required</span>
            </div>
          </div>
        </section>

        <section id="discover" className="mx-auto max-w-[1330px] scroll-mt-6 px-5 pb-16 pt-16 sm:px-9 sm:pt-20">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div>
              <p className="text-xs font-bold uppercase tracking-[.2em] text-[#117f70]">01 / Follow your curiosity</p>
              <h2 className="mt-3 max-w-[630px] text-[clamp(2rem,4vw,3.5rem)] font-semibold leading-[1.07] tracking-[-.055em]">What would you like to get better at?</h2>
              <p className="mt-3 max-w-xl text-sm leading-7 text-[#102c3d]/60 sm:text-base">Start with what matters to you, not a complicated list of qualifications.</p>
            </div>
            <div className="hidden rounded-full border border-[#102c3d]/10 px-4 py-2 text-xs font-semibold text-[#102c3d]/60 sm:block">For people already in work</div>
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {EXPLORER_INTERESTS.map((item, index) => {
              const selected = interest === item.id;
              const icons = [<Sparkles key="spark" size={22} />, <Users key="users" size={22} />, <Lightbulb key="idea" size={22} />, <Compass key="compass" size={22} />];
              return (
                <button key={item.id} onClick={() => { setInterest(selected ? "" : item.id); setVisibleCount(9); }} type="button" aria-pressed={selected}
                  className={"group flex min-h-[161px] flex-col items-start rounded-[20px] border p-5 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[#159b8f] " +
                    (selected ? "border-[#159b8f] bg-[#e0f0e9] shadow-[inset_0_0_0_1px_#159b8f]" : "border-[#102c3d]/10 bg-white hover:border-[#102c3d]/30 hover:bg-[#ecf2eb]")}>
                  <span className={"mb-6 " + (selected ? "text-[#117f70]" : "text-[#b76670]")}>{icons[index]}</span>
                  <span className="text-[17px] font-semibold tracking-[-.035em]">{item.title}</span>
                  <span className="mt-1 text-xs leading-5 text-[#102c3d]/55">{item.subtitle}</span>
                </button>
              );
            })}
          </div>

          <div className="mt-11 flex flex-col gap-4 sm:flex-row sm:items-center">
            <label htmlFor="explore-search" className="relative flex min-h-[54px] flex-1 items-center rounded-[16px] border border-[#102c3d]/15 bg-white px-4 focus-within:border-[#159b8f] focus-within:ring-2 focus-within:ring-[#159b8f]/10">
              <Search size={20} className="shrink-0 text-[#102c3d]/40" aria-hidden="true" />
              <input id="explore-search" autoComplete="off" type="search" value={query} onChange={event => { setQuery(event.target.value); setVisibleCount(9); }}
                className="h-12 w-full bg-transparent px-3 text-sm text-[#102c3d] outline-none placeholder:text-[#102c3d]/40"
                placeholder="Search by skill, role or apprenticeship..." />
            </label>
            <label htmlFor="explore-level" className="flex min-h-[54px] items-center justify-between gap-4 rounded-[16px] border border-[#102c3d]/15 bg-white px-4 text-sm font-medium sm:min-w-[180px]">
              <span className="text-[#102c3d]/60">Level</span>
              <select id="explore-level" value={level} onChange={event => { setLevel(Number(event.target.value)); setVisibleCount(9); }} className="bg-transparent py-3 text-sm font-semibold outline-none">
                <option value={0}>All levels</option>
                {[2, 3, 4, 5, 6, 7].map(value => <option key={value} value={value}>{value}</option>)}
              </select>
            </label>
          </div>

          <div className="mt-8 flex min-h-10 flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="text-[22px] font-semibold tracking-[-.04em]">Worth a closer look</h3>
              <p role="status" aria-live="polite" className="mt-1 text-xs text-[#102c3d]/50">
                {filtered.length} approved {filtered.length === 1 ? "apprenticeship" : "apprenticeships"} {isFiltered ? "match your choices" : "to explore"}
              </p>
            </div>
            {isFiltered ? (
              <button type="button" onClick={clearFilters} className="inline-flex items-center gap-2 rounded-full border border-[#102c3d]/15 px-4 py-2 text-xs font-semibold hover:bg-white"><X size={14} /> Clear filters</button>
            ) : null}
          </div>

          {filtered.length ? (
            <>
              <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {visible.map((standard, index) => <StandardCard standard={standard} index={index} key={standard.code} />)}
              </div>
              {filtered.length > visibleCount ? (
                <div className="mt-9 flex justify-center">
                  <button type="button" onClick={() => setVisibleCount(count => count + 12)} className="inline-flex min-h-[49px] items-center gap-2 rounded-full border border-[#102c3d]/25 px-7 text-sm font-semibold transition hover:bg-white">
                    Show more apprenticeships <ArrowDown size={16} aria-hidden="true" />
                  </button>
                </div>
              ) : null}
            </>
          ) : (
            <div className="mt-5 rounded-[22px] border border-[#102c3d]/10 bg-white px-7 py-12 text-center">
              <BookOpen className="mx-auto text-[#117f70]" size={30} aria-hidden="true" />
              <h3 className="mt-4 text-xl font-semibold">Nothing matching that combination</h3>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#102c3d]/60">Try broader wording or remove a filter. There may still be a suitable option to discuss with your employer.</p>
              <button type="button" onClick={clearFilters} className="mt-6 rounded-full bg-[#102c3d] px-5 py-3 text-sm font-semibold text-white">See all apprenticeships</button>
            </div>
          )}
          <p className="mt-6 text-xs leading-6 text-[#102c3d]/50">
            Programme details are sourced from LevyTate&apos;s Skills England catalogue. The underlying information may change; check the linked official standard before making a decision. Learning eligibility and funding depend on individual circumstances.
          </p>
        </section>

        <section id="how-it-works" className="border-y border-[#102c3d]/10 bg-[#e8efe9]">
          <div className="mx-auto max-w-[1330px] px-5 py-16 sm:px-9 sm:py-20">
            <div className="flex flex-wrap items-end justify-between gap-6">
              <div>
                <p className="text-xs font-bold uppercase tracking-[.2em] text-[#117f70]">02 / From idea to conversation</p>
                <h2 className="mt-3 max-w-[690px] text-[clamp(2rem,4vw,3.4rem)] font-semibold leading-[1.08] tracking-[-.055em]">A next step that feels possible.</h2>
              </div>
              <span className="text-sm text-[#102c3d]/55">At your pace. In your control.</span>
            </div>
            <div className="mt-9 grid gap-4 md:grid-cols-3">
              {[
                { number: "01", title: "Discover", text: "Explore new possibilities through your interests and ambitions — even if you know nothing about apprenticeships.", icon: <Compass size={24} /> },
                { number: "02", title: "De-fluff", text: "Get a human explanation of what a programme could mean in your working life, alongside the official facts.", icon: <WandSparkles size={24} /> },
                { number: "03", title: "Open the door", text: "When you're ready, prepare a request for your manager or choose to ask the LevyTate team for guidance.", icon: <Users size={24} /> },
              ].map(step => (
                <div key={step.number} className="rounded-[22px] bg-white p-6">
                  <div className="flex items-center justify-between"><span className="text-xs font-bold tracking-[.18em] text-[#c66e79]">{step.number}</span><span className="text-[#117f70]">{step.icon}</span></div>
                  <h3 className="mt-12 text-2xl font-semibold tracking-[-.04em]">{step.title}</h3>
                  <p className="mt-3 text-sm leading-7 text-[#102c3d]/60">{step.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto grid max-w-[1330px] gap-6 px-5 py-16 sm:px-9 md:grid-cols-[1fr_1.2fr] md:items-center md:py-20">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.2em] text-[#117f70]">A little different</p>
            <h2 className="mt-4 text-[clamp(2rem,4vw,3rem)] font-semibold leading-[1.1] tracking-[-.055em]">You don't have to be looking for a new job.</h2>
          </div>
          <div className="rounded-[22px] bg-white p-7 text-[15px] leading-8 text-[#102c3d]/70">
            Apprenticeships aren't only for people entering the workforce. They can also help people already in a role develop new skills or take on new challenges. Your employer needs to support the programme, and it must be suitable for your work and previous experience — but exploring an option costs nothing and commits you to nothing.
          </div>
        </section>
      </main>
      <footer className="bg-[#102c3d]">
        <div className="mx-auto flex max-w-[1330px] flex-wrap items-center justify-between gap-5 px-5 py-8 text-xs text-white/65 sm:px-9">
          <div className="flex items-center gap-3"><span className="font-semibold tracking-[.19em] text-white">LEVYTATE / EXPLORE</span><span className="text-white/30">•</span><span>Discover what you're capable of.</span></div>
          <div className="flex gap-5">
            <a href="/levytate/privacy" className="hover:text-white">Privacy</a>
            <a href="https://skillsengland.education.gov.uk/apprenticeships" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-white">Skills England <ArrowUpRight size={13}/></a>
          </div>
        </div>
        <div className="mx-auto flex max-w-[1330px] flex-wrap items-center justify-between gap-5 border-t border-white/10 px-5 py-5 text-[11px] leading-5 text-white/55 sm:px-9">
          <a href="https://occupational-maps.skillsengland.education.gov.uk/public-api/" target="_blank" rel="noopener noreferrer" aria-label="Skills England official data source">
            <img src="https://occupational-maps.skillsengland.education.gov.uk/media/xmehhrr0/skills-england_lesser_arms_stacked-dfe-blue-se-logo.svg?rmode=max&amp;width=500" alt="Skills England" loading="lazy" width="126" height="58" className="h-auto w-[126px] rounded-lg bg-white p-2" />
          </a>
          <p>© Skills England 2025 · Official source information licensed under the <a href="https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-white">Open Government Licence v3.0</a>. Plain-English guides are LevyTate interpretations.</p>
        </div>
      </footer>
    </>
  );
}
