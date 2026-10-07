import { randomUUID } from "node:crypto";
import { createRemoteJWKSet, decodeJwt, jwtVerify, type JWTPayload } from "jose";
import type { AuthInfo } from "@modelcontextprotocol/server";
import {
  MicrosoftCopilotConnectorError,
  microsoftCopilotProvider,
  type MicrosoftCopilotActor,
  type MicrosoftCopilotAuditOutcome,
  type MicrosoftCopilotConnectionStatus,
  type MicrosoftCopilotToolName,
} from "@/lib/levytate/microsoft-copilot";
import type { MvpUserRole } from "@/lib/levytate/mvp/rbac";
import {
  getMicrosoftCopilotConnectorConfig,
  isMicrosoftCopilotConnectorRuntimeEnabled,
} from "@/lib/server/levytate-microsoft-copilot-config";
import {
  getLevyTateSupabaseConfig,
  supabaseInsert,
  supabaseSelect,
  supabaseUpdate,
} from "@/lib/server/levytate-supabase";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const supportedEmployerRoles = new Set<MvpUserRole>(["Employer Admin", "Apprenticeship Lead", "Line Manager", "Employee"]);
const jwksByIssuer = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

type VerifiedEntraIdentity = {
  token: string;
  tenantId: string;
  objectId: string;
  subject: string;
  emailHint: string;
  expiresAt: number;
  scopes: string[];
  audience: string;
};

type TenantConnectionRow = {
  id: string;
  organisation_id: string;
  display_name: string;
  status: "inactive" | "active" | "suspended";
  connected_at: string | null;
  last_successful_activity_at: string | null;
};

type ExternalIdentityRow = {
  id: string;
  organisation_id: string;
  levytate_user_id: string;
  external_tenant_id: string;
  external_object_id: string;
  status: "active" | "revoked";
};

type UserRow = {
  id: string;
  organisation_id: string;
  email: string;
  role: string;
  active: boolean;
};

type OrganisationRow = { id: string; name: string };
type CapabilityRow = { microsoft_copilot_enabled: boolean };

export async function authenticateMicrosoftCopilotRequest(
  request: Request,
  correlationId: string,
  beforeIdentityResolution?: (identity: Pick<VerifiedEntraIdentity, "tenantId" | "objectId">) => Promise<void>,
) {
  if (!isMicrosoftCopilotConnectorRuntimeEnabled()) {
    throw new MicrosoftCopilotConnectorError("connector_disabled", "The Microsoft 365 Copilot connector is disabled.", 404);
  }
  const header = request.headers.get("authorization") ?? "";
  if (!header.startsWith("Bearer ") || header.length <= 7) {
    await recordMicrosoftCopilotAudit({
      correlationId,
      outcome: "denied",
      errorCode: "missing_bearer_token",
      eventType: "microsoft_copilot.authentication_denied",
    });
    throw new MicrosoftCopilotConnectorError("invalid_token", "A valid bearer token is required.", 401);
  }

  let verified: VerifiedEntraIdentity;
  try {
    verified = await verifyEntraAccessToken(header.slice(7));
  } catch {
    await recordMicrosoftCopilotAudit({
      correlationId,
      outcome: "denied",
      errorCode: "invalid_entra_token",
      eventType: "microsoft_copilot.authentication_denied",
    });
    throw new MicrosoftCopilotConnectorError("invalid_token", "The bearer token is invalid or expired.", 401);
  }

  try {
    await beforeIdentityResolution?.(verified);
    const actor = await resolveMicrosoftCopilotActor(verified, correlationId);
    const config = getMicrosoftCopilotConnectorConfig();
    const authInfo: AuthInfo = {
      token: verified.token,
      clientId: config.clientId,
      scopes: verified.scopes,
      expiresAt: verified.expiresAt,
      resource: audienceUrl(verified.audience),
      extra: { actor },
    };
    return { actor, authInfo };
  } catch (error) {
    if (error instanceof MicrosoftCopilotConnectorError) throw error;
    throw new MicrosoftCopilotConnectorError("identity_not_bound", "The Microsoft identity is not authorised for LevyTate.", 403);
  }
}

