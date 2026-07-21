import fs from "node:fs/promises";
import path from "node:path";

await loadRuntimeEnv();

const baseUrl = (process.argv.find((value) => value.startsWith("http")) || process.env.LEVYTATE_BASE_URL || "http://localhost:3025").replace(/\/$/, "");
const betaCode = process.env.LEVYTATE_BETA_CODE || "LEVYTATE-BETA";
const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const checks = [];

if (!supabaseUrl || !serviceKey) throw new Error("Supabase service configuration is required.");

const manager = await login("manager.demo@levytate.test", "198.51.100.251");
const employee = await login("employee.demo@levytate.test", "198.51.100.252");
const lead = await login("apprenticeshiplead.demo@levytate.test", "198.51.100.253");
const isolation = await login("isolation.employee.demo@levytate.test", "198.51.100.254");

const managerUser = await selectOne("levytate_users", { email: "eq.manager.demo@levytate.test" });
const managerEmployee = await selectOne("levytate_employees", { organisation_id: `eq.${managerUser.organisation_id}`, email: "eq.manager.demo@levytate.test" });
const directReports = await select("levytate_employees", { organisation_id: `eq.${managerUser.organisation_id}`, manager_id: `eq.${managerEmployee.id}`, status: "eq.Active" });
const directReportIds = new Set(directReports.map((person) => person.id));

const initial = await request("/api/levytate-manager/actions", manager.cookie);
assert("manager action list succeeds", initial.status === 200 && initial.body.source === "supabase", initial.body);
assert("only non-terminal manager actions are listed", initial.body.actions?.every((action) => ["open", "acknowledged", "in_progress"].includes(action.status)), initial.body.actions);
assert("summary counts are derived from the authorised list", initial.body.summary.open === initial.body.actions.filter((action) => action.status === "open").length && initial.body.summary.acknowledged === initial.body.actions.filter((action) => action.status === "acknowledged").length && initial.body.summary.inProgress === initial.body.actions.filter((action) => action.status === "in_progress").length, initial.body.summary);
assert("manager response excludes organisation and learner-record IDs", !JSON.stringify(initial.body).match(/organisationId|organisation_id|learnerRecordId|learner_record_id|applicationId|application_id|ownerUserId|owner_user_id/), initial.body);
assert("provider, HR and Apprenticeship Lead actions are excluded", initial.body.actions.every((action) => !/provider review|l&d check-in|hr approval|complete enrolment|add progress update/i.test(action.title)), initial.body.actions);
assert("all listed source links remain in authorised manager workflows", initial.body.actions.every((action) => action.kind === "application_review" ? /^\/levytate\/app\?module=Approvals&application=/.test(action.sourceUrl) : action.sourceUrl.startsWith("/levytate/app/my-team/")), initial.body.actions);

for (const filter of ["open", "acknowledged", "in_progress", "overdue"]) {
  const filtered = await request(`/api/levytate-manager/actions?status=${filter}`, manager.cookie);
  assert(`${filter} filter succeeds`, filtered.status === 200);
  assert(`${filter} filter is scoped`, filtered.body.actions.every((action) => filter === "overdue" ? action.overdue : action.status === filter), filtered.body.actions);
}

for (const [label, actor] of [["Employee", employee], ["Apprenticeship Lead", lead], ["cross-organisation user", isolation]]) {
  const denied = await request("/api/levytate-manager/actions", actor.cookie);
  assert(`${label} cannot list manager actions`, denied.status === 403 && !containsRawError(denied.body), denied.body);
}

