/** Independent filesystem challenges for the LOCAL byte-recovery primitive.
 * Sources are exclusively owned and quiescent. This does not prove defence
 * against a malicious concurrent parent-directory swap or a live Storage restore.
 */
import { afterEach, describe, expect, it } from "vitest";
import { existsSync, mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, truncateSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { restoreStorageSnapshot, snapshotStorageFiles } from "../scripts/release-storage-archive.mjs";

const owned: string[] = [];
function fixture() {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "levytate-storage-independent-")));
  owned.push(root);
  const source = join(root, "source");
  mkdirSync(source);
  const file = join(source, "fictional.bin");
  writeFileSync(file, Buffer.from([1, 2, 3]));
  return { root, source, file };
}
afterEach(() => { for (const path of owned.splice(0)) rmSync(path, { recursive: true }); });

describe("independent local recovery filesystem boundaries, under explicit quiescence", () => {
  it("rejects a symlink replacing the source root", () => {
    const { root, source } = fixture(), alias = join(root, "source-alias");
    symlinkSync(source, alias);
    expect(() => snapshotStorageFiles(alias)).toThrow();
  });
  it("rejects a real source folder reached through symlink ancestry", () => {
    const { root } = fixture(), outer = join(root, "outer");
    mkdirSync(outer); symlinkSync(root, join(outer, "root-alias"));
    expect(() => snapshotStorageFiles(join(outer, "root-alias", "source"))).toThrow();
  });
  it("rejects a restore parent reached through a symlink before creating the target", () => {
    const { root, source } = fixture(), outer = join(root, "outer");
    mkdirSync(outer); symlinkSync(root, join(outer, "root-alias"));
    const snapshot = snapshotStorageFiles(source);
    expect(() => restoreStorageSnapshot(snapshot, join(outer, "root-alias", "restore"))).toThrow();
    expect(existsSync(join(root, "restore"))).toBe(false);
  });
  it("rejects noncanonical base64 even when it decodes to the original bytes", () => {
    const { root, source } = fixture(), snapshot = snapshotStorageFiles(source), target = join(root, "restore");
    snapshot.files[0].data += "\n";
    expect(() => restoreStorageSnapshot(snapshot, target)).toThrow();
    expect(existsSync(target)).toBe(false);
  });
  it("rejects a sparse file over the 128MiB bound before archive allocation", () => {
    const { source, file } = fixture();
    truncateSync(file, 129 * 1024 * 1024);
    expect(() => snapshotStorageFiles(source)).toThrow(/bound/);
  });
});
