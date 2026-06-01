import type { Metadata } from "next";
import Image from "next/image";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { SectionEyebrow } from "@/components/ui/SectionEyebrow";
import { HeroAtmosphere } from "@/components/visual/HeroAtmosphere";
import { ENQUIRY_MAILTO } from "@/lib/contact";

export const metadata: Metadata = {
  title: "Apprenticeship Levy Consultancy for Employers",
  description:
    "MPR Consulting helps employers use apprenticeships strategically through levy health checks, apprenticeship frameworks, workforce capability planning and independent provider matching.",
  openGraph: {
    title: "MPR Consulting | Apprenticeship Levy Consultancy",
    description:
      "Independent apprenticeship strategy, levy health checks, provider matching and workforce capability support for UK employers.",
    url: "https://mprconsulting.co.uk",
  },
  alternates: {
    canonical: "/",
  },
};

const problems = [
  "Provider-led rather than employer-led",
  "Owned by HR but disconnected from business priorities",
  "Used inconsistently across teams and departments",
  "Underused as a strategic workforce tool",
  "Difficult to navigate because of funding, standards and provider choice",
];

const services = [
  {
    title: "Apprenticeship Framework",
    href: "/framework",
    copy: "Build a structured approach around roles, departments, skills gaps and long-term workforce priorities.",
    benefits: ["Role and pathway mapping", "Department-level planning", "Clear governance and decision criteria"],
    cta: "Explore the framework",
  },
  {
    title: "Levy Health Check",
    href: "/levy-health-check",
    copy: "A practical review of current apprenticeship usage, missed opportunities and potential next steps.",
    benefits: ["Usage review", "Funding clarity", "Priority recommendations"],
    cta: "Request a health check",
  },
  {
    title: "Provider Matching",
    href: "/provider-matching",
    copy: "Independent support to identify and assess suitable providers based on quality, delivery fit and employer need.",
    benefits: ["Provider criteria", "Quality and fit review", "Clearer selection confidence"],
    cta: "Compare providers",
  },
  {
    title: "Consultancy & Project Work",
    href: "/services",
    copy: "Hands-on support for specific priorities, implementation challenges or strategic workforce plans.",
    benefits: ["Focused projects", "Stakeholder support", "Implementation guidance"],
    cta: "View services",
  },
];

const methodology = [
  ["Diagnose", "Understand current usage, spend, roles, priorities and gaps."],
  ["Design", "Map apprenticeship opportunities to business needs, workforce plans and provider options."],
  ["Deliver", "Support implementation, provider alignment, internal engagement and outcomes."],
];

const trustSignals = [
  "Independent advice, not provider-led sales.",
  "Specialist apprenticeship and levy expertise.",
  "Built around employer priorities.",
  "Provider selection based on quality, fit and outcomes.",
  "Practical support from strategy through to implementation.",
];

const sectors = [
  "Manufacturing",
  "Technology",
  "Infrastructure",
  "Utilities",
  "Food and FMCG",
  "Public sector supply chains",
  "Education and skills",
];

