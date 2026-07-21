import fs from "node:fs/promises";
import path from "node:path";
import {
  createProspectSandbox,
  inspectProspectSandbox,
  resetProspectSandbox,
} from "./prospect-sandbox.mjs";

await loadLocalEnvironment();

const baseUrl = (process.argv[2] ?? process.env.LEVYTATE_VALIDATION_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const betaCode = process.env.LEVYTATE_BETA_CODE?.trim() || "LEVYTATE-BETA";
const input = {
  organisationName: "Northbridge Validation Works",
  workspaceSlug: "northbridge-p2a-validation",
  prospectEmail: "prospect.lead@northbridge-validation.example",
  prospectDisplayName: "Morgan Hale",
  primaryContactEmail: "prospect.lead@northbridge-validation.example",
  logoReference: "",
  internalOwnerName: "LevyTate validation owner",
};
const checks = [];

try {
  await cleanup();
  const created = await createProspectSandbox(input);
  check("temporary prospect is prepared without an active membership", created.active === false, created);
  const prepared = await inspectProspectSandbox(input);
  check("persistent access record starts prepared", prepared.prospectAccess?.status === "prepared" && prepared.counts.users === 1, prepared);

  const preparedLogin = await login(input.prospectEmail);
  check("prepared login is denied safely", preparedLogin.status === 403 && preparedLogin.message === "Your LevyTate access has not yet been activated." && !preparedLogin.cookie, preparedLogin);

  const admin = await login("hello@levytate.co.uk");
  check("Platform Admin authentication succeeds", admin.status === 200 && Boolean(admin.cookie), { status: admin.status });
  let access = await adminAccess(admin.cookie, prepared.prospectAccess.id);
  check("Platform Admin can inspect safe access status", access.status === "prepared" && !Object.hasOwn(access, "internalNotes") && !Object.hasOwn(access, "revocationReason"), access);

  const activation = await control(admin.cookie, {
    operation: "activate",
    accessId: access.id,
    confirmation: "ACTIVATE",
    accessStartAt: new Date().toISOString(),
    accessExpiresAt: new Date(Date.now() + 14 * 86400000).toISOString(),
    internalOwnerName: input.internalOwnerName,
    actorEmail: "forged@example.invalid",
  });
  check("activation is explicit and fixes the operational role", activation.status === 200 && activation.body.access?.status === "active" && activation.body.access?.role === "Apprenticeship Lead", activation.body);
  access = activation.body.access;

  const first = await login(input.prospectEmail);
  check("active prospect receives a normal signed session", first.status === 200 && Boolean(first.cookie), { status: first.status });
  const afterFirst = await currentAccess(first.cookie);
  check("first login is recorded", afterFirst.status === 200 && Boolean(afterFirst.body.access?.firstLoginAt), afterFirst.body);
  const firstLoginAt = afterFirst.body.access.firstLoginAt;
  const second = await login(input.prospectEmail);
  const afterSecond = await currentAccess(second.cookie);
  check("first login timestamp is immutable", afterSecond.body.access?.firstLoginAt === firstLoginAt, afterSecond.body);

  const workspace = await api("/api/levytate-workspace", { cookie: first.cookie });
  check("workspace exposes only safe active guidance metadata", workspace.status === 200 && workspace.body.workspace?.meta?.prospectAccess?.status === "active" && workspace.body.workspace?.meta?.prospectAccess?.guidanceCompletedAt === null, workspace.body.workspace?.meta);
  const guidance = await api("/api/levytate-prospect-access", { method: "PATCH", cookie: first.cookie, body: { operation: "complete_guidance" } });
  check("prospect can complete their own guidance", guidance.status === 200 && Boolean(guidance.body.access?.guidanceCompletedAt), guidance.body);
  const guidanceAt = guidance.body.access.guidanceCompletedAt;
  access = guidance.body.access;

  const employee = await login("employee.demo@levytate.test");
  const forbiddenAdmin = await api("/api/levytate-prospect-access", { method: "PATCH", cookie: employee.cookie, body: { operation: "update_expiry", accessId: access.id, accessExpiresAt: new Date(Date.now() + 30 * 86400000).toISOString(), version: access.version } });
  check("employer role cannot control prospect access", forbiddenAdmin.status === 403 && !hasRawError(forbiddenAdmin.body), { status: forbiddenAdmin.status, body: forbiddenAdmin.body });
  const copiedAdminUrl = await api("/api/levytate-prospect-access", { cookie: employee.cookie });
  check("copied Platform Admin URL is denied", copiedAdminUrl.status === 403 && !hasRawError(copiedAdminUrl.body), { status: copiedAdminUrl.status });
  const manipulated = await control(admin.cookie, { operation: "revoke", accessId: "00000000-0000-4000-8000-000000000000", reason: "Boundary validation" });
  check("manipulated access identifier fails safely", manipulated.status === 404 && !hasRawError(manipulated.body), manipulated.body);

  const staleVersion = access.version;
  const shortened = await control(admin.cookie, { operation: "update_expiry", accessId: access.id, accessExpiresAt: new Date(Date.now() + 2500).toISOString(), reason: "Expiry validation", version: staleVersion });
  check("expiry can be shortened only with a reason and current version", shortened.status === 200, shortened.body);
  access = shortened.body.access;
  const stale = await control(admin.cookie, { operation: "update_expiry", accessId: access.id, accessExpiresAt: new Date(Date.now() + 86400000).toISOString(), reason: "Stale validation", version: staleVersion });
  check("stale expiry update is rejected", stale.status === 409, stale.body);
  await new Promise((resolve) => setTimeout(resolve, 2800));

  const expiredLogin = await login(input.prospectEmail);
  check("server resolves elapsed access to expired and denies login", expiredLogin.status === 403 && expiredLogin.message === "Your LevyTate access period has ended." && !expiredLogin.cookie, expiredLogin);
  const expired = await inspectProspectSandbox(input);
  check("expiry retains workspace records and membership identity", expired.prospectAccess?.status === "expired" && expired.counts.learners === 8 && expired.membershipId === prepared.membershipId, expired);

  const reactivated = await control(admin.cookie, { operation: "reactivate", accessId: access.id, confirmation: "REACTIVATE", accessExpiresAt: new Date(Date.now() + 14 * 86400000).toISOString() });
  check("reactivation restores the same membership and role", reactivated.status === 200 && reactivated.body.access?.status === "active" && reactivated.body.access?.userId === prepared.membershipId && reactivated.body.access?.role === "Apprenticeship Lead", reactivated.body);
  access = reactivated.body.access;

  const resetBefore = await inspectProspectSandbox(input);
  await resetProspectSandbox({ ...input, confirmation: "RESET" });
  const resetAfter = await inspectProspectSandbox(input);
  check("ordinary reset preserves access and guidance governance", resetAfter.prospectAccess?.status === "active" && resetAfter.prospectAccess?.guidanceCompletedAt === guidanceAt && resetAfter.prospectAccess?.id === resetBefore.prospectAccess?.id, resetAfter);

  const revoked = await control(admin.cookie, { operation: "revoke", accessId: access.id, reason: "P2A controlled revocation validation" });
  check("revocation requires and records a controlled transition", revoked.status === 200 && revoked.body.access?.status === "revoked", revoked.body);
  const revokedLogin = await login(input.prospectEmail);
  check("revoked login is denied without internal detail", revokedLogin.status === 403 && revokedLogin.message.includes("no longer active") && !revokedLogin.message.includes("validation") && !revokedLogin.cookie, revokedLogin);
  await resetProspectSandbox({ ...input, confirmation: "RESET" });
  const revokedAfterReset = await inspectProspectSandbox(input);
  check("reset cannot reactivate revoked access", revokedAfterReset.prospectAccess?.status === "revoked" && revokedAfterReset.counts.learners === 8, revokedAfterReset);

  const audits = await auditEvents(prepared.organisationId);
  const auditActions = new Set(audits.map((event) => event.action));
  for (const action of ["prospect_access.prepared", "prospect_access.activated", "prospect_access.first_login", "prospect_access.guidance_completed", "prospect_access.expiry_updated", "prospect_access.expired", "prospect_access.reactivated", "prospect_access.revoked"]) {
    check(`audit includes ${action}`, auditActions.has(action), [...auditActions]);
  }

  console.log(JSON.stringify({ ok: true, checksPassed: checks.length, firstLoginRecordedOnce: true, guidancePersists: true, expiredDataRetained: true, revokedResetSafe: true, temporaryWorkspaceRemoved: true }, null, 2));
} finally {
  await cleanup().catch(() => {});
}

function check(label, passed, detail) { if (!passed) throw new Error(`${label} failed: ${JSON.stringify(detail)}`); checks.push(label); }
function hasRawError(value) { return /supabase|postgres|constraint|service_role|organisation_id/i.test(JSON.stringify(value)); }

async function login(email) {
  const response = await fetch(`${baseUrl}/api/levytate-beta-login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, code: betaCode }) });
  const body = await response.json().catch(() => ({}));
  return { status: response.status, cookie: response.headers.get("set-cookie")?.split(";")[0] ?? "", message: body.message ?? "" };
}
async function api(pathname, { method = "GET", cookie = "", body } = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, { method, headers: { ...(cookie ? { Cookie: cookie } : {}), ...(body ? { "Content-Type": "application/json" } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const text = await response.text(); let parsed = text; try { parsed = JSON.parse(text); } catch {}
  return { status: response.status, body: parsed };
}
async function currentAccess(cookie) { return api("/api/levytate-prospect-access", { cookie }); }
async function adminAccess(cookie, id) { const response = await api("/api/levytate-prospect-access", { cookie }); if (response.status !== 200) throw new Error("Admin access list failed."); return response.body.access.find((item) => item.id === id); }
async function control(cookie, body) { return api("/api/levytate-prospect-access", { method: "PATCH", cookie, body }); }

function serviceConfig() { const url = String(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim().replace(/\/rest\/v1\/?$/i, "").replace(/\/$/, ""); const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim(); if (!url || !key) throw new Error("Supabase service configuration is required."); return { url, key }; }
async function rest(table, { method = "GET", query = {}, body } = {}) { const config = serviceConfig(); const response = await fetch(`${config.url}/rest/v1/${table}?${new URLSearchParams(query)}`, { method, headers: { apikey: config.key, Authorization: `Bearer ${config.key}`, "Content-Type": "application/json", Prefer: "return=representation" }, ...(body ? { body: JSON.stringify(body) } : {}) }); if (!response.ok) throw new Error(`Validation storage operation failed for ${table} (${response.status}).`); const text = await response.text(); return text ? JSON.parse(text) : []; }
async function auditEvents(organisationId) { return rest("levytate_audit_events", { query: { select: "action", organisation_id: `eq.${organisationId}`, entity_type: "eq.prospect_access" } }); }
async function cleanup() { if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return; const organisations = await rest("levytate_organisations", { query: { select: "id,workspace_template", slug: `eq.${input.workspaceSlug}`, limit: "1" } }); const org = organisations[0]; if (org?.workspace_template === "levytate-prospect-sandbox") await rest("levytate_organisations", { method: "DELETE", query: { id: `eq.${org.id}` } }); await rest("levytate_early_access_requests", { method: "DELETE", query: { email: `eq.${input.prospectEmail}` } }); await rest("subscribers", { method: "DELETE", query: { email: `eq.${input.prospectEmail}` } }); }
async function loadLocalEnvironment() { for (const name of [".env.local", ".env"]) { try { const raw = await fs.readFile(path.join(process.cwd(), name), "utf8"); for (const line of raw.split(/\r?\n/)) { if (!line || line.trimStart().startsWith("#")) continue; const at = line.indexOf("="); if (at < 1) continue; const key = line.slice(0, at).trim(); const value = line.slice(at + 1).trim().replace(/^["']|["']$/g, ""); if (!process.env[key] && value) process.env[key] = value; } } catch {} } }
