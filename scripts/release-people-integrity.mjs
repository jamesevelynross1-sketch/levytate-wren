/** Independent atomic People import and hierarchy tests; disposable local DB only. */
import { spawnSync, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
const host = process.env.RELEASE_PGHOST, database = process.env.RELEASE_PGDATABASE;
if (!(host === "127.0.0.1" || host === "localhost" || host?.startsWith("/private/tmp/")) || !/^levytate_release_[a-z0-9_]+$/.test(database ?? "")) { console.error("BLOCKED dedicated loopback verifier DB required"); process.exit(2); }
const args = ["-X", "-A", "-t", "-q", "-v", "ON_ERROR_STOP=1", "-v", "VERBOSITY=verbose", "-h", host, "-p", process.env.RELEASE_PGPORT ?? "5432", "-U", process.env.RELEASE_PGUSER ?? "postgres", "-d", database];
const binary = process.env.RELEASE_PSQL ?? "psql";
const q = (s) => `'${String(s).replaceAll("'", "''")}'`;
const j = (s) => `${q(JSON.stringify(s))}::jsonb`;
const result = (code, out, err) => ({ ok: code === 0, value: out.trim(), code: err.match(/ERROR:\s+([A-Z0-9]{5}):/)?.[1] });
const sql = (input) => { const r = spawnSync(binary, args, { input, encoding: "utf8" }); return result(r.status, r.stdout, r.stderr); };
const need = (input) => { const r = sql(input); if (!r.ok) throw new Error(`SQLSTATE ${r.code ?? "connection"}`); return r.value; };
const concurrent = (input) => new Promise((resolve) => { const p = spawn(binary, args, { stdio: ["pipe", "pipe", "pipe"] }); let out = "", err = ""; p.stdout.on("data", (s) => { out += s; }); p.stderr.on("data", (s) => { err += s; }); p.on("close", (code) => resolve(result(code, out, err))); p.stdin.end(input); });
let passed = 0, failed = 0;
const check = (name, condition) => { condition ? passed++ : failed++; console.log(`${condition ? "PASS" : "FAIL"} ${name}`); };
const deny = (name, input, states = ["PT403", "PT409", "PT422", "23505", "42501"]) => { const r = sql(`begin;set local role service_role;${input}commit;`); check(name, !r.ok && states.includes(r.code)); };
const org = randomUUID(), other = randomUUID(), lead = randomUUID(), foreign = randomUUID(), employee = randomUUID(), prefix = randomUUID().slice(0, 8);
const role = `${prefix}-role`, manager = `${prefix}-manager`, report = `${prefix}-report`;
const row = (id, extra = {}) => ({ id, employee_number: id, name: `Synthetic ${id}`, email: `${id}@example.test`, role_id: role, platform_role: "Employee", status: "Active", start_date: "2026-01-01", job_title: "Synthetic role", department: "Synthetic", ...extra });
const command = (rows, key = randomUUID(), actor = lead) => `select public.levytate_import_people(${q(org)}::uuid,${q(actor)}::uuid,${q(key)}::uuid,${j(rows)});`;
try {
  console.log(`Environment local PostgreSQL ${need("show server_version;")}`);
  need(`insert into public.levytate_organisations(id,name,slug,status) values(${q(org)},'Synthetic People A',${q(`people-${prefix}-a`)},'Active'),(${q(other)},'Synthetic People B',${q(`people-${prefix}-b`)},'Active');
  insert into public.levytate_users(id,organisation_id,email,role,access_level,active) values(${q(lead)},${q(org)},${q(`${prefix}.lead@example.test`)},'Apprenticeship Lead','beta_user',true),(${q(employee)},${q(org)},${q(`${prefix}.employee@example.test`)},'Employee','beta_user',true),(${q(foreign)},${q(other)},${q(`${prefix}.foreign@example.test`)},'Apprenticeship Lead','beta_user',true);
  insert into public.levytate_roles(organisation_id,id,title,career_level,status) values(${q(org)},${q(role)},'Synthetic role','Mixed','Active'),(${q(other)},${q(`${prefix}-foreign-role`)},'Foreign role','Mixed','Active');`);
  const rows = [row(report, { manager_id: manager }), row(manager, { platform_role: "Line Manager" })], key = randomUUID();
  const races = await Promise.all([1, 2].map(() => concurrent(`begin;set local role service_role;${command(rows, key)}commit;`)));
  check("manager later in CSV succeeds atomically under concurrent retry", races.every((r) => r.ok) && races.map((r) => JSON.parse(r.value).replayed).sort().join(",") === "false,true");
  check("one import receipt and two People persisted", need(`select (select count(*) from public.levytate_employees where organisation_id=${q(org)})||':'||(select count(*) from public.levytate_people_import_receipts where organisation_id=${q(org)});`) === "2:1");
  deny("changed payload cannot reuse import key", command([row(`${prefix}-changed`)], key));
  deny("Employee cannot import People", command([row(`${prefix}-employee-denied`)], randomUUID(), employee));
  deny("foreign tenant Lead cannot import People", command([row(`${prefix}-foreign-denied`)], randomUUID(), foreign));
  deny("duplicate normalized email aborts whole batch", command([row(`${prefix}-new`), row(`${prefix}-dupe`, { email: `${report.toUpperCase()}@EXAMPLE.TEST` })]));
  check("failed batch leaves no partial rows", need(`select count(*) from public.levytate_employees where organisation_id=${q(org)};`) === "2");
  deny("duplicate normalized employee number denied", command([row(`${prefix}-number`, { employee_number: `  ${report.toUpperCase()} ` })]));
  deny("missing manager denied", command([row(`${prefix}-missing`, { manager_id: "missing" })]));
  deny("cross-tenant role denied", command([row(`${prefix}-foreign`, { role_id: `${prefix}-foreign-role` })]));
  deny("self management denied", command([row(`${prefix}-self`, { platform_role: "Line Manager", manager_id: `${prefix}-self` })]));
  deny("two-row reporting cycle denied", command([row(`${prefix}-cycle1`, { platform_role: "Line Manager", manager_id: `${prefix}-cycle2` }), row(`${prefix}-cycle2`, { platform_role: "Line Manager", manager_id: `${prefix}-cycle1` })]));
  deny("non-manager cannot receive direct reports", command([row(`${prefix}-not-manager`, { manager_id: report })]));
  deny("archived manager cannot receive active reports", command([row(`${prefix}-archived`, { platform_role: "Line Manager", status: "Archived" }), row(`${prefix}-active`, { manager_id: `${prefix}-archived` })]));
  deny("archiving manager with active reports is denied", `update public.levytate_employees set status='Archived' where organisation_id=${q(org)} and id=${q(manager)};`);
  deny("archiving a referenced active role is denied", `update public.levytate_roles set status='Archived' where organisation_id=${q(org)} and id=${q(role)};`);
  deny("moving People between tenants is denied", `update public.levytate_employees set organisation_id=${q(other)} where organisation_id=${q(org)} and id=${q(report)};`);
  deny("invalid calendar date denied", command([row(`${prefix}-date`, { start_date: "2026-02-30" })]));
  deny("unknown People field denied", command([row(`${prefix}-unknown`, { privilege: "admin" })]));
  deny("null field denied", command([row(`${prefix}-null`, { name: null })]));
  deny("empty batch denied", command([]));
  deny("oversized batch denied", command(Array.from({ length: 501 }, (_, n) => row(`${prefix}-oversize-${n}`))));
  deny("missing department denied", command([row(`${prefix}-department`, { department: "" })]));
  const unmatched = JSON.parse(need(`begin;set local role service_role;${command([row(`${prefix}-unmatched`, { role_id: "" })])}commit;`));
  check("Match Later blank role is accepted without inventing role assignment", unmatched.importedCount === 1);
  for (const browserRole of ["anon", "authenticated"]) { const r = sql(`begin;set local role ${browserRole};${command([row(`${prefix}-${browserRole}`)])}rollback;`); check(`${browserRole} cannot execute People importer`, !r.ok && r.code === "42501"); }
} catch (error) { failed++; console.error(`FAIL independent People execution ${error.message}`); }
console.log(`Independent People integrity: ${passed} PASS, ${failed} FAIL`);
if (failed) process.exitCode = 1;
