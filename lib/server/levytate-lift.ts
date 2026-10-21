import { createHash } from "node:crypto";
import type { LevyTateBetaSession } from "@/lib/levytate/config/beta-access";
import {
  liftFrameworkKey,
  liftInterpretationVersion,
  liftQuestionnaireVersion,
  type LiftAction,
  type LiftAnswerMap,
  type LiftCapabilityFinding,
  type LiftDecision,
  type LiftOpportunity,
  type LiftProofRecord,
  type LiftWorkspace,
} from "@/lib/levytate/lift/domain";
import { liftQuestionnaire } from "@/lib/levytate/lift/framework";
import { normaliseMvpUserRole } from "@/lib/levytate/mvp/rbac";
import { getLearnerLifecycleServerContext } from "@/lib/server/levytate-learner-lifecycle";
import { isLiftEnabledForOrganisation } from "@/lib/server/levytate-lift-capability";
import { buildLiftOpportunities, interpretLiftAssessment, liftManagerEvidenceId, validateLiftAnswers } from "@/lib/server/levytate-lift-interpretation";
import { calculateLiftCapacityValue, canTransitionLiftProof } from "@/lib/levytate/lift/value";
import { discloseLiftAggregates } from "@/lib/levytate/lift/privacy";
import { getLevyTateSupabaseConfig, supabaseInsert, supabaseSelect, supabaseSelectAll, supabaseUpdate } from "@/lib/server/levytate-supabase";

type EmployeeRow = { id: string; name: string; email: string; department: string; job_title: string; manager_id: string; status: string };
type ParticipantRow = { id: string; campaign_id: string; employee_id: string; manager_employee_id: string; employee_name_snapshot: string; status: string; submitted_at: string | null };
type AssessmentRow = { id: string; campaign_id: string; participant_id: string; employee_id: string; status: "draft" | "submitted"; current_revision: number; active_submission_revision: number | null; current_question_index: number; submitted_at: string | null };
type RevisionRow = { id: string; assessment_id: string; revision_number: number; status: "draft" | "submitted" | "superseded"; answers: unknown; submitted_at: string | null };
type InterpretationRow = { id: string; participant_id: string; findings_snapshot: unknown; evidence_reference_ids: unknown; created_at: string };
type ObservationRow = { id: string; campaign_id: string; participant_id: string; employee_id: string; manager_employee_id: string; status: "draft" | "submitted" | "released" | "revoked"; current_revision: number; active_submission_revision: number | null; submitted_at: string | null };
type ObservationRevisionRow = { observation_id: string; revision_number: number; status: string; observed_work: string; observation_recency: string; opportunity_to_observe: "enough" | "limited" | "not_enough"; support_degree: string; capability_observations: unknown; concrete_examples: unknown; suitable_opportunity: string; intended_outcome: string; condition_time: string; condition_tools: string; condition_access: string; condition_supervision: string; condition_suitable_work: string };
type OpportunityRow = { id: string; campaign_id: string; interpretation_id: string; title: string; capability_ids: unknown; work_that_could_improve: string; named_constraint: string; outcome_worth_pursuing: string; relationship_type: "supported" | "hypothesis"; missing_inputs: unknown; decision_question: string; evidence_needed: unknown; state: LiftOpportunity["state"]; created_at: string };
type OpportunityEvidenceRow = { opportunity_id: string; evidence_id: string; relationship: "supporting" | "contradictory" | "missing_input" };
type DecisionRow = { id: string; opportunity_id: string; decision_version: number; status: LiftDecision["status"]; selected_option_id: string; rationale: string; responsible_owner: string; intended_measure: string; value_scenario: unknown; shared_benefit_ids: unknown; created_at: string };
type AssumptionRow = { id: string; decision_id: string; label: string; value: string; unit: string | null; evidence_status: "reported" | "reviewed" | "measured" };
type ProofRow = { id: string; opportunity_id: string; state: LiftProofRecord["state"]; baseline_evidence_id: string | null; outcome_evidence_id: string | null; agreed_scope: string; responsible_owner: string; intended_measure: string; verification: LiftProofRecord["verification"]; other_relevant_changes: unknown; limitations: unknown; follow_up_at: string | null; revision: number; updated_at: string; reviewed_by_user_id: string | null };
type EvidenceRow = { id: string; source_type: import("@/lib/levytate/lift/domain").LiftEvidenceSource; source_version: string; permissions: import("@/lib/levytate/lift/domain").LiftEvidenceReference["permissions"]; description: string; limitations: unknown; quantity_value: number | null; quantity_unit: string | null; quantity_population: string | null; quantity_period: string | null; recorded_at: string; employee_id: string | null };

export class LevyTateLiftError extends Error {
  constructor(message: string, public readonly status: 400 | 403 | 404 | 409 | 413 | 503 = 400) { super(message); this.name = "LevyTateLiftError"; }
}

const tables = {
  campaigns: "levytate_lift_campaigns",
  participants: "levytate_lift_participants",
  assessments: "levytate_lift_assessments",
  revisions: "levytate_lift_assessment_revisions",
  teamContexts: "levytate_lift_team_context_revisions",
  observations: "levytate_lift_manager_observations",
  observationRevisions: "levytate_lift_manager_observation_revisions",
  employeeContexts: "levytate_lift_employee_observation_contexts",
  evidence: "levytate_lift_evidence_records",
  interpretations: "levytate_lift_interpretations",
  opportunities: "levytate_lift_opportunities",
  opportunityEvidence: "levytate_lift_opportunity_evidence",
  decisions: "levytate_lift_decisions",
  assumptions: "levytate_lift_decision_assumptions",
  proofs: "levytate_lift_proof_records",
  proofEvents: "levytate_lift_proof_events",
} as const;

