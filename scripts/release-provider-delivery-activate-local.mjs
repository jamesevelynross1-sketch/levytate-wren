/** Apply the reviewable candidate ONLY to a disposable LOCAL acceptance database. */
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { readRegularFile, readSourceEvidence, validateLocalStackState } from "./release-native-migration-gate.mjs";

const root = process.env.RELEASE_LOCAL_RUNTIME;
if (process.env.RELEASE_PROVIDER_DELIVERY_LOCAL_ENABLE !== "true"
  || process.env.VERCEL_ENV || process.env.NODE_ENV === "production"
  || !/^\/(?:private\/)?tmp\/levytate-release-runtime\.[A-Za-z0-9]+$/.test(root ?? ""))
  throw Error("BLOCKED: explicit disposable local provider trial only");
const bytes = readRegularFile(`${root}/private-stack-state.json`);
const state = JSON.parse(bytes);
const source = readSourceEvidence(root);
const startup = JSON.parse(readRegularFile(`${root}/startup-source-evidence.json`));
const db = validateLocalStackState(state, startup, source, bytes);
if (db.hostname !== "127.0.0.1") throw Error("BLOCKED: only the local loopback test database is authorised");
const env = { ...process.env, PGHOST: db.hostname, PGPORT: db.port, PGUSER: db.username,
  PGPASSWORD: db.password, PGDATABASE: db.pathname.slice(1) };
const psql = process.env.RELEASE_PSQL ?? (process.platform === "darwin"
  ? "/opt/homebrew/opt/postgresql@17/bin/psql" : "/usr/bin/psql");
function sql(input) {
  const output = spawnSync(psql, ["-XAtq", "-v", "ON_ERROR_STOP=1"], {
    env, input, encoding: "utf8", maxBuffer: 2 * 1024 * 1024,
  });
  if (output.status !== 0) throw Error("BLOCKED: local provider candidate SQL failed; raw credentials and SQL output withheld");
  return output.stdout.trim();
}
const before = JSON.parse(sql("select json_build_object('candidateMissing',to_regclass('public.levytate_provider_delivery_updates') is null,'restricted038Missing',to_regclass('public.levytate_pastoral_support_actions') is null);"));
if (before.candidateMissing !== true || before.restricted038Missing !== true)
  throw Error("BLOCKED: unexpected local schema already present");
const candidate = readFileSync("supabase/candidates/provider-delivery-v1.sql","utf8");
sql(`begin;\n${candidate}\ncommit;\n`);
const after = JSON.parse(sql("select json_build_object('candidatePresent',to_regclass('public.levytate_provider_delivery_updates') is not null,'restricted038Missing',to_regclass('public.levytate_pastoral_support_actions') is null);"));
if (after.candidatePresent !== true || after.restricted038Missing !== true)
  throw Error("BLOCKED: local candidate activation could not be verified");
console.log("PASS: isolated ephemeral provider delivery schema activated only in disposable local acceptance database");
