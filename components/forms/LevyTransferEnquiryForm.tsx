"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";

type SubmitState = "idle" | "submitting" | "success" | "error";

const employeeOptions = ["1-49", "50-249", "250-999", "1000+"];
const levyOptions = ["Yes", "No", "Unsure"];

export function LevyTransferEnquiryForm() {
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);

    setSubmitState("submitting");
    setErrorMessage("");

    const payload = {
      organisationName: String(formData.get("organisationName") ?? "").trim(),
      contactName: String(formData.get("contactName") ?? "").trim(),
      email: String(formData.get("email") ?? "").trim(),
      telephone: String(formData.get("telephone") ?? "").trim(),
      employeeNumbers: String(formData.get("employeeNumbers") ?? "").trim(),
      levyPayer: String(formData.get("levyPayer") ?? "").trim(),
      supportInterest: String(formData.get("supportInterest") ?? "").trim(),
      consent: formData.get("consent") === "on",
    };

    try {
      const response = await fetch("/api/levy-transfer-enquiry", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = (await response.json().catch(() => null)) as { message?: string } | null;

      if (!response.ok) {
        throw new Error(data?.message ?? "Unable to submit enquiry.");
      }

      setSubmitState("success");
      form.reset();
    } catch (error) {
      console.error("Levy transfer enquiry submission failed", {
        error,
        payload: {
          organisationName: payload.organisationName,
          email: payload.email,
          employeeNumbers: payload.employeeNumbers,
          levyPayer: payload.levyPayer,
        },
      });
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "We could not submit your enquiry at the moment. Please try again.",
      );
      setSubmitState("error");
    }
  }

  if (submitState === "success") {
    return (
      <div className="rounded-2xl border border-teal/20 bg-white/54 p-6 md:p-7">
        <h3 className="display-heading text-3xl leading-tight text-ink">
          Thank you for your enquiry.
        </h3>
        <p className="mt-4 text-[15px] leading-7 text-ink/68">
          We will review the information provided and contact you if there may
          be suitable levy transfer opportunities available.
        </p>
        <Link href="/" className="button-pill button-pill--primary mt-6">
          Return to Homepage
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Organisation Name *" name="organisationName" autoComplete="organization" />
        <Field label="Contact Name *" name="contactName" autoComplete="name" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Email Address *" name="email" type="email" autoComplete="email" />
        <Field label="Telephone Number" name="telephone" type="tel" autoComplete="tel" required={false} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField label="Number of Employees" name="employeeNumbers" options={employeeOptions} />
        <SelectField
          label="Are you currently a levy-paying organisation?"
          name="levyPayer"
          options={levyOptions}
        />
      </div>

      <label className="grid gap-2 text-sm font-semibold text-ink">
        What apprenticeship or workforce development support are you interested in?
        <textarea
          name="supportInterest"
          rows={5}
          className="resize-y rounded-xl border border-ink/12 bg-cream/70 px-4 py-3 text-base font-normal leading-7 text-ink outline-none transition placeholder:text-ink/38 focus:border-teal focus:ring-4 focus:ring-teal/10"
          required
        />
      </label>

      <label className="flex gap-3 rounded-xl border border-ink/10 bg-cream/60 p-4 text-sm font-semibold leading-6 text-ink/72">
        <input
          name="consent"
          type="checkbox"
          required
          className="mt-1 h-4 w-4 shrink-0 accent-teal"
        />
        <span>
          I consent to MPR Consulting contacting me regarding apprenticeship
          levy transfer opportunities and related workforce development support.
        </span>
      </label>

      {submitState === "error" ? (
        <p className="rounded-xl border border-red-900/15 bg-red-50 px-4 py-3 text-sm font-semibold leading-6 text-red-900">
          {errorMessage}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={submitState === "submitting"}
        className="button-pill button-pill--primary mt-1 w-full disabled:opacity-100 sm:w-auto sm:justify-self-start"
      >
        {submitState === "submitting" ? "Submitting Enquiry..." : "Submit Enquiry"}
      </button>
    </form>
  );
}

function Field({
  label,
  name,
  type = "text",
  autoComplete,
  required = true,
}: {
  label: string;
  name: string;
  type?: string;
  autoComplete?: string;
  required?: boolean;
}) {
  return (
    <label className="grid gap-2 text-sm font-semibold text-ink">
      {label}
      <input
        name={name}
        type={type}
        autoComplete={autoComplete}
        required={required}
        className="min-h-12 rounded-xl border border-ink/12 bg-cream/70 px-4 text-base font-normal text-ink outline-none transition placeholder:text-ink/38 focus:border-teal focus:ring-4 focus:ring-teal/10"
      />
    </label>
  );
}

function SelectField({ label, name, options }: { label: string; name: string; options: string[] }) {
  return (
    <label className="grid gap-2 text-sm font-semibold text-ink">
      {label}
      <select
        name={name}
        required
        defaultValue=""
        className="min-h-12 rounded-xl border border-ink/12 bg-cream/70 px-4 text-base font-normal text-ink outline-none transition focus:border-teal focus:ring-4 focus:ring-teal/10"
      >
        <option value="" disabled>
          Select an option
        </option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}
