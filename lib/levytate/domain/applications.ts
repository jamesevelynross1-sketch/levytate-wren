import type { Learner, ProviderMapping, RequestItem, RequestStatus } from "./types";
import { activeApplicationStatuses } from "./roles";

export function filterBySite<T extends { site: string }>(items: T[], selectedSite: string, allSitesLabel: string) {
  if (selectedSite === allSitesLabel) return items;
  return items.filter((item) => item.site === selectedSite);
}

export function isActiveApplicationStatus(status: RequestStatus) {
  return activeApplicationStatuses.includes(status);
}

export function activeApplicationFor(requests: RequestItem[], employeeName: string) {
  return requests.find((request) => request.name === employeeName && isActiveApplicationStatus(request.status));
}

export function formatShortDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", { month: "short", year: "numeric" }).format(new Date(value));
}

export function decisionNoteFor(status: RequestStatus) {
  const notes: Record<RequestStatus, string> = {
    Draft: "More information requested before this can progress.",
    "Submitted to Line Manager": "Submitted to line manager for review.",
    "Awaiting Manager Review": "Awaiting line manager review.",
    "Declined by Line Manager": "Declined by line manager. Reason captured in review notes.",
    "Approved by Line Manager": "Approved by line manager and ready for apprenticeship lead review.",
    "Submitted to Apprenticeship Lead": "Approved by line manager and sent for final approval.",
    "Awaiting Final Approval": "Awaiting final apprenticeship lead approval.",
    "Declined by Apprenticeship Lead": "Declined by apprenticeship lead. Programme fit to be reviewed.",
    "Approved for Enrolment": "Final approved and ready for provider introduction and enrolment.",
    Withdrawn: "Application withdrawn by the employee.",
    Completed: "Application workflow completed.",
    Cancelled: "Application cancelled.",
  };
  return notes[status];
}

export function findProviderMappingForRequest(request: RequestItem, mappings: ProviderMapping[]) {
  const source = normaliseMatchText(`${request.pathway} ${request.department} ${request.role}`);

  return mappings.find((mapping) => {
    const pathway = normaliseMatchText(mapping.pathway);
    const family = normaliseMatchText(mapping.roleFamily);
    const standard = normaliseMatchText(mapping.standard);

    if (source.includes(pathway) || source.includes(family) || standard.includes(source)) return true;
    if ((source.includes("team leader") || source.includes("operations manager") || source.includes("leadership")) && pathway.includes("leadership")) return true;
    if ((source.includes("data") || source.includes("digital") || source.includes("analyst")) && pathway.includes("digital")) return true;
    if ((source.includes("customer") || source.includes("hire") || source.includes("sales")) && pathway.includes("customer")) return true;
    if ((source.includes("site") || source.includes("installation") || source.includes("construction")) && pathway.includes("installation")) return true;
    if ((source.includes("supply") || source.includes("procurement")) && pathway.includes("supply")) return true;
    return false;
  });
}

export function normaliseMatchText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function readinessScore(learners: Learner[], requests: RequestItem[]) {
  if (learners.length === 0) return 52;
  const participation = Math.min(100, Math.round((learners.filter((learner) => learner.status === "Live learner" || learner.status === "Enrolment").length / learners.length) * 100));
  const completion = Math.round(learners.reduce((sum, learner) => sum + learner.progress, 0) / learners.length);
  const demandAlignment = Math.min(100, 58 + requests.length * 4);
  const leadershipPipeline = learners.filter((learner) => learner.programme === "Leadership & Management").length * 7 + 55;
  return Math.min(96, Math.max(42, Math.round((participation + completion + demandAlignment + leadershipPipeline) / 4)));
}

export function countBy<T, K extends keyof T>(items: T[], key: K) {
  return items.reduce<Record<string, number>>((acc, item) => {
    const value = String(item[key]);
    acc[value] = (acc[value] ?? 0) + 1;
    return acc;
  }, {});
}


