import { buildFallbackResponse as buildLegacyFallbackResponse } from "@/lib/levytate-ai/fallback";
import type {
  LevyTateAiAction,
  LevyTateAiRequest,
  LevyTateAiResponse,
  LevyTateRecommendedPathway,
} from "@/lib/levytate/ai/types";

function activeApplication(request: LevyTateAiRequest) {
  return request.currentApplication ?? request.contextData?.activeApplication ?? null;
}

function adminRoleEmployeeFallback(request: LevyTateAiRequest): LevyTateAiResponse {
  const application = activeApplication(request);
  const pathways: LevyTateRecommendedPathway[] = [
    {
      title: "Level 3 Data Technician",
      reason: "A strong route to explore where the role includes spreadsheets, reporting, CRM updates, data quality and recurring process administration.",
      availability: "alternative",
      fit: 91,
      standard: "Data Technician",
    },
    {
      title: "Level 3 AI Enablement",
      reason: "Worth exploring where the development goal is safe AI use, workflow automation and stronger digital confidence rather than deeper analytics.",
      availability: "alternative",
      fit: 82,
      standard: "AI Enablement",
    },
  ];
  const actions: LevyTateAiAction[] = application
    ? [
        { label: "Compare these routes", type: "compare_routes", target: pathways[0].title },
        { label: "Prepare manager message", type: "prepare_manager_message", target: application.manager },
        { label: "Save this interest", type: "save_interest", target: pathways[0].title },
        { label: "View current application", type: "open_my_applications", target: "My Applications" },
      ]
    : [
        { label: "Compare pathways", type: "compare_routes", target: pathways[0].title },
        { label: "Prepare application answers", type: "draft_application_reason", target: pathways[0].title },
        { label: "Prepare manager message", type: "prepare_manager_message", target: pathways[0].title },
        { label: "Save this interest", type: "save_interest", target: pathways[0].title },
      ];
  const applicationDraft = application
    ? null
    : {
        selectedApprenticeship: "Level 3 Data Technician",
        reasonForInterest: "I want to move from manual administration into stronger reporting, data quality and workflow improvement while building confidence with automation.",
        careerGoal: "Develop stronger data, reporting and digital workflow capability",
        supportRequired: "Access to relevant reporting tasks, protected learning time and opportunities to improve a real administrative process.",
      };

  return {
    source: "mock",
    assistantMessage: "That sounds like a role moving beyond routine administration into data and workflow improvement. Level 3 Data Technician is the clearest route to explore if reporting, spreadsheets and data quality are becoming a bigger part of the job. An AI enablement route may also be useful if the priority is automation and confident day-to-day AI use.",
    followUpQuestion: "Is the bigger goal better reporting and analysis, or reducing manual work through automation?",
    quickReplies: ["Better reporting", "Reduce manual work", "Compare both routes", "Prepare a manager message"],
    recommendedActions: actions,
    suggestedActions: actions,
    recommendedPathways: pathways,
    applicationPrefill: applicationDraft,
    applicationDraft,
    providerMatchDraft: null,
    nextStep: application ? "open_my_applications" : "compare_routes",
    safetyNotes: application
      ? ["A current application blocks a second draft or submission, but exploration and manager preparation remain available."]
      : ["Pathway availability and potential funding require employer role-fit confirmation."],
    applicationWarning: application
      ? "You already have an active apprenticeship application. You can compare and save these routes, but you cannot start a second application yet."
      : null,
    managerMessageDraft: "I would like to discuss how my role is changing through reporting, CRM work and automation. Could we review whether a Data Technician or AI enablement route would support the team as well as my development?",
  };
}

function genericEmployeeFallback(): LevyTateAiResponse {
  const actions: LevyTateAiAction[] = [
    { label: "Describe my current role", type: "ask_follow_up" },
    { label: "Explain my career goal", type: "ask_follow_up" },
  ];
  return {
    source: "mock",
    assistantMessage: "I can help, but I do not yet have an employee record or approved role mapping to ground a recommendation. The useful starting point is your current role, the work you do most often and the kind of progression you want.",
    followUpQuestion: "What is your current role, and are you trying to deepen it or move into something new?",
    quickReplies: ["Develop in my current role", "Move into a new role", "Build data and AI skills", "Prepare a manager conversation"],
    recommendedActions: actions,
    suggestedActions: actions,
    recommendedPathways: [],
    applicationPrefill: null,
    applicationDraft: null,
    providerMatchDraft: null,
    nextStep: "ask_follow_up",
    safetyNotes: ["A pathway recommendation needs an approved employer role mapping or enough role context to support a cautious comparison."],
    applicationWarning: null,
    managerMessageDraft: null,
  };
}

