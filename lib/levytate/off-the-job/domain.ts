export const eligibleActivityCategories = [
  "provider_workshop",
  "theory_teaching",
  "practical_training",
  "structured_shadowing",
  "mentoring_or_coaching",
  "industry_visit",
  "learning_support",
  "assignment_or_project_writing",
  "research",
  "revision",
  "structured_online_learning",
  "employer_delivered_training",
  "other_eligible_learning",
] as const;

export const excludedActivityCategories = [
  "initial_assessment",
  "onboarding",
  "standalone_english_or_maths",
  "progress_review",
  "examination",
  "testing_or_assessment",
  "routine_productive_work",
  "unrelated_mandatory_training",
  "training_unrelated_to_standard",
  "repeated_practice",
  "outside_hours_uncompensated",
  "travel_without_learning",
  "epa_resit_preparation_after_requirement",
  "other_ineligible_activity",
] as const;

export type EligibleActivityCategory = (typeof eligibleActivityCategories)[number];
export type ExcludedActivityCategory = (typeof excludedActivityCategories)[number];
export type OtjActivityCategory = EligibleActivityCategory | ExcludedActivityCategory;
export type OtjEligibilityOutcome = "likely_eligible" | "needs_clarification" | "likely_ineligible";
export type OtjPolicyRegime = "legacy_percentage" | "standard_minimum";
export type OtjWorkingHoursBasis =
  | "within_normal_working_hours"
  | "paid_exception"
  | "time_off_in_lieu_exception"
  | "outside_working_hours_uncompensated"
  | "not_confirmed";

export type CandidateActivityAssessmentInput = {
  lifecycleStatus: string;
  activityDate: string;
  startedAt: string;
  endedAt: string;
  breakMinutes: number;
  category: OtjActivityCategory;
  whatWasNew: string;
  standardRelevance: string;
  workingHoursBasis: OtjWorkingHoursBasis;
  compensationNote?: string;
  separateFromProductiveWork: boolean | null;
  evidenceReference?: string;
  practicalPeriodStartDate?: string | null;
  practicalPeriodEndDate?: string | null;
  activeBreakStartDate?: string | null;
  activeBreakEndDate?: string | null;
  overlappingActivity?: boolean;
};

export type CandidateActivityAssessment = {
  outcome: OtjEligibilityOutcome;
  durationMinutes: number;
  passedTests: string[];
  failedTests: string[];
  clarificationItems: string[];
  reasons: string[];
  warnings: string[];
};

export type LearningTimeTotals = {
  learnerRecordedMinutes: number;
  employerCheckedMinutes: number;
  providerConfirmedMinutes: number;
  remainingMinutes: number;
};

export type LearningTimeActivityForTotals = {
  id: string;
  durationMinutes: number;
  status: "draft" | "submitted" | "needs_information" | "employer_checked" | "not_counted" | "withdrawn";
};

export type LearningTimeConfirmationForTotals = {
  activityId: string;
  outcome: "confirmed" | "partially_confirmed" | "not_confirmed" | "superseded";
  confirmedMinutes: number;
  recordedAt: string;
};

const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;
const timePattern = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function policyRegimeForOriginalStartDate(originalStartDate: string): OtjPolicyRegime {
  return originalStartDate >= "2025-08-01" ? "standard_minimum" : "legacy_percentage";
}

export function deriveActivityDurationMinutes(startedAt: string, endedAt: string, breakMinutes: number) {
  const start = parseClockMinutes(startedAt);
  const end = parseClockMinutes(endedAt);
  if (start === null || end === null || !Number.isInteger(breakMinutes) || breakMinutes < 0) return 0;
  return Math.max(0, end - start - breakMinutes);
}

