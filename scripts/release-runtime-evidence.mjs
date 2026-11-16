/** Credential-free read-only catalogue and real CLI-ledger evidence for LOCAL stacks. */
import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { verifyReleaseSources } from "./build-release-supabase-worktree.mjs";
import { releaseRepository } from "./release-repository-path.mjs";
const root = process.env.RELEASE_LOCAL_RUNTIME;
if (!/^\/private\/tmp\/levytate-release-runtime\.[A-Za-z0-9]+$/.test(root ?? "")) throw new Error("Dedicated local runtime required");
const state = JSON.parse(readFileSync(`${root}/private-stack-state.json`, "utf8"));
const db = new URL(state.env.DB_URL);
if (db.hostname !== "127.0.0.1") throw new Error("Loopback database required");
const repository = process.env.RELEASE_CANDIDATE_REPOSITORY ? releaseRepository(process.env.RELEASE_CANDIDATE_REPOSITORY) : resolve(dirname(fileURLToPath(import.meta.url)), "..");
const verified = await verifyReleaseSources(repository);
const sql = (input) => {
  const result = spawnSync(process.env.RELEASE_PSQL ?? "/opt/homebrew/opt/postgresql@17/bin/psql", ["-XAtq", "-v", "ON_ERROR_STOP=1"], {
    input, encoding: "utf8", env: { ...process.env, PGHOST: db.hostname, PGPORT: db.port, PGUSER: db.username, PGPASSWORD: db.password, PGDATABASE: db.pathname.slice(1) },
  });
  if (result.status) throw new Error("Local evidence query failed; raw database diagnostics withheld");
  return JSON.parse(result.stdout.trim());
};
const rows = sql("select coalesce(jsonb_agg(jsonb_build_object('version',version,'name',name,'statementCount',cardinality(statements),'statementsSha256',encode(sha256(convert_to(array_to_string(statements,E'\\n'),'UTF8')),'hex')) order by version),'[]') from supabase_migrations.schema_migrations;");
const expected = [verified.bootstrap.anchor, verified.bootstrap.convergence, ...verified.manifest.migrations.map((row) => { const file = row.path.split("/").at(-1); return { version: file.split("_")[0], name: file.slice(15, -4) }; })];
if (rows.length !== expected.length || expected.some((entry, i) => rows[i]?.version !== entry.version || rows[i]?.name !== entry.name)) throw new Error("Official CLI ledger does not match the exact generated chain");
const baseChecks = [
  [61, "f47356686324f4f41fcf02701f7e3e44bccc8c561d3aa68eecb250355330241a"],
  [954, "3b582ad74254045351bbd89beee7cf16a5c0d9a16c613848eec3977e07ad947d"],
];
if (baseChecks.some(([count, hash], index) => rows[index].statementCount !== count || rows[index].statementsSha256 !== hash)) throw new Error("Official bootstrap statement ledger changed");
for (const source of verified.manifest.migrations) {
  const generated = readFileSync(`${root}/project/supabase/migrations/${source.path.split("/").at(-1)}`);
  if (createHash("sha256").update(generated).digest("hex") !== source.sha256) throw new Error("Generated candidate changed after initial verification");
}
const metadata = sql(`select jsonb_build_object(
 'postgresVersion',current_setting('server_version'),
 'tables',(select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r'),
 'rlsTables',(select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and c.relrowsecurity),
 'browserTableGrants',(select count(*) from information_schema.role_table_grants where table_schema='public' and grantee in ('anon','authenticated','PUBLIC')),
 'browserFunctionGrants',(select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'levytate_%' and (has_function_privilege('anon',p.oid,'execute') or has_function_privilege('authenticated',p.oid,'execute'))),
 'privateBuckets',(select count(*) from storage.buckets where not public),
 'publicBuckets',(select count(*) from storage.buckets where public),
 'storageObjects',(select count(*) from storage.objects),
 'authUsers',(select count(*) from auth.users),
 'employers',(select count(*) from public.levytate_organisations),
 'people',(select count(*) from public.levytate_employees),
 'excluded038Absent',to_regclass('public.levytate_pastoral_support_actions') is null
);`);
if (!metadata.postgresVersion.startsWith("17.") || metadata.tables !== metadata.rlsTables || metadata.browserTableGrants || metadata.browserFunctionGrants || metadata.privateBuckets !== 4 || metadata.publicBuckets || !metadata.excluded038Absent) throw new Error("Local schema/security invariant failed");
const evidence = { environment: "local", observedAt: new Date().toISOString(), runtime: state.runtime, runtimeId: state.id, metadata, rows, hostedAcceptance: false };
writeFileSync(`${root}/catalogue-ledger-evidence-${Date.now()}.json`, `${JSON.stringify(evidence, null, 2)}\n`, { flag: "wx", mode: 0o600 });
console.log(JSON.stringify(evidence, null, 2));
