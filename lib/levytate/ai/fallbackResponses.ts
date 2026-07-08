import { buildFallbackResponse as buildLegacyFallbackResponse } from "@/lib/levytate-ai/fallback";
import type {
  LevyTateAiAction,
  LevyTateAiRequest,
  LevyTateAiResponse,
  LevyTateRecommendedPathway,
} from "@/lib/levytate/ai/types";
import { getApprenticeshipStandard } from "@/lib/levytate/domain";

function standardPathway(standardId: string, reason: string): LevyTateRecommendedPathway {
  const standard = getApprenticeshipStandard(standardId);
  if (!standard) throw new Error("Unknown apprenticeship standard: " + standardId);
  return {
    title: "Level " + standard.level + " " + standard.title,
    reason,
    availability: "alternative",
    standard: standard.title,
  };
}
function activeApplication(request: LevyTateAiRequest) {
  return request.currentApplication ?? request.contextData?.activeApplication ?? null;
}

function adminRoleEmployeeFallback(request: LevyTateAiRequest): LevyTateAiResponse {
  const application = activeApplication(request);
  const pathways: LevyTateRecommendedPathway[] = [
    standardPathway("ST0795", "A strong route to explore where the role includes spreadsheets, reporting, CRM updates, data quality and recurring process administration."),
    standardPathway("ST0192", "Worth exploring where the development goal is workflow automation, process improvement and measurable workplace change."),  ];
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
        selectedApprenticeship: pathways[0].title,
        reasonForInterest: "I want to move from manual administration into stronger reporting, data quality and workflow improvement while building confidence with automation.",
        careerGoal: "Develop stronger data, reporting and digital workflow capability",
        supportRequired: "Access to relevant reporting tasks, protected learning time and opportunities to improve a real administrative process.",
      };

  return {
    source: "mock",
    assistantMessage: "That sounds like a role moving beyond routine administration into data and workflow improvement. Level 3 Data Technician is the clearest route to explore if reporting, spreadsheets and data quality are becoming a bigger part of the job. Improvement Practitioner may also be useful if the priority is automation, process improvement and measurable workplace change.",
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
    managerMessageDraft: "I would like to discuss how my role is changing through reporting, CRM work and automation. Could we review whether a Data Technician or Improvement Practitioner route would support the team as well as my development?",
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
  if (request.role === "Employee") return "Next useful LevyTate step: view the current application, compare the recommendation or generate a manager conversation draft.";
  if (request.role === "Line Manager") return "Next useful LevyTate step: open the review queue, check the recommendation evidence or prepare a decision rationale.";
  if (request.role === "Department Head") return "Next useful LevyTate step: open reports, review site variation or explain a workforce capability signal.";
  if (request.role === "Apprenticeship Lead") return "Next useful LevyTate step: open final approvals, compare specialist routes or prepare a provider matching request.";
  return "Next useful LevyTate step: review catalogue candidates, prepare matching notes or create an internal follow-up task.";
}

function roleQuickReplies(request: LevyTateAiRequest, response: LevyTateAiResponse) {
  const actionLabels = response.recommendedActions.map((action) => action.label);
  const defaults = {
    Employee: ["View current application", "Compare pathways", "Generate manager conversation"],
    "Line Manager": ["Show pending approvals", "Review business benefit", "Draft decision rationale"],
    "Department Head": ["Open reports", "Show site variation", "Explain participation"],
    "Apprenticeship Lead": ["Show final approvals", "Draft provider matching request", "Explain funding route"],
    "LevyTate Admin": ["Show provider relationships", "Draft matching notes", "Create follow-up task"],
  }[request.role];

  return [...actionLabels, ...defaults].filter((item, index, values) => values.indexOf(item) === index).slice(0, 4);
}

function copilotIntentActions(request: LevyTateAiRequest): LevyTateAiAction[] {
  const text = request.userMessage.toLowerCase();
  const actions: LevyTateAiAction[] = [];

  if (request.role === "Employee" && /\b(current application|my application|track|status)\b/.test(text)) {
    actions.push({ label: "View current application", type: "open_my_applications", target: "Applications" });
  }

  if (request.role === "Line Manager" && /\b(awaiting|pending|approval|review queue|review)\b/.test(text)) {
    actions.push({ label: "Open review queue", type: "open_review_queue", target: "Applications" });
  }

  if (request.role === "Department Head" && /\b(report|analytics|participation|site|skills|future)\b/.test(text)) {
    actions.push({ label: "Open reports", type: "open_reporting", target: "Reports" });
  }

  if (request.role === "Apprenticeship Lead" && /\b(final approval|approvals|awaiting approval|approved for enrolment)\b/.test(text)) {
    actions.push({ label: "Open final approvals", type: "open_final_approvals", target: "Applications" });
  }

  if ((request.role === "Apprenticeship Lead" || request.role === "LevyTate Admin") && /\b(provider|primary goal|matching|programme)\b/.test(text)) {
    actions.push({ label: "Open provider relationships", type: "open_provider_relationships", target: "Provider Relationships" });
  }

  if ((request.role === "Apprenticeship Lead" || request.role === "LevyTate Admin") && /\b(request|draft|prepare|generate|submit).{0,30}\b(provider matching|matching request|shortlist)\b/.test(text)) {
    actions.push({ label: "Prepare provider matching request", type: "request_provider_matching", target: "Provider Relationships" });
  }

  return actions;
}

function adminFallback(request: LevyTateAiRequest) {
  const leadResponse = buildLegacyFallbackResponse({ ...request, role: "Apprenticeship Lead" });
  const actions: LevyTateAiAction[] = [
    { label: "Open provider relationships", type: "open_provider_relationships", target: "Provider Relationships" },
    { label: "Review provider matching draft", type: "request_provider_matching", target: leadResponse.providerMatchDraft?.recommendedProgramme },
    { label: "Create internal follow-up", type: "create_admin_follow_up_task", target: leadResponse.providerMatchDraft?.roleFamily },
    { label: "Compare specialist routes", type: "compare_routes", target: leadResponse.providerMatchDraft?.recommendedProgramme },
  ];

  return {
    ...leadResponse,
    assistantMessage: `I have treated this as a LevyTate platform task. ${leadResponse.assistantMessage} If the user wants to add or review a provider, open Provider Relationships first, then confirm capability area, preferred provider, programme coverage, backup providers, status, review date and notes.`,
    followUpQuestion: "Would you like to open Provider Relationships or prepare the matching notes first?",
    quickReplies: ["Open provider relationships", "Set delivery preference", "Review catalogue candidates", "Create follow-up task"],
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
  const recommendedActions = [...copilotIntentActions(request), ...response.recommendedActions, ...extraActions];

  return {
    ...response,
    followUpQuestion: roleFollowUp(request),
    quickReplies: roleQuickReplies(request, { ...response, recommendedActions }),
    recommendedActions,
    suggestedActions: recommendedActions,
    applicationDraft: response.applicationPrefill,
  };
}


