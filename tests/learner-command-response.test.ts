import { describe, expect, it, vi } from "vitest";
import { createPinnedClientMutation } from "@/lib/levytate/client-mutation-retry";
import { decodeLearnerCommandResponse, type LearnerCommandExpectation } from "@/lib/levytate/learner-command-response";

const expected: LearnerCommandExpectation = { learnerRecordId: "learner-a", employeeId: "person-a", applicationId: "application-a", programmeId: "programme-a", providerId: "provider-a" };
const identity = { email: "lead@example.invalid", organisationId: "tenant-a" };
function saved() { return { ok: true, learner: {
  learnerRecordId: "learner-a", activityVersion: "reviewed-version", updatedAt: "2026-11-09T19:40:00Z",
  learner: { id: "person-a", name: "Fictional learner", email: "employee@example.invalid", jobTitle: "Role", department: "", team: "", site: "", managerName: "" },
  programme: { programmeId: "programme-a", providerId: "provider-a", applicationReference: "application-a", programmeName: "Programme", apprenticeshipStandardId: "ST0118", apprenticeshipStandardTitle: "Standard", apprenticeshipStandardReference: "ST0118", providerName: "Provider" },
  lifecycleStatus: "pre_enrolment", lifecycleStatusLabel: "Pre-enrolment", employmentRoute: "existing_employee_upskill", employmentRouteLabel: "Upskill",
  expectedStartDate: "2026-11-01", actualStartDate: "", expectedEndDate: "2028-11-01", actualEndDate: "",
  progressHistory: [], reviewHistory: [], breaksInLearning: [], lifecycleTimeline: [], operationalActions: [],
  enrolmentReadiness: { readyForEnrolment: false, completedChecks: [], outstandingChecks: [], blockingChecks: [], warningChecks: [], checks: [] },
  withdrawal: null as Record<string, unknown> | null, achievement: null as Record<string, unknown> | null,
  futureServerField: "preserved",
} }; }
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
    value.learner.withdrawal = { reasonNotes: "Fictional evidenced withdrawal" }; expect(decodeLearnerCommandResponse(value, target)).toBe(value.learner);
    value.learner.lifecycleStatus = "achieved"; expect(() => decodeLearnerCommandResponse(value, { ...expected, outcome: "achieved" })).toThrow();
    value.learner.achievement = { grade: "Pass" }; expect(decodeLearnerCommandResponse(value, { ...expected, outcome: "achieved" })).toBe(value.learner);
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
    const wrong = saved(), correct = saved(); correct.learner.lifecycleStatus = "withdrawn"; correct.learner.withdrawal = { reasonNotes: "Fictional" };
    const transport = vi.fn().mockResolvedValueOnce(Response.json(wrong)).mockResolvedValueOnce(Response.json(correct));
    const mutation = createPinnedClientMutation(identity, "/api/levytate-learners/learner-a/outcome", value => decodeLearnerCommandResponse(value, { ...expected, outcome: "withdrawn" }), transport), confirmed = vi.fn();
    await expect(mutation.execute({ outcome: "withdrawal", idempotencyKey: "original-key", expectedActivityVersion: "original-version" }, confirmed)).rejects.toThrow();
    expect(mutation.pending).toBe(true); expect(confirmed).not.toHaveBeenCalled();
    await mutation.retry(); expect(confirmed).toHaveBeenCalledOnce(); expect(transport.mock.calls[0][1].body).toBe(transport.mock.calls[1][1].body);
  });
});
