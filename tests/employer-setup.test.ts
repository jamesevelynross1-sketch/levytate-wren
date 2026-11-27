import { describe, expect, it } from "vitest";
import { buildEmployerSetupSteps, employerSetupComplete, financeSetupStatus, isEmployerSetupRole } from "@/lib/levytate/mvp/employer-setup";

const profile = { employerName: "", primaryContact: "", contactEmail: "hello@levytate.co.uk", sites: [], departments: [], priorities: [] };
const readyProfile = { employerName: "Fictional Engineering Ltd", primaryContact: "Fictional Admin", contactEmail: "admin@example.test", sites: ["North site"], departments: ["Operations"], priorities: [{ name: "Digital skills" }] };
const empty = { profile, employees: [], organisationProviders: [], organisationProgrammes: [], learnerRecords: [] };
const manager = { id: "manager-1", platformRole: "Line Manager", status: "Active" };
const employee = { id: "employee-1", platformRole: "Employee", managerId: "manager-1", status: "Active" };
const provider = { providerId: "provider-1", status: "Active" };
const programme = { programmeId: "programme-1", providerId: "provider-1", status: "Active" };

describe("resumable employer setup", () => {
  it("starts at zero essentials without relying on a checked UI flag", () => {
    const steps = buildEmployerSetupSteps(empty, "pending");
    expect(steps.filter(step => !step.optional)).toHaveLength(6);
    expect(steps.filter(step => step.complete)).toHaveLength(0);
    expect(employerSetupComplete(steps)).toBe(false);
    expect(steps[0].key).toBe("organisation");
  });

  it("requires organisation evidence and treats the default LevyTate contact as a placeholder", () => {
    const initial = buildEmployerSetupSteps({ ...empty, profile: { ...readyProfile, contactEmail: "hello@levytate.co.uk" } }, "pending");
    expect(initial[0].complete).toBe(false);
    const steps = buildEmployerSetupSteps({ ...empty, profile: readyProfile }, "pending");
    expect(steps.slice(0, 2).map(step => step.complete)).toEqual([true, true]);
    expect(steps[2].complete).toBe(false);
  });

  it("supports multiple employee saves without treating a manager as a complete team", () => {
    const partly = { ...empty, profile: readyProfile, employees: [manager] };
    expect(buildEmployerSetupSteps(partly, "pending").slice(2, 4).map(step => step.complete)).toEqual([true, false]);
    const assigned = { ...partly, employees: [manager, employee] };
    expect(buildEmployerSetupSteps(assigned, "pending").slice(2, 4).map(step => step.complete)).toEqual([true, true]);
    const archived = { ...partly, employees: [{ ...manager, status: "Archived" }, employee] };
    expect(buildEmployerSetupSteps(archived, "pending")[3].complete).toBe(false);
    const unassigned = { ...partly, employees: [manager, { ...employee, managerId: "" }] };
    expect(buildEmployerSetupSteps(unassigned, "pending")[3].complete).toBe(false);
  });

  it("requires programme selections to belong to an active selected provider", () => {
    const orphan = { ...empty, profile: readyProfile, employees: [manager, employee], organisationProgrammes: [programme] };
    expect(buildEmployerSetupSteps(orphan, "pending").slice(4, 6).map(step => step.complete)).toEqual([false, false]);
    const completed = { ...orphan, organisationProviders: [provider] };
    expect(buildEmployerSetupSteps(completed, "pending").slice(4, 6).map(step => step.complete)).toEqual([true, true]);
    expect(employerSetupComplete(buildEmployerSetupSteps(completed, "pending"))).toBe(true);
    expect(employerSetupComplete(buildEmployerSetupSteps(completed, "unavailable"))).toBe(true);
    expect(buildEmployerSetupSteps(completed, "pending").filter(step => step.optional).map(step => step.complete)).toEqual([false, false]);
  });

  it("keeps learner and DAS imports optional but strictly evidence-based", () => {
    const complete = { ...empty, profile: readyProfile, employees: [manager, employee], organisationProviders: [provider], organisationProgrammes: [programme], learnerRecords: [{}] };
    const steps = buildEmployerSetupSteps(complete, "complete");
    expect(steps.map(step => step.complete)).toEqual([true, true, true, true, true, true, true, true]);
    expect(employerSetupComplete(steps)).toBe(true);
    expect(financeSetupStatus({ mode: "persistent", imports: [{}], transactions: [] })).toBe("pending");
    expect(financeSetupStatus({ mode: "fixture", imports: [{}], transactions: [{}] })).toBe("unavailable");
    expect(financeSetupStatus({ mode: "persistent", imports: [{}], transactions: [{}] })).toBe("complete");
  });

  it("scopes guidance to employer leads and admins", () => {
    expect(isEmployerSetupRole("Apprenticeship Lead")).toBe(true);
    expect(isEmployerSetupRole("Employer Admin")).toBe(true);
    for (const role of ["Employee", "Line Manager", "Department Head", "Platform Admin", undefined]) expect(isEmployerSetupRole(role)).toBe(false);
  });
});
