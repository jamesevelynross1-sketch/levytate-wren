import { createHmac, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";

await loadLocalEnvironment();
const baseUrl = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");
const organisationId = randomUUID();
const isolationOrganisationId = randomUUID();
const stamp = Date.now().toString(36);
const users = {
  lead: member("lead", "Apprenticeship Lead", organisationId),
  employee: member("employee", "Employee", organisationId),
  manager: member("manager", "Line Manager", organisationId),
  inactive: member("inactive", "Apprenticeship Lead", organisationId, false),
  expired: member("expired", "Line Manager", organisationId),
  platform: member("platform", "Platform Admin", organisationId),
  isolation: member("isolation", "Employee", isolationOrganisationId),
};
const checks = [];

try {
  await cleanup();
  await insert("levytate_organisations", [organisation(organisationId, `terms-validation-${stamp}`), organisation(isolationOrganisationId, `terms-isolation-${stamp}`)]);
  await insert("levytate_users", Object.values(users));
  await insert("levytate_prospect_access", Object.values(users).map((user) => access(user, user === users.expired ? "expired" : "active")));

  const before = await countAcceptances();
  check("new validation organisations begin without acceptance", before === 0, before);
  const unauthenticated = await request("/api/levytate-terms-acceptance", { method: "POST", form: { acknowledged: "yes" } });
  check("unauthenticated POST redirects to login", unauthenticated.status === 303 && unauthenticated.location.endsWith("/levytate/login"), unauthenticated);
  const inactive = await request("/api/levytate-terms-acceptance", { method: "POST", cookie: session(users.inactive), form: { acknowledged: "yes" } });
  check("inactive membership cannot accept", inactive.status === 303 && inactive.location.endsWith("/levytate/login"), inactive);
  const expired = await request("/api/levytate-terms-acceptance", { method: "POST", cookie: session(users.expired), form: { acknowledged: "yes" } });
  check("expired access cannot accept", expired.status === 303 && expired.location.endsWith("/levytate/login"), expired);

  for (const [label, user] of [["Employee", users.employee], ["Line Manager", users.manager], ["Platform Admin", users.platform]]) {
    const denied = await request("/api/levytate-terms-acceptance", { method: "POST", cookie: session(user), form: { acknowledged: "yes" } });
    check(`${label} cannot accept employer terms`, denied.status === 303 && denied.location.includes("/levytate/accept-terms?error="), denied);
  }
  const employeeBefore = await request("/levytate/app", { cookie: session(users.employee) });
  const managerBefore = await request("/levytate/app", { cookie: session(users.manager) });
  check("Employee and Line Manager receive the safe waiting state", employeeBefore.status === 200 && managerBefore.status === 200 && employeeBefore.text.includes("Acceptance pending") && managerBefore.text.includes("Acceptance pending") && !employeeBefore.text.includes("Apprenticeship Lead"), { employee: employeeBefore.status, manager: managerBefore.status });
  const apiBefore = await request("/api/levytate-prospect-access", { cookie: session(users.employee) });
  check("operational API is denied before organisation acceptance", apiBefore.status === 401 && !/supabase|postgres|constraint/i.test(apiBefore.text), apiBefore.status);
  const leadBefore = await request("/levytate/app", { cookie: session(users.lead) });
  check("Apprenticeship Lead is redirected to explicit acceptance", [307, 308].includes(leadBefore.status) && leadBefore.location.endsWith("/levytate/accept-terms"), leadBefore);

  const accepted = await request("/api/levytate-terms-acceptance", { method: "POST", cookie: session(users.lead), form: { acknowledged: "yes", organisationId: isolationOrganisationId, userId: users.employee.id, role: "Platform Admin", version: "forged", hash: "0".repeat(64) } });
  check("authorised lead accepts and forged authority fields are ignored", accepted.status === 303 && accepted.location.endsWith("/levytate/app") && await countAcceptances() === 1, accepted);
  const evidence = await select("levytate_early_access_terms_acceptances", { select: "organisation_id,accepted_by_user_id,document_type,document_version,document_content_hash,role_at_acceptance", organisation_id: `eq.${organisationId}` });
  check("server records authoritative organisation, user, role, version and SHA-256", evidence.length === 1 && evidence[0].organisation_id === organisationId && evidence[0].accepted_by_user_id === users.lead.id && evidence[0].document_type === "early_access_terms" && evidence[0].document_version !== "forged" && /^[a-f0-9]{64}$/.test(evidence[0].document_content_hash) && evidence[0].role_at_acceptance === "Apprenticeship Lead", evidence[0]);
  const duplicate = await request("/api/levytate-terms-acceptance", { method: "POST", cookie: session(users.lead), form: { acknowledged: "yes" } });
  check("duplicate submission is idempotent", duplicate.status === 303 && await countAcceptances() === 1, duplicate);
  const employeeAfter = await request("/levytate/app", { cookie: session(users.employee) });
  const apiAfter = await request("/api/levytate-prospect-access", { cookie: session(users.employee) });
  check("current organisation acceptance unlocks another employer role and API", employeeAfter.status === 200 && !employeeAfter.text.includes("Acceptance pending") && apiAfter.status === 200, { page: employeeAfter.status, api: apiAfter.status });
  const isolationStillGated = await request("/levytate/app", { cookie: session(users.isolation) });
  check("tenant isolation keeps another organisation gated", isolationStillGated.status === 200 && isolationStillGated.text.includes("Acceptance pending"), isolationStillGated.status);

  await deleteAcceptanceRows();
  const concurrent = await Promise.all([1, 2].map(() => request("/api/levytate-terms-acceptance", { method: "POST", cookie: session(users.lead), form: { acknowledged: "yes" } })));
  check("concurrent submissions create one effective record", concurrent.every((item) => item.status === 303) && await countAcceptances() === 1, concurrent);
  await update("levytate_users", { active: false }, { id: `eq.${users.lead.id}` });
  const revoked = await request("/levytate/app", { cookie: session(users.lead) });
  check("historic acceptance does not reactivate revoked membership", [307, 308].includes(revoked.status) && revoked.location.endsWith("/levytate/login"), revoked);

  const publicPages = await Promise.all(["privacy", "early-access-terms", "data-processing", "support"].map((route) => request(`/levytate/${route}`)));
  check("public trust pages remain public", publicPages.every((item) => item.status === 200), publicPages.map((item) => item.status));
  const internalLogin = await fetch(`${baseUrl}/api/levytate-beta-login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: "employee.demo@levytate.test", code: process.env.LEVYTATE_BETA_CODE || "LEVYTATE-BETA" }) });
  const betaCookie = internalLogin.headers.get("set-cookie")?.split(";")[0] ?? "";
  const betaApp = await request("/levytate/app", { cookie: betaCookie });
  check("internal fictional beta session bypasses without acceptance write", internalLogin.status === 200 && betaApp.status === 200 && await countAllValidationAcceptances() === 1, { login: internalLogin.status, app: betaApp.status });

  console.log(JSON.stringify({ ok: true, checksPassed: checks.length, temporaryDataRemoved: true }, null, 2));
} finally {
  await cleanup().catch(() => {});
}

function member(name, role, orgId, active = true) { return { id: randomUUID(), organisation_id: orgId, email: `${name}.${stamp}@terms-acceptance-validation.test`, role, access_level: "beta_user", display_name: `${name[0].toUpperCase()}${name.slice(1)} Validation`, active, auth_subject: randomUUID(), auth_binding_status: "bound" }; }
function organisation(id, slug) { return { id, name: `Terms Acceptance Validation ${slug}`, slug, workspace_name: "Terms Acceptance Validation", primary_contact: "Fictional Validation", contact_email: `owner@${slug}.test`, workspace_template: "levytate-prospect-sandbox", status: "Active" }; }
function access(user, state) { const now = new Date(); return { id: randomUUID(), organisation_id: user.organisation_id, user_id: user.id, access_status: state, access_start_at: new Date(now.getTime() - 60_000).toISOString(), access_expires_at: new Date(now.getTime() + (state === "expired" ? -60_000 : 86400000)).toISOString(), internal_owner_name: "Automated validation", last_status_changed_at: now.toISOString(), version: 1 }; }
function session(user) { const now = Date.now(); const payload = Buffer.from(JSON.stringify({ email: user.email, accessLevel: "beta_user", authMode: "supabase_email", authSubject: user.auth_subject, issuedAt: now, expiresAt: now + 3600000 })).toString("base64url"); const signature = createHmac("sha256", requiredEnv("LEVYTATE_BETA_SESSION_SECRET")).update(payload).digest("base64url"); return `levytate_beta_session=${payload}.${signature}`; }
function check(label, condition, detail) { if (!condition) throw new Error(`${label} failed: ${JSON.stringify(detail)}`); checks.push(label); }
async function request(route, { method = "GET", cookie = "", form } = {}) { const response = await fetch(`${baseUrl}${route}`, { method, headers: { ...(cookie ? { Cookie: cookie } : {}), ...(form ? { "Content-Type": "application/x-www-form-urlencoded" } : {}) }, body: form ? new URLSearchParams(form) : undefined, redirect: "manual" }); return { status: response.status, location: response.headers.get("location") ?? "", text: await response.text() }; }
async function countAcceptances() { return (await select("levytate_early_access_terms_acceptances", { select: "id", organisation_id: `eq.${organisationId}` })).length; }
async function countAllValidationAcceptances() { return (await select("levytate_early_access_terms_acceptances", { select: "id", organisation_id: `in.(${organisationId},${isolationOrganisationId})` })).length; }
async function insert(table, body) { return rest(table, "POST", {}, body); }
async function update(table, body, query) { return rest(table, "PATCH", query, body); }
async function select(table, query) { return rest(table, "GET", query); }
async function rest(table, method, query, body) { const url = requiredEnv("NEXT_PUBLIC_SUPABASE_URL").replace(/\/$/, ""); const key = requiredEnv("SUPABASE_SERVICE_ROLE_KEY"); const response = await fetch(`${url}/rest/v1/${table}?${new URLSearchParams(query)}`, { method, headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "return=representation" }, body: body ? JSON.stringify(body) : undefined }); if (!response.ok) throw new Error(`Validation storage operation failed for ${table} (${response.status}).`); const text = await response.text(); return text ? JSON.parse(text) : []; }
async function deleteAcceptanceRows() { execFileSync("supabase", ["db", "query", "--linked", `delete from public.levytate_early_access_terms_acceptances where organisation_id in ('${organisationId}'::uuid, '${isolationOrganisationId}'::uuid);`], { stdio: "ignore" }); }
async function cleanup() { await deleteAcceptanceRows(); for (const id of [organisationId, isolationOrganisationId]) await rest("levytate_organisations", "DELETE", { id: `eq.${id}` }); }
function requiredEnv(name) { const value = process.env[name]?.trim(); if (!value) throw new Error(`${name} is required for live validation.`); return value; }
async function loadLocalEnvironment() { for (const name of [".env.local", ".env"]) { try { const raw = await fs.readFile(path.join(process.cwd(), name), "utf8"); for (const line of raw.split(/\r?\n/)) { if (!line || line.trimStart().startsWith("#")) continue; const at = line.indexOf("="); if (at < 1) continue; const key = line.slice(0, at).trim(); const value = line.slice(at + 1).trim().replace(/^["']|["']$/g, ""); if (!process.env[key] && value) process.env[key] = value; } } catch {} } }
