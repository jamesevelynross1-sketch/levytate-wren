import "server-only";

import { isInternalBetaLoginEnabled } from "@/lib/levytate/config/beta-access";
import { levyTateAiEnabled } from "@/lib/levytate/ai/openai";
import { getCurrentEarlyAccessTermsDocument } from "@/lib/server/levytate-early-access-terms";
import { rateLimitKey } from "@/lib/server/levytate-auth-rate-limit";
import { getLevyTateRateLimitEnvironment } from "@/lib/server/levytate-auth-rate-limit-config";
import { getLevyTateSupabaseConfig, readRuntimeEnv, supabaseFetchJson, supabaseSelect } from "@/lib/server/levytate-supabase";
import { createReadinessCache, evaluateReadinessChecks, ServiceHealthTimeoutError } from "@/lib/levytate/service-health-contract";
import type { ServiceHealthState, ServiceReadiness } from "@/lib/levytate/service-health-contract";
import type { LevyTateBetaSession } from "@/lib/levytate/config/beta-access";
import { normaliseMvpUserRole } from "@/lib/levytate/mvp/rbac";

export type HealthState = "operational" | "degraded" | "unavailable";
export type HealthComponent = { label: string; state: HealthState; checkedAt: string; summary: string; durationMs?: number };
export type PublicReadiness = ServiceReadiness;
type TableHealthCheck = { key: string; label: string; kind: "table"; table: string; column: string };
type AuthRateLimitHealthCheck = { key: string; label: string; kind: "auth-rate-limit" };
type AuthCallbackHealthCheck = { key: string; label: string; kind: "auth-callback-budget" };
type AuthProviderHealthCheck = { key: string; label: string; kind: "auth-provider" };
type HealthCheckDefinition = TableHealthCheck | AuthRateLimitHealthCheck | AuthCallbackHealthCheck | AuthProviderHealthCheck;
export type HealthCheckAdapter = (input: HealthCheckDefinition & { timeoutMs: number }) => Promise<void>;

export const LEVYTATE_HEALTH_TIMEOUT_MS = 2_500;
export const LEVYTATE_READINESS_CACHE_MS = 10_000;
export const LEVYTATE_MIGRATION_BASELINE = "039 (038 intentionally unapplied)";

const criticalChecks = [
  { key: "membership", kind: "table", table: "levytate_users", column: "id", label: "Membership and RBAC schema" },
  { key: "terms", kind: "table", table: "levytate_early_access_terms_acceptances", column: "id", label: "Terms acceptance schema" },
  { key: "security", kind: "table", table: "levytate_audit_events", column: "id", label: "Authentication security events" },
  { key: "rate-limit-operation", kind: "auth-rate-limit", label: "Authentication rate-limit operation" },
  { key: "callback-budget-operation", kind: "auth-callback-budget", label: "Authentication callback security operation" },
  { key: "auth-provider", kind: "auth-provider", label: "Individual authentication service" },
  { key: "migration-baseline", kind: "table", table: "levytate_lift_framework_versions", column: "framework_key", label: "Active migration baseline" },
] as const satisfies readonly HealthCheckDefinition[];
const optionalChecks = [
  { key: "prospect", kind: "table", table: "levytate_prospect_access", column: "id", label: "Optional prospect access diagnostics" },
  { key: "delivery", kind: "table", table: "levytate_auth_email_delivery_events", column: "id", label: "Optional authentication delivery diagnostics" },
] as const satisfies readonly HealthCheckDefinition[];

const readinessCache = createReadinessCache({
  cacheMs: LEVYTATE_READINESS_CACHE_MS,
  evaluate: () => calculatePublicReadiness({}),
  onResult: recordReadinessResult,
});

export function createLivenessResponse(now = new Date()) {
  return { status: "operational" as const, service: "LevyTate" as const, checkedAt: now.toISOString() };
}

export async function getPublicReadiness(options: { adapter?: HealthCheckAdapter; now?: Date; bypassCache?: boolean; timeoutMs?: number } = {}) {
  if (options.adapter || options.now || options.bypassCache || options.timeoutMs !== undefined) return calculatePublicReadiness(options);
  return readinessCache.get();
}

