/** Independent real PostgreSQL tests. Local disposable databases only. */
import { spawn, spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";

const host = process.env.RELEASE_PGHOST;
const database = process.env.RELEASE_PGDATABASE;
if (!(host === "127.0.0.1" || host === "localhost" || host?.startsWith("/private/tmp/")) || !/^levytate_release_[a-z0-9_]+$/.test(database ?? "")) {
  console.error("BLOCKED: a dedicated loopback levytate_release_* database is required"); process.exit(2);
}
const args = ["-X", "-A", "-t", "-q", "-v", "ON_ERROR_STOP=1", "-v", "VERBOSITY=verbose", "-h", host, "-p", process.env.RELEASE_PGPORT ?? "5432", "-U", process.env.RELEASE_PGUSER ?? "postgres", "-d", database];
const psql = process.env.RELEASE_PSQL ?? "psql";
const literal = (value) => `'${String(value).replaceAll("'", "''")}'`;
const json = (value) => `${literal(JSON.stringify(value))}::jsonb`;
let passed = 0, failed = 0;
const check = (label, condition) => { condition ? passed++ : failed++; console.log(`${condition ? "PASS" : "FAIL"} ${label}`); };
function sql(statement) {
  const result = spawnSync(psql, args, { input: statement, encoding: "utf8" });
  return { ok: result.status === 0, value: result.stdout.trim(), code: result.stderr.match(/ERROR:\s+([A-Z0-9]{5}):/)?.[1] ?? null };
}
function required(statement) { const result = sql(statement); if (!result.ok) throw new Error(`Fixture SQL failed (${result.code ?? "connection"})`); return result.value; }
function concurrent(statement) {
  return new Promise((resolve) => {
    const child = spawn(psql, args, { stdio: ["pipe", "pipe", "pipe"] });
    let output = "", error = "";
    child.stdout.on("data", (data) => { output += data; }); child.stderr.on("data", (data) => { error += data; });
    child.on("close", (code) => resolve({ ok: code === 0, value: output.trim(), code: error.match(/ERROR:\s+([A-Z0-9]{5}):/)?.[1] ?? null }));
    child.stdin.end(statement);
  });
}

const org = randomUUID(), otherOrg = randomUUID(), catalog = randomUUID();
const ids = Object.fromEntries(["employee", "manager", "lead", "otherManager", "admin", "platform", "otherLead"].map((name) => [name, randomUUID()]));
const prefix = randomUUID().slice(0, 8);
const person = `${prefix}-employee`, manager = `${prefix}-manager`, outsider = `${prefix}-other-manager`;
const standard = `ST-${prefix}`, programme = `programme-${prefix}`, provider = `provider-${prefix}`, role = `role-${prefix}`;
const email = (name) => `${prefix}.${name}@example.test`;
const member = (name, userRole, tenant = org) => `(${literal(ids[name])},${literal(tenant)},${literal(email(name))},${literal(userRole)},'beta_user',true)`;
function command(actor, app, action, revision, key, fields = {}) {
  return `select public.levytate_apply_application_command(${literal(org)}::uuid,${literal(ids[actor])}::uuid,${literal(app)},${literal(action)},${revision},${literal(key)},${json(fields)});`;
}
function deny(label, statement, states = ["PT403", "PT409", "PT422", "23505", "42501"]) {
  const result = sql(`begin; set local role service_role; ${statement} rollback;`);
  check(label, !result.ok && states.includes(result.code));
}
function call(actor, app, action, revision, key, fields) {
  return JSON.parse(required(`begin; set local role service_role; ${command(actor, app, action, revision, key, fields)} commit;`));
}

try {
  const version = required("show server_version;");
  console.log(`Environment: local PostgreSQL ${version}; durable SQL and RPC tests, no browser/Auth claim`);
  required(`
    insert into public.levytate_organisations(id,name,slug,workspace_template,status) values
      (${literal(org)},'Synthetic A',${literal(`release-${prefix}-a`)},'levytate-client-v1','Active'),
      (${literal(otherOrg)},'Synthetic B',${literal(`release-${prefix}-b`)},'levytate-client-v1','Active');
    insert into public.levytate_users(id,organisation_id,email,role,access_level,active) values
      ${member("employee", "Employee")},${member("manager", "Line Manager")},${member("lead", "Apprenticeship Lead")},
      ${member("otherManager", "Line Manager")},${member("admin", "Employer Admin")},${member("platform", "Platform Admin")},${member("otherLead", "Apprenticeship Lead", otherOrg)};
    insert into public.levytate_employees(organisation_id,id,employee_number,name,email,platform_role,start_date,manager_id,role_id) values
      (${literal(org)},${literal(manager)},'M','Synthetic Manager',${literal(email("manager"))},'Line Manager','2026-01-01','',''),
      (${literal(org)},${literal(outsider)},'X','Synthetic Other Manager',${literal(email("otherManager"))},'Line Manager','2026-01-01','',''),
      (${literal(org)},${literal(person)},'E','Synthetic Employee',${literal(email("employee"))},'Employee','2026-01-01',${literal(manager)},${literal(role)}),
      (${literal(otherOrg)},${literal(person)},'E','Synthetic Other Employee',${literal(`${prefix}.otheremployee@example.test`)},'Employee','2026-01-01','','');
  `);
  const appRow = (id, status = "Draft", tenant = org) => `insert into public.levytate_applications(organisation_id,id,employee_id,apprenticeship_standard_id,status,current_owner) values (${literal(tenant)},${literal(id)},${literal(person)},${literal(standard)},${literal(status)},'Employee');`;
  const races = await Promise.all(["race-a", "race-b"].map((id) => concurrent(`begin; select pg_sleep(0.15); ${appRow(`${prefix}-${id}`)} commit;`)));
  check("two concurrent active creates yield one durable row and one uniqueness conflict", races.filter((item) => item.ok).length === 1 && races.some((item) => item.code === "23505"));
  check("race persisted exactly one active row", required(`select count(*) from public.levytate_applications where organisation_id=${literal(org)};`) === "1");
  check("other tenant can independently create for the same employee identifier", sql(appRow(`${prefix}-tenant-b`, "Draft", otherOrg)).ok);
  required(appRow(`${prefix}-closed`, "Cancelled"));
  const reopen = sql(`update public.levytate_applications set status='Draft' where organisation_id=${literal(org)} and id=${literal(`${prefix}-closed`)};`);
  check("reopen cannot create a second active application", !reopen.ok && reopen.code === "23505");
  required(`delete from public.levytate_applications where organisation_id in (${literal(org)},${literal(otherOrg)});`);
  required(appRow(`${prefix}-information`, "More information requested"));
  const secondDraft = sql(appRow(`${prefix}-second`));
  check("information-requested application still occupies the active slot", !secondDraft.ok && secondDraft.code === "23505");
  required(`delete from public.levytate_applications where organisation_id=${literal(org)};`);

  const rpc = required("select count(*) from pg_proc where proname='levytate_apply_application_command';") === "1";
  check("authoritative transaction command RPC exists", rpc);
  if (rpc) {
    const catalogId = required(`select id from public.levytate_organisations where slug='levytate-internal';`) || catalog;
    if (catalogId === catalog) required(`insert into public.levytate_organisations(id,name,slug) values(${literal(catalog)},'Synthetic catalogue','levytate-internal');`);
    required(`
      insert into public.levytate_roles(organisation_id,id,title,career_level) values(${literal(org)},${literal(role)},'Synthetic role','Mixed');
      insert into public.levytate_role_pathway_mappings(organisation_id,id,role_id,apprenticeship_standard_id,recommendation_type) values(${literal(org)},${literal(`mapping-${prefix}`)},${literal(role)},${literal(standard)},'Primary');
      insert into public.levytate_providers(organisation_id,provider_id,provider_name,provider_type,status,verification_status) values(${literal(catalogId)},${literal(provider)},'Synthetic provider','Independent training provider','Active','verified');
      insert into public.levytate_provider_programmes(organisation_id,id,provider_id,apprenticeship_standard_id,linked_standard_id,status,record_status,verification_status) values(${literal(catalogId)},${literal(programme)},${literal(provider)},${literal(standard)},${literal(standard)},'Active','Active','LevyTate reviewed');
      insert into public.levytate_organisation_providers(organisation_id,provider_id,status) values(${literal(org)},${literal(provider)},'Active');
      insert into public.levytate_organisation_programmes(organisation_id,programme_id,provider_id,status) values(${literal(org)},${literal(programme)},${literal(provider)},'Active');
    `);
    const app = `${prefix}-journey`;
    const fields = { employeeId: person, apprenticeshipStandardId: standard, reason: "Synthetic work need", careerGoal: "Synthetic development", supportRequired: "" };
    deny("browser status and owner cannot forge final approval", command("lead", app, "save_draft", 0, "forged-fields-001", { ...fields, status: "Approved for Enrolment", currentOwner: "Provider Partner" }));
    deny("cross-tenant actor rejected", command("otherLead", app, "save_draft", 0, "cross-tenant-001", fields));
    deny("Platform Admin cannot perform employer decisions", command("platform", app, "save_draft", 0, "platform-deny-001", fields));
    const saved = call("employee", app, "save_and_submit", 0, "employee-submit-001", fields);
    check("employee submission persists manager step with revision", saved.application.status === "Awaiting Manager Review" && saved.application.current_owner === "Line Manager" && saved.application.revision === 1);
    for (const actor of ["lead", "admin", "otherManager", "employee"]) deny(`${actor} cannot skip or impersonate current manager`, command(actor, app, "approve", 1, `manager-skip-${actor}`, { note: "Synthetic decision" }));
    deny("stale manager decision rejected", command("manager", app, "approve", 0, "stale-manager-001", { note: "Synthetic decision" }));
    const managerFields = { note: "Synthetic manager approval" };
    const approved = call("manager", app, "approve", 1, "manager-approve-001", managerFields);
    const repeated = call("manager", app, "approve", 1, "manager-approve-001", managerFields);
    check("lost-response retry returns identical persisted result", JSON.stringify(approved) === JSON.stringify(repeated));
    check("manager approval advances to lead only", approved.application.status === "Awaiting Final Approval" && approved.application.current_owner === "Apprenticeship Lead" && approved.application.revision === 2);
    check("retry produces one decision history row", required(`select count(*) from public.levytate_application_history where organisation_id=${literal(org)} and application_id=${literal(app)};`) === "2");
    deny("same idempotency key with changed decision rejected", command("manager", app, "decline", 1, "manager-approve-001", managerFields));
    deny("manager cannot final approve", command("manager", app, "approve", 2, "manager-final-001", { note: "Synthetic decision" }));
    const final = call("lead", app, "approve", 2, "lead-approve-001", { note: "Synthetic lead approval" });
    check("Lead final approval follows manager and persists", final.application.status === "Approved for Enrolment" && final.application.revision === 3);
    deny("final approval cannot be reversed or reapproved", command("lead", app, "approve", 3, "lead-reverse-001", { note: "Synthetic reversal" }));
    deny("service credential cannot bypass command boundary with direct UPDATE", `update public.levytate_applications set status='Draft' where organisation_id=${literal(org)} and id=${literal(app)};`);
    for (const roleName of ["anon", "authenticated"]) {
      const result = sql(`begin; set local role ${roleName}; ${command("lead", app, "approve", 3, `browser-${roleName}`, {})} rollback;`);
      check(`${roleName} cannot execute privileged command`, !result.ok && result.code === "42501");
    }
  }
} catch (error) {
  failed++; console.error(`FAIL independent database execution: ${error.message}`);
}
// Fixtures intentionally remain in the isolated disposable database for review.
// No automatic reset, hosted writes, or silent history cleanup occurs.
console.log(`Independent database integrity: ${passed} PASS, ${failed} FAIL`);
if (failed) process.exitCode = 1;
