import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { decodeLearningTimeReadResponse, decodeLiftReadResponse } from "@/lib/levytate/client-module-reads";
import type { LearningTimeWorkspace } from "@/lib/levytate/off-the-job/api";
import { buildLiftFixtureWorkspace } from "@/lib/server/levytate-lift-fixtures";
import { LiftModule } from "@/components/levytate-mvp/LiftModule";

const roles = ["Employee", "Line Manager", "Apprenticeship Lead", "Employer Admin"] as const;
function learning(role: string = "Employee"): LearningTimeWorkspace {
  return { generatedAt: "2026-11-09T19:00:00Z", role, capabilityEnabled: true, canManagePlans: role === "Apprenticeship Lead" || role === "Employer Admin", canReviewActivities: role === "Apprenticeship Lead" || role === "Employer Admin", canCreateActivities: role === "Employee", learners: [], portfolio: { activeLearnerPlans: 0, providerConfirmedMinutes: 0, candidateMinutesAwaitingCheck: 0, activitiesAwaitingProviderConfirmation: 0, plansNeedingSetup: 0, operationalAttention: 0 }, regulatoryNotice: "Fictional test evidence" };
}
function populatedLearning() {
  const value = learning();
  value.learners.push({ learnerRecordId: "learner", employeeId: "own", learnerName: "Fictional learner", jobTitle: "Synthetic role", department: "Test", site: "Test", programmeId: "programme", programmeName: "Fictional programme", standardId: "ST0118", providerId: "provider", providerName: "Fictional provider", lifecycleStatus: "enrolled", activeBreak: false, plan: null, priorities: [{ id: "priority", learnerRecordId: "learner", label: "Synthetic priority", description: "Fictional task", ksbReferences: [], sourceType: "provider_training_plan", sourceReference: "synthetic", targetDate: null, status: "active" }], activities: [], totals: { learnerRecordedMinutes: 0, employerCheckedMinutes: 0, providerConfirmedMinutes: 0, remainingMinutes: 0 }, attention: [], lastActivityDate: null });
  return value;
}
const lifted = (role: typeof roles[number] = "Employee") => ({ ok: true, workspace: { ...buildLiftFixtureWorkspace(role), mutationRevision: 0 } });

describe("Learning Time read confirmation before React state publication", () => {
  it.each(roles)("preserves the current %s API role without substituting fixtures for empty live data", role => {
    const value = learning(role); expect(decodeLearningTimeReadResponse(value)).toBe(value); expect(value.learners).toEqual([]);
  });
  it("preserves actual populated learner views and explicitly absent plans", () => {
    const value = populatedLearning(); expect(decodeLearningTimeReadResponse(value)).toBe(value); expect(value.learners[0].plan).toBeNull();
  });
  it.each([null, {}, { message: "private upstream diagnostic" }, { learners: null }, { learners: [] }, { ...learning(), learners: {} }, { ...learning(), portfolio: null }, { ...learning(), capabilityEnabled: false }, { ...learning(), role: "Platform Admin" }, { ...learning(), canCreateActivities: "true" }])("rejects malformed HTTP200 JSON before it can reach learners.find or numeric rendering", value => {
    expect(() => decodeLearningTimeReadResponse(value)).toThrow(/incomplete response/);
  });
  it.each(["priorities", "activities", "attention", "totals", "lifecycleStatus"])("rejects invalid nested %s", field => {
    const value = populatedLearning(); Object.assign(value.learners[0], { [field]: null }); expect(() => decodeLearningTimeReadResponse(value)).toThrow();
  });
  it("rejects malformed priority collections and non-finite totals", () => {
    const value = populatedLearning(); Object.assign(value.learners[0].priorities[0], { ksbReferences: {} }); expect(() => decodeLearningTimeReadResponse(value)).toThrow();
    const invalidTotal = learning(); invalidTotal.portfolio.providerConfirmedMinutes = Number.NaN; expect(() => decodeLearningTimeReadResponse(invalidTotal)).toThrow();
  });
});

describe("Lift live read confirmation", () => {
  it.each(roles)("accepts the existing %s render contract with an explicit live revision", role => {
    // These are labelled unit fixtures only, never a substitute for a live read.
    const value = lifted(role), workspace = decodeLiftReadResponse(value);
    expect(workspace).toBe(value.workspace);
    expect(() => renderToStaticMarkup(createElement(LiftModule, { initialWorkspace: workspace }))).not.toThrow();
  });
  it.each([null, {}, { ok: true }, { ok: true, workspace: {} }, { ok: true, workspace: { ...lifted().workspace, framework: {} } }, { ok: true, workspace: { ...lifted().workspace, coverage: {} } }, { ok: true, workspace: { ...lifted().workspace, role: "Department Head" } }, { ...lifted(), ok: false }])("rejects a malformed200 without accepting a partial workspace", value => {
    expect(() => decodeLiftReadResponse(value)).toThrow(/incomplete response/);
  });
  it("requires a live revision and nonempty questionnaire while preserving unavailable optional records", () => {
    const value = lifted(); delete (value.workspace as { mutationRevision?: number }).mutationRevision; expect(() => decodeLiftReadResponse(value)).toThrow();
    const blank = lifted(); blank.workspace.framework.questions = []; expect(() => decodeLiftReadResponse(blank)).toThrow();
    const noAssessment = lifted(); noAssessment.workspace.assessment = null; expect(decodeLiftReadResponse(noAssessment).assessment).toBeNull();
  });
  it("rejects malformed question options and finding arrays", () => {
    const value = lifted(); Object.assign(value.workspace.framework.questions[0], { options: {} }); expect(() => decodeLiftReadResponse(value)).toThrow();
    const badFindings = lifted(); Object.assign(badFindings.workspace.assessment!, { findings: {} }); expect(() => decodeLiftReadResponse(badFindings)).toThrow();
  });
  it("does not render an out-of-range current question or non-array opportunities", () => {
    const value = lifted(); value.workspace.assessment!.currentQuestionIndex = value.workspace.framework.questions.length; expect(() => decodeLiftReadResponse(value)).toThrow();
    expect(() => decodeLiftReadResponse({ ...lifted(), workspace: { ...lifted().workspace, opportunities: {} } })).toThrow();
  });
});