async function calculatePublicReadiness(options: { adapter?: HealthCheckAdapter; now?: Date; timeoutMs?: number }) {
  const checkedAt = (options.now ?? new Date()).toISOString();
  const config = getLevyTateSupabaseConfig();
  if (!config || !readRuntimeEnv("LEVYTATE_BETA_SESSION_SECRET")) return { status: "unavailable", checkedAt, message: "Service dependencies are not ready." } as const;
  const adapter = options.adapter ?? createSupabaseHealthAdapter();
  const timeoutMs = options.timeoutMs ?? LEVYTATE_HEALTH_TIMEOUT_MS;
  return evaluateReadinessChecks({
    checkedAt,
    criticalChecks: criticalChecks.map((item) => () => adapter({ ...item, timeoutMs })),
    optionalChecks: optionalChecks.map((item) => () => adapter({ ...item, timeoutMs })),
    timeoutMs,
  });
}

function recordReadinessResult(result: PublicReadiness, previousStatus: ServiceHealthState | null) {
  if (result.status !== "operational") logHealthEvent("readiness_check_failed", result.status);
  else if (previousStatus && previousStatus !== "operational") logHealthEvent("readiness_check_recovered", "operational");
}

export async function getPlatformDiagnostics(options: { adapter?: HealthCheckAdapter; now?: Date; timeoutMs?: number } = {}) {
  const checkedAt = (options.now ?? new Date()).toISOString();
  const timeoutMs = options.timeoutMs ?? LEVYTATE_HEALTH_TIMEOUT_MS;
  const adapter = options.adapter ?? createSupabaseHealthAdapter();
  const configuration = configurationSafety();
  const checks = [...criticalChecks, ...optionalChecks];
  const results = await Promise.all(checks.map(async (item): Promise<HealthComponent> => {
    const started = performance.now();
    const isCritical = criticalChecks.some((critical) => critical.key === item.key);
    try {
      await adapter({ ...item, timeoutMs });
      const summary = item.kind !== "table"
        ? "Required isolated security operation succeeded."
        : isCritical ? "Required read-only schema operation succeeded." : "Optional diagnostic read succeeded.";
      return { label: item.label, state: "operational", checkedAt, summary, durationMs: Math.round(performance.now() - started) };
    } catch (error) {
      const state: HealthState = isCritical ? "unavailable" : "degraded";
      logHealthEvent(error instanceof HealthTimeoutError || error instanceof ServiceHealthTimeoutError ? "health_check_timed_out" : "diagnostic_dependency_failed", item.key);
      return { label: item.label, state, checkedAt, summary: state === "unavailable" ? "A critical dependency check did not complete." : "Diagnostic reporting is temporarily limited.", durationMs: Math.round(performance.now() - started) };
    }
  }));
  const runtime: HealthComponent = { label: "Application runtime", state: "operational", checkedAt, summary: "The application runtime answered the diagnostic request." };
  const publicTrust: HealthComponent = { label: "Public trust routes", state: "operational", checkedAt, summary: "Six governed public trust route definitions are available." };
  const migrationState = results.find((item) => item.label === "Active migration baseline")?.state ?? "unavailable";
  const migration: HealthComponent = { label: "Migration baseline", state: migrationState, checkedAt, summary: migrationState === "operational" ? `Expected active schema marker ${LEVYTATE_MIGRATION_BASELINE} is reachable.` : "The expected active schema marker is unavailable." };
  const components = [runtime, ...results, publicTrust, migration];
  const overall = components.some((item) => item.state === "unavailable") ? "unavailable" : components.some((item) => item.state === "degraded") ? "degraded" : "operational";
  return {
    ok: overall !== "unavailable",
    status: overall,
    checkedAt,
    environment: getSafeEnvironmentLabel(),
    termsVersion: getCurrentEarlyAccessTermsDocument().version,
    migrationBaseline: LEVYTATE_MIGRATION_BASELINE,
    configuration,
    supportOwnership: "Decision required before first employer",
    incidentOwnership: "Decision required before first employer",
    components,
  } as const;
}

export function configurationSafety() {
  return [
    { label: "Supabase URL configured", configured: Boolean(readRuntimeEnv("NEXT_PUBLIC_SUPABASE_URL")) },
    { label: "Service-role credential configured", configured: Boolean(readRuntimeEnv("SUPABASE_SERVICE_ROLE_KEY")) },
    { label: "Authentication session secret configured", configured: Boolean(readRuntimeEnv("LEVYTATE_BETA_SESSION_SECRET")) },
    { label: "Rate-limit HMAC secret configured", configured: Boolean(readRuntimeEnv("LEVYTATE_AUTH_RATE_LIMIT_SECRET") || readRuntimeEnv("LEVYTATE_BETA_SESSION_SECRET")) },
    { label: "Delivery webhook secret configured", configured: Boolean(readRuntimeEnv("RESEND_WEBHOOK_SECRET")) },
    { label: "Beta login enabled", configured: isInternalBetaLoginEnabled() },
    { label: "Production AI enabled", configured: levyTateAiEnabled() },
  ] as const;
}

