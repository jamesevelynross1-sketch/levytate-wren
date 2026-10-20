import { calculateLevyFinance } from "@/lib/levytate/finance/calculations";
import type { LevyFinanceState } from "@/lib/levytate/finance/types";
import type { AssessmentWorkspace } from "@/lib/levytate/assessments/api";
import { employerIntelligenceMetricCatalogue } from "@/lib/levytate/intelligence/metric-catalogue";
import type {
  EmployerIntelligenceResponse,
  FinanceIntelligence,
  IntelligencePriority,
  WorkforceIntelligenceReport,
} from "@/lib/levytate/intelligence/types";
import type { OperationsResponse } from "@/lib/levytate/mvp/operations-centre";
import type { LevyTateWorkspaceBootstrap } from "@/lib/levytate/mvp/api";

type SourceResult<T> = { ok: true; value: T } | { ok: false; message: string };

const activeLearnerStates = new Set(["enrolled", "assessment_preparation", "in_assessment", "break_in_learning"]);
const upcomingEnrolmentStates = new Set(["Ready for provider", "Submitted to provider", "Enrolment in progress"]);
const decisionOwners = new Set(["Line Manager", "Apprenticeship Lead", "Employer Admin"]);

export function buildEmployerIntelligence(input: {
  generatedAt?: string;
  workspace: SourceResult<LevyTateWorkspaceBootstrap>;
  operations: SourceResult<OperationsResponse>;
  assessments: SourceResult<AssessmentWorkspace>;
  finance: SourceResult<LevyFinanceState>;
}): EmployerIntelligenceResponse {
  if (!input.workspace.ok) throw new Error("Employer intelligence requires the authorised workspace source.");
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const { data, meta } = input.workspace.value;
  if (meta.userRole !== "Apprenticeship Lead" && meta.userRole !== "Employer Admin") {
    throw new Error("Employer intelligence is restricted to employer reporting roles.");
  }

  const decisions = data.applications.filter((application) => decisionOwners.has(application.currentOwner));
  const activeLearners = data.learnerRecords.filter((record) => record.recordStatus === "Active" && activeLearnerStates.has(record.lifecycleStatus));
  const upcomingEnrolments = data.enrolments.filter((enrolment) => upcomingEnrolmentStates.has(enrolment.status));
  const assessmentReports = input.assessments.ok ? buildWorkforceReports(input.assessments.value) : [];
  const latestAssessment = assessmentReports[0] ?? null;
  const priorities = buildPriorities(input.workspace.value, input.operations);
  const operationsAt = input.operations.ok ? input.operations.value.generatedAt : null;

  return {
    generatedAt,
    organisation: { id: meta.organisationId, name: meta.organisationName },
    role: meta.userRole,
    overview: {
      signals: [
        {
          metricId: "applications-awaiting-decision",
          label: "Applications awaiting a decision",
          value: decisions.length,
          detail: decisions.length ? "Manager or employer approval is still required." : "No application decisions are currently outstanding.",
          availability: "available",
          evidenceAt: latestDate(decisions.map((application) => application.updatedAt)) ?? generatedAt,
        },
        {
          metricId: "active-learners",
          label: "Active learners",
          value: activeLearners.length,
          detail: "Enrolled, assessment-stage and Break in Learning records.",
          availability: "available",
          evidenceAt: latestDate(activeLearners.map((record) => record.updatedAt)) ?? generatedAt,
        },
        {
          metricId: "operational-attention",
          label: "Items requiring attention",
          value: input.operations.ok ? input.operations.value.totalAttentionItems : null,
          detail: input.operations.ok ? "Current Operations Centre conditions and actions." : input.operations.message,
          availability: input.operations.ok ? "available" : "unavailable",
          evidenceAt: operationsAt,
        },
        {
          metricId: "upcoming-enrolments",
          label: "Upcoming enrolments",
          value: upcomingEnrolments.length,
          detail: "Approved records moving through provider and enrolment preparation.",
          availability: "available",
          evidenceAt: latestDate(upcomingEnrolments.map((enrolment) => enrolment.updatedAt)) ?? generatedAt,
        },
        {
          metricId: "assessment-participation",
          label: "Assessment participation",
          value: latestAssessment ? `${latestAssessment.participationPercent}%` : null,
          detail: latestAssessment
            ? `${latestAssessment.submitted} submitted of ${latestAssessment.invited} invited · ${latestAssessment.campaignTitle}`
            : input.assessments.ok ? "No employer assessment campaign is available." : input.assessments.message,
          availability: latestAssessment ? "available" : "unavailable",
          evidenceAt: latestAssessment?.createdAt ?? null,
        },
      ],
      priorities,
      recentActivityCount: input.operations.ok ? input.operations.value.recentActivity.length : null,
      sourceStatus: [
        { source: "Applications and enrolments", available: true, message: "Authorised workspace records loaded." },
        { source: "Operations Centre", available: input.operations.ok, message: input.operations.ok ? `Generated ${input.operations.value.generatedAt}.` : input.operations.message },
        { source: "Workforce assessments", available: input.assessments.ok, message: input.assessments.ok ? "Campaign aggregates loaded." : input.assessments.message },
        { source: "DAS finance", available: input.finance.ok, message: input.finance.ok ? "Imported finance records loaded." : input.finance.message },
      ],
    },
    workforce: {
      reports: assessmentReports,
      sourceAvailable: input.assessments.ok,
      message: input.assessments.ok
        ? assessmentReports.length ? "Each view is pinned to one immutable campaign and framework version." : "No employer assessment campaign is available."
        : input.assessments.message,
    },
    finance: input.finance.ok ? buildFinance(input.finance.value) : unavailableFinance(input.finance.message),
    metricCatalogue: [...employerIntelligenceMetricCatalogue],
    limitations: [
      "Assessment findings are self-reported development evidence, not demonstrated competence.",
      "Non-response is reported separately and is never interpreted as low capability.",
      "Financial information reflects imported DAS records and confirmed balance evidence; it is not live DAS connectivity.",
      "Trends are omitted when the available records do not support a reliable historical comparison.",
    ],
  };
}

