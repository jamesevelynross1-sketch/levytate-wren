import { existsSync, realpathSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** Permit verified source files from the dedicated temporary or sibling worktrees. */
export function releaseRepository(value) {
  if (typeof value !== "string" || !isAbsolute(value)) throw new Error("Explicit release candidate worktree required");
  const root = realpathSync(value);
  const siblings = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
  if (!(root.startsWith("/private/tmp/levytate-") || dirname(root) === siblings)
    || !existsSync(resolve(root, ".git")) || !existsSync(resolve(root, "supabase/release-migrations/manifest.json"))) {
    throw new Error("Dedicated release candidate worktree required");
  }
  return root;
}
