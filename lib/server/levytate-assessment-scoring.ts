import type { AssessmentAnswerMap, CapabilityDimension, CapabilityIntelligence, WorkforceAssessmentResult } from "@/lib/levytate/assessments/domain";
import {
  comprehensiveAssessmentQuestions,
  comprehensiveAssessmentQuestionsV2,
  comprehensiveQuestionnaireVersion,
  comprehensiveQuestionnaireVersionV2,
} from "@/lib/levytate/assessments/framework-registry";

// Deliberately server-only. Never import this module from a client component.
const practicalAnswerKey: Readonly<Record<string, string>> = { pv1: "B", pv2: "C", pv3: "B", pv4: "C" };
const practicalIds = Object.keys(practicalAnswerKey);
const dimensions: CapabilityDimension[] = ["aiUnderstanding", "generalUsage", "responsibleUse", "practicalApplication", "verificationJudgement", "contribution"];
const weights: Record<CapabilityDimension, number> = { aiUnderstanding: .15, generalUsage: .20, responsibleUse: .20, practicalApplication: .20, verificationJudgement: .20, contribution: .05 };
const idsByDimensionV2: Record<CapabilityDimension, string[]> = {
  aiUnderstanding: ["un1", "un2", "un3", "un4", "un5"],
  generalUsage: ["ex1", "ex2", "ex3", "ex4", "ex5", "ex6", "ex7"],
  responsibleUse: ["re1", "re2", "re3", "re4", "re5"],
  practicalApplication: ["ap1", "ap2", "ap3", "ap4", "ap5"],
  verificationJudgement: ["ve1", "ve2", "ve3", "ve4", "ve5"],
  contribution: ["co1", "co2", "co3", "co4", "co5"],
};

const idsByDimension: Record<CapabilityDimension, string[]> = {
  ...idsByDimensionV2,
  generalUsage: ["ex1", "ex2", "ex4", "ex5", "ex6", "ex7"],
};

export function interpretComprehensiveAssessment(answers: AssessmentAnswerMap): WorkforceAssessmentResult {
  return interpretComprehensiveAssessmentVersion(answers, {
    questionnaireVersion: comprehensiveQuestionnaireVersion,
    ids: idsByDimension,
    directConfidenceEvidence: true,
  });
}

export function interpretComprehensiveAssessmentV2(answers: AssessmentAnswerMap): WorkforceAssessmentResult {
  return interpretComprehensiveAssessmentVersion(answers, {
    questionnaireVersion: comprehensiveQuestionnaireVersionV2,
    ids: idsByDimensionV2,
    directConfidenceEvidence: false,
  });
}

