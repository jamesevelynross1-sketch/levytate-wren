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

const employeeEditableStatuses = new Set(["Draft", "More information requested"]);
const managerReviewStatuses = new Set(["Submitted to Line Manager", "Awaiting Manager Review"]);
const leadReviewStatuses = new Set(["Approved by Line Manager", "Submitted to Apprenticeship Lead", "Awaiting Final Approval"]);

function employeeWorkspaceContext(request: LevyTateAiRequest) {
  return request.workspaceEmployeeContext;
}

function employeeContextApplication(request: LevyTateAiRequest) {
  return employeeWorkspaceContext(request)?.application ?? null;
}

function employeeProgrammeTitle(request: LevyTateAiRequest) {
  return employeeContextApplication(request)?.pathway
    || request.workspaceEmployeeContext?.role?.preferredPathway
    || request.availablePathways?.[0]?.title
    || request.roleMappings?.[0]?.primaryPathway
    || "your recommended programme";
}

function employeeManagerName(request: LevyTateAiRequest) {
  return request.workspaceEmployeeContext?.employee?.manager
    || request.currentApplication?.manager
    || "your line manager";
}

function employeeOwnerName(request: LevyTateAiRequest) {
  const application = employeeContextApplication(request);
  if (!application) return "you";
  return application.currentOwnerName || (application.currentOwner === "Line Manager" ? employeeManagerName(request) : application.currentOwner || "the current owner");
}

function employeeCurrentStatus(request: LevyTateAiRequest) {
  return employeeContextApplication(request)?.status ?? null;
}

function employeeAction(label: string, type: LevyTateAiAction["type"], target?: string): LevyTateAiAction {
  return { label, type, target, requiresConfirmation: false };
}

function employeeActionsForState(request: LevyTateAiRequest): LevyTateAiAction[] {
  const status = employeeCurrentStatus(request);
  if (!status) {
    return [
      employeeAction("Start application", "start_application", "My Application"),
      employeeAction("Explain this programme", "open_pathway", employeeProgrammeTitle(request)),
    ];
  }
  if (status === "Draft") {
    return [
      employeeAction("Continue application", "draft_application_reason", "My Application"),
      employeeAction("Review my answers", "draft_application_reason", "My Application"),
    ];
  }
  if (managerReviewStatuses.has(status)) {
    return [
      employeeAction("View submitted application", "open_my_applications", "My Application"),
      employeeAction("Explain manager review", "ask_follow_up", "manager review"),
      employeeAction("Prepare for manager conversation", "prepare_manager_message", employeeManagerName(request)),
    ];
  }
  if (status === "More information requested") {
    return [
      employeeAction("Provide requested information", "draft_application_reason", "My Application"),
      employeeAction("Help draft my response", "draft_application_reason", "My Application"),
    ];
  }
  if (leadReviewStatuses.has(status)) {
    return [
      employeeAction("Track application", "open_my_applications", "My Application"),
      employeeAction("Explain final review", "ask_follow_up", "final review"),
    ];
  }
  if (status === "Approved for Enrolment") {
    return [
      employeeAction("View enrolment details", "open_my_applications", "My Application"),
      employeeAction("Open my programme", "open_pathway", employeeProgrammeTitle(request)),
    ];
  }
  if (/Declined/.test(status)) {
    return [
      employeeAction("Review feedback", "open_my_applications", "My Application"),
      employeeAction("Prepare manager conversation", "prepare_manager_message", employeeManagerName(request)),
    ];
  }
  return [employeeAction("Track application", "open_my_applications", "My Application")];
}

