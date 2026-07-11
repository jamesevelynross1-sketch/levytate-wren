import { createMvpId, nowIso } from "@/lib/levytate/mvp/workspace";

export type LearnerLifecycleRecordStatus = "Active" | "Archived";

export type LearnerEmploymentRoute =
  | "existing_employee_upskill"
  | "recruited_as_apprentice"
  | "not_confirmed";

export const learnerEmploymentRouteLabels = {
  existing_employee_upskill: "Existing employee - upskill",
  recruited_as_apprentice: "Recruited as an apprentice",
  not_confirmed: "Not yet confirmed",
} as const satisfies Record<LearnerEmploymentRoute, string>;

export type LearnerLifecycleStatus =
  | "pre_enrolment"
  | "enrolled"
  | "break_in_learning"
  | "withdrawn"
  | "assessment_preparation"
  | "in_assessment"
  | "achieved"
  | "completed_without_achievement";

export const learnerLifecycleStatusLabels = {
  pre_enrolment: "Pre-enrolment",
  enrolled: "Enrolled",
  break_in_learning: "Break in learning",
  withdrawn: "Withdrawn",
  assessment_preparation: "Assessment preparation",
  in_assessment: "In assessment",
  achieved: "Achieved",
  completed_without_achievement: "Completed without achievement",
} as const satisfies Record<LearnerLifecycleStatus, string>;

export const learnerLifecycleTransitionPolicy: Record<LearnerLifecycleStatus, LearnerLifecycleStatus[]> = {
  pre_enrolment: ["enrolled", "withdrawn"],
  enrolled: ["break_in_learning", "assessment_preparation", "withdrawn"],
  break_in_learning: ["enrolled", "withdrawn"],
  assessment_preparation: ["in_assessment", "break_in_learning", "withdrawn"],
  in_assessment: ["achieved", "completed_without_achievement", "assessment_preparation", "withdrawn"],
  achieved: [],
  withdrawn: [],
  completed_without_achievement: [],
};

export type LearnerEligibilityDeclarationType = "england_working_hours";
export type LearnerEligibilityVerificationStatus =
  | "not_confirmed"
  | "employee_confirmed"
  | "employer_verified"
  | "needs_review"
  | "not_eligible";

export const englandWorkingHoursDeclarationWording =
  "I confirm that I expect to spend at least 50% of my working hours in England over the duration of the apprenticeship.";
export const englandWorkingHoursDeclarationVersion = "2026-07-operational-4a";

export type LearnerProbationStatus =
  | "not_required"
  | "awaiting_confirmation"
  | "passed"
  | "not_passed"
  | "under_review";

export type LearnerHrApprovalStatus =
  | "not_requested"
  | "awaiting_approval"
  | "approved"
  | "declined"
  | "more_information_required";

export type LearnerBreakStatus =
  | "active"
  | "returned"
  | "converted_to_withdrawal"
  | "cancelled";

export type LearnerReviewType =
  | "provider_review"
  | "l_and_d_check_in"
  | "manager_check_in"
  | "other";

export type LearnerReviewStatus =
  | "completed"
  | "scheduled"
  | "cancelled"
  | "action_required";

export type LearnerProgressSource =
  | "provider_report"
  | "provider_review"
  | "manual_l_and_d_update"
  | "integration"
  | "other";

export type LearnerAssessmentModel =
  | "end_point_assessment"
  | "integrated_assessment"
  | "other"
  | "not_confirmed";

export type LearnerAssessmentStatus =
  | "not_started"
  | "preparing"
  | "readiness_confirmed"
  | "in_assessment"
  | "completed"
  | "unsuccessful"
  | "resit_required";

export type LearnerOperationalActionType =
  | "guides_sent"
  | "hr_and_manager_assessment_email_sent"
  | "completion_email_sent"
  | "provider_notified"
  | "other";

export type LearnerOperationalActionStatus =
  | "not_started"
  | "scheduled"
  | "completed"
  | "cancelled";

