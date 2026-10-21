export const liftFrameworkKey = "lift-workforce-v1";
export const liftQuestionnaireVersion = "lift-workforce-questionnaire-v1";
export const liftInterpretationVersion = "lift-workforce-rules-v1";

export const liftCapabilities = [
  "think_clearly",
  "see_better_ways",
  "work_intelligently_with_ai",
  "make_information_useful",
  "protect_trust",
  "make_yourself_understood",
  "help_people_succeed",
  "turn_priorities_into_progress",
  "grow_through_change",
  "create_lasting_value",
] as const;

export type LiftCapability = (typeof liftCapabilities)[number];
export type LiftEvidenceState = "supported" | "emerging" | "insufficient" | "contradictory" | "constrained";
export type LiftEvidenceSource = "employee_task" | "employee_report" | "manager_observation" | "workplace_condition" | "operational_baseline" | "measured_outcome";
export type LiftOpportunityState = "signal_identified" | "work_context_confirmed" | "change_tested" | "outcome_evidenced" | "paused" | "not_supported" | "no_improvement";

export const liftCapabilityLabels: Record<LiftCapability, string> = {
  think_clearly: "Think clearly",
  see_better_ways: "See better ways",
  work_intelligently_with_ai: "Work intelligently with AI",
  make_information_useful: "Make information useful",
  protect_trust: "Protect trust",
  make_yourself_understood: "Make yourself understood",
  help_people_succeed: "Help people succeed",
  turn_priorities_into_progress: "Turn priorities into progress",
  grow_through_change: "Grow through change",
  create_lasting_value: "Create lasting value",
};

export type LiftQuestionOption = { value: string; label: string };

export type LiftQuestion = {
  id: string;
  episode: string;
  capabilityIds: LiftCapability[];
  evidenceType: "structured_judgement" | "interpretation" | "short_work_sample" | "anchored_experience" | "unscored_context";
  prompt: string;
  helpText: string;
  type: "single_choice" | "multi_choice" | "long_text";
  required: boolean;
  scored: boolean;
  options?: LiftQuestionOption[];
};

export type LiftAnswerValue = string | string[] | null;
export type LiftAnswerMap = Record<string, LiftAnswerValue>;

export type LiftCapabilityFinding = {
  capabilityId: LiftCapability;
  label: string;
  state: LiftEvidenceState;
  evidenceIds: string[];
  contradictoryEvidenceIds: string[];
  limitation: string;
};

export type LiftEvidenceReference = {
  id: string;
  source: LiftEvidenceSource;
  version: string;
  recordedAt: string;
  subject: string;
  permissions: "private_employee" | "released_pair" | "authorised_employer" | "aggregate_only";
  description: string;
  limitations: string[];
  quantity?: { value: number; unit: string; population: string; period: string };
};

export type LiftOpportunity = {
  id: string;
  title: string;
  capabilityIds: LiftCapability[];
  capabilityEvidence: string;
  workThatCouldImprove: string;
  constraint: string;
  outcomeWorthPursuing: string;
  relationship: "supported" | "hypothesis";
  supportingEvidenceIds: string[];
  contradictoryEvidenceIds: string[];
  missingInputs: string[];
  decisionQuestion: string;
  evidenceNeeded: string[];
  interpretationVersion: string;
  generatedAt: string;
  state: LiftOpportunityState;
};

export type LiftDecisionOption = {
  id: string;
  label: string;
  addresses: string;
  assumptions: string[];
  commitments: string[];
  costs: string[];
  drawbacks: string[];
  remainsUnverified: string[];
};

export type LiftCapacityScenario = {
  affectedPeople: number | null;
  minutesReleasedPerPersonPerWeek: number | null;
  applicableWeeks: number | null;
  realisedFraction: number | null;
  employerLoadedHourlyRate: number | null;
  basis: "reported_estimate" | "modelled_scenario" | "measured_evidence";
  period: string;
};

