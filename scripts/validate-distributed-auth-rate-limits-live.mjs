import { createHmac, randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

loadEnv(".env.local");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const hmacSecret = process.env.LEVYTATE_AUTH_RATE_LIMIT_SECRET || process.env.LEVYTATE_BETA_SESSION_SECRET;
if (!url || !serviceKey || !hmacSecret || !url.includes("lzwcahdgchrkeulmlfqv")) throw new Error("Distributed limiter validation configuration is incomplete.");

const workerIndex = process.argv.indexOf("--worker");
if (workerIndex >= 0) {
  const [action, keyHash, environment, limit, windowSeconds] = process.argv.slice(workerIndex + 1);
  const result = await consume({ action, keyHash, environment, limit: Number(limit), windowSeconds: Number(windowSeconds) });
  process.stdout.write(JSON.stringify({ allowed: result.allowed }));
  process.exit(0);
}

let passed = 0;
let failed = 0;
function check(label, condition) { if (condition) { passed += 1; console.log(`PASS ${label}`); } else { failed += 1; console.error(`FAIL ${label}`); } }

const runId = randomUUID().replaceAll("-", "");
const prefix = `validation.${runId}`;
const rawEmail = `distributed-${runId}@example.invalid`;
const rawNetwork = `192.0.2.${Number.parseInt(runId.slice(0, 2), 16) % 200 + 1}`;
const actorHash = hash("email", rawEmail);
const networkHash = hash("network", rawNetwork);

try {
  const workers = await Promise.all(Array.from({ length: 12 }, () => runWorker(`${prefix}.concurrency`, actorHash, "local", 5, 600)));
  check("independent Node processes share one global counter", workers.filter((item) => item.allowed).length === 5);
  check("atomic concurrency cannot exceed the allowance", workers.filter((item) => !item.allowed).length === 7);

  const preview = await consume({ action: `${prefix}.namespace`, keyHash: actorHash, environment: "preview", limit: 1, windowSeconds: 600 });
  const production = await consume({ action: `${prefix}.namespace`, keyHash: actorHash, environment: "production", limit: 1, windowSeconds: 600 });
  const previewSecond = await consume({ action: `${prefix}.namespace`, keyHash: actorHash, environment: "preview", limit: 1, windowSeconds: 600 });
  check("Preview and Production namespaces are independent", preview.allowed && production.allowed && !previewSecond.allowed);

  const now = new Date();
  const ttlFirst = await consume({ action: `${prefix}.ttl`, keyHash: actorHash, environment: "local", limit: 1, windowSeconds: 1, now });
  const ttlBlocked = await consume({ action: `${prefix}.ttl`, keyHash: actorHash, environment: "local", limit: 1, windowSeconds: 1, now: new Date(now.getTime() + 100) });
  const ttlRestored = await consume({ action: `${prefix}.ttl`, keyHash: actorHash, environment: "local", limit: 1, windowSeconds: 1, now: new Date(now.getTime() + 1_200) });
  check("TTL expiry restores access", ttlFirst.allowed && !ttlBlocked.allowed && ttlRestored.allowed);

  const burst = await Promise.all(Array.from({ length: 4 }, () => consume({ action: `${prefix}.burst`, keyHash: actorHash, environment: "local", limit: 3, windowSeconds: 600 })));
  const hourly = await Promise.all(Array.from({ length: 5 }, () => consume({ action: `${prefix}.hour`, keyHash: actorHash, environment: "local", limit: 5, windowSeconds: 3600 })));
  check("short burst limit permits exactly three requests", burst.filter((item) => item.allowed).length === 3 && burst.filter((item) => !item.allowed).length === 1);
  check("hourly limit remains independent of burst state", hourly.every((item) => item.allowed));

  const emailDecision = await consume({ action: `${prefix}.email`, keyHash: actorHash, environment: "local", limit: 1, windowSeconds: 600 });
  const networkDecision = await consume({ action: `${prefix}.network`, keyHash: networkHash, environment: "local", limit: 1, windowSeconds: 600 });
  check("email and network dimensions are independent", emailDecision.allowed && networkDecision.allowed && actorHash !== networkHash);

  const rows = await table(`levytate_auth_rate_limits?select=environment_namespace,action,key_hash,request_count&action=like.${encodeURIComponent(prefix)}%25`);
  const serialised = JSON.stringify(rows);
  check("stored keys are 64-character HMAC hashes", rows.length > 0 && rows.every((row) => /^[a-f0-9]{64}$/.test(row.key_hash)));
  check("stored rows contain no raw email or IP", !serialised.includes(rawEmail) && !serialised.includes(rawNetwork));
  check("counter storage contains only environment, action, hash and counts", rows.every((row) => Object.keys(row).every((key) => ["environment_namespace", "action", "key_hash", "request_count"].includes(key))));

  const events = await table(`levytate_auth_security_events?select=event_type,environment_namespace,route,key_hash,outcome_code&route=eq.%2Fvalidation`);
  check("threshold events contain safe bounded metadata", events.length > 0 && events.every((row) => /^[a-f0-9]{64}$/.test(row.key_hash) && row.outcome_code === "threshold_reached"));

  const anonymousTable = await fetch(`${url}/rest/v1/levytate_auth_rate_limits?select=*`);
  const anonymousFunction = await fetch(`${url}/rest/v1/rpc/levytate_consume_auth_rate_limit`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
  check("anonymous browser access to the table is denied", [401, 403].includes(anonymousTable.status));
  check("anonymous browser access to the atomic function is denied", [401, 403, 404].includes(anonymousFunction.status));
} finally {
  await remove(`levytate_auth_rate_limits?action=like.${encodeURIComponent(prefix)}%25`);
  await remove("levytate_auth_security_events?route=eq.%2Fvalidation");
}

console.log(`\nDistributed rate-limit live validation: ${passed} passed, ${failed} failed.`);
if (failed) process.exit(1);

function hash(dimension, value) {
  return createHmac("sha256", hmacSecret).update(`local:${dimension}:${value}`).digest("hex");
}

async function consume({ action, keyHash, environment, limit, windowSeconds, now }) {
  const response = await fetch(`${url}/rest/v1/rpc/levytate_consume_auth_rate_limit`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ p_environment_namespace: environment, p_action: action, p_key_hash: keyHash, p_window_seconds: windowSeconds, p_limit: limit, p_route: "/validation", p_event_type: "validation_rate_limited", ...(now ? { p_now: now.toISOString() } : {}) }),
  });
  if (!response.ok) throw new Error(`Rate-limit RPC failed with status ${response.status}.`);
  return (await response.json())[0];
}

function runWorker(action, keyHash, environment, limit, windowSeconds) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [fileURLToPath(import.meta.url), "--worker", action, keyHash, environment, String(limit), String(windowSeconds)], { env: process.env, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("exit", (code) => code === 0 ? resolve(JSON.parse(stdout)) : reject(new Error(`Worker failed (${code}): ${stderr.slice(0, 120)}`)));
  });
}

async function table(path) {
  const response = await fetch(`${url}/rest/v1/${path}`, { headers: authHeaders() });
  if (!response.ok) throw new Error(`Security table query failed with status ${response.status}.`);
  return response.json();
}

async function remove(path) {
  const response = await fetch(`${url}/rest/v1/${path}`, { method: "DELETE", headers: { ...authHeaders(), Prefer: "return=minimal" } });
  if (!response.ok) throw new Error(`Security validation cleanup failed with status ${response.status}.`);
}

function authHeaders() { return { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" }; }
function loadEnv(path) {
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) process.env[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, "");
  }
}
