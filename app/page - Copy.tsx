import { FinalCta } from "@/components/sections/FinalCta";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { SectionEyebrow } from "@/components/ui/SectionEyebrow";
import { ServiceCard } from "@/components/cards/ServiceCard";
import { TrustBand } from "@/components/sections/TrustBand";
import { services } from "@/lib/content";
import { ENQUIRY_MAILTO } from "@/lib/contact";

const helpPoints = [
  "Clarify where apprenticeships genuinely support business priorities.",
  "Map roles and departments to relevant funded development pathways.",
  "Compare provider options through a quality, delivery and employer fit lens.",
  "Turn levy and funding complexity into practical decisions.",
];

export default function Home() {
  return (
    <>
      <section className="container-px mx-auto grid max-w-7xl gap-12 pb-16 pt-14 lg:grid-cols-[1.08fr_0.92fr] lg:items-end lg:pb-24 lg:pt-20">
        <div>
          <SectionEyebrow>Independent employer advisory</SectionEyebrow>
          <h1 className="display-heading max-w-4xl text-5xl leading-[1.04] text-ink text-balance md:text-6xl">
            Build a smarter apprenticeship strategy.
          </h1>
          <p className="mt-7 max-w-2xl text-[17px] leading-8 text-ink/68">
            Independent guidance for organisations looking to use apprenticeships
            more strategically, reduce wasted training spend and align funded
            development with real workforce priorities.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <ButtonLink href={ENQUIRY_MAILTO}>Book a conversation</ButtonLink>
            <ButtonLink href="/services" variant="secondary">
              Explore services
            </ButtonLink>
          </div>
        </div>

        <div className="rounded-3xl border border-ink/10 bg-white/34 p-6 shadow-[0_16px_38px_rgba(15,37,39,0.045)]">
          <div className="premium-rule h-px w-full" />
          <div className="grid gap-5 py-8">
            <p className="display-heading text-3xl leading-snug text-ink md:text-4xl">
              Strategic advice for employers making complex apprenticeship
              decisions.
            </p>
            <p className="text-sm leading-7 text-ink/64">
              MPR Consulting sits between workforce planning, provider selection
              and funded training strategy. The work is practical, independent
              and designed around the employer view.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {["Strategy", "Funding", "Provider fit", "Capability"].map((item) => (
              <div key={item} className="rounded-xl bg-cream/70 px-4 py-4 text-[13px] font-semibold text-ink/76">
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="container-px mx-auto max-w-7xl py-14">
        <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <SectionEyebrow>What we do</SectionEyebrow>
            <h2 className="display-heading text-4xl leading-tight text-ink text-balance md:text-5xl">
              We help employers make better funded training decisions.
            </h2>
          </div>
          <p className="text-[17px] leading-8 text-ink/66">
            MPR Consulting helps organisations understand workforce needs, map
            roles to funded development pathways and select the right providers.
            The focus is clear: better decisions, stronger internal alignment and
            less wasted training spend.
          </p>
        </div>
      </section>

      <TrustBand />

      <section className="bg-ink py-16 text-cream lg:py-20">
        <div className="container-px mx-auto grid max-w-7xl gap-12 lg:grid-cols-[0.85fr_1.15fr]">
          <div>
            <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.22em] text-teal">
              How we help
            </p>
            <h2 className="display-heading text-4xl leading-tight text-balance md:text-5xl">
              From ambition to a credible apprenticeship plan.
            </h2>
          </div>
          <div className="grid gap-4">
            {helpPoints.map((point) => (
              <div key={point} className="rounded-xl border border-cream/10 bg-cream/[0.035] p-5 text-[15px] leading-7 text-cream/78">
                {point}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="container-px mx-auto max-w-7xl py-20">
        <div className="grid gap-12 lg:grid-cols-[1fr_1fr] lg:items-center">
          <div>
            <SectionEyebrow>Why independence matters</SectionEyebrow>
            <h2 className="display-heading text-4xl leading-tight text-ink text-balance md:text-5xl">
              Advice shaped by employer need, not provider sales targets.
            </h2>
          </div>
          <p className="text-[17px] leading-8 text-ink/66">
            Apprenticeships can unlock meaningful workforce capability, but only
            when the right standards, providers and delivery models are chosen.
            Independent advice gives employers the space to compare options with
            commercial clarity and practical confidence.
          </p>
        </div>
      </section>

      <section className="container-px mx-auto max-w-7xl pb-20">
        <div className="mb-10 flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <div>
            <SectionEyebrow>Featured services</SectionEyebrow>
            <h2 className="display-heading text-4xl leading-tight text-ink md:text-5xl">
              Focused advisory support.
            </h2>
          </div>
          <ButtonLink href="/services" variant="quiet">
            View all services
          </ButtonLink>
        </div>
        <div className="grid gap-5 md:grid-cols-3">
          {services.slice(0, 3).map((service, index) => (
            <ServiceCard key={service.title} {...service} index={index} />
          ))}
        </div>
      </section>

      <FinalCta />
    </>
  );
}
