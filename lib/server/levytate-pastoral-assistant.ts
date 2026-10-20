import { createHmac } from "node:crypto";
import { z } from "zod";
import type { LevyTateBetaSession } from "@/lib/levytate/config/beta-access";
import { levyTateAiEnabled, levyTateAiModel } from "@/lib/levytate/ai/openai";
import {
  pastoralPolicyVersion,
  pastoralTopicCategories,
  type PastoralAssistantRequest,
  type PastoralAssistantResponse,
  type PastoralConversationMessage,
  type PastoralSupportRequestDraft,
} from "@/lib/levytate/pastoral/domain";
import {
  assertSafePastoralModelReply,
  classifyPastoralSafety,
  classifyPastoralTopic,
  immediateRiskResponse,
  isExplicitPastoralDraftRequest,
  pastoralSystemPrompt,
} from "@/lib/levytate/pastoral/policy";
import {
  findPersistedAssistantReply,
  getEmployeePastoralAssistantContext,
  LevyTatePastoralError,
  persistPastoralExchange,
} from "@/lib/server/levytate-pastoral";
import { getLevyTateSupabaseConfig, readRuntimeEnv, supabaseFetchJson } from "@/lib/server/levytate-supabase";

const pastoralDraftOutput = z.object({
  topicCategory: z.enum(pastoralTopicCategories),
  topic: z.string().max(180),
  whatIWantYouToUnderstand: z.string().max(2500),
  howItIsAffectingMe: z.string().max(1800),
  supportIWant: z.string().max(1800),
  preferredContactMethod: z.enum(["in_platform", "email", "phone", "meeting", "provider_route"]),
  sharingRestrictions: z.string().max(1000),
  employeeReportedFacts: z.array(z.string().min(1).max(300)).max(12),
  aiSuggestions: z.array(z.string().min(1).max(300)).max(8),
}).strict();

const pastoralModelOutput = z.object({
  reply: z.string().min(20).max(2400),
  supportOffer: z.boolean(),
  urgencyRoute: z.enum(["standard", "prompt_human_support", "emergency_guidance"]),
  suggestedTopicCategory: z.enum(pastoralTopicCategories),
  supportRequestDraft: pastoralDraftOutput.nullable(),
}).strict();

export async function runPastoralAssistant(session: LevyTateBetaSession, input: unknown): Promise<PastoralAssistantResponse> {
  const request = parseRequest(input);
  const prepared = await getEmployeePastoralAssistantContext(session, request.conversationId);
  const replay = await findPersistedAssistantReply(prepared.context, request.conversationId, request.clientMessageId);
  if (replay) return replay.response
    ? { ...replay.response, conversationId: replay.conversationId }
    : responseView(replay.message.content, replay.conversationId, request.message, prepared.recipients.length > 0);
  await consumeRateLimit(prepared.context.organisation.id, prepared.context.user.id);
  const safety = classifyPastoralSafety(request.message);
  if (safety === "emergency_guidance") {
    const reply = immediateRiskResponse();
    const conversationId = await persistPastoralExchange({
      context: prepared.context,
      preference: prepared.preference,
      conversation: prepared.conversation,
      clientMessageId: request.clientMessageId,
      employeeMessage: request.message,
      assistantMessage: reply,
      assistantResponse: {
        reply,
        source: "safety_policy",
        supportOffer: prepared.recipients.length > 0,
        urgencyRoute: "emergency_guidance",
        suggestedTopicCategory: classifyPastoralTopic(request.message),
        humanSupportAvailable: prepared.recipients.length > 0,
        policyVersion: pastoralPolicyVersion,
        supportRequestDraft: null,
      },
    });
    return {
      reply,
      source: "safety_policy",
      conversationId,
      supportOffer: prepared.recipients.length > 0,
      urgencyRoute: "emergency_guidance",
      suggestedTopicCategory: classifyPastoralTopic(request.message),
      humanSupportAvailable: prepared.recipients.length > 0,
      policyVersion: pastoralPolicyVersion,
      supportRequestDraft: null,
    };
  }
  if (!levyTateAiEnabled() || !readRuntimeEnv("OPENAI_API_KEY")) {
    throw new LevyTatePastoralError("The AI conversation is temporarily unavailable. You can still request support from an approved person below.", 503);
  }

  const history = prepared.conversation
    ? prepared.messages.slice(-8)
    : boundedClientHistory(request.recentMessages);
  const draftRequested = request.draftSupportRequest === true || isExplicitPastoralDraftRequest(request.message);
  const modelOutput = await callPastoralModel({
    message: request.message,
    history,
    learnerContext: prepared.learnerContext,
    recipientAvailable: prepared.recipients.length > 0,
    safety,
    draftRequested,
  });
  const parsed = pastoralModelOutput.safeParse(modelOutput);
  if (!parsed.success || !assertSafePastoralModelReply(parsed.data?.reply ?? "")) {
    throw new LevyTatePastoralError("My Support could not prepare a safe response. You can continue later or request support from an approved person.", 503);
  }
  if (draftRequested && !parsed.data.supportRequestDraft) {
    throw new LevyTatePastoralError("My Support could not prepare a reliable draft. Your conversation is unchanged; you can try again or prepare the request yourself.", 503);
  }
  if (parsed.data.urgencyRoute === "emergency_guidance") {
    const reply = immediateRiskResponse();
    const assistantResponse: Omit<PastoralAssistantResponse, "conversationId"> = {
      reply,
      source: "safety_policy",
      supportOffer: prepared.recipients.length > 0,
      urgencyRoute: "emergency_guidance",
      suggestedTopicCategory: parsed.data.suggestedTopicCategory,
      humanSupportAvailable: prepared.recipients.length > 0,
      policyVersion: pastoralPolicyVersion,
      supportRequestDraft: null,
    };
    const conversationId = await persistPastoralExchange({
      context: prepared.context, preference: prepared.preference, conversation: prepared.conversation,
      clientMessageId: request.clientMessageId, employeeMessage: request.message,
      assistantMessage: reply, assistantResponse,
    });
    return { ...assistantResponse, conversationId };
  }
  const urgencyRoute = safety === "prompt_human_support" ? "prompt_human_support" : parsed.data.urgencyRoute;
  const supportRequestDraft = draftRequested && parsed.data.supportRequestDraft
    ? normaliseSupportRequestDraft(parsed.data.supportRequestDraft, urgencyRoute)
    : null;
  const assistantResponse: Omit<PastoralAssistantResponse, "conversationId"> = {
    reply: parsed.data.reply,
    source: "openai",
    supportOffer: prepared.recipients.length > 0 && (parsed.data.supportOffer || urgencyRoute !== "standard" || Boolean(supportRequestDraft)),
    urgencyRoute,
    suggestedTopicCategory: parsed.data.suggestedTopicCategory,
    humanSupportAvailable: prepared.recipients.length > 0,
    policyVersion: pastoralPolicyVersion,
    supportRequestDraft,
  };
  const conversationId = await persistPastoralExchange({
    context: prepared.context,
    preference: prepared.preference,
    conversation: prepared.conversation,
    clientMessageId: request.clientMessageId,
    employeeMessage: request.message,
    assistantMessage: parsed.data.reply,
    assistantResponse,
  });
  return { ...assistantResponse, conversationId };
}

