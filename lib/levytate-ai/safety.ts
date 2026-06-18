import type { LevyTateAiRequest, LevyTateAiResponse } from "@/lib/levytate-ai/response-schema";

function sanitiseFundingLanguage(value: string) {
  return value.replace(/fully funded/gi, "potentially levy-funded");
}

function sanitiseMarketplaceLanguage(value: string) {
  return value
    .replace(/marketplace/gi, "provider matching support")
    .replace(/choose any provider/gi, "request provider matching through LevyTate");
}

export function applyLevyTateAiSafety(
  request: LevyTateAiRequest,
  response: LevyTateAiResponse,
): LevyTateAiResponse {
  const assistantMessage = sanitiseMarketplaceLanguage(sanitiseFundingLanguage(response.assistantMessage));
  const safetyNotes = response.safetyNotes.map((note) =>
    sanitiseMarketplaceLanguage(sanitiseFundingLanguage(note)),
  );

  const restrictedActions =
    request.role === "Department Head"
      ? response.recommendedActions.filter((action) => action.type !== "request_provider_matching")
      : response.recommendedActions;

  return {
    ...response,
    assistantMessage,
    safetyNotes,
    recommendedActions: restrictedActions,
  };
}
