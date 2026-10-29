import { describe, expect, it } from "vitest";
import { autopilotActionInput, guidanceItemPatch, guidanceSourcePatch, intelligenceActionInput, managerAcknowledgeInput, managerStartInput, operationalActionInput, parseAction, prospectActionInput } from "@/lib/server/levytate-operational-input";
import { employeeDeclarationInput, learnerEnrolmentInput, learnerOutcomeInput } from "@/lib/server/levytate-operational-input";

describe("connected learner input contracts", () => {
  it("requires an explicit true employee declaration and bounded numeric eligibility", () => {
    const value = { idempotencyKey: "synthetic-declaration", expectedUpdatedAt: "2026-10-29T00:00:00Z", confirmed: true, expectedEnglandWorkingHoursPercentage: 60 };
    expect(parseAction(employeeDeclarationInput, value)).toEqual(value);
    for (const change of [{ confirmed: "true" }, { expectedEnglandWorkingHoursPercentage: 49 }, { expectedEnglandWorkingHoursPercentage: 101 }, { verifiedBy: "forged" }]) expect(() => parseAction(employeeDeclarationInput, { ...value, ...change })).toThrow();
  });
  it("rejects forged nested evidence, fractional outside-range progress and impossible dates", () => {
    const value = { idempotencyKey: "synthetic-enrolment", expectedActivityVersion: "test-version", firstReviewDate: "2026-11-01", firstReviewerName: "Test reviewer", initialProgress: { updateDate: "2026-10-29", targetProgressPercentage: 0, actualProgressPercentage: 0, summary: "Explicit fictional initial evidence" } };
    expect(parseAction(learnerEnrolmentInput, value)).toEqual(value);
    for (const change of [{ actorEmail: "forged" }, { actualProgressPercentage: 101 }, { actualProgressPercentage: "0" }, { updateDate: "2026-02-30" }]) expect(() => parseAction(learnerEnrolmentInput, { ...value, initialProgress: { ...value.initialProgress, ...change } })).toThrow();
  });
  it("never interprets a string as confirmed notification or certificate evidence", () => {
    const value = { outcome: "withdrawal", idempotencyKey: "synthetic-outcome", expectedActivityVersion: "version", effectiveDate: "2026-10-29", notes: "Fictional withdrawal evidence", providerNotified: false };
    expect(parseAction(learnerOutcomeInput, value)).toEqual(value);
    expect(() => parseAction(learnerOutcomeInput, { ...value, providerNotified: "true" })).toThrow();
    expect(() => parseAction(learnerOutcomeInput, { ...value, certificateReceived: "false" })).toThrow();
  });
});

describe("operational action schemas", () => {
  it("accepts the current UI shapes and preserves decision text", () => {
    expect(parseAction(operationalActionInput, { command: "complete", expectedVersion: 2, completionNote: "Fictional completion", resolvedOutsideLevyTate: false })).toMatchObject({ completionNote: "Fictional completion" });
    expect(parseAction(managerStartInput, { expectedVersion: 0, note: "Fictional manager note" })).toMatchObject({ expectedVersion: 0 });
    expect(parseAction(autopilotActionInput, { action: "refresh" })).toEqual({ action: "refresh" });
    expect(parseAction(intelligenceActionInput, { action: "dismiss", signalId: "signal-1", reason: "Already resolved" })).toMatchObject({ signalId: "signal-1" });
  });
  it.each([
    { command: "complete", expectedVersion: 1, actorUserId: "another-user" },
    { command: "complete", expectedVersion: 1, organisationId: "another-tenant" },
    { command: "assign", expectedVersion: 1, ownerType: "Platform Admin" },
    { command: "acknowledge", expectedVersion: -1 },
    { command: "start", expectedVersion: 0.5 },
    { command: "cancel", expectedVersion: 0, cancellationReason: "test", cancellationKind: "arbitrary" },
    { command: "complete", expectedVersion: 0, completionNote: "x".repeat(4001) },
    { command: "complete", expectedVersion: 0, resolvedOutsideLevyTate: "true" },
  ])("rejects forged or invalid operational input %j", (body) => { expect(() => parseAction(operationalActionInput, body)).toThrow(); });
  it("rejects unsupported fields on every smaller action contract", () => {
    expect(() => parseAction(managerAcknowledgeInput, { expectedVersion: 0, note: "not supported" })).toThrow();
    expect(() => parseAction(intelligenceActionInput, { action: "analyse", signalId: "not supported" })).toThrow();
    expect(() => parseAction(autopilotActionInput, { action: "refresh", organisationId: "another-tenant" })).toThrow();
    expect(() => parseAction(prospectActionInput, { operation: "complete_guidance", accessId: "another-tenant" })).toThrow();
    expect(() => parseAction(guidanceItemPatch, { id: "item", patch: { copilotApproved: "yes" } })).toThrow();
    expect(() => parseAction(guidanceSourcePatch, { id: "source", patch: { sourceUrl: "https://attacker.invalid" } })).toThrow();
  });
});
