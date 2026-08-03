import fs from "node:fs";
import { randomUUID } from "node:crypto";

loadEnv();
const baseUrl = process.env.LEVYTATE_VALIDATION_BASE_URL || "http://localhost:3000";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !key) throw new Error("Supabase validation environment is unavailable.");
let passed = 0, failed = 0;
const createdAuthIds = new Set();
const membershipRestores = [];
const temporaryRows = [];
function check(label, condition, context) { if (condition) { passed++; console.log(`PASS ${label}`); } else { failed++; console.error(`FAIL ${label}`, context ?? ""); } }

const identities = [
  ["employee.demo@levytate.test", "Employee"],
  ["manager.demo@levytate.test", "Line Manager"],
  ["apprenticeshiplead.demo@levytate.test", "Apprenticeship Lead"],
  ["hello@levytate.co.uk", "Platform Admin"],
];

try {
  const schema = await rest("levytate_users?select=id,auth_binding_status,auth_bound_at,last_authentication_at&limit=1");
  check("migration 020 live schema available", schema.status === 200);

  const publicKnown = await publicRequest("employee.demo@levytate.test", "198.51.100.10");
  const publicUnknown = await publicRequest(`unknown-${randomUUID()}@levytate.test`, "198.51.100.11");
  check("known sign-in request is generic", publicKnown.status === 200);
  check("unknown sign-in request is generic", publicUnknown.status === 200);
  check("enumeration responses are indistinguishable", publicKnown.body === publicUnknown.body);

  const sessions = new Map();
  for (const [email, expectedRole] of identities) {
    const authUser = await ensureAuthUser(email);
    const login = await magicLogin(email, authUser.id);
    check(`${expectedRole} callback redirects to application`, login.status >= 300 && login.status < 400 && login.location.includes("/levytate/app"));
    check(`${expectedRole} HTTP-only LevyTate cookie issued`, /levytate_beta_session=.*HttpOnly/i.test(login.rawCookies));
    check(`${expectedRole} HTTP-only Auth cookies issued`, /levytate_auth_access=.*HttpOnly/i.test(login.rawCookies) && /levytate_auth_refresh=.*HttpOnly/i.test(login.rawCookies));
    const workspace = await appRequest("/api/levytate-workspace", login.cookie);
    check(`${expectedRole} resolves correct canonical role`, workspace.status === 200 && workspace.json?.workspace?.meta?.userRole === expectedRole, workspace.json?.workspace?.meta);
    check(`${expectedRole} resolves one organisation`, workspace.status === 200 && Boolean(workspace.json?.workspace?.meta?.organisationId));
    sessions.set(email, login);
  }

  const employeeMembership = await membership("employee.demo@levytate.test");
  membershipRestores.push([employeeMembership.id, { active: employeeMembership.active }]);
  await patchMembership(employeeMembership.id, { active: false });
  const inactive = await appRequest("/api/levytate-workspace", sessions.get("employee.demo@levytate.test").cookie);
  check("inactive membership denied on next request", inactive.status === 401);
  await patchMembership(employeeMembership.id, { active: employeeMembership.active });

  const managerMembership = await membership("manager.demo@levytate.test");
  membershipRestores.push([managerMembership.id, { role: managerMembership.role }]);
  await patchMembership(managerMembership.id, { role: "Employee" });
  const changedRole = await appRequest("/api/levytate-workspace", sessions.get("manager.demo@levytate.test").cookie);
  check("role change overrides stale session", changedRole.status === 200 && changedRole.json?.workspace?.meta?.userRole === "Employee");
  await patchMembership(managerMembership.id, { role: managerMembership.role });

  const refreshed = await appRequest("/api/levytate-auth/session", sessions.get("apprenticeshiplead.demo@levytate.test").cookie, { method: "POST" });
  check("session refresh succeeds", refreshed.status === 200 && refreshed.json?.ok === true);

  const logout = await appRequest("/api/levytate-beta-logout", sessions.get("employee.demo@levytate.test").cookie, { method: "POST", raw: true });
  check("logout clears all authentication cookies", /levytate_beta_session=;|levytate_beta_session=""/i.test(logout.rawCookies) && /levytate_auth_refresh=;|levytate_auth_refresh=""/i.test(logout.rawCookies));
  const afterLogout = await appRequest("/api/levytate-workspace", "");
  check("protected API denied without cookie after logout", afterLogout.status === 401);

  const realBeta = await fetch(`${baseUrl}/api/levytate-beta-login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: "person@example.com", code: process.env.LEVYTATE_BETA_CODE || "LEVYTATE-BETA" }) });
  const fictionalBeta = await fetch(`${baseUrl}/api/levytate-beta-login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: "employee.demo@levytate.test", code: process.env.LEVYTATE_BETA_CODE || "LEVYTATE-BETA" }) });
  check("non-fictional beta identity denied", realBeta.status === 403);
  check("fictional beta identity retained when enabled", fictionalBeta.status === 200);

  const prospect = await createTemporaryProspect();
  const prospectAuth = await ensureAuthUser(prospect.email);
  const prospectLogin = await magicLogin(prospect.email, prospectAuth.id);
  await rest(`levytate_prospect_access?id=eq.${prospect.accessId}`, { method: "PATCH", body: { access_status: "revoked", revoked_at: new Date().toISOString(), last_status_changed_at: new Date().toISOString() } });
  const revoked = await appRequest("/api/levytate-workspace", prospectLogin.cookie);
  check("prospect revocation takes effect immediately", revoked.status === 401);
  await rest(`levytate_prospect_access?id=eq.${prospect.accessId}`, { method: "PATCH", body: { access_status: "active", revoked_at: null, access_expires_at: new Date(Date.now() - 60_000).toISOString(), last_status_changed_at: new Date().toISOString() } });
  const expired = await appRequest("/api/levytate-workspace", prospectLogin.cookie);
  check("prospect expiry takes effect immediately", expired.status === 401);

  const adminOperations = await appRequest("/api/levytate-learners", sessions.get("hello@levytate.co.uk").cookie);
  check("Platform Admin employer operations remain denied", adminOperations.status === 403);
} finally {
  for (const [id, patch] of membershipRestores.reverse()) await patchMembership(id, patch).catch(() => {});
  for (const row of temporaryRows.reverse()) await rest(`${row.table}?${row.query}`, { method: "DELETE" }).catch(() => {});
  for (const id of createdAuthIds) await auth(`admin/users/${id}`, { method: "DELETE" }).catch(() => {});
  for (const [email] of identities) {
    const row = await membership(email).catch(() => null);
    if (row) await patchMembership(row.id, { auth_subject: null, auth_binding_status: "not_prepared", auth_bound_at: null }).catch(() => {});
  }
}

