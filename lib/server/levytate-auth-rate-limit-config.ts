import { readRuntimeEnv } from "@/lib/server/levytate-supabase";

export const levyTateAuthRateLimits = {
  magicLinkEmailBurst: { limit: 3, windowSeconds: 10 * 60 },
  magicLinkEmailHourly: { limit: 5, windowSeconds: 60 * 60 },
  magicLinkNetworkHourly: { limit: 20, windowSeconds: 60 * 60 },
  magicLinkGlobalHourly: { limit: 200, windowSeconds: 60 * 60 },
  invalidCallbackNetwork: { limit: 10, windowSeconds: 15 * 60 },
  betaLoginIdentity: { limit: 10, windowSeconds: 15 * 60 },
  betaLoginNetwork: { limit: 50, windowSeconds: 15 * 60 },
  sessionRefreshNetwork: { limit: 60, windowSeconds: 10 * 60 },
} as const;

export type LevyTateRateLimitEnvironment = "local" | "preview" | "production";

export function getLevyTateRateLimitEnvironment(): LevyTateRateLimitEnvironment {
  if (process.env.NODE_ENV !== "production") return "local";
  const vercelEnvironment = readRuntimeEnv("VERCEL_ENV").toLowerCase();
  if (vercelEnvironment === "production") return "production";
  if (vercelEnvironment === "preview") return "preview";
  return "local";
}

export function getLevyTateRateLimitSecret() {
  return readRuntimeEnv("LEVYTATE_AUTH_RATE_LIMIT_SECRET") || readRuntimeEnv("LEVYTATE_BETA_SESSION_SECRET");
}
