import type {
  LearningTimeAssistantConversationState,
  LearningTimeAssistantQuestion,
  LearningTimeAssistantRequest,
} from "@/lib/levytate/off-the-job/api";
import {
  assessConversationalOffTheJobEvidence,
  deriveActivityDurationMinutes,
  eligibleActivityCategories,
  excludedActivityCategories,
  type CandidateActivityAssessment,
  type OtjActivityCategory,
} from "@/lib/levytate/off-the-job/domain";

type LearnerProgrammeContext = {
  programmeName: string;
  standardId: string;
};

const categoryPatterns: ReadonlyArray<[RegExp, OtjActivityCategory]> = [
  [/\b(?:provider\s+)?progress review\b|\bperformance review\b|\bappraisal\b/i, "progress_review"],
  [/\b(?:onboarding|induction)\b/i, "onboarding"],
  [/\b(?:routine productive work|business as usual|normal duties)\b/i, "routine_productive_work"],
  [/\b(?:shadow(?:ed|ing)?|observ(?:e|ed|ing)|learning (?:with|from) (?:the )?\w+(?: team)?|with (?:the )?\w+ team learning)\b/i, "structured_shadowing"],
  [/\b(?:webinar|conference|workshop)\b/i, "provider_workshop"],
  [/\b(?:research(?:ed|ing)?)\b/i, "research"],
  [/\b(?:online course|online module|e-learning)\b/i, "structured_online_learning"],
  [/\b(?:coaching|mentoring)\b/i, "mentoring_or_coaching"],
  [/\b(?:lecture|seminar)\b/i, "theory_teaching"],
];

const numberWords: Readonly<Record<string, number>> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
};

export function createConversationState(): LearningTimeAssistantConversationState {
  return {
    turn: 0,
    durationMinutes: null,
    categoryCandidate: "",
    suppliedDescription: "",
    newLearningEvidence: "",
    standardRelevanceEvidence: "",
    workingHoursBasis: "not_confirmed",
    compensationNote: "",
    separateFromProductiveWork: null,
    productiveWorkAnswer: "",
  };
}

export function extractConversationState(
  request: LearningTimeAssistantRequest,
  programme: LearnerProgrammeContext,
): LearningTimeAssistantConversationState {
  const prompt = bounded(request.prompt, 3000);
  const previous = normaliseConversationState(request.conversationState);
  const next: LearningTimeAssistantConversationState = {
    ...previous,
    turn: Math.min(12, previous.turn + 1),
    suppliedDescription: previous.suppliedDescription || prompt,
  };

  applyQuickAnswer(next, request.answer);
  if (request.candidate?.category) next.categoryCandidate ||= request.candidate.category;
  if (request.candidate?.whatWasNew) next.newLearningEvidence ||= bounded(request.candidate.whatWasNew, 600);
  if (request.candidate?.standardRelevance) next.standardRelevanceEvidence ||= bounded(request.candidate.standardRelevance, 600);
  if (request.candidate?.workingHoursBasis) next.workingHoursBasis = request.candidate.workingHoursBasis;
  if (typeof request.candidate?.separateFromProductiveWork === "boolean") next.separateFromProductiveWork = request.candidate.separateFromProductiveWork;
  if (request.candidate?.startedAt && request.candidate.endedAt) {
    next.durationMinutes ??= deriveActivityDurationMinutes(request.candidate.startedAt, request.candidate.endedAt, Number(request.candidate.breakMinutes ?? 0)) || null;
  }
  next.durationMinutes ??= extractDurationMinutes(prompt);
  next.categoryCandidate ||= inferControlledCategory(prompt);
  next.newLearningEvidence ||= extractNewLearningEvidence(prompt);
  next.standardRelevanceEvidence ||= inferProgrammeRelevance(prompt, programme);
  inferWorkingHours(prompt, next);
  inferProductiveWork(prompt, next);
  return normaliseConversationState(next);
}

export function assessConversationState(state: LearningTimeAssistantConversationState): CandidateActivityAssessment {
  return assessConversationalOffTheJobEvidence({
    durationMinutes: state.durationMinutes,
    category: state.categoryCandidate,
    newLearningEvidence: state.newLearningEvidence,
    standardRelevance: state.standardRelevanceEvidence,
    workingHoursBasis: state.workingHoursBasis,
    compensationNote: state.compensationNote,
    separateFromProductiveWork: state.separateFromProductiveWork,
  });
}

