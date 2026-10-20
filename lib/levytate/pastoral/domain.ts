export const pastoralPolicyVersion = "pastoral-support-v1";

export const pastoralTopicCategories = [
  "apprenticeship_support",
  "workload_pressure",
  "workplace_relationships",
  "bullying_harassment_discrimination",
  "wellbeing",
  "personal_circumstances",
  "accessibility_adjustments",
  "provider_support",
  "other",
] as const;

export type PastoralTopicCategory = (typeof pastoralTopicCategories)[number];
export type PastoralUrgencyRoute = "standard" | "prompt_human_support" | "emergency_guidance";
export type PastoralSupportStatus = "submitted" | "acknowledged" | "support_in_progress" | "follow_up" | "resolved";
export type PastoralContactMethod = "in_platform" | "email" | "phone" | "meeting" | "provider_route";
export type PastoralConversationAuthor = "employee" | "assistant";
export type PastoralAssistantSource = "openai" | "safety_policy";
export type PastoralEmployeeResolutionStatus = "not_requested" | "awaiting_employee_response" | "helped" | "further_support_requested";
export type PastoralSupportActionStatus = "agreed" | "in_progress" | "completed" | "cancelled";

export type PastoralLearnerContext = {
  programmeName: string;
  lifecycleStage: string;
  providerName: string;
  importantDates: Array<{ label: string; date: string }>;
  learningPriorities: Array<{ label: string; targetDate: string | null }>;
};

export type PastoralConversationMessage = {
  id: string;
  author: PastoralConversationAuthor;
  content: string;
  createdAt: string;
};

export type PastoralConversationSummary = {
  id: string;
  status: "active" | "closed";
  createdAt: string;
  updatedAt: string;
  retentionExpiresAt: string;
  messages: PastoralConversationMessage[];
};

export type PastoralSupportRecipient = {
  id: string;
  kind: "line_manager" | "apprenticeship_lead" | "hr_people" | "provider_support" | "other_approved_support";
  label: string;
  contactMethod: "in_platform" | "email_notification" | "provider_route";
};

export type PastoralSharedRequestPayload = {
  topic: string;
  whatIWantYouToUnderstand: string;
  howItIsAffectingMe: string;
  supportIWant: string;
  preferredContactMethod: PastoralContactMethod;
  sharingRestrictions: string;
  recipient: string;
};

export type PastoralSupportRequestDraft = {
  topicCategory: PastoralTopicCategory;
  topic: string;
  whatIWantYouToUnderstand: string;
  howItIsAffectingMe: string;
  supportIWant: string;
  preferredContactMethod: PastoralContactMethod;
  sharingRestrictions: string;
  urgencyRoute: PastoralUrgencyRoute;
  employeeReportedFacts: string[];
  aiSuggestions: string[];
};

export type PastoralSupportActionEvent = {
  id: string;
  eventType: "agreed" | "started" | "progress_recorded" | "completed" | "cancelled" | "reassigned";
  previousState: string | null;
  newState: string;
  note: string;
  createdAt: string;
};

export type PastoralSupportActionView = {
  id: string;
  responsibleRecipientId: string;
  responsibleRecipientLabel: string;
  status: PastoralSupportActionStatus;
  dueAt: string | null;
  summary: string;
  lockVersion: number;
  completedAt: string | null;
  events: PastoralSupportActionEvent[];
};

export type PastoralSupportEvent = {
  id: string;
  eventType: "submitted" | "acknowledged" | "support_started" | "follow_up_requested" | "follow_up_agreed" | "resolved" | "reopened" | "disputed" | "reassigned" | "employee_confirmed_helped" | "employee_requested_further_support";
  previousState: string | null;
  newState: string;
  note: string;
  createdAt: string;
};

export type PastoralSupportRequestView = {
  id: string;
  employeeLabel: string;
  recipientId: string;
  recipientLabel: string;
  topicCategory: PastoralTopicCategory;
  urgencyRoute: PastoralUrgencyRoute;
  status: PastoralSupportStatus;
  lockVersion: number;
  submittedAt: string;
  acknowledgedAt: string | null;
  resolvedAt: string | null;
  agreedFollowUpAt: string | null;
  administrativelyClosedAt: string | null;
  employeeResolutionStatus: PastoralEmployeeResolutionStatus;
  employeeRespondedAt: string | null;
  employeeConfirmedResolvedAt: string | null;
  payload: PastoralSharedRequestPayload;
  events: PastoralSupportEvent[];
  actions: PastoralSupportActionView[];
};

