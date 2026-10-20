import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { EmployerExecutiveReport } from "../components/levytate-mvp/EmployerExecutiveReport";
import { applyAssessmentAggregateDisclosure } from "../lib/levytate/assessments/disclosure";
import { buildAssessmentCampaignCsv } from "../lib/levytate/assessments/export";
import type { AssessmentCampaignView, AssessmentWorkspace } from "../lib/levytate/assessments/api";
import { buildEmployerExecutiveReportContract } from "../lib/levytate/intelligence/executive-report";
import type { EmployerIntelligenceResponse } from "../lib/levytate/intelligence/types";

let assertions = 0;
function check(condition: unknown, message: string) { assert.ok(condition, message); assertions += 1; }

type GroupInput = { department: string; invited: number; submitted: number; barrier: string };
function protectedReport(groups: GroupInput[], campaignId = "campaign-v3") {
  const submitted = groups.reduce((sum, group) => sum + group.submitted, 0);
  const invited = groups.reduce((sum, group) => sum + group.invited, 0);
  return applyAssessmentAggregateDisclosure({
    campaignId,
    definition: `${submitted} distinct submitted responses from ${invited} recorded invitees.`,
    invited,
    submitted,
    participationPercent: invited ? Math.round(submitted / invited * 100) : 0,
    suppressionThreshold: 5,
    profiles: [{ label: "Enabler", count: submitted }],
    dimensions: [{ id: "responsibleUse", label: "Responsible use", value: 64 }],
    barriers: groups.filter((group) => group.barrier).map((group) => ({ label: group.barrier, count: group.submitted })),
    useCases: [{ label: "Analysis and reporting", count: submitted }],
    cohorts: [{ label: "Guided practice", count: submitted }],
    groups: groups.map((group) => ({
      department: group.department,
      invited: group.invited,
      submitted: group.submitted,
      participationPercent: group.invited ? Math.round(group.submitted / group.invited * 100) : 0,
      suppressed: group.submitted < 5,
      recurringNeeds: group.submitted < 5 ? [] : [{ label: `Need ${group.department}`, count: group.submitted }],
      blockers: group.submitted < 5 || !group.barrier ? [] : [{ label: group.barrier, count: group.submitted }],
    })),
  });
}

function exposedCategories(report: AssessmentWorkspace["reporting"][number]) {
  return [
    ...report.profiles,
    ...report.barriers,
    ...report.useCases,
    ...report.cohorts,
    ...report.groups.flatMap((group) => [...group.recurringNeeds, ...group.blockers]),
  ];
}

const sixAndOne = protectedReport([
  { department: "A", invited: 6, submitted: 6, barrier: "Barrier A" },
  { department: "B", invited: 1, submitted: 1, barrier: "Barrier B private" },
]);
check(sixAndOne.disclosure.mode === "complementary_suppressed", "Six plus one triggers complementary suppression");
check(exposedCategories(sixAndOne).length === 0, "Six plus one publishes no subtractable category values");
check(sixAndOne.groups.every((group) => group.suppressed), "The neighbouring visible group is also withheld");
check(sixAndOne.invited === 7 && sixAndOne.submitted === 7, "Safe participation counts remain factual");

const fiveAndFour = protectedReport([
  { department: "A", invited: 5, submitted: 5, barrier: "Guidance" },
  { department: "B", invited: 4, submitted: 4, barrier: "Time" },
]);
check(fiveAndFour.disclosure.mode === "complementary_suppressed" && exposedCategories(fiveAndFour).length === 0, "Five plus four cannot reveal the four-response group");

const oneSuppressedAmongSeveral = protectedReport([
  { department: "A", invited: 6, submitted: 6, barrier: "Guidance" },
  { department: "B", invited: 7, submitted: 7, barrier: "Time" },
  { department: "C", invited: 2, submitted: 2, barrier: "Tools private" },
]);
check(exposedCategories(oneSuppressedAmongSeveral).length === 0, "One small group suppresses totals and all neighbouring category breakdowns");

const multipleSuppressed = protectedReport([
  { department: "A", invited: 6, submitted: 6, barrier: "Guidance" },
  { department: "B", invited: 2, submitted: 2, barrier: "Time private" },
  { department: "C", invited: 3, submitted: 3, barrier: "Tools private" },
]);
check(multipleSuppressed.disclosure.mode === "complementary_suppressed" && exposedCategories(multipleSuppressed).length === 0, "Multiple small groups remain non-reconstructable");

const zeroResponse = protectedReport([
  { department: "A", invited: 6, submitted: 6, barrier: "" },
  { department: "B", invited: 4, submitted: 0, barrier: "" },
]);
check(zeroResponse.disclosure.mode === "available", "A zero-response department contributes no private category value");
check(zeroResponse.groups.find((group) => group.department === "B")?.suppressed === true, "Zero-response department findings remain suppressed");
check(zeroResponse.barriers.length === 0, "Missing and no-current-barrier values do not become fabricated barrier categories");

