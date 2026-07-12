const baseUrl = (process.argv[2] ?? "http://localhost:3060").replace(/\/$/, "");
const betaCode = process.env.LEVYTATE_BETA_CODE || "LEVYTATE-BETA";
const today = new Date().toISOString().slice(0, 10);
const futureDate = new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

const ids = {
  onTrack: "gc-lifecycle-record-on-track",
  behind: "gc-lifecycle-record-behind-target",
  break: "gc-lifecycle-record-break",
  preEnrolment: "gc-lifecycle-record-pre-enrolment",
  terminal: "gc-lifecycle-record-achieved",
};

const identities = {
  employee: "employee.demo@levytate.test",
  manager: "manager.demo@levytate.test",
  lead: "apprenticeshiplead.demo@levytate.test",
  isolation: "isolation.employee.demo@levytate.test",
};

const checks = [];

async function main() {
  const lead = await login("Apprenticeship Lead", identities.lead);
  const employee = await login("Employee", identities.employee);
  const manager = await login("Line Manager", identities.manager);
  const isolation = await login("Isolation employee", identities.isolation);

  const initialOnTrack = await getLearner(lead.cookie, ids.onTrack);
  const initialPreEnrolment = await getLearner(lead.cookie, ids.preEnrolment);
  const initialBreak = await getLearner(lead.cookie, ids.break);
  const initialTerminal = await getLearner(lead.cookie, ids.terminal);
  await expectStatus("Negative target is rejected", () => addProgress(lead.cookie, ids.onTrack, progressInput(initialOnTrack.activityVersion, "invalid-negative", -1, 20)), 400);
  await expectStatus("Actual progress above 100 is rejected", () => addProgress(lead.cookie, ids.onTrack, progressInput(initialOnTrack.activityVersion, "invalid-high", 20, 101)), 400);
  await expectStatus("Invalid progress source is rejected", () => addProgress(lead.cookie, ids.onTrack, { ...progressInput(initialOnTrack.activityVersion, "invalid-source", 20, 20), progressSource: "spreadsheet_magic" }), 400);
  await expectStatus("Implausibly future-dated progress is rejected", () => addProgress(lead.cookie, ids.onTrack, { ...progressInput(initialOnTrack.activityVersion, "invalid-future", 20, 20), updateDate: futureDate }), 400);
  await expectStatus("Pre-enrolment progress is rejected", () => addProgress(lead.cookie, ids.preEnrolment, progressInput(initialPreEnrolment.activityVersion, "invalid-pre-enrolment", 20, 20)), 400);
  await expectStatus("Break-in-learning normal progress is rejected", () => addProgress(lead.cookie, ids.break, progressInput(initialBreak.activityVersion, "invalid-break", 20, 20)), 400);
  await expectStatus("Terminal learner progress is rejected", () => addProgress(lead.cookie, ids.terminal, progressInput(initialTerminal.activityVersion, "invalid-terminal", 100, 100)), 400);
  await expectStatus("Employee cannot add progress", () => addProgress(employee.cookie, ids.onTrack, progressInput(initialOnTrack.activityVersion, "employee-denied", 40, 42)), 403);
  await expectStatus("Line Manager cannot add progress", () => addProgress(manager.cookie, ids.onTrack, progressInput(initialOnTrack.activityVersion, "manager-denied", 40, 42)), 403);
  await expectStatuses("Cross-organisation progress write fails safely", () => addProgress(isolation.cookie, ids.onTrack, progressInput(initialOnTrack.activityVersion, "isolation-denied", 40, 42)), [403, 404]);

  const onTrackPayload = progressInput(initialOnTrack.activityVersion, "op4b2b-on-track-v1", 40, 42, {
    summary: "Learner is applying reporting skills consistently in operational planning.",
    supportAction: "No support required",
  });
  const onTrackResult = await postJson(() => addProgress(lead.cookie, ids.onTrack, onTrackPayload));
  assert("On-track progress saves", onTrackResult.response.status === 200 && onTrackResult.body.created === true, onTrackResult.body);
  assert("Variance is server-derived as +2", onTrackResult.body.record?.variancePercentage === 2, onTrackResult.body.record);
  assert("Progress position is On target", onTrackResult.body.learner?.progressPosition === "On target", onTrackResult.body.learner);
  assert("Session actor is stored", onTrackResult.body.record?.updatedBy === identities.lead, onTrackResult.body.record);

  const duplicateProgress = await postJson(() => addProgress(lead.cookie, ids.onTrack, onTrackPayload));
  assert("Duplicate progress retry is idempotent", duplicateProgress.response.status === 200 && duplicateProgress.body.created === false, duplicateProgress.body);
  await expectStatus("Stale progress form is rejected", () => addProgress(lead.cookie, ids.onTrack, progressInput(initialOnTrack.activityVersion, "op4b2b-stale-v1", 43, 44)), 409);

  const afterProgress = onTrackResult.body.learner;
  await expectStatus("Invalid review type is rejected", () => addReview(lead.cookie, ids.onTrack, reviewInput(afterProgress.activityVersion, "invalid-review-type", { reviewType: "provider_sales_call" })), 400);
  await expectStatus("Invalid provider is rejected", () => addReview(lead.cookie, ids.onTrack, reviewInput(afterProgress.activityVersion, "invalid-provider", { providerId: "provider-not-in-workspace" })), 400);
  await expectStatus("Cancelled review requires a reason", () => addReview(lead.cookie, ids.onTrack, reviewInput(afterProgress.activityVersion, "invalid-cancelled", { status: "cancelled", summary: "", supportRequired: "" })), 400);
  await expectStatus("Action-required review needs actions or support", () => addReview(lead.cookie, ids.onTrack, reviewInput(afterProgress.activityVersion, "invalid-action", { status: "action_required", actions: [], supportRequired: "" })), 400);
  await expectStatus("Employee cannot add reviews", () => addReview(employee.cookie, ids.onTrack, reviewInput(afterProgress.activityVersion, "employee-review-denied")), 403);
  await expectStatus("Line Manager cannot add reviews", () => addReview(manager.cookie, ids.onTrack, reviewInput(afterProgress.activityVersion, "manager-review-denied")), 403);

  const providerReviewPayload = reviewInput(afterProgress.activityVersion, "op4b2b-provider-overdue-v1", {
    reviewDate: today,
    nextReviewDate: "2026-07-10",
    summary: "Provider confirmed good engagement and agreed the next evidence milestone.",
    actions: ["Confirm the next reporting project"],
  });
  const providerReviewResult = await postJson(() => addReview(lead.cookie, ids.onTrack, providerReviewPayload));
  assert("Provider review saves", providerReviewResult.response.status === 200 && providerReviewResult.body.created === true, providerReviewResult.body);
  assert("Provider defaults from learner record", providerReviewResult.body.record?.providerId === initialOnTrack.programme.providerId, providerReviewResult.body.record);
  assert("Provider review overdue is derived", providerReviewResult.body.learner?.reviewSummaries?.provider?.overdue === true, providerReviewResult.body.learner?.reviewSummaries);
  assert("Provider review becomes next key action", providerReviewResult.body.learner?.attention?.label === "Provider review overdue", providerReviewResult.body.learner?.attention);

  const duplicateReview = await postJson(() => addReview(lead.cookie, ids.onTrack, providerReviewPayload));
  assert("Duplicate review retry is idempotent", duplicateReview.response.status === 200 && duplicateReview.body.created === false, duplicateReview.body);

  const initialBehind = await getLearner(lead.cookie, ids.behind);
  const behindResult = await postJson(() => addProgress(lead.cookie, ids.behind, progressInput(initialBehind.activityVersion, "op4b2b-behind-v1", 62, 54, {
    summary: "Evidence completion has slowed because workplace project access is limited.",
    supportAction: "Manager support required: agree protected project time",
  })));
  assert("Behind-target progress saves", behindResult.response.status === 200 && behindResult.body.created === true, behindResult.body);
  assert("Variance is server-derived as -8", behindResult.body.record?.variancePercentage === -8, behindResult.body.record);
  assert("Significantly behind position is derived", behindResult.body.learner?.progressPosition === "Significantly behind", behindResult.body.learner);
  assert("Behind-target learner is prioritised", behindResult.body.learner?.attention?.label === "Significantly behind target", behindResult.body.learner?.attention);

  const lAndDResult = await postJson(() => addReview(lead.cookie, ids.behind, reviewInput(behindResult.body.learner.activityVersion, "op4b2b-landd-v1", {
    reviewType: "l_and_d_check_in",
    reviewerName: "Priya Shah",
    providerId: "",
    status: "action_required",
    summary: "L&D reviewed the progress gap and agreed a short recovery plan.",
    actions: ["Book manager recovery meeting", "Confirm protected project time"],
    supportRequired: "Manager and L&D support required for the next evidence milestone.",
  })));
  assert("L&D check-in saves", lAndDResult.response.status === 200 && lAndDResult.body.record?.reviewType === "l_and_d_check_in", lAndDResult.body);
  assert("Review action is visible", lAndDResult.body.learner?.attention?.reasons?.includes("Review action outstanding"), lAndDResult.body.learner?.attention);

  const managerResult = await postJson(() => addReview(lead.cookie, ids.onTrack, reviewInput(providerReviewResult.body.learner.activityVersion, "op4b2b-manager-v1", {
    reviewType: "manager_check_in",
    reviewerName: initialOnTrack.learner.managerName,
    providerId: "",
    summary: "Manager confirmed the learner is applying reporting skills in live work.",
    actions: ["Continue monthly workplace evidence review"],
  })));
  assert("Manager check-in saves", managerResult.response.status === 200 && managerResult.body.record?.reviewType === "manager_check_in", managerResult.body);

  const breakReview = await postJson(() => addReview(lead.cookie, ids.break, reviewInput(initialBreak.activityVersion, "op4b2b-break-support-v1", {
    reviewType: "other",
    reviewerName: "Priya Shah",
    providerId: "",
    summary: "Historical support note recorded while the learner remains on an agreed break.",
  })));
  assert("Support review can be recorded during a break", breakReview.response.status === 200, breakReview.body);
  await expectStatus("Terminal learner review is rejected", () => addReview(lead.cookie, ids.terminal, reviewInput(initialTerminal.activityVersion, "terminal-review-denied")), 400);

  const reloggedLead = await login("Apprenticeship Lead relogin", identities.lead);
  const persistedOnTrack = await getLearner(reloggedLead.cookie, ids.onTrack);
  const persistedBehind = await getLearner(reloggedLead.cookie, ids.behind);
  assert("Progress history persists after re-login", persistedOnTrack.progressHistory.some((item) => item.id.includes("op4b2b-on-track-v1")), persistedOnTrack.progressHistory);
  assert("Review history persists after re-login", persistedOnTrack.reviewHistory.some((item) => item.id.includes("op4b2b-provider-overdue-v1")), persistedOnTrack.reviewHistory);
  assert("Latest provider summary persists", persistedOnTrack.reviewSummaries.provider.latest?.id.includes("op4b2b-provider-overdue-v1"), persistedOnTrack.reviewSummaries.provider);
  assert("Latest manager summary derives correctly", persistedOnTrack.reviewSummaries.manager.latest?.id.includes("op4b2b-manager-v1"), persistedOnTrack.reviewSummaries.manager);
  assert("Latest L&D summary derives correctly", persistedBehind.reviewSummaries.lAndD.latest?.id.includes("op4b2b-landd-v1"), persistedBehind.reviewSummaries.lAndD);
  assert("Progress lifecycle event persists once", eventCount(persistedOnTrack, "progress_updated") >= 1, persistedOnTrack.lifecycleTimeline);
  assert("Provider review event persists", eventCount(persistedOnTrack, "provider_review_recorded") >= 1, persistedOnTrack.lifecycleTimeline);
  assert("L&D check-in event persists", eventCount(persistedBehind, "l_and_d_check_in_recorded") >= 1, persistedBehind.lifecycleTimeline);
  assert("Manager check-in event persists", eventCount(persistedOnTrack, "manager_check_in_recorded") >= 1, persistedOnTrack.lifecycleTimeline);
  assert("Behind-target event persists", eventCount(persistedBehind, "learner_identified_behind_target") >= 1, persistedBehind.lifecycleTimeline);

  const progressHistory = await getJson(reloggedLead.cookie, `/api/levytate-learners/${ids.onTrack}/progress`);
  const reviewHistory = await getJson(reloggedLead.cookie, `/api/levytate-learners/${ids.onTrack}/reviews`);
  assert("Progress history endpoint returns persisted history", progressHistory.response.status === 200 && progressHistory.body.progress?.length >= 2, progressHistory.body);
  assert("Review history endpoint returns persisted history", reviewHistory.response.status === 200 && reviewHistory.body.reviews?.length >= 3, reviewHistory.body);

  console.log(JSON.stringify({ ok: true, baseUrl, summary: { passed: checks.length, failed: 0 }, checks }, null, 2));
}

