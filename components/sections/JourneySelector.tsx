"use client";

import { useMemo, useState } from "react";

const journeys = [
  {
    label: "Better use of apprenticeship funding",
    href: "/scorecard",
    copy: "Review opportunity, funding position and next steps.",
  },
  {
    label: "Choose the right training provider",
    href: "/services",
    copy: "Compare options through an employer-first lens.",
  },
  {
    label: "Build an apprenticeship strategy",
    href: "/members/strategy-builder",
    copy: "Turn priorities into a structured strategy draft.",
  },
  {
    label: "Develop AI, Automation & Data capability",
    href: "/members/strategy-builder?focus=ai",
    copy: "Explore funded pathways for modern workforce capability.",
  },
  {
    label: "Develop leaders and managers",
    href: "/members/strategy-builder?focus=leadership",
    copy: "Shape practical leadership capability around business need.",
  },
  {
    label: "I'm not sure where to start",
    href: "/scorecard",
    copy: "Start with a guided opportunity review.",
  },
];

export function JourneySelector() {
  const [selected, setSelected] = useState(journeys[0].label);
  const selectedJourney = useMemo(
    () => journeys.find((journey) => journey.label === selected) ?? journeys[0],
    [selected],
  );

  return (
    <section className="container-px bg-cream">
      <div className="mx-auto max-w-7xl border-b border-ink/10 py-14 md:py-16 lg:py-20">
        <div className="grid gap-8 lg:grid-cols-[0.72fr_1.28fr] lg:items-end">
          <div>
            <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.22em] text-teal">
              Guided next step
            </p>
            <h2 className="display-heading text-4xl leading-[1.06] text-ink md:text-5xl">
              What are you looking to achieve?
            </h2>
          </div>
          <p className="max-w-2xl text-[16px] leading-8 text-ink/66 lg:justify-self-end">
            Choose the option that best matches your current priority and
            we&apos;ll guide you to the most relevant next step.
          </p>
        </div>

        <div className="mt-9 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {journeys.map((journey) => {
            const isSelected = selected === journey.label;

            return (
              <button
                key={journey.label}
                type="button"
                onClick={() => setSelected(journey.label)}
                aria-pressed={isSelected}
                className={`min-h-[148px] rounded-2xl border p-5 text-left transition duration-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-teal ${
                  isSelected
                    ? "border-teal/45 bg-white/70 shadow-[0_18px_50px_rgba(12,48,42,0.08)]"
                    : "border-ink/10 bg-white/34 hover:-translate-y-0.5 hover:border-teal/25 hover:bg-white/55"
                }`}
              >
                <span className="flex items-start justify-between gap-4">
                  <span className="text-[15px] font-semibold leading-6 text-ink">
                    {journey.label}
                  </span>
                  <span
                    className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                      isSelected ? "border-teal bg-teal" : "border-ink/18"
                    }`}
                    aria-hidden="true"
                  >
                    {isSelected && <span className="h-1.5 w-1.5 rounded-full bg-cream" />}
                  </span>
                </span>
                <span className="mt-4 block text-sm leading-6 text-ink/62">
                  {journey.copy}
                </span>
              </button>
            );
          })}
        </div>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm leading-6 text-ink/58">
            Selected: <span className="font-semibold text-ink">{selectedJourney.label}</span>
          </p>
          <a
            href={selectedJourney.href}
            className="button-pill button-pill--primary"
          >
            Continue →
          </a>
        </div>
      </div>
    </section>
  );
}
