import { readFileSync } from "node:fs";

let passed = 0;
let failed = 0;
function check(label, condition) { if (condition) { passed += 1; console.log(`PASS ${label}`); } else { failed += 1; console.error(`FAIL ${label}`); } }
const read = (path) => readFileSync(path, "utf8");

const migration = read("supabase/migrations/021_create_distributed_auth_rate_limits.sql");
const limiter = read("lib/server/levytate-auth-rate-limit.ts");
const config = read("lib/server/levytate-auth-rate-limit-config.ts");
const request = read("app/api/levytate-auth/request/route.ts");
const callback = read("app/levytate/auth/callback/route.ts");
const beta = read("app/api/levytate-beta-login/route.ts");
const session = read("app/api/levytate-auth/session/route.ts");
const docs = read("docs/LEVYTATE_DISTRIBUTED_AUTH_RATE_LIMITING.md");

check("migration is additive to isolated authentication-security objects", !/drop table|truncate/i.test(migration) && !/alter table public\.levytate_(?!auth_rate_limits|auth_security_events)/.test(migration));
check("rate-limit counter has an atomic conflict increment", /on conflict[\s\S]*do update[\s\S]*request_count\s*=\s*least/i.test(migration));
check("fixed windows have expiry and bounded cleanup", /window_start/.test(migration) && /expires_at/.test(migration) && /limit 25/.test(migration));
check("RLS is forced on both security tables", (migration.match(/force row level security/g) ?? []).length === 2);
check("browser table grants are revoked", /revoke all on table[\s\S]*from public, anon, authenticated/.test(migration));
check("browser function grants are revoked", /revoke all on function[\s\S]*from public, anon, authenticated/.test(migration));
check("service role alone receives RPC execution", /grant execute on function[\s\S]*to service_role/.test(migration));
check("stored hashes are constrained to SHA-256 hex", /key_hash ~ '\^\[a-f0-9\]\{64\}\$'/.test(migration));
check("HMAC key derivation includes environment and dimension", /createHmac\("sha256"/.test(limiter) && /getLevyTateRateLimitEnvironment\(\).*dimension.*value/s.test(limiter));
check("raw email and network source are not sent to the RPC", !/p_(email|ip|token|cookie)/.test(limiter));
check("environment namespace is server-derived and local development stays isolated", /process\.env\.NODE_ENV !== "production"/.test(config) && /VERCEL_ENV/.test(config) && !/request|headers|searchParams/.test(config));
check("email burst and hourly limits are central", /limit: 3, windowSeconds: 10 \* 60/.test(config) && /limit: 5, windowSeconds: 60 \* 60/.test(config));
check("network and global email limits are central", /magicLinkNetworkHourly/.test(config) && /magicLinkGlobalHourly/.test(config));
check("callback limiter runs before token verification", callback.indexOf("await checkCallbackAttemptLimit") < callback.indexOf("await verifyEmployerMagicLink"));
check("beta limiter runs before access-code comparison", beta.indexOf("await checkBetaLoginLimits") < beta.indexOf("code !== getLevyTateBetaAccessCode"));
check("session refresh has explicit fail-open store policy", session.includes("valid refresh token is still verified by Supabase") && session.includes("LevyTateRateLimitStoreError"));
check("magic-link store outage returns safe 503", request.includes("LevyTateRateLimitStoreError") && request.includes("status: 503"));
check("email throttling uses safe wording and 429", request.includes("Please wait before requesting another sign-in link.") && request.includes("status: 429"));
check("documentation covers privacy, namespaces, thresholds and outage policy", ["HMAC-SHA256", "preview", "production", "Outage policy", "3 per 10 minutes"].every((value) => docs.includes(value)));
check("documentation contains no credential values", !/eyJ[A-Za-z0-9_-]{20,}|service_role\s*=|LEVYTATE_AUTH_RATE_LIMIT_SECRET=\S+/.test(docs));

console.log(`\nDistributed authentication rate limiting: ${passed} passed, ${failed} failed.`);
if (failed) process.exit(1);
