import type {
  LevyTateAiAction,
  LevyTateAiRequest,
  LevyTateAiResponse,
  LevyTateConversationProfile,
  LevyTateConversationRecommendation,
  LevyTateMessageClassification,
  LevyTateRecommendedPathway,
} from "@/lib/levytate/ai/types";

const interestSignals: Array<[RegExp, string]> = [
  [/\b(ai|artificial intelligence|chatgpt|copilot)\b/i, "AI"],
  [/\b(automation|automate|workflow)\b/i, "Automation"],
  [/\b(data|analytics|analysis)\b/i, "Data"],
  [/\b(reporting|reports|dashboard|spreadsheet)\b/i, "Reporting"],
  [/\b(process improvement|continuous improvement|improve the business|business improvement)\b/i, "Business improvement"],
  [/\b(management|manager|leadership|supervisor)\b/i, "Management"],
  [/\b(project|delivery)\b/i, "Project delivery"],
  [/\b(customer|client|service)\b/i, "Customer experience"],
];

const skillSignals: Array<[RegExp, string]> = [
  [/\b(excel|spreadsheet|spreadsheets)\b/i, "Spreadsheets"],
  [/\b(reporting|reports|dashboard|dashboards)\b/i, "Reporting"],
  [/\b(crm|customer relationship management)\b/i, "CRM"],
  [/\b(chatgpt|copilot|generative ai)\b/i, "Generative AI tools"],
  [/\b(data analysis|analytics)\b/i, "Data analysis"],
  [/\b(process mapping|workflow design)\b/i, "Process mapping"],
  [/\b(project management|project coordination)\b/i, "Project coordination"],
  [/\b(customer service|customer support)\b/i, "Customer service"],
  [/\b(engineering|maintenance|manufacturing)\b/i, "Technical operations"],
];

const questionPrompts = {
  role: "What is your current role, and which parts of it take most of your time?",
  currentWork: "Which parts of your current work would you most like to improve or change?",
  careerGoal: "What would you like your role to look like in the next 12 to 24 months?",
  motivation: "What business or personal outcome matters most to you from this development?",
  aiConfidence: "What AI or automation have you tried so far, even informally?",
  learningStyle: "Would you prefer hands-on projects, workshops, coaching or mostly online learning?",
  management: "Is your ambition to lead people, lead projects or become a deeper specialist?",
} as const;

