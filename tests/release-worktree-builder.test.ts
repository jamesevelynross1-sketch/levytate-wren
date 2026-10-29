import { afterEach, describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { buildReleaseWorktree, ledgerChecksumAlgorithm, validateBaseline, verifyReleaseSources } from "../scripts/build-release-supabase-worktree.mjs";

const temporaryDirectories: string[] = [];
afterEach(async () => { for (const directory of temporaryDirectories.splice(0)) await rm(directory, { recursive: true }); });
const hash = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");

async function baselineFixture(mode: "fresh" | "shared") {
  const verified = await verifyReleaseSources();
  const bootstrap = verified.bootstrap;
  // Synthetic metadata exercises the offline builder contract only. It is never
  // presented as observed hosted history or inserted into any migration ledger.
  const reference = JSON.parse(await readFile(new URL("./release-native-ledger-evidence.json", import.meta.url), "utf8")) as { rows: Array<{ version: string; name: string; statementCount: number; statementsSha256: string }> };
  const rows = mode === "fresh" ? reference.rows.map(({ version, name, statementCount, statementsSha256 }) => ({ version, name, statementCount, statementsSha256 }))
    : [bootstrap.anchor, ...bootstrap.convergence.sources].filter((source) => /^supabase\/migrations\/\d{3}_/.test(source.path)).map((source) => ({ version: basename(source.path).split("_")[0], name: basename(source.path).replace(/^\d+_/, "").slice(0, -4), statementCount: 1, statementsSha256: source.sha256 }));
  return { verified, baseline: { formatVersion: 1, postgresMajorVersion: 17, environment: "local", observedAt: "2026-10-29T12:00:00Z", statementChecksumAlgorithm: ledgerChecksumAlgorithm, rows } };
}

describe("separate release migration worktrees (offline artifacts, no database execution)", () => {
  it("hash-locks every new source without altering the approved bootstrap", async () => {
    const verified = await verifyReleaseSources();
    expect(verified.bootstrap.convergence.sha256).toBe("3bd6b681196ff865f50976129981b48601314d2bab2421794648fba51aefb204");
    expect(verified.manifest.migrations.length).toBeGreaterThanOrEqual(5);
  });
  it.each(["fresh", "shared"] as const)("generates the %s tree with identical release SQL and no038, refusing overwrite", async (mode) => {
    const { verified, baseline } = await baselineFixture(mode);
    const directory = await mkdtemp(join(tmpdir(), "levytate-release-builder-test-")); temporaryDirectories.push(directory);
    const baselinePath = join(directory, "synthetic-offline-baseline.json");
    await writeFile(baselinePath, JSON.stringify(baseline), { flag: "wx" });
    const output = join(directory, "generated");
    const result = await buildReleaseWorktree({ mode, baseline: baselinePath, output });
    expect(result.hostedExecutionAuthorised).toBe(false); expect(result.linkedDryRunRequired).toBe(true);
    const files = await readdir(join(output, "supabase/migrations"));
    expect(files.some((name) => name.startsWith("038_") || name.startsWith("019_"))).toBe(false);
    for (const source of verified.manifest.migrations) expect(hash(await readFile(join(output, "supabase/migrations", basename(source.path))))).toBe(source.sha256);
    if (mode === "fresh") expect(files.filter((name) => name.startsWith("20261027"))).toHaveLength(2);
    else expect(files).toContain("006_create_levytate_production_foundation.sql");
    await expect(buildReleaseWorktree({ mode, baseline: baselinePath, output })).rejects.toThrow("must be empty");
  });
  it("requires completed bootstrap, correct anchor checksum and a distinct fresh history", async () => {
    const { verified, baseline } = await baselineFixture("fresh");
    expect(() => validateBaseline("fresh", { ...baseline, rows: baseline.rows.slice(0,1) }, verified.bootstrap)).toThrow("complete bootstrap separately");
    expect(() => validateBaseline("fresh", { ...baseline, rows: baseline.rows.map((row) => ({ ...row, statementsSha256: "a".repeat(64) })) }, verified.bootstrap)).toThrow("checksum");
    expect(() => validateBaseline("fresh", { ...baseline, environment: "shared-history-read-only" }, verified.bootstrap)).toThrow("never a shared-project");
  });
  it("rejects missing shared schema history rather than scheduling historical catch-up", async () => {
    const { verified, baseline } = await baselineFixture("shared");
    expect(() => validateBaseline("shared", { ...baseline, rows: baseline.rows.slice(1) }, verified.bootstrap)).toThrow("missing required historical");
  });
  it("rejects a source-file hash substituted for the actual convergence ledger checksum", async () => {
    const { verified, baseline } = await baselineFixture("fresh");
    expect(() => validateBaseline("fresh", { ...baseline, rows: baseline.rows.map((row) => row.version === verified.bootstrap.convergence.version ? { ...row, statementCount: 1, statementsSha256: verified.bootstrap.convergence.sha256 } : row) }, verified.bootstrap)).toThrow("Convergence recorded-statement checksum");
    expect(() => validateBaseline("fresh", { ...baseline, statementChecksumAlgorithm: "json-stringify" }, verified.bootstrap)).toThrow("checksum algorithm");
  });
  it("never substitutes the local split anchor for the isolated hosted single-statement anchor", async () => {
    const { verified, baseline } = await baselineFixture("fresh");
    expect(() => validateBaseline("fresh", { ...baseline, environment: "isolated-preview" }, verified.bootstrap)).toThrow("exact environment");
    const rows = baseline.rows.map((row) => row.version === verified.bootstrap.anchor.version ? { ...row, statementCount: verified.bootstrap.anchor.isolatedLedgerStatementCount, statementsSha256: verified.bootstrap.anchor.isolatedLedgerStatementsSha256 } : row);
    expect(validateBaseline("fresh", { ...baseline, environment: "isolated-preview", rows }, verified.bootstrap)).toEqual([]);
  });
  it("rejects038, duplicate rows, unknown history and secret-bearing evidence", async () => {
    const { verified, baseline } = await baselineFixture("shared");
    const row = baseline.rows[0];
    expect(() => validateBaseline("shared", { ...baseline, rows: [...baseline.rows, { ...row, version: "038" }] }, verified.bootstrap)).toThrow("Excluded migration");
    expect(() => validateBaseline("shared", { ...baseline, rows: [...baseline.rows, row] }, verified.bootstrap)).toThrow("duplicate");
    expect(() => validateBaseline("shared", { ...baseline, rows: [...baseline.rows, { ...row, version: "999" }] }, verified.bootstrap)).toThrow("Unrecognised");
    expect(() => validateBaseline("shared", { ...baseline, databaseUrl: "not-a-real-secret" }, verified.bootstrap)).toThrow("never credentials");
  });
});
