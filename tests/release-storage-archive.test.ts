import { afterEach, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, symlinkSync, rmSync, existsSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { snapshotStorageFiles, encryptStorageSnapshot, decryptStorageSnapshot, restoreStorageSnapshot, storageSnapshotDigest } from "../scripts/release-storage-archive.mjs";
const folders: string[] = [];
function fixture() {
  const folder = realpathSync(mkdtempSync(join(tmpdir(), "levytate-storage-recovery-"))); folders.push(folder);
  const source = join(folder, "source"); mkdirSync(source); mkdirSync(join(source, "bucket"));
  writeFileSync(join(source, "bucket", "fictional.bin"), Buffer.from([0, 1, 255, 10, 127]));
  return { folder, source };
}
afterEach(() => { for (const folder of folders.splice(0)) rmSync(folder, { recursive: true, force: true }); });
it("authenticates binary bytes and restores only to a new isolated directory", () => {
  const { source, folder } = fixture(), snapshot = snapshotStorageFiles(source);
  const { key, encrypted } = encryptStorageSnapshot(snapshot), restored = decryptStorageSnapshot(encrypted, key);
  const target = join(folder, "restore"); restoreStorageSnapshot(restored, target);
  expect(readFileSync(join(target, "bucket", "fictional.bin"))).toEqual(readFileSync(join(source, "bucket", "fictional.bin")));
  expect(storageSnapshotDigest(snapshotStorageFiles(target))).toBe(storageSnapshotDigest(snapshot));
  expect(() => restoreStorageSnapshot(restored, source)).toThrow("exists");
});
it("rejects ciphertext tampering and a wrong key before restoration", () => {
  const { source } = fixture(), { key, encrypted } = encryptStorageSnapshot(snapshotStorageFiles(source));
  const altered = Buffer.from(encrypted); altered[altered.length - 1] ^= 1;
  expect(() => decryptStorageSnapshot(altered, key)).toThrow();
  expect(() => decryptStorageSnapshot(encrypted, Buffer.alloc(32))).toThrow();
});
it.each(["../escaped", "/absolute", "nested/../../escaped", "nested\\escaped", "nested//file", "nested/./file"])("rejects malicious archive path %s without creating a destination", path => {
  const { source, folder } = fixture(), snapshot = snapshotStorageFiles(source), target = join(folder, "restore");
  snapshot.files[0].path = path;
  expect(() => restoreStorageSnapshot(snapshot, target)).toThrow(); expect(existsSync(target)).toBe(false);
});
it("rejects physical symlinks and empty-source false proofs", () => {
  const { source, folder } = fixture(); symlinkSync(join(source, "bucket", "fictional.bin"), join(source, "alias"));
  expect(() => snapshotStorageFiles(source)).toThrow("symlink");
  const empty = join(folder, "empty"); mkdirSync(empty); expect(() => snapshotStorageFiles(empty)).toThrow("Nonempty");
});
it("rejects duplicate paths, prefix collisions and altered bytes before writing", () => {
  const { source, folder } = fixture(), snapshot = snapshotStorageFiles(source), target = join(folder, "restore");
  expect(() => restoreStorageSnapshot({ ...snapshot, files: [...snapshot.files, snapshot.files[0]] }, target)).toThrow();
  expect(() => restoreStorageSnapshot({ ...snapshot, files: [{ ...snapshot.files[0], path: "bucket" }, snapshot.files[0]], bytes: snapshot.bytes * 2 }, target)).toThrow("collision");
  expect(() => restoreStorageSnapshot({ ...snapshot, files: [{ ...snapshot.files[0], sha256: "0".repeat(64) }] }, target)).toThrow("bytes");
  expect(existsSync(target)).toBe(false);
});
