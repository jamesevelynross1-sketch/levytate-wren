import {
  learnerEmploymentRouteLabels,
  learnerLifecycleStatusLabels,
  learnerOperationalActionLabels,
  type LearnerAssessmentReadiness,
  type LearnerBreakInLearning,
  type LearnerEligibilityDeclaration,
  type LearnerEmploymentRoute,
  type LearnerLifecycleEvent,
  type LearnerLifecycleStatus,
  type LearnerOperationalAction,
  type LearnerPreEnrolmentChecks,
  type LearnerProgressUpdate,
  type LearnerReview,
  type LearnerWithdrawal,
} from "@/lib/levytate/mvp/learner-lifecycle";

export type LearnerProgressPosition = "Ahead of target" | "On target" | "Behind target" | "No progress data";
export type LearnerAttentionSeverity = "none" | "low" | "medium" | "high";

export type LearnerPersonSnapshot = {
  id: string;
  name: string;
  email: string;
  jobTitle: string;
  department: string;
  team: string;
  site: string;
  managerName: string;
};

export type LearnerProgrammeSnapshot = {
  programmeId: string;
  programmeName: string;
  apprenticeshipStandardId: string;
  apprenticeshipStandardTitle: string;
  apprenticeshipStandardReference: string;
  providerId: string;
  providerName: string;
  applicationReference: string;
};

export type LearnerOperationalSummary = {
  learnerRecordId: string;
  learner: LearnerPersonSnapshot;
  programme: LearnerProgrammeSnapshot;
  lifecycleStatus: LearnerLifecycleStatus;
  lifecycleStatusLabel: string;
  employmentRoute: LearnerEmploymentRoute;
  employmentRouteLabel: string;
  expectedStartDate: string;
  actualStartDate: string;
  expectedEndDate: string;
  actualEndDate: string;
  updatedAt: string;
  latestProgress: LearnerProgressUpdate | null;
  progressPosition: LearnerProgressPosition;
  latestProviderReview: LearnerReview | null;
  latestLAndDCheckIn: LearnerReview | null;
  latestManagerCheckIn: LearnerReview | null;
  activeBreak: LearnerBreakInLearning | null;
  attention: LearnerAttentionState;
};

export type LearnerRecordDetail = LearnerOperationalSummary & {
  eligibilityDeclaration: LearnerEligibilityDeclaration | null;
  preEnrolmentChecks: LearnerPreEnrolmentChecks | null;
  progressHistory: LearnerProgressUpdate[];
  reviewHistory: LearnerReview[];
  breaksInLearning: LearnerBreakInLearning[];
  withdrawal: LearnerWithdrawal | null;
  assessmentReadiness: LearnerAssessmentReadiness | null;
  achievement: {
    expectedAchievementDate: string;
    actualAchievementDate: string;
    grade: string;
    gradeType: string;
    certificateReceived: boolean;
    certificateReceivedDate: string;
    resultNotes: string;
    recordedBy: string;
    recordedAt: string;
  } | null;
  operationalActions: LearnerOperationalAction[];
  enrolmentReadiness: LearnerEnrolmentReadiness;
  lifecycleTimeline: Array<Pick<LearnerLifecycleEvent, "id" | "eventType" | "eventDate" | "actorName" | "summary" | "previousStatus" | "newStatus">>;
};

export type LearnerEnrolmentReadinessStatus = "Complete" | "Outstanding" | "Needs review" | "Not applicable";

export type LearnerEnrolmentReadinessCheck = {
  id: string;
  label: string;
  status: LearnerEnrolmentReadinessStatus;
  blocking: boolean;
  message: string;
};

export type LearnerEnrolmentReadiness = {
  readyForEnrolment: boolean;
  completedChecks: LearnerEnrolmentReadinessCheck[];
  outstandingChecks: LearnerEnrolmentReadinessCheck[];
  blockingChecks: LearnerEnrolmentReadinessCheck[];
  warningChecks: LearnerEnrolmentReadinessCheck[];
  checks: LearnerEnrolmentReadinessCheck[];
};

