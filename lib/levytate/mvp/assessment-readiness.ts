import type {
  LearnerAssessmentModel,
  LearnerAssessmentReadiness,
  LearnerLifecycleStatus,
  LearnerProgressUpdate,
  LearnerReview,
} from "@/lib/levytate/mvp/learner-lifecycle";
import { deriveProgressPosition } from "@/lib/levytate/mvp/learner-record-view";

export const assessmentReadinessPolicy = {
  eligibleStatuses: ["enrolled", "assessment_preparation"] as LearnerLifecycleStatus[],
  readinessDateApproachingDays: 30,
  gatewayDateApproachingDays: 30,
  maximumFutureDateYears: 3,
  gatewayRequiredModels: ["end_point_assessment"] as LearnerAssessmentModel[],
  organisationRequiredModels: ["end_point_assessment", "other"] as LearnerAssessmentModel[],
} as const;

export const assessmentModelLabels = {
  end_point_assessment: "End-point assessment",
  integrated_assessment: "Integrated assessment",
  other: "Other",
  not_confirmed: "Not yet confirmed",
} as const satisfies Record<LearnerAssessmentModel, string>;

export const assessmentConfirmationTypes = ["provider", "learner", "line_manager", "employer"] as const;
export type AssessmentConfirmationType = typeof assessmentConfirmationTypes[number];

export const assessmentConfirmationTypeLabels: Record<AssessmentConfirmationType, string> = {
  provider: "Provider confirms readiness",
  learner: "Learner confirms readiness",
  line_manager: "Line Manager confirms workplace readiness",
  employer: "Apprenticeship Lead confirms employer readiness",
};

export const assessmentConfirmationStatuses = [
  "not_requested",
  "awaiting_confirmation",
  "confirmed",
  "not_confirmed",
  "more_information_required",
] as const;
export type AssessmentConfirmationStatus = typeof assessmentConfirmationStatuses[number];

export const assessmentConfirmationStatusLabels: Record<AssessmentConfirmationStatus, string> = {
  not_requested: "Not requested",
  awaiting_confirmation: "Awaiting confirmation",
  confirmed: "Confirmed",
  not_confirmed: "Not confirmed",
  more_information_required: "More information required",
};

export type AssessmentReadinessConfirmation = {
  type: AssessmentConfirmationType;
  status: AssessmentConfirmationStatus;
  confirmedDate: string;
  confirmedBy: string;
  recordedOnBehalfOf: string;
  note: string;
  evidenceReference: string;
  updatedBy: string;
  updatedAt: string;
};

export type AssessmentReadinessConfirmations = Record<AssessmentConfirmationType, AssessmentReadinessConfirmation>;
export type AssessmentReadinessCheckStatus = "Complete" | "Outstanding" | "Blocking" | "Warning";

export type AssessmentReadinessCheck = {
  id: string;
  label: string;
  status: AssessmentReadinessCheckStatus;
  message: string;
};

export type AssessmentReadinessResult = {
  readyForAssessment: boolean;
  checks: AssessmentReadinessCheck[];
  completedChecks: AssessmentReadinessCheck[];
  outstandingChecks: AssessmentReadinessCheck[];
  blockingChecks: AssessmentReadinessCheck[];
  warningChecks: AssessmentReadinessCheck[];
};

export type AssessmentReadinessDerivationInput = {
  lifecycleStatus: LearnerLifecycleStatus;
  activeBreak: boolean;
  programmeId: string;
  providerId: string;
  readiness: LearnerAssessmentReadiness | null;
  latestProgress: LearnerProgressUpdate | null;
  latestProviderReview: LearnerReview | null;
  criticalOperationalBlockers?: string[];
};

export function emptyAssessmentReadinessConfirmation(type: AssessmentConfirmationType): AssessmentReadinessConfirmation {
  return { type, status: "not_requested", confirmedDate: "", confirmedBy: "", recordedOnBehalfOf: "", note: "", evidenceReference: "", updatedBy: "", updatedAt: "" };
}

export function emptyAssessmentReadinessConfirmations(): AssessmentReadinessConfirmations {
  return {
    provider: emptyAssessmentReadinessConfirmation("provider"),
    learner: emptyAssessmentReadinessConfirmation("learner"),
    line_manager: emptyAssessmentReadinessConfirmation("line_manager"),
    employer: emptyAssessmentReadinessConfirmation("employer"),
  };
}

export function normaliseAssessmentReadinessConfirmations(value: unknown): AssessmentReadinessConfirmations {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const result = emptyAssessmentReadinessConfirmations();
  assessmentConfirmationTypes.forEach((type) => {
    const item = source[type] && typeof source[type] === "object" && !Array.isArray(source[type]) ? source[type] as Record<string, unknown> : {};
    result[type] = {
      type,
      status: assessmentConfirmationStatuses.includes(item.status as AssessmentConfirmationStatus) ? item.status as AssessmentConfirmationStatus : "not_requested",
      confirmedDate: text(item.confirmedDate),
      confirmedBy: text(item.confirmedBy),
      recordedOnBehalfOf: text(item.recordedOnBehalfOf),
      note: text(item.note),
      evidenceReference: text(item.evidenceReference),
      updatedBy: text(item.updatedBy),
      updatedAt: text(item.updatedAt),
    };
  });
  return result;
}

export function assessmentModelUsesGateway(model: LearnerAssessmentModel) {
  return assessmentReadinessPolicy.gatewayRequiredModels.includes(model);
}

