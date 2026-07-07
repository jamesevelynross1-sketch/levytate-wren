import type { Metadata } from "next";
import { SectionEyebrow } from "@/components/ui/SectionEyebrow";
import { ENQUIRY_EMAIL } from "@/lib/contact";

export const metadata: Metadata = {
  title: "Apprenticeship Levy Health Check",
  description:
    "Request an apprenticeship levy health check to review funding, programme options, provider decisions and practical next steps.",
  openGraph: {
    title: "Apprenticeship Levy Health Check | MPR Consulting",
    description:
      "Find out whether your apprenticeship levy is working hard enough for your organisation.",
  },
  alternates: {
    canonical: "/levy-health-check",
  },
};

const reviewItems = [
  "Current levy and apprenticeship usage",
  "Training spend that may have a potentially levy-funded route",
  "Roles and departments with development demand",
  "Provider performance and delivery confidence",
  "Internal ownership, governance and reporting",
  "Practical next steps for better utilisation",
];

const outputs = [
  "Clear view of current position",
  "Potential opportunity areas",
  "Priority questions for HR, finance and operations",
  "Recommended next steps",
];

export default function LevyHealthCheckPage() {
  return (
    <>
      <section className="container-px bg-forest text-cream">
        <div className="mx-auto grid max-w-7xl gap-10 py-16 lg:grid-cols-[0.95fr_1.05fr] lg:items-end lg:py-24">
          <div>
            <SectionEyebrow className="text-teal">Levy Health Check</SectionEyebrow>
            <h1 className="display-heading mt-6 text-5xl leading-[1.04] md:text-7xl">
              Find out whether your apprenticeship levy is working hard enough.
            </h1>
          </div>
          <p className="text-[18px] leading-9 text-cream/74">
            A practical review of your current position, potential gaps and
            opportunities across apprenticeship usage, funding decisions and
            provider activity.
          </p>
        </div>
      </section>

      <section className="container-px bg-cream">
        <div className="mx-auto grid max-w-7xl gap-8 border-b border-ink/10 py-14 lg:grid-cols-[0.8fr_1.2fr] lg:py-16">
          <div>
            <SectionEyebrow>Programme options</SectionEyebrow>
            <h2 className="display-heading mt-5 text-4xl leading-[1.06] text-ink md:text-5xl">
              Your Health Check Doesn&apos;t End With Funding
            </h2>
          </div>
          <div className="premium-card rounded-2xl p-6 md:p-8">
            <p className="text-[16px] leading-8 text-ink/68">
              A levy review should identify the right programme, not simply
              confirm available funding.
            </p>
            <p className="mt-4 text-[16px] leading-8 text-ink/68">
              With access to more than 130 apprenticeship programmes across
              trusted provider partners, MPR Consulting can recommend options
              that genuinely support workforce priorities.
            </p>
          </div>
        </div>
      </section>

      <section className="container-px bg-cream">
        <div className="mx-auto grid max-w-7xl gap-10 py-16 lg:grid-cols-[0.86fr_1.14fr] lg:py-20">
          <div>
            <SectionEyebrow>What we review</SectionEyebrow>
            <h2 className="display-heading mt-5 text-4xl leading-[1.06] text-ink md:text-5xl">
              A focused diagnostic before bigger decisions are made.
            </h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {reviewItems.map((item) => (
              <div key={item} className="rounded-2xl border border-ink/10 bg-white/36 p-5 text-sm leading-7 text-ink/68">
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="container-px bg-parchment/55">
        <div className="mx-auto grid max-w-7xl gap-8 py-16 lg:grid-cols-3 lg:py-20">
          <div className="lg:col-span-1">
            <SectionEyebrow>What you receive</SectionEyebrow>
            <h2 className="display-heading mt-5 text-4xl leading-[1.06] text-ink">
              Clear findings, not a heavy report.
            </h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:col-span-2">
            {outputs.map((output) => (
              <div key={output} className="premium-card rounded-2xl p-6 text-sm font-semibold leading-7 text-ink/72">
                {output}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="container-px bg-cream">
        <div className="mx-auto grid max-w-7xl gap-10 py-16 lg:grid-cols-[0.8fr_1.2fr] lg:py-20">
          <div>
            <SectionEyebrow>Who it is for</SectionEyebrow>
            <h2 className="display-heading mt-5 text-4xl leading-[1.06] text-ink md:text-5xl">
              Employers who want a sensible starting point.
            </h2>
            <p className="mt-5 text-[16px] leading-8 text-ink/66">
              Useful for HR, L&D, finance and operations leaders who suspect
              apprenticeship funding could be used more strategically but need
              a clearer view before committing time or budget.
            </p>
          </div>
          <form action={`mailto:${ENQUIRY_EMAIL}`} method="post" encType="text/plain" className="premium-card rounded-2xl p-6 md:p-8">
            <h3 className="display-heading text-3xl text-ink">Request a Levy Health Check</h3>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <Input name="Name" label="Name" />
              <Input name="Organisation" label="Organisation" />
              <Input name="Email" label="Email" type="email" />
              <Input name="Role" label="Role" />
            </div>
            <label className="mt-4 grid gap-2 text-sm font-semibold text-ink">
              What would you like to understand?
              <textarea name="Message" rows={5} className="rounded-xl border border-ink/12 bg-cream p-3 text-sm font-normal" required />
            </label>
            <button className="button-pill button-pill--primary mt-5">
              Request a Levy Health Check
            </button>
          </form>
        </div>
      </section>
    </>
  );
}

function Input({ name, label, type = "text" }: { name: string; label: string; type?: string }) {
  return (
    <label className="grid gap-2 text-sm font-semibold text-ink">
      {label}
      <input name={name} type={type} className="min-h-12 rounded-xl border border-ink/12 bg-cream px-3 text-sm font-normal" required />
    </label>
  );
}
