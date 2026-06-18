export type LevyTateRole =
  | "Employee"
  | "Line Manager"
  | "Department Head"
  | "Apprenticeship Lead";

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
};

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
    | "request_provider_matching";
  target?: string;
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

export type LevyTateAiRequest = {
  role: LevyTateRole;
  selectedEmployee?: string;
  selectedSite: string;
  currentSection: string;
  userMessage: string;
  conversationHistory: LevyTateConversationMessage[];
  employerContext: string;
  contextData?: {
    selectedPersona?: PersonaSummary;
    activeApplication?: RequestSummary | null;
    requests?: RequestSummary[];
  };
};

export type LevyTateAiResponse = {
  source: "openai" | "mock";
  assistantMessage: string;
  recommendedActions: LevyTateAiAction[];
  recommendedPathways: LevyTateRecommendedPathway[];
  applicationPrefill: LevyTateApplicationPrefill | null;
  providerMatchDraft: LevyTateProviderMatchDraft | null;
  nextStep: string | null;
  safetyNotes: string[];
  applicationWarning: string | null;
  managerMessageDraft: string | null;
  employeeGuidance?: EmployeeGuidance;
  managerGuidance?: ManagerGuidance;
  departmentGuidance?: DepartmentGuidance;
  leadGuidance?: LeadGuidance;
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

  if (
    (candidate.role !== "Employee" &&
      candidate.role !== "Line Manager" &&
      candidate.role !== "Department Head" &&
      candidate.role !== "Apprenticeship Lead") ||
    typeof candidate.selectedSite !== "string" ||
    typeof candidate.currentSection !== "string" ||
    typeof candidate.userMessage !== "string" ||
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
          ? candidate.contextData.requests.filter(isRequestSummary)
          : undefined,
      }
    : undefined;

  return {
    role: candidate.role,
    selectedEmployee: typeof candidate.selectedEmployee === "string" ? candidate.selectedEmployee : undefined,
    selectedSite: candidate.selectedSite,
    currentSection: candidate.currentSection,
    userMessage: candidate.userMessage,
    conversationHistory: candidate.conversationHistory,
    employerContext: candidate.employerContext,
    contextData,
  };
}
