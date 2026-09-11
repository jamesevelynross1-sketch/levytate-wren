import type {
  EmployerRequestMetrics,
  ProviderActivityMetrics,
  ProviderResponseContent,
  RequestAgreementSnapshot,
  RequestComparison,
  RequestWorkspaceHandover,
  ServiceRequest,
  ServiceRequestClarification,
  ServiceRequestDecision,
  ServiceRequestInvitation,
  ServiceRequestPrivateContext,
  ServiceRequestResponse,
  ServiceRequestResponseVersion,
  ServiceRequestVersion,
} from "@/lib/levytate/requests/domain";

export type RequestProviderOption = {
  providerId: string;
  providerName: string;
  deliveryModels: string[];
  regions: string[];
  programmeIds: string[];
  relationshipStatus: "existing" | "marketplace";
  providerAccessReady: boolean;
};

export type RequestProgrammeOption = {
  programmeId: string;
  providerId: string;
  programmeName: string;
  apprenticeshipStandardId?: string;
  level?: number;
  fundingBandMaximumPence?: number;
};

export type EmployerServiceRequestView = ServiceRequest & {
  versions: ServiceRequestVersion[];
  invitations: Array<ServiceRequestInvitation & { providerName: string }>;
  responses: Array<{
    id: string;
    requestId: string;
    invitationId: string;
    organisationId: string;
    providerId: string;
    providerName: string;
    requestVersion: number;
    currentVersion: number;
    submittedAt: string;
    submittedContent: ProviderResponseContent;
  }>;
  responseVersions: ServiceRequestResponseVersion[];
  clarifications: Array<ServiceRequestClarification & { providerName: string }>;
  decisions: Array<ServiceRequestDecision & { providerName: string }>;
  agreementSnapshots: RequestAgreementSnapshot[];
  handovers: RequestWorkspaceHandover[];
  comparison: RequestComparison;
};

export type EmployerRequestsWorkspaceBootstrap = {
  requestsEnabled: boolean;
  organisation: { id: string; name: string };
  metrics: EmployerRequestMetrics;
  requests: EmployerServiceRequestView[];
  providerOptions: RequestProviderOption[];
  programmeOptions: RequestProgrammeOption[];
};

export type ProviderOpportunityView = {
  invitation: Pick<
    ServiceRequestInvitation,
    "id" | "requestVersion" | "status" | "deadline" | "declinedAt" |
    "declineReasonCategory" | "declineNote" | "createdAt" | "updatedAt"
  >;
  employerName: string;
  requestId: string;
  requestTitle: string;
  requestStatus: ServiceRequest["status"];
  requestVersion: Pick<ServiceRequestVersion, "version" | "publishedSnapshot" | "publishedAt" | "changeSummary">;
  response?: Pick<
    ServiceRequestResponse,
    "id" | "invitationId" | "requestVersion" | "status" | "draftContent" |
    "currentVersion" | "createdAt" | "submittedAt" | "updatedAt"
  >;
  responseVersions: Array<Pick<
    ServiceRequestResponseVersion,
    "version" | "requestVersion" | "submittedContent" | "submittedAt"
  >>;
  clarifications: Array<{
    id: string;
    label: "Your question" | "Employer clarification";
    askedBy: "provider" | "employer";
    visibility: ServiceRequestClarification["visibility"];
    question: string;
    answer?: string;
    askedAt: string;
    answeredAt?: string;
    answerRequired: boolean;
  }>;
  outcome: "open" | "responded" | "declined" | "shortlisted" | "progressed_to_agreement" | "closed";
  proposedProgrammeOptions: RequestProgrammeOption[];
};

export type ProviderRequestsWorkspaceBootstrap = {
  requestsEnabled: boolean;
  provider: {
    id: string;
    name: string;
    membershipRole: "Provider Admin" | "Provider User";
  };
  metrics: ProviderActivityMetrics;
  opportunities: ProviderOpportunityView[];
};

type WithIdempotency = { idempotencyKey: string };

export type EmployerRequestAction = WithIdempotency & (
  | { action: "create_draft"; content: ServiceRequest["content"]; privateContext?: ServiceRequestPrivateContext }
  | { action: "update_draft"; requestId: string; content: ServiceRequest["content"]; privateContext?: ServiceRequestPrivateContext }
  | { action: "send_request"; content: ServiceRequest["content"]; privateContext?: ServiceRequestPrivateContext; providerIds: string[] }
  | { action: "send_existing_draft"; requestId: string; content: ServiceRequest["content"]; privateContext?: ServiceRequestPrivateContext; providerIds: string[] }
  | { action: "publish"; requestId: string }
  | { action: "publish_revision"; requestId: string; content: ServiceRequest["content"]; changeSummary: string }
  | { action: "invite_providers"; requestId: string; providerIds: string[] }
  | { action: "retry_invitation"; requestId: string; invitationId: string }
  | { action: "ask_clarification"; requestId: string; invitationId: string; question: string }
  | { action: "answer_clarification"; requestId: string; clarificationId: string; answer: string; shareWithAll: boolean }
  | { action: "shortlist"; requestId: string; responseId: string; privateDecisionNote?: string }
  | { action: "decline_provider"; requestId: string; responseId: string; privateDecisionNote?: string }
  | { action: "progress_to_agreement"; requestId: string; responseId: string; privateDecisionNote?: string }
  | { action: "confirm_agreement"; requestId: string; responseId: string }
  | { action: "confirm_and_handover"; requestId: string; responseId: string; addProvider: boolean; addProgramme: boolean }
  | { action: "not_proceeded"; requestId: string; responseId: string; privateDecisionNote?: string }
  | { action: "handover"; requestId: string; responseId: string; addProvider: boolean; addProgramme: boolean }
  | { action: "cancel"; requestId: string; reason: string }
  | { action: "close_request"; requestId: string }
  | { action: "extend_deadline"; requestId: string; deadline: string }
);

export type ProviderRequestAction = WithIdempotency & (
  | { action: "mark_viewed"; invitationId: string }
  | { action: "save_draft"; invitationId: string; content: ProviderResponseContent }
  | { action: "submit_response"; invitationId: string; content: ProviderResponseContent }
  | { action: "decline"; invitationId: string; reasonCategory: ServiceRequestInvitation["declineReasonCategory"]; note?: string }
  | { action: "ask_clarification"; invitationId: string; question: string }
  | { action: "answer_clarification"; invitationId: string; clarificationId: string; answer: string }
);
