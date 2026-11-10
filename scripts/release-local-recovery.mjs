/** Restricted LOCAL recovery archive and isolated restore; never restores the source. */
import { readFileSync, writeFileSync, mkdirSync, chmodSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { randomBytes, createHash, createCipheriv, createDecipheriv, hkdfSync } from "node:crypto";
import { lockAcceptanceRuntime } from "./release-runtime-lock.mjs";
const root = process.env.RELEASE_LOCAL_RUNTIME;
const name = process.env.RELEASE_RECOVERY_DATABASE;
if (!/^\/private\/tmp\/levytate-release-runtime\.[A-Za-z0-9]+$/.test(root ?? "") || !/^levytate_release_recovery_[a-z0-9_]+$/.test(name ?? "")) throw new Error("Explicit dedicated local recovery target required");
const release = lockAcceptanceRuntime("local encrypted recovery and isolated restore");
const state = JSON.parse(readFileSync(`${root}/private-stack-state.json`, "utf8"));
const db = new URL(state.env.DB_URL);
if (db.hostname !== "127.0.0.1") throw new Error("Loopback source required");
const bin = "/opt/homebrew/opt/postgresql@17/bin";
const env = { ...process.env, PGHOST: db.hostname, PGPORT: db.port, PGUSER: db.username, PGPASSWORD: db.password, PGDATABASE: db.pathname.slice(1) };
function run(command, args, input, commandEnv = env) {
  const result = spawnSync(`${bin}/${command}`, args, { env: commandEnv, input, maxBuffer: 128 * 1024 * 1024 });
  if (result.status) throw new Error(`${command} recovery step failed; source unchanged and partial target retained`);
  return result.stdout;
}
const query = (sql, commandEnv = env) => run("psql", ["-XAtq", "-v", "ON_ERROR_STOP=1"], sql, commandEnv).toString().trim();
if (query(`select count(*) from pg_database where datname='${name}';`) !== "0") throw new Error("Recovery target exists; never overwrite it");
const [socket, port] = query("select current_setting('unix_socket_directories')||'|'||current_setting('port');").split("|");
if (!/^\/private\/tmp\/supabase-\d+\/pg-[a-f0-9]+$/.test(socket) || !/^\d+$/.test(port)) throw new Error("Unexpected native administrative socket");
const admin = { ...env, PGHOST: socket, PGPORT: port, PGUSER: "supabase_admin" };
if (query("select current_setting('server_version_num')::int/10000=17 and rolsuper from pg_roles where rolname=current_user;", admin) !== "t") throw new Error("Expected local PG17 owner required");
// Full database archive keeps extension dependencies, managed owners and ACLs.
// No raw archive, Auth material or dump output is printed or stored unencrypted.
const archive = run("pg_dump", ["--format=custom"], undefined, admin);
const list = run("pg_restore", ["--list"], archive).toString();
if (!["auth", "storage", "public", "supabase_migrations"].every(schema => list.includes(` ${schema} `)) || !list.includes("supabase_migrations schema_migrations")) throw new Error("Required recovery schemas or ledger absent");
const directory = `${root}/restricted-recovery`;
mkdirSync(directory, { recursive: true, mode: 0o700 }); chmodSync(directory, 0o700);
const stamp = Date.now();
const salt = randomBytes(32), iv = randomBytes(12);
const secret = JSON.parse(readFileSync(`${root}/private-app-secrets.json`, "utf8")).sessionSecret;
const key = Buffer.from(hkdfSync("sha256", secret, salt, "LevyTate local recovery v1", 32));
const cipher = createCipheriv("aes-256-gcm", key, iv);
const ciphertext = Buffer.concat([cipher.update(archive), cipher.final()]);
const tag = cipher.getAuthTag();
const path = `${directory}/database-${stamp}.aes256gcm`;
writeFileSync(path, Buffer.concat([Buffer.from("LTREC01"), salt, iv, tag, ciphertext]), { mode: 0o600, flag: "wx" });
// Verify decryption of the saved archive before restoring to a new database.
const stored = readFileSync(path), offset = 7;
const restoreKey = Buffer.from(hkdfSync("sha256", secret, stored.subarray(offset, offset + 32), "LevyTate local recovery v1", 32));
const decipher = createDecipheriv("aes-256-gcm", restoreKey, stored.subarray(offset + 32, offset + 44));
decipher.setAuthTag(stored.subarray(offset + 44, offset + 60));
const restoredArchive = Buffer.concat([decipher.update(stored.subarray(offset + 60)), decipher.final()]);
const digest = bytes => createHash("sha256").update(bytes).digest("hex");
if (digest(restoredArchive) !== digest(archive)) throw new Error("Saved archive decryption mismatch");
query(`create database ${name} template template0;`, admin);
const target = { ...admin, PGDATABASE: name };
run("pg_restore", ["--single-transaction", "--exit-on-error", "--dbname", name], restoredArchive, target);
const summarySQL = `select jsonb_build_object('tables',(select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r'),'rls',(select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and c.relrowsecurity),'authUsers',(select count(*) from auth.users),'storageObjects',(select count(*) from storage.objects),'employers',(select count(*) from levytate_organisations),'people',(select count(*) from levytate_employees),'ledger',(select count(*) from supabase_migrations.schema_migrations),'ledgerHash',(select encode(sha256(convert_to(coalesce(jsonb_agg(to_jsonb(m) order by version),'[]')::text,'UTF8')),'hex') from supabase_migrations.schema_migrations m));`;
const sourceSummary = JSON.parse(query(summarySQL, admin));
const restoredSummary = JSON.parse(query(summarySQL, target));
if (JSON.stringify(sourceSummary) !== JSON.stringify(restoredSummary)) throw new Error("Recovery catalogue/count/ledger mismatch; source unchanged");
const evidence = { status: "PASS", environment: "local", sourceRuntimeId: state.id, database: name, archiveBytes: archive.length, archiveSha256: digest(archive), encryptedArchiveSha256: digest(stored), archiveEncryption: "AES-256-GCM; HKDF key derived from existing restricted local Preview secret", keyLocation: "existing restricted private-app-secrets.json; never in archive/evidence", archiveEntries: list.split("\n").filter(line => /^\d+;/.test(line)).length, ...restoredSummary, fullStorageBytesRecovery: false, hosted: false };
writeFileSync(`${directory}/database-${stamp}.evidence.json`, JSON.stringify(evidence, null, 2), { mode: 0o600, flag: "wx" });
console.log(JSON.stringify(evidence));
key.fill(0); restoreKey.fill(0); archive.fill(0); restoredArchive.fill(0);
release();
