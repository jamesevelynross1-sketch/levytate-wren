import { applyAssessmentAggregateDisclosure } from "@/lib/levytate/assessments/disclosure";
import type { EmployerIntelligenceResponse } from "@/lib/levytate/intelligence/types";

const countMetrics = ["applications-awaiting-decision", "active-learners", "operational-attention", "upcoming-enrolments"] as const;
const sourceNames = new Set(["Applications and enrolments", "Operations Centre", "Workforce assessments", "DAS finance"]);

/** A deliberately narrow aggregate contract, not a general workspace export.
 * Never spread source objects: notes, people, priorities and arbitrary labels are
 * not authorised export fields. Monetary values remain exact integer pence.
 */
export function buildEmployerEvidenceExport(source: EmployerIntelligenceResponse) {
  const finance = source.finance;
  const hasFinance = finance.availability === "available";
  return {
    format: "levytate-employer-evidence",
    version: 1,
    generatedAt: source.generatedAt,
    organisationId: source.organisation.id,
    reportingPeriod: "Current persisted state at generatedAt; financial history uses its explicit imported period.",
    exclusions: ["Individual identifiers, names and contact details", "Free-text notes, priorities and pastoral content", "Raw assessment answers and department labels", "Provider/programme labels and individual financial transactions"],
    metrics: countMetrics.map((id) => {
      const metric = source.overview.signals.find((item) => item.metricId === id);
      const valid = metric?.availability === "available" && typeof metric.value === "number" && Number.isSafeInteger(metric.value) && metric.value >= 0;
      return { id, availability: valid ? "available" : "unavailable", value: valid ? metric.value : null, evidenceAt: metric?.evidenceAt ?? null };
    }),
    sources: source.overview.sourceStatus.filter((item) => sourceNames.has(item.source)).map((item) => ({ source: item.source, available: item.available })),
    workforce: {
      available: source.workforce.sourceAvailable,
      campaigns: source.workforce.sourceAvailable ? source.workforce.reports.map((report) => {
        // Apply the same disclosure policy again at the export boundary. This
        // export deliberately omits all findings, even when publishable on screen.
        const protectedReport = applyAssessmentAggregateDisclosure(report);
        return {
          campaignId: report.campaignId,
          questionnaireVersion: report.questionnaireVersion,
          status: report.campaignStatus,
          createdAt: report.createdAt,
          closingDate: report.closingDate,
          invited: report.invited,
          submitted: report.submitted,
          participationPercent: report.participationPercent,
          suppressionThreshold: report.suppressionThreshold,
          disclosureMode: protectedReport.disclosure.mode,
          findingsIncluded: false,
        };
      }) : [],
    },
    finance: {
      availability: hasFinance ? "available" : "unavailable",
      currency: "GBP",
      unit: "pence",
      currentBalancePence: hasFinance ? money(finance.currentBalancePence) : null,
      balanceSource: hasFinance ? finance.balanceSource : "unavailable",
      balanceEvidenceAt: hasFinance ? finance.balanceEvidenceAt : null,
      importedPeriod: hasFinance ? finance.importedPeriod : null,
      latestImportAt: hasFinance ? finance.latestImportAt : null,
      contributionsPence: hasFinance ? money(finance.contributionsPence) : null,
      apprenticeshipSpendPence: hasFinance ? money(finance.apprenticeshipSpendPence) : null,
      expiredPence: hasFinance ? money(finance.expiredPence) : null,
      unclassifiedCount: hasFinance ? finance.unclassifiedCount : null,
      unclassifiedPence: hasFinance ? money(finance.unclassifiedPence) : null,
    },
    limitations: ["This is aggregate operational evidence, not an employee export, funding claim or competence assessment.", "Unavailable sources remain null; participation is not capability evidence.", "Disclosure controls reduce reconstruction risk but do not guarantee anonymity across repeated releases or external datasets."],
  };
}

function money(value: number | null) { return value !== null && Number.isSafeInteger(value) ? value : null; }
