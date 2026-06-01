import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { SectionEyebrow } from "@/components/ui/SectionEyebrow";
import { ENQUIRY_MAILTO } from "@/lib/contact";

export const metadata: Metadata = {
  title: "Apprenticeship Provider Matching",
  description:
    "Independent apprenticeship provider matching for employers who want better fit, quality and confidence.",
  openGraph: {
    title: "Apprenticeship Provider Matching | MPR Consulting",
    description:
      "Independent support to identify, assess and select apprenticeship providers based on quality, fit and employer need.",
  },
  alternates: {
    canonical: "/provider-matching",
  },
};

const problems = [
  "Provider selection starts from sales conversations rather than employer requirements",
  "Delivery model, learner support and reporting are not tested early enough",
  "Quality signals are hard to interpret without a clear decision framework",
  "Internal stakeholders lack confidence in which provider is the right fit",
];

const assessment = [
  "Delivery model and operational fit",
  "Sector and role relevance",
  "Learner and manager support",
  "Reporting quality and account management",
  "Commercial clarity and implementation risk",
  "Evidence of quality, outcomes and delivery consistency",
];

export default function ProviderMatchingPage() {
  return (
    <>
      <section className="container-px bg-forest text-cream">
        <div className="mx-auto max-w-7xl py-16 lg:py-24">
          <SectionEyebrow className="text-teal">Provider Matching</SectionEyebrow>
          <h1 className="display-heading mt-6 max-w-5xl text-5xl leading-[1.04] md:text-7xl">
            Independent provider matching for better fit, quality and confidence.
          </h1>
          <p className="mt-7 max-w-3xl text-[18px] leading-9 text-cream/74">
            MPR helps employers identify, assess and select apprenticeship
            providers through an employer-first lens, not a provider sales lens.
          </p>
          <ButtonLink href={ENQUIRY_MAILTO} variant="secondary" className="mt-9 bg-cream">
            Discuss Provider Matching
          </ButtonLink>
        </div>
      </section>

      <section className="container-px bg-cream">
        <div className="mx-auto grid max-w-7xl gap-10 py-16 lg:grid-cols-[0.8fr_1.2fr] lg:py-20">
          <div>
            <SectionEyebrow>Why provider choice matters</SectionEyebrow>
            <h2 className="display-heading mt-5 text-4xl leading-[1.06] text-ink md:text-5xl">
              The provider often determines whether the strategy works in practice.
            </h2>
          </div>
          <p className="text-[17px] leading-8 text-ink/68">
            A suitable provider can make apprenticeship delivery feel structured,
            relevant and manageable. A poor fit can create low engagement,
            inconsistent reporting, operational friction and weak confidence
            among managers and learners.
          </p>
        </div>
      </section>

      <section className="container-px bg-parchment/55">
        <div className="mx-auto grid max-w-7xl gap-8 py-16 lg:grid-cols-[0.82fr_1.18fr] lg:py-20">
          <div>
            <SectionEyebrow>Common problems</SectionEyebrow>
            <h2 className="display-heading mt-5 text-4xl leading-[1.06] text-ink">
              Provider choice is rarely just a procurement question.
            </h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {problems.map((problem) => (
              <div key={problem} className="premium-card rounded-2xl p-6 text-sm leading-7 text-ink/68">
                {problem}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="container-px bg-ink text-cream">
        <div className="mx-auto grid max-w-7xl gap-10 py-16 lg:grid-cols-[0.8fr_1.2fr] lg:py-20">
          <div>
            <SectionEyebrow className="text-teal">How MPR assesses providers</SectionEyebrow>
            <h2 className="display-heading mt-5 text-4xl leading-[1.06] md:text-5xl">
              Quality, fit and employer need in one decision view.
            </h2>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {assessment.map((item) => (
              <div key={item} className="rounded-2xl border border-cream/12 bg-cream/[0.055] p-5 text-sm font-semibold leading-7 text-cream/76">
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="container-px bg-cream">
        <div className="mx-auto grid max-w-7xl gap-8 py-16 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div>
            <SectionEyebrow>What employers get</SectionEyebrow>
            <h2 className="display-heading mt-5 text-4xl leading-[1.06] text-ink md:text-5xl">
              A clearer shortlist, stronger criteria and more confidence before committing.
            </h2>
          </div>
          <div className="premium-card rounded-2xl p-6 md:p-8">
            <p className="text-[16px] leading-8 text-ink/68">
              We help define the requirements, compare credible options, surface
              delivery risks and translate provider claims into practical
              decision criteria your stakeholders can understand.
            </p>
            <ButtonLink href={ENQUIRY_MAILTO} className="mt-7">
              Start Provider Matching Enquiry
            </ButtonLink>
          </div>
        </div>
      </section>
    </>
  );
}
