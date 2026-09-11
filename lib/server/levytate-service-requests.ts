import { createHash } from "node:crypto";
import type { LevyTateBetaSession } from "@/lib/levytate/config/beta-access";
import type {
  EmployerRequestsWorkspaceBootstrap,
  EmployerServiceRequestView,
  ProviderOpportunityView,
  ProviderRequestsWorkspaceBootstrap,
  RequestProgrammeOption,
  RequestProviderOption,
} from "@/lib/levytate/requests/api";
import type {
  EmployerRequestActor,
  ProviderMembership,
  ProviderRequestActor,
  RequestAgreementSnapshot,
  RequestWorkspaceHandover,
  ServiceRequest,
  ServiceRequestClarification,
  ServiceRequestDecision,
  ServiceRequestEvent,
  ServiceRequestInvitation,
  ServiceRequestResponse,
  ServiceRequestResponseVersion,
  ServiceRequestStore,
  ServiceRequestVersion,
} from "@/lib/levytate/requests/domain";
import {
  LevyTateRequestPayloadValidationError,
  assertEmployerRequestActionPayload,
  assertProviderRequestActionPayload,
} from "@/lib/levytate/requests/validation";
import {
  ServiceRequestWorkflowError,
  answerClarification,
  answerEmployerClarification,
  askClarification,
  askProviderClarification,
  cancelServiceRequest,
  closeServiceRequest,
  compareSubmittedResponses,
  completeWorkspaceHandover,
  confirmAgreement,
  createEmptyServiceRequestStore,
  createServiceRequestDraft,
  declineInvitation,
  declineProviderByEmployer,
  employerRequestMetrics,
  extendServiceRequestDeadline,
  getEmployerRequest,
  getProviderOpportunity,
  hasEmployerRequestPermission,
  inviteProviders,
  listEmployerRequests,
  listProviderInvitations,
  listProviderVisibleClarifications,
  markInvitationViewed,
  markPastDeadlineInvitations,
  progressProviderToAgreement,
  providerActivityMetrics,
  publishServiceRequest,
  recordAgreementNotProceeded,
  recordEmployerResponseNotificationSent,
  recordInvitationDelivery,
  saveProviderResponseDraft,
  shortlistProvider,
  submitProviderResponse,
  updatePublishedServiceRequest,
  updateServiceRequestDraft,
} from "@/lib/levytate/requests/workflow";
import type { LevyTateProviderSession } from "@/lib/server/levytate-provider-auth";
import { isRequestsEnabledForOrganisation } from "@/lib/server/levytate-request-capability";
import {
  getLevyTateSupabaseConfig,
  LevyTateSupabaseError,
  supabaseFetchJson,
  supabaseSelect,
} from "@/lib/server/levytate-supabase";
import { getLearnerLifecycleServerContext } from "@/lib/server/levytate-learner-lifecycle";
import { getWorkspaceBootstrapForSession } from "@/lib/server/levytate-workspace";
import { normaliseMvpUserRole } from "@/lib/levytate/mvp/rbac";
import { sendEmail } from "@/lib/server/resend";

const tables = {
  requests: "levytate_service_requests",
  versions: "levytate_service_request_versions",
  memberships: "levytate_provider_memberships",
  invitations: "levytate_service_request_invitations",
  responses: "levytate_service_request_responses",
  responseVersions: "levytate_service_request_response_versions",
  clarifications: "levytate_service_request_clarifications",
  decisions: "levytate_service_request_decisions",
  agreements: "levytate_service_request_agreements",
  handovers: "levytate_service_request_handovers",
  events: "levytate_service_request_events",
} as const;

type JsonRow = Record<string, unknown>;

export class LevyTateServiceRequestError extends Error {
  constructor(
    message: string,
    public status: 400 | 403 | 404 | 409 | 413 | 503 = 400,
  ) {
    super(message);
    this.name = "LevyTateServiceRequestError";
  }
}

function config() {
  const value = getLevyTateSupabaseConfig();
  if (!value) throw new LevyTateServiceRequestError("Requests are temporarily unavailable.", 503);
  return value;
}

const text = (row: JsonRow, key: string) => typeof row[key] === "string" ? row[key] as string : "";
const optionalText = (row: JsonRow, key: string) => typeof row[key] === "string" && row[key] ? row[key] as string : undefined;
const bool = (row: JsonRow, key: string) => row[key] === true;
const number = (row: JsonRow, key: string) => typeof row[key] === "number" ? row[key] as number : 0;
const json = <T>(row: JsonRow, key: string, fallback: T) => row[key] == null ? fallback : row[key] as T;

function requestFromRow(row: JsonRow): ServiceRequest {
  return {
    id: text(row, "id"), organisationId: text(row, "organisation_id"),
    content: {
      title: text(row, "title"), requestMode: text(row, "request_mode") as ServiceRequest["content"]["requestMode"],
      requirement: text(row, "requirement"), readiness: text(row, "readiness") as ServiceRequest["content"]["readiness"],
      learnerVolume: json(row, "learner_volume", { kind: "not_confirmed" }),
      workplaceLocation: json(row, "workplace_location", { kind: "not_confirmed" }),
      deliveryPreferences: json(row, "delivery_preferences", []), preferredStart: json(row, "preferred_start", { kind: "not_confirmed" }),
      responseDeadline: text(row, "response_deadline"),
      ...(optionalText(row, "programme_id") ? { programmeId: optionalText(row, "programme_id") } : {}),
      ...(optionalText(row, "apprenticeship_standard_id") ? { apprenticeshipStandardId: optionalText(row, "apprenticeship_standard_id") } : {}),
      ...(optionalText(row, "programme_title") ? { programmeTitle: optionalText(row, "programme_title") } : {}),
      ...(optionalText(row, "provider_context_id") ? { providerContextId: optionalText(row, "provider_context_id") } : {}),
      departments: json(row, "departments", []), targetRoles: json(row, "target_roles", []),
      ...(optionalText(row, "workforce_mix") ? { workforceMix: optionalText(row, "workforce_mix") as NonNullable<ServiceRequest["content"]["workforceMix"]> } : {}),
      ...(optionalText(row, "business_outcome") ? { businessOutcome: optionalText(row, "business_outcome") } : {}),
      ...(optionalText(row, "workplace_project_requirements") ? { workplaceProjectRequirements: optionalText(row, "workplace_project_requirements") } : {}),
      ...(optionalText(row, "accessibility_considerations") ? { accessibilityConsiderations: optionalText(row, "accessibility_considerations") } : {}),
      ...(optionalText(row, "procurement_requirements") ? { procurementRequirements: optionalText(row, "procurement_requirements") } : {}),
      ...(optionalText(row, "additional_notes") ? { additionalNotes: optionalText(row, "additional_notes") } : {}),
    },
    privateContext: json(row, "internal_private_context", {}),
    status: text(row, "status") as ServiceRequest["status"], currentVersion: number(row, "current_version"),
    createdBy: text(row, "created_by"), createdAt: text(row, "created_at"),
    ...(optionalText(row, "published_by") ? { publishedBy: optionalText(row, "published_by") } : {}),
    ...(optionalText(row, "published_at") ? { publishedAt: optionalText(row, "published_at") } : {}),
    ...(optionalText(row, "closed_at") ? { closedAt: optionalText(row, "closed_at") } : {}),
    ...(optionalText(row, "cancellation_reason") ? { cancellationReason: optionalText(row, "cancellation_reason") } : {}),
    updatedAt: text(row, "updated_at"),
  };
}

function versionFromRow(row: JsonRow): ServiceRequestVersion {
  return { requestId: text(row, "request_id"), organisationId: text(row, "organisation_id"), version: number(row, "version"), publishedSnapshot: json(row, "published_snapshot", {}) as ServiceRequestVersion["publishedSnapshot"], publishedAt: text(row, "published_at"), publishedBy: text(row, "published_by"), changeSummary: text(row, "change_summary") };
}

function membershipFromRow(row: JsonRow): ProviderMembership {
  return { id: text(row, "id"), providerId: text(row, "provider_id"), email: text(row, "email"), displayName: text(row, "display_name"), ...(optionalText(row, "auth_subject") ? { authSubject: optionalText(row, "auth_subject") } : {}), authBindingStatus: text(row, "auth_binding_status") === "bound" ? "bound" : "pending", ...(optionalText(row, "auth_bound_at") ? { authBoundAt: optionalText(row, "auth_bound_at") } : {}), ...(optionalText(row, "last_login_at") ? { lastLoginAt: optionalText(row, "last_login_at") } : {}), role: text(row, "role") === "Provider Admin" ? "Provider Admin" : "Provider User", active: bool(row, "active"), createdAt: text(row, "created_at"), updatedAt: text(row, "updated_at") };
}

