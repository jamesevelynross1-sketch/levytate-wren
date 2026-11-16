import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

type ManifestEntry = { path: string | null; sha256: string | null; version?: string };
type BootstrapManifest = {
  anchor: ManifestEntry & { version: string; isolatedLedgerStatementsSha256: string };
  convergence: { version: string; sha256: string; sources: ManifestEntry[] };
  excluded: ManifestEntry[];
  verification: Record<string, ManifestEntry>;
};

const repositoryRoot = process.cwd();
const manifest = JSON.parse(readFileSync(resolve(repositoryRoot, "supabase/bootstrap/manifest.json"), "utf8")) as BootstrapManifest;

describe("fresh-project bootstrap manifest", () => {
  it("hash-locks every file-backed source", () => {
    for (const entry of [
      manifest.anchor,
      ...manifest.convergence.sources,
      ...manifest.excluded.filter((item) => item.path),
      ...Object.values(manifest.verification),
    ]) {
      expect(entry.path).toBeTruthy();
      expect(entry.sha256).toBeTruthy();
      const actual = createHash("sha256").update(readFileSync(resolve(repositoryRoot, entry.path!))).digest("hex");
      expect(actual).toBe(entry.sha256);
    }
    expect(manifest.anchor.isolatedLedgerStatementsSha256).toBe(manifest.anchor.sha256);
  });

  it("preserves 039 while excluding every disallowed historical migration", () => {
    const included = manifest.convergence.sources.map((item) => item.path);
    expect(included.some((path) => path?.includes("039_create_levytate_lift_foundation.sql"))).toBe(true);
    expect(included.some((path) => path && /\/(007|008|010|019|038)_/.test(path))).toBe(false);
    expect(manifest.excluded.map((item) => item.version)).toEqual(["007", "008", "010", "019", "038"]);
  });

  it("requires every repository migration to be represented", () => {
    const represented = new Set([
      manifest.anchor.path,
      ...manifest.convergence.sources.map((item) => item.path),
      ...manifest.excluded.map((item) => item.path),
    ]);
    const unrepresented = readdirSync(resolve(repositoryRoot, "supabase/migrations"))
      .filter((name) => name.endsWith(".sql"))
      .map((name) => `supabase/migrations/${name}`)
      .filter((path) => !represented.has(path));

    expect(unrepresented).toEqual([]);
  });

  it("rebuilds the reviewed convergence SQL deterministically", () => {
    const output = JSON.parse(execFileSync(process.execPath, ["scripts/build-fresh-supabase-bootstrap.mjs", "--verify-only"], {
      cwd: repositoryRoot,
      encoding: "utf8",
    }));
    expect(output.anchorVersion).toBe("20261027174133");
    expect(output.convergenceSha256).toBe(manifest.convergence.sha256);
    expect(output.excludedVersions).toEqual(["007", "008", "010", "019", "038"]);
  });

  it("keeps browser roles closed and grants service operations explicitly", () => {
    const sql = readFileSync(resolve(repositoryRoot, "supabase/bootstrap/fresh_project_access_hardening.sql"), "utf8");
    expect(sql).toContain("revoke all on table %s from public, anon, authenticated");
    expect(sql).toContain("revoke execute on all functions in schema public from public, anon, authenticated, service_role");
    expect(sql).not.toMatch(/grant\s+all\b/i);
    expect(sql).toContain("grant select on table public.levytate_apprenticeship_standards to service_role");
    expect(sql).toContain("revoke all on table public.levytate_auth_rate_limits from service_role");
    expect(sql).toContain("public.levytate_lift_opportunity_route_members");
    expect(sql).toContain("public.levytate_lift_team_context_revisions");
  });
});