function progressInput(activityVersion, idempotencyKey, target, actual, overrides = {}) {
  return { expectedActivityVersion: activityVersion, idempotencyKey, updateDate: today, targetProgressPercentage: target, actualProgressPercentage: actual, progressSource: "provider_report", sourceReference: "Operational Sprint 4B.2B validation", summary: "Progress validation update.", supportAction: "No support required", ...overrides };
}

function reviewInput(activityVersion, idempotencyKey, overrides = {}) {
  return { expectedActivityVersion: activityVersion, idempotencyKey, reviewType: "provider_review", reviewDate: today, nextReviewDate: "", reviewerName: "Provider Skills Coach", providerId: "provider-qa", summary: "Review validation record.", actions: [], supportRequired: "", status: "completed", ...overrides };
}

async function login(label, email) {
  const response = await fetch(`${baseUrl}/api/levytate-beta-login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, code: betaCode }) });
  const body = await safeJson(response);
  assert(`${label} login accepted`, response.status === 200, body);
  const cookie = response.headers.get("set-cookie")?.split(";")[0] ?? "";
  assert(`${label} session cookie set`, Boolean(cookie), body);
  return { cookie, body };
}

async function getLearner(cookie, learnerRecordId) {
  const response = await request(`/api/levytate-learners/${encodeURIComponent(learnerRecordId)}`, cookie);
  const body = await safeJson(response);
  assert(`Learner ${learnerRecordId} loads`, response.status === 200 && body.learner, body);
  return body.learner;
}

function addProgress(cookie, learnerRecordId, body) { return request(`/api/levytate-learners/${encodeURIComponent(learnerRecordId)}/progress`, cookie, { method: "POST", body: JSON.stringify(body) }); }
function addReview(cookie, learnerRecordId, body) { return request(`/api/levytate-learners/${encodeURIComponent(learnerRecordId)}/reviews`, cookie, { method: "POST", body: JSON.stringify(body) }); }
function request(path, cookie, init = {}) { return fetch(`${baseUrl}${path}`, { ...init, headers: { "content-type": "application/json", cookie, ...(init.headers ?? {}) } }); }
async function postJson(action) { const response = await action(); return { response, body: await safeJson(response) }; }
async function getJson(cookie, path) { const response = await request(path, cookie); return { response, body: await safeJson(response) }; }
async function expectStatus(label, action, status) { const response = await action(); assert(label, response.status === status, { expected: status, actual: response.status, body: await safeJson(response) }); }
async function expectStatuses(label, action, statuses) { const response = await action(); assert(label, statuses.includes(response.status), { expected: statuses, actual: response.status, body: await safeJson(response) }); }
function eventCount(learner, type) { return (learner.lifecycleTimeline ?? []).filter((event) => event.eventType === type).length; }
async function safeJson(response) { try { return await response.clone().json(); } catch { return {}; } }
function assert(label, condition, detail) { checks.push({ label, ok: Boolean(condition) }); if (!condition) { console.error(`FAIL: ${label}`); if (detail !== undefined) console.error(JSON.stringify(detail, null, 2)); process.exit(1); } console.log(`PASS: ${label}`); }

main().catch((error) => { console.error(error); process.exitCode = 1; });
