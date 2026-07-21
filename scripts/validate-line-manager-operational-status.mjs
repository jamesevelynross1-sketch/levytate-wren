import fs from "node:fs/promises";
import path from "node:path";
import ts from "typescript";

await loadRuntimeEnv();

const baseUrl = (process.argv.find((value) => value.startsWith("http")) || process.env.LEVYTATE_BASE_URL || "http://localhost:3025").replace(/\/$/, "");
const betaCode = process.env.LEVYTATE_BETA_CODE || "LEVYTATE-BETA";
const checks = [];

const manager = await login("manager.demo@levytate.test", "198.51.100.241");
const workspaceResponse = await fetch(`${baseUrl}/api/levytate-workspace`, { headers: { cookie: manager.cookie } });
const workspacePayload = await safeJson(workspaceResponse);
const workspace = workspacePayload.workspace;
assert("workspace bootstrap succeeds", workspaceResponse.status === 200);
assert("line manager remains direct-report scoped", workspace.meta?.userRole === "Line Manager");

const employeeNames = new Map((workspace.data?.employees ?? []).map((employee) => [employee.id, employee.name]));
const summaries = new Map((workspace.meta?.directReportOperationalSummaries ?? []).map((summary) => [employeeNames.get(summary.employeeId), summary]));
const ben = requireSummary(summaries, "Ben Marshall");
assert("Ben lifecycle outranks application", ben.primaryStatus === "Enrolled" && ben.primaryStatusSource === "learner_lifecycle");
assert("Ben progress is separate", ben.progressPosition === "Ahead of target");
assert("Ben programme is current", /data analyst/i.test(ben.programme));
assert("Ben stale discovery state is absent", !/discovery in progress|building/i.test(JSON.stringify(ben)));
assert("Ben manager support is lifecycle-derived", Boolean(ben.managerSupportSummary) && ben.managerSupportState === "no_action");

assertStatus(summaries, "Cara Hughes", "Enrolled", "learner_lifecycle");
assertStatus(summaries, "Daniel Frost", "Break in learning", "learner_lifecycle");
assertStatus(summaries, "Finley Brooks", "Assessment preparation", "learner_lifecycle");
assertStatus(summaries, "Grace Bennett", "In assessment", "learner_lifecycle");
assertStatus(summaries, "Erin Vale", "Awaiting Manager Review", "application");
assertStatus(summaries, "Leo Turner", "Draft", "application");
const noJourney = requireSummary(summaries, "Owen Blake");
assert("no-journey employee uses development fallback", noJourney.primaryStatusSource === "development");

const deriveSummary = await loadSummaryHelper();
const preEnrolment = deriveSummary({ employeeId: "pre", learner: { lifecycleStatus: "pre_enrolment", programme: "Data technician" }, application: { status: "Approved for Enrolment" } });
assert("pre-enrolment lifecycle outranks application", preEnrolment.primaryStatus === "Pre-enrolment" && preEnrolment.primaryStatusSource === "learner_lifecycle");
const achieved = deriveSummary({ employeeId: "achieved", learner: { lifecycleStatus: "achieved", programme: "Data analyst", progressPosition: "On target" }, application: { status: "Approved for Enrolment" } });
assert("achieved lifecycle outranks application", achieved.primaryStatus === "Achieved" && achieved.applicationOutcome === "Approved for Enrolment");
const completed = deriveSummary({ employeeId: "completed", learner: { lifecycleStatus: "completed_without_achievement", programme: "Data analyst" }, application: { status: "Approved for Enrolment" } });
assert("terminal lifecycle label is human readable", completed.primaryStatus === "Completed without achievement");
const draft = deriveSummary({ employeeId: "draft", application: { status: "Draft", programme: "Data technician" }, development: { status: "Discovery in progress" } });
assert("draft application outranks development", draft.primaryStatus === "Draft" && draft.primaryStatusSource === "application");