export const learnerOperationalActionLabels = {
  guides_sent: "Guides sent",
  hr_and_manager_assessment_email_sent: "HR and Manager assessment/EPA email sent",
  completion_email_sent: "Completion email sent",
  provider_notified: "Provider notified",
  other: "Other",
} as const satisfies Record<LearnerOperationalActionType, string>;

export type LearnerLifecycleEventType =
  | "learner_record_created"
  | "lifecycle_status_changed"
  | "eligibility_declaration_recorded"
  | "pre_enrolment_checks_updated"
  | "hr_approved"
  | "probation_confirmed"
  | "enrolled"
  | "break_started"
  | "returned_from_break"
  | "withdrawn"
  | "provider_review_recorded"
  | "progress_updated"
  | "assessment_readiness_updated"
  | "assessment_readiness_confirmed"
  | "achievement_recorded"
  | "operational_action_completed";

export type LearnerRecord = {
  id: string;
  organisationId: string;
  employeeId: string;
  applicationId: string;
  programmeId: string;
  providerId: string;
  enrolmentId: string;
  lifecycleStatus: LearnerLifecycleStatus;
  employmentRoute: LearnerEmploymentRoute;
  expectedStartDate: string;
  actualStartDate: string;
  expectedEndDate: string;
  actualEndDate: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
  recordStatus: LearnerLifecycleRecordStatus;
  demonstrationRecord?: boolean;
};

