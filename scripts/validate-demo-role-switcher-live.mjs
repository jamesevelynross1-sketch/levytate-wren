const baseUrl = (process.env.LEVYTATE_BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const betaCode = process.env.LEVYTATE_BETA_CODE;
if (!betaCode) throw new Error("LEVYTATE_BETA_CODE is required for the fictional live validation.");

const controllerEmail = "apprenticeshiplead.demo@levytate.test";
const startedAt = new Date().toISOString();
let checks = 0;

function check(label, condition, details) {
  checks += 1;
  if (!condition) throw new Error(`FAIL: ${label}${details ? ` ${JSON.stringify(details)}` : ""}`);
  console.log(`PASS: ${label}`);
}

class CookieJar {
  values = new Map();
  apply(response) {
    for (const value of response.headers.getSetCookie?.() ?? []) {
      // This lightweight jar tracks the host-only variant. Domain expiries are
      // the separate, transitional copy of the same cookie name.
      if (/Domain=/i.test(value)) continue;
      const [pair] = value.split(";", 1);
      const separator = pair.indexOf("=");
      if (separator < 0) continue;
      const name = pair.slice(0, separator);
      const cookieValue = pair.slice(separator + 1);
      if (!cookieValue || /Max-Age=0/i.test(value)) this.values.delete(name);
      else this.values.set(name, cookieValue);
    }
  }
  header() { return [...this.values].map(([name, value]) => `${name}=${value}`).join("; "); }
  clone() { const next = new CookieJar(); next.values = new Map(this.values); return next; }
}

async function request(path, jar, init = {}) {
  const headers = new Headers(init.headers);
  if (jar?.header()) headers.set("cookie", jar.header());
  const response = await fetch(`${baseUrl}${path}`, { ...init, headers, redirect: "manual" });
  jar?.apply(response);
  const text = await response.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  return { response, body };
}

async function login(email) {
  const jar = new CookieJar();
  const result = await request("/api/levytate-beta-login", jar, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, code: betaCode }),
  });
  check(`${email} internal login succeeds`, result.response.status === 200, result.body);
  check(`${email} receives a signed employer session`, jar.values.has("levytate_beta_session"));
  return { jar, result };
}

async function switchPerspective(jar, perspective, origin = baseUrl) {
  return request("/api/levytate-demo-perspective", jar, {
    method: "POST",
    headers: { "content-type": "application/json", origin },
    body: JSON.stringify({ perspective }),
  });
}

async function workspace(jar) {
  return request("/api/levytate-workspace", jar);
}

const { jar: controllerJar, result: controllerLogin } = await login(controllerEmail);
check("controller receives independent demo authorisation", controllerJar.values.has("levytate_demo_controller"));
const controllerCookie = controllerLogin.result?.response?.headers?.getSetCookie?.().find((value) => value.startsWith("levytate_demo_controller="))
  ?? controllerLogin.response.headers.getSetCookie().find((value) => value.startsWith("levytate_demo_controller="));
check("controller cookie is HTTP-only", /HttpOnly/i.test(controllerCookie ?? ""));
check("controller cookie uses SameSite Strict", /SameSite=Strict/i.test(controllerCookie ?? ""));
check("controller cookie is host-only", !/Domain=/i.test(controllerCookie ?? ""));

const initial = await request("/api/levytate-demo-perspective", controllerJar);
check("switcher state loads", initial.response.status === 200 && initial.body?.switcher?.enabled === true, initial.body);
check("initial perspective is Apprenticeship Lead", initial.body?.switcher?.currentRole === "Apprenticeship Lead");
check("only three approved perspectives are returned", initial.body?.switcher?.options?.length === 3);
check("switcher response is private and no-store", /private/.test(initial.response.headers.get("cache-control") ?? "") && /no-store/.test(initial.response.headers.get("cache-control") ?? ""));

const leadWorkspace = await workspace(controllerJar);
check("Apprenticeship Lead workspace resolves", leadWorkspace.response.status === 200 && leadWorkspace.body?.workspace?.meta?.userRole === "Apprenticeship Lead", leadWorkspace.body);
const originalApplications = JSON.stringify((leadWorkspace.body?.workspace?.data?.applications ?? []).map(({ id, status, currentOwner }) => ({ id, status, currentOwner })));