export function assessCandidateOffTheJobActivity(input: CandidateActivityAssessmentInput): CandidateActivityAssessment {
  const durationMinutes = deriveActivityDurationMinutes(input.startedAt, input.endedAt, input.breakMinutes);
  const failedTests: string[] = [];
  const clarificationItems: string[] = [];
  const passedTests: string[] = [];
  const reasons: string[] = [];
  const warnings: string[] = [];
  const excluded = (excludedActivityCategories as readonly string[]).includes(input.category);

  if (!isoDatePattern.test(input.activityDate)) failedTests.push("A valid activity date is required.");
  if (durationMinutes <= 0) failedTests.push("The activity must have a positive duration after breaks.");
  if (excluded) failedTests.push("The selected activity category is excluded from off-the-job training.");
  else passedTests.push("The selected category is not an excluded activity.");

  if (!input.whatWasNew.trim()) clarificationItems.push("What knowledge, skill or behaviour was genuinely new?");
  else passedTests.push("The learner described new learning.");

  if (!input.standardRelevance.trim()) clarificationItems.push("How did this activity relate directly to the apprenticeship standard or current learning priority?");
  else passedTests.push("The learner described relevance to the apprenticeship.");

  if (input.workingHoursBasis === "outside_working_hours_uncompensated") {
    failedTests.push("Uncompensated learning outside normal working hours cannot be counted.");
  } else if (input.workingHoursBasis === "not_confirmed") {
    clarificationItems.push("Confirm whether the activity took place during paid normal working hours.");
  } else if (input.workingHoursBasis === "paid_exception" || input.workingHoursBasis === "time_off_in_lieu_exception") {
    if (!input.compensationNote?.trim()) clarificationItems.push("Record the attributable paid or time-off-in-lieu arrangement.");
    else passedTests.push("An exceptional compensated working-hours arrangement was recorded.");
    warnings.push("Repeated out-of-hours exceptions require employer and provider review; most training must not be delivered this way.");
  } else {
    passedTests.push("The activity was recorded within normal paid working hours.");
  }

  if (input.separateFromProductiveWork === false) failedTests.push("The activity was recorded as routine productive work rather than separate learning.");
  else if (input.separateFromProductiveWork === null) clarificationItems.push("Was the learning separate from normal productive work?");
  else passedTests.push("The activity was recorded as separate from normal productive work.");

  if (input.practicalPeriodStartDate && input.activityDate < input.practicalPeriodStartDate) {
    failedTests.push("The activity occurred before the practical period started.");
  }
  if (input.practicalPeriodEndDate && input.activityDate > input.practicalPeriodEndDate) {
    failedTests.push("The activity occurred after the practical period ended.");
  }
  if (dateFallsWithin(input.activityDate, input.activeBreakStartDate, input.activeBreakEndDate)) {
    failedTests.push("Ordinary off-the-job activity cannot be recorded during an active break in learning.");
  }
  if (input.lifecycleStatus === "break_in_learning") {
    failedTests.push("The learner is currently on a break in learning.");
  }

  if (input.overlappingActivity) {
    clarificationItems.push("This time overlaps another learning activity and requires employer review before it can be counted.");
    warnings.push("Overlapping time is not added silently to learning totals.");
  }
  if (!input.evidenceReference?.trim()) {
    clarificationItems.push("Add an evidence reference where one would reasonably be expected.");
  }

  const outcome: OtjEligibilityOutcome = failedTests.length
    ? "likely_ineligible"
    : clarificationItems.length
      ? "needs_clarification"
      : "likely_eligible";

  reasons.push(...(failedTests.length ? failedTests : clarificationItems.length ? clarificationItems : [
    "The candidate activity passes the four deterministic pre-checks using the information supplied.",
  ]));
  warnings.push("This is a preparation check, not a compliance decision. The training provider remains responsible for confirming the evidence used for off-the-job training.");

  return { outcome, durationMinutes, passedTests, failedTests, clarificationItems, reasons, warnings };
}

export function calculateLearningTimeTotals(input: {
  individualMinimumMinutes: number;
  activities: LearningTimeActivityForTotals[];
  confirmations: LearningTimeConfirmationForTotals[];
}): LearningTimeTotals {
  const learnerRecordedMinutes = input.activities
    .filter((activity) => ["submitted", "needs_information", "employer_checked"].includes(activity.status))
    .reduce((sum, activity) => sum + Math.max(0, activity.durationMinutes), 0);
  const employerCheckedMinutes = input.activities
    .filter((activity) => activity.status === "employer_checked")
    .reduce((sum, activity) => sum + Math.max(0, activity.durationMinutes), 0);

  const latestByActivity = new Map<string, LearningTimeConfirmationForTotals>();
  [...input.confirmations]
    .sort((left, right) => left.recordedAt.localeCompare(right.recordedAt))
    .forEach((confirmation) => latestByActivity.set(confirmation.activityId, confirmation));
  const providerConfirmedMinutes = [...latestByActivity.values()]
    .filter((confirmation) => confirmation.outcome === "confirmed" || confirmation.outcome === "partially_confirmed")
    .reduce((sum, confirmation) => sum + Math.max(0, confirmation.confirmedMinutes), 0);

  return {
    learnerRecordedMinutes,
    employerCheckedMinutes,
    providerConfirmedMinutes,
    remainingMinutes: Math.max(0, Math.max(0, input.individualMinimumMinutes) - providerConfirmedMinutes),
  };
}

export function activityCategoryLabel(category: OtjActivityCategory) {
  return category.split("_").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}

function parseClockMinutes(value: string) {
  const match = value.match(timePattern);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function dateFallsWithin(date: string, start?: string | null, end?: string | null) {
  if (!start || date < start) return false;
  return !end || date <= end;
}
