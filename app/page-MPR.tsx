import type { Metadata } from "next";
import Image from "next/image";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { SectionEyebrow } from "@/components/ui/SectionEyebrow";
import { LevyTransferEnquiryForm } from "@/components/forms/LevyTransferEnquiryForm";
import { JourneySelector } from "@/components/sections/JourneySelector";
import { HeroAtmosphere } from "@/components/visual/HeroAtmosphere";
import { ENQUIRY_MAILTO } from "@/lib/contact";

export const metadata: Metadata = {
  title: "Independent Apprenticeship Consultancy for Employers",
  description:
    "MPR Consulting helps employers make better apprenticeship strategy, levy funding and provider selection decisions, with access to 130+ programmes through trusted providers.",
  openGraph: {
    title: "MPR Consulting | Independent Apprenticeship Consultancy",
    description:
      "Employer-first apprenticeship strategy, levy funding guidance, provider selection and access to 130+ apprenticeship programmes through trusted provider partners.",
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

const decisionSystemSteps = [
  {
    title: "Business priorities",
    copy: "Clarify what the organisation is trying to achieve.",
  },
  {
    title: "Roles and capability gaps",
    copy: "Identify where apprenticeships could support workforce development.",
  },
  {
    title: "Levy and funding routes",
    copy: "Understand available funding and where it can be used.",
  },
  {
    title: "Provider options",
    copy: "Compare providers against quality, fit and delivery needs.",
  },
  {
    title: "Implementation plan",
    copy: "Turn decisions into a practical next-step plan.",
  },
];

const trustSignals = [
  "Independent advice, not provider-led sales.",
  "Specialist apprenticeship and levy expertise.",
  "Access to 130+ apprenticeship programmes through trusted provider partners.",
  "Built around employer priorities.",
  "Provider selection based on quality, fit and outcomes.",
  "Practical support from strategy through to implementation.",
];

const networkStats = [
  ["130+", "Apprenticeship Programmes"],
  ["Independent", "Employer Advice"],
  ["Trusted", "Provider Network"],
  ["Employer-First", "Recommendations"],
];

const whoWeSupport = [
  "Levy-paying organisations seeking to maximise apprenticeship investment",
  "HR, L&D and Talent teams",
  "Public sector bodies and larger employers",
  "Employers reviewing apprenticeship performance",
  "Organisations exploring levy transfer opportunities",
  "Growing SMEs looking for independent apprenticeship advice",
];

export default function HomePage() {
  return (
    <>
      <section className="container-px relative isolate overflow-hidden bg-forest text-cream">
        <HeroAtmosphere />
        <div className="relative z-10 mx-auto max-w-7xl py-16 md:py-20 lg:py-24">
          <div className="reveal-up">
            <SectionEyebrow className="text-teal">MPR Consulting</SectionEyebrow>
            <h1 className="display-heading mt-6 max-w-5xl text-[3rem] leading-[1.02] md:text-6xl lg:text-[4.8rem]">
              Helping employers make better decisions about apprenticeships,
              funding and provider selection.
            </h1>
            <p className="mt-7 max-w-2xl text-[17px] leading-8 text-cream/76 md:text-[18px] md:leading-9">
              Independent advisory for levy-paying organisations, public sector
              bodies and growing businesses that want clearer apprenticeship
              strategy, funding guidance and provider confidence.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <ButtonLink href={ENQUIRY_MAILTO} variant="secondary" className="bg-cream">
                Book a Conversation
              </ButtonLink>
              <ButtonLink href="/services" variant="secondary" className="bg-cream">
                Explore Our Services
              </ButtonLink>
            </div>
          </div>

        </div>
      </section>

      <section id="how-it-works" className="container-px bg-cream">
        <div className="mx-auto max-w-7xl border-b border-ink/10 py-12 md:py-14">
          <div className="grid gap-8 rounded-2xl border border-ink/10 bg-white/34 p-6 shadow-[0_12px_28px_rgba(15,37,39,0.03)] md:p-8 lg:grid-cols-[1fr_0.9fr] lg:items-center">
            <div>
              <SectionEyebrow>Provider network</SectionEyebrow>
              <h2 className="display-heading mt-5 max-w-4xl text-4xl leading-[1.06] text-ink md:text-5xl">
                Access to 130+ Apprenticeship Programmes Through Trusted Provider Partners
              </h2>
              <p className="mt-5 max-w-3xl text-[16px] leading-8 text-ink/68">
                Rather than being limited to the programmes offered by a single
                provider, MPR Consulting gives employers independent access to
                more than 130 apprenticeship programmes delivered through a
                trusted network of carefully selected training providers.
              </p>
              <p className="mt-4 max-w-3xl text-[16px] leading-8 text-ink/68">
                This means recommendations are driven by your organisation&apos;s
                workforce priorities, not a provider&apos;s sales targets.
              </p>
              <ButtonLink href="/provider-matching" variant="quiet" className="mt-7">
                Explore How It Works
              </ButtonLink>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {networkStats.map(([value, label]) => (
                <div key={label} className="rounded-xl border border-ink/10 bg-cream/68 p-5">
                  <p className="display-heading text-3xl leading-none text-ink">
                    {value}
                  </p>
                  <p className="mt-3 text-[12px] font-semibold uppercase tracking-[0.16em] text-ink/58">
                    {label}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <JourneySelector />

      <section className="container-px bg-cream">
        <div className="mx-auto max-w-7xl border-b border-ink/10 py-14 md:py-16 lg:py-20">
          <div className="grid gap-8 rounded-2xl border border-ink/10 bg-white/40 p-6 shadow-[0_12px_30px_rgba(15,37,39,0.035)] md:p-8 lg:grid-cols-[0.82fr_1.18fr] lg:items-start">
            <div>
              <SectionEyebrow>Funding opportunities</SectionEyebrow>
              <h2 className="display-heading mt-5 text-4xl leading-[1.06] text-ink md:text-5xl">
                Levy Transfer Funding Opportunities
              </h2>
              <p className="mt-5 text-[16px] leading-8 text-ink/68">
                MPR Consulting is currently supporting organisations that may
                be eligible to access apprenticeship levy transfer funding.
              </p>
              <p className="mt-4 text-[16px] leading-8 text-ink/68">
                If your organisation is looking to develop workforce capability
                through apprenticeships, complete the short enquiry form below
                and we will review whether there may be suitable opportunities
                available.
              </p>
              <p className="mt-4 text-sm font-semibold leading-7 text-ink/62">
                Funding opportunities are assessed on a case-by-case basis and
                cannot be guaranteed.
              </p>
            </div>
            <div className="rounded-2xl border border-ink/10 bg-cream/58 p-5 md:p-6">
              <LevyTransferEnquiryForm />
            </div>
          </div>
        </div>
      </section>

      <section className="container-px bg-cream">
        <div className="mx-auto max-w-7xl border-b border-ink/10 py-14 md:py-16 lg:py-20">
          <div className="grid gap-8 lg:grid-cols-[0.76fr_1.24fr] lg:items-start">
            <div>
              <SectionEyebrow>The MPR Decision System</SectionEyebrow>
              <h2 className="display-heading mt-5 text-4xl leading-[1.06] text-ink md:text-5xl">
                A clearer route from options to action.
              </h2>
              <p className="mt-5 max-w-xl text-[16px] leading-8 text-ink/66">
                A practical route from funding questions to workforce decisions,
                provider confidence and measurable implementation.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
              {decisionSystemSteps.map((step, index) => (
                <article
                  key={step.title}
                  className="flex min-h-52 flex-col rounded-2xl border border-ink/10 bg-white/40 p-5 shadow-[0_12px_28px_rgba(15,37,39,0.035)]"
                >
                  <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-teal">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <h3 className="mt-8 text-[17px] font-semibold leading-snug text-ink">
                    {step.title}
                  </h3>
                  <p className="mt-3 text-sm leading-7 text-ink/64">
                    {step.copy}
                  </p>
                </article>
              ))}
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
          <div className="mt-10 grid items-stretch gap-5 md:grid-cols-2 xl:grid-cols-4">
            {services.map((service) => (
              <article
                key={service.title}
                className="premium-card grid h-full min-h-[30rem] grid-rows-[80px_95px_132px_52px] rounded-2xl p-6"
              >
                <div className="overflow-hidden">
                  <h3 className="display-heading text-3xl leading-tight text-ink">
                    {service.title}
                  </h3>
                </div>
                <p className="overflow-hidden text-sm leading-7 text-ink/66">
                  {service.copy}
                </p>
                <div className="grid content-start gap-3 overflow-hidden text-sm leading-6 text-ink/70">
                  {service.benefits.map((benefit) => (
                    <div key={benefit} className="flex gap-3">
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-teal" />
                      <span>{benefit}</span>
                    </div>
                  ))}
                </div>
                <div className="flex items-end">
                  <ButtonLink
                    href={service.href}
                    variant="quiet"
                    className="h-[52px] w-full min-w-0 px-4 text-center"
                  >
                    {service.cta}
                  </ButtonLink>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="container-px bg-cream">
        <div className="mx-auto max-w-7xl border-t border-ink/10 py-14 md:py-16 lg:py-20">
          <div className="grid gap-8 rounded-2xl border border-ink/10 bg-white/34 p-6 shadow-[0_12px_28px_rgba(15,37,39,0.03)] md:p-8 lg:grid-cols-[0.34fr_1fr] lg:items-start">
            <div>
              <SectionEyebrow>Case Study</SectionEyebrow>
              <div className="mt-5 flex items-center justify-center">
                <Image
                  src="/brand/ground-control-logo-transparent.png"
                  alt="Ground Control"
                  width={701}
                  height={274}
                  className="h-auto max-h-[48px] w-auto max-w-[158px] object-contain"
                />
              </div>
            </div>
            <div>
              <h2 className="display-heading text-4xl leading-[1.06] text-ink md:text-5xl">
                Supporting Ground Control&apos;s Apprenticeship Ambitions
              </h2>
              <div className="mt-5 space-y-4 text-[17px] leading-8 text-ink/72">
                <p>
                  Ground Control engaged with MPR Consulting to support the
                  development of its apprenticeship approach and explore
                  opportunities to strengthen workforce capability through
                  funded development programmes.
                </p>
                <p>
                  By taking an independent and employer-focused approach, MPR
                  Consulting helped identify suitable apprenticeship pathways
                  and provider options aligned to organisational priorities.
                </p>
                <p>
                  The focus remained on ensuring decisions were driven by
                  business needs, workforce requirements and long-term
                  capability goals.
                </p>
              </div>
              <div className="mt-7 grid gap-3 sm:grid-cols-2">
                {[
                  "Independent provider guidance",
                  "Employer-focused recommendations",
                  "Apprenticeship pathway identification",
                  "Workforce capability support",
                ].map((highlight) => (
                  <div key={highlight} className="rounded-xl border border-ink/10 bg-cream/70 px-4 py-4 text-sm font-semibold leading-6 text-ink/72">
                    {highlight}
                  </div>
                ))}
              </div>
              <ButtonLink href="/case-studies/ground-control" className="mt-7">
                View Case Study
              </ButtonLink>
            </div>
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
            <SectionEyebrow>Employer-first advice</SectionEyebrow>
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
              Who We Support
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {whoWeSupport.map((audience) => (
                <div key={audience} className="rounded-xl border border-ink/10 bg-cream/70 px-4 py-4 text-sm font-semibold leading-6 text-ink/72">
                  {audience}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="container-px bg-cream">
        <div className="mx-auto max-w-7xl border-t border-ink/10 py-12">
          <div className="grid gap-6 rounded-2xl border border-ink/10 bg-white/34 p-6 shadow-[0_12px_28px_rgba(15,37,39,0.03)] md:p-8 lg:grid-cols-[0.34fr_1fr] lg:items-start">
            <SectionEyebrow>Why MPR Consulting</SectionEyebrow>
            <div>
              <h2 className="display-heading text-4xl leading-[1.06] text-ink md:text-5xl">
                Independent Advice. Employer-Focused Decisions.
              </h2>
              <p className="mt-5 text-[17px] leading-8 text-ink/72">
                MPR Consulting exists to help employers make informed decisions
                about apprenticeships, funding, workforce development and
                training providers.
              </p>
              <p className="mt-4 text-[17px] leading-8 text-ink/72">
                Unlike many organisations operating in the apprenticeship
                sector, MPR Consulting does not deliver training programmes.
                This allows advice and recommendations to remain independent,
                objective and focused entirely on the employer&apos;s requirements.
              </p>
              <p className="mt-4 text-[17px] leading-8 text-ink/72">
                Through trusted provider partners, employers can explore more
                than 130 apprenticeship programmes while retaining objective,
                employer-first guidance from MPR Consulting.
              </p>
              <p className="mt-4 text-[17px] leading-8 text-ink/72">
                Whether reviewing apprenticeship investment, exploring levy
                transfer opportunities, selecting providers or developing
                workforce capability plans, the focus remains the same: helping
                organisations identify the right solution for their people,
                priorities and long-term goals.
              </p>
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
              <ButtonLink href={ENQUIRY_MAILTO} variant="secondary">Book a Conversation</ButtonLink>
            </div>
          </div>
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
              Book a Conversation
            </ButtonLink>
            <ButtonLink href="/contact" variant="secondary">
              Contact MPR Consulting
            </ButtonLink>
          </div>
        </div>
      </section>
    </>
  );
}
