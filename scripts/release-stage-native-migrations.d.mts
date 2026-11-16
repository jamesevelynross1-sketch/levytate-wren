export function localMigrationArguments(mode: "dry-run" | "apply", root: string): string[];
export function localStatusArguments(root: string): string[];
export function readEmptyNativeDatabase(db: URL, root: string): unknown;
export function runNativeMigrationStage(options: { runtime: string; repository: string; mode: string }, io?: { readDatabase?: (db: URL, root: string) => unknown; readStatus?: (root: string) => unknown; invokeCli?: (args: string[]) => string | Promise<string>; verifyApplied?: () => unknown }): Promise<Record<string, unknown>>;
