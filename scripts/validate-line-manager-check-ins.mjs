import fs from "node:fs/promises";
import path from "node:path";

await loadRuntimeEnv();

const baseUrl = (process.argv.find((value) => value.startsWith("http")) || process.env.LEVYTATE_BASE_URL || "http://localhost:3025").replace(/\/$/, "");
const betaCode = process.env.LEVYTATE_BETA_CODE || "LEVYTATE-BETA";
const checks = [];

const manager = await login("manager.demo@levytate.test", "198.51.100.221");
const employee = await login("employee.demo@levytate.test", "198.51.100.222");
const lead = await login("apprenticeshiplead.demo@levytate.test", "198.51.100.223");
const isolation = await login("isolation.employee.demo@levytate.test", "198.51.100.224");

const ids = {
  routine: "gc-lifecycle-employee-ben",
  behind: "gc-lifecycle-employee-cara",
  break: "gc-lifecycle-employee-daniel",
  assessment: "gc-lifecycle-employee-finley",
  terminal: "gc-lifecycle-employee-harry",
  nonReport: "gc-lifecycle-employee-jules",
  crossOrganisation: "isolation-employee-isla",
  learnerRecord: "gc-lifecycle-record-on-track",
};

const before = await detail(ids.routine, manager.cookie);
assert("direct-report record exposes one manager check-in entry point", before.managerCheckIn.canRecord === true && before.managerCheckIn.destination.endsWith("?action=manager-check-in"));
assert("form concurrency version is present without raw lifecycle IDs", Boolean(before.managerCheckIn.formVersion));
const managerEventCountBefore = before.timeline.filter((event) => event.event === "Manager check-in recorded").length;
const routineControlledBoundaryBefore = controlledBoundary(before);

const checkInDate = today();
const nextDate = addDays(checkInDate, 30);
const routinePayload = payload({
  idempotencyKey: "ops7c2-ben-routine-v2",
  expectedActivityVersion: before.managerCheckIn.formVersion,
  checkInDate,
  nextCheckInDate: nextDate,
  discussionPurpose: "routine_progress",
  workplaceApplication: "applying_effectively",
  learningApplied: "Ben is using reporting techniques to improve the weekly regional performance pack.",
  workplaceOpportunityAvailable: "Ben will continue presenting insight at the weekly operations review.",
  supportAvailable: ["manager_feedback", "systems_or_data"],
  concerns: [{ type: "no_current_concern", detail: "" }],
  agreedActions: [{ description: "Present the updated report at the next operations review", responsibleParty: "employee", targetDate: addDays(checkInDate, 7) }],
  supportRequired: ["no_additional_support"],
  status: "completed",
  note: "Operational Sprint 7C.2 no-concern validation.",
});

const first = await postCheckIn(ids.routine, manager.cookie, routinePayload);
assert("valid manager check-in is persisted", first.status === 200 && first.body.record?.reviewType === "manager_check_in");
assert("response is refreshed from Supabase", first.body.source === "supabase" && first.body.detail?.reviews?.latest?.manager?.managerCheckIn?.discussionPurpose === "routine_progress");

const retry = await postCheckIn(ids.routine, manager.cookie, routinePayload);
assert("duplicate submission is idempotent", retry.status === 200 && retry.body.created === false && retry.body.record?.reviewDate === checkInDate);
const after = retry.body.detail;
const matchingReviews = after.reviews.history.filter((review) => review.managerCheckIn?.note === "Operational Sprint 7C.2 no-concern validation." && review.date === checkInDate && review.reviewerName === "Morgan Price");
assert("one structured check-in exists after retry", matchingReviews.length === 1);
assert("structured history contains workplace support and agreed action", matchingReviews[0].managerCheckIn.learningApplied.includes("weekly regional performance pack") && matchingReviews[0].managerCheckIn.agreedActions.length === 1);
assert("manager-support summary refreshes", /Manager check-in completed on/i.test(after.managerSupport.title) && after.managerSupport.whyItMatters.includes("next agreed check-in"));
assert("routine check-in does not mutate progress, lifecycle, provider, L&D or unrelated actions", controlledBoundary(after) === routineControlledBoundaryBefore);
const managerEventCountAfter = after.timeline.filter((event) => event.event === "Manager check-in recorded").length;
assert("retry does not duplicate the readable lifecycle event", managerEventCountAfter === managerEventCountBefore + (first.body.created ? 1 : 0));

