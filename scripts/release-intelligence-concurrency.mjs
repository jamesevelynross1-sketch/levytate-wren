/** Real PostgreSQL transaction races in one dedicated LOCAL review database.
 * Uses synthetic rows and the actual candidate RPC. No Auth/API/browser claims.
 * Synthetic evidence is retained for independent inspection; no resets or ledger writes.
 */
import { spawn, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createHash, randomUUID } from "node:crypto";

const runtime = process.env.RELEASE_LOCAL_RUNTIME;
const database = process.env.RELEASE_TEST_DATABASE;
const candidate = new URL("../supabase/release-migrations/20261110090943_client_intelligence_atomic_commands.sql", import.meta.url);
const candidateHash = "1e3bff237a0e7594675e43193099d701b14a1a7e299167bdb4ba2b763de8ea60";
if (!runtime?.startsWith("/private/tmp/levytate-release-runtime.") || database !== "levytate_release_intelligence_review26") throw new Error("Dedicated local Intelligence review database required");
if (createHash("sha256").update(readFileSync(candidate)).digest("hex") !== candidateHash) throw new Error("Reviewed candidate hash differs");
const state = JSON.parse(readFileSync(`${runtime}/private-stack-state.json`, "utf8"));
const connection = new URL(state.env.DB_URL);
if (connection.hostname !== "127.0.0.1") throw new Error("Loopback PostgreSQL required");
const env = { ...process.env, PGPASSWORD: connection.password };
const bin = `${process.env.RELEASE_PG_BIN ?? "/opt/homebrew/opt/postgresql@17/bin"}/psql`;
const args = ["-XAtq", "-v", "ON_ERROR_STOP=1", "-v", "VERBOSITY=verbose", "-h", connection.hostname, "-p", connection.port, "-U", connection.username, "-d", database];
const q = value => `'${String(value).replaceAll("'", "''")}'`;
const j = value => `${q(JSON.stringify(value))}::jsonb`;
const parse = (status, out, err) => ({ ok: status === 0, value: out.replaceAll("LOCK_HELD", "").trim(), code: err.match(/ERROR:\s+([A-Z0-9]{5}):/)?.[1] });
function sql(input) {
  const result = spawnSync(bin, args, { env, input, encoding: "utf8", timeout: 15000, maxBuffer: 4 * 1024 * 1024 });
  return parse(result.status, result.stdout ?? "", result.stderr ?? "");
}
function need(input) {
  const result = sql(input);
  if (!result.ok) throw new Error(`Local SQLSTATE ${result.code ?? "connection/timeout"}`);
  return result.value;
}
function running(input, keepOpen = false) {
  let readyResolve, child;
  const name = `intelligence-review-${randomUUID()}`;
  const ready = new Promise(resolve => { readyResolve = resolve; });
  const done = new Promise(resolve => {
    child = spawn(bin, args, { env: { ...env, PGAPPNAME: name }, stdio: ["pipe", "pipe", "pipe"] });
    let out = "", err = "";
    const timeout = setTimeout(() => child.kill("SIGTERM"), 15000);
    child.stdout.on("data", value => { out += value; if (out.includes("LOCK_HELD")) readyResolve(); });
    child.stderr.on("data", value => { err += value; });
    child.on("close", code => { clearTimeout(timeout); readyResolve(); resolve(parse(code, out, err)); });
    if (keepOpen) child.stdin.write(input + "\n"); else child.stdin.end(input);
  });
  return { ready, done, name, release: () => child.stdin.end("commit;\n") };
}
async function blockedBy(waiter, holder) {
  const deadline = Date.now() + 4000;
  while (Date.now() < deadline) {
    if (need(`select exists(select 1 from pg_stat_activity w join pg_stat_activity h on h.pid=any(pg_blocking_pids(w.pid)) where w.application_name=${q(waiter.name)} and h.application_name=${q(holder.name)} and w.wait_event_type='Lock')::text;`) === "true") return true;
    await new Promise(resolve => setTimeout(resolve, 25));
  }
  return false;
}
const service = "begin;set local statement_timeout='10s';set local role service_role;set local request.jwt.claim.role='service_role';";
const owner = "begin;set local statement_timeout='10s';";
const hold = "select 'LOCK_HELD';";
const family = "progress-review-v1";
let passed = 0, failed = 0;
const check = (label, ok) => { ok ? passed++ : failed++; console.log(`${ok ? "PASS" : "FAIL"}: ${label}`); };
const command = (f, payload, options = {}) => `select public.levytate_apply_intelligence_command(${q(f.org)},${q(options.actor ?? f.actor)},${q(options.family ?? family)},${j(payload)},${Boolean(options.prepare)},${options.snapshot ? q(options.snapshot.sourceHash) : "null"},${options.snapshot?.revision ?? "null"},${options.rows ? j(options.rows) : "null"});`;
const run = (f, payload, options) => JSON.parse(need(service + command(f, payload, options) + "commit;"));
function fixture() {
  const f = { org: randomUUID(), actor: randomUUID(), second: randomUUID(), person: `person-${randomUUID()}`, learner: `learner-${randomUUID()}`, review: `review-${randomUUID()}`, signal: `signal-${randomUUID()}` };
  f.template = JSON.parse(need(owner + `
    insert into public.levytate_organisations(id,name,slug,status) values(${q(f.org)},'Synthetic Intelligence concurrency',${q(f.org)},'Active');
    insert into public.levytate_users(id,organisation_id,email,role,active,access_level,auth_binding_status) values
      (${q(f.actor)},${q(f.org)},${q(`${f.actor}@example.test`)},'Apprenticeship Lead',true,'beta_user','pending'),
      (${q(f.second)},${q(f.org)},${q(`${f.second}@example.test`)},'Employer Admin',true,'beta_user','pending');
    insert into public.levytate_employees(organisation_id,id,employee_number,name,email,platform_role,status,start_date) values
      (${q(f.org)},${q(f.person)},${q(f.person)},'Synthetic employee',${q(`${f.person}@example.test`)},'Employee','Active',current_date);
    insert into public.levytate_learner_records(organisation_id,id,employee_id,lifecycle_status,employment_route,record_status) values
      (${q(f.org)},${q(f.learner)},${q(f.person)},'enrolled','existing_employee_upskill','Active');
    insert into public.levytate_learner_reviews(organisation_id,id,learner_record_id,review_type,review_date,summary) values
      (${q(f.org)},${q(f.review)},${q(f.learner)},'provider_review',current_date,'Synthetic review');
    insert into public.levytate_intelligence_signals(organisation_id,id,fingerprint,entity_type,entity_id,learner_record_id,category,signal_type,title,summary,evidence,confidence,priority,recommended_action,suggested_owner_type,analyser_version)
      values(${q(f.org)},${q(f.signal)},${q(f.signal)},'learner',${q(f.learner)},${q(f.learner)},'risk','manager_support_required','Synthetic support evidence','Synthetic only',${j([{ sourceType: "provider_review", sourceId: f.review, sourceDate: "2026-11-10", label: "Recorded review" }])},'High','High','Review recorded support','Apprenticeship Lead',${q(family)}) returning to_jsonb(levytate_intelligence_signals.*);
    delete from public.levytate_intelligence_signals where organisation_id=${q(f.org)};commit;`));
  const analyse = { action: "analyse", idempotencyKey: randomUUID() };
  run(f, analyse, { snapshot: run(f, analyse, { prepare: true }), rows: [f.template] });
  return f;
}
const decision = (f, action, revision = 1) => ({ action, signalId: f.signal, expectedRevision: revision, idempotencyKey: randomUUID(), ...(action === "dismiss" ? { reason: "No action required" } : {}) });
const counts = f => need(`select (select count(*) from public.levytate_intelligence_command_receipts where organisation_id=${q(f.org)})||':'||(select count(*) from public.levytate_intelligence_signal_events where organisation_id=${q(f.org)})||':'||(select revision from public.levytate_intelligence_signals where organisation_id=${q(f.org)} and id=${q(f.signal)});`);

