"use client";

import { FormEvent, useState } from "react";
import { SectionEyebrow } from "@/components/ui/SectionEyebrow";
import { ENQUIRY_EMAIL } from "@/lib/contact";

const interestOptions = [
  "Apprenticeship strategy",
  "Provider matching",
  "Levy and funding",
  "Workforce capability mapping",
  "Outsourced apprenticeship coordination",
  "General enquiry",
];

export default function ContactPage() {
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const firstName = String(formData.get("firstName") ?? "");
    const lastName = String(formData.get("lastName") ?? "");
    const email = String(formData.get("email") ?? "");
    const organisation = String(formData.get("organisation") ?? "");
    const role = String(formData.get("role") ?? "");
    const interest = String(formData.get("interest") ?? "");
    const message = String(formData.get("message") ?? "");

    const subject = `MPR Consulting enquiry from ${firstName} ${lastName}`.trim();
    const body = [
      "New MPR Consulting enquiry",
      "",
      `First name: ${firstName}`,
      `Last name: ${lastName}`,
      `Work email: ${email}`,
      `Organisation: ${organisation}`,
      `Role: ${role}`,
      `Area of interest: ${interest}`,
      "",
      "Message:",
      message,
      "",
      `Reply-To: ${email}`,
    ].join("\n");

    const mailto = `mailto:${ENQUIRY_EMAIL}?subject=${encodeURIComponent(
      subject,
    )}&Reply-To=${encodeURIComponent(email)}&body=${encodeURIComponent(body)}`;

    window.location.href = mailto;
    setSubmitted(true);
    form.reset();
  }

  return (
    <section className="container-px mx-auto grid max-w-7xl gap-12 pb-20 pt-14 lg:grid-cols-[0.85fr_1.15fr] lg:pt-20">
      <div>
        <SectionEyebrow>Contact</SectionEyebrow>
        <h1 className="display-heading text-5xl leading-[1.04] text-ink text-balance md:text-6xl">
          Book a conversation.
        </h1>
        <p className="mt-7 max-w-xl text-[17px] leading-8 text-ink/66">
          Tell us what you are trying to understand, improve or decide. We will
          come back with a practical route into the right conversation.
        </p>
        <a
          href={`mailto:${ENQUIRY_EMAIL}`}
          className="mt-5 inline-flex text-sm font-semibold text-ink underline decoration-ink/20 underline-offset-8 transition hover:text-teal"
        >
          {ENQUIRY_EMAIL}
        </a>
      </div>

      <div className="rounded-3xl border border-ink/10 bg-white/36 p-6 shadow-[0_14px_36px_rgba(15,37,39,0.045)] md:p-8">
        {submitted ? (
          <div className="rounded-2xl border border-teal/25 bg-mist/60 p-6 text-base font-semibold leading-7 text-ink">
            Thank you. Your enquiry has been prepared for {ENQUIRY_EMAIL} and
            we&apos;ll be in touch shortly.
          </div>
        ) : null}
        <form onSubmit={handleSubmit} className="mt-0 grid gap-5">
          <div className="grid gap-5 md:grid-cols-2">
            <Field label="First name" name="firstName" autoComplete="given-name" />
            <Field label="Last name" name="lastName" autoComplete="family-name" />
          </div>
          <Field label="Work email" name="email" type="email" autoComplete="email" />
          <div className="grid gap-5 md:grid-cols-2">
            <Field label="Organisation" name="organisation" autoComplete="organization" />
            <Field label="Role" name="role" autoComplete="organization-title" />
          </div>
          <label className="grid gap-2 text-sm font-semibold text-ink">
            Area of interest
            <select
              name="interest"
              required
              className="min-h-12 rounded-xl border border-ink/12 bg-cream/70 px-4 text-base font-normal text-ink outline-none transition focus:border-teal focus:ring-4 focus:ring-teal/10"
              defaultValue=""
            >
              <option value="" disabled>
                Select an area
              </option>
              {interestOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-2 text-sm font-semibold text-ink">
            Message
            <textarea
              name="message"
              required
              rows={6}
              className="resize-y rounded-xl border border-ink/12 bg-cream/70 px-4 py-3 text-base font-normal leading-7 text-ink outline-none transition focus:border-teal focus:ring-4 focus:ring-teal/10"
            />
          </label>
          <button
            type="submit"
            className="mt-2 inline-flex min-h-11 items-center justify-center rounded-full bg-ink px-5 text-[13px] font-semibold text-cream shadow-[0_12px_28px_rgba(15,37,39,0.12)] transition hover:bg-forest focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink"
          >
            Send enquiry
          </button>
        </form>
      </div>
    </section>
  );
}

type FieldProps = {
  label: string;
  name: string;
  type?: string;
  autoComplete?: string;
};

function Field({ label, name, type = "text", autoComplete }: FieldProps) {
  return (
    <label className="grid gap-2 text-sm font-semibold text-ink">
      {label}
      <input
        name={name}
        type={type}
        required
        autoComplete={autoComplete}
        className="min-h-12 rounded-xl border border-ink/12 bg-cream/70 px-4 text-base font-normal text-ink outline-none transition focus:border-teal focus:ring-4 focus:ring-teal/10"
      />
    </label>
  );
}