function employeeApplicationWarningForState(request: LevyTateAiRequest, text: string) {
  const status = employeeCurrentStatus(request);
  if (!status) return null;
  const attemptsNewApplication = /\b(start|apply|submit|create|new|second|another)\b.{0,40}\b(application|apprenticeship|request)\b|\b(application|apprenticeship|request)\b.{0,40}\b(start|apply|submit|create|new|second|another)\b/.test(text);
  if (!attemptsNewApplication) return null;
  if (status === "Draft") return "You already have a draft application. Continue that draft rather than starting a second one.";
  if (status === "More information requested") return "Your current application is reopened only for the information your manager requested.";
  if (managerReviewStatuses.has(status)) return "Your current application is submitted and locked while your manager reviews it.";
  if (leadReviewStatuses.has(status)) return "Your current application is already in the final review stage.";
  if (status === "Approved for Enrolment") return "Your current application is approved for enrolment, so the next step is enrolment preparation.";
  return null;
}

function employeePlatformTaskIntent(text: string) {
  if (/\b(new conversation|start over|reset conversation|fresh conversation)\b/.test(text)) return "new_conversation";
  if (/\b(prepare|generate|draft|write|help).{0,45}\b(manager conversation|conversation with manager|manager message|message for manager|manager discussion)\b|\b(manager conversation|conversation with manager|manager message|message for manager|manager discussion)\b/.test(text)) return "prepare_manager_conversation";
  if (/\b(show|open|view|take me to|go to)\b.{0,35}\b(current application|my application|submitted answers|submitted application|application)\b|\b(track|status)\b.{0,25}\b(application|request)\b/.test(text)) return "open_application";
  if (/\b(show|open|view|take me to|go to)\b.{0,35}\b(programme|program|pathway|recommendation)\b/.test(text)) return "open_programme";
  if (/\b(start|apply|submit|create)\b.{0,35}\b(application|apprenticeship|request)\b/.test(text)) return "start_application";
  if (/\b(continue|resume|open)\b.{0,35}\b(draft|application)\b|\b(edit|update)\b.{0,35}\b(draft|application)\b/.test(text)) return "continue_application";
  if (/\b(provide|submit|answer|respond|add)\b.{0,45}\b(requested information|information.*manager|manager requested|more information)\b/.test(text)) return "provide_information";
  if (/\b(view|open|show)\b.{0,35}\b(enrolment|enrollment|enrolment details|provider details)\b/.test(text)) return "view_enrolment";
  return null;
}

function employeeActionForPlatformTask(request: LevyTateAiRequest, type: LevyTateAiAction["type"], label: string, target: string) {
  return [employeeAction(label, type, target)];
}

function employeeManagerConversationDraft(request: LevyTateAiRequest) {
  const application = employeeContextApplication(request);
  const employee = request.workspaceEmployeeContext?.employee;
  const role = request.workspaceEmployeeContext?.role;
  const manager = employeeManagerName(request);
  const programme = employeeProgrammeTitle(request);
  const status = employeeCurrentStatus(request) ?? "current review";
  const reason = application?.reason || request.workspaceEmployeeContext?.recommendation?.rationale || role?.businessRationale || `you want to apply ${programme} in your role`;
  const careerGoal = application?.careerGoal || "build useful capability for your current role and future progression";
  const support = application?.supportRequired || "agree realistic study time, workplace evidence and any support needed during delivery";
  const roleTitle = employee?.jobTitle || role?.title || "your role";

  return [
    `Here is a simple way to prepare for your conversation with ${manager}:`,
    "",
    `- Explain why the ${programme} programme interests you.`,
    `- Connect it to your current role as ${roleTitle}.`,
    `- Give one practical example of how it could support ${careerGoal}.`,
    `- Be clear that the current application status is ${status}.`,
    `- Ask whether ${manager} needs any further evidence before completing the review.`,
    `- Agree the support you may need: ${support}.`,
    "",
    "Suggested opening:",
    "",
    `'I'm interested in the ${programme} programme because ${reason}. I'd like to discuss how the learning could be applied in my role and what support would be realistic during the programme.'`,
  ].join("\n");
}