const managerSwitch = await switchPerspective(controllerJar, "line_manager");
check("Line Manager switch succeeds", managerSwitch.response.status === 200 && managerSwitch.body?.switcher?.currentRole === "Line Manager", managerSwitch.body);
check("perspective switch returns a host-only session", managerSwitch.response.headers.getSetCookie().some((value) => value.startsWith("levytate_beta_session=") && !/Domain=/i.test(value) && !/Max-Age=0/i.test(value)));
const managerWorkspace = await workspace(controllerJar);
check("Line Manager workspace revalidates genuine role", managerWorkspace.response.status === 200 && managerWorkspace.body?.workspace?.meta?.userRole === "Line Manager", managerWorkspace.body);
const managerEmployees = managerWorkspace.body?.workspace?.data?.employees ?? [];
check("Line Manager data contains no unrelated employee", managerEmployees.every((employee) => employee.id === "gc-rbac-employee-morgan" || employee.managerId === "gc-rbac-employee-morgan"));

const employeeSwitch = await switchPerspective(controllerJar, "employee");
check("Employee switch succeeds", employeeSwitch.response.status === 200 && employeeSwitch.body?.switcher?.currentRole === "Employee", employeeSwitch.body);
const employeeWorkspace = await workspace(controllerJar);
check("Employee workspace revalidates genuine role", employeeWorkspace.response.status === 200 && employeeWorkspace.body?.workspace?.meta?.userRole === "Employee", employeeWorkspace.body);
check("Employee sees only their own employee record", (employeeWorkspace.body?.workspace?.data?.employees ?? []).every((employee) => employee.email === "employee.demo@levytate.test"));

const forgedRole = await switchPerspective(controllerJar, "Platform Admin");
check("arbitrary role switch is denied", forgedRole.response.status === 400);
const crossOrigin = await switchPerspective(controllerJar, "line_manager", "https://attacker.invalid");
check("cross-origin switch is denied", crossOrigin.response.status === 403);

const tamperedJar = controllerJar.clone();
const originalToken = tamperedJar.values.get("levytate_demo_controller");
tamperedJar.values.set("levytate_demo_controller", `${originalToken?.slice(0, -1)}x`);
const tampered = await switchPerspective(tamperedJar, "line_manager");
check("forged controller authorisation is denied", tampered.response.status === 401);

const leadSwitch = await switchPerspective(controllerJar, "apprenticeship_lead");
check("switching back to the original perspective succeeds", leadSwitch.response.status === 200 && leadSwitch.body?.switcher?.currentRole === "Apprenticeship Lead", leadSwitch.body);
const returnedLeadWorkspace = await workspace(controllerJar);
const returnedApplications = JSON.stringify((returnedLeadWorkspace.body?.workspace?.data?.applications ?? []).map(({ id, status, currentOwner }) => ({ id, status, currentOwner })));
check("shared workflow state persists across switches", returnedApplications === originalApplications);

const { jar: normalJar } = await login("employee.demo@levytate.test");
check("non-controller internal identity receives no controller cookie", !normalJar.values.has("levytate_demo_controller"));
const normalSwitcher = await request("/api/levytate-demo-perspective", normalJar);
check("non-controller session cannot discover the switcher", normalSwitcher.response.status === 404);

const audits = await readAuditEvents();
check("controller authorisation and perspective switches are audited", audits.some((event) => event.action === "demo.controller_authorised") && audits.filter((event) => event.action === "demo.perspective_switched").length >= 3);

const logout = await request("/api/levytate-beta-logout", controllerJar, { method: "POST", headers: { origin: baseUrl } });
check("logout redirects safely", logout.response.status === 303);
check("logout clears active persona and controller cookies", !controllerJar.values.has("levytate_beta_session") && !controllerJar.values.has("levytate_demo_controller"));
const afterLogout = await request("/api/levytate-demo-perspective", controllerJar);
check("switcher remains unavailable after logout", afterLogout.response.status === 404);

console.log(`Live demo role switcher validation passed (${checks} checks).`);

async function readAuditEvents() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase configuration is required to verify demo audit events.");
  const query = new URLSearchParams({
    select: "action,metadata,created_at",
    entity_type: "eq.demo_role_switch",
    actor_email: `eq.${controllerEmail}`,
    created_at: `gte.${startedAt}`,
    order: "created_at.asc",
  });
  const response = await fetch(`${url.replace(/\/$/, "")}/rest/v1/levytate_audit_events?${query}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  if (!response.ok) throw new Error(`Audit verification failed (${response.status}).`);
  return response.json();
}
