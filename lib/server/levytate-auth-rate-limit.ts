import { createHash, createHmac } from "node:crypto";
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

/** Shared, persistent budget for cookie-authenticated writes across endpoints.
 * Keys are HMACs and a changed session cookie cannot reset the identity budget.
 */
export async function checkAuthenticatedWriteLimit(request: Request, email: string) {
  return consumeChecks([
    check("workspace_write.identity.minute", rateLimitKey("email", email.trim().toLowerCase()), "/api/levytate-workspace/*", "workspace_write_rate_limited", { limit: 120, windowSeconds: 60 }),
    check("workspace_write.network.minute", networkRateLimitKey(request), "/api/levytate-workspace/*", "workspace_write_rate_limited", { limit: 600, windowSeconds: 60 }),
  ]);
}

export async function checkLevyTateCopilotLimits(request: Request, email: string) {
  return consumeChecks([
    check("copilot.identity.minute", rateLimitKey("email", email.trim().toLowerCase()), "/api/levytate-ai", "copilot_rate_limited", { limit: 12, windowSeconds: 60 }),
    check("copilot.identity.hour", rateLimitKey("email", email.trim().toLowerCase()), "/api/levytate-ai", "copilot_rate_limited", { limit: 120, windowSeconds: 3600 }),
    check("copilot.network.hour", networkRateLimitKey(request), "/api/levytate-ai", "copilot_rate_limited", { limit: 1200, windowSeconds: 3600 }),
  ]);
}

export async function checkMicrosoftCopilotPreAuthenticationLimit(request: Request) {
  return consumeChecks([
    check(
      "microsoft_copilot.preauth.network.minute",
      networkRateLimitKey(request),
      "/api/mcp/levytate",
      "microsoft_copilot_authentication_rate_limited",
      levyTateAuthRateLimits.microsoftCopilotPreAuthenticationNetworkMinute,
    ),
  ]);
}

export async function checkMicrosoftCopilotRequestLimits(request: Request, tenantId: string, objectId: string) {
  return consumeChecks([
    check(
      "microsoft_copilot.identity.minute",
      rateLimitKey("microsoft_identity", `${tenantId}:${objectId}`),
      "/api/mcp/levytate",
      "microsoft_copilot_rate_limited",
      levyTateAuthRateLimits.microsoftCopilotIdentityMinute,
    ),
    check(
      "microsoft_copilot.network.minute",
      networkRateLimitKey(request),
      "/api/mcp/levytate",
      "microsoft_copilot_rate_limited",
      levyTateAuthRateLimits.microsoftCopilotNetworkMinute,
    ),
    check(
      "microsoft_copilot.global.minute",
      rateLimitKey("global", "all-microsoft-copilot-requests"),
      "/api/mcp/levytate",
      "microsoft_copilot_rate_limited",
      levyTateAuthRateLimits.microsoftCopilotGlobalMinute,
    ),
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

const memoryBuckets = new Map<string, { count: number; windowStart: number }>();

export async function checkStrategyBuilderLimits(
  request: Request,
  email: string,
  route: "/api/strategy-builder/generate" | "/api/strategy-builder/refine",
) {
  return guardLimits(
    () => consumeChecks([
      check("strategy_builder.identity.burst", rateLimitKey("email", email), route, "strategy_builder_rate_limited", levyTateAuthRateLimits.strategyBuilderIdentityBurst),
      check("strategy_builder.identity.hour", rateLimitKey("email", email), route, "strategy_builder_rate_limited", levyTateAuthRateLimits.strategyBuilderIdentityHour),
      check("strategy_builder.network.hour", networkRateLimitKey(request), route, "strategy_builder_rate_limited", levyTateAuthRateLimits.strategyBuilderNetworkHour),
    ]),
    () => [
      { key: memoryActorKey("strategy-email-burst", email), rule: levyTateAuthRateLimits.strategyBuilderIdentityBurst },
      { key: memoryActorKey("strategy-email-hour", email), rule: levyTateAuthRateLimits.strategyBuilderIdentityHour },
      { key: memoryActorKey("strategy-network", clientAddress(request)), rule: levyTateAuthRateLimits.strategyBuilderNetworkHour },
    ],
  );
}

export async function checkPublicSubmissionLimits(
  request: Request,
  email: string,
  route: "/api/levy-transfer-enquiry" | "/api/opportunity-review/submit",
) {
  const action = route === "/api/levy-transfer-enquiry" ? "levy_transfer_enquiry" : "opportunity_review";
  return guardLimits(
    () => consumeChecks([
      check(`${action}.email`, rateLimitKey("email", email), route, "public_form_rate_limited", levyTateAuthRateLimits.publicFormEmailHour),
      check(`${action}.network`, networkRateLimitKey(request), route, "public_form_rate_limited", levyTateAuthRateLimits.publicFormNetworkHour),
    ]),
    () => [
      { key: memoryActorKey(`${action}-email`, email), rule: levyTateAuthRateLimits.publicFormEmailHour },
      { key: memoryActorKey(`${action}-network`, clientAddress(request)), rule: levyTateAuthRateLimits.publicFormNetworkHour },
    ],
  );
}

async function guardLimits(
  consume: () => Promise<{ allowed: boolean; resetAt?: string }>,
  memoryItems: () => Array<{ key: string; rule: RateLimitRule }>,
) {
  try {
    return await consume();
  } catch (error) {
    if (process.env.NODE_ENV !== "production" && error instanceof LevyTateRateLimitStoreError) {
      return allowMemoryChecks(memoryItems());
    }
    throw error instanceof LevyTateRateLimitStoreError ? error : new LevyTateRateLimitStoreError();
  }
}

function allowMemoryChecks(items: Array<{ key: string; rule: RateLimitRule }>) {
  for (const item of items) {
    const result = allowInMemory(item.key, item.rule);
    if (!result.allowed) return { allowed: false as const, resetAt: result.resetAt };
  }
  return { allowed: true as const };
}

function allowInMemory(key: string, rule: RateLimitRule) {
  const now = Date.now();
  const windowMs = rule.windowSeconds * 1000;
  const windowStart = Math.floor(now / windowMs) * windowMs;
  const bucketKey = `${key}:${windowStart}`;
  const count = (memoryBuckets.get(bucketKey)?.count ?? 0) + 1;
  memoryBuckets.set(bucketKey, { count, windowStart });
  if (memoryBuckets.size > 500) {
    for (const [storedKey, bucket] of memoryBuckets) {
      if (now - bucket.windowStart > windowMs) memoryBuckets.delete(storedKey);
    }
  }
  return { allowed: count <= rule.limit, resetAt: new Date(windowStart + windowMs).toISOString() };
}

function memoryActorKey(dimension: string, value: string) {
  return createHash("sha256").update(`${dimension}:${value}`).digest("hex");
}

function clientAddress(request: Request) {
  return request.headers.get("x-real-ip")?.trim()
    || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || "unknown";
}
