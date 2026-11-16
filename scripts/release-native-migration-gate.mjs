/** Fresh LOCAL bootstrap guards. No application SQL execution or history repair. */
import { createHash } from "node:crypto";
import { lstatSync, realpathSync, readdirSync, constants, openSync, fstatSync, readSync, closeSync } from "node:fs";
import { resolve, join, basename } from "node:path";
import { verifyReleaseSources } from "./build-release-supabase-worktree.mjs";
export const reviewedReleaseManifestSha256 = "8685dbf196c76f7881017f7523a0f1bee412e0da2b6fded393271cc9de2a146f";
export const reviewedBootstrapManifestSha256 = "f12810747526e66d45789840549be88046c14b8a152fc583f4897dc09e4718b6";
export const sha256 = value => createHash("sha256").update(value).digest("hex");
export const localRuntimePattern = /^\/(?:private\/)?tmp\/levytate-release-runtime\.[A-Za-z0-9]+$/;
export function existsWithoutFollowing(path) {
  try { lstatSync(path); return true; } catch (error) { if (error.code === "ENOENT") return false; throw error; }
}
export function requireRealDirectory(path) {
  if (!lstatSync(path).isDirectory() || realpathSync(path) !== resolve(path)) throw Error("Real local directory required; symlink ancestry rejected");
}
export function readRegularFile(path, maximumBytes = 16 * 1024 * 1024) {
  if (!lstatSync(path).isFile() || realpathSync(path) !== resolve(path)) throw Error("Regular local file required; symlinks rejected");
  const fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const stat = fstatSync(fd);
    if (!stat.isFile() || stat.size > maximumBytes) throw Error("Bounded regular local file required");
    const bytes = Buffer.alloc(stat.size);
    let offset = 0;
    while (offset < bytes.length) {
      const count = readSync(fd, bytes, offset, bytes.length - offset, offset);
      if (!count) throw Error("Local source changed during read");
      offset += count;
    }
    if (fstatSync(fd).size !== stat.size) throw Error("Local source changed during read");
    return bytes;
  } finally { closeSync(fd); }
}
export function assertRuntimeDirectory(root) {
  if (!localRuntimePattern.test(root ?? "")) throw Error("Dedicated temporary LOCAL runtime required");
  requireRealDirectory(root);
}
export async function canonicalExpectedMigrations(repository) {
  const verified = await verifyReleaseSources(repository);
  if (verified.manifestSha256 !== reviewedReleaseManifestSha256 || sha256(readRegularFile(`${repository}/supabase/bootstrap/manifest.json`)) !== reviewedBootstrapManifestSha256) throw Error("Current28 reviewed manifest identities required; newly changed manifests require review");
  const expected = [verified.bootstrap.anchor, verified.bootstrap.convergence].map(row => ({ filename: `${row.version}_${row.name}.sql`, sha256: row.sha256 }));
  expected.push(...verified.manifest.migrations.map(row => ({ filename: basename(row.path), sha256: row.sha256 })));
  if (expected.length !== 28) throw Error("Exact reviewed28 chain required");
  return { verified, expected };
}
export function readSourceEvidence(root) {
  assertRuntimeDirectory(root);
  const evidence = JSON.parse(readRegularFile(`${root}/runtime-source-evidence.json`));
  if (evidence.formatVersion !== 2 || evidence.cli !== "2.122.1" || evidence.startupRequiresEmptyActiveMigrations !== true
    || evidence.hostedExecutionAuthorised !== false || !/^[a-f0-9]{64}$/.test(evidence.configSha256 ?? "")
    || evidence.candidateManifest !== reviewedReleaseManifestSha256 || evidence.bootstrapManifest !== reviewedBootstrapManifestSha256) throw Error("New reviewed startup-gated runtime evidence required");
  const config = readRegularFile(`${root}/project/supabase/config.toml`);
  if (sha256(config) !== evidence.configSha256) throw Error("Generated local config changed");
  if (!/^[a-f0-9]{64}$/.test(evidence.cliSha256 ?? "") || sha256(readRegularFile(`${root}/supabase`, 128 * 1024 * 1024)) !== evidence.cliSha256) throw Error("Reviewed local CLI executable changed");
  return evidence;
}
export function assertEmptyStartupSources(root) {
  const evidence = readSourceEvidence(root);
  assertProjectSources(root, []);
  if (readdirSync(`${root}/project/supabase/migrations`).length) throw Error("Active migration directory must be entirely empty at start");
  return evidence;
}
/** Cooperative exclusive ownership is required; no malicious parent-swap guarantee. */
export function assertProjectSources(root, expected) {
  for (const path of [`${root}/project`, `${root}/project/supabase`, `${root}/project/supabase/migrations`]) requireRealDirectory(path);
  const allowedSql = new Set(expected.map(row => `${root}/project/supabase/migrations/${row.filename}`));
  function walk(path) {
    requireRealDirectory(path);
    for (const name of readdirSync(path)) {
      const child = join(path, name), stat = lstatSync(child);
      if (stat.isSymbolicLink()) throw Error("Startup source symlinks rejected");
      if (stat.isDirectory()) walk(child);
      else if (!stat.isFile() || (/\.sql$/i.test(name) && !allowedSql.has(child))) throw Error("Unexpected active SQL; start requires zero active SQL and staging requires exact reviewed sources");
    }
  }
  walk(`${root}/project/supabase`);
}
export function verifyExactMigrationFiles(directory, expected) {
  requireRealDirectory(directory);
  if (!Array.isArray(expected) || !expected.length || new Set(expected.map(row => row.filename)).size !== expected.length
    || expected.some(row => !/^\d{14}_[a-z0-9_]+\.sql$/.test(row.filename) || !/^[a-f0-9]{64}$/.test(row.sha256))) throw Error("Exact reviewed migration list required");
  const actual = readdirSync(directory).sort(), names = expected.map(row => row.filename).sort();
  if (JSON.stringify(actual) !== JSON.stringify(names)) throw Error("Migration directory differs from exact reviewed set");
  for (const row of expected) if (sha256(readRegularFile(join(directory, row.filename))) !== row.sha256) throw Error("Migration checksum mismatch");
}
export function verifyInactiveArtifact(root, expected) {
  assertRuntimeDirectory(root);
  verifyExactMigrationFiles(`${root}/reviewed-project/supabase/migrations`, expected);
}
const countKeys = ["publicRelations", "publicFunctions", "publicTypes", "applicationSchemas", "ledgerRows", "authUsers", "authIdentities", "authSessions", "storageBuckets", "storageObjects"];
const managedSchemas = new Set(["public", "auth", "storage", "realtime", "_realtime", "pgbouncer", "supabase_functions", "supabase_migrations", "extensions", "graphql", "graphql_public", "vault", "net", "pgsodium", "pgsodium_masks", "cron"]);
export function validateEmptyDatabase(value) {
  if (!value || value.postgresMajorVersion !== 17 || typeof value.ledgerExists !== "boolean"
    || !Array.isArray(value.schemaNames) || new Set(value.schemaNames).size !== value.schemaNames.length
    || ["public", "auth", "storage"].some(name => !value.schemaNames.includes(name)) || value.schemaNames.some(name => !managedSchemas.has(name))
    || countKeys.some(key => value[key] !== 0)
    || Object.keys(value).some(key => !["postgresMajorVersion", "ledgerExists", "schemaNames", ...countKeys].includes(key))) throw Error("Fresh live PostgreSQL17 with empty application, ledger, Auth and Storage required");
  return value;
}
export function validateLocalStackState(state, startup, evidence, stateBytes) {
  if (state?.runtime !== "native" || typeof state.id !== "string" || !state.id || startup?.formatVersion !== 1
    || startup.stackId !== state.id || startup.configSha256 !== evidence.configSha256 || startup.manifestSha256 !== evidence.candidateManifest
    || startup.privateStateSha256 !== sha256(stateBytes) || startup.startupSourceGuard !== "empty") throw Error("Exact guarded native startup identity required");
  let db;
  try { db = new URL(state.env.DB_URL); } catch { throw Error("Valid private local database endpoint required"); }
  if (!["postgres:", "postgresql:"].includes(db.protocol) || db.hostname !== "127.0.0.1" || !/^\d+$/.test(db.port) || !db.username || !db.password || !/^\/[a-zA-Z0-9_]+$/.test(db.pathname) || db.search || db.hash) throw Error("Exact loopback database connection required");
  return db;
}
export function verifyScheduledMigrations(output, filenames) {
  // CLI2.122.1 text dry-run contains a single migration bullet list. Unknown SQL,
  // missing or duplicate names, and disabled/up-to-date output must fail closed.
  const observed = [...output.matchAll(/[a-zA-Z0-9_.-]+\.sql\b/gi)].map(match => match[0]);
  if (!/DRY RUN|dry.run/i.test(output) || JSON.stringify(observed) !== JSON.stringify(filenames) || /include-all|include-seed|include-roles|migration(?:s)?\s+(?:is\s+|are\s+)?disabled|up\s+to\s+date/i.test(output)) throw Error("Dry-run did not schedule only the exact reviewed migration chain");
  return observed;
}
export function gateFingerprint({ evidence, stateBytes, expected }) {
  return sha256(JSON.stringify({ manifestSha256: evidence.candidateManifest, configSha256: evidence.configSha256, cliSha256: evidence.cliSha256, privateStateSha256: sha256(stateBytes), migrations: expected }));
}