async function callPastoralModel(input: {
  message: string;
  history: PastoralConversationMessage[];
  learnerContext: unknown;
  recipientAvailable: boolean;
  safety: "standard" | "prompt_human_support";
  draftRequested: boolean;
}) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${readRuntimeEnv("OPENAI_API_KEY")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: levyTateAiModel(),
      store: false,
      input: [
        { role: "system", content: pastoralSystemPrompt },
        {
          role: "user",
          content: JSON.stringify({
            latestEmployeeMessage: input.message,
            boundedRecentConversation: input.history.map((message) => ({ author: message.author, content: message.content })),
            employeeVisibleApprenticeshipContext: input.learnerContext,
            approvedHumanSupportAvailable: input.recipientAvailable,
            deterministicSafetyRoute: input.safety,
            draftSupportRequest: input.draftRequested,
            draftInstruction: input.draftRequested
              ? "Prepare the separate structured draft from employee-reported information only. Put non-factual ideas only in aiSuggestions."
              : "Return supportRequestDraft as null.",
          }),
        },
      ],
      text: { format: { type: "json_schema", name: "levytate_pastoral_support", strict: true, schema: outputSchema() } },
      max_output_tokens: 1200,
    }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new LevyTatePastoralError("The AI conversation is temporarily unavailable. You can still request support from an approved person below.", 503);
  const output = extractOutputText(await response.json());
  if (!output) throw new LevyTatePastoralError("The AI conversation is temporarily unavailable. You can still request support from an approved person below.", 503);
  try {
    return JSON.parse(output) as unknown;
  } catch {
    throw new LevyTatePastoralError("My Support could not prepare a safe response. You can still request human support.", 503);
  }
}

async function consumeRateLimit(organisationId: string, userId: string) {
  const config = getLevyTateSupabaseConfig();
  if (!config) throw new LevyTatePastoralError("My Support is temporarily unavailable.", 503);
  const secret = readRuntimeEnv("LEVYTATE_PASTORAL_SUPPORT_RATE_LIMIT_SECRET");
  if (secret.length < 32) throw new LevyTatePastoralError("My Support is temporarily unavailable.", 503);
  const keyHash = createHmac("sha256", secret).update(`${organisationId}:${userId}`).digest("hex");
  const rows = await supabaseFetchJson<Array<{ allowed: boolean; remaining: number; reset_at: string }>>(config, "rpc/levytate_consume_pastoral_rate_limit", {
    method: "POST",
    body: JSON.stringify({
      p_environment_namespace: process.env.VERCEL_ENV === "preview" ? "preview" : "local",
      p_action: "pastoral_assistant",
      p_key_hash: keyHash,
      p_window_seconds: 600,
      p_limit: 12,
      p_now: new Date().toISOString(),
    }),
  });
  if (!rows[0]?.allowed) throw new LevyTatePastoralError("You’ve reached the short-term My Support message limit. Please pause before trying again, or use the human support option.", 429);
}

