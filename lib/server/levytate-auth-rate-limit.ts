import { createHmac } from "node:crypto";
import { levyTateAuthRateLimits, getLevyTateRateLimitEnvironment, getLevyTateRateLimitSecret } from "@/lib/server/levytate-auth-rate-limit-config";
import { getLevyTateSupabaseConfig, supabaseFetchJson } from "@/lib/server/levytate-supabase";

type RateLimitRule = { limit: number; windowSeconds: number };
type RateLimitResult = { allowed: boolean; request_count: number; remaining: number; reset_at: string };
type RateLimitCheck = { action: string; actorKey: string; route: string; eventType: string; rule: RateLimitRule };

export class LevyTateRateLimitStoreError extends Error {
  constructor() { super("Authentication security controls are temporarily unavailable."); this.name = "LevyTateRateLimitStoreError"; }
}

export async function checkMagicLinkRequestLimits(request: Request, email: string) {
  const emailKey = rateLimitKey("email", email.trim().toLowerCase());
  const networkKey = networkRateLimitKey(request);
  const globalKey = rateLimitKey("global", "all-auth-email-requests");
  return consumeChecks([
    check("magic_link.email.burst", emailKey, "/api/levytate-auth/request", "authentication_request_rate_limited", levyTateAuthRateLimits.magicLinkEmailBurst),
    check("magic_link.email.hour", emailKey, "/api/levytate-auth/request", "authentication_request_rate_limited", levyTateAuthRateLimits.magicLinkEmailHourly),
    check("magic_link.network.hour", networkKey, "/api/levytate-auth/request", "authentication_request_rate_limited", levyTateAuthRateLimits.magicLinkNetworkHourly),
    check("magic_link.global.hour", globalKey, "/api/levytate-auth/request", "authentication_request_rate_limited", levyTateAuthRateLimits.magicLinkGlobalHourly),
  ]);
}

export async function checkCallbackAttemptLimit(request: Request) {
  return consumeChecks([
    check("magic_link.callback.invalid", networkRateLimitKey(request), "/levytate/auth/callback", "callback_abuse_threshold_reached", levyTateAuthRateLimits.invalidCallbackNetwork),
  ]);
}

export async function checkBetaLoginLimits(request: Request, email: string) {
  return consumeChecks([
    check("beta_login.identity", rateLimitKey("email", email.trim().toLowerCase() || "missing"), "/api/levytate-beta-login", "beta_login_rate_limited", levyTateAuthRateLimits.betaLoginIdentity),
    check("beta_login.network", networkRateLimitKey(request), "/api/levytate-beta-login", "beta_login_rate_limited", levyTateAuthRateLimits.betaLoginNetwork),
  ]);
}

export async function checkSessionRefreshLimit(request: Request) {
  return consumeChecks([
    check("session_refresh.network", networkRateLimitKey(request), "/api/levytate-auth/session", "session_refresh_rate_limited", levyTateAuthRateLimits.sessionRefreshNetwork),
  ]);
}

export function networkRateLimitKey(request: Request) {
  const source = request.headers.get("x-real-ip")?.trim()
    || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || "unknown";
  return rateLimitKey("network", source);
}

export function rateLimitKey(dimension: string, value: string) {
  const secret = getLevyTateRateLimitSecret();
  if (!secret) throw new LevyTateRateLimitStoreError();
  return createHmac("sha256", secret)
    .update(`${getLevyTateRateLimitEnvironment()}:${dimension}:${value}`)
    .digest("hex");
}

async function consumeChecks(checks: RateLimitCheck[]) {
  for (const item of checks) {
    const result = await consumeWithRetry(item);
    if (!result.allowed) return { allowed: false, resetAt: result.reset_at };
  }
  return { allowed: true as const };
}

async function consumeWithRetry(item: RateLimitCheck) {
  let failure: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const config = getLevyTateSupabaseConfig();
      if (!config) throw new LevyTateRateLimitStoreError();
      const rows = await supabaseFetchJson<RateLimitResult[]>(config, "rpc/levytate_consume_auth_rate_limit", {
        method: "POST",
        body: JSON.stringify({
          p_environment_namespace: getLevyTateRateLimitEnvironment(),
          p_action: item.action,
          p_key_hash: item.actorKey,
          p_window_seconds: item.rule.windowSeconds,
          p_limit: item.rule.limit,
          p_route: item.route,
          p_event_type: item.eventType,
        }),
      });
      if (!rows[0]) throw new LevyTateRateLimitStoreError();
      return rows[0];
    } catch (error) {
      failure = error;
    }
  }
  console.error("LevyTate authentication rate-limit store unavailable", { outcome: "store_unavailable", environment: getLevyTateRateLimitEnvironment(), route: item.route });
  throw failure instanceof LevyTateRateLimitStoreError ? failure : new LevyTateRateLimitStoreError();
}

function check(action: string, actorKey: string, route: string, eventType: string, rule: RateLimitRule): RateLimitCheck {
  return { action, actorKey, route, eventType, rule };
}
