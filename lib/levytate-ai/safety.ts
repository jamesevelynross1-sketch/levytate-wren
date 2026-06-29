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
  const applicationWarning = response.applicationWarning
    ? sanitiseMarketplaceLanguage(sanitiseFundingLanguage(response.applicationWarning))
    : null;
  const managerMessageDraft = response.managerMessageDraft
    ? sanitiseMarketplaceLanguage(sanitiseFundingLanguage(response.managerMessageDraft))
    : null;
  const followUpQuestion = response.followUpQuestion
    ? sanitiseMarketplaceLanguage(sanitiseFundingLanguage(response.followUpQuestion))
    : null;
  const quickReplies = response.quickReplies?.map((reply) =>
    sanitiseMarketplaceLanguage(sanitiseFundingLanguage(reply)),
  );

  const restrictedActions =
    request.role === "Department Head"
      ? response.recommendedActions.filter((action) => action.type !== "request_provider_matching")
      : response.recommendedActions;

  return {
    ...response,
    assistantMessage,
    safetyNotes,
    applicationWarning,
    managerMessageDraft,
    followUpQuestion,
    quickReplies,
    recommendedActions: restrictedActions,
  };
}