export default function HomePage() {
  return (
    <>
      <section className="container-px relative isolate overflow-hidden bg-forest text-cream">
        <HeroAtmosphere />
        <div className="relative z-10 mx-auto grid max-w-7xl gap-12 py-16 md:py-20 lg:grid-cols-[1fr_0.92fr] lg:items-center lg:py-24">
          <div className="reveal-up">
            <SectionEyebrow className="text-teal">MPR Consulting</SectionEyebrow>
            <h1 className="display-heading mt-6 max-w-5xl text-[3rem] leading-[1.02] md:text-6xl lg:text-[4.8rem]">
              Use apprenticeships strategically, not reactively.
            </h1>
            <p className="mt-7 max-w-2xl text-[17px] leading-8 text-cream/76 md:text-[18px] md:leading-9">
              MPR Consulting helps employers bring structure, clarity and
              commercial value to apprenticeships, provider decisions and
              workforce development.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <ButtonLink href={ENQUIRY_MAILTO} variant="secondary" className="bg-cream">
                Book a Strategy Call
              </ButtonLink>
              <ButtonLink href="/levy-health-check" variant="secondary" className="border-cream/18 bg-transparent text-cream hover:bg-cream/10">
                Start with a Levy Health Check
              </ButtonLink>
            </div>
          </div>

          <div className="reveal-up reveal-delay-2 rounded-[1.6rem] border border-cream/12 bg-cream/[0.055] p-5 shadow-[0_28px_70px_rgba(0,0,0,0.16)] md:p-7">
            <div className="grid gap-3">
              {["Business priorities", "Roles and capability gaps", "Levy and funding routes", "Provider options", "Implementation plan"].map((item, index) => (
                <div key={item} className="grid grid-cols-[auto_1fr_auto] items-center gap-4 rounded-2xl border border-cream/10 bg-cream/[0.045] p-4">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-teal/20 text-[12px] font-semibold text-teal">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="text-sm font-semibold text-cream/86">{item}</span>
                  <span className="h-px w-10 bg-gradient-to-r from-teal to-brass" />
                </div>
              ))}
            </div>
            <div className="mt-5 rounded-2xl border border-brass/30 bg-ink/24 p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-brass">
                MPR decision system
              </p>
              <p className="mt-3 text-sm leading-7 text-cream/70">
                A practical route from funding questions to workforce decisions,
                provider confidence and measurable implementation.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="container-px bg-cream">
        <div className="mx-auto grid max-w-7xl gap-10 border-b border-ink/10 py-16 lg:grid-cols-[0.78fr_1.22fr] lg:py-20">
          <div>
            <SectionEyebrow>The problem</SectionEyebrow>
            <h2 className="display-heading mt-5 text-4xl leading-[1.06] text-ink md:text-5xl">
              Apprenticeships often become activity before strategy.
            </h2>
          </div>
          <div>
            <div className="grid gap-3 md:grid-cols-2">
              {problems.map((problem) => (
                <div key={problem} className="rounded-2xl border border-ink/10 bg-white/36 p-5 text-sm leading-7 text-ink/68">
                  {problem}
                </div>
              ))}
            </div>
            <p className="mt-7 max-w-3xl text-[18px] leading-8 text-ink">
              Most organisations do not need more options. They need a clearer
              way to use what is already available.
            </p>
          </div>
        </div>
      </section>

      <section className="container-px bg-cream">
        <div className="mx-auto max-w-7xl py-16 lg:py-20">
          <div className="grid gap-8 lg:grid-cols-[0.7fr_1.3fr] lg:items-end">
            <div>
              <SectionEyebrow>Services</SectionEyebrow>
              <h2 className="display-heading mt-5 text-4xl leading-[1.06] text-ink md:text-5xl">
                Commercial support for better apprenticeship decisions.
              </h2>
            </div>
            <p className="max-w-2xl text-[16px] leading-8 text-ink/66 lg:justify-self-end">
              From first diagnostic through to framework design and provider
              selection, MPR helps employers make apprenticeships more useful,
              more structured and more connected to business priorities.
            </p>
          </div>
          <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {services.map((service) => (
              <article key={service.title} className="premium-card flex h-full flex-col rounded-2xl p-6">
                <h3 className="display-heading text-3xl leading-tight text-ink">{service.title}</h3>
                <p className="mt-4 text-sm leading-7 text-ink/66">{service.copy}</p>
                <div className="mt-6 grid gap-3 text-sm leading-6 text-ink/70">
                  {service.benefits.map((benefit) => (
                    <div key={benefit} className="flex gap-3">
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-teal" />
                      <span>{benefit}</span>
                    </div>
                  ))}
                </div>
                <ButtonLink href={service.href} variant="quiet" className="mt-auto pt-7">
                  {service.cta}
                </ButtonLink>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="container-px bg-ink text-cream">
        <div className="mx-auto max-w-7xl py-16 lg:py-20">
          <SectionEyebrow className="text-teal">MPR methodology</SectionEyebrow>
          <div className="mt-6 grid gap-8 lg:grid-cols-[0.75fr_1.25fr] lg:items-start">
            <h2 className="display-heading text-4xl leading-[1.06] md:text-5xl">
              Diagnose. Design. Deliver.
            </h2>
            <div className="grid gap-4 md:grid-cols-3">
              {methodology.map(([title, copy], index) => (
                <div key={title} className="rounded-2xl border border-cream/12 bg-cream/[0.055] p-6">
                  <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-brass">
                    0{index + 1}
                  </p>
                  <h3 className="display-heading mt-8 text-3xl">{title}</h3>
                  <p className="mt-4 text-sm leading-7 text-cream/68">{copy}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="container-px bg-cream">
        <div className="mx-auto grid max-w-7xl gap-10 py-16 lg:grid-cols-[0.95fr_1.05fr] lg:py-20">
          <div>
            <SectionEyebrow>Trust architecture</SectionEyebrow>
            <h2 className="display-heading mt-5 text-4xl leading-[1.06] text-ink md:text-5xl">
              Advice shaped around employer outcomes, not provider sales.
            </h2>
            <div className="mt-8 grid gap-3">
              {trustSignals.map((signal) => (
                <p key={signal} className="border-t border-ink/10 pt-4 text-sm font-semibold leading-7 text-ink/70">
                  {signal}
                </p>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-ink/10 bg-white/34 p-6 shadow-soft md:p-8">
            <p className="text-[12px] font-semibold uppercase tracking-[0.2em] text-teal">
              Experience across sectors
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {sectors.map((sector) => (
                <div key={sector} className="rounded-xl border border-ink/10 bg-cream/70 px-4 py-4 text-sm font-semibold text-ink/72">
                  {sector}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="container-px bg-parchment/55">
        <div className="mx-auto grid max-w-7xl gap-8 py-16 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div>
            <SectionEyebrow>Conversion point</SectionEyebrow>
            <h2 className="display-heading mt-5 text-4xl leading-[1.06] text-ink md:text-5xl">
              Not sure where to start?
            </h2>
          </div>
          <div>
            <p className="max-w-2xl text-[17px] leading-8 text-ink/68">
              Start with a practical review of how apprenticeships, levy funding
              and provider decisions currently fit your organisation.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <ButtonLink href="/levy-health-check">Start Your Levy Health Check</ButtonLink>
              <ButtonLink href={ENQUIRY_MAILTO} variant="secondary">Book a Strategy Call</ButtonLink>
            </div>
          </div>
        </div>
      </section>

      <section className="container-px border-y border-ink/10 bg-[#0a0a08] text-[#fbf7df]">
        <div className="mx-auto grid max-w-7xl gap-8 py-12 md:grid-cols-[0.28fr_1fr_auto] md:items-center">
          <div className="max-w-[160px] rounded-2xl border border-[#efff39]/28 bg-[#fbf7df] p-3">
            <Image
              src="/brand/neet-on-our-watch.png"
              alt="NEET On Our Watch"
              width={1254}
              height={1254}
              className="h-auto w-full"
            />
          </div>
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[#efff39]">
              Social impact initiative
            </p>
            <h2 className="display-heading mt-3 text-4xl leading-[1.04] md:text-5xl">
              NEET On Our Watch
            </h2>
            <p className="mt-4 max-w-2xl text-[16px] leading-8 text-[#fbf7df]/72">
              An MPR Consulting social impact initiative focused on supporting
              pathways into employment, apprenticeships, skills and opportunity.
            </p>
          </div>
          <ButtonLink href="/neet-on-our-watch" className="bg-[#efff39] text-[#0a0a08] hover:bg-[#f6ff72]">
            Learn More
          </ButtonLink>
        </div>
      </section>

      <section className="container-px bg-forest text-cream">
        <div className="mx-auto grid max-w-7xl gap-8 py-16 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <SectionEyebrow className="text-teal">Next step</SectionEyebrow>
            <h2 className="display-heading mt-5 max-w-3xl text-4xl leading-[1.06] md:text-5xl">
              Ready to make apprenticeships work harder for your organisation?
            </h2>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <ButtonLink href={ENQUIRY_MAILTO} variant="secondary" className="bg-cream">
              Book a Strategy Call
            </ButtonLink>
            <ButtonLink href="/contact" variant="secondary" className="border-cream/18 bg-transparent text-cream hover:bg-cream/10">
              Contact MPR Consulting
            </ButtonLink>
          </div>
        </div>
      </section>
    </>
  );
}
