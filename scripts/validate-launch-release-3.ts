import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildEmployerIntelligence } from "../lib/levytate/intelligence/build";
import { createEmptyMvpWorkspace } from "../lib/levytate/mvp/workspace";
import { getCoreEarlyAccessPolicy, resolveCoreEarlyAccessRouteAccess } from "../lib/levytate/core-early-access-policy";
import type { AssessmentWorkspace } from "../lib/levytate/assessments/api";
import type { OperationsResponse } from "../lib/levytate/mvp/operations-centre";
import type { LevyTateWorkspaceBootstrap } from "../lib/levytate/mvp/api";

let assertions = 0;
function check(condition: unknown, message: string) { assert.ok(condition, message); assertions += 1; }

const now = "2026-10-20T09:00:00.000Z";
const workspace: LevyTateWorkspaceBootstrap = {
  data: createEmptyMvpWorkspace(),
  meta: { organisationId: "org-release-3", organisationName: "Fictional Employer", userEmail: "lead@levytate.test", userRole: "Apprenticeship Lead", storageMode: "supabase", warnings: [] },
};
workspace.data.applications.push({ id: "app-1", employeeId: "employee-1", apprenticeshipStandardId: "ST0001", status: "Awaiting Final Approval", currentOwner: "Apprenticeship Lead", reason: "", careerGoal: "", supportRequired: "", managerNote: "", submittedAt: now, updatedAt: now, history: [] });
workspace.data.employees.push({ id: "employee-1", employeeNumber: "F-001", name: "Fictional Employee", email: "employee@levytate.test", jobTitle: "Analyst", roleId: "", managerId: "", department: "Operations", site: "HQ", platformRole: "Employee", status: "Active", startDate: "2026-01-01", createdAt: now, updatedAt: now });

const operations: OperationsResponse = {
  source: "supabase", generatedAt: now,
  summary: { needsAttentionNow: 1, readyToEnrol: 0, reviewsOverdue: 1, behindTarget: 0, activeBreaks: 0, approachingAssessmentCompletion: 0 },
  queues: { urgent: [{ id: "urgent-1", queueType: "urgent", learnerRecordId: "learner-1", learnerName: "Fictional Learner", programmeName: "Data Analyst", providerName: "Fictional Provider", department: "Operations", site: "HQ", lifecycleStatus: "Enrolled", priorityLevel: "High", priorityRank: 1, reason: "Provider review is overdue.", dueDate: "2026-10-10", dueStatus: "Overdue", daysOverdue: 10, timingLabel: "10 days overdue", ownerType: "Shared", actionType: "record_review", actionLabel: "Record review", actionUrl: "/levytate/app?module=Learners&learner=learner-1&action=record_review", secondaryActionUrl: "/levytate/app?module=Learners&learner=learner-1", sourceType: "review_due", sourceCondition: "provider-review-overdue", sourceKey: "learner-1:provider-review-overdue", persistentActionType: "record_provider_review" }], ready_to_enrol: [], reviews: [], progress: [], breaks: [], pre_enrolment: [], assessment: [] },
  recentActivity: [], filterOptions: { priorities: [], queues: [], learners: [], programmes: [], providers: [], sites: [], departments: [], owners: [], actionTypes: [] }, totalAttentionItems: 1,
};

