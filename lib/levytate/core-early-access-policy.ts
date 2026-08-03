import type { MvpUserRole } from "@/lib/levytate/mvp/rbac";

export type CoreEarlyAccessModuleKey =
  | "Home"
  | "My Programme"
  | "My Application"
  | "My Team"
  | "Approvals"
  | "Applications"
  | "People"
  | "Learners"
  | "Providers"
  | "Programmes"
  | "Copilot"
  | "Knowledge"
  | "Reports"
  | "Settings"
  | "Support";

export type CoreEarlyAccessAvailability = "enabled" | "secondary" | "hidden" | "deferred";
export type CoreEarlyAccessNavigationGroup = "primary" | "administration" | "help" | "secondary";

export type CoreEarlyAccessCapability =
  | "employee-own-journey"
  | "manager-direct-report-operations"
  | "employer-organisation-operations"
  | "employer-operational-reporting"
  | "platform-workspace-administration"
  | "platform-provider-catalogue"
  | "platform-access-support"
  | "platform-guidance-administration"
  | "platform-audit-context"
  | "provider-matching"
  | "copilot-write-actions"
  | "public-self-service-registration";

export type CoreEarlyAccessModuleStatus = {
  moduleKey: CoreEarlyAccessModuleKey;
  label: string;
  availability: CoreEarlyAccessAvailability;
  group?: CoreEarlyAccessNavigationGroup;
  route: string;
  reasonCode: "core" | "supporting" | "not-ready" | "non-core" | "role-denied";
};

export type CoreEarlyAccessRolePolicy = {
  role: MvpUserRole;
  modules: readonly CoreEarlyAccessModuleStatus[];
  permittedCapabilities: readonly CoreEarlyAccessCapability[];
  deniedCapabilities: readonly CoreEarlyAccessCapability[];
};

const route = (moduleKey: CoreEarlyAccessModuleKey) =>
  moduleKey === "Home" ? "/levytate/app" : `/levytate/app?module=${encodeURIComponent(moduleKey)}`;

const item = (
  moduleKey: CoreEarlyAccessModuleKey,
  label: string,
  availability: CoreEarlyAccessAvailability,
  group: CoreEarlyAccessNavigationGroup | undefined,
  reasonCode: CoreEarlyAccessModuleStatus["reasonCode"],
): CoreEarlyAccessModuleStatus => ({ moduleKey, label, availability, group, route: route(moduleKey), reasonCode });

const commonDeferred = [
  "provider-matching",
  "copilot-write-actions",
  "public-self-service-registration",
] as const satisfies readonly CoreEarlyAccessCapability[];

