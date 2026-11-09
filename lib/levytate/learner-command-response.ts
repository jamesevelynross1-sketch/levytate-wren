import { z } from "zod";
import type { LearnerRecordDetail } from "@/lib/levytate/mvp/learner-record-view";

export type LearnerCommandExpectation = {
  learnerRecordId?: string; employeeId: string; applicationId: string; programmeId: string; providerId: string;
  outcome?: "withdrawn" | "achieved" | "completed_without_achievement";
};
const text = z.string(), record = z.record(text, z.unknown());
const check = z.object({ id: text, label: text, status: text, blocking: z.boolean(), message: text });
const response = z.object({ ok: z.literal(true), learner: z.object({
  learnerRecordId: text.min(1), activityVersion: text.min(1), updatedAt: text.min(1),
  learner: z.object({ id: text.min(1), name: text, email: text, jobTitle: text, department: text, team: text, site: text, managerName: text }),
  programme: z.object({ programmeId: text.min(1), providerId: text.min(1), applicationReference: text.min(1), programmeName: text, apprenticeshipStandardId: text, apprenticeshipStandardTitle: text, apprenticeshipStandardReference: text, providerName: text }),
  lifecycleStatus: z.enum(["pre_enrolment", "enrolled", "break_in_learning", "withdrawn", "assessment_preparation", "in_assessment", "achieved", "completed_without_achievement"]),
  lifecycleStatusLabel: text, employmentRoute: text, employmentRouteLabel: text,
  expectedStartDate: text, actualStartDate: text, expectedEndDate: text, actualEndDate: text,
  progressHistory: z.array(record), reviewHistory: z.array(record), breaksInLearning: z.array(record), lifecycleTimeline: z.array(record), operationalActions: z.array(record),
  enrolmentReadiness: z.object({ readyForEnrolment: z.boolean(), completedChecks: z.array(check), outstandingChecks: z.array(check), blockingChecks: z.array(check), warningChecks: z.array(check), checks: z.array(check) }),
  withdrawal: record.nullable(), achievement: record.nullable(),
}) });

/** Never close a retained form on a success for another learner or handoff. */
export function decodeLearnerCommandResponse(value: unknown, expected: LearnerCommandExpectation | null): LearnerRecordDetail {
  const result = response.safeParse(value);
  if (!expected || !result.success) throw new Error("The learner update could not be confirmed. Retry the original update or reload saved state.");
  const saved = result.data.learner;
  if ((expected.learnerRecordId && saved.learnerRecordId !== expected.learnerRecordId)
    || saved.learner.id !== expected.employeeId || saved.programme.applicationReference !== expected.applicationId
    || saved.programme.programmeId !== expected.programmeId || saved.programme.providerId !== expected.providerId
    || (expected.outcome && saved.lifecycleStatus !== expected.outcome)
    || (saved.lifecycleStatus === "withdrawn" && !saved.withdrawal)
    || (saved.lifecycleStatus === "achieved" && !saved.achievement)) {
    throw new Error("The response did not confirm this learner update. Retry the original update or reload saved state.");
  }
  // Preserve the complete server model, including fields outside the confirmation checks.
  return (value as { learner: LearnerRecordDetail }).learner;
}
