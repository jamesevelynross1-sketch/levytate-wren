import fs from "node:fs/promises";
import path from "node:path";

await loadRuntimeEnv();

const baseUrl = (process.argv.find((value) => value.startsWith("http")) || process.env.LEVYTATE_BASE_URL || "http://localhost:3025").replace(/\/$/, "");
const betaCode = process.env.LEVYTATE_BETA_CODE || "LEVYTATE-BETA";
const checks = [];

const manager = await login("manager.demo@levytate.test", "198.51.100.201");
const employee = await login("employee.demo@levytate.test", "198.51.100.202");
const lead = await login("apprenticeshiplead.demo@levytate.test", "198.51.100.203");
const admin = await login("hello@levytate.co.uk", "198.51.100.204");
const isolation = await login("isolation.employee.demo@levytate.test", "198.51.100.205");

const ids = {
  application: "gc-rbac-employee-erin",
  noJourney: "gc-rbac-employee-owen",
  onTarget: "gc-lifecycle-employee-ben",
  behind: "gc-lifecycle-employee-cara",
  break: "gc-lifecycle-employee-daniel",
  assessment: "gc-lifecycle-employee-finley",
  inAssessment: "gc-lifecycle-employee-grace",
  sameDepartmentNonReport: "gc-lifecycle-employee-jules",
  anotherOrganisation: "isolation-employee-isla",
  noManager: "gc-rbac-employee-priya",
  learnerRecord: "gc-lifecycle-record-cara",
};

const application = await detail(ids.application, manager.cookie);
assert("awaiting-review employee resolves", application.employee.name === "Erin Vale" && application.application.status === "Awaiting Manager Review");
assert("application support is decision required", ["application_decision", "employee_information_received"].includes(application.managerSupport.state) && application.managerSupport.destination === "/levytate/app?module=Approvals");

const onTarget = await detail(ids.onTarget, manager.cookie);
assert("on-target learner resolves", onTarget.employee.name === "Ben Marshall" && onTarget.progress.position === "Ahead of target");
assert("on-target progress is complete", onTarget.progress.target === 38 && onTarget.progress.actual === 41 && onTarget.progress.variance === 3);
assert("review summaries are present", onTarget.reviews.latest.provider?.date === "2026-07-05" && Boolean(onTarget.reviews.latest.manager?.date));

const behind = await detail(ids.behind, manager.cookie);
assert("behind-target learner resolves", behind.employee.name === "Cara Hughes" && behind.progress.position === "Significantly behind");
assert("plain-language variance is correct", behind.progress.varianceLabel === "15 percentage points behind target.");
assert("overdue provider review is visible", behind.reviews.latest.provider?.status === "action_required" && behind.reviews.latest.provider?.nextDate === "2026-06-27");
assert("manager support is centrally derived", ["manager_check_in", "progress_support", "workplace_opportunity"].includes(behind.managerSupport.state));
assert("manager-relevant actions are scoped", behind.actions.length > 0 && behind.actions.every((action) => action.owner && action.reason));

const breakDetail = await detail(ids.break, manager.cookie);
assert("Break in Learning renders", breakDetail.journey.lifecycleStatus === "break_in_learning" && breakDetail.breakInLearning.status === "Active");
assert("sensitive break reason is not returned", !("reasonNotes" in breakDetail.breakInLearning) && !("reasonCategory" in breakDetail.breakInLearning));
assert("break return support is derived", breakDetail.managerSupport.state === "break_return");

const assessment = await detail(ids.assessment, manager.cookie);
assert("approaching assessment renders", assessment.journey.lifecycleStatus === "assessment_preparation" && assessment.assessment.status === "Preparing");
assert("manager readiness is visible", assessment.assessment.managerConfirmationStatus === "Awaiting confirmation");
assert("assessment private fields are excluded", !["assessmentContact", "assessmentReference", "assessmentNotes", "confirmations"].some((key) => key in assessment.assessment));

