import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  liftFrameworkKey,
  liftInterpretationVersion,
  liftQuestionnaireVersion,
  type LiftAnswerMap,
  type LiftProofRecord,
} from "../lib/levytate/lift/domain";
import { liftQuestionnaire } from "../lib/levytate/lift/framework";
import {
  invitePeople,
  recordDecision,
  recordProof,
  saveAssessment,
  saveManagerPerspective,
  submitAssessment,
  submitManagerPerspective,
} from "../lib/server/levytate-lift";
import { rubricFor } from "../lib/server/levytate-lift-rubric";
import {
  getLevyTateSupabaseConfig,
  supabaseInsert,
  supabaseSelect,
  supabaseSelectAll,
} from "../lib/server/levytate-supabase";

const organisationId = "12000000-0000-4000-8000-000000000001";
const expectedProjectRef = "lzwcahdgchrkeulmlfqv";
const requiredConfirmation = "GROUND_CONTROL_LIFT_039";

type UserRow = { id: string; organisation_id: string; email: string; role: string; active: boolean };
type EmployeeRow = { id: string; name: string; email: string; department: string; job_title: string; manager_id: string; status: string };
type AssessmentRow = { id: string; campaign_id: string; participant_id: string; employee_id: string; status: "draft" | "submitted"; current_revision: number };
type ObservationRow = { id: string; campaign_id: string; participant_id: string; employee_id: string; status: "draft" | "submitted" | "released"; current_revision: number };
type OpportunityRow = { id: string; campaign_id: string; contributor_count: number };
type ProofRow = { opportunity_id: string; revision: number };

const contributorEmployees = [1, 2, 3, 4, 5].map((number) => ({
  id: `gc-lift-route-${number}`,
  employee_number: `GC-LIFT-R${number}`,
  name: `Lift Route Contributor ${number}`,
  email: `lift.route.${number}@levytate.test`,
  job_title: "Fictional Operations Analyst",
  department: "Lift validation",
}));

const suppressionEmployees = [1, 2].map((number) => ({
  id: `gc-lift-suppressed-${number}`,
  employee_number: `GC-LIFT-S${number}`,
  name: `Lift Suppression Contributor ${number}`,
  email: `lift.suppressed.${number}@levytate.test`,
  job_title: "Fictional Service Coordinator",
  department: "Lift validation",
}));

const config = getLevyTateSupabaseConfig();
if (!config) throw new Error("Supabase service configuration is required.");
if (new URL(config.url).hostname !== `${expectedProjectRef}.supabase.co`) throw new Error("The configured Supabase project is not the approved LevyTate project.");
if (process.env.LEVYTATE_LIFT_FIXTURE_ORGANISATION_ID !== organisationId) throw new Error("The exact authorised fixture organisation ID is required.");
if (process.env.LEVYTATE_LIFT_FIXTURE_CONFIRMATION !== requiredConfirmation) throw new Error("The bounded fixture confirmation is required.");

const context = { organisation: { id: organisationId }, user: { id: "" } } as { organisation: { id: string }; user: { id: string } };

