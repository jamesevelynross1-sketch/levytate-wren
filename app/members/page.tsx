import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Members Dashboard | MPR Consulting",
  description:
    "Access member tools from MPR Consulting, including the AI Apprenticeship Strategy Builder.",
};

const dashboardCards = [
  {
    title: "Guided strategy inputs",
    description:
      "Capture organisation context, priorities, funding confidence and provider confidence before AI generation begins.",
  },
  {
    title: "Scorecard-aware context",
    description:
      "Use available Opportunity Scorecard signals to shape the draft around real apprenticeship readiness and blind spots.",
  },
  {
    title: "Board-friendly outputs",
    description:
      "Generate, refine, save and export a practical apprenticeship strategy brief for internal review.",
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
              Build Your Apprenticeship Strategy
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-[var(--muted)]">
              Turn your organisation&apos;s priorities, scorecard results and workforce challenges into a practical apprenticeship strategy draft.
            </p>
            <div className="mt-9">
              <Link
                href="/members/strategy-builder"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-[var(--emerald)] px-6 py-3 text-sm font-semibold text-[var(--cream)] shadow-[0_18px_42px_rgba(12,48,42,0.16)] transition hover:-translate-y-0.5 hover:bg-[var(--emerald-2)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--teal)]"
              >
                Start Strategy Builder
                <span aria-hidden>{"->"}</span>
              </Link>
            </div>
          </div>

          <div className="rounded-[28px] border border-[rgba(12,48,42,0.12)] bg-white/55 p-6 shadow-[0_24px_70px_rgba(12,48,42,0.08)] sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--teal)]">
              Strategy workspace
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