function employeePlatformTaskMessage(request: LevyTateAiRequest, text: string) {
  const intent = employeePlatformTaskIntent(text);
  if (!intent) return null;

  const application = employeeContextApplication(request);
  const status = application?.status ?? null;
  const manager = employeeManagerName(request);
  const programme = employeeProgrammeTitle(request);
  const owner = employeeOwnerName(request);

  if (intent === "new_conversation") {
    if (!application) {
      return {
        message: `Starting a fresh conversation. You have not started an application yet, and ${programme} is the current recommendation I can help explain or turn into a draft.`,
        actions: employeeActionsForState(request),
        quickReplies: [],
      };
    }
    if (managerReviewStatuses.has(status ?? "")) {
      return {
        message: `Starting a fresh conversation. Your ${programme} application is currently with ${manager} for review. I can show your submitted application, explain the review stage or help you prepare for the conversation.`,
        actions: employeeActionsForState(request),
        quickReplies: [],
      };
    }
    return {
      message: `Starting a fresh conversation. Your ${programme} application is currently ${status}${managerReviewStatuses.has(status ?? "") ? ` with ${manager} for review` : ` with ${owner}`}. I can show the application, explain the status or help you prepare for the next step.`,
      actions: employeeActionsForState(request),
      quickReplies: [],
    };
  }

  if (intent === "prepare_manager_conversation") {
    const draft = employeeManagerConversationDraft(request);
    return {
      message: draft,
      actions: [
        employeeAction("Copy conversation draft", "prepare_manager_message", manager),
        employeeAction("View submitted application", "open_my_applications", "My Application"),
        employeeAction("Explain manager review", "ask_follow_up", "manager review"),
      ],
      quickReplies: [],
      managerMessageDraft: draft,
      suppressApplicationWarning: true,
    };
  }

  if (intent === "open_application") {
    if (!application) {
      return {
        message: "You do not have a current application to open yet. I can help you start one from your recommended programme.",
        actions: employeeActionsForState(request),
        quickReplies: [],
      };
    }
    const label = managerReviewStatuses.has(status ?? "") ? "View submitted application" : status === "Draft" ? "Continue application" : "Open my application";
    return {
      message: managerReviewStatuses.has(status ?? "")
        ? `Opening your submitted application. It is currently with ${manager} for manager review.`
        : `Opening your current application. Its status is ${status}.`,
      actions: employeeActionForPlatformTask(request, "open_my_applications", label, "My Application"),
      quickReplies: [],
      autoExecute: true,
    };
  }

  if (intent === "open_programme") {
    return {
      message: `Opening your programme: ${programme}.`,
      actions: employeeActionForPlatformTask(request, "open_pathway", "Open my programme", "My Programme"),
      quickReplies: [],
      autoExecute: true,
    };
  }

  if (intent === "start_application") {
    if (!application) {
      return {
        message: `Opening the application workflow for ${programme}.`,
        actions: employeeActionForPlatformTask(request, "start_application", "Start application", "My Application"),
        quickReplies: [],
      };
    }
    if (status === "Draft") {
      return {
        message: "You already have a draft application. Opening that draft so you can continue it.",
        actions: employeeActionForPlatformTask(request, "draft_application_reason", "Continue application", "My Application"),
        quickReplies: [],
        autoExecute: true,
      };
    }
    if (status === "More information requested") {
      return {
        message: `${manager} has requested more information. Opening the reopened application section.`,
        actions: employeeActionForPlatformTask(request, "draft_application_reason", "Provide requested information", "My Application"),
        quickReplies: [],
        autoExecute: true,
      };
    }
    return {
      message: `You already have an active application for ${programme}. It is currently ${status}, so you cannot start a second application right now.`,
      actions: employeeActionForPlatformTask(request, "open_my_applications", "Open my application", "My Application"),
      quickReplies: [],
      autoExecute: true,
    };
  }

  if (intent === "continue_application") {
    if (status === "Draft") {
      return {
        message: "Opening your editable draft application.",
        actions: employeeActionForPlatformTask(request, "draft_application_reason", "Continue application", "My Application"),
        quickReplies: [],
        autoExecute: true,
      };
    }
    if (status === "More information requested") {
      return {
        message: `Opening your application so you can provide the information ${manager} requested.`,
        actions: employeeActionForPlatformTask(request, "draft_application_reason", "Provide requested information", "My Application"),
        quickReplies: [],
        autoExecute: true,
      };
    }
    if (application) {
      return {
        message: `Your application is already submitted and cannot be edited at this stage. It is currently ${status} with ${owner}.`,
        actions: employeeActionForPlatformTask(request, "open_my_applications", "View submitted application", "My Application"),
        quickReplies: [],
        autoExecute: true,
      };
    }
    return {
      message: "You do not have a draft to continue yet. I can help you start an application from your recommended programme.",
      actions: employeeActionsForState(request),
      quickReplies: [],
    };
  }

  if (intent === "provide_information") {
    if (status === "More information requested") {
      return {
        message: `Opening your application so you can respond to ${manager}'s request for more information.`,
        actions: employeeActionForPlatformTask(request, "draft_application_reason", "Provide requested information", "My Application"),
        quickReplies: [],
        autoExecute: true,
      };
    }
    return {
      message: application
        ? `There is no current request for more information. Your application is ${status}.`
        : "There is no application with a request for more information yet.",
      actions: application ? employeeActionForPlatformTask(request, "open_my_applications", "Open my application", "My Application") : employeeActionsForState(request),
      quickReplies: [],
    };
  }

  if (intent === "view_enrolment") {
    if (status === "Approved for Enrolment") {
      return {
        message: `Opening your enrolment details for ${programme}.`,
        actions: employeeActionForPlatformTask(request, "open_my_applications", "View enrolment details", "My Application"),
        quickReplies: [],
        autoExecute: true,
      };
    }
    return {
      message: application ? `Your application is not at enrolment yet. Current status: ${status}.` : "You do not have an application at enrolment stage yet.",
      actions: application ? employeeActionForPlatformTask(request, "open_my_applications", "Track application", "My Application") : employeeActionsForState(request),
      quickReplies: [],
    };
  }

  return null;
}

