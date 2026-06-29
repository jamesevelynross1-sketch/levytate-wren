import type {
  LevyTateAiAction,
  LevyTateAiRequest,
  LevyTateAiResponse,
  LevyTateConversationProfile,
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
    standard: "Data Technician",
  };
}

function aiPathway(): LevyTateRecommendedPathway {
  return {
    title: "Level 3 AI Enablement",
    reason: "Worth exploring where the goal is practical AI adoption, workflow automation and measurable business improvement.",
    availability: "alternative",
    standard: "AI Enablement",
  };
}

function directAiProgrammeQuestion(message: string) {
  return /\bhow (?:do|can) i (?:get|apply|start|join)|\bget onto\b|\bapply for\b/i.test(message) &&
    /\bai enablement\b/i.test(message);
}

function pickFallbackVariant(profile: LevyTateConversationProfile, variants: string[]) {
  return variants[Math.max(0, profile.exchangeCount - 1) % variants.length];
}

function employeeMemoryFallback(request: LevyTateAiRequest, response: LevyTateAiResponse): LevyTateAiResponse {
  const profile = request.conversationProfile;
  if (!profile) return response;

  const message = request.userMessage;
  const activeApplication = request.currentApplication ?? request.contextData?.activeApplication ?? null;
  const data = dataPathway();
  const ai = aiPathway();
  const roleOnly = profile.exchangeCount === 1 && /\badmin(?:istration|istrative)?\b/i.test(profile.currentRole ?? message);
  const reportingAndAutomation = /\breporting\b/i.test(message) && /\bautomation|automate\b/i.test(message);
  const aiProjectShift = /\bai automation project|ai project|ai opportunities|help the business grow|improve how the business/i.test(message);
  const experienceAnswer = /\bchatgpt|copilot|used ai|built.*automation|no automation|haven't built/i.test(message);
  const asksToCompare = /\bcompare|difference between|versus| vs \b/i.test(message);
  const asksForApplicationHelp = /\bhelp me apply|application reason|application answer|draft my application/i.test(message);

  let assistantMessage = "";
  let followUpQuestion: string | null = null;
  let quickReplies: string[] = [];
  let shouldShowPathways = false;
  let shouldShowActions = false;
  let pathways: LevyTateRecommendedPathway[] = [data, ai];
  let actions: LevyTateAiAction[] = [];

  if (directAiProgrammeQuestion(message)) {
    assistantMessage = "Good question. In LevyTate, you would normally get there in three steps. First, we check that your role gives you genuine opportunities to use AI at work. Then we prepare an application around the business problem you want to solve. Finally, your line manager reviews the role fit and business priority before it moves to the Apprenticeship Lead.";
    if (activeApplication) {
      assistantMessage += " You already have an active application, so we can prepare the thinking and manager conversation, but not start another application yet.";
    }
    followUpQuestion = "Would you like help with the application reason or the manager conversation?";
    pathways = [ai, data];
    actions = [
      { label: "Prepare application reason", type: "draft_application_reason", target: ai.title },
      { label: "Prepare manager conversation", type: "prepare_manager_message", target: ai.title },
      { label: "Compare with Data Technician", type: "compare_routes", target: data.title },
    ];
    shouldShowActions = true;
  } else if (roleOnly) {
    assistantMessage = "Admin can mean quite different things, so I would not jump to a programme yet. The useful starting point is what fills most of your week and which work you would like to spend less or more time doing.";
    followUpQuestion = "Is your role mainly reporting and spreadsheets, process administration, customer support, or something else?";
    quickReplies = ["Reporting and spreadsheets", "Process administration", "Customer support", "Something else"];
  } else if (reportingAndAutomation) {
    assistantMessage = "That gives us two useful threads. Reporting could point towards a data pathway, while automation may be closer to AI enablement or process improvement. I would not choose between them until we know what you want to be doing, not just what tasks are appearing in the role.";
    followUpQuestion = "Which matters more to you: analysing information, building automations, or improving the wider process?";
    quickReplies = ["Analysing information", "Building automations", "Improving the process"];
    pathways = [data, ai];
  } else if (aiProjectShift) {
    assistantMessage = "That is a slightly different angle, and it is useful. You are not just talking about improving reporting. You are interested in using AI to change how the business works, which makes an AI enablement route more relevant than a purely data-led route.";
    followUpQuestion = "Are you imagining yourself identifying AI opportunities, building automations, or helping colleagues use AI tools better?";
    quickReplies = ["Identifying AI opportunities", "Building automations", "Helping colleagues use AI"];
    pathways = [ai, data];
  } else if (experienceAnswer) {
    assistantMessage = "That helps place your starting point. You have enough exposure to understand what generative AI can do, but the development need is still practical: turning a useful idea into a safe, repeatable workplace process.";
    followUpQuestion = "What is one manual process you would most like to improve?";
    quickReplies = ["Customer onboarding", "Reporting workflow", "CRM updates", "Another process"];
    pathways = [ai, data];
  } else if (asksToCompare) {
    assistantMessage = "The clearest distinction is the work outcome. Data Technician is stronger when the role needs better data handling, reporting and insight. AI Enablement is stronger when the employee will identify use cases, improve workflows and help the organisation adopt AI responsibly.";
    followUpQuestion = "Which of those outcomes is closer to the work you want to own?";
    quickReplies = ["Data and reporting", "AI and automation", "I am still unsure"];
    pathways = [data, ai];
    shouldShowPathways = true;
  } else if (asksForApplicationHelp) {
    assistantMessage = "Yes. A strong application reason should connect three things: the work you do now, the business problem you want to solve, and the capability the programme would help you build. I can prepare that from what you have already told me.";
    actions = [
      { label: "Prepare application reason", type: "draft_application_reason", target: profile.recommendedPathways[0]?.title ?? ai.title },
      { label: "Prepare manager conversation", type: "prepare_manager_message", target: profile.recommendedPathways[0]?.title ?? ai.title },
    ];
    shouldShowActions = true;
    pathways = [ai, data];
  } else {
    assistantMessage = pickFallbackVariant(profile, [
      "That adds something useful. I am keeping the earlier context in mind, but I do not think another pathway explanation would help yet.",
      "There is enough here to keep moving without repeating the recommendation. The next useful step is to make the workplace outcome more concrete.",
      "I have taken that on board. Rather than show the same options again, let us focus on the decision that would change the advice.",
    ]);
    followUpQuestion = profile.questionsStillToAsk[0] ?? null;
    quickReplies = followUpQuestion ? ["Share an example", "Explain my goal", "Talk through the options"] : [];
    pathways = profile.interestAreas.includes("AI") ? [ai, data] : [data, ai];
  }

  const applicationDraft = !activeApplication && (directAiProgrammeQuestion(message) || asksForApplicationHelp)
    ? {
        selectedApprenticeship: ai.title,
        reasonForInterest: `I want to use AI and automation to improve ${profile.careerGoal ?? "a real business process"} and build practical confidence through a workplace project.`,
        careerGoal: profile.careerGoal ?? "Build practical AI and workflow improvement capability",
        supportRequired: "Access to a relevant workplace project, protected learning time and manager feedback.",
      }
    : null;

  return {
    ...response,
    assistantMessage,
    followUpQuestion,
    quickReplies,
    shouldShowPathways,
    shouldShowActions,
    recommendedPathways: pathways,
    recommendedActions: actions,
    suggestedActions: actions,
    applicationPrefill: applicationDraft,
    applicationDraft,
    nextStep: shouldShowActions ? actions[0]?.type ?? null : null,
    managerMessageDraft: `I would like to discuss how my role is changing and whether a practical AI or automation project could support ${profile.careerGoal ?? "a useful business improvement"}.`,
    conversationProfile: profile,
    messageClassification: profile.latestMessageClassification,
  };
}