const target = initial.body.actions.find((action) => action.status === "open" && /manager check-in/i.test(action.title)) || initial.body.actions.find((action) => action.status === "open");
assert("an open canonical manager action is available", Boolean(target), initial.body.actions);
const targetRow = await selectOne("levytate_operational_actions", { organisation_id: `eq.${managerUser.organisation_id}`, id: `eq.${target.actionId}` });
const targetLearnerId = targetRow.learner_record_id;
const actionSnapshot = await select("levytate_operational_actions", { organisation_id: `eq.${managerUser.organisation_id}`, learner_record_id: `eq.${targetLearnerId}` });
const snapshotActionIds = actionSnapshot.map((row) => row.id);
const eventSnapshot = snapshotActionIds.length ? await select("levytate_operational_action_events", { organisation_id: `eq.${managerUser.organisation_id}`, operational_action_id: `in.(${snapshotActionIds.join(",")})` }) : [];
const reviewSnapshot = await select("levytate_learner_reviews", { organisation_id: `eq.${managerUser.organisation_id}`, learner_record_id: `eq.${targetLearnerId}` });
const learnerSnapshot = await selectOne("levytate_learner_records", { organisation_id: `eq.${managerUser.organisation_id}`, id: `eq.${targetLearnerId}` });
const progressSnapshot = await select("levytate_learner_progress_updates", { organisation_id: `eq.${managerUser.organisation_id}`, learner_record_id: `eq.${targetLearnerId}` });
const employeeSnapshot = await selectOne("levytate_employees", { organisation_id: `eq.${managerUser.organisation_id}`, id: `eq.${targetRow.employee_id}` });

