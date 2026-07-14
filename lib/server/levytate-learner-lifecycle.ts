import type { LevyTateBetaSession } from "@/lib/levytate/config/beta-access";
import { getApprenticeshipStandard } from "@/lib/levytate/domain";
import {
  assessmentConfirmationStatuses,
  assessmentConfirmationTypes,
  assessmentModelLabels,
  assessmentModelUsesGateway,
  assessmentOrganisationRequired,
  assessmentReadinessPolicy,
  deriveAssessmentReadiness,
  emptyAssessmentReadinessConfirmations,
  normaliseAssessmentReadinessConfirmations,
  type AssessmentConfirmationStatus,
  type AssessmentConfirmationType,
  type AssessmentReadinessConfirmation,
  type AssessmentReadinessResult,
} from "@/lib/levytate/mvp/assessment-readiness";
import {
  assertLearnerLifecycleTransition,
  calculateLearnerProgressVariance,
  createLearnerLifecycleEvent,
  englandWorkingHoursDeclarationVersion,
  englandWorkingHoursDeclarationWording,
  getLatestLAndDCheckIn as latestLAndDCheckInFromCollections,
  getLatestLearnerProgress as latestLearnerProgressFromCollections,
  getLatestProviderReview as latestProviderReviewFromCollections,
  getLearnerLifecycleSummary as learnerLifecycleSummaryFromCollections,
  learnerProgressReviewPolicy,
  learnerBreakPolicy,
  learnerBreakReasonLabels,
  learnerProgressSourceLabels,
  learnerReviewStatusLabels,
  learnerReviewTypeLabels,
  type LearnerAchievement,
  type LearnerAssessmentReadiness,
  type LearnerBreakInLearning,
  type LearnerBreakReasonCategory,
  type LearnerEligibilityDeclaration,
  type LearnerEligibilityVerificationStatus,
  type LearnerEmploymentRoute,
  type LearnerLifecycleCollections,
  type LearnerLifecycleEvent,
  type LearnerLifecycleEventType,
  type LearnerLifecycleStatus,
  type LearnerHrApprovalStatus,
  type LearnerOperationalAction,
  type LearnerPreEnrolmentChecks,
  type LearnerProbationStatus,
  type LearnerProgressUpdate,
  type LearnerProgressSource,
  type LearnerRecord,
  type LearnerReview,
  type LearnerReviewStatus,
  type LearnerReviewType,
  type LearnerWithdrawal,
} from "@/lib/levytate/mvp/learner-lifecycle";
import {
  compareLearnerOperationalPriority,
  deriveLearnerEnrolmentReadiness,
  deriveLearnerAttention,
  deriveBreakAttention,
  deriveProgressPosition,
  deriveReviewSummaries,
  employmentRouteLabel,
  lifecycleStatusLabel,
  type LearnerOperationalSummary,
  type LearnerRecordDetail,
} from "@/lib/levytate/mvp/learner-record-view";
import {
  createMvpId,
  nowIso,
} from "@/lib/levytate/mvp/workspace";
import {
  hasMvpPermission,
  normaliseMvpUserRole,
  type MvpUserRole,
} from "@/lib/levytate/mvp/rbac";
import {
  getLevyTateSupabaseConfig,
  supabaseInsert,
  supabaseSelect,
  supabaseUpdate,
} from "@/lib/server/levytate-supabase";
import {
  assertScopeMatchesSession,
  getManagerDirectReportContext,
  type ManagerDirectReportContext,
} from "@/lib/server/levytate-manager-scope";

type OrganisationRow = {
  id: string;
  name: string;
};

type UserRow = {
  id: string;
  organisation_id: string;
  email: string;
  role: MvpUserRole;
};

type EmployeeRow = {
  id: string;
  email: string;
  manager_id: string;
  status: string;
};

type EmployeeViewRow = {
  id: string;
  name: string;
  email: string;
  job_title: string;
  role_id: string;
  manager_id: string;
  department: string;
  site: string;
  status: string;
};

type ApplicationViewRow = {
  id: string;
  employee_id: string;
  apprenticeship_standard_id: string;
};

type ProviderViewRow = {
  provider_id: string;
  provider_name: string;
};

type ProviderProgrammeViewRow = {
  id: string;
  provider_id: string;
  programme_name: string;
  apprenticeship_standard_id: string;
  linked_standard_id: string | null;
  linked_standard_ids: unknown;
  linked_standard_name: string;
};

type EnrolmentViewRow = {
  id: string;
  application_id: string;
  employee_id: string;
  provider_id: string;
  apprenticeship_standard_id: string;
};

type LearnerRecordRow = {
  organisation_id: string;
  id: string;
  employee_id: string;
  application_id: string;
  programme_id: string;
  provider_id: string;
  enrolment_id: string;
  lifecycle_status: LearnerLifecycleStatus;
  employment_route: LearnerRecord["employmentRoute"];
  expected_start_date: string;
  actual_start_date: string;
  expected_end_date: string;
  actual_end_date: string;
  created_at: string;
  updated_at: string;
  created_by: string;
  updated_by: string;
  record_status: LearnerRecord["recordStatus"];
  demonstration_record?: boolean | null;
};

type LearnerEligibilityDeclarationRow = {
  organisation_id: string;
  id: string;
  learner_record_id: string;
  declaration_type: LearnerEligibilityDeclaration["declarationType"];
  declaration_wording: string;
  declaration_version: string;
  confirmed: boolean;
  confirmed_by_employee: string;
  confirmed_at: string;
  expected_england_working_hours_percentage: number | null;
  verified_by: string;
  verified_at: string;
  verification_status: LearnerEligibilityDeclaration["verificationStatus"];
  notes: string;
  created_at: string;
  updated_at: string;
};

type LearnerPreEnrolmentChecksRow = {
  organisation_id: string;
  id: string;
  learner_record_id: string;
  probation_status: LearnerPreEnrolmentChecks["probationStatus"];
  probation_passed_date: string;
  probation_confirmed_by: string;
  probation_confirmed_at: string;
  probation_notes: string;
  hr_approval_status: LearnerPreEnrolmentChecks["hrApprovalStatus"];
  hr_approved_date: string;
  hr_approved_by: string;
  hr_approval_notes: string;
  guides_sent: boolean;
  guides_sent_date: string;
  guides_sent_by: string;
  guides_version: string;
  guides_notes: string;
  created_at: string;
  updated_at: string;
};

type LearnerBreakInLearningRow = {
  organisation_id: string;
  id: string;
  learner_record_id: string;
  start_date: string;
  expected_return_date: string;
  actual_return_date: string;
  reason_category: string;
  reason_notes: string;
  status: LearnerBreakInLearning["status"];
  recorded_by: string;
  recorded_at: string;
  updated_at: string;
};

type LearnerWithdrawalRow = {
  organisation_id: string;
  id: string;
  learner_record_id: string;
  withdrawal_date: string;
  effective_date: string;
  reason_category: string;
  reason_notes: string;
  initiated_by: string;
  provider_notified: boolean;
  provider_notified_date: string;
  employee_notified: boolean;
  employee_notified_date: string;
  recorded_by: string;
  recorded_at: string;
};

type LearnerReviewRow = {
  organisation_id: string;
  id: string;
  learner_record_id: string;
  review_type: LearnerReview["reviewType"];
  review_date: string;
  next_review_date: string;
  reviewer_name: string;
  reviewer_user_id: string;
  provider_id: string;
  summary: string;
  actions: unknown;
  support_required: string;
  status: LearnerReview["status"];
  created_at: string;
  updated_at: string;
};

type LearnerProgressUpdateRow = {
  organisation_id: string;
  id: string;
  learner_record_id: string;
  update_date: string;
  target_progress_percentage: number;
  actual_progress_percentage: number;
  variance_percentage: number;
  progress_source: LearnerProgressUpdate["progressSource"];
  source_reference: string;
  updated_by: string;
  summary: string;
  support_action: string;
  created_at: string;
};

type LearnerAssessmentReadinessRow = {
  organisation_id: string;
  id: string;
  learner_record_id: string;
  assessment_model: LearnerAssessmentReadiness["assessmentModel"];
  assessment_model_explanation: string;
  expected_assessment_readiness_date: string;
  actual_assessment_readiness_date: string;
  gateway_date: string;
  expected_assessment_start_date: string;
  assessment_start_date: string;
  assessment_status: LearnerAssessmentReadiness["assessmentStatus"];
  assessment_organisation: string;
  assessment_contact: string;
  assessment_reference: string;
  assessment_notes: string;
  confirmations: unknown;
  readiness_confirmed_by: string;
  readiness_confirmed_at: string;
  updated_by: string;
  version: number;
  created_at: string;
  updated_at: string;
};

type CriticalOperationalActionRow = {
  source_type: string;
  description: string;
  priority: string;
  status: string;
};

type LearnerAchievementRow = {
  organisation_id: string;
  id: string;
  learner_record_id: string;
  expected_achievement_date: string;
  actual_achievement_date: string;
  grade: string;
  grade_type: string;
  certificate_received: boolean;
  certificate_received_date: string;
  result_notes: string;
  recorded_by: string;
  recorded_at: string;
};

type LearnerOperationalActionRow = {
  organisation_id: string;
  id: string;
  learner_record_id: string;
  action_type: LearnerOperationalAction["actionType"];
  status: LearnerOperationalAction["status"];
  completed: boolean;
  completed_at: string;
  completed_by: string;
  recipient_summary: string;
  notes: string;
  created_at: string;
  updated_at: string;
};

type LearnerLifecycleEventRow = {
  organisation_id: string;
  id: string;
  learner_record_id: string;
  event_type: LearnerLifecycleEventType;
  previous_status: LearnerLifecycleStatus | "";
  new_status: LearnerLifecycleStatus | "";
  event_date: string;
  actor_user_id: string;
  actor_name: string;
  source: string;
  summary: string;
  metadata: unknown;
  created_at: string;
};

export type LearnerLifecycleServerContext = {
  organisation: OrganisationRow;
  user: UserRow;
};

type LifecycleContext = LearnerLifecycleServerContext;

const organisationsTable = "levytate_organisations";
const usersTable = "levytate_users";
const employeesTable = "levytate_employees";
const learnerRecordsTable = "levytate_learner_records";
const eligibilityDeclarationsTable = "levytate_learner_eligibility_declarations";
const preEnrolmentChecksTable = "levytate_learner_pre_enrolment_checks";
const breaksTable = "levytate_learner_breaks_in_learning";
const withdrawalsTable = "levytate_learner_withdrawals";
const reviewsTable = "levytate_learner_reviews";
const progressTable = "levytate_learner_progress_updates";
const assessmentReadinessTable = "levytate_learner_assessment_readiness";
const achievementsTable = "levytate_learner_achievements";
const operationalActionsTable = "levytate_learner_operational_actions";
const lifecycleEventsTable = "levytate_learner_lifecycle_events";
const persistentOperationalActionsTable = "levytate_operational_actions";

export class LevyTateLearnerLifecycleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LevyTateLearnerLifecycleError";
  }
}

export class LevyTateLearnerLifecyclePermissionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LevyTateLearnerLifecyclePermissionError";
  }
}

export class LevyTateLearnerLifecycleValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LevyTateLearnerLifecycleValidationError";
  }
}

export class LevyTateLearnerLifecycleConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LevyTateLearnerLifecycleConflictError";
  }
}

export type PreEnrolmentUpdateInput = {
  expectedUpdatedAt?: string;
  employmentRoute?: LearnerEmploymentRoute;
  eligibilityVerification?: {
    verificationStatus?: LearnerEligibilityVerificationStatus;
    notes?: string;
  };
  probation?: {
    probationStatus?: LearnerProbationStatus;
    probationPassedDate?: string;
    probationNotes?: string;
  };
  hrApproval?: {
    hrApprovalStatus?: LearnerHrApprovalStatus;
    hrApprovedDate?: string;
    hrApprovalNotes?: string;
  };
  programme?: {
    programmeId?: string;
    providerId?: string;
    applicationId?: string;
    expectedStartDate?: string;
    actualStartDate?: string;
    expectedEndDate?: string;
    changeReason?: string;
  };
  guides?: {
    guidesSent?: boolean;
    guidesSentDate?: string;
    guidesVersion?: string;
    recipientSummary?: string;
    guidesNotes?: string;
  };
};

export type ProgressUpdateInput = {
  expectedActivityVersion?: string;
  idempotencyKey: string;
  updateDate: string;
  targetProgressPercentage: number;
  actualProgressPercentage: number;
  progressSource: LearnerProgressSource;
  sourceReference?: string;
  summary?: string;
  supportAction?: string;
};

export type LearnerReviewInput = {
  expectedActivityVersion?: string;
  idempotencyKey: string;
  reviewType: LearnerReviewType;
  reviewDate: string;
  nextReviewDate?: string;
  reviewerName: string;
  providerId?: string;
  summary?: string;
  actions?: string[];
  supportRequired?: string;
  status: LearnerReviewStatus;
};

export type StartBreakInLearningInput = {
  expectedActivityVersion?: string;
  idempotencyKey: string;
  startDate: string;
  expectedReturnDate?: string;
  expectedReturnUnknown?: boolean;
  reviewDate?: string;
  reasonCategory: LearnerBreakReasonCategory;
  reasonNotes?: string;
  providerNotified: boolean;
  providerNotifiedDate?: string;
  employeeNotified: boolean;
  employeeNotifiedDate?: string;
  managerNotified: boolean;
  managerNotifiedDate?: string;
  returnPlanNotes?: string;
  effectiveLifecycleDate: string;
};

export type UpdateBreakInLearningInput = {
  expectedActivityVersion?: string;
  expectedReturnDate?: string;
  expectedReturnUnknown?: boolean;
  reviewDate?: string;
  reasonNotes?: string;
  providerNotified?: boolean;
  providerNotifiedDate?: string;
  employeeNotified?: boolean;
  employeeNotifiedDate?: string;
  managerNotified?: boolean;
  managerNotifiedDate?: string;
  returnPlanNotes?: string;
  correctedStartDate?: string;
  startDateCorrectionReason?: string;
};

export type ReturnFromBreakInput = {
  expectedActivityVersion?: string;
  idempotencyKey: string;
  actualReturnDate: string;
  returnConfirmationNote: string;
  programmeStillValidConfirmed: boolean;
  providerReturnConfirmed: boolean;
  managerReturnConfirmed: boolean;
  learnerReturnConfirmed: boolean;
  revisedExpectedEndDate?: string;
  revisedReviewDate?: string;
  immediateSupportAction?: string;
  progressResetNote?: string;
  firstCheckInDate?: string;
};

export type CancelBreakInput = {
  expectedActivityVersion?: string;
  idempotencyKey: string;
  cancellationReason: string;
};

export type LearnerBreakMutationResult = {
  record: LearnerBreakInLearning;
  learner: LearnerRecordDetail;
  created: boolean;
};

export type LearnerActivityMutationResult<T> = {
  record: T;
  learner: LearnerRecordDetail;
  created: boolean;
};

export type AssessmentReadinessUpdateInput = {
  expectedActivityVersion?: string;
  assessmentModel?: LearnerAssessmentReadiness["assessmentModel"];
  assessmentModelExplanation?: string;
  assessmentOrganisation?: string;
  assessmentContact?: string;
  assessmentReference?: string;
  assessmentNotes?: string;
  expectedAssessmentReadinessDate?: string;
  gatewayDate?: string;
  expectedAssessmentStartDate?: string;
  confirmations?: Partial<Record<AssessmentConfirmationType, Partial<AssessmentReadinessConfirmation>>>;
};

export type AssessmentTransitionInput = {
  expectedActivityVersion?: string;
  idempotencyKey: string;
};

export type ConfirmAssessmentReadinessInput = AssessmentTransitionInput & {
  actualAssessmentReadinessDate?: string;
  gatewayDate?: string;
};

export type StartAssessmentInput = AssessmentTransitionInput & {
  assessmentStartDate?: string;
};

export async function createLearnerRecord(
  session: LevyTateBetaSession,
  input: Omit<LearnerRecord, "id" | "organisationId" | "createdAt" | "updatedAt" | "createdBy" | "updatedBy" | "recordStatus"> & Partial<Pick<LearnerRecord, "id" | "recordStatus">>,
) {
  const context = await contextForSession(session);
  assertPermission(context, "learnerLifecycle:write");
  await assertCanAccessEmployee(context, input.employeeId, "write");
  await assertNoDuplicateActiveLearnerRecord(context.organisation.id, input.employeeId, input.applicationId);

  const timestamp = nowIso();
  const record: LearnerRecord = {
    id: input.id ?? createMvpId("learner"),
    organisationId: context.organisation.id,
    employeeId: input.employeeId,
    applicationId: input.applicationId,
    programmeId: input.programmeId,
    providerId: input.providerId,
    enrolmentId: input.enrolmentId,
    lifecycleStatus: input.lifecycleStatus,
    employmentRoute: input.employmentRoute,
    expectedStartDate: input.expectedStartDate,
    actualStartDate: input.actualStartDate,
    expectedEndDate: input.expectedEndDate,
    actualEndDate: input.actualEndDate,
    createdAt: timestamp,
    updatedAt: timestamp,
    createdBy: context.user.email,
    updatedBy: context.user.email,
    recordStatus: input.recordStatus ?? "Active",
    demonstrationRecord: input.demonstrationRecord ?? false,
  };

  await upsertLearnerRecord(record);
  await recordLifecycleEvent(context, record.id, "learner_record_created", "", record.lifecycleStatus, "Learner lifecycle record created.", { employeeId: record.employeeId, applicationId: record.applicationId });
  return record;
}

export async function updateLearnerLifecycleStatus(
  session: LevyTateBetaSession,
  learnerRecordId: string,
  nextStatus: LearnerLifecycleStatus,
  summary = `Learner moved to ${nextStatus}.`,
  metadata: Record<string, unknown> = {},
) {
  const context = await contextForSession(session);
  assertPermission(context, "learnerLifecycle:status");
  const record = await getScopedLearnerRecord(context, learnerRecordId, "write");
  assertLearnerLifecycleTransition(record.lifecycleStatus, nextStatus);

  const updated = {
    ...record,
    lifecycleStatus: nextStatus,
    updatedAt: nowIso(),
    updatedBy: context.user.email,
  };

  await upsertLearnerRecord(updated);
  await recordLifecycleEvent(context, record.id, "lifecycle_status_changed", record.lifecycleStatus, nextStatus, summary, metadata);
  return updated;
}