export async function verifyEntraAccessToken(token: string, verification?: {
  audience: string;
  issuerBaseUrl: URL;
  key: CryptoKey;
}): Promise<VerifiedEntraIdentity> {
  const config = verification ? null : getMicrosoftCopilotConnectorConfig();
  const unverified = decodeJwt(token);
  const tenantId = requiredGuidClaim(unverified, "tid");
  const issuerBaseUrl = verification?.issuerBaseUrl ?? config!.issuerBaseUrl;
  const expectedAudience = verification?.audience ?? config!.audience;
  const verifiedIssuer = new URL(`/${tenantId}/v2.0`, issuerBaseUrl).toString().replace(/\/$/, "");
  const jwksUrl = new URL("/common/discovery/v2.0/keys", issuerBaseUrl);
  const jwks = verification?.key ?? jwksByIssuer.get(jwksUrl.toString()) ?? createRemoteJWKSet(jwksUrl, {
    cooldownDuration: 30_000,
    cacheMaxAge: 10 * 60_000,
    timeoutDuration: 5_000,
  });
  if (!verification) jwksByIssuer.set(jwksUrl.toString(), jwks as ReturnType<typeof createRemoteJWKSet>);

  const { payload } = await jwtVerify(token, jwks, {
    algorithms: ["RS256"],
    audience: expectedAudience,
    issuer: verifiedIssuer,
    clockTolerance: 30,
    requiredClaims: ["aud", "exp", "iat", "iss", "nbf", "sub", "tid"],
  });
  const verifiedTenantId = requiredGuidClaim(payload, "tid");
  const objectId = requiredGuidClaim(payload, "oid");
  if (verifiedTenantId.toLowerCase() !== tenantId.toLowerCase() || typeof payload.sub !== "string" || !payload.sub.trim()) {
    throw new Error("Invalid Entra identity claims.");
  }
  if (typeof payload.exp !== "number") throw new Error("Missing token expiry.");
  const tokenAudience = Array.isArray(payload.aud) ? payload.aud[0] : payload.aud;
  if (!tokenAudience) throw new Error("Missing token audience.");

  return {
    token,
    tenantId: verifiedTenantId.toLowerCase(),
    objectId: objectId.toLowerCase(),
    subject: payload.sub,
    emailHint: emailHintFromClaims(payload),
    expiresAt: payload.exp,
    scopes: typeof payload.scp === "string" ? payload.scp.split(/\s+/).filter(Boolean) : [],
    audience: tokenAudience,
  };
}

