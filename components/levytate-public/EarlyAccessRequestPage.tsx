"use client";

import Link from "next/link";
import { ArrowRight, CheckCircle2, ShieldCheck, Sparkles, UsersRound } from "lucide-react";
import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { PublicFooter, PublicHeader } from "@/components/levytate-public/PublicHeader";
import {
  earlyAccessEmployeeBands,
  earlyAccessStorageKey,
  type EarlyAccessRequest,
} from "@/lib/levytate/early-access/domain";

type FormState = {
  organisation: string;
  contactName: string;
  email: string;
  employeeCount: string;
  biggestChallenge: string;
  consent: boolean;
};

const initialState: FormState = {
  organisation: "",
  contactName: "",
  email: "",
  employeeCount: "",
  biggestChallenge: "",
  consent: false,
};

const valuePoints = [
  {
    icon: Sparkles,
    title: "Shape the workflow",
    copy: "Influence how LevyTate handles approvals, pathway guidance and provider matching before wider release.",
  },
  {
    icon: UsersRound,
    title: "Join a limited cohort",
    copy: "We are inviting a small number of employers who want a more structured apprenticeship operating model.",
  },
  {
    icon: ShieldCheck,
    title: "Product-led onboarding",
    copy: "Tell us your current challenge and we will review whether LevyTate is the right early fit for your team.",
  },
] as const;