export async function recordEligibilityDeclaration(
  session: LevyTateBetaSession,
  declaration: Omit<LearnerEligibilityDeclaration, "id" | "organisationId" | "declarationWording" | "declarationVersion" | "createdAt" | "updatedAt"> & Partial<Pick<LearnerEligibilityDeclaration, "id" | "declarationWording" | "declarationVersion">>,
) {
  const context = await contextForSession(session);
  assertPermission(context, "learnerLifecycle:write");
  await getScopedLearnerRecord(context, declaration.learnerRecordId, "write");
  if (declaration.expectedEnglandWorkingHoursPercentage !== null) {
    assertPercentage(declaration.expectedEnglandWorkingHoursPercentage, "expectedEnglandWorkingHoursPercentage");
  }

  const timestamp = nowIso();
  const next: LearnerEligibilityDeclaration = {
    id: declaration.id ?? createMvpId("learner-eligibility"),
    organisationId: context.organisation.id,
    learnerRecordId: declaration.learnerRecordId,
    declarationType: declaration.declarationType,
    declarationWording: declaration.declarationWording ?? englandWorkingHoursDeclarationWording,
    declarationVersion: declaration.declarationVersion ?? englandWorkingHoursDeclarationVersion,
    confirmed: declaration.confirmed,
    confirmedByEmployee: declaration.confirmedByEmployee,
    confirmedAt: declaration.confirmedAt,
    expectedEnglandWorkingHoursPercentage: declaration.expectedEnglandWorkingHoursPercentage,
    verifiedBy: declaration.verifiedBy,
    verifiedAt: declaration.verifiedAt,
    verificationStatus: declaration.verificationStatus,
    notes: declaration.notes,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  await supabaseInsert<LearnerEligibilityDeclarationRow>(assertSupabase(), eligibilityDeclarationsTable, [eligibilityDeclarationToRow(next)], {
    query: "on_conflict=organisation_id,id",
    prefer: "resolution=merge-duplicates,return=minimal",
  });
  await recordLifecycleEvent(context, next.learnerRecordId, "eligibility_declaration_recorded", "", "", "Eligibility declaration recorded.", { verificationStatus: next.verificationStatus });
  return next;
}

export async function updatePreEnrolmentChecks(
  session: LevyTateBetaSession,
  checks: Omit<LearnerPreEnrolmentChecks, "id" | "organisationId" | "createdAt" | "updatedAt"> & Partial<Pick<LearnerPreEnrolmentChecks, "id" | "createdAt">>,
) {
  const context = await contextForSession(session);
  assertPermission(context, "learnerLifecycle:write");
  await getScopedLearnerRecord(context, checks.learnerRecordId, "write");

  const timestamp = nowIso();
  const next: LearnerPreEnrolmentChecks = {
    id: checks.id ?? createMvpId("learner-checks"),
    organisationId: context.organisation.id,
    learnerRecordId: checks.learnerRecordId,
    probationStatus: checks.probationStatus,
    probationPassedDate: checks.probationPassedDate,
    probationConfirmedBy: checks.probationConfirmedBy,
    probationConfirmedAt: checks.probationConfirmedAt,
    probationNotes: checks.probationNotes,
    hrApprovalStatus: checks.hrApprovalStatus,
    hrApprovedDate: checks.hrApprovedDate,
    hrApprovedBy: checks.hrApprovedBy,
    hrApprovalNotes: checks.hrApprovalNotes,
    guidesSent: checks.guidesSent,
    guidesSentDate: checks.guidesSentDate,
    guidesSentBy: checks.guidesSentBy,
    guidesVersion: checks.guidesVersion,
    guidesNotes: checks.guidesNotes,
    createdAt: checks.createdAt ?? timestamp,
    updatedAt: timestamp,
  };

  await supabaseInsert<LearnerPreEnrolmentChecksRow>(assertSupabase(), preEnrolmentChecksTable, [preEnrolmentChecksToRow(next)], {
    query: "on_conflict=organisation_id,id",
    prefer: "resolution=merge-duplicates,return=minimal",
  });
  await recordLifecycleEvent(context, next.learnerRecordId, "pre_enrolment_checks_updated", "", "", "Pre-enrolment checks updated.", { probationStatus: next.probationStatus, hrApprovalStatus: next.hrApprovalStatus });
  return next;
}

export async function addLearnerReview(session: LevyTateBetaSession, learnerRecordId: string, input: LearnerReviewInput): Promise<LearnerActivityMutationResult<LearnerReview>> {
  const context = await contextForSession(session);
  assertPermission(context, "learnerLifecycle:write");
  const learnerRecord = await getScopedLearnerRecord(context, learnerRecordId, "write");
  assertReviewEligible(learnerRecord.lifecycleStatus);
  if (learnerRecord.lifecycleStatus === "break_in_learning" && !["l_and_d_check_in", "manager_check_in"].includes(input.reviewType)) {
    throw new LevyTateLearnerLifecycleValidationError("Only a support-oriented L&D or manager check-in can be recorded while a learner is on a break in learning.");
  }
  const id = activityRecordId("learner-review", learnerRecordId, input.idempotencyKey);
  const existing = await selectOne<LearnerReviewRow>(reviewsTable, new URLSearchParams({ select: "*", organisation_id: `eq.${context.organisation.id}`, id: `eq.${id}`, limit: "1" }));
  if (existing) return { record: reviewFromRow(existing), learner: await getOrganisationLearnerLifecycleRecordDetail(session, learnerRecordId), created: false };

  const collections = await loadLearnerLifecycleCollectionsForRecord(session, learnerRecordId);
  latestActivityVersionRequired(collections, learnerRecord, input.expectedActivityVersion);
  assertAllowedValue(input.reviewType, learnerReviewTypeLabels, "review type");
  assertAllowedValue(input.status, learnerReviewStatusLabels, "review status");
  assertOperationalDate(input.reviewDate, "Review date");
  if (input.nextReviewDate) assertValidDate(input.nextReviewDate, "Next review date");
  const reviewerName = requiredText(input.reviewerName, "Reviewer name");
  const actions = stringArray(input.actions).map((value) => value.trim()).filter(Boolean);
  const summary = cleanText(input.summary);
  const supportRequired = cleanText(input.supportRequired);
  if (input.status === "cancelled" && !summary && !supportRequired) throw new LevyTateLearnerLifecycleValidationError("A cancellation reason is required.");
  if (input.status === "action_required" && !actions.length && !supportRequired) throw new LevyTateLearnerLifecycleValidationError("Record an agreed action or the support required when review action is required.");

  let providerId = cleanText(input.providerId);
  if (input.reviewType === "provider_review") {
    providerId = requiredText(providerId || learnerRecord.providerId, "Provider");
    await assertProviderInOrganisation(context, providerId);
  } else if (providerId) {
    await assertProviderInOrganisation(context, providerId);
  }

  const timestamp = nowIso();
  const next: LearnerReview = {
    id,
    organisationId: context.organisation.id,
    learnerRecordId,
    reviewType: input.reviewType,
    reviewDate: input.reviewDate,
    nextReviewDate: cleanText(input.nextReviewDate),
    reviewerName,
    reviewerUserId: context.user.id,
    providerId,
    summary,
    actions,
    supportRequired,
    status: input.status,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  await supabaseInsert<LearnerReviewRow>(assertSupabase(), reviewsTable, [reviewToRow(next)], {
    query: "on_conflict=organisation_id,id",
    prefer: "resolution=merge-duplicates,return=minimal",
  });
  const eventType = reviewEventType(next.reviewType);
  await recordLifecycleEvent(context, learnerRecordId, eventType, "", "", `${learnerReviewTypeLabels[next.reviewType]} recorded.`, { reviewId: next.id, reviewType: next.reviewType, reviewDate: next.reviewDate, nextReviewDate: next.nextReviewDate, status: next.status });
  if (next.status === "action_required") await recordLifecycleEvent(context, learnerRecordId, "review_action_required", "", "", `${learnerReviewTypeLabels[next.reviewType]} requires action.`, { reviewId: next.id, actions: next.actions, supportRequired: next.supportRequired });
  return { record: next, learner: await getOrganisationLearnerLifecycleRecordDetail(session, learnerRecordId), created: true };
}

export async function addProgressUpdate(session: LevyTateBetaSession, learnerRecordId: string, input: ProgressUpdateInput): Promise<LearnerActivityMutationResult<LearnerProgressUpdate>> {
  const context = await contextForSession(session);
  assertPermission(context, "learnerLifecycle:write");
  const learnerRecord = await getScopedLearnerRecord(context, learnerRecordId, "write");
  assertProgressEligible(learnerRecord.lifecycleStatus);
  const id = activityRecordId("learner-progress", learnerRecordId, input.idempotencyKey);
  const existing = await selectOne<LearnerProgressUpdateRow>(progressTable, new URLSearchParams({ select: "*", organisation_id: `eq.${context.organisation.id}`, id: `eq.${id}`, limit: "1" }));
  if (existing) return { record: progressUpdateFromRow(existing), learner: await getOrganisationLearnerLifecycleRecordDetail(session, learnerRecordId), created: false };

  const collections = await loadLearnerLifecycleCollectionsForRecord(session, learnerRecordId);
  latestActivityVersionRequired(collections, learnerRecord, input.expectedActivityVersion);
  assertOperationalDate(input.updateDate, "Update date");
  assertAllowedValue(input.progressSource, learnerProgressSourceLabels, "progress source");
  assertProgressPercentage(input.targetProgressPercentage, "Target progress percentage");
  assertProgressPercentage(input.actualProgressPercentage, "Actual progress percentage");
  const variance = calculateLearnerProgressVariance(input.targetProgressPercentage, input.actualProgressPercentage);

  const next: LearnerProgressUpdate = {
    id,
    organisationId: context.organisation.id,
    learnerRecordId,
    updateDate: input.updateDate,
    targetProgressPercentage: input.targetProgressPercentage,
    actualProgressPercentage: input.actualProgressPercentage,
    variancePercentage: variance,
    progressSource: input.progressSource,
    sourceReference: cleanText(input.sourceReference),
    updatedBy: context.user.email,
    summary: cleanText(input.summary),
    supportAction: cleanText(input.supportAction) || "No support required",
    createdAt: nowIso(),
  };

  await supabaseInsert<LearnerProgressUpdateRow>(assertSupabase(), progressTable, [progressUpdateToRow(next)], {
    query: "on_conflict=organisation_id,id",
    prefer: "resolution=merge-duplicates,return=minimal",
  });
  const position = deriveProgressPosition(next);
  await recordLifecycleEvent(context, learnerRecordId, "progress_updated", "", "", `Progress update recorded: ${next.actualProgressPercentage}% actual against ${next.targetProgressPercentage}% target.`, { progressId: next.id, target: next.targetProgressPercentage, actual: next.actualProgressPercentage, variance: next.variancePercentage, progressPosition: position, supportAction: next.supportAction });
  if (position === "Slightly behind" || position === "Significantly behind") await recordLifecycleEvent(context, learnerRecordId, "learner_identified_behind_target", "", "", `Learner identified as ${position.toLowerCase()} by ${Math.abs(next.variancePercentage)} percentage points.`, { progressId: next.id, variance: next.variancePercentage, progressPosition: position });
  return { record: next, learner: await getOrganisationLearnerLifecycleRecordDetail(session, learnerRecordId), created: true };
}

export async function startBreakInLearning(session: LevyTateBetaSession, learnerRecordId: string, input: StartBreakInLearningInput): Promise<LearnerBreakMutationResult> {
  const context = await contextForSession(session);
  assertPermission(context, "learnerLifecycle:status");
  const learner = await getScopedLearnerRecord(context, learnerRecordId, "write");
  const id = activityRecordId("learner-break", learnerRecordId, input.idempotencyKey);
  const duplicate = await selectOne<LearnerBreakInLearningRow>(breaksTable, new URLSearchParams({ select: "*", organisation_id: `eq.${context.organisation.id}`, id: `eq.${id}`, limit: "1" }));
  if (duplicate) return { record: breakFromRow(duplicate), learner: await getOrganisationLearnerLifecycleRecordDetail(session, learnerRecordId), created: false };
  const active = await getActiveBreakRow(context.organisation.id, learnerRecordId);
  if (active) throw new LevyTateLearnerLifecycleConflictError("This learner already has an active break in learning.");
  if (!learnerBreakPolicy.eligibleStartStatuses.includes(learner.lifecycleStatus)) throw new LevyTateLearnerLifecycleValidationError("A break in learning can only be started for an enrolled learner or a learner preparing for assessment.");
  const collections = await loadLearnerLifecycleCollectionsForRecord(session, learnerRecordId);
  latestActivityVersionRequired(collections, learner, input.expectedActivityVersion);
  validateBreakStartInput(learner, input);
  const timestamp = nowIso();
  const next: LearnerBreakInLearning = {
    ...emptyBreakOperationalFields(), id, organisationId: context.organisation.id, learnerRecordId,
    startDate: input.startDate, expectedReturnDate: cleanText(input.expectedReturnDate), actualReturnDate: "",
    reasonCategory: input.reasonCategory, reasonNotes: cleanText(input.reasonNotes), previousLifecycleStatus: learner.lifecycleStatus as "enrolled" | "assessment_preparation",
    expectedReturnUnknown: Boolean(input.expectedReturnUnknown), reviewDate: cleanText(input.reviewDate),
    providerNotified: input.providerNotified, providerNotifiedDate: notificationDate(input.providerNotified, input.providerNotifiedDate, "Provider notified date"),
    employeeNotified: input.employeeNotified, employeeNotifiedDate: notificationDate(input.employeeNotified, input.employeeNotifiedDate, "Employee notified date"),
    managerNotified: input.managerNotified, managerNotifiedDate: notificationDate(input.managerNotified, input.managerNotifiedDate, "Manager notified date"),
    returnPlanNotes: cleanText(input.returnPlanNotes), effectiveLifecycleDate: input.effectiveLifecycleDate,
    status: "active", recordedBy: context.user.email, recordedAt: timestamp, updatedAt: timestamp,
  };
  await supabaseInsert<LearnerBreakInLearningRow>(assertSupabase(), breaksTable, [breakToRow(next)], { query: "on_conflict=organisation_id,id", prefer: "resolution=merge-duplicates,return=minimal" });
  await persistLearnerStatus(context, learner, "break_in_learning");
  await recordLifecycleEvent(context, learnerRecordId, "break_started", learner.lifecycleStatus, "break_in_learning", "Break in learning started.", { breakId: next.id, startDate: next.startDate, expectedReturnDate: next.expectedReturnDate, expectedReturnUnknown: next.expectedReturnUnknown, reasonCategory: next.reasonCategory, effectiveLifecycleDate: next.effectiveLifecycleDate });
  return { record: next, learner: await getOrganisationLearnerLifecycleRecordDetail(session, learnerRecordId), created: true };
}

export async function updateBreakInLearning(session: LevyTateBetaSession, learnerRecordId: string, breakId: string, input: UpdateBreakInLearningInput): Promise<LearnerBreakMutationResult> {
  const context = await contextForSession(session);
  assertPermission(context, "learnerLifecycle:status");
  const learner = await getScopedLearnerRecord(context, learnerRecordId, "write");
  if (learner.lifecycleStatus !== "break_in_learning") throw new LevyTateLearnerLifecycleValidationError("Break details can only be updated while the learner is on a break in learning.");
  const currentRow = await getBreakRow(context.organisation.id, learnerRecordId, breakId);
  if (!currentRow) throw new LevyTateLearnerLifecycleError("Break in learning record was not found.");
  const current = breakFromRow(currentRow);
  if (current.status !== "active") throw new LevyTateLearnerLifecycleValidationError("Only an active break in learning can be updated.");
  const collections = await loadLearnerLifecycleCollectionsForRecord(session, learnerRecordId);
  latestActivityVersionRequired(collections, learner, input.expectedActivityVersion);
  const correctedStartDate = cleanText(input.correctedStartDate);
  if (correctedStartDate && correctedStartDate !== current.startDate) {
    requiredText(input.startDateCorrectionReason, "Start date correction reason");
    assertBreakStartDate(learner, correctedStartDate);
  }
  const next: LearnerBreakInLearning = {
    ...current,
    startDate: correctedStartDate || current.startDate,
    expectedReturnDate: input.expectedReturnDate === undefined ? current.expectedReturnDate : cleanText(input.expectedReturnDate),
    expectedReturnUnknown: input.expectedReturnUnknown ?? current.expectedReturnUnknown,
    reviewDate: input.reviewDate === undefined ? current.reviewDate : cleanText(input.reviewDate),
    reasonNotes: input.reasonNotes === undefined ? current.reasonNotes : cleanText(input.reasonNotes),
    providerNotified: input.providerNotified ?? current.providerNotified,
    providerNotifiedDate: input.providerNotified === undefined && input.providerNotifiedDate === undefined ? current.providerNotifiedDate : notificationDate(input.providerNotified ?? current.providerNotified, input.providerNotifiedDate ?? current.providerNotifiedDate, "Provider notified date"),
    employeeNotified: input.employeeNotified ?? current.employeeNotified,
    employeeNotifiedDate: input.employeeNotified === undefined && input.employeeNotifiedDate === undefined ? current.employeeNotifiedDate : notificationDate(input.employeeNotified ?? current.employeeNotified, input.employeeNotifiedDate ?? current.employeeNotifiedDate, "Employee notified date"),
    managerNotified: input.managerNotified ?? current.managerNotified,
    managerNotifiedDate: input.managerNotified === undefined && input.managerNotifiedDate === undefined ? current.managerNotifiedDate : notificationDate(input.managerNotified ?? current.managerNotified, input.managerNotifiedDate ?? current.managerNotifiedDate, "Manager notified date"),
    returnPlanNotes: input.returnPlanNotes === undefined ? current.returnPlanNotes : cleanText(input.returnPlanNotes),
    startDateCorrectionReason: correctedStartDate && correctedStartDate !== current.startDate ? requiredText(input.startDateCorrectionReason, "Start date correction reason") : current.startDateCorrectionReason,
    updatedAt: nowIso(),
  };
  validateBreakReturnPlanning(next);
  await updateBreakRow(context.organisation.id, next);
  await recordLifecycleEvent(context, learnerRecordId, "break_details_updated", "break_in_learning", "break_in_learning", "Break in learning details updated.", { breakId, expectedReturnDate: next.expectedReturnDate, reviewDate: next.reviewDate });
  if (current.expectedReturnDate !== next.expectedReturnDate) await recordLifecycleEvent(context, learnerRecordId, "break_expected_return_changed", "break_in_learning", "break_in_learning", "Expected return date changed.", { breakId, previousExpectedReturnDate: current.expectedReturnDate, expectedReturnDate: next.expectedReturnDate });
  if (current.startDate !== next.startDate) await recordLifecycleEvent(context, learnerRecordId, "break_start_date_corrected", "break_in_learning", "break_in_learning", "Break start date corrected.", { breakId, previousStartDate: current.startDate, startDate: next.startDate, correctionReason: next.startDateCorrectionReason });
  return { record: next, learner: await getOrganisationLearnerLifecycleRecordDetail(session, learnerRecordId), created: false };
}

export async function returnFromBreak(session: LevyTateBetaSession, learnerRecordId: string, breakId: string, input: ReturnFromBreakInput): Promise<LearnerBreakMutationResult> {
  const context = await contextForSession(session);
  assertPermission(context, "learnerLifecycle:status");
  const learner = await getScopedLearnerRecord(context, learnerRecordId, "write");
  const row = await getBreakRow(context.organisation.id, learnerRecordId, breakId);
  if (!row) throw new LevyTateLearnerLifecycleError("Break in learning record was not found.");
  const current = breakFromRow(row);
  if (current.status === "returned" && current.actualReturnDate === cleanText(input.actualReturnDate)) return { record: current, learner: await getOrganisationLearnerLifecycleRecordDetail(session, learnerRecordId), created: false };
  if (learner.lifecycleStatus !== "break_in_learning" || current.status !== "active") throw new LevyTateLearnerLifecycleValidationError("Only an active break in learning can be returned to active learning.");
  const collections = await loadLearnerLifecycleCollectionsForRecord(session, learnerRecordId);
  latestActivityVersionRequired(collections, learner, input.expectedActivityVersion);
  validateBreakReturnInput(current, input);
  const next: LearnerBreakInLearning = { ...current, actualReturnDate: input.actualReturnDate, returnConfirmationNote: requiredText(input.returnConfirmationNote, "Return confirmation note"), programmeStillValidConfirmed: input.programmeStillValidConfirmed, providerReturnConfirmed: input.providerReturnConfirmed, managerReturnConfirmed: input.managerReturnConfirmed, learnerReturnConfirmed: input.learnerReturnConfirmed, revisedExpectedEndDate: cleanText(input.revisedExpectedEndDate), revisedReviewDate: cleanText(input.revisedReviewDate), immediateSupportAction: cleanText(input.immediateSupportAction), progressResetNote: cleanText(input.progressResetNote), firstCheckInDate: cleanText(input.firstCheckInDate), status: "returned", updatedAt: nowIso() };
  await updateBreakRow(context.organisation.id, next);
  const learnerWithDates = { ...learner, expectedEndDate: next.revisedExpectedEndDate || learner.expectedEndDate };
  await persistLearnerStatus(context, learnerWithDates, "enrolled");
  await recordLifecycleEvent(context, learnerRecordId, "returned_from_break", "break_in_learning", "enrolled", "Learner returned from break in learning.", { breakId, actualReturnDate: next.actualReturnDate, revisedExpectedEndDate: next.revisedExpectedEndDate, revisedReviewDate: next.revisedReviewDate, immediateSupportAction: next.immediateSupportAction, firstCheckInDate: next.firstCheckInDate });
  return { record: next, learner: await getOrganisationLearnerLifecycleRecordDetail(session, learnerRecordId), created: true };
}

export async function cancelBreakInLearning(session: LevyTateBetaSession, learnerRecordId: string, breakId: string, input: CancelBreakInput): Promise<LearnerBreakMutationResult> {
  const context = await contextForSession(session);
  assertPermission(context, "learnerLifecycle:status");
  const learner = await getScopedLearnerRecord(context, learnerRecordId, "write");
  const row = await getBreakRow(context.organisation.id, learnerRecordId, breakId);
  if (!row) throw new LevyTateLearnerLifecycleError("Break in learning record was not found.");
  const current = breakFromRow(row);
  if (current.status === "cancelled") return { record: current, learner: await getOrganisationLearnerLifecycleRecordDetail(session, learnerRecordId), created: false };
  if (learner.lifecycleStatus !== "break_in_learning" || current.status !== "active") throw new LevyTateLearnerLifecycleValidationError("Only an active break entered incorrectly can be cancelled.");
  const collections = await loadLearnerLifecycleCollectionsForRecord(session, learnerRecordId);
  latestActivityVersionRequired(collections, learner, input.expectedActivityVersion);
  const cancellationReason = requiredText(input.cancellationReason, "Cancellation reason");
  const timestamp = nowIso();
  const next = { ...current, status: "cancelled" as const, cancellationReason, cancelledBy: context.user.email, cancelledAt: timestamp, updatedAt: timestamp };
  await updateBreakRow(context.organisation.id, next);
  await persistLearnerStatus(context, learner, current.previousLifecycleStatus);
  await recordLifecycleEvent(context, learnerRecordId, "break_cancelled", "break_in_learning", current.previousLifecycleStatus, "Break in learning record cancelled.", { breakId, cancellationReason });
  return { record: next, learner: await getOrganisationLearnerLifecycleRecordDetail(session, learnerRecordId), created: true };
}

export async function recordWithdrawal(
  session: LevyTateBetaSession,
  withdrawal: Omit<LearnerWithdrawal, "id" | "organisationId" | "recordedBy" | "recordedAt"> & Partial<Pick<LearnerWithdrawal, "id">>,
) {
  const context = await contextForSession(session);
  await updateLearnerLifecycleStatus(session, withdrawal.learnerRecordId, "withdrawn", "Learner withdrawn.", { reasonCategory: withdrawal.reasonCategory });
  const next: LearnerWithdrawal = {
    id: withdrawal.id ?? createMvpId("learner-withdrawal"),
    organisationId: context.organisation.id,
    learnerRecordId: withdrawal.learnerRecordId,
    withdrawalDate: withdrawal.withdrawalDate,
    effectiveDate: withdrawal.effectiveDate,
    reasonCategory: withdrawal.reasonCategory,
    reasonNotes: withdrawal.reasonNotes,
    initiatedBy: withdrawal.initiatedBy,
    providerNotified: withdrawal.providerNotified,
    providerNotifiedDate: withdrawal.providerNotifiedDate,
    employeeNotified: withdrawal.employeeNotified,
    employeeNotifiedDate: withdrawal.employeeNotifiedDate,
    recordedBy: context.user.email,
    recordedAt: nowIso(),
  };

  await supabaseInsert<LearnerWithdrawalRow>(assertSupabase(), withdrawalsTable, [withdrawalToRow(next)], {
    query: "on_conflict=organisation_id,id",
    prefer: "resolution=merge-duplicates,return=minimal",
  });
  return next;
}

export async function updateAssessmentReadinessDetails(
  session: LevyTateBetaSession,
  learnerRecordId: string,
  input: AssessmentReadinessUpdateInput,
): Promise<LearnerRecordDetail> {
  const context = await contextForSession(session);
  assertPermission(context, "learnerLifecycle:write");
  const learner = await getScopedLearnerRecord(context, learnerRecordId, "write");
  assertAssessmentManagementEligible(learner.lifecycleStatus);
  const collections = await loadLearnerLifecycleCollectionsForRecord(session, learnerRecordId);
  latestActivityVersionRequired(collections, learner, input.expectedActivityVersion);
  const current = collections.assessmentReadiness[0] ?? null;
  const next = buildAssessmentReadinessUpdate(context, learner, current, input);
  await persistAssessmentReadiness(context, current, next);
  await emitAssessmentUpdateEvents(context, current, next);
  await synchroniseLearnerOperationalActions(session, learnerRecordId);
  return getOrganisationLearnerLifecycleRecordDetail(session, learnerRecordId);
}

export async function moveLearnerToAssessmentPreparation(
  session: LevyTateBetaSession,
  learnerRecordId: string,
  input: AssessmentTransitionInput,
): Promise<{ learner: LearnerRecordDetail; created: boolean }> {
  activityRecordId("assessment-preparation", learnerRecordId, input.idempotencyKey);
  const context = await contextForSession(session);
  assertPermission(context, "learnerLifecycle:status");
  const learner = await getScopedLearnerRecord(context, learnerRecordId, "write");
  if (learner.lifecycleStatus === "assessment_preparation") {
    return { learner: await getOrganisationLearnerLifecycleRecordDetail(session, learnerRecordId), created: false };
  }
  if (learner.lifecycleStatus !== "enrolled") {
    throw new LevyTateLearnerLifecycleValidationError("Only an enrolled learner can move to assessment preparation.");
  }
  const collections = await loadLearnerLifecycleCollectionsForRecord(session, learnerRecordId);
  latestActivityVersionRequired(collections, learner, input.expectedActivityVersion);
  const blockers = await criticalOperationalBlockers(context, learnerRecordId);
  if (blockers.length) throw new LevyTateLearnerLifecycleValidationError(`Assessment preparation is blocked: ${blockers[0]}`);
  const current = collections.assessmentReadiness[0] ?? null;
  const timestamp = nowIso();
  const next = { ...emptyAssessmentRecord(context, learner, current, timestamp), assessmentStatus: "preparing" as const, updatedBy: context.user.email, updatedAt: timestamp, version: (current?.version ?? 0) + 1 };
  await persistAssessmentReadiness(context, current, next);
  await persistLearnerStatus(context, learner, "assessment_preparation");
  await recordLifecycleEvent(context, learnerRecordId, "moved_to_assessment_preparation", "enrolled", "assessment_preparation", "Learner moved to assessment preparation.", { assessmentStatus: "preparing" });
  await synchroniseLearnerOperationalActions(session, learnerRecordId);
  return { learner: await getOrganisationLearnerLifecycleRecordDetail(session, learnerRecordId), created: true };
}

export async function confirmLearnerAssessmentReadiness(
  session: LevyTateBetaSession,
  learnerRecordId: string,
  input: ConfirmAssessmentReadinessInput,
): Promise<{ learner: LearnerRecordDetail; created: boolean }> {
  activityRecordId("assessment-readiness-confirmation", learnerRecordId, input.idempotencyKey);
  const context = await contextForSession(session);
  assertPermission(context, "learnerLifecycle:status");
  const learner = await getScopedLearnerRecord(context, learnerRecordId, "write");
  const collections = await loadLearnerLifecycleCollectionsForRecord(session, learnerRecordId);
  const current = collections.assessmentReadiness[0] ?? null;
  if (learner.lifecycleStatus === "assessment_preparation" && current?.assessmentStatus === "readiness_confirmed") {
    return { learner: await getOrganisationLearnerLifecycleRecordDetail(session, learnerRecordId), created: false };
  }
  if (learner.lifecycleStatus !== "assessment_preparation") {
    throw new LevyTateLearnerLifecycleValidationError("Assessment readiness can only be confirmed during assessment preparation.");
  }
  latestActivityVersionRequired(collections, learner, input.expectedActivityVersion);
  if (!current) throw new LevyTateLearnerLifecycleValidationError("Complete the assessment readiness record before confirming readiness.");
  const timestamp = nowIso();
  const gatewayDate = input.gatewayDate === undefined ? current.gatewayDate : cleanDate(input.gatewayDate, "gateway date");
  const actualDate = cleanDate(input.actualAssessmentReadinessDate, "actual assessment-readiness date")
    || (assessmentModelUsesGateway(current.assessmentModel) && gatewayDate ? gatewayDate : timestamp.slice(0, 10));
  const candidate: LearnerAssessmentReadiness = { ...current, actualAssessmentReadinessDate: actualDate, gatewayDate, updatedBy: context.user.email, updatedAt: timestamp, version: current.version + 1 };
  validateAssessmentDates(learner, candidate);
  const blockers = await criticalOperationalBlockers(context, learnerRecordId);
  const result = assessmentResultFor(learner, collections, candidate, blockers);
  if (!result.readyForAssessment) {
    const issue = result.blockingChecks[0] ?? result.outstandingChecks[0];
    throw new LevyTateLearnerLifecycleValidationError(issue?.message ?? "Assessment readiness checks are incomplete.");
  }
  candidate.assessmentStatus = "readiness_confirmed";
  candidate.readinessConfirmedBy = context.user.email;
  candidate.readinessConfirmedAt = timestamp;
  await persistAssessmentReadiness(context, current, candidate);
  if (gatewayDate && gatewayDate !== current.gatewayDate) await recordLifecycleEvent(context, learnerRecordId, "gateway_recorded", "", "", `Gateway recorded for ${gatewayDate}.`, { gatewayDate });
  await recordLifecycleEvent(context, learnerRecordId, "assessment_readiness_confirmed", "assessment_preparation", "assessment_preparation", "Assessment readiness confirmed.", { actualAssessmentReadinessDate: actualDate, gatewayDate, assessmentStatus: "readiness_confirmed" });
  await synchroniseLearnerOperationalActions(session, learnerRecordId);
  return { learner: await getOrganisationLearnerLifecycleRecordDetail(session, learnerRecordId), created: true };
}

export async function startLearnerAssessment(
  session: LevyTateBetaSession,
  learnerRecordId: string,
  input: StartAssessmentInput,
): Promise<{ learner: LearnerRecordDetail; created: boolean }> {
  activityRecordId("assessment-start", learnerRecordId, input.idempotencyKey);
  const context = await contextForSession(session);
  assertPermission(context, "learnerLifecycle:status");
  const learner = await getScopedLearnerRecord(context, learnerRecordId, "write");
  if (learner.lifecycleStatus === "in_assessment") throw new LevyTateLearnerLifecycleConflictError("Learner has already entered assessment.");
  if (learner.lifecycleStatus !== "assessment_preparation") throw new LevyTateLearnerLifecycleValidationError("Only a learner in assessment preparation can enter assessment.");
  const collections = await loadLearnerLifecycleCollectionsForRecord(session, learnerRecordId);
  latestActivityVersionRequired(collections, learner, input.expectedActivityVersion);
  const current = collections.assessmentReadiness[0] ?? null;
  if (!current || current.assessmentStatus !== "readiness_confirmed") throw new LevyTateLearnerLifecycleValidationError("Confirm assessment readiness before moving the learner into assessment.");
  if (current.assessmentModel === "not_confirmed") throw new LevyTateLearnerLifecycleValidationError("Confirm the assessment model before moving the learner into assessment.");
  if (assessmentModelUsesGateway(current.assessmentModel) && !current.gatewayDate) throw new LevyTateLearnerLifecycleValidationError("Record the gateway date before moving the learner into assessment.");
  if (assessmentOrganisationRequired(current.assessmentModel) && !current.assessmentOrganisation) throw new LevyTateLearnerLifecycleValidationError("Record the assessment organisation before moving the learner into assessment.");
  const blockers = await criticalOperationalBlockers(context, learnerRecordId);
  if (blockers.length) throw new LevyTateLearnerLifecycleValidationError(`Assessment entry is blocked: ${blockers[0]}`);
  const timestamp = nowIso();
  const assessmentStartDate = cleanDate(input.assessmentStartDate, "assessment start date") || timestamp.slice(0, 10);
  const next: LearnerAssessmentReadiness = { ...current, assessmentStatus: "in_assessment", assessmentStartDate, updatedBy: context.user.email, updatedAt: timestamp, version: current.version + 1 };
  validateAssessmentDates(learner, next);
  await persistAssessmentReadiness(context, current, next);
  await persistLearnerStatus(context, learner, "in_assessment");
  await recordLifecycleEvent(context, learnerRecordId, "learner_entered_assessment", "assessment_preparation", "in_assessment", "Learner marked as in assessment.", { assessmentStartDate, assessmentStatus: "in_assessment" });
  await synchroniseLearnerOperationalActions(session, learnerRecordId);
  return { learner: await getOrganisationLearnerLifecycleRecordDetail(session, learnerRecordId), created: true };
}

export async function recordAchievement(
  session: LevyTateBetaSession,
  achievement: Omit<LearnerAchievement, "id" | "organisationId" | "recordedBy" | "recordedAt"> & Partial<Pick<LearnerAchievement, "id">>,
) {
  const context = await contextForSession(session);
  await updateLearnerLifecycleStatus(session, achievement.learnerRecordId, "achieved", "Learner achievement recorded.", { grade: achievement.grade });
  const next: LearnerAchievement = {
    id: achievement.id ?? createMvpId("learner-achievement"),
    organisationId: context.organisation.id,
    learnerRecordId: achievement.learnerRecordId,
    expectedAchievementDate: achievement.expectedAchievementDate,
    actualAchievementDate: achievement.actualAchievementDate,
    grade: achievement.grade,
    gradeType: achievement.gradeType,
    certificateReceived: achievement.certificateReceived,
    certificateReceivedDate: achievement.certificateReceivedDate,
    resultNotes: achievement.resultNotes,
    recordedBy: context.user.email,
    recordedAt: nowIso(),
  };

  await supabaseInsert<LearnerAchievementRow>(assertSupabase(), achievementsTable, [achievementToRow(next)], {
    query: "on_conflict=organisation_id,id",
    prefer: "resolution=merge-duplicates,return=minimal",
  });
  await recordLifecycleEvent(context, next.learnerRecordId, "achievement_recorded", "in_assessment", "achieved", "Achievement detail recorded.", { grade: next.grade, gradeType: next.gradeType });
  return next;
}

export async function completeOperationalAction(
  session: LevyTateBetaSession,
  action: Omit<LearnerOperationalAction, "id" | "organisationId" | "status" | "completed" | "completedAt" | "completedBy" | "createdAt" | "updatedAt"> & Partial<Pick<LearnerOperationalAction, "id" | "status" | "createdAt">>,
) {
  const context = await contextForSession(session);
  assertPermission(context, "learnerLifecycle:write");
  await getScopedLearnerRecord(context, action.learnerRecordId, "write");

  const timestamp = nowIso();
  const next: LearnerOperationalAction = {
    id: action.id ?? createMvpId("learner-action"),
    organisationId: context.organisation.id,
    learnerRecordId: action.learnerRecordId,
    actionType: action.actionType,
    status: "completed",
    completed: true,
    completedAt: timestamp,
    completedBy: context.user.email,
    recipientSummary: action.recipientSummary,
    notes: action.notes,
    createdAt: action.createdAt ?? timestamp,
    updatedAt: timestamp,
  };

  await supabaseInsert<LearnerOperationalActionRow>(assertSupabase(), operationalActionsTable, [operationalActionToRow(next)], {
    query: "on_conflict=organisation_id,id",
    prefer: "resolution=merge-duplicates,return=minimal",
  });
  await recordLifecycleEvent(context, next.learnerRecordId, "operational_action_completed", "", "", "Operational communication/action completed.", { actionType: next.actionType });
  return next;
}

export async function getLatestLearnerProgress(session: LevyTateBetaSession, learnerRecordId: string) {
  const collections = await loadLearnerLifecycleCollectionsForRecord(session, learnerRecordId);
  return latestLearnerProgressFromCollections(collections.progressUpdates, learnerRecordId);
}

export async function getLatestProviderReview(session: LevyTateBetaSession, learnerRecordId: string) {
  const collections = await loadLearnerLifecycleCollectionsForRecord(session, learnerRecordId);
  return latestProviderReviewFromCollections(collections.learnerReviews, learnerRecordId);
}

export async function getLatestLAndDCheckIn(session: LevyTateBetaSession, learnerRecordId: string) {
  const collections = await loadLearnerLifecycleCollectionsForRecord(session, learnerRecordId);
  return latestLAndDCheckInFromCollections(collections.learnerReviews, learnerRecordId);
}

export async function getLearnerLifecycleSummary(session: LevyTateBetaSession, learnerRecordId: string) {
  const collections = await loadLearnerLifecycleCollectionsForRecord(session, learnerRecordId);
  return learnerLifecycleSummaryFromCollections(collections, learnerRecordId);
}

export async function listOrganisationLearnerLifecycleSummaries(session: LevyTateBetaSession): Promise<LearnerOperationalSummary[]> {
  const context = await contextForSession(session);
  assertOrganisationLearnerReadPermission(context);
  const organisationId = context.organisation.id;
  const records = await selectMany<LearnerRecordRow>(learnerRecordsTable, organisationId, "record_status=eq.Active", "updated_at.desc");
  if (!records.length) return [];

  const collections = await loadLearnerLifecycleCollectionsForOrganisation(organisationId, records);
  const lookups = await loadLearnerRecordLookups(organisationId);
  return records
    .map(learnerRecordFromRow)
    .map((record) => buildLearnerOperationalSummary(record, collections, lookups))
    .sort(compareLearnerOperationalPriority);
}

export async function listOrganisationLearnerLifecycleDetails(session: LevyTateBetaSession): Promise<LearnerRecordDetail[]> {
  const context = await contextForSession(session);
  assertOrganisationLearnerReadPermission(context);
  const organisationId = context.organisation.id;
  const rows = await selectMany<LearnerRecordRow>(learnerRecordsTable, organisationId, "record_status=eq.Active", "updated_at.desc");
  if (!rows.length) return [];

  const collections = await loadLearnerLifecycleCollectionsForOrganisation(organisationId, rows);
  const lookups = await loadLearnerRecordLookups(organisationId);
  return rows
    .map(learnerRecordFromRow)
    .map((record) => buildLearnerRecordDetail(record, scopedCollections(collections, record.id), lookups));
}

export async function listManagerDirectReportLearnerLifecycleDetails(
  session: LevyTateBetaSession,
  providedScope?: ManagerDirectReportContext,
): Promise<LearnerRecordDetail[]> {
  const scope = providedScope ?? await getManagerDirectReportContext(session);
  assertScopeMatchesSession(session, scope);
  if (!scope.directReports.length) return [];

  const rows = await selectMany<LearnerRecordRow>(
    learnerRecordsTable,
    scope.organisation.id,
    `employee_id=in.(${scope.directReports.map((employee) => employee.id).join(",")})&record_status=eq.Active`,
    "updated_at.desc",
  );
  if (!rows.length) return [];

  const collections = await loadLearnerLifecycleCollectionsForOrganisation(scope.organisation.id, rows);
  const lookups = await loadLearnerRecordLookupsForManagerScope(scope, rows);
  return rows
    .map(learnerRecordFromRow)
    .map((record) => buildLearnerRecordDetail(record, scopedCollections(collections, record.id), lookups));
}

export async function getLearnerLifecycleServerContext(session: LevyTateBetaSession): Promise<LearnerLifecycleServerContext> {
  return contextForSession(session);
}

export async function getOrganisationLearnerLifecycleRecordDetail(session: LevyTateBetaSession, learnerRecordId: string): Promise<LearnerRecordDetail> {
  const context = await contextForSession(session);
  const record = await getScopedLearnerRecord(context, learnerRecordId, "read");
  const collections = await loadLearnerLifecycleCollectionsForRecord(session, learnerRecordId);
  const lookups = await loadLearnerRecordLookups(context.organisation.id);
  const detail = buildLearnerRecordDetail(record, collections, lookups);
  detail.assessmentReadinessResult = assessmentResultFor(record, collections, collections.assessmentReadiness[0] ?? null, await criticalOperationalBlockers(context, learnerRecordId));
  return detail;
}

function buildLearnerRecordDetail(
  record: LearnerRecord,
  collections: LearnerLifecycleCollections,
  lookups: Awaited<ReturnType<typeof loadLearnerRecordLookups>>,
): LearnerRecordDetail {
  const summary = buildLearnerOperationalSummary(record, collections, lookups);
  const eligibilityDeclaration = collections.eligibilityDeclarations[0] ?? null;
  const preEnrolmentChecks = collections.preEnrolmentChecks[0] ?? null;
  return {
    ...summary,
    updatedAt: latestPreEnrolmentVersion(record, eligibilityDeclaration, preEnrolmentChecks),
    activityVersion: latestActivityVersion(record, collections),
    eligibilityDeclaration,
    preEnrolmentChecks,
    enrolmentReadiness: readinessFor(record, eligibilityDeclaration, preEnrolmentChecks),
    progressHistory: [...collections.progressUpdates].sort((left, right) => right.updateDate.localeCompare(left.updateDate) || right.createdAt.localeCompare(left.createdAt)),
    reviewHistory: [...collections.learnerReviews].sort((left, right) => right.reviewDate.localeCompare(left.reviewDate) || right.createdAt.localeCompare(left.createdAt)),
    breaksInLearning: [...collections.breaksInLearning].sort((left, right) => right.startDate.localeCompare(left.startDate)),
    withdrawal: collections.withdrawals[0] ?? null,
    assessmentReadiness: collections.assessmentReadiness[0] ?? null,
    assessmentReadinessResult: assessmentResultFor(record, collections, collections.assessmentReadiness[0] ?? null, []),
    achievement: collections.achievements[0] ?? null,
    operationalActions: collections.operationalActions,
    lifecycleTimeline: collections.lifecycleEvents.map((event) => ({
      id: event.id,
      eventType: event.eventType,
      eventDate: event.eventDate,
      actorName: event.actorName,
      summary: event.summary,
      previousStatus: event.previousStatus,
      newStatus: event.newStatus,
    })),
  };
}

function scopedCollections(collections: LearnerLifecycleCollections, learnerRecordId: string): LearnerLifecycleCollections {
  return {
    learnerRecords: collections.learnerRecords.filter((record) => record.id === learnerRecordId),
    eligibilityDeclarations: collections.eligibilityDeclarations.filter((item) => item.learnerRecordId === learnerRecordId),
    preEnrolmentChecks: collections.preEnrolmentChecks.filter((item) => item.learnerRecordId === learnerRecordId),
    breaksInLearning: collections.breaksInLearning.filter((item) => item.learnerRecordId === learnerRecordId),
    withdrawals: collections.withdrawals.filter((item) => item.learnerRecordId === learnerRecordId),
    learnerReviews: collections.learnerReviews.filter((item) => item.learnerRecordId === learnerRecordId),
    progressUpdates: collections.progressUpdates.filter((item) => item.learnerRecordId === learnerRecordId),
    assessmentReadiness: collections.assessmentReadiness.filter((item) => item.learnerRecordId === learnerRecordId),
    achievements: collections.achievements.filter((item) => item.learnerRecordId === learnerRecordId),
    operationalActions: collections.operationalActions.filter((item) => item.learnerRecordId === learnerRecordId),
    lifecycleEvents: collections.lifecycleEvents.filter((item) => item.learnerRecordId === learnerRecordId),
  };
}

export async function updateLearnerPreEnrolmentProgress(
  session: LevyTateBetaSession,
  learnerRecordId: string,
  input: PreEnrolmentUpdateInput,
): Promise<LearnerRecordDetail> {
  const context = await contextForSession(session);
  assertPermission(context, "learnerLifecycle:write");
  const record = await getScopedLearnerRecord(context, learnerRecordId, "write");
  if (record.lifecycleStatus !== "pre_enrolment") {
    throw new LevyTateLearnerLifecycleValidationError("Only pre-enrolment learner records can be updated through this workflow.");
  }

  const collections = await loadLearnerLifecycleCollectionsForRecord(session, learnerRecordId);
  const existingEligibility = collections.eligibilityDeclarations[0] ?? null;
  const existingChecks = collections.preEnrolmentChecks[0] ?? null;
  assertFreshVersion(latestPreEnrolmentVersion(record, existingEligibility, existingChecks), input.expectedUpdatedAt);
  const timestamp = nowIso();
  const actor = context.user.email;

  const recordPatch = buildLearnerRecordPatch(record, input, timestamp, actor);
  if (recordPatch.changed) {
    await patchLearnerRecord(context, record, recordPatch.next);
    await emitRecordChangeEvents(context, record, recordPatch.next, input.programme?.changeReason);
  }

  if (input.eligibilityVerification) {
    const nextEligibility = buildEligibilityVerification(context, record, existingEligibility, input.eligibilityVerification, timestamp);
    await upsertEligibilityDeclaration(nextEligibility);
    if (nextEligibility.verificationStatus !== existingEligibility?.verificationStatus || nextEligibility.notes !== existingEligibility?.notes) {
      await recordLifecycleEvent(
        context,
        record.id,
        eligibilityEventType(nextEligibility.verificationStatus),
        "",
        "",
        eligibilityEventSummary(nextEligibility.verificationStatus),
        { verificationStatus: nextEligibility.verificationStatus },
      );
    }
  }

  const checksInputSupplied = Boolean(input.probation || input.hrApproval || input.guides);
  if (checksInputSupplied) {
    const nextChecks = buildPreEnrolmentChecks(context, record, existingChecks, input, timestamp);
    await upsertPreEnrolmentChecks(nextChecks);
    if (input.probation && nextChecks.probationStatus !== existingChecks?.probationStatus) {
      await recordLifecycleEvent(context, record.id, "probation_updated", "", "", `Probation status updated to ${nextChecks.probationStatus.replace(/_/g, " ")}.`, { probationStatus: nextChecks.probationStatus });
    }
    if (input.hrApproval && nextChecks.hrApprovalStatus !== existingChecks?.hrApprovalStatus) {
      await recordLifecycleEvent(context, record.id, nextChecks.hrApprovalStatus === "approved" ? "hr_approved" : "hr_approval_updated", "", "", `HR approval status updated to ${nextChecks.hrApprovalStatus.replace(/_/g, " ")}.`, { hrApprovalStatus: nextChecks.hrApprovalStatus });
    }
    if (input.guides?.guidesSent && !existingChecks?.guidesSent) {
      await upsertGuidesOperationalAction(context, record.id, nextChecks);
      await recordLifecycleEvent(context, record.id, "guides_sent", "", "", "Learner and manager guides sent.", { guidesVersion: nextChecks.guidesVersion });
    }
  }

  return getOrganisationLearnerLifecycleRecordDetail(session, learnerRecordId);
}

export async function markLearnerAsEnrolled(
  session: LevyTateBetaSession,
  learnerRecordId: string,
): Promise<LearnerRecordDetail> {
  const context = await contextForSession(session);
  assertPermission(context, "learnerLifecycle:status");
  const record = await getScopedLearnerRecord(context, learnerRecordId, "write");

  if (record.lifecycleStatus === "enrolled") {
    throw new LevyTateLearnerLifecycleConflictError("Learner is already enrolled.");
  }
  if (record.lifecycleStatus !== "pre_enrolment") {
    throw new LevyTateLearnerLifecycleValidationError("Only pre-enrolment learner records can be marked as enrolled.");
  }

  const collections = await loadLearnerLifecycleCollectionsForRecord(session, learnerRecordId);
  const readiness = readinessFor(record, collections.eligibilityDeclarations[0] ?? null, collections.preEnrolmentChecks[0] ?? null);
  if (!readiness.readyForEnrolment) {
    const ineligible = readiness.blockingChecks.find((check) => check.id === "employer-eligibility-verification" && check.status === "Needs review");
    throw new LevyTateLearnerLifecycleValidationError(ineligible?.message ?? readiness.blockingChecks[0]?.message ?? "Pre-enrolment checks are incomplete.");
  }

  const timestamp = nowIso();
  const next: LearnerRecord = {
    ...record,
    lifecycleStatus: "enrolled",
    updatedAt: timestamp,
    updatedBy: context.user.email,
  };
  await patchLearnerRecord(context, record, next);
  await recordLifecycleEvent(context, record.id, "lifecycle_status_changed", "pre_enrolment", "enrolled", "Learner marked as enrolled.", { actualStartDate: next.actualStartDate });
  await recordLifecycleEvent(context, record.id, "enrolment_completed", "pre_enrolment", "enrolled", "Learner marked as enrolled. The lifecycle record is now active.", { programmeId: next.programmeId, providerId: next.providerId });
  return getOrganisationLearnerLifecycleRecordDetail(session, learnerRecordId);
}

function readinessFor(
  record: LearnerRecord,
  eligibilityDeclaration: LearnerEligibilityDeclaration | null,
  preEnrolmentChecks: LearnerPreEnrolmentChecks | null,
) {
  return deriveLearnerEnrolmentReadiness({
    employmentRoute: record.employmentRoute,
    eligibilityDeclaration,
    preEnrolmentChecks,
    programmeId: record.programmeId,
    providerId: record.providerId,
    actualStartDate: record.actualStartDate,
    expectedEndDate: record.expectedEndDate,
  });
}

function assessmentResultFor(
  record: LearnerRecord,
  collections: LearnerLifecycleCollections,
  readiness: LearnerAssessmentReadiness | null,
  criticalOperationalBlockers: string[],
): AssessmentReadinessResult {
  return deriveAssessmentReadiness({
    lifecycleStatus: record.lifecycleStatus,
    activeBreak: Boolean(collections.breaksInLearning.find((item) => item.status === "active")),
    programmeId: record.programmeId,
    providerId: record.providerId,
    readiness,
    latestProgress: latestLearnerProgressFromCollections(collections.progressUpdates, record.id),
    latestProviderReview: latestProviderReviewFromCollections(collections.learnerReviews, record.id),
    criticalOperationalBlockers,
  });
}

function assertAssessmentManagementEligible(status: LearnerLifecycleStatus) {
  if (!assessmentReadinessPolicy.eligibleStatuses.includes(status)) {
    throw new LevyTateLearnerLifecycleValidationError("Assessment readiness can only be managed for enrolled learners or learners in assessment preparation.");
  }
}

function emptyAssessmentRecord(
  context: LifecycleContext,
  learner: LearnerRecord,
  current: LearnerAssessmentReadiness | null,
  timestamp: string,
): LearnerAssessmentReadiness {
  return current ?? {
    id: `${learner.id}-assessment-readiness`,
    organisationId: context.organisation.id,
    learnerRecordId: learner.id,
    assessmentModel: "not_confirmed",
    assessmentModelExplanation: "",
    expectedAssessmentReadinessDate: "",
    actualAssessmentReadinessDate: "",
    gatewayDate: "",
    expectedAssessmentStartDate: "",
    assessmentStartDate: "",
    assessmentStatus: "not_started",
    assessmentOrganisation: "",
    assessmentContact: "",
    assessmentReference: "",
    assessmentNotes: "",
    confirmations: emptyAssessmentReadinessConfirmations(),
    readinessConfirmedBy: "",
    readinessConfirmedAt: "",
    updatedBy: context.user.email,
    version: 0,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function buildAssessmentReadinessUpdate(
  context: LifecycleContext,
  learner: LearnerRecord,
  current: LearnerAssessmentReadiness | null,
  input: AssessmentReadinessUpdateInput,
) {
  const timestamp = nowIso();
  const base = emptyAssessmentRecord(context, learner, current, timestamp);
  const next: LearnerAssessmentReadiness = {
    ...base,
    assessmentModel: input.assessmentModel === undefined ? base.assessmentModel : input.assessmentModel,
    assessmentModelExplanation: input.assessmentModelExplanation === undefined ? base.assessmentModelExplanation : cleanText(input.assessmentModelExplanation),
    assessmentOrganisation: input.assessmentOrganisation === undefined ? base.assessmentOrganisation : cleanText(input.assessmentOrganisation),
    assessmentContact: input.assessmentContact === undefined ? base.assessmentContact : cleanText(input.assessmentContact),
    assessmentReference: input.assessmentReference === undefined ? base.assessmentReference : cleanText(input.assessmentReference),
    assessmentNotes: input.assessmentNotes === undefined ? base.assessmentNotes : cleanText(input.assessmentNotes),
    expectedAssessmentReadinessDate: input.expectedAssessmentReadinessDate === undefined ? base.expectedAssessmentReadinessDate : cleanDate(input.expectedAssessmentReadinessDate, "expected assessment-readiness date"),
    gatewayDate: input.gatewayDate === undefined ? base.gatewayDate : cleanDate(input.gatewayDate, "gateway date"),
    expectedAssessmentStartDate: input.expectedAssessmentStartDate === undefined ? base.expectedAssessmentStartDate : cleanDate(input.expectedAssessmentStartDate, "expected assessment start date"),
    confirmations: input.confirmations ? updateAssessmentConfirmations(context, base.confirmations, input.confirmations, timestamp) : base.confirmations,
    updatedBy: context.user.email,
    updatedAt: timestamp,
    version: base.version + 1,
  };
  assertAllowedValue(next.assessmentModel, assessmentModelLabels, "assessment model");
  if (next.assessmentModel === "other" && !next.assessmentModelExplanation) {
    throw new LevyTateLearnerLifecycleValidationError("Explain the assessment model when Other is selected.");
  }
  validateAssessmentDates(learner, next);
  return next;
}

function updateAssessmentConfirmations(
  context: LifecycleContext,
  current: LearnerAssessmentReadiness["confirmations"],
  updates: NonNullable<AssessmentReadinessUpdateInput["confirmations"]>,
  timestamp: string,
) {
  const next = normaliseAssessmentReadinessConfirmations(current);
  assessmentConfirmationTypes.forEach((type) => {
    const update = updates[type];
    if (!update) return;
    const status = (update.status ?? next[type].status) as AssessmentConfirmationStatus;
    if (!assessmentConfirmationStatuses.includes(status)) throw new LevyTateLearnerLifecycleValidationError(`Invalid ${type.replace("_", " ")} readiness confirmation status.`);
    const confirmation: AssessmentReadinessConfirmation = {
      ...next[type],
      status,
      confirmedDate: update.confirmedDate === undefined ? next[type].confirmedDate : cleanDate(update.confirmedDate, `${type} confirmation date`),
      confirmedBy: update.confirmedBy === undefined ? next[type].confirmedBy : cleanText(update.confirmedBy),
      recordedOnBehalfOf: update.recordedOnBehalfOf === undefined ? next[type].recordedOnBehalfOf : cleanText(update.recordedOnBehalfOf),
      note: update.note === undefined ? next[type].note : cleanText(update.note),
      evidenceReference: update.evidenceReference === undefined ? next[type].evidenceReference : cleanText(update.evidenceReference),
      updatedBy: context.user.email,
      updatedAt: timestamp,
    };
    if (status === "confirmed") {
      if (!confirmation.confirmedDate) throw new LevyTateLearnerLifecycleValidationError(`${type.replace("_", " ")} confirmation date is required.`);
      if (!confirmation.confirmedBy && !confirmation.recordedOnBehalfOf) throw new LevyTateLearnerLifecycleValidationError(`Record who confirmed ${type.replace("_", " ")} readiness or who it was recorded on behalf of.`);
      assertOperationalDate(confirmation.confirmedDate, `${type.replace("_", " ")} confirmation date`);
    }
    if ((status === "not_confirmed" || status === "more_information_required") && !confirmation.note) {
      throw new LevyTateLearnerLifecycleValidationError(`A reason is required when ${type.replace("_", " ")} readiness is not confirmed or needs more information.`);
    }
    next[type] = confirmation;
  });
  return next;
}

function validateAssessmentDates(learner: LearnerRecord, readiness: LearnerAssessmentReadiness) {
  const dates: Array<[string, string]> = [
    [readiness.expectedAssessmentReadinessDate, "Expected assessment-readiness date"],
    [readiness.actualAssessmentReadinessDate, "Actual assessment-readiness date"],
    [readiness.gatewayDate, "Gateway date"],
    [readiness.expectedAssessmentStartDate, "Expected assessment start date"],
    [readiness.assessmentStartDate, "Assessment start date"],
  ];
  dates.forEach(([value, label]) => {
    if (!value) return;
    assertValidDate(value, label);
    assertPlanningDate(value, label);
    if (learner.actualStartDate) assertDateAfter(value, learner.actualStartDate, label, "actual apprenticeship start date", true);
  });
  const latestConfirmationDate = assessmentConfirmationTypes
    .map((type) => readiness.confirmations[type].status === "confirmed" ? readiness.confirmations[type].confirmedDate : "")
    .filter(Boolean)
    .sort()
    .at(-1) ?? "";
  const readinessEvidenceDate = [readiness.actualAssessmentReadinessDate, latestConfirmationDate].filter(Boolean).sort().at(-1) ?? "";
  if (readiness.gatewayDate && readinessEvidenceDate) assertDateAfter(readiness.gatewayDate, readinessEvidenceDate, "Gateway date", "latest readiness evidence date", true);
  const readinessConfirmationDate = readiness.actualAssessmentReadinessDate || readiness.expectedAssessmentReadinessDate;
  if (readiness.expectedAssessmentStartDate && readinessConfirmationDate) assertDateAfter(readiness.expectedAssessmentStartDate, readinessConfirmationDate, "Expected assessment start date", "readiness confirmation date", true);
  if (readiness.assessmentStartDate && readiness.actualAssessmentReadinessDate) assertDateAfter(readiness.assessmentStartDate, readiness.actualAssessmentReadinessDate, "Assessment start date", "actual assessment-readiness date", true);
}

async function persistAssessmentReadiness(
  context: LifecycleContext,
  current: LearnerAssessmentReadiness | null,
  next: LearnerAssessmentReadiness,
) {
  if (!current) {
    await supabaseInsert<LearnerAssessmentReadinessRow>(assertSupabase(), assessmentReadinessTable, [assessmentReadinessToRow(next)], {
      query: "on_conflict=organisation_id,id",
      prefer: "resolution=merge-duplicates,return=minimal",
    });
    return;
  }
  const query = new URLSearchParams({
    organisation_id: `eq.${context.organisation.id}`,
    id: `eq.${current.id}`,
    version: `eq.${current.version}`,
  }).toString();
  const rows = await supabaseUpdate<LearnerAssessmentReadinessRow>(assertSupabase(), assessmentReadinessTable, query, assessmentReadinessToRow(next));
  if (!rows.length) throw new LevyTateLearnerLifecycleConflictError("This assessment readiness record changed before your update was saved. Refresh and try again.");
}

async function emitAssessmentUpdateEvents(
  context: LifecycleContext,
  current: LearnerAssessmentReadiness | null,
  next: LearnerAssessmentReadiness,
) {
  if (next.assessmentModel !== current?.assessmentModel && next.assessmentModel !== "not_confirmed") {
    await recordLifecycleEvent(context, next.learnerRecordId, "assessment_model_confirmed", "", "", `Assessment model confirmed as ${assessmentModelLabels[next.assessmentModel]}.`, { assessmentModel: next.assessmentModel });
  }
  if (next.assessmentOrganisation && next.assessmentOrganisation !== current?.assessmentOrganisation) {
    await recordLifecycleEvent(context, next.learnerRecordId, "assessment_organisation_recorded", "", "", `Assessment organisation recorded as ${next.assessmentOrganisation}.`, { assessmentOrganisation: next.assessmentOrganisation });
  }
  if (next.expectedAssessmentReadinessDate && next.expectedAssessmentReadinessDate !== current?.expectedAssessmentReadinessDate) {
    await recordLifecycleEvent(context, next.learnerRecordId, "expected_assessment_readiness_recorded", "", "", `Expected assessment-readiness date recorded for ${next.expectedAssessmentReadinessDate}.`, { expectedAssessmentReadinessDate: next.expectedAssessmentReadinessDate });
  }
  if (next.gatewayDate && next.gatewayDate !== current?.gatewayDate) {
    await recordLifecycleEvent(context, next.learnerRecordId, "gateway_recorded", "", "", `Gateway recorded for ${next.gatewayDate}.`, { gatewayDate: next.gatewayDate });
  }
  const eventTypes: Record<AssessmentConfirmationType, LearnerLifecycleEventType> = {
    provider: "provider_readiness_confirmed",
    learner: "learner_readiness_confirmed",
    line_manager: "line_manager_readiness_confirmed",
    employer: "employer_readiness_confirmed",
  };
  for (const type of assessmentConfirmationTypes) {
    if (next.confirmations[type].status === "confirmed" && current?.confirmations[type].status !== "confirmed") {
      await recordLifecycleEvent(context, next.learnerRecordId, eventTypes[type], "", "", `${type === "line_manager" ? "Line Manager" : type[0].toUpperCase() + type.slice(1)} readiness confirmed.`, { confirmationType: type, confirmedDate: next.confirmations[type].confirmedDate });
    }
  }
  await recordLifecycleEvent(context, next.learnerRecordId, "assessment_readiness_updated", "", "", "Assessment readiness record updated.", { assessmentStatus: next.assessmentStatus });
}

async function criticalOperationalBlockers(context: LifecycleContext, learnerRecordId: string) {
  const rows = await selectMany<CriticalOperationalActionRow>(persistentOperationalActionsTable, context.organisation.id, `learner_record_id=eq.${encodeURIComponent(learnerRecordId)}&priority=eq.Critical&status=in.(open,acknowledged,in_progress)`, "updated_at.desc");
  return rows.filter((row) => row.source_type !== "assessment_readiness").map((row) => row.description).filter(Boolean);
}

async function synchroniseLearnerOperationalActions(session: LevyTateBetaSession, learnerRecordId: string) {
  const { resolveActionsForLearnerConditionChange } = await import("@/lib/server/levytate-operational-actions");
  await resolveActionsForLearnerConditionChange(session, learnerRecordId);
}

function assertFreshVersion(currentVersion: string, expectedUpdatedAt: string | undefined) {
  if (!expectedUpdatedAt) return;
  if (currentVersion === expectedUpdatedAt) return;
  throw new LevyTateLearnerLifecycleConflictError("This learner record has changed since you opened it. Refresh the record before saving again.");
}

function latestPreEnrolmentVersion(
  record: LearnerRecord,
  eligibilityDeclaration: LearnerEligibilityDeclaration | null,
  preEnrolmentChecks: LearnerPreEnrolmentChecks | null,
) {
  return latestIso([record.updatedAt, eligibilityDeclaration?.updatedAt ?? "", preEnrolmentChecks?.updatedAt ?? ""]);
}

function latestActivityVersion(record: LearnerRecord, collections: LearnerLifecycleCollections) {
  const timestamp = latestIso([
    record.updatedAt,
    ...collections.progressUpdates.map((update) => update.createdAt),
    ...collections.learnerReviews.map((review) => review.updatedAt || review.createdAt),
    ...collections.breaksInLearning.map((breakRecord) => breakRecord.updatedAt || breakRecord.recordedAt),
    ...collections.assessmentReadiness.map((readiness) => readiness.updatedAt),
  ]);
  return `${timestamp}:${collections.progressUpdates.length}:${collections.learnerReviews.length}:${collections.breaksInLearning.length}`;
}

function latestIso(values: string[]) {
  return values
    .filter(Boolean)
    .sort((left, right) => new Date(right).getTime() - new Date(left).getTime())[0] ?? "";
}

function latestActivityVersionRequired(collections: LearnerLifecycleCollections, record: LearnerRecord, expected: string | undefined) {
  const value = requiredText(expected, "Activity version");
  assertFreshVersion(latestActivityVersion(record, collections), value);
}

function assertProgressEligible(status: LearnerLifecycleStatus) {
  if (!learnerProgressReviewPolicy.progressEligibleStatuses.includes(status)) {
    throw new LevyTateLearnerLifecycleValidationError("Progress updates can only be recorded for enrolled learners or learners preparing for or completing assessment.");
  }
}

function assertReviewEligible(status: LearnerLifecycleStatus) {
  if (!learnerProgressReviewPolicy.reviewEligibleStatuses.includes(status)) {
    throw new LevyTateLearnerLifecycleValidationError("Reviews can only be recorded for enrolled learners, learners on a break, or learners preparing for or completing assessment.");
  }
}

function assertAllowedValue<T extends string>(value: unknown, labels: Record<T, string>, label: string): asserts value is T {
  if (typeof value !== "string" || !Object.prototype.hasOwnProperty.call(labels, value)) {
    throw new LevyTateLearnerLifecycleValidationError(`Invalid ${label}.`);
  }
}

function requiredText(value: unknown, label: string) {
  const text = cleanText(value);
  if (!text) throw new LevyTateLearnerLifecycleValidationError(`${label} is required.`);
  return text;
}

function assertValidDate(value: string, label: string) {
  const date = cleanDate(value, label.toLowerCase());
  const [year, month, day] = date.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) {
    throw new LevyTateLearnerLifecycleValidationError(`${label} is not a valid date.`);
  }
  return date;
}

function assertOperationalDate(value: string, label: string) {
  const date = assertValidDate(value, label);
  const maximum = new Date();
  maximum.setUTCHours(0, 0, 0, 0);
  maximum.setUTCDate(maximum.getUTCDate() + learnerProgressReviewPolicy.maximumFutureDateDays);
  if (new Date(`${date}T00:00:00Z`).getTime() > maximum.getTime()) {
    throw new LevyTateLearnerLifecycleValidationError(`${label} cannot be more than ${learnerProgressReviewPolicy.maximumFutureDateDays} days in the future.`);
  }
}

function assertProgressPercentage(value: number, label: string) {
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    throw new LevyTateLearnerLifecycleValidationError(`${label} must be between 0 and 100.`);
  }
}

function activityRecordId(prefix: string, learnerRecordId: string, idempotencyKey: string) {
  const key = requiredText(idempotencyKey, "Idempotency key");
  if (!/^[a-zA-Z0-9_-]{8,80}$/.test(key)) throw new LevyTateLearnerLifecycleValidationError("Invalid idempotency key.");
  return `${prefix}-${learnerRecordId}-${key}`;
}

async function persistLearnerStatus(context: LifecycleContext, record: LearnerRecord, lifecycleStatus: LearnerLifecycleStatus) {
  const next = { ...record, lifecycleStatus, updatedAt: nowIso(), updatedBy: context.user.email };
  await upsertLearnerRecord(next);
  return next;
}

async function getActiveBreakRow(organisationId: string, learnerRecordId: string) {
  return selectOne<LearnerBreakInLearningRow>(breaksTable, new URLSearchParams({ select: "*", organisation_id: `eq.${organisationId}`, learner_record_id: `eq.${learnerRecordId}`, status: "eq.active", limit: "1" }));
}

async function getBreakRow(organisationId: string, learnerRecordId: string, breakId: string) {
  return selectOne<LearnerBreakInLearningRow>(breaksTable, new URLSearchParams({ select: "*", organisation_id: `eq.${organisationId}`, learner_record_id: `eq.${learnerRecordId}`, id: `eq.${breakId}`, limit: "1" }));
}

async function updateBreakRow(organisationId: string, record: LearnerBreakInLearning) {
  await supabaseUpdate(assertSupabase(), breaksTable, organisationQuery(organisationId, { id: record.id }), breakToRow(record), { prefer: "return=minimal" });
}

function validateBreakStartInput(learner: LearnerRecord, input: StartBreakInLearningInput) {
  assertAllowedValue(input.reasonCategory, learnerBreakReasonLabels, "break reason category");
  assertBreakStartDate(learner, input.startDate);
  assertOperationalDate(input.effectiveLifecycleDate, "Effective lifecycle date");
  if (learnerBreakPolicy.detailRequiredReasons.includes(input.reasonCategory)) requiredText(input.reasonNotes, "Reason details");
  validateBreakReturnPlanning({ startDate: input.startDate, expectedReturnDate: cleanText(input.expectedReturnDate), expectedReturnUnknown: Boolean(input.expectedReturnUnknown), reviewDate: cleanText(input.reviewDate) });
}

function validateBreakReturnPlanning(input: Pick<LearnerBreakInLearning, "startDate" | "expectedReturnDate" | "expectedReturnUnknown" | "reviewDate">) {
  if (input.expectedReturnUnknown) {
    if (input.expectedReturnDate) throw new LevyTateLearnerLifecycleValidationError("Remove the expected return date when it is marked as unknown.");
    const reviewDate = assertValidDate(input.reviewDate, "Review date");
    assertDateAfter(reviewDate, input.startDate, "Review date", "break start date", true);
    return;
  }
  const expected = assertValidDate(input.expectedReturnDate, "Expected return date");
  assertDateAfter(expected, input.startDate, "Expected return date", "break start date");
  assertPlanningDate(expected, "Expected return date");
  if (input.reviewDate) assertValidDate(input.reviewDate, "Review date");
}

function validateBreakReturnInput(current: LearnerBreakInLearning, input: ReturnFromBreakInput) {
  assertOperationalDate(input.actualReturnDate, "Actual return date");
  assertDateAfter(input.actualReturnDate, current.startDate, "Actual return date", "break start date", true);
  requiredText(input.returnConfirmationNote, "Return confirmation note");
  if (!input.programmeStillValidConfirmed || !input.providerReturnConfirmed || !input.managerReturnConfirmed || !input.learnerReturnConfirmed) throw new LevyTateLearnerLifecycleValidationError("Confirm the programme, provider, manager and learner return arrangements before returning the learner to active learning.");
  if (input.revisedExpectedEndDate) {
    assertValidDate(input.revisedExpectedEndDate, "Revised expected end date");
    assertDateAfter(input.revisedExpectedEndDate, input.actualReturnDate, "Revised expected end date", "actual return date");
  }
  if (input.revisedReviewDate) {
    assertValidDate(input.revisedReviewDate, "Revised review date");
    assertDateAfter(input.revisedReviewDate, input.actualReturnDate, "Revised review date", "actual return date", true);
  }
  if (input.firstCheckInDate) {
    assertValidDate(input.firstCheckInDate, "First check-in date");
    assertDateAfter(input.firstCheckInDate, input.actualReturnDate, "First check-in date", "actual return date", true);
  }
}

function assertBreakStartDate(learner: LearnerRecord, value: string) {
  assertOperationalDate(value, "Break start date");
  if (learner.actualStartDate) assertDateAfter(value, learner.actualStartDate, "Break start date", "learner actual start date", true);
}

function assertDateAfter(value: string, boundary: string, valueLabel: string, boundaryLabel: string, allowEqual = false) {
  if (!boundary) return;
  const valid = allowEqual ? value >= boundary : value > boundary;
  if (!valid) throw new LevyTateLearnerLifecycleValidationError(`${valueLabel} must be ${allowEqual ? "on or " : ""}after the ${boundaryLabel}.`);
}

function assertPlanningDate(value: string, label: string) {
  const maximum = new Date();
  maximum.setUTCFullYear(maximum.getUTCFullYear() + 3);
  if (new Date(`${value}T00:00:00Z`).getTime() > maximum.getTime()) throw new LevyTateLearnerLifecycleValidationError(`${label} is implausibly far in the future.`);
}

function notificationDate(notified: boolean, value: unknown, label: string) {
  if (!notified) return "";
  const date = requiredText(value, label);
  assertOperationalDate(date, label);
  return date;
}

async function assertProviderInOrganisation(context: LifecycleContext, providerId: string) {
  const provider = await selectOne<ProviderViewRow>("levytate_providers", new URLSearchParams({
    select: "provider_id,provider_name",
    organisation_id: `eq.${context.organisation.id}`,
    provider_id: `eq.${providerId}`,
    limit: "1",
  }));
  if (!provider) throw new LevyTateLearnerLifecycleValidationError("The selected provider is not available in this organisation.");
}

function reviewEventType(reviewType: LearnerReviewType): LearnerLifecycleEventType {
  if (reviewType === "provider_review") return "provider_review_recorded";
  if (reviewType === "l_and_d_check_in") return "l_and_d_check_in_recorded";
  if (reviewType === "manager_check_in") return "manager_check_in_recorded";
  return "other_review_recorded";
}

function buildLearnerRecordPatch(
  record: LearnerRecord,
  input: PreEnrolmentUpdateInput,
  timestamp: string,
  actor: string,
) {
  const next: LearnerRecord = { ...record };
  if (input.employmentRoute !== undefined) {
    assertEnum(input.employmentRoute, ["existing_employee_upskill", "recruited_as_apprentice"], "employment route");
    next.employmentRoute = input.employmentRoute;
  }

  const programme = input.programme;
  if (programme) {
    if (programme.programmeId !== undefined) next.programmeId = cleanText(programme.programmeId);
    if (programme.providerId !== undefined) next.providerId = cleanText(programme.providerId);
    if (programme.applicationId !== undefined) next.applicationId = cleanText(programme.applicationId);
    if (programme.expectedStartDate !== undefined) next.expectedStartDate = cleanDate(programme.expectedStartDate, "expected start date");
    if (programme.actualStartDate !== undefined) next.actualStartDate = cleanDate(programme.actualStartDate, "actual start date");
    if (programme.expectedEndDate !== undefined) next.expectedEndDate = cleanDate(programme.expectedEndDate, "expected end date");
    if ((next.programmeId !== record.programmeId || next.providerId !== record.providerId) && !cleanText(programme.changeReason)) {
      throw new LevyTateLearnerLifecycleValidationError("Programme or provider changes require a reason.");
    }
  }

  const changed = next.employmentRoute !== record.employmentRoute
    || next.programmeId !== record.programmeId
    || next.providerId !== record.providerId
    || next.applicationId !== record.applicationId
    || next.expectedStartDate !== record.expectedStartDate
    || next.actualStartDate !== record.actualStartDate
    || next.expectedEndDate !== record.expectedEndDate;

  if (changed) {
    next.updatedAt = timestamp;
    next.updatedBy = actor;
  }

  return { next, changed };
}

async function patchLearnerRecord(
  context: LifecycleContext,
  previous: LearnerRecord,
  next: LearnerRecord,
  expectedUpdatedAt?: string,
) {
  const query = new URLSearchParams({
    organisation_id: `eq.${context.organisation.id}`,
    id: `eq.${previous.id}`,
  });
  if (expectedUpdatedAt) query.set("updated_at", `eq.${expectedUpdatedAt}`);
  const rows = await supabaseUpdate<LearnerRecordRow>(assertSupabase(), learnerRecordsTable, query.toString(), learnerRecordToRow(next));
  if (!rows.length) throw new LevyTateLearnerLifecycleConflictError("This learner record has changed since you opened it. Refresh the record before saving again.");
}

async function emitRecordChangeEvents(context: LifecycleContext, previous: LearnerRecord, next: LearnerRecord, changeReason?: string) {
  if (previous.employmentRoute !== next.employmentRoute) {
    await recordLifecycleEvent(context, previous.id, "employment_route_confirmed", "", "", `Employment route confirmed as ${employmentRouteLabel(next.employmentRoute)}.`, { employmentRoute: next.employmentRoute });
  }
  const programmeChanged = previous.programmeId !== next.programmeId || previous.providerId !== next.providerId || previous.applicationId !== next.applicationId;
  const datesChanged = previous.expectedStartDate !== next.expectedStartDate || previous.actualStartDate !== next.actualStartDate || previous.expectedEndDate !== next.expectedEndDate;
  if (programmeChanged || datesChanged) {
    await recordLifecycleEvent(context, previous.id, "programme_provider_confirmed", "", "", "Programme, provider and enrolment dates confirmed.", {
      programmeId: next.programmeId,
      providerId: next.providerId,
      applicationId: next.applicationId,
      expectedStartDate: next.expectedStartDate,
      actualStartDate: next.actualStartDate,
      expectedEndDate: next.expectedEndDate,
      changeReason: cleanText(changeReason),
    });
  }
}

function buildEligibilityVerification(
  context: LifecycleContext,
  record: LearnerRecord,
  existing: LearnerEligibilityDeclaration | null,
  input: NonNullable<PreEnrolmentUpdateInput["eligibilityVerification"]>,
  timestamp: string,
): LearnerEligibilityDeclaration {
  const verificationStatus = cleanText(input.verificationStatus) as LearnerEligibilityVerificationStatus;
  assertEnum(verificationStatus, ["employer_verified", "needs_review", "not_eligible"], "eligibility verification status");
  const notes = cleanText(input.notes);
  if ((verificationStatus === "needs_review" || verificationStatus === "not_eligible") && !notes) {
    throw new LevyTateLearnerLifecycleValidationError("A reason is required when eligibility needs review or is not eligible.");
  }

  return {
    id: existing?.id ?? `${record.id}-england-hours`,
    organisationId: context.organisation.id,
    learnerRecordId: record.id,
    declarationType: existing?.declarationType ?? "england_working_hours",
    declarationWording: existing?.declarationWording ?? englandWorkingHoursDeclarationWording,
    declarationVersion: existing?.declarationVersion ?? englandWorkingHoursDeclarationVersion,
    confirmed: existing?.confirmed ?? false,
    confirmedByEmployee: existing?.confirmedByEmployee ?? "",
    confirmedAt: existing?.confirmedAt ?? "",
    expectedEnglandWorkingHoursPercentage: existing?.expectedEnglandWorkingHoursPercentage ?? null,
    verifiedBy: context.user.email,
    verifiedAt: timestamp,
    verificationStatus,
    notes,
    createdAt: existing?.createdAt ?? timestamp,
    updatedAt: timestamp,
  };
}

function buildPreEnrolmentChecks(
  context: LifecycleContext,
  record: LearnerRecord,
  existing: LearnerPreEnrolmentChecks | null,
  input: PreEnrolmentUpdateInput,
  timestamp: string,
): LearnerPreEnrolmentChecks {
  const next: LearnerPreEnrolmentChecks = {
    id: existing?.id ?? `${record.id}-pre-enrolment`,
    organisationId: context.organisation.id,
    learnerRecordId: record.id,
    probationStatus: existing?.probationStatus ?? "awaiting_confirmation",
    probationPassedDate: existing?.probationPassedDate ?? "",
    probationConfirmedBy: existing?.probationConfirmedBy ?? "",
    probationConfirmedAt: existing?.probationConfirmedAt ?? "",
    probationNotes: existing?.probationNotes ?? "",
    hrApprovalStatus: existing?.hrApprovalStatus ?? "not_requested",
    hrApprovedDate: existing?.hrApprovedDate ?? "",
    hrApprovedBy: existing?.hrApprovedBy ?? "",
    hrApprovalNotes: existing?.hrApprovalNotes ?? "",
    guidesSent: existing?.guidesSent ?? false,
    guidesSentDate: existing?.guidesSentDate ?? "",
    guidesSentBy: existing?.guidesSentBy ?? "",
    guidesVersion: existing?.guidesVersion ?? "",
    guidesNotes: existing?.guidesNotes ?? "",
    createdAt: existing?.createdAt ?? timestamp,
    updatedAt: timestamp,
  };

  if (input.probation) {
    const status = cleanText(input.probation.probationStatus) as LearnerProbationStatus;
    assertEnum(status, ["awaiting_confirmation", "passed", "not_passed", "under_review", "not_required"], "probation status");
    const notes = cleanText(input.probation.probationNotes);
    const passedDate = cleanDate(input.probation.probationPassedDate ?? "", "probation passed date");
    if (status === "passed" && !passedDate) throw new LevyTateLearnerLifecycleValidationError("Probation passed date is required when probation is passed.");
    if ((status === "not_passed" || status === "under_review") && !notes) throw new LevyTateLearnerLifecycleValidationError("A note is required when probation is not passed or under review.");
    next.probationStatus = status;
    next.probationPassedDate = status === "passed" ? passedDate : "";
    next.probationConfirmedBy = context.user.email;
    next.probationConfirmedAt = timestamp;
    next.probationNotes = notes;
  }

  if (input.hrApproval) {
    const status = cleanText(input.hrApproval.hrApprovalStatus) as LearnerHrApprovalStatus;
    assertEnum(status, ["not_requested", "awaiting_approval", "approved", "declined", "more_information_required"], "HR approval status");
    const notes = cleanText(input.hrApproval.hrApprovalNotes);
    const approvedDate = cleanDate(input.hrApproval.hrApprovedDate ?? "", "HR approval date");
    if (status === "approved" && !approvedDate) throw new LevyTateLearnerLifecycleValidationError("HR approval date is required when HR approval is approved.");
    if ((status === "declined" || status === "more_information_required") && !notes) throw new LevyTateLearnerLifecycleValidationError("A note is required when HR approval is declined or more information is required.");
    next.hrApprovalStatus = status;
    next.hrApprovedDate = status === "approved" ? approvedDate : "";
    next.hrApprovedBy = context.user.email;
    next.hrApprovalNotes = notes;
  }

  if (input.guides) {
    next.guidesSent = Boolean(input.guides.guidesSent);
    next.guidesSentDate = next.guidesSent ? cleanDate(input.guides.guidesSentDate ?? "", "guides sent date") : "";
    if (next.guidesSent && !next.guidesSentDate) throw new LevyTateLearnerLifecycleValidationError("Guides sent date is required when guides are marked as sent.");
    next.guidesSentBy = next.guidesSent ? context.user.email : "";
    next.guidesVersion = cleanText(input.guides.guidesVersion);
    next.guidesNotes = [cleanText(input.guides.recipientSummary), cleanText(input.guides.guidesNotes)].filter(Boolean).join(" - ");
  }

  return next;
}

async function upsertEligibilityDeclaration(next: LearnerEligibilityDeclaration) {
  await supabaseInsert<LearnerEligibilityDeclarationRow>(assertSupabase(), eligibilityDeclarationsTable, [eligibilityDeclarationToRow(next)], {
    query: "on_conflict=organisation_id,id",
    prefer: "resolution=merge-duplicates,return=minimal",
  });
}

async function upsertPreEnrolmentChecks(next: LearnerPreEnrolmentChecks) {
  await supabaseInsert<LearnerPreEnrolmentChecksRow>(assertSupabase(), preEnrolmentChecksTable, [preEnrolmentChecksToRow(next)], {
    query: "on_conflict=organisation_id,id",
    prefer: "resolution=merge-duplicates,return=minimal",
  });
}

async function upsertGuidesOperationalAction(context: LifecycleContext, learnerRecordId: string, checks: LearnerPreEnrolmentChecks) {
  const timestamp = nowIso();
  const action: LearnerOperationalAction = {
    id: `${learnerRecordId}-guides-sent`,
    organisationId: context.organisation.id,
    learnerRecordId,
    actionType: "guides_sent",
    status: "completed",
    completed: true,
    completedAt: checks.guidesSentDate ? `${checks.guidesSentDate}T00:00:00.000Z` : timestamp,
    completedBy: context.user.email,
    recipientSummary: checks.guidesNotes,
    notes: checks.guidesVersion,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  await supabaseInsert<LearnerOperationalActionRow>(assertSupabase(), operationalActionsTable, [operationalActionToRow(action)], {
    query: "on_conflict=organisation_id,id",
    prefer: "resolution=merge-duplicates,return=minimal",
  });
}

function eligibilityEventType(status: LearnerEligibilityVerificationStatus): LearnerLifecycleEventType {
  if (status === "employer_verified") return "eligibility_employer_verified";
  if (status === "not_eligible") return "eligibility_marked_not_eligible";
  return "eligibility_marked_for_review";
}

function eligibilityEventSummary(status: LearnerEligibilityVerificationStatus) {
  if (status === "employer_verified") return "England working-hours eligibility employer verified.";
  if (status === "not_eligible") return "England working-hours eligibility marked not eligible.";
  return "England working-hours eligibility marked for review.";
}

async function loadLearnerLifecycleCollectionsForOrganisation(
  organisationId: string,
  records: LearnerRecordRow[],
): Promise<LearnerLifecycleCollections> {
  const recordIds = records.map((record) => record.id);
  const inFilter = `in.(${recordIds.join(",")})`;
  const [
    eligibilityDeclarations,
    preEnrolmentChecks,
    breaksInLearning,
    withdrawals,
    learnerReviews,
    progressUpdates,
    assessmentReadiness,
    achievements,
    operationalActions,
    lifecycleEvents,
  ] = await Promise.all([
    selectMany<LearnerEligibilityDeclarationRow>(eligibilityDeclarationsTable, organisationId, `learner_record_id=${inFilter}`, "created_at.desc"),
    selectMany<LearnerPreEnrolmentChecksRow>(preEnrolmentChecksTable, organisationId, `learner_record_id=${inFilter}`, "updated_at.desc"),
    selectMany<LearnerBreakInLearningRow>(breaksTable, organisationId, `learner_record_id=${inFilter}`, "start_date.desc"),
    selectMany<LearnerWithdrawalRow>(withdrawalsTable, organisationId, `learner_record_id=${inFilter}`, "recorded_at.desc"),
    selectMany<LearnerReviewRow>(reviewsTable, organisationId, `learner_record_id=${inFilter}`, "review_date.desc"),
    selectMany<LearnerProgressUpdateRow>(progressTable, organisationId, `learner_record_id=${inFilter}`, "update_date.desc"),
    selectMany<LearnerAssessmentReadinessRow>(assessmentReadinessTable, organisationId, `learner_record_id=${inFilter}`, "updated_at.desc"),
    selectMany<LearnerAchievementRow>(achievementsTable, organisationId, `learner_record_id=${inFilter}`, "recorded_at.desc"),
    selectMany<LearnerOperationalActionRow>(operationalActionsTable, organisationId, `learner_record_id=${inFilter}`, "updated_at.desc"),
    selectMany<LearnerLifecycleEventRow>(lifecycleEventsTable, organisationId, `learner_record_id=${inFilter}`, "created_at.asc"),
  ]);

  return {
    learnerRecords: records.map(learnerRecordFromRow),
    eligibilityDeclarations: eligibilityDeclarations.map(eligibilityDeclarationFromRow),
    preEnrolmentChecks: preEnrolmentChecks.map(preEnrolmentChecksFromRow),
    breaksInLearning: breaksInLearning.map(breakFromRow),
    withdrawals: withdrawals.map(withdrawalFromRow),
    learnerReviews: learnerReviews.map(reviewFromRow),
    progressUpdates: progressUpdates.map(progressUpdateFromRow),
    assessmentReadiness: assessmentReadiness.map(assessmentReadinessFromRow),
    achievements: achievements.map(achievementFromRow),
    operationalActions: operationalActions.map(operationalActionFromRow),
    lifecycleEvents: lifecycleEvents.map(lifecycleEventFromRow),
  };
}

async function loadLearnerRecordLookups(organisationId: string) {
  const [employees, applications, providers, programmes, enrolments] = await Promise.all([
    selectMany<EmployeeViewRow>(employeesTable, organisationId, "select=id,name,email,job_title,role_id,manager_id,department,site,status", "name.asc"),
    selectMany<ApplicationViewRow>("levytate_applications", organisationId, "select=id,employee_id,apprenticeship_standard_id", "submitted_at.desc"),
    selectMany<ProviderViewRow>("levytate_providers", organisationId, "select=provider_id,provider_name", "provider_name.asc"),
    selectMany<ProviderProgrammeViewRow>("levytate_provider_programmes", organisationId, "select=id,provider_id,programme_name,apprenticeship_standard_id,linked_standard_id,linked_standard_ids,linked_standard_name", "programme_name.asc"),
    selectMany<EnrolmentViewRow>("levytate_enrolments", organisationId, "select=id,application_id,employee_id,provider_id,apprenticeship_standard_id", "created_at.desc"),
  ]);

  return { employees, applications, providers, programmes, enrolments };
}

async function loadLearnerRecordLookupsForManagerScope(
  scope: ManagerDirectReportContext,
  records: LearnerRecordRow[],
): Promise<Awaited<ReturnType<typeof loadLearnerRecordLookups>>> {
  const organisationId = scope.organisation.id;
  const employeeIds = [...scope.directReports.map((employee) => employee.id), scope.manager.id];
  const learnerEmployeeIds = scope.directReports.map((employee) => employee.id);
  const programmeIds = Array.from(new Set(records.map((record) => record.programme_id).filter(Boolean)));
  const [employees, applications, enrolments, programmes] = await Promise.all([
    selectMany<EmployeeViewRow>(employeesTable, organisationId, `select=id,name,email,job_title,role_id,manager_id,department,site,status&id=in.(${employeeIds.join(",")})`, "name.asc"),
    selectMany<ApplicationViewRow>("levytate_applications", organisationId, `select=id,employee_id,apprenticeship_standard_id&employee_id=in.(${learnerEmployeeIds.join(",")})`, "submitted_at.desc"),
    selectMany<EnrolmentViewRow>("levytate_enrolments", organisationId, `select=id,application_id,employee_id,provider_id,apprenticeship_standard_id&employee_id=in.(${learnerEmployeeIds.join(",")})`, "created_at.desc"),
    programmeIds.length
      ? selectMany<ProviderProgrammeViewRow>("levytate_provider_programmes", organisationId, `select=id,provider_id,programme_name,apprenticeship_standard_id,linked_standard_id,linked_standard_ids,linked_standard_name&id=in.(${programmeIds.join(",")})`, "programme_name.asc")
      : Promise.resolve([]),
  ]);
  const providerIds = Array.from(new Set([
    ...records.map((record) => record.provider_id),
    ...programmes.map((programme) => programme.provider_id),
    ...enrolments.map((enrolment) => enrolment.provider_id),
  ].filter(Boolean)));
  const providers = providerIds.length
    ? await selectMany<ProviderViewRow>("levytate_providers", organisationId, `select=provider_id,provider_name&provider_id=in.(${providerIds.join(",")})`, "provider_name.asc")
    : [];

  return { employees, applications, providers, programmes, enrolments };
}

function buildLearnerOperationalSummary(
  record: LearnerRecord,
  collections: LearnerLifecycleCollections,
  lookups: Awaited<ReturnType<typeof loadLearnerRecordLookups>>,
): LearnerOperationalSummary {
  const employee = lookups.employees.find((item) => item.id === record.employeeId);
  const manager = employee?.manager_id ? lookups.employees.find((item) => item.id === employee.manager_id) : undefined;
  const application = lookups.applications.find((item) => item.id === record.applicationId);
  const enrolment = lookups.enrolments.find((item) => item.id === record.enrolmentId || item.application_id === record.applicationId);
  const programme = lookups.programmes.find((item) => item.id === record.programmeId);
  const provider = lookups.providers.find((item) => item.provider_id === (record.providerId || programme?.provider_id || enrolment?.provider_id));
  const standardId = record.programmeId && programme
    ? programme.linked_standard_id ?? programme.apprenticeship_standard_id ?? stringArray(programme.linked_standard_ids)[0] ?? application?.apprenticeship_standard_id ?? enrolment?.apprenticeship_standard_id ?? ""
    : application?.apprenticeship_standard_id ?? enrolment?.apprenticeship_standard_id ?? "";
  const standard = standardId ? getApprenticeshipStandard(standardId) : undefined;
  const lifecycleSummary = learnerLifecycleSummaryFromCollections(collections, record.id);
  const progressPosition = deriveProgressPosition(lifecycleSummary?.latestProgress ?? null);
  const reviewHistory = collections.learnerReviews.filter((review) => review.learnerRecordId === record.id);
  const breakHistory = collections.breaksInLearning.filter((breakRecord) => breakRecord.learnerRecordId === record.id).sort((left, right) => right.startDate.localeCompare(left.startDate));
  const latestBreak = breakHistory[0] ?? null;
  const reviewSummaries = deriveReviewSummaries(reviewHistory);
  const operationalActions = collections.operationalActions.filter((action) => action.learnerRecordId === record.id);
  const attention = deriveLearnerAttention({
    lifecycleStatus: record.lifecycleStatus,
    eligibilityDeclaration: lifecycleSummary?.eligibilityDeclaration ?? null,
    preEnrolmentChecks: lifecycleSummary?.preEnrolmentChecks ?? null,
    latestProgress: lifecycleSummary?.latestProgress ?? null,
    latestProviderReview: lifecycleSummary?.latestProviderReview ?? null,
    latestLAndDCheckIn: lifecycleSummary?.latestLAndDCheckIn ?? null,
    latestManagerCheckIn: lifecycleSummary?.latestManagerCheckIn ?? null,
    reviewSummaries,
    activeBreak: lifecycleSummary?.activeBreak ?? null,
    latestBreak,
    reviewHistory,
    assessmentReadiness: lifecycleSummary?.assessmentReadiness ?? null,
    operationalActions,
  });

  return {
    learnerRecordId: record.id,
    learner: {
      id: employee?.id ?? record.employeeId,
      name: employee?.name ?? "Unknown learner",
      email: employee?.email ?? "",
      jobTitle: employee?.job_title ?? "Role not confirmed",
      department: employee?.department ?? "Department not confirmed",
      team: employee?.department ?? "Team not confirmed",
      site: employee?.site ?? "Site not confirmed",
      managerName: manager?.name ?? "Line manager not confirmed",
    },
    programme: {
      programmeId: record.programmeId,
      programmeName: programme?.programme_name ?? standard?.title ?? "Programme not confirmed",
      apprenticeshipStandardId: standardId,
      apprenticeshipStandardTitle: programme?.linked_standard_name || standard?.title || standardId || "Standard not confirmed",
      apprenticeshipStandardReference: standard?.referenceCode ?? standardId,
      providerId: provider?.provider_id ?? record.providerId,
      providerName: provider?.provider_name ?? "Provider not confirmed",
      applicationReference: application?.id ?? record.applicationId,
    },
    lifecycleStatus: record.lifecycleStatus,
    lifecycleStatusLabel: lifecycleStatusLabel(record.lifecycleStatus),
    employmentRoute: record.employmentRoute,
    employmentRouteLabel: employmentRouteLabel(record.employmentRoute),
    expectedStartDate: record.expectedStartDate,
    actualStartDate: record.actualStartDate,
    expectedEndDate: record.expectedEndDate,
    actualEndDate: record.actualEndDate,
    updatedAt: record.updatedAt,
    latestProgress: lifecycleSummary?.latestProgress ?? null,
    progressPosition,
    latestProviderReview: lifecycleSummary?.latestProviderReview ?? null,
    latestLAndDCheckIn: lifecycleSummary?.latestLAndDCheckIn ?? null,
    latestManagerCheckIn: lifecycleSummary?.latestManagerCheckIn ?? null,
    reviewSummaries,
    activeBreak: lifecycleSummary?.activeBreak ?? null,
    latestBreak,
    breakAttention: deriveBreakAttention(lifecycleSummary?.activeBreak ?? null, latestBreak, reviewHistory),
    attention,
  };
}

function assertOrganisationLearnerReadPermission(context: LifecycleContext) {
  assertPermission(context, "learnerLifecycle:read");
  const role = normaliseMvpUserRole(context.user.role);
  if (role === "Platform Admin" || role === "Employer Admin" || role === "Apprenticeship Lead") return;
  throw new LevyTateLearnerLifecyclePermissionError(`${role} cannot access organisation-wide learner records.`);
}

async function loadLearnerLifecycleCollectionsForRecord(session: LevyTateBetaSession, learnerRecordId: string): Promise<LearnerLifecycleCollections> {
  const context = await contextForSession(session);
  const record = await getScopedLearnerRecord(context, learnerRecordId, "read");
  const organisationId = context.organisation.id;

  const [
    eligibilityDeclarations,
    preEnrolmentChecks,
    breaksInLearning,
    withdrawals,
    learnerReviews,
    progressUpdates,
    assessmentReadiness,
    achievements,
    operationalActions,
    lifecycleEvents,
  ] = await Promise.all([
    selectMany<LearnerEligibilityDeclarationRow>(eligibilityDeclarationsTable, organisationId, `learner_record_id=eq.${learnerRecordId}`, "created_at.desc"),
    selectMany<LearnerPreEnrolmentChecksRow>(preEnrolmentChecksTable, organisationId, `learner_record_id=eq.${learnerRecordId}`, "updated_at.desc"),
    selectMany<LearnerBreakInLearningRow>(breaksTable, organisationId, `learner_record_id=eq.${learnerRecordId}`, "start_date.desc"),
    selectMany<LearnerWithdrawalRow>(withdrawalsTable, organisationId, `learner_record_id=eq.${learnerRecordId}`, "recorded_at.desc"),
    selectMany<LearnerReviewRow>(reviewsTable, organisationId, `learner_record_id=eq.${learnerRecordId}`, "review_date.desc"),
    selectMany<LearnerProgressUpdateRow>(progressTable, organisationId, `learner_record_id=eq.${learnerRecordId}`, "update_date.desc"),
    selectMany<LearnerAssessmentReadinessRow>(assessmentReadinessTable, organisationId, `learner_record_id=eq.${learnerRecordId}`, "updated_at.desc"),
    selectMany<LearnerAchievementRow>(achievementsTable, organisationId, `learner_record_id=eq.${learnerRecordId}`, "recorded_at.desc"),
    selectMany<LearnerOperationalActionRow>(operationalActionsTable, organisationId, `learner_record_id=eq.${learnerRecordId}`, "updated_at.desc"),
    selectMany<LearnerLifecycleEventRow>(lifecycleEventsTable, organisationId, `learner_record_id=eq.${learnerRecordId}`, "created_at.asc"),
  ]);

  return {
    learnerRecords: [record],
    eligibilityDeclarations: eligibilityDeclarations.map(eligibilityDeclarationFromRow),
    preEnrolmentChecks: preEnrolmentChecks.map(preEnrolmentChecksFromRow),
    breaksInLearning: breaksInLearning.map(breakFromRow),
    withdrawals: withdrawals.map(withdrawalFromRow),
    learnerReviews: learnerReviews.map(reviewFromRow),
    progressUpdates: progressUpdates.map(progressUpdateFromRow),
    assessmentReadiness: assessmentReadiness.map(assessmentReadinessFromRow),
    achievements: achievements.map(achievementFromRow),
    operationalActions: operationalActions.map(operationalActionFromRow),
    lifecycleEvents: lifecycleEvents.map(lifecycleEventFromRow),
  };
}

async function contextForSession(session: LevyTateBetaSession): Promise<LifecycleContext> {
  const email = session.email.trim().toLowerCase();
  const user = await selectOne<UserRow>(usersTable, new URLSearchParams({
    select: "id,organisation_id,email,role",
    email: `eq.${email}`,
    limit: "1",
  }));

  if (!user) {
    throw new LevyTateLearnerLifecyclePermissionError("Your user account is not linked to a LevyTate workspace.");
  }

  const organisation = await selectOne<OrganisationRow>(organisationsTable, new URLSearchParams({
    select: "id,name",
    id: `eq.${user.organisation_id}`,
    limit: "1",
  }));

  if (!organisation) {
    throw new LevyTateLearnerLifecyclePermissionError("Your workspace could not be found.");
  }

  return { organisation, user };
}

function assertPermission(context: LifecycleContext, permission: "learnerLifecycle:read" | "learnerLifecycle:write" | "learnerLifecycle:status") {
  if (!hasMvpPermission(context.user.role, permission)) {
    throw new LevyTateLearnerLifecyclePermissionError(`${normaliseMvpUserRole(context.user.role)} cannot perform learner lifecycle operations requiring ${permission}.`);
  }
}

async function getScopedLearnerRecord(context: LifecycleContext, learnerRecordId: string, access: "read" | "write") {
  assertPermission(context, access === "read" ? "learnerLifecycle:read" : "learnerLifecycle:write");
  const record = await selectOne<LearnerRecordRow>(learnerRecordsTable, new URLSearchParams({
    select: "*",
    organisation_id: `eq.${context.organisation.id}`,
    id: `eq.${learnerRecordId}`,
    limit: "1",
  }));

  if (!record) throw new LevyTateLearnerLifecycleError("Learner record was not found.");
  const learnerRecord = learnerRecordFromRow(record);
  await assertCanAccessEmployee(context, learnerRecord.employeeId, access);
  return learnerRecord;
}

async function assertCanAccessEmployee(context: LifecycleContext, employeeId: string, access: "read" | "write") {
  const role = normaliseMvpUserRole(context.user.role);
  if (role === "Platform Admin" || role === "Employer Admin" || role === "Apprenticeship Lead") return;
  if (access === "write") {
    throw new LevyTateLearnerLifecyclePermissionError(`${role} cannot edit employer-controlled learner lifecycle records.`);
  }

  const employees = await selectMany<EmployeeRow>(employeesTable, context.organisation.id, "", "id.asc");
  const currentEmployee = employees.find((employee) =>
    employee.status === "Active" && employee.email.trim().toLowerCase() === context.user.email.trim().toLowerCase()
  );

  if (!currentEmployee) {
    throw new LevyTateLearnerLifecyclePermissionError("Your account is not linked to an active employee record.");
  }

  if (role === "Employee" && currentEmployee.id === employeeId) return;
  if (role === "Line Manager" && (currentEmployee.id === employeeId || employees.some((employee) => employee.id === employeeId && employee.manager_id === currentEmployee.id))) return;

  throw new LevyTateLearnerLifecyclePermissionError("You cannot access that learner lifecycle record.");
}

async function assertNoDuplicateActiveLearnerRecord(organisationId: string, employeeId: string, applicationId: string) {
  const rows = await selectMany<LearnerRecordRow>(
    learnerRecordsTable,
    organisationId,
    `employee_id=eq.${employeeId}&record_status=eq.Active`,
    "updated_at.desc",
  );
  const duplicate = rows.find((record) => record.application_id === applicationId || !["achieved", "withdrawn", "completed_without_achievement"].includes(record.lifecycle_status));
  if (duplicate) {
    throw new LevyTateLearnerLifecycleError("This employee already has an active learner lifecycle record for an apprenticeship journey.");
  }
}

async function recordLifecycleEvent(
  context: LifecycleContext,
  learnerRecordId: string,
  eventType: LearnerLifecycleEventType,
  previousStatus: LearnerLifecycleStatus | "",
  newStatus: LearnerLifecycleStatus | "",
  summary: string,
  metadata: Record<string, unknown> = {},
) {
  const event = createLearnerLifecycleEvent({
    organisationId: context.organisation.id,
    learnerRecordId,
    eventType,
    previousStatus,
    newStatus,
    eventDate: nowIso(),
    actorUserId: context.user.id,
    actorName: context.user.email,
    source: "levytate_server",
    summary,
    metadata,
  });

  await supabaseInsert<LearnerLifecycleEventRow>(assertSupabase(), lifecycleEventsTable, [lifecycleEventToRow(event)], {
    query: "on_conflict=organisation_id,id",
    prefer: "resolution=merge-duplicates,return=minimal",
  });
}

async function upsertLearnerRecord(record: LearnerRecord) {
  await supabaseInsert<LearnerRecordRow>(assertSupabase(), learnerRecordsTable, [learnerRecordToRow(record)], {
    query: "on_conflict=organisation_id,id",
    prefer: "resolution=merge-duplicates,return=minimal",
  });
}

async function selectOne<T>(table: string, query: URLSearchParams) {
  const rows = await supabaseSelect<T>(assertSupabase(), table, query);
  return rows[0] ?? null;
}

async function selectMany<T>(table: string, organisationId: string, extraQuery: string, order: string) {
  const query = new URLSearchParams({
    select: "*",
    organisation_id: `eq.${organisationId}`,
    order,
  });
  if (extraQuery) {
    for (const pair of new URLSearchParams(extraQuery)) query.set(pair[0], pair[1]);
  }
  return supabaseSelect<T>(assertSupabase(), table, query);
}

function organisationQuery(organisationId: string, extra: Record<string, string>) {
  const query = new URLSearchParams({ organisation_id: `eq.${organisationId}` });
  for (const [key, value] of Object.entries(extra)) query.set(key, `eq.${value}`);
  return query.toString();
}

function learnerRecordToRow(record: LearnerRecord): LearnerRecordRow {
  return {
    organisation_id: record.organisationId,
    id: record.id,
    employee_id: record.employeeId,
    application_id: record.applicationId,
    programme_id: record.programmeId,
    provider_id: record.providerId,
    enrolment_id: record.enrolmentId,
    lifecycle_status: record.lifecycleStatus,
    employment_route: record.employmentRoute,
    expected_start_date: nullableDatabaseText(record.expectedStartDate),
    actual_start_date: nullableDatabaseText(record.actualStartDate),
    expected_end_date: nullableDatabaseText(record.expectedEndDate),
    actual_end_date: nullableDatabaseText(record.actualEndDate),
    created_at: record.createdAt,
    updated_at: record.updatedAt,
    created_by: record.createdBy,
    updated_by: record.updatedBy,
    record_status: record.recordStatus,
    demonstration_record: record.demonstrationRecord ?? false,
  };
}

function learnerRecordFromRow(row: LearnerRecordRow): LearnerRecord {
  return {
    id: row.id,
    organisationId: row.organisation_id,
    employeeId: row.employee_id,
    applicationId: row.application_id,
    programmeId: row.programme_id,
    providerId: row.provider_id,
    enrolmentId: row.enrolment_id,
    lifecycleStatus: row.lifecycle_status,
    employmentRoute: row.employment_route,
    expectedStartDate: row.expected_start_date ?? "",
    actualStartDate: row.actual_start_date ?? "",
    expectedEndDate: row.expected_end_date ?? "",
    actualEndDate: row.actual_end_date ?? "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    recordStatus: row.record_status,
    demonstrationRecord: Boolean(row.demonstration_record),
  };
}

function eligibilityDeclarationToRow(declaration: LearnerEligibilityDeclaration): LearnerEligibilityDeclarationRow {
  return {
    organisation_id: declaration.organisationId,
    id: declaration.id,
    learner_record_id: declaration.learnerRecordId,
    declaration_type: declaration.declarationType,
    declaration_wording: declaration.declarationWording,
    declaration_version: declaration.declarationVersion,
    confirmed: declaration.confirmed,
    confirmed_by_employee: declaration.confirmedByEmployee,
    confirmed_at: nullableDatabaseText(declaration.confirmedAt),
    expected_england_working_hours_percentage: declaration.expectedEnglandWorkingHoursPercentage,
    verified_by: declaration.verifiedBy,
    verified_at: nullableDatabaseText(declaration.verifiedAt),
    verification_status: declaration.verificationStatus,
    notes: declaration.notes,
    created_at: declaration.createdAt,
    updated_at: declaration.updatedAt,
  };
}

function eligibilityDeclarationFromRow(row: LearnerEligibilityDeclarationRow): LearnerEligibilityDeclaration {
  return {
    id: row.id,
    organisationId: row.organisation_id,
    learnerRecordId: row.learner_record_id,
    declarationType: row.declaration_type,
    declarationWording: row.declaration_wording,
    declarationVersion: row.declaration_version,
    confirmed: row.confirmed,
    confirmedByEmployee: row.confirmed_by_employee,
    confirmedAt: row.confirmed_at ?? "",
    expectedEnglandWorkingHoursPercentage: row.expected_england_working_hours_percentage,
    verifiedBy: row.verified_by,
    verifiedAt: row.verified_at ?? "",
    verificationStatus: row.verification_status,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function preEnrolmentChecksToRow(checks: LearnerPreEnrolmentChecks): LearnerPreEnrolmentChecksRow {
  return {
    organisation_id: checks.organisationId,
    id: checks.id,
    learner_record_id: checks.learnerRecordId,
    probation_status: checks.probationStatus,
    probation_passed_date: nullableDatabaseText(checks.probationPassedDate),
    probation_confirmed_by: checks.probationConfirmedBy,
    probation_confirmed_at: nullableDatabaseText(checks.probationConfirmedAt),
    probation_notes: checks.probationNotes,
    hr_approval_status: checks.hrApprovalStatus,
    hr_approved_date: nullableDatabaseText(checks.hrApprovedDate),
    hr_approved_by: checks.hrApprovedBy,
    hr_approval_notes: checks.hrApprovalNotes,
    guides_sent: checks.guidesSent,
    guides_sent_date: nullableDatabaseText(checks.guidesSentDate),
    guides_sent_by: checks.guidesSentBy,
    guides_version: checks.guidesVersion,
    guides_notes: checks.guidesNotes,
    created_at: checks.createdAt,
    updated_at: checks.updatedAt,
  };
}

function preEnrolmentChecksFromRow(row: LearnerPreEnrolmentChecksRow): LearnerPreEnrolmentChecks {
  return {
    id: row.id,
    organisationId: row.organisation_id,
    learnerRecordId: row.learner_record_id,
    probationStatus: row.probation_status,
    probationPassedDate: row.probation_passed_date ?? "",
    probationConfirmedBy: row.probation_confirmed_by,
    probationConfirmedAt: row.probation_confirmed_at ?? "",
    probationNotes: row.probation_notes,
    hrApprovalStatus: row.hr_approval_status,
    hrApprovedDate: row.hr_approved_date ?? "",
    hrApprovedBy: row.hr_approved_by,
    hrApprovalNotes: row.hr_approval_notes,
    guidesSent: row.guides_sent,
    guidesSentDate: row.guides_sent_date ?? "",
    guidesSentBy: row.guides_sent_by,
    guidesVersion: row.guides_version,
    guidesNotes: row.guides_notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function breakToRow(record: LearnerBreakInLearning): LearnerBreakInLearningRow {
  return {
    organisation_id: record.organisationId,
    id: record.id,
    learner_record_id: record.learnerRecordId,
    start_date: record.startDate,
    expected_return_date: nullableDatabaseText(record.expectedReturnDate),
    actual_return_date: nullableDatabaseText(record.actualReturnDate),
    reason_category: record.reasonCategory,
    reason_notes: JSON.stringify({
      schemaVersion: 1,
      reasonNotes: record.reasonNotes,
      previousLifecycleStatus: record.previousLifecycleStatus,
      expectedReturnUnknown: record.expectedReturnUnknown,
      reviewDate: record.reviewDate,
      providerNotified: record.providerNotified,
      providerNotifiedDate: record.providerNotifiedDate,
      employeeNotified: record.employeeNotified,
      employeeNotifiedDate: record.employeeNotifiedDate,
      managerNotified: record.managerNotified,
      managerNotifiedDate: record.managerNotifiedDate,
      returnPlanNotes: record.returnPlanNotes,
      effectiveLifecycleDate: record.effectiveLifecycleDate,
      returnConfirmationNote: record.returnConfirmationNote,
      programmeStillValidConfirmed: record.programmeStillValidConfirmed,
      providerReturnConfirmed: record.providerReturnConfirmed,
      managerReturnConfirmed: record.managerReturnConfirmed,
      learnerReturnConfirmed: record.learnerReturnConfirmed,
      revisedExpectedEndDate: record.revisedExpectedEndDate,
      revisedReviewDate: record.revisedReviewDate,
      immediateSupportAction: record.immediateSupportAction,
      progressResetNote: record.progressResetNote,
      firstCheckInDate: record.firstCheckInDate,
      cancellationReason: record.cancellationReason,
      cancelledBy: record.cancelledBy,
      cancelledAt: record.cancelledAt,
      startDateCorrectionReason: record.startDateCorrectionReason,
    }),
    status: record.status,
    recorded_by: record.recordedBy,
    recorded_at: record.recordedAt,
    updated_at: record.updatedAt,
  };
}

function breakFromRow(row: LearnerBreakInLearningRow): LearnerBreakInLearning {
  const metadata = breakMetadata(row.reason_notes);
  return {
    ...emptyBreakOperationalFields(),
    id: row.id,
    organisationId: row.organisation_id,
    learnerRecordId: row.learner_record_id,
    startDate: row.start_date,
    expectedReturnDate: row.expected_return_date ?? "",
    actualReturnDate: row.actual_return_date ?? "",
    reasonCategory: normaliseBreakReason(row.reason_category),
    reasonNotes: stringField(metadata, "reasonNotes", row.reason_notes),
    previousLifecycleStatus: stringField(metadata, "previousLifecycleStatus", "enrolled") === "assessment_preparation" ? "assessment_preparation" : "enrolled",
    expectedReturnUnknown: booleanField(metadata, "expectedReturnUnknown"),
    reviewDate: stringField(metadata, "reviewDate"),
    providerNotified: booleanField(metadata, "providerNotified"),
    providerNotifiedDate: stringField(metadata, "providerNotifiedDate"),
    employeeNotified: booleanField(metadata, "employeeNotified"),
    employeeNotifiedDate: stringField(metadata, "employeeNotifiedDate"),
    managerNotified: booleanField(metadata, "managerNotified"),
    managerNotifiedDate: stringField(metadata, "managerNotifiedDate"),
    returnPlanNotes: stringField(metadata, "returnPlanNotes"),
    effectiveLifecycleDate: stringField(metadata, "effectiveLifecycleDate", row.start_date),
    returnConfirmationNote: stringField(metadata, "returnConfirmationNote"),
    programmeStillValidConfirmed: booleanField(metadata, "programmeStillValidConfirmed"),
    providerReturnConfirmed: booleanField(metadata, "providerReturnConfirmed"),
    managerReturnConfirmed: booleanField(metadata, "managerReturnConfirmed"),
    learnerReturnConfirmed: booleanField(metadata, "learnerReturnConfirmed"),
    revisedExpectedEndDate: stringField(metadata, "revisedExpectedEndDate"),
    revisedReviewDate: stringField(metadata, "revisedReviewDate"),
    immediateSupportAction: stringField(metadata, "immediateSupportAction"),
    progressResetNote: stringField(metadata, "progressResetNote"),
    firstCheckInDate: stringField(metadata, "firstCheckInDate"),
    cancellationReason: stringField(metadata, "cancellationReason"),
    cancelledBy: stringField(metadata, "cancelledBy"),
    cancelledAt: stringField(metadata, "cancelledAt"),
    startDateCorrectionReason: stringField(metadata, "startDateCorrectionReason"),
    status: row.status,
    recordedBy: row.recorded_by,
    recordedAt: row.recorded_at,
    updatedAt: row.updated_at,
  };
}

function emptyBreakOperationalFields(): Omit<LearnerBreakInLearning, "id" | "organisationId" | "learnerRecordId" | "startDate" | "expectedReturnDate" | "actualReturnDate" | "reasonCategory" | "reasonNotes" | "status" | "recordedBy" | "recordedAt" | "updatedAt"> {
  return { previousLifecycleStatus: "enrolled", expectedReturnUnknown: false, reviewDate: "", providerNotified: false, providerNotifiedDate: "", employeeNotified: false, employeeNotifiedDate: "", managerNotified: false, managerNotifiedDate: "", returnPlanNotes: "", effectiveLifecycleDate: "", returnConfirmationNote: "", programmeStillValidConfirmed: false, providerReturnConfirmed: false, managerReturnConfirmed: false, learnerReturnConfirmed: false, revisedExpectedEndDate: "", revisedReviewDate: "", immediateSupportAction: "", progressResetNote: "", firstCheckInDate: "", cancellationReason: "", cancelledBy: "", cancelledAt: "", startDateCorrectionReason: "" };
}

function breakMetadata(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) && (parsed as { schemaVersion?: unknown }).schemaVersion === 1 ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function stringField(value: Record<string, unknown>, key: string, fallback = "") {
  return typeof value[key] === "string" ? value[key] as string : fallback;
}

function booleanField(value: Record<string, unknown>, key: string) {
  return value[key] === true;
}

function normaliseBreakReason(value: string): LearnerBreakReasonCategory {
  if (Object.prototype.hasOwnProperty.call(learnerBreakReasonLabels, value)) return value as LearnerBreakReasonCategory;
  const match = Object.entries(learnerBreakReasonLabels).find(([, label]) => label.toLowerCase() === value.toLowerCase());
  return match ? match[0] as LearnerBreakReasonCategory : "personal_circumstances";
}

function withdrawalToRow(record: LearnerWithdrawal): LearnerWithdrawalRow {
  return {
    organisation_id: record.organisationId,
    id: record.id,
    learner_record_id: record.learnerRecordId,
    withdrawal_date: record.withdrawalDate,
    effective_date: record.effectiveDate,
    reason_category: record.reasonCategory,
    reason_notes: record.reasonNotes,
    initiated_by: record.initiatedBy,
    provider_notified: record.providerNotified,
    provider_notified_date: nullableDatabaseText(record.providerNotifiedDate),
    employee_notified: record.employeeNotified,
    employee_notified_date: nullableDatabaseText(record.employeeNotifiedDate),
    recorded_by: record.recordedBy,
    recorded_at: record.recordedAt,
  };
}

function withdrawalFromRow(row: LearnerWithdrawalRow): LearnerWithdrawal {
  return {
    id: row.id,
    organisationId: row.organisation_id,
    learnerRecordId: row.learner_record_id,
    withdrawalDate: row.withdrawal_date,
    effectiveDate: row.effective_date,
    reasonCategory: row.reason_category,
    reasonNotes: row.reason_notes,
    initiatedBy: row.initiated_by,
    providerNotified: row.provider_notified,
    providerNotifiedDate: row.provider_notified_date ?? "",
    employeeNotified: row.employee_notified,
    employeeNotifiedDate: row.employee_notified_date ?? "",
    recordedBy: row.recorded_by,
    recordedAt: row.recorded_at,
  };
}

function reviewToRow(review: LearnerReview): LearnerReviewRow {
  return {
    organisation_id: review.organisationId,
    id: review.id,
    learner_record_id: review.learnerRecordId,
    review_type: review.reviewType,
    review_date: review.reviewDate,
    next_review_date: nullableDatabaseText(review.nextReviewDate),
    reviewer_name: review.reviewerName,
    reviewer_user_id: review.reviewerUserId,
    provider_id: review.providerId,
    summary: review.summary,
    actions: review.actions,
    support_required: review.supportRequired,
    status: review.status,
    created_at: review.createdAt,
    updated_at: review.updatedAt,
  };
}

function reviewFromRow(row: LearnerReviewRow): LearnerReview {
  return {
    id: row.id,
    organisationId: row.organisation_id,
    learnerRecordId: row.learner_record_id,
    reviewType: row.review_type,
    reviewDate: row.review_date,
    nextReviewDate: row.next_review_date ?? "",
    reviewerName: row.reviewer_name,
    reviewerUserId: row.reviewer_user_id,
    providerId: row.provider_id,
    summary: row.summary,
    actions: stringArray(row.actions),
    supportRequired: row.support_required,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function progressUpdateToRow(update: LearnerProgressUpdate): LearnerProgressUpdateRow {
  return {
    organisation_id: update.organisationId,
    id: update.id,
    learner_record_id: update.learnerRecordId,
    update_date: update.updateDate,
    target_progress_percentage: update.targetProgressPercentage,
    actual_progress_percentage: update.actualProgressPercentage,
    variance_percentage: update.variancePercentage,
    progress_source: update.progressSource,
    source_reference: update.sourceReference,
    updated_by: update.updatedBy,
    summary: update.summary,
    support_action: update.supportAction,
    created_at: update.createdAt,
  };
}

function progressUpdateFromRow(row: LearnerProgressUpdateRow): LearnerProgressUpdate {
  return {
    id: row.id,
    organisationId: row.organisation_id,
    learnerRecordId: row.learner_record_id,
    updateDate: row.update_date,
    targetProgressPercentage: row.target_progress_percentage,
    actualProgressPercentage: row.actual_progress_percentage,
    variancePercentage: row.variance_percentage,
    progressSource: row.progress_source,
    sourceReference: row.source_reference,
    updatedBy: row.updated_by,
    summary: row.summary,
    supportAction: row.support_action,
    createdAt: row.created_at,
  };
}

function assessmentReadinessToRow(readiness: LearnerAssessmentReadiness): LearnerAssessmentReadinessRow {
  return {
    organisation_id: readiness.organisationId,
    id: readiness.id,
    learner_record_id: readiness.learnerRecordId,
    assessment_model: readiness.assessmentModel,
    assessment_model_explanation: readiness.assessmentModelExplanation,
    expected_assessment_readiness_date: nullableDatabaseText(readiness.expectedAssessmentReadinessDate),
    actual_assessment_readiness_date: nullableDatabaseText(readiness.actualAssessmentReadinessDate),
    gateway_date: nullableDatabaseText(readiness.gatewayDate),
    expected_assessment_start_date: nullableDatabaseText(readiness.expectedAssessmentStartDate),
    assessment_start_date: nullableDatabaseText(readiness.assessmentStartDate),
    assessment_status: readiness.assessmentStatus,
    assessment_organisation: readiness.assessmentOrganisation,
    assessment_contact: readiness.assessmentContact,
    assessment_reference: readiness.assessmentReference,
    assessment_notes: readiness.assessmentNotes,
    confirmations: readiness.confirmations,
    readiness_confirmed_by: readiness.readinessConfirmedBy,
    readiness_confirmed_at: nullableDatabaseText(readiness.readinessConfirmedAt),
    updated_by: readiness.updatedBy,
    version: readiness.version,
    created_at: readiness.createdAt,
    updated_at: readiness.updatedAt,
  };
}

function assessmentReadinessFromRow(row: LearnerAssessmentReadinessRow): LearnerAssessmentReadiness {
  return {
    id: row.id,
    organisationId: row.organisation_id,
    learnerRecordId: row.learner_record_id,
    assessmentModel: row.assessment_model,
    assessmentModelExplanation: row.assessment_model_explanation ?? "",
    expectedAssessmentReadinessDate: row.expected_assessment_readiness_date ?? "",
    actualAssessmentReadinessDate: row.actual_assessment_readiness_date ?? "",
    gatewayDate: row.gateway_date ?? "",
    expectedAssessmentStartDate: row.expected_assessment_start_date ?? "",
    assessmentStartDate: row.assessment_start_date ?? "",
    assessmentStatus: row.assessment_status,
    assessmentOrganisation: row.assessment_organisation,
    assessmentContact: row.assessment_contact ?? "",
    assessmentReference: row.assessment_reference ?? "",
    assessmentNotes: row.assessment_notes,
    confirmations: normaliseAssessmentReadinessConfirmations(row.confirmations),
    readinessConfirmedBy: row.readiness_confirmed_by ?? "",
    readinessConfirmedAt: row.readiness_confirmed_at ?? "",
    updatedBy: row.updated_by ?? "",
    version: Number(row.version ?? 1),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function achievementToRow(achievement: LearnerAchievement): LearnerAchievementRow {
  return {
    organisation_id: achievement.organisationId,
    id: achievement.id,
    learner_record_id: achievement.learnerRecordId,
    expected_achievement_date: nullableDatabaseText(achievement.expectedAchievementDate),
    actual_achievement_date: nullableDatabaseText(achievement.actualAchievementDate),
    grade: achievement.grade,
    grade_type: achievement.gradeType,
    certificate_received: achievement.certificateReceived,
    certificate_received_date: nullableDatabaseText(achievement.certificateReceivedDate),
    result_notes: achievement.resultNotes,
    recorded_by: achievement.recordedBy,
    recorded_at: achievement.recordedAt,
  };
}

function achievementFromRow(row: LearnerAchievementRow): LearnerAchievement {
  return {
    id: row.id,
    organisationId: row.organisation_id,
    learnerRecordId: row.learner_record_id,
    expectedAchievementDate: row.expected_achievement_date ?? "",
    actualAchievementDate: row.actual_achievement_date ?? "",
    grade: row.grade,
    gradeType: row.grade_type,
    certificateReceived: row.certificate_received,
    certificateReceivedDate: row.certificate_received_date ?? "",
    resultNotes: row.result_notes,
    recordedBy: row.recorded_by,
    recordedAt: row.recorded_at,
  };
}

function operationalActionToRow(action: LearnerOperationalAction): LearnerOperationalActionRow {
  return {
    organisation_id: action.organisationId,
    id: action.id,
    learner_record_id: action.learnerRecordId,
    action_type: action.actionType,
    status: action.status,
    completed: action.completed,
    completed_at: nullableDatabaseText(action.completedAt),
    completed_by: action.completedBy,
    recipient_summary: action.recipientSummary,
    notes: action.notes,
    created_at: action.createdAt,
    updated_at: action.updatedAt,
  };
}

function operationalActionFromRow(row: LearnerOperationalActionRow): LearnerOperationalAction {
  return {
    id: row.id,
    organisationId: row.organisation_id,
    learnerRecordId: row.learner_record_id,
    actionType: row.action_type,
    status: row.status,
    completed: row.completed,
    completedAt: row.completed_at ?? "",
    completedBy: row.completed_by,
    recipientSummary: row.recipient_summary,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function lifecycleEventToRow(event: LearnerLifecycleEvent): LearnerLifecycleEventRow {
  return {
    organisation_id: event.organisationId,
    id: event.id,
    learner_record_id: event.learnerRecordId,
    event_type: event.eventType,
    previous_status: event.previousStatus,
    new_status: event.newStatus,
    event_date: event.eventDate,
    actor_user_id: event.actorUserId,
    actor_name: event.actorName,
    source: event.source,
    summary: event.summary,
    metadata: event.metadata,
    created_at: event.createdAt,
  };
}

function lifecycleEventFromRow(row: LearnerLifecycleEventRow): LearnerLifecycleEvent {
  return {
    id: row.id,
    organisationId: row.organisation_id,
    learnerRecordId: row.learner_record_id,
    eventType: row.event_type,
    previousStatus: row.previous_status,
    newStatus: row.new_status,
    eventDate: row.event_date,
    actorUserId: row.actor_user_id,
    actorName: row.actor_name,
    source: row.source,
    summary: row.summary,
    metadata: objectValue(row.metadata),
    createdAt: row.created_at,
  };
}

function stringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function objectValue(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function cleanText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function cleanDate(value: unknown, fieldName: string): string {
  const text = cleanText(value);
  if (!text) return "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    throw new LevyTateLearnerLifecycleValidationError(`${fieldName} must use YYYY-MM-DD format.`);
  }
  return text;
}

function assertEnum<T extends string>(value: unknown, allowed: readonly T[], label: string): asserts value is T {
  if (typeof value !== "string" || !allowed.includes(value as T)) {
    throw new LevyTateLearnerLifecycleValidationError(`Invalid ${label}.`);
  }
}

function nullableDatabaseText(value: string): string {
  return value.trim() || (null as unknown as string);
}

function assertPercentage(value: number, fieldName: string) {
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    throw new LevyTateLearnerLifecycleError(`${fieldName} must be between 0 and 100.`);
  }
}

function assertSupabase() {
  const config = getLevyTateSupabaseConfig();
  if (!config) {
    throw new LevyTateLearnerLifecycleError("Supabase environment variables are not configured.");
  }
  return config;
}
