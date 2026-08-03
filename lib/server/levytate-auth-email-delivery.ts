import { createHmac, randomUUID } from "node:crypto";
import { Webhook } from "svix";
import { getLevyTateRateLimitEnvironment, getLevyTateRateLimitSecret } from "@/lib/server/levytate-auth-rate-limit-config";
import { getLevyTateSupabaseConfig, readRuntimeEnv, supabaseInsert, supabaseSelect } from "@/lib/server/levytate-supabase";
import {
  deriveAuthenticationEmailDeliveryStatus,
  mapResendEventType,
  type AuthenticationEmailCorrelationConfidence,
  type AuthenticationEmailDeliveryStatus,
} from "@/lib/server/levytate-auth-email-delivery-model";

export { deriveAuthenticationEmailDeliveryStatus, mapResendEventType } from "@/lib/server/levytate-auth-email-delivery-model";

export const authenticationEmailDeliveryRetentionDays = 90;
export const resendWebhookMaxBytes = 128 * 1024;
export const authenticationEmailCorrelationWindowMinutes = 30;

type DeliveryEventRow = {
  id?: number;
  environment_namespace: string;
  provider: string;
  provider_event_id: string;
  provider_message_reference: string | null;
  authentication_request_reference: string | null;
  recipient_hash: string;
  canonical_status: AuthenticationEmailDeliveryStatus;
  provider_event_type: string;
  correlation_confidence: AuthenticationEmailCorrelationConfidence;
  occurred_at: string;
  received_at?: string;
  processing_status: "processed" | "ignored" | "failed";
  safe_failure_code: string | null;
  metadata: Record<string, string | boolean>;
};

type ResendEmailWebhook = {
  type?: unknown;
  created_at?: unknown;
  data?: {
    email_id?: unknown;
    message_id?: unknown;
    to?: unknown;
    bounce?: { type?: unknown; subType?: unknown };
  };
};

export class AuthenticationEmailDeliveryError extends Error {
  constructor(public code: "configuration" | "invalid_signature" | "invalid_payload" | "storage_unavailable", message: string) {
    super(message);
    this.name = "AuthenticationEmailDeliveryError";
  }
}

export function recipientDeliveryHash(email: string) {
  const secret = getLevyTateRateLimitSecret();
  if (!secret) throw new AuthenticationEmailDeliveryError("configuration", "Delivery privacy key is unavailable.");
  return createHmac("sha256", secret)
    .update(`${getLevyTateRateLimitEnvironment()}:auth-email-recipient:${email.trim().toLowerCase()}`)
    .digest("hex");
}

export async function recordAuthenticationEmailRequest(email: string) {
  const requestReference = randomUUID();
  const occurredAt = new Date().toISOString();
  await persistDeliveryEvent({
    environment_namespace: getLevyTateRateLimitEnvironment(),
    provider: "levytate",
    provider_event_id: `request:${requestReference}`,
    provider_message_reference: null,
    authentication_request_reference: requestReference,
    recipient_hash: recipientDeliveryHash(email),
    canonical_status: "requested",
    provider_event_type: "authentication.requested",
    correlation_confidence: "exact",
    occurred_at: occurredAt,
    processing_status: "processed",
    safe_failure_code: null,
    metadata: {},
  });
  return requestReference;
}

export async function recordAuthenticationEmailAccepted(email: string, requestReference: string, accepted: boolean) {
  const status: AuthenticationEmailDeliveryStatus = accepted ? "accepted" : "failed";
  await persistDeliveryEvent({
    environment_namespace: getLevyTateRateLimitEnvironment(),
    provider: "supabase",
    provider_event_id: `${accepted ? "accepted" : "failed"}:${requestReference}`,
    provider_message_reference: null,
    authentication_request_reference: requestReference,
    recipient_hash: recipientDeliveryHash(email),
    canonical_status: status,
    provider_event_type: accepted ? "smtp.accepted" : "smtp.failed",
    correlation_confidence: "exact",
    occurred_at: new Date().toISOString(),
    processing_status: "processed",
    safe_failure_code: accepted ? null : "delivery_not_started",
    metadata: {},
  });
}

