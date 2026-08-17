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
  | "More information requested"
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

export type LeadProgrammeMatch = {
  providerName: string;
  programmeName: string;
  linkedStandard: string;
  matchScore: number;
  verificationStatus: string;
  whyProgramme: string;
};

export type LeadGuidance = {
  interpretedRole: string;
  workforceNeed: string;
  recommendedStandards: AdviceStandard[];
  alternativeStandards: string[];
  businessRationale: string;
  fundingRoute: string;
  providerMatchingPrompt: string;
  programmeMatch?: LeadProgrammeMatch;
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
    | "open_provider_relationships"
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
  scoreDelta?: number;
  confidence?: number;
  evidence?: string[];
  provider?: string;
  pathway?: string;
  standard?: string;
};

export type LevyTateRecommendationEvidence = {
  id: string;
  label: string;
  source: "profile" | "conversation" | "role_mapping" | "platform_rule";
  weight: number;
};

export type LevyTateCapabilityScore = {
  domain: string;
  score: number;
  evidence: string[];
  missingEvidence: string[];
};

export type LevyTateCapabilityFit = {
  domain: string;
  score: number;
  weighting: number;
};

export type LevyTateOperationalCopilotIntent =
  | "learners_needing_attention"
  | "highest_risk_actions"
  | "applications_awaiting_review"
  | "applications_returned"
  | "applications_approved"
  | "application_status"
  | "learners_behind_target"
  | "learners_without_recent_progress"
  | "learners_ending_before"
  | "overdue_reviews"
  | "manager_check_ins"
  | "employee_review_status"
  | "employee_support"
  | "ready_to_enrol"
  | "pre_enrolment_blockers"
  | "active_breaks"
  | "assessment_readiness"
  | "operational_actions"
  | "provider_operational_summary"
  | "programme_operational_summary"
  | "programme_directory"
  | "team_summary"
  | "access_boundary";

export type LevyTateOperationalCopilotFilters = {
  progressPosition?: "Slightly behind" | "Significantly behind";
  dateBefore?: string;
  reviewType?: "provider_review" | "l_and_d_check_in" | "manager_check_in";
  provider?: string;
  programme?: string;
  owner?: string;
  status?: string;
  priority?: string;
  dueState?: string;
  actionType?: string;
  blocker?: string;
  assessmentState?: "approaching" | "ready" | "preparation" | "in_assessment" | "all";
  employeeName?: string;
  applicationState?: "awaiting_review" | "returned" | "approved" | "active";
  reviewDueState?: "overdue" | "due_soon" | "latest";
  query?: string;
  level?: string;
  deliveryModel?: string;
  region?: string;
};

export type LevyTateOperationalCopilotContext = {
  activeIntent: LevyTateOperationalCopilotIntent;
  filters: LevyTateOperationalCopilotFilters;
  resultKeys?: string[];
  evaluatedAt: string;
};

export type LevyTateCopilotResultType =
  | "learner_results"
  | "application_results"
  | "provider_results"
  | "programme_results"
  | "operational_action_results"
  | "summary_metrics"
  | "no_results"
  | "clarification_required"
  | "access_boundary"
  | "data_unavailable";

export type LevyTateCopilotResultColumn = {
  key: string;
  label: string;
  align?: "left" | "right";
};

export type LevyTateCopilotResultRow = {
  key: string;
  cells: Record<string, string | number | null>;
  actions?: Array<{ label: string; url: string }>;
};

export type LevyTateCopilotStructuredResult = {
  type: LevyTateCopilotResultType;
  title: string;
  columns: LevyTateCopilotResultColumn[];
  rows: LevyTateCopilotResultRow[];
  totalCount: number;
  truncated: boolean;
  interpretation?: string;
  emptyMessage?: string;
  viewAllUrl?: string;
  dataSource: "supabase";
  dataLabel: "Live LevyTate data";
  evaluatedAt: string;
  timings: {
    intentClassificationMs: number;
    managerScopeResolutionMs?: number;
    dataRetrievalMs: number;
    responsePreparationMs: number;
    totalMs: number;
  };
};

export type LevyTateCareerStage =
  | "Entry"
  | "Operational"
  | "Professional"
  | "Senior Professional"
  | "Team Leader"
  | "Manager"
  | "Senior Manager"
  | "Head Of"
  | "Director"
  | "Executive";

export type LevyTateRecommendationCategory =
  | "Strong Recommendation"
  | "Development Opportunity"
  | "Future Progression"
  | "Strategic Discussion Required";

export type LevyTateRoleFamily =
  | "Field Operations"
  | "Arboriculture"
  | "Grounds Maintenance"
  | "Land Based"
  | "Commercial"
  | "Procurement"
  | "Finance"
  | "HR"
  | "Learning & Development"
  | "IT"
  | "Cyber"
  | "Digital"
  | "Data"
  | "Engineering"
  | "Manufacturing"
  | "Customer Service"
  | "Leadership"
  | "Executive"
  | "Operations"
  | "Project Delivery"
  | "Business Analysis"
  | "Health & Safety"
  | "Environment"
  | "Quality"
  | "Construction"
  | "Utilities"
  | "Transport"
  | "Fleet"
  | "Administration"
  | "Marketing"
  | "Education";