function invitationFromRow(row: JsonRow): ServiceRequestInvitation {
  return { id: text(row, "id"), requestId: text(row, "request_id"), organisationId: text(row, "organisation_id"), providerId: text(row, "provider_id"), requestVersion: number(row, "request_version"), ...(optionalText(row, "invited_provider_membership_id") ? { invitedProviderMembershipId: optionalText(row, "invited_provider_membership_id") } : {}), ...(optionalText(row, "invited_contact_email") ? { invitedContactEmail: optionalText(row, "invited_contact_email") } : {}), status: text(row, "status") as ServiceRequestInvitation["status"], notificationStatus: text(row, "notification_status") as ServiceRequestInvitation["notificationStatus"], notificationAttemptCount: number(row, "notification_attempt_count"), ...(optionalText(row, "notification_failure_code") ? { notificationFailureCode: optionalText(row, "notification_failure_code") } : {}), ...(optionalText(row, "notification_provider_id") ? { notificationProviderId: optionalText(row, "notification_provider_id") } : {}), ...(optionalText(row, "sent_at") ? { sentAt: optionalText(row, "sent_at") } : {}), ...(optionalText(row, "viewed_at") ? { viewedAt: optionalText(row, "viewed_at") } : {}), deadline: text(row, "response_deadline"), ...(optionalText(row, "declined_at") ? { declinedAt: optionalText(row, "declined_at") } : {}), ...(optionalText(row, "decline_reason_category") ? { declineReasonCategory: optionalText(row, "decline_reason_category") as ServiceRequestInvitation["declineReasonCategory"] } : {}), ...(optionalText(row, "decline_note") ? { declineNote: optionalText(row, "decline_note") } : {}), createdAt: text(row, "created_at"), updatedAt: text(row, "updated_at") };
}

function responseFromRow(row: JsonRow): ServiceRequestResponse {
  return { id: text(row, "id"), requestId: text(row, "request_id"), invitationId: text(row, "invitation_id"), organisationId: text(row, "organisation_id"), providerId: text(row, "provider_id"), providerMembershipId: text(row, "provider_membership_id"), requestVersion: number(row, "request_version"), status: text(row, "status") as ServiceRequestResponse["status"], draftContent: json(row, "draft_content", {}) as ServiceRequestResponse["draftContent"], currentVersion: number(row, "current_version"), createdAt: text(row, "created_at"), ...(optionalText(row, "submitted_at") ? { submittedAt: optionalText(row, "submitted_at") } : {}), updatedAt: text(row, "updated_at") };
}

function responseVersionFromRow(row: JsonRow): ServiceRequestResponseVersion {
  return { responseId: text(row, "response_id"), requestId: text(row, "request_id"), organisationId: text(row, "organisation_id"), providerId: text(row, "provider_id"), requestVersion: number(row, "request_version"), version: number(row, "version"), submittedContent: json(row, "submitted_content", {}) as ServiceRequestResponseVersion["submittedContent"], submittedByProviderMembershipId: text(row, "submitted_by_provider_membership_id"), submittedAt: text(row, "submitted_at") };
}

function clarificationFromRow(row: JsonRow): ServiceRequestClarification {
  return { id: text(row, "id"), requestId: text(row, "request_id"), invitationId: text(row, "invitation_id"), organisationId: text(row, "organisation_id"), providerId: text(row, "provider_id"), requestVersion: number(row, "request_version"), askedByType: text(row, "asked_by_type") as ServiceRequestClarification["askedByType"], ...(optionalText(row, "asked_by_provider_membership_id") ? { askedByProviderMembershipId: optionalText(row, "asked_by_provider_membership_id") } : {}), ...(optionalText(row, "asked_by_employer_user_id") ? { askedByEmployerUserId: optionalText(row, "asked_by_employer_user_id") } : {}), question: text(row, "question"), visibility: text(row, "visibility") as ServiceRequestClarification["visibility"], askedAt: text(row, "asked_at"), ...(optionalText(row, "answer") ? { answer: optionalText(row, "answer") } : {}), ...(optionalText(row, "answered_by_type") ? { answeredByType: optionalText(row, "answered_by_type") as ServiceRequestClarification["answeredByType"] } : {}), ...(optionalText(row, "answered_by_provider_membership_id") ? { answeredByProviderMembershipId: optionalText(row, "answered_by_provider_membership_id") } : {}), ...(optionalText(row, "answered_by_employer_user_id") ? { answeredByEmployerUserId: optionalText(row, "answered_by_employer_user_id") } : {}), ...(optionalText(row, "answered_at") ? { answeredAt: optionalText(row, "answered_at") } : {}), ...(optionalText(row, "shared_by_employer_user_id") ? { sharedByEmployerUserId: optionalText(row, "shared_by_employer_user_id") } : {}), ...(optionalText(row, "shared_at") ? { sharedAt: optionalText(row, "shared_at") } : {}) };
}

function decisionFromRow(row: JsonRow): ServiceRequestDecision {
  return { id: text(row, "id"), requestId: text(row, "request_id"), invitationId: text(row, "invitation_id"), responseId: text(row, "response_id"), organisationId: text(row, "organisation_id"), providerId: text(row, "provider_id"), state: text(row, "state") as ServiceRequestDecision["state"], ...(optionalText(row, "private_decision_note") ? { privateDecisionNote: optionalText(row, "private_decision_note") } : {}), ...(optionalText(row, "shortlisted_at") ? { shortlistedAt: optionalText(row, "shortlisted_at") } : {}), ...(optionalText(row, "shortlisted_by") ? { shortlistedBy: optionalText(row, "shortlisted_by") } : {}), ...(optionalText(row, "declined_at") ? { declinedAt: optionalText(row, "declined_at") } : {}), ...(optionalText(row, "declined_by") ? { declinedBy: optionalText(row, "declined_by") } : {}), ...(optionalText(row, "progressed_at") ? { progressedAt: optionalText(row, "progressed_at") } : {}), ...(optionalText(row, "progressed_by") ? { progressedBy: optionalText(row, "progressed_by") } : {}), ...(optionalText(row, "agreement_confirmed_at") ? { agreementConfirmedAt: optionalText(row, "agreement_confirmed_at") } : {}), ...(optionalText(row, "agreement_confirmed_by") ? { agreementConfirmedBy: optionalText(row, "agreement_confirmed_by") } : {}), ...(optionalText(row, "not_proceeded_at") ? { notProceededAt: optionalText(row, "not_proceeded_at") } : {}), ...(optionalText(row, "not_proceeded_by") ? { notProceededBy: optionalText(row, "not_proceeded_by") } : {}), updatedAt: text(row, "updated_at") };
}

function agreementFromRow(row: JsonRow): RequestAgreementSnapshot {
  const snapshot = json<Omit<RequestAgreementSnapshot, "id" | "requestId" | "organisationId" | "providerId" | "invitationId" | "responseId" | "responseVersion" | "confirmedAt" | "confirmedBy">>(row, "commitment_snapshot", {} as never);
  return { ...snapshot, id: text(row, "id"), requestId: text(row, "request_id"), organisationId: text(row, "organisation_id"), providerId: text(row, "provider_id"), invitationId: text(row, "invitation_id"), responseId: text(row, "response_id"), responseVersion: number(row, "response_version"), ...(optionalText(row, "proposed_programme_id") ? { proposedProgrammeId: optionalText(row, "proposed_programme_id") } : {}), confirmedAt: text(row, "confirmed_at"), confirmedBy: text(row, "confirmed_by") };
}

function handoverFromRow(row: JsonRow): RequestWorkspaceHandover {
  return { id: text(row, "id"), requestId: text(row, "request_id"), organisationId: text(row, "organisation_id"), agreementSnapshotId: text(row, "agreement_id"), providerId: text(row, "provider_id"), ...(optionalText(row, "programme_id") ? { programmeId: optionalText(row, "programme_id") } : {}), addProvider: bool(row, "add_provider"), addProgramme: bool(row, "add_programme"), providerAdded: bool(row, "provider_added"), programmeAdded: bool(row, "programme_added"), idempotencyKey: text(row, "idempotency_key"), completedBy: text(row, "completed_by"), completedAt: text(row, "completed_at") };
}

function eventFromRow(row: JsonRow): ServiceRequestEvent {
  return { id: text(row, "id"), requestId: text(row, "request_id"), organisationId: text(row, "organisation_id"), eventType: text(row, "event_type") as ServiceRequestEvent["eventType"], actorType: text(row, "actor_type") as ServiceRequestEvent["actorType"], ...(optionalText(row, "actor_id") ? { actorId: optionalText(row, "actor_id") } : {}), ...(optionalText(row, "invitation_id") ? { invitationId: optionalText(row, "invitation_id") } : {}), ...(optionalText(row, "response_id") ? { responseId: optionalText(row, "response_id") } : {}), ...(optionalText(row, "provider_id") ? { providerId: optionalText(row, "provider_id") } : {}), idempotencyKey: text(row, "idempotency_key"), metadata: json(row, "metadata", {}), occurredAt: text(row, "occurred_at") };
}