function parseRequest(value: unknown): PastoralAssistantRequest {
  if (!value || typeof value !== "object") throw new LevyTatePastoralError("A valid message is required.");
  const item = value as Record<string, unknown>;
  const message = bounded(item.message, 3000);
  if (!message) throw new LevyTatePastoralError("Tell My Support what would help today.");
  const clientMessageId = String(item.clientMessageId ?? "").trim();
  if (!/^[a-zA-Z0-9:_-]{8,96}$/.test(clientMessageId)) throw new LevyTatePastoralError("A valid message identifier is required.");
  const conversationId = item.conversationId == null ? null : String(item.conversationId);
  if (conversationId && !/^[0-9a-f-]{36}$/i.test(conversationId)) throw new LevyTatePastoralError("The saved conversation identifier is invalid.");
  return {
    message,
    clientMessageId,
    conversationId,
    recentMessages: Array.isArray(item.recentMessages) ? item.recentMessages as PastoralAssistantRequest["recentMessages"] : [],
    draftSupportRequest: item.draftSupportRequest === true,
  };
}

function boundedClientHistory(value: PastoralAssistantRequest["recentMessages"]): PastoralConversationMessage[] {
  if (!Array.isArray(value)) return [];
  return value.slice(-8).flatMap((entry, index) => {
    if (!entry || (entry.author !== "employee" && entry.author !== "assistant")) return [];
    const content = bounded(entry.content, 3000);
    return content ? [{ id: `active-${index}`, author: entry.author, content, createdAt: "" }] : [];
  });
}

function responseView(reply: string, conversationId: string, message: string, humanSupportAvailable: boolean): PastoralAssistantResponse {
  const urgencyRoute = classifyPastoralSafety(message);
  return {
    reply,
    source: urgencyRoute === "emergency_guidance" ? "safety_policy" : "openai",
    conversationId,
    supportOffer: humanSupportAvailable && urgencyRoute !== "standard",
    urgencyRoute,
    suggestedTopicCategory: classifyPastoralTopic(message),
    humanSupportAvailable,
    policyVersion: pastoralPolicyVersion,
    supportRequestDraft: null,
  };
}

function outputSchema() {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      reply: { type: "string" },
      supportOffer: { type: "boolean" },
      urgencyRoute: { type: "string", enum: ["standard", "prompt_human_support", "emergency_guidance"] },
      suggestedTopicCategory: { type: "string", enum: pastoralTopicCategories },
      supportRequestDraft: {
        anyOf: [
          { type: "null" },
          {
            type: "object",
            additionalProperties: false,
            properties: {
              topicCategory: { type: "string", enum: pastoralTopicCategories },
              topic: { type: "string" },
              whatIWantYouToUnderstand: { type: "string" },
              howItIsAffectingMe: { type: "string" },
              supportIWant: { type: "string" },
              preferredContactMethod: { type: "string", enum: ["in_platform", "email", "phone", "meeting", "provider_route"] },
              sharingRestrictions: { type: "string" },
              employeeReportedFacts: { type: "array", items: { type: "string" }, maxItems: 12 },
              aiSuggestions: { type: "array", items: { type: "string" }, maxItems: 8 },
            },
            required: ["topicCategory", "topic", "whatIWantYouToUnderstand", "howItIsAffectingMe", "supportIWant", "preferredContactMethod", "sharingRestrictions", "employeeReportedFacts", "aiSuggestions"],
          },
        ],
      },
    },
    required: ["reply", "supportOffer", "urgencyRoute", "suggestedTopicCategory", "supportRequestDraft"],
  };
}

function extractOutputText(payload: unknown) {
  if (!payload || typeof payload !== "object") return "";
  const item = payload as { output_text?: string; output?: Array<{ content?: Array<{ type?: string; text?: string }> }> };
  if (typeof item.output_text === "string") return item.output_text.trim();
  return item.output?.flatMap((entry) => entry.content ?? []).filter((entry) => entry.type === "output_text").map((entry) => entry.text?.trim()).filter(Boolean).join("\n") ?? "";
}

function bounded(value: unknown, max: number) { return String(value ?? "").trim().slice(0, max); }

function normaliseSupportRequestDraft(
  value: z.infer<typeof pastoralDraftOutput>,
  urgencyRoute: PastoralAssistantResponse["urgencyRoute"],
): PastoralSupportRequestDraft {
  return {
    topicCategory: value.topicCategory,
    topic: bounded(value.topic, 180),
    whatIWantYouToUnderstand: bounded(value.whatIWantYouToUnderstand, 2500),
    howItIsAffectingMe: bounded(value.howItIsAffectingMe, 1800),
    supportIWant: bounded(value.supportIWant, 1800),
    preferredContactMethod: value.preferredContactMethod,
    sharingRestrictions: bounded(value.sharingRestrictions, 1000),
    urgencyRoute,
    employeeReportedFacts: value.employeeReportedFacts.map((item) => bounded(item, 300)).filter(Boolean),
    aiSuggestions: value.aiSuggestions.map((item) => bounded(item, 300)).filter(Boolean),
  };
}