export type LearnerAttentionState = {
  label: string;
  severity: LearnerAttentionSeverity;
  reasons: string[];
  needsAttention: boolean;
};

export type LearnerListSummary = {
  total: number;
  preEnrolment: number;
  activeLearners: number;
  breakInLearning: number;
  assessmentStage: number;
  achieved: number;
  needingAttention: number;
};

export function lifecycleStatusLabel(status: LearnerLifecycleStatus) {
  return learnerLifecycleStatusLabels[status] ?? status;
}

export function employmentRouteLabel(route: LearnerEmploymentRoute) {
  return learnerEmploymentRouteLabels[route] ?? "Not yet confirmed";
}

export function operationalActionLabel(actionType: LearnerOperationalAction["actionType"]) {
  return learnerOperationalActionLabels[actionType] ?? "Operational action";
}

export function deriveLearnerEnrolmentReadiness(input: {
  employmentRoute: LearnerEmploymentRoute;
  eligibilityDeclaration: LearnerEligibilityDeclaration | null;
  preEnrolmentChecks: LearnerPreEnrolmentChecks | null;
  programmeId: string;
  providerId: string;
  actualStartDate: string;
  expectedEndDate: string;
}): LearnerEnrolmentReadiness {
  const checks: LearnerEnrolmentReadinessCheck[] = [
    input.employmentRoute === "not_confirmed"
      ? blockingCheck("employment-route", "Employment route confirmed", "Record whether this is an existing employee upskill or recruited apprentice.")
      : completeCheck("employment-route", "Employment route confirmed", "Employment route has been recorded."),
    input.eligibilityDeclaration?.confirmed
      ? completeCheck("employee-england-declaration", "Employee England working-hours declaration confirmed", "Employee declaration has been captured.")
      : blockingCheck("employee-england-declaration", "Employee England working-hours declaration confirmed", "Employee must confirm the England working-hours declaration before enrolment."),
    eligibilityVerificationCheck(input.eligibilityDeclaration),
    probationReadinessCheck(input.preEnrolmentChecks),
    hrApprovalReadinessCheck(input.preEnrolmentChecks),
    input.programmeId
      ? completeCheck("programme-confirmed", "Programme confirmed", "Programme is connected to the learner record.")
      : blockingCheck("programme-confirmed", "Programme confirmed", "A programme must be confirmed before enrolment."),
    input.providerId
      ? completeCheck("provider-confirmed", "Provider confirmed", "Approved delivery partner is connected to the learner record.")
      : blockingCheck("provider-confirmed", "Provider confirmed", "A provider must be confirmed before enrolment."),
    input.actualStartDate
      ? completeCheck("actual-start-date", "Actual start date recorded", "Actual start date has been recorded.")
      : blockingCheck("actual-start-date", "Actual start date recorded", "Actual start date must be recorded before enrolment."),
    input.expectedEndDate
      ? completeCheck("expected-end-date", "Expected end date recorded", "Expected end date has been recorded.")
      : blockingCheck("expected-end-date", "Expected end date recorded", "Expected end date must be recorded before enrolment."),
  ];

  const completedChecks = checks.filter((check) => check.status === "Complete");
  const outstandingChecks = checks.filter((check) => check.status === "Outstanding");
  const warningChecks = checks.filter((check) => check.status === "Needs review");
  const blockingChecks = checks.filter((check) => check.blocking);

  return {
    readyForEnrolment: blockingChecks.length === 0,
    checks,
    completedChecks,
    outstandingChecks,
    blockingChecks,
    warningChecks,
  };
}

export function deriveProgressPosition(progress: LearnerProgressUpdate | null): LearnerProgressPosition {
  if (!progress) return "No progress data";
  if (progress.variancePercentage < -2) return "Behind target";
  if (progress.variancePercentage > 2) return "Ahead of target";
  return "On target";
}

export function formatProgressVariance(variance: number) {
  const absolute = Math.abs(variance);
  const unit = `${absolute} percentage point${absolute === 1 ? "" : "s"}`;
  if (variance < 0) return `${unit} behind target.`;
  if (variance > 0) return `${unit} ahead of target.`;
  return "On target.";
}

