import { NextResponse } from "next/server";

import { buildLevyTateAiContext } from "@/lib/levytate-ai/context";
import { buildFallbackResponse } from "@/lib/levytate-ai/fallback";
import { buildLevyTateAiSystemPrompt, buildLevyTateAiUserPrompt } from "@/lib/levytate-ai/prompts";
import { applyLevyTateAiSafety } from "@/lib/levytate-ai/safety";
import {
  parseLevyTateAiRequest,
  type LevyTateAiRequest,
  type LevyTateAiResponse,
  type LevyTateRecommendedPathway,
} from "@/lib/levytate-ai/response-schema";

type RewritePayload = {
  assistantMessage: string | null;
  safetyNotes: string[];
};

type EmployeePayload = RewritePayload & {
  managerMessageDraft: string | null;
  recommendedPathwayTitles: string[];
};

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

function parseRewritePayload(raw: string): RewritePayload {
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

function parseEmployeePayload(raw: string): EmployeePayload {
  try {
    const parsed = JSON.parse(raw) as {
      assistantMessage?: string;
      safetyNotes?: string[];
      recommendedPathwayTitles?: string[];
      managerMessageDraft?: string | null;
    };

    return {
      assistantMessage:
        typeof parsed.assistantMessage === "string" && parsed.assistantMessage.trim()
          ? parsed.assistantMessage.trim()
          : null,
      safetyNotes: Array.isArray(parsed.safetyNotes)
        ? parsed.safetyNotes.filter((item): item is string => typeof item === "string" && Boolean(item.trim()))
        : [],
      recommendedPathwayTitles: Array.isArray(parsed.recommendedPathwayTitles)
        ? parsed.recommendedPathwayTitles.filter((item): item is string => typeof item === "string" && Boolean(item.trim()))
        : [],
      managerMessageDraft:
        typeof parsed.managerMessageDraft === "string" && parsed.managerMessageDraft.trim()
          ? parsed.managerMessageDraft.trim()
          : null,
    };
  } catch {
    return {
      assistantMessage: null,
      safetyNotes: [],
      recommendedPathwayTitles: [],
      managerMessageDraft: null,
    };
  }
}

function outputSchemaFor(role: LevyTateAiRequest["role"]) {
  if (role === "Employee") {
    return {
      type: "object",
      additionalProperties: false,
      properties: {
        assistantMessage: { type: "string" },
        recommendedPathwayTitles: {
          type: "array",
          items: { type: "string" },
        },
        safetyNotes: {
          type: "array",
          items: { type: "string" },
        },
        managerMessageDraft: { type: "string" },
      },
      required: ["assistantMessage", "recommendedPathwayTitles", "safetyNotes", "managerMessageDraft"],
    };
  }

  return {
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
  };
}

async function requestOpenAI(request: LevyTateAiRequest, systemPrompt: string, userPrompt: string) {
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
          schema: outputSchemaFor(request.role),
          strict: true,
        },
      },
      max_output_tokens: request.role === "Employee" ? 640 : 320,
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

  return request.role === "Employee" ? parseEmployeePayload(outputText) : parseRewritePayload(outputText);
}

function mergeSafetyNotes(fallback: string[], generated: string[]) {
  const ordered = [...generated, ...fallback];
  const seen = new Set<string>();
  return ordered.filter((item) => {
    const key = item.trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function mergeEmployeePathways(
  fallbackPathways: LevyTateRecommendedPathway[],
  recommendedTitles: string[],
) {
  const fallbackByTitle = new Map(
    fallbackPathways.map((item) => [item.title.trim().toLowerCase(), item] as const),
  );

  const prioritised = recommendedTitles
    .map((title) => fallbackByTitle.get(title.trim().toLowerCase()))
    .filter((item): item is LevyTateRecommendedPathway => Boolean(item));

  const seen = new Set(prioritised.map((item) => item.title.trim().toLowerCase()));
  const remaining = fallbackPathways.filter((item) => !seen.has(item.title.trim().toLowerCase()));

  return prioritised.length ? [...prioritised, ...remaining] : fallbackPathways;
}

function mergeEmployeeResponse(
  request: LevyTateAiRequest,
  fallback: LevyTateAiResponse,
  generated: EmployeePayload,
): LevyTateAiResponse {
  const activeApplication = request.contextData?.activeApplication ?? null;

  return {
    ...fallback,
    source: generated.assistantMessage ? "openai" : "mock",
    assistantMessage: generated.assistantMessage ?? fallback.assistantMessage,
    recommendedPathways: mergeEmployeePathways(fallback.recommendedPathways, generated.recommendedPathwayTitles),
    safetyNotes: mergeSafetyNotes(fallback.safetyNotes, generated.safetyNotes),
    applicationWarning: activeApplication
      ? "You have one active application in progress, so new submissions are paused. Exploration, comparison and manager conversations are still open."
      : fallback.applicationWarning,
    managerMessageDraft: generated.managerMessageDraft ?? fallback.managerMessageDraft,
  };
}

function mergeRewriteResponse(fallback: LevyTateAiResponse, generated: RewritePayload): LevyTateAiResponse {
  return {
    ...fallback,
    source: generated.assistantMessage ? "openai" : "mock",
    assistantMessage: generated.assistantMessage ?? fallback.assistantMessage,
    safetyNotes: mergeSafetyNotes(fallback.safetyNotes, generated.safetyNotes),
  };
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
    const generated = await requestOpenAI(
      parsed,
      buildLevyTateAiSystemPrompt(parsed),
      buildLevyTateAiUserPrompt({ request: parsed, groundedContext, fallback }),
    );

    const merged =
      parsed.role === "Employee"
        ? mergeEmployeeResponse(parsed, fallback, generated as EmployeePayload)
        : mergeRewriteResponse(fallback, generated as RewritePayload);

    return NextResponse.json(applyLevyTateAiSafety(parsed, merged));
  } catch (error) {
    console.error("LevyTate AI request failed", { error });

    if (parsedRequest) {
      return NextResponse.json(applyLevyTateAiSafety(parsedRequest, buildFallbackResponse(parsedRequest)));
    }

    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "LevyTate AI request failed.",
      },
      { status: 500 },
    );
  }
}
