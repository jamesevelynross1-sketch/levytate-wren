import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { SectionEyebrow } from "@/components/ui/SectionEyebrow";
import { ENQUIRY_MAILTO } from "@/lib/contact";

export const metadata: Metadata = {
  title: "Apprenticeship Framework Consultancy",
  description:
    "Build a structured apprenticeship framework across roles, skills gaps and 130+ potential apprenticeship programme routes with MPR Consulting.",
  openGraph: {
    title: "Apprenticeship Framework Consultancy | MPR Consulting",
    description:
      "A structured approach to using apprenticeships across roles, departments and long-term workforce priorities.",
  },
  alternates: {
    canonical: "/framework",
  },
};

const solves = [
  "Apprenticeships used inconsistently across teams",
  "Training activity disconnected from workforce priorities",
  "Unclear role-to-standard decisions",
  "Provider choice happening before internal strategy",
  "Low confidence around governance, ownership and outcomes",
];

const includes = [
  "Current state review",
  "Role and capability mapping",
  "Priority pathway recommendations",
  "Provider requirements and selection criteria",
  "Implementation roadmap",
  "Stakeholder narrative for HR, finance and operations",
];

const areas = [
  "Leadership and management",
  "Data, AI and digital",
  "Procurement and supply chain",
  "Operations",
  "Business administration",
  "Technical and role-specific pathways",
];

export default function FrameworkPage() {
  return (
    <>
      <section className="container-px bg-forest text-cream">
        <div className="mx-auto max-w-7xl py-16 lg:py-24">
          <SectionEyebrow className="text-teal">Apprenticeship Framework</SectionEyebrow>
          <h1 className="display-heading mt-6 max-w-5xl text-5xl leading-[1.04] md:text-7xl">
            Build a long-term apprenticeship system around the workforce you need.
          </h1>
          <p className="mt-7 max-w-3xl text-[18px] leading-9 text-cream/74">
            The MPR Apprenticeship Framework helps employers move from reactive
            programme choices to a structured approach across roles, teams,
            capability gaps and business priorities.
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <ButtonLink href={ENQUIRY_MAILTO} variant="secondary" className="bg-cream">
              Book a Conversation
            </ButtonLink>
            <ButtonLink href="/levy-health-check" variant="secondary">
              Start with a Levy Health Check
            </ButtonLink>
          </div>
        </div>
      </section>

      <section className="container-px bg-cream">
        <div className="mx-auto grid max-w-7xl gap-10 py-16 lg:grid-cols-[0.82fr_1.18fr] lg:py-20">
          <div>
            <SectionEyebrow>What it is</SectionEyebrow>
            <h2 className="display-heading mt-5 text-4xl leading-[1.06] text-ink md:text-5xl">
              A practical architecture for apprenticeship decisions.
            </h2>
          </div>
          <div className="grid gap-5 text-[16px] leading-8 text-ink/68">
            <p>
              The framework clarifies where apprenticeships should support the
              organisation, which roles and departments should be prioritised,
              which pathways are credible and what provider requirements matter.
            </p>
            <p>
              It is designed for employers who want a clearer link between levy
              funding, workforce planning, provider decisions and measurable
              capability building.
            </p>
            <p>
              Once workforce priorities have been identified, MPR Consulting
              maps suitable roles to apprenticeship programmes from a trusted
              network delivering more than 130 programmes. This ensures
              recommendations are driven by organisational need rather than
              provider limitations.
            </p>
          </div>
        </div>
      </section>

      <section className="container-px bg-parchment/55">
        <div className="mx-auto max-w-7xl py-16 lg:py-20">
          <div className="grid gap-8 lg:grid-cols-3">
            <div>
              <SectionEyebrow>Who it is for</SectionEyebrow>
              <h2 className="display-heading mt-5 text-4xl leading-[1.06] text-ink">
                Employers ready to move beyond isolated activity.
              </h2>
            </div>
            <div className="premium-card rounded-2xl p-6 lg:col-span-2">
              <div className="grid gap-4 md:grid-cols-2">
                {solves.map((item) => (
                  <div key={item} className="rounded-xl border border-ink/10 bg-cream/70 p-4 text-sm leading-7 text-ink/68">
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="container-px bg-cream">
        <div className="mx-auto max-w-7xl py-16 lg:py-20">
          <div className="grid gap-10 lg:grid-cols-[0.72fr_1.28fr]">
            <div>
              <SectionEyebrow>What it includes</SectionEyebrow>
              <h2 className="display-heading mt-5 text-4xl leading-[1.06] text-ink md:text-5xl">
                Clear outputs your stakeholders can use.
              </h2>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {includes.map((item, index) => (
                <div key={item} className="rounded-2xl border border-ink/10 bg-white/36 p-5">
                  <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-teal">
                    {String(index + 1).padStart(2, "0")}
                  </p>
                  <p className="mt-5 text-sm font-semibold leading-7 text-ink/76">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="container-px bg-ink text-cream">
        <div className="mx-auto grid max-w-7xl gap-10 py-16 lg:grid-cols-[0.8fr_1.2fr] lg:py-20">
          <div>
            <SectionEyebrow className="text-teal">Framework areas</SectionEyebrow>
            <h2 className="display-heading mt-5 text-4xl leading-[1.06] md:text-5xl">
              Built around the work your organisation actually needs to develop.
            </h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {areas.map((area) => (
              <div key={area} className="rounded-2xl border border-cream/12 bg-cream/[0.055] px-5 py-5 text-sm font-semibold text-cream/78">
                {area}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="container-px bg-cream">
        <div className="mx-auto grid max-w-7xl gap-8 py-16 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div>
            <SectionEyebrow>How MPR builds it</SectionEyebrow>
            <h2 className="display-heading mt-5 text-4xl leading-[1.06] text-ink md:text-5xl">
              Diagnose the current position, design the framework, support the route to delivery.
            </h2>
          </div>
          <div className="grid gap-4 text-sm leading-7 text-ink/68">
            {[
              "We review current activity, funding position, internal ownership and workforce priorities.",
              "We map credible apprenticeship opportunities against roles, teams and future capability needs.",
              "We help define provider requirements, implementation sequence and internal decision points.",
            ].map((item) => (
              <p key={item} className="rounded-2xl border border-ink/10 bg-white/36 p-5">{item}</p>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