try {
  const detail = await request(`/api/levytate-manager/actions/${target.actionId}`, manager.cookie);
  assert("authorised action detail succeeds", detail.status === 200 && detail.body.action?.employee?.name === target.employeeName, detail.body);
  assert("detail is manager-safe and contains readable history", Array.isArray(detail.body.action?.history) && !JSON.stringify(detail.body).match(/organisationId|learnerRecordId|applicationId|ownerUserId/), detail.body);

  const acknowledged = await post(`/api/levytate-manager/actions/${target.actionId}/acknowledge`, manager.cookie, { expectedVersion: target.version, actorName: "Spoofed actor" });
  assert("open action can be acknowledged", acknowledged.status === 200 && acknowledged.body.action?.status === "acknowledged", acknowledged.body);
  const duplicateAcknowledgement = await post(`/api/levytate-manager/actions/${target.actionId}/acknowledge`, manager.cookie, { expectedVersion: target.version });
  assert("duplicate acknowledgement is idempotent", duplicateAcknowledgement.status === 200 && duplicateAcknowledgement.body.action?.version === acknowledged.body.action.version, duplicateAcknowledgement.body);
  assert("acknowledgement creates one actor-labelled event", acknowledged.body.action.history.filter((event) => event.eventType === "acknowledged" && event.actorName === "Morgan Price").length === 1, acknowledged.body.action.history);

  const stale = await post(`/api/levytate-manager/actions/${target.actionId}/start`, manager.cookie, { expectedVersion: target.version });
  assert("stale version fails safely", stale.status === 409 && !containsRawError(stale.body), stale.body);
  const started = await post(`/api/levytate-manager/actions/${target.actionId}/start`, manager.cookie, { expectedVersion: acknowledged.body.action.version, note: "Coordinate the agreed direct-report support." });
  assert("acknowledged action can move to in progress", started.status === 200 && started.body.action?.status === "in_progress", started.body);
  const duplicateStart = await post(`/api/levytate-manager/actions/${target.actionId}/start`, manager.cookie, { expectedVersion: acknowledged.body.action.version, note: "Duplicate retry must not create another event." });
  assert("duplicate start is idempotent", duplicateStart.status === 200 && duplicateStart.body.action?.version === started.body.action.version, duplicateStart.body);
  assert("start creates one actor-labelled event", started.body.action.history.filter((event) => event.eventType === "started" && event.actorName === "Morgan Price").length === 1, started.body.action.history);

  const repeatedSync = await request("/api/levytate-manager/actions", manager.cookie);
  const persisted = repeatedSync.body.actions.find((action) => action.actionId === target.actionId);
  assert("repeated synchronisation preserves in-progress state", persisted?.status === "in_progress" && persisted.version === started.body.action.version, persisted);

  const lifecycleAfter = await selectOne("levytate_learner_records", { organisation_id: `eq.${managerUser.organisation_id}`, id: `eq.${targetLearnerId}` });
  const reviewsAfter = await select("levytate_learner_reviews", { organisation_id: `eq.${managerUser.organisation_id}`, learner_record_id: `eq.${targetLearnerId}` });
  const progressAfter = await select("levytate_learner_progress_updates", { organisation_id: `eq.${managerUser.organisation_id}`, learner_record_id: `eq.${targetLearnerId}` });
  assert("acknowledge and start do not mutate lifecycle or review source data", JSON.stringify(learnerSnapshot) === JSON.stringify(lifecycleAfter) && JSON.stringify(reviewSnapshot) === JSON.stringify(reviewsAfter) && JSON.stringify(progressSnapshot) === JSON.stringify(progressAfter), { lifecycleAfter, reviewsAfter, progressAfter });

  const genericComplete = await fetch(`${baseUrl}/api/levytate-operational-actions/${target.actionId}`, { method: "PATCH", headers: { "content-type": "application/json", cookie: manager.cookie }, body: JSON.stringify({ command: "complete", expectedVersion: started.body.action.version, resolvedOutsideLevyTate: true, completionNote: "A manager must not complete this action manually." }) });
  assert("Line Manager cannot use organisation-wide completion", genericComplete.status === 403);
  const genericList = await request("/api/levytate-operational-actions", manager.cookie);
  assert("Line Manager cannot list organisation-wide actions", genericList.status === 403);

  await update("levytate_operational_actions", { organisation_id: `eq.${managerUser.organisation_id}`, id: `eq.${target.actionId}` }, { owner_user_id: "another-manager-validation" });
  const otherManagerOwned = await request(`/api/levytate-manager/actions/${target.actionId}`, manager.cookie);
  assert("action assigned to another manager is denied", otherManagerOwned.status === 403 && !containsRawError(otherManagerOwned.body), otherManagerOwned.body);
  await update("levytate_operational_actions", { organisation_id: `eq.${managerUser.organisation_id}`, id: `eq.${target.actionId}` }, { owner_user_id: targetRow.owner_user_id });

  await update("levytate_employees", { organisation_id: `eq.${managerUser.organisation_id}`, id: `eq.${targetRow.employee_id}` }, { manager_id: "gc-lifecycle-employee-jules" });
  const staleScope = await request(`/api/levytate-manager/actions/${target.actionId}`, manager.cookie);
  assert("former direct-report action is denied after scope changes", staleScope.status === 403 && !containsRawError(staleScope.body), staleScope.body);
  await update("levytate_employees", { organisation_id: `eq.${managerUser.organisation_id}`, id: `eq.${targetRow.employee_id}` }, { manager_id: employeeSnapshot.manager_id });

  const allOrganisationActions = await select("levytate_operational_actions", { organisation_id: `eq.${managerUser.organisation_id}` });
  const nonReport = allOrganisationActions.find((action) => !directReportIds.has(action.employee_id));
  const excludedOwner = allOrganisationActions.find((action) => ["HR", "Provider", "Apprenticeship Lead", "Employee"].includes(action.owner_type));
  const crossOrganisation = (await select("levytate_operational_actions", { organisation_id: `neq.${managerUser.organisation_id}` }))[0];
  for (const [label, actionId] of [["same-organisation non-report", nonReport?.id], ["excluded owner", excludedOwner?.id], ["cross-organisation copied ID", crossOrganisation?.id], ["unknown copied ID", "unknown-manager-action-id"]]) {
    if (!actionId && label !== "unknown copied ID") continue;
    const denied = await request(`/api/levytate-manager/actions/${actionId}`, manager.cookie);
    assert(`${label} fails safely`, denied.status === 403 && !containsRawError(denied.body), denied.body);
  }

  if (targetRow.action_type === "record_manager_check_in") {
    const managerReviews = reviewSnapshot.filter((review) => review.review_type === "manager_check_in").sort((left, right) => right.review_date.localeCompare(left.review_date));
    const sourceReview = managerReviews[0];
    assert("manager check-in source review exists", Boolean(sourceReview), managerReviews);
    await update("levytate_learner_reviews", { organisation_id: `eq.${managerUser.organisation_id}`, id: `eq.${sourceReview.id}` }, { next_review_date: addDays(today(), 90), status: "completed" });
    const completionSync = await request("/api/levytate-manager/actions", manager.cookie);
    assert("source-workflow resolution removes the active action", !completionSync.body.actions.some((action) => action.actionId === target.actionId), completionSync.body.actions);
    const completed = await request(`/api/levytate-manager/actions/${target.actionId}`, manager.cookie);
    assert("source-workflow resolution completes only the related action", completed.status === 200 && completed.body.action?.status === "completed" && completed.body.action.history.some((event) => event.eventType === "completed"), completed.body);
    const terminalStart = await post(`/api/levytate-manager/actions/${target.actionId}/start`, manager.cookie, { expectedVersion: completed.body.action.version });
    assert("terminal action cannot be restarted", terminalStart.status === 409 && terminalStart.body.message === "This action was updated by someone else. Refresh to view the latest status." && !containsRawError(terminalStart.body), terminalStart.body);
  }

  const copilot = await ask(manager.cookie, "What actions need my attention?");
  const copilotRows = copilot.structuredResult?.rows ?? [];
  assert("Copilot returns persisted manager action status", copilotRows.every((row) => ["Open", "Acknowledged", "In progress"].includes(row.cells?.status)), copilotRows);
  assert("Copilot deep links open authorised Home actions", copilotRows.flatMap((row) => row.actions ?? []).every((action) => /^\/levytate\/app\?module=Home&managerAction=/.test(action.url)), copilotRows);

  const sourcePage = await fetch(`${baseUrl}${target.sourceUrl}`, { headers: { cookie: manager.cookie } });
  assert("authorised source-workflow deep link opens", sourcePage.status === 200);
} finally {
  await update("levytate_employees", { organisation_id: `eq.${managerUser.organisation_id}`, id: `eq.${targetRow.employee_id}` }, { manager_id: employeeSnapshot.manager_id });
  for (const review of reviewSnapshot) await update("levytate_learner_reviews", { organisation_id: `eq.${managerUser.organisation_id}`, id: `eq.${review.id}` }, review);
  const currentActions = await select("levytate_operational_actions", { organisation_id: `eq.${managerUser.organisation_id}`, learner_record_id: `eq.${targetLearnerId}` });
  const allActionIds = [...new Set([...snapshotActionIds, ...currentActions.map((row) => row.id)])];
  if (allActionIds.length) await remove("levytate_operational_action_events", { organisation_id: `eq.${managerUser.organisation_id}`, operational_action_id: `in.(${allActionIds.join(",")})` });
  await remove("levytate_operational_actions", { organisation_id: `eq.${managerUser.organisation_id}`, learner_record_id: `eq.${targetLearnerId}` });
  if (actionSnapshot.length) await insert("levytate_operational_actions", actionSnapshot);
  if (eventSnapshot.length) await insert("levytate_operational_action_events", eventSnapshot);
}

