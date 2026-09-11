/**
 * LevyTate Requests V1.1 domain contracts.
 *
 * Requests is deliberately separate from the legacy percentage-ranked provider
 * matching workflow. These contracts contain no score, rank, winner, learner,
 * application, Finance or provider-Intelligence payloads.
 */

export const SERVICE_REQUESTS_CAPABILITY = "requestsEnabled" as const;
export const SERVICE_REQUEST_MAX_PROVIDERS = 5 as const;

export const serviceRequestModes = ["programme_led", "need_led"] as const;
export const serviceRequestReadinessValues = ["exploring", "planning", "approved_to_proceed"] as const;
export const serviceRequestStatuses = [
  "draft",
  "open",
  "responses_received",
  "decision_in_progress",
  "progressed_to_agreement",
  "closed",
  "cancelled",
  "expired",
] as const;
export const serviceRequestInvitationStatuses = [
  "pending_delivery",
  "sent",
  "viewed",
  "responded",
  "declined",
  "delivery_failed",
  "deadline_passed",
  "cancelled",
] as const;
export const serviceRequestResponseStatuses = ["draft", "submitted"] as const;
export const serviceRequestDecisionStates = [
  "pending",
  "shortlisted",
  "declined",
  "progressed_to_agreement",
  "agreement_confirmed",
  "not_proceeded",
] as const;
export const serviceRequestClarificationVisibilities = [
  "provider_specific",
  "shared_with_invited_providers",
] as const;
export const providerMembershipRoles = ["Provider Admin", "Provider User"] as const;
export const providerDeclineReasonCategories = [
  "not_a_programme_we_deliver",
  "no_capacity_in_required_timeframe",
  "location_or_delivery_requirements",
  "cohort_size",
  "commercial_fit",
  "other",
] as const;
export const serviceRequestEventTypes = [
  "request_created",
  "request_published",
  "request_updated",
  "invitation_sent",
  "invitation_delivery_failed",
  "invitation_viewed",
  "provider_response_started",
  "provider_response_submitted",
  "provider_response_revised",
  "employer_response_notification_sent",
  "provider_declined",
  "clarification_asked",
  "clarification_answered",
  "clarification_shared",
  "provider_shortlisted",
  "provider_declined_by_employer",
  "provider_progressed_to_agreement",
  "agreement_confirmed",
  "agreement_not_proceeded",
  "request_deadline_extended",
  "request_expired",
  "request_cancelled",
  "request_closed",
  "workspace_handover_completed",
] as const;
export const serviceRequestPermissions = [
  "serviceRequests:read",
  "serviceRequests:write",
  "serviceRequests:publish",
  "serviceRequests:decide",
] as const;

export type ServiceRequestMode = (typeof serviceRequestModes)[number];
export type ServiceRequestReadiness = (typeof serviceRequestReadinessValues)[number];
export type ServiceRequestStatus = (typeof serviceRequestStatuses)[number];
export type ServiceRequestInvitationStatus = (typeof serviceRequestInvitationStatuses)[number];
export type ServiceRequestResponseStatus = (typeof serviceRequestResponseStatuses)[number];
export type ServiceRequestDecisionState = (typeof serviceRequestDecisionStates)[number];
export type ServiceRequestClarificationVisibility = (typeof serviceRequestClarificationVisibilities)[number];
export type ProviderMembershipRole = (typeof providerMembershipRoles)[number];
export type ProviderDeclineReasonCategory = (typeof providerDeclineReasonCategories)[number];
export type ServiceRequestEventType = (typeof serviceRequestEventTypes)[number];
export type ServiceRequestPermission = (typeof serviceRequestPermissions)[number];

export type EmployerRequestRole =
  | "Employer Admin"
  | "Apprenticeship Lead"
  | "Line Manager"
  | "Employee"
  | "Platform Admin";

export type EmployerRequestActor = {
  userId: string;
  email: string;
  organisationId: string;
  role: EmployerRequestRole;
};

export type ProviderRequestActor = {
  membershipId: string;
  email: string;
  providerId: string;
  role: ProviderMembershipRole;
  active: boolean;
};

export type LearnerVolume =
  | { kind: "exact"; count: number }
  | { kind: "approximate"; count: number }
  | { kind: "range"; minimum: number; maximum: number }
  | { kind: "not_confirmed" };

export type WorkplaceLocation =
  | { kind: "sites"; siteIds: string[]; labels: string[] }
  | { kind: "remote_or_distributed"; label?: string }
  | { kind: "not_confirmed" };

export type PreferredStart =
  | { kind: "month"; value: string }
  | { kind: "quarter"; value: string }
  | { kind: "flexible" }
  | { kind: "not_confirmed" };

export type WorkforceMix = "existing_employees" | "new_recruits" | "mixed" | "unknown";

