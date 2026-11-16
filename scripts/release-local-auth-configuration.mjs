/** Prove LOCAL email sign-in is enabled while public signup stays closed. */
import { readFileSync, writeFileSync } from "node:fs";
import { randomBytes, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
const root = process.env.RELEASE_LOCAL_RUNTIME;
if (!/^\/private\/tmp\/levytate-release-runtime\.[A-Za-z0-9]+$/.test(root ?? "")) throw new Error("Dedicated local runtime required");
const state = JSON.parse(readFileSync(`${root}/private-stack-state.json`, "utf8")), base = new URL(state.env.API_URL), db = new URL(state.env.DB_URL);
if (base.hostname !== "127.0.0.1" || db.hostname !== "127.0.0.1") throw new Error("Loopback only");
const request = async (path, options = {}) => {
  const response = await fetch(new URL(path, base), { ...options, headers: { apikey: state.env.ANON_KEY, "content-type": "application/json", ...options.headers }, redirect: "error", signal: AbortSignal.timeout(15000) });
  return { status: response.status, body: await response.json() };
};
const settings = await request("/auth/v1/settings");
if (settings.status !== 200 || settings.body.external?.email !== true || settings.body.disable_signup !== true) throw new Error("Email provider/public signup configuration does not meet local acceptance contract");
const email = `lt-release-signup-${randomUUID()}@example.test`;
const count = () => {
  const result = spawnSync("/opt/homebrew/opt/postgresql@17/bin/psql", ["-XAtq", "-v", "ON_ERROR_STOP=1"], { input: `select count(*) from auth.users where email='${email}';`, encoding: "utf8", env: { ...process.env, PGHOST: db.hostname, PGPORT: db.port, PGUSER: db.username, PGPASSWORD: db.password, PGDATABASE: db.pathname.slice(1) } });
  if (result.status !== 0) throw new Error("Local Auth count unavailable"); return Number(result.stdout.trim());
};
if (count() !== 0) throw new Error("Unexpected synthetic signup fixture");
const signup = await request("/auth/v1/signup", { method: "POST", body: JSON.stringify({ email, password: randomBytes(32).toString("base64url") }) });
if (![400, 403, 422].includes(signup.status) || signup.body.error_code !== "signup_disabled" || count() !== 0) throw new Error("Public signup was not conclusively denied; stop local Auth acceptance");
const evidence = { environment: "local", observedAt: new Date().toISOString(), emailProviderEnabled: true, publicSignupDisabled: true, signupStatus: signup.status, signupErrorCode: "signup_disabled", signupCreatedUsers: 0, hostedAcceptance: false };
writeFileSync(`${root}/auth-configuration-evidence-${Date.now()}.json`, `${JSON.stringify(evidence, null, 2)}\n`, { flag: "wx", mode: 0o600 });
console.log(JSON.stringify(evidence));
