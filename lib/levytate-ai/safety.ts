import type { LevyTateAiRequest, LevyTateAiResponse } from "@/lib/levytate-ai/response-schema";

function sanitiseFundingLanguage(value: string) {
  return value.replace(/fully funded/gi, "potentially levy-funded");
}

function sanitiseMarketplaceLanguage(value: string) {
  return value
    .replace(/marketplace/gi, "provider matching support")
    .replace(/choose any provider/gi, "request provider matching through LevyTate");
}

function sanitiseEncodingArtifacts(value: string) {
  return value
    .replace(/[—–]/g, "-")
    .replace(/\u00e2\u0080\u0094/g, "-")
    .replace(/\u00e2\u0080\u0093/g, "-")
    .replace(/\u00e2\u0086\u0092/g, "->")
    .replace(/â/g, "-")
    .replace(/â€“/g, "-")
    .replace(/â†’/g, "->")
    .replace(/Â·/g, "·")
    .replace(/Ãƒâ€šÃ‚Â·/g, "·")
    .replace(/\uFFFD/g, "");
}

function sanitiseAiText(value: string) {
  return sanitiseEncodingArtifacts(sanitiseMarketplaceLanguage(sanitiseFundingLanguage(value)));
}

export function applyLevyTateAiSafety(
  request: LevyTateAiRequest,
  response: LevyTateAiResponse,
): LevyTateAiResponse {
  const assistantMessage = sanitiseAiText(response.assistantMessage);
  const safetyNotes = response.safetyNotes.map((note) =>
    sanitiseAiText(note),
  );
  const applicationWarning = response.applicationWarning
    ? sanitiseAiText(response.applicationWarning)
    : null;
  const managerMessageDraft = response.managerMessageDraft
    ? sanitiseAiText(response.managerMessageDraft)
    : null;
  const followUpQuestion = response.followUpQuestion
    ? sanitiseAiText(response.followUpQuestion)
    : null;
  const quickReplies = response.quickReplies?.map((reply) =>
    sanitiseAiText(reply),
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
