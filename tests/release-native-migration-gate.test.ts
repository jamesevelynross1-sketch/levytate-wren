import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, writeFileSync, readFileSync, mkdirSync, rmSync, symlinkSync, readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { assertEmptyStartupSources, canonicalExpectedMigrations, readSourceEvidence, sha256, validateEmptyDatabase, validateLocalStackState, verifyScheduledMigrations } from "../scripts/release-native-migration-gate.mjs";
import { localMigrationArguments, runNativeMigrationStage } from "../scripts/release-stage-native-migrations.mjs";
const repository = resolve(import.meta.dirname, "..");
const roots: string[] = [];
const empty = { postgresMajorVersion: 17, publicRelations: 0, publicFunctions: 0, publicTypes: 0, applicationSchemas: 0, ledgerRows: 0, ledgerExists: false, authUsers: 0, authIdentities: 0, authSessions: 0, storageBuckets: 0, storageObjects: 0, schemaNames: ["auth", "public", "storage"] };
async function fixture() {
  const root = mkdtempSync("/private/tmp/levytate-release-runtime."); roots.push(root);
  writeFileSync(`${root}/supabase`, `#!${process.execPath}\nif(process.argv[2]!=="--version")process.exit(99);console.log("2.122.1");\n`, { mode: 0o700 });
  const result = spawnSync(process.execPath, [resolve(repository, "scripts/release-create-native-runtime.mjs")], { env: { ...process.env, RELEASE_LOCAL_RUNTIME: root }, encoding: "utf8" });
  expect(result.status).toBe(0);
  const evidence = readSourceEvidence(root), { expected } = await canonicalExpectedMigrations(repository);
  const stateBytes = Buffer.from(JSON.stringify({ runtime: "native", id: "unit-only-no-server", env: { DB_URL: "postgresql://unit:unit@127.0.0.1:1/unit" } }));
  writeFileSync(`${root}/private-stack-state.json`, stateBytes);
  writeFileSync(`${root}/startup-source-evidence.json`, JSON.stringify({ formatVersion: 1, stackId: "unit-only-no-server", configSha256: evidence.configSha256, manifestSha256: evidence.candidateManifest, privateStateSha256: sha256(stateBytes), startupSourceGuard: "empty" }));
  vi.stubEnv("RELEASE_LOCAL_RUNTIME", root); vi.stubEnv("RELEASE_RUNTIME_QUIESCENT", "true");
  const readDatabase = vi.fn(() => structuredClone(empty));
  const readStatus = vi.fn(() => JSON.parse(stateBytes.toString()));
  const invokeCli = vi.fn(async (args: string[]) => args.includes("--dry-run") ? `DRY RUN: migrations will not be applied\nWould push these migrations:\n${expected.map(row => ` • ${row.filename}`).join("\n")}\n` : "Applied reviewed migrations");
  const verifyApplied = vi.fn(() => ({}));
  const run = (mode: string) => runNativeMigrationStage({ runtime: root, repository, mode }, { readDatabase, readStatus, invokeCli, verifyApplied });
  return { root, expected, run, readDatabase, readStatus, invokeCli, verifyApplied };
}
afterEach(() => { vi.unstubAllEnvs(); for (const root of roots.splice(0)) rmSync(root, { recursive: true }); });