async function selectRows(table: string, params: Record<string, string>) {
  return supabaseSelect<JsonRow>(config(), table, new URLSearchParams({ select: "*", ...params }));
}

async function loadStoreForOrganisation(
  organisationId: string,
  selections: Pick<ServiceRequestStore, "organisationProviderSelections" | "organisationProgrammeSelections"> = {
    organisationProviderSelections: [],
    organisationProgrammeSelections: [],
  },
  refreshDeadlines = true,
) {
  const enabled = await isRequestsEnabledForOrganisation(organisationId);
  const scope = { organisation_id: `eq.${organisationId}` };
  const [requestRows, versionRows, invitationRows, responseRows, responseVersionRows, clarificationRows, decisionRows, agreementRows, handoverRows, eventRows] = enabled
    ? await Promise.all([
        selectRows(tables.requests, scope), selectRows(tables.versions, scope), selectRows(tables.invitations, scope),
        selectRows(tables.responses, scope), selectRows(tables.responseVersions, scope), selectRows(tables.clarifications, scope),
        selectRows(tables.decisions, scope), selectRows(tables.agreements, scope), selectRows(tables.handovers, scope),
        selectRows(tables.events, scope),
      ])
    : [[], [], [], [], [], [], [], [], [], []] as JsonRow[][];
  const providerIds = [...new Set(invitationRows.map((row) => text(row, "provider_id")).filter(Boolean))];
  const membershipRows = providerIds.length
    ? await selectRows(tables.memberships, { provider_id: `in.(${providerIds.map(encodeURIComponent).join(",")})` })
    : [];
  const store = createEmptyServiceRequestStore(enabled ? [{ organisationId, requestsEnabled: true }] : []);
  store.requests = requestRows.map(requestFromRow);
  store.requestVersions = versionRows.map(versionFromRow);
  store.providerMemberships = membershipRows.map(membershipFromRow);
  store.invitations = invitationRows.map(invitationFromRow);
  store.responses = responseRows.map(responseFromRow);
  store.responseVersions = responseVersionRows.map(responseVersionFromRow);
  store.clarifications = clarificationRows.map(clarificationFromRow);
  store.decisions = decisionRows.map(decisionFromRow);
  store.agreementSnapshots = agreementRows.map(agreementFromRow);
  store.handovers = handoverRows.map(handoverFromRow);
  store.events = eventRows.map(eventFromRow);
  store.organisationProviderSelections = [...selections.organisationProviderSelections];
  store.organisationProgrammeSelections = [...selections.organisationProgrammeSelections];
  if (!refreshDeadlines) return store;
  const beforeDeadlineRefresh = structuredClone(store);
  markPastDeadlineInvitations(store, new Date().toISOString().slice(0, 10));
  if (changed(beforeDeadlineRefresh, store)) {
    await persistStore(beforeDeadlineRefresh, store);
    // Database timestamp triggers own updated_at. Reload once so a follow-on
    // action in this request uses the exact persisted optimistic-lock values.
    return loadStoreForOrganisation(organisationId, selections, false);
  }
  return store;
}

const requestRow = (item: ServiceRequest) => ({
  organisation_id: item.organisationId, id: item.id, title: item.content.title,
  request_mode: item.content.requestMode, requirement: item.content.requirement,
  programme_id: item.content.programmeId ?? null,
  apprenticeship_standard_id: item.content.apprenticeshipStandardId ?? null,
  programme_title: item.content.programmeTitle ?? null,
  provider_context_id: item.content.providerContextId ?? null,
  readiness: item.content.readiness, learner_volume: item.content.learnerVolume,
  workplace_location: item.content.workplaceLocation, delivery_preferences: item.content.deliveryPreferences,
  preferred_start: item.content.preferredStart, departments: item.content.departments ?? [],
  target_roles: item.content.targetRoles ?? [], workforce_mix: item.content.workforceMix ?? null,
  business_outcome: item.content.businessOutcome ?? null,
  workplace_project_requirements: item.content.workplaceProjectRequirements ?? null,
  accessibility_considerations: item.content.accessibilityConsiderations ?? null,
  procurement_requirements: item.content.procurementRequirements ?? null,
  additional_notes: item.content.additionalNotes ?? null,
  internal_private_context: item.privateContext, status: item.status,
  response_deadline: item.content.responseDeadline, current_version: item.currentVersion,
  created_by: item.createdBy, created_at: item.createdAt, published_by: item.publishedBy ?? null,
  published_at: item.publishedAt ?? null, closed_at: item.closedAt ?? null,
  cancellation_reason: item.cancellationReason ?? null, updated_at: item.updatedAt,
});
const versionRow = (item: ServiceRequestVersion) => ({ organisation_id: item.organisationId, request_id: item.requestId, version: item.version, published_snapshot: item.publishedSnapshot, published_at: item.publishedAt, published_by: item.publishedBy, change_summary: item.changeSummary });
const invitationRow = (item: ServiceRequestInvitation) => ({ organisation_id: item.organisationId, id: item.id, request_id: item.requestId, provider_id: item.providerId, request_version: item.requestVersion, invited_provider_membership_id: item.invitedProviderMembershipId ?? null, invited_contact_email: item.invitedContactEmail ?? null, status: item.status, notification_status: item.notificationStatus, notification_attempt_count: item.notificationAttemptCount, notification_failure_code: item.notificationFailureCode ?? null, notification_provider_id: item.notificationProviderId ?? null, sent_at: item.sentAt ?? null, viewed_at: item.viewedAt ?? null, response_deadline: item.deadline, declined_at: item.declinedAt ?? null, decline_reason_category: item.declineReasonCategory ?? null, decline_note: item.declineNote ?? null, created_at: item.createdAt, updated_at: item.updatedAt });
const responseRow = (item: ServiceRequestResponse) => ({ organisation_id: item.organisationId, id: item.id, request_id: item.requestId, invitation_id: item.invitationId, provider_id: item.providerId, provider_membership_id: item.providerMembershipId, request_version: item.requestVersion, status: item.status, draft_content: item.draftContent, current_version: item.currentVersion, created_at: item.createdAt, submitted_at: item.submittedAt ?? null, updated_at: item.updatedAt });
const responseVersionRow = (item: ServiceRequestResponseVersion) => ({ organisation_id: item.organisationId, response_id: item.responseId, request_id: item.requestId, provider_id: item.providerId, request_version: item.requestVersion, version: item.version, submitted_content: item.submittedContent, submitted_by_provider_membership_id: item.submittedByProviderMembershipId, submitted_at: item.submittedAt });
const clarificationRow = (item: ServiceRequestClarification) => ({ organisation_id: item.organisationId, id: item.id, request_id: item.requestId, invitation_id: item.invitationId, provider_id: item.providerId, request_version: item.requestVersion, asked_by_type: item.askedByType, asked_by_provider_membership_id: item.askedByProviderMembershipId ?? null, asked_by_employer_user_id: item.askedByEmployerUserId ?? null, question: item.question, visibility: item.visibility, asked_at: item.askedAt, answer: item.answer ?? null, answered_by_type: item.answeredByType ?? null, answered_by_provider_membership_id: item.answeredByProviderMembershipId ?? null, answered_by_employer_user_id: item.answeredByEmployerUserId ?? null, answered_at: item.answeredAt ?? null, shared_by_employer_user_id: item.sharedByEmployerUserId ?? null, shared_at: item.sharedAt ?? null });
const decisionRow = (item: ServiceRequestDecision) => ({ organisation_id: item.organisationId, id: item.id, request_id: item.requestId, invitation_id: item.invitationId, response_id: item.responseId, provider_id: item.providerId, state: item.state, private_decision_note: item.privateDecisionNote ?? null, shortlisted_at: item.shortlistedAt ?? null, shortlisted_by: item.shortlistedBy ?? null, declined_at: item.declinedAt ?? null, declined_by: item.declinedBy ?? null, progressed_at: item.progressedAt ?? null, progressed_by: item.progressedBy ?? null, agreement_confirmed_at: item.agreementConfirmedAt ?? null, agreement_confirmed_by: item.agreementConfirmedBy ?? null, not_proceeded_at: item.notProceededAt ?? null, not_proceeded_by: item.notProceededBy ?? null, updated_at: item.updatedAt });
const agreementRow = (item: RequestAgreementSnapshot) => ({ organisation_id: item.organisationId, id: item.id, request_id: item.requestId, invitation_id: item.invitationId, response_id: item.responseId, response_version: item.responseVersion, provider_id: item.providerId, proposed_programme_id: item.proposedProgrammeId ?? null, commitment_snapshot: { proposedStart: item.proposedStart, deliveryApproach: item.deliveryApproach, workplaceRequirements: item.workplaceRequirements, learningCommitment: item.learningCommitment, employerReportingSupport: item.employerReportingSupport, proposedTrainingAssessmentPricePence: item.proposedTrainingAssessmentPricePence, priceBasisAndAssumptions: item.priceBasisAndAssumptions, additionalCommercialCosts: item.additionalCommercialCosts, exceptionsOrClarifications: item.exceptionsOrClarifications, label: item.label }, confirmed_by: item.confirmedBy, confirmed_at: item.confirmedAt });
const handoverRow = (item: RequestWorkspaceHandover) => ({ organisation_id: item.organisationId, id: item.id, request_id: item.requestId, agreement_id: item.agreementSnapshotId, provider_id: item.providerId, programme_id: item.programmeId ?? null, add_provider: item.addProvider, add_programme: item.addProgramme, provider_added: item.providerAdded, programme_added: item.programmeAdded, idempotency_key: item.idempotencyKey, completed_by: item.completedBy, completed_at: item.completedAt });
const eventRow = (item: ServiceRequestEvent) => ({ organisation_id: item.organisationId, id: item.id, request_id: item.requestId, invitation_id: item.invitationId ?? null, response_id: item.responseId ?? null, provider_id: item.providerId ?? null, event_type: item.eventType, actor_type: item.actorType, actor_id: item.actorId ?? null, idempotency_key: item.idempotencyKey, metadata: item.metadata, occurred_at: item.occurredAt });