const restoredActions = await select("levytate_operational_actions", { organisation_id: `eq.${managerUser.organisation_id}`, learner_record_id: `eq.${targetLearnerId}` });
const restoredReviews = await select("levytate_learner_reviews", { organisation_id: `eq.${managerUser.organisation_id}`, learner_record_id: `eq.${targetLearnerId}` });
assert("validation fixture actions are restored exactly", JSON.stringify(sortRows(restoredActions)) === JSON.stringify(sortRows(actionSnapshot)));
assert("validation fixture review business state is restored", JSON.stringify(sortRows(restoredReviews).map(reviewBusinessState)) === JSON.stringify(sortRows(reviewSnapshot).map(reviewBusinessState)));

const routeSource = await fs.readFile(path.join(process.cwd(), "app/api/levytate-manager/actions/[actionId]/route.ts"), "utf8");
const serverSource = await fs.readFile(path.join(process.cwd(), "lib/server/levytate-operational-actions.ts"), "utf8");
assert("manager detail route exposes no generic PATCH mutation", !routeSource.includes("export async function PATCH"));
assert("manager transition path exposes no complete, dismiss, cancel or reassignment command", !/completeManagerDirectReportOperationalAction|dismissManagerDirectReportOperationalAction|cancelManagerDirectReportOperationalAction|assignManagerDirectReportOperationalAction/.test(serverSource));