export function EarlyAccessRequestPage() {
  const [form, setForm] = useState<FormState>(initialState);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [submittedLead, setSubmittedLead] = useState<EarlyAccessRequest | null>(null);

  const canSubmit = useMemo(() => (
    form.organisation.trim() &&
    form.contactName.trim() &&
    form.email.trim() &&
    form.employeeCount.trim() &&
    form.consent
  ), [form]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/levytate-early-access", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });

      const payload = (await response.json()) as {
        message?: string;
        lead?: EarlyAccessRequest;
      };

      if (!response.ok || !payload.lead) {
        throw new Error(payload.message || "Early access is temporarily unavailable.");
      }

      setSubmittedLead(payload.lead);
      setForm(initialState);
      persistSubmittedLead(payload.lead);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Early access is temporarily unavailable.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#f6fbf8] text-[#102c3d]">
      <PublicHeader />
      <main>
        <section className="relative overflow-hidden border-b border-[#102c3d]/[0.07]">
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,rgba(199,240,228,0.92),transparent_31rem),radial-gradient(circle_at_top_right,rgba(255,128,144,0.18),transparent_24rem),linear-gradient(180deg,#f6fbf8_0%,#eef8f4_100%)]" />
          <div className="mx-auto grid max-w-7xl gap-8 px-5 py-14 sm:px-8 lg:grid-cols-[0.92fr_1.08fr] lg:items-start lg:py-20">
            <div className="max-w-2xl">
              <p className="inline-flex rounded-full bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#0b6f63] ring-1 ring-[#159b8f]/[0.12] shadow-[0_12px_30px_rgba(16,44,61,0.05)]">
                Founding employers
              </p>
              <h1 className="mt-6 text-[2.6rem] font-semibold leading-[1.04] tracking-[-0.03em] sm:text-5xl lg:text-[3.75rem]">
                Request Early Access
              </h1>
              <p className="mt-5 text-lg leading-8 text-[#102c3d]/66">
                Join a small group of employers helping shape the future of apprenticeship management.
              </p>
              <p className="mt-4 max-w-xl text-base leading-7 text-[#102c3d]/58">
                Access during the limited beta programme is offered to employers who want to improve visibility, reduce administration and build a clearer route from employee demand to approved delivery.
              </p>

              <div className="mt-8 grid gap-4">
                {valuePoints.map(({ icon: Icon, title, copy }) => (
                  <article key={title} className="rounded-[1.4rem] border border-[#102c3d]/[0.07] bg-white/88 p-5 shadow-[0_20px_55px_rgba(16,44,61,0.06)] backdrop-blur-xl">
                    <div className="flex items-start gap-4">
                      <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#eef8f4] text-[#0b8e82] ring-1 ring-[#159b8f]/[0.12]">
                        <Icon size={18} />
                      </div>
                      <div>
                        <h2 className="text-base font-semibold">{title}</h2>
                        <p className="mt-2 text-sm leading-6 text-[#102c3d]/60">{copy}</p>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </div>

            <div className="min-w-0 rounded-[2rem] border border-[#102c3d]/[0.08] bg-white/92 p-4 shadow-[0_34px_100px_rgba(16,44,61,0.13)] backdrop-blur-xl sm:p-5">
              <div className="rounded-[1.6rem] border border-[#102c3d]/[0.06] bg-[#fbfcfc] p-5 sm:p-6">
                {submittedLead ? (
                  <SuccessState organisation={submittedLead.organisation} />
                ) : (
                  <>
                    <div className="max-w-xl">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#c95568]">Limited beta intake</p>
                      <h2 className="mt-2 text-3xl font-semibold tracking-[-0.025em]">Tell us about your organisation.</h2>
                      <p className="mt-3 text-sm leading-7 text-[#102c3d]/60">
                        Keep it light. We only need enough context to assess fit for the early programme.
                      </p>
                    </div>

                    <form className="mt-6 grid gap-4" onSubmit={handleSubmit}>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <Field label="Organisation">
                          <input
                            required
                            value={form.organisation}
                            onChange={(event) => setForm((current) => ({ ...current, organisation: event.target.value }))}
                            className="h-12 rounded-2xl border border-[#102c3d]/[0.08] bg-white px-4 text-sm font-medium text-[#102c3d] outline-none transition focus:border-[#159b8f] focus:ring-4 focus:ring-[#159b8f]/10"
                            placeholder="Your organisation"
                          />
                        </Field>
                        <Field label="Name">
                          <input
                            required
                            value={form.contactName}
                            onChange={(event) => setForm((current) => ({ ...current, contactName: event.target.value }))}
                            className="h-12 rounded-2xl border border-[#102c3d]/[0.08] bg-white px-4 text-sm font-medium text-[#102c3d] outline-none transition focus:border-[#159b8f] focus:ring-4 focus:ring-[#159b8f]/10"
                            placeholder="Your name"
                          />
                        </Field>
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <Field label="Work Email">
                          <input
                            required
                            type="email"
                            value={form.email}
                            onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                            className="h-12 rounded-2xl border border-[#102c3d]/[0.08] bg-white px-4 text-sm font-medium text-[#102c3d] outline-none transition focus:border-[#159b8f] focus:ring-4 focus:ring-[#159b8f]/10"
                            placeholder="your.name@company.co.uk"
                          />
                        </Field>
                        <Field label="Number of Employees">
                          <select
                            required
                            value={form.employeeCount}
                            onChange={(event) => setForm((current) => ({ ...current, employeeCount: event.target.value }))}
                            className="h-12 rounded-2xl border border-[#102c3d]/[0.08] bg-white px-4 text-sm font-medium text-[#102c3d] outline-none transition focus:border-[#159b8f] focus:ring-4 focus:ring-[#159b8f]/10"
                          >
                            <option value="">Select band</option>
                            {earlyAccessEmployeeBands.map((band) => (
                              <option key={band} value={band}>{band}</option>
                            ))}
                          </select>
                        </Field>
                      </div>

                      <Field label="Biggest apprenticeship challenge">
                        <input
                          value={form.biggestChallenge}
                          onChange={(event) => setForm((current) => ({ ...current, biggestChallenge: event.target.value }))}
                          className="h-12 rounded-2xl border border-[#102c3d]/[0.08] bg-white px-4 text-sm font-medium text-[#102c3d] outline-none transition focus:border-[#159b8f] focus:ring-4 focus:ring-[#159b8f]/10"
                          placeholder="Optional"
                        />
                      </Field>

                      <label className="flex items-start gap-3 rounded-[1.15rem] border border-[#102c3d]/[0.06] bg-[#f8fbfa] px-4 py-3">
                        <input
                          type="checkbox"
                          checked={form.consent}
                          onChange={(event) => setForm((current) => ({ ...current, consent: event.target.checked }))}
                          className="mt-1 h-4 w-4 rounded border-[#102c3d]/20 text-[#0b8e82] focus:ring-[#159b8f]/20"
                        />
                        <span className="text-sm leading-6 text-[#102c3d]/68">
                          I would like to be considered for LevyTate Early Access.
                        </span>
                      </label>

                      {message ? (
                        <p className="rounded-2xl border border-[#c95568]/20 bg-[#fff4f5] px-4 py-3 text-sm text-[#a93d52]">
                          {message}
                        </p>
                      ) : null}

                      <div className="flex flex-wrap items-center gap-3 pt-1">
                        <button
                          type="submit"
                          disabled={!canSubmit || loading}
                          className="inline-flex min-h-12 items-center justify-center rounded-full bg-[#102c3d] px-6 text-sm font-semibold text-white shadow-[0_18px_38px_rgba(16,44,61,0.18)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-55"
                        >
                          {loading ? "Requesting access..." : "Request Early Access"}
                        </button>
                        <Link href="/login" className="inline-flex min-h-12 items-center justify-center rounded-full bg-[#eef8f4] px-6 text-sm font-semibold text-[#0b6f63] ring-1 ring-[#159b8f]/[0.12] transition hover:-translate-y-0.5">
                          Login to Beta
                        </Link>
                      </div>
                    </form>
                  </>
                )}
              </div>
            </div>
          </div>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-2">
      <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#102c3d]/48">{label}</span>
      {children}
    </label>
  );
}

function SuccessState({ organisation }: { organisation: string }) {
  return (
    <div className="flex min-h-[540px] flex-col items-center justify-center text-center">
      <div className="grid h-16 w-16 place-items-center rounded-[1.4rem] bg-[#eef8f4] text-[#0b8e82] ring-1 ring-[#159b8f]/[0.12]">
        <CheckCircle2 size={28} />
      </div>
      <p className="mt-6 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#c95568]">Request received</p>
      <h2 className="mt-2 text-3xl font-semibold tracking-[-0.025em]">Thank you.</h2>
      <p className="mt-4 max-w-lg text-base leading-7 text-[#102c3d]/62">
        Your Early Access request for {organisation} has been received. We are inviting a small number of employers into the LevyTate beta to help shape the platform. We will review your request and be in touch shortly.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Link href="/" className="inline-flex min-h-12 items-center justify-center rounded-full bg-[#102c3d] px-6 text-sm font-semibold text-white shadow-[0_18px_38px_rgba(16,44,61,0.18)] transition hover:-translate-y-0.5">
          Return to Homepage
        </Link>
        <Link href="/login" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-white px-6 text-sm font-semibold text-[#102c3d] ring-1 ring-[#102c3d]/[0.09] transition hover:-translate-y-0.5">
          Login to Beta
          <ArrowRight size={16} />
        </Link>
      </div>
    </div>
  );
}

function persistSubmittedLead(lead: EarlyAccessRequest) {
  if (typeof window === "undefined") return;

  try {
    const parsed = JSON.parse(window.localStorage.getItem(earlyAccessStorageKey) ?? "[]") as EarlyAccessRequest[];
    const next = [lead, ...parsed.filter((entry) => entry.id !== lead.id)];
    window.localStorage.setItem(earlyAccessStorageKey, JSON.stringify(next));
  } catch {
    window.localStorage.setItem(earlyAccessStorageKey, JSON.stringify([lead]));
  }
}


