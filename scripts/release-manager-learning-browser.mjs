/** Helper-only genuine LOCAL Manager learning journey. Caller owns sessions. */
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { localUrl } from "./release-local-fixtures.mjs";

export async function verifyManagerLearningTime({ app: origin, manifest, contexts, learnerId, backend, check }) {
  const app = localUrl(origin, "manager learning app"), runtime = process.env.RELEASE_LOCAL_RUNTIME;
  const manager = contexts.get("a:manager"), lead = contexts.get("a:lead"), employee = contexts.get("a:employee"), other = contexts.get("b:employee"), tenant = manifest.tenants.find(item => item.key === "a");
  if (!runtime?.startsWith("/private/tmp/levytate-release-runtime.") || !manifest.synthetic || manifest.environment !== "local" || !/^[a-f0-9-]{36}$/.test(manifest.run) || !/^[a-f0-9-]{36}$/.test(tenant?.id ?? "") || manifest.catalogue.standardId !== "ST0118" || ![manager, lead, employee, other].every(actor => actor?.context && actor?.page) || !learnerId) throw Error("Reviewed fictional local learner and existing genuine contexts required");
  const db = new URL(JSON.parse(readFileSync(`${runtime}/private-stack-state.json`, "utf8")).env.DB_URL);
  if (db.hostname !== "127.0.0.1") throw Error("Local database only");
  const capability = enabled => {
    const result = spawnSync("/opt/homebrew/opt/postgresql@17/bin/psql", ["-XAtq", "-v", "ON_ERROR_STOP=1"], { env: { ...process.env, PGHOST: db.hostname, PGPORT: db.port, PGUSER: db.username, PGPASSWORD: db.password, PGDATABASE: db.pathname.slice(1) }, encoding: "utf8", input: `update public.levytate_organisation_capabilities set off_the_job_assistant_enabled=${enabled} where organisation_id='${tenant.id}' and exists(select 1 from public.levytate_organisations where id='${tenant.id}' and slug='release-${manifest.run}-a') returning organisation_id;` });
    if (result.status || result.stdout.trim() !== tenant.id) throw Error("Local fictional capability update failed");
  };
  const report = (label, passed) => check(`Manager Learning Time: ${label}`, passed);
  const headers = actor => ({ Origin: app, "X-LevyTate-Account": actor.user.email, "X-LevyTate-Organisation": actor.tenant.id });
  const path = `${app}/api/levytate-learning-time`, page = manager.page, today = new Date().toISOString().slice(0, 10);
  const post = (actor, data) => actor.context.request.post(path, { headers: headers(actor), data });
  const workspace = async actor => { const response = await actor.context.request.get(path, { headers: headers(actor) }); report(`${actor.user.role} reads current scoped learning data`, response.status() === 200); return response.json(); };
  const own = value => value.learners.find(item => item.learnerRecordId === learnerId);
  const counts = async id => {
    const [rows, events, receipts, audits] = await Promise.all([
      backend(`rest/v1/levytate_otj_activities?organisation_id=eq.${tenant.id}&id=eq.${id}&select=id,status,lock_version,duration_minutes,title`),
      backend(`rest/v1/levytate_otj_activity_events?organisation_id=eq.${tenant.id}&activity_id=eq.${id}&select=id&order=id`),
      backend(`rest/v1/levytate_otj_command_receipts?organisation_id=eq.${tenant.id}&actor_user_id=eq.${manager.user.membershipId}&select=request_id&order=request_id`),
      backend(`rest/v1/levytate_audit_events?organisation_id=eq.${tenant.id}&entity_type=eq.learning_time&entity_id=eq.${encodeURIComponent(learnerId)}&select=id&order=id`),
    ]); return { rows, events, receipts, audits };
  };
  let phase = "verify exact own enrolled learner", badGet, dropped, originalBody, savedActivity, upstreamFailed = false;
  const malformed = async route => {
    if (!badGet && route.request().method() === "GET") {
      badGet = true; const response = await route.fetch();
      if (response.status() !== 200) { upstreamFailed = true; await route.fulfill({ response }); return; }
      const headers = response.headers(); delete headers["content-length"]; delete headers["content-encoding"];
      await route.fulfill({ response, body: "{}", headers: { ...headers, "content-type": "application/json" } });
    } else await route.continue();
  };
  const loseSave = async route => {
    if (!dropped && route.request().method() === "POST" && route.request().postDataJSON()?.action === "save_activity") {
      dropped = true; originalBody = route.request().postData();
      try {
        const response = await route.fetch(), body = await response.json();
        if (response.status() !== 201 || body.activity?.learner_record_id !== learnerId || body.activity.status !== "draft") throw Error("Upstream save unconfirmed");
        savedActivity = body.activity; await route.abort("connectionreset");
      } catch { upstreamFailed = true; await route.abort(); }
    } else await route.continue();
  };
  const matchPost = response => new URL(response.url()).pathname === "/api/levytate-learning-time" && response.request().method() === "POST";
  capability(true);
  try {
    report("other tenant remains disabled", (await other.context.request.get(path, { headers: headers(other) })).status() === 404);
    const before = await workspace(manager), current = own(before);
    report("own current learner is distinct from report controls", current?.employeeId === manager.user.personId && current.canCreateActivities === true && before.learners[0].learnerRecordId === learnerId && before.canReviewActivities === false && before.canManagePlans === false && before.learners.filter(item => item.employeeId !== manager.user.personId).every(item => item.canCreateActivities === false));
    report("new own learner has no fabricated plan or activity", current.plan === null && current.activities.length === 0);
    const plan = { action: "create_plan_draft", idempotencyKey: randomUUID(), learnerRecordId: learnerId, originalStartDate: today, practicalStartDate: today, practicalEndDate: "2028-01-01", standardId: "ST0118", standardVersion: "1.1", priorLearningReductionMinutes: 0, individualMinimumMinutes: 22200, plannedDeliveryMinutes: 22200, providerId: manifest.catalogue.providerId, trainingPlanReference: "Synthetic own-manager acceptance; no funding claim", sourceType: "provider_training_plan", sourceDate: today };
    report("Manager cannot author their own plan", (await post(manager, plan)).status() === 403);
    const draftResponse = await post(lead, plan), draft = await draftResponse.json();
    report("Lead creates the actual own-Manager plan", draftResponse.status() === 201 && draft.version?.standard_version === "1.1");
    report("Lead publishes the exact plan", (await post(lead, { action: "publish_plan", versionId: draft.version.id, idempotencyKey: randomUUID() })).status() === 200);
    phase = "malformed successful read";
    await page.route("**/api/levytate-learning-time", malformed);
    try { await page.goto(`${app}/levytate/app?module=Learning%20Time`); await page.getByText("Learning Time is unavailable", { exact: true }).waitFor(); }
    finally { await page.unroute("**/api/levytate-learning-time", malformed); }
    report("malformed actual200 is rejected without rendering a partial workspace", badGet && !upstreamFailed && await page.getByRole("button", { name: "Add learning activity", exact: true }).count() === 0);
    await page.getByRole("button", { name: "Try again", exact: true }).click();
    await page.getByRole("button", { name: "Add learning activity", exact: true }).click();
    phase = "real save then lost response";
    const title = `Synthetic manager workshop ${manifest.run.slice(0, 8)}`;
    await page.getByLabel("Activity date", { exact: true }).fill(today); await page.getByLabel("Start", { exact: true }).fill("11:00"); await page.getByLabel("End", { exact: true }).fill("12:00");
    await page.getByRole("combobox", { name: "Working-hours basis", exact: true }).selectOption("within_normal_working_hours");
    for (const [label, value] of [["Title", title], ["What did you do?", "Synthetic individual workshop, separate from productive work."], ["What was genuinely new?", "New data interpretation methods."], ["How did this relate to your standard or agreed priority?", "Data analysis skills within the synthetic plan."], ["Reflection", "Fictional acceptance evidence only."]]) await page.getByLabel(label, { exact: true }).fill(value);
    await page.getByLabel("This was separate from routine productive work.", { exact: true }).check();
    await page.route("**/api/levytate-learning-time", loseSave);
    try { await page.getByRole("button", { name: "Save private draft", exact: true }).click(); await page.getByRole("dialog", { name: "Update awaiting confirmation", exact: true }).waitFor(); }
    finally { await page.unroute("**/api/levytate-learning-time", loseSave); }
    report("real upstream commit precedes lost response and visible recovery", dropped && !upstreamFailed && Boolean(savedActivity?.id) && typeof originalBody === "string");
    report("uncertain original input stays frozen", await page.getByLabel("Title", { exact: true }).inputValue() === title && await page.getByLabel("Title", { exact: true }).isDisabled());
    const committed = await counts(savedActivity.id), retry = page.waitForResponse(matchPost);
    await page.getByRole("dialog", { name: "Update awaiting confirmation", exact: true }).getByRole("button", { name: "Retry original update", exact: true }).click();
    const retried = await retry;
    report("retry sends the original body and key under original account", retried.status() === 201 && retried.request().postData() === originalBody && retried.request().headers()["x-levytate-account"] === manager.user.email && retried.request().headers()["x-levytate-organisation"] === tenant.id);
    await page.getByRole("dialog", { name: "Update awaiting confirmation", exact: true }).waitFor({ state: "hidden" });
    report("lost-response retry adds no activity, event, receipt or audit", JSON.stringify(await counts(savedActivity.id)) === JSON.stringify(committed));
    await page.reload(); await page.getByRole("heading", { name: title, exact: true }).waitFor();
    report("reload reads exact durable own draft", own(await workspace(manager)).activities.some(item => item.id === savedActivity.id && item.status === "draft" && item.durationMinutes === 60));
    report("Lead cannot read a manager's private draft", !(own(await workspace(lead)).activities.some(item => item.id === savedActivity.id)));
    phase = "own submission, denied review and own withdrawal";
    const card = page.locator("article").filter({ has: page.getByRole("heading", { name: title, exact: true }) });
    const submitting = page.waitForResponse(matchPost); await card.getByRole("button", { name: "Submit", exact: true }).click();
    report("Manager submits through actual UI", (await submitting).status() === 200);
    const submitted = own(await workspace(manager)).activities.find(item => item.id === savedActivity.id);
    const review = { action: "transition_activity", activityId: savedActivity.id, transitionAction: "employer_check", lockVersion: submitted.lockVersion, note: "Synthetic forbidden self-review", idempotencyKey: randomUUID() };
    report("Manager cannot employer-check own evidence", (await post(manager, review)).status() === 403);
    report("Employee cannot act on manager evidence", (await post(employee, { action: "submit_activity", activityId: savedActivity.id, lockVersion: submitted.lockVersion, idempotencyKey: randomUUID() })).status() === 403);
    const withdrawing = page.waitForResponse(matchPost); await card.getByRole("button", { name: "Withdraw activity", exact: true }).click();
    const withdrawn = await withdrawing, withdrawalBody = withdrawn.request().postDataJSON(); report("Manager withdraws via the real own-only control", withdrawn.status() === 200 && (await withdrawn.json()).activity?.status === "withdrawn");
    const ended = await counts(savedActivity.id); report("withdrawal retry returns exact original success", (await post(manager, withdrawalBody)).status() === 200); report("withdrawal replay does not duplicate durable records", JSON.stringify(await counts(savedActivity.id)) === JSON.stringify(ended));
    await page.reload(); await page.getByRole("heading", { name: title, exact: true }).waitFor(); report("withdrawn result persists without an available repeat action", await card.getByText("withdrawn", { exact: true }).count() === 1 && await card.getByRole("button", { name: "Withdraw activity", exact: true }).count() === 0);
    const reportLearner = (await workspace(manager)).learners.find(item => item.employeeId === employee.user.personId);
    report("actual direct-report learner remains visible separately", Boolean(reportLearner));
    if (reportLearner) {
      await page.getByRole("combobox", { name: "Learner", exact: true }).selectOption(reportLearner.learnerRecordId);
      await page.getByRole("heading", { name: "Direct-report learning summary", exact: true }).waitFor();
      report("selecting a report does not retain own capture or review controls", await page.getByRole("button", { name: "Add learning activity", exact: true }).count() === 0 && await page.getByRole("button", { name: "Employer check", exact: true }).count() === 0 && await page.getByRole("button", { name: "Withdraw activity", exact: true }).count() === 0);
    }
    return { learnerId, activityId: savedActivity.id, result: "PASS", lostResponseAfterRealCommit: true, newSignIns: 0 };
  } catch { throw Error(`Manager Learning Time acceptance failed during ${phase}; private state omitted`); }
  finally { await page.unroute("**/api/levytate-learning-time", malformed); await page.unroute("**/api/levytate-learning-time", loseSave); capability(false); report("optional capability restored disabled", (await manager.context.request.get(path, { headers: headers(manager) })).status() === 404); }
}
