const baseUrl = (process.argv[2] ?? process.env.LEVYTATE_VALIDATION_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const betaCode = process.env.LEVYTATE_BETA_CODE?.trim() || "LEVYTATE-BETA";
const checks = [];
const scenarios = [
  { email: "employee.demo@levytate.test", role: "Employee", labels: ["Home", "My Application", "My Apprenticeship", "Copilot", "Guidance Centre"], hidden: "Providers" },
  { email: "manager.demo@levytate.test", role: "Line Manager", labels: ["Home", "Approvals", "My Team", "Copilot", "Guidance Centre"], hidden: "Reports" },
  { email: "apprenticeshiplead.demo@levytate.test", role: "Apprenticeship Lead", labels: ["Operations Centre", "Intelligence", "Applications", "Learners", "Providers", "People", "Programmes", "Settings", "Copilot", "Guidance Centre"], hidden: "Reports" },
  { email: "hello@levytate.co.uk", role: "Platform Admin", labels: ["Employer Workspaces", "Provider Catalogue", "Access & Tenant Support", "Guidance Administration", "Support / Audit Context"], hidden: "Learners" },
];

for (const scenario of scenarios) {
  const cookie = await login(scenario.email);
  const workspace = await request("/api/levytate-workspace", cookie);
  check(`${scenario.role} workspace loads`, workspace.status === 200);
  const policy = workspace.body.workspace?.meta?.coreEarlyAccess;
  const visible = policy?.modules?.filter((item) => ["enabled", "secondary"].includes(item.availability)).map((item) => item.label) ?? [];
  check(`${scenario.role} exact navigation`, JSON.stringify(visible) === JSON.stringify(scenario.labels), { expected: scenario.labels, actual: visible });
  const permitted = await request(`/levytate/app?module=${encodeURIComponent(policy.modules.find((item) => item.availability === "enabled").moduleKey)}`, cookie);
  check(`${scenario.role} authorised module loads`, permitted.status === 200, permitted.status);
  const hidden = await request(`/levytate/app?module=${encodeURIComponent(scenario.hidden)}`, cookie);
  check(`${scenario.role} hidden module redirects safely`, [307, 308].includes(hidden.status) && hidden.headers.get("location")?.startsWith("/levytate/app"), { status: hidden.status, location: hidden.headers.get("location") });
}

console.log(JSON.stringify({ ok: true, baseUrl, checksPassed: checks.length }, null, 2));

function check(label, condition, detail) { if (!condition) throw new Error(`FAILED: ${label} ${JSON.stringify(detail ?? {})}`); checks.push(label); }
async function login(email) {
  const response = await request("/api/levytate-beta-login", "", { method: "POST", body: { email, code: betaCode } });
  const cookie = response.headers.get("set-cookie")?.split(";")[0] ?? "";
  check(`${email} login succeeds`, response.status === 200 && Boolean(cookie), response.body);
  return cookie;
}
async function request(path, cookie = "", init = {}) {
  const response = await fetch(`${baseUrl}${path}`, { method: init.method ?? "GET", headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) }, ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }), redirect: "manual" });
  return { status: response.status, headers: response.headers, body: await response.json().catch(() => ({})) };
}
