import { createHmac, randomBytes, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { Webhook } from "svix";

loadEnv(".env.local");
const supabaseUrl = clean(process.env.NEXT_PUBLIC_SUPABASE_URL);
const serviceKey = clean(process.env.SUPABASE_SERVICE_ROLE_KEY);
const privacyKey = clean(process.env.LEVYTATE_AUTH_RATE_LIMIT_SECRET) || clean(process.env.LEVYTATE_BETA_SESSION_SECRET);
const webhookSecret = clean(process.env.RESEND_WEBHOOK_SECRET);
const baseUrl = process.env.LEVYTATE_VALIDATION_BASE_URL || "http://localhost:3000";
if (!supabaseUrl || !serviceKey || !privacyKey || !webhookSecret) throw new Error("Safe local validation configuration is incomplete.");

let passed = 0;
let failed = 0;
function check(label, condition) { if (condition) { passed += 1; console.log(`PASS ${label}`); } else { failed += 1; console.error(`FAIL ${label}`); } }
const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" };
const prefix = `validation-${randomUUID()}`;
const email = `${prefix}@levytate.test`;
const recipientHash = createHmac("sha256", privacyKey).update(`local:auth-email-recipient:${email}`).digest("hex");
const requestReference = randomUUID();
const messageReference = `<${prefix}@validation.invalid>`;
const emailId = randomUUID();
const webhook = new Webhook(webhookSecret);
const eventIds = [];

try {
  await insert([{ environment_namespace: "local", provider: "levytate", provider_event_id: `request:${requestReference}`, authentication_request_reference: requestReference, recipient_hash: recipientHash, canonical_status: "requested", provider_event_type: "authentication.requested", correlation_confidence: "exact", occurred_at: new Date().toISOString(), processing_status: "processed", metadata: {} }]);

  const sent = await send("email.sent", 0);
  check("valid official signature is accepted", sent.status === 200);
  const duplicate = await sendRaw(sent.id, sent.body, sent.timestamp);
  check("provider retry is idempotently acknowledged", duplicate.status === 200 && (await duplicate.json()).duplicate === true);

  const invalid = await fetch(`${baseUrl}/api/levytate-auth/delivery-events/resend`, { method: "POST", headers: { "Content-Type": "application/json", "svix-id": `msg_${randomUUID()}`, "svix-timestamp": String(Math.floor(Date.now() / 1000)), "svix-signature": "v1,invalid" }, body: sent.body });
  check("invalid signature is rejected", invalid.status === 401);

  const staleId = `msg_${randomUUID()}`;
  const staleTime = new Date(Date.now() - 10 * 60 * 1000);
  const stale = await fetch(`${baseUrl}/api/levytate-auth/delivery-events/resend`, { method: "POST", headers: signedHeaders(staleId, staleTime, sent.body), body: sent.body });
  check("stale signed replay is rejected", stale.status === 401);

  const tooLarge = await fetch(`${baseUrl}/api/levytate-auth/delivery-events/resend`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "x".repeat(131073) });
  check("oversized payload is rejected", tooLarge.status === 413);

  const delayed = await send("email.delivery_delayed", 2);
  const delivered = await send("email.delivered", 3);
  const bounced = await send("email.bounced", 4, { bounce: { type: "Permanent", subType: "General" } });
  const complaint = await send("email.complained", 5);
  const unknown = await send("email.opened", 6);
  check("supported and unknown events are accepted", [delayed, delivered, bounced, complaint, unknown].every((result) => result.status === 200));

  const rows = await select(`environment_namespace=eq.local&recipient_hash=eq.${recipientHash}&select=provider_event_id,provider_message_reference,authentication_request_reference,recipient_hash,canonical_status,provider_event_type,correlation_confidence,processing_status,safe_failure_code,metadata&order=occurred_at.asc`);
  check("provider retries create one immutable row", rows.filter((row) => row.provider_event_id === sent.id).length === 1);
  check("first SMTP event has bounded correlation", rows.find((row) => row.provider_event_id === sent.id)?.correlation_confidence === "bounded");
  const laterProviderEvents = rows.filter((row) => row.provider_event_id !== sent.id && row.provider_event_id !== `request:${requestReference}`);
  check("later provider-message events have exact correlation", laterProviderEvents.every((row) => row.correlation_confidence === "exact"));
  if (laterProviderEvents.some((row) => row.correlation_confidence !== "exact")) console.error("Correlation diagnostics", laterProviderEvents.map((row) => ({ type: row.provider_event_type, confidence: row.correlation_confidence })));
  check("all webhook events resolve to the request UUID", rows.filter((row) => row.provider_event_id !== `request:${requestReference}`).every((row) => row.authentication_request_reference === requestReference));
  check("unknown event is retained as ignored evidence", rows.some((row) => row.provider_event_type === "email.opened" && row.canonical_status === "unknown" && row.processing_status === "ignored"));
  check("bounce and complaint retain safe reason codes", rows.some((row) => row.canonical_status === "bounced" && row.safe_failure_code === "hard_bounce") && rows.some((row) => row.canonical_status === "complained" && row.safe_failure_code === "complained"));
  check("stored metadata contains no recipient or payload", rows.every((row) => !JSON.stringify(row.metadata).includes(email) && !JSON.stringify(row).includes("token")));

  const anonymous = await fetch(`${supabaseUrl}/rest/v1/levytate_auth_email_delivery_events?select=id`, { headers: { apikey: serviceKey.replace(/.$/, serviceKey.at(-1) === "a" ? "b" : "a") } });
  check("browser access is denied", [401, 403].includes(anonymous.status));

  const expiredId = `expired:${randomUUID()}`;
  await insert([{ environment_namespace: "local", provider: "validation", provider_event_id: expiredId, recipient_hash: recipientHash, canonical_status: "unknown", provider_event_type: "validation.expired", correlation_confidence: "uncorrelated", occurred_at: new Date(Date.now() - 91 * 86400000).toISOString(), processing_status: "ignored", metadata: {}, expires_at: new Date(Date.now() - 1000).toISOString() }]);
  const cleanup = await fetch(`${supabaseUrl}/rest/v1/rpc/levytate_cleanup_auth_email_delivery_events`, { method: "POST", headers, body: JSON.stringify({ p_batch_size: 100 }) });
  check("bounded retention cleanup succeeds", cleanup.ok && (await cleanup.json()) >= 1);

  const productionRows = await select(`environment_namespace=eq.production&recipient_hash=eq.${recipientHash}&select=id`);
  check("local fixture events do not enter Production namespace", productionRows.length === 0);
} finally {
  await fetch(`${supabaseUrl}/rest/v1/levytate_auth_email_delivery_events?recipient_hash=eq.${recipientHash}`, { method: "DELETE", headers: { ...headers, Prefer: "return=minimal" } });
  for (const eventType of ["auth.webhook_signature_rejected", "auth.email_bounced", "auth.email_complained"]) {
    await fetch(`${supabaseUrl}/rest/v1/levytate_auth_security_events?event_type=eq.${eventType}&environment_namespace=eq.local`, { method: "DELETE", headers: { ...headers, Prefer: "return=minimal" } });
  }
}