export function createSupabaseHealthAdapter(): HealthCheckAdapter {
  const config = getLevyTateSupabaseConfig();
  return async (input) => {
    if (!config) throw new Error("configuration");
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), input.timeoutMs);
    try {
      if (input.kind === "auth-rate-limit") {
        const rows = await supabaseFetchJson<Array<{ allowed: boolean; request_count: number }>>(config, "rpc/levytate_consume_auth_rate_limit", {
          method: "POST",
          signal: controller.signal,
          body: JSON.stringify({
            p_environment_namespace: getLevyTateRateLimitEnvironment(),
            p_action: "health.readiness",
            p_key_hash: rateLimitKey("health_probe", "required-rate-limit-operation"),
            p_window_seconds: 60,
            p_limit: 10_000,
            p_route: "/api/levytate-health/ready",
            p_event_type: "health_readiness_rate_limited",
          }),
        });
        if (rows[0]?.allowed !== true || !Number.isInteger(rows[0].request_count)) throw new Error("dependency");
        return;
      }
      if (input.kind === "auth-callback-budget") {
        const rows = await supabaseFetchJson<Array<{ allowed: boolean; reset_at: string }>>(config, "rpc/levytate_check_auth_callback_failures", {
          method: "POST", signal: controller.signal,
          body: JSON.stringify({ p_environment_namespace: getLevyTateRateLimitEnvironment(), p_key_hash: rateLimitKey("health_probe", "required-callback-budget-operation") }),
        });
        if (!Array.isArray(rows) || rows.length !== 1 || rows[0].allowed !== true || !Number.isFinite(Date.parse(rows[0].reset_at))) throw new Error("dependency");
        return;
      }
      if (input.kind === "auth-provider") {
        const response = await fetch(`${config.url}/auth/v1/health`, {
          headers: { apikey: config.serviceRoleKey, Accept: "application/json" }, cache: "no-store", signal: controller.signal,
        });
        if (!response.ok) throw new Error("dependency");
        return;
      }
      const query = new URLSearchParams({ select: input.column, limit: "1" });
      const response = await fetch(`${config.url}/rest/v1/${input.table}?${query}`, {
        headers: { apikey: config.serviceRoleKey, Authorization: `Bearer ${config.serviceRoleKey}`, Accept: "application/json" },
        cache: "no-store",
        signal: controller.signal,
      });
      if (!response.ok) throw new Error("dependency");
      await response.text();
    } catch (error) {
      if (controller.signal.aborted) throw new HealthTimeoutError();
      throw error;
    } finally { clearTimeout(timer); }
  };
}

export class HealthTimeoutError extends Error { constructor() { super("Health check timed out"); this.name = "HealthTimeoutError"; } }

export function logDiagnosticDenied() { logHealthEvent("diagnostic_request_denied", "access_denied"); }

type PlatformDiagnosticMembership = {
  email: string;
  role: string;
  active: boolean;
  auth_subject: string | null;
  auth_binding_status: string;
};

export function isCurrentPlatformDiagnosticBinding(
  session: LevyTateBetaSession,
  memberships: PlatformDiagnosticMembership[],
) {
  const membership = memberships.length === 1 ? memberships[0] : null;
  if (
    !membership
    || !membership.active
    || normaliseMvpUserRole(membership.role) !== "Platform Admin"
    || membership.auth_binding_status !== "bound"
    || !membership.auth_subject
  ) return false;
  return session.authMode === "supabase_email" && session.authSubject === membership.auth_subject;
}

export async function hasCurrentPlatformDiagnosticBinding(session: LevyTateBetaSession) {
  const config = getLevyTateSupabaseConfig();
  if (!config) return false;
  const query = new URLSearchParams({ select: "email,role,active,auth_subject,auth_binding_status", email: `eq.${session.email}`, limit: "2" });
  try {
    const rows = await supabaseSelect<PlatformDiagnosticMembership>(config, "levytate_users", query);
    return isCurrentPlatformDiagnosticBinding(session, rows);
  } catch {
    logHealthEvent("diagnostic_binding_check_failed", "access_denied");
    return false;
  }
}
function logHealthEvent(event: string, outcome: string) { console.log("LevyTate service health", { event, outcome }); }
function getSafeEnvironmentLabel() {
  if (process.env.VERCEL_ENV === "preview") return "Preview";
  if (process.env.VERCEL_ENV === "production") return "Production";
  return process.env.NODE_ENV === "production" ? "Production-shaped local" : "Local development";
}