export type LevyTateDevelopmentObjective =
  | "Current role capability"
  | "Management progression"
  | "Technical specialism"
  | "Commercial capability"
  | "AI adoption"
  | "Productivity improvement"
  | "Succession preparation"
  | "Compliance improvement"
  | "Transformation support"
  | "Career exploration";

export type LevyTateExcludedPathway = {
  title: string;
  reason: string;
};

export type LevyTateRecommendationEnvelope = {
  careerStage: LevyTateCareerStage;
  minimumLevel: number | null;
  maximumLevel: number | null;
  label: string;
  excludedRoutes: string[];
  strategicOnly: boolean;
};

export type LevyTateQualificationAwareness = {
  highestQualification?: string | null;
  previousApprenticeshipLevel?: number | null;
  professionalMemberships?: string[];
  charteredStatus?: string | null;
  existingCertifications?: string[];
  status: "not_collected";
  missingFields: string[];
};

export type LevyTateStrategicSignal = {
  category:
    | "current_capability"
    | "future_capability"
    | "organisation_priority"
    | "business_strategy"
    | "provider_capability"
    | "programme_suitability"
    | "delivery_fit";
  label: string;
  score: number;
  evidence: string[];
};

export type LevyTateStrategicRecommendation = {
  currentBestFit: string | null;
  futureDevelopmentOpportunity: string | null;
  strategicRecommendation: string | null;
  alternativeRoute: string | null;
  confidence: number;
  businessImpact: string;
  organisationBenefit: string;
  employeeBenefit: string;
  whyRecommended: string;
  whyOtherRoutesRankedLower: string[];
  missingEvidence: string[];
  suggestedQuestions: string[];
  organisationPrioritiesInfluenced: string[];
  employeeCapabilitiesInfluenced: string[];
};

export type LevyTatePlatformRecommendation = {
  pathwayId: string;
  title: string;
  fitScore: number;
  scoreDelta: number;
  confidence: number;
  rationale: string;
  evidence: LevyTateRecommendationEvidence[];
  missingEvidence: string[];
  capabilityFit: LevyTateCapabilityFit[];
  strategicRole: "current_best_fit" | "future_development" | "strategic_recommendation" | "alternative_route" | "supporting_option";
  strategicSignals: LevyTateStrategicSignal[];
  businessImpact: string;
  organisationBenefit: string;
  employeeBenefit: string;
  providerRationale: string;
  programmeRationale: string;
  whyRankedLower: string[];
  suggestedQuestions: string[];
  availability: "approved" | "role_fit_review" | "not_available";
  eligibility: "eligible" | "requires_review" | "ineligible";
  providerAvailability: "mapped" | "matching_available" | "unconfirmed";
  careerStage: LevyTateCareerStage;
  recommendationCategory: LevyTateRecommendationCategory;
  careerStageFit: "inside_envelope" | "development_stretch" | "outside_envelope" | "strategic_only";
  credibilityNotes: string[];
  roleFamilies: LevyTateRoleFamily[];
  developmentObjective: LevyTateDevelopmentObjective;
  consultantReasoning: string;
};

export type LevyTateRecommendationResult = {
  recommendations: LevyTatePlatformRecommendation[];
  topRecommendation: LevyTatePlatformRecommendation | null;
  recommendationVersion: string;
  confidence: number;
  revealThreshold: number;
  shouldRevealRecommendations: boolean;
  evidenceChanged: boolean;
  capabilityProfile: LevyTateCapabilityScore[];
  currentCapabilityProfile: LevyTateCapabilityScore[];
  futureCapabilityProfile: LevyTateCapabilityScore[];
  careerStage: LevyTateCareerStage;
  roleFamily: LevyTateRoleFamily;
  secondaryRoleFamilies: LevyTateRoleFamily[];
  developmentObjective: LevyTateDevelopmentObjective;
  apprenticeshipAppropriate: boolean;
  consultantReasoning: string;
  excludedPathways: LevyTateExcludedPathway[];
  recommendationEnvelope: LevyTateRecommendationEnvelope;
  qualificationAwareness: LevyTateQualificationAwareness;
  strategicDiscussion: string | null;
  strategicRecommendation: LevyTateStrategicRecommendation | null;
};

export type LevyTateApplicationPrefill = {
  selectedApprenticeship?: string;
  reasonForInterest?: string;
  careerGoal?: string;
  supportRequired?: string;
};

export type LevyTateProviderMatchDraft = {
  roleFamily: string;
  recommendedProgramme: string;
  providerName: string;
  linkedStandard: string;
  matchScore: number;
  verificationStatus: string;
  rationale: string;
  fundingRoute: string;
  notes: string;
  recommendedStandard?: string;
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
  deliveryModels?: string[];
  verificationStatus?: string;
};

