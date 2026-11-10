/** Rollback-only exact older-body compatibility checks in a dedicated empty DB.
 * No commands, Auth identities, capabilities, evidence or ledger writes.
 */
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
const runtime = process.env.RELEASE_LOCAL_RUNTIME, database = process.env.RELEASE_TEST_DATABASE;
if (!/^\/private\/tmp\/levytate-release-runtime\.[A-Za-z0-9]+$/.test(runtime ?? "") || database !== "levytate_release_learning_readiness_review25") throw Error("Dedicated local readiness database required");
const connection = new URL(JSON.parse(readFileSync(`${runtime}/private-stack-state.json`, "utf8")).env.DB_URL);
if (connection.hostname !== "127.0.0.1") throw Error("Loopback database required");
const run = sql => spawnSync("/opt/homebrew/opt/postgresql@17/bin/psql", ["-XAtq", "-v", "ON_ERROR_STOP=1", "-v", "VERBOSITY=verbose"], { input: sql, encoding: "utf8", env: { ...process.env, PGHOST: connection.hostname, PGPORT: connection.port, PGUSER: connection.username, PGPASSWORD: connection.password, PGDATABASE: database } });
const guard = run("select current_setting('server_version_num')::int/10000=17 and (select count(*)=0 from auth.users) and (select count(*)=0 from storage.objects) and (select count(*)=0 from public.levytate_organisations) and (select count(*)=0 from supabase_migrations.schema_migrations) and public.levytate_required_client_contracts()=' {\"version\":\"20261110085437\",\"available\":true}'::jsonb;");
if (guard.status !== 0 || guard.stdout.trim() !== "t") throw Error("Reviewed current contract and empty local database required before compatibility tests");
const older = [
  ["supabase/migrations/033_create_off_the_job_learning_assistant.sql", "levytate_submit_otj_activity", "35236c66e14fed6a2f64dc3c32d557b835b13b69ac9f01b4ba9a16b2ab010cae"],
  ["supabase/migrations/033_create_off_the_job_learning_assistant.sql", "levytate_transition_otj_activity", "35236c66e14fed6a2f64dc3c32d557b835b13b69ac9f01b4ba9a16b2ab010cae"],
  ["supabase/release-migrations/20261029162529_client_learning_time_integrity.sql", "levytate_apply_learning_time_command", "f8c1b4af652784f12f8d4222b1cd020b04c8cf42059237a81d858918b36a0197"],
].map(([path, name, expectedSha256]) => {
  const source = readFileSync(resolve(path), "utf8");
  const sourceSha256 = createHash("sha256").update(source).digest("hex");
  if (sourceSha256 !== expectedSha256) throw Error("Historical source checksum changed; stop without compatibility tests");
  const statement = source.match(new RegExp(`create(?: or replace)? function public\\.${name}\\([\\s\\S]*?\\$\\$;`, "i"))?.[0];
  if (!statement) throw Error("Exact original routine statement missing");
  return { name, statement: statement.replace(/^create function/i, "create or replace function"), sourceSha256 };
});
let failures = 0;
for (const routines of [...older.map(item => [item]), older]) {
  const result = run(`begin;\n${routines.map(item => item.statement).join("\n")}\nset local role service_role;\ndo $proof$ begin if public.levytate_required_client_contracts()->>'available' is distinct from 'false' then raise exception 'Older same-signature implementation incorrectly reports available';end if;end $proof$;\nreset role;rollback;`);
  if (result.status !== 0) failures++;
  console.log(JSON.stringify({ status: result.status === 0 ? "PASS" : "FAIL", check: "older-same-signature-routines-unavailable", routines: routines.map(({ name, sourceSha256 }) => ({ name, sourceSha256 })), sqlstate: result.stderr.match(/(?:ERROR|FATAL):\s+([A-Z0-9]{5}):/)?.[1] ?? null, hosted: false }));
}
const recovered = run("set default_transaction_read_only=on;select public.levytate_required_client_contracts()=' {\"version\":\"20261110085437\",\"available\":true}'::jsonb;");
if (recovered.status !== 0 || recovered.stdout.trim() !== "t") failures++;
console.log(JSON.stringify({ status: failures ? "FAIL" : "PASS", checks: 5, recoveryReadOnly: recovered.status === 0 && recovered.stdout.trim() === "t", hosted: false }));
if (failures) process.exitCode = 1;