function neutraliseEmployerReferences(response: LevyTateAiResponse, request: LevyTateAiRequest): LevyTateAiResponse {
  if (/portakabin/i.test(request.employerContext)) return response;
  const replaceEmployer = (value: string) => value.replace(/Portakabin locations/gi, "the employer's locations").replace(/at Portakabin/gi, "in the organisation");
  return {
    ...response,
    assistantMessage: replaceEmployer(response.assistantMessage),
    providerMatchDraft: response.providerMatchDraft
      ? { ...response.providerMatchDraft, notes: replaceEmployer(response.providerMatchDraft.notes) }
      : null,
    leadGuidance: response.leadGuidance
      ? {
          ...response.leadGuidance,
          businessRationale: replaceEmployer(response.leadGuidance.businessRationale),
          providerMatchingPrompt: replaceEmployer(response.leadGuidance.providerMatchingPrompt),
        }
      : undefined,
  };
}

function roleFollowUp(request: LevyTateAiRequest) {
  if (request.role === "Employee") return "Would you like to compare the routes, prepare an application answer or plan a manager conversation?";
  if (request.role === "Line Manager") return "Which evidence, workload constraint or business outcome would you like to test before making a decision?";
  if (request.role === "Department Head") return "Would you like to explore participation, site variation or future capability risk next?";
  if (request.role === "Apprenticeship Lead") return "Should we refine the role fit, compare specialist standards or prepare a provider matching request?";
  return "Would you like to refine the requirement, review catalogue candidates or create an internal follow-up task?";
}

function roleQuickReplies(request: LevyTateAiRequest, response: LevyTateAiResponse) {
  const actionLabels = response.recommendedActions.map((action) => action.label);
  const defaults = {
    Employee: ["Compare pathways", "Prepare manager message", "Explain the commitment"],
    "Line Manager": ["Review business benefit", "Check time commitment", "Draft decision rationale"],
    "Department Head": ["Show site variation", "Explain participation", "Review future skills"],
    "Apprenticeship Lead": ["Compare specialist standards", "Draft provider matching request", "Explain funding route"],
    "LevyTate Admin": ["Prepare controlled shortlist", "Draft matching notes", "Create follow-up task"],
  }[request.role];

  return [...actionLabels, ...defaults].filter((item, index, values) => values.indexOf(item) === index).slice(0, 4);
}

function adminFallback(request: LevyTateAiRequest) {
  const leadResponse = buildLegacyFallbackResponse({ ...request, role: "Apprenticeship Lead" });
  const actions: LevyTateAiAction[] = [
    { label: "Review provider matching draft", type: "request_provider_matching", target: leadResponse.providerMatchDraft?.recommendedStandard },
    { label: "Create internal follow-up", type: "create_admin_follow_up_task", target: leadResponse.providerMatchDraft?.roleFamily },
    { label: "Compare specialist routes", type: "compare_routes", target: leadResponse.providerMatchDraft?.recommendedStandard },
  ];

  return {
    ...leadResponse,
    assistantMessage: `I have treated this as a controlled provider matching question. ${leadResponse.assistantMessage} Any provider names should be handled as catalogue candidates until programme fit, delivery capability and relationship status have been checked.`,
    followUpQuestion: "What learner volume, locations, delivery preference and target start window should the shortlist use?",
    quickReplies: ["Add learner volume", "Set delivery preference", "Review catalogue candidates", "Create follow-up task"],
    recommendedActions: actions,
    suggestedActions: actions,
    applicationDraft: null,
    safetyNotes: [
      "Provider matching remains LevyTate-led and requires user confirmation before a request or task is created.",
      ...leadResponse.safetyNotes,
    ],
  } satisfies LevyTateAiResponse;
}

export function buildLevyTateAiFallbackResponse(request: LevyTateAiRequest): LevyTateAiResponse {
  if (request.role === "LevyTate Admin") return neutraliseEmployerReferences(adminFallback(request), request);

  if (request.role === "Employee" && /(admin|spreadsheet|reporting|report|crm|automation|manual process)/i.test(request.userMessage)) {
    return adminRoleEmployeeFallback(request);
  }

  if (request.role === "Employee" && !request.contextData?.selectedPersona && !request.roleMappings?.length) {
    return genericEmployeeFallback();
  }

  const response = neutraliseEmployerReferences(buildLegacyFallbackResponse(request), request);
  const extraActions: LevyTateAiAction[] = request.role === "Line Manager"
    ? [{ label: "Prepare decision rationale", type: "prepare_approval_rationale" }]
    : [];
  const recommendedActions = [...response.recommendedActions, ...extraActions];

  return {
    ...response,
    followUpQuestion: roleFollowUp(request),
    quickReplies: roleQuickReplies(request, { ...response, recommendedActions }),
    recommendedActions,
    suggestedActions: recommendedActions,
    applicationDraft: response.applicationPrefill,
  };
}