export type LiftValueResult = {
  hours: number | null;
  capacityEquivalentValue: number | null;
  label: string;
  limitations: string[];
};

export type LiftDecision = {
  id: string;
  opportunityId: string;
  status: "selected" | "deferred" | "gather_evidence";
  selectedOptionId: string;
  rationale: string;
  owner: string;
  intendedMeasure: string;
  recordedAt: string;
  assumptions: Array<{ id: string; label: string; value: string; unit: string | null; status: "reported" | "reviewed" | "measured" }>;
  valueScenario: LiftCapacityScenario | null;
  sharedBenefitIds: string[];
};

export type LiftProofRecord = {
  opportunityId: string;
  revision: number;
  state: LiftOpportunityState;
  baseline: LiftEvidenceReference | null;
  outcome: LiftEvidenceReference | null;
  agreedScope: string;
  owner: string;
  intendedMeasure: string;
  reviewedBy: string | null;
  verification: "not_reviewed" | "internal_review" | "external_review";
  otherRelevantChanges: string[];
  limitations: string[];
  followUpAt: string | null;
  updatedAt: string;
};

export type LiftWorkspace = {
  enabled: boolean;
  generatedAt: string;
  role: "Employee" | "Line Manager" | "Apprenticeship Lead" | "Employer Admin";
  framework: { key: string; questionnaireVersion: string; interpretationVersion: string; questions: LiftQuestion[] };
  coverage: { invited: number; submitted: number; workplacePerspectives: number; applicablePopulation: number; evidenceFrom: string | null; evidenceTo: string | null };
  assessment: { id: string; status: "not_started" | "draft" | "submitted"; currentQuestionIndex: number; answers: LiftAnswerMap; findings: LiftCapabilityFinding[]; managerPerspectiveStatus: "not_added" | "submitted" | "released"; releasedManagerObservation: { id: string; observedWork: string; concreteExamples: string[]; suitableOpportunity: string; intendedOutcome: string; workplaceConditions: string[] } | null } | null;
  manager: { teamContextSubmitted: boolean; directReports: Array<{ employeeId: string; employeeName: string; perspectiveStatus: "not_started" | "draft" | "submitted"; employeeFindingsReleased: boolean; employeeFindings: LiftCapabilityFinding[] }> } | null;
  availableEmployees: Array<{ employeeId: string; employeeName: string; department: string; managerEmployeeId: string | null }>;
  opportunities: LiftOpportunity[];
  decisions: LiftDecision[];
  proofs: LiftProofRecord[];
  selectedOpportunityId: string | null;
  historicalAssessmentsAvailable: boolean;
  privacyNotice: string;
};

export type LiftAction =
  | { action: "invite_people"; title: string; businessObjective: string; employeeIds: string[]; frameworkKey: string; questionnaireVersion: string; interpretationVersion: string; idempotencyKey: string }
  | { action: "save_assessment"; assessmentId: string; answers: LiftAnswerMap; currentQuestionIndex: number; expectedRevision: number; idempotencyKey: string }
  | { action: "submit_assessment"; assessmentId: string; expectedRevision: number; idempotencyKey: string }
  | { action: "save_team_context"; purpose: string; workflows: string; friction: string; expectedChanges: string; availableSupport: string; expectedRevision: number; idempotencyKey: string }
  | { action: "save_manager_perspective"; employeeId: string; observations: Record<string, unknown>; expectedRevision: number; idempotencyKey: string }
  | { action: "submit_manager_perspective"; employeeId: string; expectedRevision: number; idempotencyKey: string }
  | { action: "record_employee_context"; managerObservationId: string; context: string; disputed: boolean; idempotencyKey: string }
  | { action: "record_decision"; opportunityId: string; decision: Omit<LiftDecision, "id" | "recordedAt" | "opportunityId">; idempotencyKey: string }
  | { action: "record_proof"; opportunityId: string; proof: Omit<LiftProofRecord, "opportunityId" | "updatedAt">; expectedRevision: number; idempotencyKey: string };
