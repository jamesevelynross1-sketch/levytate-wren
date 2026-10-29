import { describe, expect, it } from "vitest";
import { canRunMvpMutation, normaliseMvpUserRole, permissionsForMvpRole } from "@/lib/levytate/mvp/rbac";

// Independent release regressions: these assert the security contract, not
// implementation strings. They are domain tests, not hosted authentication.
describe("release: unsupported role values fail closed", () => {
  for (const role of ["Department Head", "employee", "", "Administrator", "Unknown", null, undefined]) {
    it(`rejects ${JSON.stringify(role)} instead of granting Employee permissions`, () => {
      expect(permissionsForMvpRole(role)).toEqual([]);
      expect(() => normaliseMvpUserRole(role)).toThrow();
    });
  }

  it("retains all five supported roles without broadening client permissions", () => {
    for (const role of ["Employee", "Line Manager", "Apprenticeship Lead", "Employer Admin", "Platform Admin"] as const) {
      expect(normaliseMvpUserRole(role)).toBe(role);
    }
    expect(canRunMvpMutation("Employee", "updateApplicationStatus")).toBe(false);
    expect(canRunMvpMutation("Employee", "saveProvider")).toBe(false);
    expect(canRunMvpMutation("Line Manager", "saveEmployee")).toBe(false);
  });
});