export async function shouldSuppressAuthenticationEmail(email: string) {
  const config = getLevyTateSupabaseConfig();
  if (!config) return false;
  try {
    const rows = await supabaseSelect<DeliveryEventRow>(config, "levytate_auth_email_delivery_events", new URLSearchParams({
      select: "canonical_status,occurred_at,received_at",
      environment_namespace: `eq.${getLevyTateRateLimitEnvironment()}`,
      recipient_hash: `eq.${recipientDeliveryHash(email)}`,
      safe_failure_code: "in.(hard_bounce,rejected,complained,suppressed)",
      occurred_at: `gte.${new Date(Date.now() - authenticationEmailDeliveryRetentionDays * 86400000).toISOString()}`,
      order: "occurred_at.desc",
      limit: "1",
    }));
    return rows.length > 0;
  } catch {
    console.error("LevyTate authentication delivery suppression check unavailable", { outcome: "suppression_check_failed" });
    return false;
  }
}

export function verifyAndParseResendWebhook(rawBody: string, headers: Headers) {
  const secret = readRuntimeEnv("RESEND_WEBHOOK_SECRET");
  if (!secret) throw new AuthenticationEmailDeliveryError("configuration", "Webhook verification is unavailable.");
  const webhookId = headers.get("svix-id")?.trim();
  const webhookTimestamp = headers.get("svix-timestamp")?.trim();
  const webhookSignature = headers.get("svix-signature")?.trim();
  if (!webhookId || !webhookTimestamp || !webhookSignature) throw new AuthenticationEmailDeliveryError("invalid_signature", "Webhook signature is missing.");
  try {
    return {
      providerEventId: webhookId,
      payload: new Webhook(secret).verify(rawBody, {
        "svix-id": webhookId,
        "svix-timestamp": webhookTimestamp,
        "svix-signature": webhookSignature,
      }) as ResendEmailWebhook,
    };
  } catch {
    throw new AuthenticationEmailDeliveryError("invalid_signature", "Webhook signature is invalid.");
  }
}

export async function processResendDeliveryWebhook(rawBody: string, headers: Headers) {
  const verified = verifyAndParseResendWebhook(rawBody, headers);
  const normalised = await normaliseResendEvent(verified.providerEventId, verified.payload);
  const inserted = await persistDeliveryEvent(normalised);
  if (inserted && (normalised.canonical_status === "complained" || normalised.safe_failure_code === "hard_bounce")) {
    await recordSecurityEvent(`auth.email_${normalised.canonical_status}`, normalised.recipient_hash, normalised.safe_failure_code ?? normalised.canonical_status);
  } else if (inserted && normalised.correlation_confidence === "uncorrelated") {
    await recordSecurityEvent("auth.email_delivery_uncorrelated", normalised.recipient_hash, "uncorrelated");
  }
  return { inserted, status: normalised.canonical_status, correlationConfidence: normalised.correlation_confidence };
}

export async function getAuthenticationDeliveryStatus(requestReference: string) {
  const config = getLevyTateSupabaseConfig();
  if (!config) throw new AuthenticationEmailDeliveryError("storage_unavailable", "Delivery evidence is unavailable.");
  const rows = await supabaseSelect<DeliveryEventRow>(config, "levytate_auth_email_delivery_events", new URLSearchParams({
    select: "canonical_status,occurred_at,received_at,correlation_confidence,safe_failure_code,environment_namespace",
    environment_namespace: `eq.${getLevyTateRateLimitEnvironment()}`,
    authentication_request_reference: `eq.${requestReference}`,
    order: "occurred_at.asc",
    limit: "100",
  }));
  return {
    status: deriveAuthenticationEmailDeliveryStatus(rows),
    lastProviderEventAt: rows.at(-1)?.occurred_at ?? null,
    correlationConfidence: weakestCorrelation(rows.map((row) => row.correlation_confidence)),
    safeFailureCode: rows.at(-1)?.safe_failure_code ?? null,
    environment: getLevyTateRateLimitEnvironment(),
  };
}

