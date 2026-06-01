import type { Metadata } from "next";
import Link from "next/link";
import { SectionEyebrow } from "@/components/ui/SectionEyebrow";

export const metadata: Metadata = {
  title: "Employer Apprenticeship Case Studies",
  description:
    "Selected employer apprenticeship strategy and workforce capability case studies from MPR Consulting.",
};

export default function CaseStudiesPage() {
  return (
    <>
      <section className="container-px mx-auto max-w-7xl pb-14 pt-14 lg:pb-20 lg:pt-20">
        <SectionEyebrow>Case studies</SectionEyebrow>
        <div className="mt-5 grid gap-8 lg:grid-cols-[0.82fr_1.18fr] lg:items-start">
          <h1 className="display-heading text-5xl leading-[1.04] text-ink text-balance md:text-6xl">
            Employer outcomes from clearer apprenticeship decisions.
          </h1>
          <p className="max-w-2xl text-[17px] leading-8 text-ink/66">
            Selected examples of how MPR Consulting helps employers make better
            apprenticeship strategy, provider and workforce capability
            decisions.
          </p>
        </div>
      </section>

      <section className="container-px mx-auto max-w-7xl pb-16 lg:pb-24">
        <div className="grid gap-5 md:grid-cols-2">
          <Link
            href="/case-studies/ground-control"
            className="premium-card group flex min-h-80 flex-col rounded-xl p-6 transition duration-300 hover:-translate-y-1 hover:border-teal/20 hover:bg-white/[0.44] hover:shadow-[0_18px_38px_rgba(15,37,39,0.055)] md:p-8"
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-teal">
              Ground Control
            </p>
            <h2 className="display-heading mt-5 text-3xl leading-[1.1] text-ink text-balance md:text-4xl">
              Building a clearer apprenticeship strategy.
            </h2>
            <p className="mt-5 text-sm leading-7 text-ink/66">
              How independent advisory support helped turn an underutilised
              levy into clearer strategy, stronger provider decisions and a more
              visible apprenticeship culture.
            </p>
            <p className="mt-auto pt-8 text-[13px] font-semibold text-ink transition group-hover:text-teal">
              Read case study &rarr;
            </p>
          </Link>

          <div className="rounded-xl border border-dashed border-ink/12 p-6 text-ink/54 md:p-8">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-teal">
              More examples coming soon
            </p>
            <p className="mt-5 max-w-md text-sm leading-7">
              Further employer examples will be added as MPR Consulting
              continues to support apprenticeship strategy, provider selection
              and workforce capability planning.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
