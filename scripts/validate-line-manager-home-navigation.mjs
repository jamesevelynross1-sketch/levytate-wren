import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";

const baseUrl = (process.argv[2] ?? process.env.LEVYTATE_VALIDATION_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const betaCode = process.env.LEVYTATE_BETA_CODE?.trim() || "LEVYTATE-BETA";
const checks = [];

await main();

async function main() {
  resetFixture();

  const manager = await login("manager.demo@levytate.test");
  const employee = await login("employee.demo@levytate.test");
  const isolation = await login("isolation.employee.demo@levytate.test");
  const managerWorkspace = await workspace(manager.cookie);
  const employeeWorkspace = await workspace(employee.cookie);
  const isolationWorkspace = await workspace(isolation.cookie);

  const managerData = managerWorkspace.workspace.data;
  const morgan = managerData.employees.find((item) => item.email === "manager.demo@levytate.test");
  const erin = managerData.employees.find((item) => item.name === "Erin Vale");
  const application = managerData.applications.find((item) => item.employeeId === erin?.id && ["Submitted to Line Manager", "Awaiting Manager Review"].includes(item.status));

  assert("manager identity resolves to Morgan Price", morgan?.name === "Morgan Price");
  assert("Erin Vale is an authoritative direct report", erin?.managerId === morgan?.id);
  assert("Home decision item has a scoped application ID", application?.id === "gc-rbac-app-erin");
  assert("manager workspace contains no Nadia application", !managerData.applications.some((item) => item.id === "gc-rbac-app-nadia"));
  assert("employee workspace cannot read manager review queue", !employeeWorkspace.workspace.data.applications.some((item) => item.id !== "gc-rbac-app-erin"));
  assert("cross-organisation workspace cannot read Ground Control application", !JSON.stringify(isolationWorkspace.workspace.data).includes("gc-rbac-app-erin"));

  const refreshablePage = await request(`/levytate/app?module=Approvals&application=${encodeURIComponent(application.id)}`, manager.cookie);
  assert("refreshable manager review destination loads", refreshablePage.status === 200);

  await expectDenied("manipulated application mutation fails safely", manager.cookie, "not-a-real-application");
  await expectDenied("another manager application mutation fails safely", manager.cookie, "gc-rbac-app-nadia");
  await expectDenied("Employee cannot use manager review mutation", employee.cookie, "gc-rbac-app-erin");
  await expectDenied("cross-organisation user cannot use manager review mutation", isolation.cookie, "gc-rbac-app-erin");

  const appShell = await fs.readFile("components/levytate-mvp/LevyTateMvpApp.tsx", "utf8");
  const home = await fs.readFile("components/levytate-mvp/DashboardSettingsModules.tsx", "utf8");
  const approvals = await fs.readFile("components/levytate-mvp/ApplicationsModule.tsx", "utf8");
  assert("one shared application review navigation function is used", appShell.includes("function openApplicationReview(applicationId: string)"));
  assert("review selection is retained in the internal URL", appShell.includes("module=Approvals&application=${encodeURIComponent(applicationId)}"));
  assert("exact module keys use central navigation", appShell.includes("const exactModule = availableModules.find((module) => module.name === target)"));
  assert("both Home review actions use the shared callback", occurrences(home, "onOpenApplicationReview(nextApplication.id)") === 2);
  assert("My Team action uses the recognised module key", home.includes('onNavigate("My Team")'));
  assert("Home controls expose visible keyboard focus", occurrences(home, "focus-visible:ring") >= 3);
  assert("invalid selected applications show safe copy", approvals.includes("This application could not be opened. Refresh the page and try again."));
  assert("Approvals reauthorises requested IDs against its scoped queue", approvals.includes("queue.find((application) => application.id === selectedId)"));

  resetFixture();
  console.log(JSON.stringify({
    ok: true,
    baseUrl,
    manager: morgan.name,
    employee: erin.name,
    applicationId: application.id,
    checksPassed: checks.length,
  }, null, 2));
}

async function login(email) {
  const response = await request("/api/levytate-beta-login", "", {
    method: "POST",
    body: JSON.stringify({ email, code: betaCode }),
  });
  const body = await safeJson(response);
  assert(`login succeeds for ${email}`, response.status === 200);
  const cookie = response.headers.get("set-cookie")?.split(";")[0] ?? "";
  if (!cookie) throw new Error(`No session returned for ${email}: ${JSON.stringify(body)}`);
  return { cookie };
}

async function workspace(cookie) {
  const response = await request("/api/levytate-workspace", cookie);
  const body = await safeJson(response);
  assert("scoped workspace loads", response.status === 200 && body?.ok === true);
  return body;
}

async function expectDenied(label, cookie, id) {
  const response = await request("/api/levytate-workspace", cookie, {
    method: "POST",
    body: JSON.stringify({
      type: "updateApplicationStatus",
      id,
      status: "Approved by Line Manager",
      note: "This validation request must be denied.",
    }),
  });
  const body = await safeJson(response);
  assert(label, response.status === 403 && typeof body?.message === "string" && !/supabase|levytate_applications|constraint|stack/i.test(body.message));
}

function request(path, cookie = "", init = {}) {
  return fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(cookie ? { Cookie: cookie } : {}),
      ...(init.headers ?? {}),
    },
    redirect: "manual",
  });
}

async function safeJson(response) {
  return response.json().catch(() => ({}));
}

function occurrences(value, term) {
  return value.split(term).length - 1;
}

function assert(label, condition) {
  if (!condition) throw new Error(`FAILED: ${label}`);
  checks.push(label);
}

function resetFixture() {
  execFileSync(process.execPath, ["scripts/prepare-line-manager-smoke-fixture.mjs"], {
    cwd: process.cwd(),
    stdio: "pipe",
    env: process.env,
  });
}