export async function getAuthenticationDeliveryHealth(since = new Date(Date.now() - 86400000)) {
  const config = getLevyTateSupabaseConfig();
  if (!config) throw new AuthenticationEmailDeliveryError("storage_unavailable", "Delivery evidence is unavailable.");
  const rows = await supabaseSelect<DeliveryEventRow>(config, "levytate_auth_email_delivery_events", new URLSearchParams({
    select: "canonical_status,occurred_at,received_at,correlation_confidence",
    environment_namespace: `eq.${getLevyTateRateLimitEnvironment()}`,
    occurred_at: `gte.${since.toISOString()}`,
    provider: "eq.resend",
    order: "occurred_at.desc",
    limit: "1000",
  }));
  const counts = Object.fromEntries([...new Set(rows.map((row) => row.canonical_status))].map((status) => [status, rows.filter((row) => row.canonical_status === status).length]));
  return { environment: getLevyTateRateLimitEnvironment(), since: since.toISOString(), counts, latestEventAt: rows[0]?.occurred_at ?? null };
}

export async function listRecentAuthenticationDeliveryFailures(limit = 50) {
  const config = getLevyTateSupabaseConfig();
  if (!config) throw new AuthenticationEmailDeliveryError("storage_unavailable", "Delivery evidence is unavailable.");
  const boundedLimit = Math.max(1, Math.min(limit, 100));
  return supabaseSelect<Pick<DeliveryEventRow, "canonical_status" | "occurred_at" | "correlation_confidence" | "safe_failure_code" | "environment_namespace">>(config, "levytate_auth_email_delivery_events", new URLSearchParams({
    select: "canonical_status,occurred_at,correlation_confidence,safe_failure_code,environment_namespace",
    environment_namespace: `eq.${getLevyTateRateLimitEnvironment()}`,
    canonical_status: "in.(bounced,rejected,complained,suppressed,failed)",
    order: "occurred_at.desc",
    limit: String(boundedLimit),
  }));
}

export function getAuthenticationProviderStatus() {
  return { provider: "resend", environment: getLevyTateRateLimitEnvironment(), webhookConfigured: Boolean(readRuntimeEnv("RESEND_WEBHOOK_SECRET")) };
}

async function normaliseResendEvent(providerEventId: string, payload: ResendEmailWebhook): Promise<DeliveryEventRow> {
  if (!payload || typeof payload !== "object" || typeof payload.type !== "string" || !payload.data || typeof payload.data !== "object" || !validDate(payload.created_at)) {
    throw new AuthenticationEmailDeliveryError("invalid_payload", "Webhook payload is malformed.");
  }
  const eventType = typeof payload.type === "string" && /^[a-z0-9_.:-]{1,100}$/.test(payload.type) ? payload.type : "unknown";
  const occurredAt = validDate(payload.created_at) ?? new Date().toISOString();
  const emailId = safeReference(payload.data?.email_id, 160);
  const messageId = safeReference(payload.data?.message_id, 255);
  const recipient = Array.isArray(payload.data?.to) && payload.data.to.length === 1 && typeof payload.data.to[0] === "string" ? payload.data.to[0].trim().toLowerCase() : "";
  const recipientHash = recipient ? recipientDeliveryHash(recipient) : recipientDeliveryHash(`uncorrelated:${providerEventId}`);
  const correlation = await correlateDeliveryEvent(messageId ?? emailId, recipientHash, occurredAt);
  const canonicalStatus = mapResendEventType(eventType);
  return {
    environment_namespace: getLevyTateRateLimitEnvironment(),
    provider: "resend",
    provider_event_id: providerEventId,
    provider_message_reference: messageId ?? emailId,
    authentication_request_reference: correlation.requestReference,
    recipient_hash: recipientHash,
    canonical_status: canonicalStatus,
    provider_event_type: eventType,
    correlation_confidence: correlation.confidence,
    occurred_at: occurredAt,
    processing_status: canonicalStatus === "unknown" ? "ignored" : "processed",
    safe_failure_code: safeFailureCode(canonicalStatus, payload),
    metadata: { recipient_count: Array.isArray(payload.data?.to) ? payload.data.to.length === 1 : false },
  };
}