export function nextConversationQuestion(
  state: LearningTimeAssistantConversationState,
  assessment: CandidateActivityAssessment,
): LearningTimeAssistantQuestion | null {
  if (assessment.outcome === "likely_ineligible") return null;
  if (state.durationMinutes === null) return question("duration", "Approximately how long did the learning activity take?");
  if (!state.categoryCandidate) return question("activity_type", "What kind of learning activity was this?");
  if (!state.newLearningEvidence) return question("new_learning", "What specifically was new to you?");
  if (!state.standardRelevanceEvidence) return question("standard_relevance", "How does this connect to your programme or an agreed learning priority?");
  if (state.workingHoursBasis === "not_confirmed") return question("working_hours", "Was this completed during your normal paid working hours?", [
    ["Yes", "normal_paid_hours"],
    ["No", "outside_unpaid"],
    ["Paid exception / TOIL", "paid_exception_or_toil"],
    ["Not sure", "not_sure"],
  ]);
  if ((state.workingHoursBasis === "paid_exception" || state.workingHoursBasis === "time_off_in_lieu_exception") && !state.compensationNote) {
    return question("compensation", "What paid exception or time-off-in-lieu arrangement applied?");
  }
  if (state.separateFromProductiveWork === null && state.productiveWorkAnswer === "partly") {
    return question("productive_work_detail", "Which part was structured learning, separate from work you were already competent to perform?");
  }
  if (state.separateFromProductiveWork === null) return question("productive_work", "Was this structured learning separate from routine work you already knew how to do?", [
    ["Yes", "separate"],
    ["No", "routine"],
    ["Partly", "partly"],
    ["Not sure", "not_sure"],
  ]);
  return null;
}

export function conversationCandidateFacts(state: LearningTimeAssistantConversationState, programme: LearnerProgrammeContext) {
  const facts: string[] = [];
  if (state.durationMinutes) facts.push(`Approximately ${formatDuration(state.durationMinutes)}`);
  if (state.categoryCandidate === "structured_shadowing") facts.push("Learning with or shadowing colleagues");
  if (/power\s*bi/i.test(state.suppliedDescription)) facts.push("Power BI dashboards");
  if (/\b(?:built|created|made)\s+(?:my\s+)?first\s+(?:power\s*bi\s+)?(?:report|dashboard)\b/i.test(state.suppliedDescription)) facts.push("Built a first report");
  if (state.newLearningEvidence) facts.push("New-learning evidence supplied");
  if (state.standardRelevanceEvidence) facts.push(`Appears relevant to ${programme.programmeName} (${programme.standardId})`);
  if (state.workingHoursBasis === "within_normal_working_hours") facts.push("Normal paid working hours confirmed");
  if (state.separateFromProductiveWork === true) facts.push("Separate from routine productive work confirmed");
  return facts.slice(0, 8);
}

export function inferControlledCategory(prompt: string): OtjActivityCategory | "" {
  return categoryPatterns.find(([pattern]) => pattern.test(prompt))?.[1] ?? "";
}

export function mergeAiCandidateState(
  deterministic: LearningTimeAssistantConversationState,
  candidate: unknown,
): LearningTimeAssistantConversationState {
  if (!candidate || typeof candidate !== "object") return deterministic;
  const value = candidate as Record<string, unknown>;
  const category = typeof value.categoryCandidate === "string" && isActivityCategory(value.categoryCandidate)
    ? value.categoryCandidate
    : "";
  const duration = finiteMinutes(value.durationMinutes);
  return normaliseConversationState({
    ...deterministic,
    durationMinutes: deterministic.durationMinutes ?? duration,
    categoryCandidate: deterministic.categoryCandidate || category,
    newLearningEvidence: deterministic.newLearningEvidence || bounded(value.newLearningEvidence, 600),
    standardRelevanceEvidence: deterministic.standardRelevanceEvidence || bounded(value.standardRelevanceEvidence, 600),
  });
}

function inferProgrammeRelevance(prompt: string, programme: LearnerProgrammeContext) {
  if (!/\b(?:ST0118|data analyst)\b/i.test(`${programme.standardId} ${programme.programmeName}`)) return "";
  if (!/\b(?:power\s*bi|data visuali[sz]ation|data cleansing|data analysis|analys(?:is|ing)|reporting|dashboard)\b/i.test(prompt)) return "";
  return `The described data and reporting activity appears relevant to the ${programme.programmeName} programme (${programme.standardId}).`;
}

function extractDurationMinutes(prompt: string) {
  const numeric = prompt.match(/\b(\d+(?:\.\d+)?)\s*(hours?|hrs?|minutes?|mins?)\b/i);
  if (numeric) return durationToMinutes(Number(numeric[1]), numeric[2]);
  const words = prompt.match(/\b(one|two|three|four|five|six|seven|eight)\s+(hours?|minutes?)\b/i);
  return words ? durationToMinutes(numberWords[words[1].toLowerCase()], words[2]) : null;
}

function extractNewLearningEvidence(prompt: string) {
  if (/\b(?:learning how|learned how|learnt how)\b/i.test(prompt) && /\bfirst\s+(?:report|dashboard)\b/i.test(prompt)) {
    return "Learned how dashboards are built and applied that learning by building a first report.";
  }
  if (/\b(?:first time|my first|new to me|new structured learning|learned how|learnt how|learning how)\b/i.test(prompt)) {
    return bounded(prompt, 600);
  }
  return "";
}

