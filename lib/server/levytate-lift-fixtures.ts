import {
  liftFrameworkKey,
  liftInterpretationVersion,
  liftQuestionnaireVersion,
  type LiftAnswerMap,
  type LiftCapability,
  type LiftDecision,
  type LiftEvidenceReference,
  type LiftProofRecord,
  type LiftWorkspace,
} from "@/lib/levytate/lift/domain";
import { liftQuestionnaire } from "@/lib/levytate/lift/framework";
import { buildLiftOpportunities, interpretLiftAssessment } from "@/lib/server/levytate-lift-interpretation";
import { rubricFor } from "@/lib/server/levytate-lift-rubric";

const generatedAt = "2026-10-21T09:30:00.000Z";

const roles: LiftWorkspace["role"][] = ["Employee", "Line Manager", "Apprenticeship Lead", "Employer Admin"];

export function buildLiftFixtureWorkspace(role: LiftWorkspace["role"]): LiftWorkspace {
  if (!roles.includes(role)) throw new Error("Unsupported Lift fixture role.");
  const reporting = fixtureCase({
    assessmentId: "lift-assessment-reporting",
    employeeId: "lift-employee-reporting",
    work: "Produce the weekly operational report with fewer manual reconciliations",
    outcome: "Release review capacity while preserving report accuracy and decision usefulness",
    capabilities: ["think_clearly", "make_information_useful", "turn_priorities_into_progress"],
    conditions: { time: "Two hours agreed for a bounded trial", tools: "available", access: "Dataset access requires owner approval", supervision: "Fortnightly manager review", suitableWork: "available" },
  });
  const peer = fixtureCase({
    assessmentId: "lift-assessment-peer",
    employeeId: "lift-employee-peer",
    work: "Make shift handovers clearer and help new supervisors use the same decision checks",
    outcome: "Fewer avoidable handover clarifications and more consistent ownership",
    capabilities: ["make_yourself_understood", "help_people_succeed", "create_lasting_value"],
    conditions: { time: "Monthly team learning slot available", tools: "available", access: "available", supervision: "Manager coaching agreed", suitableWork: "available" },
  });
  const constraint = fixtureCase({
    assessmentId: "lift-assessment-constraint",
    employeeId: "lift-employee-constraint",
    work: "Reduce duplicate entry between the scheduling and service systems",
    outcome: "Reduce rework without weakening access controls or service continuity",
    capabilities: ["see_better_ways", "work_intelligently_with_ai", "protect_trust"],
    conditions: { time: "No protected trial time yet", tools: "Approved automation tool unavailable", access: "System owner permission required", supervision: "Support owner not assigned", suitableWork: "A suitable low-risk case exists" },
  });
  reporting.opportunities[0]!.title = "Improve weekly reporting without moving rework downstream";
  peer.opportunities[0]!.title = "Strengthen supervisor handovers through shared practice";
  constraint.opportunities[0]!.title = "Remove access and support barriers before automation training";
  const opportunities = [...reporting.opportunities, ...peer.opportunities, ...constraint.opportunities];
  const first = opportunities[0]!;
  const decisions: LiftDecision[] = [{
    id: "lift-decision-reporting-v1",
    opportunityId: first.id,
    status: "selected",
    selectedOptionId: "bounded-process-trial",
    rationale: "A four-week trial can test the reporting handover without committing to a system replacement.",
    owner: "Operations Reporting Lead",
    intendedMeasure: "Weekly preparation minutes, reconciliation defects and on-time publication",
    recordedAt: "2026-09-12T10:00:00.000Z",
    assumptions: [
      { id: "assumption-people", label: "Affected people", value: "6", unit: "people", status: "reviewed" },
      { id: "assumption-minutes", label: "Minutes released per person per week", value: "35", unit: "minutes", status: "reported" },
      { id: "assumption-weeks", label: "Applicable period", value: "4", unit: "weeks", status: "reviewed" },
      { id: "assumption-realised", label: "Realised fraction", value: "0.75", unit: "fraction", status: "reviewed" },
    ],
    valueScenario: { affectedPeople: 6, minutesReleasedPerPersonPerWeek: 35, applicableWeeks: 4, realisedFraction: 0.75, employerLoadedHourlyRate: null, basis: "modelled_scenario", period: "Four-week fictional trial" },
    sharedBenefitIds: ["reporting-review-capacity-v1"],
  }];
  const proofs: LiftProofRecord[] = [{
    opportunityId: first.id,
    revision: 1,
    state: "outcome_evidenced",
    baseline: quantityEvidence("lift-baseline-reporting", "operational_baseline", 270, "minutes per weekly report", "6-person reporting process", "Four weeks before trial", "2026-09-01T09:00:00.000Z"),
    outcome: quantityEvidence("lift-outcome-reporting", "measured_outcome", 205, "minutes per weekly report", "6-person reporting process", "Four-week trial", "2026-10-10T09:00:00.000Z"),
    agreedScope: "One weekly report, existing authorised data and the six-person reporting process.",
    owner: "Operations Reporting Lead",
    intendedMeasure: "Preparation time and reconciliation defects on the same report population.",
    reviewedBy: "Apprenticeship Lead",
    verification: "internal_review",
    otherRelevantChanges: ["One source-system extract was simplified during week three."],
    limitations: ["Before-and-after change does not by itself prove causation.", "This is illustrative fictional evidence, not a newly measured customer result."],
    followUpAt: "2026-11-14T09:00:00.000Z",
    updatedAt: "2026-10-14T09:00:00.000Z",
  }];
  const selected = first.id;
  return {
    enabled: true,
    generatedAt,
    role,
    framework: { key: liftFrameworkKey, questionnaireVersion: liftQuestionnaireVersion, interpretationVersion: liftInterpretationVersion, questions: [...liftQuestionnaire] },
    coverage: { invited: 8, submitted: 7, workplacePerspectives: 6, applicablePopulation: 7, evidenceFrom: "2026-09-01T09:00:00.000Z", evidenceTo: generatedAt },
    assessment: role === "Employee" ? {
      id: reporting.assessmentId,
      status: "submitted",
      currentQuestionIndex: liftQuestionnaire.length - 1,
      answers: reporting.answers,
      findings: reporting.findings,
      managerPerspectiveStatus: "released",
      releasedManagerObservation: { id: "lift-manager-observation-reporting", observedWork: "Alex prepared the weekly fictional operations brief and checked source limitations before review.", concreteExamples: ["The latest brief separated a missing data source from the recommendation."], suitableOpportunity: "Own a bounded reporting trial with authorised data access.", intendedOutcome: "Release review capacity while preserving report accuracy.", workplaceConditions: ["Two protected hours", "Authorised dataset access", "Fortnightly manager review"] },
    } : null,
    manager: role === "Line Manager" ? {
      teamContextSubmitted: true,
      directReports: [
        { employeeId: "lift-employee-reporting", employeeName: "Alex Morgan", perspectiveStatus: "submitted", employeeFindingsReleased: true, employeeFindings: reporting.findings },
        { employeeId: "lift-employee-peer", employeeName: "Jordan Ellis", perspectiveStatus: "draft", employeeFindingsReleased: false, employeeFindings: [] },
      ],
    } : null,
    availableEmployees: role === "Apprenticeship Lead" || role === "Employer Admin" ? [
      { employeeId: "lift-employee-reporting", employeeName: "Alex Morgan", department: "Operations", managerEmployeeId: "lift-manager" },
      { employeeId: "lift-employee-peer", employeeName: "Jordan Ellis", department: "Customer", managerEmployeeId: "lift-manager" },
      { employeeId: "lift-employee-constraint", employeeName: "Sam Taylor", department: "Finance", managerEmployeeId: "lift-manager-2" },
    ] : [],
    opportunities: role === "Apprenticeship Lead" || role === "Employer Admin" ? opportunities : role === "Employee" ? opportunities.slice(0, 1) : [],
    decisions: role === "Apprenticeship Lead" || role === "Employer Admin" ? decisions : [],
    proofs: role === "Apprenticeship Lead" || role === "Employer Admin" ? proofs : [],
    selectedOpportunityId: selected,
    historicalAssessmentsAvailable: true,
    privacyNotice: "Lift keeps employee tasks, manager observations, workplace conditions and outcomes as distinct evidence. It never reads pastoral support data or averages the two perspectives.",
  };
}