function interpretComprehensiveAssessmentVersion(answers: AssessmentAnswerMap, config: {
  questionnaireVersion: string;
  ids: Record<CapabilityDimension, string[]>;
  directConfidenceEvidence: boolean;
}): WorkforceAssessmentResult {
  const dimensionScores = Object.fromEntries(dimensions.flatMap((dimension) => {
    const values = config.ids[dimension].map((id) => scoreValue(answers[id])).filter((value): value is number => value !== null);
    return values.length ? [[dimension, Math.round(values.reduce((sum, value) => sum + value, 0) / values.length)]] : [];
  })) as Partial<Record<CapabilityDimension, number>>;
  const weighted = dimensions.flatMap((dimension) => dimensionScores[dimension] === undefined ? [] : [{ value: dimensionScores[dimension]!, weight: weights[dimension] }]);
  const overallIndicator = weighted.length ? Math.round(weighted.reduce((sum, item) => sum + item.value * item.weight, 0) / weighted.reduce((sum, item) => sum + item.weight, 0)) : null;
  const scenarioAnswers = practicalIds.filter((id) => typeof answers[id] === "string" && answers[id] !== "");
  const practicalJudgement = scenarioAnswers.length === practicalIds.length ? practicalIds.filter((id) => answers[id] === practicalAnswerKey[id]).length * 25 : null;
  const confidenceEvidence = config.directConfidenceEvidence ? scoreValue(answers.ex6) : dimensionScores.generalUsage;
  const confidenceAlignment = confidenceEvidence === null || confidenceEvidence === undefined || practicalJudgement === null ? "Further review recommended" : confidenceEvidence - practicalJudgement > 15 ? "Confidence ahead of evidence" : confidenceEvidence - practicalJudgement < -15 ? "Capability may be understated" : "Aligned";
  const personalFrequency = scoreValue(answers.ex1) ?? 0;
  const workplaceFrequency = scoreValue(answers.ex2) ?? 0;
  const personalCases = array(answers.personalUseCases);
  const workplaceCases = array(answers.workplaceUseCases).filter((item) => item !== "I do not currently use AI at work");
  const personalEvidence = personalFrequency >= 25 || personalCases.length >= 3;
  const transferableExperience: CapabilityIntelligence["transferableExperience"] = !personalEvidence && workplaceFrequency === 0 && !workplaceCases.length
    ? "Not currently evidenced"
    : personalEvidence && workplaceFrequency <= 25 && workplaceCases.length <= 1 && (practicalJudgement ?? 0) >= 50 && (dimensionScores.responsibleUse ?? 0) >= 40
      ? "Personal experience not yet applied at work"
      : workplaceFrequency >= 75 && workplaceCases.length >= 3 && (practicalJudgement ?? 0) >= 50 && (dimensionScores.responsibleUse ?? 0) >= 50
        ? "Established workplace application"
        : "Emerging workplace application";
  const profile = profileFor(answers, dimensionScores, practicalJudgement);
  const internalBand = overallIndicator === null || practicalJudgement === null ? "Further review required" : overallIndicator < 40 ? "Foundation" : overallIndicator < 60 ? "Developing" : overallIndicator < 80 ? "Applied" : (dimensionScores.responsibleUse ?? 0) < 40 || (dimensionScores.verificationJudgement ?? 0) < 40 || practicalJudgement < 50 ? "Applied" : "Advanced";
  const cohorts = cohortsFor({ profile, internalBand, overallIndicator, dimensions: dimensionScores, practicalJudgement, confidenceAlignment, transferableExperience, workplaceFrequency, workplaceCases });
  const strengths = dimensions.filter((dimension) => (dimensionScores[dimension] ?? -1) >= 70).map(dimensionLabel);
  const developmentNeeds = dimensions.filter((dimension) => (dimensionScores[dimension] ?? 101) < 55).map((dimension) => `${dimensionLabel(dimension)} development`);
  const barrierAnswer = text(answers.barrier);
  const barrier = !barrierAnswer || barrierAnswer === "no_current_barrier" || barrierAnswer === "not_applicable" ? null : barrierAnswer;
  const opportunity = text(answers.opportunity) || null;
  const intelligence: CapabilityIntelligence = {
    frameworkVersion: config.questionnaireVersion,
    internalBand,
    developmentProfile: profile,
    dimensionScores,
    overallIndicator,
    practicalJudgement,
    confidenceAlignment,
    transferableExperience,
    workplaceUsePattern: workplaceUsePattern(answers.ex3, workplaceFrequency),
    barrier,
    opportunity,
    developmentCohorts: cohorts,
    evidenceCoverage: { answeredScored: dimensions.reduce((count, dimension) => count + config.ids[dimension].filter((id) => scoreValue(answers[id]) !== null).length, 0), availableScored: dimensions.reduce((count, dimension) => count + config.ids[dimension].length, 0), practicalScenariosAnswered: scenarioAnswers.length },
    methodology: config.directConfidenceEvidence
      ? "Internal development indicators use relevant scored responses only. Usage context is categorical, and the confidence item is compared separately with four indicative workplace scenarios. The scenarios are limited judgement evidence, not certification or validated competency thresholds."
      : "Internal development indicators use available relevant responses only. Missing, unknown and not-applicable responses are excluded. Six self-report dimensions are weighted 15/20/20/20/20/5 and interpreted alongside four confidential workplace scenarios. These are not validated competency thresholds.",
  };
  return {
    strengths: strengths.length ? strengths : ["Further evidence is needed before identifying a reliable strength pattern"],
    developmentNeeds: developmentNeeds.length ? developmentNeeds : ["No immediate dimension-level development need is indicated"],
    practicalOpportunity: opportunity || "A practical workplace opportunity still needs to be identified.",
    workplaceConstraints: barrier ? [barrier] : [],
    possibleRoutes: routesFor(cohorts),
    discussionPoints: ["Review the evidence in the employee's role context.", "Agree a proportionate workplace development action and accountable owner.", "Confirm programme suitability, prior learning, eligibility and funding separately from this assessment."],
    evidenceDomains: [
      { domain: "technical", answered: intelligence.evidenceCoverage.answeredScored, relevant: intelligence.evidenceCoverage.availableScored },
      { domain: "non_technical", answered: opportunity ? 1 : 0, relevant: 1 },
      { domain: "responsible_ethical", answered: config.ids.responsibleUse.filter((id) => scoreValue(answers[id]) !== null).length, relevant: config.ids.responsibleUse.length },
    ],
    disclaimer: "Internal, indicative development intelligence only. It is not a certified competence score, employment decision, apprenticeship eligibility decision, programme approval or provider recommendation.",
    capabilityIntelligence: intelligence,
  };
}

