import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Members Dashboard | MPR Consulting",
  description:
    "Access member tools from MPR Consulting, including the Apprenticeship Opportunity Review.",
};

const dashboardCards = [
  {
    title: "Guided diagnostic inputs",
    description:
      "Capture organisation details, apprenticeship activity, current challenges and business priorities.",
  },
  {
    title: "Practical opportunity review",
    description:
      "Identify immediate opportunities without scores, maturity labels or generic AI reporting.",
  },
  {
    title: "Action-focused output",
    description:
      "Create 30, 60 and 90 day actions that can support a more useful employer conversation.",
  },
];

export default function MembersDashboardPage() {
  return (
    <main className="bg-[var(--cream)] text-[var(--ink)]">
      <section className="container-px mx-auto max-w-7xl py-20 sm:py-24 lg:py-28">
        <div className="grid gap-12 lg:grid-cols-[0.95fr_1.05fr] lg:items-end">
          <div>
            <p className="mb-5 text-xs font-semibold uppercase tracking-[0.28em] text-[var(--teal)]">
              MPR Members
            </p>
            <h1 className="display-heading text-balance text-4xl font-semibold leading-[1.04] text-[var(--ink)] sm:text-5xl lg:text-6xl">
              Review Your Apprenticeship Opportunity
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-[var(--muted)]">
              Turn your organisation&apos;s context, challenges and workforce priorities into a practical diagnostic review.
            </p>
            <div className="mt-9">
              <Link
                href="/members/strategy-builder"
                className="button-pill button-pill--emerald"
              >
                Start Opportunity Review
                <span aria-hidden>{"->"}</span>
              </Link>
            </div>
          </div>

          <div className="rounded-[28px] border border-[rgba(12,48,42,0.12)] bg-white/55 p-6 shadow-[0_24px_70px_rgba(12,48,42,0.08)] sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--teal)]">
              Opportunity workspace
            </p>
            <div className="mt-6 grid gap-4">
              {dashboardCards.map((card) => (
                <div
                  key={card.title}
                  className="rounded-2xl border border-[rgba(12,48,42,0.1)] bg-[var(--cream)]/80 p-5"
                >
                  <div className="flex gap-4">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--emerald)] text-[var(--cream)]">
                      <span className="h-2 w-2 rounded-full bg-[var(--cream)]" aria-hidden />
                    </span>
                    <div>
                      <h2 className="text-base font-semibold text-[var(--ink)]">{card.title}</h2>
                      <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{card.description}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
