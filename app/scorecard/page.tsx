"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type Answers = {
  organisationName: string;
  role: string;
  employees: string;
  levyPayer: string;
  fundingConfidence: string;
  apprenticeshipActivity: string;
  workforcePlanning: string;
  providerConfidence: string;
  priorities: string[];
  strategicChallenge: string;
};

type GateDetails = {
  name: string;
  email: string;
  organisation: string;
  role: string;
  consent: boolean;
};

type BlindSpot = {
  issue: string;
  meaning: string;
  whyItMatters: string;
  nextStep: string;
};

const initialAnswers: Answers = {
  organisationName: "",
  role: "",
  employees: "",
  levyPayer: "",
  fundingConfidence: "",
  apprenticeshipActivity: "",
  workforcePlanning: "",
  providerConfidence: "",
  priorities: [],
  strategicChallenge: "",
};

const initialGateDetails: GateDetails = {
  name: "",
  email: "",
  organisation: "",
  role: "",
  consent: false,
};

const employeeOptions = ["Under 50", "50-249", "250-999", "1,000+"];
const levyOptions = ["Yes", "No", "Not sure"];
const fundingConfidenceOptions = ["Very confident", "Somewhat confident", "Not very confident", "Not sure"];
const activityOptions = [
  "No current apprenticeships",
  "A small number of apprentices",
  "Several active programmes",
  "Apprenticeships are embedded across the organisation",
  "Not sure",
];
const workforcePlanningOptions = ["Strongly linked", "Somewhat linked", "Mostly reactive", "Not linked", "Not sure"];
const providerOptions = [
  "Very confident",
  "Somewhat confident",
  "We use providers but have concerns",
  "We do not currently have providers",
  "Not sure",
];
const priorityOptions = [
  "Leadership and management",
  "AI, data or automation",
  "Procurement",
  "Operations",
  "Customer service",
  "Digital skills",
  "Early careers",
  "Retention and progression",
  "Compliance or professional development",
  "Other",
];
const challengeOptions = [
  "Reducing commercial training spend",
  "Improving workforce capability",
  "Building leadership pipeline",
  "Supporting AI or digital adoption",
  "Improving retention",
  "Developing future skills",
  "Finding suitable providers",
  "Understanding funding rules",
  "Not sure yet",
];

const positionFramework = [
  {
    label: "Underutilised",
    range: "0–25",
    copy: "Significant untapped opportunity.",
  },
  {
    label: "Developing",
    range: "26–50",
    copy: "Some activity exists, but stronger structure and alignment may help.",
  },
  {
    label: "Optimising",
    range: "51–75",
    copy: "Using apprenticeships with increasing maturity, with opportunities to strengthen strategic use.",
  },
  {
    label: "Strategic",
    range: "76–100",
    copy: "Mature, embedded and strategically aligned approach.",
  },
];

const briefingBenefits = [
  "employer market updates",
  "funding changes",
  "apprenticeship developments",
  "workforce capability insight",
  "practical employer guidance",
];

function calculateScore(answers: Answers) {
  let score = 0;

  score += answers.levyPayer === "Yes" ? 12 : answers.levyPayer === "Not sure" ? 8 : 5;
  score += {
    "Very confident": 0,
    "Somewhat confident": 8,
    "Not very confident": 18,
    "Not sure": 14,
  }[answers.fundingConfidence] ?? 0;
  score += {
    "No current apprenticeships": 20,
    "A small number of apprentices": 14,
    "Several active programmes": 7,
    "Apprenticeships are embedded across the organisation": 0,
    "Not sure": 10,
  }[answers.apprenticeshipActivity] ?? 0;
  score += {
    "Strongly linked": 0,
    "Somewhat linked": 8,
    "Mostly reactive": 15,
    "Not linked": 20,
    "Not sure": 12,
  }[answers.workforcePlanning] ?? 0;
  score += {
    "Very confident": 0,
    "Somewhat confident": 7,
    "We use providers but have concerns": 16,
    "We do not currently have providers": 14,
    "Not sure": 12,
  }[answers.providerConfidence] ?? 0;
  score += Math.min(answers.priorities.length * 4, 16);
  score += ["Finding suitable providers", "Understanding funding rules", "Not sure yet"].includes(answers.strategicChallenge)
    ? 8
    : 4;

  return Math.min(score, 100);
}

function getPosition(score: number) {
  if (score <= 25) return "Underutilised";
  if (score <= 50) return "Developing";
  if (score <= 75) return "Optimising";
  return "Strategic";
}

