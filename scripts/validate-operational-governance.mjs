import { readFileSync } from "node:fs";

loadEnv(".env.vercel.local");
loadEnv(".env.local", false);
loadEnv(".env.production.vercel.local", false);

const baseUrl = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");
const betaCode = process.env.LEVYTATE_BETA_CODE || "LEVYTATE-BETA";
const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/rest\/v1\/?$/i, "").replace(/\/$/, "");
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const prefix = `governance-validation-${Date.now()}`;
const checks = [];
let organisationId = "";

async function main() {
  if (!supabaseUrl || !serviceKey) throw new Error("Supabase service environment is required for governance validation.");
  const leadCookie = await login("apprenticeshiplead.demo@levytate.test");
  const employeeCookie = await login("employee.demo@levytate.test");
  const managerCookie = await login("manager.demo@levytate.test");
  const adminCookie = await login("hello@levytate.co.uk");
  const lead = await selectOne("levytate_users", { email: "eq.apprenticeshiplead.demo@levytate.test" });
  organisationId = lead.organisation_id;
  const learner = await selectOne("levytate_learner_records", { organisation_id: `eq.${organisationId}`, record_status: "eq.Active" });
  check("Ground Control learner is available for isolated governance validation", Boolean(learner?.id));

  try {
    const now = new Date();
    const actions = [
      action("overdue-open", learner, { title: "Critical overdue governance validation", priority: "Critical", rank: 0, status: "open", detected: ago(now, 20), due: dateAgo(now, 10), updated: ago(now, 20) }),
      action("overdue-ack", learner, { title: "Acknowledged overdue governance validation", priority: "High", rank: 1, status: "acknowledged", detected: ago(now, 12), due: dateAgo(now, 6), acknowledged: ago(now, 10), updated: ago(now, 10) }),
      action("stalled", learner, { title: "Stalled governance validation", priority: "Medium", rank: 2, status: "in_progress", detected: ago(now, 22), due: dateFrom(now, 5), acknowledged: ago(now, 20), started: ago(now, 18), updated: ago(now, 10) }),
      action("manual", learner, { title: "Manual completion governance validation", priority: "Medium", rank: 2, status: "completed", detected: ago(now, 8), completed: ago(now, 2), completionMethod: "user_completed", completionNote: "Completed manually with controlled validation evidence.", updated: ago(now, 2) }),
      action("automatic", learner, { title: "Automatic completion governance validation", priority: "Low", rank: 3, status: "completed", detected: ago(now, 20), completed: ago(now, 3), completionMethod: "source_condition_resolved", completionNote: "Completed when the provider review was recorded.", updated: ago(now, 3) }),
      action("dismissed", learner, { title: "Dismissed governance validation", priority: "Low", rank: 3, status: "dismissed", detected: ago(now, 15), dismissed: ago(now, 4), completionMethod: "dismissed", dismissalReason: "Not applicable to this temporary validation learner context.", updated: ago(now, 4) }),
      action("cancelled", learner, { title: "Cancelled governance validation", priority: "Informational", rank: 4, status: "cancelled", detected: ago(now, 12), completed: ago(now, 5), completionMethod: "system_cancelled", completionNote: "Cancelled following an administrative validation correction.", cancellation: { category: "invalidly_generated", reason: "Cancelled following an administrative validation correction.", cancelledAt: ago(now, 5), cancelledBy: lead.id }, updated: ago(now, 5) }),
      action("recurrence-old", learner, { source: `${prefix}:recurrence`, title: "Previous recurring governance validation occurrence", priority: "Low", rank: 3, status: "completed", detected: ago(now, 24), completed: ago(now, 18), completionMethod: "source_condition_resolved", completionNote: "Previous occurrence completed when its source condition cleared.", updated: ago(now, 18) }),
      action("recurrence-current", learner, { source: `${prefix}:recurrence`, title: "Current recurring governance validation occurrence", priority: "Low", rank: 3, status: "open", detected: ago(now, 6), due: dateFrom(now, 2), updated: ago(now, 6), metadata: { priorActionId: `${prefix}:recurrence-old` } }),
    ];
    await insert("levytate_operational_actions", actions);
    await insert("levytate_operational_action_events", actions.flatMap((item) => eventsFor(item, lead.id)));

    const overview = await getJson(`/api/levytate-operational-governance?search=${encodeURIComponent("governance validation")}&datePeriod=90`, leadCookie);
    check("Governance source is live Supabase", overview.status === 200 && overview.body.source === "supabase", overview.body);
    check("Active ageing bands derive from detected timestamps", overview.body.ageing?.some((item) => item.band === "Ageing" && item.count >= 1) && overview.body.ageing?.some((item) => item.band === "Significantly ageing" && item.count >= 1), overview.body.ageing);
    check("Overdue ordering places Critical first", overview.body.overdue?.[0]?.id === `${prefix}:overdue-open`, overview.body.overdue);
    check("Acknowledgement duration derives from stored timestamps", overview.body.overdue?.find((item) => item.id === `${prefix}:overdue-ack`)?.acknowledgementDuration === 2, overview.body.overdue);
    check("Stalled action uses the last persisted meaningful update", overview.body.stalled?.some((item) => item.id === `${prefix}:stalled` && item.daysWithoutMovement >= 9), overview.body.stalled);
    check("Terminal outcomes remain separate", overview.body.summary?.completedAutomatically === 2 && overview.body.summary?.completedManually === 1 && overview.body.summary?.dismissed === 1 && overview.body.summary?.cancelled === 1, overview.body.summary);
    check("Resolution duration uses authoritative terminal timestamps", overview.body.closed?.items?.find((item) => item.id === `${prefix}:manual`)?.resolutionDuration === 6, overview.body.closed?.items);

    const pageOne = await getJson(`/api/levytate-operational-governance?search=${encodeURIComponent("governance")}&view=closed&datePeriod=90&page=1&pageSize=2`, leadCookie);
    const pageTwo = await getJson(`/api/levytate-operational-governance?search=${encodeURIComponent("governance")}&view=closed&datePeriod=90&page=2&pageSize=2`, leadCookie);
    const firstIds = pageOne.body.closed?.items?.map((item) => item.id) ?? [];
    const secondIds = pageTwo.body.closed?.items?.map((item) => item.id) ?? [];
    check("Closed register pagination is bounded and stable", firstIds.length === 2 && secondIds.length === 2 && !firstIds.some((id) => secondIds.includes(id)), { firstIds, secondIds });
    check("Recurring occurrences remain separate", overview.body.closed?.items?.some((item) => item.id === `${prefix}:recurrence-old`) && overview.body.overdue?.every((item) => item.id !== `${prefix}:recurrence-old`), { closed: overview.body.closed?.items, overdue: overview.body.overdue });

    const detail = await getJson(`/api/levytate-operational-actions/${prefix}:manual?management=true`, leadCookie);
    check("Closed action opens the existing authoritative action history", detail.status === 200 && detail.body.history?.some((event) => event.eventType === "completed"), detail.body);
    const relogged = await login("apprenticeshiplead.demo@levytate.test");
    const persisted = await getJson(`/api/levytate-operational-governance?search=${encodeURIComponent("governance validation")}&datePeriod=90`, relogged);
    check("Fresh session returns the same persisted governance rows", persisted.status === 200 && persisted.body.closed?.total === overview.body.closed?.total, { before: overview.body.closed?.total, after: persisted.body.closed?.total });

    for (const [label, cookie] of [["Employee", employeeCookie], ["Line Manager", managerCookie]]) {
      const denied = await getJson("/api/levytate-operational-governance", cookie);
      check(`${label} is denied organisation-wide governance`, denied.status === 403, denied.body);
    }
    const admin = await getJson("/api/levytate-operational-governance?datePeriod=30", adminCookie);
    check("Platform Admin retains authorised governance access", admin.status === 200, admin.body);
    const crossOrganisationAttempt = await getJson(`/api/levytate-operational-governance?organisationId=00000000-0000-4000-8000-000000000000&search=${encodeURIComponent("governance validation")}`, leadCookie);
    check("Client organisation input cannot escape the signed organisation scope", crossOrganisationAttempt.status === 200 && crossOrganisationAttempt.body.overdue?.some((item) => item.id === `${prefix}:overdue-open`), crossOrganisationAttempt.body);
    const mutation = await request("/api/levytate-operational-governance", leadCookie, { method: "POST" });
    check("Governance API exposes no mutation method", mutation.status === 405, await safeJson(mutation));
  } finally {
    await removeValidationRows();
  }

  console.log(JSON.stringify({ ok: checks.every((item) => item.ok), baseUrl, checks, summary: { passed: checks.filter((item) => item.ok).length, failed: checks.filter((item) => !item.ok).length } }, null, 2));
  if (checks.some((item) => !item.ok)) process.exitCode = 1;
}

