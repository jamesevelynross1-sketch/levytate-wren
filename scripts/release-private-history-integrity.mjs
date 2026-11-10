/** Independent PG17 private-history races. Synthetic ciphertext; no live activation. */
import { readFileSync } from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
const root = process.env.RELEASE_LOCAL_RUNTIME, database = process.env.RELEASE_TEST_DATABASE;
if (!/^\/private\/tmp\/levytate-release-runtime\.[A-Za-z0-9]+$/.test(root ?? "") || !/^levytate_release_support_[a-z0-9_]+$/.test(database ?? "")) throw new Error("Dedicated local support verifier required");
const db = new URL(JSON.parse(readFileSync(`${root}/private-stack-state.json`, "utf8")).env.DB_URL);
if (db.hostname !== "127.0.0.1") throw new Error("Loopback required");
const env = { ...process.env, PGHOST: db.hostname, PGPORT: db.port, PGUSER: db.username, PGPASSWORD: db.password, PGDATABASE: database };
const bin = "/opt/homebrew/opt/postgresql@17/bin/psql", args = ["-XAtq", "-v", "ON_ERROR_STOP=1", "-v", "VERBOSITY=verbose"];
const parse = (status, out, err) => ({ ok: status === 0, value: out.trim(), code: err.match(/ERROR:\s+([A-Z0-9]{5}):/)?.[1] });
const sql = input => { const r = spawnSync(bin, args, { env, input, encoding: "utf8" }); return parse(r.status, r.stdout, r.stderr); };
const need = input => { const r = sql(input); if (!r.ok) throw new Error(`Local SQLSTATE ${r.code ?? "connection"}`); return r.value; };
const parallel = input => new Promise(resolve => { const p = spawn(bin, args, { env, stdio: ["pipe", "pipe", "pipe"] }); let out = "", err = ""; p.stdout.on("data", c => out += c); p.stderr.on("data", c => err += c); p.on("close", code => resolve(parse(code, out, err))); p.stdin.end(input); });
const q = v => `'${String(v).replaceAll("'", "''")}'`, j = v => `${q(JSON.stringify(v))}::jsonb`;
const org = randomUUID(), other = randomUUID(), owner = randomUUID(), lead = randomUUID(), employee = `private-${randomUUID().slice(0, 8)}`;
const tx = input => `begin;set local role service_role;set local request.jwt.claim.role='service_role';${input}commit;`;
const rpc = (body, actor = owner, tenant = org) => `select public.levytate_pastoral_history_command(${q(tenant)},${q(actor)},${q(employee)},${j(body)});`;
const call = body => JSON.parse(need(tx(rpc(body))));
const preference = (version, saving) => ({ action: "preference", request_hmac: (saving ? "a" : "b").repeat(64), expected_version: version, save_history: saving, retention_days: 30 });
const exchange = (key, conversation = null, sequence = 0, consent = 1) => ({ action: "exchange", request_hmac: "c".repeat(64), client_message_id: key, conversation_id: conversation, new_conversation_id: randomUUID(), expected_sequence: sequence, expected_preference_version: consent, policy_version: "pastoral-support-v1", messages: ["a", "b"].map(c => ({ ciphertext: c.repeat(32), nonce: "n".repeat(16), authenticationTag: "t".repeat(22), keyVersion: "synthetic-v1" })) });
const probe = key => ({ action: "probe_exchange", request_hmac: "c".repeat(64), client_message_id: key, conversation_id: null });
let passed = 0, failed = 0;
const check = (name, pass) => { pass ? passed++ : failed++; console.log(`${pass ? "PASS" : "FAIL"} ${name}`); };
const reject = (name, body, codes, actor = owner, tenant = org) => { const r = sql(tx(rpc(body, actor, tenant))); check(name, !r.ok && codes.includes(r.code)); };
async function afterPeopleLock(statement, lock = `select pg_advisory_xact_lock(hashtextextended('levytate-people:'||${q(org)}::text,0));`) {
  let mark; const locked = new Promise(resolve => mark = resolve);
  const holder = new Promise(resolve => {
    const p = spawn(bin, args, { env, stdio: ["pipe", "pipe", "pipe"] }); let out = "", err = "";
    p.stdout.on("data", c => { out += c; if (out.includes("LOCKED")) mark(); }); p.stderr.on("data", c => err += c);
    p.on("close", code => { mark(); resolve(parse(code, out, err)); });
    p.stdin.end(`begin;${lock}select 'LOCKED';select pg_sleep(2);commit;`);
  });
  await locked; const result = await parallel(statement); const held = await holder;
  if (!held.ok) throw new Error("Synthetic lock holder failed"); return result;
}
try {
  need(`insert into public.levytate_organisations(id,name,slug,status)values(${q(org)},'Synthetic private owner',${q(employee)},'Active'),(${q(other)},'Synthetic other private tenant',${q(`${employee}-other`)},'Active');
    insert into public.levytate_employees(organisation_id,id,employee_number,name,email,platform_role,status,start_date)values(${q(org)},${q(employee)},${q(employee)},'Synthetic adult',${q(`${employee}@example.test`)},'Employee','Active',current_date);
    insert into public.levytate_users(id,organisation_id,email,role,active,access_level)values(${q(owner)},${q(org)},${q(`${employee}@example.test`)},'Employee',true,'beta_user'),(${q(lead)},${q(org)},${q(`${employee}-lead@example.test`)},'Apprenticeship Lead',true,'beta_user');
    insert into public.levytate_organisation_capabilities(organisation_id,pastoral_support_enabled)values(${q(org)},true);
    insert into public.levytate_pastoral_access_eligibility(organisation_id,employee_id,owner_user_id,age_assurance_status,active,approved_by,approved_at,expires_at)values(${q(org)},${q(employee)},${q(owner)},'adult',true,${q(lead)},now(),now()+interval '1 day');`);
  const consentRace = await Promise.all([0, 1].map(() => parallel(tx(rpc(preference(0, true))))));
  check("simultaneous consent retries persist one version and one audit", consentRace.every(r => r.ok) && consentRace.map(r => JSON.parse(r.value)).filter(r => r.replayed).length === 1 && need(`select count(*) from public.levytate_pastoral_audit_events where organisation_id=${q(org)} and entity_type='preference';`) === "1");
  const first = exchange("first-concurrent");
  const firstRace = await Promise.all([0, 1].map(() => parallel(tx(rpc(first)))));
  const initial = firstRace.filter(r => r.ok).map(r => JSON.parse(r.value));
  check("two simultaneous initial exchanges persist one complete pair", initial.length === 2 && initial.filter(r => r.replayed).length === 1 && need(`select count(*) from public.levytate_pastoral_messages where organisation_id=${q(org)};`) === "2");
  const conversation = initial[0].conversationId;
  const appendRace = await Promise.all(["parallel-one", "parallel-two"].map(k => parallel(tx(rpc(exchange(k, conversation, 2))))));
  check("different concurrent messages at one sequence produce one winner", appendRace.filter(r => r.ok).length === 1 && appendRace.some(r => r.code === "PT409") && need(`select last_sequence_number from public.levytate_pastoral_conversations where id=${q(conversation)};`) === "4");
  check("receipt contains only non-content result fields", need(`select bool_and(result - array['conversationId','sequence','preferenceVersion','deleted']='{}'::jsonb)::text from public.levytate_pastoral_history_receipts where organisation_id=${q(org)};`) === "true");
  reject("changed HMAC cannot read a saved assistant reply", { ...probe("first-concurrent"), request_hmac: "d".repeat(64) }, ["PT409"]);
  reject("Lead cannot use owner history command", probe("first-concurrent"), ["PT403"], lead);
  reject("cross-tenant owner cannot use history command", probe("first-concurrent"), ["PT403"], owner, other);
  call(preference(1, false)); call(preference(2, true));
  reject("off then on invalidates a previously prepared assistant turn", exchange("stale-consent", conversation, 4), ["PT409"]);
  need(`update public.levytate_users set role='Line Manager' where id=${q(owner)};`);
  reject("changed membership role blocks old receipt replay", probe("first-concurrent"), ["PT403"]);
  need(`update public.levytate_users set role='Employee' where id=${q(owner)};`);
  need(`update public.levytate_pastoral_access_eligibility set expires_at=clock_timestamp()+interval '1 second' where organisation_id=${q(org)};`);
  const expiredEligibility = await afterPeopleLock(tx(rpc(probe("first-concurrent"))));
  check("eligibility expiring while waiting for a lock denies saved reply", !expiredEligibility.ok && expiredEligibility.code === "PT403");
  need(`update public.levytate_pastoral_access_eligibility set expires_at=clock_timestamp()+interval '1 day' where organisation_id=${q(org)};update public.levytate_pastoral_conversations set retention_expires_at=clock_timestamp()+interval '1 second' where id=${q(conversation)};`);
  const expiredConversation = await afterPeopleLock(tx(rpc(probe("first-concurrent"))));
  check("retention expiring while waiting for a lock denies saved reply", !expiredConversation.ok && expiredConversation.code === "PT404");
  need(`update public.levytate_pastoral_conversations set retention_expires_at=clock_timestamp()+interval '1 day' where id=${q(conversation)};update public.levytate_pastoral_access_eligibility set expires_at=clock_timestamp()+interval '1 second' where organisation_id=${q(org)};`);
  const eligibilityRowWait = await afterPeopleLock(tx(rpc(probe("first-concurrent"))), `select id from public.levytate_pastoral_access_eligibility where organisation_id=${q(org)} for update;`);
  check("eligibility row-lock wait cannot extend adult approval", !eligibilityRowWait.ok && eligibilityRowWait.code === "PT403");
  need(`update public.levytate_pastoral_access_eligibility set expires_at=clock_timestamp()+interval '1 day' where organisation_id=${q(org)};update public.levytate_pastoral_conversations set retention_expires_at=clock_timestamp()+interval '1 second' where id=${q(conversation)};`);
  const conversationRowWait = await afterPeopleLock(tx(rpc(probe("first-concurrent"))), `select id from public.levytate_pastoral_conversations where id=${q(conversation)} for update;`);
  check("conversation row-lock wait cannot extend retention", !conversationRowWait.ok && conversationRowWait.code === "PT404");
  const delay = `release_private_delay_${employee.replaceAll("-", "_")}`;
  need(`create function public.${delay}() returns trigger language plpgsql as $$begin if new.organisation_id=${q(org)}::uuid then perform pg_sleep(2);end if;return new;end;$$;create trigger ${delay} before insert on public.levytate_pastoral_audit_events for each row execute function public.${delay}();`);
  try {
    need(`update public.levytate_pastoral_access_eligibility set expires_at=clock_timestamp()+interval '1 second' where organisation_id=${q(org)};`);
    const lateConsent = sql(tx(rpc(preference(3, false))));
    check("eligibility expiry during audit rolls back consent and receipt", !lateConsent.ok && lateConsent.code === "PT403" && need(`select (save_history and lock_version=3)::text from public.levytate_pastoral_preferences where organisation_id=${q(org)};`) === "true" && need(`select count(*) from public.levytate_pastoral_history_receipts where organisation_id=${q(org)} and request_key='preference:3';`) === "0");
    need(`update public.levytate_pastoral_access_eligibility set expires_at=clock_timestamp()+interval '1 day' where organisation_id=${q(org)};update public.levytate_pastoral_conversations set retention_expires_at=clock_timestamp()+interval '1 second' where id=${q(conversation)};`);
    const lateAppend = sql(tx(rpc(exchange("late-audit-append", conversation, 4, 3))));
    check("retention expiry during audit rolls back both messages and sequence", !lateAppend.ok && lateAppend.code === "PT404" && need(`select count(*) from public.levytate_pastoral_messages where organisation_id=${q(org)};`) === "4" && need(`select last_sequence_number from public.levytate_pastoral_conversations where id=${q(conversation)};`) === "4");
  } finally { need(`drop trigger ${delay} on public.levytate_pastoral_audit_events;drop function public.${delay}();`); }
  const deletion = { action: "delete", request_hmac: "e".repeat(64), conversation_id: conversation };
  const deleteRace = await Promise.all([0, 1].map(() => parallel(tx(rpc(deletion)))));
  check("concurrent owner deletion leaves one tombstone and no ciphertext", deleteRace.every(r => r.ok) && deleteRace.filter(r => JSON.parse(r.value).replayed).length === 1 && need(`select count(*) from public.levytate_pastoral_messages where organisation_id=${q(org)};`) === "0");
  reject("replayed old exchange cannot recreate deleted ciphertext", first, ["PT404"]);
  for (const role of ["anon", "authenticated"]) { const r = sql(`begin;set local role ${role};${rpc(probe("first-concurrent"))}rollback;`); check(`${role} cannot invoke history RPC`, !r.ok && r.code === "42501"); }
  check("service role cannot bypass receipt privacy or message writer", need("select (not has_table_privilege('service_role','public.levytate_pastoral_history_receipts','select') and not has_table_privilege('service_role','public.levytate_pastoral_messages','insert'))::text;") === "true");
  check("038 objects remain absent", need("select (to_regclass('public.levytate_pastoral_support_actions') is null)::text;") === "true");
} catch (error) { failed++; console.error(`FAIL independent private history execution: ${error.message}`); }
console.log(`Independent private history integrity: ${passed} PASS, ${failed} FAIL`);
if (failed) process.exitCode = 1;
