import { NextResponse } from "next/server";

import { enforceLevyTateAiActions } from "@/lib/levytate/ai/actions";
import { buildLevyTateAiContext } from "@/lib/levytate/ai/context";
import { buildLevyTateAiFallbackResponse } from "@/lib/levytate/ai/fallbackResponses";
import {
  applyConversationMemoryToFallback,
  finaliseConversationProfile,
  withConversationMemory,
} from "@/lib/levytate/ai/memory";
import { levyTateAiEnabled, requestLevyTateOpenAI, type LevyTateGeneratedGuidance } from "@/lib/levytate/ai/openai";
import { buildLevyTateAiSystemPrompt, buildLevyTateAiUserPrompt } from "@/lib/levytate/ai/prompts";
import {
  applyPlatformRecommendations,
  buildLevyTateRecommendations,
  buildPlatformRecommendationExplanation,
  recommendationNarrativeIsAligned,
} from "@/lib/levytate/ai/recommendationEngine";
import {
  parseLevyTateAiRequest,
  type LevyTateAiRequest,
  type LevyTateAiResponse,
} from "@/lib/levytate/ai/types";
import { applyLevyTateAiSafety } from "@/lib/levytate-ai/safety";
import { getCopilotGuidanceItems } from "@/lib/server/levytate-guidance-sources";

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

function mergeGeneratedGuidance(fallback: LevyTateAiResponse, generated: LevyTateGeneratedGuidance): LevyTateAiResponse {
  const actionsByType = new Map(fallback.recommendedActions.map((action) => [action.type, action] as const));
  const selectedActions = generated.suggestedActionTypes
    .map((type) => actionsByType.get(type))
    .filter((action): action is NonNullable<typeof action> => Boolean(action));
  const recommendationResult = fallback.recommendationResult;
  const generatedMessage = generated.assistantMessage ?? fallback.assistantMessage;
  const aligned = !recommendationResult || recommendationNarrativeIsAligned(generatedMessage, recommendationResult);

  return {
    ...fallback,
    source: generated.assistantMessage && aligned ? "openai" : "mock",
    assistantMessage: aligned
      ? generatedMessage
      : recommendationResult
        ? buildPlatformRecommendationExplanation(recommendationResult)
        : fallback.assistantMessage,
    followUpQuestion: generated.followUpQuestion,
    quickReplies: generated.quickReplies,
    shouldShowActions: generated.shouldShowActions && selectedActions.length > 0,
    recommendedActions: selectedActions,
    suggestedActions: selectedActions,
    safetyNotes: mergeSafetyNotes(
      fallback.safetyNotes,
      aligned ? generated.safetyNotes : ["Generated recommendation language did not match the platform ranking and was replaced."],
    ),
    managerMessageDraft: generated.managerMessageDraft ?? fallback.managerMessageDraft,
  };
}

function progressiveEmployeeFollowUp(request: LevyTateAiRequest) {
  if (request.role !== "Employee" || !request.selectedEmployee || !request.employeeDiscovery) return null;
  if (request.employeeDiscovery.stage === "future_capability" && request.employeeDiscovery.futureCapabilities.length === 0) {
    const name = request.selectedEmployee.trim().split(/\s+/)[0] || request.selectedEmployee;
    return `What would you like ${name} to be able to do over the next 12 months that they cannot do confidently today?`;
  }
  return null;
}
function buildGroundedFallback(request: LevyTateAiRequest) {
  const recommendationResult = buildLevyTateRecommendations(request);
  const conversationalFallback = applyConversationMemoryToFallback(
    request,
    buildLevyTateAiFallbackResponse(request),
  );
  const grounded = applyPlatformRecommendations(request, conversationalFallback, recommendationResult);
  if (recommendationResult.shouldRevealRecommendations && !recommendationNarrativeIsAligned(grounded.assistantMessage, recommendationResult)) {
    return { ...grounded, assistantMessage: buildPlatformRecommendationExplanation(recommendationResult) };
  }
  return grounded;
}

function finaliseResponse(request: LevyTateAiRequest, response: LevyTateAiResponse) {
  const withProfile = finaliseConversationProfile(request, response);
  const enforced = enforceLevyTateAiActions(request, applyLevyTateAiSafety(request, withProfile));
  const shouldShowActions = Boolean(enforced.applicationWarning) || enforced.shouldShowActions !== false;
  const shouldShowPathways = enforced.recommendationResult?.shouldRevealRecommendations === true;
  const progressiveFollowUp = progressiveEmployeeFollowUp(request);

  return {
    ...enforced,
    followUpQuestion: progressiveFollowUp ?? enforced.followUpQuestion,
    shouldShowActions,
    shouldShowPathways,
    recommendedActions: shouldShowActions ? enforced.recommendedActions : [],
    suggestedActions: shouldShowActions ? enforced.suggestedActions : [],
    recommendedPathways: shouldShowPathways ? enforced.recommendedPathways : [],
  };
}

export async function POST(request: Request) {
  let parsedRequest: LevyTateAiRequest | null = null;

  try {
    parsedRequest = parseLevyTateAiRequest(await request.json());
    if (!parsedRequest) {
      return NextResponse.json({ message: "Invalid LevyTate Copilot request payload." }, { status: 400 });
    }

    parsedRequest = withConversationMemory(parsedRequest);

    if (isRateLimited(rateLimitKey(request), parsedRequest.userMessage)) {
      return NextResponse.json({ message: "Please wait a moment before asking another question." }, { status: 429 });
    }

    const fallback = buildGroundedFallback(parsedRequest);
    if (!levyTateAiEnabled()) {
      return NextResponse.json(finaliseResponse(parsedRequest, fallback));
    }

    const guidanceItems = await getCopilotGuidanceItems({
      asOf: new Date().toISOString().slice(0, 10),
    });
    const groundedContext = buildLevyTateAiContext(parsedRequest, guidanceItems);
    const generated = await requestLevyTateOpenAI({
      request: parsedRequest,
      systemPrompt: buildLevyTateAiSystemPrompt(parsedRequest),
      contextPrompt: buildLevyTateAiUserPrompt({ request: parsedRequest, groundedContext, fallback }),
    });

    return NextResponse.json(finaliseResponse(parsedRequest, mergeGeneratedGuidance(fallback, generated)));
  } catch (error) {
    console.error("LevyTate Copilot request failed", { error });

    if (parsedRequest) {
      return NextResponse.json(finaliseResponse(parsedRequest, buildGroundedFallback(parsedRequest)));
    }

    return NextResponse.json({ message: "LevyTate Copilot could not process this request." }, { status: 500 });
  }
}
