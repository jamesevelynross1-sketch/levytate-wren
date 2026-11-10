import { z } from "zod";
import type { LearnerListSummary, LearnerOperationalSummary, LearnerRecordDetail } from "@/lib/levytate/mvp/learner-record-view";

export type LearnerCommandExpectation = {
  learnerRecordId?: string; employeeId: string; applicationId: string; programmeId: string; providerId: string;
  outcome?: "withdrawn" | "achieved" | "completed_without_achievement";
};
const text = z.string(), number = z.number().finite(), bool = z.boolean(), texts = z.array(text);
const strings = <T extends string>(...keys: T[]) => Object.fromEntries(keys.map(key => [key, text])) as Record<T, typeof text>;
const identity = { id: text.min(1), organisationId: text.min(1), learnerRecordId: text.min(1) };
const check = z.object({ id: text, label: text, status: text, blocking: z.boolean(), message: text });
const progress = z.object({ ...identity, ...strings("updateDate", "progressSource", "sourceReference", "updatedBy", "summary", "supportAction", "createdAt"), targetProgressPercentage: number, actualProgressPercentage: number, variancePercentage: number });
const managerCheckIn = z.object({
  schemaVersion: z.literal(1), ...strings("discussionPurpose", "discussionPurposeDetail", "workplaceApplication", "learningApplied", "workplaceOpportunityAvailable", "workplaceOpportunityNeeded", "workplaceApplicationNote", "supportAvailableOtherDetail", "supportRequiredDetail", "actionRequiredReason", "note"),
  supportAvailable: texts, supportRequired: texts, concerns: z.array(z.object(strings("type", "detail"))), agreedActions: z.array(z.object(strings("description", "responsibleParty", "targetDate"))),
});
const review = z.object({ ...identity, ...strings("reviewType", "reviewDate", "nextReviewDate", "reviewerName", "reviewerUserId", "providerId", "summary", "supportRequired", "status", "createdAt", "updatedAt"), actions: texts, managerCheckIn: managerCheckIn.nullable().optional() });
const breakRecord = z.object({
  ...identity, ...strings("startDate", "expectedReturnDate", "actualReturnDate", "reasonCategory", "reasonNotes", "previousLifecycleStatus", "reviewDate", "providerNotifiedDate", "employeeNotifiedDate", "managerNotifiedDate", "returnPlanNotes", "effectiveLifecycleDate", "returnConfirmationNote", "revisedExpectedEndDate", "revisedReviewDate", "immediateSupportAction", "progressResetNote", "firstCheckInDate", "cancellationReason", "cancelledBy", "cancelledAt", "startDateCorrectionReason", "status", "recordedBy", "recordedAt", "updatedAt"),
  expectedReturnUnknown: bool, providerNotified: bool, employeeNotified: bool, managerNotified: bool, programmeStillValidConfirmed: bool, providerReturnConfirmed: bool, managerReturnConfirmed: bool, learnerReturnConfirmed: bool,
});
const declaration = z.object({ ...identity, ...strings("declarationType", "declarationWording", "declarationVersion", "confirmedByEmployee", "confirmedAt", "verifiedBy", "verifiedAt", "verificationStatus", "notes", "createdAt", "updatedAt"), confirmed: bool, expectedEnglandWorkingHoursPercentage: number.nullable() });
const preEnrolment = z.object({ ...identity, ...strings("probationStatus", "probationPassedDate", "probationConfirmedBy", "probationConfirmedAt", "probationNotes", "hrApprovalStatus", "hrApprovedDate", "hrApprovedBy", "hrApprovalNotes", "guidesSentDate", "guidesSentBy", "guidesVersion", "guidesNotes", "createdAt", "updatedAt"), guidesSent: bool });
const confirmation = z.object(strings("type", "status", "confirmedDate", "confirmedBy", "recordedOnBehalfOf", "note", "evidenceReference", "updatedBy", "updatedAt"));
const assessment = z.object({ ...identity, ...strings("assessmentModel", "assessmentModelExplanation", "expectedAssessmentReadinessDate", "actualAssessmentReadinessDate", "gatewayDate", "expectedAssessmentStartDate", "assessmentStartDate", "assessmentStatus", "assessmentOrganisation", "assessmentContact", "assessmentReference", "assessmentNotes", "readinessConfirmedBy", "readinessConfirmedAt", "updatedBy", "createdAt", "updatedAt"), version: number.int(), confirmations: z.object({ provider: confirmation, learner: confirmation, line_manager: confirmation, employer: confirmation }) });
const assessmentCheck = z.object(strings("id", "label", "status", "message"));
const assessmentResult = z.object({ readyForAssessment: bool, checks: z.array(assessmentCheck), completedChecks: z.array(assessmentCheck), outstandingChecks: z.array(assessmentCheck), blockingChecks: z.array(assessmentCheck), warningChecks: z.array(assessmentCheck) });
const withdrawal = z.object({ ...identity, ...strings("withdrawalDate", "effectiveDate", "reasonCategory", "reasonNotes", "initiatedBy", "providerNotifiedDate", "employeeNotifiedDate", "recordedBy", "recordedAt"), providerNotified: bool, employeeNotified: bool });
const achievement = z.object({ ...strings("expectedAchievementDate", "actualAchievementDate", "grade", "gradeType", "certificateReceivedDate", "resultNotes", "recordedBy", "recordedAt"), certificateReceived: bool });
const operationalAction = z.object({ ...identity, ...strings("actionType", "status", "completedAt", "completedBy", "recipientSummary", "notes", "createdAt", "updatedAt"), completed: bool });
const reviewSummary = z.object({ latest: review.nullable(), nextDate: text, overdue: bool });
const response = z.object({ ok: z.literal(true), learner: z.object({
  learnerRecordId: text.min(1), activityVersion: text.min(1), updatedAt: text.min(1),
  learner: z.object({ id: text.min(1), name: text, email: text, jobTitle: text, department: text, team: text, site: text, managerName: text }),
  programme: z.object({ programmeId: text.min(1), providerId: text.min(1), applicationReference: text.min(1), programmeName: text, apprenticeshipStandardId: text, apprenticeshipStandardTitle: text, apprenticeshipStandardReference: text, providerName: text }),
  lifecycleStatus: z.enum(["pre_enrolment", "enrolled", "break_in_learning", "withdrawn", "assessment_preparation", "in_assessment", "achieved", "completed_without_achievement"]),
  lifecycleStatusLabel: text, employmentRoute: text, employmentRouteLabel: text,
  expectedStartDate: text, actualStartDate: text, expectedEndDate: text, actualEndDate: text,
  latestProgress: progress.nullable(), progressPosition: text,
  latestProviderReview: review.nullable(), latestLAndDCheckIn: review.nullable(), latestManagerCheckIn: review.nullable(),
  reviewSummaries: z.object({ provider: reviewSummary, lAndD: reviewSummary, manager: reviewSummary }),
  activeBreak: breakRecord.nullable(), latestBreak: breakRecord.nullable(),
  breakAttention: z.object({ ...strings("label", "state"), daysOnBreak: number, daysUntilReturn: number.nullable(), reasons: texts }),
  attention: z.object({ ...strings("label", "severity"), reasons: texts, needsAttention: bool }),
  eligibilityDeclaration: declaration.nullable(), preEnrolmentChecks: preEnrolment.nullable(), assessmentReadiness: assessment.nullable(), assessmentReadinessResult: assessmentResult,
  progressHistory: z.array(progress), reviewHistory: z.array(review), breaksInLearning: z.array(breakRecord), lifecycleTimeline: z.array(z.object(strings("id", "eventType", "eventDate", "actorName", "summary", "previousStatus", "newStatus"))), operationalActions: z.array(operationalAction),
  enrolmentReadiness: z.object({ readyForEnrolment: z.boolean(), completedChecks: z.array(check), outstandingChecks: z.array(check), blockingChecks: z.array(check), warningChecks: z.array(check), checks: z.array(check) }),
  withdrawal: withdrawal.nullable(), achievement: achievement.nullable(),
}) });