export function deriveLearnerAttention(input: {
  lifecycleStatus: LearnerLifecycleStatus;
  eligibilityDeclaration: LearnerEligibilityDeclaration | null;
  preEnrolmentChecks: LearnerPreEnrolmentChecks | null;
  latestProgress: LearnerProgressUpdate | null;
  latestProviderReview: LearnerReview | null;
  latestLAndDCheckIn: LearnerReview | null;
  activeBreak: LearnerBreakInLearning | null;
  assessmentReadiness: LearnerAssessmentReadiness | null;
  operationalActions: LearnerOperationalAction[];
  today?: string;
}): LearnerAttentionState {
  const today = input.today ?? new Date().toISOString().slice(0, 10);
  const reasons: string[] = [];

  if (!input.eligibilityDeclaration?.confirmed || input.eligibilityDeclaration.verificationStatus !== "employer_verified") {
    reasons.push("Confirm England working-hours eligibility");
  }

  if (!input.preEnrolmentChecks || input.preEnrolmentChecks.hrApprovalStatus === "awaiting_approval" || input.preEnrolmentChecks.hrApprovalStatus === "not_requested") {
    reasons.push("Awaiting HR approval");
  }

  if (!input.preEnrolmentChecks || input.preEnrolmentChecks.probationStatus === "awaiting_confirmation") {
    reasons.push("Confirm probation status");
  }

  if (!input.preEnrolmentChecks?.guidesSent) {
    reasons.push("Send learner and manager guides");
  }

  if (input.activeBreak) {
    reasons.push("Learner is currently on a break in learning");
  }

  if (input.latestProgress && input.latestProgress.variancePercentage < -2) {
    reasons.push("Actual progress is behind target");
  }

  if (input.latestProviderReview?.nextReviewDate && input.latestProviderReview.nextReviewDate < today) {
    reasons.push("Provider review overdue");
  }

  if (input.latestLAndDCheckIn?.nextReviewDate && input.latestLAndDCheckIn.nextReviewDate < today) {
    reasons.push("L&D check-in overdue");
  }

  if (input.lifecycleStatus === "assessment_preparation") {
    reasons.push("Prepare for assessment readiness");
  }

  const assessmentEmail = input.operationalActions.find((action) => action.actionType === "hr_and_manager_assessment_email_sent");
  if ((input.lifecycleStatus === "assessment_preparation" || input.lifecycleStatus === "in_assessment") && !assessmentEmail?.completed) {
    reasons.push("Send HR and Manager assessment email");
  }

  const completionEmail = input.operationalActions.find((action) => action.actionType === "completion_email_sent");
  if ((input.lifecycleStatus === "achieved" || input.lifecycleStatus === "completed_without_achievement") && !completionEmail?.completed) {
    reasons.push("Send completion email");
  }

  const severity: LearnerAttentionSeverity = input.activeBreak || input.lifecycleStatus === "withdrawn" || reasons.some((reason) => /overdue|behind|HR approval|eligibility/i.test(reason))
    ? "high"
    : reasons.length
      ? "medium"
      : "none";

  return {
    label: reasons[0] ?? "No immediate action required",
    severity,
    reasons,
    needsAttention: reasons.length > 0,
  };
}

export function buildLearnerListSummary(records: LearnerOperationalSummary[]): LearnerListSummary {
  return {
    total: records.length,
    preEnrolment: records.filter((record) => record.lifecycleStatus === "pre_enrolment").length,
    activeLearners: records.filter((record) => ["enrolled", "assessment_preparation", "in_assessment", "break_in_learning"].includes(record.lifecycleStatus)).length,
    breakInLearning: records.filter((record) => record.lifecycleStatus === "break_in_learning").length,
    assessmentStage: records.filter((record) => record.lifecycleStatus === "assessment_preparation" || record.lifecycleStatus === "in_assessment").length,
    achieved: records.filter((record) => record.lifecycleStatus === "achieved").length,
    needingAttention: records.filter((record) => record.attention.needsAttention).length,
  };
}