export function validateComprehensiveAnswers(answers: AssessmentAnswerMap) {
  const missing = comprehensiveAssessmentQuestions.filter((question) => question.required && unanswered(answers[question.id]));
  return missing.length ? { valid: false as const, message: `Please answer ${missing.length} remaining question${missing.length === 1 ? "" : "s"}.`, missing: missing.map((question) => question.id) } : { valid: true as const, missing: [] as string[] };
}

export function validateComprehensiveAnswersV2(answers: AssessmentAnswerMap) {
  const missing = comprehensiveAssessmentQuestionsV2.filter((question) => question.required && unanswered(answers[question.id]));
  return missing.length ? { valid: false as const, message: `Please answer ${missing.length} remaining question${missing.length === 1 ? "" : "s"}.`, missing: missing.map((question) => question.id) } : { valid: true as const, missing: [] as string[] };
}

function workplaceUsePattern(context: unknown, workplaceFrequency: number) {
  if (context === "personal") return "Personal use only";
  if (context === "workplace") return "Workplace use only";
  if (context === "both") return "Personal and workplace use";
  if (context === "never") return "No current use reported";
  return workplaceFrequency >= 75 ? "Frequent workplace use" : workplaceFrequency >= 50 ? "Developing workplace use" : "Limited current workplace use";
}

function profileFor(answers: AssessmentAnswerMap, scores: Partial<Record<CapabilityDimension, number>>, practical: number | null): CapabilityIntelligence["developmentProfile"] {
  if ((scoreValue(answers.co3) ?? 0) >= 75 && (practical ?? 0) >= 75) return "Technical";
  if ((scoreValue(answers.co5) ?? 0) >= 75 && (scores.contribution ?? 0) >= 65) return "Leader";
  if ((scores.contribution ?? 0) >= 65 && (practical ?? 0) >= 75 && (scores.responsibleUse ?? 0) >= 65) return "Enabler";
  return "User";
}