const listItem = response.shape.learner.omit({ activityVersion: true, eligibilityDeclaration: true, preEnrolmentChecks: true, assessmentReadiness: true, assessmentReadinessResult: true, progressHistory: true, reviewHistory: true, breaksInLearning: true, lifecycleTimeline: true, operationalActions: true, enrolmentReadiness: true, withdrawal: true, achievement: true });
const count = z.number().int().nonnegative().safe();
const listResponse = z.object({ ok: z.literal(true), learners: z.array(listItem), summary: z.object({ total: count, preEnrolment: count, activeLearners: count, breakInLearning: count, assessmentStage: count, achieved: count, needingAttention: count }) });

/** List and detail GETs must satisfy the same rendered fields as saved results. */
export function decodeLearnerListResponse(value: unknown): { learners: LearnerOperationalSummary[]; summary: LearnerListSummary } {
  if (!listResponse.safeParse(value).success) throw new Error("Learner records returned an incomplete response. Retry to load the current workspace.");
  return value as { learners: LearnerOperationalSummary[]; summary: LearnerListSummary };
}

export function decodeLearnerDetailResponse(value: unknown, learnerRecordId: string): LearnerRecordDetail {
  const parsed = response.safeParse(value);
  if (!learnerRecordId || !parsed.success || parsed.data.learner.learnerRecordId !== learnerRecordId) throw new Error("This learner record could not be loaded. Retry to load its saved details.");
  return (value as { learner: LearnerRecordDetail }).learner;
}