const behind = await detail(ids.behind, manager.cookie);
const behindControlledBoundaryBefore = controlledBoundary(behind);
const behindResult = await postCheckIn(ids.behind, manager.cookie, payload({
  idempotencyKey: "ops7c2-cara-behind-v1",
  expectedActivityVersion: behind.managerCheckIn.formVersion,
  checkInDate,
  nextCheckInDate: nextDate,
  discussionPurpose: "behind_target_support",
  workplaceApplication: "opportunity_required",
  learningApplied: "Cara has started applying data visualisation techniques to planning reports.",
  workplaceOpportunityNeeded: "A protected planning improvement task is required to build evidence.",
  supportAvailable: ["protected_learning_time", "manager_feedback"],
  concerns: [{ type: "progress_concern", detail: "Current evidence remains behind the agreed plan." }],
  agreedActions: [{ description: "Allocate a protected planning improvement task", responsibleParty: "line_manager", targetDate: addDays(checkInDate, 7) }],
  supportRequired: ["workplace_opportunity_required", "line_manager_support"],
  supportRequiredDetail: "",
  actionRequiredReason: "Workplace evidence and progress recovery need active manager support.",
  status: "action_required",
}));
assert("behind-target check-in records action required", behindResult.status === 200 && behindResult.body.record.status === "action_required");
assert("outstanding support remains explicit", /workplace support is still required/i.test(behindResult.body.detail.managerSupport.title));
assert("action-required check-in only synchronises manager check-in conditions", controlledBoundary(behindResult.body.detail) === behindControlledBoundaryBefore);

for (const [label, employeeId, purpose] of [
  ["Break in Learning", ids.break, "return_to_learning"],
  ["assessment preparation", ids.assessment, "assessment_readiness"],
]) {
  const record = await detail(employeeId, manager.cookie);
  const result = await postCheckIn(employeeId, manager.cookie, payload({
    idempotencyKey: `ops7c2-${purpose}-v1`, expectedActivityVersion: record.managerCheckIn.formVersion,
    checkInDate, nextCheckInDate: nextDate, discussionPurpose: purpose,
    workplaceApplication: "some_application", learningApplied: `${label} workplace support was reviewed.`,
    workplaceOpportunityAvailable: "The manager confirmed suitable workplace support is available.",
    supportAvailable: ["manager_feedback", "coaching_or_mentoring"], concerns: [{ type: "no_current_concern", detail: "" }],
    agreedActions: [{ description: "Continue the agreed workplace support", responsibleParty: "shared", targetDate: addDays(checkInDate, 7) }],
    supportRequired: ["no_additional_support"], status: "completed",
  }));
  assert(`${label} check-in persists without changing formal lifecycle state`, result.status === 200 && result.body.detail.journey.lifecycleStatus === record.journey.lifecycleStatus);
}

const terminalAttempt = await postCheckIn(ids.terminal, manager.cookie, payload({ idempotencyKey: "ops7c2-terminal-v1", checkInDate }));
assert("another manager's terminal learner remains outside scope", terminalAttempt.status === 403);

