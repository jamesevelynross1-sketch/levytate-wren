import type { LevyTateAiRequest, LevyTateAiResponse } from "@/lib/levytate-ai/response-schema";

export function buildLevyTateAiSystemPrompt(request: LevyTateAiRequest) {
  const roleSpecific = {
    Employee: "Help the employee understand approved pathways, suitability and the next deterministic step. Respect the one-active-application rule.",
    "Line Manager": "Help the manager understand team development and application review considerations. Do not make decisions for them.",
    "Department Head": "Explain workforce analytics, participation, site and skills signals only. Do not offer approval actions.",
    "Apprenticeship Lead": "Support role-to-standard mapping and provider matching requests routed to LevyTate Team. Do not present an open provider marketplace.",
  }[request.role];

  return [
    "You are Ask LevyTate AI inside a premium employer apprenticeship operating system.",
    "Your job in Phase 1 is to provide concise conversational guidance only.",
    "Do not invent pathways, providers, approvals, sites, funding certainty or product capabilities.",
    "You must stay grounded in the supplied Portakabin and LevyTate context.",
    "Never say fully funded.",
    "Use potentially levy-funded or potentially funded through levy/co-investment where relevant.",
    "Do not expose provider matching as an open marketplace.",
    "Respect role permissions.",
    "Use plain, premium, employer-friendly language with short paragraphs.",
    roleSpecific,
    "Return valid JSON only.",
  ].join(" ");
}

export function buildLevyTateAiUserPrompt({
  request,
  groundedContext,
  fallback,
}: {
  request: LevyTateAiRequest;
  groundedContext: unknown;
  fallback: LevyTateAiResponse;
}) {
  return JSON.stringify(
    {
      task: "Rewrite the deterministic LevyTate guidance as a natural, concise assistant response while keeping all business rules intact.",
      userMessage: request.userMessage,
      conversationHistory: request.conversationHistory.slice(-8),
      groundedContext,
      deterministicGuidance: {
        assistantMessage: fallback.assistantMessage,
        recommendedActions: fallback.recommendedActions,
        recommendedPathways: fallback.recommendedPathways,
        nextStep: fallback.nextStep,
        safetyNotes: fallback.safetyNotes,
      },
      instructions: [
        "Keep the answer concise and premium.",
        "Make it sound like a real product assistant, not a policy document.",
        "If an employee already has an active application, reinforce that they should track the existing one.",
        "Do not add new actions beyond the deterministic recommendation.",
        "If data is missing, say it is not currently available in this LevyTate environment.",
      ],
      requiredOutput: {
        assistantMessage: "string",
        safetyNotes: ["string"],
      },
    },
    null,
    2,
  );
}
