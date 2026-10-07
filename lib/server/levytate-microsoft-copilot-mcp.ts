import { createMcpHandler, McpServer, type CallToolResult, type JSONObject } from "@modelcontextprotocol/server";
import { z } from "zod/v4";
import {
  MicrosoftCopilotConnectorError,
  type MicrosoftCopilotActor,
  type MicrosoftCopilotToolName,
} from "@/lib/levytate/microsoft-copilot";
import { executeMicrosoftCopilotTool } from "@/lib/server/levytate-microsoft-copilot-tools";

const noInput = z.object({}).strict();
const listInput = z.object({ limit: z.number().int().min(1).max(50).optional() }).strict();
const readOnlyAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} as const;

export const microsoftCopilotMcpHandler = createMcpHandler(({ authInfo }) => {
  const actor = authInfo?.extra?.actor as MicrosoftCopilotActor | undefined;
  const correlationId = typeof authInfo?.extra?.correlationId === "string" ? authInfo.extra.correlationId : crypto.randomUUID();
  return createMicrosoftCopilotMcpServer(actor, correlationId);
}, {
  legacy: "stateless",
  responseMode: "auto",
  maxRequestBodySize: 64 * 1024,
});

type MicrosoftCopilotToolExecutor = typeof executeMicrosoftCopilotTool;

export function createMicrosoftCopilotMcpServer(
  actor: MicrosoftCopilotActor | undefined,
  correlationId: string,
  execute: MicrosoftCopilotToolExecutor = executeMicrosoftCopilotTool,
) {
  const server = new McpServer({ name: "LevyTate", version: "1.0.0" }, { capabilities: { tools: {} } });

  register(server, actor, correlationId, execute, "get_operations_brief", {
    title: "Get operations brief",
    description: "Return the caller's current LevyTate operations brief and a link to Operations Centre.",
    inputSchema: noInput,
  });
  register(server, actor, correlationId, execute, "list_autopilot_signals", {
    title: "List Autopilot signals",
    description: "List current deterministic LevyTate Autopilot signals visible to the caller.",
    inputSchema: z.object({
      lane: z.enum(["needs_your_decision", "ready_to_action", "waiting_externally", "upcoming", "recently_resolved"]).optional(),
      priority: z.enum(["action_now", "this_week", "upcoming"]).optional(),
      limit: z.number().int().min(1).max(50).optional(),
    }).strict(),
  });
  register(server, actor, correlationId, execute, "list_upcoming_reviews", {
    title: "List upcoming reviews",
    description: "List upcoming learner reviews within the caller's existing LevyTate scope.",
    inputSchema: z.object({
      days: z.number().int().min(1).max(90).optional(),
      status: z.string().trim().min(1).max(120).optional(),
      limit: z.number().int().min(1).max(50).optional(),
    }).strict(),
  });
  register(server, actor, correlationId, execute, "list_operational_actions", {
    title: "List operational actions",
    description: "List open LevyTate operational actions visible to the caller; Line Managers remain limited to direct reports.",
    inputSchema: z.object({
      status: z.enum(["open", "acknowledged", "in_progress", "completed", "cancelled", "dismissed"]).optional(),
      owner: z.string().trim().min(1).max(120).optional(),
      dueWithinDays: z.number().int().min(1).max(90).optional(),
      limit: z.number().int().min(1).max(50).optional(),
    }).strict(),
  });
  register(server, actor, correlationId, execute, "get_learner_summary", {
    title: "Get learner summary",
    description: "Return a role-scoped learner lifecycle summary from LevyTate.",
    inputSchema: z.object({ learnerRecordId: z.string().trim().min(1).max(120) }).strict(),
  });
  register(server, actor, correlationId, execute, "list_applications", {
    title: "List applications",
    description: "List apprenticeship applications visible to the caller under LevyTate RBAC.",
    inputSchema: z.object({
      status: z.string().trim().min(1).max(120).optional(),
      owner: z.string().trim().min(1).max(120).optional(),
      attentionOnly: z.boolean().optional(),
      limit: z.number().int().min(1).max(50).optional(),
    }).strict(),
  });
  register(server, actor, correlationId, execute, "get_levy_summary", {
    title: "Get levy summary",
    description: "Return organisation levy totals only when the caller has LevyTate Finance read permission.",
    inputSchema: noInput,
  });
  register(server, actor, correlationId, execute, "list_my_providers", {
    title: "List my providers",
    description: "List providers explicitly connected to the caller's organisation and visible under LevyTate RBAC.",
    inputSchema: listInput,
  });
  register(server, actor, correlationId, execute, "list_my_programmes", {
    title: "List my programmes",
    description: "List programmes explicitly selected by the caller's organisation and visible under LevyTate RBAC.",
    inputSchema: listInput,
  });
  register(server, actor, correlationId, execute, "get_provider_summary", {
    title: "Get provider summary",
    description: "Return a factual summary for a provider already in the organisation's provider portfolio.",
    inputSchema: z.object({ providerId: z.string().trim().min(1).max(120) }).strict(),
  });

  return server;
}

function register<T extends z.ZodObject<z.ZodRawShape>>(
  server: McpServer,
  actor: MicrosoftCopilotActor | undefined,
  correlationId: string,
  execute: MicrosoftCopilotToolExecutor,
  toolName: MicrosoftCopilotToolName,
  config: { title: string; description: string; inputSchema: T },
) {
  server.registerTool(toolName, {
    title: config.title,
    description: config.description,
    inputSchema: config.inputSchema.shape as Record<string, z.ZodType>,
    annotations: readOnlyAnnotations,
  }, async (input: Record<string, unknown>): Promise<CallToolResult> => {
    if (!actor) return toolError(new MicrosoftCopilotConnectorError("invalid_token", "An authenticated LevyTate identity is required.", 401), correlationId);
    try {
      const result = await execute({
        actor,
        toolName,
        arguments: input as Record<string, unknown>,
        correlationId,
      });
      return {
        content: [{ type: "text" as const, text: JSON.stringify(result) }],
        structuredContent: result as unknown as JSONObject,
      };
    } catch (error) {
      return toolError(error, correlationId);
    }
  });
}

function toolError(error: unknown, correlationId: string): CallToolResult {
  const safe = error instanceof MicrosoftCopilotConnectorError
    ? error
    : new MicrosoftCopilotConnectorError("configuration_unavailable", "The LevyTate tool is temporarily unavailable.", 503);
  const payload = { error: { code: safe.code, message: safe.message, correlationId } };
  return {
    isError: true as const,
    content: [{ type: "text" as const, text: JSON.stringify(payload) }],
    structuredContent: payload as unknown as JSONObject,
  };
}