async function resolveMicrosoftCopilotActor(identity: VerifiedEntraIdentity, correlationId: string): Promise<MicrosoftCopilotActor> {
  const config = requireSupabase();
  const connections = await supabaseSelect<TenantConnectionRow>(config, "levytate_external_tenant_connections", new URLSearchParams({
    select: "id,organisation_id,display_name,status,connected_at,last_successful_activity_at",
    provider: `eq.${microsoftCopilotProvider}`,
    external_tenant_id: `eq.${identity.tenantId}`,
    limit: "2",
  }));
  const connection = connections[0];
  if (connections.length !== 1 || !connection || connection.status !== "active") {
    await recordMicrosoftCopilotAudit({
      correlationId,
      tenantId: identity.tenantId,
      objectId: identity.objectId,
      organisationId: connection?.organisation_id,
      outcome: "denied",
      errorCode: connection ? `tenant_${connection.status}` : "tenant_not_connected",
      eventType: "microsoft_copilot.identity_denied",
    });
    throw new MicrosoftCopilotConnectorError("tenant_not_connected", "This Microsoft tenant is not connected to LevyTate.", 403);
  }

  const capabilities = await supabaseSelect<CapabilityRow>(config, "levytate_organisation_capabilities", new URLSearchParams({
    select: "microsoft_copilot_enabled",
    organisation_id: `eq.${connection.organisation_id}`,
    limit: "1",
  }));
  if (capabilities[0]?.microsoft_copilot_enabled !== true) {
    await recordMicrosoftCopilotAudit({
      correlationId,
      tenantId: identity.tenantId,
      objectId: identity.objectId,
      organisationId: connection.organisation_id,
      outcome: "denied",
      errorCode: "organisation_capability_disabled",
      eventType: "microsoft_copilot.identity_denied",
    });
    throw new MicrosoftCopilotConnectorError("connector_disabled", "The connector is not enabled for this LevyTate workspace.", 403);
  }

  let bindings = await supabaseSelect<ExternalIdentityRow>(config, "levytate_external_identities", new URLSearchParams({
    select: "id,organisation_id,levytate_user_id,external_tenant_id,external_object_id,status",
    provider: `eq.${microsoftCopilotProvider}`,
    external_tenant_id: `eq.${identity.tenantId}`,
    external_object_id: `eq.${identity.objectId}`,
    limit: "2",
  }));
  if (!bindings.length) {
    try {
      const binding = await createJustInTimeBinding(connection, identity, correlationId);
      bindings = [binding];
    } catch (error) {
      await recordMicrosoftCopilotAudit({
        correlationId,
        tenantId: identity.tenantId,
        objectId: identity.objectId,
        organisationId: connection.organisation_id,
        outcome: "denied",
        errorCode: error instanceof MicrosoftCopilotConnectorError ? error.code : "identity_binding_failed",
        eventType: "microsoft_copilot.identity_denied",
      });
      throw error;
    }
  }
  const binding = bindings[0];
  if (bindings.length !== 1 || binding.status !== "active" || binding.organisation_id !== connection.organisation_id) {
    await recordMicrosoftCopilotAudit({
      correlationId,
      tenantId: identity.tenantId,
      objectId: identity.objectId,
      organisationId: connection.organisation_id,
      outcome: "denied",
      errorCode: "identity_binding_conflict",
      eventType: "microsoft_copilot.identity_denied",
    });
    throw new MicrosoftCopilotConnectorError("identity_conflict", "The Microsoft identity binding is not valid.", 403);
  }

  const users = await supabaseSelect<UserRow>(config, "levytate_users", new URLSearchParams({
    select: "id,organisation_id,email,role,active",
    id: `eq.${binding.levytate_user_id}`,
    organisation_id: `eq.${connection.organisation_id}`,
    limit: "2",
  }));
  const user = users[0];
  if (users.length !== 1 || !user?.active) {
    await recordMicrosoftCopilotAudit({
      correlationId,
      tenantId: identity.tenantId,
      objectId: identity.objectId,
      organisationId: connection.organisation_id,
      userId: user?.id,
      outcome: "denied",
      errorCode: "membership_inactive",
      eventType: "microsoft_copilot.identity_denied",
    });
    throw new MicrosoftCopilotConnectorError("membership_inactive", "The bound LevyTate membership is inactive.", 403);
  }
  if (!supportedEmployerRoles.has(user.role as MvpUserRole) || user.role === "Platform Admin") {
    await recordMicrosoftCopilotAudit({
      correlationId,
      tenantId: identity.tenantId,
      objectId: identity.objectId,
      organisationId: connection.organisation_id,
      userId: user.id,
      outcome: "denied",
      errorCode: "role_not_supported",
      eventType: "microsoft_copilot.identity_denied",
    });
    throw new MicrosoftCopilotConnectorError("role_not_supported", "This LevyTate role cannot use the employer connector.", 403);
  }
  const organisations = await supabaseSelect<OrganisationRow>(config, "levytate_organisations", new URLSearchParams({
    select: "id,name",
    id: `eq.${connection.organisation_id}`,
    limit: "1",
  }));
  if (!organisations[0]) {
    await recordMicrosoftCopilotAudit({
      correlationId,
      tenantId: identity.tenantId,
      objectId: identity.objectId,
      organisationId: connection.organisation_id,
      userId: user.id,
      outcome: "denied",
      errorCode: "workspace_not_found",
      eventType: "microsoft_copilot.identity_denied",
    });
    throw new MicrosoftCopilotConnectorError("tenant_not_connected", "The connected workspace was not found.", 403);
  }

  const now = new Date().toISOString();
  await Promise.all([
    supabaseUpdate(config, "levytate_external_identities", `id=eq.${binding.id}`, { last_seen_at: now, updated_at: now }, { prefer: "return=minimal" }),
    supabaseUpdate(config, "levytate_external_tenant_connections", `id=eq.${connection.id}`, { last_successful_activity_at: now, updated_at: now }, { prefer: "return=minimal" }),
  ]);
  return {
    organisationId: connection.organisation_id,
    organisationName: organisations[0].name,
    userId: user.id,
    email: user.email.trim().toLowerCase(),
    role: user.role as MicrosoftCopilotActor["role"],
    tenantId: identity.tenantId,
    objectId: identity.objectId,
    identityId: binding.id,
  };
}

async function createJustInTimeBinding(connection: TenantConnectionRow, identity: VerifiedEntraIdentity, correlationId: string) {
  if (!identity.emailHint) {
    throw new MicrosoftCopilotConnectorError("identity_not_bound", "The Microsoft identity has not been bound to LevyTate.", 403);
  }
  const config = requireSupabase();
  const users = await supabaseSelect<UserRow>(config, "levytate_users", new URLSearchParams({
    select: "id,organisation_id,email,role,active",
    organisation_id: `eq.${connection.organisation_id}`,
    email: `eq.${identity.emailHint}`,
    active: "eq.true",
    limit: "2",
  }));
  if (users.length !== 1) {
    throw new MicrosoftCopilotConnectorError("identity_not_bound", "The Microsoft identity could not be uniquely matched to an active LevyTate user.", 403);
  }
  const user = users[0];
  const conflicts = await supabaseSelect<ExternalIdentityRow>(config, "levytate_external_identities", new URLSearchParams({
    select: "id,organisation_id,levytate_user_id,external_tenant_id,external_object_id,status",
    organisation_id: `eq.${connection.organisation_id}`,
    levytate_user_id: `eq.${user.id}`,
    provider: `eq.${microsoftCopilotProvider}`,
    limit: "2",
  }));
  if (conflicts.length) {
    throw new MicrosoftCopilotConnectorError("identity_conflict", "The LevyTate user is already bound to another Microsoft identity.", 403);
  }
  const now = new Date().toISOString();
  const row = {
    id: randomUUID(),
    organisation_id: connection.organisation_id,
    levytate_user_id: user.id,
    provider: microsoftCopilotProvider,
    external_tenant_id: identity.tenantId,
    external_object_id: identity.objectId,
    email_hint: identity.emailHint,
    status: "active" as const,
    binding_method: "just_in_time",
    first_bound_at: now,
    last_seen_at: now,
    created_at: now,
    updated_at: now,
  };
  const inserted = await supabaseInsert<ExternalIdentityRow>(config, "levytate_external_identities", [row]);
  if (inserted.length !== 1) throw new MicrosoftCopilotConnectorError("identity_conflict", "The Microsoft identity could not be bound safely.", 409);
  await recordMicrosoftCopilotAudit({
    correlationId,
    tenantId: identity.tenantId,
    objectId: identity.objectId,
    organisationId: connection.organisation_id,
    userId: user.id,
    outcome: "allowed",
    eventType: "microsoft_copilot.identity_bound",
  });
  return inserted[0];
}