function changed(left: unknown, right: unknown) {
  return JSON.stringify(left) !== JSON.stringify(right);
}

type PersistStoreOptions = {
  selectionActorEmail?: string;
};

function mutableRows<T extends { id: string; organisationId: string; updatedAt: string }>(
  before: T[],
  after: T[],
  row: (item: T) => unknown,
) {
  const prior = new Map(before.map((item) => [item.id, item]));
  const insert: unknown[] = [];
  const update: unknown[] = [];
  const expected: Array<{ id: string; updated_at: string }> = [];
  for (const item of after) {
    const previous = prior.get(item.id);
    if (!previous) insert.push(row(item));
    else if (changed(previous, item)) {
      update.push(row(item));
      expected.push({ id: item.id, updated_at: previous.updatedAt });
    }
  }
  return { insert, update, expected };
}

async function persistStore(
  before: ServiceRequestStore,
  after: ServiceRequestStore,
  options: PersistStoreOptions = {},
) {
  const organisations = new Set([
    ...after.requests.map((item) => item.organisationId),
    ...after.invitations.map((item) => item.organisationId),
    ...after.responses.map((item) => item.organisationId),
    ...after.clarifications.map((item) => item.organisationId),
    ...after.decisions.map((item) => item.organisationId),
    ...after.events.map((item) => item.organisationId),
  ]);
  if (organisations.size !== 1) {
    throw new LevyTateServiceRequestError("Requests persistence scope is invalid.", 403);
  }
  const organisationId = [...organisations][0];
  if (!organisationId) return;

  const requests = mutableRows(before.requests, after.requests, requestRow);
  const invitations = mutableRows(before.invitations, after.invitations, invitationRow);
  const responses = mutableRows(before.responses, after.responses, responseRow);
  const decisions = mutableRows(before.decisions, after.decisions, decisionRow);

  const priorClarifications = new Map(before.clarifications.map((item) => [item.id, item]));
  const clarificationsInsert: unknown[] = [];
  const clarificationsUpdate: unknown[] = [];
  const clarificationsExpected: unknown[] = [];
  for (const item of after.clarifications) {
    const previous = priorClarifications.get(item.id);
    if (!previous) clarificationsInsert.push(clarificationRow(item));
    else if (changed(previous, item)) {
      clarificationsUpdate.push(clarificationRow(item));
      clarificationsExpected.push(clarificationRow(previous));
    }
  }

  const priorVersions = new Set(before.requestVersions.map((item) => `${item.requestId}:${item.version}`));
  const priorResponseVersions = new Set(before.responseVersions.map((item) => `${item.responseId}:${item.version}`));
  const priorAgreements = new Set(before.agreementSnapshots.map((item) => item.id));
  const priorHandovers = new Set(before.handovers.map((item) => item.id));
  const priorEvents = new Set(before.events.map((item) => item.id));
  const newEvents = after.events.filter((item) => !priorEvents.has(item.id));
  const newHandovers = after.handovers.filter((item) => !priorHandovers.has(item.id));
  const selectionActorEmail = options.selectionActorEmail?.trim();
  if (newHandovers.some((item) => item.providerAdded || item.programmeAdded) && !selectionActorEmail) {
    throw new LevyTateServiceRequestError("Workspace handover actor is required.", 403);
  }
  const selectedBy = selectionActorEmail ?? "";
  const organisationProviders = newHandovers
    .filter((item) => item.providerAdded)
    .map((item) => ({
      organisation_id: item.organisationId,
      provider_id: item.providerId,
      status: "Active",
      selected_by: selectedBy,
      selected_at: item.completedAt,
      updated_at: item.completedAt,
    }));
  const organisationProgrammes = newHandovers
    .filter((item) => item.programmeAdded && item.programmeId)
    .map((item) => ({
      organisation_id: item.organisationId,
      programme_id: item.programmeId,
      provider_id: item.providerId,
      status: "Active",
      selected_by: selectedBy,
      selected_at: item.completedAt,
      updated_at: item.completedAt,
    }));

  const changes = {
    requests_insert: requests.insert,
    requests_update: requests.update,
    versions_insert: after.requestVersions.filter((item) => !priorVersions.has(`${item.requestId}:${item.version}`)).map(versionRow),
    invitations_insert: invitations.insert,
    invitations_update: invitations.update,
    responses_insert: responses.insert,
    responses_update: responses.update,
    response_versions_insert: after.responseVersions.filter((item) => !priorResponseVersions.has(`${item.responseId}:${item.version}`)).map(responseVersionRow),
    clarifications_insert: clarificationsInsert,
    clarifications_update: clarificationsUpdate,
    decisions_insert: decisions.insert,
    decisions_update: decisions.update,
    agreements_insert: after.agreementSnapshots.filter((item) => !priorAgreements.has(item.id)).map(agreementRow),
    handovers_insert: newHandovers.map(handoverRow),
    organisation_providers_upsert: organisationProviders,
    organisation_programmes_upsert: organisationProgrammes,
    events_insert: newEvents.map(eventRow),
  };
  if (!Object.values(changes).some((rows) => rows.length)) return;

  // Guard every Request touched directly or through a child row. Some valid
  // actions (notably a new invitation or an existing response draft update)
  // do not emit an event, so events alone are not a complete read set.
  const guardedRequestIds = new Set(newEvents.map((item) => item.requestId));
  for (const item of [...requests.insert, ...requests.update] as Array<Record<string, unknown>>) {
    if (typeof item.id === "string") guardedRequestIds.add(item.id);
  }
  for (const rows of Object.values(changes)) {
    for (const item of rows as Array<Record<string, unknown>>) {
      if (typeof item.request_id === "string") guardedRequestIds.add(item.request_id);
    }
  }
  const expectedRequests = before.requests
    .filter((item) => guardedRequestIds.has(item.id))
    .map((item) => ({ id: item.id, updated_at: item.updatedAt }));

  await supabaseFetchJson<unknown>(config(), "rpc/levytate_persist_service_request_action", {
    method: "POST",
    body: JSON.stringify({
      p_organisation_id: organisationId,
      p_changes: changes,
      p_expected: {
        requests: expectedRequests,
        invitations: invitations.expected,
        responses: responses.expected,
        decisions: decisions.expected,
        clarifications: clarificationsExpected,
      },
    }),
  });
}

function employerActor(
  session: LevyTateBetaSession,
  context: Awaited<ReturnType<typeof getLearnerLifecycleServerContext>>,
): EmployerRequestActor {
  return {
    userId: context.user.id,
    email: session.email,
    organisationId: context.organisation.id,
    role: normaliseMvpUserRole(context.user.role),
  };
}

function providerActor(session: LevyTateProviderSession): ProviderRequestActor {
  return {
    membershipId: session.membershipId,
    providerId: session.providerId,
    email: session.email,
    role: session.role,
    active: true,
  };
}

function providerNameMap(providerOptions: RequestProviderOption[]) {
  return new Map(providerOptions.map((provider) => [provider.providerId, provider.providerName]));
}