function getPositionSnapshot(position: string) {
  if (position === "Underutilised") {
    return {
      currentPicture: "Apprenticeships may not yet be playing a clear role in workforce development.",
      biggestOpportunity: "A clearer view of funding, training spend and where apprenticeships could help.",
      recommendedMove: "Start with a simple funding and opportunity review.",
    };
  }
  if (position === "Developing") {
    return {
      currentPicture: "You already have some apprenticeship activity in place.",
      biggestOpportunity: "Stronger connection between apprenticeships, funding and workforce priorities.",
      recommendedMove: "Review providers, funding confidence and strategic workforce goals.",
    };
  }
  if (position === "Optimising") {
    return {
      currentPicture: "Apprenticeships are active, but there may be room to make them work harder.",
      biggestOpportunity: "Better measurement, clearer provider choices and expansion into priority skills areas.",
      recommendedMove: "Benchmark current activity and decide where to scale next.",
    };
  }

  return {
    currentPicture: "Apprenticeships appear to be well established and linked to business priorities.",
    biggestOpportunity: "Refining the approach, benchmarking performance and staying ahead of emerging skills needs.",
    recommendedMove: "Use an independent review to test whether the current strategy remains future-ready.",
  };
}

function getScoreExplanation(position: string) {
  if (position === "Underutilised") {
    return {
      meaning:
        "Your score suggests apprenticeships are not yet being used in a clear or consistent way across the organisation.",
      reason:
        "This position is usually linked to low activity, limited funding confidence, unclear provider options or apprenticeships not yet being connected to workforce priorities.",
      next:
        "Organisations in this position typically start by reviewing training spend, funding routes and the roles where apprenticeships could add practical value.",
    };
  }
  if (position === "Developing") {
    return {
      meaning:
        "Your score suggests some activity is already in place, but the approach may still need clearer structure.",
      reason:
        "This position is usually linked to partial apprenticeship use, mixed funding confidence, provider questions or a weaker link to workforce planning.",
      next:
        "Organisations in this position typically review current activity, check provider fit and decide which workforce priorities apprenticeships should support next.",
    };
  }
  if (position === "Optimising") {
    return {
      meaning:
        "Your score suggests apprenticeships are being used with increasing maturity.",
      reason:
        "This position is usually linked to active apprenticeship use, improving funding confidence and a clearer connection to workforce priorities.",
      next:
        "Organisations in this position typically strengthen measurement, compare provider performance and expand into priority skills areas where there is a clear need.",
    };
  }

  return {
    meaning:
      "Your score suggests apprenticeships are mature, embedded and connected to wider workforce planning.",
    reason:
      "This position is usually linked to confident funding use, established apprenticeship activity, clear planning and stronger provider confidence.",
    next:
      "Organisations in this position typically focus on benchmarking, refinement and keeping the approach current as standards and workforce needs change.",
  };
}

function getBlindSpots(answers: Answers): BlindSpot[] {
  const blindSpots: BlindSpot[] = [];

  if (answers.fundingConfidence !== "Very confident") {
    blindSpots.push({
      issue: "Funding clarity",
      meaning:
        "You may not yet have a clear picture of available funding, levy opportunities or viable delivery routes.",
      whyItMatters:
        "Organisations without funding clarity often miss opportunities or continue spending commercially where apprenticeships may be suitable.",
      nextStep: "Review available funding routes and current training spend.",
    });
  }
  if (["No current apprenticeships", "A small number of apprentices", "Not sure"].includes(answers.apprenticeshipActivity)) {
    blindSpots.push({
      issue: "Current activity",
      meaning:
        "Apprenticeship activity may not yet be fully mapped across teams, roles and workforce priorities.",
      whyItMatters:
        "Without visibility, apprenticeship activity can remain isolated rather than supporting wider workforce development.",
      nextStep: "Review current apprenticeship activity against teams, workforce priorities and future demand.",
    });
  }
  if (["Mostly reactive", "Not linked", "Not sure"].includes(answers.workforcePlanning)) {
    blindSpots.push({
      issue: "Workforce connection",
      meaning:
        "Apprenticeships may not yet be clearly linked to the skills, roles or priorities the organisation needs most.",
      whyItMatters:
        "Apprenticeships create more value when they are connected to real workforce priorities, not used only when a course happens to be available.",
      nextStep: "Identify two or three workforce priorities where funded training could add value.",
    });
  }
  if (["We use providers but have concerns", "We do not currently have providers", "Not sure"].includes(answers.providerConfidence)) {
    blindSpots.push({
      issue: "Provider confidence",
      meaning:
        "You may not yet have a clear picture of provider suitability, quality or delivery fit.",
      whyItMatters:
        "Provider uncertainty can slow decisions, create inconsistent delivery and reduce confidence when scaling activity.",
      nextStep: "Review providers against employer priorities, delivery quality and programme fit.",
    });
  }

  return blindSpots.length > 0
    ? blindSpots
    : [
        {
          issue: "Continuous improvement",
          meaning:
            "You may now need a clearer view of what is working well, what could improve and how your approach compares with the market.",
          whyItMatters:
            "Even mature apprenticeship strategies need regular review as standards, funding rules and workforce needs change.",
          nextStep: "Benchmark current activity and agree what should be improved next.",
        },
      ];
}

