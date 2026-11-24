/** Restricted LOCAL recovery archive and isolated restore; never restores the source. */
import { readFileSync, writeFileSync, mkdirSync, chmodSync, lstatSync, realpathSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { randomBytes, createHash, createCipheriv, createDecipheriv, hkdfSync } from "node:crypto";
import { lockAcceptanceRuntime } from "./release-runtime-lock.mjs";
const root = process.env.RELEASE_LOCAL_RUNTIME;
const name = process.env.RELEASE_RECOVERY_DATABASE;
if (!/^\/(?:private\/)?tmp\/levytate-release-runtime\.[A-Za-z0-9]+$/.test(root ?? "") || !/^levytate_release_recovery_[a-z0-9_]+$/.test(name ?? "")) throw new Error("Explicit dedicated local recovery target required");
const release = lockAcceptanceRuntime("local encrypted recovery and isolated restore");
const sensitiveBuffers=[];
try {
const state = JSON.parse(readFileSync(`${root}/private-stack-state.json`, "utf8"));
if(!/^[a-f0-9]{64}$/.test(state.id??""))throw Error("Exact native runtime identity required");
const db = new URL(state.env.DB_URL);
if (db.hostname !== "127.0.0.1") throw new Error("Loopback source required");
// The archive contains Auth data. Reject even a local fixture whose tenancy
// cannot be proved fictional before making any backup bytes.
const fixture = JSON.parse(readFileSync(`${root}/fixture-manifest.json`,"utf8"));
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
if (fixture.synthetic !== true || fixture.environment !== "local"
  || !uuid.test(fixture.run ?? "") || fixture.tenants?.length !== 2
  || fixture.tenants.some(t=>!uuid.test(t.id??"") || !["a","b"].includes(t.key))
  || new Set(fixture.tenants.map(t=>t.id)).size !== 2)
  throw Error("Local recovery requires the approved two-tenant fictional fixture");
const bin = process.env.RELEASE_PG_BIN ?? (process.platform === "darwin" ? "/opt/homebrew/opt/postgresql@17/bin" : "/usr/lib/postgresql/17/bin");
const env = { ...process.env, PGHOST: db.hostname, PGPORT: db.port, PGUSER: db.username, PGPASSWORD: db.password, PGDATABASE: db.pathname.slice(1) };
function run(command, args, input, commandEnv = env) {
  const result = spawnSync(`${bin}/${command}`, args, { env: commandEnv, input, maxBuffer: 128 * 1024 * 1024 });
  if (result.status) { result.stdout?.fill(0); result.stderr?.fill(0); throw new Error(`${command} recovery step failed; source unchanged and partial target retained`); }
  return result.stdout;
}
const query = (sql, commandEnv = env) => run("psql", ["-XAtq", "-v", "ON_ERROR_STOP=1"], sql, commandEnv).toString().trim();
if (query(`select count(*) from pg_database where datname='${name}';`) !== "0") throw new Error("Recovery target exists; never overwrite it");
const [socket, port] = query("select current_setting('unix_socket_directories')||'|'||current_setting('port');").split("|");
if (!/^\/(?:private\/)?tmp\/supabase-\d+\/pg-[a-f0-9]+$/.test(socket) || !/^\d+$/.test(port)) throw new Error("Unexpected native administrative socket");
const admin = { ...env, PGHOST: socket, PGPORT: port, PGUSER: "supabase_admin" };
if (query("select current_setting('server_version_num')::int/10000=17 and rolsuper from pg_roles where rolname=current_user;", admin) !== "t") throw new Error("Expected local PG17 owner required");
const organisationSlugs = query("select string_agg(slug,',' order by slug) from public.levytate_organisations;", admin).split(",");
const allowed = new Set(["levytate-internal", ...fixture.tenants.map(t=>`release-${fixture.run}-${t.key}`)]);
if (organisationSlugs.length!==allowed.size || organisationSlugs.some(slug=>!allowed.has(slug))) {
  throw Error("Local recovery source includes an unapproved employer workspace");
}
// Full database archive keeps extension dependencies, managed owners and ACLs.
// No raw archive, Auth material or dump output is printed or stored unencrypted.
const archive = run("pg_dump", ["--format=custom"], undefined, admin); sensitiveBuffers.push(archive);
const list = run("pg_restore", ["--list"], archive).toString();
if (!["auth", "storage", "public", "supabase_migrations"].every(schema => list.includes(` ${schema} `)) || !list.includes("supabase_migrations schema_migrations")) throw new Error("Required recovery schemas or ledger absent");
const directory = `${root}/restricted-recovery`;
mkdirSync(directory, { recursive: true, mode: 0o700 }); chmodSync(directory, 0o700);
const stamp = Date.now();
const salt = randomBytes(32), iv = randomBytes(12);
const secret = JSON.parse(readFileSync(`${root}/private-app-secrets.json`, "utf8")).sessionSecret;
const key = Buffer.from(hkdfSync("sha256", secret, salt, "LevyTate local recovery v1", 32)); sensitiveBuffers.push(key);
const cipher = createCipheriv("aes-256-gcm", key, iv);
const ciphertext = Buffer.concat([cipher.update(archive), cipher.final()]);
const tag = cipher.getAuthTag();
const path = `${directory}/database-${stamp}.aes256gcm`;
writeFileSync(path, Buffer.concat([Buffer.from("LTREC01"), salt, iv, tag, ciphertext]), { mode: 0o600, flag: "wx" });
// Verify decryption of the saved archive before restoring to a new database.
const stored = readFileSync(path), offset = 7;
const restoreKey = Buffer.from(hkdfSync("sha256", secret, stored.subarray(offset, offset + 32), "LevyTate local recovery v1", 32)); sensitiveBuffers.push(restoreKey);
const decipher = createDecipheriv("aes-256-gcm", restoreKey, stored.subarray(offset + 32, offset + 44));
decipher.setAuthTag(stored.subarray(offset + 44, offset + 60));
const restoreChunk=decipher.update(stored.subarray(offset+60));sensitiveBuffers.push(restoreChunk);
const restoreFinal=decipher.final();sensitiveBuffers.push(restoreFinal);
const restoredArchive = Buffer.concat([restoreChunk,restoreFinal]); sensitiveBuffers.push(restoredArchive);
const digest = bytes => createHash("sha256").update(bytes).digest("hex");
if (digest(restoredArchive) !== digest(archive)) throw new Error("Saved archive decryption mismatch");
query(`create database ${name} template template0;`, admin);
const target = { ...admin, PGDATABASE: name };
run("pg_restore", ["--single-transaction", "--exit-on-error", "--dbname", name], restoredArchive, target);
const summarySQL = `select jsonb_build_object('tables',(select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r'),'rls',(select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and c.relrowsecurity),'authUsers',(select count(*) from auth.users),'storageObjects',(select count(*) from storage.objects),'employers',(select count(*) from levytate_organisations),'people',(select count(*) from levytate_employees),'ledger',(select count(*) from supabase_migrations.schema_migrations),'ledgerHash',(select encode(sha256(convert_to(coalesce(jsonb_agg(to_jsonb(m) order by version),'[]')::text,'UTF8')),'hex') from supabase_migrations.schema_migrations m),
  'providerGrants',(select count(*) from public.levytate_provider_delivery_grants),
  'providerReports',(select count(*) from public.levytate_provider_delivery_updates),
  'canonicalProviderProgress',(select count(*) from public.levytate_learner_progress_updates where source_reference like 'provider-delivery:%'),
  'providerReviewAudit',(select count(*) from public.levytate_audit_events where entity_type='provider_delivery_update'),
  'providerPromotionLedgerDigest',(select encode(sha256(convert_to(coalesce(jsonb_agg(to_jsonb(p) order by p.id),'[]')::text,'UTF8')),'hex')
    from public.levytate_learner_progress_updates p where p.source_reference like 'provider-delivery:%')
);`;
const sourceSummary = JSON.parse(query(summarySQL, admin));
const restoredSummary = JSON.parse(query(summarySQL, target));
if (sourceSummary.providerReports < 2 || sourceSummary.canonicalProviderProgress < 1
  || sourceSummary.providerReviewAudit < 2 || sourceSummary.providerGrants < 1) {
  throw Error("Local provider learner progress evidence is missing from the backup source");
}
if (JSON.stringify(sourceSummary) !== JSON.stringify(restoredSummary)) throw new Error("Recovery catalogue/count/ledger mismatch; source unchanged");
const evidence = { status: "PASS", environment: "local", sourceRuntimeId: state.id, database: name, archiveBytes: archive.length, archiveSha256: digest(archive), encryptedArchiveSha256: digest(stored), archiveEncryption: "AES-256-GCM; HKDF key derived from existing restricted local Preview secret", keyLocation: "existing restricted private-app-secrets.json; never in archive/evidence", archiveEntries: list.split("\n").filter(line => /^\d+;/.test(line)).length, ...restoredSummary, fullStorageBytesRecovery: false, hosted: false };
writeFileSync(`${directory}/database-${stamp}.evidence.json`, JSON.stringify(evidence, null, 2), { mode: 0o600, flag: "wx" });
if(process.env.RELEASE_DURABLE_RECOVERY==="true"){
  const repository="/Users/jamesross/Documents/levytate-wren",base=`${repository}/.local-acceptance-private`;
  const info=lstatSync(base),mode=info.mode&0o777;
  if(info.isSymbolicLink()||!info.isDirectory()||realpathSync(base)!==base||mode!==0o700||spawnSync("git",["-C",repository,"check-ignore","--quiet",base]).status!==0)throw Error("Approved durable recovery directory must be private and Git-ignored");
  const durable=`${base}/${state.id}-${stamp}`;mkdirSync(durable,{mode:0o700});
  writeFileSync(`${durable}/database.aes256gcm`,stored,{mode:0o600,flag:"wx"});
  // Preserve only the derived archive key, separately from ciphertext. This
  // cannot sign application sessions and is never used by browser acceptance.
  writeFileSync(`${durable}/recovery-key.bin`,key,{mode:0o600,flag:"wx"});
  const retained=readFileSync(`${durable}/database.aes256gcm`),retainedKey=readFileSync(`${durable}/recovery-key.bin`);sensitiveBuffers.push(retainedKey);
  const verified=createDecipheriv("aes-256-gcm",retainedKey,retained.subarray(offset+32,offset+44));verified.setAuthTag(retained.subarray(offset+44,offset+60));
  const retainedChunk=verified.update(retained.subarray(offset+60));sensitiveBuffers.push(retainedChunk);
  const retainedFinal=verified.final();sensitiveBuffers.push(retainedFinal);
  const plaintext=Buffer.concat([retainedChunk,retainedFinal]);sensitiveBuffers.push(plaintext);
  if(digest(plaintext)!==digest(archive))throw Error("Durable encrypted recovery verification failed");
  plaintext.fill(0);retainedKey.fill(0);
  const safe={...evidence,keyLocation:"separate restricted derived recovery key; not a session-signing credential",durableEncryptionVerified:true,directoryMode:"0700",fileMode:"0600",encryptedFiles:1,keyFiles:1,browserSessionStateExported:false};
  writeFileSync(`${durable}/evidence.json`,JSON.stringify(safe,null,2),{mode:0o600,flag:"wx"});
  console.log(JSON.stringify({durableRecovery:"PASS",directoryMode:"0700",fileMode:"0600",files:3,encryptedArchiveSha256:digest(retained),restoredDatabase:name,browserSessionStateExported:false}));
}
console.log(JSON.stringify(evidence));
} finally {
  for(const buffer of sensitiveBuffers)buffer.fill(0);
  release();
}
