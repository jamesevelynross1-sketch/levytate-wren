# LevyTate authentication logout contract

LevyTate logout is a server-owned full-document POST to `/api/levytate-beta-logout`. The server completes provider invalidation where applicable, expires recognised authentication cookies, returns a `303` response to `/levytate/login`, and marks the response private and non-cacheable before the browser navigates.

## Session scope

Supabase email authentication uses `scope=local`, so logout revokes only the current browser's Supabase refresh session. A separately authenticated browser remains active. Organisation access revocation, membership deactivation and canonical role changes continue to be revalidated on every protected request and therefore override every browser session.

Internal beta-code sessions have no Supabase provider session. The same server POST expires the signed LevyTate application cookie and returns the same login redirect.

## Recognised cookies

The callback and refresh routes create these HTTP-only, `SameSite=Lax`, root-path cookies without a custom domain:

- `levytate_beta_session`
- `levytate_auth_access`
- `levytate_auth_refresh`

Production cookies are Secure. Logout expires the same three names at `/` with `Max-Age=0` and an epoch expiry. It does not remove unrelated cookies.

## Failure behaviour

If Supabase current-session invalidation fails, LevyTate still expires every local authentication cookie and redirects to `/levytate/login?logout=local-only`. The login page shows only a generic warning. Server logs and audit events contain safe outcomes, never tokens, cookie values, Auth identifiers or provider payloads.

## Caching and refresh

The protected application page is force-dynamic. Workspace, session-refresh and logout responses use private no-store headers. After logout, the missing refresh cookie makes refresh return `401`, no new signed application session is issued, protected APIs return `401`, and protected pages redirect to login.

## Validation

`scripts/validate-secure-employer-auth-live.mjs` exercises real HTTP cookie application, current-session refresh revocation, duplicate and expired logout, provider-failure local fallback, protected pages and APIs, session refresh, another browser session, and all four internal beta roles. The browser smoke test additionally verifies the visible control, Back navigation, protected route/API denial, refresh denial, console cleanliness and the 390 × 844 layout.
