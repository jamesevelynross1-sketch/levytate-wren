import type { Metadata } from "next";
import { FinalCta } from "@/components/sections/FinalCta";
import { SectionEyebrow } from "@/components/ui/SectionEyebrow";

export const metadata: Metadata = {
  title: "About",
  description:
    "Learn about MPR Consulting's independent, practical and employer-first approach.",
};

const sections = [
  {
    title: "Who we are",
    copy: "MPR Consulting is an independent advisory partner for employers navigating apprenticeships, workforce capability and funded training decisions.",
  },
  {
    title: "Why we exist",
    copy: "Too many organisations underuse apprenticeships because the system is complex, provider options are difficult to compare and internal priorities are unclear. We help create the clarity needed to act with confidence.",
  },
  {
    title: "Independent by design",
    copy: "Our advice is not tied to a single training provider or delivery model. We focus on the employer's objectives, the quality of fit and the decisions that will improve outcomes.",
  },
  {
    title: "Practical, employer-first advice",
    copy: "Strategy only matters when it can be used. Our work connects board-level priorities with role mapping, provider selection, funding choices and operational coordination.",
  },
];

export default function AboutPage() {
  return (
    <>
      <section className="container-px mx-auto max-w-7xl pb-16 pt-14 lg:pb-20 lg:pt-20">
        <SectionEyebrow>About MPR Consulting</SectionEyebrow>
        <div className="grid gap-10 lg:grid-cols-[1fr_0.8fr] lg:items-end">
          <h1 className="display-heading text-5xl leading-[1.04] text-ink text-balance md:text-6xl">
            Independent advice for better apprenticeship decisions.
          </h1>
          <p className="text-[17px] leading-8 text-ink/66">
            We bring a consultancy-led view to apprenticeship strategy, provider
            selection and workforce capability planning. The approach is human,
            practical and commercially clear.
          </p>
        </div>
      </section>

      <section className="container-px mx-auto max-w-7xl pb-16 lg:pb-20">
        <div className="grid gap-5 md:grid-cols-2">
          {sections.map((section) => (
            <article key={section.title} className="rounded-xl border border-ink/10 bg-white/34 p-7 shadow-[0_10px_28px_rgba(15,37,39,0.035)]">
              <h2 className="text-2xl font-semibold leading-snug text-ink">
                {section.title}
              </h2>
              <p className="mt-4 text-[15px] leading-7 text-ink/66">{section.copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="bg-forest py-16 text-cream lg:py-20">
        <div className="container-px mx-auto max-w-7xl">
          <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.22em] text-teal">
            Part of MPR Group
          </p>
          <p className="display-heading max-w-4xl text-4xl leading-tight text-balance md:text-5xl">
            MPR Consulting is part of MPR Group, which builds products,
            platforms and advisory solutions that improve how organisations,
            providers and learners navigate apprenticeships.
          </p>
        </div>
      </section>

      <div className="pt-20">
        <FinalCta />
      </div>
    </>
  );
}