const detailResponse = await fetch(`${baseUrl}/api/levytate-manager-direct-reports/gc-lifecycle-employee-ben`, { headers: { cookie: manager.cookie } });
const detailBody = await safeJson(detailResponse);
assert("Ben learner detail succeeds", detailResponse.status === 200);
assert("profile header summary uses lifecycle", detailBody.detail?.operationalSummary?.primaryStatus === "Enrolled");
assert("application is historical context", detailBody.detail?.operationalSummary?.applicationOutcome === "Approved for Enrolment");

const copilot = await ask(manager.cookie, "What is Ben Marshall's current status?");
const copilotCells = copilot.structuredResult?.rows?.[0]?.cells ?? {};
assert("Copilot uses lifecycle stage", copilotCells.currentStage === "Enrolled");
assert("Copilot uses same progress", copilotCells.progress === "Ahead of target");
assert("Copilot keeps application outcome secondary", copilotCells.applicationOutcome === "Approved for Enrolment");

console.log(JSON.stringify({
  baseUrl,
  BenMarshall: ben,
  scenarios: Object.fromEntries([...summaries.entries()].filter(([name]) => ["Cara Hughes", "Daniel Frost", "Finley Brooks", "Grace Bennett", "Erin Vale", "Leo Turner", "Owen Blake"].includes(name))),
  checksPassed: checks.length,
}, null, 2));

function requireSummary(summariesByName, name) {
  const summary = summariesByName.get(name);
  assert(`${name} summary exists`, Boolean(summary));
  return summary;
}

function assertStatus(summariesByName, name, status, source) {
  const summary = requireSummary(summariesByName, name);
  assert(`${name} uses ${status}`, summary.primaryStatus === status && summary.primaryStatusSource === source);
}

async function ask(cookie, userMessage) {
  const response = await fetch(`${baseUrl}/api/levytate-ai`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie, "x-forwarded-for": "198.51.100.242" },
    body: JSON.stringify({ role: "Line Manager", userRole: "Line Manager", selectedSite: "All sites", currentSection: "LevyTate Copilot", userMessage, conversationHistory: [], employerContext: "Ground Control" }),
  });
  const body = await safeJson(response);
  if (!response.ok) throw new Error(`Copilot request failed (${response.status}): ${JSON.stringify(body)}`);
  return body;
}

async function login(email, ip) {
  const response = await fetch(`${baseUrl}/api/levytate-beta-login`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify({ email, code: betaCode }),
  });
  const body = await safeJson(response);
  assert(`login succeeds for ${email}`, response.status === 200);
  const cookie = response.headers.get("set-cookie")?.split(";")[0];
  if (!cookie) throw new Error(`No signed session returned for ${email}: ${JSON.stringify(body)}`);
  return { cookie };
}

async function safeJson(response) {
  return response.json().catch(() => ({}));
}

function assert(label, condition) {
  if (!condition) throw new Error(`Validation failed: ${label}`);
  checks.push(label);
}

async function loadRuntimeEnv() {
  for (const filename of [".env.vercel.local", ".env.local", ".env"]) {
    try {
      const content = await fs.readFile(path.join(process.cwd(), filename), "utf8");
      for (const line of content.split(/\r?\n/)) {
        const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
        if (!match || process.env[match[1]]) continue;
        process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
      }
    } catch {}
  }
}
async function loadSummaryHelper() {
  const source = await fs.readFile(path.join(process.cwd(), "lib/levytate/mvp/employee-operational-summary.ts"), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const labels = {
    pre_enrolment: "Pre-enrolment",
    enrolled: "Enrolled",
    break_in_learning: "Break in learning",
    assessment_preparation: "Assessment preparation",
    in_assessment: "In assessment",
    achieved: "Achieved",
    withdrawn: "Withdrawn",
    completed_without_achievement: "Completed without achievement",
  };
  const module = { exports: {} };
  const localRequire = (specifier) => {
    if (specifier === "@/lib/levytate/mvp/learner-record-view") return { lifecycleStatusLabel: (status) => labels[status] ?? status };
    return {};
  };
  new Function("require", "module", "exports", compiled)(localRequire, module, module.exports);
  return module.exports.deriveEmployeeOperationalSummary;
}
