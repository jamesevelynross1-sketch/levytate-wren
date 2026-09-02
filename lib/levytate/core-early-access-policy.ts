import type { MvpUserRole } from "@/lib/levytate/mvp/rbac";

export type CoreEarlyAccessModuleKey =
  | "Home"
  | "My Programme"
  | "My Application"
  | "My Team"
  | "Approvals"
  | "Operations"
  | "Intelligence"
  | "Applications"
  | "People"
  | "Learners"
  | "Providers"
  | "My Providers"
  | "My Programmes"
  | "Marketplace"
  | "Finance"
  | "Programmes"
  | "Copilot"
  | "Knowledge"
  | "Reports"
  | "Settings"
  | "Support";

export type CoreEarlyAccessAvailability = "enabled" | "secondary" | "hidden" | "deferred";
export type CoreEarlyAccessNavigationGroup = "operate" | "manage" | "discover" | "support";

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
      item("Home", "Home", "enabled", "operate", "core"),
      item("My Application", "My Application", "enabled", "operate", "core"),
      item("My Programme", "My Apprenticeship", "enabled", "operate", "core"),
      item("Copilot", "Copilot", "secondary", "support", "supporting"),
      item("Knowledge", "Guidance Centre", "secondary", "support", "supporting"),
      item("Providers", "Programmes & Providers", "hidden", undefined, "non-core"),
      item("Finance", "Finance", "hidden", undefined, "role-denied"),
      item("Programmes", "Programmes", "hidden", undefined, "non-core"),
      item("Reports", "Reports", "deferred", undefined, "not-ready"),
    ],
    permittedCapabilities: ["employee-own-journey"],
    deniedCapabilities: ["manager-direct-report-operations", "employer-organisation-operations", "employer-operational-reporting", "platform-workspace-administration", "platform-provider-catalogue", "platform-access-support", "platform-guidance-administration", "platform-audit-context", ...commonDeferred],
  },
  "Line Manager": {
    role: "Line Manager",
    modules: [
      item("Home", "Home", "enabled", "operate", "core"),
      item("Approvals", "Approvals", "enabled", "operate", "core"),
      item("My Team", "My Team", "enabled", "operate", "core"),
      item("Copilot", "Copilot", "secondary", "support", "supporting"),
      item("Knowledge", "Guidance Centre", "secondary", "support", "supporting"),
      item("Providers", "Programmes & Providers", "hidden", undefined, "non-core"),
      item("Finance", "Finance", "hidden", undefined, "role-denied"),
      item("Programmes", "Programmes", "hidden", undefined, "non-core"),
      item("Reports", "Team Reporting", "deferred", undefined, "not-ready"),
    ],
    permittedCapabilities: ["manager-direct-report-operations"],
    deniedCapabilities: ["employee-own-journey", "employer-organisation-operations", "employer-operational-reporting", "platform-workspace-administration", "platform-provider-catalogue", "platform-access-support", "platform-guidance-administration", "platform-audit-context", ...commonDeferred],
  },
  "Apprenticeship Lead": {
    role: "Apprenticeship Lead",
    modules: [
      item("Home", "Home", "enabled", "operate", "core"),
      item("Applications", "Applications", "enabled", "operate", "core"),
      item("Learners", "Learners", "enabled", "operate", "core"),
      item("Operations", "Operations Centre", "enabled", "operate", "core"),
      item("People", "People", "enabled", "manage", "core"),
      item("My Providers", "My Providers", "enabled", "manage", "core"),
      item("My Programmes", "My Programmes", "enabled", "manage", "core"),
      item("Finance", "Finance", "enabled", "manage", "core"),
      item("Marketplace", "Marketplace", "enabled", "discover", "core"),
      item("Intelligence", "Intelligence", "enabled", "discover", "core"),
      item("Copilot", "Copilot", "secondary", "support", "supporting"),
      item("Knowledge", "Guidance Centre", "secondary", "support", "supporting"),
      item("Settings", "Settings", "secondary", "support", "supporting"),
      item("Reports", "Reports", "deferred", undefined, "not-ready"),
    ],
    permittedCapabilities: ["employer-organisation-operations"],
    deniedCapabilities: ["employee-own-journey", "manager-direct-report-operations", "employer-operational-reporting", "platform-workspace-administration", "platform-provider-catalogue", "platform-access-support", "platform-guidance-administration", "platform-audit-context", ...commonDeferred],
  },
  "Platform Admin": {
    role: "Platform Admin",
    modules: [
      item("Home", "Employer Workspaces", "enabled", "manage", "core"),
      item("Intelligence", "Intelligence", "hidden", undefined, "role-denied"),
      item("Providers", "Provider Catalogue", "enabled", "manage", "core"),
      item("Finance", "Finance", "hidden", undefined, "role-denied"),
      item("Programmes", "Programmes", "hidden", undefined, "role-denied"),
      item("Settings", "Access & Tenant Support", "enabled", "manage", "core"),
      item("Knowledge", "Guidance Administration", "secondary", "support", "supporting"),
      item("Support", "Support / Audit Context", "secondary", "support", "supporting"),
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
      item("Home", "Home", "enabled", "operate", "core"),
      item("Applications", "Applications", "enabled", "operate", "core"),
      item("Learners", "Learners", "enabled", "operate", "core"),
      item("Operations", "Operations Centre", "enabled", "operate", "core"),
      item("People", "People", "enabled", "manage", "core"),
      item("My Providers", "My Providers", "enabled", "manage", "core"),
      item("My Programmes", "My Programmes", "enabled", "manage", "core"),
      item("Finance", "Finance", "enabled", "manage", "core"),
      item("Marketplace", "Marketplace", "enabled", "discover", "core"),
      item("Intelligence", "Intelligence", "enabled", "discover", "core"),
      item("Copilot", "Copilot", "secondary", "support", "supporting"),
      item("Knowledge", "Guidance Centre", "secondary", "support", "supporting"),
      item("Settings", "Settings", "secondary", "support", "supporting"),
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