async function main() {
  const users = await supabaseSelectAll<UserRow>(config!, "levytate_users", new URLSearchParams({
    select: "id,organisation_id,email,role,active",
    organisation_id: `eq.${organisationId}`,
    email: "in.(apprenticeshiplead.demo@levytate.test,manager.demo@levytate.test,employee.demo@levytate.test)",
  }));
  assert.equal(users.length, 3, "The three approved fictional identities must exist exactly once in Ground Control.");
  const byEmail = new Map(users.map((user) => [user.email.toLowerCase(), user]));
  const leadUser = byEmail.get("apprenticeshiplead.demo@levytate.test");
  const managerUser = byEmail.get("manager.demo@levytate.test");
  const employeeUser = byEmail.get("employee.demo@levytate.test");
  assert.ok(leadUser?.active && leadUser.role === "Apprenticeship Lead");
  assert.ok(managerUser?.active && managerUser.role === "Line Manager");
  assert.ok(employeeUser?.active && employeeUser.role === "Employee");
  context.user.id = leadUser.id;

  const existingDemoEmployees = await supabaseSelectAll<EmployeeRow>(config!, "levytate_employees", new URLSearchParams({
    select: "id,name,email,department,job_title,manager_id,status",
    organisation_id: `eq.${organisationId}`,
    email: "in.(apprenticeshiplead.demo@levytate.test,manager.demo@levytate.test,employee.demo@levytate.test)",
  }));
  const employeeByEmail = new Map(existingDemoEmployees.map((employee) => [employee.email.toLowerCase(), employee]));
  const manager = employeeByEmail.get("manager.demo@levytate.test");
  const interactiveEmployee = employeeByEmail.get("employee.demo@levytate.test");
  assert.ok(manager && interactiveEmployee);
  assert.equal(interactiveEmployee.manager_id, manager.id, "The approved Employee must remain a direct report of the approved Line Manager.");

  const fictionalRows = [...contributorEmployees, ...suppressionEmployees].map((employee) => ({
    organisation_id: organisationId,
    ...employee,
    role_id: "lift-fictional-validation-role",
    manager_id: manager.id,
    site: "Fictional Preview workspace",
    platform_role: "Employee",
    status: "Active",
    start_date: "2026-10-01",
  }));
  const existingFixtureRows = await supabaseSelectAll<EmployeeRow>(config!, "levytate_employees", new URLSearchParams({
    select: "id,name,email,department,job_title,manager_id,status",
    organisation_id: `eq.${organisationId}`,
    id: `in.(${fictionalRows.map((employee) => employee.id).join(",")})`,
  }));
  for (const existing of existingFixtureRows) {
    const expected = fictionalRows.find((employee) => employee.id === existing.id);
    assert.ok(expected);
    assert.equal(existing.email, expected.email, `Fixture employee ${existing.id} has an unexpected email.`);
    assert.equal(existing.manager_id, manager.id, `Fixture employee ${existing.id} has an unexpected manager.`);
  }
  await supabaseInsert(config!, "levytate_employees", fictionalRows, { prefer: "resolution=ignore-duplicates,return=representation" });

  await invitePeople(context as never, "Apprenticeship Lead", {
    action: "invite_people",
    title: "Lift guided assessment — complete together",
    businessObjective: "Fictional Preview journey for an employee and independent line-manager perspective.",
    employeeIds: [interactiveEmployee.id],
    frameworkKey: liftFrameworkKey,
    questionnaireVersion: liftQuestionnaireVersion,
    interpretationVersion: liftInterpretationVersion,
    idempotencyKey: "gc-lift-interactive-v1",
  });

  const routeCampaignId = await seedCompletedCampaign({
    title: "Lift reporting opportunity — fictional populated example",
    objective: "Demonstrate privacy-safe aggregation, decision assumptions and durable proof using fictional evidence.",
    idempotencyKey: "gc-lift-route-v1",
    employees: contributorEmployees.map((employee) => ({ ...employee, manager_id: manager.id, status: "Active" })),
    manager,
    workflowGroup: "reporting_and_insight",
  });
  const suppressionCampaignId = await seedCompletedCampaign({
    title: "Lift suppression check — fictional small group",
    objective: "Demonstrate that a two-person fictional signal remains suppressed from employer aggregate reporting.",
    idempotencyKey: "gc-lift-suppression-v1",
    employees: suppressionEmployees.map((employee) => ({ ...employee, manager_id: manager.id, status: "Active" })),
    manager,
    workflowGroup: "service_and_customer",
  });

  const opportunities = await select<OpportunityRow>("levytate_lift_opportunities", { campaign_id: `eq.${routeCampaignId}` });
  assert.equal(opportunities.length, 1, "Five fictional contributors must create one disclosed route.");
  assert.equal(opportunities[0]!.contributor_count, 5);
  const opportunityId = opportunities[0]!.id;
  const decisions = await select<{ id: string }>("levytate_lift_decisions", { opportunity_id: `eq.${opportunityId}` });
  if (!decisions.length) {
    await recordDecision(context as never, "Apprenticeship Lead", {
      action: "record_decision",
      opportunityId,
      decision: {
        status: "selected",
        selectedOptionId: "fictional-bounded-reporting-trial",
        rationale: "Fictional illustration: test one reporting handoff without assuming a financial return.",
        owner: "Fictional Operations Reporting Lead",
        intendedMeasure: "Comparable preparation minutes and reconciliation exceptions",
        assumptions: [
          { id: "people", label: "Affected people", value: "5", unit: "people", status: "reported" },
          { id: "minutes", label: "Illustrative minutes per person per week", value: "30", unit: "minutes", status: "reported" },
          { id: "weeks", label: "Illustrative period", value: "4", unit: "weeks", status: "reported" },
          { id: "fraction", label: "Illustrative realised fraction", value: "0.5", unit: "fraction", status: "reported" },
        ],
        valueScenario: { affectedPeople: 5, minutesReleasedPerPersonPerWeek: 30, applicableWeeks: 4, realisedFraction: 0.5, employerLoadedHourlyRate: null, basis: "modelled_scenario", period: "Four-week fictional Preview illustration" },
        sharedBenefitIds: ["fictional-reporting-capacity-v1"],
      },
      idempotencyKey: "gc-lift-decision-v1",
    });
  }

  const proofRows = await select<ProofRow>("levytate_lift_proof_records", { opportunity_id: `eq.${opportunityId}` });
  const baseline = evidence("39000000-0000-4000-a000-000000000201", "operational_baseline", 240, "Fictional baseline");
  const outcome = evidence("39000000-0000-4000-a000-000000000202", "measured_outcome", 205, "Fictional observed result");
  if (!proofRows.length) {
    await recordProof(context as never, "Apprenticeship Lead", {
      action: "record_proof",
      opportunityId,
      expectedRevision: 0,
      proof: proof(1, "change_tested", baseline, null),
      idempotencyKey: "gc-lift-proof-baseline-v1",
    });
  }
  const currentProof = (await select<ProofRow>("levytate_lift_proof_records", { opportunity_id: `eq.${opportunityId}` }))[0];
  if (currentProof?.revision === 1) {
    await recordProof(context as never, "Apprenticeship Lead", {
      action: "record_proof",
      opportunityId,
      expectedRevision: 1,
      proof: proof(2, "outcome_evidenced", baseline, outcome),
      idempotencyKey: "gc-lift-proof-outcome-v1",
    });
  }

  const interactiveCampaignId = stableUuid(organisationId, leadUser.id, "gc-lift-interactive-v1", "campaign");
  const interactiveAssessments = await select<AssessmentRow>("levytate_lift_assessments", { campaign_id: `eq.${interactiveCampaignId}` });
  const interactiveObservations = await select<ObservationRow>("levytate_lift_manager_observations", { campaign_id: `eq.${interactiveCampaignId}` });
  const suppressedRoutes = await select<OpportunityRow>("levytate_lift_opportunities", { campaign_id: `eq.${suppressionCampaignId}` });
  const suppressedCandidates = await select<{ id: string }>("levytate_lift_opportunity_candidates", { campaign_id: `eq.${suppressionCampaignId}` });
  assert.equal(interactiveAssessments.length, 1);
  assert.equal(interactiveAssessments[0]!.status, "draft");
  assert.equal(interactiveObservations.length, 1);
  assert.equal(interactiveObservations[0]!.status, "draft");
  assert.equal(suppressedCandidates.length, 2);
  assert.equal(suppressedRoutes.length, 0, "The two-person campaign must remain suppressed.");

  console.log(JSON.stringify({
    organisationId,
    fixtureEmployeesCreatedOrReused: fictionalRows.length,
    interactiveCampaignId,
    interactiveAssessmentStatus: "draft",
    interactiveManagerPerspectiveStatus: "draft",
    populatedCampaignId: routeCampaignId,
    populatedContributorCount: 5,
    populatedOpportunityCount: 1,
    decisionCount: 1,
    proofRevision: 2,
    suppressionCampaignId,
    suppressionCandidateCount: 2,
    suppressionVisibleRouteCount: 0,
  }));
}