export type ServiceRequestContent = {
  title: string;
  requestMode: ServiceRequestMode;
  requirement: string;
  readiness: ServiceRequestReadiness;
  learnerVolume: LearnerVolume;
  workplaceLocation: WorkplaceLocation;
  deliveryPreferences: string[];
  preferredStart: PreferredStart;
  responseDeadline: string;
  programmeId?: string;
  apprenticeshipStandardId?: string;
  programmeTitle?: string;
  providerContextId?: string;
  departments?: string[];
  targetRoles?: string[];
  workforceMix?: WorkforceMix;
  businessOutcome?: string;
  workplaceProjectRequirements?: string;
  accessibilityConsiderations?: string;
  procurementRequirements?: string;
  additionalNotes?: string;
};

/** Fields retained for the employer but never copied into a published snapshot. */
export type ServiceRequestPrivateContext = {
  privateNotes?: string;
  employeeIds?: string[];
  learnerIds?: string[];
  applicationIds?: string[];
  financeReference?: string;
  intelligenceSignalIds?: string[];
  privateProviderConcern?: string;
};

export type PublishedServiceRequestSnapshot = Readonly<{
  employerOrganisationName: string;
  title: string;
  requestMode: ServiceRequestMode;
  requirement: string;
  readiness: ServiceRequestReadiness;
  learnerVolume: LearnerVolume;
  workplaceLocation: WorkplaceLocation;
  deliveryPreferences: readonly string[];
  preferredStart: PreferredStart;
  responseDeadline: string;
  programme?: Readonly<{
    id: string;
    title?: string;
    apprenticeshipStandardId?: string;
  }>;
  optionalInformation: Readonly<{
    departments?: readonly string[];
    targetRoles?: readonly string[];
    workforceMix?: WorkforceMix;
    businessOutcome?: string;
    workplaceProjectRequirements?: string;
    accessibilityConsiderations?: string;
    procurementRequirements?: string;
    additionalNotes?: string;
  }>;
  providersShouldAddress: readonly string[];
}>;

export type ServiceRequest = {
  id: string;
  organisationId: string;
  content: ServiceRequestContent;
  privateContext: ServiceRequestPrivateContext;
  status: ServiceRequestStatus;
  currentVersion: number;
  createdBy: string;
  createdAt: string;
  publishedBy?: string;
  publishedAt?: string;
  closedAt?: string;
  cancellationReason?: string;
  updatedAt: string;
};

export type ServiceRequestVersion = {
  requestId: string;
  organisationId: string;
  version: number;
  publishedSnapshot: PublishedServiceRequestSnapshot;
  publishedAt: string;
  publishedBy: string;
  changeSummary: string;
};

