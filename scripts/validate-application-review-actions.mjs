import fs from "node:fs/promises";
import path from "node:path";

await loadRuntimeEnv();

const baseUrl = (process.argv.find((value) => value.startsWith("http")) || process.env.LEVYTATE_BASE_URL || "http://localhost:3025").replace(/\/$/, "");
const betaCode = process.env.LEVYTATE_BETA_CODE || "LEVYTATE-BETA";
const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const applicationId = "gc-rbac-app-erin";
const checks = [];

if (!supabaseUrl || !serviceKey) throw new Error("Supabase service configuration is required.");

const manager = await login("manager.demo@levytate.test", "198.51.100.181");
const employee = await login("employee.demo@levytate.test", "198.51.100.182");
const lead = await login("apprenticeshiplead.demo@levytate.test", "198.51.100.183");
const isolation = await login("isolation.employee.demo@levytate.test", "198.51.100.184");
const managerUser = await selectOne("levytate_users", { email: "eq.manager.demo@levytate.test" });
const managerEmployee = await selectOne("levytate_employees", { organisation_id: `eq.${managerUser.organisation_id}`, email: "eq.manager.demo@levytate.test" });
const erin = await selectOne("levytate_employees", { organisation_id: `eq.${managerUser.organisation_id}`, email: "eq.employee.demo@levytate.test" });
const jules = await selectOne("levytate_employees", { organisation_id: `eq.${managerUser.organisation_id}`, id: "eq.gc-lifecycle-employee-jules" });
const applicationSnapshot = await selectOne("levytate_applications", { organisation_id: `eq.${managerUser.organisation_id}`, id: `eq.${applicationId}` });
const historySnapshot = await select("levytate_application_history", { organisation_id: `eq.${managerUser.organisation_id}`, application_id: `eq.${applicationId}` });
const actionSnapshot = await select("levytate_operational_actions", { organisation_id: `eq.${managerUser.organisation_id}`, application_id: `eq.${applicationId}`, action_type: "eq.review_application" });
const snapshotActionIds = actionSnapshot.map((row) => row.id);
const eventSnapshot = snapshotActionIds.length ? await select("levytate_operational_action_events", { organisation_id: `eq.${managerUser.organisation_id}`, operational_action_id: `in.(${snapshotActionIds.join(",")})` }) : [];
const employeeSnapshot = { ...erin };
const fixturePrefix = `application-review-validation-${Date.now()}`;