function getPriorityRecommendations(answers: Answers) {
  const recommendations = [];

  if (answers.priorities.includes("Leadership and management")) {
    recommendations.push("Review management apprenticeship options against leadership and progression needs.");
  }
  if (answers.priorities.includes("AI, data or automation")) {
    recommendations.push("Explore AI, data and automation apprenticeship routes for relevant teams.");
  }
  if (answers.priorities.includes("Procurement")) {
    recommendations.push("Review procurement apprenticeship options against commercial and supplier needs.");
  }
  if (["We use providers but have concerns", "We do not currently have providers", "Not sure"].includes(answers.providerConfidence)) {
    recommendations.push("Compare provider options before committing to new programmes.");
  }
  if (answers.fundingConfidence !== "Very confident") {
    recommendations.push("Clarify funding routes before deciding what to build or buy.");
  }

  return recommendations.length > 0
    ? recommendations
    : ["Review current activity against workforce priorities, provider performance and emerging standards."];
}

function getSupportRoute(answers: Answers, position: string) {
  if (position === "Underutilised") return "reviewing funding routes and finding where apprenticeships could reduce wasted training spend";
  if (answers.providerConfidence.includes("concerns") || answers.providerConfidence === "Not sure") {
    return "reviewing provider options and checking which routes are most suitable";
  }
  if (answers.priorities.includes("AI, data or automation")) {
    return "exploring AI, data and automation routes alongside workforce priorities";
  }
  return "turning your answers into a clearer apprenticeship plan";
}

function getCommonNextSteps(position: string) {
  if (position === "Underutilised") {
    return [
      "Review current training spend and funding options.",
      "Identify one or two workforce priorities where apprenticeships may help.",
      "Check whether levy or co-investment routes are being missed.",
      "Build a simple first-stage apprenticeship plan.",
    ];
  }
  if (position === "Developing") {
    return [
      "Review current apprenticeship activity.",
      "Identify workforce priorities where apprenticeships could add value.",
      "Review provider options and funding routes.",
      "Build a clearer apprenticeship strategy.",
    ];
  }
  if (position === "Optimising") {
    return [
      "Benchmark current activity and outcomes.",
      "Review provider performance and fit.",
      "Expand into priority skills areas where there is a clear business case.",
      "Agree how success will be measured.",
    ];
  }

  return [
    "Benchmark your approach against market practice.",
    "Review emerging standards and future skills needs.",
    "Test whether provider arrangements still fit the organisation.",
    "Refine the strategy for the next planning cycle.",
  ];
}

function getSegments(answers: Answers) {
  const segments = new Set<string>(["apprenticeships", "workforce"]);

  if (answers.priorities.includes("AI, data or automation")) segments.add("ai");
  if (answers.priorities.includes("Procurement")) segments.add("procurement");
  if (answers.priorities.includes("Leadership and management")) segments.add("leadership");

  return Array.from(segments);
}

