"use client";

import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";

type ReviewContext = {
  organisationName: string;
  sector: string;
  employeeNumbers: string;
  levyStatus: string;
  currentActivity: string;
  challenges: string[];
  priorities: string[];
};

type OpportunityReview = {
  currentPosition: string[];
  immediateOpportunities: string[];
  actions30: string[];
  actions60: string[];
  actions90: string[];
  supportServices: Array<{
    title: string;
    description: string;
  }>;
  nextConversation: string;
};

type SubmitForm = {
  name: string;
  organisation: string;
  email: string;
  telephone: string;
  consent: boolean;
};

const initialContext: ReviewContext = {
  organisationName: "",
  sector: "",
  employeeNumbers: "",
  levyStatus: "",
  currentActivity: "",
  challenges: [],
  priorities: [],
};

const initialSubmitForm: SubmitForm = {
  name: "",
  organisation: "",
  email: "",
  telephone: "",
  consent: false,
};

const employeeNumberOptions = ["1-49", "50-249", "250-999", "1000+"];
const levyOptions = ["Yes", "No", "Unsure"];
const activityOptions = ["None", "Small-scale activity", "Moderate activity", "Significant activity"];

const challengeOptions = [
  "Unsure how to utilise apprenticeship funding",
  "Low apprenticeship engagement",
  "Finding the right training provider",
  "Leadership and management capability",
  "AI, Data or Digital skills gaps",
  "Recruitment challenges",
  "Retention challenges",
  "Succession planning",
  "Workforce growth",
  "Unsure where to start",
];

const priorityOptions = [
  "Improve productivity",
  "Develop future leaders",
  "Build management capability",
  "Increase digital capability",
  "Support business growth",
  "Improve staff retention",
  "Create progression pathways",
  "Maximise apprenticeship investment",
  "Strengthen recruitment pipelines",
  "Future-proof workforce skills",
];

const supportCatalogue = [
  {
    title: "Apprenticeship Health Check",
    description: "Review current activity, funding position, decision making and immediate improvement opportunities.",
    keywords: ["funding", "engagement", "start", "investment", "activity"],
  },
  {
    title: "Provider Selection & Vetting",
    description: "Compare provider options against delivery model, quality, learner support and employer fit.",
    keywords: ["provider", "training provider"],
  },
  {
    title: "Levy Transfer Guidance",
    description: "Clarify levy position, unused funding, transfer routes and practical funding opportunities.",
    keywords: ["funding", "levy", "investment"],
  },
  {
    title: "Apprenticeship Strategy Support",
    description: "Turn priorities into a structured roadmap with roles, pathways, owners and decision criteria.",
    keywords: ["start", "growth", "productivity", "future-proof", "retention"],
  },
  {
    title: "Workforce Capability Planning",
    description: "Map role needs, skills gaps and workforce priorities to funded development pathways.",
    keywords: ["workforce", "skills", "progression", "succession", "capability"],
  },
  {
    title: "Leadership Development Pathways",
    description: "Identify targeted development routes for managers, future leaders and operational leadership capability.",
    keywords: ["leadership", "management", "future leaders"],
  },
  {
    title: "AI, Data & Digital Apprenticeships",
    description: "Explore funded routes that support digital confidence, data capability and AI adoption.",
    keywords: ["ai", "data", "digital"],
  },
];

function toggleLimitedSelection(items: string[], value: string, limit = 3) {
  if (items.includes(value)) {
    return items.filter((item) => item !== value);
  }

  return items.length >= limit ? items : [...items, value];
}

function includesAny(values: string[], keywords: string[]) {
  const joined = values.join(" ").toLowerCase();
  return keywords.some((keyword) => joined.includes(keyword.toLowerCase()));
}