function buildPriorities(workspace: LevyTateWorkspaceBootstrap, operations: SourceResult<OperationsResponse>): IntelligencePriority[] {
  const employeeById = new Map(workspace.data.employees.map((employee) => [employee.id, employee]));
  const applicationPriorities = workspace.data.applications
    .filter((application) => decisionOwners.has(application.currentOwner))
    .sort((left, right) => left.updatedAt.localeCompare(right.updatedAt))
    .map<IntelligencePriority>((application) => {
      const employee = employeeById.get(application.employeeId);
      return {
        id: `application:${application.id}`,
        level: application.currentOwner === "Line Manager" ? "Medium" : "High",
        title: application.currentOwner === "Line Manager" ? "Manager decision required" : "Final employer decision required",
        why: `${application.status}. The application cannot progress until the recorded decision owner acts.`,
        subject: employee?.name ?? "Authorised application",
        owner: application.currentOwner,
        nextStep: "Open the application and record the appropriate decision.",
        href: `/levytate/app?module=Applications&application=${encodeURIComponent(application.id)}`,
      };
    });
  const operationalPriorities = operations.ok
    ? [...new Map(Object.values(operations.value.queues).flat()
      .filter((item) => item.persistentActionStatus !== "completed" && item.persistentActionStatus !== "cancelled")
      .sort((left, right) => left.priorityRank - right.priorityRank || (left.dueDate || "9999").localeCompare(right.dueDate || "9999"))
      .map((item) => [item.sourceKey, item] as const)).values()]
      .map<IntelligencePriority>((item) => ({
        id: `operation:${item.id}`,
        level: item.priorityLevel === "Informational" ? "Low" : item.priorityLevel,
        title: item.reason,
        why: `${item.programmeName}${item.timingLabel ? ` · ${item.timingLabel}` : ""}`,
        subject: item.learnerName,
        owner: item.persistentOwnerDisplayName || item.ownerType,
        nextStep: item.actionLabel,
        href: item.actionUrl,
      }))
    : [];
  return [...operationalPriorities, ...applicationPriorities].slice(0, 6);
}