export type PastoralWorkspace = {
  generatedAt: string;
  role: string;
  capabilityEnabled: true;
  accessMode: "employee" | "support_recipient";
  employee: {
    id: string;
    name: string;
    historySavingEnabled: boolean;
    historyRetentionDays: number;
    learnerContext: PastoralLearnerContext | null;
  } | null;
  recipients: PastoralSupportRecipient[];
  conversations: PastoralConversationSummary[];
  requests: PastoralSupportRequestView[];
  privacyNotice: string;
  emergencyNotice: string;
};

export type PastoralAssistantRequest = {
  message: string;
  conversationId?: string | null;
  clientMessageId: string;
  recentMessages?: Array<{ author: PastoralConversationAuthor; content: string }>;
  draftSupportRequest?: boolean;
};

export type PastoralAssistantResponse = {
  reply: string;
  source: PastoralAssistantSource;
  conversationId: string | null;
  supportOffer: boolean;
  urgencyRoute: PastoralUrgencyRoute;
  suggestedTopicCategory: PastoralTopicCategory;
  humanSupportAvailable: boolean;
  policyVersion: string;
  supportRequestDraft: PastoralSupportRequestDraft | null;
};

export type PastoralSupportMutation =
  | { action: "set_history_preference"; saveHistory: boolean; retentionDays?: number }
  | { action: "delete_conversation"; conversationId: string }
  | {
      action: "submit_support_request";
      recipientId: string;
      topicCategory: PastoralTopicCategory;
      urgencyRoute: PastoralUrgencyRoute;
      idempotencyKey: string;
      payload: Omit<PastoralSharedRequestPayload, "recipient">;
    }
  | {
      action: "transition_support_request";
      requestId: string;
      transition: "acknowledge" | "start_support" | "request_follow_up" | "resolve" | "reopen" | "dispute";
      expectedLockVersion: number;
      idempotencyKey: string;
      note?: string;
    }
  | {
      action: "record_follow_up";
      requestId: string;
      expectedLockVersion: number;
      agreedFollowUpAt: string;
      idempotencyKey: string;
      note?: string;
    }
  | {
      action: "create_support_action";
      requestId: string;
      responsibleRecipientId: string;
      dueAt?: string | null;
      summary: string;
      idempotencyKey: string;
    }
  | {
      action: "transition_support_action";
      supportActionId: string;
      transition: "start" | "progress" | "complete" | "cancel" | "reassign";
      expectedLockVersion: number;
      idempotencyKey: string;
      newResponsibleRecipientId?: string;
      note?: string;
    }
  | {
      action: "record_employee_outcome";
      requestId: string;
      outcome: "helped" | "further_support_requested";
      expectedLockVersion: number;
      idempotencyKey: string;
      note?: string;
    };

export const pastoralSharedFieldNames = [
  "topic",
  "what_i_want_you_to_understand",
  "how_it_is_affecting_me",
  "support_i_want",
  "preferred_contact_method",
  "sharing_restrictions",
  "recipient",
] as const;

export function isPastoralTopicCategory(value: unknown): value is PastoralTopicCategory {
  return pastoralTopicCategories.includes(value as PastoralTopicCategory);
}

export function pastoralRecipientIsSafeForConcern(recipient: PastoralSupportRecipient, concern: string) {
  const text = concern.toLocaleLowerCase("en-GB");
  const label = recipient.label.trim().toLocaleLowerCase("en-GB");
  if (label.length >= 3 && text.includes(label)) return false;
  if (recipient.kind === "line_manager" && /\b(?:my\s+)?(?:line\s+)?(?:manager|boss|supervisor)\b/i.test(concern)) return false;
  if (recipient.kind === "apprenticeship_lead" && /\b(?:my\s+)?(?:apprenticeship|learning and development|l&d)\s+(?:lead|manager)\b/i.test(concern)) return false;
  return true;
}
