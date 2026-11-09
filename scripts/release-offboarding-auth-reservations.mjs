/** Independent SQL concurrency checks. Synthetic rows in one dedicated LOCAL DB only.
 * This is not a Supabase Auth API, browser, encrypted-delivery or hosted acceptance test.
 * Uses real lifecycle RPCs and transaction locks; never fabricates case/history rows.
 * Leaves synthetic evidence in the named database for independent inspection.
 */
import { spawn, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";

const runtime = process.env.RELEASE_LOCAL_RUNTIME;
const database = process.env.RELEASE_TEST_DATABASE;
if (!runtime?.startsWith("/private/tmp/levytate-release-runtime.")
  || !/^levytate_release_offboard_identity_review[0-9a-z_]+$/.test(database ?? "")) {
  throw new Error("Dedicated offboarding identity review database required");
}
const state = JSON.parse(readFileSync(`${runtime}/private-stack-state.json`, "utf8"));
const connection = new URL(state.env.DB_URL);
if (connection.hostname !== "127.0.0.1") throw new Error("Loopback PostgreSQL required");
const env = { ...process.env, PGPASSWORD: connection.password };
const bin = `${process.env.RELEASE_PG_BIN ?? "/opt/homebrew/opt/postgresql@17/bin"}/psql`;
const args = ["-XAtq", "-v", "ON_ERROR_STOP=1", "-v", "VERBOSITY=verbose", "-h", connection.hostname,
  "-p", connection.port, "-U", connection.username, "-d", database];
const q = (value) => `'${String(value).replaceAll("'", "''")}'`;
const j = (value) => `${q(JSON.stringify(value))}::jsonb`;
const parse = (status, out, err) => ({ ok: status === 0, value: out.trim(), code: err.match(/ERROR:\s+([A-Z0-9]{5}):/)?.[1] });
function sql(input) {
  const result = spawnSync(bin, args, { env, input, encoding: "utf8", timeout: 15000, maxBuffer: 2 * 1024 * 1024 });
  return parse(result.status, result.stdout ?? "", result.stderr ?? "");
}
function need(input) {
  const result = sql(input);
  if (!result.ok) throw new Error(`Local SQLSTATE ${result.code ?? "connection/timeout"}`);
  return result.value;
}
function running(input, keepOpen = false) {
  let readyResolve;
  let child;
  const name = `offboard-review-${randomUUID()}`;
  const ready = new Promise((resolve) => { readyResolve = resolve; });
  const done = new Promise((resolve) => {
    child = spawn(bin, args, { env: { ...env, PGAPPNAME: name }, stdio: ["pipe", "pipe", "pipe"] });
    let out = "", err = "";
    const timeout = setTimeout(() => child.kill("SIGTERM"), 15000);
    child.stdout.on("data", (value) => { out += value; if (out.includes("LOCK_HELD")) readyResolve(); });
    child.stderr.on("data", (value) => { err += value; });
    child.on("close", (code) => { clearTimeout(timeout); readyResolve(); resolve(parse(code, out, err)); });
    if (keepOpen) child.stdin.write(input + "\n");
    else child.stdin.end(input);
  });
  return { ready, done, name, release: () => child.stdin.end("commit;\n") };
}
async function blockedBy(waiter, holder) {
  const deadline = Date.now() + 4000;
  while (Date.now() < deadline) {
    if (need(`select exists(select 1 from pg_stat_activity w join pg_stat_activity h on h.pid=any(pg_blocking_pids(w.pid)) where w.application_name=${q(waiter.name)} and h.application_name=${q(holder.name)} and w.wait_event_type='Lock')::text;`) === "true") return true;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  return false;
}
const service = "begin;set local statement_timeout='10s';set local role service_role;set local request.jwt.claim.role='service_role';";
const fixture = "begin;set local statement_timeout='10s';";
const hold = "select 'LOCK_HELD';";
let passed = 0, failed = 0;
const check = (label, ok) => { ok ? passed++ : failed++; console.log(`${ok ? "PASS" : "FAIL"}: ${label}`); };
const denied = (label, result, code = "PT403") => check(label, !result.ok && result.code === code);
const operator = randomUUID(), other = randomUUID(), adminA = randomUUID(), adminB = randomUUID();
const prefix = randomUUID().slice(0, 8);
const command = (actor, payload) => `select public.levytate_offboarding_command(${q(actor)},${j(payload)});`;
const beginCommand = (c) => command(adminB, { action: "begin_delete", caseId: c.caseId, requestId: c.beginRequest, expectedRevision: 4 });
const plan = (c, actor = adminA) => `select public.levytate_offboarding_disposal_plan(${q(actor)},${q(c.caseId)});`;
const inventoryDecision = (c) => need(`select a->>'delete' from public.levytate_tenant_offboarding_cases c cross join lateral jsonb_array_elements(c.auth_inventory) a where c.id=${q(c.caseId)} and a->>'id'=${q(c.subject)};`);

function memberInsert(c, kind, { subject = true, emailMatch = false, active = true, id = randomUUID() } = {}) {
  const email = emailMatch ? c.authEmail : `${randomUUID()}@example.invalid`;
  const auth = subject ? `${q(c.subject)},'bound',now()` : "null,'pending',null";
  return kind === "provider"
    ? `insert into public.levytate_provider_memberships(id,provider_id,email,role,active,auth_subject,auth_binding_status,auth_bound_at)
       values(${q(id)},${q(`synthetic-${prefix}`)},${q(email)},'Provider User',${active},${auth});`
    : `insert into public.levytate_users(id,organisation_id,email,role,access_level,active,auth_subject,auth_binding_status,auth_bound_at)
       values(${q(id)},${q(other)},${q(email)},'Apprenticeship Lead','beta_user',${active},${auth});`;
}

function prepareCase() {
  const c = { tenant: randomUUID(), member: randomUUID(), subject: randomUUID(), caseId: randomUUID(), beginRequest: randomUUID() };
  c.authEmail = `${c.subject}@example.invalid`;
  need(`${fixture}
    insert into auth.users(id,email,aud,role) values(${q(c.subject)},${q(c.authEmail)},'authenticated','authenticated');
    insert into public.levytate_organisations(id,name,slug,workspace_template,status)
      values(${q(c.tenant)},'Synthetic identity reservation tenant',${q(`reservation-${c.tenant}`)},'levytate-client-v1','Suspended');
    insert into public.levytate_users(id,organisation_id,email,role,access_level,active,auth_subject,auth_binding_status,auth_bound_at)
      values(${q(c.member)},${q(c.tenant)},${q(c.authEmail)},'Apprenticeship Lead','beta_user',false,${q(c.subject)},'bound',now());
    update public.levytate_users set email=${q(`retired-${c.subject}@example.invalid`)},auth_subject=null,auth_binding_status='pending',auth_bound_at=null where id=${q(c.member)};
    commit;`);
  const now = Date.now();
  const policy = { version: "levytate-offboarding-v1", approvalReference: "synthetic-policy-only", clientNoticeReference: "synthetic-notice-only",
    supportHandoverReference: "synthetic-handover-only", recoveryBoundaryReference: "synthetic-no-restore", dataOwnerUserId: adminA,
    serviceOwnerUserId: adminB, evidenceRetainUntil: new Date(now + 86400000 * 30).toISOString(),
    schedules: ["identity", "people", "applications", "learners", "finance", "catalogue", "files", "assessments", "lift", "support", "audit"]
      .map((dataClass) => ({ dataClass, retainUntil: new Date(now - 86400000).toISOString(), action: "delete", approvalReference: "synthetic-due" })) };
  need(service + command(adminA, { action: "request", caseId: c.caseId, requestId: randomUUID(), organisationId: c.tenant,
    purpose: "delete", policy, recipientPublicKey: "synthetic-public-key-".repeat(10), exportExpiresAt: new Date(now + 86400000).toISOString() })
    + command(adminB, { action: "approve", caseId: c.caseId, requestId: randomUUID(), expectedRevision: 1, approvalReference: "synthetic-independent-review" }) + "commit;");
  // Snapshot and envelope metadata are deliberately synthetic. No claim of encrypted delivery.
  const snapshot = JSON.parse(need(service + `select public.levytate_offboarding_snapshot(${q(adminA)},${q(c.caseId)});commit;`));
  need(service + command(adminA, { action: "record_export", caseId: c.caseId, requestId: randomUUID(), expectedRevision: 2,
    snapshotHash: snapshot.snapshotHash, storageInventory: snapshot.storageObjects,
    manifest: { organisationId: c.tenant, tables: [], storage: [] }, envelope: { version: "levytate-encrypted-export-v1", expiresAt: snapshot.expiresAt } })
    + `select public.levytate_offboarding_download(${q(adminA)},${q(c.caseId)});`
    + command(adminA, { action: "record_delivery", caseId: c.caseId, requestId: randomUUID(), expectedRevision: 3, reference: "synthetic-delivery-only" }) + "commit;");
  return c;
}

try {
  if (need("select current_setting('server_version_num')::int/10000;") !== "17") throw new Error("PostgreSQL 17 required");
  if (need("select count(*) from supabase_migrations.schema_migrations;") !== "0") throw new Error("Fresh local verifier ledger must remain empty");
  need(`${fixture}
    insert into public.levytate_organisations(id,name,slug,workspace_template,status) values
      (${q(operator)},'Synthetic independent operators',${q(`operators-${prefix}`)},'levytate-client-v1','Active'),
      (${q(other)},'Synthetic second tenant',${q(`other-${prefix}`)},'levytate-client-v1','Active');
    insert into public.levytate_users(id,organisation_id,email,role,access_level,active,auth_subject,auth_binding_status,auth_bound_at) values
      (${q(adminA)},${q(operator)},${q(`operator-a-${prefix}@example.invalid`)},'Platform Admin','beta_user',true,${q(randomUUID())},'bound',now()),
      (${q(adminB)},${q(operator)},${q(`operator-b-${prefix}@example.invalid`)},'Platform Admin','beta_user',true,${q(randomUUID())},'bound',now());commit;`);
  check("retired bindings cannot be altered by service or browser roles", need("select (not has_table_privilege('service_role','public.levytate_retired_auth_bindings','INSERT') and not has_table_privilege('authenticated','public.levytate_retired_auth_bindings','SELECT'))::text;") === "true");

  const sharedCases = [];
  for (const [kind, options, label] of [
    ["provider", { subject: true, active: true }, "active provider subject binding"],
    ["provider", { subject: false, emailMatch: true, active: false }, "inactive provider email reservation"],
    ["employer", { subject: true, active: true }, "second-tenant current subject binding"],
    ["employer", { subject: false, emailMatch: true, active: false }, "second-tenant inactive email reservation"],
  ]) {
    const c = prepareCase();
    sharedCases.push(c);
    need(fixture + memberInsert(c, kind, options) + "commit;");
    need(service + beginCommand(c) + "commit;");
    check(`${label} retains the Auth identity`, inventoryDecision(c) === "false");
    check(`${label} remains present in the authorised disposal plan`, JSON.parse(need(service + plan(c) + "commit;")).identities.some((a) => a.id === c.subject && a.delete === false));
  }

  const retainedProvider = sharedCases[0];
  need(service + `select public.levytate_offboarding_finish_delete(${q(adminB)},${q(retainedProvider.caseId)});commit;`);
  check("tenant SQL disposal preserves the shared provider identity and membership", need(`select (not exists(select 1 from public.levytate_organisations where id=${q(retainedProvider.tenant)}) and exists(select 1 from auth.users where id=${q(retainedProvider.subject)}) and exists(select 1 from public.levytate_provider_memberships where auth_subject=${q(retainedProvider.subject)} and active))::text;`) === "true");

  const revokedProvider = sharedCases[1];
  need(fixture + `update public.levytate_provider_memberships set email=${q(`retired-provider-${revokedProvider.subject}@example.invalid`)} where email=${q(revokedProvider.authEmail)};commit;`);
  check("removing a shared email association never escalates the captured plan to deletion", inventoryDecision(revokedProvider) === "false" && JSON.parse(need(service + plan(revokedProvider) + "commit;")).identities.some((a) => a.id === revokedProvider.subject && a.delete === false));

  const retired = prepareCase();
  need(fixture + memberInsert(retired, "employer") + `update public.levytate_users set email=${q(`changed-${retired.subject}@example.invalid`)},active=false,auth_subject=null,auth_binding_status='pending',auth_bound_at=null where organisation_id=${q(other)} and auth_subject=${q(retired.subject)};commit;`);
  need(service + beginCommand(retired) + "commit;");
  check("second-tenant retired subject is retained after revocation and email change", inventoryDecision(retired) === "false");

  for (const kind of ["employer", "provider"]) {
    for (const emailOnly of [false, true]) {
      const label = `${kind} ${emailOnly ? "email-only" : "subject"}`;
      const earlier = prepareCase();
      const binding = running(fixture + memberInsert(earlier, kind, { subject: !emailOnly, emailMatch: emailOnly }) + hold, true);
      await binding.ready;
      const deletion = running(service + beginCommand(earlier) + "commit;");
      check(`${label} begin_delete waits for the uncommitted binding`, await blockedBy(deletion, binding));
      binding.release();
      const [bound, begun] = await Promise.all([binding.done, deletion.done]);
      check(`${label} winning reservation race commits both transactions`, bound.ok && begun.ok);
      check(`${label} committed during lock wait is retained in refreshed inventory`, inventoryDecision(earlier) === "false");

      const later = prepareCase();
      const reservation = running(service + beginCommand(later) + hold, true);
      await reservation.ready;
      const lateBinding = running(fixture + memberInsert(later, kind, { subject: !emailOnly, emailMatch: emailOnly }) + "commit;");
      check(`${label} new binding waits for the uncommitted reservation`, await blockedBy(lateBinding, reservation));
      reservation.release();
      const [reserved, rejected] = await Promise.all([reservation.done, lateBinding.done]);
      check(`${label} disposal-first transaction commits an exclusive reservation`, reserved.ok && inventoryDecision(later) === "true");
      denied(`${label} concurrent identity reuse is denied after reservation`, rejected, "PT409");
      check(`${label} denied reuse leaves no second-tenant/provider binding`, need(`select (select count(*) from public.levytate_users where organisation_id=${q(other)} and (auth_subject=${q(later.subject)} or email=${q(later.authEmail)}))+(select count(*) from public.levytate_provider_memberships where auth_subject=${q(later.subject)} or email=${q(later.authEmail)});`) === "0");
    }
  }

  for (const kind of ["employer", "provider"]) {
    const c = prepareCase(), memberId = randomUUID();
    need(fixture + memberInsert(c, kind, { subject: false, id: memberId }) + "commit;");
    const reservation = running(service + beginCommand(c) + hold, true);
    await reservation.ready;
    const table = kind === "employer" ? "levytate_users" : "levytate_provider_memberships";
    const binding = running(fixture + `update public.${table} set auth_subject=${q(c.subject)},auth_binding_status='bound',auth_bound_at=now(),email=${q(c.authEmail)} where id=${q(memberId)};commit;`);
    check(`${kind} rebinding UPDATE waits for disposal reservation`, await blockedBy(binding, reservation));
    reservation.release();
    const [reserved, rejected] = await Promise.all([reservation.done, binding.done]);
    check(`${kind} existing membership cannot be rebound to a reserved identity`, reserved.ok && !rejected.ok && rejected.code === "PT409");
    check(`${kind} rejected rebind preserves the original pending membership`, need(`select (auth_subject is null and auth_binding_status='pending' and email<>${q(c.authEmail)})::text from public.${table} where id=${q(memberId)};`) === "true");
  }

  const onlyRetired = prepareCase();
  need(service + beginCommand(onlyRetired) + "commit;");
  check("sole retired target subject remains in disposal inventory after email change", inventoryDecision(onlyRetired) === "true");
  check("requester and independent approver can inspect current disposal", sql(service + plan(onlyRetired, adminA) + plan(onlyRetired, adminB) + "commit;").ok);
  const unrelated = randomUUID();
  need(fixture + `insert into public.levytate_users(id,organisation_id,email,role,access_level,active,auth_subject,auth_binding_status,auth_bound_at) values(${q(unrelated)},${q(operator)},${q(`operator-c-${prefix}@example.invalid`)},'Platform Admin','beta_user',true,${q(randomUUID())},'bound',now());commit;`);
  denied("unrelated platform administrator cannot execute this disposal", sql(service + plan(onlyRetired, unrelated) + "commit;"));

  for (const [actor, mutation, restore, label] of [
    [adminA, "active=false", "active=true", "requester revocation"],
    [adminB, "role='Apprenticeship Lead'", "role='Platform Admin'", "approver role change"],
  ]) {
    const revoke = running(fixture + `update public.levytate_users set ${mutation} where id=${q(actor)};` + hold, true);
    await revoke.ready;
    const disposal = running(service + plan(onlyRetired, actor === adminA ? adminB : adminA) + "commit;");
    check(`${label} next disposal step waits for the authority row`, await blockedBy(disposal, revoke));
    revoke.release();
    const [revoked, stopped] = await Promise.all([revoke.done, disposal.done]);
    check(`${label} commits while the next disposal step waits`, revoked.ok);
    denied(`${label} denies the other executor's next disposal plan after wait`, stopped);
    need(fixture + `update public.levytate_users set ${restore} where id=${q(actor)};commit;`);
  }

  const frozen = prepareCase();
  need(fixture + `update public.levytate_users set active=false where id=${q(adminA)};commit;`);
  denied("begin_delete revalidates the other approving actor", sql(service + beginCommand(frozen) + "commit;"));
  check("revoked approval cannot create a partial deletion reservation or receipt", need(`select status||':'||revision||':'||(auth_inventory is null)::text||':'||(select count(*) from public.levytate_tenant_offboarding_commands where request_id=${q(frozen.beginRequest)}) from public.levytate_tenant_offboarding_cases where id=${q(frozen.caseId)};`) === "exported:4:true:0");
  need(fixture + `update public.levytate_users set active=true where id=${q(adminA)};commit;`);
  check("all synthetic Auth rows remain; no Auth API disposal performed", need(`select (not exists(select 1 from public.levytate_tenant_offboarding_cases c cross join lateral jsonb_array_elements(c.auth_inventory) a left join auth.users u on u.id=(a->>'id')::uuid where u.id is null))::text;`) === "true");
  check("no Storage objects or fabricated migration rows created", need("select (select count(*) from storage.objects)||':'||(select count(*) from supabase_migrations.schema_migrations);") === "0:0");
} catch (error) {
  failed++;
  console.error(`FAIL: independent offboarding execution: ${error.message}`);
}
console.log(JSON.stringify({ suite: "offboarding-auth-reservations", passed, failed, database, hosted: false, authApiDisposal: false }));
if (failed) process.exitCode = 1;
