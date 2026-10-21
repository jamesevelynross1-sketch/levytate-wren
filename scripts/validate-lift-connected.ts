import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createServer } from "node:http";
import { liftFrameworkKey, liftInterpretationVersion, liftQuestionnaireVersion, type LiftAnswerMap, type LiftProofRecord } from "../lib/levytate/lift/domain";
import { liftQuestionnaire } from "../lib/levytate/lift/framework";
import { invitePeople, recordDecision, recordProof, saveAssessment, saveManagerPerspective, submitAssessment, submitManagerPerspective } from "../lib/server/levytate-lift";
import { liftRubricMatrix } from "../lib/server/levytate-lift-rubric";

const socket = process.env.LEVYTATE_LIFT_TEST_SOCKET;
const databasePort = process.env.LEVYTATE_LIFT_TEST_PORT ?? "55439";
const databaseUser = process.env.LEVYTATE_LIFT_TEST_USER ?? "postgres";
if (!socket) throw new Error("LEVYTATE_LIFT_TEST_SOCKET is required.");

const psql = (sql: string) => execFileSync("/opt/homebrew/bin/psql", ["-h", socket, "-p", databasePort, "-U", databaseUser, "-d", "lift039", "-v", "ON_ERROR_STOP=1", "-At", "-c", sql], { encoding: "utf8" }).trim();
const jsonQuery = <T>(sql: string): T => JSON.parse(psql(`select coalesce(json_agg(result),'[]'::json) from (${sql}) result;`) || "[]") as T;
const jsonDml = <T>(sql: string): T => JSON.parse(psql(`with result as (${sql}) select coalesce(json_agg(result),'[]'::json) from result;`) || "[]") as T;
const quote = (value: unknown) => value === null ? "null" : typeof value === "number" ? String(value) : typeof value === "boolean" ? String(value) : typeof value === "object" ? `${literal(JSON.stringify(value))}::jsonb` : literal(String(value));
const literal = (value: string) => `'${value.replaceAll("'", "''")}'`;
const identifier = (value: string) => { if (!/^[a-z][a-z0-9_]*$/.test(value)) throw new Error(`Unsafe identifier ${value}`); return `"${value}"`; };
const allowedTables = new Set(["levytate_employees", "levytate_lift_campaigns", "levytate_lift_participants", "levytate_lift_assessments", "levytate_lift_assessment_revisions", "levytate_lift_manager_observations", "levytate_lift_manager_observation_revisions", "levytate_lift_evidence_records", "levytate_lift_interpretations", "levytate_lift_opportunity_candidates", "levytate_lift_opportunities", "levytate_lift_opportunity_route_members", "levytate_lift_opportunity_evidence", "levytate_lift_decisions", "levytate_lift_decision_assumptions", "levytate_lift_proof_records", "levytate_lift_proof_events"]);

let failCandidateInsertOnce = false;
const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    const table = url.pathname.split("/").filter(Boolean).at(-1) ?? "";
    if (!allowedTables.has(table)) throw new Error(`Table ${table} is outside the isolated adapter.`);
    const body = await readBody(request);
    if (request.method === "POST" && table === "levytate_lift_opportunity_candidates" && failCandidateInsertOnce) {
      failCandidateInsertOnce = false;
      response.writeHead(503, { "Content-Type": "application/json" }); response.end(JSON.stringify({ message: "Injected interrupted reconciliation" })); return;
    }
    const rows = request.method === "GET" ? selectRows(table, url.searchParams)
      : request.method === "POST" ? insertRows(table, JSON.parse(body || "[]"), request.headers.prefer?.includes("ignore-duplicates") ?? false)
      : request.method === "PATCH" ? updateRows(table, url.searchParams, JSON.parse(body || "{}"))
      : (() => { throw new Error(`Unsupported method ${request.method}`); })();
    response.writeHead(request.method === "POST" ? 201 : 200, { "Content-Type": "application/json" });
    response.end(JSON.stringify(rows));
  } catch (error) {
    response.writeHead(400, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ message: error instanceof Error ? error.message : "Isolated adapter failed" }));
  }
});

