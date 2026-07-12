import type { LevyTateBetaSession } from "@/lib/levytate/config/beta-access";
import { getApprenticeshipStandard } from "@/lib/levytate/domain";
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
  type LearnerAchievement,
  type LearnerAssessmentReadiness,
  type LearnerBreakInLearning,
  type LearnerEligibilityDeclaration,
  type LearnerLifecycleCollections,
  type LearnerLifecycleEvent,
  type LearnerLifecycleEventType,
  type LearnerLifecycleStatus,
  type LearnerOperationalAction,
  type LearnerPreEnrolmentChecks,
  type LearnerProgressUpdate,
  type LearnerRecord,
  type LearnerReview,
  type LearnerWithdrawal,
} from "@/lib/levytate/mvp/learner-lifecycle";
import {
  compareLearnerOperationalPriority,
  deriveLearnerAttention,
  deriveProgressPosition,
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
  expected_assessment_readiness_date: string;
  actual_assessment_readiness_date: string;
  gateway_date: string;
  assessment_status: LearnerAssessmentReadiness["assessmentStatus"];
  assessment_organisation: string;
  assessment_notes: string;
  created_at: string;
  updated_at: string;
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

type LifecycleContext = {
  organisation: OrganisationRow;
  user: UserRow;
};

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

export async function addLearnerReview(
  session: LevyTateBetaSession,
  review: Omit<LearnerReview, "id" | "organisationId" | "createdAt" | "updatedAt"> & Partial<Pick<LearnerReview, "id">>,
) {
  const context = await contextForSession(session);
  assertPermission(context, "learnerLifecycle:write");
  await getScopedLearnerRecord(context, review.learnerRecordId, "write");

  const timestamp = nowIso();
  const next: LearnerReview = {
    id: review.id ?? createMvpId("learner-review"),
    organisationId: context.organisation.id,
    learnerRecordId: review.learnerRecordId,
    reviewType: review.reviewType,
    reviewDate: review.reviewDate,
    nextReviewDate: review.nextReviewDate,
    reviewerName: review.reviewerName,
    reviewerUserId: review.reviewerUserId,
    providerId: review.providerId,
    summary: review.summary,
    actions: review.actions,
    supportRequired: review.supportRequired,
    status: review.status,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  await supabaseInsert<LearnerReviewRow>(assertSupabase(), reviewsTable, [reviewToRow(next)], {
    query: "on_conflict=organisation_id,id",
    prefer: "resolution=merge-duplicates,return=minimal",
  });
  await recordLifecycleEvent(context, next.learnerRecordId, "provider_review_recorded", "", "", `${next.reviewType} recorded.`, { reviewType: next.reviewType, reviewDate: next.reviewDate });
  return next;
}

export async function addProgressUpdate(
  session: LevyTateBetaSession,
  update: Omit<LearnerProgressUpdate, "id" | "organisationId" | "variancePercentage" | "createdAt"> & Partial<Pick<LearnerProgressUpdate, "id">>,
) {
  const context = await contextForSession(session);
  assertPermission(context, "learnerLifecycle:write");
  await getScopedLearnerRecord(context, update.learnerRecordId, "write");

  const next: LearnerProgressUpdate = {
    id: update.id ?? createMvpId("learner-progress"),
    organisationId: context.organisation.id,
    learnerRecordId: update.learnerRecordId,
    updateDate: update.updateDate,
    targetProgressPercentage: update.targetProgressPercentage,
    actualProgressPercentage: update.actualProgressPercentage,
    variancePercentage: calculateLearnerProgressVariance(update.targetProgressPercentage, update.actualProgressPercentage),
    progressSource: update.progressSource,
    sourceReference: update.sourceReference,
    updatedBy: update.updatedBy,
    summary: update.summary,
    supportAction: update.supportAction,
    createdAt: nowIso(),
  };

  await supabaseInsert<LearnerProgressUpdateRow>(assertSupabase(), progressTable, [progressUpdateToRow(next)], {
    query: "on_conflict=organisation_id,id",
    prefer: "resolution=merge-duplicates,return=minimal",
  });
  await recordLifecycleEvent(context, next.learnerRecordId, "progress_updated", "", "", "Learner progress updated.", { target: next.targetProgressPercentage, actual: next.actualProgressPercentage, variance: next.variancePercentage });
  return next;
}

export async function startBreakInLearning(
  session: LevyTateBetaSession,
  breakRecord: Omit<LearnerBreakInLearning, "id" | "organisationId" | "status" | "recordedBy" | "recordedAt" | "updatedAt"> & Partial<Pick<LearnerBreakInLearning, "id">>,
) {
  const context = await contextForSession(session);
  const record = await updateLearnerLifecycleStatus(session, breakRecord.learnerRecordId, "break_in_learning", "Break in learning started.", { reasonCategory: breakRecord.reasonCategory });
  const timestamp = nowIso();
  const next: LearnerBreakInLearning = {
    id: breakRecord.id ?? createMvpId("learner-break"),
    organisationId: context.organisation.id,
    learnerRecordId: breakRecord.learnerRecordId,
    startDate: breakRecord.startDate,
    expectedReturnDate: breakRecord.expectedReturnDate,
    actualReturnDate: breakRecord.actualReturnDate,
    reasonCategory: breakRecord.reasonCategory,
    reasonNotes: breakRecord.reasonNotes,
    status: "active",
    recordedBy: context.user.email,
    recordedAt: timestamp,
    updatedAt: timestamp,
  };

  await supabaseInsert<LearnerBreakInLearningRow>(assertSupabase(), breaksTable, [breakToRow(next)], {
    query: "on_conflict=organisation_id,id",
    prefer: "resolution=merge-duplicates,return=minimal",
  });
  await recordLifecycleEvent(context, record.id, "break_started", "enrolled", "break_in_learning", "Break in learning record created.", { expectedReturnDate: next.expectedReturnDate });
  return next;
}

export async function returnFromBreak(
  session: LevyTateBetaSession,
  learnerRecordId: string,
  actualReturnDate: string,
  notes = "Learner returned from break in learning.",
) {
  const context = await contextForSession(session);
  const breakRecord = await selectOne<LearnerBreakInLearningRow>(breaksTable, new URLSearchParams({
    select: "*",
    organisation_id: `eq.${context.organisation.id}`,
    learner_record_id: `eq.${learnerRecordId}`,
    status: "eq.active",
    limit: "1",
  }));
  if (!breakRecord) throw new LevyTateLearnerLifecycleError("No active break in learning was found.");

  await updateLearnerLifecycleStatus(session, learnerRecordId, "enrolled", notes);
  await supabaseUpdate(assertSupabase(), breaksTable, organisationQuery(context.organisation.id, { id: breakRecord.id }), {
    actual_return_date: actualReturnDate,
    status: "returned",
    updated_at: nowIso(),
  }, { prefer: "return=minimal" });
  await recordLifecycleEvent(context, learnerRecordId, "returned_from_break", "break_in_learning", "enrolled", notes, { actualReturnDate });
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

export async function updateAssessmentReadiness(
  session: LevyTateBetaSession,
  readiness: Omit<LearnerAssessmentReadiness, "id" | "organisationId" | "createdAt" | "updatedAt"> & Partial<Pick<LearnerAssessmentReadiness, "id" | "createdAt">>,
) {
  const context = await contextForSession(session);
  assertPermission(context, "learnerLifecycle:write");
  await getScopedLearnerRecord(context, readiness.learnerRecordId, "write");

  const timestamp = nowIso();
  const next: LearnerAssessmentReadiness = {
    id: readiness.id ?? createMvpId("learner-assessment"),
    organisationId: context.organisation.id,
    learnerRecordId: readiness.learnerRecordId,
    assessmentModel: readiness.assessmentModel,
    expectedAssessmentReadinessDate: readiness.expectedAssessmentReadinessDate,
    actualAssessmentReadinessDate: readiness.actualAssessmentReadinessDate,
    gatewayDate: readiness.gatewayDate,
    assessmentStatus: readiness.assessmentStatus,
    assessmentOrganisation: readiness.assessmentOrganisation,
    assessmentNotes: readiness.assessmentNotes,
    createdAt: readiness.createdAt ?? timestamp,
    updatedAt: timestamp,
  };

  await supabaseInsert<LearnerAssessmentReadinessRow>(assertSupabase(), assessmentReadinessTable, [assessmentReadinessToRow(next)], {
    query: "on_conflict=organisation_id,id",
    prefer: "resolution=merge-duplicates,return=minimal",
  });
  await recordLifecycleEvent(context, next.learnerRecordId, "assessment_readiness_updated", "", "", "Assessment readiness updated.", { assessmentStatus: next.assessmentStatus, gatewayDate: next.gatewayDate });
  return next;
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

export async function getOrganisationLearnerLifecycleRecordDetail(session: LevyTateBetaSession, learnerRecordId: string): Promise<LearnerRecordDetail> {
  const context = await contextForSession(session);
  assertOrganisationLearnerReadPermission(context);
  const recordRow = await selectOne<LearnerRecordRow>(learnerRecordsTable, new URLSearchParams({
    select: "*",
    organisation_id: `eq.${context.organisation.id}`,
    id: `eq.${learnerRecordId}`,
    limit: "1",
  }));
  if (!recordRow) throw new LevyTateLearnerLifecycleError("Learner record was not found.");

  const record = learnerRecordFromRow(recordRow);
  const collections = await loadLearnerLifecycleCollectionsForRecord(session, learnerRecordId);
  const lookups = await loadLearnerRecordLookups(context.organisation.id);
  const summary = buildLearnerOperationalSummary(record, collections, lookups);
  return {
    ...summary,
    eligibilityDeclaration: collections.eligibilityDeclarations[0] ?? null,
    preEnrolmentChecks: collections.preEnrolmentChecks[0] ?? null,
    progressHistory: [...collections.progressUpdates].sort((left, right) => right.updateDate.localeCompare(left.updateDate) || right.createdAt.localeCompare(left.createdAt)),
    reviewHistory: [...collections.learnerReviews].sort((left, right) => right.reviewDate.localeCompare(left.reviewDate) || right.createdAt.localeCompare(left.createdAt)),
    breaksInLearning: [...collections.breaksInLearning].sort((left, right) => right.startDate.localeCompare(left.startDate)),
    withdrawal: collections.withdrawals[0] ?? null,
    assessmentReadiness: collections.assessmentReadiness[0] ?? null,
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
  const operationalActions = collections.operationalActions.filter((action) => action.learnerRecordId === record.id);
  const attention = deriveLearnerAttention({
    lifecycleStatus: record.lifecycleStatus,
    eligibilityDeclaration: lifecycleSummary?.eligibilityDeclaration ?? null,
    preEnrolmentChecks: lifecycleSummary?.preEnrolmentChecks ?? null,
    latestProgress: lifecycleSummary?.latestProgress ?? null,
    latestProviderReview: lifecycleSummary?.latestProviderReview ?? null,
    latestLAndDCheckIn: lifecycleSummary?.latestLAndDCheckIn ?? null,
    activeBreak: lifecycleSummary?.activeBreak ?? null,
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
    latestProgress: lifecycleSummary?.latestProgress ?? null,
    progressPosition,
    latestProviderReview: lifecycleSummary?.latestProviderReview ?? null,
    latestLAndDCheckIn: lifecycleSummary?.latestLAndDCheckIn ?? null,
    latestManagerCheckIn: lifecycleSummary?.latestManagerCheckIn ?? null,
    activeBreak: lifecycleSummary?.activeBreak ?? null,
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
    reason_notes: record.reasonNotes,
    status: record.status,
    recorded_by: record.recordedBy,
    recorded_at: record.recordedAt,
    updated_at: record.updatedAt,
  };
}

function breakFromRow(row: LearnerBreakInLearningRow): LearnerBreakInLearning {
  return {
    id: row.id,
    organisationId: row.organisation_id,
    learnerRecordId: row.learner_record_id,
    startDate: row.start_date,
    expectedReturnDate: row.expected_return_date ?? "",
    actualReturnDate: row.actual_return_date ?? "",
    reasonCategory: row.reason_category,
    reasonNotes: row.reason_notes,
    status: row.status,
    recordedBy: row.recorded_by,
    recordedAt: row.recorded_at,
    updatedAt: row.updated_at,
  };
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
    expected_assessment_readiness_date: nullableDatabaseText(readiness.expectedAssessmentReadinessDate),
    actual_assessment_readiness_date: nullableDatabaseText(readiness.actualAssessmentReadinessDate),
    gateway_date: nullableDatabaseText(readiness.gatewayDate),
    assessment_status: readiness.assessmentStatus,
    assessment_organisation: readiness.assessmentOrganisation,
    assessment_notes: readiness.assessmentNotes,
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
    expectedAssessmentReadinessDate: row.expected_assessment_readiness_date ?? "",
    actualAssessmentReadinessDate: row.actual_assessment_readiness_date ?? "",
    gatewayDate: row.gateway_date ?? "",
    assessmentStatus: row.assessment_status,
    assessmentOrganisation: row.assessment_organisation,
    assessmentNotes: row.assessment_notes,
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
