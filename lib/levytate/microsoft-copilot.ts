import type { MvpUserRole } from "@/lib/levytate/mvp/rbac";

export const microsoftCopilotProvider = "microsoft_entra" as const;
export const microsoftCopilotToolNames = [
  "get_operations_brief",
  "list_autopilot_signals",
  "list_upcoming_reviews",
  "list_operational_actions",
  "get_learner_summary",
  "list_applications",
  "get_levy_summary",
  "list_my_providers",
  "list_my_programmes",
  "get_provider_summary",
] as const;

export type MicrosoftCopilotToolName = (typeof microsoftCopilotToolNames)[number];

export type MicrosoftCopilotActor = {
  organisationId: string;
  organisationName: string;
  userId: string;
  email: string;
  role: Exclude<MvpUserRole, "Platform Admin">;
  tenantId: string;
  objectId: string;
  identityId: string;
};

export type MicrosoftCopilotAuditOutcome = "allowed" | "denied" | "error";

export type MicrosoftCopilotConnectionStatus = {
  runtimeEnabled: boolean;
  organisationEnabled: boolean;
  status: "not_configured" | "inactive" | "active" | "suspended";
  displayName: string;
  connectedAt: string | null;
  lastSuccessfulActivityAt: string | null;
};

export class MicrosoftCopilotConnectorError extends Error {
  constructor(
    public readonly code:
      | "configuration_unavailable"
      | "connector_disabled"
      | "invalid_token"
      | "tenant_not_connected"
      | "identity_not_bound"
      | "identity_conflict"
      | "membership_inactive"
      | "role_not_supported"
      | "permission_denied"
      | "not_found"
      | "rate_limited"
      | "invalid_request",
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "MicrosoftCopilotConnectorError";
  }
}

export function isMicrosoftCopilotToolName(value: string): value is MicrosoftCopilotToolName {
  return (microsoftCopilotToolNames as readonly string[]).includes(value);
}
