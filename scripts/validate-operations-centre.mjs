const baseUrl = (process.argv[2] ?? "http://localhost:3060").replace(/\/$/, "");
const betaCode = process.env.LEVYTATE_BETA_CODE || "LEVYTATE-BETA";
const checks = [];

async function main() {
  const leadCookie = await login("apprenticeshiplead.demo@levytate.test");
  const response = await authedFetch("/api/levytate-operations?synchronise=true", leadCookie);
  const body = await safeJson(response);
  check("Apprenticeship Lead can read Operations Centre", response.status === 200, body);
  check("Operations source is live Supabase", body.source === "supabase", body);
  const readyToEnrol = body.queues?.ready_to_enrol ?? [];
  const readyLearners = new Set(readyToEnrol.map((item) => item.learnerRecordId));
  check(
    "Ready-to-enrol summary matches current lifecycle conditions",
    body.summary?.readyToEnrol === readyLearners.size
      && readyToEnrol.every((item) => item.actionType === "complete_enrolment" && item.sourceCondition === "ready_to_enrol"),
    { summary: body.summary, readyToEnrol },
  );
  check("HR blocker is visible for Avery Collins", body.queues?.pre_enrolment?.some((item) => item.learnerName === "Avery Collins" && item.ownerType === "HR" && /HR approval/i.test(item.reason)), body.queues?.pre_enrolment);
  check("Significantly behind learner is prioritised", body.queues?.urgent?.some((item) => item.learnerName === "Cara Hughes" && item.priorityLevel === "High"), body.queues?.urgent);
  check("Provider review overdue is visible", body.queues?.reviews?.some((item) => item.learnerName === "Cara Hughes" && item.reviewType === "Provider review" && item.dueStatus === "Overdue"), body.queues?.reviews);
  check("L&D check-in overdue is visible", body.queues?.reviews?.some((item) => item.learnerName === "Cara Hughes" && item.reviewType === "L&D check-in" && item.dueStatus === "Overdue"), body.queues?.reviews);
  check("Active break and overdue return are visible", body.queues?.breaks?.some((item) => item.learnerName === "Daniel Frost" && item.actionType === "return_learner") && body.queues?.urgent?.some((item) => item.learnerName === "Daniel Frost" && item.priorityLevel === "Critical"), body.queues?.breaks);
  const benResponse = await getJson("/api/levytate-learners/gc-lifecycle-record-on-track", leadCookie);
  const ben = benResponse.body.learner;
  const reviewAfterReturn = ben?.reviewHistory?.some((review) => review.reviewType !== "provider_review" && review.reviewDate >= ben.latestBreak?.actualReturnDate);
  const postReturnActionVisible = body.queues?.breaks?.some((item) => item.learnerName === "Ben Marshall" && /Post-return review/i.test(item.reason));
  check("Post-return review reflects current review history", reviewAfterReturn ? !postReturnActionVisible : postReturnActionVisible, { reviewAfterReturn, queues: body.queues?.breaks });
  check("Recent activity is bounded and meaningful", Array.isArray(body.recentActivity) && body.recentActivity.length <= 12 && body.recentActivity.every((item) => item.learnerName && item.action && item.eventDate), body.recentActivity);
  check("Urgent queue is priority ordered", isPriorityOrdered(body.queues?.urgent ?? []), body.queues?.urgent);
  check("Operational items contain the server contract", Object.values(body.queues ?? {}).flat().every((item) => ["priorityLevel", "priorityRank", "reason", "dueDate", "daysOverdue", "ownerType", "actionType", "actionUrl", "sourceKey", "sourceCondition", "persistentActionId", "persistentActionStatus"].every((key) => key in item)), body.queues);
  check("Operational response does not expose sensitive break notes", !JSON.stringify(body).includes("Temporary break while operational cover is stabilised"), body.queues?.breaks);
  check("Every primary action links to an existing learner workflow", Object.values(body.queues ?? {}).flat().every((item) => item.actionUrl?.startsWith("/levytate/app?module=Learners&learner=")), body.queues);

  const priorityFiltered = await getJson("/api/levytate-operations?priority=Critical", leadCookie);
  check("Priority filter is server-side", Object.values(priorityFiltered.body.queues ?? {}).flat().every((item) => item.priorityLevel === "Critical"), priorityFiltered.body);
  const queueFiltered = await getJson("/api/levytate-operations?queue=ready_to_enrol", leadCookie);
  check("Queue filter is server-side", Object.entries(queueFiltered.body.queues ?? {}).every(([key, items]) => key === "ready_to_enrol" || items.length === 0), queueFiltered.body);
  const ownerFiltered = await getJson("/api/levytate-operations?owner=HR", leadCookie);
  check("Owner filter is server-side", Object.values(ownerFiltered.body.queues ?? {}).flat().every((item) => item.ownerType === "HR"), ownerFiltered.body);
  const searchFiltered = await getJson("/api/levytate-operations?search=Cara%20Hughes", leadCookie);
  check("Learner search is server-side", Object.values(searchFiltered.body.queues ?? {}).flat().every((item) => item.learnerName === "Cara Hughes"), searchFiltered.body);

  const refreshed = await getJson("/api/levytate-operations", leadCookie);
  check("Refresh preserves queue counts", JSON.stringify(refreshed.body.summary) === JSON.stringify(body.summary), { before: body.summary, after: refreshed.body.summary });
  const reloggedCookie = await login("apprenticeshiplead.demo@levytate.test");
  const relogged = await getJson("/api/levytate-operations", reloggedCookie);
  check("Re-login preserves queue counts", JSON.stringify(relogged.body.summary) === JSON.stringify(body.summary), { before: body.summary, after: relogged.body.summary });

  for (const [label, email] of [["Employee", "employee.demo@levytate.test"], ["Line Manager", "manager.demo@levytate.test"]]) {
    const cookie = await login(email);
    const denied = await authedFetch("/api/levytate-operations", cookie);
    check(`${label} is denied organisation-wide Operations Centre`, denied.status === 403, await safeJson(denied));
  }
  const isolationCookie = await login("isolation.employee.demo@levytate.test");
  const isolationDenied = await authedFetch("/api/levytate-operations?organisationId=12000000-0000-4000-8000-000000000001", isolationCookie);
  check("Cross-organisation query is denied", isolationDenied.status === 403, await safeJson(isolationDenied));
  const mutation = await authedFetch("/api/levytate-operations", leadCookie, { method: "POST" });
  check("Operations endpoint exposes no mutations", mutation.status === 405, await safeJson(mutation));

  console.log(JSON.stringify({ ok: true, baseUrl, summary: body.summary, checks: checks.length }, null, 2));
}

async function login(email) {
  const response = await fetch(`${baseUrl}/api/levytate-beta-login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, code: betaCode }) });
  const body = await safeJson(response);
  check(`Login succeeds for ${email}`, response.status === 200, body);
  const cookie = response.headers.get("set-cookie")?.split(";")[0];
  check(`Session cookie issued for ${email}`, Boolean(cookie), body);
  return cookie;
}

async function getJson(path, cookie) {
  const response = await authedFetch(path, cookie);
  return { response, body: await safeJson(response) };
}

function authedFetch(path, cookie, init = {}) {
  return fetch(`${baseUrl}${path}`, { ...init, headers: { cookie, ...(init.headers ?? {}) } });
}

function isPriorityOrdered(items) {
  return items.every((item, index) => !index || items[index - 1].priorityRank <= item.priorityRank);
}

async function safeJson(response) {
  try { return await response.clone().json(); } catch { return {}; }
}

function check(label, condition, detail) {
  if (!condition) {
    console.error(`FAIL: ${label}`);
    if (detail !== undefined) console.error(JSON.stringify(detail, null, 2));
    process.exit(1);
  }
  checks.push(label);
  console.log(`PASS: ${label}`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
