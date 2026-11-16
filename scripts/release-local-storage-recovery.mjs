/** LOCAL physical-byte proof. Never writes to the source or a running Storage service. */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, realpathSync, statSync } from "node:fs";
import { basename, resolve } from "node:path";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { lockAcceptanceRuntime } from "./release-runtime-lock.mjs";
import { snapshotStorageFiles, storageSnapshotDigest, encryptStorageSnapshot, decryptStorageSnapshot, restoreStorageSnapshot } from "./release-storage-archive.mjs";

const root = process.env.RELEASE_LOCAL_RUNTIME;
const persistent = "/Users/jamesross/Documents/levytate-wren/.local-acceptance-private";
if (!/^\/private\/tmp\/levytate-release-runtime\.[A-Za-z0-9]+$/.test(root ?? "") || process.env.RELEASE_STORAGE_QUIESCENT !== "true") throw Error("Explicit dedicated LOCAL runtime and coordinated idle Storage required");
const ignored = spawnSync("git", ["check-ignore", "--quiet", `${persistent}/recovery-check`], { cwd: "/Users/jamesross/Documents/levytate-wren" });
if (ignored.status !== 0 || realpathSync(persistent) !== persistent || (statSync(persistent).mode & 0o777) !== 0o700) throw Error("Exact ignored private recovery directory required");
const release = lockAcceptanceRuntime("local encrypted physical Storage recovery");
let key;
try {
  const state = JSON.parse(readFileSync(`${root}/private-stack-state.json`, "utf8")), db = new URL(state.env.DB_URL);
  if (db.hostname !== "127.0.0.1") throw Error("Loopback database required");
  const manifest = JSON.parse(readFileSync(`${root}/fixture-manifest.json`, "utf8"));
  const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
  if (!manifest.synthetic || manifest.environment !== "local" || !uuid.test(manifest.run ?? "") || manifest.tenants?.length !== 2
    || manifest.tenants.some(tenant => !uuid.test(tenant.id ?? "") || !["a", "b"].includes(tenant.key))
    || new Set(manifest.tenants.map(tenant => tenant.key)).size !== 2 || new Set(manifest.tenants.map(tenant => tenant.id)).size !== 2) throw Error("Exact two-tenant fictional run manifest required");
  const tenantIds = manifest.tenants.map(tenant => `'${tenant.id}'`).join(",");
  const tenantRows = manifest.tenants.map(tenant => `(id='${tenant.id}' and slug='release-${manifest.run}-${tenant.key}')`).join(" or ");
  const folders = readdirSync(`${root}/home/stacks`, { withFileTypes: true }).filter(item => item.isDirectory());
  const sources = [];
  for (const folder of folders) {
    const base = `${root}/home/stacks/${folder.name}`;
    const native = JSON.parse(readFileSync(`${base}/state.json`, "utf8"));
    for (const service of native.instances.filter(item => item.creation.service === "storage")) {
      const path = service.creation.config.filePath;
      if (typeof path !== "string" || !resolve(path).startsWith(`${base}/`) || realpathSync(path) !== resolve(path)) throw Error("Unexpected native Storage root");
      sources.push(path);
    }
  }
  if (sources.length !== 1) throw Error("One exact local native Storage instance required");
  function catalogue() {
    const result = spawnSync("/opt/homebrew/opt/postgresql@17/bin/psql", ["-XAtq", "-v", "ON_ERROR_STOP=1"], {
      input: `set default_transaction_read_only=on; select jsonb_build_object('objects',count(*),'outsideFixtureTenants',count(*)filter(where split_part(name,'/',1) not in(${tenantIds})),'matchingTenants',(select count(*)from public.levytate_organisations where ${tenantRows}),'sha256',encode(sha256(convert_to(coalesce(jsonb_agg(to_jsonb(o) order by bucket_id,name),'[]')::text,'UTF8')),'hex')) from storage.objects o;`,
      encoding: "utf8", env: { ...process.env, PGHOST: db.hostname, PGPORT: db.port, PGUSER: db.username, PGPASSWORD: db.password, PGDATABASE: db.pathname.slice(1) },
    });
    if (result.status) throw Error("Read-only local Storage catalogue check failed; private details withheld");
    const value = JSON.parse(result.stdout.trim());
    if (!Number.isSafeInteger(value.objects) || value.objects < 1 || !/^[a-f0-9]{64}$/.test(value.sha256) || value.outsideFixtureTenants !== 0 || value.matchingTenants !== 2) throw Error("Nonempty Storage catalogue must match this exact fictional run's tenant prefixes");
    return value;
  }
  const before = catalogue(), snapshot = snapshotStorageFiles(sources[0]);
  const packed = encryptStorageSnapshot(snapshot); key = packed.key;
  const folder = `${persistent}/${basename(root)}`; mkdirSync(folder, { recursive: true, mode: 0o700 });
  if (realpathSync(folder) !== folder || (statSync(folder).mode & 0o777) !== 0o700) throw Error("Restricted per-run recovery directory required");
  const stamp = Date.now(), archivePath = `${folder}/storage-${stamp}.aes256gcm`, keyPath = `${folder}/storage-${stamp}.key`;
  writeFileSync(archivePath, packed.encrypted, { flag: "wx", mode: 0o600 });
  writeFileSync(keyPath, key, { flag: "wx", mode: 0o600 });
  if ((statSync(archivePath).mode & 0o777) !== 0o600 || (statSync(keyPath).mode & 0o777) !== 0o600) throw Error("Archive/key permissions differ");
  const saved = readFileSync(archivePath), savedKey = readFileSync(keyPath);
  let restored;
  try { restored = decryptStorageSnapshot(saved, savedKey); } finally { savedKey.fill(0); }
  const target = `${folder}/storage-restore-${stamp}`;
  restoreStorageSnapshot(restored, target);
  if (JSON.stringify(before) !== JSON.stringify(catalogue()) || storageSnapshotDigest(snapshotStorageFiles(sources[0])) !== storageSnapshotDigest(snapshot)) throw Error("Source changed during recovery; quiesce and take a new checkpoint");
  const evidence = { environment: "local", manifestDeclaredSynthetic: true, catalogueMatchesExactFixtureTenants: true, sourceQuiescenceRequired: true, concurrentMaliciousParentSwapProtection: false, observedAt: new Date().toISOString(), runtime: basename(root), status: "PASS", objects: before.objects, physicalFiles: snapshot.files.length, physicalBytes: snapshot.bytes, catalogueSha256: before.sha256, sourceFilesSha256: storageSnapshotDigest(snapshot), encryptedArchiveSha256: createHash("sha256").update(saved).digest("hex"), encryption: "AES-256-GCM with independent archive-only key in separate0600 file", savedArchiveDecryptionVerified: true, isolatedByteRestoreVerified: true, sourceUnchanged: true, restoredToService: false, databaseRestoreVerifiedByThisScript: false, hostedAcceptance: false };
  writeFileSync(`${folder}/storage-${stamp}.evidence.json`, JSON.stringify(evidence, null, 2), { flag: "wx", mode: 0o600 });
  console.log(JSON.stringify(evidence));
} finally { key?.fill(0); release(); }