function buildEmployerRequestView(
  store: ServiceRequestStore,
  actor: EmployerRequestActor,
  request: ServiceRequest,
  providers: Map<string, string>,
): EmployerServiceRequestView {
  const related = <T extends { requestId: string }>(items: T[]) => items.filter((item) => item.requestId === request.id);
  const responseVersions = related(store.responseVersions).sort((left, right) => right.version - left.version);
  const submittedResponses = related(store.responses).flatMap((response) => {
    const submitted = responseVersions.find((version) => version.responseId === response.id);
    if (!submitted) return [];
    return [{
      id: response.id,
      requestId: response.requestId,
      invitationId: response.invitationId,
      organisationId: response.organisationId,
      providerId: response.providerId,
      providerName: providers.get(response.providerId) ?? "Responding provider",
      requestVersion: submitted.requestVersion,
      currentVersion: response.currentVersion,
      submittedAt: submitted.submittedAt,
      submittedContent: structuredClone(submitted.submittedContent),
    }];
  });
  return {
    ...getEmployerRequest(store, actor, request.id),
    versions: related(store.requestVersions).sort((left, right) => right.version - left.version),
    invitations: related(store.invitations).map((item) => ({ ...item, providerName: providers.get(item.providerId) ?? "Invited provider" })),
    responses: submittedResponses,
    responseVersions,
    clarifications: related(store.clarifications).map((item) => ({ ...item, providerName: providers.get(item.providerId) ?? "Provider" })),
    decisions: related(store.decisions).map((item) => ({ ...item, providerName: providers.get(item.providerId) ?? "Provider" })),
    agreementSnapshots: related(store.agreementSnapshots),
    handovers: related(store.handovers),
    comparison: compareSubmittedResponses(store, actor, request.id),
  };
}

async function allActiveProviderMemberships() {
  const rows = await selectRows(tables.memberships, { active: "eq.true" });
  return rows.map(membershipFromRow);
}

export async function getEmployerRequestsWorkspaceForSession(
  session: LevyTateBetaSession,
): Promise<EmployerRequestsWorkspaceBootstrap> {
  const [context, workspace] = await Promise.all([
    getLearnerLifecycleServerContext(session),
    getWorkspaceBootstrapForSession(session),
  ]);
  const actor = employerActor(session, context);
  const requestsEnabled = workspace.meta.requestsEnabled === true;
  if (!requestsEnabled) throw new LevyTateServiceRequestError("Requests is not enabled for this workspace.", 404);
  if (!hasEmployerRequestPermission(actor.role, "serviceRequests:read")) {
    throw new LevyTateServiceRequestError("This role cannot access Requests.", 403);
  }
  const selections = {
    organisationProviderSelections: workspace.data.organisationProviders
      .filter((item) => item.status === "Active")
      .map((item) => ({ organisationId: context.organisation.id, providerId: item.providerId })),
    organisationProgrammeSelections: workspace.data.organisationProgrammes
      .filter((item) => item.status === "Active")
      .map((item) => ({ organisationId: context.organisation.id, programmeId: item.programmeId, providerId: item.providerId })),
  };
  const [store, providerMemberships] = await Promise.all([
    loadStoreForOrganisation(context.organisation.id, selections),
    allActiveProviderMemberships(),
  ]);
  const activeProviderIds = new Set(providerMemberships.map((item) => item.providerId));
  const selectedProviderIds = new Set(selections.organisationProviderSelections.map((item) => item.providerId));
  const providerOptions: RequestProviderOption[] = workspace.data.providers
    .filter((provider) => provider.status === "Active")
    .map((provider) => ({
      providerId: provider.providerId,
      providerName: provider.providerName,
      deliveryModels: provider.deliveryModels,
      regions: provider.regions,
      programmeIds: workspace.data.providerProgrammes.filter((programme) => programme.providerId === provider.providerId && programme.status === "Active" && programme.recordStatus === "Active").map((programme) => programme.id),
      relationshipStatus: selectedProviderIds.has(provider.providerId) ? "existing" as const : "marketplace" as const,
      providerAccessReady: activeProviderIds.has(provider.providerId),
    }))
    .sort((left, right) => left.providerName.localeCompare(right.providerName));
  const programmeOptions: RequestProgrammeOption[] = workspace.data.providerProgrammes
    .filter((programme) => programme.status === "Active" && programme.recordStatus === "Active")
    .map((programme) => ({
      programmeId: programme.id,
      providerId: programme.providerId,
      programmeName: programme.programmeName,
      apprenticeshipStandardId: programme.linkedStandardId || undefined,
      level: programme.level ?? undefined,
      fundingBandMaximumPence: programme.fundingBand == null ? undefined : Math.round(programme.fundingBand * 100),
    }))
    .sort((left, right) => left.programmeName.localeCompare(right.programmeName));
  const names = providerNameMap(providerOptions);
  const requests = listEmployerRequests(store, actor).map((request) => buildEmployerRequestView(store, actor, request, names));
  return {
    requestsEnabled,
    organisation: { id: context.organisation.id, name: context.organisation.name },
    metrics: employerRequestMetrics(store, actor),
    requests,
    providerOptions,
    programmeOptions,
  };
}

function getResponseProviderId(store: ServiceRequestStore, requestId: string, responseId: string) {
  const response = store.responses.find((item) => item.id === responseId && item.requestId === requestId);
  if (!response) throw new LevyTateServiceRequestError("The submitted provider response was not found.", 404);
  return response.providerId;
}

function canonicalRequestContent(content: ServiceRequest["content"], workspace: Awaited<ReturnType<typeof getWorkspaceBootstrapForSession>>) {
  const activeProviders = new Set(workspace.data.providers.filter((item) => item.status === "Active").map((item) => item.providerId));
  const activeProgrammes = workspace.data.providerProgrammes.filter((item) => item.status === "Active" && item.recordStatus === "Active");
  if (content.providerContextId && !activeProviders.has(content.providerContextId)) {
    throw new LevyTateServiceRequestError("The Marketplace provider context is unavailable.");
  }
  const programme = content.programmeId ? activeProgrammes.find((item) => item.id === content.programmeId) : undefined;
  if (content.programmeId && !programme) {
    throw new LevyTateServiceRequestError("The selected Marketplace programme is unavailable.");
  }
  if (programme && content.providerContextId && programme.providerId !== content.providerContextId) {
    throw new LevyTateServiceRequestError("The selected programme does not belong to the Marketplace provider context.");
  }
  const safe = { ...content };
  delete safe.programmeTitle;
  delete safe.apprenticeshipStandardId;
  return {
    ...safe,
    ...(programme ? {
      programmeTitle: programme.programmeName,
      ...(programme.linkedStandardId ? { apprenticeshipStandardId: programme.linkedStandardId } : {}),
    } : {}),
  };
}

function canonicalPrivateContext(value: ServiceRequest["privateContext"] | undefined) {
  if (!value) return undefined;
  if (value.employeeIds?.length || value.learnerIds?.length || value.applicationIds?.length || value.financeReference || value.intelligenceSignalIds?.length) {
    throw new LevyTateServiceRequestError("Private operational record links are not supported in Requests V1.1.");
  }
  return {
    ...(value.privateNotes ? { privateNotes: value.privateNotes } : {}),
    ...(value.privateProviderConcern ? { privateProviderConcern: value.privateProviderConcern } : {}),
  };
}

function assertCanonicalProviders(providerIds: string[], workspace: Awaited<ReturnType<typeof getWorkspaceBootstrapForSession>>) {
  const active = new Set(workspace.data.providers.filter((item) => item.status === "Active").map((item) => item.providerId));
  if (providerIds.some((providerId) => !active.has(providerId))) {
    throw new LevyTateServiceRequestError("One or more selected providers are unavailable.");
  }
}

async function deliverInvitation(
  store: ServiceRequestStore,
  actor: EmployerRequestActor,
  invitation: ServiceRequestInvitation,
  idempotencyKey: string,
  organisationName: string,
) {
  if (store.events.some((event) => event.organisationId === invitation.organisationId && event.requestId === invitation.requestId && event.idempotencyKey === `delivery:${idempotencyKey}`)) return;
  const before = structuredClone(store);
  const member = store.providerMemberships
    .filter((item) => item.providerId === invitation.providerId && item.active)
    .sort((left, right) => Number(right.role === "Provider Admin") - Number(left.role === "Provider Admin") || left.email.localeCompare(right.email))[0];
  if (!member) {
    recordInvitationDelivery(store, actor, invitation.id, { accepted: false, failureCode: "provider_access_not_configured", idempotencyKey });
    await persistStore(before, store);
    return;
  }
  invitation.invitedProviderMembershipId = member.id;
  invitation.invitedContactEmail = member.email;
  const request = store.requests.find((item) => item.id === invitation.requestId);
  const requestTitle = request?.content.title ?? "Employer apprenticeship requirement";
  try {
    const providerMessageId = await sendEmail({
      from: "LevyTate <hello@levytate.co.uk>",
      to: member.email,
      subject: "A new employer opportunity is ready in LevyTate",
      text: `${organisationName} has invited your provider to respond to “${requestTitle}” by ${invitation.deadline}. Sign in securely: ${providerLoginUrl()}\n\nThe full approved brief is available only after secure sign-in.`,
      html: `<p>${escapeHtml(organisationName)} has invited your provider to respond to <strong>${escapeHtml(requestTitle)}</strong> by ${escapeHtml(invitation.deadline)}.</p><p><a href="${providerLoginUrl()}">Sign in to Opportunities</a></p><p>The full approved brief is available only after secure sign-in.</p>`,
      idempotencyKey: `service-request-invitation/${invitation.id}`,
    });
    recordInvitationDelivery(store, actor, invitation.id, { accepted: true, idempotencyKey, providerMessageId });
  } catch {
    recordInvitationDelivery(store, actor, invitation.id, { accepted: false, failureCode: "delivery_provider_unavailable", idempotencyKey });
  }
  await persistStore(before, store);
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] ?? character);
}

