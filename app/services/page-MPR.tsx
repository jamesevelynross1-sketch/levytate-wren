import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { SectionEyebrow } from "@/components/ui/SectionEyebrow";
import { ENQUIRY_MAILTO } from "@/lib/contact";

export const metadata: Metadata = {
  title: "Consultancy and Project Work",
  description:
    "Focused apprenticeship consultancy and project support for levy usage, workforce capability, provider selection and implementation challenges.",
  openGraph: {
    title: "Consultancy and Project Work | MPR Consulting",
    description:
      "Hands-on project support for employers working through apprenticeship strategy, provider selection, levy usage and workforce capability planning.",
  },
  alternates: {
    canonical: "/services",
  },
};

const projects = [
  "Apprenticeship strategy review",
  "Levy and funding opportunity review",
  "Provider sourcing and comparison",
  "Role-to-standard mapping",
  "Workforce capability planning",
  "Internal stakeholder engagement",
  "Implementation and governance support",
  "Apprenticeship operating model design",
];

export default function ServicesPage() {
  return (
    <>
      <section className="container-px bg-forest text-cream">
        <div className="mx-auto max-w-7xl py-16 lg:py-24">
          <SectionEyebrow className="text-teal">Consultancy & Project Work</SectionEyebrow>
          <h1 className="display-heading mt-6 max-w-5xl text-5xl leading-[1.04] md:text-7xl">
            Focused support for complex apprenticeship and workforce decisions.
          </h1>
          <p className="mt-7 max-w-3xl text-[18px] leading-9 text-cream/74">
            For employers who need specific help reviewing apprenticeship use,
            selecting providers, aligning programmes, reducing commercial
            training spend or improving workforce capability.
          </p>
          <ButtonLink href={ENQUIRY_MAILTO} variant="secondary" className="mt-9 bg-cream">
            Book a Conversation
          </ButtonLink>
        </div>
      </section>

      <section className="container-px bg-cream">
        <div className="mx-auto grid max-w-7xl gap-10 py-16 lg:grid-cols-[0.78fr_1.22fr] lg:py-20">
          <div>
            <SectionEyebrow>Project focus</SectionEyebrow>
            <h2 className="display-heading mt-5 text-4xl leading-[1.06] text-ink md:text-5xl">
              Practical work that creates clarity before decisions harden.
            </h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {projects.map((project) => (
              <div key={project} className="rounded-2xl border border-ink/10 bg-white/36 p-5 text-sm font-semibold leading-7 text-ink/70">
                {project}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="container-px bg-parchment/55">
        <div className="mx-auto grid max-w-7xl gap-8 py-16 lg:grid-cols-3 lg:py-20">
          {[
            ["Commercially aware", "We connect apprenticeship decisions to cost, capability, provider risk and operational fit."],
            ["Provider-neutral", "Advice is independent and shaped around employer need rather than provider sales targets."],
            ["Implementation-minded", "Recommendations are designed to be used by real teams with real constraints."],
          ].map(([title, copy]) => (
            <article key={title} className="premium-card rounded-2xl p-6">
              <h2 className="display-heading text-3xl text-ink">{title}</h2>
              <p className="mt-4 text-sm leading-7 text-ink/66">{copy}</p>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
