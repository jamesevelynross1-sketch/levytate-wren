import type { AssessmentWorkspace } from "@/lib/levytate/assessments/api";

type ProtectedReport = AssessmentWorkspace["reporting"][number];
type UnprotectedReport = Omit<ProtectedReport, "disclosure" | "groups"> & {
  disclosure?: ProtectedReport["disclosure"];
  groups: Array<Omit<ProtectedReport["groups"][number], "suppressionReason"> & {
    suppressionReason?: ProtectedReport["groups"][number]["suppressionReason"];
  }>;
};

/** Applies the one disclosure policy consumed by UI, Insights, print and CSV. */
export function applyAssessmentAggregateDisclosure(report: UnprotectedReport): ProtectedReport {
  const threshold = report.suppressionThreshold;
  const campaignSuppressed = report.submitted < threshold;
  const hasPositiveSmallGroup = report.groups.some((group) => group.submitted > 0 && group.submitted < threshold);
  const complementarySuppressed = !campaignSuppressed && hasPositiveSmallGroup;
  const findingsAvailable = !campaignSuppressed && !complementarySuppressed;
  const mode = campaignSuppressed ? "campaign_suppressed" : complementarySuppressed ? "complementary_suppressed" : "available";
  const reason = campaignSuppressed
    ? `Aggregate findings are withheld until at least ${threshold} employees have submitted.`
    : complementarySuppressed
      ? `Aggregate category and department findings are withheld because at least one department has between 1 and ${threshold - 1} submitted responses; publishing totals or neighbouring groups could reveal that department by subtraction.`
      : "Aggregate findings meet the campaign and department disclosure thresholds.";

  return {
    ...report,
    profiles: findingsAvailable ? report.profiles : [],
    dimensions: findingsAvailable ? report.dimensions : [],
    barriers: findingsAvailable ? report.barriers : [],
    useCases: findingsAvailable ? report.useCases : [],
    cohorts: findingsAvailable ? report.cohorts : [],
    disclosure: {
      mode,
      organisationFindingsAvailable: findingsAvailable,
      departmentFindingsAvailable: findingsAvailable,
      reason,
      residualRisk: "The policy reduces straightforward reconstruction risk but does not guarantee anonymity across external datasets, repeated releases or colluding recipients.",
    },
    groups: report.groups.map((group) => {
      const belowThreshold = group.submitted < threshold;
      const suppressed = belowThreshold || complementarySuppressed || campaignSuppressed;
      return {
        ...group,
        suppressed,
        suppressionReason: belowThreshold ? "threshold" : suppressed ? "complementary" : null,
        recurringNeeds: suppressed ? [] : group.recurringNeeds,
        blockers: suppressed ? [] : group.blockers,
      };
    }),
  };
}