function employeeRecommendationExplanation(request: LevyTateAiRequest) {
  const employee = request.workspaceEmployeeContext?.employee;
  const role = request.workspaceEmployeeContext?.role;
  const recommendation = request.workspaceEmployeeContext?.recommendation;
  const programme = employeeProgrammeTitle(request);
  const rationale = recommendation?.rationale || role?.businessRationale || "it is the approved pathway mapped to this role in LevyTate.";
  const evidence = recommendation?.evidence?.length ? ` The strongest evidence is ${recommendation.evidence.slice(0, 3).join(", ")}.` : "";
  return `${programme} is the current LevyTate recommendation for ${employee?.name ?? "you"} because ${rationale}${evidence} It is linked to the ${employee?.jobTitle || role?.title || "current"} role and the development context LevyTate already holds.`;
}

function employeeNoApplicationMessage(request: LevyTateAiRequest, text: string) {
  const programme = employeeProgrammeTitle(request);
  if (/draft|application|apply|answer|start|today|next/.test(text)) {
    return `You have not started an application yet. The next useful step is to start an application for ${programme}, or I can help you draft the answers before you submit anything to ${employeeManagerName(request)}.`;
  }
  return `${programme} is the approved programme currently mapped to your role. I can explain why it fits, help you prepare application answers or open the application workflow when you are ready.`;
}

