import type {
  CandidateActivityAssessment,
  OtjActivityCategory,
  OtjEligibilityOutcome,
  OtjPolicyRegime,
  OtjWorkingHoursBasis,
} from "@/lib/levytate/off-the-job/domain";

export type LearningTimePlanView = {
  planId: string;
  versionId: string;
  versionNumber: number;
  status: "not_configured" | "draft" | "published" | "needs_review" | "closed";
  policyRegime: OtjPolicyRegime;
  originalApprenticeshipStartDate: string;
  practicalPeriodStartDate: string;
  practicalPeriodEndDate: string;
  standardId: string;
  standardVersion: string;
  publishedStandardMinimumMinutes: number | null;
  legacyIndicativeMinimumMinutes: number | null;
  priorLearningReductionMinutes: number;
  individualMinimumMinutes: number;
  plannedDeliveryMinutes: number;
  providerId: string;
  trainingPlanReference: string;
  sourceType: string;
  sourceDate: string;
  inactivityAttentionDays: number;
  notes: string;
  publishedAt: string | null;
};

export type LearningTimePriorityView = {
  id: string;
  learnerRecordId: string;
  label: string;
  description: string;
  ksbReferences: string[];
  sourceType: string;
  sourceReference: string;
  targetDate: string | null;
  status: "active" | "completed" | "superseded";
};

export type LearningTimeConfirmationView = {
  id: string;
  activityId: string;
  outcome: "confirmed" | "partially_confirmed" | "not_confirmed" | "superseded";
  confirmedMinutes: number;
  sourceType: string;
  providerId: string;
  sourceReference: string;
  sourceDate: string;
  recordedAt: string;
  recordedByLabel: string;
  note: string;
};

export type LearningTimeActivityView = {
  id: string;
  learnerRecordId: string;
  activityDate: string;
  startedAt: string;
  endedAt: string;
  breakMinutes: number;
  durationMinutes: number;
  category: OtjActivityCategory;
  title: string;
  description: string;
  whatWasNew: string;
  standardRelevance: string;
  reflection: string;
  workingHoursBasis: OtjWorkingHoursBasis;
  compensationNote: string;
  separateFromProductiveWork: boolean | null;
  ksbReferences: string[];
  evidenceReference: string;
  deterministicOutcome: OtjEligibilityOutcome;
  deterministicReasons: string[];
  status: "draft" | "submitted" | "needs_information" | "employer_checked" | "not_counted" | "withdrawn";
  submittedAt: string | null;
  lockVersion: number;
  confirmation: LearningTimeConfirmationView | null;
  createdAt: string;
  updatedAt: string;
};

export type LearningTimeLearnerView = {
  learnerRecordId: string;
  employeeId: string;
  learnerName: string;
  jobTitle: string;
  department: string;
  site: string;
  programmeId: string;
  programmeName: string;
  standardId: string;
  providerId: string;
  providerName: string;
  lifecycleStatus: string;
  activeBreak: boolean;
  plan: LearningTimePlanView | null;
  priorities: LearningTimePriorityView[];
  activities: LearningTimeActivityView[];
  totals: {
    learnerRecordedMinutes: number;
    employerCheckedMinutes: number;
    providerConfirmedMinutes: number;
    remainingMinutes: number;
  };
  attention: Array<{
    type: string;
    label: string;
    detail: string;
  }>;
  lastActivityDate: string | null;
};

export type LearningTimeWorkspace = {
  generatedAt: string;
  role: string;
  capabilityEnabled: boolean;
  canManagePlans: boolean;
  canReviewActivities: boolean;
  canCreateActivities: boolean;
  learners: LearningTimeLearnerView[];
  portfolio: {
    activeLearnerPlans: number;
    providerConfirmedMinutes: number;
    candidateMinutesAwaitingCheck: number;
    activitiesAwaitingProviderConfirmation: number;
    plansNeedingSetup: number;
    operationalAttention: number;
  };
  regulatoryNotice: string;
};

export type LearningTimeActivityInput = {
  learnerRecordId: string;
  activityId?: string;
  activityDate: string;
  startedAt: string;
  endedAt: string;
  breakMinutes: number;
  timezone?: string;
  category: OtjActivityCategory;
  title: string;
  description: string;
  whatWasNew: string;
  standardRelevance: string;
  reflection: string;
  workingHoursBasis: OtjWorkingHoursBasis;
  compensationNote?: string;
  separateFromProductiveWork: boolean | null;
  ksbReferences?: string[];
  evidenceReference?: string;
  saveAsNonCounted?: boolean;
};

export type LearningTimeAssistantResponse = {
  mode: "eligibility_check" | "planning" | "capture_support";
  assessment: OtjEligibilityOutcome;
  headline: string;
  explanation: string;
  clarificationQuestions: string[];
  suggestedActivity: {
    title: string;
    category: OtjActivityCategory | "";
    description: string;
    whatWasNew: string;
    standardRelevance: string;
    reflection: string;
    suggestedKsbReferences: string[];
    evidenceToCapture: string[];
  };
  planningSuggestions: Array<{
    title: string;
    purpose: string;
    estimatedMinutes: number;
    learningPriorityIds: string[];
    evidenceToCapture: string[];
    supportNeeded: string;
  }>;
  warnings: string[];
  source: "deterministic" | "openai";
  deterministicAssessment?: CandidateActivityAssessment;
};

export type LearningTimeAssistantRequest = {
  learnerRecordId: string;
  mode: "eligibility_check" | "planning" | "capture_support";
  prompt: string;
  candidate?: Partial<LearningTimeActivityInput>;
};
