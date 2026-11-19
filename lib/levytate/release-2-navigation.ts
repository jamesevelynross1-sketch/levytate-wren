import type { CoreEarlyAccessModuleKey } from "@/lib/levytate/core-early-access-policy";
import type { MvpUserRole } from "@/lib/levytate/mvp/rbac";
import type { LevyTateProductSection } from "@/lib/levytate/product-packaging";

export type Release2NavigationArea = {
  key: string;
  label: string;
  description: string;
  modules: readonly CoreEarlyAccessModuleKey[];
  section: LevyTateProductSection;
  priority: "primary" | "secondary";
};

const core = (key: string, label: string, description: string, modules: readonly CoreEarlyAccessModuleKey[]): Release2NavigationArea =>
  ({ key, label, description, modules, section: "core", priority: "primary" });
const addOn = (key: string, label: string, description: string, modules: readonly CoreEarlyAccessModuleKey[]): Release2NavigationArea =>
  ({ key, label, description, modules, section: "add-on", priority: "secondary" });
const support = (key: string, label: string, description: string, modules: readonly CoreEarlyAccessModuleKey[]): Release2NavigationArea =>
  ({ key, label, description, modules, section: "support", priority: "secondary" });

const employerAreas: readonly Release2NavigationArea[] = [
  core("home", "Home", "Priorities and operational attention", ["Home", "Operations"]),
  core("people", "People", "Employees, learners and roles", ["People", "Learners"]),
  core("applications", "Applications", "Reviews, approvals and history", ["Applications"]),
  core("programmes", "Programmes", "Programmes and provider relationships", ["My Programmes", "My Providers", "Marketplace"]),
  core("insights", "Insights & Finance", "Operating evidence, reporting and funding", ["Insights", "Finance"]),
  addOn("workforce", "Workforce Intelligence", "Assessments and development evidence", ["Assessments", "Workforce Development"]),
  addOn("provider-intelligence", "Provider Intelligence", "Provider and market updates", ["Intelligence"]),
  addOn("requests", "Provider Requests", "Briefs, comparisons and provider proposals", ["Requests"]),
  addOn("learning-time", "Learning Time", "Off-the-job learning support", ["Learning Time"]),
  addOn("learner-support", "Learner Support", "Employee-approved support requests", ["Learner Support"]),
  addOn("copilot", "Copilot", "Grounded help in your current context", ["Copilot"]),
  support("guidance", "Guidance", "Practical apprenticeship guidance", ["Knowledge"]),
  support("settings", "Settings", "Workspace configuration", ["Settings"]),
];

const employeeAreas: readonly Release2NavigationArea[] = [
  core("home", "Home", "Your next important step", ["Home"]),
  core("application", "My Application", "Prepare and track your application", ["My Application"]),
  core("programme", "My Apprenticeship", "Your current programme", ["My Programme"]),
  addOn("assessments", "Assessments", "Your development assessments", ["Assessments"]),
  addOn("learning-time", "Learning Time", "Off-the-job learning support", ["Learning Time"]),
  addOn("my-support", "My Support", "Private support and approved requests", ["My Support"]),
  addOn("copilot", "Copilot", "Help with your LevyTate journey", ["Copilot"]),
  support("guidance", "Guidance", "Practical apprenticeship guidance", ["Knowledge"]),
];

const managerAreas: readonly Release2NavigationArea[] = [
  core("home", "Home", "Decisions and team attention", ["Home"]),
  core("team", "My Team", "Direct-report development", ["My Team"]),
  core("approvals", "Approvals", "Applications awaiting your decision", ["Approvals"]),
  core("development", "My Development", "Your own programme and application", ["My Programme", "My Application"]),
  addOn("assessments", "Assessments", "Your development assessments", ["Assessments"]),
  addOn("learning-time", "Learning Time", "Off-the-job learning support", ["Learning Time"]),
  addOn("learner-support", "Learner Support", "Employee-approved support requests", ["Learner Support"]),
  addOn("copilot", "Copilot", "Grounded manager support", ["Copilot"]),
  support("guidance", "Guidance", "Practical apprenticeship guidance", ["Knowledge"]),
];

const platformAreas: readonly Release2NavigationArea[] = [
  core("workspaces", "Workspaces", "Employer workspace administration", ["Home"]),
  core("catalogue", "Provider Catalogue", "Platform provider reference data", ["Providers"]),
  // Platform access controls are essential operations; employer Settings are support.
  core("access", "Access & Tenants", "Controlled access and tenant support", ["Settings"]),
  support("guidance", "Guidance Admin", "Platform guidance administration", ["Knowledge"]),
  support("support", "Support Context", "Safe audit and support context", ["Support"]),
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
