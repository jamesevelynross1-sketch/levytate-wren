"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import type {
  ScorecardContext,
  StrategyBuilderContext,
  StrategyGeneratePayload,
  StrategyRefinePayload,
} from "@/lib/strategy-builder";

const priorityOptions = [
  "Leadership & Management",
  "AI, Data & Automation",
  "Procurement",
  "Operations",
  "Customer Service",
  "Digital Skills",
  "Early Careers",
  "Retention & Progression",
  "Compliance / Professional Development",
  "Other",
];

const challengeOptions = [
  "Reducing commercial training spend",
  "Leadership capability",
  "AI adoption",
  "Retention",
  "Future skills",
  "Funding clarity",
  "Provider selection",
  "Other",
];

const confidenceOptions = ["High", "Moderate", "Low", "Unsure"];

const refinementPrompts = [
  "Add more focus on leadership development.",
  "Make this suitable for a Finance Director.",
  "Include AI capability priorities.",
  "Make recommendations more practical.",
  "Reduce procurement focus.",
  "Shorten for executive review.",
];

const initialContext: StrategyBuilderContext = {
  organisationName: "",
  industry: "",
  employeeNumbers: "",
  userRole: "",
  existingActivity: "",
  strategicPriorities: ["AI, Data & Automation"],
  fundingConfidence: "Unsure",
  providerConfidence: "Unsure",
  strategicChallenge: "Funding clarity",
};

type SavedStrategy = {
  id: string;
  userId: string;
  organisation: string;
  strategyContent: string;
  createdAt: string;
  updatedAt: string;
  scorecardContext: ScorecardContext | null;
  context: StrategyBuilderContext;
};

function normaliseScorecard(value: unknown): ScorecardContext | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  const score = typeof candidate.score === "number" ? candidate.score : undefined;
  const position = typeof candidate.position === "string" ? candidate.position : undefined;
  const blindSpots = Array.isArray(candidate.blindSpots)
    ? candidate.blindSpots.filter((item): item is string => typeof item === "string")
    : undefined;
  const selectedPriorities = Array.isArray(candidate.selectedPriorities)
    ? candidate.selectedPriorities.filter((item): item is string => typeof item === "string")
    : Array.isArray(candidate.priorities)
      ? candidate.priorities.filter((item): item is string => typeof item === "string")
      : undefined;

  if (!score && !position && !blindSpots?.length && !selectedPriorities?.length) {
    return null;
  }

  return { score, position, blindSpots, selectedPriorities };
}

function getOrCreateUserId() {
  const key = "mpr.strategyBuilder.userId";
  const existing = window.localStorage.getItem(key);

  if (existing) {
    return existing;
  }

  const nextId =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `local-${Date.now()}`;

  window.localStorage.setItem(key, nextId);
  return nextId;
}