/** Never close a retained form on a success for another learner or handoff. */
export function decodeLearnerCommandResponse(value: unknown, expected: LearnerCommandExpectation | null): LearnerRecordDetail {
  const result = response.safeParse(value);
  if (!expected || !result.success) throw new Error("The learner update could not be confirmed. Retry the original update or reload saved state.");
  const saved = result.data.learner;
  if ((expected.learnerRecordId && saved.learnerRecordId !== expected.learnerRecordId)
    || saved.learner.id !== expected.employeeId || saved.programme.applicationReference !== expected.applicationId
    || saved.programme.programmeId !== expected.programmeId || saved.programme.providerId !== expected.providerId
    || (expected.outcome && saved.lifecycleStatus !== expected.outcome)
    || (saved.lifecycleStatus === "withdrawn" && (!saved.withdrawal || saved.withdrawal.learnerRecordId !== saved.learnerRecordId
      || ![saved.withdrawal.withdrawalDate, saved.withdrawal.effectiveDate, saved.withdrawal.reasonCategory, saved.withdrawal.reasonNotes, saved.withdrawal.initiatedBy, saved.withdrawal.recordedBy, saved.withdrawal.recordedAt].every(value => value.trim())
      || saved.actualEndDate !== saved.withdrawal.effectiveDate))
    || ((saved.lifecycleStatus === "achieved" || saved.lifecycleStatus === "completed_without_achievement") && (!saved.achievement
      || ![saved.achievement.actualAchievementDate, saved.achievement.grade, saved.achievement.gradeType, saved.achievement.resultNotes, saved.achievement.recordedBy, saved.achievement.recordedAt].every(value => value.trim())
      || saved.actualEndDate !== saved.achievement.actualAchievementDate))
    || (saved.lifecycleStatus === "completed_without_achievement" && (saved.achievement?.grade !== "Not achieved" || saved.achievement.gradeType !== "Outcome" || saved.achievement.certificateReceived))) {
    throw new Error("The response did not confirm this learner update. Retry the original update or reload saved state.");
  }
  // Preserve the complete server model, including fields outside the confirmation checks.
  return (value as { learner: LearnerRecordDetail }).learner;
}
