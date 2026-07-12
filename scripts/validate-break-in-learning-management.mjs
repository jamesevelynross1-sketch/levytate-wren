const baseUrl = (process.argv[2] ?? "http://localhost:3060").replace(/\/$/, "");
const betaCode = process.env.LEVYTATE_BETA_CODE || "LEVYTATE-BETA";
const today = dateOffset(0);
const startPast = dateOffset(-30);
const overdueReturn = dateOffset(-1);
const futureReturn = dateOffset(30);
const checks = [];
const ids = { active: "gc-lifecycle-record-on-track", cancel: "gc-lifecycle-record-behind-target", pre: "gc-lifecycle-record-pre-enrolment", terminal: "gc-lifecycle-record-achieved" };
const emails = { lead: "apprenticeshiplead.demo@levytate.test", employee: "employee.demo@levytate.test", manager: "manager.demo@levytate.test", isolation: "isolation.employee.demo@levytate.test" };

async function main() {
  const lead = await login("Apprenticeship Lead", emails.lead);
  const employee = await login("Employee", emails.employee);
  const manager = await login("Line Manager", emails.manager);
  const isolation = await login("Isolation employee", emails.isolation);
  let initial = await learner(lead.cookie, ids.active);
  if (initial.activeBreak?.id?.includes("op4b2c")) {
    await returnBreak(lead.cookie, ids.active, initial.activeBreak.id, returnInput(initial.activityVersion, `recovery-${Date.now()}`));
    initial = await learner(lead.cookie, ids.active);
  }
  const key = `op4b2c-${Date.now()}`;
  const start = startInput(initial.activityVersion, key);

  await expect("Employee start denied", () => postBreak(employee.cookie, ids.active, start), 403);
  await expect("Line Manager start denied", () => postBreak(manager.cookie, ids.active, start), 403);
  await expectAny("Cross-organisation start denied", () => postBreak(isolation.cookie, ids.active, start), [403, 404]);
  const pre = await learner(lead.cookie, ids.pre);
  await expect("Pre-enrolment start rejected", () => postBreak(lead.cookie, ids.pre, startInput(pre.activityVersion, `${key}-pre`)), 400);
  const terminal = await learner(lead.cookie, ids.terminal);
  await expect("Terminal start rejected", () => postBreak(lead.cookie, ids.terminal, startInput(terminal.activityVersion, `${key}-terminal`)), 400);
  await expect("Invalid reason rejected", () => postBreak(lead.cookie, ids.active, { ...start, reasonCategory: "holiday" }), 400);
  await expect("Expected return before start rejected", () => postBreak(lead.cookie, ids.active, { ...start, expectedReturnDate: dateOffset(-31) }), 400);
  await expect("Unknown return requires review date", () => postBreak(lead.cookie, ids.active, { ...start, idempotencyKey: `${key}-unknown`, expectedReturnUnknown: true, expectedReturnDate: "", reviewDate: "" }), 400);

  const started = await json(() => postBreak(lead.cookie, ids.active, start));
  assert("Break starts", started.response.status === 200 && started.body.created === true, started.body);
  assert("Lifecycle becomes break in learning", started.body.learner?.lifecycleStatus === "break_in_learning", started.body.learner);
  assert("Session actor is stored", started.body.record?.recordedBy === emails.lead, started.body.record);
  assert("Overdue return is derived", started.body.learner?.breakAttention?.state === "overdue" && started.body.learner?.attention?.label === "Return date overdue", started.body.learner?.breakAttention);
  const duplicateStart = await json(() => postBreak(lead.cookie, ids.active, start));
  assert("Duplicate start is idempotent", duplicateStart.response.status === 200 && duplicateStart.body.created === false, duplicateStart.body);
  await expect("Second active break rejected", () => postBreak(lead.cookie, ids.active, { ...start, idempotencyKey: `${key}-second`, expectedActivityVersion: started.body.learner.activityVersion }), 409);
  await expect("Normal progress blocked during break", () => postJson(lead.cookie, `/api/levytate-learners/${ids.active}/progress`, { expectedActivityVersion: started.body.learner.activityVersion, idempotencyKey: `${key}-progress`, updateDate: today, targetProgressPercentage: 50, actualProgressPercentage: 50, progressSource: "provider_report" }), 400);
  await expect("Provider review blocked during break", () => postJson(lead.cookie, `/api/levytate-learners/${ids.active}/reviews`, { expectedActivityVersion: started.body.learner.activityVersion, idempotencyKey: `${key}-provider`, reviewType: "provider_review", reviewDate: today, reviewerName: "Provider", providerId: started.body.learner.programme.providerId, status: "completed" }), 400);

  await expect("Stale break update rejected", () => patchBreak(lead.cookie, ids.active, started.body.record.id, { expectedActivityVersion: initial.activityVersion, expectedReturnDate: futureReturn, expectedReturnUnknown: false }), 409);
  const updated = await json(() => patchBreak(lead.cookie, ids.active, started.body.record.id, { expectedActivityVersion: started.body.learner.activityVersion, expectedReturnDate: futureReturn, expectedReturnUnknown: false, reviewDate: dateOffset(14), reasonNotes: "Temporary workload change with a controlled return plan.", providerNotified: true, providerNotifiedDate: today, employeeNotified: true, employeeNotifiedDate: today, managerNotified: true, managerNotifiedDate: today, returnPlanNotes: "Protected learning time will restart on return." }));
  assert("Active break update persists", updated.response.status === 200 && updated.body.record?.expectedReturnDate === futureReturn, updated.body);
  assert("Expected return change event created", eventCount(updated.body.learner, "break_expected_return_changed") >= 1, updated.body.learner?.lifecycleTimeline);
  await expect("Return confirmations enforced", () => returnBreak(lead.cookie, ids.active, started.body.record.id, returnInput(updated.body.learner.activityVersion, `${key}-return`, { providerReturnConfirmed: false })), 400);
  const returned = await json(() => returnBreak(lead.cookie, ids.active, started.body.record.id, returnInput(updated.body.learner.activityVersion, `${key}-return`)));
  assert("Learner returns to active learning", returned.response.status === 200 && returned.body.learner?.lifecycleStatus === "enrolled" && returned.body.record?.status === "returned", returned.body);
  assert("Return history retained", returned.body.learner?.breaksInLearning?.some((item) => item.id === started.body.record.id && item.status === "returned"), returned.body.learner?.breaksInLearning);
  const duplicateReturn = await json(() => returnBreak(lead.cookie, ids.active, started.body.record.id, returnInput(returned.body.learner.activityVersion, `${key}-return`)));
  assert("Duplicate return is idempotent", duplicateReturn.response.status === 200 && duplicateReturn.body.created === false, duplicateReturn.body);

  const cancelInitial = await learner(lead.cookie, ids.cancel);
  const cancelStarted = await json(() => postBreak(lead.cookie, ids.cancel, { ...startInput(cancelInitial.activityVersion, `${key}-cancel-start`), startDate: today, expectedReturnDate: futureReturn }));
  assert("Cancellation journey break starts", cancelStarted.response.status === 200, cancelStarted.body);
  const cancelled = await json(() => cancelBreak(lead.cookie, ids.cancel, cancelStarted.body.record.id, { expectedActivityVersion: cancelStarted.body.learner.activityVersion, idempotencyKey: `${key}-cancel`, cancellationReason: "Record entered against the wrong learner during validation." }));
  assert("Incorrect break is cancelled", cancelled.response.status === 200 && cancelled.body.record?.status === "cancelled" && cancelled.body.learner?.lifecycleStatus === "enrolled", cancelled.body);
  assert("Cancelled history remains", cancelled.body.learner?.breaksInLearning?.some((item) => item.id === cancelStarted.body.record.id && item.status === "cancelled"), cancelled.body.learner?.breaksInLearning);
  const duplicateCancel = await json(() => cancelBreak(lead.cookie, ids.cancel, cancelStarted.body.record.id, { expectedActivityVersion: cancelled.body.learner.activityVersion, idempotencyKey: `${key}-cancel`, cancellationReason: "Record entered against the wrong learner during validation." }));
  assert("Duplicate cancellation is idempotent", duplicateCancel.response.status === 200 && duplicateCancel.body.created === false, duplicateCancel.body);
  await expect("Cancelled break cannot be returned", () => returnBreak(lead.cookie, ids.cancel, cancelStarted.body.record.id, returnInput(cancelled.body.learner.activityVersion, `${key}-cancel-return`)), 400);

  const relogin = await login("Apprenticeship Lead relogin", emails.lead);
  const persistedReturn = await learner(relogin.cookie, ids.active);
  const persistedCancel = await learner(relogin.cookie, ids.cancel);
  assert("Returned break persists after relogin", persistedReturn.breaksInLearning.some((item) => item.id === started.body.record.id && item.status === "returned"), persistedReturn.breaksInLearning);
  assert("Cancelled break persists after relogin", persistedCancel.breaksInLearning.some((item) => item.id === cancelStarted.body.record.id && item.status === "cancelled"), persistedCancel.breaksInLearning);
  assert("Break start event persists", eventCount(persistedReturn, "break_started") >= 1, persistedReturn.lifecycleTimeline);
  assert("Return event persists", eventCount(persistedReturn, "returned_from_break") >= 1, persistedReturn.lifecycleTimeline);
  assert("Cancellation event persists", eventCount(persistedCancel, "break_cancelled") >= 1, persistedCancel.lifecycleTimeline);
  const history = await getJson(relogin.cookie, `/api/levytate-learners/${ids.active}/breaks`);
  assert("Break history endpoint uses Supabase", history.response.status === 200 && history.body.source === "supabase" && history.body.breakHistory?.length, history.body);
  console.log(JSON.stringify({ ok: true, baseUrl, summary: { passed: checks.length, failed: 0 }, checks }, null, 2));
}

