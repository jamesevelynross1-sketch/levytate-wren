export type LevyTateRole =
  | "Employee"
  | "Line Manager"
  | "Department Head"
  | "Apprenticeship Lead"
  | "LevyTate Admin";

export type LevyTateRequestStatus =
  | "Draft"
  | "Submitted to Line Manager"
  | "Awaiting Manager Review"
  | "Declined by Line Manager"
  | "Approved by Line Manager"
  | "Submitted to Apprenticeship Lead"
  | "Awaiting Final Approval"
  | "Declined by Apprenticeship Lead"
  | "Approved for Enrolment"
  | "Withdrawn"
  | "Completed"
  | "Cancelled";

export type AdviceStandard = {
  name: string;
  level: string;
  suitability: number;
  why: string;
  bestFor: string;
  delivery: string;
};

export type EmployeePrimaryRecommendation = {
  programme: string;
  pathway: string;
  provider: string;
  fit: number;
  why: string;
  draftReason: string;
};

export type EmployeeAlternativeRecommendation = {
  programme: string;
  fit: number;
  why: string;
};

export type EmployeeGuidance = {
  primary: EmployeePrimaryRecommendation;
  alternatives: EmployeeAlternativeRecommendation[];
  supportRequired: string;
  intent?: EmployeeIntent;
  availableNow?: EmployeeAlternativeRecommendation[];
  futureInterests?: EmployeeAlternativeRecommendation[];
};

export type EmployeeIntent =
  | "career_exploration"
  | "data_ai_interest"
  | "automation_interest"
  | "management_interest"
  | "application_help"
  | "change_of_mind"
  | "compare_routes"
  | "manager_conversation"
  | "pathway_explanation"
  | "general_support";

export type InsightSignal = [string, string];

export type ManagerGuidance = {
  title: string;
  summary: string;
  signals: InsightSignal[];
};

export type DepartmentGuidance = {
  title: string;
  summary: string;
  signals: InsightSignal[];
};

export type LeadGuidance = {
  interpretedRole: string;
  workforceNeed: string;
  recommendedStandards: AdviceStandard[];
  alternativeStandards: string[];
  businessRationale: string;
  fundingRoute: string;
  providerMatchingPrompt: string;
};

export type PersonaSummary = {
  name: string;
  role: string;
  department: string;
  site: string;
  manager: string;
  careerGoal: string;
  recommendedPathways: number;
  savedOpportunities: number;
  passportActivities: number;
};

export type RequestSummary = {
  id: number;
  name: string;
  role: string;
  department: string;
  team: string;
  site: string;
  pathway: string;
  manager: string;
  status: LevyTateRequestStatus;
  note: string;
  careerGoal: string;
  supportRequired: string;
  submittedDate: string;
  decisionNotes: string;
};

export type LevyTateConversationMessage = {
  role: "user" | "assistant";
  content: string;
};

export type LevyTateMessageClassification =
  | "new_information"
  | "answer_to_previous_question"
  | "clarification"
  | "change_of_direction"
  | "new_question"
  | "platform_assistance_request";

export type LevyTateConversationRecommendation = {
  title: string;
  confidence: number;
  stage: "possible" | "likely" | "recommended";
  firstDiscussedAt: number;
  lastDiscussedAt: number;
};

export type LevyTateConversationProfile = {
  currentRole: string | null;
  currentDepartment: string | null;
  currentEmployer: string | null;
  careerGoal: string | null;
  reasonForDevelopment: string | null;
  currentSkills: string[];
  aiConfidence: number | null;
  digitalConfidence: number | null;
  interestAreas: string[];
  preferredLearningStyle: string | null;
  managementAspirations: string | null;
  currentApplicationStatus: string | null;
  recommendedPathways: LevyTateConversationRecommendation[];
  confidence: {
    role: number;
    careerGoal: number;
    technicalConfidence: number;
    managementAmbition: number;
    overall: number;
  };
  questionsAlreadyAsked: string[];
  questionsStillToAsk: string[];
  conversationSummary: string;
  exchangeCount: number;
  latestMessageClassification: LevyTateMessageClassification;
};

export type LevyTateAiAction = {
  label: string;
  type:
    | "open_pathway"
    | "start_application"
    | "open_my_applications"
    | "open_review_queue"
    | "open_team_development"
    | "open_department_analytics"
    | "open_site_breakdown"
    | "open_reporting"
    | "open_final_approvals"
    | "request_provider_matching"
    | "compare_routes"
    | "save_interest"
    | "prepare_manager_message"
    | "prepare_approval_rationale"
    | "draft_application_reason"
    | "create_admin_follow_up_task"
    | "ask_follow_up";
  target?: string;
  requiresConfirmation?: boolean;
};