async function seedCompletedCampaign(input: {
  title: string;
  objective: string;
  idempotencyKey: string;
  employees: EmployeeRow[];
  manager: EmployeeRow;
  workflowGroup: "reporting_and_insight" | "service_and_customer";
}) {
  await invitePeople(context as never, "Apprenticeship Lead", {
    action: "invite_people",
    title: input.title,
    businessObjective: input.objective,
    employeeIds: input.employees.map((employee) => employee.id),
    frameworkKey: liftFrameworkKey,
    questionnaireVersion: liftQuestionnaireVersion,
    interpretationVersion: liftInterpretationVersion,
    idempotencyKey: input.idempotencyKey,
  });
  const campaignId = stableUuid(organisationId, context.user.id, input.idempotencyKey, "campaign");
  const assessments = await select<AssessmentRow>("levytate_lift_assessments", { campaign_id: `eq.${campaignId}` });
  const observations = await select<ObservationRow>("levytate_lift_manager_observations", { campaign_id: `eq.${campaignId}` });
  assert.equal(assessments.length, input.employees.length);
  assert.equal(observations.length, input.employees.length);
  const assessmentByEmployee = new Map(assessments.map((assessment) => [assessment.employee_id, assessment]));
  const observationByEmployee = new Map(observations.map((observation) => [observation.employee_id, observation]));
  for (const [index, employee] of input.employees.entries()) {
    const assessment = assessmentByEmployee.get(employee.id)!;
    const observation = observationByEmployee.get(employee.id)!;
    const submitEmployee = async () => {
      if (assessment.status === "draft") {
        await saveAssessment(context as never, "Employee", employee, { action: "save_assessment", assessmentId: assessment.id, answers: answersFor(employee.id), currentQuestionIndex: liftQuestionnaire.length - 1, expectedRevision: assessment.current_revision, idempotencyKey: `${input.idempotencyKey}-employee-save-${index}` });
      }
      await submitAssessment(context as never, "Employee", employee, { action: "submit_assessment", assessmentId: assessment.id, expectedRevision: assessment.current_revision, idempotencyKey: `${input.idempotencyKey}-employee-submit-${index}` });
    };
    const submitManager = async () => {
      if (observation.status === "draft") {
        await saveManagerPerspective(context as never, "Line Manager", input.manager, {
          action: "save_manager_perspective",
          employeeId: employee.id,
          expectedRevision: observation.current_revision,
          observations: {
            workflowGroup: input.workflowGroup,
            observedWork: `Fictional observation ${index + 1}: the contributor prepared an operational handoff and checked the source limitations.`,
            observationRecency: "Recent fictional Preview evidence",
            opportunityToObserve: "enough",
            supportDegree: "some_support",
            capabilityObservations: ["think_clearly", "make_information_useful", "turn_priorities_into_progress"],
            concreteExamples: [`Fictional example ${index + 1} used the agreed review checks.`],
            suitableOpportunity: input.workflowGroup === "reporting_and_insight" ? `Improve reporting handoff example ${index + 1}` : `Improve service handoff example ${index + 1}`,
            intendedOutcome: "Reduce avoidable reconciliation while preserving accuracy.",
            conditionTime: "Two fictional protected hours",
            conditionTools: "Approved tools available",
            conditionAccess: "Authorised data only",
            conditionSupervision: "Manager review",
            conditionSuitableWork: "A bounded fictional case is available",
          },
          idempotencyKey: `${input.idempotencyKey}-manager-save-${index}`,
        });
      }
      await submitManagerPerspective(context as never, "Line Manager", input.manager, { action: "submit_manager_perspective", employeeId: employee.id, expectedRevision: observation.current_revision, idempotencyKey: `${input.idempotencyKey}-manager-submit-${index}` });
    };
    if (index % 2 === 0) { await submitEmployee(); await submitManager(); }
    else { await submitManager(); await submitEmployee(); }
  }
  return campaignId;
}