export async function getMicrosoftCopilotConnectionStatus(organisationId: string): Promise<MicrosoftCopilotConnectionStatus> {
  const config = requireSupabase();
  const [capabilities, connections] = await Promise.all([
    supabaseSelect<CapabilityRow>(config, "levytate_organisation_capabilities", new URLSearchParams({
      select: "microsoft_copilot_enabled",
      organisation_id: `eq.${organisationId}`,
      limit: "1",
    })),
    supabaseSelect<TenantConnectionRow>(config, "levytate_external_tenant_connections", new URLSearchParams({
      select: "id,organisation_id,display_name,status,connected_at,last_successful_activity_at",
      organisation_id: `eq.${organisationId}`,
      provider: `eq.${microsoftCopilotProvider}`,
      limit: "1",
    })),
  ]);
  const connection = connections[0];
  return {
    runtimeEnabled: isMicrosoftCopilotConnectorRuntimeEnabled(),
    organisationEnabled: capabilities[0]?.microsoft_copilot_enabled === true,
    status: connection?.status ?? "not_configured",
    displayName: connection?.display_name ?? "",
    connectedAt: connection?.connected_at ?? null,
    lastSuccessfulActivityAt: connection?.last_successful_activity_at ?? null,
  };
}

export async function recordMicrosoftCopilotAudit(input: {
  correlationId: string;
  eventType: string;
  outcome: MicrosoftCopilotAuditOutcome;
  actor?: MicrosoftCopilotActor;
  organisationId?: string;
  userId?: string;
  tenantId?: string;
  objectId?: string;
  toolName?: MicrosoftCopilotToolName;
  errorCode?: string;
  resultCount?: number;
  durationMs?: number;
}) {
  const correlationId = uuidPattern.test(input.correlationId) ? input.correlationId : randomUUID();
  await supabaseInsert(requireSupabase(), "levytate_external_connector_events", [{
    id: randomUUID(),
    organisation_id: input.actor?.organisationId ?? input.organisationId ?? null,
    levytate_user_id: input.actor?.userId ?? input.userId ?? null,
    provider: microsoftCopilotProvider,
    external_tenant_id: input.actor?.tenantId ?? input.tenantId ?? "",
    external_object_id: input.actor?.objectId ?? input.objectId ?? "",
    correlation_id: correlationId,
    event_type: input.eventType,
    tool_name: input.toolName ?? null,
    outcome: input.outcome,
    error_code: input.errorCode ?? null,
    result_count: input.resultCount ?? null,
    duration_ms: Math.max(0, Math.round(input.durationMs ?? 0)),
    created_at: new Date().toISOString(),
  }], { prefer: "return=minimal" });
}

function requiredGuidClaim(payload: JWTPayload, name: "tid" | "oid") {
  const value = payload[name];
  if (typeof value !== "string" || !uuidPattern.test(value)) throw new Error(`Invalid ${name} claim.`);
  return value;
}

function emailHintFromClaims(payload: JWTPayload) {
  for (const name of ["email", "preferred_username", "upn"] as const) {
    const value = payload[name];
    if (typeof value !== "string") continue;
    const normalised = value.trim().toLowerCase();
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalised) && normalised.length <= 320) return normalised;
  }
  return "";
}

function audienceUrl(audience: string) {
  try { return new URL(audience); }
  catch { return undefined; }
}

function requireSupabase() {
  const config = getLevyTateSupabaseConfig();
  if (!config) throw new MicrosoftCopilotConnectorError("configuration_unavailable", "Connector persistence is unavailable.", 503);
  return config;
}
