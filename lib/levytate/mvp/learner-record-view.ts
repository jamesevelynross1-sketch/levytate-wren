import {
  learnerEmploymentRouteLabels,
  learnerLifecycleStatusLabels,
  learnerOperationalActionLabels,
  learnerBreakPolicy,
  learnerProgressReviewPolicy,
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
  type LearnerReviewType,
  type LearnerWithdrawal,
} from "@/lib/levytate/mvp/learner-lifecycle";
import type { AssessmentReadinessResult } from "@/lib/levytate/mvp/assessment-readiness";

export type LearnerProgressPosition = "Ahead of target" | "On target" | "Slightly behind" | "Significantly behind" | "No progress data";
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
  reviewSummaries: LearnerReviewSummaries;
  activeBreak: LearnerBreakInLearning | null;
  latestBreak: LearnerBreakInLearning | null;
  breakAttention: LearnerBreakAttention;
  attention: LearnerAttentionState;
};

export type LearnerRecordDetail = LearnerOperationalSummary & {
  activityVersion: string;
  eligibilityDeclaration: LearnerEligibilityDeclaration | null;
  preEnrolmentChecks: LearnerPreEnrolmentChecks | null;
  progressHistory: LearnerProgressUpdate[];
  reviewHistory: LearnerReview[];
  breaksInLearning: LearnerBreakInLearning[];
  withdrawal: LearnerWithdrawal | null;
  assessmentReadiness: LearnerAssessmentReadiness | null;
  assessmentReadinessResult: AssessmentReadinessResult;
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

export type LearnerBreakAttention = {
  label: string;
  state: "none" | "active" | "approaching" | "overdue" | "unknown" | "confirmations" | "post_return_review";
  daysOnBreak: number;
  daysUntilReturn: number | null;
  reasons: string[];
};

export type LearnerReviewSummary = {
  latest: LearnerReview | null;
  nextDate: string;
  overdue: boolean;
};

export type LearnerReviewSummaries = {
  provider: LearnerReviewSummary;
  lAndD: LearnerReviewSummary;
  manager: LearnerReviewSummary;
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
  return deriveProgressPositionFromVariance(progress.variancePercentage);
}

export function deriveProgressPositionFromVariance(variance: number): Exclude<LearnerProgressPosition, "No progress data"> {
  if (variance >= 3) return "Ahead of target";
  if (variance <= -8) return "Significantly behind";
  if (variance <= -3) return "Slightly behind";
  return "On target";
}

export function deriveReviewSummaries(reviews: LearnerReview[], today = new Date().toISOString().slice(0, 10)): LearnerReviewSummaries {
  return {
    provider: reviewSummary(reviews, "provider_review", today),
    lAndD: reviewSummary(reviews, "l_and_d_check_in", today),
    manager: reviewSummary(reviews, "manager_check_in", today),
  };
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
  latestManagerCheckIn: LearnerReview | null;
  reviewSummaries: LearnerReviewSummaries;
  activeBreak: LearnerBreakInLearning | null;
  latestBreak?: LearnerBreakInLearning | null;
  reviewHistory?: LearnerReview[];
  assessmentReadiness: LearnerAssessmentReadiness | null;
  operationalActions: LearnerOperationalAction[];
  today?: string;
}): LearnerAttentionState {
  const today = input.today ?? new Date().toISOString().slice(0, 10);
  const reasons: string[] = [];
  const progressPosition = deriveProgressPosition(input.latestProgress);
  const reviewSummaries = input.reviewSummaries;
  const breakAttention = deriveBreakAttention(input.activeBreak, input.latestBreak ?? input.activeBreak, input.reviewHistory ?? [], today);

  if (input.lifecycleStatus === "pre_enrolment") {
    if (!input.eligibilityDeclaration?.confirmed || input.eligibilityDeclaration.verificationStatus !== "employer_verified") reasons.push("Confirm England working-hours eligibility");
    if (!input.preEnrolmentChecks || input.preEnrolmentChecks.hrApprovalStatus === "awaiting_approval" || input.preEnrolmentChecks.hrApprovalStatus === "not_requested") reasons.push("Awaiting HR approval");
    if (!input.preEnrolmentChecks || input.preEnrolmentChecks.probationStatus === "awaiting_confirmation") reasons.push("Confirm probation status");
    if (!input.preEnrolmentChecks?.guidesSent) reasons.push("Send learner and manager guides");
  }

  reasons.push(...breakAttention.reasons);

  if (progressPosition === "Significantly behind") reasons.push("Significantly behind target");
  if (reviewSummaries.provider.overdue) reasons.push("Provider review overdue");
  if (input.latestProgress?.supportAction && !/^no support required$/i.test(input.latestProgress.supportAction)) reasons.push("Support action outstanding");
  if (input.latestProviderReview?.status === "action_required" || input.latestLAndDCheckIn?.status === "action_required" || input.latestManagerCheckIn?.status === "action_required") reasons.push("Review action outstanding");
  if (reviewSummaries.lAndD.overdue) reasons.push("L&D check-in overdue");
  if (reviewSummaries.manager.overdue) reasons.push("Manager check-in overdue");
  if (progressPosition === "Slightly behind") reasons.push("Slightly behind target");
  if (progressIsOverdue(input.latestProgress, today) && ["enrolled", "assessment_preparation", "in_assessment"].includes(input.lifecycleStatus)) reasons.push("Progress update overdue");

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

  const orderedReasons = orderAttentionReasons(reasons);
  const severity: LearnerAttentionSeverity = breakAttention.state === "overdue" || breakAttention.state === "unknown" || input.lifecycleStatus === "withdrawn" || orderedReasons.some((reason) => /significantly|provider review overdue|HR approval|eligibility/i.test(reason))
    ? "high"
    : orderedReasons.length
      ? "medium"
      : "none";

  return {
    label: orderedReasons[0] ?? "No immediate action required",
    severity,
    reasons: orderedReasons,
    needsAttention: orderedReasons.length > 0,
  };
}