async function correlateDeliveryEvent(messageReference: string | null, recipientHash: string, occurredAt: string) {
  const config = getLevyTateSupabaseConfig();
  if (!config) throw new AuthenticationEmailDeliveryError("storage_unavailable", "Delivery evidence is unavailable.");
  if (messageReference) {
    const exact = await supabaseSelect<DeliveryEventRow>(config, "levytate_auth_email_delivery_events", new URLSearchParams({
      select: "authentication_request_reference",
      environment_namespace: `eq.${getLevyTateRateLimitEnvironment()}`,
      provider_message_reference: `eq.${messageReference}`,
      authentication_request_reference: "not.is.null",
      order: "occurred_at.desc",
      limit: "1",
    }));
    if (exact[0]?.authentication_request_reference) return { requestReference: exact[0].authentication_request_reference, confidence: "exact" as const };
  }
  const eventTime = Date.parse(occurredAt);
  const bounded = await supabaseSelect<DeliveryEventRow>(config, "levytate_auth_email_delivery_events", new URLSearchParams({
    select: "authentication_request_reference",
    environment_namespace: `eq.${getLevyTateRateLimitEnvironment()}`,
    recipient_hash: `eq.${recipientHash}`,
    provider: "in.(levytate,supabase)",
    occurred_at: `gte.${new Date(eventTime - authenticationEmailCorrelationWindowMinutes * 60000).toISOString()}`,
    order: "occurred_at.desc",
    limit: "2",
  }));
  const references = [...new Set(bounded.map((row) => row.authentication_request_reference).filter(Boolean))];
  if (references.length === 1) return { requestReference: references[0]!, confidence: "bounded" as const };
  return { requestReference: null, confidence: "uncorrelated" as const };
}

async function persistDeliveryEvent(event: DeliveryEventRow) {
  const config = getLevyTateSupabaseConfig();
  if (!config) throw new AuthenticationEmailDeliveryError("storage_unavailable", "Delivery evidence is unavailable.");
  const rows = await supabaseInsert<DeliveryEventRow>(config, "levytate_auth_email_delivery_events", [event], {
    prefer: "resolution=ignore-duplicates,return=representation",
    query: "on_conflict=environment_namespace,provider,provider_event_id",
  });
  return rows.length === 1;
}

export async function recordWebhookSecurityEvent(eventType: string, providerEventId: string, outcomeCode: string) {
  try { await recordSecurityEvent(eventType, recipientDeliveryHash(`provider-event:${providerEventId || "missing"}`), outcomeCode); } catch { /* keep webhook response bounded */ }
}

async function recordSecurityEvent(eventType: string, keyHash: string, outcomeCode: string) {
  const config = getLevyTateSupabaseConfig();
  if (!config) return;
  await supabaseInsert(config, "levytate_auth_security_events", [{
    event_type: eventType,
    environment_namespace: getLevyTateRateLimitEnvironment(),
    route: "/api/levytate-auth/delivery-events/resend",
    key_hash: keyHash,
    outcome_code: outcomeCode,
  }], { prefer: "return=minimal" });
}

function safeFailureCode(status: AuthenticationEmailDeliveryStatus, payload: ResendEmailWebhook) {
  if (status === "bounced") {
    const bounceType = typeof payload.data?.bounce?.type === "string" ? payload.data.bounce.type.toLowerCase() : "";
    if (bounceType === "permanent") return "hard_bounce";
    if (bounceType === "transient") return "soft_bounce";
    return "undetermined_bounce";
  }
  if (["rejected", "complained", "suppressed", "failed"].includes(status)) return status;
  return null;
}

function safeReference(value: unknown, maxLength: number) {
  return typeof value === "string" && value.length > 0 && value.length <= maxLength && !/[\r\n]/.test(value) ? value : null;
}

function validDate(value: unknown) {
  if (typeof value !== "string") return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && Math.abs(Date.now() - parsed) <= authenticationEmailDeliveryRetentionDays * 86400000 ? new Date(parsed).toISOString() : null;
}

function weakestCorrelation(values: AuthenticationEmailCorrelationConfidence[]) {
  if (values.includes("uncorrelated")) return "uncorrelated";
  if (values.includes("bounded")) return "bounded";
  return values.length ? "exact" : "uncorrelated";
}
