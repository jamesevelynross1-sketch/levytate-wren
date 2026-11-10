/** Real PostgreSQL concurrency in an empty, explicitly named local review DB. */
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
const runtime = process.env.RELEASE_LOCAL_RUNTIME, database = process.env.RELEASE_TEST_DATABASE;
if (!/^\/private\/tmp\/levytate-release-runtime\.[A-Za-z0-9]+$/.test(runtime ?? "") || !/^levytate_release_manager_learning_[a-z0-9_]+$/.test(database ?? "")) throw Error("Dedicated local manager-learning database required");
const candidate = "supabase/release-migrations/20261109193701_manager_personal_learning_time_permissions.sql";
if (createHash("sha256").update(readFileSync(candidate)).digest("hex") !== "209c8dedc643029186ea6959fc7d36982cad530d38e9d517935d186d69385d64") throw Error("Reviewed candidate hash required");
const url = new URL(JSON.parse(readFileSync(`${runtime}/private-stack-state.json`, "utf8")).env.DB_URL);
if (url.hostname !== "127.0.0.1") throw Error("Local loopback only");
const env = { ...process.env, PGHOST: url.hostname, PGPORT: url.port, PGUSER: url.username, PGPASSWORD: url.password, PGDATABASE: database };
const binary = "/opt/homebrew/opt/postgresql@17/bin/psql", args = ["-XAtq", "-v", "ON_ERROR_STOP=1", "-v", "VERBOSITY=verbose"];
const org = "92000000-0000-4000-a000-000000000001", manager = "92000000-0000-4000-a000-000000000003", lead = "92000000-0000-4000-a000-000000000002", otherLead = "92000000-0000-4000-a000-000000000005";
let passed = 0;
function check(label, condition) { if (!condition) throw Error(`FAIL: ${label}`); passed++; console.log(`PASS: ${label}`); }
function sql(source) { const result = spawnSync(binary, args, { input: source, encoding: "utf8", env }); if (result.status) throw Error(`Local SQL failed (${result.stderr.match(/ERROR:\s+([A-Z0-9]{5}):/)?.[1] ?? "unknown"})`); return result.stdout.trim(); }
function concurrent(source) {
  const child = spawn(binary, args, { env }); let stdout = "", stderr = ""; let readyResolve;
  const ready = new Promise(resolve => { readyResolve = resolve; });
  child.stdout.on("data", data => { stdout += data; if (stdout.includes("barrier-ready")) readyResolve(); });
  child.stderr.on("data", data => { stderr += data; });
  const done = new Promise(resolve => child.on("close", code => resolve({ ok: code === 0, code: stderr.match(/ERROR:\s+([A-Z0-9]{5}):/)?.[1], stdout })));
  child.stdin.end(source); return { ready, done };
}
const quote = value => `'${String(value).replaceAll("'", "''")}'`;
const command = (actor, action, input, row = {}) => `begin;select set_config('request.jwt.claim.role','service_role',true);select public.levytate_apply_learning_time_command('${org}','${actor}',${quote(action)},${quote(JSON.stringify(input))}::jsonb,${quote(JSON.stringify(row))}::jsonb);commit;`;
function counts() { return sql(`select jsonb_build_array((select count(*) from public.levytate_otj_activities where organisation_id='${org}'),(select count(*) from public.levytate_otj_activity_events where organisation_id='${org}'),(select count(*) from public.levytate_otj_command_receipts where organisation_id='${org}'),(select count(*) from public.levytate_audit_events where organisation_id='${org}'));`); }
try {
  check("fresh isolated schema has no People/Auth/Storage/history fixtures", sql("select (select count(*) from public.levytate_employees)+(select count(*) from auth.users)+(select count(*) from storage.objects)+(select count(*) from supabase_migrations.schema_migrations);") === "0");
  check("reviewed own-Manager RPC is installed before fixture creation", sql("select position('own_employee_ids' in pg_get_functiondef('public.levytate_apply_learning_time_command(uuid,uuid,text,jsonb,jsonb,boolean)'::regprocedure))>0;") === "t");
  const fixture = readFileSync("tests/learning-time-transaction.sql", "utf8");
  if (createHash("sha256").update(fixture).digest("hex") !== "017805db0db6b9469cd259dfc06d4877a4f4a710ec3c9d6a4bee1d7934c6b6d7") throw Error("Reviewed fixture hash required");
  const end = fixture.indexOf(" replayed:=public.levytate_apply_learning_time_command");
  if (end < 0) throw Error("Fixture boundary missing");
  sql(fixture.slice(0, end).replace("'employee-otj@example.invalid','Employee','Employer',true", "'employee-otj@example.invalid','Line Manager','Employer',true") + "end $$;commit;");
  const activity = sql(`select id from public.levytate_otj_activities where organisation_id='${org}';`);
  const submissions = await Promise.all(["race-submit-a", "race-submit-b"].map(idempotencyKey => concurrent(command(manager, "submit_activity", { activityId: activity, idempotencyKey, lockVersion: 0 })).done));
  check("concurrent distinct submissions commit exactly once and reject stale revision", submissions.filter(value => value.ok).length === 1 && submissions.filter(value => value.code === "PT409").length === 1);
  check("one submission leaves one event and one receipt/audit", counts() === "[1, 2, 4, 4]");
  const withdrawal = { activityId: activity, idempotencyKey: "race-same-withdrawal", lockVersion: 1, action: "withdraw", note: "Synthetic same command" };
  const withdrawals = await Promise.all([1, 2].map(() => concurrent(command(manager, "transition_activity", withdrawal)).done));
  check("concurrent identical withdrawals both receive the original success", withdrawals.every(value => value.ok));
  check("identical withdrawal never duplicates event receipt or audit", counts() === "[1, 3, 5, 5]" && sql(`select status||':'||lock_version from public.levytate_otj_activities where id='${activity}';`) === "withdrawn:2");
  // Use the original saved row as normalized evidence for a second independent activity.
  const row = JSON.parse(sql(`select to_jsonb(a)-array['id','organisation_id','learner_record_id','created_at','created_by_user_id','created_by_email','status','submitted_at','lock_version','updated_at'] from public.levytate_otj_activities a where id='${activity}';`));
  row.started_at = "12:00"; row.ended_at = "13:00";
  sql(command(manager, "save_activity", { learnerRecordId: "otj-learner", idempotencyKey: "race-review-activity" }, row));
  const reviewed = sql(`select id from public.levytate_otj_activities where organisation_id='${org}' and status='draft';`);
  sql(command(manager, "submit_activity", { activityId: reviewed, idempotencyKey: "race-review-submit", lockVersion: 0 }));
  sql(`insert into public.levytate_users(id,organisation_id,email,role,access_level,active) values('${otherLead}','${org}','race-reviewer@example.invalid','Employer Admin','Employer',true);`);
  const review = { activityId: reviewed, idempotencyKey: "race-shared-review-key", lockVersion: 1, action: "employer_check", note: "Synthetic review" };
  const reviews = await Promise.all([lead, otherLead].map(actor => concurrent(command(actor, "transition_activity", review)).done));
  check("two reviewers racing the same legacy key cannot falsely acknowledge both", reviews.filter(value => value.ok).length === 1 && reviews.filter(value => value.code === "PT409").length === 1);
  check("one review event has exactly one actor receipt and audit", sql(`select jsonb_build_array((select count(*) from public.levytate_otj_activity_events where organisation_id='${org}' and idempotency_key='race-shared-review-key'),(select count(*) from public.levytate_otj_command_receipts where organisation_id='${org}' and request_id='race-shared-review-key'),(select count(*) from public.levytate_audit_events where organisation_id='${org}' and metadata->>'requestId'='race-shared-review-key'));`) === "[1, 1, 1]");
  const before = counts();
  for (const [label, change, restore] of [
    ["revoked membership", `update public.levytate_users set active=false where id='${manager}';`, `update public.levytate_users set active=true where id='${manager}';`],
    ["archived own People", `update public.levytate_employees set status='Archived' where organisation_id='${org}' and id='otj-employee';`, `update public.levytate_employees set status='Active' where organisation_id='${org}' and id='otj-employee';`],
    ["changed actor role", `update public.levytate_users set role='Apprenticeship Lead' where id='${manager}';`, `update public.levytate_users set role='Line Manager' where id='${manager}';`],
  ]) {
    const holder = concurrent(`begin;select pg_advisory_xact_lock(hashtextextended('levytate-people:${org}',0));${change}select 'barrier-ready';select pg_sleep(0.4);commit;`);
    await Promise.race([holder.ready, holder.done.then(() => { throw Error("Barrier not reached"); })]);
    const started = Date.now(), result = await concurrent(command(manager, "transition_activity", withdrawal)).done;
    check(`${label} committed during lock wait denies even exact successful receipt`, (await holder.done).ok && !result.ok && result.code === "PT403" && Date.now() - started >= 150);
    check(`${label} denied retry leaves every durable count unchanged`, counts() === before); sql(restore);
  }
  check("no Auth user, object or ledger fabricated by concurrency fixtures", sql("select (select count(*) from auth.users)+(select count(*) from storage.objects)+(select count(*) from supabase_migrations.schema_migrations);") === "0");
  console.log(JSON.stringify({ passed, failed: 0, database, hosted: false, realAuthentication: false, fictionalFixturesRetainedInDedicatedDatabase: true }));
} catch (error) {
  console.log(JSON.stringify({ passed, failed: 1, message: error instanceof Error ? error.message : "Local challenge failed", database, hosted: false })); process.exitCode = 1;
}
