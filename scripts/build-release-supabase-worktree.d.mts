export type MigrationSource = { path: string; sha256: string };
export type BootstrapManifest = {
  anchor: MigrationSource & { version: string; name: string; isolatedLedgerStatementCount: number; isolatedLedgerStatementsSha256: string };
  convergence: { version: string; name: string; sha256: string; sources: MigrationSource[] };
  excluded: Array<{ version: string; path: string | null; sha256: string | null }>;
};
export type ReleaseManifest = { formatVersion: number; postgresMajorVersion: number; approvedBootstrapConvergenceSha256: string; migrations: MigrationSource[] };
export function verifyReleaseSources(root?: string): Promise<{ manifest: ReleaseManifest; bootstrap: BootstrapManifest; manifestSha256: string }>;
export function validateBaseline(mode: string, baseline: unknown, bootstrap: BootstrapManifest): MigrationSource[];
export function buildReleaseWorktree(options: { root?: string; mode: "fresh" | "shared"; baseline: string; output?: string; verifyOnly?: boolean }): Promise<{
  formatVersion: number;
  mode: string;
  environment: string;
  postgresMajorVersion: number;
  manifestSha256: string;
  baselineEvidenceSha256: string;
  approvedBootstrapConvergenceSha256: string;
  expectedAppliedBaseline: Array<{ version: string; name: string }>;
  expectedPendingMigrations: Array<{ filename: string; sha256: string }>;
  excludedVersions: string[];
  hostedExecutionAuthorised: boolean;
  linkedDryRunRequired: boolean;
  outputRoot?: string;
}>;