function downloadMarkdown(strategy: string, organisation: string) {
  const safeOrganisation = organisation.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-") || "strategy";
  const blob = new Blob([strategy], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${safeOrganisation}-apprenticeship-strategy.md`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export default function StrategyBuilderClient() {
  const [step, setStep] = useState(1);
  const [context, setContext] = useState<StrategyBuilderContext>(initialContext);
  const [scorecardContext, setScorecardContext] = useState<ScorecardContext | null>(null);
  const [scorecardStatus, setScorecardStatus] = useState("Checking for Opportunity Scorecard context...");
  const [strategy, setStrategy] = useState("");
  const [instruction, setInstruction] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRefining, setIsRefining] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const canGenerate = context.organisationName.trim().length > 1 && context.industry.trim().length > 1;

  useEffect(() => {
    const keys = ["mpr.scorecard.latest", "mpr.scorecardResults", "mpr.opportunityScorecard"];

    for (const key of keys) {
      const raw = window.localStorage.getItem(key);
      if (!raw) {
        continue;
      }

      try {
        const parsed = JSON.parse(raw);
        const normalised = normaliseScorecard(parsed);

        if (normalised) {
          setScorecardContext(normalised);
          setScorecardStatus("Opportunity Scorecard context found and ready to use.");
          return;
        }
      } catch {
        continue;
      }
    }

    setScorecardStatus("No completed scorecard context found. You can continue without it.");
  }, []);

  const completion = useMemo(() => {
    const fields = [
      context.organisationName,
      context.industry,
      context.employeeNumbers,
      context.userRole,
      context.existingActivity,
      context.strategicChallenge,
    ];
    const filled = fields.filter(Boolean).length + (context.strategicPriorities.length ? 1 : 0);

    return Math.round((filled / 7) * 100);
  }, [context]);

  const updateField = (field: keyof StrategyBuilderContext, value: string) => {
    setContext((current) => ({ ...current, [field]: value }));
  };

  const togglePriority = (priority: string) => {
    setContext((current) => {
      const exists = current.strategicPriorities.includes(priority);
      const next = exists
        ? current.strategicPriorities.filter((item) => item !== priority)
        : [...current.strategicPriorities, priority];

      return { ...current, strategicPriorities: next };
    });
  };

  const generateStrategy = async () => {
    if (!canGenerate) {
      setErrorMessage("Add at least an organisation name and industry before generating the strategy.");
      return;
    }

    setErrorMessage("");
    setStatusMessage("");
    setIsGenerating(true);

    const payload: StrategyGeneratePayload = { context, scorecardContext };

    try {
      const response = await fetch("/api/strategy-builder/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await response.json()) as { strategy?: string; error?: string };

      if (!response.ok || !data.strategy) {
        throw new Error(data.error || "Strategy generation failed.");
      }

      setStrategy(data.strategy);
      setStep(3);
      setStatusMessage("Strategy draft generated. You can refine, save or export it.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Strategy generation failed.");
    } finally {
      setIsGenerating(false);
    }
  };

  const refineStrategy = async (nextInstruction = instruction) => {
    if (!strategy || !nextInstruction.trim()) {
      return;
    }

    setErrorMessage("");
    setStatusMessage("");
    setIsRefining(true);

    const payload: StrategyRefinePayload = {
      context,
      scorecardContext,
      currentStrategy: strategy,
      instruction: nextInstruction,
    };

    try {
      const response = await fetch("/api/strategy-builder/refine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await response.json()) as { strategy?: string; error?: string };

      if (!response.ok || !data.strategy) {
        throw new Error(data.error || "Strategy refinement failed.");
      }

      setStrategy(data.strategy);
      setInstruction("");
      setStatusMessage("Strategy refined using your instruction.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Strategy refinement failed.");
    } finally {
      setIsRefining(false);
    }
  };

  const saveStrategy = () => {
    if (!strategy) {
      return;
    }

    const now = new Date().toISOString();
    const saved: SavedStrategy = {
      id:
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `strategy-${Date.now()}`,
      userId: getOrCreateUserId(),
      organisation: context.organisationName,
      strategyContent: strategy,
      createdAt: now,
      updatedAt: now,
      scorecardContext,
      context,
    };

    const existingRaw = window.localStorage.getItem("mpr.strategyBuilder.savedStrategies");
    const existing = existingRaw ? (JSON.parse(existingRaw) as SavedStrategy[]) : [];
    const next = [saved, ...existing].slice(0, 10);

    window.localStorage.setItem("mpr.strategyBuilder.savedStrategies", JSON.stringify(next));
    window.localStorage.setItem("mpr.strategyBuilder.latestStrategy", JSON.stringify(saved));
    setStatusMessage("Strategy saved in this browser.");
  };

  const copyStrategy = async () => {
    if (!strategy) {
      return;
    }

    await navigator.clipboard.writeText(strategy);
    setStatusMessage("Strategy copied to clipboard.");
  };

  return (
    <main className="bg-[var(--cream)] text-[var(--ink)]">
      <section className="container-px mx-auto max-w-7xl py-16 sm:py-20 lg:py-24">
        <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-end">
          <div>
            <Link
              href="/members"
              className="mb-6 inline-flex text-sm font-semibold text-[var(--teal)] transition hover:text-[var(--emerald)]"
            >
              Members dashboard
            </Link>
            <p className="mb-5 text-xs font-semibold uppercase tracking-[0.28em] text-[var(--teal)]">
              AI Apprenticeship Strategy Builder
            </p>
            <h1 className="display-heading text-balance text-4xl font-semibold leading-[1.04] text-[var(--ink)] sm:text-5xl lg:text-[4rem]">
              Build a practical apprenticeship strategy draft.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-[var(--muted)]">
              Start with guided inputs, add scorecard context where available, then use AI refinement to shape a board-friendly strategy brief.
            </p>
          </div>

          <div className="rounded-[28px] border border-[rgba(12,48,42,0.12)] bg-white/55 p-6 shadow-[0_24px_70px_rgba(12,48,42,0.08)]">
            <div className="flex items-center justify-between gap-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--teal)]">
                  Completion
                </p>
                <p className="mt-2 text-3xl font-semibold text-[var(--ink)]">{completion}%</p>
              </div>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-[rgba(12,48,42,0.08)]">
                <div
                  className="h-full rounded-full bg-[var(--teal)] transition-all"
                  style={{ width: `${completion}%` }}
                />
              </div>
            </div>
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              {["Context", "Scorecard", "Strategy"].map((label, index) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => setStep(index + 1)}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                    step === index + 1
                      ? "bg-[var(--emerald)] text-[var(--cream)]"
                      : "bg-[var(--cream)] text-[var(--muted)] hover:text-[var(--ink)]"
                  }`}
                >
                  {index + 1}. {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="container-px mx-auto max-w-7xl pb-20 lg:pb-28">
        <div className="grid gap-8 lg:grid-cols-[0.72fr_0.28fr]">
          <div className="rounded-[32px] border border-[rgba(12,48,42,0.12)] bg-white/60 p-6 shadow-[0_28px_80px_rgba(12,48,42,0.08)] sm:p-8 lg:p-10">
            {step === 1 && (
              <div>
                <div className="mb-8 flex items-start justify-between gap-6">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--teal)]">
                      Step 1
                    </p>
                    <h2 className="mt-3 text-2xl font-semibold text-[var(--ink)]">Organisation context</h2>
                    <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)]">
                      Capture the essentials before AI generation begins. Short, practical answers are enough.
                    </p>
                  </div>
                </div>

                <div className="grid gap-5 md:grid-cols-2">
                  <Field label="Organisation name">
                    <input
                      value={context.organisationName}
                      onChange={(event) => updateField("organisationName", event.target.value)}
                      className="input-field"
                      placeholder="Example Ltd"
                    />
                  </Field>
                  <Field label="Industry">
                    <input
                      value={context.industry}
                      onChange={(event) => updateField("industry", event.target.value)}
                      className="input-field"
                      placeholder="Facilities, retail, public sector..."
                    />
                  </Field>
                  <Field label="Approximate employee numbers">
                    <input
                      value={context.employeeNumbers}
                      onChange={(event) => updateField("employeeNumbers", event.target.value)}
                      className="input-field"
                      placeholder="250, 1,200, 5,000..."
                    />
                  </Field>
                  <Field label="Your role">
                    <input
                      value={context.userRole}
                      onChange={(event) => updateField("userRole", event.target.value)}
                      className="input-field"
                      placeholder="HR Director, L&D Lead, Finance..."
                    />
                  </Field>
                </div>

                <div className="mt-5 grid gap-5 md:grid-cols-2">
                  <Field label="Existing apprenticeship activity">
                    <select
                      value={context.existingActivity}
                      onChange={(event) => updateField("existingActivity", event.target.value)}
                      className="input-field"
                    >
                      <option value="">Select current position</option>
                      <option>None currently</option>
                      <option>Small number of apprentices</option>
                      <option>Established activity, limited strategy</option>
                      <option>Established strategic programme</option>
                    </select>
                  </Field>
                  <Field label="Strategic challenge">
                    <select
                      value={context.strategicChallenge}
                      onChange={(event) => updateField("strategicChallenge", event.target.value)}
                      className="input-field"
                    >
                      {challengeOptions.map((option) => (
                        <option key={option}>{option}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Funding confidence">
                    <select
                      value={context.fundingConfidence}
                      onChange={(event) => updateField("fundingConfidence", event.target.value)}
                      className="input-field"
                    >
                      {confidenceOptions.map((option) => (
                        <option key={option}>{option}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Provider confidence">
                    <select
                      value={context.providerConfidence}
                      onChange={(event) => updateField("providerConfidence", event.target.value)}
                      className="input-field"
                    >
                      {confidenceOptions.map((option) => (
                        <option key={option}>{option}</option>
                      ))}
                    </select>
                  </Field>
                </div>

                <div className="mt-8">
                  <p className="text-sm font-semibold text-[var(--ink)]">Strategic priorities</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {priorityOptions.map((priority) => {
                      const selected = context.strategicPriorities.includes(priority);
                      return (
                        <button
                          key={priority}
                          type="button"
                          onClick={() => togglePriority(priority)}
                          className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                            selected
                              ? "border-[var(--emerald)] bg-[var(--emerald)] text-[var(--cream)]"
                              : "border-[rgba(12,48,42,0.14)] bg-[var(--cream)] text-[var(--muted)] hover:border-[var(--teal)] hover:text-[var(--ink)]"
                          }`}
                        >
                          {priority}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="mt-10 flex flex-col gap-3 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-[var(--emerald)] px-6 py-3 text-sm font-semibold text-[var(--cream)] transition hover:-translate-y-0.5 hover:bg-[var(--emerald-2)]"
                  >
                    Continue to scorecard context
                    <span aria-hidden>{"->"}</span>
                  </button>
                </div>
              </div>
            )}

            {step === 2 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--teal)]">
                  Step 2
                </p>
                <h2 className="mt-3 text-2xl font-semibold text-[var(--ink)]">Scorecard integration</h2>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)]">
                  If an Opportunity Scorecard has been completed in this browser, the builder will use its score, position, blind spots and priorities as additional strategy context.
                </p>

                <div className="mt-8 rounded-3xl border border-[rgba(12,48,42,0.12)] bg-[var(--cream)] p-6">
                  <div className="flex items-start gap-4">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--emerald)] text-[var(--cream)]">
                      {scorecardContext ? <span aria-hidden>OK</span> : <span className="h-2 w-2 rounded-full bg-[var(--cream)]" aria-hidden />}
                    </span>
                    <div>
                      <h3 className="text-lg font-semibold text-[var(--ink)]">{scorecardStatus}</h3>
                      {scorecardContext ? (
                        <div className="mt-5 grid gap-4 sm:grid-cols-2">
                          <Metric label="Score" value={scorecardContext.score ? `${scorecardContext.score}/100` : "Available"} />
                          <Metric label="Position" value={scorecardContext.position || "Available"} />
                          <Metric
                            label="Blind spots"
                            value={scorecardContext.blindSpots?.length ? `${scorecardContext.blindSpots.length} identified` : "None stored"}
                          />
                          <Metric
                            label="Priorities"
                            value={scorecardContext.selectedPriorities?.length ? `${scorecardContext.selectedPriorities.length} selected` : "None stored"}
                          />
                        </div>
                      ) : (
                        <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
                          This will not block generation. The brief will be built from the organisation context you provide.
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-10 flex flex-col gap-3 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="rounded-full border border-[rgba(12,48,42,0.18)] px-6 py-3 text-sm font-semibold text-[var(--ink)] transition hover:border-[var(--teal)]"
                  >
                    Back to context
                  </button>
                  <button
                    type="button"
                    onClick={generateStrategy}
                    disabled={isGenerating}
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-[var(--emerald)] px-6 py-3 text-sm font-semibold text-[var(--cream)] transition hover:-translate-y-0.5 hover:bg-[var(--emerald-2)] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isGenerating ? "Generating..." : "Generate strategy brief"}
                  </button>
                </div>
              </div>
            )}

            {step === 3 && (
              <div>
                <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--teal)]">
                      Step 3
                    </p>
                    <h2 className="mt-3 text-2xl font-semibold text-[var(--ink)]">Apprenticeship strategy brief</h2>
                    <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)]">
                      Refine the draft conversationally, then save or export it for internal discussion.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <ActionButton onClick={saveStrategy} disabled={!strategy}>
                      Save
                    </ActionButton>
                    <ActionButton onClick={copyStrategy} disabled={!strategy}>
                      Copy
                    </ActionButton>
                    <ActionButton onClick={() => downloadMarkdown(strategy, context.organisationName)} disabled={!strategy}>
                      Markdown
                    </ActionButton>
                    <ActionButton onClick={() => window.print()} disabled={!strategy}>
                      PDF
                    </ActionButton>
                  </div>
                </div>

                <article className="mt-8 rounded-3xl border border-[rgba(12,48,42,0.12)] bg-[var(--cream)] p-6 shadow-[0_18px_50px_rgba(12,48,42,0.06)] sm:p-8 print:border-0 print:bg-white print:shadow-none">
                  {strategy ? (
                    <div className="whitespace-pre-wrap text-[15px] leading-7 text-[var(--ink)]">{strategy}</div>
                  ) : (
                    <div className="py-12 text-center text-sm text-[var(--muted)]">
                      Generate the first draft to begin refining the strategy.
                    </div>
                  )}
                </article>

                {strategy && (
                  <div className="mt-8 grid gap-6 lg:grid-cols-[0.62fr_0.38fr] print:hidden">
                    <div className="rounded-3xl border border-[rgba(12,48,42,0.12)] bg-white/60 p-6">
                      <h3 className="text-lg font-semibold text-[var(--ink)]">Refine the strategy</h3>
                      <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                        Give a focused instruction. The AI will edit the existing draft rather than starting again.
                      </p>
                      <textarea
                        value={instruction}
                        onChange={(event) => setInstruction(event.target.value)}
                        rows={4}
                        className="input-field mt-5 resize-none"
                        placeholder="Example: Make the recommendations more practical for an Operations Director."
                      />
                      <button
                        type="button"
                        onClick={() => refineStrategy()}
                        disabled={isRefining || !instruction.trim()}
                        className="mt-4 inline-flex items-center justify-center gap-2 rounded-full bg-[var(--emerald)] px-6 py-3 text-sm font-semibold text-[var(--cream)] transition hover:-translate-y-0.5 hover:bg-[var(--emerald-2)] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {isRefining ? "Refining..." : "Refine draft"}
                      </button>
                    </div>
                    <div className="rounded-3xl border border-[rgba(12,48,42,0.12)] bg-[var(--emerald)] p-6 text-[var(--cream)]">
                      <h3 className="text-lg font-semibold">Suggested refinements</h3>
                      <div className="mt-4 grid gap-2">
                        {refinementPrompts.map((prompt) => (
                          <button
                            key={prompt}
                            type="button"
                            onClick={() => refineStrategy(prompt)}
                            disabled={isRefining}
                            className="rounded-2xl border border-[rgba(245,239,228,0.16)] bg-[rgba(245,239,228,0.08)] px-4 py-3 text-left text-sm leading-5 transition hover:bg-[rgba(245,239,228,0.14)] disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {prompt}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {errorMessage && (
              <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-medium text-red-700">
                {errorMessage}
              </div>
            )}
            {statusMessage && (
              <div className="mt-6 rounded-2xl border border-[rgba(52,116,103,0.18)] bg-[rgba(52,116,103,0.08)] px-5 py-4 text-sm font-medium text-[var(--emerald)]">
                {statusMessage}
              </div>
            )}
          </div>

          <aside className="space-y-5 print:hidden">
            <div className="rounded-[28px] border border-[rgba(12,48,42,0.12)] bg-[var(--emerald)] p-6 text-[var(--cream)] shadow-[0_24px_70px_rgba(12,48,42,0.12)]">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[rgba(245,239,228,0.7)]">
                Output structure
              </p>
              <ul className="mt-5 space-y-3 text-sm leading-6 text-[rgba(245,239,228,0.82)]">
                <li>Executive Summary</li>
                <li>Current Position</li>
                <li>Strategic Opportunities</li>
                <li>Priority Capability Areas</li>
                <li>Funding & Levy Considerations</li>
                <li>Provider Considerations</li>
                <li>30 / 60 / 90 Day Actions</li>
              </ul>
            </div>

            <div className="rounded-[28px] border border-[rgba(12,48,42,0.12)] bg-white/60 p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--teal)]">
                Advisory support
              </p>
              <h3 className="mt-3 text-xl font-semibold text-[var(--ink)]">
                Need help turning this into a live strategy?
              </h3>
              <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
                MPR Consulting can help validate the roadmap, assess providers and connect funded development to workforce priorities.
              </p>
              <Link
                href="mailto:james@mprconsulting.co.uk?subject=Strategy%20Builder%20conversation"
                className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-[var(--emerald)] transition hover:text-[var(--teal)]"
              >
                Book a Strategy Conversation
                <span aria-hidden>{"->"}</span>
              </Link>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-[var(--ink)]">{label}</span>
      {children}
    </label>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[rgba(12,48,42,0.1)] bg-white/65 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--teal)]">{label}</p>
      <p className="mt-2 text-base font-semibold text-[var(--ink)]">{value}</p>
    </div>
  );
}

function ActionButton({
  children,
  disabled,
  onClick,
}: {
  children: ReactNode;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center justify-center gap-2 rounded-full border border-[rgba(12,48,42,0.14)] bg-[var(--cream)] px-4 py-2 text-sm font-semibold text-[var(--ink)] transition hover:border-[var(--teal)] disabled:cursor-not-allowed disabled:opacity-50"
    >
      {children}
    </button>
  );
}