export async function getLiftWorkspaceForSession(session: LevyTateBetaSession): Promise<LiftWorkspace> {
  const context = await getLearnerLifecycleServerContext(session);
  const role = normaliseMvpUserRole(context.user.role);
  if (role === "Platform Admin") throw new LevyTateLiftError("Lift is unavailable for this role.", 403);
  if (!await isLiftEnabledForOrganisation(context.organisation.id)) throw new LevyTateLiftError("Lift is not enabled for this workspace.", 404);
  const employees = await selectAll<EmployeeRow>(context.organisation.id, "levytate_employees", { status: "eq.Active", order: "name.asc" });
  const employee = employees.find((item) => item.email.trim().toLowerCase() === session.email.trim().toLowerCase()) ?? null;
  if ((role === "Employee" || role === "Line Manager") && !employee) throw new LevyTateLiftError("Your account is not linked to an active employee record.", 403);
  const participants = await selectAll<ParticipantRow>(context.organisation.id, tables.participants, { order: "invited_at.desc" });
  const assessments = await selectAll<AssessmentRow>(context.organisation.id, tables.assessments, { order: "updated_at.desc" });
  const currentAssessment = role === "Employee" && employee ? assessments.find((item) => item.employee_id === employee.id) ?? null : null;
  const revision = currentAssessment ? (await select<RevisionRow>(context.organisation.id, tables.revisions, { assessment_id: `eq.${currentAssessment.id}`, revision_number: `eq.${currentAssessment.current_revision}`, limit: "1" }))[0] ?? null : null;
  const interpretation = currentAssessment ? (await select<InterpretationRow>(context.organisation.id, tables.interpretations, { participant_id: `eq.${currentAssessment.participant_id}`, status: "in.(provisional,reviewed)", order: "created_at.desc", limit: "1" }))[0] ?? null : null;
  const observations = await selectAll<ObservationRow>(context.organisation.id, tables.observations, { order: "updated_at.desc" });
  const observationForEmployee = currentAssessment ? observations.find((item) => item.employee_id === currentAssessment.employee_id && item.campaign_id === currentAssessment.campaign_id) : null;
  const releasedObservationRevision = observationForEmployee?.status === "released" && observationForEmployee.active_submission_revision ? (await select<ObservationRevisionRow>(context.organisation.id, tables.observationRevisions, { observation_id: `eq.${observationForEmployee.id}`, revision_number: `eq.${observationForEmployee.active_submission_revision}`, status: "eq.submitted", limit: "1" }))[0] ?? null : null;
  const manager = role === "Line Manager" && employee ? await managerWorkspace(context.organisation.id, employee, employees, observations, assessments) : null;
  const aggregate = role === "Apprenticeship Lead" || role === "Employer Admin" ? await leaderWorkspace(context.organisation.id, participants) : { opportunities: [], decisions: [], proofs: [] };
  const dates = participants.flatMap((item) => item.submitted_at ? [item.submitted_at] : []);
  return {
    enabled: true,
    generatedAt: new Date().toISOString(),
    role: role as LiftWorkspace["role"],
    framework: { key: liftFrameworkKey, questionnaireVersion: liftQuestionnaireVersion, interpretationVersion: liftInterpretationVersion, questions: [...liftQuestionnaire] },
    coverage: {
      invited: new Set(participants.map((item) => item.employee_id)).size,
      submitted: new Set(participants.filter((item) => item.status === "submitted").map((item) => item.employee_id)).size,
      workplacePerspectives: new Set(observations.filter((item) => item.active_submission_revision).map((item) => item.employee_id)).size,
      applicablePopulation: new Set(participants.filter((item) => item.status !== "withdrawn").map((item) => item.employee_id)).size,
      evidenceFrom: dates.sort()[0] ?? null,
      evidenceTo: dates.sort().at(-1) ?? null,
    },
    assessment: currentAssessment ? {
      id: currentAssessment.id,
      status: currentAssessment.status,
      currentQuestionIndex: currentAssessment.current_question_index,
      answers: object<LiftAnswerMap>(revision?.answers),
      findings: interpretation ? object<{ findings?: LiftCapabilityFinding[] }>(interpretation.findings_snapshot).findings ?? [] : [],
      managerPerspectiveStatus: observationForEmployee?.status === "released" ? "released" : observationForEmployee?.active_submission_revision ? "submitted" : "not_added",
      releasedManagerObservation: releasedObservationRevision && observationForEmployee ? { id: observationForEmployee.id, observedWork: releasedObservationRevision.observed_work, concreteExamples: strings(releasedObservationRevision.concrete_examples), suitableOpportunity: releasedObservationRevision.suitable_opportunity, intendedOutcome: releasedObservationRevision.intended_outcome, workplaceConditions: [releasedObservationRevision.condition_time, releasedObservationRevision.condition_tools, releasedObservationRevision.condition_access, releasedObservationRevision.condition_supervision, releasedObservationRevision.condition_suitable_work].filter(Boolean) } : null,
    } : null,
    manager,
    availableEmployees: role === "Apprenticeship Lead" || role === "Employer Admin" ? employees.map((item) => ({ employeeId: item.id, employeeName: item.name, department: item.department, managerEmployeeId: item.manager_id || null })) : [],
    opportunities: aggregate.opportunities,
    decisions: aggregate.decisions,
    proofs: aggregate.proofs,
    selectedOpportunityId: aggregate.opportunities[0]?.id ?? null,
    historicalAssessmentsAvailable: true,
    privacyNotice: "Draft answers remain private. Manager observations are submitted independently before employee findings are released. Lift never reads pastoral support data.",
  };
}