const inAssessment = await detail(ids.inAssessment, manager.cookie);
assert("in-assessment learner renders", inAssessment.journey.lifecycleStatus === "in_assessment" && inAssessment.assessment.status === "In assessment");

const noJourney = await detail(ids.noJourney, manager.cookie);
assert("no-journey employee has useful state", noJourney.employee.name === "Owen Blake" && noJourney.journey.hasActivity === false && noJourney.journey.stage === "No active apprenticeship journey");
assert("no-journey guidance is manager relevant", /development goals|progression options/i.test(noJourney.journey.nextExpectedStep));

for (const [label, id] of [
  ["same-department non-report", ids.sameDepartmentNonReport],
  ["another organisation", ids.anotherOrganisation],
  ["employee with no manager relationship", ids.noManager],
  ["manipulated learner-record ID", ids.learnerRecord],
  ["manipulated employee ID", "not-a-real-employee"],
]) {
  await expectSafeDenial(label, id, manager.cookie);
}
await expectSafeDenial("Employee copied direct-report link", ids.onTarget, employee.cookie);
await expectSafeDenial("cross-organisation user copied link", ids.onTarget, isolation.cookie);

const pageResponse = await fetch(`${baseUrl}/levytate/app/my-team/${ids.behind}`, { headers: { cookie: manager.cookie } });
const pageHtml = await pageResponse.text();
assert("authorised route returns the LevyTate detail page", pageResponse.status === 200 && pageHtml.includes("Cara Hughes"));
assert("read-only page includes responsive layout", pageHtml.includes("Manager support") && pageHtml.includes("Progress") && pageHtml.includes("Reviews and check-ins"));

const restrictedPage = await fetch(`${baseUrl}/levytate/app/my-team/${ids.sameDepartmentNonReport}`, { headers: { cookie: manager.cookie } });
const restrictedHtml = await restrictedPage.text();
assert("restricted route fails safely", restrictedPage.status === 404 && restrictedHtml.includes("This employee record could not be opened"));
assert("restricted route reveals no employee", !restrictedHtml.includes("Jules Mercer"));

const mutationResponse = await fetch(`${baseUrl}/api/levytate-manager-direct-reports/${ids.onTarget}`, { method: "POST", headers: { cookie: manager.cookie } });
assert("manager detail contract is read-only", mutationResponse.status === 405);

const leadLearners = await fetch(`${baseUrl}/api/levytate-learners`, { headers: { cookie: lead.cookie } });
assert("Apprenticeship Lead organisation learner access remains available", leadLearners.status === 200);
const adminLearners = await fetch(`${baseUrl}/api/levytate-learners`, { headers: { cookie: admin.cookie } });
assert("Platform Admin is denied employer learner access", adminLearners.status === 403);

const copilotBehind = await ask(manager.cookie, "Show me learners behind target.");
const learnerActions = (copilotBehind.structuredResult?.rows || []).flatMap((row) => row.actions || []);
assert("Copilot learner results deep-link to direct-report routes", learnerActions.length > 0 && learnerActions.every((action) => /^\/levytate\/app\/my-team\/gc-/.test(action.url)));

const copilotActions = await ask(manager.cookie, "What needs my attention today?");
const operationalActions = (copilotActions.structuredResult?.rows || []).flatMap((row) => row.actions || []);
assert("Copilot manager actions deep-link only to authorised records", operationalActions.every((action) => /^\/levytate\/app\/my-team\/gc-/.test(action.url) || /^\/levytate\/app\?module=Home&managerAction=/.test(action.url)));

const allDetails = [application, onTarget, behind, breakDetail, assessment, inAssessment, noJourney];
allDetails.forEach((item) => assertMinimised(item));
assert("manager-safe timelines contain no raw fields", allDetails.every((item) => item.timeline.every((event) => Object.keys(event).sort().join(",") === "date,event,summary")));

