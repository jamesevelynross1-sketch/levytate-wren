import { describe, expect, it } from "vitest";
import { confirmExistingCoreLearner } from "../scripts/release-existing-core-learner.mjs";

function fixture() {
  const id = "learner-149592ee-109c-4441-befc-5056b5d25a9b";
  const employee = { key: "employee", membershipId: "membership-a", personId: "a-employee" };
  const tenant = { id: "tenant-a", key: "a", users: [employee] };
  const reference = "browser-fictional-run";
  return { id, employee, tenant, manifest: { synthetic: true, environment: "local", run: "fictional-run", tenants: [tenant] },
    learners: [{ id, organisation_id: tenant.id, employee_id: employee.personId, application_id: reference, record_status: "Active", lifecycle_status: "enrolled" }],
    applications: [{ id: reference, organisation_id: tenant.id, employee_id: employee.personId, status: "Completed" }],
    enrolments: [{ organisation_id: tenant.id, application_id: reference, employee_id: employee.personId, status: "Live learner" }] };
}
describe("read-only exact existing core continuation", () => {
  it("accepts the same current-run live handoff without mutating its inputs", () => {
    const input = fixture(), original = structuredClone(input);
    expect(confirmExistingCoreLearner(input)).toBe(input.id);
    expect(input).toEqual(original);
  });
  for (const field of ["organisation_id", "employee_id", "application_id"] as const) it(`denies another learner ${field}`, () => {
    const input = fixture(); input.learners[0][field] = "foreign";
    expect(() => confirmExistingCoreLearner(input)).toThrow();
  });
  it("denies a withdrawn learner", () => { const input = fixture(); input.learners[0].lifecycle_status = "withdrawn"; expect(() => confirmExistingCoreLearner(input)).toThrow(); });
  it("denies an archived record", () => { const input = fixture(); input.learners[0].record_status = "Archived"; expect(() => confirmExistingCoreLearner(input)).toThrow(); });
  it("denies an unfinished handoff", () => { const input = fixture(); input.applications[0].status = "Approved for Enrolment"; expect(() => confirmExistingCoreLearner(input)).toThrow(); });
  it("denies a duplicate live enrolment", () => { const input = fixture(); input.enrolments.push({ ...input.enrolments[0] }); expect(() => confirmExistingCoreLearner(input)).toThrow(); });
  it("denies another fixture run", () => { const input = fixture(); input.manifest.run = "another-run"; expect(() => confirmExistingCoreLearner(input)).toThrow(); });
  it("denies a foreign membership", () => { const input = fixture(); input.employee = { ...input.employee, membershipId: "another-user" }; expect(() => confirmExistingCoreLearner(input)).toThrow(); });
});
