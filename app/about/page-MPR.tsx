import type { Metadata } from "next";
import { FinalCta } from "@/components/sections/FinalCta";
import { SectionEyebrow } from "@/components/ui/SectionEyebrow";

export const metadata: Metadata = {
  title: "About MPR Consulting",
  description:
    "MPR Consulting is an independent, provider-neutral apprenticeship consultancy helping employers make better strategy, levy, provider and workforce capability decisions.",
  openGraph: {
    title: "About MPR Consulting",
    description:
      "Independent, provider-neutral apprenticeship consultancy for employers.",
  },
  alternates: {
    canonical: "/about",
  },
};

const points = [
  {
    title: "Who we are",
    copy: "MPR Consulting is a specialist advisory firm helping employers make clearer decisions about apprenticeships, levy use, funded training and workforce capability.",
  },
  {
    title: "Why we exist",
    copy: "Many organisations know apprenticeships could support capability, but need a sharper view of roles, pathways, providers, funding and internal ownership before they act.",
  },
  {
    title: "Independent by design",
    copy: "We are not a training provider and do not need to push a delivery model. Our advice is shaped around employer priorities, delivery quality, value for money and practical fit.",
  },
  {
    title: "Practical, employer-first advice",
    copy: "We translate policy, funding and provider options into decisions that HR, L&D, finance and operations teams can act on with confidence.",
  },
];

export default function AboutPage() {
  return (
    <>
      <section className="container-px mx-auto max-w-7xl py-14 lg:py-20">
        <SectionEyebrow>About</SectionEyebrow>
        <h1 className="display-heading mt-5 max-w-4xl text-5xl leading-[1.04] text-ink text-balance md:text-6xl">
          Provider-neutral apprenticeship advice, grounded in the realities
          employers face.
        </h1>
        <p className="mt-6 max-w-2xl text-[17px] leading-8 text-ink/66">
          MPR Consulting sits on the employer side of the table. We help leaders
          make informed decisions before funding, providers and internal teams
          are committed to a pathway.
        </p>
      </section>
      <section className="container-px mx-auto max-w-7xl pb-16 lg:pb-24">
        <div className="grid gap-5 md:grid-cols-2">
          {points.map((point) => (
            <article key={point.title} className="premium-card rounded-xl p-6 md:p-7">
              <h2 className="text-xl font-semibold text-ink">{point.title}</h2>
              <p className="mt-4 text-sm leading-7 text-ink/66">{point.copy}</p>
            </article>
          ))}
        </div>
        <div className="mt-8 rounded-xl border border-teal/18 bg-teal/[0.08] p-6 text-sm leading-7 text-ink/70">
          MPR Consulting is part of MPR Group, which builds products, platforms
          and advisory solutions that improve how organisations, providers and
          learners navigate apprenticeships.
        </div>
      </section>
      <FinalCta
        title="Looking for independent apprenticeship advice?"
        copy="We can help you make better decisions across strategy, provider selection, levy use and workforce capability."
      />
    </>
  );
}
