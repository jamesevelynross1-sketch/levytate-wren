import { MicrosoftCopilotConnectorError } from "@/lib/levytate/microsoft-copilot";
import { readRuntimeEnv } from "@/lib/server/levytate-supabase";

export type MicrosoftCopilotConnectorConfig = {
  enabled: boolean;
  audience: string;
  clientId: string;
  baseUrl: URL;
  issuerBaseUrl: URL;
};

export function isMicrosoftCopilotConnectorRuntimeEnabled() {
  return readRuntimeEnv("LEVYTATE_MICROSOFT_COPILOT_ENABLED").toLowerCase() === "true";
}

export function getMicrosoftCopilotConnectorConfig(): MicrosoftCopilotConnectorConfig {
  const audience = readRuntimeEnv("LEVYTATE_ENTRA_AUDIENCE");
  const clientId = readRuntimeEnv("LEVYTATE_ENTRA_CLIENT_ID");
  const baseUrlValue = readRuntimeEnv("LEVYTATE_MCP_BASE_URL");
  const issuerBaseValue = readRuntimeEnv("LEVYTATE_ENTRA_ISSUER_BASE_URL") || "https://login.microsoftonline.com";
  if (!audience || !clientId || !baseUrlValue) {
    throw new MicrosoftCopilotConnectorError(
      "configuration_unavailable",
      "The Microsoft 365 Copilot connector is not configured.",
      503,
    );
  }

  let baseUrl: URL;
  let issuerBaseUrl: URL;
  try {
    baseUrl = new URL(baseUrlValue);
    issuerBaseUrl = new URL(issuerBaseValue);
  } catch {
    throw new MicrosoftCopilotConnectorError(
      "configuration_unavailable",
      "The Microsoft 365 Copilot connector URL configuration is invalid.",
      503,
    );
  }
  if (process.env.NODE_ENV === "production" && baseUrl.protocol !== "https:") {
    throw new MicrosoftCopilotConnectorError("configuration_unavailable", "The connector requires HTTPS.", 503);
  }
  if (issuerBaseUrl.protocol !== "https:") {
    throw new MicrosoftCopilotConnectorError("configuration_unavailable", "The Entra issuer must use HTTPS.", 503);
  }

  return {
    enabled: isMicrosoftCopilotConnectorRuntimeEnabled(),
    audience,
    clientId,
    baseUrl,
    issuerBaseUrl,
  };
}

export function microsoftCopilotCanonicalUrl(path: string, query?: Record<string, string | undefined>) {
  const baseUrl = getMicrosoftCopilotConnectorConfig().baseUrl;
  const candidate = new URL(path, baseUrl);
  const url = candidate.origin === baseUrl.origin ? candidate : new URL("/levytate/app", baseUrl);
  Object.entries(query ?? {}).forEach(([key, value]) => {
    if (value) url.searchParams.set(key, value);
  });
  return url.toString();
}
