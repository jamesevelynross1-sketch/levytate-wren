const baseUrl = (process.argv[2] ?? process.env.LEVYTATE_VALIDATION_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const betaCode = process.env.LEVYTATE_BETA_CODE?.trim() || "LEVYTATE-BETA";
const checks = [];
const check = (label, condition, detail) => { if (!condition) throw new Error(`FAILED: ${label} ${JSON.stringify(detail ?? {})}`); checks.push(label); };

const admin = await login("hello@levytate.co.uk");
const workspace = await request("/api/levytate-workspace", admin.cookie);
check("Platform Admin workspace loads", workspace.status === 200, workspace.body);
const meta = workspace.body.workspace?.meta;
const data = workspace.body.workspace?.data;
check("Platform Admin receives explicit permissions only", meta?.permissions?.includes("earlyAccess:manage") && meta.permissions.includes("providers:write") && !meta.permissions.includes("applications:status") && !meta.permissions.includes("learnerLifecycle:write") && !meta.permissions.includes("operationalActions:write"), meta?.permissions);
check("Platform Admin receives central policy", meta?.coreEarlyAccess?.role === "Platform Admin" && meta.coreEarlyAccess.modules.some((item) => item.label === "Employer Workspaces"), meta?.coreEarlyAccess);
check("Platform Admin bootstrap excludes employer operations", [data?.applications, data?.learnerRecords, data?.operationalActions, data?.providerRelationships].every((items) => Array.isArray(items) && items.length === 0));
check("Provider Catalogue remains available", Array.isArray(data?.providers));

for (const [label, status] of [["approve application", "Approved by Line Manager"], ["decline application", "Declined by Line Manager"], ["request more information", "More information requested"]]) {
  await denied(label, "/api/levytate-workspace", admin.cookie, { method: "POST", body: { type: "updateApplicationStatus", id: "gc-rbac-app-erin", status, note: "Boundary validation only." } });
}

const learner = "gc-lifecycle-record-cara";
await denied("update learner progress", `/api/levytate-learners/${learner}/progress`, admin.cookie, { method: "POST", body: {} });
await denied("record employer review", `/api/levytate-learners/${learner}/reviews`, admin.cookie, { method: "POST", body: {} });
await denied("record manager check-in", "/api/levytate-manager/direct-reports/gc-lifecycle-employee-cara/check-ins", admin.cookie, { method: "POST", body: {} });
await denied("mark learner enrolled", `/api/levytate-learners/${learner}/enrol`, admin.cookie, { method: "POST", body: {} });
await denied("start Break in Learning", `/api/levytate-learners/${learner}/breaks`, admin.cookie, { method: "POST", body: {} });
await denied("return learner from break", `/api/levytate-learners/${learner}/breaks/copied-break/return`, admin.cookie, { method: "POST", body: {} });
await denied("confirm assessment readiness", `/api/levytate-learners/${learner}/confirm-assessment-readiness`, admin.cookie, { method: "POST", body: { idempotencyKey: "platform-admin-boundary-validation" } });
await denied("change learner lifecycle status", "/api/levytate-workspace", admin.cookie, { method: "POST", body: { type: "updateLearnerLifecycleStatus", id: learner, status: "active_learning" } });
await denied("manage employer provider relationship", "/api/levytate-workspace", admin.cookie, { method: "POST", body: { type: "saveProviderRelationship", relationship: {} } });
await denied("acknowledge employer operational action", "/api/levytate-operational-actions/copied-action", admin.cookie, { method: "PATCH", body: { command: "acknowledge", expectedVersion: 1 } });
await denied("access employer governance", "/api/levytate-operational-governance", admin.cookie);
await denied("access organisation learner list", "/api/levytate-learners", admin.cookie);
await denied("query employer operational data through Copilot", "/api/levytate-ai", admin.cookie, { method: "POST", body: { role: "LevyTate Admin", userRole: "LevyTate Admin", userMessage: "Show me learners behind target." } });

const prospect = await request("/api/levytate-prospect-access", admin.cookie);
check("Access & Tenant Support remains available", prospect.status === 200, prospect.body);
const guidance = await request("/api/levytate-guidance-sources", admin.cookie);
check("Guidance Administration remains available", guidance.status === 200, guidance.body);

console.log(JSON.stringify({ ok: true, baseUrl, checksPassed: checks.length }, null, 2));

async function denied(label, path, cookie, init = {}) {
  const response = await request(path, cookie, init);
  check(label, response.status === 403 && !/supabase|constraint|stack|service.role/i.test(JSON.stringify(response.body)), { status: response.status, body: response.body });
}

async function login(email) {
  const response = await request("/api/levytate-beta-login", "", { method: "POST", body: { email, code: betaCode } });
  const cookie = response.headers.get("set-cookie")?.split(";")[0] ?? "";
  check("Platform Admin login succeeds", response.status === 200 && Boolean(cookie), response.body);
  return { cookie };
}

async function request(path, cookie = "", init = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: init.method ?? "GET",
    headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) },
    ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
    redirect: "manual",
  });
  return { status: response.status, headers: response.headers, body: await response.json().catch(() => ({})) };
}
