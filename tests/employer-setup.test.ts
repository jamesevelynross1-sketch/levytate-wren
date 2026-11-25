import { describe, expect, it } from "vitest";
import { buildEmployerSetupSteps, employerSetupComplete, financeSetupStatus, isEmployerSetupRole } from "@/lib/levytate/mvp/employer-setup";

const active = { status: "Active" };
const empty = { employees: [], organisationProviders: [], organisationProgrammes: [], learnerRecords: [] };
const completed = { employees: [active], organisationProviders: [active], organisationProgrammes: [active], learnerRecords: [{}] };

describe("employer setup continuity", () => {
  it("starts at 0/5 and survives the first saved employee", () => {
    const first = buildEmployerSetupSteps(empty, "pending");
    expect(first.filter(step => step.complete)).toHaveLength(0);
    const second = buildEmployerSetupSteps({ ...empty, employees: [active] }, "pending");
    expect(second.map(step => step.complete)).toEqual([true, false, false, false, false]);
    expect(employerSetupComplete(second)).toBe(false);
    expect(second.find(step => !step.complete)?.target).toBe("Marketplace");
  });
  it("recognises each independent persisted milestone and only finishes after five", () => {
    const provider = { ...empty, employees: [active], organisationProviders: [active] };
    expect(buildEmployerSetupSteps(provider, "pending").filter(step => step.complete)).toHaveLength(2);
    const programme = { ...provider, organisationProgrammes: [active] };
    expect(buildEmployerSetupSteps(programme, "pending").filter(step => step.complete)).toHaveLength(3);
    expect(buildEmployerSetupSteps(completed, "pending").filter(step => step.complete)).toHaveLength(4);
    expect(employerSetupComplete(buildEmployerSetupSteps(completed, "complete"))).toBe(true);
  });
  it("does not count archived people or inactive catalogue selections", () => {
    const inactive = { status: "Archived" };
    expect(buildEmployerSetupSteps({ ...empty, employees: [inactive], organisationProviders: [inactive], organisationProgrammes: [inactive] }, "pending").filter(step => step.complete)).toHaveLength(0);
  });
  it("keeps learner and finance steps explicitly optional and does not count a failed or pending finance read", () => {
    for (const status of ["checking", "unavailable", "pending"] as const) {
      const steps = buildEmployerSetupSteps(completed, status);
      expect(steps[3].optional).toBe(true);
      expect(steps[4].optional).toBe(true);
      expect(steps[4].complete).toBe(false);
      expect(employerSetupComplete(steps)).toBe(false);
    }
  });
  it("requires actual persisted DAS import and transaction evidence", () => {
    expect(financeSetupStatus({ mode: "persistent", imports: [], transactions: [] })).toBe("pending");
    expect(financeSetupStatus({ mode: "persistent", imports: [{}], transactions: [] })).toBe("pending");
    expect(financeSetupStatus({ mode: "fixture", imports: [{}], transactions: [{}] })).toBe("unavailable");
    expect(financeSetupStatus({ mode: "persistent", imports: [{}], transactions: [{}] })).toBe("complete");
  });
  it("scopes the checklist to employer owners, not other roles", () => {
    expect(isEmployerSetupRole("Apprenticeship Lead")).toBe(true);
    expect(isEmployerSetupRole("Employer Admin")).toBe(true);
    for (const role of ["Employee", "Line Manager", "Department Head", "Platform Admin", undefined]) expect(isEmployerSetupRole(role)).toBe(false);
  });
});
