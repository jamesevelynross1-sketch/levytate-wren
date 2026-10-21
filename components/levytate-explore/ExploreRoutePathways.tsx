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
  { background: "#dff2b4", iconBackground: "#effad8", accent: "#215e47" },
  { background: "#fbd1c7", iconBackground: "#fff0e5", accent: "#8a414f" },
  { background: "#f5e5b9", iconBackground: "#fff1ce", accent: "#7b5c27" },
  { background: "#d8d4ff", iconBackground: "#eeedff", accent: "#5c4eaa" },
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
      <main className="mx-auto max-w-[1100px] px-4 pb-24 pt-6 text-[#142f3a] sm:px-8 sm:pt-9">
        <nav aria-label="Breadcrumb" className="flex min-h-11 flex-wrap items-center gap-2 text-xs text-[#142f3a]/65">
          <Link href="/explore" className="inline-flex min-h-9 items-center gap-2 font-semibold text-[#117f70] hover:underline">
            <ArrowLeft size={14} aria-hidden="true" /> All routes
          </Link>
          <span aria-hidden="true" className="text-[#102c3d]/25">/</span>
          <span aria-current="page">{route.name}</span>
        </nav>

        <section className="explore-interior-hero mt-5">
          <p className="explore-eyebrow text-[#226951]">
            Skills England <span className="mx-2 text-[#102c3d]/25">/</span> Occupational route
          </p>
          <h1 className="explore-display mt-5 max-w-[900px] text-[clamp(2.3rem,6.2vw,4.9rem)]">
            {route.name}
          </h1>
          <p className="mt-6 max-w-[690px] text-[15px] leading-[1.85] text-[#142f3a]/80 sm:text-[17px]">
            {route.description}. {hasPathways
              ? "Choose a pathway to discover the apprenticeships within it."
              : "Explore the apprenticeship standards while we complete the official pathway mapping."}
          </p>
        </section>

        <section aria-labelledby="explore-pathways-heading" className="mt-10 sm:mt-12">
          <div className="explore-section-lead">
            <div>
              <p className="explore-eyebrow mb-2 text-[#147362]">Find your direction</p>
              <h2 id="explore-pathways-heading" className="explore-pathway-title">
                {hasPathways ? "Choose a pathway" : "Explore the standards"}
              </h2>
            </div>
            <span className="pb-1 text-xs text-[#102c3d]/55">
              {mapping.totalRouteStandards} approved {mapping.totalRouteStandards === 1 ? "standard" : "standards"} in this route
            </span>
          </div>

          {hasPathways ? (
            <div className="explore-pathway-grid mt-5 grid sm:grid-cols-2">
              {mapping.groups.map((group, index) => {
                const theme = palette[index % palette.length];
                return (
                  <Link
                    key={group.slug}
                    prefetch={false}
                    href={routeHref + "/pathways/" + group.slug}
                    className="explore-pathway-card group flex flex-col justify-between focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[#117f70]"
                    style={{ backgroundColor: theme.background }}
                  >
                    <div className="relative z-10 flex items-start justify-between gap-4">
                      <span
                        className="grid h-[52px] w-[52px] place-items-center rounded-[17px] border border-[#142f3a]/10"
                        style={{ backgroundColor: theme.iconBackground, color: theme.accent }}
                      >
                        <PathwayIcon slug={group.slug} />
                      </span>
                      <ArrowUpRight size={20} aria-hidden="true" className="text-[#142f3a]/55 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                    </div>
                    <div className="relative z-10 mt-9">
                      <h3 className="explore-pathway-title">{group.name}</h3>
                      <div className="mt-5 flex items-center justify-between gap-3 border-t border-[#142f3a]/15 pt-4">
                        <span className="text-xs text-[#102c3d]/65">
                          {group.standardCodes.length} {group.standardCodes.length === 1 ? "apprenticeship" : "apprenticeships"} mapped
                        </span>
                        <span className="flex items-center gap-1 text-xs font-extrabold" style={{ color: theme.accent }}>
                          View standards <ArrowRight size={15} aria-hidden="true" />
                        </span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="mt-5 rounded-[23px] border border-[#142f3a]/15 bg-[#e2f1df] p-7 sm:p-9">
              <BriefcaseBusiness size={27} className="text-[#117f70]" aria-hidden="true" />
              <h3 className="mt-4 text-xl font-semibold tracking-[-.04em]">Pathway details are being connected.</h3>
              <p className="mt-3 max-w-[680px] text-sm leading-7 text-[#102c3d]/65">
                We have the approved apprenticeship standards for this route, but the official Skills England pathway-to-standard links are not yet available in this Preview. Rather than guess which standards belong in which pathway, you can browse the full route list.
              </p>
              <Link href={routeHref + "/pathways/unmapped"} className="mt-5 inline-flex min-h-[48px] items-center gap-2 rounded-full bg-[#142f3a] px-6 text-[13px] font-bold text-white transition hover:bg-[#255461]">
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
              className="mt-5 flex min-h-[85px] items-center justify-between gap-4 rounded-[17px] border border-[#142f3a]/15 bg-white px-5 py-4 transition hover:bg-[#eff6ed]"
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
