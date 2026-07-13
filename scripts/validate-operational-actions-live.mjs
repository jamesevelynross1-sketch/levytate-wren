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
    const today = new Date().toISOString().slice(0, 10);
    const expectedEnd = new Date();
    expectedEnd.setUTCFullYear(expectedEnd.getUTCFullYear() + 1);
    await insert("levytate_learner_records", {
      ...without(seedRecord, ["id", "application_id", "enrolment_id", "created_at", "updated_at"]),
      id: testId,
      application_id: `${testId}-application`,
      enrolment_id: `${testId}-enrolment`,
      lifecycle_status: "pre_enrolment",
      employment_route: "existing_employee_upskill",
      expected_start_date: today,
      actual_start_date: today,
      expected_end_date: expectedEnd.toISOString().slice(0, 10),
      created_by: leadUser.id,
      updated_by: leadUser.id,
      demonstration_record: true,
    });
    await insert("levytate_learner_eligibility_declarations", {
      organisation_id: leadUser.organisation_id,
      id: `${testId}-eligibility`,
      learner_record_id: testId,
      declaration_wording: "Temporary operational actions validation declaration.",
      declaration_version: "validation-v1",
      confirmed: true,
      confirmed_by_employee: seedRecord.employee_id,
      confirmed_at: new Date().toISOString(),
      expected_england_working_hours_percentage: 100,
      verified_by: leadUser.id,
      verified_at: new Date().toISOString(),
      verification_status: "employer_verified",
    });
    await insert("levytate_learner_pre_enrolment_checks", {
      organisation_id: leadUser.organisation_id,
      id: `${testId}-checks`,
      learner_record_id: testId,
      probation_status: "passed",
      probation_passed_date: today,
      probation_confirmed_by: leadUser.id,
      probation_confirmed_at: new Date().toISOString(),
      hr_approval_status: "awaiting_approval",
      guides_sent: false,
    });

    const [syncOne, syncTwo] = await Promise.all([
      requestJson("/api/levytate-operational-actions", leadCookie, { method: "POST" }),
      requestJson("/api/levytate-operational-actions", leadCookie, { method: "POST" }),
    ]);
    check("Simultaneous synchronisation succeeds", syncOne.status === 200 && syncTwo.status === 200, { syncOne: syncOne.body, syncTwo: syncTwo.body });

    const preEnrolmentInitial = await listForLearner(leadCookie, testId, true);
    const initialKeys = preEnrolmentInitial.filter((action) => ["open", "acknowledged", "in_progress"].includes(action.status)).map((action) => action.sourceKey);
    check("Database uniqueness permits one active action per source", new Set(initialKeys).size === initialKeys.length, preEnrolmentInitial);
    check("HR approval outstanding creates a durable action", preEnrolmentInitial.some((action) => action.actionType === "obtain_hr_approval"), preEnrolmentInitial);
    check("Guides outstanding creates a durable action", preEnrolmentInitial.some((action) => action.actionType === "send_guides"), preEnrolmentInitial);

    let hrAction = preEnrolmentInitial.find((action) => action.actionType === "obtain_hr_approval");
    const guidesAction = preEnrolmentInitial.find((action) => action.actionType === "send_guides");
    const managementDetail = await requestJson(`/api/levytate-operational-actions/${hrAction.id}?management=true`, leadCookie);
    check("Focused action detail returns source context", managementDetail.status === 200 && managementDetail.body.context?.learnerName && managementDetail.body.context?.sourceFacts?.length, managementDetail.body);
    check("Focused action detail returns history and valid owner options", Array.isArray(managementDetail.body.history) && managementDetail.body.ownerOptions?.some((option) => option.label === "Priya Shah"), managementDetail.body);

    const priyaOwner = managementDetail.body.ownerOptions.find((option) => option.label === "Priya Shah");
    const assigned = await patchAction(leadCookie, hrAction.id, { command: "assign", expectedVersion: hrAction.version, ownerType: priyaOwner.ownerType, ownerUserId: priyaOwner.ownerUserId });
    check("Controlled assignment persists the selected organisation owner", assigned.status === 200 && assigned.body.action?.ownerDisplayName === "Priya Shah", assigned.body);
    hrAction = assigned.body.action;

    const manualDueDate = isoDateFromNow(5);
    const dueChanged = await patchAction(leadCookie, hrAction.id, { command: "due_date", expectedVersion: hrAction.version, dueDate: manualDueDate });
    check("Manual due date persists", dueChanged.status === 200 && dueChanged.body.action?.dueDate === manualDueDate, dueChanged.body);
    hrAction = dueChanged.body.action;

    const hrAcknowledged = await patchAction(leadCookie, hrAction.id, { command: "acknowledge", expectedVersion: hrAction.version });
    check("Managed action acknowledgement persists", hrAcknowledged.status === 200 && hrAcknowledged.body.action?.status === "acknowledged", hrAcknowledged.body);
    const duplicateManagedAcknowledgement = await patchAction(leadCookie, hrAction.id, { command: "acknowledge", expectedVersion: hrAction.version });
    check("Managed action duplicate acknowledgement is idempotent", duplicateManagedAcknowledgement.status === 200 && duplicateManagedAcknowledgement.body.action?.version === hrAcknowledged.body.action.version, duplicateManagedAcknowledgement.body);
    const started = await patchAction(leadCookie, hrAction.id, { command: "start", expectedVersion: hrAcknowledged.body.action.version });
    check("Managed action starts work", started.status === 200 && started.body.action?.status === "in_progress", started.body);
    const duplicateStart = await patchAction(leadCookie, hrAction.id, { command: "start", expectedVersion: hrAcknowledged.body.action.version });
    check("Managed action duplicate start is idempotent", duplicateStart.status === 200 && duplicateStart.body.action?.version === started.body.action.version, duplicateStart.body);
    hrAction = started.body.action;

    const managedRepeat = await requestJson("/api/levytate-operational-actions", leadCookie, { method: "POST" });
    check("Synchronisation preserves managed status and owner", managedRepeat.status === 200, managedRepeat.body);
    const afterManagedRepeat = await listForLearner(leadCookie, testId, true);
    const persistedManaged = afterManagedRepeat.find((action) => action.id === hrAction.id);
    check("Managed ownership, due date and status survive synchronisation", persistedManaged?.ownerDisplayName === "Priya Shah" && persistedManaged?.dueDate === manualDueDate && persistedManaged?.status === "in_progress", persistedManaged);

    const dismissed = await patchAction(leadCookie, guidesAction.id, {
      command: "dismiss",
      expectedVersion: guidesAction.version,
      dismissalKind: "managed_outside_levytate",
      dismissalReason: "The guide pack was issued through the controlled HR process.",
    });
    check("Permitted informational action dismissal persists", dismissed.status === 200 && dismissed.body.action?.status === "dismissed", dismissed.body);
    const duplicateDismissal = await patchAction(leadCookie, guidesAction.id, {
      command: "dismiss",
      expectedVersion: guidesAction.version,
      dismissalKind: "managed_outside_levytate",
      dismissalReason: "The guide pack was issued through the controlled HR process.",
    });
    check("Duplicate dismissal is idempotent", duplicateDismissal.status === 200 && duplicateDismissal.body.action?.version === dismissed.body.action.version, duplicateDismissal.body);
    const checksBeforeResolution = await selectOne("levytate_learner_pre_enrolment_checks", { organisation_id: `eq.${leadUser.organisation_id}`, learner_record_id: `eq.${testId}` });
    check("Dismissal leaves source lifecycle truth unchanged", checksBeforeResolution.guides_sent === false, checksBeforeResolution);

    const mine = await requestJson("/api/levytate-operations?assignment=mine", leadCookie);
    check("My actions filter includes Priya's assigned action", mine.status === 200 && Object.values(mine.body.queues ?? {}).flat().some((item) => item.persistentActionId === hrAction.id), mine.body);

    const repeat = await requestJson("/api/levytate-operational-actions", leadCookie, { method: "POST" });
    check("Repeated synchronisation creates no duplicate", repeat.status === 200 && repeat.body.result?.created === 0, repeat.body);

    const activeManualCompletion = await patchAction(leadCookie, hrAction.id, { command: "complete", expectedVersion: hrAction.version, completionNote: "Resolved through the approved external HR control.", resolvedOutsideLevyTate: true });
    check("Manual completion is blocked while the source condition remains active", activeManualCompletion.status === 400, activeManualCompletion.body);

    await update("levytate_learner_pre_enrolment_checks", { organisation_id: `eq.${leadUser.organisation_id}`, learner_record_id: `eq.${testId}` }, {
      hr_approval_status: "approved",
      hr_approved_date: today,
      hr_approved_by: leadUser.id,
      guides_sent: true,
      guides_sent_date: today,
      guides_sent_by: leadUser.id,
      guides_version: "validation-v1",
    });
    const manualCompletion = await patchAction(leadCookie, hrAction.id, { command: "complete", expectedVersion: hrAction.version, completionNote: "Resolved through the approved external HR control.", resolvedOutsideLevyTate: true });
    check("Manual completion succeeds only after source truth is resolved", manualCompletion.status === 200 && manualCompletion.body.action?.status === "completed" && manualCompletion.body.action?.completionMethod === "user_completed", manualCompletion.body);
    const readinessSync = await requestJson("/api/levytate-operational-actions", leadCookie, { method: "POST" });
    check("Pre-enrolment resolution synchronises successfully", readinessSync.status === 200, readinessSync.body);
    const readyActions = await listForLearner(leadCookie, testId, true);
    check("Resolved HR action remains completed after synchronisation", readyActions.some((action) => action.actionType === "obtain_hr_approval" && action.status === "completed"), readyActions);
    check("Dismissed Guides action remains terminal with its lifecycle truth later cleared", readyActions.some((action) => action.id === guidesAction.id && action.status === "dismissed" && action.metadata?.conditionClearedAt), readyActions);
    const hrHistory = await requestJson(`/api/levytate-operational-actions/${hrAction.id}?history=true`, leadCookie);
    check("Managed action history retains assignment, due date, acknowledgement, start and completion", ["owner_changed", "due_date_changed", "acknowledged", "started", "completed"].every((event) => hrHistory.body.history?.some((item) => item.eventType === event)), hrHistory.body.history);
    check("Duplicate state retries create only one acknowledgement and start event", hrHistory.body.history?.filter((item) => item.eventType === "acknowledged").length === 1 && hrHistory.body.history?.filter((item) => item.eventType === "started").length === 1, hrHistory.body.history);
    const readyAction = readyActions.find((action) => action.actionType === "complete_enrolment" && action.status === "open");
    check("Ready to enrol creates one durable action", Boolean(readyAction), readyActions);

    const cancelledReady = await patchAction(leadCookie, readyAction.id, {
      command: "cancel",
      expectedVersion: readyAction.version,
      cancellationKind: "invalidly_generated",
      cancellationReason: "Validation confirms this administrative occurrence is no longer valid.",
    });
    check("Administrative cancellation persists where permitted", cancelledReady.status === 200 && cancelledReady.body.action?.status === "cancelled", cancelledReady.body);
    const duplicateCancellation = await patchAction(leadCookie, readyAction.id, {
      command: "cancel",
      expectedVersion: readyAction.version,
      cancellationKind: "invalidly_generated",
      cancellationReason: "Validation confirms this administrative occurrence is no longer valid.",
    });
    check("Duplicate cancellation is idempotent", duplicateCancellation.status === 200 && duplicateCancellation.body.action?.version === cancelledReady.body.action.version, duplicateCancellation.body);

    await update("levytate_learner_records", { organisation_id: `eq.${leadUser.organisation_id}`, id: `eq.${testId}` }, {
      lifecycle_status: "enrolled",
      updated_by: leadUser.id,
    });
    const enrolledSync = await requestJson("/api/levytate-operational-actions", leadCookie, { method: "POST" });
    check("Enrolment resolution synchronises successfully", enrolledSync.status === 200, enrolledSync.body);
    const enrolledActions = await listForLearner(leadCookie, testId, true);
    check("Cancelled occurrence remains terminal after source resolution", enrolledActions.some((action) => action.id === readyAction.id && action.status === "cancelled"), enrolledActions);

    await update("levytate_learner_records", { organisation_id: `eq.${leadUser.organisation_id}`, id: `eq.${testId}` }, {
      lifecycle_status: "break_in_learning",
      updated_by: leadUser.id,
    });
    const inconsistencySync = await requestJson("/api/levytate-operational-actions", leadCookie, { method: "POST" });
    check("Lifecycle inconsistency synchronises successfully", inconsistencySync.status === 200, inconsistencySync.body);
    const initial = await listForLearner(leadCookie, testId, true);
    const activeInitial = initial.filter((action) => ["open", "acknowledged", "in_progress"].includes(action.status));
    const action = activeInitial.find((item) => item.actionType === "resolve_lifecycle_inconsistency");
    check("Lifecycle inconsistency produces the expected action", Boolean(action), initial);

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
    const recurrenceDetail = await requestJson(`/api/levytate-operational-actions/${recurrentActive.id}?management=true`, leadCookie);
    check("Action detail keeps prior occurrences separate", recurrenceDetail.status === 200 && recurrenceDetail.body.previousOccurrences?.some((item) => item.id === action.id && item.status === "completed"), recurrenceDetail.body);

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

function isoDateFromNow(days) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
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