export async function applyLiftActionForSession(session: LevyTateBetaSession, value: unknown) {
  const action = parseAction(value);
  const context = await getLearnerLifecycleServerContext(session);
  const role = normaliseMvpUserRole(context.user.role);
  if (!await isLiftEnabledForOrganisation(context.organisation.id)) throw new LevyTateLiftError("Lift is not enabled for this workspace.", 404);
  const employee = (await select<EmployeeRow>(context.organisation.id, "levytate_employees", { email: `eq.${session.email.trim().toLowerCase()}`, status: "eq.Active", limit: "1" }))[0] ?? null;
  switch (action.action) {
    case "invite_people": await invitePeople(context, role, action); break;
    case "save_assessment": await saveAssessment(context, role, employee, action); break;
    case "submit_assessment": await submitAssessment(context, role, employee, action); break;
    case "save_team_context": await saveTeamContext(context, role, employee, action); break;
    case "save_manager_perspective": await saveManagerPerspective(context, role, employee, action); break;
    case "submit_manager_perspective": await submitManagerPerspective(context, role, employee, action); break;
    case "record_employee_context": await recordEmployeeContext(context, role, employee, action); break;
    case "record_decision": await recordDecision(context, role, action); break;
    case "record_proof": await recordProof(context, role, action); break;
  }
  return getLiftWorkspaceForSession(session);
}

async function invitePeople(context: Awaited<ReturnType<typeof getLearnerLifecycleServerContext>>, role: string, action: Extract<LiftAction, { action: "invite_people" }>) {
  assertRole(role, ["Apprenticeship Lead", "Employer Admin"]);
  if (action.frameworkKey !== liftFrameworkKey || action.questionnaireVersion !== liftQuestionnaireVersion || action.interpretationVersion !== liftInterpretationVersion) throw new LevyTateLiftError("Only the current published Lift assessment can be invited.", 409);
  const ids = uniqueStrings(action.employeeIds, 500);
  if (!ids.length) throw new LevyTateLiftError("Select at least one employee.");
  const employees = await selectAll<EmployeeRow>(context.organisation.id, "levytate_employees", { status: "eq.Active" });
  const selected = employees.filter((item) => ids.includes(item.id));
  if (selected.length !== ids.length) throw new LevyTateLiftError("One or more selected employees are not active in this organisation.", 403);
  const campaignId = stableUuid(context.organisation.id, context.user.id, action.idempotencyKey, "campaign");
  await insert(tables.campaigns, [{ id: campaignId, organisation_id: context.organisation.id, title: required(action.title, 180), business_objective: required(action.businessObjective, 2000), framework_key: liftFrameworkKey, questionnaire_version: liftQuestionnaireVersion, interpretation_version: liftInterpretationVersion, status: "open", created_by: context.user.id, opened_at: new Date().toISOString() }], true);
  const participants = selected.map((item) => ({ id: stableUuid(campaignId, item.id, "participant"), organisation_id: context.organisation.id, campaign_id: campaignId, employee_id: item.id, manager_employee_id: item.manager_id || null, employee_name_snapshot: item.name, department_snapshot: item.department, role_title_snapshot: item.job_title }));
  await insert(tables.participants, participants, true);
  await insert(tables.assessments, participants.map((item) => ({ id: stableUuid(campaignId, item.employee_id, "assessment"), organisation_id: context.organisation.id, campaign_id: campaignId, participant_id: item.id, employee_id: item.employee_id, framework_key: liftFrameworkKey, questionnaire_version: liftQuestionnaireVersion, interpretation_version: liftInterpretationVersion, status: "draft", created_at: new Date().toISOString() })), true);
  await insert(tables.revisions, participants.map((item) => ({ id: stableUuid(campaignId, item.employee_id, "assessment-revision-1"), organisation_id: context.organisation.id, assessment_id: stableUuid(campaignId, item.employee_id, "assessment"), revision_number: 1, status: "draft", answers: {}, employee_context: {}, created_by: context.user.id })), true);
  const managed = participants.filter((item) => item.manager_employee_id && item.manager_employee_id !== item.employee_id);
  await insert(tables.observations, managed.map((item) => ({ id: stableUuid(campaignId, item.employee_id, item.manager_employee_id!, "observation"), organisation_id: context.organisation.id, campaign_id: campaignId, participant_id: item.id, employee_id: item.employee_id, manager_employee_id: item.manager_employee_id, status: "draft" })), true);
  await insert(tables.observationRevisions, managed.map((item) => ({ id: stableUuid(campaignId, item.employee_id, item.manager_employee_id!, "observation-revision-1"), organisation_id: context.organisation.id, observation_id: stableUuid(campaignId, item.employee_id, item.manager_employee_id!, "observation"), revision_number: 1, observed_work: "", observation_recency: "", opportunity_to_observe: "not_enough", support_degree: "not_observed", capability_observations: [], concrete_examples: [], status: "draft", created_by: context.user.id })), true);
}

async function saveAssessment(context: Context, role: string, employee: EmployeeRow | null, action: Extract<LiftAction, { action: "save_assessment" }>) {
  assertRole(role, ["Employee", "Line Manager", "Apprenticeship Lead", "Employer Admin"]);
  if (!employee) throw new LevyTateLiftError("Active employee record required.", 403);
  const assessment = await ownAssessment(context.organisation.id, action.assessmentId, employee.id);
  if (assessment.current_revision !== action.expectedRevision) throw new LevyTateLiftError("The assessment changed; refresh before saving.", 409);
  const answers = sanitiseAnswers(action.answers);
  await supabaseUpdate(config(), tables.revisions, scope(context.organisation.id, { assessment_id: assessment.id, revision_number: assessment.current_revision }), { answers, updated_at: new Date().toISOString() });
  await supabaseUpdate(config(), tables.assessments, scope(context.organisation.id, { id: assessment.id, current_revision: action.expectedRevision }), { current_question_index: Math.max(0, Math.min(liftQuestionnaire.length - 1, Math.floor(action.currentQuestionIndex))), updated_at: new Date().toISOString() });
}