export type LevyTateAiPathwayContext = {
  title: string;
  standard?: string;
  status?: string;
  deliveryModel?: string;
};

export type LevyTateEmployerPriorityContext = {
  name: string;
  importance: "Critical" | "High" | "Medium";
};

export type LevyTateEmployeeDiscoveryContext = {
  roleTitle?: string;
  department?: string;
  responsibilities: string[];
  currentSkills: string[];
  businessFunctions: string[];
  currentCapabilities: string[];
  apprenticeshipIndicators: string[];
  aiOpportunities: string[];
  dataOpportunities: string[];
  automationOpportunities: string[];
  futureCapabilities: string[];
  stage: "role_context" | "future_capability" | "recommendation_ready";
};

export type LevyTateWorkspaceEmployeeContext = {
  resolution: "selected_employee" | "matched_by_name" | "multiple_matches" | "not_found" | "none";
  searchText?: string;
  missingData: string[];
  matchedEmployees?: Array<{
    id: string;
    name: string;
    jobTitle: string;
    department: string;
    site: string;
  }>;
  employee?: {
    id: string;
    name: string;
    employeeNumber?: string;
    jobTitle: string;
    division?: string;
    department: string;
    team?: string;
    manager?: string;
    location?: string;
    platformRole?: string;
  };
  role?: {
    title: string;
    businessArea?: string;
    careerLevel?: string;
    skillsTags?: string[];
    progression?: string[];
    preferredPathway?: string;
    alternativePathways?: string[];
    businessRationale?: string;
  };
  application?: {
    id: string;
    status: LevyTateRequestStatus;
    currentOwner?: string;
    currentOwnerName?: string;
    pathway: string;
    provider?: string;
    submittedDate?: string;
    reason?: string;
    careerGoal?: string;
    supportRequired?: string;
    managerNote?: string;
    latestComment?: string;
    requestedInformation?: string;
    enrolmentStatus?: string;
    approvalHistory?: string[];
  } | null;
  development?: LevyTateEmployeeDiscoveryContext;
  recommendation?: {
    topRecommendation?: string;
    fitScore?: number;
    confidence?: number;
    rationale?: string;
    evidence?: string[];
    currentCapabilityProfile?: LevyTateCapabilityScore[];
    futureCapabilityProfile?: LevyTateCapabilityScore[];
  } | null;
  providerProgramme?: {
    providerName?: string;
    programmeName?: string;
    linkedStandard?: string;
    verificationStatus?: string;
    deliveryModels?: string[];
  } | null;
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
  previousRecommendationResult?: LevyTateRecommendationResult | null;
  employerContext: string;
  currentWorkspace?: LevyTateAiWorkspaceContext;
  currentApplication?: RequestSummary | null;
  roleMappings?: LevyTateAiRoleMappingContext[];
  providerCatalogue?: LevyTateAiProviderContext[];
  availablePathways?: LevyTateAiPathwayContext[];
  employerPriorities?: LevyTateEmployerPriorityContext[];
  employeeDiscovery?: LevyTateEmployeeDiscoveryContext;
  workspaceEmployeeContext?: LevyTateWorkspaceEmployeeContext;
  preferredStandardId?: string;
  operationalContext?: LevyTateOperationalCopilotContext;
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
  shouldShowPathways?: boolean;
  shouldShowActions?: boolean;
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
  recommendationResult?: LevyTateRecommendationResult;
  executionMode?: "deterministic" | "model_assisted" | "fallback";
  structuredResult?: LevyTateCopilotStructuredResult;
  operationalContext?: LevyTateOperationalCopilotContext;
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
    "More information requested",
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

const operationalIntents: LevyTateOperationalCopilotIntent[] = [
  "learners_needing_attention",
  "highest_risk_actions",
  "applications_awaiting_review",
  "applications_returned",
  "applications_approved",
  "application_status",
  "learners_behind_target",
  "learners_without_recent_progress",
  "learners_ending_before",
  "overdue_reviews",
  "manager_check_ins",
  "employee_review_status",
  "employee_support",
  "ready_to_enrol",
  "pre_enrolment_blockers",
  "active_breaks",
  "assessment_readiness",
  "operational_actions",
  "provider_operational_summary",
  "programme_operational_summary",
  "team_summary",
  "access_boundary",
];

function parseOperationalContext(value: unknown): LevyTateOperationalCopilotContext | undefined {
  if (!value || typeof value !== "object") return undefined;
  const candidate = value as Partial<LevyTateOperationalCopilotContext>;
  if (!candidate.activeIntent || !operationalIntents.includes(candidate.activeIntent)) return undefined;
  const filters = candidate.filters && typeof candidate.filters === "object"
    ? candidate.filters as LevyTateOperationalCopilotFilters
    : {};
  const progressPosition = filters.progressPosition === "Slightly behind" || filters.progressPosition === "Significantly behind"
    ? filters.progressPosition
    : undefined;
  const reviewType = filters.reviewType === "provider_review" || filters.reviewType === "l_and_d_check_in" || filters.reviewType === "manager_check_in"
    ? filters.reviewType
    : undefined;
  const assessmentState = filters.assessmentState === "approaching" || filters.assessmentState === "ready" || filters.assessmentState === "preparation" || filters.assessmentState === "in_assessment" || filters.assessmentState === "all"
    ? filters.assessmentState
    : undefined;
  const clean = (item: unknown, limit = 160) => typeof item === "string" ? item.trim().slice(0, limit) || undefined : undefined;
  return {
    activeIntent: candidate.activeIntent,
    filters: {
      progressPosition,
      dateBefore: clean(filters.dateBefore, 10),
      reviewType,
      provider: clean(filters.provider),
      programme: clean(filters.programme),
      owner: clean(filters.owner),
      status: clean(filters.status),
      priority: clean(filters.priority),
      dueState: clean(filters.dueState),
      actionType: clean(filters.actionType),
      blocker: clean(filters.blocker),
      assessmentState,
      employeeName: clean(filters.employeeName, 120),
      applicationState: filters.applicationState === "awaiting_review" || filters.applicationState === "returned" || filters.applicationState === "approved" || filters.applicationState === "active" ? filters.applicationState : undefined,
      reviewDueState: filters.reviewDueState === "overdue" || filters.reviewDueState === "due_soon" || filters.reviewDueState === "latest" ? filters.reviewDueState : undefined,
    },
    resultKeys: cleanStringArray(candidate.resultKeys, 25),
    evaluatedAt: typeof candidate.evaluatedAt === "string" ? candidate.evaluatedAt.slice(0, 40) : "",
  };
}

const levyTateRoleFamilies: LevyTateRoleFamily[] = [
  "Field Operations", "Arboriculture", "Grounds Maintenance", "Land Based", "Commercial", "Procurement", "Finance", "HR", "Learning & Development", "IT", "Cyber", "Digital", "Data", "Engineering", "Manufacturing", "Customer Service", "Leadership", "Executive", "Operations", "Project Delivery", "Business Analysis", "Health & Safety", "Environment", "Quality", "Construction", "Utilities", "Transport", "Fleet", "Administration", "Marketing", "Education",
];

function cleanRoleFamily(value: unknown): LevyTateRoleFamily | null {
  return typeof value === "string" && levyTateRoleFamilies.includes(value as LevyTateRoleFamily)
    ? value as LevyTateRoleFamily
    : null;
}

function cleanRoleFamilies(value: unknown, limit = 6): LevyTateRoleFamily[] {
  return Array.isArray(value)
    ? value.flatMap((item) => {
        const family = cleanRoleFamily(item);
        return family ? [family] : [];
      }).slice(0, limit)
    : [];
}

function cleanDevelopmentObjective(value: unknown): LevyTateDevelopmentObjective {
  return value === "Current role capability" ||
    value === "Management progression" ||
    value === "Technical specialism" ||
    value === "Commercial capability" ||
    value === "AI adoption" ||
    value === "Productivity improvement" ||
    value === "Succession preparation" ||
    value === "Compliance improvement" ||
    value === "Transformation support" ||
    value === "Career exploration"
    ? value
    : "Career exploration";
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
    const candidate = item as Partial<LevyTateAiProviderContext> & { deliveryModel?: string[] };
    if (typeof candidate.providerName !== "string") return [];
    return [{
      providerName: candidate.providerName.trim().slice(0, 160),
      sectors: cleanStringArray(candidate.sectors),
      deliveryModels: cleanStringArray(candidate.deliveryModels ?? candidate.deliveryModel),
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

function parseEmployerPriorities(value: unknown): LevyTateEmployerPriorityContext[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.slice(0, 3).flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const candidate = item as Partial<LevyTateEmployerPriorityContext>;
    if (typeof candidate.name !== "string") return [];
    const importance: LevyTateEmployerPriorityContext["importance"] =
      candidate.importance === "Critical" || candidate.importance === "Medium" ? candidate.importance : "High";
    return [{ name: candidate.name.trim().slice(0, 160), importance }];
  });
}

function parseEmployeeDiscovery(value: unknown): LevyTateEmployeeDiscoveryContext | undefined {
  if (!value || typeof value !== "object") return undefined;
  const candidate = value as Partial<LevyTateEmployeeDiscoveryContext>;
  const stage: LevyTateEmployeeDiscoveryContext["stage"] =
    candidate.stage === "future_capability" || candidate.stage === "recommendation_ready" ? candidate.stage : "role_context";
  return {
    roleTitle: typeof candidate.roleTitle === "string" && candidate.roleTitle.trim() ? candidate.roleTitle.trim().slice(0, 160) : undefined,
    department: typeof candidate.department === "string" && candidate.department.trim() ? candidate.department.trim().slice(0, 160) : undefined,
    responsibilities: cleanStringArray(candidate.responsibilities, 12) ?? [],
    currentSkills: cleanStringArray(candidate.currentSkills, 12) ?? [],
    businessFunctions: cleanStringArray(candidate.businessFunctions, 12) ?? [],
    currentCapabilities: cleanStringArray(candidate.currentCapabilities, 12) ?? [],
    apprenticeshipIndicators: cleanStringArray(candidate.apprenticeshipIndicators, 12) ?? [],
    aiOpportunities: cleanStringArray(candidate.aiOpportunities, 12) ?? [],
    dataOpportunities: cleanStringArray(candidate.dataOpportunities, 12) ?? [],
    automationOpportunities: cleanStringArray(candidate.automationOpportunities, 12) ?? [],
    futureCapabilities: cleanStringArray(candidate.futureCapabilities, 12) ?? [],
    stage,
  };
}

function parseWorkspaceEmployeeContext(value: unknown): LevyTateWorkspaceEmployeeContext | undefined {
  if (!value || typeof value !== "object") return undefined;
  const candidate = value as Partial<LevyTateWorkspaceEmployeeContext>;
  const text = (item: unknown, limit = 240) => typeof item === "string" && item.trim()
    ? item.trim().slice(0, limit)
    : undefined;
  const numberScore = (item: unknown) => typeof item === "number" && Number.isFinite(item)
    ? Math.max(0, Math.min(100, Math.round(item)))
    : undefined;
  const resolution: LevyTateWorkspaceEmployeeContext["resolution"] =
    candidate.resolution === "selected_employee" ||
    candidate.resolution === "matched_by_name" ||
    candidate.resolution === "multiple_matches" ||
    candidate.resolution === "not_found"
      ? candidate.resolution
      : "none";
  const parseCapabilityScores = (profile: unknown): LevyTateCapabilityScore[] | undefined => Array.isArray(profile)
    ? profile.slice(0, 12).flatMap((item) => {
        if (!item || typeof item !== "object") return [];
        const score = item as Partial<LevyTateCapabilityScore>;
        const domain = text(score.domain, 80);
        const value = numberScore(score.score);
        if (!domain || value === undefined) return [];
        return [{
          domain,
          score: value,
          evidence: cleanStringArray(score.evidence, 6) ?? [],
          missingEvidence: cleanStringArray(score.missingEvidence, 6) ?? [],
        }];
      })
    : undefined;

  return {
    resolution,
    searchText: text(candidate.searchText, 160),
    missingData: cleanStringArray(candidate.missingData, 12) ?? [],
    matchedEmployees: Array.isArray(candidate.matchedEmployees)
      ? candidate.matchedEmployees.slice(0, 8).flatMap((item) => {
          if (!item || typeof item !== "object") return [];
          const employee = item as NonNullable<LevyTateWorkspaceEmployeeContext["matchedEmployees"]>[number];
          const name = text(employee.name, 120);
          if (!name) return [];
          return [{
            id: text(employee.id, 80) ?? name,
            name,
            jobTitle: text(employee.jobTitle, 160) ?? "Role missing",
            department: text(employee.department, 160) ?? "Department missing",
            site: text(employee.site, 160) ?? "Location missing",
          }];
        })
      : undefined,
    employee: candidate.employee && typeof candidate.employee === "object"
      ? {
          id: text(candidate.employee.id, 80) ?? "",
          name: text(candidate.employee.name, 120) ?? "",
          employeeNumber: text(candidate.employee.employeeNumber, 80),
          jobTitle: text(candidate.employee.jobTitle, 160) ?? "",
          division: text(candidate.employee.division, 160),
          department: text(candidate.employee.department, 160) ?? "",
          team: text(candidate.employee.team, 160),
          manager: text(candidate.employee.manager, 120),
          location: text(candidate.employee.location, 160),
          platformRole: text(candidate.employee.platformRole, 80),
        }
      : undefined,
    role: candidate.role && typeof candidate.role === "object"
      ? {
          title: text(candidate.role.title, 160) ?? "",
          businessArea: text(candidate.role.businessArea, 160),
          careerLevel: text(candidate.role.careerLevel, 80),
          skillsTags: cleanStringArray(candidate.role.skillsTags, 12),
          progression: cleanStringArray(candidate.role.progression, 8),
          preferredPathway: text(candidate.role.preferredPathway, 180),
          alternativePathways: cleanStringArray(candidate.role.alternativePathways, 8),
          businessRationale: text(candidate.role.businessRationale, 500),
        }
      : undefined,
    application: candidate.application === null
      ? null
      : candidate.application && typeof candidate.application === "object" && isRequestStatus(candidate.application.status)
        ? {
            id: text(candidate.application.id, 80) ?? "",
            status: candidate.application.status,
            currentOwner: text(candidate.application.currentOwner, 120),
            pathway: text(candidate.application.pathway, 180) ?? "",
            submittedDate: text(candidate.application.submittedDate, 80),
            reason: text(candidate.application.reason, 500),
            careerGoal: text(candidate.application.careerGoal, 300),
            supportRequired: text(candidate.application.supportRequired, 300),
            managerNote: text(candidate.application.managerNote, 500),
            approvalHistory: cleanStringArray(candidate.application.approvalHistory, 8),
          }
        : undefined,
    development: parseEmployeeDiscovery(candidate.development),
    recommendation: candidate.recommendation && typeof candidate.recommendation === "object"
      ? {
          topRecommendation: text(candidate.recommendation.topRecommendation, 180),
          fitScore: numberScore(candidate.recommendation.fitScore),
          confidence: numberScore(candidate.recommendation.confidence),
          rationale: text(candidate.recommendation.rationale, 600),
          evidence: cleanStringArray(candidate.recommendation.evidence, 10),
          currentCapabilityProfile: parseCapabilityScores(candidate.recommendation.currentCapabilityProfile),
          futureCapabilityProfile: parseCapabilityScores(candidate.recommendation.futureCapabilityProfile),
        }
      : undefined,
    providerProgramme: candidate.providerProgramme === null
      ? null
      : candidate.providerProgramme && typeof candidate.providerProgramme === "object"
        ? {
            providerName: text(candidate.providerProgramme.providerName, 160),
            programmeName: text(candidate.providerProgramme.programmeName, 180),
            linkedStandard: text(candidate.providerProgramme.linkedStandard, 180),
            verificationStatus: text(candidate.providerProgramme.verificationStatus, 100),
            deliveryModels: cleanStringArray(candidate.providerProgramme.deliveryModels, 8),
          }
        : undefined,
  };
}

function parseRecommendationResult(value: unknown): LevyTateRecommendationResult | null | undefined {
  if (value === null) return null;
  if (!value || typeof value !== "object") return undefined;
  const candidate = value as Partial<LevyTateRecommendationResult>;
  const careerStage: LevyTateCareerStage =
    candidate.careerStage === "Entry" ||
    candidate.careerStage === "Operational" ||
    candidate.careerStage === "Professional" ||
    candidate.careerStage === "Senior Professional" ||
    candidate.careerStage === "Team Leader" ||
    candidate.careerStage === "Manager" ||
    candidate.careerStage === "Senior Manager" ||
    candidate.careerStage === "Head Of" ||
    candidate.careerStage === "Director" ||
    candidate.careerStage === "Executive"
      ? candidate.careerStage
      : "Professional";
  const score = (item: unknown) => typeof item === "number" && Number.isFinite(item)
    ? Math.max(-100, Math.min(100, Math.round(item)))
    : 0;
  const text = (item: unknown, limit = 240) => typeof item === "string" && item.trim()
    ? item.trim().slice(0, limit)
    : "";
  const parseCapabilityProfile = (profile: unknown): LevyTateCapabilityScore[] => Array.isArray(profile) ? profile.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const capability = item as Partial<LevyTateCapabilityScore>;
    if (typeof capability.domain !== "string") return [];
    return [{
      domain: capability.domain.trim().slice(0, 80),
      score: Math.max(0, score(capability.score)),
      evidence: Array.isArray(capability.evidence) ? capability.evidence.filter((entry): entry is string => typeof entry === "string").slice(0, 8) : [],
      missingEvidence: Array.isArray(capability.missingEvidence) ? capability.missingEvidence.filter((entry): entry is string => typeof entry === "string").slice(0, 8) : [],
    }];
  }).slice(0, 20) : [];
  const parseStrategicSignals = (signals: unknown): LevyTateStrategicSignal[] => Array.isArray(signals) ? signals.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const signal = item as Partial<LevyTateStrategicSignal>;
    const category: LevyTateStrategicSignal["category"] =
      signal.category === "current_capability" ||
      signal.category === "future_capability" ||
      signal.category === "organisation_priority" ||
      signal.category === "business_strategy" ||
      signal.category === "provider_capability" ||
      signal.category === "programme_suitability" ||
      signal.category === "delivery_fit"
        ? signal.category
        : "programme_suitability";
    const label = text(signal.label, 160);
    if (!label) return [];
    return [{
      category,
      label,
      score: Math.max(0, score(signal.score)),
      evidence: Array.isArray(signal.evidence) ? signal.evidence.filter((entry): entry is string => typeof entry === "string").slice(0, 6) : [],
    }];
  }).slice(0, 12) : [];
  const parseStrategicRecommendation = (item: unknown): LevyTateStrategicRecommendation | null => {
    if (!item || typeof item !== "object") return null;
    const strategic = item as Partial<LevyTateStrategicRecommendation>;
    return {
      currentBestFit: text(strategic.currentBestFit, 180) || null,
      futureDevelopmentOpportunity: text(strategic.futureDevelopmentOpportunity, 180) || null,
      strategicRecommendation: text(strategic.strategicRecommendation, 180) || null,
      alternativeRoute: text(strategic.alternativeRoute, 180) || null,
      confidence: Math.max(0, score(strategic.confidence)),
      businessImpact: text(strategic.businessImpact, 360),
      organisationBenefit: text(strategic.organisationBenefit, 360),
      employeeBenefit: text(strategic.employeeBenefit, 360),
      whyRecommended: text(strategic.whyRecommended, 520),
      whyOtherRoutesRankedLower: cleanStringArray(strategic.whyOtherRoutesRankedLower, 6) ?? [],
      missingEvidence: cleanStringArray(strategic.missingEvidence, 6) ?? [],
      suggestedQuestions: cleanStringArray(strategic.suggestedQuestions, 6) ?? [],
      organisationPrioritiesInfluenced: cleanStringArray(strategic.organisationPrioritiesInfluenced, 6) ?? [],
      employeeCapabilitiesInfluenced: cleanStringArray(strategic.employeeCapabilitiesInfluenced, 8) ?? [],
    };
  };
  const recommendations: LevyTatePlatformRecommendation[] = Array.isArray(candidate.recommendations)
    ? candidate.recommendations.slice(0, 8).flatMap((item) => {
        if (!item || typeof item !== "object") return [];
        const recommendation = item as Partial<LevyTatePlatformRecommendation>;
        if (typeof recommendation.pathwayId !== "string" || typeof recommendation.title !== "string") return [];
        const evidence = Array.isArray(recommendation.evidence)
          ? recommendation.evidence.slice(0, 12).flatMap((entry) => {
              if (!entry || typeof entry !== "object") return [];
              const evidenceItem = entry as Partial<LevyTateRecommendationEvidence>;
              if (typeof evidenceItem.id !== "string" || typeof evidenceItem.label !== "string") return [];
              const source: LevyTateRecommendationEvidence["source"] = evidenceItem.source === "profile" || evidenceItem.source === "role_mapping" || evidenceItem.source === "platform_rule"
                ? evidenceItem.source
                : "conversation";
              return [{
                id: evidenceItem.id.trim().slice(0, 120),
                label: evidenceItem.label.trim().slice(0, 220),
                source,
                weight: score(evidenceItem.weight),
              }];
            })
          : [];
        const availability = recommendation.availability === "approved" || recommendation.availability === "not_available"
          ? recommendation.availability
          : "role_fit_review";
        const eligibility = recommendation.eligibility === "eligible" || recommendation.eligibility === "ineligible"
          ? recommendation.eligibility
          : "requires_review";
        const providerAvailability = recommendation.providerAvailability === "mapped" || recommendation.providerAvailability === "unconfirmed"
          ? recommendation.providerAvailability
          : "matching_available";
        const recommendationCategory: LevyTateRecommendationCategory =
          recommendation.recommendationCategory === "Strategic Discussion Required" ||
          recommendation.recommendationCategory === "Development Opportunity" ||
          recommendation.recommendationCategory === "Future Progression"
            ? recommendation.recommendationCategory
            : "Strong Recommendation";
        const careerStageFit: LevyTatePlatformRecommendation["careerStageFit"] =
          recommendation.careerStageFit === "development_stretch" ||
          recommendation.careerStageFit === "outside_envelope" ||
          recommendation.careerStageFit === "strategic_only"
            ? recommendation.careerStageFit
            : "inside_envelope";
        const strategicRole: LevyTatePlatformRecommendation["strategicRole"] =
          recommendation.strategicRole === "current_best_fit" ||
          recommendation.strategicRole === "future_development" ||
          recommendation.strategicRole === "strategic_recommendation" ||
          recommendation.strategicRole === "alternative_route" ||
          recommendation.strategicRole === "supporting_option"
            ? recommendation.strategicRole
            : "supporting_option";
        return [{
          pathwayId: recommendation.pathwayId.trim().slice(0, 120),
          title: recommendation.title.trim().slice(0, 180),
          fitScore: Math.max(0, score(recommendation.fitScore)),
          scoreDelta: score(recommendation.scoreDelta),
          confidence: Math.max(0, score(recommendation.confidence)),
          rationale: typeof recommendation.rationale === "string" ? recommendation.rationale.trim().slice(0, 600) : "",
          evidence,
          missingEvidence: Array.isArray(recommendation.missingEvidence) ? recommendation.missingEvidence.filter((item): item is string => typeof item === "string").slice(0, 8) : [],
          capabilityFit: Array.isArray(recommendation.capabilityFit) ? recommendation.capabilityFit.flatMap((item) => {
            if (!item || typeof item !== "object") return [];
            const fit = item as Partial<LevyTateCapabilityFit>;
            if (typeof fit.domain !== "string") return [];
            return [{ domain: fit.domain.trim().slice(0, 80), score: Math.max(0, score(fit.score)), weighting: Math.max(0, score(fit.weighting)) }];
          }).slice(0, 12) : [],
          strategicRole,
          strategicSignals: parseStrategicSignals(recommendation.strategicSignals),
          businessImpact: text(recommendation.businessImpact, 360),
          organisationBenefit: text(recommendation.organisationBenefit, 360),
          employeeBenefit: text(recommendation.employeeBenefit, 360),
          providerRationale: text(recommendation.providerRationale, 360),
          programmeRationale: text(recommendation.programmeRationale, 360),
          whyRankedLower: cleanStringArray(recommendation.whyRankedLower, 6) ?? [],
          suggestedQuestions: cleanStringArray(recommendation.suggestedQuestions, 6) ?? [],
          availability,
          eligibility,
          providerAvailability,
          careerStage: recommendation.careerStage ?? careerStage,
          recommendationCategory,
          careerStageFit,
          credibilityNotes: cleanStringArray(recommendation.credibilityNotes, 6) ?? [],
          roleFamilies: cleanRoleFamilies(recommendation.roleFamilies, 6),
          developmentObjective: cleanDevelopmentObjective(recommendation.developmentObjective),
          consultantReasoning: text(recommendation.consultantReasoning, 700),
        }];
      })
    : [];
  const topRecommendation = recommendations.find((item) => item.pathwayId === candidate.topRecommendation?.pathwayId) ?? recommendations[0] ?? null;
  const capabilityProfile = parseCapabilityProfile(candidate.capabilityProfile);
  return {
    recommendations,
    topRecommendation,
    recommendationVersion: typeof candidate.recommendationVersion === "string" ? candidate.recommendationVersion.trim().slice(0, 120) : "unknown",
    confidence: Math.max(0, score(candidate.confidence)),
    revealThreshold: Math.max(0, score(candidate.revealThreshold)),
    shouldRevealRecommendations: candidate.shouldRevealRecommendations === true,
    evidenceChanged: candidate.evidenceChanged === true,
    capabilityProfile,
    currentCapabilityProfile: parseCapabilityProfile(candidate.currentCapabilityProfile ?? candidate.capabilityProfile),
    futureCapabilityProfile: parseCapabilityProfile(candidate.futureCapabilityProfile),
    careerStage,
    roleFamily: cleanRoleFamily(candidate.roleFamily) ?? "Administration",
    secondaryRoleFamilies: cleanRoleFamilies(candidate.secondaryRoleFamilies, 8),
    developmentObjective: cleanDevelopmentObjective(candidate.developmentObjective),
    apprenticeshipAppropriate: candidate.apprenticeshipAppropriate === true,
    consultantReasoning: text(candidate.consultantReasoning, 900),
    excludedPathways: Array.isArray(candidate.excludedPathways)
      ? candidate.excludedPathways.slice(0, 12).flatMap((item) => {
          if (!item || typeof item !== "object") return [];
          const excluded = item as Partial<LevyTateExcludedPathway>;
          const title = text(excluded.title, 180);
          const reason = text(excluded.reason, 320);
          return title && reason ? [{ title, reason }] : [];
        })
      : [],
    recommendationEnvelope: candidate.recommendationEnvelope && typeof candidate.recommendationEnvelope === "object"
      ? {
          careerStage,
          minimumLevel: typeof candidate.recommendationEnvelope.minimumLevel === "number" ? candidate.recommendationEnvelope.minimumLevel : null,
          maximumLevel: typeof candidate.recommendationEnvelope.maximumLevel === "number" ? candidate.recommendationEnvelope.maximumLevel : null,
          label: text(candidate.recommendationEnvelope.label, 180) || "Career-stage envelope not previously recorded.",
          excludedRoutes: cleanStringArray(candidate.recommendationEnvelope.excludedRoutes, 12) ?? [],
          strategicOnly: candidate.recommendationEnvelope.strategicOnly === true,
        }
      : {
          careerStage,
          minimumLevel: null,
          maximumLevel: null,
          label: "Career-stage envelope not previously recorded.",
          excludedRoutes: [],
          strategicOnly: false,
        },
    qualificationAwareness: {
      highestQualification: candidate.qualificationAwareness?.highestQualification ?? null,
      previousApprenticeshipLevel: candidate.qualificationAwareness?.previousApprenticeshipLevel ?? null,
      professionalMemberships: cleanStringArray(candidate.qualificationAwareness?.professionalMemberships, 8) ?? [],
      charteredStatus: candidate.qualificationAwareness?.charteredStatus ?? null,
      existingCertifications: cleanStringArray(candidate.qualificationAwareness?.existingCertifications, 8) ?? [],
      status: "not_collected",
      missingFields: cleanStringArray(candidate.qualificationAwareness?.missingFields, 8) ?? ["highest qualification", "previous apprenticeship level", "professional memberships", "chartered status", "existing certifications"],
    },
    strategicDiscussion: text(candidate.strategicDiscussion, 700) || null,
    strategicRecommendation: parseStrategicRecommendation(candidate.strategicRecommendation),
  };
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
    previousRecommendationResult: parseRecommendationResult(candidate.previousRecommendationResult),
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
    employerPriorities: parseEmployerPriorities(candidate.employerPriorities),
    employeeDiscovery: parseEmployeeDiscovery(candidate.employeeDiscovery),
    workspaceEmployeeContext: parseWorkspaceEmployeeContext(candidate.workspaceEmployeeContext),
    preferredStandardId: typeof candidate.preferredStandardId === "string" ? candidate.preferredStandardId.trim().slice(0, 120) : undefined,
    operationalContext: parseOperationalContext(candidate.operationalContext),
    contextData,
  };
}