export function deriveBreakAttention(
  activeBreak: LearnerBreakInLearning | null,
  latestBreak: LearnerBreakInLearning | null,
  reviews: LearnerReview[],
  today = new Date().toISOString().slice(0, 10),
): LearnerBreakAttention {
  if (activeBreak) {
    const daysOnBreak = Math.max(0, dateDifferenceDays(activeBreak.startDate, today));
    if (activeBreak.expectedReturnUnknown || !activeBreak.expectedReturnDate) {
      return { label: "Return date not confirmed", state: "unknown", daysOnBreak, daysUntilReturn: null, reasons: ["Return date not confirmed", "Learner currently on a break in learning"] };
    }
    const daysUntilReturn = dateDifferenceDays(today, activeBreak.expectedReturnDate);
    if (daysUntilReturn < 0) {
      return { label: "Return date overdue", state: "overdue", daysOnBreak, daysUntilReturn, reasons: ["Return date overdue", "Learner currently on a break in learning"] };
    }
    const confirmations = [
      !activeBreak.providerReturnConfirmed && "Provider return confirmation outstanding",
      !activeBreak.managerReturnConfirmed && "Manager return confirmation outstanding",
      !activeBreak.learnerReturnConfirmed && "Learner return confirmation outstanding",
    ].filter(Boolean) as string[];
    if (daysUntilReturn <= learnerBreakPolicy.returnDateApproachingDays && confirmations.length) {
      return { label: confirmations[0], state: "confirmations", daysOnBreak, daysUntilReturn, reasons: [...confirmations, "Return date approaching", "Learner currently on a break in learning"] };
    }
    if (daysUntilReturn <= learnerBreakPolicy.returnDateApproachingDays) {
      return { label: "Return date approaching", state: "approaching", daysOnBreak, daysUntilReturn, reasons: ["Return date approaching", "Learner currently on a break in learning"] };
    }
    return { label: "Learner currently on a break in learning", state: "active", daysOnBreak, daysUntilReturn, reasons: ["Learner currently on a break in learning"] };
  }

  if (latestBreak?.status === "returned" && latestBreak.actualReturnDate) {
    const daysSinceReturn = dateDifferenceDays(latestBreak.actualReturnDate, today);
    const reviewedAfterReturn = reviews.some((review) => ["provider_review", "l_and_d_check_in", "manager_check_in"].includes(review.reviewType) && review.reviewDate >= latestBreak.actualReturnDate);
    if (daysSinceReturn >= 0 && daysSinceReturn <= learnerBreakPolicy.postReturnReviewDays && !reviewedAfterReturn) {
      return { label: "Post-return review required", state: "post_return_review", daysOnBreak: 0, daysUntilReturn: null, reasons: ["Post-return review required"] };
    }
  }
  return { label: "No break action required", state: "none", daysOnBreak: 0, daysUntilReturn: null, reasons: [] };
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
  if (record.progressPosition === "Significantly behind") score += 35;
  if (record.progressPosition === "Slightly behind") score += 20;
  if (record.attention.severity === "high") score += 20;
  if (record.attention.severity === "medium") score += 10;
  return score;
}

function reviewSummary(reviews: LearnerReview[], reviewType: LearnerReviewType, today: string): LearnerReviewSummary {
  const latest = reviews
    .filter((review) => review.reviewType === reviewType)
    .sort((left, right) => right.reviewDate.localeCompare(left.reviewDate) || right.createdAt.localeCompare(left.createdAt))[0] ?? null;
  const nextDate = latest?.nextReviewDate ?? "";
  return { latest, nextDate, overdue: Boolean(nextDate && nextDate < today && latest?.status !== "cancelled") };
}

function progressIsOverdue(progress: LearnerProgressUpdate | null, today: string) {
  if (!progress) return true;
  const last = new Date(`${progress.updateDate}T00:00:00Z`).getTime();
  const current = new Date(`${today}T00:00:00Z`).getTime();
  return Number.isFinite(last) && Number.isFinite(current) && current - last > learnerProgressReviewPolicy.progressUpdateOverdueDays * 24 * 60 * 60 * 1000;
}

function orderAttentionReasons(reasons: string[]) {
  const priority = [
    "Return date overdue",
    "Return date not confirmed",
    "Provider return confirmation outstanding",
    "Manager return confirmation outstanding",
    "Learner return confirmation outstanding",
    "Return date approaching",
    "Learner currently on a break in learning",
    "Post-return review required",
    "Significantly behind target",
    "Provider review overdue",
    "Support action outstanding",
    "Review action outstanding",
    "L&D check-in overdue",
    "Manager check-in overdue",
    "Slightly behind target",
    "Progress update overdue",
  ];
  return Array.from(new Set(reasons)).sort((left, right) => {
    const leftIndex = priority.indexOf(left);
    const rightIndex = priority.indexOf(right);
    if (leftIndex === -1 && rightIndex === -1) return 0;
    if (leftIndex === -1) return 1;
    if (rightIndex === -1) return -1;
    return leftIndex - rightIndex;
  });
}

function dateDifferenceDays(from: string, to: string) {
  const fromTime = new Date(`${from}T00:00:00Z`).getTime();
  const toTime = new Date(`${to}T00:00:00Z`).getTime();
  if (!Number.isFinite(fromTime) || !Number.isFinite(toTime)) return 0;
  return Math.floor((toTime - fromTime) / 86_400_000);
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
