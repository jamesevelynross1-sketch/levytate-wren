import { MicrosoftCopilotConnectorError } from "@/lib/levytate/microsoft-copilot";
import { readRuntimeEnv } from "@/lib/server/levytate-supabase";

export type MicrosoftCopilotConnectorConfig = {
  enabled: boolean;
  audience: string;
  allowedClientId: string;
  clientId: string;
  mcpBaseUrl: URL;
  appBaseUrl: URL;
  issuerBaseUrl: URL;
  requiredScope: string;
};

const guidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isMicrosoftCopilotConnectorRuntimeEnabled() {
  return readRuntimeEnv("LEVYTATE_MICROSOFT_COPILOT_ENABLED").toLowerCase() === "true";
}

export function getMicrosoftCopilotConnectorConfig(): MicrosoftCopilotConnectorConfig {
  const audience = readRuntimeEnv("LEVYTATE_ENTRA_AUDIENCE");
  const allowedClientId = readRuntimeEnv("LEVYTATE_ENTRA_ALLOWED_CLIENT_ID");
  const clientId = readRuntimeEnv("LEVYTATE_ENTRA_CLIENT_ID");
  const requiredScope = readRuntimeEnv("LEVYTATE_ENTRA_REQUIRED_SCOPE") || "LevyTate.Read";
  const issuerBaseValue = readRuntimeEnv("LEVYTATE_ENTRA_ISSUER_BASE_URL") || "https://login.microsoftonline.com";
  if (
    !guidPattern.test(audience)
    || !guidPattern.test(clientId)
    || audience.toLowerCase() !== clientId.toLowerCase()
    || (allowedClientId && !guidPattern.test(allowedClientId))
    || !isValidScopeName(requiredScope)
  ) {
    throw new MicrosoftCopilotConnectorError(
      "configuration_unavailable",
      "The Microsoft 365 Copilot connector is not configured.",
      503,
    );
  }

  let issuerBaseUrl: URL;
  try {
    issuerBaseUrl = new URL(issuerBaseValue);
  } catch {
    throw new MicrosoftCopilotConnectorError(
      "configuration_unavailable",
      "The Microsoft 365 Copilot connector URL configuration is invalid.",
      503,
    );
  }
  if (issuerBaseUrl.protocol !== "https:") {
    throw new MicrosoftCopilotConnectorError("configuration_unavailable", "The Entra issuer must use HTTPS.", 503);
  }

  return {
    enabled: isMicrosoftCopilotConnectorRuntimeEnabled(),
    audience,
    allowedClientId,
    clientId,
    mcpBaseUrl: getMicrosoftCopilotConnectorBaseUrl(),
    appBaseUrl: getMicrosoftCopilotAppBaseUrl(),
    issuerBaseUrl,
    requiredScope,
  };
}

export function getMicrosoftCopilotConnectorBaseUrl() {
  return configuredOrigin("LEVYTATE_MCP_BASE_URL");
}

export function getMicrosoftCopilotAppBaseUrl() {
  return configuredOrigin("LEVYTATE_APP_BASE_URL");
}

export function microsoftCopilotCanonicalUrl(path: string, query?: Record<string, string | undefined>) {
  const appBaseUrl = getMicrosoftCopilotAppBaseUrl();
  let url = new URL("/levytate/app", appBaseUrl);
  if (path.startsWith("/") && !path.startsWith("//")) {
    const candidate = new URL(path, appBaseUrl);
    if (candidate.origin === appBaseUrl.origin && candidate.pathname.startsWith("/levytate/")) url = candidate;
  }
  Object.entries(query ?? {}).forEach(([key, value]) => {
    if (value) url.searchParams.set(key, value);
  });
  return url.toString();
}

function configuredOrigin(name: "LEVYTATE_MCP_BASE_URL" | "LEVYTATE_APP_BASE_URL") {
  const value = readRuntimeEnv(name);
  if (!value) {
    throw new MicrosoftCopilotConnectorError(
      "configuration_unavailable",
      "The Microsoft 365 Copilot connector is not configured.",
      503,
    );
  }
  try {
    const baseUrl = new URL(value);
    const suppliedPath = baseUrl.pathname.replace(/\/+$/, "");
    if (
      (process.env.NODE_ENV === "production" && baseUrl.protocol !== "https:")
      || !["http:", "https:"].includes(baseUrl.protocol)
      || baseUrl.username
      || baseUrl.password
      || baseUrl.search
      || baseUrl.hash
      || suppliedPath
    ) {
      throw new Error("A clean HTTP(S) origin is required.");
    }
    return new URL(baseUrl.origin);
  } catch {
    throw new MicrosoftCopilotConnectorError(
      "configuration_unavailable",
      "The Microsoft 365 Copilot connector URL configuration is invalid.",
      503,
    );
  }
}

function isValidScopeName(value: string) {
  return /^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/.test(value);
}
