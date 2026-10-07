import { randomUUID } from "node:crypto";
import { hostHeaderValidationResponse, originValidationResponse } from "@modelcontextprotocol/server";
import { MicrosoftCopilotConnectorError } from "@/lib/levytate/microsoft-copilot";
import {
  checkMicrosoftCopilotPreAuthenticationLimit,
  checkMicrosoftCopilotRequestLimits,
} from "@/lib/server/levytate-auth-rate-limit";
import {
  getMicrosoftCopilotConnectorBaseUrl,
  isMicrosoftCopilotConnectorRuntimeEnabled,
} from "@/lib/server/levytate-microsoft-copilot-config";
import {
  authenticateMicrosoftCopilotRequest,
  recordMicrosoftCopilotAudit,
} from "@/lib/server/levytate-microsoft-copilot-identity";
import { microsoftCopilotMcpHandler } from "@/lib/server/levytate-microsoft-copilot-mcp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(request: Request) {
  const correlationId = request.headers.get("x-correlation-id")?.match(/^[0-9a-f-]{36}$/i)?.[0] ?? randomUUID();
  try {
    if (!isMicrosoftCopilotConnectorRuntimeEnabled()) {
      throw new MicrosoftCopilotConnectorError("connector_disabled", "The connector is disabled.", 404);
    }
    const baseUrl = getMicrosoftCopilotConnectorBaseUrl();
    const allowedHosts = process.env.NODE_ENV === "production"
      ? [baseUrl.hostname]
      : [baseUrl.hostname, "localhost", "127.0.0.1"];
    const hostRejected = hostHeaderValidationResponse(request, allowedHosts);
    if (hostRejected) return secureResponse(hostRejected, correlationId);
    const originRejected = originValidationResponse(request, [
      baseUrl.hostname,
      "teams.microsoft.com",
      "m365.cloud.microsoft",
      "copilot.microsoft.com",
    ]);
    if (originRejected) return secureResponse(originRejected, correlationId);

    const preAuthenticationLimit = await checkMicrosoftCopilotPreAuthenticationLimit(request);
    if (!preAuthenticationLimit.allowed) {
      await recordMicrosoftCopilotAudit({
        correlationId,
        eventType: "microsoft_copilot.authentication_denied",
        outcome: "denied",
        errorCode: "rate_limited",
      });
      throw new MicrosoftCopilotConnectorError("rate_limited", "Too many connector requests. Try again later.", 429);
    }

    const { authInfo } = await authenticateMicrosoftCopilotRequest(request, correlationId, async (identity) => {
      const rateLimit = await checkMicrosoftCopilotRequestLimits(request, identity.tenantId, identity.objectId);
      if (rateLimit.allowed) return;
      await recordMicrosoftCopilotAudit({
        correlationId,
        tenantId: identity.tenantId,
        objectId: identity.objectId,
        eventType: "microsoft_copilot.request_denied",
        outcome: "denied",
        errorCode: "rate_limited",
      });
      throw new MicrosoftCopilotConnectorError("rate_limited", "Too many connector requests. Try again later.", 429);
    });
    authInfo.extra = { ...authInfo.extra, correlationId };
    return secureResponse(await microsoftCopilotMcpHandler.fetch(request, { authInfo }), correlationId);
  } catch (error) {
    const safe = error instanceof MicrosoftCopilotConnectorError
      ? error
      : new MicrosoftCopilotConnectorError("configuration_unavailable", "The connector is temporarily unavailable.", 503);
    return secureJson({ error: { code: safe.code, message: safe.message, correlationId } }, safe.status, correlationId, safe.status === 401);
  }
}

export function GET() { return methodNotAllowed(); }
export function DELETE() { return methodNotAllowed(); }
export function PUT() { return methodNotAllowed(); }
export function PATCH() { return methodNotAllowed(); }

function methodNotAllowed() {
  return new Response("Method not allowed.", {
    status: 405,
    headers: { Allow: "POST", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
  });
}

function secureJson(body: unknown, status: number, correlationId: string, challenge = false) {
  const headers = new Headers({
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store, max-age=0",
    Pragma: "no-cache",
    "X-Content-Type-Options": "nosniff",
    "X-LevyTate-Correlation-Id": correlationId,
  });
  if (challenge) headers.set("WWW-Authenticate", 'Bearer realm="LevyTate MCP"');
  return new Response(JSON.stringify(body), { status, headers });
}

function secureResponse(response: Response, correlationId: string) {
  const headers = new Headers(response.headers);
  headers.delete("set-cookie");
  headers.set("Cache-Control", "no-store, max-age=0");
  headers.set("Pragma", "no-cache");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-LevyTate-Correlation-Id", correlationId);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