function buildOpportunityReview(context: ReviewContext): OpportunityReview {
  const organisation = context.organisationName.trim() || "your organisation";
  const hasActivity = context.currentActivity && context.currentActivity !== "None";
  const isLevyPayer = context.levyStatus === "Yes";
  const selectedSignals = [...context.challenges, ...context.priorities];
  const challengePhrase = context.challenges.length
    ? context.challenges.join(", ").toLowerCase()
    : "where apprenticeships could create the most value";
  const priorityPhrase = context.priorities.length
    ? context.priorities.join(", ").toLowerCase()
    : "your wider workforce priorities";

  const currentPosition = [
    `Based on the information provided, apprenticeships appear to be a practical opportunity for ${organisation}. ${context.employeeNumbers ? `With ${context.employeeNumbers} employees` : "At your current scale"}, the useful starting point is to understand where funded development can support real workforce needs rather than treating apprenticeships as a separate HR activity.`,
    hasActivity
      ? `There is already some apprenticeship activity to build from. The next step is to test whether that activity is closely linked to priorities such as ${priorityPhrase}, and whether providers, funding and internal ownership are working well enough to support the organisation's plans.`
      : `There does not appear to be significant current activity, which can be a useful moment to design the approach properly from the start. The priority is to avoid selecting programmes too early and first clarify the roles, skills and business outcomes apprenticeships need to support.`,
    isLevyPayer
      ? `As a levy-paying employer, there may be immediate value in reviewing how funding is being used, where spend could be redirected and whether apprenticeship routes are being considered before commercial training is purchased.`
      : context.levyStatus === "Unsure"
        ? "The funding position should be clarified early. Understanding whether levy, co-investment or transfer options apply will make the next decisions more practical and commercially grounded."
        : "Even where levy funding is not available, co-investment or levy transfer routes may still make apprenticeships relevant if they solve a clear workforce problem.",
  ];

  const opportunityPool = [
    {
      text: "Review whether current or planned apprenticeship activity is aligned to the organisation's most important workforce priorities.",
      keywords: ["activity", "productivity", "growth", "retention", "future-proof", "progression"],
    },
    {
      text: "Clarify the funding position so apprenticeship decisions are made with a clear view of levy, co-investment or transfer options.",
      keywords: ["funding", "levy", "investment", "start"],
    },
    {
      text: "Assess provider options before committing to new programmes, with a focus on delivery model, quality, learner support and employer fit.",
      keywords: ["provider", "training provider"],
    },
    {
      text: "Identify priority roles where apprenticeships could support leadership, management or future leader development.",
      keywords: ["leadership", "management", "future leaders", "succession"],
    },
    {
      text: "Explore AI, data and digital apprenticeship routes where they could support productivity, confidence and future skills.",
      keywords: ["ai", "data", "digital", "future-proof", "productivity"],
    },
    {
      text: "Use apprenticeships to support recruitment, retention and progression pathways where workforce movement is creating pressure.",
      keywords: ["recruitment", "retention", "progression", "growth"],
    },
  ];

  const immediateOpportunities = [
    ...opportunityPool.filter((opportunity) => includesAny(selectedSignals, opportunity.keywords)).map((opportunity) => opportunity.text),
    ...opportunityPool.map((opportunity) => opportunity.text),
  ].filter((item, index, all) => all.indexOf(item) === index).slice(0, 3);

  const actions30 = [
    "Complete a focused apprenticeship health check covering funding, current activity, provider position and internal ownership.",
    "Agree the three to five priority roles or departments where apprenticeships could support development, retention or future skills.",
    "Bring HR, L&D, Finance and operational stakeholders together to confirm the business problems apprenticeships need to solve.",
  ];

  const actions60 = [
    "Map relevant apprenticeship standards to the priority workforce requirements identified in the health check.",
    context.challenges.includes("Finding the right training provider")
      ? "Compare provider options against employer fit, quality, delivery model and learner support."
      : "Review whether any current or potential providers can meet the organisation's delivery and reporting requirements.",
    "Evaluate funding routes and confirm where apprenticeship investment could replace or strengthen existing training activity.",
  ];

  const actions90 = [
    "Develop a practical implementation roadmap with owners, timelines, target cohorts and decision criteria.",
    hasActivity
      ? "Refine existing apprenticeship activity around the strongest priority areas before expanding further."
      : "Launch a small pilot where there is clear role fit, manager support and a defined business outcome.",
    "Establish simple success measures covering engagement, progression, provider performance and operational value.",
  ];

  const supportServices = supportCatalogue
    .filter((service) => includesAny(selectedSignals, service.keywords))
    .slice(0, 4);

  const services = supportServices.length
    ? supportServices
    : supportCatalogue.slice(0, 4);

  return {
    currentPosition,
    immediateOpportunities,
    actions30,
    actions60,
    actions90,
    supportServices: services,
    nextConversation: `Based on the information provided, a useful next step would be a short conversation to review ${challengePhrase}, your funding position and the workforce priorities behind ${priorityPhrase}. This would help identify where apprenticeships could deliver the greatest practical value and where further advisory support may be useful.`,
  };
}