function unique(items: string[], limit = 16) {
  const seen = new Set<string>();
  return items
    .map((item) => item.trim())
    .filter((item) => {
      const key = item.toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, limit);
}

function score(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function classifyMessage(request: LevyTateAiRequest): LevyTateMessageClassification {
  const message = request.userMessage.trim();
  const lower = message.toLowerCase();
  const previousAssistant = [...request.conversationHistory].reverse().find((item) => item.role === "assistant")?.content ?? "";

  if (/\b(actually|instead|changed my mind|change direction|rather than|less interested|more interested|not anymore)\b/i.test(message)) {
    return "change_of_direction";
  }
  if (/\b(to clarify|what i mean|i meant|more specifically|let me clarify)\b/i.test(message)) {
    return "clarification";
  }
  if (/\b(how do i|can you help me|where do i|apply|application|save this|compare|manager message|use levytate)\b/i.test(message)) {
    return "platform_assistance_request";
  }
  if (message.includes("?") || /^(what|which|why|when|where|who|could|would|should|can)\b/i.test(message)) {
    return "new_question";
  }
  const answersAiQuestion = /ai or automation|tried so far/i.test(previousAssistant) && /ai|chatgpt|copilot|automation/i.test(message);
  const answersLearningQuestion = /hands-on projects|workshops|coaching|online learning/i.test(previousAssistant) && /hands-on|practical|workshop|coaching|online|blended/i.test(message);
  if (answersAiQuestion || answersLearningQuestion || (previousAssistant.includes("?") && lower.split(/\s+/).length <= 8)) {
    return "answer_to_previous_question";
  }
  return "new_information";
}

function extractRole(message: string) {
  const match = message.match(/\b(?:i(?:'m| am)|i work)(?: currently)?\s+(?:as|in)\s+(?:an?\s+)?([^,.!?]{2,70})/i)
    ?? message.match(/\bmy (?:current )?role is\s+([^,.!?]{2,70})/i);
  if (!match) return null;
  const raw = match[1].trim().replace(/\b(?:role|team)$/i, "").trim();
  if (/^admin(?:istration|istrative)?$/i.test(raw)) return "Administration";
  return raw.replace(/\b\w/g, (character) => character.toUpperCase());
}

function extractDepartment(message: string) {
  const match = message.match(/\b(?:department|team)\s+(?:is|in|called)\s+([^,.!?]{2,70})/i)
    ?? message.match(/\bi work in the\s+([^,.!?]{2,70})\s+(?:department|team)\b/i);
  return match?.[1]?.trim() ?? null;
}

function extractCareerGoal(message: string) {
  const match = message.match(/\b(?:i(?:'d| would) like to|i want to|my goal is to|i hope to|i'm aiming to|i am aiming to)\s+([^.!?]{4,220})/i)
    ?? message.match(/\b(?:progress|move|develop)\s+(?:into|towards|toward)\s+([^.!?]{3,180})/i);
  return match?.[1]?.trim() ?? null;
}

function extractReason(message: string) {
  const match = message.match(/\b(?:because|so that|in order to|to help)\s+([^.!?]{4,220})/i);
  return match?.[1]?.trim() ?? null;
}

function extractLearningStyle(message: string) {
  if (/\b(hands-on|practical|project-based|real projects)\b/i.test(message)) return "Hands-on projects";
  if (/\b(workshop|classroom|in person)\b/i.test(message)) return "Workshops";
  if (/\b(coaching|mentor|one-to-one)\b/i.test(message)) return "Coaching";
  if (/\b(online|remote|self-paced)\b/i.test(message)) return "Online learning";
  if (/\b(blended|mix of)\b/i.test(message)) return "Blended learning";
  return null;
}

function extractAiConfidence(message: string, previous: number | null) {
  if (/\b(never used|no experience|complete beginner|not used)\b.*\b(ai|chatgpt|automation)\b/i.test(message)) return 10;
  if (/\b(used|tried|use)\b.*\b(chatgpt|copilot|ai)\b/i.test(message) && /\b(no automation|not automated|nothing advanced|beginner)\b/i.test(message)) return 40;
  if (/\b(used|tried|use)\b.*\b(chatgpt|copilot|ai)\b/i.test(message)) return Math.max(previous ?? 0, 50);
  if (/\b(confident|comfortable|regularly)\b.*\b(ai|automation)\b/i.test(message)) return 75;
  if (/\b(build|built|deploy|deployed|advanced)\b.*\b(ai|automation|workflow)\b/i.test(message)) return 90;
  return previous;
}

function extractDigitalConfidence(message: string, previous: number | null) {
  if (/\b(not confident|low confidence|struggle)\b.*\b(digital|technology|systems)\b/i.test(message)) return 20;
  if (/\b(confident|comfortable|strong)\b.*\b(digital|technology|systems|data)\b/i.test(message)) return 75;
  return previous;
}

function extractManagementAspiration(message: string) {
  if (!/\b(manager|management|lead people|lead a team|supervisor|leadership|lead projects)\b/i.test(message)) return null;
  if (/\b(project|delivery)\b/i.test(message)) return "Lead projects or delivery";
  if (/\b(people|team|staff)\b/i.test(message)) return "Lead people or a team";
  return "Develop management responsibility";
}

function extractQuestions(history: LevyTateAiRequest["conversationHistory"]) {
  return history
    .filter((message) => message.role === "assistant")
    .flatMap((message) => message.content.split(/(?<=\?)/g))
    .filter((sentence) => sentence.includes("?"))
    .map((sentence) => sentence.trim().slice(0, 220));
}

function buildQuestionsStillToAsk(profile: LevyTateConversationProfile, role: LevyTateAiRequest["role"]) {
  if (role !== "Employee") return [];
  const questions: string[] = [];
  if (!profile.currentRole) questions.push(questionPrompts.role);
  if (!profile.currentSkills.length) questions.push(questionPrompts.currentWork);
  if (!profile.careerGoal) questions.push(questionPrompts.careerGoal);
  if (!profile.reasonForDevelopment) questions.push(questionPrompts.motivation);
  if (profile.interestAreas.some((item) => item === "AI" || item === "Automation") && profile.aiConfidence === null) {
    questions.push(questionPrompts.aiConfidence);
  }
  if (!profile.preferredLearningStyle && profile.exchangeCount >= 3) questions.push(questionPrompts.learningStyle);
  if (profile.interestAreas.includes("Management") && !profile.managementAspirations) questions.push(questionPrompts.management);
  return questions.filter((question) => !profile.questionsAlreadyAsked.includes(question)).slice(0, 6);
}

function buildSummary(profile: LevyTateConversationProfile) {
  const details = [
    profile.currentRole ? `current role: ${profile.currentRole}` : null,
    profile.careerGoal ? `goal: ${profile.careerGoal}` : null,
    profile.interestAreas.length ? `interests: ${profile.interestAreas.join(", ")}` : null,
    profile.currentSkills.length ? `experience: ${profile.currentSkills.join(", ")}` : null,
    profile.reasonForDevelopment ? `motivation: ${profile.reasonForDevelopment}` : null,
  ].filter(Boolean);
  return details.length ? details.join("; ") : "The user's role, goals and experience are still being explored.";
}

function confidenceFor(profile: LevyTateConversationProfile) {
  const role = profile.currentRole ? 100 : 0;
  const careerGoal = profile.careerGoal ? 85 : profile.interestAreas.length ? 45 : 0;
  const technicalConfidence = profile.currentSkills.length
    ? Math.max(55, profile.aiConfidence ?? 0, profile.digitalConfidence ?? 0)
    : Math.max(profile.aiConfidence ?? 0, profile.digitalConfidence ?? 0);
  const managementAmbition = profile.managementAspirations ? 85 : profile.interestAreas.includes("Management") ? 45 : 20;
  const motivation = profile.reasonForDevelopment ? 85 : 20;
  const interests = profile.interestAreas.length ? 80 : 20;
  const overall = score((role + careerGoal + technicalConfidence + motivation + interests) / 5);
  return { role, careerGoal, technicalConfidence, managementAmbition, overall };
}

function initialProfile(request: LevyTateAiRequest): LevyTateConversationProfile {
  return {
    currentRole: request.contextData?.selectedPersona?.role ?? null,
    currentDepartment: request.contextData?.selectedPersona?.department ?? null,
    currentEmployer: request.currentWorkspace?.employerName ?? request.employerContext ?? null,
    careerGoal: request.contextData?.selectedPersona?.careerGoal ?? null,
    reasonForDevelopment: null,
    currentSkills: [],
    aiConfidence: null,
    digitalConfidence: null,
    interestAreas: [],
    preferredLearningStyle: null,
    managementAspirations: null,
    currentApplicationStatus: request.currentApplication?.status ?? request.contextData?.activeApplication?.status ?? null,
    recommendedPathways: [],
    confidence: { role: 0, careerGoal: 0, technicalConfidence: 0, managementAmbition: 0, overall: 0 },
    questionsAlreadyAsked: [],
    questionsStillToAsk: [],
    conversationSummary: "The user's role, goals and experience are still being explored.",
    exchangeCount: 0,
    latestMessageClassification: "new_information",
  };
}

export function withConversationMemory(request: LevyTateAiRequest): LevyTateAiRequest {
  const previous = request.conversationProfile ?? initialProfile(request);
  const message = request.userMessage;
  const currentRole = extractRole(message) ?? previous.currentRole;
  const currentDepartment = extractDepartment(message) ?? previous.currentDepartment;
  const careerGoal = extractCareerGoal(message) ?? previous.careerGoal;
  const reasonForDevelopment = extractReason(message) ?? previous.reasonForDevelopment;
  const interestAreas = unique([
    ...previous.interestAreas,
    ...interestSignals.filter(([pattern]) => pattern.test(message)).map(([, label]) => label),
  ], 12);
  const currentSkills = unique([
    ...previous.currentSkills,
    ...skillSignals.filter(([pattern]) => pattern.test(message)).map(([, label]) => label),
  ], 12);
  const profile: LevyTateConversationProfile = {
    ...previous,
    currentRole,
    currentDepartment,
    currentEmployer: previous.currentEmployer ?? request.currentWorkspace?.employerName ?? request.employerContext,
    careerGoal,
    reasonForDevelopment,
    currentSkills,
    aiConfidence: extractAiConfidence(message, previous.aiConfidence),
    digitalConfidence: extractDigitalConfidence(message, previous.digitalConfidence),
    interestAreas,
    preferredLearningStyle: extractLearningStyle(message) ?? previous.preferredLearningStyle,
    managementAspirations: extractManagementAspiration(message) ?? previous.managementAspirations,
    currentApplicationStatus: request.currentApplication?.status ?? request.contextData?.activeApplication?.status ?? previous.currentApplicationStatus,
    questionsAlreadyAsked: unique([...previous.questionsAlreadyAsked, ...extractQuestions(request.conversationHistory)]),
    exchangeCount: previous.exchangeCount + 1,
    latestMessageClassification: classifyMessage(request),
  };
  profile.confidence = confidenceFor(profile);
  profile.questionsStillToAsk = buildQuestionsStillToAsk(profile, request.role);
  profile.conversationSummary = buildSummary(profile);
  return { ...request, conversationProfile: profile };
}

function dataPathway(): LevyTateRecommendedPathway {
  return {
    title: "Level 3 Data Technician",
    reason: "Useful where administration includes spreadsheets, reporting, CRM data and improving information quality.",
    availability: "alternative",
    fit: 86,
    standard: "Data Technician",
  };
}

function aiPathway(): LevyTateRecommendedPathway {
  return {
    title: "Level 3 AI Enablement",
    reason: "Worth exploring where the goal is practical AI adoption, workflow automation and measurable business improvement.",
    availability: "alternative",
    fit: 90,
    standard: "AI Enablement",
  };
}

function nextQuestion(profile: LevyTateConversationProfile) {
  if (profile.questionsStillToAsk[0]) return profile.questionsStillToAsk[0];
  if (profile.confidence.overall >= 75) return "Would you like me to prepare application answers or a manager discussion summary?";
  return "Would you like to compare the likely routes or continue refining the goal?";
}

function conversationSummaryText(profile: LevyTateConversationProfile) {
  if (profile.exchangeCount < 5 || profile.exchangeCount % 5 !== 0) return "";
  const points = [
    profile.currentRole ? `you're currently working in ${profile.currentRole}` : null,
    profile.interestAreas.length ? `your strongest interests are ${profile.interestAreas.slice(0, 3).join(", ")}` : null,
    profile.careerGoal ? `you'd like to ${profile.careerGoal}` : null,
    profile.currentSkills.length ? `you've already used ${profile.currentSkills.slice(0, 3).join(", ")}` : null,
  ].filter(Boolean);
  const closing = profile.confidence.overall >= 75
    ? "We now have a confident basis for the next step."
    : "We're getting close to a confident recommendation.";
  return points.length ? `\n\nSo far I've understood that:\n- ${points.join("\n- ")}\n\n${closing}` : "";
}

function employeeMemoryFallback(request: LevyTateAiRequest, response: LevyTateAiResponse): LevyTateAiResponse {
  const profile = request.conversationProfile;
  if (!profile) return response;

  const previousPrimary = profile.recommendedPathways[0]?.title ?? null;
  const asksForRecommendation = /\b(recommend|recommendation|which pathway|what apprenticeship|best fit|compare)\b/i.test(request.userMessage);
  const aiDirection = profile.interestAreas.includes("AI") && (
    profile.interestAreas.includes("Automation") ||
    profile.interestAreas.includes("Business improvement") ||
    /\b(ai automation|automation project|help the business|business grow)\b/i.test(request.userMessage)
  );
  const adminContext = /admin/i.test(profile.currentRole ?? "") ||
    profile.currentSkills.some((skill) => ["Spreadsheets", "Reporting", "CRM"].includes(skill)) ||
    /\badmin|spreadsheet|reporting|crm\b/i.test(request.userMessage);

  if (!adminContext && !aiDirection) {
    return { ...response, conversationProfile: profile, messageClassification: profile.latestMessageClassification };
  }

  const data = dataPathway();
  const ai = aiPathway();
  const primary = aiDirection ? ai : data;
  const changedDirection = Boolean(previousPrimary && previousPrimary !== primary.title);
  const currentStage = recommendationStage(profile.confidence.overall);
  const maturedRecommendation = previousPrimary === primary.title &&
    profile.recommendedPathways[0]?.stage !== currentStage &&
    currentStage === "recommended";
  const repeatedRecommendation = previousPrimary === primary.title && !asksForRecommendation && !maturedRecommendation;
  const earlyRoleOnly = profile.exchangeCount === 1 && Boolean(profile.currentRole) && !profile.currentSkills.length && !profile.careerGoal;

  let assistantMessage: string;
  if (earlyRoleOnly) {
    assistantMessage = "Administration gives us a useful starting point, but it is too early to settle on a pathway. Data Technician is one possible direction if your work centres on spreadsheets and reporting. An AI enablement route may fit better if you are drawn to automation and process improvement.";
  } else if (changedDirection) {
    assistantMessage = `That new detail changes my thinking. Earlier I was leaning towards ${previousPrimary} because administration often includes reporting and data quality. You are more interested in using AI automation to improve the business, so ${primary.title} is becoming the stronger route to explore.`;
  } else if (maturedRecommendation) {
    assistantMessage = `That gives me a firmer view. You have some practical exposure through ${profile.currentSkills.join(", ") || "digital tools"}, and your goal is clearly about automation-led business improvement. ${primary.title} is now the strongest route to explore, provided your employer can support a real workplace project.`;
  } else if (repeatedRecommendation && /hands-on|practical|customer onboarding|process/i.test(request.userMessage)) {
    assistantMessage = "Good, that makes the development need much more concrete. A hands-on learning preference and a real customer onboarding process give you the kind of workplace project that could test value quickly. The next useful step is to define the manual steps, data involved and outcome you would want to improve.";
  } else if (repeatedRecommendation && /chatgpt|copilot|no automation|haven't built/i.test(request.userMessage)) {
    assistantMessage = "That is useful context. You have moved beyond complete beginner level through ChatGPT, but you have not yet tested workflow automation. A practical, project-led route is therefore more relevant than a purely theoretical or analytical one.";
  } else if (repeatedRecommendation) {
    assistantMessage = profile.questionsStillToAsk[0]
      ? `That adds useful detail to the profile I am building. I am keeping the earlier pathway in view without repeating the case for it. The remaining question is ${profile.questionsStillToAsk[0].replace(/\?$/, "").toLowerCase()}.`
      : "That completes another useful part of the picture. I am keeping the earlier recommendation in view without repeating the case for it. We now have enough context to move into application preparation or a focused manager conversation.";
  } else if (aiDirection) {
    assistantMessage = "Your interest is moving beyond routine administration into practical AI adoption and workflow improvement. That makes an AI enablement route more relevant than a purely reporting-led option, although the exact fit still depends on your current experience and the projects available at work.";
  } else {
    assistantMessage = "Your administration background points towards a data route only if reporting, spreadsheets or information quality are a meaningful part of the job. I would treat Data Technician as a possible option for now, not a final recommendation.";
  }
  assistantMessage += conversationSummaryText(profile);

  const recommendedPathways = repeatedRecommendation ? [] : maturedRecommendation ? [primary] : aiDirection ? [ai, data] : [data, ai];
  const actions: LevyTateAiAction[] = [
    { label: "Compare likely routes", type: "compare_routes", target: primary.title },
    { label: "Prepare manager conversation", type: "prepare_manager_message", target: primary.title },
    { label: "Save this interest", type: "save_interest", target: primary.title },
  ];
  const activeApplication = request.currentApplication ?? request.contextData?.activeApplication ?? null;
  if (!activeApplication && profile.confidence.overall >= 75) {
    actions.push({ label: "Prepare application answers", type: "draft_application_reason", target: primary.title });
  }

  const applicationDraft = !activeApplication && profile.confidence.overall >= 75
    ? {
        selectedApprenticeship: primary.title,
        reasonForInterest: `I want to build practical capability in ${profile.interestAreas.slice(0, 3).join(", ").toLowerCase()} so I can ${profile.careerGoal ?? "improve how work is completed"}.`,
        careerGoal: profile.careerGoal ?? "Build practical digital and improvement capability",
        supportRequired: "Access to a relevant workplace project, protected learning time and manager feedback.",
      }
    : null;

  return {
    ...response,
    assistantMessage,
    followUpQuestion: nextQuestion(profile),
    quickReplies: profile.questionsStillToAsk.length
      ? ["Share an example", "Explain my experience", "Compare both routes", "Prepare a manager message"]
      : ["Compare both routes", "Prepare application answers", "Prepare a manager message"],
    recommendedPathways,
    recommendedActions: actions,
    suggestedActions: actions,
    applicationPrefill: applicationDraft,
    applicationDraft,
    nextStep: profile.confidence.overall >= 75 ? "draft_application_reason" : "ask_follow_up",
    managerMessageDraft: `I would like to discuss how my role is developing beyond routine administration. I am particularly interested in ${profile.interestAreas.slice(0, 3).join(", ").toLowerCase() || "digital improvement"} and would value your view on a suitable workplace project and development route.`,
    conversationProfile: profile,
    messageClassification: profile.latestMessageClassification,
  };
}

export function applyConversationMemoryToFallback(request: LevyTateAiRequest, response: LevyTateAiResponse) {
  if (request.role === "Employee") return employeeMemoryFallback(request, response);
  return {
    ...response,
    conversationProfile: request.conversationProfile,
    messageClassification: request.conversationProfile?.latestMessageClassification,
  };
}

function recommendationStage(confidence: number): LevyTateConversationRecommendation["stage"] {
  if (confidence >= 75) return "recommended";
  if (confidence >= 50) return "likely";
  return "possible";
}

export function finaliseConversationProfile(request: LevyTateAiRequest, response: LevyTateAiResponse): LevyTateAiResponse {
  const profile = request.conversationProfile;
  if (!profile) return response;

  const exchange = profile.exchangeCount;
  const existing = new Map(profile.recommendedPathways.map((item) => [item.title.toLowerCase(), item] as const));
  const discussed = response.recommendedPathways.map((pathway, index) => {
    const previous = existing.get(pathway.title.toLowerCase());
    const recommendationConfidence = score(profile.confidence.overall - index * 8);
    return {
      title: pathway.title,
      confidence: recommendationConfidence,
      stage: recommendationStage(recommendationConfidence),
      firstDiscussedAt: previous?.firstDiscussedAt ?? exchange,
      lastDiscussedAt: exchange,
    } satisfies LevyTateConversationRecommendation;
  });
  const discussedTitles = new Set(discussed.map((item) => item.title.toLowerCase()));
  const recommendedPathways = discussed.length
    ? [...discussed, ...profile.recommendedPathways.filter((item) => !discussedTitles.has(item.title.toLowerCase()))].slice(0, 8)
    : profile.recommendedPathways;
  const followUp = response.followUpQuestion?.trim();
  const questionsAlreadyAsked = followUp
    ? unique([...profile.questionsAlreadyAsked, followUp])
    : profile.questionsAlreadyAsked;
  const nextProfile = {
    ...profile,
    recommendedPathways,
    questionsAlreadyAsked,
    questionsStillToAsk: profile.questionsStillToAsk.filter((question) => question !== followUp),
  };
  nextProfile.conversationSummary = buildSummary(nextProfile);

  return {
    ...response,
    conversationProfile: nextProfile,
    messageClassification: nextProfile.latestMessageClassification,
  };
}