export type LevyTateRecommendedPathway = {
  title: string;
  reason: string;
  availability: "approved" | "not_available" | "alternative";
  fit?: number;
  provider?: string;
  pathway?: string;
  standard?: string;
};

export type LevyTateApplicationPrefill = {
  selectedApprenticeship?: string;
  reasonForInterest?: string;
  careerGoal?: string;
  supportRequired?: string;
};

export type LevyTateProviderMatchDraft = {
  roleFamily: string;
  recommendedStandard: string;
  rationale: string;
  fundingRoute: string;
  notes: string;
};

export type LevyTateAiWorkspaceContext = {
  employerName?: string;
  selectedSite?: string;
  activeModule?: string;
};

export type LevyTateAiRoleMappingContext = {
  roleTitle: string;
  primaryPathway: string;
  alternativePathways?: string[];
  businessRationale?: string;
};

export type LevyTateAiProviderContext = {
  providerName: string;
  sectors?: string[];
  deliveryModel?: string[];
  verificationStatus?: string;
};

export type LevyTateAiPathwayContext = {
  title: string;
  standard?: string;
  status?: string;
  deliveryModel?: string;
};

export type LevyTateAiRequest = {
  role: LevyTateRole;
  userRole?: LevyTateRole;
  selectedEmployee?: string;
  selectedSite: string;
  currentSection: string;
  userMessage: string;
  conversationHistory: LevyTateConversationMessage[];
  conversationProfile?: LevyTateConversationProfile;
  employerContext: string;
  currentWorkspace?: LevyTateAiWorkspaceContext;
  currentApplication?: RequestSummary | null;
  roleMappings?: LevyTateAiRoleMappingContext[];
  providerCatalogue?: LevyTateAiProviderContext[];
  availablePathways?: LevyTateAiPathwayContext[];
  contextData?: {
    selectedPersona?: PersonaSummary;
    activeApplication?: RequestSummary | null;
    requests?: RequestSummary[];
  };
};

export type LevyTateAiResponse = {
  source: "openai" | "mock";
  assistantMessage: string;
  followUpQuestion?: string | null;
  quickReplies?: string[];
  recommendedActions: LevyTateAiAction[];
  suggestedActions?: LevyTateAiAction[];
  recommendedPathways: LevyTateRecommendedPathway[];
  applicationPrefill: LevyTateApplicationPrefill | null;
  applicationDraft?: LevyTateApplicationPrefill | null;
  providerMatchDraft: LevyTateProviderMatchDraft | null;
  nextStep: string | null;
  safetyNotes: string[];
  applicationWarning: string | null;
  managerMessageDraft: string | null;
  employeeGuidance?: EmployeeGuidance;
  managerGuidance?: ManagerGuidance;
  departmentGuidance?: DepartmentGuidance;
  leadGuidance?: LeadGuidance;
  conversationProfile?: LevyTateConversationProfile;
  messageClassification?: LevyTateMessageClassification;
};

function isConversationMessage(value: unknown): value is LevyTateConversationMessage {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<LevyTateConversationMessage>;
  return (candidate.role === "user" || candidate.role === "assistant") && typeof candidate.content === "string";
}

function isRequestStatus(value: unknown): value is LevyTateRequestStatus {
  return typeof value === "string" && [
    "Draft",
    "Submitted to Line Manager",
    "Awaiting Manager Review",
    "Declined by Line Manager",
    "Approved by Line Manager",
    "Submitted to Apprenticeship Lead",
    "Awaiting Final Approval",
    "Declined by Apprenticeship Lead",
    "Approved for Enrolment",
    "Withdrawn",
    "Completed",
    "Cancelled",
  ].includes(value);
}

function isRole(value: unknown): value is LevyTateRole {
  return value === "Employee" ||
    value === "Line Manager" ||
    value === "Department Head" ||
    value === "Apprenticeship Lead" ||
    value === "LevyTate Admin";
}

function cleanStringArray(value: unknown, limit = 8) {
  return Array.isArray(value)
    ? value
        .filter((item): item is string => typeof item === "string" && Boolean(item.trim()))
        .slice(0, limit)
        .map((item) => item.trim().slice(0, 180))
    : undefined;
}

