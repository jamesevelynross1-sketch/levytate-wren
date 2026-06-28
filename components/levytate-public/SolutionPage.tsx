import Link from "next/link";
import { PublicFooter, PublicHeader } from "@/components/levytate-public/PublicHeader";

export type SolutionSection = {
  id?: string;
  label: string;
  title: string;
  copy: string;
  points: string[];
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
  closingTitle,
  closingCopy,
}: SolutionPageProps) {
  return (
    <div className="min-h-screen bg-[#f6fbf8] text-[#102c3d]">
      <PublicHeader />
      <main>
        <section className="border-b border-[#102c3d]/[0.07] bg-[linear-gradient(180deg,#f6fbf8_0%,#eef8f4_100%)]">
          <div className="mx-auto grid max-w-7xl gap-10 px-5 py-16 sm:px-8 lg:py-20 xl:grid-cols-[0.95fr_1.05fr] xl:items-center">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#c95568]">{eyebrow}</p>
              <h1 className="mt-4 max-w-3xl text-4xl font-semibold leading-tight sm:text-5xl lg:text-6xl">{title}</h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-[#102c3d]/64">{description}</p>
              <div className="mt-8 flex flex-wrap gap-3">
                <a href={primaryHref} className="inline-flex min-h-11 items-center justify-center rounded-full bg-[#102c3d] px-6 text-sm font-semibold text-white shadow-[0_16px_34px_rgba(16,44,61,0.16)] transition hover:-translate-y-0.5">{primaryCta}</a>
                {secondaryCta && secondaryHref ? <Link href={secondaryHref} className="inline-flex min-h-11 items-center justify-center rounded-full bg-white px-6 text-sm font-semibold text-[#102c3d] ring-1 ring-[#102c3d]/[0.09] transition hover:-translate-y-0.5">{secondaryCta}</Link> : null}
              </div>
            </div>
            <div className="rounded-[2rem] border border-[#102c3d]/[0.08] bg-white p-4 shadow-[0_28px_80px_rgba(16,44,61,0.11)]">
              <div className="rounded-[1.5rem] bg-[#102c3d] p-5 text-white">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#c7f0e4]">LevyTate workspace</p>
                <p className="mt-2 text-xl font-semibold">One clear route to action</p>
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {sections.slice(0, 4).map((section, index) => (
                  <div key={section.title} className="min-h-[116px] rounded-[1.2rem] bg-[#f8fbfa] p-4 ring-1 ring-[#102c3d]/[0.06]">
                    <span className="text-xs font-semibold text-[#c95568]">0{index + 1}</span>
                    <p className="mt-3 text-sm font-semibold leading-5">{section.label}</p>
                    <p className="mt-1.5 text-xs leading-5 text-[#102c3d]/54">{section.title}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-5 py-16 sm:px-8 lg:py-20">
          <div className="grid gap-10 lg:grid-cols-[0.72fr_1.28fr] lg:items-start">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#c95568]">The challenge</p>
              <h2 className="mt-3 text-3xl font-semibold leading-tight sm:text-4xl">{painsTitle}</h2>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {pains.map((pain) => (
                <div key={pain} className="flex min-h-[76px] items-center gap-3 rounded-[1.2rem] bg-white px-4 py-3 shadow-[0_14px_38px_rgba(16,44,61,0.05)] ring-1 ring-[#102c3d]/[0.06]">
                  <span className="h-2 w-2 shrink-0 rounded-full bg-[#c95568]" />
                  <span className="text-sm font-semibold leading-5 text-[#102c3d]/72">{pain}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-y border-[#102c3d]/[0.07] bg-white/72">
          <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 lg:py-20">
            <div className="max-w-3xl">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#c95568]">How LevyTate helps</p>
              <h2 className="mt-3 text-3xl font-semibold leading-tight sm:text-4xl">A focused operating model, built around the decisions your team needs to make.</h2>
            </div>
            <div className="mt-10 grid gap-5 md:grid-cols-2">
              {sections.map((section, index) => (
                <article id={section.id} key={section.title} className="scroll-mt-28 rounded-[1.6rem] border border-[#102c3d]/[0.07] bg-white p-6 shadow-[0_18px_50px_rgba(16,44,61,0.055)]">
                  <div className="flex items-center justify-between gap-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#0b6f63]">{section.label}</p>
                    <span className="text-xs font-semibold text-[#102c3d]/36">0{index + 1}</span>
                  </div>
                  <h3 className="mt-4 text-2xl font-semibold leading-tight">{section.title}</h3>
                  <p className="mt-3 text-sm leading-7 text-[#102c3d]/60">{section.copy}</p>
                  <ul className="mt-5 grid gap-2.5">
                    {section.points.map((point) => (
                      <li key={point} className="flex gap-3 text-sm leading-6 text-[#102c3d]/72">
                        <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#18a89a]" />
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="px-5 py-16 sm:px-8 lg:py-20">
          <div className="mx-auto grid max-w-7xl gap-8 rounded-[2rem] bg-[#102c3d] p-7 text-white shadow-[0_28px_80px_rgba(16,44,61,0.17)] sm:p-10 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <h2 className="text-3xl font-semibold leading-tight sm:text-4xl">{closingTitle}</h2>
              <p className="mt-4 max-w-2xl text-base leading-7 text-white/68">{closingCopy}</p>
            </div>
            <a href={primaryHref} className="inline-flex min-h-11 items-center justify-center rounded-full bg-white px-6 text-sm font-semibold text-[#102c3d] transition hover:-translate-y-0.5">{primaryCta}</a>
          </div>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}