function fixtureCase(input: {
  assessmentId: string;
  employeeId: string;
  work: string;
  outcome: string;
  capabilities: LiftCapability[];
  conditions: { time: string; tools: string; access: string; supervision: string; suitableWork: string };
}) {
  const answers: LiftAnswerMap = Object.fromEntries(liftQuestionnaire.map((item) => [item.id,
    item.type === "long_text" ? `Fictional response for ${item.id} with evidence, uncertainty and a bounded next check.`
      : rubricFor(item.id)?.supportedValues[0] ?? rubricFor(item.id)?.contextValues[0] ?? null,
  ]));
  const interpreted = interpretLiftAssessment({ assessmentId: input.assessmentId, employeeId: input.employeeId, answers, submittedAt: "2026-09-01T09:00:00.000Z" });
  const opportunities = buildLiftOpportunities({
    assessmentId: input.assessmentId,
    employeeId: input.employeeId,
    findings: interpreted.findings,
    employeeEvidence: interpreted.evidence,
    manager: {
      employeeId: input.employeeId,
      observationId: `${input.assessmentId}-observation`,
      observationRevision: 1,
      workflowGroup: "reporting_and_insight",
      observedCapabilityIds: input.capabilities,
      workThatCouldImprove: input.work,
      intendedOutcome: input.outcome,
      concreteExamples: ["The manager recorded a recent fictional example using the authorised workplace-observation workflow."],
      opportunityToObserve: "enough",
      conditions: input.conditions,
      recordedAt: "2026-09-04T09:00:00.000Z",
    },
    generatedAt,
  });
  return { assessmentId: input.assessmentId, answers, findings: interpreted.findings, evidence: interpreted.evidence, opportunities };
}

function quantityEvidence(id: string, source: "operational_baseline" | "measured_outcome", value: number, unit: string, population: string, period: string, recordedAt: string): LiftEvidenceReference {
  return { id, source, version: "lift-proof-v1", recordedAt, subject: "reporting-process", permissions: "authorised_employer", description: `${source === "operational_baseline" ? "Baseline" : "Observed result"} for the fictional reporting trial.`, limitations: ["Fictional validation fixture; not customer evidence."], quantity: { value, unit, population, period } };
}