function assessmentWorkspace(submitted: number): AssessmentWorkspace {
  const report = (id: string) => ({ campaignId: id, definition: `${submitted} submitted`, invited: 8, submitted, participationPercent: Math.round(submitted / 8 * 100), suppressionThreshold: 5, profiles: submitted < 5 ? [] : [{ label: "Enabler", count: 3 }], dimensions: submitted < 5 ? [] : [{ id: "responsibleUse", label: "Responsible use", value: 62 }], barriers: submitted < 5 ? [] : [{ label: "Unclear company guidance", count: 3 }], useCases: submitted < 5 ? [] : [{ label: "Analysis and reporting", count: 4 }], cohorts: submitted < 5 ? [] : [{ label: "Guided practice", count: 3 }], groups: [{ department: "Small team", invited: 3, submitted: 3, participationPercent: 100, suppressed: true, recurringNeeds: [], blockers: [] }, { department: "Operations", invited: 5, submitted: Math.min(5, submitted), participationPercent: Math.min(100, submitted * 20), suppressed: submitted < 5, recurringNeeds: submitted < 5 ? [] : [{ label: "Responsible use", count: 3 }], blockers: submitted < 5 ? [] : [{ label: "Guidance", count: 3 }] }] });
  return {
    generatedAt: now, role: "Apprenticeship Lead", currentEmployeeId: null, canCompleteOwnAssessments: false, questions: [], frameworks: [], questionnaireVersion: "v3", interpretationVersion: "v3", disclosure: { private: "", campaign: "", guidance: "" }, assessments: [], availableEmployees: [],
    campaigns: [
      { id: "campaign-v3", title: "AI capability 2026", purpose: "Plan responsible development", frameworkTitle: "Comprehensive AI Capability Assessment", questionnaireVersion: "v3", businessObjectives: [], departments: ["Operations"], status: "closed", closingDate: "2026-10-18", ownerName: "Campaign owner", sharingPolicy: "campaign_owner_summary", invited: 8, submitted, participationPercent: Math.round(submitted / 8 * 100), participantEmployeeIds: [], createdAt: "2026-10-01T00:00:00.000Z" },
      { id: "campaign-v2", title: "Historic framework", purpose: "Historical evidence", frameworkTitle: "AI Capability Assessment", questionnaireVersion: "v2", businessObjectives: [], departments: ["Operations"], status: "closed", closingDate: "2026-06-01", ownerName: "Campaign owner", sharingPolicy: "campaign_owner_summary", invited: 8, submitted, participationPercent: Math.round(submitted / 8 * 100), participantEmployeeIds: [], createdAt: "2026-05-01T00:00:00.000Z" },
    ],
    reporting: [report("campaign-v3"), report("campaign-v2")] as AssessmentWorkspace["reporting"],
  };
}

const finance = { version: 1 as const, mode: "persistent" as const, imports: [{ id: "import-1", importedAt: now, fileName: "das.csv", sourceRows: 4, newTransactions: 4, duplicateRows: 0, reviewRows: 1, dateRange: { from: "2026-08-01", to: "2026-09-30" } }], manualBalancePence: 500000, manualBalanceConfirmedAt: "2026-09-30", transactions: [
  { transactionId: "1", transactionDate: "2026-08-01", description: "Levy credit", category: "levy_in" as const, amountPence: 200000, sourceRow: 1, fingerprint: "1" },
  { transactionId: "2", transactionDate: "2026-08-10", description: "Training", category: "apprenticeship_spend" as const, amountPence: -75000, providerName: "Fictional Provider", programmeName: "Data Analyst", sourceRow: 2, fingerprint: "2" },
  { transactionId: "3", transactionDate: "2026-09-10", description: "Expiry", category: "levy_expiry" as const, amountPence: -10000, sourceRow: 3, fingerprint: "3" },
  { transactionId: "4", transactionDate: "2026-09-30", description: "Review", category: "other" as const, amountPence: -5000, sourceRow: 4, fingerprint: "4" },
] };

