const baseUrl = (process.argv[2] ?? "http://localhost:3060").replace(/\/$/, "");
const betaCode = process.env.LEVYTATE_BETA_CODE || "LEVYTATE-BETA";
const learnerId = "gc-lifecycle-record-on-track";
const breakLearnerId = "gc-lifecycle-record-break";
const checks = [];
const today = dateOffset(0);
const assessmentStart = dateOffset(7);

async function main() {
  const lead = await login("Apprenticeship Lead", "apprenticeshiplead.demo@levytate.test");
  const employee = await login("Employee", "employee.demo@levytate.test");
  const manager = await login("Line Manager", "manager.demo@levytate.test");
  const isolation = await login("Isolation employee", "isolation.employee.demo@levytate.test");
  const initial = await learner(lead.cookie, learnerId);
  assert("Validation learner starts enrolled", initial.lifecycleStatus === "enrolled", initial.lifecycleStatus);

  const initialPatch = readinessInput(initial.activityVersion, { confirmations: {} });
  await expect("Employee readiness mutation denied", () => patch(employee.cookie, learnerId, initialPatch), 403);
  await expect("Line Manager readiness mutation denied", () => patch(manager.cookie, learnerId, initialPatch), 403);
  await expectAny("Cross-organisation mutation denied", () => patch(isolation.cookie, learnerId, initialPatch), [403, 404]);
  await expect("Invalid assessment model rejected", () => patch(lead.cookie, learnerId, { ...initialPatch, assessmentModel: "epa_only" }), 400);
  await expect("Other model requires explanation", () => patch(lead.cookie, learnerId, { ...initialPatch, assessmentModel: "other", assessmentModelExplanation: "" }), 400);

  const saved = await json(() => patch(lead.cookie, learnerId, initialPatch));
  assert("Assessment model and organisation persist", saved.response.status === 200 && saved.body.learner?.assessmentReadiness?.assessmentModel === "end_point_assessment" && saved.body.learner?.assessmentReadiness?.assessmentOrganisation === "Independent Assessment Service", saved.body);
  await expect("Stale readiness update rejected", () => patch(lead.cookie, learnerId, { ...initialPatch, assessmentNotes: "Stale update" }), 409);

  const prepared = await json(() => post(lead.cookie, learnerId, "assessment-preparation", { expectedActivityVersion: saved.body.learner.activityVersion, idempotencyKey: key("prepare") }));
  assert("Learner moves to assessment preparation", prepared.response.status === 200 && prepared.body.created === true && prepared.body.learner?.lifecycleStatus === "assessment_preparation", prepared.body);
  const duplicatePreparation = await json(() => post(lead.cookie, learnerId, "assessment-preparation", { expectedActivityVersion: prepared.body.learner.activityVersion, idempotencyKey: key("prepare-duplicate") }));
  assert("Duplicate preparation transition is safe", duplicatePreparation.response.status === 200 && duplicatePreparation.body.created === false, duplicatePreparation.body);
  await expect("Incomplete readiness cannot be confirmed", () => post(lead.cookie, learnerId, "confirm-assessment-readiness", { expectedActivityVersion: prepared.body.learner.activityVersion, idempotencyKey: key("blocked-readiness"), gatewayDate: today }), 400);

  const completed = await json(() => patch(lead.cookie, learnerId, readinessInput(prepared.body.learner.activityVersion, { confirmations: confirmationInput() })));
  assert("Central readiness becomes ready", completed.response.status === 200 && completed.body.learner?.assessmentReadinessResult?.readyForAssessment === true, completed.body.learner?.assessmentReadinessResult);
  const confirmed = await json(() => post(lead.cookie, learnerId, "confirm-assessment-readiness", { expectedActivityVersion: completed.body.learner.activityVersion, idempotencyKey: key("confirm"), gatewayDate: today }));
  assert("Assessment readiness is confirmed", confirmed.response.status === 200 && confirmed.body.created === true && confirmed.body.learner?.assessmentReadiness?.assessmentStatus === "readiness_confirmed", confirmed.body);
  const duplicateConfirmation = await json(() => post(lead.cookie, learnerId, "confirm-assessment-readiness", { expectedActivityVersion: confirmed.body.learner.activityVersion, idempotencyKey: key("confirm-duplicate"), gatewayDate: today }));
  assert("Duplicate readiness confirmation is safe", duplicateConfirmation.response.status === 200 && duplicateConfirmation.body.created === false, duplicateConfirmation.body);

  const started = await json(() => post(lead.cookie, learnerId, "start-assessment", { expectedActivityVersion: confirmed.body.learner.activityVersion, idempotencyKey: key("start"), assessmentStartDate: assessmentStart }));
  assert("Learner enters assessment", started.response.status === 200 && started.body.learner?.lifecycleStatus === "in_assessment" && started.body.learner?.assessmentReadiness?.assessmentStatus === "in_assessment", started.body);
  await expect("Already in-assessment transition rejected", () => post(lead.cookie, learnerId, "start-assessment", { expectedActivityVersion: started.body.learner.activityVersion, idempotencyKey: key("start-duplicate"), assessmentStartDate: assessmentStart }), 409);

  const breakLearner = await learner(lead.cookie, breakLearnerId);
  await expect("Break in Learning readiness update rejected", () => patch(lead.cookie, breakLearnerId, readinessInput(breakLearner.activityVersion, {})), 400);
  await expect("Break in Learning preparation rejected", () => post(lead.cookie, breakLearnerId, "assessment-preparation", { expectedActivityVersion: breakLearner.activityVersion, idempotencyKey: key("break") }), 400);

  const relogin = await login("Apprenticeship Lead relogin", "apprenticeshiplead.demo@levytate.test");
  const persisted = await learner(relogin.cookie, learnerId);
  assert("Assessment state persists after relogin", persisted.lifecycleStatus === "in_assessment" && persisted.assessmentReadiness?.assessmentStartDate === assessmentStart, persisted.assessmentReadiness);
  assert("Assessment lifecycle events persist", ["assessment_model_confirmed", "moved_to_assessment_preparation", "provider_readiness_confirmed", "assessment_readiness_confirmed", "learner_entered_assessment"].every((type) => persisted.lifecycleTimeline.some((event) => event.eventType === type)), persisted.lifecycleTimeline);

  const actions = await getJson(relogin.cookie, "/api/levytate-operational-actions?includeTerminal=true");
  const learnerActions = (actions.body.actions ?? []).filter((action) => action.learnerRecordId === learnerId && action.sourceType === "assessment_readiness");
  assert("Assessment actions persist and resolve", actions.response.status === 200 && learnerActions.length > 0 && learnerActions.every((action) => ["completed", "dismissed", "cancelled"].includes(action.status)), learnerActions);
  console.log(JSON.stringify({ ok: true, baseUrl, summary: { passed: checks.length, failed: 0 }, checks }, null, 2));
}

