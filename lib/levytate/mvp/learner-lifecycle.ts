import { createMvpId, nowIso } from "@/lib/levytate/mvp/workspace";
import type { AssessmentReadinessConfirmations } from "@/lib/levytate/mvp/assessment-readiness";
import type { ManagerCheckInDetails } from "@/lib/levytate/mvp/manager-check-in";

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

export type LearnerBreakReasonCategory =
  | "health_or_wellbeing"
  | "parental_leave"
  | "caring_responsibilities"
  | "bereavement"
  | "temporary_role_or_workload_change"
  | "extended_authorised_absence"
  | "provider_or_programme_disruption"
  | "personal_circumstances"
  | "other";

export const learnerBreakReasonLabels = {
  health_or_wellbeing: "Health or wellbeing",
  parental_leave: "Maternity, paternity or parental leave",
  caring_responsibilities: "Caring responsibilities",
  bereavement: "Bereavement",
  temporary_role_or_workload_change: "Temporary role or workload change",
  extended_authorised_absence: "Extended authorised absence",
  provider_or_programme_disruption: "Provider or programme disruption",
  personal_circumstances: "Personal circumstances",
  other: "Other",
} as const satisfies Record<LearnerBreakReasonCategory, string>;

export const learnerBreakStatusLabels = {
  active: "Active",
  returned: "Returned",
  converted_to_withdrawal: "Converted to withdrawal",
  cancelled: "Cancelled",
} as const satisfies Record<LearnerBreakStatus, string>;

export const learnerBreakPolicy = {
  eligibleStartStatuses: ["enrolled", "assessment_preparation"] as LearnerLifecycleStatus[],
  returnDateApproachingDays: 14,
  postReturnReviewDays: 14,
  maximumFutureEffectiveDateDays: 7,
  detailRequiredReasons: ["other", "provider_or_programme_disruption", "temporary_role_or_workload_change"] as LearnerBreakReasonCategory[],
} as const;

export type LearnerReviewType =
  | "provider_review"
  | "l_and_d_check_in"
  | "manager_check_in"
  | "other";

export const learnerReviewTypeLabels = {
  provider_review: "Provider review",
  l_and_d_check_in: "L&D check-in",
  manager_check_in: "Manager check-in",
  other: "Other",
} as const satisfies Record<LearnerReviewType, string>;

export type LearnerReviewStatus =
  | "completed"
  | "scheduled"
  | "cancelled"
  | "action_required";

export const learnerReviewStatusLabels = {
  completed: "Completed",
  scheduled: "Scheduled",
  cancelled: "Cancelled",
  action_required: "Action required",
} as const satisfies Record<LearnerReviewStatus, string>;

export type LearnerProgressSource =
  | "provider_report"
  | "provider_review"
  | "manual_l_and_d_update"
  | "integration"
  | "other";

export const learnerProgressSourceLabels = {
  provider_report: "Provider report",
  provider_review: "Provider review",
  manual_l_and_d_update: "Manual L&D update",
  integration: "Integration",
  other: "Other",
} as const satisfies Record<LearnerProgressSource, string>;

export type LearnerSupportActionType =
  | "no_support_required"
  | "monitor_progress"
  | "manager_support_required"
  | "provider_action_required"
  | "l_and_d_check_in_required"
  | "role_or_workplace_opportunity_required"
  | "escalation_required"
  | "other";

export const learnerSupportActionLabels = {
  no_support_required: "No support required",
  monitor_progress: "Monitor progress",
  manager_support_required: "Manager support required",
  provider_action_required: "Provider action required",
  l_and_d_check_in_required: "L&D check-in required",
  role_or_workplace_opportunity_required: "Role or workplace opportunity required",
  escalation_required: "Escalation required",
  other: "Other",
} as const satisfies Record<LearnerSupportActionType, string>;

export const learnerProgressReviewPolicy = {
  progressEligibleStatuses: ["enrolled", "assessment_preparation", "in_assessment"] as LearnerLifecycleStatus[],
  reviewEligibleStatuses: ["enrolled", "break_in_learning", "assessment_preparation", "in_assessment"] as LearnerLifecycleStatus[],
  progressUpdateOverdueDays: 60,
  maximumFutureDateDays: 7,
} as const;

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
  | "employment_route_confirmed"
  | "eligibility_employer_verified"
  | "eligibility_marked_for_review"
  | "eligibility_marked_not_eligible"
  | "probation_updated"
  | "hr_approved"
  | "hr_approval_updated"
  | "probation_confirmed"
  | "programme_provider_confirmed"
  | "guides_sent"
  | "enrolled"
  | "enrolment_completed"
  | "break_started"
  | "break_details_updated"
  | "break_expected_return_changed"
  | "break_start_date_corrected"
  | "returned_from_break"
  | "break_cancelled"
  | "withdrawn"
  | "provider_review_recorded"
  | "l_and_d_check_in_recorded"
  | "manager_check_in_recorded"
  | "other_review_recorded"
  | "review_action_required"
  | "progress_updated"
  | "learner_identified_behind_target"
  | "assessment_readiness_updated"
  | "assessment_model_confirmed"
  | "assessment_organisation_recorded"
  | "expected_assessment_readiness_recorded"
  | "provider_readiness_confirmed"
  | "learner_readiness_confirmed"
  | "line_manager_readiness_confirmed"
  | "employer_readiness_confirmed"
  | "moved_to_assessment_preparation"
  | "assessment_readiness_confirmed"
  | "gateway_recorded"
  | "learner_entered_assessment"
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
  reasonCategory: LearnerBreakReasonCategory;
  reasonNotes: string;
  previousLifecycleStatus: "enrolled" | "assessment_preparation";
  expectedReturnUnknown: boolean;
  reviewDate: string;
  providerNotified: boolean;
  providerNotifiedDate: string;
  employeeNotified: boolean;
  employeeNotifiedDate: string;
  managerNotified: boolean;
  managerNotifiedDate: string;
  returnPlanNotes: string;
  effectiveLifecycleDate: string;
  returnConfirmationNote: string;
  programmeStillValidConfirmed: boolean;
  providerReturnConfirmed: boolean;
  managerReturnConfirmed: boolean;
  learnerReturnConfirmed: boolean;
  revisedExpectedEndDate: string;
  revisedReviewDate: string;
  immediateSupportAction: string;
  progressResetNote: string;
  firstCheckInDate: string;
  cancellationReason: string;
  cancelledBy: string;
  cancelledAt: string;
  startDateCorrectionReason: string;
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
  managerCheckIn?: ManagerCheckInDetails | null;
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
  assessmentModelExplanation: string;
  expectedAssessmentReadinessDate: string;
  actualAssessmentReadinessDate: string;
  gatewayDate: string;
  expectedAssessmentStartDate: string;
  assessmentStartDate: string;
  assessmentStatus: LearnerAssessmentStatus;
  assessmentOrganisation: string;
  assessmentContact: string;
  assessmentReference: string;
  assessmentNotes: string;
  confirmations: AssessmentReadinessConfirmations;
  readinessConfirmedBy: string;
  readinessConfirmedAt: string;
  updatedBy: string;
  version: number;
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
