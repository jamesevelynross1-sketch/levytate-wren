import { readFileSync } from "node:fs";

loadEnv(".env.vercel.local");
loadEnv(".env.production.vercel.local", false);

const baseUrl = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");
const betaCode = process.env.LEVYTATE_BETA_CODE || "LEVYTATE-BETA";
const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/rest\/v1\/?$/i, "").replace(/\/$/, "");
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const testId = `operational-action-validation-${Date.now()}`;
const checks = [];

async function main() {
  if (!supabaseUrl || !serviceKey) throw new Error("Supabase service environment is required for live validation.");
  const leadCookie = await login("apprenticeshiplead.demo@levytate.test");
  const employeeCookie = await login("employee.demo@levytate.test");
  const managerCookie = await login("manager.demo@levytate.test");
  const adminCookie = await login("hello@levytate.co.uk");
  const isolationCookie = await login("isolation.employee.demo@levytate.test");

  const leadUser = await selectOne("levytate_users", { email: "eq.apprenticeshiplead.demo@levytate.test" });
  const isolationUser = await selectOne("levytate_users", { email: "eq.isolation.employee.demo@levytate.test" });
  const seedRecord = await selectOne("levytate_learner_records", { organisation_id: `eq.${leadUser.organisation_id}`, record_status: "eq.Active" });
  check("Ground Control learner seed exists", Boolean(seedRecord));

  try {
    await insert("levytate_learner_records", {
      ...without(seedRecord, ["id", "application_id", "enrolment_id", "created_at", "updated_at"]),
      id: testId,
      application_id: `${testId}-application`,
      enrolment_id: `${testId}-enrolment`,
      lifecycle_status: "break_in_learning",
      created_by: leadUser.id,
      updated_by: leadUser.id,
      demonstration_record: true,
    });

    const [syncOne, syncTwo] = await Promise.all([
      requestJson("/api/levytate-operational-actions", leadCookie, { method: "POST" }),
      requestJson("/api/levytate-operational-actions", leadCookie, { method: "POST" }),
    ]);
    check("Simultaneous synchronisation succeeds", syncOne.status === 200 && syncTwo.status === 200, { syncOne: syncOne.body, syncTwo: syncTwo.body });

    const initial = await listForLearner(leadCookie, testId, true);
    const activeInitial = initial.filter((action) => ["open", "acknowledged", "in_progress"].includes(action.status));
    check("Database uniqueness permits one active source action", activeInitial.length === 1, initial);
    check("Lifecycle inconsistency produces the expected action", activeInitial[0]?.actionType === "resolve_lifecycle_inconsistency", activeInitial[0]);

    const repeat = await requestJson("/api/levytate-operational-actions", leadCookie, { method: "POST" });
    check("Repeated synchronisation creates no duplicate", repeat.status === 200 && repeat.body.result?.created === 0, repeat.body);

    const action = activeInitial[0];
    const acknowledged = await patchAction(leadCookie, action.id, { command: "acknowledge", expectedVersion: action.version });
    check("Acknowledgement persists actor-derived state", acknowledged.status === 200 && acknowledged.body.action?.status === "acknowledged", acknowledged.body);
    const duplicateAcknowledgement = await patchAction(leadCookie, action.id, { command: "acknowledge", expectedVersion: action.version });
    check("Duplicate acknowledgement is safe", duplicateAcknowledgement.status === 200 && duplicateAcknowledgement.body.action?.status === "acknowledged", duplicateAcknowledgement.body);
    const stale = await patchAction(leadCookie, action.id, { command: "start", expectedVersion: action.version });
    check("Stale mutation returns 409", stale.status === 409, stale.body);
    const criticalDismissal = await patchAction(leadCookie, action.id, {
      command: "dismiss",
      expectedVersion: acknowledged.body.action.version,
      dismissalKind: "not_applicable",
      dismissalReason: "Validation confirms this critical action cannot be hidden.",
    });
    check("Critical lifecycle inconsistency cannot be dismissed", criticalDismissal.status === 400, criticalDismissal.body);
    const crossOrganisationOwner = await patchAction(leadCookie, action.id, {
      command: "assign",
      expectedVersion: acknowledged.body.action.version,
      ownerType: "Apprenticeship Lead",
      ownerUserId: isolationUser.id,
    });
    check("Owner outside the organisation is rejected", crossOrganisationOwner.status === 400, crossOrganisationOwner.body);

    await update("levytate_learner_records", { organisation_id: `eq.${leadUser.organisation_id}`, id: `eq.${testId}` }, {
      lifecycle_status: "enrolled",
      updated_by: leadUser.id,
    });
    const resolvedSync = await requestJson("/api/levytate-operational-actions", leadCookie, { method: "POST" });
    check("Lifecycle resolution synchronises successfully", resolvedSync.status === 200, resolvedSync.body);
    const resolved = await listForLearner(leadCookie, testId, true);
    const completed = resolved.find((item) => item.id === action.id);
    check("Source resolution completes the action", completed?.status === "completed" && completed.completionMethod === "source_condition_resolved", completed);
    const history = await requestJson(`/api/levytate-operational-actions/${action.id}?history=true`, leadCookie);
    check("Action history retains detected, acknowledged and completed events", ["detected", "acknowledged", "completed"].every((event) => history.body.history?.some((item) => item.eventType === event)), history.body.history);
    const terminalStart = await patchAction(leadCookie, action.id, { command: "start", expectedVersion: completed.version });
    check("Terminal action cannot return to In progress", terminalStart.status === 400, terminalStart.body);

    await update("levytate_learner_records", { organisation_id: `eq.${leadUser.organisation_id}`, id: `eq.${testId}` }, {
      lifecycle_status: "break_in_learning",
      updated_by: leadUser.id,
    });
    const recurrenceSync = await requestJson("/api/levytate-operational-actions", leadCookie, { method: "POST" });
    check("Recurring condition synchronises successfully", recurrenceSync.status === 200, recurrenceSync.body);
    const recurrence = await listForLearner(leadCookie, testId, true);
    const recurrentActive = recurrence.find((item) => !["completed", "dismissed", "cancelled"].includes(item.status));
    check("Recurrence creates a new occurrence", Boolean(recurrentActive && recurrentActive.id !== action.id && recurrentActive.metadata?.priorActionId === action.id), recurrence);

    const relogged = await login("apprenticeshiplead.demo@levytate.test");
    const persisted = await listForLearner(relogged, testId, true);
    check("Fresh session returns persisted action state", persisted.some((item) => item.id === recurrentActive.id), persisted);

    for (const [label, cookie] of [["Employee", employeeCookie], ["Line Manager", managerCookie], ["Cross-organisation Employee", isolationCookie]]) {
      const deniedRead = await requestJson("/api/levytate-operational-actions", cookie);
      const deniedSync = await requestJson("/api/levytate-operational-actions", cookie, { method: "POST" });
      check(`${label} cannot read organisation actions`, deniedRead.status === 403, deniedRead.body);
      check(`${label} cannot synchronise organisation actions`, deniedSync.status === 403, deniedSync.body);
    }
    const adminRead = await requestJson("/api/levytate-operational-actions", adminCookie);
    check("Platform Admin retains authorised organisation-scoped access", adminRead.status === 200, adminRead.body);

    const activeRows = await selectMany("levytate_operational_actions", {
      organisation_id: `eq.${leadUser.organisation_id}`,
      source_key: `eq.${recurrentActive.sourceKey}`,
      status: "in.(open,acknowledged,in_progress)",
    });
    check("Partial unique source invariant is visible in live rows", activeRows.length === 1, activeRows);
  } finally {
    await remove("levytate_learner_records", { organisation_id: `eq.${leadUser.organisation_id}`, id: `eq.${testId}` });
    const remaining = await selectMany("levytate_operational_actions", { organisation_id: `eq.${leadUser.organisation_id}`, learner_record_id: `eq.${testId}` });
    check("Temporary validation learner and cascaded actions are removed", remaining.length === 0, remaining);
  }

  console.log(JSON.stringify({ ok: true, baseUrl, checks: checks.length }, null, 2));
}