function selectRows(table: string, params: URLSearchParams) {
  const where = whereSql(params);
  const orderParam = params.get("order");
  const order = orderParam ? ` order by ${orderParam.split(",").map((part) => { const [column, direction] = part.split("."); return `${identifier(column!)} ${direction === "desc" ? "desc" : "asc"}`; }).join(",")}` : "";
  const limit = Math.max(0, Number(params.get("limit") ?? 1000));
  const offset = Math.max(0, Number(params.get("offset") ?? 0));
  return jsonQuery<unknown[]>(`select * from public.${identifier(table)}${where} ${order} limit ${limit} offset ${offset}`);
}

function insertRows(table: string, value: unknown, ignore: boolean) {
  const rows = Array.isArray(value) ? value as Record<string, unknown>[] : [value as Record<string, unknown>];
  if (!rows.length) return [];
  const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  const values = rows.map((row) => `(${columns.map((column) => quote(row[column] ?? null)).join(",")})`).join(",");
  return jsonDml<unknown[]>(`insert into public.${identifier(table)} (${columns.map(identifier).join(",")}) values ${values}${ignore ? " on conflict do nothing" : ""} returning *`);
}

function updateRows(table: string, params: URLSearchParams, body: Record<string, unknown>) {
  const entries = Object.entries(body);
  if (!entries.length) return [];
  return jsonDml<unknown[]>(`update public.${identifier(table)} set ${entries.map(([key, value]) => `${identifier(key)}=${quote(value)}`).join(",")}${whereSql(params)} returning *`);
}

function whereSql(params: URLSearchParams) {
  const ignored = new Set(["select","order","limit","offset"]);
  const filters: string[] = [];
  for (const [key, raw] of params) {
    if (ignored.has(key)) continue;
    if (raw.startsWith("eq.")) filters.push(`${identifier(key)}=${literal(raw.slice(3))}`);
    else if (raw.startsWith("in.(") && raw.endsWith(")")) filters.push(`${identifier(key)} in (${raw.slice(4,-1).split(",").map(literal).join(",")})`);
    else throw new Error(`Unsupported isolated filter ${key}=${raw}`);
  }
  return filters.length ? ` where ${filters.join(" and ")}` : "";
}

async function readBody(request: import("node:http").IncomingMessage) { const chunks: Buffer[] = []; for await (const chunk of request) chunks.push(Buffer.from(chunk)); return Buffer.concat(chunks).toString("utf8"); }