const populated = buildEmployerIntelligence({ generatedAt: now, workspace: { ok: true, value: workspace }, operations: { ok: true, value: operations }, assessments: { ok: true, value: assessmentWorkspace(5) }, finance: { ok: true, value: finance } });
check(populated.overview.signals.find((item) => item.metricId === "applications-awaiting-decision")?.value === 1, "Application decision count reconciles to source records");
check(populated.overview.signals.find((item) => item.metricId === "operational-attention")?.value === 1, "Operational attention count reconciles to Operations Centre");
check(populated.overview.priorities[0]?.href.includes("learner-1"), "Priority opens the exact authorised learner action");
check(populated.workforce.reports.length === 2 && populated.workforce.reports[0].questionnaireVersion === "v3" && populated.workforce.reports[1].questionnaireVersion === "v2", "Mixed framework versions remain separate campaign reports");
check(populated.workforce.reports[0].groups[0].suppressed && populated.workforce.reports[0].groups[0].recurringNeeds.length === 0, "Under-five department stays suppressed without a complement aggregate");
check(populated.workforce.reports[0].priorities.length === 3, "Three evidence-led workforce priorities are produced from eligible evidence");
check(populated.finance.contributionsPence === 200000 && populated.finance.apprenticeshipSpendPence === 75000 && populated.finance.expiredPence === 10000, "Finance figures reconcile to classified imported transactions");
check(populated.finance.unclassifiedCount === 1 && populated.finance.unclassifiedPence === 5000, "Unclassified finance evidence remains visible");

const suppressed = buildEmployerIntelligence({ generatedAt: now, workspace: { ok: true, value: workspace }, operations: { ok: true, value: operations }, assessments: { ok: true, value: assessmentWorkspace(4) }, finance: { ok: false, message: "Missing finance import." } });
check(suppressed.workforce.reports[0].suppressed && suppressed.workforce.reports[0].dimensions.length === 0 && suppressed.workforce.reports[0].priorities.length === 0, "Organisation findings are suppressed below five submissions");
check(suppressed.finance.availability === "unavailable" && suppressed.finance.missingInformation[0] === "Missing finance import.", "Missing finance is labelled and not fabricated");

const emptyWorkspace = { ...workspace, data: createEmptyMvpWorkspace() };
const empty = buildEmployerIntelligence({ generatedAt: now, workspace: { ok: true, value: emptyWorkspace }, operations: { ok: false, message: "Unavailable" }, assessments: { ok: true, value: { ...assessmentWorkspace(0), campaigns: [], reporting: [] } }, finance: { ok: false, message: "Unavailable" } });
check(empty.overview.signals[0].value === 0 && empty.workforce.reports.length === 0, "Empty employer workspace produces an honest empty state");
check(empty.overview.signals.find((item) => item.metricId === "operational-attention")?.availability === "unavailable", "Failed sources are unavailable rather than stale");

for (const role of ["Apprenticeship Lead", "Employer Admin"] as const) {
  const policy = getCoreEarlyAccessPolicy(role);
  check(resolveCoreEarlyAccessRouteAccess(role, "Insights", policy).permitted, `${role} may access employer Insights`);
  check(resolveCoreEarlyAccessRouteAccess(role, "Workforce Development", policy).permitted, `${role} may access workforce intelligence`);
}
for (const role of ["Employee", "Line Manager", "Platform Admin"] as const) {
  check(!resolveCoreEarlyAccessRouteAccess(role, "Insights").permitted, `${role} is denied organisation-wide employer Insights`);
}

const component = readFileSync(new URL("../components/levytate-mvp/EmployerInsightsModule.tsx", import.meta.url), "utf8");
const builder = readFileSync(new URL("../lib/levytate/intelligence/build.ts", import.meta.url), "utf8");
check(!`${component}\n${builder}`.includes("Levy utilisation"), "Legacy synthetic levy-utilisation KPI is absent");
const printComponent = component.slice(component.indexOf("function ExecutivePrintReport"));
check(!printComponent.includes("priority.subject"), "Executive print report does not render named priority subjects");
check(component.includes("employer-intelligence-report"), "Executive print output is implemented");
check(populated.metricCatalogue.every((item) => item.source && item.population && item.calculation && item.reportingPeriod && item.timestamp && item.roleAuthorisation && item.missingData && item.privacy), "Every metric has a complete source-of-truth definition");

console.log(`Launch Release 3 validation passed (${assertions} assertions).`);