console.log(`\nSecure employer auth live validation: ${passed} passed, ${failed} failed.`);
if (failed) process.exit(1);

async function publicRequest(email, ip) { const response = await fetch(`${baseUrl}/api/levytate-auth/request`, { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": ip }, body: JSON.stringify({ email }) }); return { status: response.status, body: await response.text() }; }
async function magicLogin(email) {
  const generated = await auth("admin/generate_link", { method: "POST", body: { type: "magiclink", email, options: { redirect_to: `${baseUrl}/levytate/auth/callback` } } });
  if (!generated.ok) throw new Error("Could not generate fictional validation link.");
  const payload = generated.json;
  const tokenHash = payload.hashed_token;
  const response = await fetch(`${baseUrl}/levytate/auth/callback?token_hash=${encodeURIComponent(tokenHash)}&type=magiclink`, { redirect: "manual" });
  const rawCookies = response.headers.getSetCookie().join(", ");
  const cookie = response.headers.getSetCookie().map(value => value.split(";", 1)[0]).join("; ");
  return { status: response.status, location: response.headers.get("location") || "", rawCookies, cookie };
}
async function ensureAuthUser(email) {
  const listed = await auth("admin/users?page=1&per_page=1000");
  const existing = listed.json?.users?.find(user => user.email?.toLowerCase() === email.toLowerCase());
  if (existing) return existing;
  const created = await auth("admin/users", { method: "POST", body: { email, email_confirm: true, user_metadata: { validation_identity: true } } });
  if (!created.ok) throw new Error("Could not create fictional validation Auth identity.");
  createdAuthIds.add(created.json.id); return created.json;
}
async function membership(email) { const response = await rest(`levytate_users?select=id,organisation_id,email,role,active,auth_subject&email=eq.${encodeURIComponent(email)}&limit=1`); if (!response.json?.[0]) throw new Error(`Missing fictional membership ${email}`); return response.json[0]; }
async function patchMembership(id, body) { return rest(`levytate_users?id=eq.${id}`, { method: "PATCH", body }); }
async function createTemporaryProspect() {
  const organisationId = randomUUID();
  await rest("levytate_organisations", { method: "POST", body: { id: organisationId, name: "Authentication Validation Employer", slug: `auth-validation-${organisationId}`, workspace_name: "Authentication Validation", workspace_template: "levytate-prospect-sandbox", status: "Active" } });
  temporaryRows.push({ table: "levytate_organisations", query: `id=eq.${organisationId}` });
  const userId = randomUUID(), accessId = randomUUID(), email = `auth-validation-${randomUUID()}@levytate.test`;
  await rest("levytate_users", { method: "POST", body: { id: userId, organisation_id: organisationId, email, role: "Apprenticeship Lead", access_level: "beta_user", display_name: "Authentication Validation", active: true, auth_binding_status: "pending" } });
  temporaryRows.push({ table: "levytate_users", query: `id=eq.${userId}` });
  await rest("levytate_prospect_access", { method: "POST", body: { id: accessId, organisation_id: organisationId, user_id: userId, access_status: "active", access_start_at: new Date(Date.now() - 60_000).toISOString(), access_expires_at: new Date(Date.now() + 3600_000).toISOString() } });
  temporaryRows.push({ table: "levytate_prospect_access", query: `id=eq.${accessId}` });
  return { userId, accessId, email };
}
async function appRequest(path, cookie, init = {}) { const response = await fetch(`${baseUrl}${path}`, { ...init, headers: { cookie, ...(init.headers ?? {}) }, redirect: "manual" }); const text = await response.text(); let json; try { json = JSON.parse(text); } catch {} return { status: response.status, json, rawCookies: response.headers.getSetCookie().join(", ") }; }
async function rest(path, init = {}) { const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, { method: init.method || "GET", headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "return=representation" }, ...(init.body ? { body: JSON.stringify(init.body) } : {}) }); const text = await response.text(); let json; try { json = JSON.parse(text); } catch {} return { status: response.status, json }; }
async function auth(path, init = {}) { const response = await fetch(`${supabaseUrl}/auth/v1/${path}`, { method: init.method || "GET", headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, ...(init.body ? { body: JSON.stringify(init.body) } : {}) }); const text = await response.text(); let json; try { json = JSON.parse(text); } catch {} return { ok: response.ok, status: response.status, json }; }
function loadEnv() { const raw = fs.readFileSync(".env.local", "utf8"); for (const line of raw.split(/\r?\n/)) { const match = line.match(/^([^#=]+)=(.*)$/); if (match) process.env[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, ""); } }
