import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { findRelease2NavigationArea, getRelease2Navigation } from "../lib/levytate/release-2-navigation";
import type { CoreEarlyAccessModuleKey } from "../lib/levytate/core-early-access-policy";

let assertions = 0;
function check(condition: unknown, message: string) {
  assert.ok(condition, message);
  assertions += 1;
}

const employerModules: CoreEarlyAccessModuleKey[] = [
  "Home", "Operations", "People", "Learners", "Learning Time", "Applications", "Assessments",
  "My Programmes", "My Providers", "Marketplace", "Intelligence", "Requests", "Finance",
  "Copilot", "Knowledge", "Settings",
];

for (const role of ["Apprenticeship Lead", "Employer Admin"] as const) {
  const navigation = getRelease2Navigation(role, employerModules);
  check(navigation.filter((area) => area.priority === "primary").map((area) => area.label).join("|") === "Home|People|Applications|Assessments|Programmes|Insights", `${role} receives the six launch areas`);
  check(findRelease2NavigationArea(navigation, "Operations")?.label === "Home", `${role} Operations remains immediately accessible from Home`);
  check(findRelease2NavigationArea(navigation, "Learners")?.label === "People", `${role} learner operations are grouped under People`);
  check(findRelease2NavigationArea(navigation, "Marketplace")?.label === "Programmes", `${role} Marketplace is grouped under Programmes`);
  check(findRelease2NavigationArea(navigation, "Finance")?.label === "Insights", `${role} Finance is grouped under Insights`);
}

const capabilityOff = getRelease2Navigation("Apprenticeship Lead", employerModules.filter((module) => module !== "Requests" && module !== "Learning Time"));
check(!capabilityOff.some((area) => area.modules.includes("Requests")), "Requests stays hidden when capability access is absent");
check(!capabilityOff.some((area) => area.modules.includes("Learning Time")), "Learning Time stays hidden when capability access is absent");

const employee = getRelease2Navigation("Employee", ["Home", "My Application", "My Programme", "Assessments", "Learning Time", "Copilot", "Knowledge"]);
check(employee.filter((area) => area.priority === "primary").map((area) => area.label).join("|") === "Home|My Development|My Application", "Employee navigation is limited to three clear primary areas");
check(findRelease2NavigationArea(employee, "Learning Time")?.label === "My Development", "Employee Learning Time is contextual to My Development");

const manager = getRelease2Navigation("Line Manager", ["Home", "My Team", "Approvals", "Assessments", "Learning Time", "Copilot", "Knowledge"]);
check(manager.filter((area) => area.priority === "primary").map((area) => area.label).join("|") === "Home|My Team|Approvals", "Line Manager navigation prioritises Home, My Team and Approvals");
check(findRelease2NavigationArea(manager, "Assessments")?.priority === "secondary", "A manager's own assessment remains separately accessible");

const platform = getRelease2Navigation("Platform Admin", ["Home", "Providers", "Settings", "Knowledge", "Support"]);
check(platform.some((area) => area.label === "Workspaces"), "Platform Admin retains workspace administration");
check(!platform.some((area) => area.label === "Applications" || area.label === "People" || area.label === "Insights"), "Platform Admin does not inherit employer operating areas");

const shell = readFileSync(new URL("../components/levytate-mvp/LevyTateMvpApp.tsx", import.meta.url), "utf8");
check(shell.includes('id="levytate-mobile-navigation"'), "Mobile navigation drawer is present");
check(shell.includes('aria-modal="true"'), "Mobile drawer exposes modal semantics");
check(shell.includes('event.key === "Escape"'), "Mobile drawer supports Escape-to-close");
check(shell.includes('window.addEventListener("popstate"'), "Browser Back and Forward update the active module");
check(!shell.includes('<select value={activeModule}'), "The technical mobile module select is removed");
check(shell.includes('aria-current={active ? "page"'), "Selected navigation state is exposed accessibly");

const ui = readFileSync(new URL("../components/levytate-mvp/MvpUi.tsx", import.meta.url), "utf8");
check(ui.includes("previousFocus?.focus()"), "Dialogs restore focus after close");
check(ui.includes('aria-labelledby={titleId}'), "Dialogs have an explicit accessible title association");
check(ui.includes('event.key !== "Tab"'), "Dialogs contain keyboard focus");

console.log(`Launch Release 2 validation passed (${assertions} assertions).`);
