import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { calculateLevyFinance, financeReportingPeriod } from "../lib/levytate/finance/calculations";
import type { LevyFinanceState } from "../lib/levytate/finance/types";

const source = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const store = source("components/levytate-mvp/MvpWorkspaceStore.tsx");
assert.match(store, /Promise<WorkspaceMutationResult>/, "Workspace mutations must expose a confirmed asynchronous result.");
assert.match(store, /return syncMutation\(mutation\)/, "Supabase mutations must return the queued server result to their caller.");
assert.match(store, /Your information is still in this form; please retry/, "Network failure must provide a recoverable retry message.");

const employeeApplication = source("components/levytate-mvp/EmployeeExperienceModule.tsx");
assert.match(employeeApplication, /const result = await saveApplication\(next\)/);
assert.ok(employeeApplication.indexOf("if (!result.ok)") < employeeApplication.indexOf("setSavedMessage(status"), "Success must only appear after confirmed persistence.");
assert.match(employeeApplication, /onSecondary=\{\(\) => onNavigate\("My Programme"\)\}/, "View programme must not remain an empty handler.");
assert.match(employeeApplication, /disabled=\{saving\}/, "Repeated employee submissions must be disabled while persistence is pending.");

const applications = source("components/levytate-mvp/ApplicationsModule.tsx");
assert.match(applications, /const result = await saveApplication/);
assert.match(applications, /const result = await onDecision/, "Manager decisions must await server confirmation.");
assert.match(applications, /Saving decision…/, "Manager decisions must expose a pending state.");

const dashboard = source("components/levytate-mvp/DashboardSettingsModules.tsx");
assert.ok(!dashboard.includes('target: "Provider Relationships"'), "Employer Home must not target the unavailable legacy provider destination.");
assert.match(dashboard, /Employees:\$\{employee\.id\}/, "Employee attention items must retain record context.");
const shell = source("components/levytate-mvp/LevyTateMvpApp.tsx");
assert.match(shell, /target\.startsWith\("Applications:"\)/);
assert.match(shell, /target\.startsWith\("Employees:"\)/);

const portfolio = source("components/levytate-mvp/EmployerPortfolioModules.tsx");
assert.match(portfolio, /Standard-linked applications/);
assert.match(portfolio, /not confirmed against this provider programme/);

const oldImport: LevyFinanceState = {
  version: 1,
  mode: "persistent",
  transactions: [{
    transactionId: "launch-old-import",
    fingerprint: "launch-old-import",
    sourceRow: 1,
    transactionDate: "2025-01-15",
    description: "Levy credit",
    amountPence: 100_000,
    category: "levy_in",
  }],
  imports: [],
};
const oldPeriod = financeReportingPeriod(calculateLevyFinance(oldImport, new Date("2026-10-19T12:00:00Z")), new Date("2026-10-19T12:00:00Z"));
assert.equal(oldPeriod.status, "historical");
assert.equal(oldPeriod.label, "Jan 2025");
assert.match(oldPeriod.copy, /not a live current-month balance/);

const launchScope = source("docs/LEVYTATE_LAUNCH_SCOPE.md");
for (const required of ["Runtime roles and boundaries", "Module status", "Application and approval rules", "Copilot boundary", "Explicitly outside"]) {
  assert.ok(launchScope.includes(required), `Launch scope must include ${required}.`);
}

console.log("Launch Release 1 validation passed: confirmed mutation UX, deep-link navigation, truthful finance/programme reporting and launch-scope boundaries.");
