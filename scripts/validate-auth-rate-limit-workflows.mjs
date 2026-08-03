import { createHmac, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";

loadEnv(".env.local");
const baseUrl = process.env.LEVYTATE_VALIDATION_BASE_URL || "http://localhost:3000";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const hmacSecret = process.env.LEVYTATE_AUTH_RATE_LIMIT_SECRET || process.env.LEVYTATE_BETA_SESSION_SECRET;
if (!supabaseUrl || !serviceKey || !hmacSecret) throw new Error("Rate-limit workflow validation configuration is incomplete.");

let passed = 0;
let failed = 0;
function check(label, condition) { if (condition) { passed += 1; console.log(`PASS ${label}`); } else { failed += 1; console.error(`FAIL ${label}`); } }

const id = randomUUID().replaceAll("-", "");
const burstEmail = `unknown-burst-${id}@example.invalid`;
const knownEmail = "employee.demo@levytate.test";
const unknownEmail = `unknown-enumeration-${id}@example.invalid`;
const burstNetwork = `198.51.100.${Number.parseInt(id.slice(0, 2), 16) % 200 + 1}`;
const wideNetwork = `203.0.113.${Number.parseInt(id.slice(2, 4), 16) % 200 + 1}`;
const callbackNetwork = `192.0.2.${Number.parseInt(id.slice(4, 6), 16) % 200 + 1}`;
const betaNetwork = `198.18.${Number.parseInt(id.slice(6, 8), 16) % 200 + 1}.${Number.parseInt(id.slice(8, 10), 16) % 200 + 1}`;
const touchedKeys = new Set();

try {
  const burst = [];
  for (let attempt = 0; attempt < 4; attempt += 1) burst.push(await requestLink(burstEmail, burstNetwork));
  check("normal unknown-email requests retain the generic response", burst.slice(0, 3).every((item) => item.status === 200 && item.body?.message?.startsWith("If this email is authorised")));
  check("email burst returns the safe 429 response", burst[3].status === 429 && burst[3].body?.message === "Please wait before requesting another sign-in link.");

  const networkStatuses = [];
  for (let attempt = 0; attempt < 21; attempt += 1) networkStatuses.push((await requestLink(`network-${attempt}-${id}@example.invalid`, wideNetwork)).status);
  check("one network source can request twenty links per hour", networkStatuses.slice(0, 20).every((status) => status === 200));
  check("network request twenty-one is rejected", networkStatuses[20] === 429);

  await preconsumeEmail(knownEmail, 3);
  await preconsumeEmail(unknownEmail, 3);
  const knownLimited = await requestLink(knownEmail, `${wideNetwork}-known`);
  const unknownLimited = await requestLink(unknownEmail, `${wideNetwork}-unknown`);
  const enumerationSafe = knownLimited.status === 429 && unknownLimited.status === 429 && JSON.stringify(knownLimited.body) === JSON.stringify(unknownLimited.body);
  check("known and unknown account-specific limits are enumeration-resistant", enumerationSafe);
  if (!enumerationSafe) console.error(JSON.stringify({ knownStatus: knownLimited.status, unknownStatus: unknownLimited.status, knownMessage: knownLimited.body?.message, unknownMessage: unknownLimited.body?.message }));

  const callbackStatuses = [];
  for (let attempt = 0; attempt < 11; attempt += 1) {
    const response = await fetch(`${baseUrl}/levytate/auth/callback?token_hash=invalid-${id}-${attempt}&type=magiclink`, { headers: { "x-forwarded-for": callbackNetwork }, redirect: "manual" });
    callbackStatuses.push({ status: response.status, location: response.headers.get("location") ?? "" });
  }
  const callbackEvent = await securityEvent("callback_abuse_threshold_reached");
  if (callbackEvent?.key_hash) touchedKeys.add(callbackEvent.key_hash);
  check("invalid callbacks always fail to the same safe state", callbackStatuses.every((item) => [302, 307, 308].includes(item.status) && item.location.endsWith("/levytate/login?auth=invalid-link")));
  check("callback abuse threshold is recorded without raw network data", Boolean(callbackEvent) && !JSON.stringify(callbackEvent).includes(callbackNetwork));

  const betaStatuses = [];
  for (let attempt = 0; attempt < 11; attempt += 1) {
    const response = await fetch(`${baseUrl}/api/levytate-beta-login`, { method: "POST", headers: { "Content-Type": "application/json", "x-forwarded-for": betaNetwork }, body: JSON.stringify({ email: `rate-limit-${id}@levytate.test`, code: "invalid-validation-code" }) });
    betaStatuses.push(response.status);
  }
  check("beta-code failures are limited by the shared identity counter", betaStatuses.slice(0, 10).every((status) => status === 401) && betaStatuses[10] === 429);

  const refresh = await fetch(`${baseUrl}/api/levytate-auth/session`, { method: "POST", headers: { "x-forwarded-for": `${wideNetwork}-refresh` } });
  check("normal refresh path still reaches Supabase session validation", refresh.status === 401 && (await refresh.json()).message === "Your session has ended. Sign in again to continue.");
} finally {
  await cleanup();
}

console.log(`\nAuthentication rate-limit workflows: ${passed} passed, ${failed} failed.`);
if (failed) process.exit(1);

async function requestLink(email, network) {
  touchedKeys.add(hash("email", email.toLowerCase()));
  touchedKeys.add(hash("network", network));
  touchedKeys.add(hash("global", "all-auth-email-requests"));
  const response = await fetch(`${baseUrl}/api/levytate-auth/request`, { method: "POST", headers: { "Content-Type": "application/json", "x-forwarded-for": network }, body: JSON.stringify({ email }) });
  return { status: response.status, body: await response.json().catch(() => null) };
}

async function preconsumeEmail(email, count) {
  const keyHash = hash("email", email.toLowerCase());
  touchedKeys.add(keyHash);
  for (const action of ["magic_link.email.burst", "magic_link.email.hour"]) {
    for (let attempt = 0; attempt < count; attempt += 1) await rpc({ p_environment_namespace: "local", p_action: action, p_key_hash: keyHash, p_window_seconds: action.endsWith("burst") ? 600 : 3600, p_limit: action.endsWith("burst") ? 3 : 5, p_route: "/api/levytate-auth/request", p_event_type: "authentication_request_rate_limited" });
  }
}

async function securityEvent(eventType) {
  const query = new URLSearchParams({ select: "event_type,environment_namespace,route,key_hash,outcome_code", event_type: `eq.${eventType}`, environment_namespace: "eq.local", order: "created_at.desc", limit: "1" });
  const response = await fetch(`${supabaseUrl}/rest/v1/levytate_auth_security_events?${query}`, { headers: authHeaders() });
  if (!response.ok) throw new Error("Could not inspect safe security events.");
  return (await response.json())[0] ?? null;
}

async function rpc(body) {
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/levytate_consume_auth_rate_limit`, { method: "POST", headers: authHeaders(), body: JSON.stringify(body) });
  if (!response.ok) throw new Error(`Rate-limit setup failed with status ${response.status}.`);
}

async function cleanup() {
  for (const keyHash of touchedKeys) {
    const filter = `key_hash=eq.${keyHash}`;
    await fetch(`${supabaseUrl}/rest/v1/levytate_auth_rate_limits?${filter}`, { method: "DELETE", headers: authHeaders() });
    await fetch(`${supabaseUrl}/rest/v1/levytate_auth_security_events?${filter}`, { method: "DELETE", headers: authHeaders() });
  }
}

function hash(dimension, value) { return createHmac("sha256", hmacSecret).update(`local:${dimension}:${value}`).digest("hex"); }
function authHeaders() { return { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" }; }
function loadEnv(path) {
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) process.env[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, "");
  }
}