const invalidDate = await postCheckIn(ids.routine, manager.cookie, payload({ idempotencyKey: "ops7c2-invalid-date-v1", checkInDate, nextCheckInDate: checkInDate }));
assert("invalid next check-in date is rejected", invalidDate.status === 400 && /must be after/i.test(invalidDate.body.message));
const invalidEnum = await postCheckIn(ids.routine, manager.cookie, { ...routinePayload, idempotencyKey: "ops7c2-invalid-enum-v1", expectedActivityVersion: "", discussionPurpose: "provider_review" });
assert("invalid controlled value is rejected", invalidEnum.status === 400 && /Invalid discussion purpose/i.test(invalidEnum.body.message));
const staleVersion = await postCheckIn(ids.routine, manager.cookie, { ...routinePayload, idempotencyKey: "ops7c2-stale-v1", expectedActivityVersion: "stale-version" });
assert("stale activity version fails safely", staleVersion.status === 409 && !JSON.stringify(staleVersion.body).match(/supabase|constraint|organisation_id/i));

for (const [label, employeeId, cookie] of [
  ["same-department non-report", ids.nonReport, manager.cookie],
  ["cross-organisation employee", ids.crossOrganisation, manager.cookie],
  ["Employee mutation", ids.routine, employee.cookie],
  ["cross-organisation signed user", ids.routine, isolation.cookie],
  ["manipulated learner-record ID", ids.learnerRecord, manager.cookie],
]) {
  const result = await postCheckIn(employeeId, cookie, payload({ idempotencyKey: `ops7c2-denial-${checks.length}`, checkInDate }));
  assert(`${label} is denied without record disclosure`, [403, 401].includes(result.status) && !JSON.stringify(result.body).match(/Cara|Ben|learner-record|organisation_id|supabase/i));
}

const managerGenericReview = await fetch(`${baseUrl}/api/levytate-learners/${ids.learnerRecord}/reviews`, { method: "POST", headers: { "content-type": "application/json", cookie: manager.cookie }, body: JSON.stringify({}) });
assert("Line Manager did not gain generic review mutation", managerGenericReview.status === 403);
const managerGenericProgress = await fetch(`${baseUrl}/api/levytate-learners/${ids.learnerRecord}/progress`, { method: "POST", headers: { "content-type": "application/json", cookie: manager.cookie }, body: JSON.stringify({}) });
assert("Line Manager did not gain progress mutation", managerGenericProgress.status === 403);
const managerLifecycleTransition = await fetch(`${baseUrl}/api/levytate-learners/${ids.learnerRecord}/assessment-preparation`, { method: "POST", headers: { "content-type": "application/json", cookie: manager.cookie }, body: JSON.stringify({ idempotencyKey: "ops7c2-denied-lifecycle" }) });
assert("Line Manager did not gain lifecycle transition mutation", managerLifecycleTransition.status === 403);
const leadRead = await fetch(`${baseUrl}/api/levytate-learners/${ids.learnerRecord}/reviews`, { headers: { cookie: lead.cookie } });
assert("Apprenticeship Lead review visibility remains available", leadRead.status === 200);

const copilot = await ask(manager.cookie, "Who needs a manager check-in?");
const copilotRows = copilot.structuredResult?.rows || [];
const copilotActions = copilotRows.flatMap((row) => row.actions || []);
assert("Copilot exposes authorised check-in deep links", copilotActions.some((action) => action.label === "Record manager check-in" && /\/levytate\/app\/my-team\/gc-.*\?action=manager-check-in$/.test(action.url)));
assert("resolved no-concern check-in is absent from current due results", !copilotRows.some((row) => row.cells?.learner === "Ben Marshall"));

const page = await fetch(`${baseUrl}${after.managerCheckIn.destination}`, { headers: { cookie: manager.cookie } });
const pageHtml = await page.text();
assert("refresh-safe check-in deep link renders the authorised form contract", page.status === 200 && pageHtml.includes("Ben Marshall"));

