/** Explicit LOCAL fixture preparation. Creates provider identities, never sessions.
 * Plan first; the runtime owner reviews its hash before --apply-reviewed-plan.
 * No password, generated sign-in link, fabricated cookie or external recipient.
 */
import { createHash, randomUUID } from "node:crypto";
import { readFileSync, writeFileSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { localUrl, releaseBackend } from "./release-local-fixtures.mjs";
import { lockAcceptanceRuntime } from "./release-runtime-lock.mjs";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const keys = ["admin-a", "admin-b", "member"];
const bytes = "Synthetic lifecycle browser evidence\n";
const digest = (value) => createHash("sha256").update(value).digest("hex");
export function assertLifecycleManifest(value, parentRun, prepared = false) {
  if (!value || value.version !== 1 || value.kind !== "lifecycle" || value.synthetic !== true || value.environment !== "local"
    || !uuid.test(value.run ?? "") || value.parentRun !== parentRun || !uuid.test(parentRun ?? "")
    || !["planned", "preparing", "prepared", "failed"].includes(value.stage)
    || !uuid.test(value.operator?.id ?? "") || !uuid.test(value.target?.id ?? "") || value.operator.id === value.target.id
    || value.operator.slug !== `lifecycle-${value.run}-operator` || value.target.slug !== `lifecycle-${value.run}-target`
    || value.operator.name !== `Synthetic lifecycle operators ${value.run.slice(0, 8)}` || value.target.name !== `Synthetic lifecycle target ${value.run.slice(0, 8)}`
    || !Array.isArray(value.users) || value.users.length !== 3) throw new Error("Exact local lifecycle plan required");
  const ids = new Set([value.operator.id, value.target.id]), subjects = new Set();
  for (const [index, key] of keys.entries()) {
    const user = value.users[index];
    if (user.key !== key || user.email !== `lg.${value.run}.${key}@example.test` || !uuid.test(user.membershipId ?? "") || ids.has(user.membershipId)
      || user.role !== (key === "member" ? "Apprenticeship Lead" : "Platform Admin")
      || user.organisationId !== (key === "member" ? value.target.id : value.operator.id)
      || (user.authSubject !== null && !uuid.test(user.authSubject ?? "")) || (prepared && !uuid.test(user.authSubject ?? ""))) throw new Error("Exact lifecycle identity required");
    if (user.authSubject && subjects.has(user.authSubject)) throw new Error("Distinct provider identities required");
    if (user.authSubject) subjects.add(user.authSubject);
    ids.add(user.membershipId);
  }
  if (value.storage?.bucket !== "levytate-uploads" || value.storage.path !== `${value.target.id}/release-lifecycle-${value.run}/evidence.txt`
    || value.storage.sha256 !== digest(bytes) || value.storage.bytes !== Buffer.byteLength(bytes)
    || value.personId !== `lifecycle-member-${value.run}` || (prepared && (value.stage !== "prepared" || value.databasePrepared !== true || value.storagePrepared !== true))) throw new Error("Exact lifecycle fixture boundary required");
  return value;
}
export function lifecycleRecipients(value, parentRun) { return assertLifecycleManifest(value, parentRun).users.map((user) => user.email); }
export function planLifecycleFixtures(base) {
  if (!base?.synthetic || base.environment !== "local" || !uuid.test(base.run ?? "") || base.tenants?.length !== 2) throw new Error("Existing two-tenant local base required");
  const run = randomUUID(), operator = randomUUID(), target = randomUUID();
  const value = { version: 1, kind: "lifecycle", synthetic: true, environment: "local", parentRun: base.run, run, stage: "planned",
    operator: { id: operator, slug: `lifecycle-${run}-operator`, name: `Synthetic lifecycle operators ${run.slice(0, 8)}` },
    target: { id: target, slug: `lifecycle-${run}-target`, name: `Synthetic lifecycle target ${run.slice(0, 8)}` },
    users: keys.map((key) => ({ key, email: `lg.${run}.${key}@example.test`, membershipId: randomUUID(), authSubject: null,
      organisationId: key === "member" ? target : operator, role: key === "member" ? "Apprenticeship Lead" : "Platform Admin" })),
    personId: `lifecycle-member-${run}`, storage: { bucket: "levytate-uploads", path: `${target}/release-lifecycle-${run}/evidence.txt`, bytes: Buffer.byteLength(bytes), sha256: digest(bytes) },
    databasePrepared: false, storagePrepared: false,
  };
  return assertLifecycleManifest(value, base.run);
}
const quote = (value) => `'${String(value).replaceAll("'", "''")}'`;
export async function prepareLifecycleFixtures({ runtime, approvedSha256 }) {
  if (!runtime?.startsWith("/private/tmp/levytate-release-runtime.") || !/^[a-f0-9]{64}$/.test(approvedSha256 ?? "")) throw new Error("Reviewed local plan hash required");
  const path = `${runtime}/lifecycle-fixture-manifest.json`, raw = readFileSync(path, "utf8");
  if ((statSync(path).mode & 0o077) !== 0 || digest(raw) !== approvedSha256) throw new Error("Restricted reviewed plan checksum required");
  const base = JSON.parse(readFileSync(`${runtime}/fixture-manifest.json`, "utf8"));
  const plan = assertLifecycleManifest(JSON.parse(raw), base.run);
  if (plan.stage !== "planned" || base.tenants.some((tenant) => [plan.operator.id, plan.target.id].includes(tenant.id))) throw new Error("Fresh exclusive lifecycle plan required; inspect any partial prior attempt");
  const state = JSON.parse(readFileSync(`${runtime}/private-stack-state.json`, "utf8")).env, db = new URL(state.DB_URL), api = localUrl(state.API_URL, "local API");
  if (db.hostname !== "127.0.0.1") throw new Error("Loopback fixture database required");
  process.env.RELEASE_LOCAL_RUNTIME = runtime; process.env.RELEASE_SUPABASE_URL = api; process.env.RELEASE_SUPABASE_SERVICE_KEY = state.SERVICE_ROLE_KEY;
  const release = lockAcceptanceRuntime("reviewed-lifecycle-fixture-preparation"), backend = releaseBackend();
  const persist = () => writeFileSync(path, `${JSON.stringify(plan, null, 2)}\n`, { mode: 0o600 });
  function sql(input) {
    const result = spawnSync(process.env.RELEASE_PSQL ?? "/opt/homebrew/opt/postgresql@17/bin/psql", ["-XAtq", "-v", "ON_ERROR_STOP=1"], { input, encoding: "utf8", env: { ...process.env, PGHOST: db.hostname, PGPORT: db.port, PGUSER: db.username, PGPASSWORD: db.password, PGDATABASE: db.pathname.slice(1) } });
    if (result.status) throw new Error("Local lifecycle fixture SQL failed; existing state preserved");
    return result.stdout.trim();
  }
  try {
    if (sql(`select count(*) from public.levytate_organisations where id in (${quote(plan.operator.id)},${quote(plan.target.id)});`) !== "0") throw new Error("Lifecycle target is not empty");
    plan.stage = "preparing"; persist();
    for (const user of plan.users) {
      const created = await backend("auth/v1/admin/users", "POST", { email: user.email, email_confirm: true, app_metadata: { release_fixture: plan.run, fixture_kind: "lifecycle" } });
      if (!uuid.test(created?.id ?? "")) throw new Error("Provider identity creation was not confirmed");
      user.authSubject = created.id; persist();
    }
    sql(`begin;
      insert into public.levytate_organisations(id,name,slug,workspace_name,workspace_template,status) values ${[plan.operator, plan.target].map((org) => `(${quote(org.id)},${quote(org.name)},${quote(org.slug)},${quote(org.name)},'levytate-client-v1','Active')`).join(",")};
      insert into public.levytate_users(id,organisation_id,email,display_name,role,access_level,active,auth_subject,auth_binding_status,auth_bound_at,invitation_status) values ${plan.users.map((user) => `(${quote(user.membershipId)},${quote(user.organisationId)},${quote(user.email)},${quote(`Synthetic lifecycle ${user.key}`)},${quote(user.role)},'beta_user',true,${quote(user.authSubject)},'bound',clock_timestamp(),'consumed')`).join(",")};
      insert into public.levytate_employees(organisation_id,id,employee_number,name,email,platform_role,status,start_date) values (${quote(plan.target.id)},${quote(plan.personId)},'synthetic-lifecycle','Synthetic lifecycle member',${quote(plan.users[2].email)},'Apprenticeship Lead','Active',current_date);
      insert into public.levytate_file_assets(organisation_id,entity_type,entity_id,bucket_name,object_path,original_name,mime_type,file_size_bytes,uploaded_by_email) values (${quote(plan.target.id)},'synthetic-lifecycle',${quote(plan.run)},${quote(plan.storage.bucket)},${quote(plan.storage.path)},'Synthetic lifecycle evidence.txt','text/plain',${plan.storage.bytes},${quote(plan.users[2].email)});
      commit;`);
    plan.databasePrepared = true; persist();
    const uploaded = await fetch(`${api}/storage/v1/object/${plan.storage.bucket}/${plan.storage.path}`, { method: "POST", headers: { apikey: state.SERVICE_ROLE_KEY, Authorization: `Bearer ${state.SERVICE_ROLE_KEY}`, "Content-Type": "text/plain", "x-upsert": "false" }, body: bytes, redirect: "error" });
    if (!uploaded.ok) throw new Error("Local lifecycle Storage fixture was not confirmed");
    plan.storagePrepared = true; plan.stage = "prepared"; persist();
    return assertLifecycleManifest(plan, base.run, true);
  } catch (error) { plan.stage = "failed"; persist(); throw error; }
  finally { release(); }
}
async function main() {
  const runtime = process.env.RELEASE_LOCAL_RUNTIME;
  if (!runtime?.startsWith("/private/tmp/levytate-release-runtime.")) throw new Error("Dedicated local runtime required");
  if (process.argv[2] === "--plan") {
    const value = planLifecycleFixtures(JSON.parse(readFileSync(`${runtime}/fixture-manifest.json`, "utf8"))), raw = `${JSON.stringify(value, null, 2)}\n`;
    writeFileSync(`${runtime}/lifecycle-fixture-manifest.json`, raw, { mode: 0o600, flag: "wx" });
    console.log(`PASS local lifecycle plan only; SHA-256 ${digest(raw)}; no Auth, database, Storage or email changes`);
  } else if (process.argv[2] === "--apply-reviewed-plan") {
    await prepareLifecycleFixtures({ runtime, approvedSha256: process.env.RELEASE_LIFECYCLE_PLAN_SHA256 });
    console.log("PASS exactly three synthetic lifecycle identities and isolated fixture prepared; no login or email sent");
  } else throw new Error("Choose --plan or --apply-reviewed-plan");
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch(() => { console.error("FAIL lifecycle preparation; no reset, cleanup or retry performed; inspect restricted plan stage"); process.exitCode = 1; });
