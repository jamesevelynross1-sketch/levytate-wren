import type { Metadata } from "next";
import { SectionEyebrow } from "@/components/ui/SectionEyebrow";
import { ENQUIRY_EMAIL } from "@/lib/contact";

export const metadata: Metadata = {
  title: "Contact MPR Consulting",
  description:
    "Contact MPR Consulting about apprenticeship strategy, levy health checks, provider matching, partnership enquiries and workforce capability projects.",
  openGraph: {
    title: "Contact MPR Consulting",
    description:
      "Start a focused conversation about apprenticeship strategy, levy funding, provider matching or workforce capability.",
  },
  alternates: {
    canonical: "/contact",
  },
};

const enquiryTypes = [
  "Strategy discussion",
  "Levy Health Check enquiry",
  "Provider matching enquiry",
  "Partnership / collaboration enquiry",
];

export default function ContactPage() {
  return (
    <section className="container-px bg-cream">
      <div className="mx-auto grid max-w-7xl gap-10 py-16 lg:grid-cols-[0.82fr_1.18fr] lg:py-24">
        <div>
          <SectionEyebrow>Contact</SectionEyebrow>
          <h1 className="display-heading mt-5 text-5xl leading-[1.04] text-ink md:text-7xl">
            Start with the decision you need to make.
          </h1>
          <p className="mt-6 text-[17px] leading-8 text-ink/66">
            Use this page for strategy discussions, Levy Health Check enquiries,
            provider matching questions or partnership conversations. Keep it
            short if you are not sure where to start.
          </p>
          <div className="mt-8 rounded-2xl border border-ink/10 bg-white/36 p-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-teal">
              Direct email
            </p>
            <a href={`mailto:${ENQUIRY_EMAIL}`} className="mt-3 inline-flex text-lg font-semibold text-ink hover:text-teal">
              {ENQUIRY_EMAIL}
            </a>
          </div>
        </div>

        <form action={`mailto:${ENQUIRY_EMAIL}`} method="post" encType="text/plain" className="premium-card rounded-2xl p-6 md:p-8">
          <h2 className="display-heading text-3xl text-ink">Tell us what you need.</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <Input name="Name" label="Name" />
            <Input name="Organisation" label="Organisation" />
            <Input name="Email" label="Email" type="email" />
            <label className="grid gap-2 text-sm font-semibold text-ink">
              Enquiry type
              <select name="Enquiry type" className="min-h-12 rounded-xl border border-ink/12 bg-cream px-3 text-sm font-normal" required>
                {enquiryTypes.map((type) => (
                  <option key={type}>{type}</option>
                ))}
              </select>
            </label>
          </div>
          <label className="mt-4 grid gap-2 text-sm font-semibold text-ink">
            Message
            <textarea name="Message" rows={7} className="rounded-xl border border-ink/12 bg-cream p-3 text-sm font-normal" required />
          </label>
          <button className="button-pill button-pill--primary mt-5">
            Send enquiry
          </button>
          <p className="mt-4 text-sm leading-6 text-ink/54">
            We will use your details only to respond to your enquiry.
          </p>
        </form>
      </div>
    </section>
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
