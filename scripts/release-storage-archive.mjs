/** Local recovery primitives. No service credentials or database mutations. */
import { createHash, randomBytes, createCipheriv, createDecipheriv } from "node:crypto";
import { lstatSync, readdirSync, mkdirSync, writeFileSync, existsSync, realpathSync, constants, openSync, fstatSync, closeSync, readSync } from "node:fs";
import { resolve, join, dirname, relative } from "node:path";

const digest = value => createHash("sha256").update(value).digest("hex");
const aad = Buffer.from("LevyTate local Storage byte recovery v1");
const maxBytes = 128 * 1024 * 1024;
export function snapshotStorageFiles(source) {
  if (!lstatSync(source).isDirectory() || realpathSync(source) !== resolve(source)) throw Error("Real dedicated Storage directory required");
  const files = [];
  let bytes = 0;
  function walk(folder) {
    // This local proof requires a quiescent, exclusively owned source tree.
    // Reject observed ancestry symlinks; Node has no portable openat traversal
    // that can defend against a malicious concurrent parent-directory swap.
    if (!lstatSync(folder).isDirectory() || realpathSync(folder) !== resolve(folder)) throw Error("Storage directory changed or contains symlink ancestry");
    for (const name of readdirSync(folder).sort()) {
      const path = join(folder, name), stat = lstatSync(path);
      if (stat.isSymbolicLink()) throw Error("Storage symlink rejected");
      if (stat.isDirectory()) walk(path);
      else if (stat.isFile()) {
        bytes += stat.size;
        if (bytes > maxBytes || files.length >= 10000) throw Error("Local recovery snapshot exceeds supported bound");
        const fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW);
        let data;
        try {
          const opened = fstatSync(fd);
          if (!opened.isFile() || opened.dev !== stat.dev || opened.ino !== stat.ino || opened.size !== stat.size || opened.mtimeMs !== stat.mtimeMs) throw Error("Storage file changed before snapshot");
          data = Buffer.alloc(opened.size);
          let offset = 0;
          while (offset < data.length) {
            const count = readSync(fd, data, offset, data.length - offset, offset);
            if (count === 0) throw Error("Storage truncated during snapshot");
            offset += count;
          }
          const after = fstatSync(fd);
          if (data.length !== stat.size || after.size !== opened.size || after.mtimeMs !== opened.mtimeMs || after.ctimeMs !== opened.ctimeMs) throw Error("Storage changed during snapshot");
        } finally { closeSync(fd); }
        files.push({ path: relative(source, path), bytes: data.length, sha256: digest(data), data: data.toString("base64") });
      } else throw Error("Unsupported Storage file type");
    }
  }
  walk(source);
  if (!files.length) throw Error("Nonempty fictional Storage bytes required for recovery proof");
  return { formatVersion: 1, files, bytes };
}
function validate(snapshot) {
  if (snapshot?.formatVersion !== 1 || !Array.isArray(snapshot.files) || !snapshot.files.length || snapshot.files.length > 10000) throw Error("Invalid Storage recovery snapshot");
  const seen = new Set();
  let bytes = 0;
  const files = snapshot.files.map(file => {
    if (typeof file.path !== "string" || !file.path || file.path.length > 4096 || /[\\\x00-\x1f\x7f]/.test(file.path)
      || file.path.startsWith("/") || file.path.split("/").some(part => !part || part === "." || part === "..") || seen.has(file.path)
      || !Number.isSafeInteger(file.bytes) || file.bytes < 0 || !/^[a-f0-9]{64}$/.test(file.sha256) || typeof file.data !== "string") throw Error("Unsafe Storage recovery entry");
    seen.add(file.path);
    bytes += file.bytes;
    if (bytes > maxBytes || file.data.length > Math.ceil(maxBytes / 3) * 4) throw Error("Storage recovery exceeds supported bound");
    const data = Buffer.from(file.data, "base64");
    if (data.toString("base64") !== file.data || data.length !== file.bytes || digest(data) !== file.sha256) throw Error("Storage recovery bytes do not match manifest");
    return { path: file.path, data };
  });
  if (bytes !== snapshot.bytes) throw Error("Storage recovery byte count differs");
  // Reject file/directory collisions before creating any target.
  for (const path of seen) for (let parent = dirname(path); parent !== "."; parent = dirname(parent)) if (seen.has(parent)) throw Error("Storage recovery path collision");
  return files;
}
export function storageSnapshotDigest(snapshot) {
  validate(snapshot);
  return digest(JSON.stringify(snapshot.files.map(({ path, bytes, sha256 }) => ({ path, bytes, sha256 }))));
}
export function encryptStorageSnapshot(snapshot, key = randomBytes(32)) {
  validate(snapshot);
  if (key.length !== 32) throw Error("Independent archive key required");
  const iv = randomBytes(12), cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(aad);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(snapshot), "utf8"), cipher.final()]);
  return { key, encrypted: Buffer.concat([Buffer.from("LTSTOR1"), iv, cipher.getAuthTag(), ciphertext]) };
}
export function decryptStorageSnapshot(encrypted, key) {
  if (encrypted.length < 36 || encrypted.length > 192 * 1024 * 1024 || encrypted.subarray(0, 7).toString() !== "LTSTOR1" || key.length !== 32) throw Error("Invalid encrypted Storage archive");
  const decipher = createDecipheriv("aes-256-gcm", key, encrypted.subarray(7, 19));
  decipher.setAAD(aad); decipher.setAuthTag(encrypted.subarray(19, 35));
  const snapshot = JSON.parse(Buffer.concat([decipher.update(encrypted.subarray(35)), decipher.final()]).toString("utf8"));
  validate(snapshot);
  return snapshot;
}
export function restoreStorageSnapshot(snapshot, target) {
  const files = validate(snapshot);
  if (existsSync(target)) throw Error("Recovery target exists; never overwrite source or previous restore");
  if (realpathSync(dirname(target)) !== resolve(dirname(target))) throw Error("Real private recovery parent required");
  mkdirSync(target, { mode: 0o700 });
  for (const file of files) {
    const path = join(target, file.path);
    mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
    writeFileSync(path, file.data, { flag: "wx", mode: 0o600 });
  }
  if (storageSnapshotDigest(snapshotStorageFiles(target)) !== storageSnapshotDigest(snapshot)) throw Error("Restored Storage bytes differ");
}