function answersFor(employeeId: string): LiftAnswerMap {
  return Object.fromEntries(liftQuestionnaire.map((question) => [question.id,
    question.type === "long_text"
      ? `Fictional ${employeeId} work sample: checked source limitations, explained the decision and recorded a bounded next step.`
      : rubricFor(question.id)?.supportedValues[0] ?? rubricFor(question.id)?.contextValues[0] ?? null,
  ]));
}

function evidence(id: string, source: "operational_baseline" | "measured_outcome", value: number, description: string) {
  return { id, source, version: "lift-fictional-proof-v1", recordedAt: "2026-10-21T12:00:00.000Z", subject: "fictional-reporting-handoff", permissions: "authorised_employer" as const, description: `${description}; fictional Preview evidence only.`, limitations: ["Fictional demonstration evidence; not a customer result.", "Before-and-after difference does not establish causation."], quantity: { value, unit: "minutes per weekly report", population: "five fictional contributors", period: "four-week fictional illustration" } };
}

function proof(revision: number, state: LiftProofRecord["state"], baseline: ReturnType<typeof evidence>, outcome: ReturnType<typeof evidence> | null): Omit<LiftProofRecord, "opportunityId" | "updatedAt"> {
  return { revision, state, baseline, outcome, agreedScope: "One fictional weekly reporting handoff using authorised demonstration data.", owner: "Fictional Operations Reporting Lead", intendedMeasure: "Preparation minutes and reconciliation exceptions on the same fictional population.", reviewedBy: outcome ? "Authorised fictional reviewer" : null, verification: outcome ? "internal_review" : "not_reviewed", otherRelevantChanges: ["One fictional extract was simplified during the illustration."], limitations: ["Fictional demonstration only.", "No financial return is claimed."], followUpAt: null };
}

async function select<T>(table: string, filters: Record<string, string>) {
  return supabaseSelect<T>(config!, table, new URLSearchParams({ select: "*", organisation_id: `eq.${organisationId}`, ...filters }));
}

function stableUuid(...parts: string[]) {
  const hash = createHash("sha256").update(parts.join(":")).digest("hex");
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}

void main();
