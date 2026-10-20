import type { AssessmentCampaignView, AssessmentWorkspace } from "@/lib/levytate/assessments/api";

export function buildAssessmentCampaignCsv(campaign: AssessmentCampaignView, report: AssessmentWorkspace["reporting"][number]) {
  const rows: Array<Array<string | number>> = [
    ["LevyTate aggregate assessment report"],
    ["Campaign", campaign.title],
    ["Framework", campaign.frameworkTitle],
    ["Invited", report.invited],
    ["Submitted", report.submitted],
    ["Outstanding", Math.max(0, report.invited - report.submitted)],
    ["Participation", `${report.participationPercent}%`],
    [],
    ["Department", "Invited", "Submitted", "Participation", "Aggregate findings"],
    ...report.groups.map((group) => [group.department, group.invited, group.submitted, `${group.participationPercent}%`, group.suppressed ? suppressionLabel(group.suppressionReason, report.suppressionThreshold) : "Available"]),
  ];
  if (report.disclosure.organisationFindingsAvailable) {
    rows.push([], ["Dimension", "Organisation value"], ...report.dimensions.map((item) => [item.label, item.value]));
    rows.push([], ["Development profile", "Count"], ...report.profiles.map((item) => [item.label, item.count]));
    rows.push([], ["Barrier", "Count"], ...report.barriers.map((item) => [item.label, item.count]));
    rows.push([], ["Workplace use pattern", "Count"], ...report.useCases.map((item) => [item.label, item.count]));
    rows.push([], ["Development cohort", "Count"], ...report.cohorts.map((item) => [item.label, item.count]));
  }
  rows.push([], ["Methodology", report.definition], ["Privacy", report.disclosure.reason], ["Residual disclosure risk", report.disclosure.residualRisk]);
  return rows.map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(",")).join("\n");
}

function suppressionLabel(reason: AssessmentWorkspace["reporting"][number]["groups"][number]["suppressionReason"], threshold: number) {
  return reason === "complementary" ? "Withheld to prevent reconstruction" : `Suppressed below ${threshold}`;
}
