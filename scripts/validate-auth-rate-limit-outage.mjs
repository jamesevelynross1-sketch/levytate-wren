import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";

loadEnv(".env.local");
const port = 3107;
const baseUrl = `http://localhost:${port}`;
const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "-p", String(port)], {
  env: { ...process.env, SUPABASE_SERVICE_ROLE_KEY: "invalid-validation-key", LEVYTATE_BETA_LOGIN_ENABLED: "true" },
  stdio: ["ignore", "pipe", "pipe"],
});
let output = "";
server.stdout.on("data", (chunk) => { output += chunk; });
server.stderr.on("data", (chunk) => { output += chunk; });

let passed = 0;
let failed = 0;
function check(label, condition) { if (condition) { passed += 1; console.log(`PASS ${label}`); } else { failed += 1; console.error(`FAIL ${label}`); } }

try {
  await waitUntilReady();
  const email = await fetch(`${baseUrl}/api/levytate-auth/request`, { method: "POST", headers: { "Content-Type": "application/json", "x-forwarded-for": "192.0.2.201" }, body: JSON.stringify({ email: "store-outage@example.invalid" }) });
  const emailBody = await email.json();
  check("magic-link request fails safely when the store is unavailable", email.status === 503 && emailBody.message === "Secure sign-in is temporarily unavailable. Please try again shortly.");

  const callback = await fetch(`${baseUrl}/levytate/auth/callback?token_hash=invalid&type=magiclink`, { headers: { "x-forwarded-for": "192.0.2.202" }, redirect: "manual" });
  check("callback fails closed to the safe invalid-link state", [302, 307, 308].includes(callback.status) && (callback.headers.get("location") ?? "").endsWith("/levytate/login?auth=invalid-link"));

  const beta = await fetch(`${baseUrl}/api/levytate-beta-login`, { method: "POST", headers: { "Content-Type": "application/json", "x-forwarded-for": "192.0.2.203" }, body: JSON.stringify({ email: "outage.validation@levytate.test", code: "invalid" }) });
  check("internal beta login fails closed when the store is unavailable", beta.status === 503 && (await beta.json()).message === "Internal sign-in is temporarily unavailable.");

  const refresh = await fetch(`${baseUrl}/api/levytate-auth/session`, { method: "POST", headers: { cookie: "levytate_auth_refresh=invalid-validation-refresh", "x-forwarded-for": "192.0.2.204" } });
  check("session refresh fails open only to normal Supabase token verification", refresh.status === 401 && (await refresh.json()).message === "Your session has ended. Sign in again to continue.");
} finally {
  server.kill("SIGTERM");
}

console.log(`\nAuthentication rate-limit outage policy: ${passed} passed, ${failed} failed.`);
if (failed) process.exit(1);

async function waitUntilReady() {
  const started = Date.now();
  while (!/Ready in|Local:/.test(output)) {
    if (server.exitCode !== null) throw new Error(`Validation server stopped unexpectedly: ${output.slice(-300)}`);
    if (Date.now() - started > 30_000) throw new Error("Validation server did not become ready.");
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
}

function loadEnv(path) {
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) process.env[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, "");
  }
}