export const coreEarlyAccessPolicy: Readonly<Record<MvpUserRole, CoreEarlyAccessRolePolicy>> = {
  Employee: {
    role: "Employee",
    modules: [
      item("Home", "Home", "enabled", "primary", "core"),
      item("My Application", "My Application", "enabled", "primary", "core"),
      item("My Programme", "My Apprenticeship", "enabled", "primary", "core"),
      item("Copilot", "Copilot", "secondary", "help", "supporting"),
      item("Knowledge", "Guidance Centre", "secondary", "help", "supporting"),
      item("Providers", "Programmes & Providers", "hidden", undefined, "non-core"),
      item("Programmes", "Programmes", "hidden", undefined, "non-core"),
      item("Reports", "Reports", "deferred", undefined, "not-ready"),
    ],
    permittedCapabilities: ["employee-own-journey"],
    deniedCapabilities: ["manager-direct-report-operations", "employer-organisation-operations", "employer-operational-reporting", "platform-workspace-administration", "platform-provider-catalogue", "platform-access-support", "platform-guidance-administration", "platform-audit-context", ...commonDeferred],
  },
  "Line Manager": {
    role: "Line Manager",
    modules: [
      item("Home", "Home", "enabled", "primary", "core"),
      item("Approvals", "Approvals", "enabled", "primary", "core"),
      item("My Team", "My Team", "enabled", "primary", "core"),
      item("Copilot", "Copilot", "secondary", "help", "supporting"),
      item("Knowledge", "Guidance Centre", "secondary", "help", "supporting"),
      item("Providers", "Programmes & Providers", "hidden", undefined, "non-core"),
      item("Programmes", "Programmes", "hidden", undefined, "non-core"),
      item("Reports", "Team Reporting", "deferred", undefined, "not-ready"),
    ],
    permittedCapabilities: ["manager-direct-report-operations"],
    deniedCapabilities: ["employee-own-journey", "employer-organisation-operations", "employer-operational-reporting", "platform-workspace-administration", "platform-provider-catalogue", "platform-access-support", "platform-guidance-administration", "platform-audit-context", ...commonDeferred],
  },
  "Apprenticeship Lead": {
    role: "Apprenticeship Lead",
    modules: [
      item("Home", "Operations Centre", "enabled", "primary", "core"),
      item("Applications", "Applications", "enabled", "primary", "core"),
      item("Learners", "Learners", "enabled", "primary", "core"),
      item("Providers", "Providers", "enabled", "primary", "core"),
      item("People", "People", "secondary", "administration", "supporting"),
      item("Programmes", "Programmes", "secondary", "administration", "supporting"),
      item("Settings", "Settings", "secondary", "administration", "supporting"),
      item("Copilot", "Copilot", "secondary", "help", "supporting"),
      item("Knowledge", "Guidance Centre", "secondary", "help", "supporting"),
      item("Reports", "Reports", "deferred", undefined, "not-ready"),
    ],
    permittedCapabilities: ["employer-organisation-operations"],
    deniedCapabilities: ["employee-own-journey", "manager-direct-report-operations", "employer-operational-reporting", "platform-workspace-administration", "platform-provider-catalogue", "platform-access-support", "platform-guidance-administration", "platform-audit-context", ...commonDeferred],
  },
  "Platform Admin": {
    role: "Platform Admin",
    modules: [
      item("Home", "Employer Workspaces", "enabled", "primary", "core"),
      item("Providers", "Provider Catalogue", "enabled", "primary", "core"),
      item("Programmes", "Programmes", "hidden", undefined, "role-denied"),
      item("Settings", "Access & Tenant Support", "enabled", "primary", "core"),
      item("Knowledge", "Guidance Administration", "secondary", "secondary", "supporting"),
      item("Support", "Support / Audit Context", "secondary", "secondary", "supporting"),
      item("Applications", "Applications", "hidden", undefined, "role-denied"),
      item("Learners", "Learners", "hidden", undefined, "role-denied"),
      item("Reports", "Reports", "hidden", undefined, "role-denied"),
      item("Copilot", "Copilot", "hidden", undefined, "role-denied"),
    ],
    permittedCapabilities: ["platform-workspace-administration", "platform-provider-catalogue", "platform-access-support", "platform-guidance-administration", "platform-audit-context"],
    deniedCapabilities: ["employee-own-journey", "manager-direct-report-operations", "employer-organisation-operations", "employer-operational-reporting", ...commonDeferred],
  },
  "Employer Admin": {
    role: "Employer Admin",
    modules: [
      item("Home", "Operations Centre", "enabled", "primary", "core"),
      item("Applications", "Applications", "enabled", "primary", "core"),
      item("Learners", "Learners", "enabled", "primary", "core"),
      item("Providers", "Providers", "enabled", "primary", "core"),
      item("People", "People", "secondary", "administration", "supporting"),
      item("Programmes", "Programmes", "secondary", "administration", "supporting"),
      item("Settings", "Settings", "secondary", "administration", "supporting"),
      item("Copilot", "Copilot", "secondary", "help", "supporting"),
      item("Knowledge", "Guidance Centre", "secondary", "help", "supporting"),
      item("Reports", "Reports", "deferred", undefined, "not-ready"),
    ],
    permittedCapabilities: ["employer-organisation-operations"],
    deniedCapabilities: ["employee-own-journey", "manager-direct-report-operations", "employer-operational-reporting", "platform-workspace-administration", "platform-provider-catalogue", "platform-access-support", "platform-guidance-administration", "platform-audit-context", ...commonDeferred],
  },
};

export function getCoreEarlyAccessPolicy(role: MvpUserRole): CoreEarlyAccessRolePolicy {
  return coreEarlyAccessPolicy[role];
}

export function resolveCoreEarlyAccessRouteAccess(role: MvpUserRole, requestedModule: string | null | undefined) {
  const policy = getCoreEarlyAccessPolicy(role);
  const requested = policy.modules.find((entry) => entry.moduleKey === requestedModule);
  const first = policy.modules.find((entry) => entry.availability === "enabled")!;
  const permitted = requested && (requested.availability === "enabled" || requested.availability === "secondary");
  return {
    permitted: Boolean(permitted),
    availability: requested?.availability ?? "hidden",
    module: permitted ? requested.moduleKey : first.moduleKey,
    safeRedirect: first.route,
    reasonCode: requested?.reasonCode ?? "role-denied",
  } as const;
}

export function hasCoreEarlyAccessCapability(role: MvpUserRole, capability: CoreEarlyAccessCapability) {
  return getCoreEarlyAccessPolicy(role).permittedCapabilities.includes(capability);
}