function buildWorkforceReports(workspace: AssessmentWorkspace): WorkforceIntelligenceReport[] {
  return workspace.reporting.flatMap((report) => {
    const campaign = workspace.campaigns.find((item) => item.id === report.campaignId);
    if (!campaign) return [];
    const suppressed = report.submitted < report.suppressionThreshold;
    const review = campaign.closingDate ? `Review after ${formatDate(campaign.closingDate)} or when the campaign closes.` : "Review when the campaign closes or evidence materially changes.";
    const priorities: WorkforceIntelligenceReport["priorities"] = [];
    if (!suppressed) {
      const lowestDimension = [...report.dimensions].sort((left, right) => left.value - right.value)[0];
      if (lowestDimension) priorities.push({
        id: "dimension",
        finding: `${lowestDimension.label} is the lowest current evidence dimension.`,
        evidence: `${lowestDimension.value}/100 across ${report.submitted} submitted responses.`,
        group: "Selected campaign population",
        intervention: "Agree a short, practical development activity and an evidence-based follow-up.",
        rationale: "A focused workplace activity can test whether support and opportunity improve applied evidence.",
        owner: campaign.ownerName,
        review,
        href: "/levytate/app?module=Assessments",
      });
      const topBarrier = report.barriers[0];
      if (topBarrier) priorities.push({
        id: "barrier",
        finding: `${topBarrier.label} is the most frequently reported workplace barrier.`,
        evidence: `${topBarrier.count} of ${report.submitted} submitted responses reported this condition.`,
        group: "Selected campaign population",
        intervention: barrierIntervention(topBarrier.label),
        rationale: "Workplace conditions should be addressed separately from assumptions about individual capability.",
        owner: campaign.ownerName,
        review,
        href: "/levytate/app?module=Assessments",
      });
      const topUseCase = report.useCases[0];
      if (topUseCase) priorities.push({
        id: "use-case",
        finding: `${topUseCase.label} is the leading reported workplace use pattern.`,
        evidence: `${topUseCase.count} submitted responses contributed this pattern.`,
        group: "Selected campaign population",
        intervention: "Select a bounded workplace example, responsible-use guidance and a named enabler for practical testing.",
        rationale: "A real use case makes development relevant while keeping suitability and approval decisions separate.",
        owner: campaign.ownerName,
        review,
        href: "/levytate/app?module=Assessments",
      });
    }
    return [{
      campaignId: campaign.id,
      campaignTitle: campaign.title,
      campaignPurpose: campaign.purpose,
      frameworkTitle: campaign.frameworkTitle,
      questionnaireVersion: campaign.questionnaireVersion,
      campaignStatus: campaign.status,
      closingDate: campaign.closingDate,
      createdAt: campaign.createdAt,
      definition: report.definition,
      invited: report.invited,
      submitted: report.submitted,
      nonResponse: Math.max(0, report.invited - report.submitted),
      participationPercent: report.participationPercent,
      suppressionThreshold: report.suppressionThreshold,
      suppressed,
      profiles: report.profiles,
      dimensions: report.dimensions,
      barriers: report.barriers,
      useCases: report.useCases,
      cohorts: report.cohorts,
      groups: report.groups,
      priorities: priorities.slice(0, 3),
      limitation: suppressed
        ? `Aggregate capability findings are withheld until at least ${report.suppressionThreshold} employees have submitted.`
        : "Self-reported development evidence only. Competence, apprenticeship suitability, funding and prior learning require separate decisions.",
    }];
  }).sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

function buildFinance(state: LevyFinanceState): FinanceIntelligence {
  const summary = calculateLevyFinance(state);
  const spend = state.transactions.filter((transaction) => transaction.category === "apprenticeship_spend");
  const period = state.transactions.length ? {
    from: [...state.transactions].sort((left, right) => left.transactionDate.localeCompare(right.transactionDate))[0].transactionDate,
    to: [...state.transactions].sort((left, right) => right.transactionDate.localeCompare(left.transactionDate))[0].transactionDate,
  } : null;
  const total = (category: string) => state.transactions.filter((item) => item.category === category).reduce((sum, item) => sum + Math.abs(item.amountPence), 0);
  const providerSpend = aggregateSpend(spend.map((item) => ({ label: item.providerName || "Unclassified provider", amountPence: Math.abs(item.amountPence) })));
  const programmeSpend = aggregateSpend(spend.map((item) => ({ label: item.programmeName || "Unclassified programme", amountPence: Math.abs(item.amountPence) })));
  const unclassifiedPence = summary.unknownTransactions.reduce((sum, item) => sum + Math.abs(item.amountPence), 0);
  const missingInformation = [
    !state.transactions.length ? "No DAS transaction records have been imported." : "",
    summary.currentBalance.source === "unavailable" ? "No recorded or manually confirmed levy balance is available." : "",
    spend.some((item) => !item.providerName) ? "Some apprenticeship spend has no provider classification." : "",
    spend.some((item) => !item.programmeName) ? "Some apprenticeship spend has no programme classification." : "",
    summary.unknownTransactions.length ? `${summary.unknownTransactions.length} transaction${summary.unknownTransactions.length === 1 ? "" : "s"} require classification.` : "",
  ].filter(Boolean);
  return {
    availability: state.transactions.length || summary.currentBalance.source !== "unavailable" ? "available" : "unavailable",
    currentBalancePence: summary.currentBalance.amountPence ?? null,
    balanceSource: summary.currentBalance.source,
    balanceEvidenceAt: summary.currentBalance.asOf ?? null,
    importedPeriod: period,
    latestImportAt: state.imports[0]?.importedAt ?? null,
    contributionsPence: state.transactions.length ? total("levy_in") : null,
    apprenticeshipSpendPence: state.transactions.length ? total("apprenticeship_spend") : null,
    expiredPence: state.transactions.length ? total("levy_expiry") : null,
    unclassifiedCount: summary.unknownTransactions.length,
    unclassifiedPence,
    providerSpend,
    programmeSpend,
    missingInformation,
  };
}

function unavailableFinance(message: string): FinanceIntelligence {
  return { availability: "unavailable", currentBalancePence: null, balanceSource: "unavailable", balanceEvidenceAt: null, importedPeriod: null, latestImportAt: null, contributionsPence: null, apprenticeshipSpendPence: null, expiredPence: null, unclassifiedCount: 0, unclassifiedPence: 0, providerSpend: [], programmeSpend: [], missingInformation: [message] };
}

function aggregateSpend(rows: Array<{ label: string; amountPence: number }>) {
  const values = new Map<string, number>();
  rows.forEach((row) => values.set(row.label, (values.get(row.label) ?? 0) + row.amountPence));
  return [...values.entries()].map(([label, amountPence]) => ({ label, amountPence })).sort((left, right) => right.amountPence - left.amountPence || left.label.localeCompare(right.label)).slice(0, 8);
}

function latestDate(values: string[]) { return [...values].filter(Boolean).sort().at(-1) ?? null; }
function formatDate(value: string) { return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`)); }
function barrierIntervention(label: string) {
  if (/guidance/i.test(label)) return "Publish concise responsible-use guidance with clear examples of permitted and prohibited use.";
  if (/time/i.test(label)) return "Agree protected time for a bounded practical learning activity.";
  if (/example|start/i.test(label)) return "Provide role-specific examples and a short facilitated starting session.";
  if (/confidence|accuracy/i.test(label)) return "Use guided practice, verification steps and a named workplace enabler.";
  return "Review the reported workplace condition with the campaign owner and agree a proportionate intervention.";
}