function providerLoginUrl() {
  const host = process.env.VERCEL_BRANCH_URL || process.env.VERCEL_URL;
  return host ? `https://${host}/levytate/provider/login` : "http://localhost:3000/levytate/provider/login";
}

function employerLoginUrl() {
  const host = process.env.VERCEL_BRANCH_URL || process.env.VERCEL_URL;
  return host ? `https://${host}/levytate/login` : "http://localhost:3000/levytate/login";
}

async function notifyEmployerOfResponse(store: ServiceRequestStore, invitation: ServiceRequestInvitation) {
  try {
    const recipients = await supabaseSelect<{ email: string }>(config(), "levytate_users", new URLSearchParams({
      select: "email",
      organisation_id: `eq.${invitation.organisationId}`,
      role: "in.(Apprenticeship Lead,Employer Admin)",
      active: "eq.true",
      order: "email.asc",
      limit: "10",
    }));
    const version = store.requestVersions.find((item) => item.requestId === invitation.requestId && item.version === invitation.requestVersion);
    const title = version?.publishedSnapshot.title ?? "Employer Request";
    const response = store.responses.find((item) => item.invitationId === invitation.id);
    if (!response?.currentVersion) return;
    const before = structuredClone(store);
    const deliveries = await Promise.allSettled(recipients.map(async (recipient) => {
      const recipientKey = createHash("sha256").update(recipient.email.trim().toLowerCase()).digest("hex").slice(0, 24);
      const notificationKey = `response-notification:${response.id}:${response.currentVersion}:${recipientKey}`;
      if (store.events.some((event) => event.requestId === invitation.requestId && event.idempotencyKey === notificationKey)) return;
      await sendEmail({
        from: "LevyTate <hello@levytate.co.uk>",
        to: recipient.email,
        subject: "A provider response is ready in LevyTate",
        text: `A provider submitted a response to “${title}”. Sign in to review the structured response: ${employerLoginUrl()}`,
        html: `<p>A provider submitted a response to <strong>${escapeHtml(title)}</strong>.</p><p><a href="${employerLoginUrl()}">Sign in to review the structured response</a></p>`,
        idempotencyKey: `service-request-response/${response.id}/${response.currentVersion}/${recipientKey}`,
      });
      recordEmployerResponseNotificationSent(
        store,
        invitation.id,
        response.id,
        response.currentVersion,
        recipientKey,
      );
    }));
    if (store.events.length !== before.events.length) await persistStore(before, store);
    if (deliveries.some((delivery) => delivery.status === "rejected")) {
      console.error("LevyTate Request response notification was not accepted for every recipient.");
    }
  } catch {
    // A response remains truthfully submitted even if the status-only email is unavailable.
  }
}

export async function applyEmployerRequestActionForSession(
  session: LevyTateBetaSession,
  value: unknown,
) {
  const action = validateEmployerAction(value);
  const [context, workspace] = await Promise.all([getLearnerLifecycleServerContext(session), getWorkspaceBootstrapForSession(session)]);
  if (!workspace.meta.requestsEnabled) throw new LevyTateServiceRequestError("Requests is not enabled for this workspace.", 404);
  const actor = employerActor(session, context);
  if (!hasEmployerRequestPermission(actor.role, "serviceRequests:read")) {
    throw new LevyTateServiceRequestError("This role cannot access Requests.", 403);
  }
  const selections = {
    organisationProviderSelections: workspace.data.organisationProviders.filter((item) => item.status === "Active").map((item) => ({ organisationId: context.organisation.id, providerId: item.providerId })),
    organisationProgrammeSelections: workspace.data.organisationProgrammes.filter((item) => item.status === "Active").map((item) => ({ organisationId: context.organisation.id, programmeId: item.programmeId, providerId: item.providerId })),
  };
  const store = await loadStoreForOrganisation(context.organisation.id, selections);
  store.providerMemberships = await allActiveProviderMemberships();
  const before = structuredClone(store);
  let invitationsToDeliver: ServiceRequestInvitation[] = [];
  try {
    if ("content" in action) action.content = canonicalRequestContent(action.content, workspace);
    if ("privateContext" in action) action.privateContext = canonicalPrivateContext(action.privateContext);
    if ("providerIds" in action) assertCanonicalProviders(action.providerIds, workspace);
    switch (action.action) {
      case "create_draft": createServiceRequestDraft(store, actor, { content: action.content, privateContext: action.privateContext, idempotencyKey: action.idempotencyKey }); break;
      case "update_draft": updateServiceRequestDraft(store, actor, action.requestId, { content: action.content, privateContext: action.privateContext, idempotencyKey: action.idempotencyKey }); break;
      case "send_request": {
        const request = createServiceRequestDraft(store, actor, { content: action.content, privateContext: action.privateContext, idempotencyKey: `${action.idempotencyKey}:create` });
        publishServiceRequest(store, actor, request.id, { organisationName: context.organisation.name, idempotencyKey: `${action.idempotencyKey}:publish` });
        invitationsToDeliver = inviteProviders(store, actor, request.id, action.providerIds, { idempotencyKey: `${action.idempotencyKey}:invite` });
        break;
      }
      case "send_existing_draft": {
        const existingRequest = store.requests.find((item) => item.id === action.requestId);
        if (!existingRequest) throw new LevyTateServiceRequestError("Request was not found.", 404);
        if (existingRequest.status === "draft") {
          updateServiceRequestDraft(store, actor, action.requestId, { content: action.content, privateContext: action.privateContext, idempotencyKey: `${action.idempotencyKey}:update` });
          publishServiceRequest(store, actor, action.requestId, { organisationName: context.organisation.name, idempotencyKey: `${action.idempotencyKey}:publish` });
        } else if (JSON.stringify(existingRequest.content) !== JSON.stringify(action.content)) {
          throw new LevyTateServiceRequestError("This Request was already published with different content.", 409);
        }
        invitationsToDeliver = inviteProviders(store, actor, action.requestId, action.providerIds, { idempotencyKey: `${action.idempotencyKey}:invite` })
          .filter((item) => item.status === "pending_delivery" || item.status === "delivery_failed");
        break;
      }
      case "publish": publishServiceRequest(store, actor, action.requestId, { organisationName: context.organisation.name, idempotencyKey: action.idempotencyKey }); break;
      case "publish_revision": updatePublishedServiceRequest(store, actor, action.requestId, { content: action.content, changeSummary: action.changeSummary, idempotencyKey: action.idempotencyKey }); break;
      case "invite_providers": invitationsToDeliver = inviteProviders(store, actor, action.requestId, action.providerIds, { idempotencyKey: action.idempotencyKey }).filter((item) => item.status === "pending_delivery"); break;
      case "retry_invitation": {
        const invitation = store.invitations.find((item) => item.id === action.invitationId && item.requestId === action.requestId);
        if (!invitation) throw new LevyTateServiceRequestError("Invitation was not found.", 404);
        const parentRequest = store.requests.find((item) => item.id === invitation.requestId);
        const today = new Date().toISOString().slice(0, 10);
        if (
          !parentRequest
          || !["open", "responses_received", "decision_in_progress"].includes(parentRequest.status)
          || invitation.deadline < today
        ) {
          throw new LevyTateServiceRequestError("This Request is no longer accepting provider invitations.", 409);
        }
        if (invitation.status !== "delivery_failed" && invitation.status !== "pending_delivery") {
          throw new LevyTateServiceRequestError("Only a pending or failed provider notification can be retried.", 409);
        }
        invitationsToDeliver = [invitation]; break;
      }
      case "ask_clarification": {
        if (!store.invitations.some((item) => item.id === action.invitationId && item.requestId === action.requestId)) {
          throw new LevyTateServiceRequestError("Invitation was not found.", 404);
        }
        askProviderClarification(store, actor, action.invitationId, { question: action.question, idempotencyKey: action.idempotencyKey });
        break;
      }
      case "answer_clarification": {
        if (!store.clarifications.some((item) => item.id === action.clarificationId && item.requestId === action.requestId)) {
          throw new LevyTateServiceRequestError("Clarification was not found.", 404);
        }
        answerClarification(store, actor, action.clarificationId, { answer: action.answer, shareWithAll: action.shareWithAll, idempotencyKey: action.idempotencyKey });
        break;
      }
      case "shortlist": shortlistProvider(store, actor, action.requestId, action.responseId, { privateNote: action.privateDecisionNote, idempotencyKey: action.idempotencyKey }); break;
      case "decline_provider": declineProviderByEmployer(store, actor, action.requestId, action.responseId, { privateNote: action.privateDecisionNote, idempotencyKey: action.idempotencyKey }); break;
      case "progress_to_agreement": progressProviderToAgreement(store, actor, action.requestId, action.responseId, { privateNote: action.privateDecisionNote, idempotencyKey: action.idempotencyKey }); break;
      case "confirm_agreement": confirmAgreement(store, actor, action.requestId, getResponseProviderId(store, action.requestId, action.responseId), { idempotencyKey: action.idempotencyKey }); break;
      case "confirm_and_handover": {
        const providerId = getResponseProviderId(store, action.requestId, action.responseId);
        confirmAgreement(store, actor, action.requestId, providerId, { idempotencyKey: `${action.idempotencyKey}:agreement` });
        completeWorkspaceHandover(store, actor, action.requestId, {
          addProvider: action.addProvider || action.addProgramme,
          addProgramme: action.addProgramme,
          idempotencyKey: `${action.idempotencyKey}:handover`,
        });
        break;
      }
      case "not_proceeded": recordAgreementNotProceeded(store, actor, action.requestId, getResponseProviderId(store, action.requestId, action.responseId), { privateNote: action.privateDecisionNote, idempotencyKey: action.idempotencyKey }); break;
      case "handover": {
        const providerId = getResponseProviderId(store, action.requestId, action.responseId);
        if (!store.agreementSnapshots.some((item) => item.requestId === action.requestId && item.providerId === providerId)) {
          throw new LevyTateServiceRequestError("Confirm the agreement before handover.", 409);
        }
        completeWorkspaceHandover(store, actor, action.requestId, {
          addProvider: action.addProvider || action.addProgramme,
          addProgramme: action.addProgramme,
          idempotencyKey: action.idempotencyKey,
        });
        break;
      }
      case "cancel": cancelServiceRequest(store, actor, action.requestId, { reason: action.reason, idempotencyKey: action.idempotencyKey }); break;
      case "close_request": closeServiceRequest(store, actor, action.requestId, { idempotencyKey: action.idempotencyKey }); break;
      case "extend_deadline": extendServiceRequestDeadline(store, actor, action.requestId, action.deadline, { idempotencyKey: action.idempotencyKey }); break;
      default: throw new LevyTateServiceRequestError("Request action is not supported.");
    }
    await persistStore(before, store, { selectionActorEmail: actor.email });
    for (const pendingInvitation of invitationsToDeliver) {
      // Reload after the state transaction so trigger-generated timestamps and
      // any intervening terminal Request change are observed before email.
      const deliveryStore = await loadStoreForOrganisation(context.organisation.id);
      const invitation = deliveryStore.invitations.find((item) => item.id === pendingInvitation.id);
      const request = invitation
        ? deliveryStore.requests.find((item) => item.id === invitation.requestId)
        : undefined;
      if (
        !invitation
        || !request
        || !["open", "responses_received", "decision_in_progress"].includes(request.status)
        || invitation.deadline < new Date().toISOString().slice(0, 10)
        || !["pending_delivery", "delivery_failed"].includes(invitation.status)
      ) continue;
      await deliverInvitation(
        deliveryStore,
        actor,
        invitation,
        `${action.idempotencyKey}:${invitation.id}`,
        context.organisation.name,
      );
    }
  } catch (error) {
    throw normaliseWorkflowError(error);
  }
  return getEmployerRequestsWorkspaceForSession(session);
}

