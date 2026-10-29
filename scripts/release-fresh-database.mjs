/** Empty, local-only PG17 verification database. No reset, copied data, or ledger repair. */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";

const runtime = process.env.RELEASE_LOCAL_RUNTIME;
const repository = process.env.RELEASE_CANDIDATE_REPOSITORY;
const name = process.env.RELEASE_TEST_DATABASE;
if (!runtime?.startsWith("/private/tmp/levytate-release-runtime.") || !repository?.startsWith("/private/tmp/levytate-") || !/^levytate_release_[a-z0-9_]+$/.test(name ?? "")) throw new Error("Dedicated local runtime, candidate worktree and fresh verifier database required");
const state = JSON.parse(readFileSync(`${runtime}/private-stack-state.json`, "utf8"));
const connection = new URL(state.env.DB_URL);
if (connection.hostname !== "127.0.0.1") throw new Error("Loopback database required");
const env = { ...process.env, PGPASSWORD: connection.password };
const binaries = process.env.RELEASE_PG_BIN ?? "/opt/homebrew/opt/postgresql@17/bin";
const connectionArgs = ["-h", connection.hostname, "-p", connection.port, "-U", connection.username];
function command(binary, args, input) {
  const result = spawnSync(`${binaries}/${binary}`, args, { env, input, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (result.status !== 0) {
    const safeError = result.stderr.split("\n").filter((line) => /ERROR:|FATAL:/.test(line)).map((line) => line.replace(/postgres(?:ql)?:\/\/\S+/g, "[redacted connection]")).join("\n");
    throw new Error(`${binary} failed; partial database is retained. ${safeError || "See restricted local diagnostic; no output exposed"}`);
  }
  return result.stdout;
}
const psqlArgs = [...connectionArgs, "-X", "-A", "-t", "-q", "-v", "ON_ERROR_STOP=1"];
const sql = (database, statement) => command("psql", [...psqlArgs, "-d", database], statement);
const source = decodeURIComponent(connection.pathname.slice(1));
if (sql(source, `select count(*) from pg_database where datname='${name}';`).trim() !== "0") throw new Error("Database already exists: preserve it and choose a fresh name");
if (sql(source, "select current_setting('server_version_num')::int / 10000;").trim() !== "17") throw new Error("PostgreSQL 17 required");
const baseline = [
  ["20261027174133_006_create_levytate_production_foundation.sql", "876321865fd5efd9473c8863078c1d3cd2173927b737555c36266039fea16f35"],
  ["20261027190000_levytate_fresh_project_convergence.sql", "3bd6b681196ff865f50976129981b48601314d2bab2421794648fba51aefb204"],
].map(([file, sha256]) => ({ path: `${runtime}/project/supabase/migrations/${file}`, sha256 }));
const manifest = JSON.parse(readFileSync(resolve(repository, "supabase/release-migrations/manifest.json"), "utf8"));
if (manifest.approvedBootstrapConvergenceSha256 !== baseline[1].sha256) throw new Error("Candidate manifest bootstrap mismatch");
const candidates = manifest.migrations.map(({ path, sha256 }) => {
  if (!/^supabase\/release-migrations\/\d{14}_[a-z_]+\.sql$/.test(path)) throw new Error("Non-candidate migration path rejected");
  return { path: resolve(repository, path), sha256 };
});
const migrations = [...baseline, ...candidates].map((entry) => {
  const content = readFileSync(entry.path, "utf8");
  if (createHash("sha256").update(content).digest("hex") !== entry.sha256) throw new Error(`Hash mismatch: ${entry.path.split("/").at(-1)}`);
  return { ...entry, content };
});
console.log(`PASS: ${migrations.length} exact migration hashes checked before creating ${name}`);
// Schema only: no Auth identities, Storage objects, employer rows or ledger data.
// The supported native stack provides a local trust-authenticated admin socket.
// Preserve actual managed schema ownership/default ACLs; do not weaken them to
// work around postgres's deliberate inability to impersonate service owners.
const [socket, port] = sql(source, "select current_setting('unix_socket_directories')||'|'||current_setting('port');").trim().split("|");
if (!/^\/private\/tmp\/supabase-\d+\/pg-[a-f0-9]+$/.test(socket) || !/^\d+$/.test(port)) throw new Error("Unexpected native administrative socket; stop without changing configuration");
const platformArgs = ["-h", socket, "-p", port, "-U", "supabase_admin"];
if (command("psql", [...platformArgs, "-XAtq", "-d", source, "-c", "select rolsuper from pg_roles where rolname=current_user;"]).trim() !== "t") throw new Error("Expected local managed schema owner unavailable");
const platform = command("pg_dump", [...platformArgs, "-d", source, "--schema-only", "--schema=auth", "--schema=storage", "--schema=supabase_migrations"]);
sql(source, `create database ${name} template template0;`);
command("psql", [...platformArgs, "-XAtq", "-v", "ON_ERROR_STOP=1", "-d", name], platform);
for (const migration of migrations) {
  sql(name, migration.content);
  console.log(`PASS: applied ${migration.path.split("/").at(-1)} to fresh local verifier only`);
}
const counts = sql(name, `select (select count(*) from auth.users)||':'||(select count(*) from storage.objects)||':'||(select count(*) from public.levytate_employees)||':'||(select count(*) from public.levytate_organisations)||':'||(select count(*) from supabase_migrations.schema_migrations);`).trim();
if (counts !== "0:0:0:0:0") throw new Error("Fresh verifier data/ledger is unexpectedly nonempty");
console.log("PASS: Auth, Storage, employers, People and migration ledger remain empty; no ledger entries fabricated");
console.log(`PASS: combined local PostgreSQL 17 schema ready in ${name}; this is not hosted acceptance`);