function parseConversationProfile(value: unknown): LevyTateConversationProfile | undefined {
  if (!value || typeof value !== "object") return undefined;
  const candidate = value as Partial<LevyTateConversationProfile>;
  const confidence = candidate.confidence;
  const classification = candidate.latestMessageClassification;
  const validClassification = classification === "new_information" ||
    classification === "answer_to_previous_question" ||
    classification === "clarification" ||
    classification === "change_of_direction" ||
    classification === "new_question" ||
    classification === "platform_assistance_request";
  if (!confidence || typeof confidence !== "object" || !validClassification) return undefined;

  const nullableString = (item: unknown) => typeof item === "string" && item.trim() ? item.trim().slice(0, 300) : null;
  const score = (item: unknown) => typeof item === "number" && Number.isFinite(item) ? Math.max(0, Math.min(100, Math.round(item))) : 0;
  const recommendations = Array.isArray(candidate.recommendedPathways)
    ? candidate.recommendedPathways.slice(0, 8).flatMap((item) => {
        if (!item || typeof item !== "object") return [];
        const recommendation = item as Partial<LevyTateConversationRecommendation>;
        if (typeof recommendation.title !== "string" || !recommendation.title.trim()) return [];
        const stage: LevyTateConversationRecommendation["stage"] = recommendation.stage === "likely" || recommendation.stage === "recommended" ? recommendation.stage : "possible";
        return [{
          title: recommendation.title.trim().slice(0, 180),
          confidence: score(recommendation.confidence),
          stage,
          firstDiscussedAt: typeof recommendation.firstDiscussedAt === "number" ? Math.max(1, Math.round(recommendation.firstDiscussedAt)) : 1,
          lastDiscussedAt: typeof recommendation.lastDiscussedAt === "number" ? Math.max(1, Math.round(recommendation.lastDiscussedAt)) : 1,
        }];
      })
    : [];

  return {
    currentRole: nullableString(candidate.currentRole),
    currentDepartment: nullableString(candidate.currentDepartment),
    currentEmployer: nullableString(candidate.currentEmployer),
    careerGoal: nullableString(candidate.careerGoal),
    reasonForDevelopment: nullableString(candidate.reasonForDevelopment),
    currentSkills: cleanStringArray(candidate.currentSkills, 12) ?? [],
    aiConfidence: candidate.aiConfidence === null ? null : score(candidate.aiConfidence),
    digitalConfidence: candidate.digitalConfidence === null ? null : score(candidate.digitalConfidence),
    interestAreas: cleanStringArray(candidate.interestAreas, 12) ?? [],
    preferredLearningStyle: nullableString(candidate.preferredLearningStyle),
    managementAspirations: nullableString(candidate.managementAspirations),
    currentApplicationStatus: nullableString(candidate.currentApplicationStatus),
    recommendedPathways: recommendations,
    confidence: {
      role: score(confidence.role),
      careerGoal: score(confidence.careerGoal),
      technicalConfidence: score(confidence.technicalConfidence),
      managementAmbition: score(confidence.managementAmbition),
      overall: score(confidence.overall),
    },
    questionsAlreadyAsked: cleanStringArray(candidate.questionsAlreadyAsked, 16) ?? [],
    questionsStillToAsk: cleanStringArray(candidate.questionsStillToAsk, 12) ?? [],
    conversationSummary: nullableString(candidate.conversationSummary) ?? "No profile details captured yet.",
    exchangeCount: typeof candidate.exchangeCount === "number" ? Math.max(0, Math.min(50, Math.round(candidate.exchangeCount))) : 0,
    latestMessageClassification: classification,
  };
}

function parseRoleMappings(value: unknown): LevyTateAiRoleMappingContext[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.slice(0, 20).flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const candidate = item as Partial<LevyTateAiRoleMappingContext>;
    if (typeof candidate.roleTitle !== "string" || typeof candidate.primaryPathway !== "string") return [];
    return [{
      roleTitle: candidate.roleTitle.trim().slice(0, 160),
      primaryPathway: candidate.primaryPathway.trim().slice(0, 180),
      alternativePathways: cleanStringArray(candidate.alternativePathways),
      businessRationale: typeof candidate.businessRationale === "string" ? candidate.businessRationale.trim().slice(0, 500) : undefined,
    }];
  });
}

function parseProviderCatalogue(value: unknown): LevyTateAiProviderContext[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.slice(0, 30).flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const candidate = item as Partial<LevyTateAiProviderContext>;
    if (typeof candidate.providerName !== "string") return [];
    return [{
      providerName: candidate.providerName.trim().slice(0, 160),
      sectors: cleanStringArray(candidate.sectors),
      deliveryModel: cleanStringArray(candidate.deliveryModel),
      verificationStatus: typeof candidate.verificationStatus === "string" ? candidate.verificationStatus.trim().slice(0, 80) : undefined,
    }];
  });
}

