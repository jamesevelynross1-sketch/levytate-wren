import { createHash } from "node:crypto";
import type { LevyTateBetaSession } from "@/lib/levytate/config/beta-access";
import {
  liftFrameworkKey,
  liftInterpretationVersion,
  liftOpportunityGroupingVersion,
  liftQuestionnaireVersion,
  liftWorkflowGroups,
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
import { groupLiftOpportunityCandidates, type LiftOpportunityCandidateForGrouping } from "@/lib/server/levytate-lift-grouping";
import { calculateLiftCapacityValue, canTransitionLiftProof } from "@/lib/levytate/lift/value";
import { getLevyTateSupabaseConfig, supabaseInsert, supabaseSelect, supabaseSelectAll, supabaseUpdate as persistUpdate } from "@/lib/server/levytate-supabase";
import { insertLiftPlan, liftRevision, liftWritePlan, runLiftTransaction, selectLiftPlan, updateLiftPlan } from "@/lib/server/levytate-lift-transaction";

type EmployeeRow = { id: string; name: string; email: string; department: string; job_title: string; manager_id: string; status: string };
type ParticipantRow = { id: string; campaign_id: string; employee_id: string; manager_employee_id: string; employee_name_snapshot: string; status: string; submitted_at: string | null };
type AssessmentRow = { id: string; campaign_id: string; participant_id: string; employee_id: string; framework_key: string; questionnaire_version: string; interpretation_version: string; status: "draft" | "submitted"; current_revision: number; active_submission_revision: number | null; current_question_index: number; submitted_at: string | null };
type RevisionRow = { id: string; assessment_id: string; revision_number: number; status: "draft" | "submitted" | "superseded"; answers: unknown; submitted_at: string | null };
type InterpretationRow = { id: string; participant_id: string; findings_snapshot: unknown; evidence_reference_ids: unknown; created_at: string };
type ObservationRow = { id: string; campaign_id: string; participant_id: string; employee_id: string; manager_employee_id: string; status: "draft" | "submitted" | "released" | "revoked"; current_revision: number; active_submission_revision: number | null; submitted_at: string | null };
type ObservationRevisionRow = { id: string; observation_id: string; revision_number: number; status: string; revision_kind: "initial" | "addendum"; clarifies_revision_number: number | null; workflow_group_key: import("@/lib/levytate/lift/domain").LiftWorkflowGroup; observed_work: string; observation_recency: string; opportunity_to_observe: "enough" | "limited" | "not_enough"; support_degree: string; capability_observations: unknown; concrete_examples: unknown; suitable_opportunity: string; intended_outcome: string; condition_time: string; condition_tools: string; condition_access: string; condition_supervision: string; condition_suitable_work: string; submitted_at: string | null };
type OpportunityCandidateRow = { id: string; campaign_id: string; interpretation_id: string; employee_id: string; framework_key: string; questionnaire_version: string; interpretation_version: string; grouping_version: string; workflow_group_key: import("@/lib/levytate/lift/domain").LiftWorkflowGroup; capability_ids: unknown; relationship_type: "supported" | "hypothesis"; supporting_evidence_ids: unknown; contradictory_evidence_ids: unknown };
type OpportunityRow = { id: string; campaign_id: string; framework_key: string; questionnaire_version: string; interpretation_version: string; grouping_version: string; workflow_group_key: import("@/lib/levytate/lift/domain").LiftWorkflowGroup; grouping_key: string; grouping_criteria: unknown; contributor_count: number; title: string; capability_ids: unknown; work_that_could_improve: string; named_constraint: string; outcome_worth_pursuing: string; relationship_type: "supported" | "hypothesis"; missing_inputs: unknown; decision_question: string; evidence_needed: unknown; state: LiftOpportunity["state"]; created_at: string };
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
  opportunityCandidates: "levytate_lift_opportunity_candidates",
  opportunities: "levytate_lift_opportunities",
  opportunityRouteMembers: "levytate_lift_opportunity_route_members",
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
  const mutationRevision = await liftRevision(context.organisation.id);
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
  if (mutationRevision !== await liftRevision(context.organisation.id)) throw new LevyTateLiftError("Lift changed while loading. Refresh to load a consistent workspace.", 409);
  return {
    mutationRevision,
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
  await runLiftTransaction(context.organisation.id, context.user.id, action, async () => {
  switch (action.action) {
    case "invite_people": await invitePeople(context, role, action); break;
    case "save_assessment": await saveAssessment(context, role, employee, action); break;
    case "submit_assessment": await submitAssessment(context, role, employee, action); break;
    case "save_team_context": await saveTeamContext(context, role, employee, action); break;
    case "save_manager_perspective": await saveManagerPerspective(context, role, employee, action); break;
    case "submit_manager_perspective": await submitManagerPerspective(context, role, employee, action); break;
    case "add_manager_perspective_addendum": await addManagerPerspectiveAddendum(context, role, employee, action); break;
    case "record_employee_context": await recordEmployeeContext(context, role, employee, action); break;
    case "record_decision": await recordDecision(context, role, action); break;
    case "record_proof": await recordProof(context, role, action); break;
  }
  });
  return getLiftWorkspaceForSession(session);
}

export async function invitePeople(context: Awaited<ReturnType<typeof getLearnerLifecycleServerContext>>, role: string, action: Extract<LiftAction, { action: "invite_people" }>) {
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
  await insert(tables.observationRevisions, managed.map((item) => ({ id: stableUuid(campaignId, item.employee_id, item.manager_employee_id!, "observation-revision-1"), organisation_id: context.organisation.id, observation_id: stableUuid(campaignId, item.employee_id, item.manager_employee_id!, "observation"), revision_number: 1, revision_kind: "initial", workflow_group_key: "other_reviewed", observed_work: "", observation_recency: "", opportunity_to_observe: "not_enough", support_degree: "not_observed", capability_observations: [], concrete_examples: [], status: "draft", created_by: context.user.id })), true);
}

export async function saveAssessment(context: Context, role: string, employee: EmployeeRow | null, action: Extract<LiftAction, { action: "save_assessment" }>) {
  assertRole(role, ["Employee", "Line Manager", "Apprenticeship Lead", "Employer Admin"]);
  if (!employee) throw new LevyTateLiftError("Active employee record required.", 403);
  const assessment = await ownAssessment(context.organisation.id, action.assessmentId, employee.id);
  if (assessment.status !== "draft") throw new LevyTateLiftError("Submitted assessment evidence is immutable.", 409);
  if (assessment.current_revision !== action.expectedRevision) throw new LevyTateLiftError("The assessment changed; refresh before saving.", 409);
  const answers = sanitiseAnswers(action.answers);
  await supabaseUpdate(config(), tables.revisions, scope(context.organisation.id, { assessment_id: assessment.id, revision_number: assessment.current_revision }), { answers, updated_at: new Date().toISOString() });
  await supabaseUpdate(config(), tables.assessments, scope(context.organisation.id, { id: assessment.id, current_revision: action.expectedRevision }), { current_question_index: Math.max(0, Math.min(liftQuestionnaire.length - 1, Math.floor(action.currentQuestionIndex))), updated_at: new Date().toISOString() });
}

export async function submitAssessment(context: Context, role: string, employee: EmployeeRow | null, action: Extract<LiftAction, { action: "submit_assessment" }>) {
  assertRole(role, ["Employee", "Line Manager", "Apprenticeship Lead", "Employer Admin"]);
  if (!employee) throw new LevyTateLiftError("Active employee record required.", 403);
  const assessment = await ownAssessment(context.organisation.id, action.assessmentId, employee.id);
  if (assessment.status === "submitted") { await reconcileLiftParticipant(context, assessment.participant_id); return; }
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
  await reconcileLiftParticipant(context, assessment.participant_id);
}

async function saveTeamContext(context: Context, role: string, employee: EmployeeRow | null, action: Extract<LiftAction, { action: "save_team_context" }>) {
  assertRole(role, ["Line Manager"]); if (!employee) throw new LevyTateLiftError("Active manager record required.", 403);
  const current = await selectAll<{ revision_number: number }>(context.organisation.id, tables.teamContexts, { manager_employee_id: `eq.${employee.id}`, order: "revision_number.desc", limit: "1" });
  if ((current[0]?.revision_number ?? 0) !== action.expectedRevision - 1) throw new LevyTateLiftError("Team context changed; refresh before saving.", 409);
  await insert(tables.teamContexts, [{ id: stableUuid(context.organisation.id, employee.id, String(action.expectedRevision), action.idempotencyKey), organisation_id: context.organisation.id, manager_employee_id: employee.id, revision_number: action.expectedRevision, team_purpose: required(action.purpose, 3000), relevant_workflows: bounded(action.workflows, 5000), recurring_friction: bounded(action.friction, 5000), expected_changes: bounded(action.expectedChanges, 5000), available_support: bounded(action.availableSupport, 5000), status: "submitted", created_by: context.user.id }], true);
}

export async function saveManagerPerspective(context: Context, role: string, employee: EmployeeRow | null, action: Extract<LiftAction, { action: "save_manager_perspective" }>) {
  assertRole(role, ["Line Manager"]); if (!employee) throw new LevyTateLiftError("Active manager record required.", 403);
  const observation = await managerObservation(context.organisation.id, employee.id, action.employeeId);
  if (observation.employee_id === observation.manager_employee_id) throw new LevyTateLiftError("A manager cannot submit a Workplace Perspective about themselves.", 403);
  if (observation.status !== "draft") throw new LevyTateLiftError("The submitted Workplace Perspective is immutable. Record a new clarification instead.", 409);
  if (observation.current_revision !== action.expectedRevision) throw new LevyTateLiftError("The Workplace Perspective changed; refresh before saving.", 409);
  const safe = observationPayload(action.observations);
  const updated = await supabaseUpdate<ObservationRevisionRow>(config(), tables.observationRevisions, scope(context.organisation.id, { observation_id: observation.id, revision_number: observation.current_revision, status: "draft" }), { ...safe, updated_at: new Date().toISOString() });
  if (updated.length !== 1) throw new LevyTateLiftError("The Workplace Perspective was not changed because the draft is no longer current.", 409);
}

export async function submitManagerPerspective(context: Context, role: string, employee: EmployeeRow | null, action: Extract<LiftAction, { action: "submit_manager_perspective" }>) {
  assertRole(role, ["Line Manager"]); if (!employee) throw new LevyTateLiftError("Active manager record required.", 403);
  const observation = await managerObservation(context.organisation.id, employee.id, action.employeeId);
  if (observation.status === "submitted" || observation.status === "released") { await reconcileLiftParticipant(context, observation.participant_id); return; }
  if (observation.current_revision !== action.expectedRevision) throw new LevyTateLiftError("The Workplace Perspective changed; refresh before submitting.", 409);
  const revision = (await select<ObservationRevisionRow>(context.organisation.id, tables.observationRevisions, { observation_id: `eq.${observation.id}`, revision_number: `eq.${observation.current_revision}`, limit: "1" }))[0];
  if (!revision || (!revision.observed_work.trim() && revision.opportunity_to_observe !== "not_enough")) throw new LevyTateLiftError("Observed work or Not enough opportunity to observe is required.");
  const now = new Date().toISOString();
  const submittedRevision = await supabaseUpdate<ObservationRevisionRow>(config(), tables.observationRevisions, scope(context.organisation.id, { observation_id: observation.id, revision_number: observation.current_revision, status: "draft" }), { status: "submitted", submitted_at: now, updated_at: now });
  if (submittedRevision.length !== 1) throw new LevyTateLiftError("The Workplace Perspective was already submitted or changed.", 409);
  const submittedObservation = await supabaseUpdate<ObservationRow>(config(), tables.observations, scope(context.organisation.id, { id: observation.id, current_revision: action.expectedRevision, status: "draft" }), { status: "submitted", active_submission_revision: observation.current_revision, submitted_at: now, updated_at: now });
  if (submittedObservation.length !== 1) throw new LevyTateLiftError("The Workplace Perspective was already submitted or changed.", 409);
  await reconcileLiftParticipant(context, observation.participant_id);
}

async function addManagerPerspectiveAddendum(context: Context, role: string, employee: EmployeeRow | null, action: Extract<LiftAction, { action: "add_manager_perspective_addendum" }>) {
  assertRole(role, ["Line Manager"]); if (!employee) throw new LevyTateLiftError("Active manager record required.", 403);
  const observation = await managerObservation(context.organisation.id, employee.id, action.employeeId);
  if (observation.status !== "released" || !observation.active_submission_revision) throw new LevyTateLiftError("An addendum requires a released initial Workplace Perspective.", 409);
  const clarification = required(action.clarification, 5000);
  const revisionNumber = observation.current_revision + 1;
  await insert(tables.observationRevisions, [{ id: stableUuid(observation.id, "addendum", String(revisionNumber), action.idempotencyKey), organisation_id: context.organisation.id, observation_id: observation.id, revision_number: revisionNumber, revision_kind: "addendum", clarifies_revision_number: observation.active_submission_revision, workflow_group_key: "other_reviewed", observed_work: clarification, observation_recency: "Clarification after initial submission", opportunity_to_observe: "limited", support_degree: "not_observed", capability_observations: [], concrete_examples: [], suitable_opportunity: "", intended_outcome: "", status: "submitted", submitted_at: new Date().toISOString(), created_by: context.user.id }], true);
  const advanced = await supabaseUpdate<ObservationRow>(config(), tables.observations, scope(context.organisation.id, { id: observation.id, current_revision: observation.current_revision, status: "released" }), { current_revision: revisionNumber, updated_at: new Date().toISOString() });
  if (advanced.length !== 1) throw new LevyTateLiftError("The Workplace Perspective changed; refresh before adding clarification.", 409);
}

async function recordEmployeeContext(context: Context, role: string, employee: EmployeeRow | null, action: Extract<LiftAction, { action: "record_employee_context" }>) {
  assertRole(role, ["Employee", "Line Manager", "Apprenticeship Lead", "Employer Admin"]); if (!employee) throw new LevyTateLiftError("Active employee record required.", 403);
  const observation = (await select<ObservationRow>(context.organisation.id, tables.observations, { id: `eq.${action.managerObservationId}`, employee_id: `eq.${employee.id}`, status: "eq.released", limit: "1" }))[0];
  if (!observation) throw new LevyTateLiftError("Released manager observation unavailable.", 404);
  await insert(tables.employeeContexts, [{ id: stableUuid(observation.id, employee.id, action.idempotencyKey), organisation_id: context.organisation.id, observation_id: observation.id, employee_id: employee.id, context: required(action.context, 5000), disputed: Boolean(action.disputed), created_by: context.user.id }], true);
}

export async function recordDecision(context: Context, role: string, action: Extract<LiftAction, { action: "record_decision" }>) {
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

export async function recordProof(context: Context, role: string, action: Extract<LiftAction, { action: "record_proof" }>) {
  assertRole(role, ["Apprenticeship Lead", "Employer Admin"]);
  const opportunity = (await select<OpportunityRow>(context.organisation.id, tables.opportunities, { id: `eq.${action.opportunityId}`, limit: "1" }))[0];
  if (!opportunity) throw new LevyTateLiftError("Opportunity unavailable.", 404);
  const existing = (await select<ProofRow>(context.organisation.id, tables.proofs, { opportunity_id: `eq.${opportunity.id}`, limit: "1" }))[0] ?? null;
  if (existing && existing.revision !== action.expectedRevision) throw new LevyTateLiftError("Proof record changed; refresh before saving.", 409);
  const proof = action.proof;
  const current = { ...proof, state: existing?.state ?? opportunity.state } as LiftProofRecord;
  const decisionRecorded = (await select<DecisionRow>(context.organisation.id, tables.decisions, { opportunity_id: `eq.${opportunity.id}`, status: "eq.selected", limit: "1" })).length > 0;
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
  const contexts = await selectAll<{ id: string; revision_number: number }>(organisationId, tables.teamContexts, { manager_employee_id: `eq.${manager.id}`, status: "eq.submitted", order: "revision_number.desc", limit: "1" });
  return { teamContextSubmitted: contexts.length > 0, teamContextRevision: contexts[0]?.revision_number ?? 0, directReports: await Promise.all(direct.map(async (person) => {
    const observation = observations.find((item) => item.manager_employee_id === manager.id && item.employee_id === person.id && item.status !== "revoked");
    const assessment = assessments.find((item) => item.employee_id === person.id && item.campaign_id === observation?.campaign_id);
    const released = Boolean(observation?.active_submission_revision && assessment?.active_submission_revision);
    const interpretation = released && assessment ? (await select<InterpretationRow>(organisationId, tables.interpretations, { participant_id: `eq.${assessment.participant_id}`, status: "in.(provisional,reviewed)", order: "created_at.desc", limit: "1" }))[0] ?? null : null;
    const draft = observation?.status === "draft" ? (await select<ObservationRevisionRow>(organisationId, tables.observationRevisions, { observation_id: `eq.${observation.id}`, revision_number: `eq.${observation.current_revision}`, limit: "1" }))[0] : null;
    return { employeeId: person.id, employeeName: person.name, perspectiveStatus: observation?.active_submission_revision ? "submitted" : observation ? "draft" : "not_started", currentRevision: observation?.current_revision ?? 1, draft: draft ? { workflowGroup: draft.workflow_group_key, observedWork: draft.observed_work, observationRecency: draft.observation_recency, supportDegree: draft.support_degree, capabilityObservations: strings(draft.capability_observations), example: strings(draft.concrete_examples).join("\n"), opportunity: draft.suitable_opportunity, outcome: draft.intended_outcome, conditions: draft.condition_time } : undefined, employeeFindingsReleased: released, employeeFindings: interpretation ? object<{ findings?: LiftCapabilityFinding[] }>(interpretation.findings_snapshot).findings ?? [] : [] };
  })) };
}

async function leaderWorkspace(organisationId: string, participants: ParticipantRow[]) {
  const submittedByCampaign = submittedEmployeesByCampaign(participants);
  const rows = await selectAll<OpportunityRow>(organisationId, tables.opportunities, { order: "updated_at.desc" });
  const candidates = await selectAll<OpportunityCandidateRow>(organisationId, tables.opportunityCandidates, {});
  const disclosedIds = new Set(groupLiftOpportunityCandidates({ candidates: candidates.map(candidateForGrouping), submittedEmployeeIdsByCampaign: submittedByCampaign, stableId: stableUuid }).map((route) => route.id));
  const opportunities = rows.filter((row) => disclosedIds.has(row.id)).map(opportunityView);
  const visibleOpportunityIds = new Set(opportunities.map((item) => item.id));
  const decisionRows = await selectAll<DecisionRow>(organisationId, tables.decisions, { order: "created_at.desc" });
  const assumptions = await selectAll<AssumptionRow>(organisationId, tables.assumptions, {});
  const decisions = decisionRows.filter((row) => visibleOpportunityIds.has(row.opportunity_id)).map((row) => decisionView(row, assumptions));
  const proofRows = await selectAll<ProofRow>(organisationId, tables.proofs, {});
  const evidence = await selectAll<EvidenceRow>(organisationId, tables.evidence, { source_type: "in.(operational_baseline,measured_outcome)" });
  const proofs = proofRows.filter((row) => visibleOpportunityIds.has(row.opportunity_id)).map((row) => proofView(row, evidence));
  return { opportunities, decisions, proofs };
}

/** A single replay-safe path used after either independent submission. */
export async function reconcileLiftParticipant(context: Context, participantId: string) {
  const organisationId = context.organisation.id;
  const assessment = (await select<AssessmentRow>(organisationId, tables.assessments, { participant_id: `eq.${participantId}`, status: "eq.submitted", limit: "1" }))[0];
  const observation = (await select<ObservationRow>(organisationId, tables.observations, { participant_id: `eq.${participantId}`, status: "in.(submitted,released)", limit: "1" }))[0];
  if (!assessment?.active_submission_revision || !observation?.active_submission_revision) return { reconciled: false as const, reason: "awaiting_independent_submission" as const };
  const revision = (await select<ObservationRevisionRow>(organisationId, tables.observationRevisions, { observation_id: `eq.${observation.id}`, revision_number: `eq.${observation.active_submission_revision}`, revision_kind: "eq.initial", status: "eq.submitted", limit: "1" }))[0];
  const interpretation = (await select<InterpretationRow>(organisationId, tables.interpretations, { participant_id: `eq.${participantId}`, status: "in.(provisional,reviewed)", order: "created_at.desc", limit: "1" }))[0];
  if (!revision || !interpretation) return { reconciled: false as const, reason: "evidence_incomplete" as const };
  const now = new Date().toISOString();
  const employeeEvidence = await selectAll<EvidenceRow>(organisationId, tables.evidence, { employee_id: `eq.${observation.employee_id}`, campaign_id: `eq.${observation.campaign_id}`, source_type: "in.(employee_task,employee_report)" });
  const managerEvidenceId = liftManagerEvidenceId(assessment.id, observation.id, revision.revision_number);
  await insert(tables.evidence, [{ id: managerEvidenceId, organisation_id: organisationId, campaign_id: observation.campaign_id, employee_id: observation.employee_id, source_type: "manager_observation", source_record_id: observation.id, source_version: String(revision.revision_number), permissions: "released_pair", description: bounded(revision.observed_work, 5000), limitations: ["Independent manager observation; not averaged with employee evidence."], recorded_at: revision.submitted_at ?? now }], true);
  const findings = object<{ findings?: LiftCapabilityFinding[] }>(interpretation.findings_snapshot).findings ?? [];
  const opportunities = buildLiftOpportunities({ assessmentId: assessment.id, employeeId: observation.employee_id, findings, employeeEvidence: employeeEvidence.map(evidenceView), manager: { employeeId: observation.employee_id, observationId: observation.id, observationRevision: revision.revision_number, workflowGroup: revision.workflow_group_key, observedCapabilityIds: strings(revision.capability_observations) as import("@/lib/levytate/lift/domain").LiftCapability[], workThatCouldImprove: revision.suitable_opportunity, intendedOutcome: revision.intended_outcome, concreteExamples: strings(revision.concrete_examples), opportunityToObserve: revision.opportunity_to_observe, conditions: { time: revision.condition_time, tools: revision.condition_tools, access: revision.condition_access, supervision: revision.condition_supervision, suitableWork: revision.condition_suitable_work }, recordedAt: revision.submitted_at ?? now }, generatedAt: now });
  for (const opportunity of opportunities) {
    await insert(tables.opportunityCandidates, [{ id: opportunity.id, organisation_id: organisationId, campaign_id: observation.campaign_id, interpretation_id: interpretation.id, employee_id: observation.employee_id, framework_key: assessment.framework_key, questionnaire_version: assessment.questionnaire_version, interpretation_version: assessment.interpretation_version, grouping_version: opportunity.groupingVersion ?? liftOpportunityGroupingVersion, workflow_group_key: opportunity.workflowGroup, title: opportunity.title, capability_ids: opportunity.capabilityIds, work_that_could_improve: opportunity.workThatCouldImprove, named_constraint: opportunity.constraint, outcome_worth_pursuing: opportunity.outcomeWorthPursuing, relationship_type: opportunity.relationship, supporting_evidence_ids: opportunity.supportingEvidenceIds, contradictory_evidence_ids: opportunity.contradictoryEvidenceIds, missing_inputs: opportunity.missingInputs, decision_question: opportunity.decisionQuestion, evidence_needed: opportunity.evidenceNeeded, state: opportunity.state }], true);
  }
  await reconcileCampaignOpportunityRoutes(organisationId, observation.campaign_id);
  if (observation.status === "submitted") await supabaseUpdate(config(), tables.observations, scope(organisationId, { id: observation.id, status: "submitted", active_submission_revision: observation.active_submission_revision }), { status: "released", released_at: now });
  return { reconciled: true as const, candidateCount: opportunities.length };
}

async function reconcileCampaignOpportunityRoutes(organisationId: string, campaignId: string) {
  const candidates = await selectAll<OpportunityCandidateRow>(organisationId, tables.opportunityCandidates, { campaign_id: `eq.${campaignId}` });
  const participants = await selectAll<ParticipantRow>(organisationId, tables.participants, { campaign_id: `eq.${campaignId}` });
  const routes = groupLiftOpportunityCandidates({ candidates: candidates.map(candidateForGrouping), submittedEmployeeIdsByCampaign: submittedEmployeesByCampaign(participants), stableId: stableUuid });
  for (const route of routes) {
    await insert(tables.opportunities, [{ id: route.id, organisation_id: organisationId, campaign_id: route.campaignId, framework_key: route.frameworkKey, questionnaire_version: route.questionnaireVersion, interpretation_version: route.interpretationVersion, grouping_version: route.groupingVersion, workflow_group_key: route.workflowGroup, grouping_key: route.groupingKey, grouping_criteria: { campaignId: route.campaignId, frameworkKey: route.frameworkKey, questionnaireVersion: route.questionnaireVersion, interpretationVersion: route.interpretationVersion, groupingVersion: route.groupingVersion, workflowGroup: route.workflowGroup, minimumDistinctEmployees: 5, wordingSource: "controlled_taxonomy" }, contributor_count: route.contributorEmployeeIds.length, title: route.title, capability_ids: route.capabilityIds, work_that_could_improve: route.workThatCouldImprove, named_constraint: route.constraint, outcome_worth_pursuing: route.outcomeWorthPursuing, relationship_type: route.relationship, missing_inputs: ["Confirm shared conditions and operational baseline"], decision_question: "Is a bounded employer-level test justified, or should more evidence be gathered first?", evidence_needed: ["Named owner and agreed scope", "Comparable operational baseline", "Outcome observed on the same basis"], state: route.relationship === "supported" ? "work_context_confirmed" : "signal_identified" }], true);
    const candidateById = new Map(candidates.map((candidate) => [candidate.id, candidate]));
    await insert(tables.opportunityRouteMembers, route.candidateIds.flatMap((candidateId) => { const candidate = candidateById.get(candidateId); return candidate ? [{ organisation_id: organisationId, opportunity_id: route.id, candidate_id: candidateId, contributor_employee_id: candidate.employee_id, grouping_criteria: { campaignId: route.campaignId, workflowGroup: route.workflowGroup, groupingVersion: route.groupingVersion } }] : []; }), true);
    await insert(tables.opportunityEvidence, [...route.supportingEvidenceIds.map((id) => ({ organisation_id: organisationId, opportunity_id: route.id, evidence_id: id, relationship: "supporting" })), ...route.contradictoryEvidenceIds.map((id) => ({ organisation_id: organisationId, opportunity_id: route.id, evidence_id: id, relationship: "contradictory" }))], true);
  }
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

function opportunityView(row: OpportunityRow): LiftOpportunity { return { id: row.id, campaignId: row.campaign_id, workflowGroup: row.workflow_group_key, groupingVersion: row.grouping_version, title: row.title, capabilityIds: strings(row.capability_ids) as LiftOpportunity["capabilityIds"], capabilityEvidence: "Privacy-safe aggregate of authorised assessment and workplace evidence", workThatCouldImprove: row.work_that_could_improve, constraint: row.named_constraint, outcomeWorthPursuing: row.outcome_worth_pursuing, relationship: row.relationship_type, supportingEvidenceIds: [], contradictoryEvidenceIds: [], missingInputs: strings(row.missing_inputs), decisionQuestion: row.decision_question, evidenceNeeded: strings(row.evidence_needed), interpretationVersion: row.interpretation_version, generatedAt: row.created_at, state: row.state }; }
function decisionView(row: DecisionRow, assumptions: AssumptionRow[]): LiftDecision { return { id: row.id, opportunityId: row.opportunity_id, status: row.status, selectedOptionId: row.selected_option_id, rationale: row.rationale, owner: row.responsible_owner, intendedMeasure: row.intended_measure, recordedAt: row.created_at, assumptions: assumptions.filter((item) => item.decision_id === row.id).map((item) => ({ id: item.id, label: item.label, value: item.value, unit: item.unit, status: item.evidence_status })), valueScenario: nullableObject<LiftDecision["valueScenario"]>(row.value_scenario), sharedBenefitIds: strings(row.shared_benefit_ids) }; }
function proofView(row: ProofRow, evidence: EvidenceRow[]): LiftProofRecord { const byId = new Map(evidence.map((item) => [item.id, evidenceView(item)])); return { opportunityId: row.opportunity_id, revision: row.revision, state: row.state, baseline: row.baseline_evidence_id ? byId.get(row.baseline_evidence_id) ?? null : null, outcome: row.outcome_evidence_id ? byId.get(row.outcome_evidence_id) ?? null : null, agreedScope: row.agreed_scope, owner: row.responsible_owner, intendedMeasure: row.intended_measure, reviewedBy: row.reviewed_by_user_id ? "Authorised reviewer" : null, verification: row.verification, otherRelevantChanges: strings(row.other_relevant_changes), limitations: strings(row.limitations), followUpAt: row.follow_up_at, updatedAt: row.updated_at }; }
function evidenceView(row: EvidenceRow): import("@/lib/levytate/lift/domain").LiftEvidenceReference { return { id: row.id, source: row.source_type, version: row.source_version, recordedAt: row.recorded_at, subject: row.employee_id ?? "aggregate", permissions: row.permissions, description: row.description, limitations: strings(row.limitations), quantity: row.quantity_value === null ? undefined : { value: Number(row.quantity_value), unit: row.quantity_unit!, population: row.quantity_population!, period: row.quantity_period! } }; }
function candidateForGrouping(row: OpportunityCandidateRow): LiftOpportunityCandidateForGrouping { return { id: row.id, campaignId: row.campaign_id, employeeId: row.employee_id, frameworkKey: row.framework_key, questionnaireVersion: row.questionnaire_version, interpretationVersion: row.interpretation_version, groupingVersion: row.grouping_version, workflowGroup: row.workflow_group_key, capabilityIds: strings(row.capability_ids) as import("@/lib/levytate/lift/domain").LiftCapability[], relationship: row.relationship_type, supportingEvidenceIds: strings(row.supporting_evidence_ids), contradictoryEvidenceIds: strings(row.contradictory_evidence_ids) }; }
function submittedEmployeesByCampaign(participants: ParticipantRow[]) { const result = new Map<string, string[]>(); for (const participant of participants) { if (participant.status !== "submitted") continue; result.set(participant.campaign_id, [...(result.get(participant.campaign_id) ?? []), participant.employee_id]); } return result; }

function parseAction(value: unknown): LiftAction {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new LevyTateLiftError("A valid Lift action is required.");
  const input = value as Record<string, unknown>;
  const fields: Record<string, string[]> = {
    invite_people: ["title","businessObjective","employeeIds","frameworkKey","questionnaireVersion","interpretationVersion"],
    save_assessment: ["assessmentId","answers","currentQuestionIndex","expectedRevision"], submit_assessment: ["assessmentId","expectedRevision"],
    save_team_context: ["purpose","workflows","friction","expectedChanges","availableSupport","expectedRevision"],
    save_manager_perspective: ["employeeId","observations","expectedRevision"], submit_manager_perspective: ["employeeId","expectedRevision"],
    add_manager_perspective_addendum: ["employeeId","clarification"], record_employee_context: ["managerObservationId","context","disputed"],
    record_decision: ["opportunityId","decision"], record_proof: ["opportunityId","proof","expectedRevision"],
  };
  if (typeof input.action !== "string" || !Object.hasOwn(fields,input.action) || typeof input.idempotencyKey !== "string" || !/^[a-zA-Z0-9:_-]{8,128}$/.test(input.idempotencyKey)) throw new LevyTateLiftError("A valid action and retry key are required.");
  if (!Number.isSafeInteger(input.expectedWorkspaceRevision) || (input.expectedWorkspaceRevision as number)<0) throw new LevyTateLiftError("Refresh Lift before saving; a current workspace revision is required.",409);
  const allowed = ["action","idempotencyKey","expectedWorkspaceRevision",...fields[input.action]];
  if (Object.keys(input).some((key) => !allowed.includes(key)) || fields[input.action].some((key) => !(key in input))) throw new LevyTateLiftError("Lift action fields are incomplete or unsupported.");
  for (const key of fields[input.action]) {
    const item = input[key];
    if (["expectedRevision","currentQuestionIndex"].includes(key)) { if (!Number.isSafeInteger(item) || (item as number)<0) throw new LevyTateLiftError("A valid Lift revision and question index are required."); }
    else if (["answers","observations","decision","proof"].includes(key)) { if (!item || typeof item!=="object" || Array.isArray(item)) throw new LevyTateLiftError("Lift evidence must be an object."); }
    else if (key==="employeeIds") { if (!Array.isArray(item) || !item.length || item.length>500 || item.some((id) => typeof id!=="string" || !id.trim()) || new Set(item).size!==item.length) throw new LevyTateLiftError("Select between one and 500 distinct employees."); }
    else if (key==="disputed") { if (typeof item!=="boolean") throw new LevyTateLiftError("A valid context decision is required."); }
    else if (typeof item!=="string" || item.length>8000) throw new LevyTateLiftError("Lift action text is invalid or too long.");
  }
  if (input.action === "save_manager_perspective") {
    const observation = input.observations as Record<string, unknown>;
    const listKeys = ["capabilityObservations","concreteExamples"];
    const textKeys = ["workflowGroup","observedWork","observationRecency","opportunityToObserve","supportDegree","suitableOpportunity","intendedOutcome","conditionTime","conditionTools","conditionAccess","conditionSupervision","conditionSuitableWork"];
    if (Object.entries(observation).some(([key,item]) => listKeys.includes(key) ? !validStringArray(item,30,5000) : !textKeys.includes(key) || typeof item!=="string" || item.length>5000)) throw new LevyTateLiftError("Workplace Perspective fields are invalid.");
  }
  if (input.action === "record_decision") {
    const decision = input.decision as Record<string, unknown>;
    if (!["selected","deferred","gather_evidence"].includes(String(decision.status)) || ["selectedOptionId","rationale","owner","intendedMeasure"].some((key) => typeof decision[key]!=="string" || !(decision[key] as string).trim()) || !Array.isArray(decision.assumptions) || decision.assumptions.length>100 || !validStringArray(decision.sharedBenefitIds,100,500)) throw new LevyTateLiftError("A complete decision and assumptions are required.");
    for (const assumption of decision.assumptions) {
      if (!assumption || typeof assumption!=="object" || ["id","label","value"].some((key) => typeof assumption[key]!=="string") || (assumption.unit!==null && typeof assumption.unit!=="string") || !["reported","reviewed","measured"].includes(assumption.status)) throw new LevyTateLiftError("Decision assumptions are invalid.");
    }
  }
  if (input.action === "record_proof") {
    const proof = input.proof as Record<string, unknown>;
    if (!["signal_identified","work_context_confirmed","change_tested","outcome_evidenced","paused","not_supported","no_improvement"].includes(String(proof.state)) || ["agreedScope","owner","intendedMeasure"].some((key) => typeof proof[key]!=="string") || !["not_reviewed","internal_review","external_review"].includes(String(proof.verification)) || !validStringArray(proof.limitations,30,2000) || !validStringArray(proof.otherRelevantChanges,30,2000) || (proof.reviewedBy!==null && typeof proof.reviewedBy!=="string") || (proof.followUpAt!==null && (typeof proof.followUpAt!=="string" || !Number.isFinite(Date.parse(proof.followUpAt))))) throw new LevyTateLiftError("Proof fields are invalid.");
    for (const name of ["baseline","outcome"] as const) {
      const evidence=proof[name] as Record<string,unknown> | null;
      if (evidence===null) continue;
      if (!evidence || typeof evidence!=="object" || ["id","source","version","recordedAt","description"].some((key) => typeof evidence[key]!=="string") || !Number.isFinite(Date.parse(evidence.recordedAt as string)) || evidence.source!==(name==="baseline" ? "operational_baseline" : "measured_outcome") || !validStringArray(evidence.limitations,30,2000)) throw new LevyTateLiftError("Proof evidence is invalid.");
      const quantity=evidence.quantity as Record<string,unknown> | undefined;
      if (quantity && (typeof quantity.value!=="number" || !Number.isFinite(quantity.value) || quantity.value<0 || ["unit","population","period"].some((key) => typeof quantity[key]!=="string" || !(quantity[key] as string).trim()))) throw new LevyTateLiftError("Proof measures require finite non-negative quantities and their units, population and period.");
    }
  }
  return value as LiftAction;
}
function validStringArray(value: unknown, max: number, maxLength: number) { return Array.isArray(value) && value.length<=max && value.every((item) => typeof item==="string" && item.length<=maxLength); }
function sanitiseAnswers(value: LiftAnswerMap) { if (!value || typeof value !== "object" || Array.isArray(value)) throw new LevyTateLiftError("Lift answers must be an object."); const safe: LiftAnswerMap = {}; for (const question of liftQuestionnaire) { const answer = value[question.id]; if (answer === undefined || answer === null || answer === "") safe[question.id] = null; else if (question.type === "long_text") { if (typeof answer !== "string") throw new LevyTateLiftError(`Answer for ${question.id} must be text.`); safe[question.id] = bounded(answer, 5000); } else { if (typeof answer !== "string" || !question.options?.some((option) => option.value === answer)) throw new LevyTateLiftError(`Answer for ${question.id} is invalid.`); safe[question.id] = answer; } } return safe; }
function observationPayload(value: Record<string, unknown>) { const workflowGroup = String(value.workflowGroup ?? "other_reviewed"); return { workflow_group_key: liftWorkflowGroups.includes(workflowGroup as (typeof liftWorkflowGroups)[number]) ? workflowGroup : "other_reviewed", observed_work: bounded(String(value.observedWork ?? ""), 5000), observation_recency: bounded(String(value.observationRecency ?? ""), 500), opportunity_to_observe: ["enough","limited","not_enough"].includes(String(value.opportunityToObserve)) ? value.opportunityToObserve : "not_enough", support_degree: ["independent","some_support","substantial_support","not_observed"].includes(String(value.supportDegree)) ? value.supportDegree : "not_observed", capability_observations: uniqueStrings(value.capabilityObservations, 10), concrete_examples: uniqueStrings(value.concreteExamples, 5), suitable_opportunity: bounded(String(value.suitableOpportunity ?? ""), 3000), intended_outcome: bounded(String(value.intendedOutcome ?? ""), 3000), condition_time: bounded(String(value.conditionTime ?? ""), 1000), condition_tools: bounded(String(value.conditionTools ?? ""), 1000), condition_access: bounded(String(value.conditionAccess ?? ""), 1000), condition_supervision: bounded(String(value.conditionSupervision ?? ""), 1000), condition_suitable_work: bounded(String(value.conditionSuitableWork ?? ""), 1000) }; }
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
async function select<T>(organisationId: string, table: string, params: Record<string, string>) { if (liftWritePlan.getStore() && table.startsWith("levytate_lift_")) return selectLiftPlan<T>(table, params); return supabaseSelect<T>(config(), table, new URLSearchParams({ select: "*", organisation_id: `eq.${organisationId}`, ...params })); }
async function selectAll<T>(organisationId: string, table: string, params: Record<string, string>) { if (liftWritePlan.getStore() && table.startsWith("levytate_lift_")) return selectLiftPlan<T>(table, params); if (params.limit) return select<T>(organisationId, table, params); const order = params.order ? `${params.order},id.asc` : "id.asc"; return supabaseSelectAll<T>(config(), table, new URLSearchParams({ select: "*", organisation_id: `eq.${organisationId}`, ...params, order })); }
async function insert(table: string, rows: unknown[], ignore = false) { if (!rows.length) return []; if (liftWritePlan.getStore()) return insertLiftPlan(table, rows as Record<string, unknown>[], ignore); return supabaseInsert(config(), table, rows, ignore ? { prefer: "resolution=ignore-duplicates,return=representation" } : undefined); }
async function supabaseUpdate<T>(connection: ReturnType<typeof config>, table: string, query: string, body: Record<string, unknown>): Promise<T[]> { if (liftWritePlan.getStore()) return updateLiftPlan<T>(table, Object.fromEntries(new URLSearchParams(query)), body); return persistUpdate<T>(connection, table, query, body); }
type Context = Awaited<ReturnType<typeof getLearnerLifecycleServerContext>>;