function employeeDirectMessage(request: LevyTateAiRequest) {
  const text = request.userMessage.toLowerCase();
  const application = employeeContextApplication(request);
  const status = application?.status ?? null;
  const manager = employeeManagerName(request);
  const owner = employeeOwnerName(request);
  const programme = employeeProgrammeTitle(request);

  if (/\b(another employee|someone else|other employee|nadia|rachel|show me .*employee)\b/.test(text)) {
    return {
      message: `I can only help with your own apprenticeship journey. Your current ${application ? `application is ${status} with ${owner}` : `recommended programme is ${programme}`}. I can show your application or explain its status.`,
      actions: [
        employeeAction("Open my application", "open_my_applications", "My Application"),
        employeeAction("Explain current status", "ask_follow_up", status ?? "current status"),
      ],
      quickReplies: [],
      suppressApplicationWarning: true,
    };
  }

  if (/\b(explain|why).{0,25}(recommendation|programme|pathway|route)\b/.test(text)) {
    return employeeRecommendationExplanation(request);
  }

  if (/\bwhy\b.{0,40}\b(edit|change|rewrite)\b|\b(can.?t|cannot|can't).{0,30}\b(edit|change)\b/.test(text)) {
    if (!application) return "You can still start and edit a draft because you have not submitted an application yet.";
    if (employeeEditableStatuses.has(status ?? "")) return `You can edit the current application because it is ${status}. When you submit it, the answers will lock for review.`;
    return `You cannot edit this application because it has already been submitted. The submitted version is locked to protect the review record, and the next action sits with ${owner}. Editing becomes available again only if ${manager} requests more information.`;
  }

  const platformTask = employeePlatformTaskMessage(request, text);
  if (platformTask) return platformTask;

  if (/\bwhat happens next\b|\bnext action\b|\bwho owns\b|\bowner\b/.test(text)) {
    if (!application) return `You own the next step. You can start an application for ${programme}, save it as a draft, or ask me to help draft the answers first.`;
    if (status && managerReviewStatuses.has(status)) return `The next action sits with ${manager}. Your application is awaiting manager review, and you do not need to edit anything unless ${manager} asks for more information.`;
    if (status === "Draft") return "You own the next step. Continue the draft, complete the required answers and submit it when you are ready.";
    if (status === "More information requested") return `${manager} has asked for more information. You own the next step: provide the requested response in the reopened application section and resubmit.`;
    if (status && leadReviewStatuses.has(status)) return `Manager approval is complete. The Apprenticeship Lead owns the final review, and you can track progress while they check readiness, programme fit and enrolment timing.`;
    if (status === "Approved for Enrolment") return `Your application is approved for enrolment. The next step is enrolment preparation with ${application.provider || request.workspaceEmployeeContext?.providerProgramme?.providerName || "the approved delivery partner"}.`;
    if (status && /Declined/.test(status)) return "A decision has been recorded. Review the feedback first, then prepare a calm follow-up conversation with your manager or Apprenticeship Lead if you need clarity.";
  }

  if (/\b(manager review|review mean|what does manager)\b/.test(text)) {
    return `Manager review means ${manager} checks role fit, workload, business benefit and whether the team can support the learning time. At this stage your answers are locked, and ${manager} owns the decision.`;
  }

  if (/\b(manager need|information.*manager|what information)\b/.test(text)) {
    if (status === "More information requested") {
      return `${manager} has requested: ${application?.requestedInformation || application?.managerNote || application?.latestComment || "more detail on the application evidence"}. I can help draft a clear response.`;
    }
    if (application) return `${manager} can already see your submitted reason, career goal, support request and manager note. They mainly need to decide whether the programme fits your role, workload and team priorities.`;
    return `${manager} will need a clear reason for interest, how the programme supports your role or future development, and what support you need at work.`;
  }

  if (/\b(time|commitment|hours|duration|off.the.job|off the job)\b/.test(text)) {
    return `The time commitment will be confirmed before enrolment, but apprenticeships normally require regular protected learning time alongside workplace evidence. For ${programme}, your manager will need to agree how learning time fits around your role before the application moves forward.`;
  }

  if (/\bdraft|help me draft|answers|application\b/.test(text)) {
    if (!application) return `I can help draft the application for ${programme}. Start with a short reason for interest, a practical career goal and the support you need from ${manager}.`;
    if (status === "Draft") return "You have a draft in progress. I can help improve the answers before you submit it to your line manager.";
    if (status === "More information requested") return `I can help draft the requested response for ${manager}. Keep it specific to the question asked and explain what evidence or support you can provide.`;
    return `Your application is already submitted, so I cannot help rewrite the answers right now. I can help you prepare for a conversation with ${manager} or explain the review stage.`;
  }

  if (/\btoday\b|\bwhat should i do\b/.test(text)) {
    if (!application) return `Today, review ${programme} and start the application if it still feels right. I can help draft the answers first.`;
    if (status === "Draft") return "Today, continue the draft and complete any missing answers before submitting it to your line manager.";
    if (status && managerReviewStatuses.has(status)) return `Today, you do not need to edit anything. Your application is with ${manager}; you can review your submitted answers or prepare for a manager conversation.`;
    if (status === "More information requested") return `Today, respond to ${manager}'s request for more information and resubmit the application.`;
    return `Today, track the application and review the latest status. The current owner is ${owner}.`;
  }

  return null;
}

function employeeWorkspaceFallback(request: LevyTateAiRequest): LevyTateAiResponse | null {
  if (request.role !== "Employee" || !request.workspaceEmployeeContext?.employee) return null;
  const text = request.userMessage.toLowerCase();
  const direct = employeeDirectMessage(request) ?? (!employeeContextApplication(request) ? employeeNoApplicationMessage(request, text) : null);
  if (!direct) return null;
  const directMessage = typeof direct === "string" ? direct : direct.message;
  const actions = typeof direct === "string" ? employeeActionsForState(request) : direct.actions;
  const isPlatformTask = typeof direct !== "string";
  const status = employeeCurrentStatus(request);
  return {
    source: "mock",
    assistantMessage: directMessage,
    followUpQuestion: null,
    quickReplies: typeof direct === "string" ? employeeQuickRepliesForState(request) : direct.quickReplies,
    shouldShowActions: true,
    shouldShowPathways: false,
    recommendedActions: actions,
    suggestedActions: actions,
    recommendedPathways: [],
    applicationPrefill: status ? null : {
      selectedApprenticeship: employeeProgrammeTitle(request),
      reasonForInterest: "I want to build capability that supports my current role and future development.",
      careerGoal: "Develop stronger skills linked to my role and progression goals.",
      supportRequired: `Protected learning time and practical support from ${employeeManagerName(request)}.`,
    },
    applicationDraft: null,
    providerMatchDraft: null,
    nextStep: actions[0]?.type ?? null,
    safetyNotes: [
      "Employee Copilot response was grounded in the server-scoped employee record and current application state.",
      ...(isPlatformTask ? ["Employee Copilot platform task intent was resolved deterministically."] : []),
      ...(typeof direct !== "string" && "autoExecute" in direct && direct.autoExecute ? ["Employee Copilot platform task action may be executed immediately by the client."] : []),
    ],
    applicationWarning: typeof direct !== "string" && "suppressApplicationWarning" in direct && direct.suppressApplicationWarning ? null : employeeApplicationWarningForState(request, text),
    managerMessageDraft: typeof direct !== "string" && "managerMessageDraft" in direct && direct.managerMessageDraft
      ? direct.managerMessageDraft
      : `Hi ${employeeManagerName(request)}, I wanted to discuss my apprenticeship application and make sure I understand the next step. Could we review the programme fit, workload and support needed?`,
  };
}

function employeeQuickRepliesForState(request: LevyTateAiRequest) {
  const status = employeeCurrentStatus(request);
  if (!status) return ["Explain this programme", "Help me draft my application", "What should I do today?"];
  if (status === "Draft") return ["Review my answers", "What should I do today?", "How much time will it require?"];
  if (managerReviewStatuses.has(status)) return ["Explain manager review", "Who owns the next action?", "Prepare for a manager conversation"];
  if (status === "More information requested") return ["Help draft my response", "What information does my manager need?", "What should I do today?"];
  if (leadReviewStatuses.has(status)) return ["What happens next?", "Who owns the next action?", "Explain final review"];
  if (status === "Approved for Enrolment") return ["View enrolment details", "How much time will it require?", "What should I do today?"];
  return ["Review feedback", "Prepare manager conversation", "What should I do today?"];
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

  const employeeResponse = employeeWorkspaceFallback(request);
  if (employeeResponse) return employeeResponse;

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