async function providerCatalogueName(providerId: string) {
  const organisationId = await canonicalCatalogueOrganisationId();
  if (!organisationId) return "Provider workspace";
  const rows = await supabaseSelect<JsonRow>(config(), "levytate_providers", new URLSearchParams({
    select: "provider_id,provider_name",
    organisation_id: `eq.${organisationId}`,
    provider_id: `eq.${providerId}`,
    status: "eq.Active",
    order: "updated_at.desc",
    limit: "1",
  }));
  return rows[0] ? text(rows[0], "provider_name") : "Provider workspace";
}

async function providerProgrammeOptions(providerId: string): Promise<RequestProgrammeOption[]> {
  const organisationId = await canonicalCatalogueOrganisationId();
  if (!organisationId) return [];
  const rows = await supabaseSelect<JsonRow>(config(), "levytate_provider_programmes", new URLSearchParams({
    select: "id,provider_id,programme_name,linked_standard_id,level,funding_band",
    organisation_id: `eq.${organisationId}`,
    provider_id: `eq.${providerId}`,
    status: "eq.Active",
    record_status: "eq.Active",
    order: "programme_name.asc",
  }));
  return rows.map((row) => ({
    programmeId: text(row, "id"), providerId: text(row, "provider_id"), programmeName: text(row, "programme_name"),
    apprenticeshipStandardId: optionalText(row, "linked_standard_id"),
    level: typeof row.level === "number" ? row.level : undefined,
    fundingBandMaximumPence: typeof row.funding_band === "number" ? Math.round(row.funding_band * 100) : undefined,
  }));
}

async function canonicalCatalogueOrganisationId() {
  const rows = await supabaseSelect<JsonRow>(config(), "levytate_organisations", new URLSearchParams({
    select: "id",
    slug: "eq.levytate-internal",
    status: "eq.Active",
    limit: "1",
  }));
  return rows[0] ? text(rows[0], "id") : null;
}

async function organisationNames(ids: string[]) {
  if (!ids.length) return new Map<string, string>();
  const rows = await supabaseSelect<JsonRow>(config(), "levytate_organisations", new URLSearchParams({
    select: "id,name",
    id: `in.(${ids.map(encodeURIComponent).join(",")})`,
  }));
  return new Map(rows.map((row) => [text(row, "id"), text(row, "name")]));
}

function opportunityOutcome(store: ServiceRequestStore, invitation: ServiceRequestInvitation): ProviderOpportunityView["outcome"] {
  const decision = store.decisions.find((item) => item.invitationId === invitation.id);
  const request = store.requests.find((item) => item.id === invitation.requestId);
  if (!request || ["closed", "cancelled", "expired"].includes(request.status) || ["cancelled", "deadline_passed"].includes(invitation.status)) return "closed";
  if (decision?.state === "progressed_to_agreement" || decision?.state === "agreement_confirmed") return "progressed_to_agreement";
  if (decision?.state === "shortlisted") return "shortlisted";
  if (decision?.state === "declined" || invitation.status === "declined") return "declined";
  if (store.responses.some((item) => item.invitationId === invitation.id && item.status === "submitted")) return "responded";
  return "open";
}

function providerOpportunityView(
  store: ServiceRequestStore,
  actor: ProviderRequestActor,
  invitation: ServiceRequestInvitation,
  employerNames: Map<string, string>,
  programmeOptions: RequestProgrammeOption[],
): ProviderOpportunityView {
  const opportunity = getProviderOpportunity(store, actor, invitation.id);
  const request = store.requests.find((item) => item.id === invitation.requestId);
  if (!request) throw new LevyTateServiceRequestError("Opportunity was not found.", 404);
  const response = store.responses.find((item) => item.invitationId === invitation.id);
  return {
    invitation: {
      id: opportunity.invitation.id,
      requestVersion: opportunity.invitation.requestVersion,
      status: opportunity.invitation.status,
      deadline: opportunity.invitation.deadline,
      ...(opportunity.invitation.declinedAt ? { declinedAt: opportunity.invitation.declinedAt } : {}),
      ...(opportunity.invitation.declineReasonCategory ? { declineReasonCategory: opportunity.invitation.declineReasonCategory } : {}),
      ...(opportunity.invitation.declineNote ? { declineNote: opportunity.invitation.declineNote } : {}),
      createdAt: opportunity.invitation.createdAt,
      updatedAt: opportunity.invitation.updatedAt,
    },
    employerName: employerNames.get(invitation.organisationId) ?? "Employer organisation",
    requestId: request.id,
    requestTitle: opportunity.version.publishedSnapshot.title,
    requestStatus: request.status,
    requestVersion: {
      version: opportunity.version.version,
      publishedSnapshot: opportunity.version.publishedSnapshot,
      publishedAt: opportunity.version.publishedAt,
      changeSummary: opportunity.version.changeSummary,
    },
    ...(response ? { response: {
      id: response.id,
      invitationId: response.invitationId,
      requestVersion: response.requestVersion,
      status: response.status,
      draftContent: structuredClone(response.draftContent),
      currentVersion: response.currentVersion,
      createdAt: response.createdAt,
      ...(response.submittedAt ? { submittedAt: response.submittedAt } : {}),
      updatedAt: response.updatedAt,
    } } : {}),
    responseVersions: store.responseVersions
      .filter((item) => item.requestId === request.id && item.providerId === actor.providerId)
      .sort((left, right) => right.version - left.version)
      .map((item) => ({ version: item.version, requestVersion: item.requestVersion, submittedContent: structuredClone(item.submittedContent), submittedAt: item.submittedAt })),
    clarifications: listProviderVisibleClarifications(store, actor, request.id).map((item) => ({ ...item, answerRequired: store.clarifications.some((clarification) => clarification.id === item.id && clarification.askedByType === "employer_user" && !clarification.answer) })),
    outcome: opportunityOutcome(store, invitation),
    proposedProgrammeOptions: programmeOptions,
  };
}