const domainContract = await fs.readFile(path.join(process.cwd(), "lib/levytate/mvp/manager-check-in.ts"), "utf8");
const serverContract = await fs.readFile(path.join(process.cwd(), "lib/server/levytate-manager-check-ins.ts"), "utf8");
const copilotContract = await fs.readFile(path.join(process.cwd(), "lib/server/levytate-copilot-tools.ts"), "utf8");
assert("terminal lifecycle states are excluded centrally", !/managerCheckInEligibleLifecycleStatuses[\s\S]*withdrawn[\s\S]*achieved/.test(domainContract));
assert("direct-report scope is re-resolved before every write", serverContract.indexOf("authorisedScope(session, employeeId)") < serverContract.indexOf("supabaseInsert<ManagerReviewRow>"));
assert("check-in persistence cannot complete general operational actions", !serverContract.includes("completeOperationalAction") && serverContract.includes("resolveManagerCheckInActionsForDirectReport"));
assert("Copilot remains navigation-only for manager check-ins", !copilotContract.includes("recordManagerDirectReportCheckIn"));

console.log(JSON.stringify({
  baseUrl,
  source: "supabase",
  directReport: after.employee.name,
  behindTarget: behindResult.body.detail.employee.name,
  checkInDate,
  checksPassed: checks.length,
}, null, 2));

function payload(overrides = {}) {
  return {
    idempotencyKey: "ops7c2-default-v1",
    expectedActivityVersion: "",
    checkInDate: today(),
    nextCheckInDate: addDays(today(), 14),
    discussionPurpose: "routine_progress",
    discussionPurposeDetail: "",
    workplaceApplication: "some_application",
    learningApplied: "Learning application was discussed.",
    workplaceOpportunityAvailable: "A suitable workplace task is available.",
    workplaceOpportunityNeeded: "",
    workplaceApplicationNote: "",
    supportAvailable: ["manager_feedback"],
    supportAvailableOtherDetail: "",
    concerns: [{ type: "no_current_concern", detail: "" }],
    agreedActions: [],
    supportRequired: ["no_additional_support"],
    supportRequiredDetail: "",
    actionRequiredReason: "",
    note: "",
    status: "completed",
    ...overrides,
  };
}

async function detail(employeeId, cookie) {
  const response = await fetch(`${baseUrl}/api/levytate-manager-direct-reports/${encodeURIComponent(employeeId)}`, { headers: { cookie } });
  const body = await safeJson(response);
  if (!response.ok) throw new Error(`Detail request failed (${response.status}): ${JSON.stringify(body)}`);
  return body.detail;
}

async function postCheckIn(employeeId, cookie, body) {
  const response = await fetch(`${baseUrl}/api/levytate-manager/direct-reports/${encodeURIComponent(employeeId)}/check-ins`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify(body),
  });
  return { status: response.status, body: await safeJson(response) };
}

async function ask(cookie, userMessage) {
  const response = await fetch(`${baseUrl}/api/levytate-ai`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie, "x-forwarded-for": "198.51.100.221" },
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
  return { cookie, body };
}

function today() { return new Date().toISOString().slice(0, 10); }
function addDays(value, days) { const date = new Date(`${value}T12:00:00Z`); date.setUTCDate(date.getUTCDate() + days); return date.toISOString().slice(0, 10); }
async function safeJson(response) { return response.json().catch(() => ({})); }
function assert(label, condition) { if (!condition) throw new Error(`FAILED: ${label}`); checks.push(label); }

function controlledBoundary(detail) {
  return JSON.stringify({
    application: detail.application,
    journey: detail.journey,
    progress: detail.progress,
    providerReviews: detail.reviews.history.filter((review) => review.type === "provider_review"),
    lAndDReviews: detail.reviews.history.filter((review) => review.type === "l_and_d_check_in"),
    breakInLearning: detail.breakInLearning,
    assessment: detail.assessment,
    unrelatedActions: detail.actions.filter((action) => !(action.owner === "Line Manager" && /manager check-in/i.test(`${action.title} ${action.reason}`))),
  });
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
