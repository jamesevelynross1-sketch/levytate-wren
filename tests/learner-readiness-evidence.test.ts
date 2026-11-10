import { describe, expect, it } from "vitest";
import { deriveAssessmentReadiness, emptyAssessmentReadinessConfirmations, type AssessmentReadinessDerivationInput } from "@/lib/levytate/mvp/assessment-readiness";
import type { LearnerAssessmentReadiness, LearnerProgressUpdate, LearnerReview } from "@/lib/levytate/mvp/learner-lifecycle";

function readyInput(): AssessmentReadinessDerivationInput {
  const confirmations = emptyAssessmentReadinessConfirmations();
  for (const confirmation of Object.values(confirmations)) Object.assign(confirmation, { status: "confirmed", confirmedDate: "2026-10-28", confirmedBy: "Synthetic evidence confirmer" });
  return {
    asOf: "2026-10-29", lifecycleStatus: "assessment_preparation", activeBreak: false, programmeId: "programme-fixture", providerId: "provider-fixture",
    readiness: { assessmentModel: "end_point_assessment", assessmentOrganisation: "Fictional assessment organisation", confirmations, expectedAssessmentReadinessDate: "2026-10-28", gatewayDate: "2026-10-28" } as LearnerAssessmentReadiness,
    latestProgress: { updateDate: "2026-10-28", targetProgressPercentage: 100, actualProgressPercentage: 100, variancePercentage: 0 } as LearnerProgressUpdate,
    latestProviderReview: { status: "completed", reviewDate: "2026-10-28", nextReviewDate: "2026-11-28" } as LearnerReview,
  };
}
describe("assessment readiness uses actual current evidence", () => {
  it("accepts current completed evidence and all explicit confirmations", () => { expect(deriveAssessmentReadiness(readyInput()).readyForAssessment).toBe(true); });
  it.each(["scheduled", "cancelled"] as const)("does not count a %s review as completed evidence", (status) => {
    const input = readyInput(); input.latestProviderReview = { ...input.latestProviderReview!, status };
    expect(deriveAssessmentReadiness(input).blockingChecks.map((check) => check.id)).toContain("latest-provider-review-recorded");
  });
  it("uses the existing 60-day progress policy at its exact boundary", () => {
    const input = readyInput(); input.latestProgress!.updateDate = "2026-08-30";
    expect(deriveAssessmentReadiness(input).readyForAssessment).toBe(true);
    input.latestProgress!.updateDate = "2026-08-29";
    expect(deriveAssessmentReadiness(input).blockingChecks.map((check) => check.id)).toContain("current-progress-evidence");
  });
  it("blocks an overdue provider follow-up and a newly raised critical issue", () => {
    const input = readyInput(); input.latestProviderReview!.nextReviewDate = "2026-10-28"; input.criticalOperationalBlockers = ["New unresolved provider evidence issue"];
    expect(deriveAssessmentReadiness(input).blockingChecks.map((check) => check.id)).toEqual(expect.arrayContaining(["current-provider-review", "critical-operational-blocker-1"]));
  });
  it("rechecks a revoked confirmation and an active break", () => {
    const input = readyInput(); input.readiness!.confirmations.provider.status = "not_confirmed"; input.activeBreak = true;
    expect(deriveAssessmentReadiness(input).blockingChecks.map((check) => check.id)).toEqual(expect.arrayContaining(["provider-readiness-confirmation", "not-on-break"]));
  });
});
