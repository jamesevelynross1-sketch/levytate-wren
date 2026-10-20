import type { CoreEarlyAccessModuleKey } from "@/lib/levytate/core-early-access-policy";
import type { MvpUserRole } from "@/lib/levytate/mvp/rbac";

export type Release2NavigationArea = {
  key: string;
  label: string;
  description: string;
  modules: readonly CoreEarlyAccessModuleKey[];
  priority: "primary" | "secondary";
};

const employerAreas: readonly Release2NavigationArea[] = [
  { key: "home", label: "Home", description: "Priorities and operational attention", modules: ["Home", "Operations", "Learner Support"], priority: "primary" },
  { key: "people", label: "People", description: "Employees, learners and roles", modules: ["People", "Learners", "Learning Time"], priority: "primary" },
  { key: "applications", label: "Applications", description: "Reviews, approvals and history", modules: ["Applications"], priority: "primary" },
  { key: "assessments", label: "Assessments", description: "Campaigns, submissions and findings", modules: ["Assessments"], priority: "primary" },
  { key: "programmes", label: "Programmes", description: "Programmes, providers and requests", modules: ["My Programmes", "My Providers", "Marketplace", "Intelligence", "Requests"], priority: "primary" },
  { key: "insights", label: "Insights", description: "Trusted operating, workforce and finance evidence", modules: ["Insights", "Workforce Development", "Finance"], priority: "primary" },
  { key: "copilot", label: "Copilot", description: "Grounded help in your current context", modules: ["Copilot"], priority: "secondary" },
  { key: "guidance", label: "Guidance", description: "Practical apprenticeship guidance", modules: ["Knowledge"], priority: "secondary" },
  { key: "settings", label: "Settings", description: "Workspace configuration", modules: ["Settings"], priority: "secondary" },
];

const employeeAreas: readonly Release2NavigationArea[] = [
  { key: "home", label: "Home", description: "Your next important step", modules: ["Home"], priority: "primary" },
  { key: "development", label: "My Development", description: "Assessment, apprenticeship, learning and support", modules: ["Assessments", "My Programme", "Learning Time", "My Support"], priority: "primary" },
  { key: "application", label: "My Application", description: "Prepare and track your application", modules: ["My Application"], priority: "primary" },
  { key: "copilot", label: "Copilot", description: "Help with your LevyTate journey", modules: ["Copilot"], priority: "secondary" },
  { key: "guidance", label: "Guidance", description: "Practical apprenticeship guidance", modules: ["Knowledge"], priority: "secondary" },
];

const managerAreas: readonly Release2NavigationArea[] = [
  { key: "home", label: "Home", description: "Decisions and team attention", modules: ["Home"], priority: "primary" },
  { key: "team", label: "My Team", description: "Direct-report development", modules: ["My Team", "Learner Support"], priority: "primary" },
  { key: "approvals", label: "Approvals", description: "Applications awaiting your decision", modules: ["Approvals"], priority: "primary" },
  { key: "development", label: "My Development", description: "Your own assessment and learning", modules: ["Assessments", "Learning Time"], priority: "secondary" },
  { key: "copilot", label: "Copilot", description: "Grounded manager support", modules: ["Copilot"], priority: "secondary" },
  { key: "guidance", label: "Guidance", description: "Practical apprenticeship guidance", modules: ["Knowledge"], priority: "secondary" },
];

const platformAreas: readonly Release2NavigationArea[] = [
  { key: "workspaces", label: "Workspaces", description: "Employer workspace administration", modules: ["Home"], priority: "primary" },
  { key: "catalogue", label: "Provider Catalogue", description: "Platform provider reference data", modules: ["Providers"], priority: "primary" },
  { key: "access", label: "Access & Tenants", description: "Controlled access and tenant support", modules: ["Settings"], priority: "primary" },
  { key: "guidance", label: "Guidance Admin", description: "Platform guidance administration", modules: ["Knowledge"], priority: "secondary" },
  { key: "support", label: "Support Context", description: "Safe audit and support context", modules: ["Support"], priority: "secondary" },
];

export function getRelease2Navigation(
  role: MvpUserRole,
  availableModules: readonly CoreEarlyAccessModuleKey[],
): readonly Release2NavigationArea[] {
  const source = role === "Employee"
    ? employeeAreas
    : role === "Line Manager"
      ? managerAreas
      : role === "Platform Admin"
        ? platformAreas
        : employerAreas;
  const available = new Set(availableModules);
  return source
    .map((area) => ({ ...area, modules: area.modules.filter((module) => available.has(module)) }))
    .filter((area) => area.modules.length > 0);
}

export function findRelease2NavigationArea(
  areas: readonly Release2NavigationArea[],
  module: CoreEarlyAccessModuleKey,
) {
  return areas.find((area) => area.modules.includes(module));
}