export function assessmentOrganisationRequired(model: LearnerAssessmentModel) {
  return assessmentReadinessPolicy.organisationRequiredModels.includes(model);
}

export function deriveAssessmentReadiness(input: AssessmentReadinessDerivationInput): AssessmentReadinessResult {
  const checks: AssessmentReadinessCheck[] = [];
  const readiness = input.readiness;
  const confirmations = readiness?.confirmations ?? emptyAssessmentReadinessConfirmations();
  const eligible = assessmentReadinessPolicy.eligibleStatuses.includes(input.lifecycleStatus);

  checks.push(check("eligible-lifecycle-status", "Eligible lifecycle status", eligible ? "Complete" : "Blocking", eligible ? "Learner is enrolled or preparing for assessment." : "Learner must be enrolled or in assessment preparation."));
  checks.push(check("not-on-break", "Active learning", input.activeBreak ? "Blocking" : "Complete", input.activeBreak ? "Return the learner from their Break in Learning before assessment progression." : "Learner is not on a Break in Learning."));
  checks.push(check("programme-provider-confirmed", "Programme and provider confirmed", input.programmeId && input.providerId ? "Complete" : "Blocking", input.programmeId && input.providerId ? "Programme and provider are linked to the learner record." : "Confirm both programme and provider."));

  const modelConfirmed = Boolean(readiness && readiness.assessmentModel !== "not_confirmed");
  checks.push(check("assessment-model-confirmed", "Assessment model confirmed", modelConfirmed ? "Complete" : "Blocking", modelConfirmed ? "Assessment model is recorded." : "Confirm the assessment model."));

  const organisationRequired = readiness ? assessmentOrganisationRequired(readiness.assessmentModel) : false;
  const organisationRecorded = Boolean(readiness?.assessmentOrganisation);
  checks.push(check("assessment-organisation-recorded", "Assessment organisation recorded", organisationRecorded ? "Complete" : organisationRequired ? "Blocking" : "Warning", organisationRecorded ? "Assessment organisation is recorded." : organisationRequired ? "Record the assessment organisation for this assessment model." : "Assessment organisation is not yet recorded."));

  checks.push(check("latest-progress-recorded", "Latest progress recorded", input.latestProgress ? "Complete" : "Blocking", input.latestProgress ? `Latest actual progress is ${input.latestProgress.actualProgressPercentage}% against ${input.latestProgress.targetProgressPercentage}% target.` : "Record a current progress update before readiness review."));
  if (input.latestProgress) {
    const position = deriveProgressPosition(input.latestProgress);
    const behind = position === "Slightly behind" || position === "Significantly behind";
    checks.push(check("progress-position-reviewed", "Progress position reviewed", behind ? "Warning" : "Complete", behind ? `${position}. Readiness must be supported by provider evidence and programme-specific judgement.` : `${position}. Progress alone does not confirm assessment readiness.`));
  }

  checks.push(check("latest-provider-review-recorded", "Latest provider review recorded", input.latestProviderReview ? "Complete" : "Blocking", input.latestProviderReview ? `Provider review recorded on ${input.latestProviderReview.reviewDate}.` : "Record a current provider review."));

  assessmentConfirmationTypes.forEach((type) => {
    const confirmation = confirmations[type];
    const confirmed = confirmation.status === "confirmed";
    const negative = confirmation.status === "not_confirmed" || confirmation.status === "more_information_required";
    checks.push(check(`${type}-readiness-confirmation`, assessmentConfirmationTypeLabels[type], confirmed ? "Complete" : negative ? "Blocking" : "Outstanding", confirmed ? `Confirmed${confirmation.confirmedDate ? ` on ${confirmation.confirmedDate}` : ""}.` : negative ? confirmation.note || `${assessmentConfirmationTypeLabels[type]} is not confirmed.` : `${assessmentConfirmationStatusLabels[confirmation.status]}.`));
  });

  const expectedDate = readiness?.expectedAssessmentReadinessDate || readiness?.gatewayDate || "";
  checks.push(check("readiness-date-recorded", assessmentModelUsesGateway(readiness?.assessmentModel ?? "not_confirmed") ? "Expected readiness or gateway date recorded" : "Expected readiness date recorded", expectedDate ? "Complete" : "Blocking", expectedDate ? `Readiness planning date is ${expectedDate}.` : "Record the expected readiness date."));
  if (assessmentModelUsesGateway(readiness?.assessmentModel ?? "not_confirmed")) {
    checks.push(check("gateway-date-recorded", "Gateway date recorded", readiness?.gatewayDate ? "Complete" : "Blocking", readiness?.gatewayDate ? `Gateway is recorded for ${readiness.gatewayDate}.` : "Record the gateway date for this end-point assessment model."));
  }

  (input.criticalOperationalBlockers ?? []).forEach((blocker, index) => checks.push(check(`critical-operational-blocker-${index + 1}`, "Critical operational blocker", "Blocking", blocker)));

  const completedChecks = checks.filter((item) => item.status === "Complete");
  const outstandingChecks = checks.filter((item) => item.status === "Outstanding");
  const blockingChecks = checks.filter((item) => item.status === "Blocking");
  const warningChecks = checks.filter((item) => item.status === "Warning");
  return { readyForAssessment: blockingChecks.length === 0 && outstandingChecks.length === 0, checks, completedChecks, outstandingChecks, blockingChecks, warningChecks };
}

function check(id: string, label: string, status: AssessmentReadinessCheckStatus, message: string): AssessmentReadinessCheck {
  return { id, label, status, message };
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}
