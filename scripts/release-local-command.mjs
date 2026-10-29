/** Inject local-only test credentials in child environment, never arguments. */
import { spawn } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = process.env.RELEASE_LOCAL_RUNTIME;
if (!root?.startsWith("/private/tmp/levytate-release-runtime.")) throw new Error("Dedicated local runtime required");
const secretPath = `${root}/private-app-secrets.json`;
if (!existsSync(secretPath)) writeFileSync(secretPath, JSON.stringify({ hookSecret: randomBytes(32).toString("base64"), sessionSecret: randomBytes(48).toString("base64url") }), { mode: 0o600, flag: "wx" });
const secrets = JSON.parse(readFileSync(secretPath, "utf8"));
const rateRun = process.env.RELEASE_RATE_LIMIT_RUN;
let rateSecret;
if (rateRun) {
  if (!/^[a-z0-9-]{1,32}$/.test(rateRun)) throw new Error("Invalid local test run name");
  const ratePath = `${root}/private-rate-limit-${rateRun}.json`;
  if (!existsSync(ratePath)) writeFileSync(ratePath, JSON.stringify({ secret: randomBytes(48).toString("base64url") }), { mode: 0o600, flag: "wx" });
  rateSecret = JSON.parse(readFileSync(ratePath, "utf8")).secret;
}
const state = JSON.parse(readFileSync(`${root}/private-stack-state.json`, "utf8"));
const base = state.env.API_URL;
if (new URL(base).hostname !== "127.0.0.1") throw new Error("Local API must remain loopback");
const scriptDir = dirname(fileURLToPath(import.meta.url));
const database=new URL(state.env.DB_URL);
if(database.hostname!=="127.0.0.1")throw new Error("Local database must remain loopback");
const env = {
  ...process.env, SUPABASE_HOME: `${root}/home`, RELEASE_EMAIL_HOOK_SECRET: `v1,whsec_${secrets.hookSecret}`,
  NEXT_PUBLIC_SUPABASE_URL: base, SUPABASE_SERVICE_ROLE_KEY: state.env.SERVICE_ROLE_KEY,
  LEVYTATE_BETA_SESSION_SECRET: secrets.sessionSecret, LEVYTATE_BETA_LOGIN_ENABLED: "false",
  ...(rateSecret ? { LEVYTATE_AUTH_RATE_LIMIT_SECRET: rateSecret } : {}),
  RELEASE_SUPABASE_URL: base, RELEASE_SUPABASE_SERVICE_KEY: state.env.SERVICE_ROLE_KEY,
  RELEASE_SUPABASE_ANON_KEY: state.env.ANON_KEY,
  RELEASE_APP_URL: process.env.RELEASE_APP_URL ?? "http://localhost:3107", RELEASE_MAILPIT_URL: state.env.MAILPIT_URL,
  RELEASE_FIXTURE_MANIFEST: process.env.RELEASE_FIXTURE_MANIFEST ?? `${root}/fixture-manifest.json`, RELEASE_EVIDENCE_PATH: `${root}/browser-evidence.json`,
  PGPASSWORD:database.password,RELEASE_PGHOST:database.hostname,RELEASE_PGPORT:database.port,RELEASE_PGUSER:database.username,
  RELEASE_PGDATABASE:process.env.RELEASE_TEST_DATABASE,RELEASE_PSQL:process.env.RELEASE_PSQL??"/opt/homebrew/opt/postgresql@17/bin/psql",
};
const mode = process.argv[2];
const commands = {
  hook: [process.execPath, [resolve(scriptDir, "release-local-email-hook.mjs")]],
  seed: [process.execPath, [resolve(scriptDir, "release-local-fixtures.mjs")]],
  browser: [process.execPath, [resolve(scriptDir, "release-browser-acceptance.mjs")]],
  "callback-budget": [process.execPath,[resolve(scriptDir,"release-callback-budget-integrity.mjs")]],
  readiness: [process.execPath,[resolve(scriptDir,"release-readiness-integrity.mjs")]],
  database: [process.execPath,[resolve(scriptDir,"release-database-integrity.mjs")]],
  people: [process.execPath,[resolve(scriptDir,"release-people-integrity.mjs")]],
  finance: [process.execPath,[resolve(scriptDir,"release-finance-integrity.mjs")]],
  learner: [process.execPath,[resolve(scriptDir,"release-learner-integrity.mjs")]],
  start: [process.execPath, [resolve(scriptDir, "release-start-local-stack.mjs")]],
  stop: [`${root}/supabase`, ["stack", "stop", "--workdir", `${root}/project`, "--output-format", "json"]],
  "bootstrap-dry-run": [`${root}/supabase`, ["db", "push", "--local", "--dry-run", "--workdir", `${root}/project`]],
  bootstrap: [`${root}/supabase`, ["db", "push", "--local", "--workdir", `${root}/project`, "--yes"]],
  app: [process.execPath, [resolve(process.cwd(), "node_modules/next/dist/bin/next"), "dev", "--hostname", "127.0.0.1", "--port", "3107"]],
};
if (!commands[mode]) throw new Error("Unsupported local acceptance command");
const [command, args] = commands[mode];
const child = spawn(command, args, { env, stdio: ["ignore", "pipe", "pipe"] });
function safeOutput(data) {
  if (mode === "app" || mode === "stop") {
    // Next dev logs callback query strings; discard ALL raw application output.
    if (/ready in|started server/i.test(String(data))) console.log("Local application server ready on loopback port 3107");
    return;
  }
  process.stdout.write(data);
}
child.stdout.on("data", safeOutput); child.stderr.on("data", safeOutput);
child.on("close", (code) => { console.log(`Local ${mode} process exited ${code}`); process.exitCode = code ?? 1; });
process.on("SIGTERM", () => child.kill("SIGTERM")); process.on("SIGINT", () => child.kill("SIGINT"));