function action(id, learner, values) {
  const detected = values.detected;
  const metadata = { sourceCondition: "governance_validation", ...(values.metadata ?? {}), ...(values.cancellation ? { cancellation: values.cancellation } : {}) };
  return {
    organisation_id: organisationId,
    id: `${prefix}:${id}`,
    learner_record_id: learner.id,
    application_id: learner.application_id || "",
    employee_id: learner.employee_id || "",
    source_type: "manual_system_correction",
    source_key: values.source || `${prefix}:${id}`,
    action_type: "resolve_lifecycle_inconsistency",
    title: values.title,
    description: `${values.title} source reason.`,
    priority: values.priority,
    priority_rank: values.rank,
    status: values.status,
    owner_type: "Apprenticeship Lead",
    owner_user_id: "",
    owner_display_name: "Priya Shah",
    due_date: values.due || null,
    detected_at: detected,
    acknowledged_at: values.acknowledged || null,
    acknowledged_by: values.acknowledged ? "validation-lead" : "",
    started_at: values.started || null,
    started_by: values.started ? "validation-lead" : "",
    completed_at: values.completed || null,
    completed_by: values.completed ? "validation-lead" : "",
    completion_method: values.completionMethod || "",
    completion_note: values.completionNote || "",
    dismissed_at: values.dismissed || null,
    dismissed_by: values.dismissed ? "validation-lead" : "",
    dismissal_reason: values.dismissalReason || "",
    source_url: "",
    metadata,
    version: 1,
    created_at: detected,
    updated_at: values.updated || detected,
  };
}

