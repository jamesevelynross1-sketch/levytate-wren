/** Execute one hash-reviewed file in an explicitly named LOCAL schema-test DB. */
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
const root = process.env.RELEASE_LOCAL_RUNTIME;
const name = process.env.RELEASE_TEST_DATABASE;
const path = process.env.RELEASE_SQL_FILE;
const expected = process.env.RELEASE_SQL_SHA256;
if (!/^\/private\/tmp\/levytate-release-runtime\.[A-Za-z0-9]+$/.test(root ?? "") || !/^levytate_release_[a-z0-9_]+$/.test(name ?? "") || !path?.endsWith(".sql") || /(?:^|\/)038_/.test(path) || !/^[a-f0-9]{64}$/.test(expected ?? "")) throw new Error("Exact local database, reviewed SQL file and hash required; 038 remains excluded");
const sql = readFileSync(path, "utf8");
if (createHash("sha256").update(sql).digest("hex") !== expected || /\b(?:insert\s+into|update|delete\s+from|truncate(?:\s+table)?)\s+(?:"?supabase_migrations"?\.)/i.test(sql)) throw new Error("SQL checksum/history guard rejected file");
const db = new URL(JSON.parse(readFileSync(`${root}/private-stack-state.json`, "utf8")).env.DB_URL);
if (db.hostname !== "127.0.0.1") throw new Error("Loopback database required");
const result = spawnSync(process.env.RELEASE_PSQL ?? "/opt/homebrew/opt/postgresql@17/bin/psql", ["-XAtq", "--single-transaction", "-v", "ON_ERROR_STOP=1", "-v", "VERBOSITY=verbose"], {
 input: sql, encoding: "utf8", env: { ...process.env, PGHOST: db.hostname, PGPORT: db.port, PGUSER: db.username, PGPASSWORD: db.password, PGDATABASE: name }, maxBuffer: 8*1024*1024,
});
console.log(JSON.stringify({ status: result.status === 0 ? "PASS" : "FAIL", database: name, sha256: expected, sqlstate: result.stderr?.match(/(?:ERROR|FATAL):\s+([A-Z0-9]{5}):/)?.[1] ?? null, assertions: [...(result.stderr ?? "").matchAll(/NOTICE:.*PASS/g)].length, hosted: false }));
if (result.status) process.exitCode = 1;