async function main() {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address(); if (!address || typeof address === "string") throw new Error("Adapter did not start.");
  process.env.NEXT_PUBLIC_SUPABASE_URL = `http://127.0.0.1:${address.port}`;
  process.env.SUPABASE_SERVICE_ROLE_KEY = "isolated-validation-only";
  const [seed] = jsonQuery<Array<{ organisation_id: string; user_id: string }>>("select o.id organisation_id, u.id user_id from public.levytate_organisations o join public.levytate_users u on u.organisation_id=o.id limit 1");
  assert.ok(seed);
  const manager = { id: "lift-manager", name: "Fictional Lift Manager", email: "lift-manager@levytate.test", department: "Validation", job_title: "Manager", manager_id: "", status: "Active" };
  const employees = [1,2,3,4,5].map((number) => ({ id: `lift-employee-${number}`, name: `Fictional Lift Employee ${number}`, email: `lift-employee-${number}@levytate.test`, department: "Validation", job_title: "Analyst", manager_id: manager.id, status: "Active" }));
  psql(`insert into public.levytate_employees(organisation_id,id,employee_number,name,email,job_title,role_id,manager_id,department,site,platform_role,status,start_date) values ${[manager, ...employees].map((employee, index) => `(${literal(seed.organisation_id)},${literal(employee.id)},${literal(`LIFT-${index}`)},${literal(employee.name)},${literal(employee.email)},${literal(employee.job_title)},'role',${literal(employee.manager_id)},${literal(employee.department)},'Isolated','Employee','Active','2026-01-01')`).join(",")} on conflict do nothing;`);
  const context = { organisation: { id: seed.organisation_id }, user: { id: seed.user_id } } as never;
  await invitePeople(context, "Apprenticeship Lead", { action: "invite_people", title: "Connected Lift validation", businessObjective: "Validate the complete isolated Lift journey", employeeIds: employees.map((employee) => employee.id), frameworkKey: liftFrameworkKey, questionnaireVersion: liftQuestionnaireVersion, interpretationVersion: liftInterpretationVersion, idempotencyKey: "connected-invite-001" });
  const assessments = jsonQuery<Array<{ id: string; employee_id: string }>>("select id,employee_id from public.levytate_lift_assessments where employee_id like 'lift-employee-%' order by employee_id");
  assert.equal(assessments.length, 5, "Invitation created one assessment for each fictional employee.");
  const answers: LiftAnswerMap = Object.fromEntries(liftQuestionnaire.map((question) => { const rubric = liftRubricMatrix.find((item) => item.itemId === question.id); return [question.id, question.type === "long_text" ? `Evidence-backed isolated response for ${question.id}` : rubric?.supportedValues[0] ?? rubric?.contextValues[0] ?? null]; }));
  const perspective = (employeeNumber: number) => ({ workflowGroup: "reporting_and_insight", observedWork: `Observed reporting workflow example ${employeeNumber}`, observationRecency: "Recent", opportunityToObserve: "enough", supportDegree: "some_support", capabilityObservations: ["think_clearly","make_information_useful","turn_priorities_into_progress"], concreteExamples: [`Natural manager wording ${employeeNumber}`], suitableOpportunity: `Improve the reporting handoff in a naturally worded way ${employeeNumber}`, intendedOutcome: `Reduce avoidable reconciliation in example ${employeeNumber}`, conditionTime: "Two hours agreed", conditionTools: "available", conditionAccess: "available", conditionSupervision: "Manager review", conditionSuitableWork: "available" });
  const submitEmployee = async (index: number) => { const assessment = assessments[index]!; const employee = employees[index]!; await saveAssessment(context, "Employee", employee, { action: "save_assessment", assessmentId: assessment.id, answers, currentQuestionIndex: 17, expectedRevision: 1, idempotencyKey: `employee-save-${index}` }); const resumed = jsonQuery<Array<{ current_question_index: number }>>(`select current_question_index from public.levytate_lift_assessments where id=${literal(assessment.id)}`)[0]; assert.equal(resumed?.current_question_index, 17); await submitAssessment(context, "Employee", employee, { action: "submit_assessment", assessmentId: assessment.id, expectedRevision: 1, idempotencyKey: `employee-submit-${index}` }); };
  const submitManager = async (index: number) => { const employee = employees[index]!; await saveManagerPerspective(context, "Line Manager", manager, { action: "save_manager_perspective", employeeId: employee.id, observations: perspective(index + 1), expectedRevision: 1, idempotencyKey: `manager-save-${index}` }); await submitManagerPerspective(context, "Line Manager", manager, { action: "submit_manager_perspective", employeeId: employee.id, expectedRevision: 1, idempotencyKey: `manager-submit-${index}` }); };

  await submitEmployee(0); assert.equal(Number(psql("select count(*) from public.levytate_lift_opportunity_candidates where employee_id='lift-employee-1'")), 0); await submitManager(0);
  await assert.rejects(saveManagerPerspective(context, "Line Manager", manager, { action: "save_manager_perspective", employeeId: employees[0]!.id, observations: { ...perspective(1), observedWork: "Forbidden direct API overwrite" }, expectedRevision: 1, idempotencyKey: "forbidden-overwrite-1" }), /immutable/);
  await submitManager(1); assert.equal(Number(psql("select count(*) from public.levytate_lift_opportunity_candidates where employee_id='lift-employee-2'")), 0); await submitEmployee(1);
  await Promise.all([submitEmployee(2), submitManager(2)]); await submitAssessment(context, "Employee", employees[2]!, { action: "submit_assessment", assessmentId: assessments[2]!.id, expectedRevision: 1, idempotencyKey: "employee-retry-2" });
  await submitEmployee(3); failCandidateInsertOnce = true; await assert.rejects(submitManager(3), /Injected interrupted reconciliation/); await submitManagerPerspective(context, "Line Manager", manager, { action: "submit_manager_perspective", employeeId: employees[3]!.id, expectedRevision: 1, idempotencyKey: "manager-retry-3" });
  await submitManager(4); await submitEmployee(4);
  assert.equal(Number(psql("select count(*) from public.levytate_lift_opportunity_candidates where employee_id like 'lift-employee-%'")), 5, "Retries and both orders produce one candidate per employee.");
  assert.equal(Number(psql("select count(*) from public.levytate_lift_opportunities")), 1, "Five distinct contributors produce one privacy-safe route.");
  assert.equal(Number(psql("select count(*) from public.levytate_lift_opportunity_route_members")), 5, "Route retains traceable evidence membership.");
  const original = psql("select observed_work from public.levytate_lift_manager_observation_revisions where observation_id in (select id from public.levytate_lift_manager_observations where employee_id='lift-employee-1') and revision_number=1");
  assert.match(original, /Observed reporting workflow/);
  const opportunityId = psql("select id from public.levytate_lift_opportunities limit 1");
  await recordDecision(context, "Apprenticeship Lead", { action: "record_decision", opportunityId, decision: { status: "selected", selectedOptionId: "bounded_trial", rationale: "Run a bounded reporting trial with explicit assumptions.", owner: "Fictional owner", intendedMeasure: "Comparable reconciliation minutes", assumptions: [{ id: "assumption-1", label: "Scope", value: "One fictional reporting workflow", unit: null, status: "reported" }], valueScenario: null, sharedBenefitIds: [] }, idempotencyKey: "connected-decision-001" });
  const baseline = { id: "39000000-0000-4000-a000-000000000101", source: "operational_baseline" as const, version: "v1", recordedAt: "2026-10-21T09:00:00Z", subject: "reporting", permissions: "authorised_employer" as const, description: "Fictional baseline", limitations: [], quantity: { value: 30, unit: "minutes", population: "one report", period: "one week" } };
  const outcome = { ...baseline, id: "39000000-0000-4000-a000-000000000102", source: "measured_outcome" as const, description: "Fictional outcome", quantity: { ...baseline.quantity, value: 22 } };
  const proof = { revision: 0, state: "change_tested", baseline, outcome: null, agreedScope: "One fictional report", owner: "Fictional owner", intendedMeasure: "Reconciliation minutes", reviewedBy: null, verification: "not_reviewed", otherRelevantChanges: [], limitations: [], followUpAt: null } satisfies Omit<LiftProofRecord, "opportunityId" | "updatedAt">;
  await recordProof(context, "Apprenticeship Lead", { action: "record_proof", opportunityId, proof, expectedRevision: 0, idempotencyKey: "connected-proof-001" });
  await recordProof(context, "Apprenticeship Lead", { action: "record_proof", opportunityId, proof: { ...proof, revision: 1, state: "outcome_evidenced", outcome, reviewedBy: "Authorised reviewer", verification: "internal_review" }, expectedRevision: 1, idempotencyKey: "connected-proof-002" });
  assert.equal(Number(psql("select count(*) from public.levytate_lift_decisions")), 1);
  assert.equal(Number(psql("select count(*) from public.levytate_lift_decision_assumptions")), 1);
  assert.equal(Number(psql("select count(*) from public.levytate_lift_proof_records where baseline_evidence_id is not null and outcome_evidence_id is not null")), 1);
  assert.equal(Number(psql("select count(*) from public.levytate_lift_manager_observations where status='released' and employee_id like 'lift-employee-%'")), 5);
  console.log("Connected Lift validation passed: actual server services persisted invitation, save/resume, both submission orders, retry recovery, aggregate route, decision assumptions and proof evidence in isolated PostgreSQL.");
}

void main().finally(() => server.close());