async function submitAssessment(context: Context, role: string, employee: EmployeeRow | null, action: Extract<LiftAction, { action: "submit_assessment" }>) {
  assertRole(role, ["Employee", "Line Manager", "Apprenticeship Lead", "Employer Admin"]);
  if (!employee) throw new LevyTateLiftError("Active employee record required.", 403);
  const assessment = await ownAssessment(context.organisation.id, action.assessmentId, employee.id);
  if (assessment.status === "submitted") return;
  if (assessment.current_revision !== action.expectedRevision) throw new LevyTateLiftError("The assessment changed; refresh before submitting.", 409);
  const revision = (await select<RevisionRow>(context.organisation.id, tables.revisions, { assessment_id: `eq.${assessment.id}`, revision_number: `eq.${assessment.current_revision}`, limit: "1" }))[0];
  if (!revision) throw new LevyTateLiftError("Assessment revision unavailable.", 404);
  const answers = sanitiseAnswers(object<LiftAnswerMap>(revision.answers));
  const validation = validateLiftAnswers(answers);
  if (!validation.valid) throw new LevyTateLiftError(validation.message);
  const now = new Date().toISOString();
  const interpreted = interpretLiftAssessment({ assessmentId: assessment.id, employeeId: employee.id, answers, submittedAt: now });
  await supabaseUpdate(config(), tables.revisions, scope(context.organisation.id, { id: revision.id, status: "draft" }), { status: "submitted", submitted_at: now, updated_at: now });
  await supabaseUpdate(config(), tables.assessments, scope(context.organisation.id, { id: assessment.id, current_revision: action.expectedRevision }), { status: "submitted", active_submission_revision: assessment.current_revision, submitted_at: now, updated_at: now });
  await supabaseUpdate(config(), tables.participants, scope(context.organisation.id, { id: assessment.participant_id }), { status: "submitted", submitted_at: now });
  await insert(tables.evidence, interpreted.evidence.map((item) => ({ id: item.id, organisation_id: context.organisation.id, campaign_id: assessment.campaign_id, employee_id: employee.id, source_type: item.source, source_record_id: assessment.id, source_version: item.version, permissions: item.permissions, description: item.description, limitations: item.limitations, recorded_at: item.recordedAt })), true);
  const interpretationId = stableUuid(assessment.id, String(assessment.current_revision), liftInterpretationVersion);
  await insert(tables.interpretations, [{ id: interpretationId, organisation_id: context.organisation.id, campaign_id: assessment.campaign_id, participant_id: assessment.participant_id, interpretation_version: liftInterpretationVersion, evidence_reference_ids: interpreted.evidence.map((item) => item.id), findings_snapshot: { findings: interpreted.findings }, status: "provisional", created_by: context.user.id }], true);
  await releaseObservationWhenBothSubmitted(context.organisation.id, assessment.participant_id);
}

async function saveTeamContext(context: Context, role: string, employee: EmployeeRow | null, action: Extract<LiftAction, { action: "save_team_context" }>) {
  assertRole(role, ["Line Manager"]); if (!employee) throw new LevyTateLiftError("Active manager record required.", 403);
  const current = await selectAll<{ revision_number: number }>(context.organisation.id, tables.teamContexts, { manager_employee_id: `eq.${employee.id}`, order: "revision_number.desc", limit: "1" });
  if ((current[0]?.revision_number ?? 0) !== action.expectedRevision - 1) throw new LevyTateLiftError("Team context changed; refresh before saving.", 409);
  await insert(tables.teamContexts, [{ id: stableUuid(context.organisation.id, employee.id, String(action.expectedRevision), action.idempotencyKey), organisation_id: context.organisation.id, manager_employee_id: employee.id, revision_number: action.expectedRevision, team_purpose: required(action.purpose, 3000), relevant_workflows: bounded(action.workflows, 5000), recurring_friction: bounded(action.friction, 5000), expected_changes: bounded(action.expectedChanges, 5000), available_support: bounded(action.availableSupport, 5000), status: "submitted", created_by: context.user.id }], true);
}

async function saveManagerPerspective(context: Context, role: string, employee: EmployeeRow | null, action: Extract<LiftAction, { action: "save_manager_perspective" }>) {
  assertRole(role, ["Line Manager"]); if (!employee) throw new LevyTateLiftError("Active manager record required.", 403);
  const observation = await managerObservation(context.organisation.id, employee.id, action.employeeId);
  if (observation.employee_id === observation.manager_employee_id) throw new LevyTateLiftError("A manager cannot submit a Workplace Perspective about themselves.", 403);
  if (observation.current_revision !== action.expectedRevision) throw new LevyTateLiftError("The Workplace Perspective changed; refresh before saving.", 409);
  const safe = observationPayload(action.observations);
  await supabaseUpdate(config(), tables.observationRevisions, scope(context.organisation.id, { observation_id: observation.id, revision_number: observation.current_revision }), { ...safe, updated_at: new Date().toISOString() });
}

async function submitManagerPerspective(context: Context, role: string, employee: EmployeeRow | null, action: Extract<LiftAction, { action: "submit_manager_perspective" }>) {
  assertRole(role, ["Line Manager"]); if (!employee) throw new LevyTateLiftError("Active manager record required.", 403);
  const observation = await managerObservation(context.organisation.id, employee.id, action.employeeId);
  if (observation.status === "submitted" || observation.status === "released") return;
  if (observation.current_revision !== action.expectedRevision) throw new LevyTateLiftError("The Workplace Perspective changed; refresh before submitting.", 409);
  const revision = (await select<ObservationRevisionRow>(context.organisation.id, tables.observationRevisions, { observation_id: `eq.${observation.id}`, revision_number: `eq.${observation.current_revision}`, limit: "1" }))[0];
  if (!revision || (!revision.observed_work.trim() && revision.opportunity_to_observe !== "not_enough")) throw new LevyTateLiftError("Observed work or Not enough opportunity to observe is required.");
  const now = new Date().toISOString();
  await supabaseUpdate(config(), tables.observationRevisions, scope(context.organisation.id, { observation_id: observation.id, revision_number: observation.current_revision }), { status: "submitted", submitted_at: now, updated_at: now });
  await supabaseUpdate(config(), tables.observations, scope(context.organisation.id, { id: observation.id, current_revision: action.expectedRevision }), { status: "submitted", active_submission_revision: observation.current_revision, submitted_at: now, updated_at: now });
  await generateOpportunityWhenBothSubmitted(context, observation, revision, now);
}