console.log(JSON.stringify({ baseUrl, source: "supabase", actionFamilies: initial.body.actions.map((action) => action.title.replace(/ for .+$/, "")), checksPassed: checks.length, fixtureRestored: true }, null, 2));

async function login(email, ip) {
  const response = await fetch(`${baseUrl}/api/levytate-beta-login`, { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": ip }, body: JSON.stringify({ email, code: betaCode }) });
  const body = await safeJson(response);
  assert(`login succeeds for ${email}`, response.status === 200, body);
  const cookie = response.headers.get("set-cookie")?.split(";")[0];
  if (!cookie) throw new Error(`No signed session was returned for ${email}.`);
  return { cookie };
}

async function request(url, cookie) { const response = await fetch(`${baseUrl}${url}`, { headers: { cookie } }); return { status: response.status, body: await safeJson(response) }; }
async function post(url, cookie, body) { const response = await fetch(`${baseUrl}${url}`, { method: "POST", headers: { "content-type": "application/json", cookie }, body: JSON.stringify(body) }); return { status: response.status, body: await safeJson(response) }; }
async function ask(cookie, userMessage) { const response = await fetch(`${baseUrl}/api/levytate-ai`, { method: "POST", headers: { "content-type": "application/json", cookie, "x-forwarded-for": "198.51.100.255" }, body: JSON.stringify({ role: "Line Manager", userRole: "Line Manager", selectedSite: "All sites", currentSection: "Copilot", userMessage, conversationHistory: [], employerContext: "Ground Control" }) }); const body = await safeJson(response); assert("Copilot request succeeds", response.status === 200, body); return body; }

async function select(table, filters) { return rest(table, { method: "GET", query: { select: "*", ...filters } }); }
async function selectOne(table, filters) { const rows = await rest(table, { method: "GET", query: { select: "*", ...filters, limit: "1" } }); if (!rows[0]) throw new Error(`Required ${table} fixture is missing.`); return rows[0]; }
async function update(table, filters, body) { return rest(table, { method: "PATCH", query: filters, body, prefer: "return=representation" }); }
async function insert(table, body) { return rest(table, { method: "POST", body, prefer: "return=representation" }); }
async function remove(table, filters) { return rest(table, { method: "DELETE", query: filters, prefer: "return=minimal" }); }
async function rest(table, { method, query = {}, body, prefer }) { const params = new URLSearchParams(query); const response = await fetch(`${supabaseUrl}/rest/v1/${table}?${params}`, { method, headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json", ...(prefer ? { Prefer: prefer } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }); if (!response.ok) throw new Error(`Fixture operation failed for ${table} (${response.status}).`); const text = await response.text(); return text ? JSON.parse(text) : []; }
async function safeJson(response) { return response.json().catch(() => ({})); }
function assert(label, condition, context) { if (!condition) throw new Error(`Validation failed: ${label}${context === undefined ? "" : `\n${JSON.stringify(context, null, 2)}`}`); checks.push(label); }
function containsRawError(body) { return /supabase|postgres|constraint|organisation_id|learner_record_id|service_role/i.test(JSON.stringify(body)); }
function today() { return new Date().toISOString().slice(0, 10); }
function addDays(value, days) { const date = new Date(`${value}T12:00:00Z`); date.setUTCDate(date.getUTCDate() + days); return date.toISOString().slice(0, 10); }
function sortRows(rows) { return [...rows].sort((left, right) => String(left.id).localeCompare(String(right.id))); }
function reviewBusinessState(row) { const state = { ...row }; delete state.updated_at; return state; }
async function loadRuntimeEnv() { for (const filename of [".env.vercel.local", ".env.local", ".env"]) { try { const content = await fs.readFile(path.join(process.cwd(), filename), "utf8"); for (const line of content.split(/\r?\n/)) { const match = line.match(/^([A-Z0-9_]+)=(.*)$/); if (!match || process.env[match[1]]) continue; process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, ""); } } catch {} } }