export default function ScorecardPage() {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Answers>(initialAnswers);
  const [gateDetails, setGateDetails] = useState<GateDetails>(initialGateDetails);
  const [showResults, setShowResults] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const rawOpportunityScore = useMemo(() => calculateScore(answers), [answers]);
  const score = useMemo(() => 100 - rawOpportunityScore, [rawOpportunityScore]);
  const position = useMemo(() => getPosition(score), [score]);
  const blindSpots = useMemo(() => getBlindSpots(answers), [answers]);
  const priorityRecommendations = useMemo(() => getPriorityRecommendations(answers), [answers]);
  const supportRoute = useMemo(() => getSupportRoute(answers, position), [answers, position]);
  const positionSnapshot = useMemo(() => getPositionSnapshot(position), [position]);
  const scoreExplanation = useMemo(() => getScoreExplanation(position), [position]);
  const commonNextSteps = useMemo(() => getCommonNextSteps(position), [position]);

  const steps = ["Profile", "Funding", "Activity", "Providers", "Priorities", "Gate"];
  const progress = showResults ? 100 : Math.round(((step + 1) / steps.length) * 100);

  useEffect(() => {
    if (!showResults) {
      return;
    }

    window.localStorage.setItem(
      "mpr.scorecard.latest",
      JSON.stringify({
        score,
        position,
        blindSpots: blindSpots.map((spot) => spot.issue),
        selectedPriorities: answers.priorities,
        updatedAt: new Date().toISOString(),
      }),
    );
  }, [answers.priorities, blindSpots, position, score, showResults]);

  function setAnswer<K extends keyof Answers>(key: K, value: Answers[K]) {
    setAnswers((current) => ({ ...current, [key]: value }));
    setError("");
  }

  function togglePriority(priority: string) {
    setAnswers((current) => {
      const selected = current.priorities.includes(priority);
      return {
        ...current,
        priorities: selected
          ? current.priorities.filter((item) => item !== priority)
          : [...current.priorities, priority],
      };
    });
    setError("");
  }

  function validateStep() {
    if (step === 0) return Boolean(answers.organisationName && answers.role && answers.employees);
    if (step === 1) return Boolean(answers.levyPayer && answers.fundingConfidence);
    if (step === 2) return Boolean(answers.apprenticeshipActivity && answers.workforcePlanning);
    if (step === 3) return Boolean(answers.providerConfidence);
    if (step === 4) return answers.priorities.length > 0 && Boolean(answers.strategicChallenge);
    return true;
  }

  function goNext() {
    if (!validateStep()) {
      setError("Please complete the required fields before continuing.");
      return;
    }

    setStep((current) => Math.min(current + 1, steps.length - 1));
    setError("");
  }

  function goBack() {
    setStep((current) => Math.max(current - 1, 0));
    setError("");
  }

  async function submitGate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!gateDetails.name || !gateDetails.email || !gateDetails.organisation || !gateDetails.role) {
      setError("Please complete your details to receive the scorecard summary.");
      return;
    }
    if (!gateDetails.consent) {
      setError("Please confirm consent to receive your scorecard summary and the MPR employer briefing.");
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      const response = await fetch("/api/subscribe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: gateDetails.email.trim().toLowerCase(),
          sourcePage: "/scorecard",
          segments: getSegments(answers),
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { message?: string } | null;
        throw new Error(payload?.message ?? "We could not save your briefing subscription.");
      }

      // TODO: Persist the full scorecard lead payload to CRM once the preferred lead store is confirmed.
      setShowResults(true);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "We could not complete the subscription. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <section className="container-px relative isolate overflow-hidden bg-forest text-cream">
        <div className="pointer-events-none absolute inset-0 opacity-70">
          <div className="absolute -right-40 -top-40 h-[34rem] w-[34rem] rounded-full border border-teal/25" />
          <div className="absolute -right-12 top-8 h-[22rem] w-[22rem] rounded-full border border-brass/18" />
        </div>
        <div className="relative mx-auto grid max-w-7xl gap-10 py-16 md:py-20 lg:grid-cols-[0.95fr_1.05fr] lg:items-end lg:py-24">
          <div className="reveal-up">
            <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-teal">
              Employer Apprenticeship Opportunity Scorecard
            </p>
            <h1 className="display-heading mt-6 max-w-4xl text-[2.85rem] leading-[1.04] sm:text-[3.85rem] lg:text-[5rem] lg:leading-[1]">
              Are you leaving apprenticeship opportunity on the table?
            </h1>
          </div>

          <div className="reveal-up reveal-delay-2 max-w-2xl lg:pb-2">
            <p className="max-w-xl text-[17px] leading-8 text-cream/76 md:text-[18px] md:leading-9">
              Use the Employer Apprenticeship Opportunity Scorecard to understand how well your organisation is using apprenticeship funding, where capability gaps may exist and what your next strategic move could be.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a href="#scorecard" className="button-pill">
                Start the 3-minute assessment
              </a>
              <a href="#scorecard" className="button-pill">
                Receive your score and employer briefing
              </a>
            </div>
            <p className="mt-5 text-[12px] font-semibold uppercase tracking-[0.16em] text-cream/58">
              Built for HR, L&amp;D, Finance and Operations leaders.
            </p>
          </div>
        </div>
      </section>

      <section id="scorecard" className="container-px py-14 md:py-16 lg:py-20">
        <div className="mx-auto max-w-7xl">
          <div className="premium-card rounded-xl bg-white/42 p-5 md:p-6">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-[12px] font-semibold uppercase tracking-[0.2em] text-teal">
                  {showResults ? "Report summary" : `Step ${step + 1} of ${steps.length}`}
                </p>
                <h2 className="display-heading mt-3 text-4xl leading-none text-ink md:text-5xl">
                  {showResults ? "Your employer opportunity profile" : steps[step]}
                </h2>
              </div>
              <div className="min-w-full sm:min-w-64">
                <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.16em] text-ink/52">
                  <span>Progress</span>
                  <span>{progress}%</span>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-ink/10">
                  <div className="h-full rounded-full bg-teal transition-all duration-500" style={{ width: `${progress}%` }} />
                </div>
              </div>
            </div>
          </div>

          {showResults ? (
            <div className="mt-8 grid gap-6">
              <div className="grid gap-6 lg:grid-cols-[0.88fr_1.12fr]">
                <div className="rounded-xl bg-forest p-7 text-cream shadow-soft lg:p-8">
                  <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-brass">Your position</p>
                  <h2 className="display-heading mt-5 text-5xl leading-none md:text-6xl">
                    {position}
                  </h2>
                  <div className="mt-6 border-t border-cream/14 pt-6">
                    <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-brass">
                      Opportunity Score
                    </p>
                    <p className="display-heading mt-3 text-6xl leading-none md:text-7xl">
                      {score} / 100
                    </p>

                    <div className="mt-6 rounded-lg border border-cream/12 bg-cream/[0.06] p-4">
                      <div className="flex flex-wrap items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.12em]">
                        {positionFramework.map((stage, index) => (
                          <span key={stage.label} className="inline-flex items-center gap-2">
                            <span className={stage.label === position ? "rounded-full bg-cream px-2 py-1 text-forest" : "text-cream/58"}>
                              {stage.label}
                            </span>
                            {index < positionFramework.length - 1 ? <span className="text-cream/30">&rarr;</span> : null}
                          </span>
                        ))}
                      </div>
                      <div className="mt-4 grid gap-2 sm:grid-cols-4">
                        {positionFramework.map((stage) => {
                          const active = stage.label === position;
                          return (
                            <div key={stage.label} className={`h-1.5 rounded-full ${active ? "bg-brass" : "bg-cream/18"}`} />
                          );
                        })}
                      </div>
                    </div>

                    <div className="mt-6">
                      <p className="text-sm font-semibold uppercase tracking-[0.12em] text-cream/54">How to read your score</p>
                      <div className="mt-4 grid gap-3">
                        {positionFramework.map((stage) => (
                          <div key={stage.label} className="grid gap-1 border-t border-cream/10 pt-3 first:border-t-0 first:pt-0 sm:grid-cols-[5rem_8rem_1fr]">
                            <p className="text-sm font-semibold text-brass">{stage.range}</p>
                            <p className="text-sm font-semibold text-cream">{stage.label}</p>
                            <p className="text-sm leading-6 text-cream/68">{stage.copy}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="mt-6">
                      <p className="text-sm font-semibold uppercase tracking-[0.12em] text-cream/54">What your score means</p>
                      <p className="mt-3 text-base leading-7 text-cream/76">
                        {scoreExplanation.meaning}
                      </p>
                      <p className="mt-4 text-sm font-semibold uppercase tracking-[0.12em] text-cream/54">Why you received this position</p>
                      <p className="mt-3 text-base leading-7 text-cream/76">
                        {scoreExplanation.reason}
                      </p>
                      <p className="mt-4 text-sm font-semibold uppercase tracking-[0.12em] text-cream/54">What organisations typically do next</p>
                      <p className="mt-3 text-base leading-7 text-cream/76">
                        {scoreExplanation.next}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="premium-card rounded-xl bg-white/48 p-6 md:p-7">
                  <p className="text-[12px] font-semibold uppercase tracking-[0.2em] text-teal">
                    Your Results In 30 Seconds
                  </p>
                  <div className="mt-6 grid gap-4">
                    <SummaryRow label="Position" value={position} />
                    <SummaryRow label="Current picture" value={positionSnapshot.currentPicture} />
                    <SummaryRow label="Biggest opportunity" value={positionSnapshot.biggestOpportunity} />
                    <SummaryRow label="Recommended next move" value={positionSnapshot.recommendedMove} />
                  </div>
                </div>
              </div>

              <div className="premium-card rounded-xl bg-white/48 p-6 md:p-7">
                <div className="grid gap-6 lg:grid-cols-[0.62fr_1.38fr] lg:items-start">
                  <div>
                    <p className="text-[12px] font-semibold uppercase tracking-[0.2em] text-teal">
                      How to read your score
                    </p>
                    <p className="mt-4 text-sm leading-7 text-ink/62">
                      The score shows the level of apprenticeship opportunity still available to explore. It is not a pass or fail.
                    </p>
                  </div>
                  <div className="grid gap-3 md:grid-cols-4">
                    {positionFramework.map((stage) => {
                      const active = stage.label === position;
                      return (
                        <div
                          key={stage.label}
                          className={`rounded-lg border p-4 ${
                            active
                              ? "border-forest bg-forest text-cream"
                              : "border-ink/10 bg-cream/60 text-ink"
                          }`}
                        >
                          <p className={`text-[11px] font-semibold uppercase tracking-[0.16em] ${active ? "text-brass" : "text-ink/48"}`}>
                            {stage.range}
                          </p>
                          <p className="mt-3 text-sm font-semibold">{stage.label}</p>
                          <p className={`mt-2 text-sm leading-6 ${active ? "text-cream/72" : "text-ink/58"}`}>
                            {stage.copy}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="grid gap-6 lg:grid-cols-[1.06fr_0.94fr]">
                <div className="grid gap-6">
                  <BlindSpotCard items={blindSpots} />
                  <ReportCard title="Suggested priority areas" items={priorityRecommendations} />
                </div>

                <div className="grid gap-6">
                  <div className="premium-card rounded-xl p-6">
                    <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-teal">
                      Common Next Steps For Organisations In This Position
                    </p>
                    <ol className="mt-5 grid gap-3">
                      {commonNextSteps.map((item, index) => (
                        <li key={item} className="flex gap-3 text-base leading-7 text-ink/68">
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-forest text-xs font-semibold text-cream">
                            {index + 1}
                          </span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ol>
                  </div>

                  <div className="premium-card rounded-xl p-6">
                    <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-teal">How MPR Could Help</p>
                    <p className="mt-4 text-base leading-7 text-ink/68">
                      Based on your answers, the most useful next step may be {supportRoute}.
                    </p>
                    <p className="mt-4 text-base leading-7 text-ink/68">
                      Based on your priorities, MPR Consulting can explore
                      relevant apprenticeship pathways from a trusted provider
                      network delivering more than 130 apprenticeship
                      programmes.
                    </p>
                    <div className="mt-5 grid gap-3 text-sm leading-6 text-ink/64">
                      {[
                        "reviewing provider options",
                        "clarifying funding opportunities",
                        "identifying where apprenticeships could support workforce priorities",
                        "building a clearer strategy",
                      ].map((item) => (
                        <div key={item} className="flex gap-3">
                          <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-brass" />
                          <span>{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-6 rounded-xl bg-forest p-7 text-cream shadow-soft lg:flex-row lg:items-center lg:justify-between lg:p-8">
                <div>
                  <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-brass">Next steps</p>
                  <h2 className="display-heading mt-4 max-w-3xl text-3xl leading-[1.08] md:text-4xl">
                    Turn the scorecard into a practical apprenticeship strategy conversation.
                  </h2>
                  <p className="mt-4 max-w-2xl text-sm leading-7 text-cream/64">
                    Independent guidance. Built for employers. No obligation.
                  </p>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row lg:flex-col xl:flex-row">
                  <a href="mailto:james@mprconsulting.co.uk?subject=Employer%20Apprenticeship%20Strategy%20Conversation" className="button-pill">
                    Book a Strategy Conversation
                  </a>
                  <Link href="/insights" className="button-pill">
                    Receive My Full Summary &amp; Employer Briefing
                  </Link>
                  <Link href="/services" className="button-pill">
                    Explore Advisory Services
                  </Link>
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-8 grid gap-8 lg:grid-cols-[280px_1fr]">
              <aside className="hidden lg:block">
                <div className="sticky top-24 premium-card rounded-xl bg-white/42 p-4">
                  {steps.map((label, index) => (
                    <div key={label} className={`flex items-center gap-3 rounded-lg p-4 ${index === step ? "bg-forest text-cream" : "text-ink/64"}`}>
                      <div className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold ${index === step ? "bg-cream/10 text-brass" : "bg-cream text-ink"}`}>
                        {index + 1}
                      </div>
                      <p className="text-sm font-semibold">{label}</p>
                    </div>
                  ))}
                </div>
              </aside>

              <div className="premium-card rounded-xl bg-white/48 p-6 shadow-soft lg:p-8">
                {step === 0 ? (
                  <div className="grid gap-5">
                    <TextField label="Organisation name" value={answers.organisationName} onChange={(value) => setAnswer("organisationName", value)} />
                    <TextField label="Your role" value={answers.role} onChange={(value) => setAnswer("role", value)} />
                    <OptionGroup label="Approximate number of employees" value={answers.employees} options={employeeOptions} onChange={(value) => setAnswer("employees", value)} />
                  </div>
                ) : null}

                {step === 1 ? (
                  <div className="grid gap-6">
                    <OptionGroup label="Are you an apprenticeship levy payer?" value={answers.levyPayer} options={levyOptions} onChange={(value) => setAnswer("levyPayer", value)} />
                    <OptionGroup label="How confident are you that your organisation is using apprenticeship funding effectively?" value={answers.fundingConfidence} options={fundingConfidenceOptions} onChange={(value) => setAnswer("fundingConfidence", value)} />
                  </div>
                ) : null}

                {step === 2 ? (
                  <div className="grid gap-6">
                    <OptionGroup label="How active is your organisation with apprenticeships?" value={answers.apprenticeshipActivity} options={activityOptions} onChange={(value) => setAnswer("apprenticeshipActivity", value)} />
                    <OptionGroup label="How well are apprenticeships linked to workforce planning?" value={answers.workforcePlanning} options={workforcePlanningOptions} onChange={(value) => setAnswer("workforcePlanning", value)} />
                  </div>
                ) : null}

                {step === 3 ? (
                  <OptionGroup label="How confident are you in your current apprenticeship provider mix?" value={answers.providerConfidence} options={providerOptions} onChange={(value) => setAnswer("providerConfidence", value)} />
                ) : null}

                {step === 4 ? (
                  <div className="grid gap-8">
                    <div>
                      <p className="text-sm font-semibold text-ink">Workforce priorities</p>
                      <p className="mt-2 text-sm leading-6 text-ink/58">Select all that apply.</p>
                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        {priorityOptions.map((priority) => {
                          const selected = answers.priorities.includes(priority);
                          return (
                            <button
                              key={priority}
                              type="button"
                              onClick={() => togglePriority(priority)}
                              className={`rounded-lg border p-4 text-left text-sm font-semibold transition ${
                                selected ? "border-forest bg-forest text-cream" : "border-ink/10 bg-cream/70 text-ink hover:bg-white/70"
                              }`}
                            >
                              {priority}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <OptionGroup label="What is the biggest challenge you want apprenticeship funding to help solve?" value={answers.strategicChallenge} options={challengeOptions} onChange={(value) => setAnswer("strategicChallenge", value)} />
                  </div>
                ) : null}

                {step === 5 ? (
                  <form onSubmit={submitGate} className="grid gap-5" noValidate>
                    <div>
                      <p className="display-heading text-3xl leading-[1.12] text-ink md:text-4xl">
                        Receive your personalised scorecard summary.
                      </p>
                      <p className="mt-3 max-w-2xl text-base leading-7 text-ink/64">
                        We will show your score explanation, practical recommendations and relevant employer insights. You will also receive the MPR Employer Briefing.
                      </p>
                      <div className="mt-5 rounded-lg border border-ink/10 bg-cream/70 p-4">
                        <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-ink/52">
                          Your briefing subscription includes
                        </p>
                        <div className="mt-3 grid gap-2 sm:grid-cols-2">
                          {briefingBenefits.map((benefit) => (
                            <div key={benefit} className="flex gap-2 text-sm leading-6 text-ink/64">
                              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brass" />
                              <span>{benefit}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                    <TextField label="Name" value={gateDetails.name} onChange={(value) => setGateDetails((current) => ({ ...current, name: value }))} />
                    <TextField label="Work email" type="email" value={gateDetails.email} onChange={(value) => setGateDetails((current) => ({ ...current, email: value }))} />
                    <TextField label="Organisation" value={gateDetails.organisation} onChange={(value) => setGateDetails((current) => ({ ...current, organisation: value }))} />
                    <TextField label="Role" value={gateDetails.role} onChange={(value) => setGateDetails((current) => ({ ...current, role: value }))} />
                    <label className="flex items-start gap-3 rounded-lg border border-ink/10 bg-cream/70 p-4 text-sm leading-6 text-ink/68">
                      <input
                        type="checkbox"
                        checked={gateDetails.consent}
                        onChange={(event) => setGateDetails((current) => ({ ...current, consent: event.target.checked }))}
                        className="mt-1 h-4 w-4 rounded border-ink/20 accent-teal"
                      />
                      <span>
                        Send me my scorecard summary and the MPR Employer Briefing. I understand my details will be used to respond to this enquiry and share relevant employer guidance.
                      </span>
                    </label>
                    <p className="text-xs leading-5 text-ink/50">
                      We will use your details only for this scorecard follow-up and relevant employer guidance. You can unsubscribe from the briefing at any time.
                    </p>
                    <button type="submit" disabled={isSubmitting} className="button-pill button-pill--primary disabled:opacity-100">
                      {isSubmitting ? "Preparing scorecard..." : "View my scorecard"}
                    </button>
                  </form>
                ) : null}

                {error ? (
                  <div className="mt-6 rounded-lg border border-brass/35 bg-parchment/55 p-4 text-sm font-semibold text-ink" role="alert">
                    {error}
                  </div>
                ) : null}

                {step < 5 ? (
                  <div className="mt-8 flex flex-col gap-3 border-t border-ink/10 pt-6 sm:flex-row sm:items-center sm:justify-between">
                    <button type="button" onClick={goBack} disabled={step === 0} className="button-pill disabled:opacity-100">
                      Previous
                    </button>
                    <button type="button" onClick={goNext} className="button-pill button-pill--primary">
                      {step === 4 ? "Continue to score" : "Next"}
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="container-px border-t border-ink/10 bg-cream py-6">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-center gap-2 text-center text-[11px] font-semibold uppercase tracking-[0.22em] text-ink/58 sm:flex-row">
          <span>Independent guidance</span>
          <span className="hidden sm:inline">|</span>
          <span>Provider-neutral</span>
          <span className="hidden sm:inline">|</span>
          <span>Employer-first</span>
        </div>
      </section>
    </>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 border-t border-ink/10 pt-4 first:border-t-0 first:pt-0 sm:grid-cols-[10rem_1fr]">
      <p className="text-sm font-semibold text-ink">{label}:</p>
      <p className="text-base leading-7 text-ink/68">{value}</p>
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  const id = label.toLowerCase().replace(/[^a-z0-9]+/g, "-");

  return (
    <div>
      <label htmlFor={id} className="text-sm font-semibold text-ink">{label}</label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 min-h-12 w-full rounded-lg border border-ink/12 bg-cream/70 px-4 text-base text-ink outline-none transition placeholder:text-ink/38 focus:border-teal/45 focus:bg-white/62 focus:ring-4 focus:ring-teal/10"
        required
      />
    </div>
  );
}

function OptionGroup({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <fieldset>
      <legend className="text-sm font-semibold text-ink">{label}</legend>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => onChange(option)}
            className={`rounded-lg border p-4 text-left text-sm font-semibold transition ${
              value === option
                ? "border-forest bg-forest text-cream"
                : "border-ink/10 bg-cream/70 text-ink hover:bg-white/70"
            }`}
          >
            {option}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function BlindSpotCard({ items }: { items: BlindSpot[] }) {
  return (
    <div className="premium-card rounded-xl p-6 md:p-7">
      <div className="max-w-2xl">
        <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-teal">Key blind spots</p>
        <p className="mt-3 text-sm leading-7 text-ink/58">
          These are the areas most likely to create missed opportunity or slow decision-making.
        </p>
      </div>
      <div className="mt-6 grid gap-4">
        {items.map((item) => (
          <article key={item.issue} className="rounded-xl border border-ink/10 bg-cream/55 p-5 md:p-7">
            <h3 className="display-heading text-[2rem] leading-[1.05] text-ink md:text-4xl">{item.issue}</h3>
            <div className="mt-6 max-w-3xl space-y-6">
              <InsightBlock label="What this means" copy={item.meaning} />
              <InsightBlock label="Why this matters" copy={item.whyItMatters} />
              <InsightBlock label="Potential next step" copy={item.nextStep} accent />
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function InsightBlock({
  label,
  copy,
  accent = false,
}: {
  label: string;
  copy: string;
  accent?: boolean;
}) {
  return (
    <div className={`border-t pt-4 ${accent ? "border-brass/30" : "border-ink/10"}`}>
      <p className={`text-[11px] font-semibold uppercase tracking-[0.12em] ${accent ? "text-brass" : "text-ink/48"}`}>
        {label}
      </p>
      <p className="mt-2 text-base leading-7 text-ink/68">{copy}</p>
    </div>
  );
}

function ReportCard({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="premium-card rounded-xl p-6">
      <p className="text-[12px] font-semibold uppercase tracking-[0.2em] text-teal">{title}</p>
      <div className="mt-5 grid gap-4">
        {items.map((item) => (
          <div key={item} className="flex gap-3">
            <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-brass" />
            <p className="text-base leading-7 text-ink/68">{item}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
