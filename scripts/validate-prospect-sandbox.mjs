import {
  createProspectSandbox,
  deactivateProspectAccess,
  inspectProspectSandbox,
  reactivateProspectAccess,
  resetProspectSandbox,
} from "./prospect-sandbox.mjs";
import fs from "node:fs/promises";
import path from "node:path";

await loadLocalEnvironment();

const baseUrl = (process.argv[2] ?? process.env.LEVYTATE_VALIDATION_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const betaCode = process.env.LEVYTATE_BETA_CODE?.trim() || "LEVYTATE-BETA";
const input = {
  organisationName: "Rivermark Engineering",
  workspaceSlug: "rivermark-prospect-validation",
  prospectEmail: "prospect.lead@rivermark-validation.test",
  prospectDisplayName: "Alex Rowan",
  logoReference: "",
  primaryContactEmail: "prospect.lead@rivermark-validation.test",
};
const checks = [];

try {
  await cleanup();
  const created = await createProspectSandbox(input);
  check("sandbox creates one prepared organisation membership", created.changes === 1 && created.role === "Apprenticeship Lead" && created.active === false, created);
  check("template has recommended people and journey volume", created.counts.users === 1 && created.counts.employees === 15 && created.counts.applications === 10 && created.counts.learners === 8, created.counts);
  check("template has provider and programme breadth", created.counts.providers === 3 && created.counts.programmes === 5, created.counts);
  check("template starts with operational actions", created.counts.actions >= 6, created.counts);

  const repeated = await createProspectSandbox(input);
  check("identical provisioning is idempotent", repeated.changes === 0 && repeated.counts.employees === 15 && repeated.counts.learners === 8, repeated);
  const inspected = await inspectProspectSandbox(input);
  check("inspection reports prepared governed access", inspected.activeMemberships === 0 && inspected.canonical && inspected.prospectAccess?.status === "prepared", inspected);

  const preparedLogin = await login();
  check("prepared access denies login with a safe message", preparedLogin.status === 403 && !preparedLogin.cookie && preparedLogin.message === "Your LevyTate access has not yet been activated.", { status: preparedLogin.status, message: preparedLogin.message });
  await reactivateProspectAccess({ ...input, confirmation: "REACTIVATE", accessExpiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString() });

  const session = await login();
  check("prospect signed login succeeds", session.status === 200 && Boolean(session.cookie), { status: session.status });
  const workspace = await api("/api/levytate-workspace", { cookie: session.cookie });
  check("workspace resolves canonical Apprenticeship Lead", workspace.status === 200 && workspace.body?.workspace?.meta?.userRole === "Apprenticeship Lead", workspace.body?.workspace?.meta);
  check("workspace is organisation scoped", workspace.body?.workspace?.meta?.organisationName === input.organisationName && !/Ground Control|Portakabin|Wren|Innocent|RBAC/i.test(JSON.stringify(workspace.body)), workspace.body?.workspace?.meta);
  const permissions = workspace.body?.workspace?.meta?.permissions ?? [];
  check("settings remain read-only", permissions.includes("settings:read") && !permissions.includes("settings:write") && !permissions.includes("workspace:migrate") && !permissions.includes("earlyAccess:manage"), permissions);
  const settingsWrite = await api("/api/levytate-workspace", { method: "POST", cookie: session.cookie, body: { type: "saveProfile", profile: workspace.body?.workspace?.data?.profile } });
  check("settings mutation is denied server-side", settingsWrite.status === 403 && !hasRawError(settingsWrite.body), { status: settingsWrite.status });
  const platformSources = await api("/api/levytate-guidance-sources", { cookie: session.cookie });
  const earlyAccess = await api("/api/levytate-early-access", { cookie: session.cookie });
  check("platform administration remains denied", platformSources.status === 403 && earlyAccess.status === 403, { guidance: platformSources.status, earlyAccess: earlyAccess.status });
  const foreignLearner = await api("/api/levytate-learners?learnerRecordId=gc-lifecycle-record-behind-target", { cookie: session.cookie });
  check("copied cross-organisation learner id fails safely", [403, 404].includes(foreignLearner.status) && !hasRawError(foreignLearner.body), { status: foreignLearner.status });
  const foreignApplication = await api("/api/levytate-workspace", { method: "POST", cookie: session.cookie, body: { type: "updateApplicationStatus", id: "gc-rbac-app-erin", status: "Approved for Enrolment", note: "Cross-organisation boundary check." } });
  check("copied cross-organisation application id fails safely", [403, 404, 503].includes(foreignApplication.status) && !hasRawError(foreignApplication.body), { status: foreignApplication.status });

  const pages = ["/levytate/app", "/levytate/app?module=Applications", "/levytate/app?module=Learners", "/levytate/app?module=Providers", "/levytate/app?module=Programmes", "/levytate/app?module=Copilot", "/levytate/app?module=Knowledge", "/levytate/app?module=Settings"];
  for (const page of pages) {
    const response = await fetch(`${baseUrl}${page}`, { headers: { Cookie: session.cookie }, redirect: "manual" });
    check(`lead surface loads ${page}`, response.status === 200, { status: response.status });
  }
  const hiddenReport = await fetch(`${baseUrl}/levytate/app?module=Reports`, { headers: { Cookie: session.cookie }, redirect: "manual" });
  check("matching-oriented Reports is hidden in Core Early Access", [307, 308].includes(hiddenReport.status) && hiddenReport.headers.get("location") === "/levytate/app", { status: hiddenReport.status, location: hiddenReport.headers.get("location") });

  const prompts = [
    "What requires attention today?", "Show learners behind target.", "Which provider reviews are overdue?",
    "Who is ready to enrol?", "Who is approaching assessment?", "Show open actions.", "Summarise recent activity.",
  ];
  for (const prompt of prompts) {
    const response = await api("/api/levytate-ai", { method: "POST", cookie: session.cookie, body: { role: "Apprenticeship Lead", selectedSite: "All sites", currentSection: "Copilot", employerContext: input.organisationName, selectedEmployee: "", userMessage: prompt, conversationHistory: [] } });
    const serialised = JSON.stringify(response.body);
    check(`deterministic Copilot answers: ${prompt}`, response.status === 200 && /supabase/i.test(serialised) && !/Ground Control|Portakabin|Wren|Innocent|RBAC|service_role|SUPABASE_SERVICE_ROLE_KEY/i.test(serialised), { status: response.status, structured: Boolean(response.body?.structuredResult) });
  }

  await mutateOneEmployee();
  await resetProspectSandbox({ ...input, confirmation: "RESET" });
  const afterReset = await inspectProspectSandbox(input);
  check("reset restores canonical data while preserving active governance", afterReset.canonical && afterReset.organisationName === input.organisationName && afterReset.activeMemberships === 1 && afterReset.prospectAccess?.status === "active", afterReset);

  await deactivateProspectAccess({ ...input, confirmation: "DEACTIVATE" });
  const denied = await login();
  check("deactivation denies login", denied.status === 403 && !denied.cookie && denied.message.includes("no longer active"), { status: denied.status, message: denied.message });
  const retained = await inspectProspectSandbox(input);
  check("deactivation retains organisation data and audit-safe membership", retained.counts.learners === 8 && retained.active === false, retained);

  await reactivateProspectAccess({ ...input, confirmation: "REACTIVATE", accessExpiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString() });
  const restored = await login();
  check("reactivation restores the same scoped role", restored.status === 200 && Boolean(restored.cookie), { status: restored.status });
  const finalInspection = await inspectProspectSandbox(input);
  check("reactivation does not duplicate membership or records", finalInspection.activeMemberships === 1 && finalInspection.counts.users === 1 && finalInspection.counts.employees === 15, finalInspection);

  console.log(JSON.stringify({ ok: true, baseUrl, checksPassed: checks.length, template: finalInspection.template, counts: finalInspection.counts, temporaryWorkspaceRemoved: true }, null, 2));
} finally {
  await cleanup().catch(() => {});
}

function check(label, passed, detail) {
  if (!passed) throw new Error(`${label} failed: ${JSON.stringify(detail)}`);
  checks.push(label);
}

function hasRawError(value) {
  return /supabase|postgres|constraint|organisation_id|service_role|SUPABASE_SERVICE_ROLE_KEY/i.test(JSON.stringify(value));
}

async function login() {
  const response = await fetch(`${baseUrl}/api/levytate-beta-login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: input.prospectEmail, code: betaCode }) });
  const body = await response.json().catch(() => ({}));
  return { status: response.status, cookie: response.headers.get("set-cookie")?.split(";")[0] ?? "", message: body.message ?? "" };
}

async function api(pathname, { method = "GET", cookie = "", body } = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, { method, headers: { ...(cookie ? { Cookie: cookie } : {}), ...(body ? { "Content-Type": "application/json" } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const text = await response.text();
  let parsed = text;
  try { parsed = JSON.parse(text); } catch {}
  return { status: response.status, body: parsed };
}

function serviceConfig() {
  const url = String(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim().replace(/\/rest\/v1\/?$/i, "").replace(/\/$/, "");
  const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();
  if (!url || !key) throw new Error("Supabase service configuration is required for live sandbox validation.");
  return { url, key };
}

async function rest(table, { method = "GET", query = {}, body } = {}) {
  const config = serviceConfig();
  const response = await fetch(`${config.url}/rest/v1/${table}?${new URLSearchParams(query)}`, { method, headers: { apikey: config.key, Authorization: `Bearer ${config.key}`, "Content-Type": "application/json", Prefer: "return=representation" }, ...(body ? { body: JSON.stringify(body) } : {}) });
  if (!response.ok) throw new Error(`Validation storage operation failed for ${table} (${response.status}).`);
  const text = await response.text(); return text ? JSON.parse(text) : [];
}

async function mutateOneEmployee() {
  const organisations = await rest("levytate_organisations", { query: { select: "id", slug: `eq.${input.workspaceSlug}`, limit: "1" } });
  const organisationId = organisations[0]?.id;
  if (!organisationId) throw new Error("Temporary workspace was not found for reset validation.");
  await rest("levytate_employees", { method: "PATCH", query: { organisation_id: `eq.${organisationId}`, employee_number: "eq.PS-005" }, body: { name: "Changed Validation Name" } });
}

async function cleanup() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return;
  const organisations = await rest("levytate_organisations", { query: { select: "id,workspace_template", slug: `eq.${input.workspaceSlug}`, limit: "1" } });
  const org = organisations[0];
  if (org?.workspace_template === "levytate-prospect-sandbox") await rest("levytate_organisations", { method: "DELETE", query: { id: `eq.${org.id}` } });
  await rest("levytate_early_access_requests", { method: "DELETE", query: { email: `eq.${input.prospectEmail}` } });
  await rest("subscribers", { method: "DELETE", query: { email: `eq.${input.prospectEmail}` } });
}

async function loadLocalEnvironment() {
  for (const name of [".env.local", ".env"]) {
    try {
      const raw = await fs.readFile(path.join(process.cwd(), name), "utf8");
      for (const line of raw.split(/\r?\n/)) {
        if (!line || line.trimStart().startsWith("#")) continue;
        const at = line.indexOf("=");
        if (at < 1) continue;
        const key = line.slice(0, at).trim();
        const value = line.slice(at + 1).trim().replace(/^["']|["']$/g, "");
        if (!process.env[key] && value) process.env[key] = value;
      }
    } catch {}
  }
}