try {
  if (need("select current_setting('server_version_num')::int/10000;") !== "17") throw new Error("PostgreSQL 17 required");
  if (need("select count(*) from supabase_migrations.schema_migrations;") !== "0") throw new Error("Review ledger must remain empty");
  check("actual candidate readiness contract is present", JSON.parse(need(service + "select public.levytate_required_client_contracts();commit;")).version === "20261110090943");

  const exact = fixture(), exactCommand = decision(exact, "acknowledge");
  const first = running(service + command(exact, exactCommand) + hold, true);
  await first.ready;
  const second = running(service + command(exact, exactCommand) + "commit;");
  check("same exact request waits on the first transaction", await blockedBy(second, first));
  first.release();
  const [one, two] = await Promise.all([first.done, second.done]);
  check("concurrent exact request returns byte-identical original receipt", one.ok && two.ok && one.value === two.value);
  check("concurrent replay leaves one decision, history and receipt", counts(exact) === "2:2:2");

  for (const differentActor of [false, true]) {
    const f = fixture();
    const winner = running(service + command(f, decision(f, "acknowledge")) + hold, true);
    await winner.ready;
    const loser = running(service + command(f, decision(f, "dismiss"), { actor: differentActor ? f.second : f.actor }) + "commit;");
    check(`${differentActor ? "second actor" : "same actor"} competing revision waits`, await blockedBy(loser, winner));
    winner.release();
    const [won, lost] = await Promise.all([winner.done, loser.done]);
    check(`${differentActor ? "second actor" : "same actor"} stale decision rejected after winner commits`, won.ok && !lost.ok && lost.code === "PT409");
    check("competing decision cannot add a receipt or history", counts(f) === "2:2:2");
  }

  for (const [label, set, restore] of [["actor revocation", "active=false", "active=true"], ["actor role downgrade", "role='Employee'", "role='Apprenticeship Lead'"]]) {
    const f = fixture(), original = decision(f, "acknowledge");
    run(f, original);
    const change = running(owner + `update public.levytate_users set ${set} where id=${q(f.actor)};` + hold, true);
    await change.ready;
    const replay = running(service + command(f, original) + "commit;");
    check(`${label} original receipt waits for current authority`, await blockedBy(replay, change));
    change.release();
    const [changed, denied] = await Promise.all([change.done, replay.done]);
    check(`${label} denies receipt replay after lock wait`, changed.ok && !denied.ok && denied.code === "PT403");
    check(`${label} keeps existing attributable evidence unchanged`, counts(f) === "2:2:2");
    need(owner + `update public.levytate_users set ${restore} where id=${q(f.actor)};commit;`);
  }

  const suspended = fixture(), beforeSuspend = decision(suspended, "acknowledge");
  run(suspended, beforeSuspend);
  const suspension = running(owner + `update public.levytate_organisations set status='Suspended' where id=${q(suspended.org)};` + hold, true);
  await suspension.ready;
  const staleEmployer = running(service + command(suspended, beforeSuspend) + "commit;");
  check("employer suspension blocks original receipt on current organisation", await blockedBy(staleEmployer, suspension));
  suspension.release();
  const [suspendedResult, refusedEmployer] = await Promise.all([suspension.done, staleEmployer.done]);
  check("suspended employer cannot read old success receipt", suspendedResult.ok && !refusedEmployer.ok && refusedEmployer.code === "PT403");

  const changedSource = fixture();
  const sourceWriter = running(owner + `update public.levytate_learner_reviews set summary='Synthetic changed source after analysis' where organisation_id=${q(changedSource.org)} and id=${q(changedSource.review)};` + hold, true);
  await sourceWriter.ready;
  const staleAccept = running(service + command(changedSource, decision(changedSource, "accept")) + "commit;");
  check("decision waits for an in-flight source mutation", await blockedBy(staleAccept, sourceWriter));
  sourceWriter.release();
  const [sourceCommitted, staleDenied] = await Promise.all([sourceWriter.done, staleAccept.done]);
  check("source changed during wait rejects acceptance", sourceCommitted.ok && !staleDenied.ok && staleDenied.code === "PT409");
  check("stale source produces no derived action or decision history", counts(changedSource) === "1:1:1" && need(`select count(*) from public.levytate_operational_actions where organisation_id=${q(changedSource.org)};`) === "0");

  for (const humanFirst of [true, false]) {
    const f = fixture(), refresh = { action: "analyse", idempotencyKey: randomUUID() };
    const snapshot = run(f, refresh, { prepare: true });
    const reconcileSql = command(f, refresh, { snapshot, rows: snapshot.signals });
    const humanSql = command(f, decision(f, "acknowledge"));
    const winning = running(service + (humanFirst ? humanSql : reconcileSql) + hold, true);
    await winning.ready;
    const waiting = running(service + (humanFirst ? reconcileSql : humanSql) + "commit;");
    check(`${humanFirst ? "reconciliation" : "human decision"} waits for competing command`, await blockedBy(waiting, winning));
    winning.release();
    const [won, lost] = await Promise.all([winning.done, waiting.done]);
    check(`${humanFirst ? "human decision" : "reconciliation"} wins and stale competing command is refused`, won.ok && !lost.ok && lost.code === "PT409");
    check("competing reconciliation preserves one durable revision", counts(f) === "2:2:2");
  }

  const accepted = fixture(), accept = decision(accepted, "accept");
  const accepting = running(service + command(accepted, accept) + hold, true);
  await accepting.ready;
  const acceptRetry = running(service + command(accepted, accept) + "commit;");
  check("duplicate accept waits through nested Operations creation", await blockedBy(acceptRetry, accepting));
  accepting.release();
  const [acceptedOne, acceptedTwo] = await Promise.all([accepting.done, acceptRetry.done]);
  check("duplicate accept returns same linked action and exact snapshot", acceptedOne.ok && acceptedTwo.ok && acceptedOne.value === acceptedTwo.value);
  check("duplicate accept creates one action, Operations history and Operations receipt", need(`select (select count(*) from public.levytate_operational_actions where organisation_id=${q(accepted.org)})||':'||(select count(*) from public.levytate_operational_action_events where organisation_id=${q(accepted.org)})||':'||(select count(*) from public.levytate_operational_action_receipts where organisation_id=${q(accepted.org)});`) === "1:1:1");
  check("no Auth, Storage or migration-history fixture data created", need("select (select count(*) from auth.users)||':'||(select count(*) from storage.objects)||':'||(select count(*) from supabase_migrations.schema_migrations);") === "0:0:0");
} catch (error) {
  failed++;
  console.error(`FAIL: bounded local concurrency execution: ${/^Local SQLSTATE [A-Z0-9/]+$/.test(error.message) ? error.message : "execution or preflight failed"}`);
}
console.log(JSON.stringify({ suite: "intelligence-concurrency", passed, failed, database, candidateHash, hosted: false, syntheticEvidenceRetained: true }));
if (failed) process.exitCode = 1;