function readinessInput(version, overrides) {
  return {
    expectedActivityVersion: version,
    assessmentModel: "end_point_assessment",
    assessmentModelExplanation: "",
    assessmentOrganisation: "Independent Assessment Service",
    assessmentContact: "Gateway coordination team",
    assessmentReference: `GC-READY-${Date.now()}`,
    assessmentNotes: "Readiness evidence reviewed through the controlled Ground Control demonstration journey.",
    expectedAssessmentReadinessDate: today,
    gatewayDate: today,
    expectedAssessmentStartDate: assessmentStart,
    ...overrides,
  };
}
function confirmationInput() {
  return Object.fromEntries(["provider", "learner", "line_manager", "employer"].map((type) => [type, { status: "confirmed", confirmedDate: today, confirmedBy: type === "provider" ? "Provider reviewer" : type === "learner" ? "Learner confirmation" : type === "line_manager" ? "Line manager" : "Priya Shah", evidenceReference: type === "provider" ? "GC-PROVIDER-READY" : "", note: "Readiness confirmed." }]));
}
async function login(label, email) { const response = await fetch(`${baseUrl}/api/levytate-beta-login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, code: betaCode }) }); const body = await safe(response); assert(`${label} login accepted`, response.status === 200, body); const cookie = response.headers.get("set-cookie")?.split(";")[0] ?? ""; assert(`${label} session cookie set`, Boolean(cookie), body); return { cookie }; }
async function learner(cookie, id) { const result = await getJson(cookie, `/api/levytate-learners/${id}`); assert(`Learner ${id} loads`, result.response.status === 200 && result.body.learner, result.body); return result.body.learner; }
function patch(cookie, id, body) { return request(cookie, `/api/levytate-learners/${id}/assessment-readiness`, { method: "PATCH", body: JSON.stringify(body) }); }
function post(cookie, id, route, body) { return request(cookie, `/api/levytate-learners/${id}/${route}`, { method: "POST", body: JSON.stringify(body) }); }
function request(cookie, path, init = {}) { return fetch(`${baseUrl}${path}`, { ...init, headers: { "content-type": "application/json", cookie, ...(init.headers || {}) } }); }
async function getJson(cookie, path) { const response = await request(cookie, path); return { response, body: await safe(response) }; }
async function json(action) { const response = await action(); return { response, body: await safe(response) }; }
async function expect(label, action, status) { const response = await action(); assert(label, response.status === status, { expected: status, actual: response.status, body: await safe(response) }); }
async function expectAny(label, action, statuses) { const response = await action(); assert(label, statuses.includes(response.status), { expected: statuses, actual: response.status, body: await safe(response) }); }
function dateOffset(days) { const value = new Date(); value.setUTCDate(value.getUTCDate() + days); return value.toISOString().slice(0, 10); }
function key(label) { return `op6a-${label}-${Date.now()}`; }
async function safe(response) { try { return await response.clone().json(); } catch { return {}; } }
function assert(label, condition, detail) { checks.push({ label, ok: Boolean(condition) }); if (!condition) { console.error(`FAIL: ${label}`); if (detail !== undefined) console.error(JSON.stringify(detail, null, 2)); process.exit(1); } console.log(`PASS: ${label}`); }
main().catch((error) => { console.error(error); process.exitCode = 1; });