function inferWorkingHours(prompt: string, state: LearningTimeAssistantConversationState) {
  if (/\b(?:outside|after)\s+(?:my\s+)?(?:normal\s+)?working hours\b.*\b(?:unpaid|uncompensated)\b/i.test(prompt)) {
    state.workingHoursBasis = "outside_working_hours_uncompensated";
  } else if (/\b(?:normal paid hours|paid working (?:hours|time)|during (?:my )?(?:normal )?working hours)\b/i.test(prompt)) {
    state.workingHoursBasis = "within_normal_working_hours";
  } else if (/\btime off in lieu\b|\bTOIL\b/i.test(prompt)) {
    state.workingHoursBasis = "time_off_in_lieu_exception";
    state.compensationNote ||= bounded(prompt, 500);
  } else if (/\bpaid exception\b/i.test(prompt)) {
    state.workingHoursBasis = "paid_exception";
    state.compensationNote ||= bounded(prompt, 500);
  }
}

function inferProductiveWork(prompt: string, state: LearningTimeAssistantConversationState) {
  if (/\b(?:not (?:my )?(?:normal|routine)|separate from (?:my )?(?:normal|routine)|not work I (?:already )?knew how to do)\b/i.test(prompt)) {
    state.separateFromProductiveWork = true;
    state.productiveWorkAnswer = "";
  } else if (/\b(?:partly|a mixture|some of it)\b/i.test(prompt)) {
    state.separateFromProductiveWork = null;
    state.productiveWorkAnswer = "partly";
  } else if (/\b(?:routine work|normal weekly work|business as usual|work I already knew how to do)\b/i.test(prompt)) {
    state.separateFromProductiveWork = false;
    state.productiveWorkAnswer = "";
  }
}

function applyQuickAnswer(state: LearningTimeAssistantConversationState, answer: LearningTimeAssistantRequest["answer"]) {
  if (!answer) return;
  if (answer.questionId === "working_hours") {
    if (answer.value === "normal_paid_hours") state.workingHoursBasis = "within_normal_working_hours";
    if (answer.value === "outside_unpaid") state.workingHoursBasis = "outside_working_hours_uncompensated";
    if (answer.value === "paid_exception_or_toil") state.workingHoursBasis = "paid_exception";
  }
  if (answer.questionId === "productive_work") {
    if (answer.value === "separate") state.separateFromProductiveWork = true;
    if (answer.value === "routine") state.separateFromProductiveWork = false;
    if (answer.value === "partly") state.productiveWorkAnswer = "partly";
  }
}

function normaliseConversationState(value?: Partial<LearningTimeAssistantConversationState>): LearningTimeAssistantConversationState {
  const base = createConversationState();
  if (!value) return base;
  return {
    turn: Math.max(0, Math.min(12, Math.round(Number(value.turn) || 0))),
    durationMinutes: finiteMinutes(value.durationMinutes),
    categoryCandidate: typeof value.categoryCandidate === "string" && isActivityCategory(value.categoryCandidate) ? value.categoryCandidate : "",
    suppliedDescription: bounded(value.suppliedDescription, 3000),
    newLearningEvidence: bounded(value.newLearningEvidence, 600),
    standardRelevanceEvidence: bounded(value.standardRelevanceEvidence, 600),
    workingHoursBasis: ["within_normal_working_hours", "paid_exception", "time_off_in_lieu_exception", "outside_working_hours_uncompensated", "not_confirmed"].includes(String(value.workingHoursBasis)) ? value.workingHoursBasis! : "not_confirmed",
    compensationNote: bounded(value.compensationNote, 500),
    separateFromProductiveWork: typeof value.separateFromProductiveWork === "boolean" ? value.separateFromProductiveWork : null,
    productiveWorkAnswer: value.productiveWorkAnswer === "partly" || value.productiveWorkAnswer === "not_sure" ? value.productiveWorkAnswer : "",
  };
}

function isActivityCategory(value: string): value is OtjActivityCategory {
  return [...eligibleActivityCategories, ...excludedActivityCategories].includes(value as OtjActivityCategory);
}

function durationToMinutes(value: number, unit: string) {
  if (!Number.isFinite(value) || value <= 0 || value > 24 * 60) return null;
  return Math.round(value * (/^h/i.test(unit) ? 60 : 1));
}

function finiteMinutes(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 && number <= 24 * 60 ? Math.round(number) : null;
}

function formatDuration(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (!hours) return `${remainder} minutes`;
  return remainder ? `${hours} hours ${remainder} minutes` : `${hours} ${hours === 1 ? "hour" : "hours"}`;
}

function question(id: LearningTimeAssistantQuestion["id"], prompt: string, answers: Array<[string, string]> = []): LearningTimeAssistantQuestion {
  return { id, prompt, quickAnswers: answers.map(([label, value]) => ({ label, value })) };
}

function bounded(value: unknown, maximum: number) {
  return String(value ?? "").trim().slice(0, maximum);
}