function cohortsFor(input: { profile: CapabilityIntelligence["developmentProfile"]; internalBand: CapabilityIntelligence["internalBand"]; overallIndicator: number | null; dimensions: Partial<Record<CapabilityDimension, number>>; practicalJudgement: number | null; confidenceAlignment: CapabilityIntelligence["confidenceAlignment"]; transferableExperience: CapabilityIntelligence["transferableExperience"]; workplaceFrequency: number; workplaceCases: string[] }) {
  if (input.confidenceAlignment === "Further review recommended") return ["Further assessment"];
  const cohorts: string[] = [];
  if (input.internalBand === "Foundation") cohorts.push("Foundation support");
  if (input.workplaceFrequency <= 25 || input.internalBand === "Developing") cohorts.push("Role-specific development");
  if (input.workplaceFrequency >= 75 && ((input.dimensions.responsibleUse ?? 100) < 60 || (input.dimensions.verificationJudgement ?? 100) < 55 || (input.practicalJudgement ?? 100) < 50)) cohorts.push("Responsible-use support");
  if (input.transferableExperience === "Personal experience not yet applied at work") cohorts.push("Transferable capability activation");
  if (input.profile === "Enabler") cohorts.push("Potential AI Enablers");
  if (input.profile === "Technical") cohorts.push("Technical development");
  if (input.profile === "Leader") cohorts.push("Leadership development");
  if ((input.overallIndicator ?? 0) >= 48 && (input.overallIndicator ?? 0) <= 65 && (input.practicalJudgement ?? 0) >= 75 && input.workplaceCases.length >= 2) cohorts.push("Apprenticeship pathway review");
  return cohorts.length ? cohorts : ["No immediate targeted intervention"];
}

function routesFor(cohorts: string[]): WorkforceAssessmentResult["possibleRoutes"] {
  const map: Record<string, WorkforceAssessmentResult["possibleRoutes"][number]> = {
    "Foundation support": { route: "focused_training", label: "Foundation support", rationale: "Use short, safe learning with approved tools and guided practice." },
    "Role-specific development": { route: "workplace_project", label: "Role-specific development", rationale: "Apply learning to a defined, low-risk workplace task with human review." },
    "Responsible-use support": { route: "focused_training", label: "Responsible-use support", rationale: "Prioritise approved-tool guidance, information handling and output verification." },
    "Potential AI Enablers": { route: "mentoring", label: "Enabler development", rationale: "Validate interest before developing peer support and workflow improvement capability." },
    "Technical development": { route: "workplace_project", label: "Technical development", rationale: "Use governed project-based development aligned to genuine technical responsibilities." },
    "Leadership development": { route: "focused_training", label: "Leadership development", rationale: "Focus on governance, sponsorship and workforce adoption decisions." },
    "Apprenticeship pathway review": { route: "investigate_apprenticeship", label: "Apprenticeship pathway review", rationale: "Review occupational relevance, prior learning, eligibility and funding separately." },
    "Further assessment": { route: "no_immediate_action", label: "Further diagnostic review", rationale: "Obtain sufficient evidence before selecting an intervention." },
  };
  const routes = cohorts.flatMap((cohort) => map[cohort] ? [map[cohort]] : []);
  return routes.length ? [...new Map(routes.map((route) => [route.label, route])).values()] : [{ route: "no_immediate_action", label: "No immediate targeted intervention", rationale: "Maintain guidance and reassess as role needs change." }];
}

function scoreValue(value: unknown) { const numeric = typeof value === "string" && /^[1-5]$/.test(value) ? Number(value) : null; return numeric === null ? null : Math.round(((numeric - 1) / 4) * 100); }
function unanswered(value: unknown) { return value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0); }
function array(value: unknown) { return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []; }
function text(value: unknown) { return typeof value === "string" ? value.trim().slice(0, 4000) : ""; }
function dimensionLabel(dimension: CapabilityDimension) { return ({ aiUnderstanding: "AI understanding", generalUsage: "Personal and workplace AI use", responsibleUse: "Safe and responsible AI use", practicalApplication: "Practical AI application", verificationJudgement: "Checking and evaluating AI outputs", contribution: "Contribution to wider AI adoption" })[dimension]; }
