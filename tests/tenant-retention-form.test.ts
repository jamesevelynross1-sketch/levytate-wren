import { describe, expect, it } from "vitest";
import { buildTenantRetentionPolicy, emptyTenantRetentionForm, tenantLocalTimeToInstant, tenantRetentionClasses } from "@/lib/levytate/mvp/tenant-retention-form";
import { parseTenantRetentionPolicy, tenantDataClasses } from "@/lib/server/levytate-tenant-data-policy";

const owners = [{ id: "ad000000-0000-4000-8000-000000000001", label: "Fictional data owner" }, { id: "ad000000-0000-4000-8000-000000000002", label: "Fictional service owner" }];
function completedForm() {
  const form = emptyTenantRetentionForm();
  Object.assign(form, { dataOwnerUserId: owners[0].id, serviceOwnerUserId: owners[1].id, approvalReference: "Approved policy ref", clientNoticeReference: "Approved notice ref", supportHandoverReference: "Approved handover ref", recoveryBoundaryReference: "Approved recovery ref", evidenceRetainUntilLocal: "2027-11-09T14:00" });
  for (const { key } of tenantRetentionClasses) form.schedules[key] = { action: "delete", retainUntilLocal: "2026-11-09T14:00", approvalReference: `Approved ${key} schedule` };
  return form;
}
describe("structured tenant retention decisions", () => {
  it("never invents a retention date, deletion decision, owner or approval", () => {
    const form = emptyTenantRetentionForm();
    expect(form.dataOwnerUserId).toBe(""); expect(form.evidenceRetainUntilLocal).toBe("");
    expect(Object.values(form.schedules).every((row) => Object.values(row).every((value) => value === ""))).toBe(true);
    expect(() => buildTenantRetentionPolicy(form, owners)).toThrow();
  });
  it("matches the complete server taxonomy and produces the real strict policy contract", () => {
    expect(tenantRetentionClasses.map((row) => row.key)).toEqual([...tenantDataClasses]);
    const value = buildTenantRetentionPolicy(completedForm(), owners);
    expect(parseTenantRetentionPolicy(value)).toEqual(value); expect(value.schedules).toHaveLength(11);
  });
  it.each(tenantRetentionClasses)("requires an explicit action and real calendar time for $label", ({ key }) => {
    const form = completedForm(); form.schedules[key].action = "";
    expect(() => buildTenantRetentionPolicy(form, owners)).toThrow("approved retention action");
    form.schedules[key].action = "retain"; form.schedules[key].retainUntilLocal = "2026-02-30T12:00";
    expect(() => buildTenantRetentionPolicy(form, owners)).toThrow("valid local date");
  });
  it("preserves retained classes rather than silently converting them to disposal", () => {
    const form = completedForm(); form.schedules.finance.action = "retain";
    expect(buildTenantRetentionPolicy(form, owners).schedules.find((row) => row.dataClass === "finance")?.action).toBe("retain");
  });
  it("refuses missing/revoked owners and incomplete evidence references", () => {
    expect(() => buildTenantRetentionPolicy(completedForm(), owners.slice(1))).toThrow("current authorised");
    const form = completedForm(); form.clientNoticeReference = "   ";
    expect(() => buildTenantRetentionPolicy(form, owners)).toThrow("client notice");
  });
  it("converts a local time to an explicit instant without changing the chosen components", () => {
    const value = new Date(tenantLocalTimeToInstant("2026-07-09T09:30")!);
    expect([value.getFullYear(), value.getMonth() + 1, value.getDate(), value.getHours(), value.getMinutes()]).toEqual([2026, 7, 9, 9, 30]);
    for (const invalid of ["", "2026-13-09T12:00", "2026-11-09T25:00", "2026-11-09", "2026-11-09T12:00Z"]) expect(tenantLocalTimeToInstant(invalid)).toBeNull();
  });
});