export function compareLearnerOperationalPriority(left: LearnerOperationalSummary, right: LearnerOperationalSummary) {
  const leftScore = learnerPriorityScore(left);
  const rightScore = learnerPriorityScore(right);
  if (leftScore !== rightScore) return rightScore - leftScore;
  const leftReview = left.latestProviderReview?.nextReviewDate ?? "9999-12-31";
  const rightReview = right.latestProviderReview?.nextReviewDate ?? "9999-12-31";
  if (leftReview !== rightReview) return leftReview.localeCompare(rightReview);
  return left.learner.name.localeCompare(right.learner.name);
}

function learnerPriorityScore(record: LearnerOperationalSummary) {
  let score = 0;
  if (record.attention.needsAttention) score += 100;
  if (record.lifecycleStatus === "break_in_learning") score += 40;
  if (record.progressPosition === "Behind target") score += 30;
  if (record.attention.severity === "high") score += 20;
  if (record.attention.severity === "medium") score += 10;
  return score;
}

function eligibilityVerificationCheck(declaration: LearnerEligibilityDeclaration | null): LearnerEnrolmentReadinessCheck {
  if (!declaration) return blockingCheck("employer-eligibility-verification", "Employer eligibility verification complete", "Employer eligibility verification has not been recorded.");
  if (declaration.verificationStatus === "employer_verified") return completeCheck("employer-eligibility-verification", "Employer eligibility verification complete", "Employer verification is complete.");
  if (declaration.verificationStatus === "not_eligible") {
    return {
      id: "employer-eligibility-verification",
      label: "Employer eligibility verification complete",
      status: "Needs review",
      blocking: true,
      message: "This learner cannot currently proceed to enrolment because the England working-hours requirement has not been verified.",
    };
  }
  if (declaration.verificationStatus === "needs_review") {
    return {
      id: "employer-eligibility-verification",
      label: "Employer eligibility verification complete",
      status: "Needs review",
      blocking: true,
      message: "Employer eligibility verification needs review before enrolment.",
    };
  }
  return blockingCheck("employer-eligibility-verification", "Employer eligibility verification complete", "Employer eligibility must be verified before enrolment.");
}

function probationReadinessCheck(checks: LearnerPreEnrolmentChecks | null): LearnerEnrolmentReadinessCheck {
  const status = checks?.probationStatus ?? "awaiting_confirmation";
  if (status === "passed" || status === "not_required") return completeCheck("probation-complete", "Probation passed or not required", "Probation position supports enrolment.");
  if (status === "not_passed") return needsReviewCheck("probation-complete", "Probation passed or not required", "Probation has not been passed, so enrolment is blocked.");
  if (status === "under_review") return needsReviewCheck("probation-complete", "Probation passed or not required", "Probation is under review.");
  return blockingCheck("probation-complete", "Probation passed or not required", "Probation status must be passed or not required before enrolment.");
}

function hrApprovalReadinessCheck(checks: LearnerPreEnrolmentChecks | null): LearnerEnrolmentReadinessCheck {
  const status = checks?.hrApprovalStatus ?? "not_requested";
  if (status === "approved") return completeCheck("hr-approval-complete", "HR approval complete", "HR approval has been recorded.");
  if (status === "declined") return needsReviewCheck("hr-approval-complete", "HR approval complete", "HR approval has been declined, so enrolment is blocked.");
  if (status === "more_information_required") return needsReviewCheck("hr-approval-complete", "HR approval complete", "HR needs more information before enrolment.");
  return blockingCheck("hr-approval-complete", "HR approval complete", "HR approval must be complete before enrolment.");
}

function completeCheck(id: string, label: string, message: string): LearnerEnrolmentReadinessCheck {
  return { id, label, message, status: "Complete", blocking: false };
}

function blockingCheck(id: string, label: string, message: string): LearnerEnrolmentReadinessCheck {
  return { id, label, message, status: "Outstanding", blocking: true };
}

function needsReviewCheck(id: string, label: string, message: string): LearnerEnrolmentReadinessCheck {
  return { id, label, message, status: "Needs review", blocking: true };
}