console.log(JSON.stringify({
  baseUrl,
  scenarios: {
    awaitingReview: application.employee.name,
    onTarget: onTarget.employee.name,
    behindTarget: behind.employee.name,
    overdueReview: behind.employee.name,
    breakInLearning: breakDetail.employee.name,
    approachingAssessment: assessment.employee.name,
    inAssessment: inAssessment.employee.name,
    noJourney: noJourney.employee.name,
    managerActions: behind.actions.length,
  },
  checksPassed: checks.length,
}, null, 2));

async function detail(employeeId, cookie) {
  const response = await fetch(`${baseUrl}/api/levytate-manager-direct-reports/${encodeURIComponent(employeeId)}`, { headers: { cookie } });
  const body = await safeJson(response);
  if (!response.ok) throw new Error(`Detail request failed (${response.status}): ${JSON.stringify(body)}`);
  return body.detail;
}

async function expectSafeDenial(label, employeeId, cookie) {
  const response = await fetch(`${baseUrl}/api/levytate-manager-direct-reports/${encodeURIComponent(employeeId)}`, { headers: { cookie } });
  const body = await safeJson(response);
  assert(`${label} is denied`, response.status === 404);
  assert(`${label} uses safe message`, body.error === "This employee record could not be opened.");
  assert(`${label} reveals no restricted detail`, Object.keys(body).sort().join(",") === "error");
}

async function ask(cookie, userMessage) {
  const response = await fetch(`${baseUrl}/api/levytate-ai`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie, "x-forwarded-for": "198.51.100.201" },
    body: JSON.stringify({ role: "Line Manager", userRole: "Line Manager", selectedSite: "All sites", currentSection: "LevyTate Copilot", userMessage, conversationHistory: [], employerContext: "Ground Control" }),
  });
  const body = await safeJson(response);
  if (!response.ok) throw new Error(`Copilot request failed (${response.status}): ${JSON.stringify(body)}`);
  return body;
}

function assertMinimised(detailValue) {
  const forbiddenKeys = new Set([
    "id", "organisationId", "learnerRecordId", "employeeId", "applicationId", "programmeId", "providerId", "enrolmentId",
    "email", "careerGoal", "managerNote", "reasonCategory", "reasonNotes", "eligibilityDeclaration",
    "preEnrolmentChecks", "withdrawal", "achievement", "assessmentContact", "assessmentReference", "assessmentNotes", "confirmations",
    "sourceReference", "updatedBy", "recordedBy", "metadata", "sourceKey", "activityVersion",
  ]);
  const found = [];
  visit(detailValue, (key) => { if (forbiddenKeys.has(key)) found.push(key); });
  assert(`field-level minimisation for ${detailValue.employee.name}`, found.length === 0);
  const serialised = JSON.stringify(detailValue);
  assert(`no raw infrastructure text for ${detailValue.employee.name}`, !/levytate_learner_|organisation_id|supabase|constraint|service.role/i.test(serialised));
}

function visit(value, callback) {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) return value.forEach((item) => visit(item, callback));
  Object.entries(value).forEach(([key, item]) => { callback(key); visit(item, callback); });
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
  return { cookie, body };
}

async function safeJson(response) {
  return response.json().catch(() => ({}));
}

function assert(label, condition) {
  if (!condition) throw new Error(`FAILED: ${label}`);
  checks.push(label);
}

async function loadRuntimeEnv() {
  const cwd = process.cwd();
  for (const fileName of [".env.vercel.local", ".env.production.vercel.local", ".env.local", ".env"]) {
    try {
      const content = await fs.readFile(path.join(cwd, fileName), "utf8");
      for (const rawLine of content.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line || line.startsWith("#")) continue;
        const index = line.indexOf("=");
        if (index < 0) continue;
        const key = line.slice(0, index).trim();
        const value = line.slice(index + 1).trim().replace(/^["']|["']$/g, "");
        if (key && value && !process.env[key]) process.env[key] = value;
      }
    } catch {
      // Optional local environment files are ignored.
    }
  }
}