try {
  await update("levytate_employees", { organisation_id: `eq.${managerUser.organisation_id}`, id: `eq.${erin.id}` }, { status: "Active", manager_id: managerEmployee.id });
  await update("levytate_applications", { organisation_id: `eq.${managerUser.organisation_id}`, id: `eq.${applicationId}` }, {
    status: "Awaiting Manager Review",
    current_owner: "Line Manager",
    manager_note: "",
    updated_at: new Date().toISOString(),
  });
  await insert("levytate_application_history", [{
    organisation_id: managerUser.organisation_id,
    id: `${fixturePrefix}-boundary`,
    application_id: applicationId,
    status: "More information requested",
    owner: "Employee",
    note: "Validation occurrence boundary.",
    created_at: new Date(Date.now() - 1000).toISOString(),
  }, {
    organisation_id: managerUser.organisation_id,
    id: `${fixturePrefix}-submitted-1`,
    application_id: applicationId,
    status: "Awaiting Manager Review",
    owner: "Line Manager",
    note: "Validation manager-review occurrence.",
    created_at: new Date().toISOString(),
  }]);

  const initial = await request("/api/levytate-manager/actions?kind=application_review", manager.cookie);
  assert("review-action list succeeds", initial.status === 200 && initial.body.source === "supabase", initial.body);
  const first = initial.body.actions?.filter((action) => action.kind === "application_review" && action.sourceUrl.includes(applicationId)) ?? [];
  assert("one current application-review action is returned", first.length === 1, first);
  const action = first[0];
  assert("review action is high priority with no invented due date", action.priority === "High" && action.dueDate === "", action);
  assert("review action links to the exact Approvals record", action.sourceUrl === `/levytate/app?module=Approvals&application=${applicationId}`, action.sourceUrl);
  assert("review action records the submitted occurrence", action.submittedVersion >= 1 && Boolean(action.submittedDate), { submittedVersion: action.submittedVersion, submittedDate: action.submittedDate });

  const firstRow = await selectOne("levytate_operational_actions", { organisation_id: `eq.${managerUser.organisation_id}`, id: `eq.${action.actionId}` });
  assert("pre-learner action persists with application and employee links", firstRow.learner_record_id === null && firstRow.application_id === applicationId && firstRow.employee_id === erin.id, firstRow);
  assert("authoritative current manager owns the action", firstRow.owner_user_id === managerUser.id && firstRow.owner_display_name === managerEmployee.name, { ownerUserIdMatches: firstRow.owner_user_id === managerUser.id, ownerName: firstRow.owner_display_name });
  const erinLearners = await select("levytate_learner_records", { organisation_id: `eq.${managerUser.organisation_id}`, employee_id: `eq.${erin.id}` });
  assert("no artificial learner record exists for Erin", erinLearners.length === 0, { count: erinLearners.length });

  const repeated = await request("/api/levytate-manager/actions?kind=application_review", manager.cookie);
  const repeatedRows = repeated.body.actions?.filter((item) => item.sourceUrl.includes(applicationId)) ?? [];
  assert("repeated synchronisation is idempotent", repeatedRows.length === 1 && repeatedRows[0].actionId === action.actionId, repeatedRows);
  const activeRows = await activeReviewActions();
  assert("database has one active action for the occurrence", activeRows.length === 1 && activeRows[0].id === action.actionId, activeRows);

  const support = await request("/api/levytate-manager/actions?kind=manager_support", manager.cookie);
  assert("Home support list excludes application reviews", support.body.actions?.every((item) => item.kind === "manager_support"), support.body.actions);
  for (const [label, actor] of [["Employee", employee], ["Apprenticeship Lead", lead], ["cross-organisation user", isolation]]) {
    const denied = await request("/api/levytate-manager/actions?kind=application_review", actor.cookie);
    assert(`${label} cannot list manager-owned review actions`, denied.status === 403 && !containsRawError(denied.body), denied.body);
  }
  const employeeDetail = await request(`/api/levytate-manager/actions/${action.actionId}`, employee.cookie);
  assert("Employee cannot read the manager action by copied ID", employeeDetail.status === 403 && !containsRawError(employeeDetail.body), employeeDetail.body);
  const beforeLeadMutation = await selectOne("levytate_operational_actions", { organisation_id: `eq.${managerUser.organisation_id}`, id: `eq.${action.actionId}` });
  const leadMutation = await patchApi(`/api/levytate-operational-actions/${action.actionId}`, lead.cookie, { command: "acknowledge", expectedVersion: beforeLeadMutation.version });
  const afterLeadMutation = await selectOne("levytate_operational_actions", { organisation_id: `eq.${managerUser.organisation_id}`, id: `eq.${action.actionId}` });
  assert("Apprenticeship Lead organisation visibility is read-only", leadMutation.status === 400 && !containsRawError(leadMutation.body) && afterLeadMutation.status === beforeLeadMutation.status && afterLeadMutation.version === beforeLeadMutation.version, leadMutation.body);
  const sourcePage = await fetch(`${baseUrl}${action.sourceUrl}`, { headers: { cookie: manager.cookie }, redirect: "manual" });
  assert("Approvals deep link opens for the manager", sourcePage.status === 200, { status: sourcePage.status });

  const applicationBeforeTransitions = await selectOne("levytate_applications", { organisation_id: `eq.${managerUser.organisation_id}`, id: `eq.${applicationId}` });
  const currentVersion = afterLeadMutation.version;
  const acknowledged = await post(`/api/levytate-manager/actions/${action.actionId}/acknowledge`, manager.cookie, { expectedVersion: currentVersion });
  assert("review action can be acknowledged", acknowledged.status === 200 && acknowledged.body.action?.status === "acknowledged", acknowledged.body);
  const duplicateAck = await post(`/api/levytate-manager/actions/${action.actionId}/acknowledge`, manager.cookie, { expectedVersion: currentVersion });
  assert("duplicate acknowledge creates no duplicate transition", duplicateAck.status === 200 && duplicateAck.body.action?.version === acknowledged.body.action.version, duplicateAck.body);
  const staleStart = await post(`/api/levytate-manager/actions/${action.actionId}/start`, manager.cookie, { expectedVersion: currentVersion });
  assert("stale start fails safely", staleStart.status === 409 && !containsRawError(staleStart.body), staleStart.body);
  const started = await post(`/api/levytate-manager/actions/${action.actionId}/start`, manager.cookie, { expectedVersion: acknowledged.body.action.version, note: "Review the submitted application evidence." });
  assert("review action can move to in progress", started.status === 200 && started.body.action?.status === "in_progress", started.body);
  const duplicateStart = await post(`/api/levytate-manager/actions/${action.actionId}/start`, manager.cookie, { expectedVersion: acknowledged.body.action.version, note: "Duplicate retry." });
  assert("duplicate start creates no duplicate transition", duplicateStart.status === 200 && duplicateStart.body.action?.version === started.body.action.version, duplicateStart.body);
  const applicationAfterTransitions = await selectOne("levytate_applications", { organisation_id: `eq.${managerUser.organisation_id}`, id: `eq.${applicationId}` });
  assert("acknowledge and start do not mutate the application", JSON.stringify(applicationBeforeTransitions) === JSON.stringify(applicationAfterTransitions));

  const requested = await workspacePost(manager.cookie, {
    type: "updateApplicationStatus",
    id: applicationId,
    status: "More information requested",
    note: "Manager decision by Morgan Price: more information requested.\nRequest: Add the expected reporting outcome.",
  });
  assert("More Information decision succeeds", requested.status === 200, requested.body);
  const completedFirst = await selectOne("levytate_operational_actions", { organisation_id: `eq.${managerUser.organisation_id}`, id: `eq.${action.actionId}` });
  assert("source decision completes the first action", completedFirst.status === "completed" && completedFirst.completion_method === "source_condition_resolved", completedFirst);
  const firstCompletionEvents = await select("levytate_operational_action_events", { organisation_id: `eq.${managerUser.organisation_id}`, operational_action_id: `eq.${action.actionId}`, event_type: "eq.completed" });
  assert("source completion creates one completion event", firstCompletionEvents.length === 1, firstCompletionEvents);

  const employeeWorkspace = await workspaceGet(employee.cookie);
  const employeeApplication = employeeWorkspace.body.workspace.data.applications.find((item) => item.id === applicationId);
  const resubmitted = await workspacePost(employee.cookie, {
    type: "saveApplication",
    application: {
      ...employeeApplication,
      status: "Submitted to Line Manager",
      currentOwner: "Line Manager",
      reason: `${employeeApplication.reason} Validation resubmission adds the requested reporting outcome.`,
      updatedAt: new Date().toISOString(),
    },
  });
  assert("employee resubmission succeeds", resubmitted.status === 200, resubmitted.body);
  const afterResubmit = await request("/api/levytate-manager/actions?kind=application_review", manager.cookie);
  const second = afterResubmit.body.actions?.filter((item) => item.sourceUrl.includes(applicationId)) ?? [];
  assert("resubmission creates one new occurrence action", second.length === 1 && second[0].actionId !== action.actionId && second[0].submittedVersion > action.submittedVersion, second);
  const afterResubmitRepeat = await request("/api/levytate-manager/actions?kind=application_review", manager.cookie);
  assert("resubmission retry does not duplicate the new action", afterResubmitRepeat.body.actions?.filter((item) => item.sourceUrl.includes(applicationId)).length === 1, afterResubmitRepeat.body.actions);

  await update("levytate_employees", { organisation_id: `eq.${managerUser.organisation_id}`, id: `eq.${erin.id}` }, { manager_id: jules.id });
  const leadSync = await post("/api/levytate-operational-actions", lead.cookie, {});
  assert("organisation synchronisation succeeds after manager change", leadSync.status === 200, leadSync.body);
  const reassigned = await selectOne("levytate_operational_actions", { organisation_id: `eq.${managerUser.organisation_id}`, id: `eq.${second[0].actionId}` });
  assert("active review action follows the current manager", reassigned.owner_display_name === jules.name && reassigned.owner_user_id !== managerUser.id, { ownerName: reassigned.owner_display_name, formerOwnerRemoved: reassigned.owner_user_id !== managerUser.id });
  const formerManagerDetail = await request(`/api/levytate-manager/actions/${second[0].actionId}`, manager.cookie);
  assert("former manager loses copied-ID access", formerManagerDetail.status === 403 && !containsRawError(formerManagerDetail.body), formerManagerDetail.body);

  await update("levytate_employees", { organisation_id: `eq.${managerUser.organisation_id}`, id: `eq.${erin.id}` }, { manager_id: managerEmployee.id });
  await post("/api/levytate-operational-actions", lead.cookie, {});
  const currentManager = await request("/api/levytate-manager/actions?kind=application_review", manager.cookie);
  const currentAction = currentManager.body.actions.find((item) => item.sourceUrl.includes(applicationId));
  assert("restored current manager can access the active action", Boolean(currentAction), currentManager.body.actions);
  const approved = await workspacePost(manager.cookie, {
    type: "updateApplicationStatus",
    id: applicationId,
    status: "Approved by Line Manager",
    note: "Manager decision by Morgan Price: approved for Apprenticeship Lead review after validation.",
  });
  assert("approval succeeds", approved.status === 200, approved.body);
  const completedSecond = await selectOne("levytate_operational_actions", { organisation_id: `eq.${managerUser.organisation_id}`, id: `eq.${currentAction.actionId}` });
  assert("approval completes only the current occurrence", completedSecond.status === "completed" && completedSecond.completion_method === "source_condition_resolved", completedSecond);
  const duplicateDecision = await workspacePost(manager.cookie, { type: "updateApplicationStatus", id: applicationId, status: "Declined by Line Manager", note: "Duplicate manager decision." });
  assert("duplicate source decision is denied", duplicateDecision.status === 403 && !containsRawError(duplicateDecision.body), duplicateDecision.body);

  const invalidType = await restRaw("levytate_operational_actions", {
    method: "POST",
    body: { ...firstRow, id: `${fixturePrefix}-invalid`, source_key: `${fixturePrefix}-invalid`, action_type: "invalid_validation_type", learner_record_id: null },
  });
  assert("unknown action type remains constraint-denied", invalidType.status === 400, { status: invalidType.status });
} finally {
  await update("levytate_employees", { organisation_id: `eq.${managerUser.organisation_id}`, id: `eq.${erin.id}` }, employeeSnapshot);
  await update("levytate_applications", { organisation_id: `eq.${managerUser.organisation_id}`, id: `eq.${applicationId}` }, applicationSnapshot);
  const currentHistory = await select("levytate_application_history", { organisation_id: `eq.${managerUser.organisation_id}`, application_id: `eq.${applicationId}` });
  const snapshotHistoryIds = new Set(historySnapshot.map((row) => row.id));
  const extraHistoryIds = currentHistory.filter((row) => !snapshotHistoryIds.has(row.id)).map((row) => row.id);
  if (extraHistoryIds.length) await remove("levytate_application_history", { organisation_id: `eq.${managerUser.organisation_id}`, id: `in.(${extraHistoryIds.join(",")})` });
  const currentActions = await select("levytate_operational_actions", { organisation_id: `eq.${managerUser.organisation_id}`, application_id: `eq.${applicationId}`, action_type: "eq.review_application" });
  const allActionIds = [...new Set([...snapshotActionIds, ...currentActions.map((row) => row.id)])];
  if (allActionIds.length) await remove("levytate_operational_action_events", { organisation_id: `eq.${managerUser.organisation_id}`, operational_action_id: `in.(${allActionIds.join(",")})` });
  await remove("levytate_operational_actions", { organisation_id: `eq.${managerUser.organisation_id}`, application_id: `eq.${applicationId}`, action_type: "eq.review_application" });
  if (actionSnapshot.length) await insert("levytate_operational_actions", actionSnapshot);
  if (eventSnapshot.length) await insert("levytate_operational_action_events", eventSnapshot);
}

