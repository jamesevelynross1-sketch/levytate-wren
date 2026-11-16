/** Explicit fresh LOCAL stage -> dry-run -> apply. No hosted path, reset or repair. */
import { copyFileSync, constants, mkdirSync, writeFileSync, renameSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { lockAcceptanceRuntime } from "./release-runtime-lock.mjs";
import { assertRuntimeDirectory, existsWithoutFollowing, assertEmptyStartupSources, assertProjectSources, canonicalExpectedMigrations, gateFingerprint, readRegularFile, readSourceEvidence, sha256, validateEmptyDatabase, validateLocalStackState, verifyExactMigrationFiles, verifyInactiveArtifact, verifyScheduledMigrations } from "./release-native-migration-gate.mjs";

function localEnvironment(root) {
  const env = Object.fromEntries(["PATH", "HOME", "TMPDIR", "USER", "LOGNAME", "LANG", "LC_ALL", "SSL_CERT_FILE", "NODE_EXTRA_CA_CERTS"].filter(name => process.env[name]).map(name => [name, process.env[name]]));
  const secrets = JSON.parse(readRegularFile(`${root}/private-app-secrets.json`));
  return { ...env, SUPABASE_HOME: `${root}/home`, SUPABASE_EXPERIMENTAL_STACK: "1", RELEASE_LOCAL_RUNTIME: root, RELEASE_EMAIL_HOOK_SECRET: `v1,whsec_${secrets.hookSecret}` };
}
function checkedProcess(command, args, env, input) {
  const result = spawnSync(command, args, { env, input, encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
  if (result.status !== 0) throw Error("Local gate subprocess failed; raw diagnostics and private values withheld");
  return { stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
}
export function localStatusArguments(root) {
  return ["stack", "status", "--output-format", "json", "--workdir", `${root}/project`];
}
function readLocalStatus(root) {
  const result = checkedProcess(`${root}/supabase`, localStatusArguments(root), localEnvironment(root));
  try { return JSON.parse(result.stdout); } catch { throw Error("Live local stack status unavailable; private diagnostics withheld"); }
}
export function localMigrationArguments(mode, root) {
  if (!["dry-run", "apply"].includes(mode)) throw Error("Explicit local dry-run or apply required");
  return ["db", "push", "--local", "--skip-vault", ...(mode === "dry-run" ? ["--dry-run"] : ["--yes"]), "--workdir", `${root}/project`];
}
export function readEmptyNativeDatabase(db, root) {
  const env = { ...localEnvironment(root), PGHOST: db.hostname, PGPORT: db.port, PGUSER: decodeURIComponent(db.username), PGPASSWORD: decodeURIComponent(db.password), PGDATABASE: db.pathname.slice(1), PGOPTIONS: "-c default_transaction_read_only=on" };
  function query(sql) {
    const result = spawnSync("/opt/homebrew/opt/postgresql@17/bin/psql", ["-XAtq", "-v", "ON_ERROR_STOP=1"], { input: `begin transaction read only;\n${sql}\ncommit;`, env, encoding: "utf8" });
    if (result.status !== 0) throw Error("Live local empty-database check failed; private diagnostics withheld");
    try { return JSON.parse(result.stdout.trim()); } catch { throw Error("Unrecognised empty-database evidence"); }
  }
  const metadata = query(`select jsonb_build_object(
    'postgresMajorVersion',current_setting('server_version_num')::int/10000,
    'publicRelations',(select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and not exists(select 1 from pg_depend d where d.classid='pg_class'::regclass and d.objid=c.oid and d.deptype='e')),
    'publicFunctions',(select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and not exists(select 1 from pg_depend d where d.classid='pg_proc'::regclass and d.objid=p.oid and d.deptype='e')),
    'publicTypes',(select count(*) from pg_type t join pg_namespace n on n.oid=t.typnamespace where n.nspname='public' and t.typtype<>'c' and t.typelem=0 and not exists(select 1 from pg_depend d where d.classid='pg_type'::regclass and d.objid=t.oid and d.deptype='e')),
    'applicationSchemas',(select count(*) from pg_namespace where nspname like 'levytate%'),
    'schemaNames',(select jsonb_agg(nspname order by nspname) from pg_namespace where left(nspname,3)<>'pg_' and nspname<>'information_schema'),
    'ledgerExists',to_regclass('supabase_migrations.schema_migrations') is not null,
    'authUsers',(select count(*) from auth.users),'authIdentities',(select count(*) from auth.identities),'authSessions',(select count(*) from auth.sessions),
    'storageBuckets',(select count(*) from storage.buckets),'storageObjects',(select count(*) from storage.objects));`);
  metadata.ledgerRows = metadata.ledgerExists ? query("select count(*) from supabase_migrations.schema_migrations;") : 0;
  return validateEmptyDatabase(metadata);
}

/** Test IO overrides are an in-process unit seam, never exposed by the CLI. */
export async function runNativeMigrationStage({ runtime, repository, mode }, io = {}) {
  if (!["stage", "dry-run", "apply", "deactivate"].includes(mode) || process.env.RELEASE_LOCAL_RUNTIME !== runtime || process.env.RELEASE_RUNTIME_QUIESCENT !== "true") throw Error("Explicit stage/dry-run/apply/deactivate on an exclusively owned idle LOCAL runtime required");
  assertRuntimeDirectory(runtime);
  const release = lockAcceptanceRuntime(`guarded native migration ${mode}`);
  try {
    const evidence = readSourceEvidence(runtime), { expected, verified } = await canonicalExpectedMigrations(repository);
    if (evidence.candidateManifest !== verified.manifestSha256 || evidence.migrationCount !== expected.length) throw Error("Runtime source manifest identity differs");
    verifyInactiveArtifact(runtime, expected);
    const active = `${runtime}/project/supabase/migrations`;
    assertProjectSources(runtime, mode === "stage" ? [] : expected);
    if (mode === "deactivate") {
      verifyExactMigrationFiles(active, expected);
      const preserved = `${runtime}/deactivated-migrations-${Date.now()}`;
      renameSync(active, preserved); mkdirSync(active, { mode: 0o700 });
      return { status: "PASS", operation: mode, preservedDirectory: basename(preserved), movedReviewedFiles: expected.length, ledgerOrDataChanged: false };
    }
    if (mode === "stage") assertEmptyStartupSources(runtime);
    else verifyExactMigrationFiles(active, expected);
    const stateBytes = readRegularFile(`${runtime}/private-stack-state.json`), state = JSON.parse(stateBytes);
    const startup = JSON.parse(readRegularFile(`${runtime}/startup-source-evidence.json`));
    const db = validateLocalStackState(state, startup, evidence, stateBytes);
    const readStatus = io.readStatus ?? readLocalStatus;
    async function assertCurrentTarget() {
      const current = await readStatus(runtime);
      // CLI2.122.1 start emits top-level id; status deliberately has a distinct DTO.
      // Accept only the observed structured status identity, never an alias fallback.
      if (!current || typeof current !== "object" || Array.isArray(current) || Object.hasOwn(current, "id")
        || !current.identity || typeof current.identity !== "object" || Array.isArray(current.identity)
        || current.runtime !== "native" || current.identity.id !== state.id || current.env?.DB_URL !== state.env.DB_URL) throw Error("Live local CLI target differs from guarded startup identity");
    }
    await assertCurrentTarget();
    const readDatabase = io.readDatabase ?? readEmptyNativeDatabase;
    const empty = validateEmptyDatabase(await readDatabase(db, runtime));
    const fingerprint = gateFingerprint({ evidence, stateBytes, expected });
    const names = expected.map(row => row.filename);
    if (mode === "stage") {
      await assertCurrentTarget();
      for (const row of expected) copyFileSync(`${runtime}/reviewed-project/supabase/migrations/${row.filename}`, `${active}/${row.filename}`, constants.COPYFILE_EXCL);
      verifyExactMigrationFiles(active, expected);
      validateEmptyDatabase(await readDatabase(db, runtime));
      assertProjectSources(runtime, expected);
      await assertCurrentTarget();
      const staged = { formatVersion: 1, operation: "stage", fingerprint, stackId: state.id, observedAt: new Date().toISOString(), migrations: expected, emptyDatabase: empty, applied: false };
      writeFileSync(`${runtime}/migration-stage-${Date.now()}.json`, `${JSON.stringify(staged)}\n`, { flag: "wx", mode: 0o600 });
      return { status: "PASS", operation: mode, migrations: names, liveEmptyVerified: true, applied: false };
    }
    const invokeCli = io.invokeCli ?? ((args) => {
      const result = checkedProcess(`${runtime}/supabase`, args, localEnvironment(runtime));
      return `${result.stdout}\n${result.stderr}`;
    });
    if (mode === "dry-run") {
      await assertCurrentTarget();
      const output = await invokeCli(localMigrationArguments(mode, runtime));
      verifyScheduledMigrations(output, names);
      // Detect any unexpected CLI mutation despite its dry-run request.
      validateEmptyDatabase(await readDatabase(db, runtime));
      verifyExactMigrationFiles(active, expected);
      assertProjectSources(runtime, expected);
      await assertCurrentTarget();
      if (readSourceEvidence(runtime).configSha256 !== evidence.configSha256 || sha256(readRegularFile(`${runtime}/private-stack-state.json`)) !== sha256(stateBytes)) throw Error("Source/state changed during dry-run");
      const receipt = { formatVersion: 1, operation: "dry-run", fingerprint, stackId: state.id, observedAt: new Date().toISOString(), scheduled: names, cliArguments: localMigrationArguments(mode, runtime), outputSha256: sha256(output), liveEmptyBeforeAndAfter: true, liveCliTargetVerified: true, applied: false };
      const receiptName = `migration-dry-run-${Date.now()}.json`;
      writeFileSync(`${runtime}/${receiptName}`, `${JSON.stringify(receipt)}\n`, { flag: "wx", mode: 0o600 });
      if (existsWithoutFollowing(`${runtime}/latest-migration-dry-run.json`)) readRegularFile(`${runtime}/latest-migration-dry-run.json`);
      writeFileSync(`${runtime}/latest-migration-dry-run.json`, `${JSON.stringify({ receipt: receiptName })}\n`, { mode: 0o600 });
      return { status: "PASS", operation: mode, scheduled: names, liveEmptyBeforeAndAfter: true, applied: false };
    }
    const pointer = JSON.parse(readRegularFile(`${runtime}/latest-migration-dry-run.json`));
    if (!/^migration-dry-run-\d+\.json$/.test(pointer.receipt ?? "")) throw Error("Exact saved dry-run receipt required before apply");
    const receipt = JSON.parse(readRegularFile(`${runtime}/${pointer.receipt}`));
    if (receipt.formatVersion !== 1 || receipt.operation !== "dry-run" || receipt.fingerprint !== fingerprint || receipt.stackId !== state.id || receipt.liveEmptyBeforeAndAfter !== true || receipt.liveCliTargetVerified !== true || receipt.applied !== false
      || JSON.stringify(receipt.scheduled) !== JSON.stringify(names) || JSON.stringify(receipt.cliArguments) !== JSON.stringify(localMigrationArguments("dry-run", runtime))
      || !/^[a-f0-9]{64}$/.test(receipt.outputSha256 ?? "") || !Number.isFinite(Date.parse(receipt.observedAt)) || Date.now() - Date.parse(receipt.observedAt) < 0 || Date.now() - Date.parse(receipt.observedAt) > 30 * 60 * 1000) throw Error("Current matching live-empty dry-run receipt required before apply");
    // Re-read all sources/state and live DB at the final mutation boundary.
    await canonicalExpectedMigrations(repository); verifyInactiveArtifact(runtime, expected); verifyExactMigrationFiles(active, expected);
    assertProjectSources(runtime, expected);
    if (readSourceEvidence(runtime).configSha256 !== evidence.configSha256 || sha256(readRegularFile(`${runtime}/private-stack-state.json`)) !== sha256(stateBytes)) throw Error("Source/state changed before apply");
    validateEmptyDatabase(await readDatabase(db, runtime));
    await assertCurrentTarget();
    await invokeCli(localMigrationArguments("apply", runtime));
    await assertCurrentTarget();
    const verifyApplied = io.verifyApplied ?? (() => {
      const output = checkedProcess(process.execPath, [resolve(repository, "scripts/release-runtime-evidence.mjs")], localEnvironment(runtime));
      const result = JSON.parse(output.stdout.trim());
      if (result.rows?.length !== expected.length || ["authUsers", "storageObjects", "employers", "people"].some(key => result.metadata?.[key] !== 0)) throw Error("Post-apply exact empty schema/security/ledger verification failed");
      return result;
    });
    await verifyApplied();
    const applied = { status: "PASS", operation: mode, migrations: names, fingerprint, stackId: state.id, reviewedDryRunReceipt: pointer.receipt, postApplyVerification: true, activeFilesRetained: true, guardedRestartRequiresDeactivation: true, hostedExecution: false };
    writeFileSync(`${runtime}/migration-apply-${Date.now()}.json`, `${JSON.stringify(applied)}\n`, { flag: "wx", mode: 0o600 });
    return applied;
  } finally { release(); process.removeListener("exit", release); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (process.argv.length !== 3) throw Error("One explicit gate command required");
    console.log(JSON.stringify(await runNativeMigrationStage({ runtime: process.env.RELEASE_LOCAL_RUNTIME, repository: resolve(dirname(fileURLToPath(import.meta.url)), ".."), mode: process.argv[2] })));
  } catch (error) {
    // Messages are fixed local guard descriptions; never print child diagnostics or credentials.
    console.error(JSON.stringify({ status: "BLOCKED", safeError: error?.message?.startsWith("ENOENT") ? "Required local gate evidence is missing" : "Local migration gate failed; inspect reviewed sources and safe evidence before retrying" }));
    process.exitCode = 1;
  }
}