async function recordEmployeeContext(context: Context, role: string, employee: EmployeeRow | null, action: Extract<LiftAction, { action: "record_employee_context" }>) {
  assertRole(role, ["Employee", "Line Manager", "Apprenticeship Lead", "Employer Admin"]); if (!employee) throw new LevyTateLiftError("Active employee record required.", 403);
  const observation = (await select<ObservationRow>(context.organisation.id, tables.observations, { id: `eq.${action.managerObservationId}`, employee_id: `eq.${employee.id}`, status: "eq.released", limit: "1" }))[0];
  if (!observation) throw new LevyTateLiftError("Released manager observation unavailable.", 404);
  await insert(tables.employeeContexts, [{ id: stableUuid(observation.id, employee.id, action.idempotencyKey), organisation_id: context.organisation.id, observation_id: observation.id, employee_id: employee.id, context: required(action.context, 5000), disputed: Boolean(action.disputed), created_by: context.user.id }], true);
}

async function recordDecision(context: Context, role: string, action: Extract<LiftAction, { action: "record_decision" }>) {
  assertRole(role, ["Apprenticeship Lead", "Employer Admin"]);
  const opportunity = (await select<OpportunityRow>(context.organisation.id, tables.opportunities, { id: `eq.${action.opportunityId}`, limit: "1" }))[0];
  if (!opportunity) throw new LevyTateLiftError("Opportunity unavailable.", 404);
  const existing = await selectAll<DecisionRow>(context.organisation.id, tables.decisions, { opportunity_id: `eq.${opportunity.id}`, order: "decision_version.desc", limit: "1" });
  const decision = action.decision;
  if (decision.valueScenario) {
    try { calculateLiftCapacityValue(decision.valueScenario); }
    catch { throw new LevyTateLiftError("The capacity scenario contains invalid values."); }
  }
  const decisionId = stableUuid(opportunity.id, context.user.id, action.idempotencyKey);
  await insert(tables.decisions, [{ id: decisionId, organisation_id: context.organisation.id, opportunity_id: opportunity.id, decision_version: (existing[0]?.decision_version ?? 0) + 1, status: decision.status, selected_option_id: required(decision.selectedOptionId, 200), rationale: required(decision.rationale, 5000), responsible_owner: required(decision.owner, 500), intended_measure: required(decision.intendedMeasure, 2000), value_scenario: decision.valueScenario, shared_benefit_ids: uniqueStrings(decision.sharedBenefitIds, 100), created_by: context.user.id }], true);
  await insert(tables.assumptions, decision.assumptions.map((item) => ({ id: stableUuid(decisionId, item.id), organisation_id: context.organisation.id, decision_id: decisionId, label: required(item.label, 500), value: bounded(item.value, 1000), unit: item.unit ? bounded(item.unit, 120) : null, evidence_status: item.status })), true);
}

async function recordProof(context: Context, role: string, action: Extract<LiftAction, { action: "record_proof" }>) {
  assertRole(role, ["Apprenticeship Lead", "Employer Admin"]);
  const opportunity = (await select<OpportunityRow>(context.organisation.id, tables.opportunities, { id: `eq.${action.opportunityId}`, limit: "1" }))[0];
  if (!opportunity) throw new LevyTateLiftError("Opportunity unavailable.", 404);
  const existing = (await select<ProofRow>(context.organisation.id, tables.proofs, { opportunity_id: `eq.${opportunity.id}`, limit: "1" }))[0] ?? null;
  if (existing && existing.revision !== action.expectedRevision) throw new LevyTateLiftError("Proof record changed; refresh before saving.", 409);
  const proof = action.proof;
  const current = proof as LiftProofRecord;
  const decisionRecorded = (await select<DecisionRow>(context.organisation.id, tables.decisions, { opportunity_id: `eq.${opportunity.id}`, limit: "1" })).length > 0;
  if (!canTransitionLiftProof({ current: { ...current, opportunityId: opportunity.id, updatedAt: new Date().toISOString() }, nextState: proof.state, decisionRecorded })) throw new LevyTateLiftError("The required decision, baseline, outcome or review evidence is incomplete.", 409);
  const evidenceRows = [proof.baseline, proof.outcome].filter((item): item is NonNullable<typeof item> => Boolean(item)).map((item) => ({
    id: item.id,
    organisation_id: context.organisation.id,
    campaign_id: opportunity.campaign_id,
    employee_id: null,
    source_type: item.source,
    source_record_id: opportunity.id,
    source_version: bounded(item.version, 120),
    permissions: "authorised_employer",
    description: required(item.description, 5000),
    limitations: uniqueStrings(item.limitations, 30),
    quantity_value: item.quantity?.value ?? null,
    quantity_unit: item.quantity ? required(item.quantity.unit, 120) : null,
    quantity_population: item.quantity ? required(item.quantity.population, 500) : null,
    quantity_period: item.quantity ? required(item.quantity.period, 500) : null,
    recorded_at: item.recordedAt,
    recorded_by: context.user.id,
  }));
  if (evidenceRows.some((item) => !["operational_baseline", "measured_outcome"].includes(item.source_type) || (item.quantity_value !== null && (!Number.isFinite(item.quantity_value) || item.quantity_value < 0)))) throw new LevyTateLiftError("Proof evidence must use a valid non-negative operational measure.");
  await insert(tables.evidence, evidenceRows, true);
  const id = existing?.id ?? stableUuid(opportunity.id, "proof");
  const body = { state: proof.state, baseline_evidence_id: proof.baseline?.id ?? null, outcome_evidence_id: proof.outcome?.id ?? null, agreed_scope: bounded(proof.agreedScope, 5000), responsible_owner: bounded(proof.owner, 500), intended_measure: bounded(proof.intendedMeasure, 2000), reviewed_by_user_id: proof.reviewedBy ? context.user.id : null, verification: proof.verification, other_relevant_changes: proof.otherRelevantChanges, limitations: proof.limitations, follow_up_at: proof.followUpAt, revision: (existing?.revision ?? 0) + 1 };
  if (existing) await supabaseUpdate(config(), tables.proofs, scope(context.organisation.id, { id, revision: action.expectedRevision }), body);
  else await insert(tables.proofs, [{ id, organisation_id: context.organisation.id, opportunity_id: opportunity.id, ...body }]);
  await insert(tables.proofEvents, [{ id: stableUuid(id, action.idempotencyKey), organisation_id: context.organisation.id, proof_record_id: id, opportunity_id: opportunity.id, previous_state: existing?.state ?? null, new_state: proof.state, evidence_reference_ids: [proof.baseline?.id, proof.outcome?.id].filter(Boolean), note: "Proof state recorded through the controlled Lift workflow.", actor_user_id: context.user.id, idempotency_key: action.idempotencyKey }], true);
}

