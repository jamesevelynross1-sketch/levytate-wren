import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { SectionEyebrow } from "@/components/ui/SectionEyebrow";
import { ENQUIRY_MAILTO } from "@/lib/contact";

export const metadata: Metadata = {
  title: "Apprenticeship Provider Matching",
  description:
    "Independent apprenticeship provider matching for employers, with access to 130+ programmes through trusted provider partners.",
  openGraph: {
    title: "Apprenticeship Provider Matching | MPR Consulting",
    description:
      "Independent support to identify apprenticeship programmes and trusted providers based on quality, fit and employer need.",
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

const directProviderComparison = [
  "Limited programme portfolio",
  "One delivery model",
  "Recommendations limited to internal offer",
];

const mprComparison = [
  "130+ apprenticeship programmes",
  "Multiple trusted providers",
  "Independent recommendations",
  "Employer-first approach",
  "Greater flexibility",
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
        <div className="mx-auto max-w-7xl border-b border-ink/10 py-16 lg:py-20">
          <div className="grid gap-10 lg:grid-cols-[0.82fr_1.18fr] lg:items-start">
            <div>
              <SectionEyebrow>More choice</SectionEyebrow>
              <h2 className="display-heading mt-5 text-4xl leading-[1.06] text-ink md:text-5xl">
                More Choice. Better Decisions.
              </h2>
              <div className="mt-5 grid gap-4 text-[16px] leading-8 text-ink/68">
                <p>
                  Unlike working directly with a single provider, MPR
                  Consulting can explore apprenticeship solutions across a
                  trusted provider network covering more than 130 apprenticeship
                  programmes.
                </p>
                <p>
                  This enables employers to identify the most suitable
                  programme, provider and delivery approach based on
                  organisational objectives.
                </p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <ComparisonCard title="Working Directly With One Provider" items={directProviderComparison} />
              <ComparisonCard title="Working With MPR Consulting" items={mprComparison} highlight />
            </div>
          </div>
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

function ComparisonCard({
  title,
  items,
  highlight = false,
}: {
  title: string;
  items: string[];
  highlight?: boolean;
}) {
  return (
    <div className={`rounded-2xl border p-6 ${highlight ? "border-teal/24 bg-teal/[0.08]" : "border-ink/10 bg-white/36"}`}>
      <h3 className="text-lg font-semibold leading-snug text-ink">{title}</h3>
      <div className="mt-5 grid gap-3 text-sm leading-6 text-ink/68">
        {items.map((item) => (
          <div key={item} className="flex gap-3">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-teal" />
            <span>{item}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
