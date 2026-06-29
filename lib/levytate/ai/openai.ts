import type { LevyTateAiRequest } from "@/lib/levytate/ai/types";

export type LevyTateGeneratedGuidance = {
  assistantMessage: string | null;
  followUpQuestion: string | null;
  quickReplies: string[];
  recommendedPathwayTitles: string[];
  safetyNotes: string[];
  managerMessageDraft: string | null;
};

export function levyTateAiEnabled() {
  if (process.env.LEVYTATE_AI_ENABLED === "true") return true;
  if (process.env.LEVYTATE_AI_ENABLED === "false") return false;
  return Boolean(process.env.OPENAI_API_KEY);
}

export function levyTateAiModel() {
  return process.env.LEVYTATE_AI_MODEL?.trim() || "gpt-5.4-mini";
}

function outputSchema() {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      assistantMessage: { type: "string" },
      followUpQuestion: { type: "string" },
      quickReplies: { type: "array", items: { type: "string" } },
      recommendedPathwayTitles: { type: "array", items: { type: "string" } },
      safetyNotes: { type: "array", items: { type: "string" } },
      managerMessageDraft: { type: "string" },
    },
    required: [
      "assistantMessage",
      "followUpQuestion",
      "quickReplies",
      "recommendedPathwayTitles",
      "safetyNotes",
      "managerMessageDraft",
    ],
  };
}

function extractOutputText(payload: unknown) {
  if (!payload || typeof payload !== "object") return "";
  const candidate = payload as {
    output_text?: string;
    output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
  };

  if (typeof candidate.output_text === "string" && candidate.output_text.trim()) return candidate.output_text.trim();

  return candidate.output
    ?.flatMap((item) => item.content ?? [])
    .filter((item) => item.type === "output_text" && typeof item.text === "string")
    .map((item) => item.text?.trim())
    .filter(Boolean)
    .join("\n") ?? "";
}

function cleanStringArray(value: unknown, limit: number) {
  return Array.isArray(value)
    ? value
        .filter((item): item is string => typeof item === "string" && Boolean(item.trim()))
        .map((item) => item.trim())
        .slice(0, limit)
    : [];
}

function parseGeneratedGuidance(raw: string): LevyTateGeneratedGuidance {
  const parsed = JSON.parse(raw) as Record<string, unknown>;
  return {
    assistantMessage: typeof parsed.assistantMessage === "string" && parsed.assistantMessage.trim() ? parsed.assistantMessage.trim() : null,
    followUpQuestion: typeof parsed.followUpQuestion === "string" && parsed.followUpQuestion.trim() ? parsed.followUpQuestion.trim() : null,
    quickReplies: cleanStringArray(parsed.quickReplies, 4),
    recommendedPathwayTitles: cleanStringArray(parsed.recommendedPathwayTitles, 5),
    safetyNotes: cleanStringArray(parsed.safetyNotes, 5),
    managerMessageDraft: typeof parsed.managerMessageDraft === "string" && parsed.managerMessageDraft.trim() ? parsed.managerMessageDraft.trim() : null,
  };
}

export async function requestLevyTateOpenAI({
  request,
  systemPrompt,
  userPrompt,
}: {
  request: LevyTateAiRequest;
  systemPrompt: string;
  userPrompt: string;
}) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured.");

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: levyTateAiModel(),
      input: [
        { role: "system", content: [{ type: "input_text", text: systemPrompt }] },
        { role: "user", content: [{ type: "input_text", text: userPrompt }] },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "levytate_role_aware_guidance",
          schema: outputSchema(),
          strict: true,
        },
      },
      max_output_tokens: request.role === "Employee" ? 760 : 620,
    }),
    signal: AbortSignal.timeout(25_000),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`OpenAI Responses API failed with status ${response.status}. ${detail.slice(0, 240)}`);
  }

  const outputText = extractOutputText(await response.json());
  if (!outputText) throw new Error("OpenAI Responses API returned empty output.");

  return parseGeneratedGuidance(outputText);
}