function applyRoleVisibility(request: LevyTateAiRequest, response: LevyTateAiResponse): LevyTateAiResponse {
  const message = request.userMessage.toLowerCase();
  const asksForPathways = /\b(map|mapping|pathway|standard|recommend|compare)\b/.test(message);
  const asksForAction = request.role === "Line Manager"
    ? /\b(review|decision|rationale|approve|decline)\b/.test(message)
    : request.role === "Department Head"
      ? /\b(open|show|view|report)\b/.test(message)
      : /\b(provider matching|shortlist|prepare|request|final approval|follow-up task)\b/.test(message);

  return {
    ...response,
    shouldShowPathways: asksForPathways && response.recommendedPathways.length > 0,
    shouldShowActions: asksForAction && response.recommendedActions.length > 0,
    quickReplies: response.quickReplies?.slice(0, 3),
    conversationProfile: request.conversationProfile,
    messageClassification: request.conversationProfile?.latestMessageClassification,
  };
}

export function applyConversationMemoryToFallback(request: LevyTateAiRequest, response: LevyTateAiResponse) {
  if (request.role === "Employee") return employeeMemoryFallback(request, response);
  return applyRoleVisibility(request, response);
}

export function finaliseConversationProfile(request: LevyTateAiRequest, response: LevyTateAiResponse): LevyTateAiResponse {
  const profile = request.conversationProfile;
  if (!profile) return response;

  const exchange = profile.exchangeCount;
  const existing = new Map(profile.recommendedPathways.map((item) => [item.title.toLowerCase(), item] as const));
  const platformRecommendations = response.recommendationResult?.recommendations ?? [];
  const recommendedPathways = platformRecommendations.map((recommendation) => {
    const previous = existing.get(recommendation.title.toLowerCase());
    return {
      title: recommendation.title,
      confidence: recommendation.confidence,
      stage: recommendation.confidence >= 75 ? "recommended" as const : recommendation.confidence >= 50 ? "likely" as const : "possible" as const,
      firstDiscussedAt: previous?.firstDiscussedAt ?? exchange,
      lastDiscussedAt: exchange,
    };
  });
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