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
    insert into public.levytate_apprenticeship_standards(id,title,reference_code,status,level,occupational_route) values(${literal(standard)},'Synthetic standard',${literal(standard)},'Approved for delivery',4,'Synthetic');
    insert into public.levytate_roles(organisation_id,id,title,career_level) values(${literal(org)},${literal(role)},'Synthetic role','Experienced');
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
      insert into public.levytate_role_pathway_mappings(organisation_id,id,role_id,apprenticeship_standard_id,recommendation_type) values(${literal(org)},${literal(`mapping-${prefix}`)},${literal(role)},${literal(standard)},'Primary');
      insert into public.levytate_providers(organisation_id,provider_id,provider_name,provider_type,status,verification_status,last_verified,source_urls) values(${literal(catalogId)},${literal(provider)},'Synthetic provider','Independent training provider','Active','verified',current_date,'["https://example.test/synthetic-provider"]');
      insert into public.levytate_provider_programmes(organisation_id,id,provider_id,apprenticeship_standard_id,linked_standard_id,linked_standard_ids,status,record_status,verification_status,source_url) values(${literal(catalogId)},${literal(programme)},${literal(provider)},${literal(standard)},${literal(standard)},${json([standard])},'Active','Active','LevyTate reviewed','https://example.test/synthetic-programme');
      insert into public.levytate_organisation_providers(organisation_id,provider_id,status) values(${literal(org)},${literal(provider)},'Active');
      insert into public.levytate_organisation_programmes(organisation_id,programme_id,provider_id,status) values(${literal(org)},${literal(programme)},${literal(provider)},'Active');
    `);
    const app = `${prefix}-journey`;
    const fields = { employeeId: person, apprenticeshipStandardId: standard, reason: "Synthetic work need", careerGoal: "Synthetic development", supportRequired: "" };
    deny("null action cannot evade command validation", command("employee", app, "save_draft", 0, "null-action-001", fields).replace("'save_draft'", "null"));
    deny("null field object cannot evade command validation", command("employee", app, "save_draft", 0, "null-fields-001", null));
    deny("numeric employee id is rejected", command("employee", app, "save_draft", 0, "numeric-id-001", { ...fields, employeeId: 42 }));
    deny("array fields are rejected", command("employee", app, "save_draft", 0, "array-fields-001", []));
    deny("fractional lock version is rejected", command("employee", app, "save_draft", 0, "fractional-lock-001", { ...fields, expectedLockVersion: 0.5 }));
    deny("browser status and owner cannot forge final approval", command("lead", app, "save_draft", 0, "forged-fields-001", { ...fields, status: "Approved for Enrolment", currentOwner: "Provider Partner" }));
    deny("cross-tenant actor rejected", command("otherLead", app, "save_draft", 0, "cross-tenant-001", fields));
    deny("Platform Admin cannot perform employer decisions", command("platform", app, "save_draft", 0, "platform-deny-001", fields));
    const saved = call("employee", app, "save_and_submit", 0, "employee-submit-001", fields);
    check("employee submission persists manager step with revision", saved.application.status === "Awaiting Manager Review" && saved.application.current_owner === "Line Manager" && saved.application.revision === 1);
    for (const actor of ["lead", "admin", "otherManager", "employee"]) deny(`${actor} cannot skip or impersonate current manager`, command(actor, app, "approve", 1, `manager-skip-${actor}`, { note: "Synthetic decision" }));
    required(`update public.levytate_employees set manager_id=${literal(outsider)} where organisation_id=${literal(org)} and id=${literal(person)};`);
    deny("manager reassignment removes old manager authority immediately", command("manager", app, "approve", 1, "reassigned-deny-001", { note: "Synthetic decision" }));
    required(`update public.levytate_employees set manager_id=${literal(manager)} where organisation_id=${literal(org)} and id=${literal(person)}; update public.levytate_users set active=false where id=${literal(ids.manager)};`);
    deny("revoked manager membership cannot decide", command("manager", app, "approve", 1, "revoked-deny-001", { note: "Synthetic decision" }));
    required(`update public.levytate_users set active=true where id=${literal(ids.manager)};`);
    required(`insert into public.levytate_applications(organisation_id,id,employee_id,apprenticeship_standard_id,status,current_owner) values(${literal(org)},${literal(`${prefix}-manager-own`)},${literal(manager)},${literal(standard)},'Awaiting Manager Review','Line Manager');`);
    deny("manager cannot approve their own application", command("manager", `${prefix}-manager-own`, "approve", 0, "manager-self-001", { note: "Synthetic self review" }));
    deny("stale manager decision rejected", command("manager", app, "approve", 0, "stale-manager-001", { note: "Synthetic decision" }));
    const managerFields = { note: "Synthetic manager approval" };
    const constraint = `release_fail_audit_${prefix}`;
    required(`alter table public.levytate_audit_events add constraint ${constraint} check(organisation_id<>${literal(org)}::uuid or action<>'application.approve') not valid;`);
    const failedAudit = sql(`begin; set local role service_role; ${command("manager", app, "approve", 1, "audit-failure-001", managerFields)} commit;`);
    required(`alter table public.levytate_audit_events drop constraint ${constraint};`);
    check("audit failure aborts the approval transaction", !failedAudit.ok && failedAudit.code === "23514");
    check("audit failure preserves application and history atomically", required(`select status||':'||revision||':'||(select count(*) from public.levytate_application_history where organisation_id=${literal(org)} and application_id=${literal(app)}) from public.levytate_applications where organisation_id=${literal(org)} and id=${literal(app)};`) === "Awaiting Manager Review:1:1");
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
    const handoffFields = { employeeId: person, programmeId: programme, providerId: provider, employmentRoute: "existing_employee_upskill", expectedStartDate: "2027-01-01", expectedEndDate: "2028-01-01" };
    const handoff = (actor, applicationId, key, fields = handoffFields) => `select public.levytate_start_pre_enrolment(${literal(org)}::uuid,${literal(ids[actor])}::uuid,${literal(applicationId)},3,${literal(key)},${json(fields)});`;
    deny("employee cannot initiate employer pre-enrolment", handoff("employee", app, "employee-handoff-001"));
    deny("cross-tenant lead cannot initiate handoff", handoff("otherLead", app, "cross-handoff-001"));
    deny("blank application cannot start pre-enrolment", handoff("lead", "", "blank-handoff-001"));
    deny("wrong-employee handoff cannot start pre-enrolment", handoff("lead", app, "wrong-handoff-001", { ...handoffFields, employeeId: manager }));
    deny("direct enrolled lifecycle payload rejected", handoff("lead", app, "enrolled-handoff-001", { ...handoffFields, lifecycleStatus: "enrolled" }));
    deny("unselected provider rejected", handoff("lead", app, "provider-handoff-001", { ...handoffFields, providerId: "unselected" }));
    const handoffRaces = await Promise.all([1, 2].map(() => concurrent(`begin; set local role service_role; ${handoff("lead", app, "same-handoff-retry-001")} commit;`)));
    check("concurrent handoff retry returns one durable identical result", handoffRaces.every((item) => item.ok) && handoffRaces[0].value === handoffRaces[1].value);
    const learner = JSON.parse(handoffRaces[0].value || "null");
    check("handoff starts pre-enrolment only", learner?.lifecycle_status === "pre_enrolment" && learner.employee_id === person && learner.application_id === app);
    check("handoff persists exactly one learner and lifecycle event", required(`select (select count(*) from public.levytate_learner_records where organisation_id=${literal(org)} and application_id=${literal(app)})||':'||(select count(*) from public.levytate_learner_lifecycle_events where organisation_id=${literal(org)} and learner_record_id=${literal(learner?.id ?? "")});`) === "1:1");
    deny("a different handoff key cannot duplicate the learner", handoff("lead", app, "different-handoff-001"));
  }
} catch (error) {
  failed++; console.error(`FAIL independent database execution: ${error.message}`);
}
// Fixtures intentionally remain in the isolated disposable database for review.
// No automatic reset, hosted writes, or silent history cleanup occurs.
console.log(`Independent database integrity: ${passed} PASS, ${failed} FAIL`);
if (failed) process.exitCode = 1;