function eventsFor(action, actorId) {
  const events = [{ type: "detected", at: action.detected_at, previous: "", next: "open", summary: "Operational condition detected." }];
  if (action.acknowledged_at) events.push({ type: "acknowledged", at: action.acknowledged_at, previous: "open", next: "acknowledged", summary: "Action acknowledged." });
  if (action.started_at) events.push({ type: "started", at: action.started_at, previous: action.acknowledged_at ? "acknowledged" : "open", next: "in_progress", summary: "Action started." });
  const terminalAt = action.dismissed_at || action.completed_at;
  if (terminalAt) events.push({ type: action.status, at: terminalAt, previous: action.started_at ? "in_progress" : action.acknowledged_at ? "acknowledged" : "open", next: action.status, summary: action.completion_note || action.dismissal_reason || `${action.status} validation action.` });
  return events.map((event, index) => ({
    organisation_id: organisationId,
    id: `${action.id}:event:${index}`,
    operational_action_id: action.id,
    event_type: event.type,
    previous_status: event.previous,
    new_status: event.next,
    actor_user_id: event.type === "detected" ? "system" : actorId,
    actor_name: event.type === "detected" ? "LevyTate" : "Priya Shah",
    event_date: event.at,
    summary: event.summary,
    metadata: {},
    created_at: event.at,
  }));
}

async function login(email) {
  const response = await request("/api/levytate-beta-login", "", { method: "POST", body: JSON.stringify({ email, code: betaCode }) });
  const body = await safeJson(response);
  check(`Login succeeds for ${email}`, response.status === 200, body);
  const cookie = response.headers.get("set-cookie")?.split(";")[0] || "";
  check(`Session cookie issued for ${email}`, Boolean(cookie));
  return cookie;
}

async function getJson(path, cookie) { const response = await request(path, cookie); return { status: response.status, body: await safeJson(response) }; }
function request(path, cookie = "", init = {}) { return fetch(`${baseUrl}${path}`, { ...init, headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}), ...(init.headers || {}) }, redirect: "manual" }); }
async function safeJson(response) { const text = await response.text(); try { return text ? JSON.parse(text) : {}; } catch { return { text: text.slice(0, 500) }; } }

async function selectOne(table, filters) {
  const params = new URLSearchParams({ select: "*", ...filters, limit: "1" });
  const rows = await supabase(table, { query: params });
  if (!rows[0]) throw new Error(`${table} validation seed was not found.`);
  return rows[0];
}
async function insert(table, body) { return supabase(table, { method: "POST", body, prefer: "return=representation" }); }
async function removeValidationRows() {
  if (!organisationId) return;
  await supabase("levytate_operational_action_events", { method: "DELETE", query: new URLSearchParams({ organisation_id: `eq.${organisationId}`, id: `like.${prefix}*` }), prefer: "return=minimal", raw: true });
  await supabase("levytate_operational_actions", { method: "DELETE", query: new URLSearchParams({ organisation_id: `eq.${organisationId}`, id: `like.${prefix}*` }), prefer: "return=minimal", raw: true });
}
async function supabase(table, { method = "GET", query = new URLSearchParams(), body, prefer = "return=representation", raw = false } = {}) {
  const response = await fetch(`${supabaseUrl}/rest/v1/${table}?${query}`, { method, headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json", Prefer: prefer }, ...(body ? { body: JSON.stringify(body) } : {}) });
  if (!response.ok) throw new Error(`${table}: ${response.status} ${await response.text()}`);
  if (raw || response.status === 204) return [];
  const text = await response.text();
  return text ? JSON.parse(text) : [];
}

function ago(now, days) { return new Date(now.getTime() - days * 86_400_000).toISOString(); }
function dateAgo(now, days) { return ago(now, days).slice(0, 10); }
function dateFrom(now, days) { return new Date(now.getTime() + days * 86_400_000).toISOString().slice(0, 10); }
function check(label, ok, detail) { checks.push({ label, ok: Boolean(ok), ...(ok || detail === undefined ? {} : { detail }) }); console.log(`${ok ? "PASS" : "FAIL"}: ${label}`); }
function loadEnv(file, override = true) { try { for (const line of readFileSync(file, "utf8").split(/\r?\n/)) { const match = line.match(/^([A-Z0-9_]+)=(.*)$/); if (!match || (!override && process.env[match[1]])) continue; process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, ""); } } catch {} }

main().catch(async (error) => { console.error(error); try { await removeValidationRows(); } catch (cleanupError) { console.error(cleanupError); } process.exitCode = 1; });
