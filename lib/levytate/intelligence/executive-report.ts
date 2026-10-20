import type { EmployerIntelligenceResponse, IntelligencePriority, WorkforceIntelligenceReport } from "@/lib/levytate/intelligence/types";

export type EmployerExecutiveReportContract = {
  organisationName: string;
  generatedAt: string;
  signals: Array<{ id: string; label: string; value: number | string | null; detail: string }>;
  priorities: Array<{ id: string; title: string; evidence: string; ownerRole: string; nextAction: string }>;
  workforce: null | {
    frameworkTitle: string;
    invited: number;
    submitted: number;
    participationPercent: number;
    limitation: string;
    dimensions: WorkforceIntelligenceReport["dimensions"];
    priorities: Array<{ id: string; finding: string; evidence: string; intervention: string }>;
  };
  finance: EmployerIntelligenceResponse["finance"];
  limitations: string[];
  personalDataExcluded: true;
};

export function buildEmployerExecutiveReportContract(intelligence: EmployerIntelligenceResponse, campaign: WorkforceIntelligenceReport | null): EmployerExecutiveReportContract {
  return {
    organisationName: intelligence.organisation.name,
    generatedAt: intelligence.generatedAt,
    signals: intelligence.overview.signals.map((signal) => ({
      id: signal.metricId,
      label: signal.label,
      value: signal.value,
      detail: executiveSignalDetail(signal.metricId, signal.availability),
    })),
    priorities: intelligence.overview.priorities.map(executivePriority),
    workforce: campaign ? {
      frameworkTitle: campaign.frameworkTitle,
      invited: campaign.invited,
      submitted: campaign.submitted,
      participationPercent: campaign.participationPercent,
      limitation: campaign.limitation,
      dimensions: campaign.dimensions,
      priorities: campaign.priorities.map((priority) => ({ id: priority.id, finding: priority.finding, evidence: priority.evidence, intervention: priority.intervention })),
    } : null,
    finance: intelligence.finance,
    limitations: [...intelligence.limitations],
    personalDataExcluded: true,
  };
}

function executivePriority(priority: IntelligencePriority): EmployerExecutiveReportContract["priorities"][number] {
  const application = priority.id.startsWith("application:");
  return {
    id: priority.id,
    title: application ? "Application decision requires attention" : "Operational action requires attention",
    evidence: application ? "A current application is waiting for its recorded decision owner." : "A current organisation-scoped operational condition remains outstanding.",
    ownerRole: safeOwnerRole(priority.ownerRole),
    nextAction: application ? "Open the authorised application and record the appropriate decision." : "Open the authorised operational record and complete the recorded next step.",
  };
}

function safeOwnerRole(value: string) {
  const roles = new Set(["Employee", "Line Manager", "Apprenticeship Lead", "Employer Admin", "Provider", "Shared", "Organisation"]);
  return roles.has(value) ? value : "Authorised operational owner";
}

function executiveSignalDetail(metricId: string, availability: string) {
  if (availability !== "available") return "Evidence was unavailable at the reporting time.";
  if (metricId === "applications-awaiting-decision") return "Current, non-closed applications requiring a recorded manager or employer decision.";
  if (metricId === "active-learners") return "Distinct active learner records in an active learning state.";
  if (metricId === "operational-attention") return "Distinct current operational conditions and actions requiring attention.";
  if (metricId === "upcoming-enrolments") return "Distinct approved records moving through provider and enrolment preparation.";
  if (metricId === "assessment-participation") return "Participation for the selected immutable campaign and framework version.";
  return "Organisation-scoped evidence available at the reporting time.";
}
