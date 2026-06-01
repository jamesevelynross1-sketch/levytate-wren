import type { Metadata } from "next";
import Link from "next/link";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { SectionEyebrow } from "@/components/ui/SectionEyebrow";
import { ENQUIRY_MAILTO } from "@/lib/contact";

export const metadata: Metadata = {
  title: "Ground Control Apprenticeship Strategy Case Study",
  description:
    "How MPR Consulting helped Ground Control improve apprenticeship levy utilisation, apprenticeship participation and long-term workforce capability planning.",
};

const outcomeMetrics = [
  {
    value: "390%",
    label: "Increase in apprentices across the organisation",
  },
  {
    value: "530%",
    label: "Increase in apprenticeship levy utilisation",
  },
  {
    value: "400+",
    label: "Unique organisational roles considered",
  },
  {
    value: "New team",
    label: "Apprenticeship-focused function created within L&D",
  },
];

const snapshotItems = [
  ["Client", "Large national employer"],
  ["Complexity", "400+ unique organisational roles"],
  ["Core question", "How can we make our Apprenticeship Levy work smarter for us?"],
  ["Focus", "Strategy, providers, levy opportunity and workforce capability"],
];

const advisorySteps = [
  "Programme review",
  "Provider assessment",
  "Levy opportunity analysis",
  "Strategic apprenticeship roadmap",
];

const outcomes = [
  "Visible growth and development across the organisation.",
  "Clearer long-term direction for development, retention and progression.",
  "Apprenticeships embedded more deliberately within L&D.",
  "Stronger alignment to workforce growth and future skills priorities.",
];

