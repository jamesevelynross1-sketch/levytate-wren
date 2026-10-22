"use client";

import Image from "next/image";
import Link from "next/link";
import type { CSSProperties } from "react";
import {
  ArrowDownRight, ArrowRight, ArrowUpRight, BriefcaseBusiness, Factory,
  GraduationCap, HardHat, HeartHandshake, HeartPulse, Leaf, Megaphone,
  Monitor, Palette, Scale, Scissors, ShieldCheck, Sparkles, Truck, Utensils,
} from "lucide-react";
import { ExploreInstallAction } from "./ExploreInstallAction";
import type { ExploreStandard } from "@/lib/levytate/explore/catalogue";
import {
  UNCATEGORISED_ROUTE_SLUG,
  countUncategorisedStandards, getExploreRouteGroups, getExploreRouteHref,
  type ExploreRouteGroup,
} from "@/lib/levytate/explore/occupational-routes";

export function ExploreHeader() {
  return (
    <header className="explore-header">
      <div className="explore-header-inner mx-auto flex max-w-[1220px] items-center justify-between gap-3 px-5 sm:px-8">
        <Link href="/explore" className="flex min-w-0 items-center gap-3" aria-label="LevyTate Explore home">
          {/* Retain the supplied dimensional LevyTate wordmark exactly. */}
          <Image
            src="/brand/levytate-logo-supplied.png"
            alt="LevyTate"
            width={131}
            height={46}
            className="h-[40px] w-auto max-w-[132px] object-contain"
            priority
          />
          <span className="h-6 w-px bg-[#142f3a]/20" aria-hidden="true" />
          <span className="explore-identifier">EXPLORE</span>
        </Link>
        <div className="flex shrink-0 items-center gap-3 sm:gap-6">
          <a
            href="https://www.levytate.co.uk/"
            className="hidden min-h-11 items-center gap-2 text-xs font-semibold text-[#142f3a]/70 transition hover:text-[#142f3a] md:inline-flex"
          >
            For employers <ArrowUpRight size={15} aria-hidden="true" />
          </a>
          <ExploreInstallAction />
        </div>
      </div>
    </header>
  );
}

const routeIcons = {
  leaf: Leaf,
  briefcase: BriefcaseBusiness,
  "heart-handshake": HeartHandshake,
  utensils: Utensils,
  "hard-hat": HardHat,
  palette: Palette,
  monitor: Monitor,
  "graduation-cap": GraduationCap,
  factory: Factory,
  scissors: Scissors,
  "heart-pulse": HeartPulse,
  scale: Scale,
  "shield-check": ShieldCheck,
  megaphone: Megaphone,
  truck: Truck,
} as const;

const routePalette = {
  mint: { background: "#bce8cf", accent: "#0d6456" },
  cream: { background: "#f5e8bd", accent: "#795729" },
  rose: { background: "#fad5d9", accent: "#904355" },
  peach: { background: "#f8d2b2", accent: "#87482c" },
  lavender: { background: "#d9d2fa", accent: "#5e4897" },
  slate: { background: "#cae5f2", accent: "#345e7a" },
} as const;

function RouteTile({ route, count, index }: ExploreRouteGroup & { index: number }) {
  const palette = routePalette[route.tone];
  const Icon = routeIcons[route.icon];
  const tileStyle = {
    "--tile-bg": palette.background,
    "--tile-accent": palette.accent,
  } as CSSProperties;

  return (
    <Link
      href={getExploreRouteHref(route)}
      prefetch={false}
      className="explore-route-card group focus-visible:outline-offset-3"
      style={tileStyle}
      aria-label={route.name + " — " + count + " apprenticeships"}
    >
      <div className="relative z-10 flex items-start justify-between gap-4">
        <span className="explore-route-number">{String(index + 1).padStart(2, "0")} / 15</span>
        <span className="explore-route-icon">
          <Icon size={23} strokeWidth={1.8} aria-hidden="true" />
        </span>
      </div>
      <div className="relative z-10 mt-6">
        <h3 className="explore-route-title">{route.name}</h3>
        <p className="explore-route-description mt-2">{route.description}</p>
        <div className="explore-route-bottom">
          <span className="font-semibold opacity-75">
            {count} {count === 1 ? "apprenticeship" : "apprenticeships"}
          </span>
          <span className="flex items-center gap-2 font-extrabold">
            Explore <span className="explore-route-arrow"><ArrowRight size={16} aria-hidden="true" /></span>
          </span>
        </div>
      </div>
    </Link>
  );
}

