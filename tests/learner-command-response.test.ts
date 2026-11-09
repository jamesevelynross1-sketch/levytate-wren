import { describe, expect, it, vi } from "vitest";
import { createPinnedClientMutation } from "@/lib/levytate/client-mutation-retry";
import { decodeLearnerCommandResponse, type LearnerCommandExpectation } from "@/lib/levytate/learner-command-response";
import { deriveAssessmentReadiness } from "@/lib/levytate/mvp/assessment-readiness";
import { deriveBreakAttention, deriveLearnerAttention, deriveLearnerEnrolmentReadiness, deriveProgressPosition, deriveReviewSummaries, type LearnerRecordDetail } from "@/lib/levytate/mvp/learner-record-view";
import type { LearnerWithdrawal } from "@/lib/levytate/mvp/learner-lifecycle";

const expected: LearnerCommandExpectation = { learnerRecordId: "learner-a", employeeId: "person-a", applicationId: "application-a", programmeId: "programme-a", providerId: "provider-a" };
const identity = { email: "lead@example.invalid", organisationId: "tenant-a" };
function saved(): { ok: true; learner: LearnerRecordDetail & { futureServerField: string } } {
  const reviewSummaries = deriveReviewSummaries([], "2026-11-09");
  const attention = deriveLearnerAttention({ lifecycleStatus: "pre_enrolment", eligibilityDeclaration: null, preEnrolmentChecks: null, latestProgress: null, latestProviderReview: null, latestLAndDCheckIn: null, latestManagerCheckIn: null, reviewSummaries, activeBreak: null, assessmentReadiness: null, operationalActions: [], today: "2026-11-09" });
  return { ok: true, learner: {
  learnerRecordId: "learner-a", activityVersion: "reviewed-version", updatedAt: "2026-11-09T19:40:00Z",
  learner: { id: "person-a", name: "Fictional learner", email: "employee@example.invalid", jobTitle: "Role", department: "", team: "", site: "", managerName: "" },
  programme: { programmeId: "programme-a", providerId: "provider-a", applicationReference: "application-a", programmeName: "Programme", apprenticeshipStandardId: "ST0118", apprenticeshipStandardTitle: "Standard", apprenticeshipStandardReference: "ST0118", providerName: "Provider" },
  lifecycleStatus: "pre_enrolment", lifecycleStatusLabel: "Pre-enrolment", employmentRoute: "existing_employee_upskill", employmentRouteLabel: "Upskill",
  expectedStartDate: "2026-11-01", actualStartDate: "", expectedEndDate: "2028-11-01", actualEndDate: "",
  latestProgress: null, progressPosition: deriveProgressPosition(null), latestProviderReview: null, latestLAndDCheckIn: null, latestManagerCheckIn: null,
  reviewSummaries, activeBreak: null, latestBreak: null, breakAttention: deriveBreakAttention(null, null, [], "2026-11-09"), attention,
  eligibilityDeclaration: null, preEnrolmentChecks: null, assessmentReadiness: null,
  assessmentReadinessResult: deriveAssessmentReadiness({ asOf: "2026-11-09", lifecycleStatus: "pre_enrolment", activeBreak: false, programmeId: "programme-a", providerId: "provider-a", readiness: null, latestProgress: null, latestProviderReview: null }),
  progressHistory: [], reviewHistory: [], breaksInLearning: [], lifecycleTimeline: [], operationalActions: [],
  enrolmentReadiness: deriveLearnerEnrolmentReadiness({ employmentRoute: "existing_employee_upskill", eligibilityDeclaration: null, preEnrolmentChecks: null, programmeId: "programme-a", providerId: "provider-a", actualStartDate: "", expectedEndDate: "2028-11-01" }),
  withdrawal: null, achievement: null,
  futureServerField: "preserved",
} }; }
function withdrawal(): LearnerWithdrawal { return { id: "withdrawal-a", organisationId: "tenant-a", learnerRecordId: "learner-a", withdrawalDate: "2026-11-09", effectiveDate: "2026-11-09", reasonCategory: "Fictional reason", reasonNotes: "Fictional evidenced withdrawal", initiatedBy: "Synthetic learner", providerNotified: false, providerNotifiedDate: "", employeeNotified: false, employeeNotifiedDate: "", recordedBy: "synthetic@example.test", recordedAt: "2026-11-09T19:40:00Z" }; }
function achievement(): NonNullable<LearnerRecordDetail["achievement"]> { return { expectedAchievementDate: "2026-11-09", actualAchievementDate: "2026-11-09", grade: "Pass", gradeType: "Final result", certificateReceived: false, certificateReceivedDate: "", resultNotes: "Fictional result", recordedBy: "synthetic@example.test", recordedAt: "2026-11-09T19:40:00Z" }; }
describe("learner handoff and terminal outcome confirmation", () => {
  it("preserves the matching complete server model without requiring a new handoff ID in advance", () => {
    const value = saved(); expect(decodeLearnerCommandResponse(value, expected)).toBe(value.learner);
    expect(decodeLearnerCommandResponse(value, { ...expected, learnerRecordId: undefined })).toBe(value.learner);
  });
  it.each([null, {}, { ok: true }, { ok: true, learner: { learnerRecordId: "learner-a" } }])("does not confirm malformed successful payloads", value => {
    expect(() => decodeLearnerCommandResponse(value, expected)).toThrow("could not be confirmed");
  });
  it.each(["learnerRecordId", "employeeId", "applicationId", "programmeId", "providerId"] as const)("does not confirm a different %s", key => {
    expect(() => decodeLearnerCommandResponse(saved(), { ...expected, [key]: "different" })).toThrow("did not confirm");
  });
  it("requires both the exact terminal outcome and its associated durable evidence", () => {
    const value = saved(), target = { ...expected, outcome: "withdrawn" as const };
    expect(() => decodeLearnerCommandResponse(value, target)).toThrow();
    value.learner.lifecycleStatus = "withdrawn"; expect(() => decodeLearnerCommandResponse(value, target)).toThrow();
    value.learner.withdrawal = withdrawal(); value.learner.actualEndDate = "2026-11-09"; expect(decodeLearnerCommandResponse(value, target)).toBe(value.learner);
    value.learner.lifecycleStatus = "achieved"; expect(() => decodeLearnerCommandResponse(value, { ...expected, outcome: "achieved" })).toThrow();
    value.learner.achievement = achievement(); expect(decodeLearnerCommandResponse(value, { ...expected, outcome: "achieved" })).toBe(value.learner);
  });
  it.each(["reviewSummaries", "attention", "assessmentReadinessResult", "breakAttention", "latestProgress", "latestProviderReview", "latestLAndDCheckIn", "latestManagerCheckIn", "activeBreak", "latestBreak", "eligibilityDeclaration", "preEnrolmentChecks", "assessmentReadiness", "progressPosition"] as const)("rejects missing render-required %s instead of closing the form", field => {
    const value = saved(); Reflect.deleteProperty(value.learner, field);
    expect(() => decodeLearnerCommandResponse(value, expected)).toThrow("could not be confirmed");
  });
  it.each([{}, { reasonNotes: "Only one field" }, { ...withdrawal(), learnerRecordId: "another-learner" }, { ...withdrawal(), recordedAt: "" }])("rejects incomplete or mismatched withdrawal evidence", invalid => {
    const value = saved(); value.learner.lifecycleStatus = "withdrawn"; Object.assign(value.learner, { withdrawal: invalid });
    expect(() => decodeLearnerCommandResponse(value, { ...expected, outcome: "withdrawn" })).toThrow();
  });
  it.each([{}, { grade: "Pass" }, { ...achievement(), certificateReceived: "false" }, { ...achievement(), recordedBy: "" }])("rejects incomplete or malformed achievement evidence", invalid => {
    const value = saved(); value.learner.lifecycleStatus = "achieved"; Object.assign(value.learner, { achievement: invalid });
    expect(() => decodeLearnerCommandResponse(value, { ...expected, outcome: "achieved" })).toThrow();
  });
  it("requires complete outcome evidence for completion without achievement", () => {
    const value = saved(), target = { ...expected, outcome: "completed_without_achievement" as const };
    value.learner.lifecycleStatus = "completed_without_achievement";
    value.learner.actualEndDate = "2026-11-09";
    expect(() => decodeLearnerCommandResponse(value, target)).toThrow();
    value.learner.achievement = achievement();
    expect(() => decodeLearnerCommandResponse(value, target)).toThrow();
    value.learner.achievement = { ...achievement(), grade: "Not achieved", gradeType: "Outcome" };
    expect(decodeLearnerCommandResponse(value, target)).toBe(value.learner);
    value.learner.achievement.certificateReceived = true;
    expect(() => decodeLearnerCommandResponse(value, target)).toThrow();
  });
  it.each(["withdrawn", "achieved"] as const)("requires the %s effective date to match the saved terminal record", outcome => {
    const value = saved(); value.learner.lifecycleStatus = outcome;
    value.learner.withdrawal = withdrawal(); value.learner.achievement = achievement();
    value.learner.actualEndDate = "2026-11-08";
    expect(() => decodeLearnerCommandResponse(value, { ...expected, outcome })).toThrow();
  });
  it("rejects malformed render-required children and collection elements", () => {
    for (const invalid of [{ reviewSummaries: {} }, { attention: { ...saved().learner.attention, reasons: null } }, { assessmentReadinessResult: { ...saved().learner.assessmentReadinessResult, blockingChecks: [null] } }, { progressHistory: [{}] }, { reviewHistory: [{}] }, { breaksInLearning: [{}] }, { operationalActions: [{}] }, { lifecycleTimeline: [{}] }]) {
      const value = saved(); Object.assign(value.learner, invalid); expect(() => decodeLearnerCommandResponse(value, expected)).toThrow("could not be confirmed");
    }
  });
  it("keeps the exact handoff body after a lost committed response and rejects changed input", async () => {
    const transport = vi.fn().mockRejectedValueOnce(new TypeError("Synthetic lost response")).mockResolvedValueOnce(Response.json(saved()));
    const mutation = createPinnedClientMutation(identity, "/api/levytate-learners", value => decodeLearnerCommandResponse(value, expected), transport);
    const command = { applicationId: "application-a", expectedApplicationRevision: 3, programmeId: "programme-a" }, confirmed = vi.fn();
    await expect(mutation.execute(command, confirmed)).rejects.toThrow(); command.programmeId = "changed";
    await expect(mutation.execute(command)).rejects.toThrow("original update"); expect(confirmed).not.toHaveBeenCalled();
    await mutation.retry(); expect(transport.mock.calls[0][1].body).toBe(transport.mock.calls[1][1].body);
    expect(confirmed).toHaveBeenCalledOnce(); expect(mutation.pending).toBe(false);
  });
  it("retains the original terminal command through a wrong successful response", async () => {
    const wrong = saved(), correct = saved(); correct.learner.lifecycleStatus = "withdrawn"; correct.learner.withdrawal = withdrawal(); correct.learner.actualEndDate = "2026-11-09";
    const transport = vi.fn().mockResolvedValueOnce(Response.json(wrong)).mockResolvedValueOnce(Response.json(correct));
    const mutation = createPinnedClientMutation(identity, "/api/levytate-learners/learner-a/outcome", value => decodeLearnerCommandResponse(value, { ...expected, outcome: "withdrawn" }), transport), confirmed = vi.fn();
    await expect(mutation.execute({ outcome: "withdrawal", idempotencyKey: "original-key", expectedActivityVersion: "original-version" }, confirmed)).rejects.toThrow();
    expect(mutation.pending).toBe(true); expect(confirmed).not.toHaveBeenCalled();
    await mutation.retry(); expect(confirmed).toHaveBeenCalledOnce(); expect(transport.mock.calls[0][1].body).toBe(transport.mock.calls[1][1].body);
  });
});