function reviewToText(review: OpportunityReview) {
  return [
    "Apprenticeship Opportunity Review",
    "",
    "Your Current Position",
    ...review.currentPosition,
    "",
    "Immediate Opportunities",
    ...review.immediateOpportunities.map((item, index) => `${index + 1}. ${item}`),
    "",
    "Recommended Actions",
    "30-Day Actions",
    ...review.actions30.map((item, index) => `${index + 1}. ${item}`),
    "60-Day Actions",
    ...review.actions60.map((item, index) => `${index + 1}. ${item}`),
    "90-Day Actions",
    ...review.actions90.map((item, index) => `${index + 1}. ${item}`),
    "",
    "How MPR Consulting Can Support",
    ...review.supportServices.map((service, index) => `${index + 1}. ${service.title}: ${service.description}`),
    "",
    "Suggested Next Conversation",
    review.nextConversation,
  ].join("\n");
}

function getOrCreateUserId() {
  const key = "mpr.opportunityReview.userId";
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

function downloadReview(reviewText: string, organisation: string) {
  const safeOrganisation = organisation.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-") || "opportunity-review";
  const blob = new Blob([reviewText], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${safeOrganisation}-apprenticeship-opportunity-review.txt`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export default function StrategyBuilderClient() {
  const [step, setStep] = useState(1);
  const [context, setContext] = useState<ReviewContext>(initialContext);
  const [review, setReview] = useState<OpportunityReview | null>(null);
  const [showSubmitForm, setShowSubmitForm] = useState(false);
  const [submitForm, setSubmitForm] = useState<SubmitForm>(initialSubmitForm);
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [reviewSubmitted, setReviewSubmitted] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const completion = useMemo(() => {
    const detailFields = [
      context.organisationName,
      context.sector,
      context.employeeNumbers,
      context.levyStatus,
      context.currentActivity,
    ].filter(Boolean).length;
    const challengeProgress = context.challenges.length ? 1 : 0;
    const priorityProgress = context.priorities.length ? 1 : 0;

    return Math.round(((detailFields + challengeProgress + priorityProgress) / 7) * 100);
  }, [context]);

  const reviewText = useMemo(() => (review ? reviewToText(review) : ""), [review]);
  const canContinueFromDetails = Boolean(
    context.organisationName.trim() &&
      context.sector.trim() &&
      context.employeeNumbers &&
      context.levyStatus &&
      context.currentActivity,
  );
  const canGenerate = canContinueFromDetails && context.challenges.length > 0 && context.priorities.length > 0;

  const updateField = (field: keyof ReviewContext, value: string) => {
    setContext((current) => ({ ...current, [field]: value }));
  };

  const generateReview = () => {
    if (!canGenerate) {
      setErrorMessage("Complete the organisation details, then select at least one challenge and one priority.");
      return;
    }

    const nextReview = buildOpportunityReview(context);
    setReview(nextReview);
    setSubmitForm((current) => ({
      ...current,
      organisation: context.organisationName,
    }));
    setShowSubmitForm(false);
    setReviewSubmitted(false);
    setStep(4);
    setErrorMessage("");
    setStatusMessage("Opportunity Review created. You can save, copy or download it for internal discussion.");
  };

  const saveReview = () => {
    if (!review) {
      return;
    }

    const now = new Date().toISOString();
    const saved = {
      id:
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `review-${Date.now()}`,
      userId: getOrCreateUserId(),
      organisation: context.organisationName,
      reviewContent: reviewText,
      createdAt: now,
      updatedAt: now,
      context,
    };
    const existingRaw = window.localStorage.getItem("mpr.opportunityReview.savedReviews");
    const existing = existingRaw ? (JSON.parse(existingRaw) as Array<typeof saved>) : [];
    const next = [saved, ...existing].slice(0, 10);

    window.localStorage.setItem("mpr.opportunityReview.savedReviews", JSON.stringify(next));
    window.localStorage.setItem("mpr.opportunityReview.latestReview", JSON.stringify(saved));
    setStatusMessage("Opportunity Review saved in this browser.");
  };

  const copyReview = async () => {
    if (!reviewText) {
      return;
    }

    await navigator.clipboard.writeText(reviewText);
    setStatusMessage("Opportunity Review copied to clipboard.");
  };

  const printReview = () => {
    window.print();
  };

  const submitReview = async () => {
    if (!review) {
      return;
    }

    if (!submitForm.name.trim() || !submitForm.organisation.trim() || !submitForm.email.trim() || !submitForm.consent) {
      setErrorMessage("Add your name, organisation, email address and consent before submitting the review.");
      return;
    }

    setErrorMessage("");
    setStatusMessage("");
    setIsSubmittingReview(true);

    try {
      const response = await fetch("/api/opportunity-review/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contact: submitForm,
          organisationDetails: context,
          review,
          reviewText,
          consent: {
            given: submitForm.consent,
            statement:
              "By submitting this review, you agree that MPR Consulting may use the information provided to review your enquiry and contact you regarding relevant apprenticeship and workforce development support.",
            capturedAt: new Date().toISOString(),
          },
        }),
      });
      const data = (await response.json().catch(() => ({}))) as { message?: string };

      if (!response.ok) {
        throw new Error(data.message || "Review submission failed.");
      }

      setReviewSubmitted(true);
      setShowSubmitForm(false);
      setStatusMessage("Review submitted.");
    } catch (error) {
      console.error("Opportunity Review submission failed", error);
      setErrorMessage("We couldn't submit your review at the moment. Please try again or contact us directly.");
    } finally {
      setIsSubmittingReview(false);
    }
  };

  return (
    <main className="bg-[var(--cream)] text-[var(--ink)]">
      <section className="container-px mx-auto max-w-7xl py-16 sm:py-20 lg:py-24">
        <div className="grid gap-10 lg:grid-cols-[0.92fr_1.08fr] lg:items-end">
          <div>
            <Link
              href="/members"
              className="mb-6 inline-flex text-sm font-semibold text-[var(--teal)] transition hover:text-[var(--emerald)]"
            >
              Members dashboard
            </Link>
            <p className="mb-5 text-xs font-semibold uppercase tracking-[0.28em] text-[var(--teal)]">
              Apprenticeship Opportunity Review
            </p>
            <h1 className="display-heading text-balance text-4xl font-semibold leading-[1.04] text-[var(--ink)] sm:text-5xl lg:text-[4rem]">
              Understand your current position and identify practical next steps.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-[var(--muted)]">
              A guided diagnostic for employers who want clearer apprenticeship decisions, immediate opportunities and a practical action plan.
            </p>
          </div>

          <div className="rounded-[28px] border border-[rgba(12,48,42,0.12)] bg-white/55 p-6 shadow-[0_24px_70px_rgba(12,48,42,0.08)]">
            <div className="flex items-center justify-between gap-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--teal)]">
                  Review progress
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
            <div className="mt-6 grid gap-3 sm:grid-cols-4">
              {["Details", "Challenges", "Priorities", "Review"].map((label, index) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => setStep(index + 1)}
                  className={`button-pill min-h-10 px-3 py-2 text-sm ${
                    step === index + 1
                      ? "button-pill--emerald"
                      : ""
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
        <div className={`grid gap-8 ${step === 4 ? "lg:grid-cols-1" : "lg:grid-cols-[0.72fr_0.28fr]"}`}>
          <div className="rounded-[32px] border border-[rgba(12,48,42,0.12)] bg-white/60 p-6 shadow-[0_28px_80px_rgba(12,48,42,0.08)] sm:p-8 lg:p-10">
            {step === 1 && (
              <div>
                <StepHeader
                  label="Step 1"
                  title="Organisation details"
                  description="Start with the essentials. This helps frame the review around your size, funding position and current apprenticeship activity."
                />

                <div className="grid gap-5 md:grid-cols-2">
                  <Field label="Organisation name">
                    <input
                      value={context.organisationName}
                      onChange={(event) => updateField("organisationName", event.target.value)}
                      className="input-field"
                      placeholder="Example Ltd"
                    />
                  </Field>
                  <Field label="Industry / sector">
                    <input
                      value={context.sector}
                      onChange={(event) => updateField("sector", event.target.value)}
                      className="input-field"
                      placeholder="Facilities, retail, public sector..."
                    />
                  </Field>
                  <Field label="Employee numbers">
                    <select
                      value={context.employeeNumbers}
                      onChange={(event) => updateField("employeeNumbers", event.target.value)}
                      className="input-field"
                    >
                      <option value="">Select employee range</option>
                      {employeeNumberOptions.map((option) => (
                        <option key={option}>{option}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Are you a levy-paying organisation?">
                    <select
                      value={context.levyStatus}
                      onChange={(event) => updateField("levyStatus", event.target.value)}
                      className="input-field"
                    >
                      <option value="">Select funding position</option>
                      {levyOptions.map((option) => (
                        <option key={option}>{option}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Current apprenticeship activity">
                    <select
                      value={context.currentActivity}
                      onChange={(event) => updateField("currentActivity", event.target.value)}
                      className="input-field"
                    >
                      <option value="">Select current position</option>
                      {activityOptions.map((option) => (
                        <option key={option}>{option}</option>
                      ))}
                    </select>
                  </Field>
                </div>

                <div className="mt-10">
                  <PrimaryButton onClick={() => (canContinueFromDetails ? setStep(2) : setErrorMessage("Complete the organisation details before continuing."))}>
                    Continue to challenges
                    <span aria-hidden>{"->"}</span>
                  </PrimaryButton>
                </div>
              </div>
            )}

            {step === 2 && (
              <div>
                <StepHeader
                  label="Step 2"
                  title="Current challenges"
                  description="Select up to three apprenticeship or workforce development challenges. Choose the areas that feel most live for the organisation now."
                />

                <SelectionGrid
                  options={challengeOptions}
                  selected={context.challenges}
                  onToggle={(option) =>
                    setContext((current) => ({
                      ...current,
                      challenges: toggleLimitedSelection(current.challenges, option),
                    }))
                  }
                />

                <StepActions>
                  <SecondaryButton onClick={() => setStep(1)}>Back to details</SecondaryButton>
                  <PrimaryButton onClick={() => (context.challenges.length ? setStep(3) : setErrorMessage("Select at least one challenge before continuing."))}>
                    Continue to priorities
                    <span aria-hidden>{"->"}</span>
                  </PrimaryButton>
                </StepActions>
              </div>
            )}

            {step === 3 && (
              <div>
                <StepHeader
                  label="Step 3"
                  title="Business priorities"
                  description="Select up to three priorities for the next 12 to 24 months. The review will use these to shape the opportunities and actions."
                />

                <SelectionGrid
                  options={priorityOptions}
                  selected={context.priorities}
                  onToggle={(option) =>
                    setContext((current) => ({
                      ...current,
                      priorities: toggleLimitedSelection(current.priorities, option),
                    }))
                  }
                />

                <StepActions>
                  <SecondaryButton onClick={() => setStep(2)}>Back to challenges</SecondaryButton>
                  <PrimaryButton onClick={generateReview}>
                    Create Opportunity Review
                    <span aria-hidden>{"->"}</span>
                  </PrimaryButton>
                </StepActions>
              </div>
            )}

            {step === 4 && (
              <div>
                <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
                  <StepHeader
                    label="Step 4"
                    title="Apprenticeship Opportunity Review"
                    description="A practical diagnostic summary for internal discussion and follow-up planning."
                  />
                  <div className="flex flex-wrap gap-2">
                    <ActionButton onClick={saveReview} disabled={!review}>
                      Save
                    </ActionButton>
                    <ActionButton onClick={copyReview} disabled={!review}>
                      Copy
                    </ActionButton>
                    <ActionButton onClick={() => downloadReview(reviewText, context.organisationName)} disabled={!review}>
                      Download
                    </ActionButton>
                    <ActionButton onClick={printReview} disabled={!review}>
                      Download PDF
                    </ActionButton>
                  </div>
                </div>

                <article className="opportunity-review-report mt-8 print:border-0 print:bg-white print:shadow-none">
                  {review ? (
                    <OpportunityReviewView review={review} context={context} generatedAt={new Date()} />
                  ) : (
                    <div className="rounded-3xl border border-[rgba(12,48,42,0.12)] bg-[var(--cream)] py-12 text-center text-sm text-[var(--muted)]">
                      Complete the diagnostic inputs to create the review.
                    </div>
                  )}
                </article>

                <StepActions>
                  <SecondaryButton onClick={() => setStep(3)}>Back to priorities</SecondaryButton>
                  <PrimaryButton onClick={() => setShowSubmitForm((current) => !current)}>
                    Submit Review to MPR
                    <span aria-hidden>{"->"}</span>
                  </PrimaryButton>
                  <Link
                    href="/contact"
                    className="button-pill button-pill--emerald"
                  >
                    Book a Conversation
                    <span aria-hidden>{"->"}</span>
                  </Link>
                </StepActions>

                {showSubmitForm && review && !reviewSubmitted && (
                  <SubmitReviewForm
                    form={submitForm}
                    isSubmitting={isSubmittingReview}
                    onChange={(field, value) => setSubmitForm((current) => ({ ...current, [field]: value }))}
                    onSubmit={submitReview}
                  />
                )}

                {reviewSubmitted && (
                  <div className="mt-8 rounded-[28px] border border-[rgba(52,116,103,0.22)] bg-white p-6 shadow-[0_18px_50px_rgba(12,48,42,0.06)]">
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--teal)]">
                      Review Submitted
                    </p>
                    <h3 className="mt-3 text-2xl font-semibold text-[var(--ink)]">Thank you for submitting your Apprenticeship Opportunity Review.</h3>
                    <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--muted)]">
                      A member of MPR Consulting will review the information provided and may contact you to discuss potential opportunities and next steps.
                    </p>
                    <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                      <PrimaryButton onClick={printReview}>Download PDF</PrimaryButton>
                      <Link
                        href="/contact"
                        className="button-pill button-pill--emerald"
                      >
                        Book a Conversation
                        <span aria-hidden>{"->"}</span>
                      </Link>
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

          {step !== 4 && (
          <aside className="space-y-5 print:hidden">
            <div className="rounded-[28px] border border-[rgba(12,48,42,0.12)] bg-[var(--emerald)] p-6 text-[var(--cream)] shadow-[0_24px_70px_rgba(12,48,42,0.12)]">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[rgba(245,239,228,0.7)]">
                Review structure
              </p>
              <ul className="mt-5 space-y-3 text-sm leading-6 text-[rgba(245,239,228,0.84)]">
                <li>Your Current Position</li>
                <li>Immediate Opportunities</li>
                <li>30-Day Actions</li>
                <li>60-Day Actions</li>
                <li>90-Day Actions</li>
                <li>How MPR Consulting Can Support</li>
                <li>Suggested Next Conversation</li>
              </ul>
            </div>

            <div className="rounded-[28px] border border-[rgba(12,48,42,0.12)] bg-white/60 p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--teal)]">
                Diagnostic focus
              </p>
              <h3 className="mt-3 text-xl font-semibold text-[var(--ink)]">
                No scores. No labels. Just practical decisions.
              </h3>
              <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
                The review is designed to help employers understand where they are today, what opportunities exist and what to do next.
              </p>
            </div>
          </aside>
          )}
        </div>
      </section>
    </main>
  );
}

function OpportunityReviewView({
  review,
  context,
  generatedAt,
}: {
  review: OpportunityReview;
  context: ReviewContext;
  generatedAt: Date;
}) {
  const formattedDate = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(generatedAt);

  return (
    <div className="space-y-6">
      <div className="hidden print:block print:mb-10 print:break-after-page">
        <Image
          src="/brand/mpr-consulting-logo-original.png"
          alt="MPR Consulting"
          width={511}
          height={232}
          className="h-auto w-[190px]"
        />
        <h1 className="mt-12 text-[34px] font-semibold leading-tight text-[#0f2527]">
          Apprenticeship Opportunity Review
        </h1>
        <p className="mt-4 max-w-[560px] text-[15px] leading-7 text-[#536466]">
          A concise review of current position, immediate opportunities and practical next steps.
        </p>
        <div className="mt-10 grid max-w-[560px] gap-3 border-t border-[#d8d0c5] pt-6 text-[13px] text-[#0f2527]">
          <p>
            <span className="font-semibold">Generated:</span> {formattedDate}
          </p>
          {context.organisationName && (
            <p>
              <span className="font-semibold">Organisation:</span> {context.organisationName}
            </p>
          )}
        </div>
      </div>

      <div className="rounded-[28px] border border-[rgba(12,48,42,0.1)] bg-[var(--cream)] p-6 shadow-[0_18px_50px_rgba(12,48,42,0.06)] sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--teal)]">
          MPR Consulting diagnostic
        </p>
        <h3 className="mt-3 text-3xl font-semibold leading-tight text-[var(--ink)]">
          Apprenticeship Opportunity Review
        </h3>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)]">
          A concise review of current position, immediate opportunities and practical next steps.
        </p>
      </div>

      <ProseSection title="Your Current Position" paragraphs={review.currentPosition} />
      <ActionSection title="Immediate Opportunities" actions={review.immediateOpportunities} />

      <section className="rounded-[28px] border border-[rgba(12,48,42,0.1)] bg-white/60 p-5 sm:p-6">
        <h4 className="text-xl font-semibold text-[var(--ink)]">Recommended Actions</h4>
        <div className="mt-5 grid gap-4 lg:grid-cols-3">
          <ActionPlanCard title="30-Day Actions" actions={review.actions30} />
          <ActionPlanCard title="60-Day Actions" actions={review.actions60} />
          <ActionPlanCard title="90-Day Actions" actions={review.actions90} />
        </div>
      </section>

      <section className="rounded-[28px] border border-[rgba(12,48,42,0.1)] bg-white/60 p-5 sm:p-6">
        <h4 className="text-xl font-semibold text-[var(--ink)]">How MPR Consulting Can Support</h4>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {review.supportServices.map((service) => (
            <div
              key={service.title}
              className="rounded-2xl border border-[rgba(12,48,42,0.08)] bg-[var(--cream)] p-4"
            >
              <h5 className="text-sm font-semibold text-[var(--ink)]">{service.title}</h5>
              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{service.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-[28px] border border-[rgba(52,116,103,0.18)] bg-[rgba(52,116,103,0.08)] p-5 sm:p-6">
        <h4 className="text-xl font-semibold text-[var(--ink)]">Suggested Next Conversation</h4>
        <p className="mt-4 text-[15px] leading-7 text-[var(--muted)]">{review.nextConversation}</p>
        <Link
          href="/contact"
          className="button-pill button-pill--emerald mt-5"
        >
          Book a Conversation
          <span aria-hidden>{"->"}</span>
        </Link>
      </section>
    </div>
  );
}

function ProseSection({ title, paragraphs }: { title: string; paragraphs: string[] }) {
  return (
    <section className="rounded-[28px] border border-[rgba(12,48,42,0.1)] bg-white/60 p-5 sm:p-6">
      <h4 className="text-xl font-semibold text-[var(--ink)]">{title}</h4>
      <div className="mt-4 space-y-4">
        {paragraphs.map((paragraph, index) => (
          <p key={`${title}-${index}`} className="text-[15px] leading-7 text-[var(--muted)]">
            {paragraph}
          </p>
        ))}
      </div>
    </section>
  );
}

function ActionSection({ title, actions }: { title: string; actions: string[] }) {
  return (
    <section className="rounded-[28px] border border-[rgba(12,48,42,0.1)] bg-white/60 p-5 sm:p-6">
      <h4 className="text-xl font-semibold text-[var(--ink)]">{title}</h4>
      <div className="mt-5 grid gap-3">
        {actions.map((action, index) => (
          <NumberedAction key={`${title}-${action}`} index={index} text={action} />
        ))}
      </div>
    </section>
  );
}

function ActionPlanCard({ title, actions }: { title: string; actions: string[] }) {
  return (
    <div className="rounded-2xl border border-[rgba(12,48,42,0.14)] bg-white p-4">
      <h5 className="text-sm font-semibold text-[var(--ink)]">{title}</h5>
      <div className="mt-4 space-y-3">
        {actions.map((action, index) => (
          <NumberedAction key={`${title}-${action}`} index={index} text={action} compact />
        ))}
      </div>
    </div>
  );
}

function NumberedAction({ index, text, compact }: { index: number; text: string; compact?: boolean }) {
  return (
    <div className={`flex gap-3 ${compact ? "" : "rounded-2xl border border-[rgba(12,48,42,0.12)] bg-white p-4"}`}>
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--emerald)] text-sm font-semibold text-[var(--cream)]">
        {String(index + 1).padStart(2, "0")}
      </span>
      <p className="text-sm leading-6 text-[var(--ink)]">{text}</p>
    </div>
  );
}

function SelectionGrid({
  options,
  selected,
  onToggle,
}: {
  options: string[];
  selected: string[];
  onToggle: (option: string) => void;
}) {
  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-4">
        <p className="text-sm font-semibold text-[var(--ink)]">Select up to 3</p>
        <p className="text-sm text-[var(--muted)]">{selected.length}/3 selected</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {options.map((option) => {
          const isSelected = selected.includes(option);
          const isUnavailable = !isSelected && selected.length >= 3;

          return (
            <button
              key={option}
              type="button"
              onClick={() => onToggle(option)}
              disabled={isUnavailable}
              className={`min-h-20 rounded-2xl border p-4 text-left text-sm font-semibold leading-5 transition ${
                isSelected
                  ? "border-[var(--emerald)] bg-[var(--emerald)] text-[var(--cream)] shadow-[0_14px_32px_rgba(12,48,42,0.12)]"
                  : "border-[rgba(12,48,42,0.16)] bg-white text-[var(--ink)] hover:border-[var(--teal)]"
              } disabled:cursor-not-allowed disabled:opacity-55`}
            >
              {option}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function StepHeader({
  label,
  title,
  description,
}: {
  label: string;
  title: string;
  description: string;
}) {
  return (
    <div className="mb-8">
      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--teal)]">
        {label}
      </p>
      <h2 className="mt-3 text-2xl font-semibold text-[var(--ink)]">{title}</h2>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)]">{description}</p>
    </div>
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

function StepActions({ children }: { children: ReactNode }) {
  return <div className="mt-10 flex flex-col gap-3 sm:flex-row">{children}</div>;
}

function PrimaryButton({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="button-pill button-pill--emerald"
    >
      {children}
    </button>
  );
}

function SubmitReviewForm({
  form,
  isSubmitting,
  onChange,
  onSubmit,
}: {
  form: SubmitForm;
  isSubmitting: boolean;
  onChange: (field: keyof SubmitForm, value: string | boolean) => void;
  onSubmit: () => void;
}) {
  return (
    <div className="mt-8 rounded-[28px] border border-[rgba(12,48,42,0.14)] bg-white p-6 shadow-[0_18px_50px_rgba(12,48,42,0.06)]">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--teal)]">
        Submit Review to MPR
      </p>
      <h3 className="mt-3 text-2xl font-semibold text-[var(--ink)]">Request a consultant review</h3>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--muted)]">
        Share the completed review with MPR Consulting so we can understand the context before any follow-up conversation.
      </p>

      <div className="mt-6 grid gap-5 md:grid-cols-2">
        <Field label="Your Name *">
          <input
            value={form.name}
            onChange={(event) => onChange("name", event.target.value)}
            className="input-field"
            placeholder="Your name"
          />
        </Field>
        <Field label="Organisation *">
          <input
            value={form.organisation}
            onChange={(event) => onChange("organisation", event.target.value)}
            className="input-field"
            placeholder="Organisation name"
          />
        </Field>
        <Field label="Email Address *">
          <input
            type="email"
            value={form.email}
            onChange={(event) => onChange("email", event.target.value)}
            className="input-field"
            placeholder="name@organisation.co.uk"
          />
        </Field>
        <Field label="Telephone Number (optional)">
          <input
            value={form.telephone}
            onChange={(event) => onChange("telephone", event.target.value)}
            className="input-field"
            placeholder="Telephone number"
          />
        </Field>
      </div>

      <label className="mt-6 flex gap-3 rounded-2xl border border-[rgba(12,48,42,0.14)] bg-[var(--cream)] p-4 text-sm leading-6 text-[var(--ink)]">
        <input
          type="checkbox"
          checked={form.consent}
          onChange={(event) => onChange("consent", event.target.checked)}
          className="mt-1 h-4 w-4 shrink-0 accent-[var(--emerald)]"
        />
        <span>
          I would like MPR Consulting to review this report and contact me.
          <span className="mt-2 block text-[13px] leading-6 text-[var(--muted)]">
            By submitting this review, you agree that MPR Consulting may use the information provided to review your enquiry and contact you regarding relevant apprenticeship and workforce development support.
          </span>
        </span>
      </label>

      <button
        type="button"
        onClick={onSubmit}
        disabled={isSubmitting}
        className="button-pill button-pill--emerald mt-6"
      >
        {isSubmitting ? "Submitting review..." : "Submit Review"}
      </button>
    </div>
  );
}

function SecondaryButton({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="button-pill"
    >
      {children}
    </button>
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
      className="button-pill min-h-10 px-4 py-2 text-sm disabled:opacity-100"
    >
      {children}
    </button>
  );
}