async function managerWorkspace(organisationId: string, manager: EmployeeRow, employees: EmployeeRow[], observations: ObservationRow[], assessments: AssessmentRow[]): Promise<LiftWorkspace["manager"]> {
  const direct = employees.filter((item) => item.manager_id === manager.id);
  const contexts = await selectAll<{ id: string }>(organisationId, tables.teamContexts, { manager_employee_id: `eq.${manager.id}`, status: "eq.submitted", limit: "1" });
  return { teamContextSubmitted: contexts.length > 0, directReports: await Promise.all(direct.map(async (person) => {
    const observation = observations.find((item) => item.manager_employee_id === manager.id && item.employee_id === person.id && item.status !== "revoked");
    const assessment = assessments.find((item) => item.employee_id === person.id && item.campaign_id === observation?.campaign_id);
    const released = Boolean(observation?.active_submission_revision && assessment?.active_submission_revision);
    const interpretation = released && assessment ? (await select<InterpretationRow>(organisationId, tables.interpretations, { participant_id: `eq.${assessment.participant_id}`, status: "in.(provisional,reviewed)", order: "created_at.desc", limit: "1" }))[0] ?? null : null;
    return { employeeId: person.id, employeeName: person.name, perspectiveStatus: observation?.active_submission_revision ? "submitted" : observation ? "draft" : "not_started", employeeFindingsReleased: released, employeeFindings: interpretation ? object<{ findings?: LiftCapabilityFinding[] }>(interpretation.findings_snapshot).findings ?? [] : [] };
  })) };
}

async function leaderWorkspace(organisationId: string, participants: ParticipantRow[]) {
  const submitted = new Set(participants.filter((item) => item.status === "submitted").map((item) => item.employee_id));
  if (submitted.size < 5) return { opportunities: [], decisions: [], proofs: [] };
  const rows = await selectAll<OpportunityRow>(organisationId, tables.opportunities, { order: "updated_at.desc" });
  const interpretations = await selectAll<InterpretationRow>(organisationId, tables.interpretations, {});
  const participantByInterpretation = new Map(interpretations.map((item) => [item.id, item.participant_id]));
  const employeeByParticipant = new Map(participants.map((item) => [item.id, item.employee_id]));
  const links = await selectAll<OpportunityEvidenceRow>(organisationId, tables.opportunityEvidence, {});
  const groups = new Map<string, { row: OpportunityRow; contributors: string[] }>();
  rows.forEach((row) => {
    const key = [row.title, JSON.stringify(row.capability_ids), row.work_that_could_improve, row.named_constraint, row.outcome_worth_pursuing].join("|");
    const current = groups.get(key) ?? { row, contributors: [] };
    const employeeId = employeeByParticipant.get(participantByInterpretation.get(row.interpretation_id) ?? "");
    if (employeeId) current.contributors.push(employeeId);
    groups.set(key, current);
  });
  const disclosed = discloseLiftAggregates({ submittedEmployeeIds: [...submitted], candidates: [...groups.values()].map((item) => ({ row: item.row, contributorEmployeeIds: item.contributors, cohort: item.row.campaign_id })) });
  const opportunities = disclosed.available.map((item) => opportunityView(item.row, links));
  const visibleOpportunityIds = new Set(opportunities.map((item) => item.id));
  const decisionRows = await selectAll<DecisionRow>(organisationId, tables.decisions, { order: "created_at.desc" });
  const assumptions = await selectAll<AssumptionRow>(organisationId, tables.assumptions, {});
  const decisions = decisionRows.filter((row) => visibleOpportunityIds.has(row.opportunity_id)).map((row) => decisionView(row, assumptions));
  const proofRows = await selectAll<ProofRow>(organisationId, tables.proofs, {});
  const evidence = await selectAll<EvidenceRow>(organisationId, tables.evidence, { source_type: "in.(operational_baseline,measured_outcome)" });
  const proofs = proofRows.filter((row) => visibleOpportunityIds.has(row.opportunity_id)).map((row) => proofView(row, evidence));
  return { opportunities, decisions, proofs };
}