export type LearnerEligibilityDeclaration = {
  id: string;
  organisationId: string;
  learnerRecordId: string;
  declarationType: LearnerEligibilityDeclarationType;
  declarationWording: string;
  declarationVersion: string;
  confirmed: boolean;
  confirmedByEmployee: string;
  confirmedAt: string;
  expectedEnglandWorkingHoursPercentage: number | null;
  verifiedBy: string;
  verifiedAt: string;
  verificationStatus: LearnerEligibilityVerificationStatus;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type LearnerPreEnrolmentChecks = {
  id: string;
  organisationId: string;
  learnerRecordId: string;
  probationStatus: LearnerProbationStatus;
  probationPassedDate: string;
  probationConfirmedBy: string;
  probationConfirmedAt: string;
  probationNotes: string;
  hrApprovalStatus: LearnerHrApprovalStatus;
  hrApprovedDate: string;
  hrApprovedBy: string;
  hrApprovalNotes: string;
  guidesSent: boolean;
  guidesSentDate: string;
  guidesSentBy: string;
  guidesVersion: string;
  guidesNotes: string;
  createdAt: string;
  updatedAt: string;
};

export type LearnerBreakInLearning = {
  id: string;
  organisationId: string;
  learnerRecordId: string;
  startDate: string;
  expectedReturnDate: string;
  actualReturnDate: string;
  reasonCategory: string;
  reasonNotes: string;
  status: LearnerBreakStatus;
  recordedBy: string;
  recordedAt: string;
  updatedAt: string;
};

export type LearnerWithdrawal = {
  id: string;
  organisationId: string;
  learnerRecordId: string;
  withdrawalDate: string;
  effectiveDate: string;
  reasonCategory: string;
  reasonNotes: string;
  initiatedBy: string;
  providerNotified: boolean;
  providerNotifiedDate: string;
  employeeNotified: boolean;
  employeeNotifiedDate: string;
  recordedBy: string;
  recordedAt: string;
};

export type LearnerReview = {
  id: string;
  organisationId: string;
  learnerRecordId: string;
  reviewType: LearnerReviewType;
  reviewDate: string;
  nextReviewDate: string;
  reviewerName: string;
  reviewerUserId: string;
  providerId: string;
  summary: string;
  actions: string[];
  supportRequired: string;
  status: LearnerReviewStatus;
  createdAt: string;
  updatedAt: string;
};

export type LearnerProgressUpdate = {
  id: string;
  organisationId: string;
  learnerRecordId: string;
  updateDate: string;
  targetProgressPercentage: number;
  actualProgressPercentage: number;
  variancePercentage: number;
  progressSource: LearnerProgressSource;
  sourceReference: string;
  updatedBy: string;
  summary: string;
  supportAction: string;
  createdAt: string;
};

export type LearnerAssessmentReadiness = {
  id: string;
  organisationId: string;
  learnerRecordId: string;
  assessmentModel: LearnerAssessmentModel;
  expectedAssessmentReadinessDate: string;
  actualAssessmentReadinessDate: string;
  gatewayDate: string;
  assessmentStatus: LearnerAssessmentStatus;
  assessmentOrganisation: string;
  assessmentNotes: string;
  createdAt: string;
  updatedAt: string;
};

export type LearnerAchievement = {
  id: string;
  organisationId: string;
  learnerRecordId: string;
  expectedAchievementDate: string;
  actualAchievementDate: string;
  grade: string;
  gradeType: string;
  certificateReceived: boolean;
  certificateReceivedDate: string;
  resultNotes: string;
  recordedBy: string;
  recordedAt: string;
};

export type LearnerOperationalAction = {
  id: string;
  organisationId: string;
  learnerRecordId: string;
  actionType: LearnerOperationalActionType;
  status: LearnerOperationalActionStatus;
  completed: boolean;
  completedAt: string;
  completedBy: string;
  recipientSummary: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type LearnerLifecycleEvent = {
  id: string;
  organisationId: string;
  learnerRecordId: string;
  eventType: LearnerLifecycleEventType;
  previousStatus: LearnerLifecycleStatus | "";
  newStatus: LearnerLifecycleStatus | "";
  eventDate: string;
  actorUserId: string;
  actorName: string;
  source: string;
  summary: string;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type LearnerLifecycleCollections = {
  learnerRecords: LearnerRecord[];
  eligibilityDeclarations: LearnerEligibilityDeclaration[];
  preEnrolmentChecks: LearnerPreEnrolmentChecks[];
  breaksInLearning: LearnerBreakInLearning[];
  withdrawals: LearnerWithdrawal[];
  learnerReviews: LearnerReview[];
  progressUpdates: LearnerProgressUpdate[];
  assessmentReadiness: LearnerAssessmentReadiness[];
  achievements: LearnerAchievement[];
  operationalActions: LearnerOperationalAction[];
  lifecycleEvents: LearnerLifecycleEvent[];
};

export type LearnerLifecycleSummary = {
  learnerRecord: LearnerRecord;
  latestProgress: LearnerProgressUpdate | null;
  latestProviderReview: LearnerReview | null;
  latestLAndDCheckIn: LearnerReview | null;
  latestManagerCheckIn: LearnerReview | null;
  activeBreak: LearnerBreakInLearning | null;
  withdrawal: LearnerWithdrawal | null;
  assessmentReadiness: LearnerAssessmentReadiness | null;
  achievement: LearnerAchievement | null;
  preEnrolmentChecks: LearnerPreEnrolmentChecks | null;
  eligibilityDeclaration: LearnerEligibilityDeclaration | null;
  completedOperationalActions: LearnerOperationalAction[];
  openOperationalActions: LearnerOperationalAction[];
};

export function emptyLearnerLifecycleCollections(): LearnerLifecycleCollections {
  return {
    learnerRecords: [],
    eligibilityDeclarations: [],
    preEnrolmentChecks: [],
    breaksInLearning: [],
    withdrawals: [],
    learnerReviews: [],
    progressUpdates: [],
    assessmentReadiness: [],
    achievements: [],
    operationalActions: [],
    lifecycleEvents: [],
  };
}

export function canTransitionLearnerLifecycle(
  previousStatus: LearnerLifecycleStatus,
  nextStatus: LearnerLifecycleStatus,
) {
  return learnerLifecycleTransitionPolicy[previousStatus].includes(nextStatus);
}

export function assertLearnerLifecycleTransition(
  previousStatus: LearnerLifecycleStatus,
  nextStatus: LearnerLifecycleStatus,
) {
  if (previousStatus === nextStatus) return;
  if (canTransitionLearnerLifecycle(previousStatus, nextStatus)) return;
  throw new Error(`Invalid learner lifecycle transition: ${previousStatus} -> ${nextStatus}.`);
}

export function calculateLearnerProgressVariance(targetProgressPercentage: number, actualProgressPercentage: number) {
  assertPercentage(targetProgressPercentage, "targetProgressPercentage");
  assertPercentage(actualProgressPercentage, "actualProgressPercentage");
  return Math.round((actualProgressPercentage - targetProgressPercentage) * 10) / 10;
}

export function assertPercentage(value: number, fieldName: string) {
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    throw new Error(`${fieldName} must be between 0 and 100.`);
  }
}

export function createLearnerLifecycleEvent(
  input: Omit<LearnerLifecycleEvent, "id" | "createdAt"> & { id?: string; createdAt?: string },
): LearnerLifecycleEvent {
  const createdAt = input.createdAt ?? nowIso();
  return {
    id: input.id ?? createMvpId("learner-event"),
    organisationId: input.organisationId,
    learnerRecordId: input.learnerRecordId,
    eventType: input.eventType,
    previousStatus: input.previousStatus,
    newStatus: input.newStatus,
    eventDate: input.eventDate,
    actorUserId: input.actorUserId,
    actorName: input.actorName,
    source: input.source,
    summary: input.summary,
    metadata: input.metadata,
    createdAt,
  };
}

export function getLatestLearnerProgress(progressUpdates: LearnerProgressUpdate[], learnerRecordId: string) {
  return progressUpdates
    .filter((update) => update.learnerRecordId === learnerRecordId)
    .sort((left, right) => right.updateDate.localeCompare(left.updateDate) || right.createdAt.localeCompare(left.createdAt))[0] ?? null;
}

export function getLatestProviderReview(reviews: LearnerReview[], learnerRecordId: string) {
  return getLatestReviewByType(reviews, learnerRecordId, "provider_review");
}

export function getLatestLAndDCheckIn(reviews: LearnerReview[], learnerRecordId: string) {
  return getLatestReviewByType(reviews, learnerRecordId, "l_and_d_check_in");
}

export function getLatestReviewByType(
  reviews: LearnerReview[],
  learnerRecordId: string,
  reviewType: LearnerReviewType,
) {
  return reviews
    .filter((review) => review.learnerRecordId === learnerRecordId && review.reviewType === reviewType)
    .sort((left, right) => right.reviewDate.localeCompare(left.reviewDate) || right.createdAt.localeCompare(left.createdAt))[0] ?? null;
}

export function getLearnerLifecycleSummary(
  collections: LearnerLifecycleCollections,
  learnerRecordId: string,
): LearnerLifecycleSummary | null {
  const learnerRecord = collections.learnerRecords.find((record) => record.id === learnerRecordId) ?? null;
  if (!learnerRecord) return null;

  const operationalActions = collections.operationalActions.filter((action) => action.learnerRecordId === learnerRecordId);
  return {
    learnerRecord,
    latestProgress: getLatestLearnerProgress(collections.progressUpdates, learnerRecordId),
    latestProviderReview: getLatestProviderReview(collections.learnerReviews, learnerRecordId),
    latestLAndDCheckIn: getLatestLAndDCheckIn(collections.learnerReviews, learnerRecordId),
    latestManagerCheckIn: getLatestReviewByType(collections.learnerReviews, learnerRecordId, "manager_check_in"),
    activeBreak: collections.breaksInLearning.find((breakRecord) => breakRecord.learnerRecordId === learnerRecordId && breakRecord.status === "active") ?? null,
    withdrawal: collections.withdrawals.find((withdrawal) => withdrawal.learnerRecordId === learnerRecordId) ?? null,
    assessmentReadiness: collections.assessmentReadiness.find((readiness) => readiness.learnerRecordId === learnerRecordId) ?? null,
    achievement: collections.achievements.find((achievement) => achievement.learnerRecordId === learnerRecordId) ?? null,
    preEnrolmentChecks: collections.preEnrolmentChecks.find((checks) => checks.learnerRecordId === learnerRecordId) ?? null,
    eligibilityDeclaration: collections.eligibilityDeclarations.find((declaration) => declaration.learnerRecordId === learnerRecordId) ?? null,
    completedOperationalActions: operationalActions.filter((action) => action.completed),
    openOperationalActions: operationalActions.filter((action) => !action.completed),
  };
}