const restoredApplication = await selectOne("levytate_applications", { organisation_id: `eq.${managerUser.organisation_id}`, id: `eq.${applicationId}` });
const restoredActions = await select("levytate_operational_actions", { organisation_id: `eq.${managerUser.organisation_id}`, application_id: `eq.${applicationId}`, action_type: "eq.review_application" });
assert("application fixture business state is restored", JSON.stringify(applicationBusinessState(restoredApplication)) === JSON.stringify(applicationBusinessState(applicationSnapshot)));
assert("review-action fixture is restored", JSON.stringify(sortRows(restoredActions)) === JSON.stringify(sortRows(actionSnapshot)));

console.log(JSON.stringify({ baseUrl, source: "supabase", checksPassed: checks.length, fixtureRestored: true }, null, 2));

async function activeReviewActions() {
  const rows = await select("levytate_operational_actions", { organisation_id: `eq.${managerUser.organisation_id}`, application_id: `eq.${applicationId}`, action_type: "eq.review_application" });
  return rows.filter((row) => !["completed", "cancelled", "dismissed"].includes(row.status));
}
async function login(email, ip) { const response = await fetch(`${baseUrl}/api/levytate-beta-login`, { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": ip }, body: JSON.stringify({ email, code: betaCode }) }); const body = await safeJson(response); assert(`login succeeds for ${email}`, response.status === 200, body); const cookie = response.headers.get("set-cookie")?.split(";")[0]; if (!cookie) throw new Error(`No signed session was returned for ${email}.`); return { cookie }; }
async function request(url, cookie) { const response = await fetch(`${baseUrl}${url}`, { headers: { cookie } }); return { status: response.status, body: await safeJson(response) }; }
async function post(url, cookie, body) { const response = await fetch(`${baseUrl}${url}`, { method: "POST", headers: { "content-type": "application/json", cookie }, body: JSON.stringify(body) }); return { status: response.status, body: await safeJson(response) }; }
async function patchApi(url, cookie, body) { const response = await fetch(`${baseUrl}${url}`, { method: "PATCH", headers: { "content-type": "application/json", cookie }, body: JSON.stringify(body) }); return { status: response.status, body: await safeJson(response) }; }
async function workspaceGet(cookie) { return request("/api/levytate-workspace", cookie); }
async function workspacePost(cookie, body) { return post("/api/levytate-workspace", cookie, body); }
async function select(table, filters) { return rest(table, { method: "GET", query: { select: "*", ...filters } }); }
async function selectOne(table, filters) { const rows = await rest(table, { method: "GET", query: { select: "*", ...filters, limit: "1" } }); if (!rows[0]) throw new Error(`Required ${table} fixture is missing.`); return rows[0]; }
async function update(table, filters, body) { return rest(table, { method: "PATCH", query: filters, body, prefer: "return=representation" }); }
async function insert(table, body) { return rest(table, { method: "POST", body, prefer: "return=representation" }); }
async function remove(table, filters) { return rest(table, { method: "DELETE", query: filters, prefer: "return=minimal" }); }
async function rest(table, { method, query = {}, body, prefer }) { const response = await restRaw(table, { method, query, body, prefer }); if (!response.ok) throw new Error(`Fixture operation failed for ${table} (${response.status}).`); const text = await response.text(); return text ? JSON.parse(text) : []; }
async function restRaw(table, { method, query = {}, body, prefer }) { const params = new URLSearchParams(query); return fetch(`${supabaseUrl}/rest/v1/${table}?${params}`, { method, headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json", ...(prefer ? { Prefer: prefer } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }); }
async function safeJson(response) { return response.json().catch(() => ({})); }
function assert(label, condition, context) { if (!condition) throw new Error(`Validation failed: ${label}${context === undefined ? "" : `\n${JSON.stringify(context, null, 2)}`}`); checks.push(label); }
function containsRawError(body) { return /supabase|postgres|constraint|organisation_id|learner_record_id|service_role/i.test(JSON.stringify(body)); }
function sortRows(rows) { return [...rows].sort((left, right) => String(left.id).localeCompare(String(right.id))); }
function applicationBusinessState(row) { const state = { ...row }; delete state.updated_at; return state; }
async function loadRuntimeEnv() { for (const filename of [".env.vercel.local", ".env.local", ".env"]) { try { const content = await fs.readFile(path.join(process.cwd(), filename), "utf8"); for (const line of content.split(/\r?\n/)) { const match = line.match(/^([A-Z0-9_]+)=(.*)$/); if (!match || process.env[match[1]]) continue; process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, ""); } } catch {} } }