export default function GroundControlCaseStudyPage() {
  return (
    <>
      <section className="container-px mx-auto max-w-7xl pb-12 pt-14 lg:pb-16 lg:pt-20">
        <SectionEyebrow>Case study</SectionEyebrow>
        <div className="mt-5 grid gap-10 lg:grid-cols-[0.92fr_0.58fr] lg:items-end">
          <div>
            <h1 className="display-heading max-w-4xl text-5xl leading-[1.04] text-ink text-balance md:text-6xl">
              Ground Control: making the Apprenticeship Levy work smarter.
            </h1>
            <p className="mt-6 max-w-2xl text-[17px] leading-8 text-ink/66">
              Supporting a large national employer to move from underused levy
              opportunity to a clearer, more embedded approach to
              apprenticeships, providers and workforce capability.
            </p>
          </div>

          <div className="premium-card rounded-xl p-6 md:p-7">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-teal">
              Project snapshot
            </p>
            <div className="mt-5 grid gap-4">
              {snapshotItems.map(([label, value]) => (
                <div key={label} className="border-t border-ink/10 pt-4 first:border-t-0 first:pt-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink/42">
                    {label}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-ink/70">{value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="container-px mx-auto max-w-7xl pb-14 lg:pb-18">
        <div className="border-y border-ink/10 py-7">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {outcomeMetrics.map((metric) => (
              <article key={metric.value} className="rounded-xl border border-ink/10 bg-white/24 p-5">
                <p className="display-heading text-4xl leading-none text-ink md:text-5xl">
                  {metric.value}
                </p>
                <p className="mt-4 text-sm leading-6 text-ink/62">{metric.label}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="container-px mx-auto max-w-7xl pb-16 lg:pb-24">
        <div className="grid gap-10 lg:grid-cols-[0.72fr_1.28fr] lg:gap-16">
          <aside className="lg:sticky lg:top-28 lg:self-start">
            <div className="border-y border-ink/10 py-6">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-teal">
                Advisory focus
              </p>
              <div className="mt-5 grid gap-4">
                {advisorySteps.map((step) => (
                  <p key={step} className="text-sm leading-7 text-ink/66">
                    {step}
                  </p>
                ))}
              </div>
            </div>
            <div className="mt-7 border-b border-ink/10 pb-6">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-teal">
                Strategic alignment
              </p>
              <div className="mt-5 grid gap-4 text-sm leading-7 text-ink/66">
                <p>Workforce growth</p>
                <p>Retention</p>
                <p>Future skills priorities</p>
                <p>Organisational capability development</p>
              </div>
            </div>
          </aside>

          <article className="max-w-3xl">
            <CaseStudySection title="Business context">
              <p>
                Ground Control is a large national employer with more than 400
                unique organisational roles, a strong learning and development
                culture, established internal programmes and clear values around
                people growth.
              </p>
              <p>
                The organisation was already investing significantly in
                commercially funded training. Apprenticeship opportunities,
                however, were materially underutilised, creating a clear
                strategic question for L&D and senior stakeholders.
              </p>
            </CaseStudySection>

            <CaseStudySection title="The challenge">
              <p>
                The core client question was simple: &ldquo;How can we make our
                Apprenticeship Levy work smarter for us?&rdquo;
              </p>
              <p>
                This was not just a funding question. Ground Control needed a
                provider-neutral view of where apprenticeships could support
                workforce growth, retention, future skills and progression
                without disrupting the strengths of its existing development
                culture.
              </p>
            </CaseStudySection>

            <CaseStudySection title="The MPR intervention">
              <p>
                MPR Consulting reviewed the existing programme, assessed
                provider options and analysed the levy opportunity against the
                organisation&rsquo;s role base, development priorities and internal
                operating reality.
              </p>
              <p>
                The work created a strategic apprenticeship roadmap that linked
                funded development to workforce growth, retention, future skills
                priorities and organisational capability development. The
                emphasis was practical and evidence-led: clearer choices, better
                provider decisions and a stronger internal model for managing
                apprenticeship activity.
              </p>
            </CaseStudySection>

            <CaseStudySection title="What changed">
              <p>
                Apprenticeships gained clearer internal ownership and a more
                explicit connection to Ground Control&rsquo;s wider L&D strategy.
                The creation of an apprenticeship-focused team within L&D helped
                move activity from isolated opportunity to managed organisational
                capability.
              </p>
              <p>
                Provider conversations became more informed, with stronger
                criteria around delivery fit, learner experience, business
                relevance and long-term value. The organisation also developed a
                clearer view of how apprenticeship pathways could support
                progression across a complex role base.
              </p>
            </CaseStudySection>

            <CaseStudySection title="Outcomes">
              <p>
                The work contributed to a 390% increase in apprentices across
                the organisation and a 530% increase in apprenticeship levy
                utilisation. It also supported visible growth and development
                across the organisation and a clearer long-term direction for
                development, retention and progression.
              </p>
              <div className="mt-7 grid gap-3">
                {outcomes.map((outcome) => (
                  <p key={outcome} className="rounded-lg border border-ink/10 bg-white/24 px-4 py-3 text-sm leading-6 text-ink/66">
                    {outcome}
                  </p>
                ))}
              </div>
            </CaseStudySection>

            <div className="my-12 rounded-xl border border-ink/10 bg-white/30 p-6 md:p-8">
              <blockquote className="display-heading text-3xl leading-[1.14] text-ink text-balance md:text-4xl">
                &ldquo;Apprenticeships have become a key part of how we develop our
                people, contributing to a growing apprenticeship culture across
                the organisation.&rdquo;
              </blockquote>
              <div className="mt-6">
                <p className="font-semibold text-ink">Jez Light</p>
                <p className="mt-1 text-sm leading-6 text-ink/58">
                  Learning & Development Director, Ground Control
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-cream/10 bg-forest p-7 text-cream shadow-[0_22px_54px_rgba(15,37,39,0.12)] md:p-9">
              <h2 className="display-heading text-4xl leading-[1.06] text-balance">
                Want to make better apprenticeship decisions?
              </h2>
              <p className="mt-5 max-w-2xl text-[16px] leading-8 text-cream/70">
                MPR Consulting helps employers understand where funded
                development fits, which providers are credible and how
                apprenticeship activity can support workforce capability before
                budget, people or providers are committed.
              </p>
              <ButtonLink href={ENQUIRY_MAILTO} variant="secondary" className="mt-7 bg-cream">
                Book a consultation
              </ButtonLink>
              <div className="mt-6 flex flex-wrap gap-x-6 gap-y-3 text-[13px] font-semibold text-cream/78">
                <Link href="/" className="transition hover:text-cream">
                  Back to homepage
                </Link>
                <Link href="/case-studies" className="transition hover:text-cream">
                  View more case studies
                </Link>
              </div>
            </div>
          </article>
        </div>
      </section>
    </>
  );
}

function CaseStudySection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-ink/10 py-9 first:border-t-0 first:pt-0">
      <h2 className="display-heading text-3xl leading-[1.1] text-ink">{title}</h2>
      <div className="mt-5 grid gap-5 text-[16px] leading-8 text-ink/66">
        {children}
      </div>
    </section>
  );
}
