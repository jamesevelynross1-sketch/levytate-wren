/** One reviewed LOCAL reviewer fixture. Creates an identity, never a session.
 * The runtime owner plans from current state, reviews the hash, then applies.
 * Existing membership access is never changed or silently reactivated.
 */
import { createHash, randomUUID } from "node:crypto";
import { readFileSync, writeFileSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { localUrl, releaseBackend } from "./release-local-fixtures.mjs";
import { lockAcceptanceRuntime } from "./release-runtime-lock.mjs";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const digest = (value) => createHash("sha256").update(value).digest("hex");
const quote = (value) => `'${String(value).replaceAll("'", "''")}'`;
function baseManager(base) {
  if (!base?.synthetic || base.environment !== "local" || !uuid.test(base.run ?? "") || base.tenants?.length !== 2) throw new Error("Existing local two-tenant base required");
  const tenant = base.tenants.find((item) => item.key === "a"), user = tenant?.users.find((item) => item.key === "manager");
  if (!uuid.test(tenant?.id ?? "") || !uuid.test(user?.membershipId ?? "") || user.role !== "Line Manager" || user.personId !== "a-manager" || user.email !== `release.${base.run}.a.manager@example.test`) throw new Error("Exact existing fictional manager required");
  return { tenant, user };
}
export function assertManagerManifest(value, base, prepared = false) {
  const { tenant, user } = baseManager(base), source = value?.source;
  if (!value || value.version !== 1 || value.kind !== "manager-reviewer" || value.synthetic !== true || value.environment !== "local"
    || !uuid.test(value.run ?? "") || value.parentRun !== base.run || !["planned", "preparing", "prepared", "failed"].includes(value.stage)
    || value.tenantId !== tenant.id || source?.organisation?.id !== tenant.id || source.organisation.status !== "Active"
    || source?.membership?.id !== user.membershipId || source.membership.organisation_id !== tenant.id || source.membership.email !== user.email
    || source.membership.role !== "Line Manager" || source.membership.active !== true || source.membership.auth_binding_status !== "bound" || !uuid.test(source.membership.auth_subject ?? "")
    || source?.person?.id !== user.personId || source.person.organisation_id !== tenant.id || source.person.email !== user.email || source.person.platform_role !== "Line Manager"
    || source.person.status !== "Active" || source.person.manager_id !== "" || typeof source.person.role_id !== "string" || !source.person.role_id
    || ![source.membership.updated_at, source.person.updated_at, source.organisation.updated_at].every((stamp) => typeof stamp === "string" && Number.isFinite(Date.parse(stamp)))
    || !Array.isArray(value.users) || value.users.length !== 1) throw new Error("Exact reviewed current manager state required");
  const reviewer = value.users[0];
  if (reviewer.key !== "reviewer" || reviewer.role !== "Line Manager" || reviewer.email !== `lg.${value.run}.reviewer@example.test`
    || reviewer.organisationId !== tenant.id || !uuid.test(reviewer.membershipId ?? "") || reviewer.membershipId === user.membershipId
    || reviewer.personId !== `manager-reviewer-${value.run}` || (reviewer.authSubject !== null && !uuid.test(reviewer.authSubject ?? ""))
    || reviewer.authSubject === source.membership.auth_subject || (prepared && (!uuid.test(reviewer.authSubject ?? "") || value.stage !== "prepared" || value.databasePrepared !== true))) throw new Error("Exact additional reviewer identity required");
  return value;
}
export function managerRecipients(value, base) { return assertManagerManifest(value, base).users.map((user) => user.email); }
export function planManagerFixtures(base, source) {
  const { tenant } = baseManager(base), run = randomUUID();
  return assertManagerManifest({ version: 1, kind: "manager-reviewer", synthetic: true, environment: "local", parentRun: base.run, run, stage: "planned", tenantId: tenant.id, source,
    users: [{ key: "reviewer", role: "Line Manager", email: `lg.${run}.reviewer@example.test`, organisationId: tenant.id, membershipId: randomUUID(), personId: `manager-reviewer-${run}`, authSubject: null }], databasePrepared: false }, base);
}
function localRuntime(runtime) {
  if (!runtime?.startsWith("/private/tmp/levytate-release-runtime.")) throw new Error("Dedicated local runtime required");
  const state = JSON.parse(readFileSync(`${runtime}/private-stack-state.json`, "utf8")).env, db = new URL(state.DB_URL);
  if (db.hostname !== "127.0.0.1") throw new Error("Loopback fixture database required");
  process.env.RELEASE_LOCAL_RUNTIME = runtime; process.env.RELEASE_SUPABASE_URL = localUrl(state.API_URL, "local API"); process.env.RELEASE_SUPABASE_SERVICE_KEY = state.SERVICE_ROLE_KEY;
  const sql = (input) => {
    const result = spawnSync(process.env.RELEASE_PSQL ?? "/opt/homebrew/opt/postgresql@17/bin/psql", ["-XAtq", "-v", "ON_ERROR_STOP=1"], { input, encoding: "utf8", env: { ...process.env, PGHOST: db.hostname, PGPORT: db.port, PGUSER: db.username, PGPASSWORD: db.password, PGDATABASE: db.pathname.slice(1) } });
    if (result.status) throw new Error("Local manager fixture SQL failed; existing state preserved");
    return result.stdout.trim();
  };
  return { sql, backend: releaseBackend() };
}
const selected = {
  organisation: "id,status,updated_at",
  membership: "id,organisation_id,email,role,active,auth_subject,auth_binding_status,updated_at",
  person: "id,organisation_id,email,platform_role,status,manager_id,role_id,updated_at",
};
async function readSource(backend, base) {
  const { tenant, user } = baseManager(base);
  const [organisations, users, people, applications] = await Promise.all([
    backend(`rest/v1/levytate_organisations?id=eq.${tenant.id}&select=${selected.organisation}`),
    backend(`rest/v1/levytate_users?id=eq.${user.membershipId}&select=${selected.membership}`),
    backend(`rest/v1/levytate_employees?organisation_id=eq.${tenant.id}&id=eq.${user.personId}&select=${selected.person}`),
    backend(`rest/v1/levytate_applications?organisation_id=eq.${tenant.id}&employee_id=eq.${user.personId}&select=id,status`),
  ]);
  if (organisations.length !== 1 || users.length !== 1 || people.length !== 1 || applications.some((item) => !["Declined", "Withdrawn", "Completed", "Cancelled"].includes(item.status))) throw new Error("Current manager has changed or an active personal application exists");
  return { organisation: organisations[0], membership: users[0], person: people[0] };
}
export async function prepareManagerFixtures({ runtime, approvedSha256 }) {
  if (!/^[a-f0-9]{64}$/.test(approvedSha256 ?? "")) throw new Error("Reviewed local plan hash required");
  const { sql, backend } = localRuntime(runtime), path = `${runtime}/manager-fixture-manifest.json`, raw = readFileSync(path, "utf8"), base = JSON.parse(readFileSync(`${runtime}/fixture-manifest.json`, "utf8"));
  if ((statSync(path).mode & 0o077) !== 0 || digest(raw) !== approvedSha256) throw new Error("Restricted reviewed plan checksum required");
  const plan = assertManagerManifest(JSON.parse(raw), base), reviewer = plan.users[0];
  if (plan.stage !== "planned") throw new Error("Fresh reviewer plan required; inspect any partial attempt");
  const release = lockAcceptanceRuntime("reviewed-manager-reviewer-preparation"), persist = () => writeFileSync(path, `${JSON.stringify(plan, null, 2)}\n`, { mode: 0o600 });
  try {
    if (sql("select count(*) from supabase_migrations.schema_migrations where version in ('20261109181634','20261109182509');") !== "2") throw new Error("Reviewed personal permissions and derived review migrations required");
    if (JSON.stringify(await readSource(backend, base)) !== JSON.stringify(plan.source)) throw new Error("Manager changed after plan review; no fixture applied");
    plan.stage = "preparing"; persist();
    const created = await backend("auth/v1/admin/users", "POST", { email: reviewer.email, email_confirm: true, app_metadata: { release_fixture: plan.run, fixture_kind: "manager-reviewer" } });
    if (!uuid.test(created?.id ?? "") || created.id === plan.source.membership.auth_subject) throw new Error("Distinct reviewer provider identity was not confirmed");
    reviewer.authSubject = created.id; persist();
    // A second exact check under row locks prevents changed manager hierarchy,
    // access, or tenant state being overwritten after the read-only plan.
    sql(`begin;
      select id from public.levytate_organisations where id=${quote(plan.tenantId)} for update;
      select id from public.levytate_users where id=${quote(plan.source.membership.id)} for update;
      select id from public.levytate_employees where organisation_id=${quote(plan.tenantId)} and id=${quote(plan.source.person.id)} for update;
      do $guard$ begin
        if (select to_jsonb(r) from (select ${selected.organisation} from public.levytate_organisations where id=${quote(plan.tenantId)}) r) is distinct from ${quote(JSON.stringify(plan.source.organisation))}::jsonb
          or (select to_jsonb(r) from (select ${selected.membership} from public.levytate_users where id=${quote(plan.source.membership.id)}) r) is distinct from ${quote(JSON.stringify(plan.source.membership))}::jsonb
          or (select to_jsonb(r) from (select ${selected.person} from public.levytate_employees where organisation_id=${quote(plan.tenantId)} and id=${quote(plan.source.person.id)}) r) is distinct from ${quote(JSON.stringify(plan.source.person))}::jsonb
          or exists(select 1 from public.levytate_applications where organisation_id=${quote(plan.tenantId)} and employee_id=${quote(plan.source.person.id)} and status not in ('Declined','Withdrawn','Completed','Cancelled'))
        then raise exception 'Reviewed manager changed; preserve current state'; end if;
      end $guard$;
      insert into public.levytate_users(id,organisation_id,email,display_name,role,access_level,active,auth_subject,auth_binding_status,auth_bound_at,invitation_status) values (${quote(reviewer.membershipId)},${quote(plan.tenantId)},${quote(reviewer.email)},'Synthetic distinct senior manager','Line Manager','beta_user',true,${quote(reviewer.authSubject)},'bound',clock_timestamp(),'consumed');
      insert into public.levytate_employees(organisation_id,id,employee_number,name,email,platform_role,manager_id,role_id,status,start_date) values (${quote(plan.tenantId)},${quote(reviewer.personId)},${quote(`senior-${plan.run}`)},'Synthetic distinct senior manager',${quote(reviewer.email)},'Line Manager','',${quote(plan.source.person.role_id)},'Active',current_date);
      update public.levytate_employees set manager_id=${quote(reviewer.personId)},updated_at=clock_timestamp() where organisation_id=${quote(plan.tenantId)} and id=${quote(plan.source.person.id)} and manager_id='';
      commit;`);
    plan.databasePrepared = true; plan.stage = "prepared"; persist(); return assertManagerManifest(plan, base, true);
  } catch (error) { plan.stage = "failed"; persist(); throw error; }
  finally { release(); }
}
async function main() {
  const runtime = process.env.RELEASE_LOCAL_RUNTIME;
  if (process.argv[2] === "--plan") {
    const { backend } = localRuntime(runtime), base = JSON.parse(readFileSync(`${runtime}/fixture-manifest.json`, "utf8"));
    const plan = planManagerFixtures(base, await readSource(backend, base)), raw = `${JSON.stringify(plan, null, 2)}\n`;
    writeFileSync(`${runtime}/manager-fixture-manifest.json`, raw, { mode: 0o600, flag: "wx" });
    console.log(`PASS read-only manager plan; SHA-256 ${digest(raw)}; no Auth, database or email changes`);
  } else if (process.argv[2] === "--apply-reviewed-plan") {
    await prepareManagerFixtures({ runtime, approvedSha256: process.env.RELEASE_MANAGER_PLAN_SHA256 });
    console.log("PASS exactly one distinct fictional reviewer prepared; existing account access unchanged; no login or email sent");
  } else throw new Error("Choose --plan or --apply-reviewed-plan");
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch(() => { console.error("FAIL manager fixture preparation; no reset, cleanup or retry performed; inspect restricted plan stage"); process.exitCode = 1; });