const overlappingV2 = protectedReport([
  { department: "A", invited: 6, submitted: 6, barrier: "V2 A" },
  { department: "B", invited: 1, submitted: 1, barrier: "V2 private" },
], "campaign-v2");
check(overlappingV2.campaignId !== sixAndOne.campaignId && overlappingV2.disclosure.mode === "complementary_suppressed", "Overlapping framework-version campaigns are protected independently");

const campaign: AssessmentCampaignView = {
  id: "campaign-v3", title: "Fictional campaign", purpose: "Assurance", frameworkTitle: "Comprehensive AI Capability Assessment", questionnaireVersion: "v3", businessObjectives: [], departments: ["A", "B"], status: "closed", closingDate: null, ownerName: "Named Owner", sharingPolicy: "campaign_owner_summary", invited: 7, submitted: 7, participationPercent: 100, participantEmployeeIds: [], createdAt: "2026-10-20T09:00:00.000Z",
};
const suppressedCsv = buildAssessmentCampaignCsv(campaign, sixAndOne);
check(!suppressedCsv.includes("Barrier B private") && !suppressedCsv.includes("Barrier A"), "CSV contains no reconstructable category values");
check(suppressedCsv.includes("Withheld to prevent reconstruction") && suppressedCsv.includes('"Submitted","7"'), "CSV retains participation and explains complementary suppression");

const intelligence = fictionalIntelligence(sixAndOne);
const executiveContract = buildEmployerExecutiveReportContract(intelligence, intelligence.workforce.reports[0]);
const executiveMarkup = renderToStaticMarkup(createElement(EmployerExecutiveReport, { report: executiveContract }));
for (const privateValue of ["Alex Namedperson", "Priya Private", "Sensitive free-text note", "Named Owner"]) {
  check(!executiveMarkup.includes(privateValue), `Executive output excludes ${privateValue}`);
}
check(executiveMarkup.includes("Owner: Shared") && executiveMarkup.includes("Persisted imported transaction history covers"), "Executive output uses a role owner and explicit finance period language");

const assessmentsSource = readFileSync(new URL("../components/levytate-mvp/AssessmentsModule.tsx", import.meta.url), "utf8");
const insightsSource = readFileSync(new URL("../components/levytate-mvp/EmployerInsightsModule.tsx", import.meta.url), "utf8");
check(assessmentsSource.includes("report.disclosure") && insightsSource.includes("selected.disclosure"), "Assessment and Insights presentations consume the shared disclosure contract");
check(!`${assessmentsSource}\n${insightsSource}`.includes("Levy utilisation"), "Synthetic levy utilisation remains absent");

console.log(`Launch Release 4 assurance validation passed (${assertions} assertions).`);

function fictionalIntelligence(report: AssessmentWorkspace["reporting"][number]): EmployerIntelligenceResponse {
  return {
    generatedAt: "2026-10-20T09:00:00.000Z",
    organisation: { id: "org-fictional", name: "Fictional Employer" },
    role: "Apprenticeship Lead",
    overview: {
      signals: [{ metricId: "operational-attention", label: "Items requiring attention", value: 1, detail: "Sensitive free-text note", availability: "available", evidenceAt: "2026-10-20T09:00:00.000Z" }],
      priorities: [{ id: "operation:1", level: "High", title: "Priya Private needs a review", why: "Sensitive free-text note", subject: "Priya Private", owner: "Alex Namedperson", ownerRole: "Shared", nextStep: "Sensitive free-text note", href: "/levytate/app?module=Learners" }],
      recentActivityCount: 0,
      sourceStatus: [],
    },
    workforce: { sourceAvailable: true, message: "", reports: [{
      campaignId: report.campaignId,
      campaignTitle: "Named Owner campaign",
      campaignPurpose: "Priya Private development",
      frameworkTitle: "Comprehensive AI Capability Assessment",
      questionnaireVersion: "v3",
      campaignStatus: "closed",
      closingDate: null,
      createdAt: "2026-10-01T00:00:00.000Z",
      definition: report.definition,
      invited: report.invited,
      submitted: report.submitted,
      nonResponse: Math.max(0, report.invited - report.submitted),
      participationPercent: report.participationPercent,
      suppressionThreshold: report.suppressionThreshold,
      suppressed: !report.disclosure.organisationFindingsAvailable,
      disclosure: report.disclosure,
      profiles: report.profiles,
      dimensions: report.dimensions,
      barriers: report.barriers,
      useCases: report.useCases,
      cohorts: report.cohorts,
      groups: report.groups,
      priorities: [],
      limitation: report.disclosure.reason,
    }] },
    finance: { availability: "available", currentBalancePence: 500000, balanceSource: "manual", balanceEvidenceAt: "2026-09-30", importedPeriod: { from: "2026-08-01", to: "2026-09-30" }, latestImportAt: "2026-10-01T10:00:00.000Z", contributionsPence: 200000, apprenticeshipSpendPence: 75000, expiredPence: 10000, unclassifiedCount: 1, unclassifiedPence: 5000, providerSpend: [], programmeSpend: [], missingInformation: [] },
    metricCatalogue: [],
    limitations: ["Fictional evidence only."],
  };
}
