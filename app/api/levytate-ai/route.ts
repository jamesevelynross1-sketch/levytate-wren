import { NextResponse } from "next/server";

import { buildLevyTateAiContext } from "@/lib/levytate-ai/context";
import { buildFallbackResponse } from "@/lib/levytate-ai/fallback";
import { buildLevyTateAiSystemPrompt, buildLevyTateAiUserPrompt } from "@/lib/levytate-ai/prompts";
import { applyLevyTateAiSafety } from "@/lib/levytate-ai/safety";
import { parseLevyTateAiRequest, type LevyTateAiResponse } from "@/lib/levytate-ai/response-schema";

function aiEnabled() {
  if (process.env.LEVYTATE_AI_ENABLED === "true") return true;
  if (process.env.LEVYTATE_AI_ENABLED === "false") return false;
  return Boolean(process.env.OPENAI_API_KEY);
}

function aiModel() {
  return process.env.LEVYTATE_AI_MODEL || "gpt-4.1-mini";
}

function extractOutputText(payload: unknown) {
  if (!payload || typeof payload !== "object") return "";
  const candidate = payload as {
    output_text?: string;
    output?: Array<{
      content?: Array<{
        type?: string;
        text?: string;
      }>;
    }>;
  };

  if (typeof candidate.output_text === "string" && candidate.output_text.trim()) {
    return candidate.output_text.trim();
  }

  const text = candidate.output
    ?.flatMap((item) => item.content ?? [])
    .find((item) => item.type === "output_text" && typeof item.text === "string")
    ?.text;

  return typeof text === "string" ? text.trim() : "";
}

function parseAssistantRewrite(raw: string) {
  try {
    const parsed = JSON.parse(raw) as {
      assistantMessage?: string;
      safetyNotes?: string[];
    };

    return {
      assistantMessage:
        typeof parsed.assistantMessage === "string" && parsed.assistantMessage.trim()
          ? parsed.assistantMessage.trim()
          : null,
      safetyNotes: Array.isArray(parsed.safetyNotes)
        ? parsed.safetyNotes.filter((item): item is string => typeof item === "string" && Boolean(item.trim()))
        : [],
    };
  } catch {
    return {
      assistantMessage: null,
      safetyNotes: [],
    };
  }
}

async function rewriteWithOpenAI(systemPrompt: string, userPrompt: string) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: aiModel(),
      input: [
        {
          role: "system",
          content: [{ type: "input_text", text: systemPrompt }],
        },
        {
          role: "user",
          content: [{ type: "input_text", text: userPrompt }],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "levytate_ai_guidance",
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              assistantMessage: { type: "string" },
              safetyNotes: {
                type: "array",
                items: { type: "string" },
              },
            },
            required: ["assistantMessage", "safetyNotes"],
          },
          strict: true,
        },
      },
      max_output_tokens: 320,
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`OpenAI Responses API failed with status ${response.status}. ${detail.slice(0, 300)}`);
  }

  const payload = await response.json();
  const outputText = extractOutputText(payload);

  if (!outputText) {
    throw new Error("OpenAI Responses API returned empty output.");
  }

  return parseAssistantRewrite(outputText);
}

export async function POST(request: Request) {
  let parsedRequest = null;

  try {
    const body = await request.json();
    const parsed = parseLevyTateAiRequest(body);
    parsedRequest = parsed;

    if (!parsed) {
      return NextResponse.json({ message: "Invalid LevyTate AI request payload." }, { status: 400 });
    }

    const fallback = buildFallbackResponse(parsed);

    if (!aiEnabled()) {
      return NextResponse.json(applyLevyTateAiSafety(parsed, fallback));
    }

    const groundedContext = buildLevyTateAiContext(parsed);
    const rewrite = await rewriteWithOpenAI(
      buildLevyTateAiSystemPrompt(parsed),
      buildLevyTateAiUserPrompt({ request: parsed, groundedContext, fallback }),
    );

    const merged: LevyTateAiResponse = {
      ...fallback,
      source: rewrite.assistantMessage ? "openai" : "mock",
      assistantMessage: rewrite.assistantMessage ?? fallback.assistantMessage,
      safetyNotes: rewrite.safetyNotes.length ? rewrite.safetyNotes : fallback.safetyNotes,
    };

    return NextResponse.json(applyLevyTateAiSafety(parsed, merged));
  } catch (error) {
    console.error("LevyTate AI request failed", { error });

    if (parsedRequest) {
      return NextResponse.json(applyLevyTateAiSafety(parsedRequest, buildFallbackResponse(parsedRequest)));
    }

    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "LevyTate AI request failed.",
      },
      { status: 500 },
    );
  }
}
