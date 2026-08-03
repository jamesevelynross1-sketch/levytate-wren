# LevyTate distributed authentication rate limiting

## Store and schema

LevyTate uses the existing `mpr-consulting` Supabase project as a shared, production-capable authentication-security store. Migration `021_create_distributed_auth_rate_limits.sql` adds only:

- `levytate_auth_rate_limits`: fixed-window counters;
- `levytate_auth_security_events`: bounded threshold events;
- `levytate_consume_auth_rate_limit`: atomic counter consumption;
- `levytate_cleanup_auth_rate_limits`: bounded expiry cleanup.

Both tables enforce and force RLS. Browser roles have no table or function privileges. Only the service role can consume limits, clean expired rows or inspect security events. The atomic function performs a bounded expired-row sweep on normal use; the cleanup function is available for controlled maintenance.

## Configuration

Server-only configuration:

- `NEXT_PUBLIC_SUPABASE_URL`: existing Supabase REST endpoint; this pre-existing public project URL is not a credential.
- `SUPABASE_SERVICE_ROLE_KEY`: existing server-only database credential.
- `LEVYTATE_AUTH_RATE_LIMIT_SECRET`: preferred HMAC key. Use at least 32 random bytes and never expose it with `NEXT_PUBLIC_`.
- `LEVYTATE_BETA_SESSION_SECRET`: established server secret used as a safe fallback HMAC key until the dedicated key is configured.
- `VERCEL_ENV`: authoritative only in a production-mode Node runtime. Values map to `preview` and `production`; development and other non-production execution always map to `local`, even if pulled Vercel metadata is present.

Rotate the dedicated HMAC key by updating the server environment value and redeploying the relevant environment. Rotation intentionally starts new pseudonymous buckets; do it during a low-risk period and retain provider-level Supabase controls throughout. Never log either secret.

## Keys and privacy

The server normalises an email or obtains the trusted network source, then calculates HMAC-SHA256 over the environment, dimension and value. Stored keys are 64-character non-reversible keyed hashes. Rows never contain raw email, raw IP, tokens, cookies, Auth payloads, organisations, employees or learners. Environment authority is derived only from server configuration.

## Initial thresholds

- Magic-link email burst: 3 per 10 minutes.
- Magic-link email hourly: 5 per hour.
- Magic-link network source: 20 per hour.
- Magic-link global safety cap: 200 per hour.
- Callback attempts: 10 per network source per 15 minutes.
- Internal beta login: 10 per identity and 50 per network source per 15 minutes.
- Session refresh: 60 per network source per 10 minutes.

Supabase remains configured for 10 authentication emails per hour and its own per-user minimum interval. Resend and Vercel retain their provider limits. The application normally rejects abuse before it reaches Supabase or Resend. Public responses do not assert provider delivery and never reveal account existence or internal counters.

## Outage policy

- Magic-link request: retry the shared store once, then return a generic temporary 503 response without calling Supabase Auth.
- Callback: fail closed to the safe invalid-link state if the store cannot be evaluated.
- Internal beta login: fail closed with a generic temporary response.
- Session refresh: fail open only to Supabase's normal refresh-token verification so an already-authenticated user is not taken offline.
- Ordinary protected APIs are not rate-limited by this component.

Store-unavailable logs contain only a safe outcome, server-derived environment and route. Threshold events are recorded only when a bucket first crosses its limit and contain the HMAC actor key, not raw identity data.

## Testing and incidents

Run `node scripts/validate-distributed-auth-rate-limits.mjs` for static policy checks and `node scripts/validate-distributed-auth-rate-limits-live.mjs` for service-role, atomic concurrency, namespace, TTL and privacy checks. Run `node scripts/validate-auth-rate-limit-outage.mjs` only when no other Next.js development server is using this working tree. The live validators use unique HMAC keys, never request an email, and remove their temporary security rows.

During an incident, change central thresholds in `lib/server/levytate-auth-rate-limit-config.ts`, validate and deploy only the intended environment. Do not change database rows manually, disable the limiter, expose raw actors, or weaken Supabase provider limits. Use the bounded cleanup RPC only for expired rows. Detailed dashboards, alert routing and provider incident presentation remain Sprint 2B.2B work.
