import { describe, expect, it } from "vitest";
import { analyseOperationsAutopilot, autopilotApplicationDestination, buildOperationsBrief } from "@/lib/levytate/autopilot/operations-autopilot";

const now = "2026-11-10T12:00:00Z";
function signal(status = "Awaiting Final Approval", currentOwner: "Apprenticeship Lead" | "Provider Partner" | "Line Manager" = "Apprenticeship Lead", id = "application-one") {
  return analyseOperationsAutopilot({ organisationId: "synthetic-org", now, learners: [], actions: [], applications: [{ id, employeeId: "synthetic-person", employeeName: "Synthetic person", status, currentOwner, updatedAt: "2026-10-01T12:00:00Z" }] })[0];
}
describe("Autopilot application workflow destinations", () => {
  it.each([
    ["Awaiting Final Approval", "Apprenticeship Lead", "Review application"],
    ["Approved for Enrolment", "Provider Partner", "Open enrolment handoff"],
  ] as const)("routes %s to the exact canonical application without proposing an unsupported task", (status, owner, label) => {
    const item = signal(status, owner);
    expect(item.suggestedActionType).toBe("");
    expect(autopilotApplicationDestination(item)).toMatchObject({ applicationId: item.entityId, href: "/levytate/app?module=Applications&application=application-one", label });
    expect(buildOperationsBrief([{ ...item, status: "new", revision: 1 }])).toMatchObject({ total: 1, preparedNextActions: 0 });
  });
  it("keeps the supported manager-review task mapping", () => {
    const item = signal("Awaiting Manager Review", "Line Manager");
    expect(item.suggestedActionType).toBe("review_application"); expect(autopilotApplicationDestination(item)).toBeNull();
  });
  it("uses matching source identity rather than an unrelated payload application", () => {
    const item = signal();
    expect(autopilotApplicationDestination({ ...item, applicationId: "other" })).toBeNull();
    expect(autopilotApplicationDestination({ ...item, evidence: [{ ...item.evidence[0], sourceId: "other" }] })).toBeNull();
    expect(autopilotApplicationDestination({ ...item, entityType: "learner" })).toBeNull();
    expect(autopilotApplicationDestination({ ...item, evidence: [] })).toBeNull();
  });
  it.each(["", " leading", "trailing ", "bad\nvalue", "x".repeat(161)])("rejects malformed source identity %#", id => {
    const item = signal(); expect(autopilotApplicationDestination({ ...item, entityId: id, applicationId: id, evidence: [{ ...item.evidence[0], sourceId: id }] })).toBeNull();
  });
  it("encodes the source identifier inside a fixed local application route", () => {
    const item = signal("Awaiting Final Approval", "Apprenticeship Lead", "application?next=https://example.invalid");
    const destination = autopilotApplicationDestination(item)!;
    expect(destination.href).toBe("/levytate/app?module=Applications&application=application%3Fnext%3Dhttps%3A%2F%2Fexample.invalid");
  });
});