console.log(`\nAuthentication email delivery monitoring live: ${passed} passed, ${failed} failed.`);
if (failed) process.exit(1);

async function send(type, offsetMinutes, extra = {}) {
  const id = `msg_${randomUUID()}`;
  eventIds.push(id);
  const occurred = new Date(Date.now() + offsetMinutes * 60000);
  const body = JSON.stringify({ type, created_at: occurred.toISOString(), data: { email_id: emailId, message_id: messageReference, to: [email], ...extra } });
  const response = await sendRaw(id, body, new Date());
  return { id, body, timestamp: new Date(), status: response.status };
}
async function sendRaw(id, body, timestamp) {
  return fetch(`${baseUrl}/api/levytate-auth/delivery-events/resend`, { method: "POST", headers: signedHeaders(id, timestamp, body), body });
}
function signedHeaders(id, timestamp, body) {
  return { "Content-Type": "application/json", "svix-id": id, "svix-timestamp": String(Math.floor(timestamp.getTime() / 1000)), "svix-signature": webhook.sign(id, timestamp, body) };
}
async function insert(body) {
  const response = await fetch(`${supabaseUrl}/rest/v1/levytate_auth_email_delivery_events`, { method: "POST", headers: { ...headers, Prefer: "return=minimal" }, body: JSON.stringify(body) });
  if (!response.ok) throw new Error(`Fixture insert failed (${response.status}).`);
}
async function select(query) {
  const response = await fetch(`${supabaseUrl}/rest/v1/levytate_auth_email_delivery_events?${query}`, { headers });
  if (!response.ok) throw new Error(`Fixture read failed (${response.status}).`);
  return response.json();
}
function loadEnv(path) {
  try { for (const line of readFileSync(path, "utf8").split(/\r?\n/)) { const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/); if (match && !process.env[match[1]]) process.env[match[1]] = clean(match[2]); } } catch {}
}
function clean(value = "") { return value.trim().replace(/^['"]|['"]$/g, ""); }