async function generateOpportunityWhenBothSubmitted(context: Context, observation: ObservationRow, revision: ObservationRevisionRow, now: string) {
  const assessment = (await select<AssessmentRow>(context.organisation.id, tables.assessments, { participant_id: `eq.${observation.participant_id}`, status: "eq.submitted", limit: "1" }))[0];
  if (!assessment) return;
  const interpretation = (await select<InterpretationRow>(context.organisation.id, tables.interpretations, { participant_id: `eq.${observation.participant_id}`, status: "in.(provisional,reviewed)", order: "created_at.desc", limit: "1" }))[0];
  if (!interpretation) return;
  const employeeEvidence = await selectAll<EvidenceRow>(context.organisation.id, tables.evidence, { employee_id: `eq.${observation.employee_id}`, source_type: "in.(employee_task,employee_report)" });
  const managerEvidenceId = liftManagerEvidenceId(assessment.id, observation.employee_id, now);
  await insert(tables.evidence, [{ id: managerEvidenceId, organisation_id: context.organisation.id, campaign_id: observation.campaign_id, employee_id: observation.employee_id, source_type: "manager_observation", source_record_id: observation.id, source_version: String(observation.current_revision), permissions: "released_pair", description: bounded(revision.observed_work, 5000), limitations: ["Independent manager observation; not averaged with employee evidence."], recorded_at: now }], true);
  const findings = object<{ findings?: LiftCapabilityFinding[] }>(interpretation.findings_snapshot).findings ?? [];
  const opportunities = buildLiftOpportunities({ assessmentId: assessment.id, employeeId: observation.employee_id, findings, employeeEvidence: employeeEvidence.map(evidenceView), manager: { employeeId: observation.employee_id, observedCapabilityIds: strings(revision.capability_observations) as import("@/lib/levytate/lift/domain").LiftCapability[], workThatCouldImprove: revision.suitable_opportunity, intendedOutcome: revision.intended_outcome, concreteExamples: strings(revision.concrete_examples), opportunityToObserve: revision.opportunity_to_observe, conditions: { time: revision.condition_time, tools: revision.condition_tools, access: revision.condition_access, supervision: revision.condition_supervision, suitableWork: revision.condition_suitable_work }, recordedAt: now }, generatedAt: now });
  for (const opportunity of opportunities) {
    await insert(tables.opportunities, [{ id: opportunity.id, organisation_id: context.organisation.id, campaign_id: observation.campaign_id, interpretation_id: interpretation.id, title: opportunity.title, capability_ids: opportunity.capabilityIds, work_that_could_improve: opportunity.workThatCouldImprove, named_constraint: opportunity.constraint, outcome_worth_pursuing: opportunity.outcomeWorthPursuing, relationship_type: opportunity.relationship, missing_inputs: opportunity.missingInputs, decision_question: opportunity.decisionQuestion, evidence_needed: opportunity.evidenceNeeded, state: opportunity.state }], true);
    await insert(tables.opportunityEvidence, [...opportunity.supportingEvidenceIds.map((id) => ({ organisation_id: context.organisation.id, opportunity_id: opportunity.id, evidence_id: id, relationship: "supporting" })), ...opportunity.contradictoryEvidenceIds.map((id) => ({ organisation_id: context.organisation.id, opportunity_id: opportunity.id, evidence_id: id, relationship: "contradictory" }))], true);
  }
  await releaseObservationWhenBothSubmitted(context.organisation.id, observation.participant_id);
}

async function releaseObservationWhenBothSubmitted(organisationId: string, participantId: string) {
  const assessment = (await select<AssessmentRow>(organisationId, tables.assessments, { participant_id: `eq.${participantId}`, status: "eq.submitted", limit: "1" }))[0];
  const observation = (await select<ObservationRow>(organisationId, tables.observations, { participant_id: `eq.${participantId}`, status: "eq.submitted", limit: "1" }))[0];
  if (assessment && observation) await supabaseUpdate(config(), tables.observations, scope(organisationId, { id: observation.id, status: "submitted" }), { status: "released", released_at: new Date().toISOString() });
}

async function managerObservation(organisationId: string, managerEmployeeId: string, employeeId: string) {
  const employee = (await select<EmployeeRow>(organisationId, "levytate_employees", { id: `eq.${employeeId}`, manager_id: `eq.${managerEmployeeId}`, status: "eq.Active", limit: "1" }))[0];
  if (!employee) throw new LevyTateLiftError("Only a current direct report can receive your Workplace Perspective.", 403);
  const observation = (await select<ObservationRow>(organisationId, tables.observations, { employee_id: `eq.${employeeId}`, manager_employee_id: `eq.${managerEmployeeId}`, status: "in.(draft,submitted,released)", order: "created_at.desc", limit: "1" }))[0];
  if (!observation) throw new LevyTateLiftError("No active Lift invitation was found for this direct report.", 404);
  return observation;
}

async function ownAssessment(organisationId: string, assessmentId: string, employeeId: string) {
  const row = (await select<AssessmentRow>(organisationId, tables.assessments, { id: `eq.${assessmentId}`, employee_id: `eq.${employeeId}`, limit: "1" }))[0];
  if (!row) throw new LevyTateLiftError("Assessment unavailable.", 404);
  return row;
}

function opportunityView(row: OpportunityRow, links: OpportunityEvidenceRow[]): LiftOpportunity { const related = links.filter((item) => item.opportunity_id === row.id); return { id: row.id, title: row.title, capabilityIds: strings(row.capability_ids) as LiftOpportunity["capabilityIds"], capabilityEvidence: "Authorised assessment and workplace evidence", workThatCouldImprove: row.work_that_could_improve, constraint: row.named_constraint, outcomeWorthPursuing: row.outcome_worth_pursuing, relationship: row.relationship_type, supportingEvidenceIds: related.filter((item) => item.relationship === "supporting").map((item) => item.evidence_id), contradictoryEvidenceIds: related.filter((item) => item.relationship === "contradictory").map((item) => item.evidence_id), missingInputs: strings(row.missing_inputs), decisionQuestion: row.decision_question, evidenceNeeded: strings(row.evidence_needed), interpretationVersion: liftInterpretationVersion, generatedAt: row.created_at, state: row.state }; }
function decisionView(row: DecisionRow, assumptions: AssumptionRow[]): LiftDecision { return { id: row.id, opportunityId: row.opportunity_id, status: row.status, selectedOptionId: row.selected_option_id, rationale: row.rationale, owner: row.responsible_owner, intendedMeasure: row.intended_measure, recordedAt: row.created_at, assumptions: assumptions.filter((item) => item.decision_id === row.id).map((item) => ({ id: item.id, label: item.label, value: item.value, unit: item.unit, status: item.evidence_status })), valueScenario: nullableObject<LiftDecision["valueScenario"]>(row.value_scenario), sharedBenefitIds: strings(row.shared_benefit_ids) }; }
function proofView(row: ProofRow, evidence: EvidenceRow[]): LiftProofRecord { const byId = new Map(evidence.map((item) => [item.id, evidenceView(item)])); return { opportunityId: row.opportunity_id, revision: row.revision, state: row.state, baseline: row.baseline_evidence_id ? byId.get(row.baseline_evidence_id) ?? null : null, outcome: row.outcome_evidence_id ? byId.get(row.outcome_evidence_id) ?? null : null, agreedScope: row.agreed_scope, owner: row.responsible_owner, intendedMeasure: row.intended_measure, reviewedBy: row.reviewed_by_user_id ? "Authorised reviewer" : null, verification: row.verification, otherRelevantChanges: strings(row.other_relevant_changes), limitations: strings(row.limitations), followUpAt: row.follow_up_at, updatedAt: row.updated_at }; }
function evidenceView(row: EvidenceRow): import("@/lib/levytate/lift/domain").LiftEvidenceReference { return { id: row.id, source: row.source_type, version: row.source_version, recordedAt: row.recorded_at, subject: row.employee_id ?? "aggregate", permissions: row.permissions, description: row.description, limitations: strings(row.limitations), quantity: row.quantity_value === null ? undefined : { value: Number(row.quantity_value), unit: row.quantity_unit!, population: row.quantity_population!, period: row.quantity_period! } }; }

