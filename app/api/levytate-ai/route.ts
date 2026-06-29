import { NextResponse } from "next/server";

import { enforceLevyTateAiActions } from "@/lib/levytate/ai/actions";
import { buildLevyTateAiContext } from "@/lib/levytate/ai/context";
import { buildLevyTateAiFallbackResponse } from "@/lib/levytate/ai/fallbackResponses";
import { levyTateAiEnabled, requestLevyTateOpenAI, type LevyTateGeneratedGuidance } from "@/lib/levytate/ai/openai";
import { buildLevyTateAiSystemPrompt, buildLevyTateAiUserPrompt } from "@/lib/levytate/ai/prompts";
import {
  parseLevyTateAiRequest,
  type LevyTateAiRequest,
  type LevyTateAiResponse,
  type LevyTateRecommendedPathway,
} from "@/lib/levytate/ai/types";
import { applyLevyTateAiSafety } from "@/lib/levytate-ai/safety";

const requestWindowMs = 5 * 60 * 1000;
const duplicateWindowMs = 1_500;
const maxRequestsPerWindow = 24;
const requestBuckets = new Map<string, { count: number; startedAt: number; lastMessage: string; lastRequestAt: number }>();

function rateLimitKey(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
}

function isRateLimited(key: string, message: string) {
  const now = Date.now();
  const normalisedMessage = message.trim().toLowerCase().slice(0, 240);
  const existing = requestBuckets.get(key);

  if (!existing || now - existing.startedAt >= requestWindowMs) {
    requestBuckets.set(key, { count: 1, startedAt: now, lastMessage: normalisedMessage, lastRequestAt: now });
    return false;
  }

  if (existing.lastMessage === normalisedMessage && now - existing.lastRequestAt < duplicateWindowMs) return true;

  existing.count += 1;
  existing.lastMessage = normalisedMessage;
  existing.lastRequestAt = now;
  requestBuckets.set(key, existing);
  return existing.count > maxRequestsPerWindow;
}

function mergeSafetyNotes(fallback: string[], generated: string[]) {
  const seen = new Set<string>();
  return [...generated, ...fallback].filter((item) => {
    const key = item.trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 6);
}

function mergePathways(fallback: LevyTateRecommendedPathway[], titles: string[]) {
  const byTitle = new Map(fallback.map((item) => [item.title.trim().toLowerCase(), item] as const));
  const prioritised = titles
    .map((title) => byTitle.get(title.trim().toLowerCase()))
    .filter((item): item is LevyTateRecommendedPathway => Boolean(item));
  const seen = new Set(prioritised.map((item) => item.title.trim().toLowerCase()));
  return [...prioritised, ...fallback.filter((item) => !seen.has(item.title.trim().toLowerCase()))];
}

function mergeGeneratedGuidance(fallback: LevyTateAiResponse, generated: LevyTateGeneratedGuidance): LevyTateAiResponse {
  return {
    ...fallback,
    source: generated.assistantMessage ? "openai" : "mock",
    assistantMessage: generated.assistantMessage ?? fallback.assistantMessage,
    followUpQuestion: generated.followUpQuestion ?? fallback.followUpQuestion ?? null,
    quickReplies: generated.quickReplies.length ? generated.quickReplies : fallback.quickReplies,
    recommendedPathways: mergePathways(fallback.recommendedPathways, generated.recommendedPathwayTitles),
    safetyNotes: mergeSafetyNotes(fallback.safetyNotes, generated.safetyNotes),
    managerMessageDraft: generated.managerMessageDraft ?? fallback.managerMessageDraft,
  };
}

function finaliseResponse(request: LevyTateAiRequest, response: LevyTateAiResponse) {
  return enforceLevyTateAiActions(request, applyLevyTateAiSafety(request, response));
}

export async function POST(request: Request) {
  let parsedRequest: LevyTateAiRequest | null = null;

  try {
    parsedRequest = parseLevyTateAiRequest(await request.json());
    if (!parsedRequest) {
      return NextResponse.json({ message: "Invalid LevyTate AI request payload." }, { status: 400 });
    }

    if (isRateLimited(rateLimitKey(request), parsedRequest.userMessage)) {
      return NextResponse.json({ message: "Please wait a moment before asking another question." }, { status: 429 });
    }

    const fallback = buildLevyTateAiFallbackResponse(parsedRequest);
    if (!levyTateAiEnabled()) {
      return NextResponse.json(finaliseResponse(parsedRequest, fallback));
    }

    const groundedContext = buildLevyTateAiContext(parsedRequest);
    const generated = await requestLevyTateOpenAI({
      request: parsedRequest,
      systemPrompt: buildLevyTateAiSystemPrompt(parsedRequest),
      userPrompt: buildLevyTateAiUserPrompt({ request: parsedRequest, groundedContext, fallback }),
    });

    return NextResponse.json(finaliseResponse(parsedRequest, mergeGeneratedGuidance(fallback, generated)));
  } catch (error) {
    console.error("LevyTate AI request failed", { error });

    if (parsedRequest) {
      return NextResponse.json(finaliseResponse(parsedRequest, buildLevyTateAiFallbackResponse(parsedRequest)));
    }

    return NextResponse.json({ message: "LevyTate AI could not process this request." }, { status: 500 });
  }
}