function parseAvailablePathways(value: unknown): LevyTateAiPathwayContext[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.slice(0, 30).flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const candidate = item as Partial<LevyTateAiPathwayContext>;
    if (typeof candidate.title !== "string") return [];
    return [{
      title: candidate.title.trim().slice(0, 180),
      standard: typeof candidate.standard === "string" ? candidate.standard.trim().slice(0, 180) : undefined,
      status: typeof candidate.status === "string" ? candidate.status.trim().slice(0, 80) : undefined,
      deliveryModel: typeof candidate.deliveryModel === "string" ? candidate.deliveryModel.trim().slice(0, 120) : undefined,
    }];
  });
}

function isPersonaSummary(value: unknown): value is PersonaSummary {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<PersonaSummary>;
  return typeof candidate.name === "string" &&
    typeof candidate.role === "string" &&
    typeof candidate.department === "string" &&
    typeof candidate.site === "string" &&
    typeof candidate.manager === "string" &&
    typeof candidate.careerGoal === "string" &&
    typeof candidate.recommendedPathways === "number" &&
    typeof candidate.savedOpportunities === "number" &&
    typeof candidate.passportActivities === "number";
}

function isRequestSummary(value: unknown): value is RequestSummary {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<RequestSummary>;
  return typeof candidate.id === "number" &&
    typeof candidate.name === "string" &&
    typeof candidate.role === "string" &&
    typeof candidate.department === "string" &&
    typeof candidate.team === "string" &&
    typeof candidate.site === "string" &&
    typeof candidate.pathway === "string" &&
    typeof candidate.manager === "string" &&
    isRequestStatus(candidate.status) &&
    typeof candidate.note === "string" &&
    typeof candidate.careerGoal === "string" &&
    typeof candidate.supportRequired === "string" &&
    typeof candidate.submittedDate === "string" &&
    typeof candidate.decisionNotes === "string";
}

export function parseLevyTateAiRequest(payload: unknown): LevyTateAiRequest | null {
  if (!payload || typeof payload !== "object") return null;

  const candidate = payload as Partial<LevyTateAiRequest>;
  const role = isRole(candidate.userRole) ? candidate.userRole : candidate.role;

  if (
    !isRole(role) ||
    typeof candidate.selectedSite !== "string" ||
    typeof candidate.currentSection !== "string" ||
    typeof candidate.userMessage !== "string" ||
    !candidate.userMessage.trim() ||
    typeof candidate.employerContext !== "string" ||
    !Array.isArray(candidate.conversationHistory) ||
    !candidate.conversationHistory.every(isConversationMessage)
  ) {
    return null;
  }

  const contextData = candidate.contextData && typeof candidate.contextData === "object"
    ? {
        selectedPersona: isPersonaSummary(candidate.contextData.selectedPersona) ? candidate.contextData.selectedPersona : undefined,
        activeApplication:
          candidate.contextData.activeApplication === null
            ? null
            : isRequestSummary(candidate.contextData.activeApplication)
              ? candidate.contextData.activeApplication
              : undefined,
        requests: Array.isArray(candidate.contextData.requests)
          ? candidate.contextData.requests.filter(isRequestSummary).slice(0, 30)
          : undefined,
      }
    : undefined;

  return {
    role,
    userRole: role,
    selectedEmployee: typeof candidate.selectedEmployee === "string" ? candidate.selectedEmployee.trim().slice(0, 160) : undefined,
    selectedSite: candidate.selectedSite.trim().slice(0, 180),
    currentSection: candidate.currentSection.trim().slice(0, 120),
    userMessage: candidate.userMessage.trim().slice(0, 2000),
    conversationHistory: candidate.conversationHistory.slice(-12).map((message) => ({
      role: message.role,
      content: message.content.trim().slice(0, 2000),
    })),
    conversationProfile: parseConversationProfile(candidate.conversationProfile),
    employerContext: candidate.employerContext.trim().slice(0, 200),
    currentWorkspace: candidate.currentWorkspace && typeof candidate.currentWorkspace === "object"
      ? {
          employerName: typeof candidate.currentWorkspace.employerName === "string" ? candidate.currentWorkspace.employerName.trim().slice(0, 160) : undefined,
          selectedSite: typeof candidate.currentWorkspace.selectedSite === "string" ? candidate.currentWorkspace.selectedSite.trim().slice(0, 180) : undefined,
          activeModule: typeof candidate.currentWorkspace.activeModule === "string" ? candidate.currentWorkspace.activeModule.trim().slice(0, 120) : undefined,
        }
      : undefined,
    currentApplication:
      candidate.currentApplication === null
        ? null
        : isRequestSummary(candidate.currentApplication)
          ? candidate.currentApplication
          : undefined,
    roleMappings: parseRoleMappings(candidate.roleMappings),
    providerCatalogue: parseProviderCatalogue(candidate.providerCatalogue),
    availablePathways: parseAvailablePathways(candidate.availablePathways),
    contextData,
  };
}
