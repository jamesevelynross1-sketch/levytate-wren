import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const script = resolve("scripts/validate-levytate-environment-manifest.mjs");
const temporaryDirectories: string[] = [];

afterEach(() => {
  temporaryDirectories.splice(0).forEach((directory) => rmSync(directory, { force: true, recursive: true }));
});

function writeInventory(value: unknown) {
  const directory = mkdtempSync(join(tmpdir(), "levytate-environment-names-"));
  temporaryDirectories.push(directory);
  const path = join(directory, "names.json");
  writeFileSync(path, JSON.stringify(value));
  return path;
}

function run(...args: string[]) {
  return spawnSync(process.execPath, [script, ...args], { cwd: process.cwd(), encoding: "utf8" });
}

describe("credential-free environment manifest", () => {
  it("validates the committed environment-name contract without accessing runtime values", () => {
    const result = run();
    const source = readFileSync(script, "utf8");

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("PASS credential-free environment manifest");
    expect(source).not.toContain("process.env");
  });

  it("accepts a names-only production inventory containing every required name", () => {
    const namesFile = writeInventory({
      environment: "production",
      names: ["LEVYTATE_BETA_SESSION_SECRET", "NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"],
    });

    const result = run("--environment", "production", "--names-file", namesFile);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("PASS production environment name inventory");
  });

  it("fails when a launch-critical name is absent", () => {
    const namesFile = writeInventory({
      environment: "preview",
      names: ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"],
    });

    const result = run("--environment", "preview", "--names-file", namesFile);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("LEVYTATE_BETA_SESSION_SECRET");
  });

  it("rejects inventories that contain value fields without printing their contents", () => {
    const sentinel = "do-not-print-this-secret-value";
    const namesFile = writeInventory({
      environment: "production",
      names: ["LEVYTATE_BETA_SESSION_SECRET", "NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"],
      values: { LEVYTATE_BETA_SESSION_SECRET: sentinel },
    });

    const result = run("--environment", "production", "--names-file", namesFile);
    const output = `${result.stdout}${result.stderr}`;

    expect(result.status).toBe(1);
    expect(output).toContain("must contain only");
    expect(output).not.toContain(sentinel);
  });
});