export type ProviderMembership = {
  id: string;
  providerId: string;
  email: string;
  displayName: string;
  authSubject?: string;
  authBindingStatus: "pending" | "bound";
  authBoundAt?: string;
  lastLoginAt?: string;
  role: ProviderMembershipRole;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ProviderAccessInvite = {
  id: string;
  invitationId: string;
  providerId: string;
  invitedEmail: string;
  tokenHash: string;
  expiresAt: string;
  redeemedAt?: string;
  redeemedByMembershipId?: string;
  revokedAt?: string;
  createdAt: string;
};

export type ServiceRequestInvitation = {
  id: string;
  requestId: string;
  organisationId: string;
  providerId: string;
  requestVersion: number;
  invitedProviderMembershipId?: string;
  invitedContactEmail?: string;
  status: ServiceRequestInvitationStatus;
  notificationStatus: "pending" | "accepted" | "failed";
  notificationAttemptCount: number;
  notificationFailureCode?: string;
  notificationProviderId?: string;
  sentAt?: string;
  viewedAt?: string;
  deadline: string;
  declinedAt?: string;
  declineReasonCategory?: ProviderDeclineReasonCategory;
  declineNote?: string;
  createdAt: string;
  updatedAt: string;
};

export type ProviderResponseContent = {
  proposedProgramme:
    | { kind: "canonical_programme"; programmeId: string; programmeTitle?: string }
    | { kind: "alternative_to_discuss"; description: string };
  whyThisFits: string;
  earliestAvailableStart: string;
  deliveryApproach: { models: string[]; notes?: string };
  cohortCapacity: {
    kind: "can_accommodate" | "minimum_required" | "maximum_places" | "requires_discussion";
    value?: number;
    notes?: string;
  };
  workplaceRequirements: string;
  learningCommitment?: string;
  employerReportingSupport: string;
  proposedTrainingAssessmentPricePence?: number;
  priceBasisAndAssumptions?: string;
  additionalCommercialCosts?: string;
  relevantEvidence?: string;
  exceptionsOrClarifications?: string;
};

export type ServiceRequestResponse = {
  id: string;
  requestId: string;
  invitationId: string;
  organisationId: string;
  providerId: string;
  providerMembershipId: string;
  requestVersion: number;
  status: ServiceRequestResponseStatus;
  draftContent: ProviderResponseContent;
  currentVersion: number;
  createdAt: string;
  submittedAt?: string;
  updatedAt: string;
};

export type ServiceRequestResponseVersion = {
  responseId: string;
  requestId: string;
  organisationId: string;
  providerId: string;
  requestVersion: number;
  version: number;
  submittedContent: Readonly<ProviderResponseContent>;
  submittedByProviderMembershipId: string;
  submittedAt: string;
};

export type ServiceRequestClarification = {
  id: string;
  requestId: string;
  invitationId: string;
  organisationId: string;
  providerId: string;
  requestVersion: number;
  askedByType: "provider_member" | "employer_user";
  askedByProviderMembershipId?: string;
  askedByEmployerUserId?: string;
  question: string;
  visibility: ServiceRequestClarificationVisibility;
  askedAt: string;
  answer?: string;
  answeredByType?: "provider_member" | "employer_user";
  answeredByProviderMembershipId?: string;
  answeredByEmployerUserId?: string;
  answeredAt?: string;
  sharedByEmployerUserId?: string;
  sharedAt?: string;
};

export type ProviderVisibleClarification = {
  id: string;
  requestId: string;
  requestVersion: number;
  label: "Your question" | "Employer clarification";
  askedBy: "provider" | "employer";
  visibility: ServiceRequestClarificationVisibility;
  question: string;
  answer?: string;
  askedAt: string;
  answeredAt?: string;
};

export type ServiceRequestDecision = {
  id: string;
  requestId: string;
  invitationId: string;
  responseId: string;
  organisationId: string;
  providerId: string;
  state: ServiceRequestDecisionState;
  privateDecisionNote?: string;
  shortlistedAt?: string;
  shortlistedBy?: string;
  declinedAt?: string;
  declinedBy?: string;
  progressedAt?: string;
  progressedBy?: string;
  agreementConfirmedAt?: string;
  agreementConfirmedBy?: string;
  notProceededAt?: string;
  notProceededBy?: string;
  updatedAt: string;
};

export type RequestAgreementSnapshot = {
  id: string;
  requestId: string;
  organisationId: string;
  providerId: string;
  invitationId: string;
  responseId: string;
  responseVersion: number;
  proposedProgrammeId?: string;
  proposedStart: string;
  deliveryApproach: Readonly<{ models: readonly string[]; notes?: string }>;
  workplaceRequirements: string;
  learningCommitment?: string;
  employerReportingSupport: string;
  proposedTrainingAssessmentPricePence?: number;
  priceBasisAndAssumptions?: string;
  additionalCommercialCosts?: string;
  exceptionsOrClarifications?: string;
  label: "Request agreement snapshot";
  confirmedAt: string;
  confirmedBy: string;
};

export type RequestWorkspaceHandover = {
  id: string;
  requestId: string;
  organisationId: string;
  agreementSnapshotId: string;
  providerId: string;
  programmeId?: string;
  addProvider: boolean;
  addProgramme: boolean;
  providerAdded: boolean;
  programmeAdded: boolean;
  completedBy: string;
  completedAt: string;
  idempotencyKey: string;
};

export type ServiceRequestEvent = {
  id: string;
  requestId: string;
  organisationId: string;
  eventType: ServiceRequestEventType;
  actorType: "employer_user" | "provider_member" | "system";
  actorId?: string;
  invitationId?: string;
  responseId?: string;
  providerId?: string;
  idempotencyKey: string;
  /** Bounded operational facts only; never tokens, private notes or chain-of-thought. */
  metadata: Readonly<Record<string, string | number | boolean | null>>;
  occurredAt: string;
};

export type OrganisationRequestCapability = {
  organisationId: string;
  requestsEnabled: boolean;
};

export type RequestComparisonColumn = {
  providerId: string;
  responseId: string;
  programme: string;
  startAvailability: string;
  delivery: string;
  cohortCapacity: string;
  workplaceRequirements: string;
  learningCommitment: string;
  supportAndReporting: string;
  proposedPrice: string;
  evidence: string;
  exceptions: string;
};

export type RequestComparison = {
  requestId: string;
  requestVersion: number;
  columns: RequestComparisonColumn[];
  pointsToResolve: string[];
};

export type ServiceRequestStore = {
  capabilities: OrganisationRequestCapability[];
  requests: ServiceRequest[];
  requestVersions: ServiceRequestVersion[];
  providerMemberships: ProviderMembership[];
  providerAccessInvites: ProviderAccessInvite[];
  invitations: ServiceRequestInvitation[];
  responses: ServiceRequestResponse[];
  responseVersions: ServiceRequestResponseVersion[];
  clarifications: ServiceRequestClarification[];
  decisions: ServiceRequestDecision[];
  agreementSnapshots: RequestAgreementSnapshot[];
  handovers: RequestWorkspaceHandover[];
  organisationProviderSelections: Array<{ organisationId: string; providerId: string }>;
  organisationProgrammeSelections: Array<{ organisationId: string; programmeId: string; providerId: string }>;
  events: ServiceRequestEvent[];
};

export type ProviderActivityMetrics = {
  opportunitiesReceived: number;
  responsesSubmitted: number;
  shortlisted: number;
  progressedToAgreement: number;
  declined: number;
};

export type EmployerRequestMetrics = {
  openRequests: number;
  responsesReceived: number;
  requestsInDecision: number;
  progressedToAgreement: number;
};
