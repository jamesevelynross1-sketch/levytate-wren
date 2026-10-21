"use client";

import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight, ArrowUpRight, BriefcaseBusiness, Factory, GraduationCap,
  HardHat, HeartHandshake, HeartPulse, Leaf, Megaphone, Monitor, Palette,
  Scale, Scissors, ShieldCheck, Truck, Utensils,
} from "lucide-react";
import { ExploreInstallAction } from "./ExploreInstallAction";
import type { ExploreStandard } from "@/lib/levytate/explore/catalogue";
import {
  UNCATEGORISED_ROUTE_SLUG,
  countUncategorisedStandards, getExploreRouteGroups, getExploreRouteHref,
  type ExploreRoute, type ExploreRouteGroup,
} from "@/lib/levytate/explore/occupational-routes";

export function ExploreHeader() {
  return (
    <header className="border-b border-[#102c3d]/10 bg-[#f8f8f5]">
      <div className="mx-auto flex min-h-[76px] max-w-[1220px] items-center justify-between gap-3 px-5 sm:px-8">
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

const tileColours = {
  mint: { background: "#ebf4ed", accent: "#156e63", iconBackground: "#d3e9db" },
  cream: { background: "#f8f3e7", accent: "#87613f", iconBackground: "#eee4cf" },
  rose: { background: "#f9eced", accent: "#ad5e6b", iconBackground: "#f0dce0" },
  peach: { background: "#faf0e5", accent: "#a86640", iconBackground: "#f3dfc9" },
  lavender: { background: "#f0eef8", accent: "#746298", iconBackground: "#e4def3" },
  slate: { background: "#edf1f4", accent: "#4c6981", iconBackground: "#dce5eb" },
} as const;

function RouteTile({ route, count }: ExploreRouteGroup) {
  const palette = tileColours[route.tone];
  const Icon = routeIcons[route.icon];

  return (
    <Link
      href={getExploreRouteHref(route)}
      prefetch={false}
      className="group relative flex min-h-[205px] flex-col justify-between overflow-hidden rounded-[21px] border border-[#102c3d]/[.06] px-5 pb-5 pt-6 transition duration-200 hover:-translate-y-1 hover:border-[#102c3d]/20 hover:shadow-[0_17px_45px_rgba(16,44,61,.085)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[#117f70] sm:p-6"
      style={{ backgroundColor: palette.background }}
      aria-label={route.name + " — " + count + " apprenticeships"}
    >
      <div className="relative z-10 flex items-start justify-between gap-4">
        <span
          className="grid h-[47px] w-[47px] shrink-0 place-items-center rounded-[15px]"
          style={{ backgroundColor: palette.iconBackground, color: palette.accent }}
          aria-hidden="true"
        >
          <Icon size={23} strokeWidth={1.7} />
        </span>
        <ArrowUpRight
          size={20}
          className="text-[#102c3d]/30 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-[#102c3d]"
          aria-hidden="true"
        />
      </div>
      <div className="relative z-10 mt-8">
        <h3 className="max-w-[290px] text-[20px] font-semibold leading-[1.16] tracking-[-.045em] text-[#102c3d] sm:text-[21px]">
          {route.name}
        </h3>
        <p className="mt-2 text-[13px] leading-[1.5] text-[#102c3d]/55">{route.description}</p>
        <div className="mt-5 flex items-center justify-between gap-3 border-t border-[#102c3d]/10 pt-4">
          <span className="text-xs font-semibold text-[#102c3d]/65">
            {count} {count === 1 ? "apprenticeship" : "apprenticeships"}
          </span>
          <span className="inline-flex items-center gap-1 text-[12px] font-bold" style={{ color: palette.accent }}>
            View standards <ArrowRight size={14} aria-hidden="true" />
          </span>
        </div>
      </div>
    </Link>
  );
}

export function ExploreFooter() {
  return (
    <footer className="border-t border-[#102c3d]/10 bg-[#102c3d] px-5 py-7 text-white/60">
      <div className="mx-auto flex max-w-[1220px] flex-wrap items-center justify-between gap-3 text-xs">
        <span>LevyTate Explore · Discover what you&apos;re capable of.</span>
        <div className="flex flex-wrap items-center gap-4 sm:gap-5">
          <Link href="/explore/privacy" className="hover:text-white">Privacy</Link>
          <a href="https://occupational-maps.skillsengland.education.gov.uk/" rel="noopener noreferrer" target="_blank" className="hover:text-white">Skills England</a>
          <a href="https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/" rel="noopener noreferrer" target="_blank" className="hover:text-white">Open Government Licence</a>
        </div>
      </div>
      <div className="mx-auto mt-5 flex max-w-[1220px] flex-wrap items-center gap-4 border-t border-white/10 pt-5">
        <a href="https://occupational-maps.skillsengland.education.gov.uk/" target="_blank" rel="noopener noreferrer" aria-label="Skills England occupational standards data">
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
        <p className="max-w-[750px] text-[11px] leading-6">
          © Skills England 2025. Source information licensed under Open Government Licence v3.0.
          LevyTate Unpacked provides AI explanations, not official apprenticeship or funding advice.
        </p>
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
      <main className="mx-auto max-w-[1220px] px-5 pb-24 pt-12 sm:px-8 sm:pt-16">
        <section className="max-w-[850px]">
          <p className="text-[11px] font-bold uppercase tracking-[.18em] text-[#117f70]">
            LevyTate Explore <span className="mx-2 text-[#102c3d]/25">/</span> Your next chapter
          </p>
          <h1 className="mt-5 max-w-[760px] text-[clamp(2.6rem,6vw,5rem)] font-semibold leading-[1.03] tracking-[-.066em] text-[#102c3d]">
            Where could you <span className="font-serif font-normal italic text-[#117f70]">go next?</span>
          </h1>
          <p className="mt-5 max-w-[650px] text-[15px] leading-8 text-[#102c3d]/65 sm:text-[17px]">
            Explore apprenticeships for people already in work. Choose a field,
            find a programme, then discover what it could mean for you with <strong className="font-semibold text-[#102c3d]">Unpacked</strong>.
          </p>
        </section>

        <section aria-labelledby="route-list-heading" className="mt-12 sm:mt-16">
          <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[#102c3d]/10 pb-5">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[.15em] text-[#117f70]">Start with a field</p>
              <h2 id="route-list-heading" className="mt-2 text-[clamp(1.55rem,3vw,2.2rem)] font-semibold tracking-[-.045em] text-[#102c3d]">
                Explore apprenticeship routes
              </h2>
            </div>
            <span className="pb-1 text-xs font-medium text-[#102c3d]/55">
              15 official routes <span className="px-2 text-[#102c3d]/20">/</span> {standards.length} listed standards
            </span>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 sm:gap-4">
            {routeGroups.map(group => (
              <RouteTile key={group.route.slug} route={group.route} count={group.count} />
            ))}
          </div>
          {uncategorised > 0 ? (
            <div className="mt-6 rounded-[15px] border border-[#102c3d]/10 bg-white px-5 py-4 text-xs leading-6 text-[#102c3d]/65">
              {uncategorised} {uncategorised === 1 ? "standard is" : "standards are"} not yet assigned to a recognised Skills England route in our current catalogue.{" "}
              <Link href={"/explore/routes/" + UNCATEGORISED_ROUTE_SLUG} className="font-semibold text-[#117f70] underline underline-offset-2">
                Browse unclassified standards
              </Link>
            </div>
          ) : null}
          <p className="mt-6 text-xs leading-6 text-[#102c3d]/50">
            These are Skills England&apos;s 15 occupational routes, not LevyTate-generated categories.
            Counts reflect the approved standards currently recorded in our catalogue and may change.
          </p>
        </section>
      </main>
      <ExploreFooter />
    </>
  );
}
