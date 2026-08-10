import Link from "next/link";
import { ArrowRight, Check, CircleDot } from "lucide-react";
import { PublicFooter, PublicHeader } from "@/components/levytate-public/PublicHeader";

export type SolutionSection = {
  id?: string;
  label: string;
  title: string;
  copy: string;
  points: string[];
};

export type SolutionVisualItem = {
  label: string;
  value: string;
  detail: string;
  status?: string;
};

export type SolutionPageProps = {
  eyebrow: string;
  title: string;
  description: string;
  primaryCta: string;
  primaryHref: string;
  secondaryCta?: string;
  secondaryHref?: string;
  painsTitle: string;
  pains: string[];
  sections: SolutionSection[];
  visualEyebrow: string;
  visualTitle: string;
  visualItems: SolutionVisualItem[];
  closingTitle: string;
  closingCopy: string;
};

export function SolutionPage({
  eyebrow,
  title,
  description,
  primaryCta,
  primaryHref,
  secondaryCta,
  secondaryHref,
  painsTitle,
  pains,
  sections,
  visualEyebrow,
  visualTitle,
  visualItems,
  closingTitle,
  closingCopy,
}: SolutionPageProps) {
  return (
    <div className="min-h-screen bg-[#f6fbf8] text-[#102c3d]">
      <PublicHeader />
      <main>
        <section className="relative overflow-hidden border-b border-[#102c3d]/[0.07]">
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_15%_12%,rgba(199,240,228,0.88),transparent_31rem),radial-gradient(circle_at_92%_2%,rgba(255,128,144,0.16),transparent_28rem),linear-gradient(180deg,#f8fcfa_0%,#eef7f3_100%)]" />
          <div className="mx-auto grid max-w-[90rem] gap-10 px-5 py-12 sm:px-8 lg:py-16 xl:grid-cols-[0.82fr_1.18fr] xl:items-center xl:gap-14">
            <div className="max-w-3xl">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#c95568]">{eyebrow}</p>
              <h1 className="mt-4 text-balance text-[2.65rem] font-semibold leading-[1.03] tracking-[-0.045em] sm:text-6xl lg:text-[4.2rem]">{title}</h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-[#102c3d]/65">{description}</p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <ActionLink href={primaryHref} primary>{primaryCta}<ArrowRight size={15} aria-hidden="true" /></ActionLink>
                {secondaryCta && secondaryHref ? <ActionLink href={secondaryHref}>{secondaryCta}</ActionLink> : null}
              </div>
            </div>
            <SolutionHeroVisual eyebrow={visualEyebrow} title={visualTitle} items={visualItems} />
          </div>
        </section>

        <section className="bg-[#102c3d] text-white">
          <div className="mx-auto grid max-w-7xl gap-10 px-5 py-14 sm:px-8 lg:grid-cols-[0.7fr_1.3fr] lg:items-start lg:py-16">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#ffde59]">The challenge</p>
              <h2 className="mt-3 text-balance text-3xl font-semibold leading-tight tracking-[-0.03em] sm:text-4xl">{painsTitle}</h2>
            </div>
            <ul className="grid gap-x-8 gap-y-1 sm:grid-cols-2">
              {pains.map((pain) => (
                <li key={pain} className="flex min-h-[4.2rem] items-center gap-3 border-b border-white/10 py-3 text-sm font-semibold leading-5 text-white/70">
                  <CircleDot size={15} className="shrink-0 text-[#ff8090]" aria-hidden="true" />
                  <span>{pain}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="bg-white">
          <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 lg:py-20">
            <div className="max-w-4xl">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#c95568]">How LevyTate helps</p>
              <h2 className="mt-3 text-balance text-4xl font-semibold leading-tight tracking-[-0.035em] sm:text-5xl">A focused experience built around the work people need to complete.</h2>
            </div>

            <div className="mt-12 divide-y divide-[#102c3d]/[0.08] border-y border-[#102c3d]/[0.08]">
              {sections.map((section, index) => (
                <article id={section.id} key={section.title} className="scroll-mt-28 grid gap-7 py-8 lg:grid-cols-[0.72fr_1.28fr] lg:items-start lg:gap-12 lg:py-10">
                  <div>
                    <div className="flex items-center justify-between gap-4">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#0b6f63]">{section.label}</p>
                      <span className="text-xs font-semibold text-[#102c3d]/28">{String(index + 1).padStart(2, "0")}</span>
                    </div>
                    <h3 className="mt-3 text-2xl font-semibold leading-tight tracking-[-0.025em] sm:text-3xl">{section.title}</h3>
                    <p className="mt-4 text-sm leading-7 text-[#102c3d]/60">{section.copy}</p>
                  </div>
                  <FeaturePanel section={section} index={index} />
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="border-t border-[#102c3d]/[0.07] bg-[#eef8f4] px-5 py-16 sm:px-8 lg:py-20">
          <div className="mx-auto grid max-w-7xl gap-8 rounded-[2rem] bg-[#102c3d] p-7 text-white shadow-[0_28px_80px_rgba(16,44,61,0.18)] sm:p-10 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <h2 className="text-balance text-3xl font-semibold leading-tight tracking-[-0.03em] sm:text-4xl">{closingTitle}</h2>
              <p className="mt-4 max-w-2xl text-base leading-7 text-white/66">{closingCopy}</p>
            </div>
            <ActionLink href={primaryHref} light>{primaryCta}<ArrowRight size={15} aria-hidden="true" /></ActionLink>
          </div>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}

function SolutionHeroVisual({ eyebrow, title, items }: { eyebrow: string; title: string; items: SolutionVisualItem[] }) {
  return (
    <div className="min-w-0 overflow-hidden rounded-[1.7rem] bg-[#102c3d] p-3 text-white shadow-[0_32px_90px_rgba(16,44,61,0.22)] sm:p-4">
      <div className="overflow-hidden rounded-[1.3rem] bg-[#f6f9f8] text-[#102c3d]">
        <div className="flex items-center justify-between gap-4 border-b border-[#102c3d]/[0.07] bg-white px-4 py-4 sm:px-5">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#c95568]">{eyebrow}</p>
            <p className="mt-1.5 text-lg font-semibold tracking-[-0.02em]">{title}</p>
          </div>
          <span className="rounded-full bg-[#eaf7f2] px-3 py-1.5 text-[10px] font-semibold text-[#0b6f63]">Example view</span>
        </div>
        <div className="p-3 sm:p-4">
          <div className="grid gap-2 sm:grid-cols-2">
            {items.map((item, index) => (
              <div key={item.label} className={`min-w-0 rounded-[1.05rem] p-4 ring-1 ${index === 0 ? "bg-[#102c3d] text-white ring-[#102c3d]" : "bg-white ring-[#102c3d]/[0.06]"}`}>
                <div className="flex items-start justify-between gap-3">
                  <p className={`text-[10px] font-semibold uppercase tracking-[0.13em] ${index === 0 ? "text-[#c7f0e4]/70" : "text-[#102c3d]/38"}`}>{item.label}</p>
                  {item.status ? <span className={`shrink-0 rounded-full px-2 py-1 text-[9px] font-semibold ${index === 0 ? "bg-white/10 text-white/75" : "bg-[#eef8f4] text-[#0b6f63]"}`}>{item.status}</span> : null}
                </div>
                <p className="mt-4 truncate text-sm font-semibold">{item.value}</p>
                <p className={`mt-1.5 text-xs leading-5 ${index === 0 ? "text-white/52" : "text-[#102c3d]/48"}`}>{item.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function FeaturePanel({ section, index }: { section: SolutionSection; index: number }) {
  const dark = index % 4 === 0;
  return (
    <div className={`rounded-[1.3rem] p-4 sm:p-5 ${dark ? "bg-[#102c3d] text-white" : index % 2 === 0 ? "bg-[#eef8f4] text-[#102c3d]" : "bg-[#f6f9f8] text-[#102c3d] ring-1 ring-[#102c3d]/[0.06]"}`}>
      <p className={`text-[10px] font-semibold uppercase tracking-[0.14em] ${dark ? "text-[#ffde59]" : "text-[#c95568]"}`}>In the workspace</p>
      <ul className="mt-3 grid gap-2 sm:grid-cols-2">
        {section.points.map((point) => (
          <li key={point} className={`flex min-h-[3.5rem] items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-semibold leading-5 ${dark ? "bg-white/[0.07] text-white/72" : "bg-white text-[#102c3d]/66"}`}>
            <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-lg ${dark ? "bg-[#c7f0e4] text-[#102c3d]" : "bg-[#102c3d] text-white"}`}><Check size={13} aria-hidden="true" /></span>
            <span>{point}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ActionLink({ href, children, primary = false, light = false }: { href: string; children: React.ReactNode; primary?: boolean; light?: boolean }) {
  const classes = `inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-6 text-sm font-semibold transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-4 ${light ? "bg-white text-[#102c3d] focus-visible:ring-[#c7f0e4]/35" : primary ? "bg-[#102c3d] text-white shadow-[0_16px_34px_rgba(16,44,61,0.16)] focus-visible:ring-[#159b8f]/25" : "bg-white text-[#102c3d] ring-1 ring-[#102c3d]/[0.1] focus-visible:ring-[#159b8f]/20"}`;
  return href.startsWith("/") ? <Link href={href} className={classes}>{children}</Link> : <a href={href} className={classes}>{children}</a>;
}
