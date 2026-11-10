import { describe, expect, it } from "vitest";
import { normalisePeopleRecord, validatePeopleChanges } from "../lib/levytate/mvp/people-validation";
import { parsePeopleCsv, preparePeopleImport } from "../lib/levytate/mvp/people-import";
import type { MvpEmployee } from "../lib/levytate/mvp/workspace";

const now = "2026-10-29T15:00:00.000Z";
const person = (patch: Partial<MvpEmployee> = {}): MvpEmployee => ({ id: "employee-a", employeeNumber: "EMP-A", name: "Fictional Person", email: "person@example.test", jobTitle: "Analyst", roleId: "", managerId: "", department: "Data", site: "North", platformRole: "Employee", status: "Active", startDate: "2026-10-29", createdAt: now, updatedAt: now, ...patch });
const csv = (row: string, extra = "") => `name,work email,job title,department${extra}\n${row}`;

describe("People runtime schema and references", () => {
  it("normalises email and keeps supported fields only", () => {
    expect(normalisePeopleRecord(person({ email: " PERSON@EXAMPLE.TEST ", managerName: "display only" }))).toEqual(person());
  });
  it.each([
    { email: "not-email" }, { name: "" }, { jobTitle: "" }, { department: "" }, { employeeNumber: "" },
    { status: "Maybe" }, { platformRole: "Platform Admin" }, { roleId: "role/unsafe" }, { managerId: "cross tenant?" },
    { startDate: "2026-02-30" }, { createdAt: "yesterday" }, { name: "bad\nname" }, { organisation_id: "another-tenant" },
  ])("rejects malformed record %j", (patch) => {
    expect(() => normalisePeopleRecord({ ...person(), ...patch })).toThrow();
  });
  it("denies duplicate normalized email and employee number", () => {
    expect(() => validatePeopleChanges([person({ id: "other", employeeNumber: "EMP-B" })], [person()], [])).toThrow(/email/);
    expect(() => validatePeopleChanges([person({ id: "other", email: "other@example.test", employeeNumber: "emp-a" })], [person()], [])).toThrow(/number/);
  });
  it("allows unassigned role but refuses missing/archived/cross-tenant references", () => {
    expect(() => validatePeopleChanges([person()], [], [])).not.toThrow();
    expect(() => validatePeopleChanges([person({ roleId: "other-tenant-role" })], [], [])).toThrow(/active role/);
    expect(() => validatePeopleChanges([person({ managerId: "other-tenant-person" })], [], [])).toThrow(/Line Manager/);
    expect(() => validatePeopleChanges([person({ roleId: "old" })], [], [{ id: "old", status: "Archived" }])).toThrow(/active role/);
  });
  it("allows manager later in the batch and rejects role impersonation/self/cycles", () => {
    const manager = person({ id: "manager", employeeNumber: "EMP-M", email: "manager@example.test", platformRole: "Line Manager" });
    expect(() => validatePeopleChanges([person({ managerId: manager.id }), manager], [], [])).not.toThrow();
    expect(() => validatePeopleChanges([person({ managerId: manager.id }), { ...manager, platformRole: "Employee" }], [], [])).toThrow(/Line Manager/);
    expect(() => validatePeopleChanges([person({ managerId: "employee-a" })], [], [])).toThrow(/themselves/);
    expect(() => validatePeopleChanges([person({ platformRole: "Line Manager", managerId: manager.id }), { ...manager, managerId: "employee-a" }], [], [])).toThrow(/cycle/);
  });
  it("refuses archiving/demoting managers with active reports", () => {
    const manager = person({ id: "manager", employeeNumber: "EMP-M", email: "manager@example.test", platformRole: "Line Manager" });
    const existing = [person({ managerId: manager.id }), manager];
    expect(() => validatePeopleChanges([{ ...manager, status: "Archived" }], existing, [])).toThrow(/Line Manager/);
    expect(() => validatePeopleChanges([{ ...manager, platformRole: "Employee" }], existing, [])).toThrow(/Line Manager/);
  });
});

describe("CSV preparation is all-or-nothing", () => {
  it("handles quoted commas, BOM and CRLF", () => {
    const result = parsePeopleCsv(`\uFEFFname,work email,job title,department\r\n"Fictional, Person",person@example.test,Analyst,Data\r\n`);
    expect(result.issues).toEqual([]); expect(result.rows[0].name).toBe("Fictional, Person");
  });
  it.each([
    csv('"unclosed,person@example.test,Analyst,Data'),
    "name,email,work email,job title,department\nPerson,one@example.test,two@example.test,Analyst,Data",
    csv('Per"son,person@example.test,Analyst,Data'),
    csv('"Person"x,person@example.test,Analyst,Data'),
    csv("Person,person@example.test,Analyst,Data,Unknown", ",status"),
    csv("Person,person@example.test,Analyst,Data,Platform Admin", ",platform role"),
    csv("Person,person@example.test,Analyst,Data,extra"),
    csv("Person,person@example.test,Analyst,Data,person@example.test", ",manager email"),
  ])("blocks malformed file %s", (input) => {
    const result = parsePeopleCsv(input); expect(result.issues.length).toBeGreaterThan(0);
    expect(() => preparePeopleImport(result, [], [], () => "new-id", now)).toThrow();
  });
  it("does not silently skip a duplicate existing email", () => {
    const result = parsePeopleCsv(csv("Person,person@example.test,Analyst,Data"));
    expect(() => preparePeopleImport(result, [person()], [], () => "new-id", now)).toThrow(/already exists/);
  });
  it("fails unknown manager rather than losing the reporting link", () => {
    const result = parsePeopleCsv(csv("Person,person@example.test,Analyst,Data,missing@example.test", ",manager email"));
    expect(() => preparePeopleImport(result, [], [], () => "new-id", now)).toThrow(/manager email/);
  });
  it("builds stable batch IDs and validates manager regardless of row order", () => {
    const result = parsePeopleCsv(csv("Person,person@example.test,Analyst,Data,manager@example.test,Employee\nManager,manager@example.test,Lead,Data,,Line Manager", ",manager email,platform role"));
    let id = 0; const batch = preparePeopleImport(result, [], [], () => `id-${++id}`, now);
    expect(batch[0].managerId).toBe(batch[1].id); expect(batch[0].createdAt).toBe(now);
  });
});
