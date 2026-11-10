#!/usr/bin/env node

import { createHash } from "node:crypto";
import { access, copyFile, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = resolve(repositoryRoot, "supabase/bootstrap/manifest.json");
const manifestBytes = await readFile(manifestPath);
const manifest = JSON.parse(manifestBytes.toString("utf8"));
const args = parseArguments(process.argv.slice(2));

await verifyManifestSources(manifest);
const convergenceSql = await buildConvergenceSql(manifest);
const convergenceSha256 = sha256(convergenceSql);

if (manifest.convergence.sha256 && manifest.convergence.sha256 !== convergenceSha256) {
  throw new Error(`Generated convergence hash mismatch: expected ${manifest.convergence.sha256}, received ${convergenceSha256}`);
}

const result = {
  manifest: "supabase/bootstrap/manifest.json",
  manifestSha256: sha256(manifestBytes),
  anchorVersion: manifest.anchor.version,
  anchorSha256: manifest.anchor.sha256,
  convergenceVersion: manifest.convergence.version,
  convergenceSha256,
  includedSourceCount: manifest.convergence.sources.length + 1,
  excludedVersions: manifest.excluded.map((item) => item.version),
};

if (args.verifyOnly) {
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  process.exit(0);
}

if (!args.output) throw new Error("Pass --output <empty-directory> or use --verify-only.");
const outputRoot = resolve(args.output);
await requireEmptyOrMissingDirectory(outputRoot);
const outputSupabase = resolve(outputRoot, "supabase");
const outputMigrations = resolve(outputSupabase, "migrations");
await mkdir(outputMigrations, { recursive: true });

await copyFile(resolve(repositoryRoot, "supabase/config.toml"), resolve(outputSupabase, "config.toml"));
await copyFile(
  resolve(repositoryRoot, manifest.anchor.path),
  resolve(outputMigrations, `${manifest.anchor.version}_${manifest.anchor.name}.sql`),
);
if (!args.anchorOnly) {
  await writeFile(
    resolve(outputMigrations, `${manifest.convergence.version}_${manifest.convergence.name}.sql`),
    convergenceSql,
    { flag: "wx" },
  );
}
await writeFile(
  resolve(outputSupabase, "bootstrap-manifest.lock.json"),
  `${JSON.stringify(result, null, 2)}\n`,
  { flag: "wx" },
);

process.stdout.write(`${JSON.stringify({ ...result, anchorOnly: args.anchorOnly, outputRoot }, null, 2)}\n`);

function parseArguments(values) {
  const parsed = { output: "", verifyOnly: false, anchorOnly: false };
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (value === "--verify-only") parsed.verifyOnly = true;
    else if (value === "--anchor-only") parsed.anchorOnly = true;
    else if (value === "--output") {
      parsed.output = values[index + 1] ?? "";
      index += 1;
    } else throw new Error(`Unknown argument: ${value}`);
  }
  if (parsed.verifyOnly && (parsed.output || parsed.anchorOnly)) throw new Error("--verify-only cannot be combined with output options.");
  if (parsed.anchorOnly && !parsed.output) throw new Error("--anchor-only requires --output.");
  return parsed;
}

async function verifyManifestSources(value) {
  const seen = new Set();
  const sources = [
    value.anchor,
    ...value.convergence.sources,
    ...value.excluded.filter((item) => item.path),
    ...Object.values(value.verification ?? {}),
  ];
  for (const source of sources) {
    if (!source.path || !source.sha256) throw new Error("Every file-backed manifest entry requires path and sha256.");
    if (seen.has(source.path)) throw new Error(`Duplicate manifest path: ${source.path}`);
    seen.add(source.path);
    const bytes = await readFile(resolve(repositoryRoot, source.path));
    const actual = sha256(bytes);
    if (actual !== source.sha256) throw new Error(`Source hash mismatch for ${source.path}: expected ${source.sha256}, received ${actual}`);
  }

  const migrationDirectory = resolve(repositoryRoot, "supabase/migrations");
  const migrationFiles = (await readdir(migrationDirectory)).filter((name) => name.endsWith(".sql"));
  for (const migrationFile of migrationFiles) {
    const migrationPath = `supabase/migrations/${migrationFile}`;
    if (!seen.has(migrationPath)) {
      throw new Error(`Migration is missing from the fresh-project manifest: ${migrationPath}`);
    }
  }

  const excludedVersions = new Set(value.excluded.map((item) => item.version));
  for (const required of ["007", "008", "010", "019", "038"]) {
    if (!excludedVersions.has(required)) throw new Error(`Required exclusion ${required} is missing.`);
  }
  if (!value.convergence.sources.some((item) => item.path.includes("039_create_levytate_lift_foundation.sql"))) {
    throw new Error("Migration 039 must be included in the convergence migration.");
  }
  if (value.convergence.sources.some((item) => /\/(007|008|010|019|038)_/.test(item.path))) {
    throw new Error("An explicitly excluded migration was added to convergence sources.");
  }
}

async function buildConvergenceSql(value) {
  const sections = [
    "-- Generated by scripts/build-fresh-supabase-bootstrap.mjs.",
    "-- Review supabase/bootstrap/manifest.json and every hash-locked source.",
    "-- Do not edit this generated file or use it against the shared LevyTate project.",
    "",
  ];
  for (const source of value.convergence.sources) {
    const sql = await readFile(resolve(repositoryRoot, source.path), "utf8");
    sections.push(`-- BEGIN HASHED SOURCE: ${source.path} (${source.sha256})`);
    sections.push(sql.endsWith("\n") ? sql.slice(0, -1) : sql);
    sections.push(`-- END HASHED SOURCE: ${source.path}`, "");
  }
  return `${sections.join("\n")}\n`;
}

async function requireEmptyOrMissingDirectory(path) {
  try {
    await access(path, constants.F_OK);
  } catch {
    return;
  }
  const entries = await readdir(path);
  if (entries.length > 0) throw new Error(`Output directory must be empty: ${path}`);
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}
