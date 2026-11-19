import { describe, expect, it } from "vitest";
import { getCoreEarlyAccessPolicy, resolveCoreEarlyAccessRouteAccess, type CoreEarlyAccessModuleKey } from "@/lib/levytate/core-early-access-policy";
import { getLevyTateProductSection, levyTateModuleSections } from "@/lib/levytate/product-packaging";
import { getRelease2Navigation } from "@/lib/levytate/release-2-navigation";
import type { MvpUserRole } from "@/lib/levytate/mvp/rbac";

const roles: readonly MvpUserRole[] = ["Employee", "Line Manager", "Apprenticeship Lead", "Employer Admin", "Platform Admin"];

describe("Core and add-on packaging", () => {
  it("classifies every module in the existing early-access policy", () => {
    const policyModules = roles.flatMap((role) => getCoreEarlyAccessPolicy(role).modules.map((module) => module.moduleKey));
    expect(Object.keys(levyTateModuleSections).sort()).toEqual([...new Set(policyModules)].sort());
    for (const moduleKey of policyModules) {
      expect(["core", "add-on", "support"]).toContain(getLevyTateProductSection(moduleKey));
    }
  });

  it.each(roles)("retains every accessible module exactly once for %s", (role) => {
    const policy = getCoreEarlyAccessPolicy(role, {
      requestsEnabled: true,
      offTheJobAssistantEnabled: true,
      pastoralSupportEnabled: true,
      pastoralInboxEnabled: true,
    });
    const available = policy.modules
      .filter((module) => module.availability === "enabled" || module.availability === "secondary")
      .map((module) => module.moduleKey);
    const navigation = getRelease2Navigation(role, available);
    const navigable = navigation.flatMap((area) => area.modules);
    expect(navigable.slice().sort()).toEqual(available.slice().sort());
    expect(new Set(navigable).size).toBe(navigable.length);

    for (const area of navigation) {
      for (const moduleKey of area.modules) {
        const expected = role === "Platform Admin" && moduleKey === "Settings"
          ? "core"
          : getLevyTateProductSection(moduleKey);
        expect(area.section).toBe(expected);
      }
    }
  });

  it("keeps optional features available to existing beta users, including direct links", () => {
    const policy = getCoreEarlyAccessPolicy("Apprenticeship Lead");
    for (const moduleKey of ["Assessments", "Intelligence", "Workforce Development", "Copilot"] as CoreEarlyAccessModuleKey[]) {
      expect(getLevyTateProductSection(moduleKey)).toBe("add-on");
      expect(resolveCoreEarlyAccessRouteAccess("Apprenticeship Lead", moduleKey, policy).permitted).toBe(true);
      expect(getRelease2Navigation("Apprenticeship Lead", [moduleKey])[0]?.section).toBe("add-on");
    }
  });

  it("does not surface deferred reporting or role-denied modules", () => {
    const employee = getCoreEarlyAccessPolicy("Employee");
    const visible = employee.modules.filter((module) => module.availability === "enabled" || module.availability === "secondary").map((module) => module.moduleKey);
    const navigable = getRelease2Navigation("Employee", visible).flatMap((area) => area.modules);
    expect(navigable).not.toContain("Reports");
    expect(navigable).not.toContain("Finance");
    expect(navigable).not.toContain("My Providers");
  });
});
