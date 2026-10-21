import Link from "next/link";
import {
  ArrowLeft, ArrowRight, ArrowUpRight, BriefcaseBusiness, Layers3,
  Megaphone, MessagesSquare, PackageCheck, ShoppingBag,
} from "lucide-react";
import type { ExploreRoute } from "@/lib/levytate/explore/occupational-routes";
import type { ExplorePathwayMap } from "@/lib/levytate/explore/official-pathways";
import { ExploreFooter, ExploreHeader } from "./ExploreHome";

type Props = {
  route: ExploreRoute;
  mapping: ExplorePathwayMap;
};

const palette = [
  { background: "#e6f0e9", iconBackground: "#cce6d8", accent: "#176f60" },
  { background: "#f9ece8", iconBackground: "#f1dad3", accent: "#a66060" },
  { background: "#f6f0e3", iconBackground: "#e9deca", accent: "#83633a" },
  { background: "#ebeff8", iconBackground: "#dce2f2", accent: "#556ca2" },
] as const;

function PathwayIcon({ slug }: { slug: string }) {
  const icons: Record<string, typeof Layers3> = {
    retail: ShoppingBag,
    "customer-service": MessagesSquare,
    marketing: Megaphone,
    procurement: PackageCheck,
  };
  const Icon = icons[slug] || Layers3;
  return <Icon size={23} strokeWidth={1.7} aria-hidden="true" />;
}