export function ExploreFooter() {
  return (
    <footer className="bg-[#142f3a] px-5 pb-8 pt-9 text-white/70">
      <div className="mx-auto max-w-[1220px]">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <p className="text-[15px] font-extrabold tracking-[-.03em] text-white">LevyTate <span className="text-[#d9f3a1]">Explore</span></p>
            <p className="mt-1 text-[12px]">Discover what you&apos;re capable of.</p>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-3 text-xs font-semibold">
            <Link href="/explore/privacy" className="min-h-9 py-2 hover:text-white">Privacy</Link>
            <a href="https://occupational-maps.skillsengland.education.gov.uk/" rel="noopener noreferrer" target="_blank" className="min-h-9 py-2 hover:text-white">Skills England</a>
            <a href="https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/" rel="noopener noreferrer" target="_blank" className="min-h-9 py-2 hover:text-white">Open Government Licence</a>
          </div>
        </div>
        <div className="mt-7 flex flex-wrap items-center gap-4 border-t border-white/20 pt-5">
          <a
            href="https://occupational-maps.skillsengland.education.gov.uk/"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Skills England occupational standards data"
            className="shrink-0"
          >
            <Image
              unoptimized
              src="https://occupational-maps.skillsengland.education.gov.uk/media/xmehhrr0/skills-england_lesser_arms_stacked-dfe-blue-se-logo.svg?rmode=max&amp;width=500"
              alt="Skills England"
              loading="lazy"
              width={126}
              height={58}
              className="w-[126px] rounded-lg bg-white p-2"
            />
          </a>
          <p className="max-w-[740px] text-[11px] leading-[1.9] text-white/65">
            © Skills England 2025. Source information under Open Government Licence v3.0.
            LevyTate Unpacked translates official information into plain language; it is not an official
            eligibility assessment or funding guarantee.
          </p>
        </div>
      </div>
    </footer>
  );
}

export function ExploreHome({ standards }: { standards: ExploreStandard[] }) {
  const routeGroups = getExploreRouteGroups(standards);
  const uncategorised = countUncategorisedStandards(standards);

  return (
    <>
      <ExploreHeader />
      <main className="mx-auto max-w-[1220px] px-4 pb-20 pt-5 sm:px-8 sm:pt-7">
        <section className="explore-hero">
          <div className="explore-hero-body">
            <p className="explore-eyebrow text-[#d9f3a1]">A new direction can start right here</p>
            <h1 className="explore-display mt-6 max-w-[790px] text-[clamp(3.15rem,7.3vw,6.5rem)]">
              You&apos;re not <span className="sm:whitespace-nowrap">done <em>growing.</em></span>
            </h1>
            <p className="mt-6 max-w-[500px] text-[15px] leading-[1.8] text-white/85 sm:text-[17px]">
              Already in work? Find an apprenticeship that could take your skills somewhere new.
              No job hunt. Just possibilities.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <a
                href="#routes"
                className="inline-flex min-h-[49px] items-center gap-2 rounded-full bg-[#d9f3a1] px-5 text-[13px] font-extrabold text-[#142f3a] transition hover:bg-white"
              >
                Find your field <ArrowDownRight size={19} aria-hidden="true" />
              </a>
              <span className="explore-hero-note">Free to explore <span aria-hidden="true">✦</span> No account required</span>
            </div>
          </div>
        </section>

        <section id="routes" aria-labelledby="route-list-heading" className="mt-12 scroll-mt-8 sm:mt-16">
          <div className="explore-section-lead">
            <div>
              <p className="explore-eyebrow mb-2 text-[#147362]">01 / Choose a field</p>
              <h2 id="route-list-heading">Where do you want to go?</h2>
            </div>
            <p className="text-[12px] font-semibold text-[#142f3a]/65">
              15 official occupational routes <span className="mx-2 text-[#142f3a]/20">•</span> {standards.length} standards
            </p>
          </div>

          <div className="explore-route-grid mt-5 grid sm:grid-cols-2 lg:grid-cols-3">
            {routeGroups.map((group, index) => (
              <RouteTile key={group.route.slug} route={group.route} count={group.count} index={index} />
            ))}
          </div>

          {uncategorised > 0 ? (
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-[17px] border border-[#142f3a]/15 bg-white px-5 py-4 text-[13px] leading-6">
              <span>{uncategorised} {uncategorised === 1 ? "standard is" : "standards are"} awaiting an official occupational route.</span>
              <Link href={"/explore/routes/" + UNCATEGORISED_ROUTE_SLUG} className="inline-flex min-h-10 items-center gap-2 font-bold text-[#126b59] underline underline-offset-4">
                View unclassified standards <ArrowUpRight size={16} aria-hidden="true" />
              </Link>
            </div>
          ) : null}

          <div className="mt-7 flex flex-wrap items-start justify-between gap-3">
            <p className="explore-editorial-note max-w-[770px]">
              These tiles use Skills England&apos;s official occupational routes. We&apos;re making the
              information easier to explore, not changing the government classification.
              Individual standards and funding status can change.
            </p>
            <span className="explore-soft-stamp">
              <Sparkles size={14} className="text-[#127365]" aria-hidden="true" /> Powered by official standards
            </span>
          </div>
        </section>
      </main>
      <ExploreFooter />
    </>
  );
}