function parseAction(value: unknown): LiftAction { if (!value || typeof value !== "object") throw new LevyTateLiftError("A valid Lift action is required."); const input = value as Record<string, unknown>; if (typeof input.action !== "string" || typeof input.idempotencyKey !== "string" || !/^[a-zA-Z0-9:_-]{8,128}$/.test(input.idempotencyKey)) throw new LevyTateLiftError("A valid action and idempotency key are required."); const allowed = new Set(["invite_people","save_assessment","submit_assessment","save_team_context","save_manager_perspective","submit_manager_perspective","record_employee_context","record_decision","record_proof"]); if (!allowed.has(input.action)) throw new LevyTateLiftError("Lift action is not supported."); return value as LiftAction; }
function sanitiseAnswers(value: LiftAnswerMap) { if (!value || typeof value !== "object" || Array.isArray(value)) throw new LevyTateLiftError("Lift answers must be an object."); const safe: LiftAnswerMap = {}; for (const question of liftQuestionnaire) { const answer = value[question.id]; if (answer === undefined || answer === null || answer === "") safe[question.id] = null; else if (question.type === "long_text") { if (typeof answer !== "string") throw new LevyTateLiftError(`Answer for ${question.id} must be text.`); safe[question.id] = bounded(answer, 5000); } else { if (typeof answer !== "string" || !question.options?.some((option) => option.value === answer)) throw new LevyTateLiftError(`Answer for ${question.id} is invalid.`); safe[question.id] = answer; } } return safe; }
function observationPayload(value: Record<string, unknown>) { return { observed_work: bounded(String(value.observedWork ?? ""), 5000), observation_recency: bounded(String(value.observationRecency ?? ""), 500), opportunity_to_observe: ["enough","limited","not_enough"].includes(String(value.opportunityToObserve)) ? value.opportunityToObserve : "not_enough", support_degree: ["independent","some_support","substantial_support","not_observed"].includes(String(value.supportDegree)) ? value.supportDegree : "not_observed", capability_observations: uniqueStrings(value.capabilityObservations, 10), concrete_examples: uniqueStrings(value.concreteExamples, 5), suitable_opportunity: bounded(String(value.suitableOpportunity ?? ""), 3000), intended_outcome: bounded(String(value.intendedOutcome ?? ""), 3000), condition_time: bounded(String(value.conditionTime ?? ""), 1000), condition_tools: bounded(String(value.conditionTools ?? ""), 1000), condition_access: bounded(String(value.conditionAccess ?? ""), 1000), condition_supervision: bounded(String(value.conditionSupervision ?? ""), 1000), condition_suitable_work: bounded(String(value.conditionSuitableWork ?? ""), 1000) }; }
function assertRole(role: string, allowed: string[]) { if (!allowed.includes(role)) throw new LevyTateLiftError(`${role} cannot perform this Lift action.`, 403); }
function required(value: unknown, max: number) { const next = bounded(String(value ?? ""), max); if (!next) throw new LevyTateLiftError("A required value is missing."); return next; }
function bounded(value: string, max: number) { return value.trim().slice(0, max); }
function uniqueStrings(value: unknown, max: number) { return [...new Set((Array.isArray(value) ? value : []).filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean))].slice(0, max); }
function strings(value: unknown) { return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []; }
function object<T>(value: unknown): T { return value && typeof value === "object" && !Array.isArray(value) ? value as T : {} as T; }
function nullableObject<T>(value: unknown): T | null { return value && typeof value === "object" && !Array.isArray(value) && Object.keys(value as Record<string, unknown>).length ? value as T : null; }
function stableUuid(...parts: string[]) { const hash = createHash("sha256").update(parts.join(":")) .digest("hex"); return `${hash.slice(0,8)}-${hash.slice(8,12)}-4${hash.slice(13,16)}-a${hash.slice(17,20)}-${hash.slice(20,32)}`; }
function config() { const value = getLevyTateSupabaseConfig(); if (!value) throw new LevyTateLiftError("Lift persistence is unavailable.", 503); return value; }
function scope(organisationId: string, values: Record<string, string | number>) { const params = new URLSearchParams({ organisation_id: `eq.${organisationId}` }); Object.entries(values).forEach(([key, value]) => params.set(key, `eq.${value}`)); return params.toString(); }
async function select<T>(organisationId: string, table: string, params: Record<string, string>) { return supabaseSelect<T>(config(), table, new URLSearchParams({ select: "*", organisation_id: `eq.${organisationId}`, ...params })); }
async function selectAll<T>(organisationId: string, table: string, params: Record<string, string>) { return supabaseSelectAll<T>(config(), table, new URLSearchParams({ select: "*", organisation_id: `eq.${organisationId}`, ...params })); }
async function insert(table: string, rows: unknown[], ignore = false) { if (!rows.length) return []; return supabaseInsert(config(), table, rows, ignore ? { prefer: "resolution=ignore-duplicates,return=representation" } : undefined); }
type Context = Awaited<ReturnType<typeof getLearnerLifecycleServerContext>>;