export function ExploreRoutePathways({ route, mapping }: Props) {
  const hasPathways = mapping.groups.length > 0;
  const historical = mapping.source === "historical-official-map";
  const unavailable = mapping.source === "not-connected";
  const routeHref = "/explore/routes/" + route.slug;

  return (
    <>
      <ExploreHeader />
      <main className="mx-auto max-w-[1100px] px-5 pb-24 pt-8 text-[#102c3d] sm:px-8 sm:pt-12">
        <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-xs text-[#102c3d]/55">
          <Link href="/explore" className="inline-flex min-h-9 items-center gap-2 font-semibold text-[#117f70] hover:underline">
            <ArrowLeft size={14} aria-hidden="true" /> All routes
          </Link>
          <span aria-hidden="true" className="text-[#102c3d]/25">/</span>
          <span aria-current="page">{route.name}</span>
        </nav>

        <section className="mt-8 max-w-[900px]">
          <p className="text-[11px] font-bold uppercase tracking-[.17em] text-[#117f70]">
            Skills England <span className="mx-2 text-[#102c3d]/25">/</span> Occupational route
          </p>
          <h1 className="mt-4 text-[clamp(2.3rem,5.6vw,4.5rem)] font-semibold leading-[1.05] tracking-[-.062em]">
            {route.name}
          </h1>
          <p className="mt-5 max-w-[690px] text-[15px] leading-8 text-[#102c3d]/65 sm:text-[17px]">
            {route.description}. {hasPathways
              ? "Choose a pathway to discover the apprenticeships within it."
              : "Explore the apprenticeship standards while we complete the official pathway mapping."}
          </p>
        </section>

        <section aria-labelledby="explore-pathways-heading" className="mt-11 sm:mt-14">
          <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[#102c3d]/10 pb-5">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[.15em] text-[#117f70]">Find your direction</p>
              <h2 id="explore-pathways-heading" className="mt-2 text-[clamp(1.65rem,3vw,2.15rem)] font-semibold tracking-[-.045em]">
                {hasPathways ? "Choose a pathway" : "Explore the standards"}
              </h2>
            </div>
            <span className="pb-1 text-xs text-[#102c3d]/55">
              {mapping.totalRouteStandards} approved {mapping.totalRouteStandards === 1 ? "standard" : "standards"} in this route
            </span>
          </div>

          {hasPathways ? (
            <div className="mt-6 grid gap-3 sm:grid-cols-2 sm:gap-4">
              {mapping.groups.map((group, index) => {
                const theme = palette[index % palette.length];
                return (
                  <Link
                    key={group.slug}
                    prefetch={false}
                    href={routeHref + "/pathways/" + group.slug}
                    className="group flex min-h-[192px] flex-col justify-between rounded-[22px] border border-[#102c3d]/[.06] p-6 transition duration-200 hover:-translate-y-1 hover:border-[#102c3d]/20 hover:shadow-[0_16px_40px_rgba(16,44,61,.09)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[#117f70]"
                    style={{ backgroundColor: theme.background }}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <span
                        className="grid h-[49px] w-[49px] place-items-center rounded-[15px]"
                        style={{ backgroundColor: theme.iconBackground, color: theme.accent }}
                      >
                        <PathwayIcon slug={group.slug} />
                      </span>
                      <ArrowUpRight size={20} aria-hidden="true" className="text-[#102c3d]/35 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                    </div>
                    <div className="mt-8">
                      <h3 className="text-[24px] font-semibold tracking-[-.04em]">{group.name}</h3>
                      <div className="mt-4 flex items-center justify-between gap-3 border-t border-[#102c3d]/10 pt-4">
                        <span className="text-xs text-[#102c3d]/65">
                          {group.standardCodes.length} {group.standardCodes.length === 1 ? "apprenticeship" : "apprenticeships"} mapped
                        </span>
                        <span className="flex items-center gap-1 text-xs font-bold" style={{ color: theme.accent }}>
                          View standards <ArrowRight size={15} aria-hidden="true" />
                        </span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="mt-6 rounded-[22px] border border-[#102c3d]/10 bg-white p-7 sm:p-8">
              <BriefcaseBusiness size={27} className="text-[#117f70]" aria-hidden="true" />
              <h3 className="mt-4 text-xl font-semibold tracking-[-.04em]">Pathway details are being connected.</h3>
              <p className="mt-3 max-w-[680px] text-sm leading-7 text-[#102c3d]/65">
                We have the approved apprenticeship standards for this route, but the official Skills England pathway-to-standard links are not yet available in this Preview. Rather than guess which standards belong in which pathway, you can browse the full route list.
              </p>
              <Link href={routeHref + "/pathways/unmapped"} className="mt-5 inline-flex min-h-[46px] items-center gap-2 rounded-full bg-[#102c3d] px-5 text-sm font-semibold text-white">
                Browse all {mapping.totalRouteStandards} standards <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </div>
          )}

          {historical ? (
            <p className="mt-5 rounded-[14px] border border-[#bb9b69]/25 bg-[#fff9eb] p-4 text-xs leading-6 text-[#705e40]">
              These four pathway names and the mapped examples come from a <a href={mapping.sourceUrl || "#"} target="_blank" rel="noopener noreferrer" className="font-semibold underline underline-offset-2">May 2019 official occupational map</a>.
              The classifications are historical, not live-verified. We&apos;ll update them from the current Skills England API before public launch; newer standards remain separately accessible below.
            </p>
          ) : null}

          {mapping.unmappedCodes.length > 0 && hasPathways ? (
            <Link
              href={routeHref + "/pathways/unmapped"}
              className="mt-5 flex min-h-[79px] items-center justify-between gap-4 rounded-[17px] border border-[#102c3d]/10 bg-white px-5 py-4 transition hover:bg-[#eef4ed]"
            >
              <span>
                <span className="block text-sm font-semibold">Standards awaiting pathway verification</span>
                <span className="mt-1 block text-xs text-[#102c3d]/55">
                  {mapping.unmappedCodes.length} programmes whose current pathway has not been confirmed
                </span>
              </span>
              <ArrowRight size={19} className="shrink-0 text-[#117f70]" aria-hidden="true" />
            </Link>
          ) : null}
          {unavailable ? (
            <p className="mt-5 text-xs leading-6 text-[#102c3d]/55">
              Pathway titles are never fabricated from apprenticeship names. The official API requires authorisation and is not yet connected in this Preview.
            </p>
          ) : null}
          {mapping.source === "live-official-api" ? (
            <p className="mt-5 text-xs leading-6 text-[#102c3d]/55">
              Pathway names and apprenticeship mappings are from the Skills England Occupational Maps API.
            </p>
          ) : null}
        </section>
      </main>
      <ExploreFooter />
    </>
  );
}