async function login(email) {
  const response = await requestJson("/api/levytate-beta-login", "", { method: "POST", body: JSON.stringify({ email, code: betaCode }) });
  check(`Login succeeds for ${email}`, response.status === 200, response.body);
  const cookie = response.response.headers.get("set-cookie")?.split(";")[0] || "";
  check(`Session cookie issued for ${email}`, Boolean(cookie));
  return cookie;
}

async function listForLearner(cookie, learnerRecordId, includeTerminal = false) {
  const response = await requestJson(`/api/levytate-operational-actions?learnerRecordId=${encodeURIComponent(learnerRecordId)}&includeTerminal=${includeTerminal}`, cookie);
  check("Operational action list succeeds", response.status === 200, response.body);
  return response.body.actions || [];
}

function patchAction(cookie, actionId, body) {
  return requestJson(`/api/levytate-operational-actions/${actionId}`, cookie, { method: "PATCH", body: JSON.stringify(body) });
}

async function requestJson(path, cookie = "", init = {}) {
  const response = await fetch(`${baseUrl}${path}`, { ...init, headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}), ...(init.headers || {}) } });
  const body = await response.clone().json().catch(() => ({}));
  return { response, status: response.status, body };
}

function headers(prefer = "return=representation") {
  return { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "content-type": "application/json", Prefer: prefer };
}

async function selectOne(table, filters) {
  return (await selectMany(table, filters))[0];
}

async function selectMany(table, filters) {
  const params = new URLSearchParams({ select: "*", ...filters });
  const response = await fetch(`${supabaseUrl}/rest/v1/${table}?${params}`, { headers: headers() });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

async function insert(table, body) {
  const response = await fetch(`${supabaseUrl}/rest/v1/${table}`, { method: "POST", headers: headers(), body: JSON.stringify(body) });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

async function update(table, filters, body) {
  const response = await fetch(`${supabaseUrl}/rest/v1/${table}?${new URLSearchParams(filters)}`, { method: "PATCH", headers: headers(), body: JSON.stringify(body) });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

async function remove(table, filters) {
  const response = await fetch(`${supabaseUrl}/rest/v1/${table}?${new URLSearchParams(filters)}`, { method: "DELETE", headers: headers("return=minimal") });
  if (!response.ok && response.status !== 404) throw new Error(await response.text());
}

function without(source, keys) {
  return Object.fromEntries(Object.entries(source).filter(([key]) => !keys.includes(key)));
}

function loadEnv(file, overwrite = true) {
  try {
    for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
      const index = line.indexOf("=");
      if (index < 1) continue;
      const key = line.slice(0, index).trim();
      if (!overwrite && process.env[key]) continue;
      process.env[key] = line.slice(index + 1).trim().replace(/^["']|["']$/g, "");
    }
  } catch {}
}

function check(label, condition, detail) {
  if (!condition) {
    console.error(`FAIL: ${label}`);
    if (detail !== undefined) console.error(JSON.stringify(detail, null, 2));
    throw new Error(label);
  }
  checks.push(label);
  console.log(`PASS: ${label}`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