async function loadProviderStores(session: LevyTateProviderSession) {
  const invitationRows = await selectRows(tables.invitations, { provider_id: `eq.${session.providerId}` });
  const organisationIds = [...new Set(invitationRows.map((row) => text(row, "organisation_id")).filter(Boolean))];
  const stores = (await Promise.all(organisationIds.map((id) => loadStoreForOrganisation(id))))
    .filter((store) => store.capabilities.some((item) => item.requestsEnabled));
  return stores;
}

export async function getProviderWorkspaceBootstrapForSession(
  session: LevyTateProviderSession,
): Promise<ProviderRequestsWorkspaceBootstrap | null> {
  const stores = await loadProviderStores(session);
  if (!stores.length) return null;
  const actor = providerActor(session);
  const organisationIds = [...new Set(stores.flatMap((store) => store.invitations.filter((item) => item.providerId === actor.providerId).map((item) => item.organisationId)))];
  const [employers, providerName, programmes] = await Promise.all([
    organisationNames(organisationIds), providerCatalogueName(session.providerId), providerProgrammeOptions(session.providerId),
  ]);
  const opportunities = stores.flatMap((store) => listProviderInvitations(store, actor).map((invitation) => providerOpportunityView(store, actor, invitation, employers, programmes)));
  const merged = createEmptyServiceRequestStore(stores.flatMap((store) => store.capabilities));
  merged.invitations = stores.flatMap((store) => store.invitations);
  merged.responses = stores.flatMap((store) => store.responses);
  merged.decisions = stores.flatMap((store) => store.decisions);
  return {
    requestsEnabled: true,
    provider: { id: session.providerId, name: providerName, membershipRole: session.role },
    metrics: providerActivityMetrics(merged, actor),
    opportunities: opportunities.sort((left, right) => right.invitation.createdAt.localeCompare(left.invitation.createdAt)),
  };
}

export async function applyProviderRequestActionForSession(
  session: LevyTateProviderSession,
  value: unknown,
): Promise<ProviderOpportunityView> {
  const action = validateProviderAction(value);
  const stores = await loadProviderStores(session);
  const store = stores.find((item) => item.invitations.some((invitation) => invitation.id === action.invitationId));
  if (!store) throw new LevyTateServiceRequestError("Opportunity was not found.", 404);
  const actor = providerActor(session);
  const before = structuredClone(store);
  const invitationForAction = store.invitations.find((item) => item.id === action.invitationId);
  const priorSubmitEvent = action.action === "submit_response" && invitationForAction
    ? before.events.find((event) =>
        event.organisationId === invitationForAction.organisationId &&
        event.requestId === invitationForAction.requestId &&
        event.invitationId === invitationForAction.id &&
        event.idempotencyKey === `response-submit:${action.idempotencyKey}`)
    : undefined;
  let shouldNotifyEmployer = false;
  try {
    if ("content" in action && action.content.proposedProgramme.kind === "canonical_programme") {
      const programmes = await providerProgrammeOptions(session.providerId);
      const programmeId = action.content.proposedProgramme.programmeId;
      const programme = programmes.find((item) => item.programmeId === programmeId);
      if (!programme) {
        throw new LevyTateServiceRequestError("The selected provider programme is unavailable.");
      }
      action.content = {
        ...action.content,
        proposedProgramme: {
          kind: "canonical_programme",
          programmeId: programme.programmeId,
          programmeTitle: programme.programmeName,
        },
      };
    }
    switch (action.action) {
      case "mark_viewed": markInvitationViewed(store, actor, action.invitationId, { idempotencyKey: action.idempotencyKey }); break;
      case "save_draft": saveProviderResponseDraft(store, actor, action.invitationId, action.content, { idempotencyKey: action.idempotencyKey }); break;
      case "submit_response": {
        if (priorSubmitEvent) {
          const response = store.responses.find((item) => item.invitationId === action.invitationId);
          const submittedVersion = response && store.responseVersions.find((item) =>
            item.responseId === response.id &&
            item.version === Number(priorSubmitEvent.metadata.responseVersion));
          if (!submittedVersion || changed(submittedVersion.submittedContent, action.content)) {
            throw new LevyTateServiceRequestError("This submission key was already used for different response content.", 409);
          }
          // The response write is idempotent, but a prior process may have
          // stopped after commit and before notification acknowledgement.
          // Retry only missing recipients with a stable email idempotency key.
          shouldNotifyEmployer = true;
          break;
        }
        const response = saveProviderResponseDraft(store, actor, action.invitationId, action.content, { idempotencyKey: `${action.idempotencyKey}:draft` });
        submitProviderResponse(store, actor, response.id, { idempotencyKey: action.idempotencyKey });
        shouldNotifyEmployer = true;
        break;
      }
      case "decline": declineInvitation(store, actor, action.invitationId, { reasonCategory: action.reasonCategory, note: action.note, idempotencyKey: action.idempotencyKey }); break;
      case "ask_clarification": askClarification(store, actor, action.invitationId, { question: action.question, idempotencyKey: action.idempotencyKey }); break;
      case "answer_clarification": {
        if (!store.clarifications.some((item) => item.id === action.clarificationId && item.invitationId === action.invitationId)) {
          throw new LevyTateServiceRequestError("Clarification was not found.", 404);
        }
        answerEmployerClarification(store, actor, action.clarificationId, { answer: action.answer, idempotencyKey: action.idempotencyKey });
        break;
      }
      default: throw new LevyTateServiceRequestError("Provider action is not supported.");
    }
    await persistStore(before, store);
    if (shouldNotifyEmployer) {
      // Reload trigger-authored timestamps before persisting notification
      // acknowledgements; the submitted response transaction updates its
      // parent Request and the database owns the resulting updated_at value.
      const notificationStore = await loadStoreForOrganisation(store.requests[0].organisationId);
      const submittedInvitation = notificationStore.invitations.find((item) => item.id === action.invitationId);
      if (submittedInvitation) await notifyEmployerOfResponse(notificationStore, submittedInvitation);
    }
  } catch (error) {
    throw normaliseWorkflowError(error);
  }
  const invitation = store.invitations.find((item) => item.id === action.invitationId);
  if (!invitation) throw new LevyTateServiceRequestError("Opportunity was not found.", 404);
  const [employers, programmes] = await Promise.all([organisationNames([invitation.organisationId]), providerProgrammeOptions(session.providerId)]);
  return providerOpportunityView(store, actor, invitation, employers, programmes);
}

function normaliseWorkflowError(error: unknown) {
  if (error instanceof LevyTateServiceRequestError) return error;
  if (error instanceof LevyTateSupabaseError) {
    const conflict = /40001|23505|changed while|duplicate key/i.test(error.message);
    if (conflict) {
      return new LevyTateServiceRequestError("This Request changed while the action was being saved. Reload and retry.", 409);
    }
  }
  if (error instanceof ServiceRequestWorkflowError) {
    const denied = /denied|permission|inactive|feature_disabled/.test(error.code);
    const missing = /not_found/.test(error.code);
    const conflict = /already|conflict|closed|immutable|required/.test(error.code);
    return new LevyTateServiceRequestError(
      error.message,
      denied ? 403 : missing ? 404 : conflict ? 409 : 400,
    );
  }
  console.error("LevyTate Requests persistence failed", error instanceof Error ? error.name : "unknown");
  return new LevyTateServiceRequestError("Requests are temporarily unavailable.", 503);
}

function validateEmployerAction(value: unknown) {
  try {
    return assertEmployerRequestActionPayload(value);
  } catch (error) {
    if (error instanceof LevyTateRequestPayloadValidationError) {
      throw new LevyTateServiceRequestError(error.message, 400);
    }
    throw error;
  }
}

function validateProviderAction(value: unknown) {
  try {
    return assertProviderRequestActionPayload(value);
  } catch (error) {
    if (error instanceof LevyTateRequestPayloadValidationError) {
      throw new LevyTateServiceRequestError(error.message, 400);
    }
    throw error;
  }
}