function startInput(version, key) { return { expectedActivityVersion: version, idempotencyKey: key, startDate: startPast, expectedReturnDate: overdueReturn, expectedReturnUnknown: false, reviewDate: today, reasonCategory: "temporary_role_or_workload_change", reasonNotes: "Temporary workload change requires a controlled pause.", providerNotified: true, providerNotifiedDate: today, employeeNotified: true, employeeNotifiedDate: today, managerNotified: true, managerNotifiedDate: today, returnPlanNotes: "Confirm workload and protected learning time before return.", effectiveLifecycleDate: startPast }; }
function returnInput(version, key, overrides = {}) { return { expectedActivityVersion: version, idempotencyKey: key, actualReturnDate: today, returnConfirmationNote: "Return arrangements confirmed with all parties.", programmeStillValidConfirmed: true, providerReturnConfirmed: true, managerReturnConfirmed: true, learnerReturnConfirmed: true, revisedExpectedEndDate: dateOffset(365), revisedReviewDate: dateOffset(14), immediateSupportAction: "Protect learning time during the first month back.", progressResetNote: "Provider will rebaseline progress at the first review.", firstCheckInDate: dateOffset(7), ...overrides }; }
async function login(label, email) { const response = await fetch(`${baseUrl}/api/levytate-beta-login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, code: betaCode }) }); const body = await safe(response); assert(`${label} login accepted`, response.status === 200, body); const cookie = response.headers.get("set-cookie")?.split(";")[0] ?? ""; assert(`${label} session cookie set`, Boolean(cookie), body); return { cookie }; }
async function learner(cookie, id) { const result = await getJson(cookie, `/api/levytate-learners/${id}`); assert(`Learner ${id} loads`, result.response.status === 200 && result.body.learner, result.body); return result.body.learner; }
function postBreak(cookie, id, body) { return postJson(cookie, `/api/levytate-learners/${id}/breaks`, body); }
function patchBreak(cookie, id, breakId, body) { return request(cookie, `/api/levytate-learners/${id}/breaks/${breakId}`, { method: "PATCH", body: JSON.stringify(body) }); }
function returnBreak(cookie, id, breakId, body) { return postJson(cookie, `/api/levytate-learners/${id}/breaks/${breakId}/return`, body); }
function cancelBreak(cookie, id, breakId, body) { return postJson(cookie, `/api/levytate-learners/${id}/breaks/${breakId}/cancel`, body); }
function postJson(cookie, path, body) { return request(cookie, path, { method: "POST", body: JSON.stringify(body) }); }
function request(cookie, path, init = {}) { return fetch(`${baseUrl}${path}`, { ...init, headers: { "content-type": "application/json", cookie, ...(init.headers || {}) } }); }
async function getJson(cookie, path) { const response = await request(cookie, path); return { response, body: await safe(response) }; }
async function json(action) { const response = await action(); return { response, body: await safe(response) }; }
async function expect(label, action, status) { const response = await action(); assert(label, response.status === status, { expected: status, actual: response.status, body: await safe(response) }); }
async function expectAny(label, action, statuses) { const response = await action(); assert(label, statuses.includes(response.status), { expected: statuses, actual: response.status, body: await safe(response) }); }
function eventCount(learnerRecord, type) { return (learnerRecord.lifecycleTimeline || []).filter((event) => event.eventType === type).length; }
function dateOffset(days) { const value = new Date(); value.setUTCDate(value.getUTCDate() + days); return value.toISOString().slice(0, 10); }
async function safe(response) { try { return await response.clone().json(); } catch { return {}; } }
function assert(label, condition, detail) { checks.push({ label, ok: Boolean(condition) }); if (!condition) { console.error(`FAIL: ${label}`); if (detail !== undefined) console.error(JSON.stringify(detail, null, 2)); process.exit(1); } console.log(`PASS: ${label}`); }
main().catch((error) => { console.error(error); process.exitCode = 1; });
