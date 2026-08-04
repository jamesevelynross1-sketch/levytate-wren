import "server-only";

import { isInternalBetaLoginEnabled } from "@/lib/levytate/config/beta-access";
import { levyTateAiEnabled } from "@/lib/levytate/ai/openai";
import { getCurrentEarlyAccessTermsDocument } from "@/lib/server/levytate-early-access-terms";
import { getLevyTateSupabaseConfig, readRuntimeEnv, supabaseSelect } from "@/lib/server/levytate-supabase";
import { classifyReadiness, ServiceHealthTimeoutError } from "@/lib/levytate/service-health-contract";
import type { LevyTateBetaSession } from "@/lib/levytate/config/beta-access";
import { normaliseMvpUserRole } from "@/lib/levytate/mvp/rbac";

export type HealthState = "operational" | "degraded" | "unavailable";
export type HealthComponent = { label: string; state: HealthState; checkedAt: string; summary: string; durationMs?: number };
export type PublicReadiness = { status: HealthState; checkedAt: string; message?: string };
export type HealthCheckAdapter = (input: { key: string; table: string; column: string; timeoutMs: number }) => Promise<void>;

export const LEVYTATE_HEALTH_TIMEOUT_MS = 2_500;
export const LEVYTATE_READINESS_CACHE_MS = 10_000;
export const LEVYTATE_MIGRATION_BASELINE = "023";

const criticalChecks = [
  { key: "membership", table: "levytate_users", column: "id", label: "Membership and RBAC schema" },
  { key: "terms", table: "levytate_early_access_terms_acceptances", column: "id", label: "Terms acceptance schema" },
  { key: "security", table: "levytate_audit_events", column: "id", label: "Authentication security events" },
] as const;
const nonCriticalChecks = [
  { key: "prospect", table: "levytate_prospect_access", column: "id", label: "Prospect access schema" },
  { key: "rate-limit", table: "levytate_auth_rate_limits", column: "environment_namespace", label: "Distributed rate-limit store" },
  { key: "delivery", table: "levytate_auth_email_delivery_events", column: "id", label: "Authentication delivery events" },
] as const;

let readinessCache: { expiresAt: number; promise: Promise<PublicReadiness> } | null = null;
let localLastReadiness: HealthState | null = null;

export function createLivenessResponse(now = new Date()) {
  return { status: "operational" as const, service: "LevyTate" as const, checkedAt: now.toISOString() };
}

export async function getPublicReadiness(options: { adapter?: HealthCheckAdapter; now?: Date; bypassCache?: boolean; timeoutMs?: number } = {}) {
  if (options.adapter || options.bypassCache) return calculatePublicReadiness(options);
  const now = Date.now();
  if (readinessCache && readinessCache.expiresAt > now) return readinessCache.promise;
  const promise = calculatePublicReadiness(options);
  readinessCache = { expiresAt: now + LEVYTATE_READINESS_CACHE_MS, promise };
  return promise;
}

async function calculatePublicReadiness(options: { adapter?: HealthCheckAdapter; now?: Date; timeoutMs?: number }) {
  const checkedAt = (options.now ?? new Date()).toISOString();
  const config = getLevyTateSupabaseConfig();
  if (!config || !readRuntimeEnv("LEVYTATE_BETA_SESSION_SECRET")) return finishReadiness({ status: "unavailable", checkedAt, message: "Service dependencies are not ready." });
  const adapter = options.adapter ?? createSupabaseHealthAdapter();
  const timeoutMs = options.timeoutMs ?? LEVYTATE_HEALTH_TIMEOUT_MS;
  const critical = await Promise.allSettled(criticalChecks.map((item) => adapter({ key: item.key, table: item.table, column: item.column, timeoutMs })));
  if (critical.some((result) => result.status === "rejected")) return finishReadiness(classifyReadiness({ checkedAt, criticalAvailable: false, nonCriticalAvailable: true }));
  const optional = await Promise.allSettled(nonCriticalChecks.map((item) => adapter({ key: item.key, table: item.table, column: item.column, timeoutMs })));
  return finishReadiness(classifyReadiness({ checkedAt, criticalAvailable: true, nonCriticalAvailable: !optional.some((result) => result.status === "rejected") }));
}

function finishReadiness(result: PublicReadiness) {
  if (result.status !== "operational") logHealthEvent("readiness_check_failed", result.status);
  else if (localLastReadiness && localLastReadiness !== "operational") logHealthEvent("readiness_check_recovered", "operational");
  localLastReadiness = result.status;
  return result;
}

export async function getPlatformDiagnostics(options: { adapter?: HealthCheckAdapter; now?: Date; timeoutMs?: number } = {}) {
  const checkedAt = (options.now ?? new Date()).toISOString();
  const timeoutMs = options.timeoutMs ?? LEVYTATE_HEALTH_TIMEOUT_MS;
  const adapter = options.adapter ?? createSupabaseHealthAdapter();
  const configuration = configurationSafety();
  const checks = [...criticalChecks, ...nonCriticalChecks];
  const results = await Promise.all(checks.map(async (item): Promise<HealthComponent> => {
    const started = performance.now();
    try {
      await adapter({ key: item.key, table: item.table, column: item.column, timeoutMs });
      return { label: item.label, state: "operational", checkedAt, summary: "Required read-only schema operation succeeded.", durationMs: Math.round(performance.now() - started) };
    } catch (error) {
      const state: HealthState = criticalChecks.some((critical) => critical.key === item.key) ? "unavailable" : "degraded";
      logHealthEvent(error instanceof HealthTimeoutError || error instanceof ServiceHealthTimeoutError ? "health_check_timed_out" : "diagnostic_dependency_failed", item.key);
      return { label: item.label, state, checkedAt, summary: state === "unavailable" ? "A critical read-only check did not complete." : "Diagnostic reporting is temporarily limited.", durationMs: Math.round(performance.now() - started) };
    }
  }));
  const runtime: HealthComponent = { label: "Application runtime", state: "operational", checkedAt, summary: "The application runtime answered the diagnostic request." };
  const publicTrust: HealthComponent = { label: "Public trust routes", state: "operational", checkedAt, summary: "Six governed public trust route definitions are available." };
  const migrationState = results.find((item) => item.label === "Terms acceptance schema")?.state ?? "unavailable";
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
  return async ({ table, column, timeoutMs }) => {
    if (!config) throw new Error("configuration");
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const query = new URLSearchParams({ select: column, limit: "1" });
      const response = await fetch(`${config.url}/rest/v1/${table}?${query}`, {
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
