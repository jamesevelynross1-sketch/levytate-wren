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

export type PastoralSupportEvent = {
  id: string;
  eventType: "submitted" | "acknowledged" | "support_started" | "follow_up_requested" | "resolved" | "reopened" | "disputed" | "reassigned";
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
  payload: PastoralSharedRequestPayload;
  events: PastoralSupportEvent[];
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
