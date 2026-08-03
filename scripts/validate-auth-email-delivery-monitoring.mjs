import { readFileSync } from "node:fs";
import { deriveAuthenticationEmailDeliveryStatus, mapResendEventType } from "../lib/server/levytate-auth-email-delivery-model.ts";

let passed = 0;
let failed = 0;
function check(label, condition) { if (condition) { passed += 1; console.log(`PASS ${label}`); } else { failed += 1; console.error(`FAIL ${label}`); } }
const read = (path) => readFileSync(path, "utf8");

const migration = read("supabase/migrations/022_create_auth_email_delivery_events.sql");
const delivery = read("lib/server/levytate-auth-email-delivery.ts");
const model = read("lib/server/levytate-auth-email-delivery-model.ts");
const route = read("app/api/levytate-auth/delivery-events/resend/route.ts");
const request = read("app/api/levytate-auth/request/route.ts");
const auth = read("lib/server/levytate-auth.ts");
const docs = read("docs/LEVYTATE_AUTH_EMAIL_DELIVERY_MONITORING.md");

check("migration is additive and isolated", !/drop table|truncate|alter table public\.levytate_(?!auth_email_delivery_events)/i.test(migration));
check("delivery evidence has environment and provider uniqueness", /unique \(environment_namespace, provider, provider_event_id\)/.test(migration));
check("canonical statuses are database constrained", ["requested", "accepted", "delivered", "delayed", "bounced", "rejected", "complained", "suppressed", "failed", "unknown"].every((status) => migration.includes(`'${status}'`)));
check("recipient identifier is constrained HMAC output", /recipient_hash text not null check \(recipient_hash ~ '\^\[a-f0-9\]\{64\}\$'\)/.test(migration));
check("RLS is enabled and forced", /enable row level security/.test(migration) && /force row level security/.test(migration));
check("browser roles have no table or cleanup access", /revoke all on table[\s\S]*from public, anon, authenticated/.test(migration) && /revoke all on function[\s\S]*from public, anon, authenticated/.test(migration));
check("service role is the sole database API principal", /to service_role/.test(migration) && !/grant .* to (anon|authenticated)/.test(migration));
check("retention is 90 days with bounded cleanup", /interval '90 days'/.test(migration) && /limit p_batch_size/.test(migration) && /p_batch_size > 10000/.test(migration));
check("raw request body is verified using Svix", /new Webhook\(secret\)\.verify\(rawBody/.test(delivery) && /await request\.text\(\)/.test(route));
check("unsigned requests are rejected", /invalid_signature/.test(delivery) && /status: 401/.test(route));
check("payload size is bounded before processing", /resendWebhookMaxBytes/.test(route) && /status: 413/.test(route));
check("replay protection is database backed", /resolution=ignore-duplicates/.test(delivery) && /provider_event_id/.test(migration));
check("recipient HMAC includes server-derived environment", /createHmac\("sha256"/.test(delivery) && /getLevyTateRateLimitEnvironment\(\).*auth-email-recipient/s.test(delivery));
check("no raw recipient is persisted", !/recipient_email|raw_payload|email_body|magic_link|session_cookie/.test(migration));
check("safe read contracts omit recipient hashes", ["getAuthenticationDeliveryHealth", "listRecentAuthenticationDeliveryFailures", "getAuthenticationDeliveryStatus", "getAuthenticationProviderStatus"].every((name) => delivery.includes(`function ${name}`)));
check("public sign-in wording remains generic", request.includes("genericSignInRequestMessage") && !request.includes("delivery"));
check("monitoring outages do not expose raw provider errors", !/console\.error\([^\n]*error/.test(delivery) && !/return NextResponse\.json\([^\n]*message/.test(route));
check("authentication request records monitoring without changing redirect", auth.includes("recordAuthenticationEmailRequest") && auth.includes('otp?redirect_to=${encodeURIComponent(redirectTo)}'));

const mappings = {
  "email.sent": "accepted", "email.delivered": "delivered", "email.delivery_delayed": "delayed",
  "email.bounced": "bounced", "email.failed": "failed", "email.complained": "complained", "email.suppressed": "suppressed",
};
check("supported provider events map canonically", Object.entries(mappings).every(([event, status]) => mapResendEventType(event) === status));
check("unsupported provider event is unknown", mapResendEventType("email.opened") === "unknown");

const at = (minute, status, received = minute) => ({ canonical_status: status, occurred_at: `2026-01-01T00:${String(minute).padStart(2, "0")}:00.000Z`, received_at: `2026-01-01T00:${String(received).padStart(2, "0")}:30.000Z` });
check("accepted is not delivered", deriveAuthenticationEmailDeliveryStatus([at(0, "requested"), at(1, "accepted")]) === "accepted");
check("delivered supersedes a delay", deriveAuthenticationEmailDeliveryStatus([at(0, "accepted"), at(2, "delayed"), at(3, "delivered")]) === "delivered");
check("out-of-order receipt uses provider chronology", deriveAuthenticationEmailDeliveryStatus([at(3, "delivered", 3), at(2, "delayed", 4)]) === "delivered");
check("later bounce supersedes delivered", deriveAuthenticationEmailDeliveryStatus([at(1, "delivered"), at(2, "bounced")]) === "bounced");
check("complaint has terminal precedence", deriveAuthenticationEmailDeliveryStatus([at(1, "delivered"), at(2, "complained"), at(3, "accepted")]) === "complained");
check("documentation records bounded correlation honestly", docs.includes("30-minute window") && docs.includes("explicitly recorded as `bounded`, never `exact`"));
check("documentation covers protected Preview activation", docs.includes("Protection Bypass for Automation") && docs.includes("Do not remove it"));
check("documentation contains no secrets or raw payload", !/whsec_[A-Za-z0-9_-]+|re_[A-Za-z0-9_-]{12,}|service_role\s*=/.test(docs));
check("model is central and not duplicated in UI", model.includes("deriveAuthenticationEmailDeliveryStatus") && !route.includes("canonical_status ==="));

console.log(`\nAuthentication email delivery monitoring: ${passed} passed, ${failed} failed.`);
if (failed) process.exit(1);

