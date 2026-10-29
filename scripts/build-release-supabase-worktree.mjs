#!/usr/bin/env node

// Offline artifact builder only: never links, connects, pushes or repairs a DB.
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { copyFile, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const approvedConvergence = "3bd6b681196ff865f50976129981b48601314d2bab2421794648fba51aefb204";
const checksum = (bytes) => createHash("sha256").update(bytes).digest("hex");
const isHash = (value) => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
const versionOf = (path) => basename(path).split("_")[0];

export async function verifyReleaseSources(root = repositoryRoot) {
  const manifestBytes = await readFile(resolve(root, "supabase/release-migrations/manifest.json"));
  const manifest = JSON.parse(manifestBytes);
  if (manifest.formatVersion !== 1 || manifest.postgresMajorVersion !== 17 || manifest.approvedBootstrapConvergenceSha256 !== approvedConvergence || !Array.isArray(manifest.migrations) || !manifest.migrations.length) throw new Error("Invalid release manifest or approved bootstrap identity.");
  const bootstrap = JSON.parse(await readFile(resolve(root, "supabase/bootstrap/manifest.json"), "utf8"));
  if (bootstrap.convergence.sha256 !== approvedConvergence) throw new Error("Approved bootstrap must remain unchanged.");
  // Use the approved builder's complete source verification without changing it.
  const bootstrapVerification = JSON.parse(execFileSync(process.execPath, [resolve(root, "scripts/build-fresh-supabase-bootstrap.mjs"), "--verify-only"], { encoding: "utf8" }));
  if (bootstrapVerification.convergenceSha256 !== approvedConvergence) throw new Error("Bootstrap regeneration differs from approval.");
  const seen = new Set();
  let previous = bootstrap.convergence.version;
  for (const source of manifest.migrations) {
    if (typeof source.path !== "string" || !/^supabase\/release-migrations\/\d{14}_[a-z0-9_]+\.sql$/.test(source.path) || !isHash(source.sha256)) throw new Error("Invalid release migration source.");
    const version = versionOf(source.path);
    if (seen.has(source.path) || version <= previous) throw new Error("Release versions must be unique and increasing after convergence.");
    seen.add(source.path); previous = version;
    const bytes = await readFile(resolve(root, source.path));
    if (checksum(bytes) !== source.sha256) throw new Error(`Release source hash mismatch: ${source.path}`);
    if (/\b(?:insert\s+into|update|delete\s+from|truncate(?:\s+table)?)\s+(?:"?supabase_migrations"?\.)/i.test(bytes.toString("utf8"))) throw new Error("Release source must not mutate migration history.");
  }
  const files = (await readdir(resolve(root, "supabase/release-migrations"))).filter((name) => name.endsWith(".sql"));
  if (files.some((name) => !seen.has(`supabase/release-migrations/${name}`))) throw new Error("An unreviewed release migration is not represented in the manifest.");
  return { manifest, bootstrap, manifestSha256: checksum(manifestBytes) };
}

export function validateBaseline(mode, baseline, bootstrap) {
  if (!["fresh", "shared"].includes(mode) || baseline?.formatVersion !== 1 || baseline.postgresMajorVersion !== 17 || !Array.isArray(baseline.rows) || !baseline.rows.length
    || !["local", "isolated-preview", "shared-history-read-only"].includes(baseline.environment) || typeof baseline.observedAt !== "string" || !Number.isFinite(Date.parse(baseline.observedAt))) throw new Error("Explicit PostgreSQL 17 read-only ledger evidence is required.");
  if (Object.keys(baseline).some((key) => !["formatVersion", "postgresMajorVersion", "environment", "observedAt", "rows"].includes(key))) throw new Error("Ledger evidence must contain metadata only, never credentials.");
  const versions = new Set();
  for (const row of baseline.rows) {
    if (typeof row.version !== "string" || !/^\d{3,14}$/.test(row.version) || typeof row.name !== "string" || !/^[a-z0-9_]+$/.test(row.name)
      || !Number.isInteger(row.statementCount) || row.statementCount < 0 || !isHash(row.statementsSha256) || versions.has(row.version)
      || Object.keys(row).some((key) => !["version", "name", "statementCount", "statementsSha256"].includes(key))) throw new Error("Malformed, duplicate or credential-bearing ledger evidence.");
    versions.add(row.version);
  }
  if (versions.has("038") || versions.has("019")) throw new Error("Excluded migration 019/038 must not be represented as applied.");
  if (mode === "fresh") {
    if (baseline.environment === "shared-history-read-only") throw new Error("The fresh worktree is never a shared-project target.");
    const expected = [bootstrap.anchor, bootstrap.convergence];
    if (baseline.rows.length !== expected.length || expected.some((source) => !baseline.rows.some((row) => row.version === source.version && row.name === source.name))) throw new Error("Fresh release requires the already-verified anchor and convergence ledger only; complete bootstrap separately.");
    const anchor = baseline.rows.find((row) => row.version === bootstrap.anchor.version);
    if (anchor.statementCount !== bootstrap.anchor.isolatedLedgerStatementCount || anchor.statementsSha256 !== bootstrap.anchor.isolatedLedgerStatementsSha256) throw new Error("Fresh anchor statement checksum does not match approval.");
    return [];
  }
  if (baseline.environment === "isolated-preview") throw new Error("Do not substitute shared history for an isolated fresh-project ledger.");
  const historical = [bootstrap.anchor, ...bootstrap.convergence.sources, ...bootstrap.excluded.filter((source) => ["007", "008", "010"].includes(source.version))]
    .filter((source) => /^supabase\/migrations\/\d{3}_/.test(source.path));
  const sourceByVersion = new Map(historical.map((source) => [versionOf(source.path), source]));
  const required = [bootstrap.anchor, ...bootstrap.convergence.sources].filter((source) => /^supabase\/migrations\/\d{3}_/.test(source.path)).map((source) => versionOf(source.path));
  if (required.some((version) => !versions.has(version))) throw new Error("Shared baseline is missing required historical schema versions; never schedule catch-up history in a release tree.");
  return baseline.rows.map((row) => {
    const source = sourceByVersion.get(row.version);
    if (!source || row.name !== basename(source.path).slice(row.version.length + 1, -4)) throw new Error(`Unrecognised shared history entry: ${row.version}`);
    return source;
  }).sort((a,b) => versionOf(a.path).localeCompare(versionOf(b.path)));
}

export async function buildReleaseWorktree(options) {
  const root = options.root ?? repositoryRoot;
  const verified = await verifyReleaseSources(root);
  const baselineBytes = await readFile(resolve(options.baseline));
  const baseline = JSON.parse(baselineBytes);
  const sharedSources = validateBaseline(options.mode, baseline, verified.bootstrap);
  const evidence = { formatVersion: 1, mode: options.mode, environment: baseline.environment, postgresMajorVersion: 17, manifestSha256: verified.manifestSha256,
    baselineEvidenceSha256: checksum(baselineBytes), approvedBootstrapConvergenceSha256: approvedConvergence,
    expectedAppliedBaseline: baseline.rows.map(({ version, name }) => ({ version, name })),
    expectedPendingMigrations: verified.manifest.migrations.map((source) => ({ filename: basename(source.path), sha256: source.sha256 })),
    excludedVersions: ["019", "038"], hostedExecutionAuthorised: false, linkedDryRunRequired: true };
  if (options.verifyOnly) return evidence;
  if (!options.output) throw new Error("Provide an empty output directory, or --verify-only.");
  const output = resolve(options.output);
  try { if ((await readdir(output)).length) throw new Error("Output directory must be empty; existing work is never overwritten."); }
  catch (error) { if (error.code !== "ENOENT") throw error; }
  if (options.mode === "fresh") execFileSync(process.execPath, [resolve(root, "scripts/build-fresh-supabase-bootstrap.mjs"), "--output", output], { encoding: "utf8" });
  else {
    await mkdir(resolve(output, "supabase/migrations"), { recursive: true });
    await copyFile(resolve(root, "supabase/config.toml"), resolve(output, "supabase/config.toml"));
    for (const source of sharedSources) {
      const bytes = await readFile(resolve(root, source.path));
      if (checksum(bytes) !== source.sha256) throw new Error("Shared historical source changed after verification.");
      await writeFile(resolve(output, "supabase/migrations", basename(source.path)), bytes, { flag: "wx" });
    }
  }
  for (const source of verified.manifest.migrations) {
    const bytes = await readFile(resolve(root, source.path));
    if (checksum(bytes) !== source.sha256) throw new Error("Release source changed after verification.");
    await writeFile(resolve(output, "supabase/migrations", basename(source.path)), bytes, { flag: "wx" });
  }
  await writeFile(resolve(output, "supabase/release-manifest.lock.json"), `${JSON.stringify(evidence, null, 2)}\n`, { flag: "wx" });
  return { ...evidence, outputRoot: output };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const options = {};
  for (let i=2;i<process.argv.length;i++) {
    const argument=process.argv[i];
    if (argument === "--verify-only") options.verifyOnly=true;
    else if (["--mode", "--baseline", "--output"].includes(argument)) { if (!process.argv[i+1] || process.argv[i+1].startsWith("--")) throw new Error(`Value required for ${argument}`); options[argument.slice(2)]=process.argv[++i]; }
    else throw new Error(`Unknown option: ${argument}`);
  }
  if (!options.mode || !options.baseline || (options.verifyOnly && options.output)) throw new Error("Use --mode fresh|shared --baseline READ_ONLY_LEDGER.json and either --output EMPTY_DIRECTORY or --verify-only.");
  process.stdout.write(`${JSON.stringify(await buildReleaseWorktree(options), null, 2)}\n`);
}