describe("fresh local startup migration gate (mock CLI/DB, never native acceptance)", () => {
  it("creates all28 verified SQL outside active sources and stages only after live-empty readback", async () => {
    const f = await fixture();
    expect(readdirSync(`${f.root}/project/supabase/migrations`)).toEqual([]);
    expect(readdirSync(`${f.root}/reviewed-project/supabase/migrations`)).toHaveLength(28);
    expect(() => assertEmptyStartupSources(f.root)).not.toThrow();
    await f.run("stage"); expect(f.readDatabase).toHaveBeenCalledTimes(2); expect(f.invokeCli).not.toHaveBeenCalled();
    expect(readdirSync(`${f.root}/project/supabase/migrations`)).toHaveLength(28);
    expect(() => assertEmptyStartupSources(f.root)).toThrow(/zero active SQL/);
  });
  it("requires explicit matching dry-run before apply and keeps restarts blocked until reviewed deactivation", async () => {
    const f = await fixture(); await f.run("stage");
    await expect(f.run("apply")).rejects.toThrow(); expect(f.invokeCli).not.toHaveBeenCalled();
    await f.run("dry-run"); expect(f.verifyApplied).not.toHaveBeenCalled();
    await f.run("apply"); expect(f.verifyApplied).toHaveBeenCalledOnce();
    expect(f.invokeCli.mock.calls.map(([args]) => args)).toEqual([localMigrationArguments("dry-run", f.root), localMigrationArguments("apply", f.root)]);
    await f.run("deactivate"); expect(() => assertEmptyStartupSources(f.root)).not.toThrow();
    expect(readdirSync(f.root).some(name => name.startsWith("deactivated-migrations-"))).toBe(true);
  });
  it("rejects an altered config after dry-run before invoking apply", async () => {
    const f = await fixture(); await f.run("stage"); await f.run("dry-run");
    writeFileSync(`${f.root}/project/supabase/config.toml`, `${readFileSync(`${f.root}/project/supabase/config.toml`)}\n# changed\n`);
    await expect(f.run("apply")).rejects.toThrow(/config changed/); expect(f.invokeCli).toHaveBeenCalledOnce();
  });
  it("rejects a replaced CLI executable before startup or apply", async () => {
    const f = await fixture(); await f.run("stage"); await f.run("dry-run");
    writeFileSync(`${f.root}/supabase`, "#!/bin/sh\nexit 0\n");
    expect(() => assertEmptyStartupSources(f.root)).toThrow(/CLI executable changed/);
    await expect(f.run("apply")).rejects.toThrow(/CLI executable changed/); expect(f.invokeCli).toHaveBeenCalledOnce();
  });
  it("rejects a changed generated SQL file after dry-run and refuses to deactivate unknown bytes", async () => {
    const f = await fixture(); await f.run("stage"); await f.run("dry-run");
    writeFileSync(`${f.root}/project/supabase/migrations/${f.expected[0].filename}`, "select 'unreviewed';");
    await expect(f.run("apply")).rejects.toThrow(/checksum/); await expect(f.run("deactivate")).rejects.toThrow(/checksum/);
    expect(f.invokeCli).toHaveBeenCalledOnce();
  });
  it("rejects live state that is no longer empty before applying", async () => {
    const f = await fixture(); await f.run("stage"); await f.run("dry-run");
    f.readDatabase.mockReturnValue({ ...empty, authUsers: 1 });
    await expect(f.run("apply")).rejects.toThrow(/empty/); expect(f.invokeCli).toHaveBeenCalledOnce();
  });
  it.each(["roles.sql", "seed.sql", "nested/extra.SQL"])("rejects unreviewed %s outside migrations after a valid dry-run", async filename => {
    const f = await fixture(); await f.run("stage"); await f.run("dry-run");
    if (filename.includes("/")) mkdirSync(`${f.root}/project/supabase/nested`);
    writeFileSync(`${f.root}/project/supabase/${filename}`, "select 1;");
    await expect(f.run("apply")).rejects.toThrow(/Unexpected active SQL/);
    await expect(f.run("deactivate")).rejects.toThrow(/Unexpected active SQL/);
    expect(f.invokeCli).toHaveBeenCalledOnce();
  });
  it("rejects changed private stack identity after dry-run without invoking apply", async () => {
    const f = await fixture(); await f.run("stage"); await f.run("dry-run");
    const state = JSON.parse(readFileSync(`${f.root}/private-stack-state.json`, "utf8"));
    state.env.DB_URL = "postgresql://unit:unit@127.0.0.1:2/another";
    writeFileSync(`${f.root}/private-stack-state.json`, JSON.stringify(state));
    await expect(f.run("apply")).rejects.toThrow(/startup identity/); expect(f.invokeCli).toHaveBeenCalledOnce();
  });
  it("rejects live CLI registry drift even when the private startup evidence is unchanged", async () => {
    const f = await fixture(); await f.run("stage"); await f.run("dry-run");
    f.readStatus.mockReturnValue({ runtime: "native", id: "another", env: { DB_URL: "postgresql://unit:unit@127.0.0.1:2/another" } });
    await expect(f.run("apply")).rejects.toThrow(/Live local CLI target/); expect(f.invokeCli).toHaveBeenCalledOnce();
  });
  it("refuses to activate SQL when the live target changes during empty-database verification", async () => {
    const f = await fixture(), unchanged = JSON.parse(readFileSync(`${f.root}/private-stack-state.json`, "utf8"));
    f.readStatus.mockReturnValueOnce(unchanged).mockReturnValue({ ...unchanged, id: "another" });
    await expect(f.run("stage")).rejects.toThrow(/Live local CLI target/);
    expect(readdirSync(`${f.root}/project/supabase/migrations`)).toEqual([]); expect(f.invokeCli).not.toHaveBeenCalled();
  });
  it("rechecks the live CLI target at the final apply boundary after its first valid check", async () => {
    const f = await fixture(); await f.run("stage"); await f.run("dry-run");
    const unchanged = JSON.parse(readFileSync(`${f.root}/private-stack-state.json`, "utf8"));
    f.readStatus.mockReturnValueOnce(unchanged).mockReturnValue({ ...unchanged, env: { DB_URL: "postgresql://unit:unit@127.0.0.1:2/another" } });
    await expect(f.run("apply")).rejects.toThrow(/Live local CLI target/); expect(f.invokeCli).toHaveBeenCalledOnce();
  });
  it("rejects expired or traversing dry-run receipts and retains active reviewed sources", async () => {
    const f = await fixture(); await f.run("stage"); await f.run("dry-run");
    const pointerPath = `${f.root}/latest-migration-dry-run.json`, pointer = JSON.parse(readFileSync(pointerPath, "utf8"));
    const receiptPath = `${f.root}/${pointer.receipt}`, receipt = JSON.parse(readFileSync(receiptPath, "utf8"));
    receipt.observedAt = new Date(Date.now() - 31 * 60_000).toISOString();
    writeFileSync(receiptPath, JSON.stringify(receipt)); await expect(f.run("apply")).rejects.toThrow(/matching/);
    writeFileSync(pointerPath, JSON.stringify({ receipt: `../${pointer.receipt}` }));
    await expect(f.run("apply")).rejects.toThrow(/saved dry-run/); expect(f.invokeCli).toHaveBeenCalledOnce();
    expect(readdirSync(`${f.root}/project/supabase/migrations`)).toHaveLength(28);
  });
  it("rejects active source symlinks, nested SQL and an unreviewed self-consistent runtime manifest", async () => {
    const f = await fixture(), active = `${f.root}/project/supabase/migrations`;
    symlinkSync(`${f.root}/reviewed-project/supabase/migrations/${f.expected[0].filename}`, `${active}/alias`);
    expect(() => assertEmptyStartupSources(f.root)).toThrow(/symlink/); rmSync(`${active}/alias`);
    mkdirSync(`${f.root}/project/supabase/nested`); writeFileSync(`${f.root}/project/supabase/nested/hidden.sql`, "select 1;");
    expect(() => assertEmptyStartupSources(f.root)).toThrow(/zero active SQL/); rmSync(`${f.root}/project/supabase/nested`, { recursive: true });
    const evidence = JSON.parse(readFileSync(`${f.root}/runtime-source-evidence.json`, "utf8")); evidence.candidateManifest = "0".repeat(64);
    writeFileSync(`${f.root}/runtime-source-evidence.json`, JSON.stringify(evidence));
    await expect(f.run("stage")).rejects.toThrow(/reviewed/); expect(f.readDatabase).not.toHaveBeenCalled();
  });
});
it.each(["publicRelations", "publicFunctions", "publicTypes", "applicationSchemas", "ledgerRows", "authUsers", "authIdentities", "authSessions", "storageBuckets", "storageObjects"])("rejects nonempty %s", key => {
  expect(() => validateEmptyDatabase({ ...empty, [key]: 1 })).toThrow();
});
it("rejects unknown schemas and malformed counts", () => {
  for (const schema of ["unreviewed", "pgclient", "pgx"]) expect(() => validateEmptyDatabase({ ...empty, schemaNames: [...empty.schemaNames, schema] })).toThrow();
  expect(() => validateEmptyDatabase({ ...empty, authUsers: "0" })).toThrow();
});
it("rejects remote or unrelated loopback stack identity before database access", () => {
  const evidence = { configSha256: "config", candidateManifest: "manifest" };
  for (const endpoint of ["postgresql://unit:unit@db.example.test:5432/postgres", "postgresql://unit:unit@127.0.0.1:5432/postgres?host=remote"]) {
    const state = { runtime: "native", id: "original", env: { DB_URL: endpoint } }, bytes = Buffer.from(JSON.stringify(state));
    const startup = { formatVersion: 1, stackId: "original", configSha256: "config", manifestSha256: "manifest", privateStateSha256: sha256(bytes), startupSourceGuard: "empty" };
    expect(() => validateLocalStackState(state, startup, evidence, bytes)).toThrow(/loopback/);
  }
  const state = { runtime: "native", id: "another", env: { DB_URL: "postgresql://unit:unit@127.0.0.1:5432/postgres" } }, bytes = Buffer.from(JSON.stringify(state));
  expect(() => validateLocalStackState(state, { formatVersion: 1, stackId: "original" }, evidence, bytes)).toThrow(/startup identity/);
});
it("rejects absent, duplicate, extra, seed and disabled migration schedules", () => {
  const names = ["20261110000000_reviewed.sql"], good = `DRY RUN\nWould push these migrations:\n • ${names[0]}`;
  expect(verifyScheduledMigrations(good, names)).toEqual(names);
  for (const bad of ["Database up to date", `${good}\n${names[0]}`, `${good}\n038_unapproved.sql`, `${good}\nseed.sql`, `${good}\nroles.sql`, `${good}\nMigrations disabled`]) expect(() => verifyScheduledMigrations(bad, names)).toThrow();
});
it("constructs only explicit local commands with vault writes excluded", () => {
  for (const mode of ["dry-run", "apply"] as const) {
    const args = localMigrationArguments(mode, "/private/tmp/levytate-release-runtime.Unit");
    expect(args).toContain("--local"); expect(args).toContain("--skip-vault");
    expect(args.some(value => ["--linked", "--db-url", "--include-all", "--include-seed", "--include-roles", "reset", "repair"].includes(value))).toBe(false);
  }
});
