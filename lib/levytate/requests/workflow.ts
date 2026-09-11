import type {
  EmployerRequestActor,
  EmployerRequestMetrics,
  EmployerRequestRole,
  OrganisationRequestCapability,
  ProviderActivityMetrics,
  ProviderMembership,
  ProviderRequestActor,
  ProviderResponseContent,
  ProviderVisibleClarification,
  PublishedServiceRequestSnapshot,
  RequestAgreementSnapshot,
  RequestComparison,
  RequestComparisonColumn,
  RequestWorkspaceHandover,
  ServiceRequest,
  ServiceRequestClarification,
  ServiceRequestEvent,
  ServiceRequestInvitation,
  ServiceRequestPermission,
  ServiceRequestPrivateContext,
  ServiceRequestResponse,
  ServiceRequestResponseVersion,
  ServiceRequestStore,
  ServiceRequestVersion,
  ServiceRequestContent,
} from "@/lib/levytate/requests/domain";

const maximumInvitedProviders = 5;

export class ServiceRequestWorkflowError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "ServiceRequestWorkflowError";
    this.code = code;
  }
}

const fullEmployerRequestPermissions = new Set<ServiceRequestPermission>([
  "serviceRequests:read",
  "serviceRequests:write",
  "serviceRequests:publish",
  "serviceRequests:decide",
]);

const employerPermissionsByRole: Record<EmployerRequestRole, ReadonlySet<ServiceRequestPermission>> = {
  "Employer Admin": fullEmployerRequestPermissions,
  "Apprenticeship Lead": fullEmployerRequestPermissions,
  "Line Manager": new Set(),
  Employee: new Set(),
  "Platform Admin": new Set(),
};

const nowIso = (now?: string) => now ?? new Date().toISOString();
const clean = (value: string) => value.replace(/\s+/g, " ").trim();
const requireText = (value: string, label: string) => {
  const result = clean(value);
  if (!result) throw new ServiceRequestWorkflowError("validation_failed", `${label} is required.`);
  return result;
};
const stableId = (prefix: string, value: string) => {
  const source = `${prefix}:${value}`;
  const seeds = [2166136261, 2246822519, 374761393, 668265263];
  const multipliers = [16777619, 3266489917, 2246822519, 374761393];
  const words = seeds.map((seed, wordIndex) => {
    let hash = seed;
    for (let index = 0; index < source.length; index += 1) {
      hash = Math.imul(hash ^ (source.charCodeAt(index) + wordIndex * 31), multipliers[wordIndex]);
    }
    return (hash >>> 0).toString(16).padStart(8, "0");
  });
  const hex = words.join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
};
const clone = <T>(value: T): T => structuredClone(value);
const deepFreeze = <T>(value: T): T => {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  }
  return value;
};
const sameValue = (left: unknown, right: unknown) => JSON.stringify(left) === JSON.stringify(right);

function parseIsoDate(value: string, label: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new ServiceRequestWorkflowError("validation_failed", `${label} must be an ISO date.`);
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new ServiceRequestWorkflowError("validation_failed", `${label} must be a valid date.`);
  }
  return value;
}

function dateFromTimestamp(value?: string) {
  const timestamp = nowIso(value);
  const parsed = new Date(timestamp);
  if (Number.isNaN(parsed.getTime())) {
    throw new ServiceRequestWorkflowError("validation_failed", "The operation timestamp is invalid.");
  }
  return parsed.toISOString().slice(0, 10);
}

export function createEmptyServiceRequestStore(
  capabilities: OrganisationRequestCapability[] = [],
): ServiceRequestStore {
  return {
    capabilities: clone(capabilities),
    requests: [],
    requestVersions: [],
    providerMemberships: [],
    providerAccessInvites: [],
    invitations: [],
    responses: [],
    responseVersions: [],
    clarifications: [],
    decisions: [],
    agreementSnapshots: [],
    handovers: [],
    organisationProviderSelections: [],
    organisationProgrammeSelections: [],
    events: [],
  };
}

export function isServiceRequestsEnabled(store: ServiceRequestStore, organisationId: string) {
  return store.capabilities.some(
    (capability) => capability.organisationId === organisationId && capability.requestsEnabled,
  );
}

export function hasEmployerRequestPermission(
  role: EmployerRequestRole,
  permission: ServiceRequestPermission,
) {
  return employerPermissionsByRole[role].has(permission);
}

function assertEmployerAccess(
  store: ServiceRequestStore,
  actor: EmployerRequestActor,
  organisationId: string,
  permission: ServiceRequestPermission,
) {
  if (!isServiceRequestsEnabled(store, organisationId)) {
    throw new ServiceRequestWorkflowError("feature_disabled", "Requests is not enabled for this workspace.");
  }
  if (actor.organisationId !== organisationId) {
    throw new ServiceRequestWorkflowError("cross_organisation_denied", "Request is outside this employer workspace.");
  }
  if (!hasEmployerRequestPermission(actor.role, permission)) {
    throw new ServiceRequestWorkflowError("permission_denied", "This role cannot perform that Request action.");
  }
}

function getRequest(store: ServiceRequestStore, requestId: string) {
  const request = store.requests.find((item) => item.id === requestId);
  if (!request) throw new ServiceRequestWorkflowError("request_not_found", "Request was not found.");
  return request;
}

function getInvitation(store: ServiceRequestStore, invitationId: string) {
  const invitation = store.invitations.find((item) => item.id === invitationId);
  if (!invitation) throw new ServiceRequestWorkflowError("invitation_not_found", "Invitation was not found.");
  return invitation;
}

function assertProviderInvitationAccess(
  invitation: ServiceRequestInvitation,
  actor: ProviderRequestActor,
) {
  if (!actor.active) {
    throw new ServiceRequestWorkflowError("inactive_provider_membership", "Provider membership is inactive.");
  }
  if (actor.providerId !== invitation.providerId) {
    throw new ServiceRequestWorkflowError("cross_provider_denied", "Opportunity is outside this provider workspace.");
  }
}

function assertProviderOpportunityNotTerminal(
  store: ServiceRequestStore,
  invitation: ServiceRequestInvitation,
) {
  const request = getRequest(store, invitation.requestId);
  const decision = store.decisions.find(
    (item) => item.requestId === invitation.requestId && item.providerId === invitation.providerId,
  );
  if (decision && ["declined", "agreement_confirmed", "not_proceeded"].includes(decision.state)) {
    throw new ServiceRequestWorkflowError(
      "provider_decision_terminal",
      "The employer decision for this provider is final, so the opportunity is read-only.",
    );
  }
  if (["cancelled", "closed"].includes(request.status)) {
    throw new ServiceRequestWorkflowError("request_closed", "This opportunity is closed.");
  }
  return request;
}

function assertProviderResponseWindow(
  store: ServiceRequestStore,
  invitation: ServiceRequestInvitation,
  now?: string,
) {
  const request = assertProviderOpportunityNotTerminal(store, invitation);
  if (request.status === "expired" || invitation.status === "deadline_passed" || invitation.deadline < dateFromTimestamp(now)) {
    throw new ServiceRequestWorkflowError("response_deadline_passed", "The response deadline has passed.");
  }
  if (!["open", "responses_received", "decision_in_progress"].includes(request.status)) {
    throw new ServiceRequestWorkflowError("request_closed", "This opportunity is not accepting responses.");
  }
  if (!["sent", "viewed", "responded"].includes(invitation.status)) {
    throw new ServiceRequestWorkflowError("invitation_closed", "This opportunity is not accepting responses.");
  }
  return request;
}

function emitEvent(
  store: ServiceRequestStore,
  values: Omit<ServiceRequestEvent, "id">,
) {
  const existing = store.events.find(
    (event) =>
      event.organisationId === values.organisationId &&
      event.requestId === values.requestId &&
      event.idempotencyKey === values.idempotencyKey,
  );
  if (existing) return existing;
  const event = deepFreeze<ServiceRequestEvent>({
    ...clone(values),
    id: stableId("request-event", `${values.organisationId}:${values.requestId}:${values.idempotencyKey}`),
  });
  store.events.push(event);
  return event;
}

export function buildProviderVisibleSnapshot(
  organisationName: string,
  content: ServiceRequestContent,
): PublishedServiceRequestSnapshot {
  const programme = content.programmeId
    ? {
        id: content.programmeId,
        ...(content.programmeTitle ? { title: clean(content.programmeTitle) } : {}),
        ...(content.apprenticeshipStandardId
          ? { apprenticeshipStandardId: content.apprenticeshipStandardId }
          : {}),
      }
    : undefined;
  const optionalInformation = {
    ...(content.departments?.length ? { departments: [...content.departments] } : {}),
    ...(content.targetRoles?.length ? { targetRoles: [...content.targetRoles] } : {}),
    ...(content.workforceMix ? { workforceMix: content.workforceMix } : {}),
    ...(content.businessOutcome ? { businessOutcome: clean(content.businessOutcome) } : {}),
    ...(content.workplaceProjectRequirements
      ? { workplaceProjectRequirements: clean(content.workplaceProjectRequirements) }
      : {}),
    ...(content.accessibilityConsiderations
      ? { accessibilityConsiderations: clean(content.accessibilityConsiderations) }
      : {}),
    ...(content.procurementRequirements
      ? { procurementRequirements: clean(content.procurementRequirements) }
      : {}),
    ...(content.additionalNotes ? { additionalNotes: clean(content.additionalNotes) } : {}),
  };
  const snapshot: PublishedServiceRequestSnapshot = {
    employerOrganisationName: requireText(organisationName, "Employer organisation name"),
    title: requireText(content.title, "Request title"),
    requestMode: content.requestMode,
    requirement: requireText(content.requirement, "Requirement"),
    readiness: content.readiness,
    learnerVolume: clone(content.learnerVolume),
    workplaceLocation: clone(content.workplaceLocation),
    deliveryPreferences: [...content.deliveryPreferences],
    preferredStart: clone(content.preferredStart),
    responseDeadline: content.responseDeadline,
    ...(programme ? { programme } : {}),
    optionalInformation,
    providersShouldAddress: [
      "Suitable pathway",
      "Workplace requirements",
      "Delivery commitment",
      "Start availability",
      "Provider proposed training/assessment price",
    ],
  };
  assertProviderVisibleSnapshotSafe(snapshot);
  return deepFreeze(clone(snapshot));
}

export function assertProviderVisibleSnapshotSafe(snapshot: PublishedServiceRequestSnapshot) {
  const serialised = JSON.stringify(snapshot);
  const prohibitedKeys = [
    "employeeIds",
    "learnerIds",
    "applicationIds",
    "financeReference",
    "intelligenceSignalIds",
    "privateProviderConcern",
    "privateNotes",
    "salary",
    "internalProviderNotes",
    "learnerProgress",
    "reviewContent",
  ];
  if (prohibitedKeys.some((key) => serialised.includes(`\"${key}\"`))) {
    throw new ServiceRequestWorkflowError("private_data_exposure", "Published Request contains private employer data.");
  }
  return true;
}

function validateLearnerVolume(content: ServiceRequestContent) {
  const volume = content.learnerVolume;
  if ((volume.kind === "exact" || volume.kind === "approximate") && volume.count < 1) {
    throw new ServiceRequestWorkflowError("validation_failed", "Learner volume must be positive.");
  }
  if (volume.kind === "range" && (volume.minimum < 1 || volume.maximum < volume.minimum)) {
    throw new ServiceRequestWorkflowError("validation_failed", "Learner volume range is invalid.");
  }
}

function validateRequestContent(content: ServiceRequestContent, now?: string) {
  requireText(content.title, "Request title");
  requireText(content.requirement, "Requirement");
  validateLearnerVolume(content);
  parseIsoDate(content.responseDeadline, "Response deadline");
  if (content.responseDeadline <= dateFromTimestamp(now)) {
    throw new ServiceRequestWorkflowError("response_deadline_not_future", "Response deadline must be in the future.");
  }
  if (content.requestMode === "programme_led" && !content.programmeId) {
    throw new ServiceRequestWorkflowError("validation_failed", "Programme-led Requests require a programme.");
  }
}

export function createServiceRequestDraft(
  store: ServiceRequestStore,
  actor: EmployerRequestActor,
  input: {
    content: ServiceRequestContent;
    privateContext?: ServiceRequestPrivateContext;
    idempotencyKey: string;
    now?: string;
  },
) {
  assertEmployerAccess(store, actor, actor.organisationId, "serviceRequests:write");
  const id = stableId("request", `${actor.organisationId}:${input.idempotencyKey}`);
  const existing = store.requests.find((request) => request.id === id);
  if (existing) {
    if (
      sameValue(existing.content, input.content) &&
      sameValue(existing.privateContext, input.privateContext ?? {})
    ) {
      return existing;
    }
    throw new ServiceRequestWorkflowError(
      "idempotency_conflict",
      "This idempotency key has already been used for a different Request draft.",
    );
  }
  validateRequestContent(input.content, input.now);
  const timestamp = nowIso(input.now);
  const request: ServiceRequest = {
    id,
    organisationId: actor.organisationId,
    content: clone(input.content),
    privateContext: clone(input.privateContext ?? {}),
    status: "draft",
    currentVersion: 0,
    createdBy: actor.userId,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  store.requests.push(request);
  emitEvent(store, {
    organisationId: request.organisationId,
    requestId: request.id,
    eventType: "request_created",
    actorType: "employer_user",
    actorId: actor.userId,
    idempotencyKey: `create:${input.idempotencyKey}`,
    metadata: { requestMode: request.content.requestMode },
    occurredAt: timestamp,
  });
  return request;
}

export function updateServiceRequestDraft(
  store: ServiceRequestStore,
  actor: EmployerRequestActor,
  requestId: string,
  input: {
    content: ServiceRequestContent;
    privateContext?: ServiceRequestPrivateContext;
    idempotencyKey: string;
    now?: string;
  },
) {
  const request = getRequest(store, requestId);
  assertEmployerAccess(store, actor, request.organisationId, "serviceRequests:write");
  if (request.status !== "draft" || request.currentVersion !== 0) {
    throw new ServiceRequestWorkflowError("published_request_immutable", "Published content must be changed through Request versioning.");
  }
  validateRequestContent(input.content, input.now);
  request.content = clone(input.content);
  if (input.privateContext !== undefined) request.privateContext = clone(input.privateContext);
  request.updatedAt = nowIso(input.now);
  return request;
}

export function publishServiceRequest(
  store: ServiceRequestStore,
  actor: EmployerRequestActor,
  requestId: string,
  input: { organisationName: string; changeSummary?: string; idempotencyKey: string; now?: string },
) {
  const request = getRequest(store, requestId);
  assertEmployerAccess(store, actor, request.organisationId, "serviceRequests:publish");
  if (request.status !== "draft") {
    const existing = store.requestVersions.find(
      (version) => version.requestId === requestId && version.version === request.currentVersion,
    );
    if (existing && store.events.some((event) =>
      event.organisationId === request.organisationId &&
      event.requestId === requestId &&
      event.idempotencyKey === `publish:${input.idempotencyKey}`)) {
      return existing;
    }
    throw new ServiceRequestWorkflowError("already_published", "Published Requests must be updated as a new version.");
  }
  validateRequestContent(request.content, input.now);
  const timestamp = nowIso(input.now);
  const version: ServiceRequestVersion = deepFreeze({
    requestId,
    organisationId: request.organisationId,
    version: 1,
    publishedSnapshot: buildProviderVisibleSnapshot(input.organisationName, request.content),
    publishedAt: timestamp,
    publishedBy: actor.userId,
    changeSummary: clean(input.changeSummary ?? "Initial published brief"),
  });
  store.requestVersions.push(version);
  request.currentVersion = 1;
  request.status = "open";
  request.publishedBy = actor.userId;
  request.publishedAt = timestamp;
  request.updatedAt = timestamp;
  emitEvent(store, {
    organisationId: request.organisationId,
    requestId,
    eventType: "request_published",
    actorType: "employer_user",
    actorId: actor.userId,
    idempotencyKey: `publish:${input.idempotencyKey}`,
    metadata: { requestVersion: 1 },
    occurredAt: timestamp,
  });
  return version;
}

export function updatePublishedServiceRequest(
  store: ServiceRequestStore,
  actor: EmployerRequestActor,
  requestId: string,
  input: {
    content: ServiceRequestContent;
    changeSummary: string;
    idempotencyKey: string;
    now?: string;
    reopenExpired?: boolean;
  },
) {
  const request = getRequest(store, requestId);
  assertEmployerAccess(store, actor, request.organisationId, "serviceRequests:publish");
  if (request.currentVersion < 1 || request.status === "draft") {
    throw new ServiceRequestWorkflowError("not_published", "Publish Version 1 before creating an update.");
  }
  if (
    ["cancelled", "closed", "progressed_to_agreement"].includes(request.status)
    || (request.status === "expired" && !input.reopenExpired)
  ) {
    throw new ServiceRequestWorkflowError("request_closed", "Closed Requests cannot be updated.");
  }
  validateRequestContent(input.content, input.now);
  const previous = store.requestVersions.find(
    (version) => version.requestId === requestId && version.version === request.currentVersion,
  );
  if (!previous) throw new ServiceRequestWorkflowError("version_not_found", "Current Request version was not found.");
  const existingEvent = store.events.find((event) =>
    event.organisationId === request.organisationId &&
    event.requestId === requestId &&
    event.idempotencyKey === `update:${input.idempotencyKey}`);
  if (existingEvent) {
    return store.requestVersions.find(
      (version) => version.requestId === requestId && version.version === Number(existingEvent.metadata.requestVersion),
    )!;
  }
  const snapshot = buildProviderVisibleSnapshot(previous.publishedSnapshot.employerOrganisationName, input.content);
  if (sameValue(snapshot, previous.publishedSnapshot)) return previous;
  const timestamp = nowIso(input.now);
  const nextVersion = request.currentVersion + 1;
  const version: ServiceRequestVersion = deepFreeze({
    requestId,
    organisationId: request.organisationId,
    version: nextVersion,
    publishedSnapshot: snapshot,
    publishedAt: timestamp,
    publishedBy: actor.userId,
    changeSummary: requireText(input.changeSummary, "Change summary"),
  });
  store.requestVersions.push(version);
  request.content = clone(input.content);
  request.currentVersion = nextVersion;
  request.updatedAt = timestamp;
  for (const invitation of store.invitations.filter(
    (item) => item.requestId === requestId && !["cancelled", "declined"].includes(item.status),
  )) {
    invitation.requestVersion = nextVersion;
    invitation.deadline = input.content.responseDeadline;
    invitation.updatedAt = timestamp;
  }
  emitEvent(store, {
    organisationId: request.organisationId,
    requestId,
    eventType: "request_updated",
    actorType: "employer_user",
    actorId: actor.userId,
    idempotencyKey: `update:${input.idempotencyKey}`,
    metadata: { requestVersion: nextVersion, changeSummary: version.changeSummary },
    occurredAt: timestamp,
  });
  return version;
}

export function inviteProviders(
  store: ServiceRequestStore,
  actor: EmployerRequestActor,
  requestId: string,
  providerIds: string[],
  input: { idempotencyKey: string; now?: string },
) {
  const request = getRequest(store, requestId);
  assertEmployerAccess(store, actor, request.organisationId, "serviceRequests:publish");
  if (!["open", "responses_received", "decision_in_progress"].includes(request.status)) {
    throw new ServiceRequestWorkflowError("request_not_open", "Providers can only be invited to an open Request.");
  }
  if (request.content.responseDeadline < dateFromTimestamp(input.now)) {
    throw new ServiceRequestWorkflowError("response_deadline_passed", "Providers cannot be invited after the response deadline.");
  }
  const distinctProviderIds = [...new Set(providerIds.map(clean).filter(Boolean))];
  if (!distinctProviderIds.length) {
    throw new ServiceRequestWorkflowError("validation_failed", "Choose at least one provider.");
  }
  const existingProviderIds = new Set(
    store.invitations.filter((item) => item.requestId === requestId).map((item) => item.providerId),
  );
  if (new Set([...existingProviderIds, ...distinctProviderIds]).size > maximumInvitedProviders) {
    throw new ServiceRequestWorkflowError(
      "provider_limit_exceeded",
      `A Request may invite no more than ${maximumInvitedProviders} providers.`,
    );
  }
  const timestamp = nowIso(input.now);
  const invitations: ServiceRequestInvitation[] = [];
  let invitationAdded = false;
  for (const providerId of distinctProviderIds) {
    const duplicate = store.invitations.find(
      (item) => item.requestId === requestId && item.providerId === providerId,
    );
    if (duplicate) {
      invitations.push(duplicate);
      continue;
    }
    const invitation: ServiceRequestInvitation = {
      id: stableId("invitation", `${request.organisationId}:${requestId}:${providerId}`),
      requestId,
      organisationId: request.organisationId,
      providerId,
      requestVersion: request.currentVersion,
      status: "pending_delivery",
      notificationStatus: "pending",
      notificationAttemptCount: 0,
      deadline: request.content.responseDeadline,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    store.invitations.push(invitation);
    invitationAdded = true;
    invitations.push(invitation);
  }
  // A published-version update rewrites the whole invitation set. Bump the
  // parent row whenever that set grows so concurrent revisions cannot commit
  // against a stale child collection.
  if (invitationAdded) request.updatedAt = timestamp;
  return invitations;
}

export function recordInvitationDelivery(
  store: ServiceRequestStore,
  actor: EmployerRequestActor,
  invitationId: string,
  input:
    | { accepted: true; providerMessageId?: string; idempotencyKey: string; now?: string }
    | { accepted: false; failureCode: string; idempotencyKey: string; now?: string },
) {
  const invitation = getInvitation(store, invitationId);
  assertEmployerAccess(store, actor, invitation.organisationId, "serviceRequests:publish");
  const existingEvent = store.events.find(
    (event) =>
      event.organisationId === invitation.organisationId &&
      event.requestId === invitation.requestId &&
      event.invitationId === invitationId &&
      event.idempotencyKey === `delivery:${input.idempotencyKey}`,
  );
  if (existingEvent) return invitation;
  const timestamp = nowIso(input.now);
  invitation.notificationAttemptCount += 1;
  invitation.updatedAt = timestamp;
  if (input.accepted) {
    invitation.notificationStatus = "accepted";
    invitation.status = "sent";
    invitation.notificationFailureCode = undefined;
    invitation.notificationProviderId = input.providerMessageId
      ? requireText(input.providerMessageId, "Provider message ID").slice(0, 255)
      : undefined;
    invitation.sentAt = timestamp;
  } else {
    invitation.notificationStatus = "failed";
    invitation.status = "delivery_failed";
    invitation.notificationFailureCode = requireText(input.failureCode, "Failure code").slice(0, 80);
    invitation.notificationProviderId = undefined;
  }
  emitEvent(store, {
    organisationId: invitation.organisationId,
    requestId: invitation.requestId,
    invitationId,
    providerId: invitation.providerId,
    eventType: input.accepted ? "invitation_sent" : "invitation_delivery_failed",
    actorType: "employer_user",
    actorId: actor.userId,
    idempotencyKey: `delivery:${input.idempotencyKey}`,
    metadata: input.accepted ? { notificationAccepted: true } : { notificationAccepted: false },
    occurredAt: timestamp,
  });
  return invitation;
}

export function recordEmployerResponseNotificationSent(
  store: ServiceRequestStore,
  invitationId: string,
  responseId: string,
  responseVersion: number,
  recipientKey: string,
  now?: string,
) {
  const invitation = getInvitation(store, invitationId);
  const response = store.responses.find(
    (item) => item.id === responseId && item.invitationId === invitation.id,
  );
  if (!response || response.currentVersion !== responseVersion) {
    throw new ServiceRequestWorkflowError("response_not_found", "Submitted response was not found.");
  }
  return emitEvent(store, {
    organisationId: invitation.organisationId,
    requestId: invitation.requestId,
    invitationId: invitation.id,
    responseId: response.id,
    providerId: invitation.providerId,
    eventType: "employer_response_notification_sent",
    actorType: "system",
    idempotencyKey: `response-notification:${response.id}:${responseVersion}:${recipientKey}`,
    metadata: { responseVersion, notificationAccepted: true },
    occurredAt: nowIso(now),
  });
}

export function resolveProviderMembership(
  store: ServiceRequestStore,
  identity: { authSubject: string; email: string },
): ProviderRequestActor {
  const normalisedEmail = identity.email.trim().toLowerCase();
  const membership = store.providerMemberships.find(
    (item) => item.authSubject === identity.authSubject && item.email === normalisedEmail,
  );
  if (!membership || !membership.active || membership.authBindingStatus !== "bound") {
    throw new ServiceRequestWorkflowError("provider_membership_denied", "Active provider membership was not found.");
  }
  return {
    membershipId: membership.id,
    email: membership.email,
    providerId: membership.providerId,
    role: membership.role,
    active: membership.active,
  };
}

export function listProviderInvitations(store: ServiceRequestStore, actor: ProviderRequestActor) {
  if (!actor.active) return [];
  return store.invitations.filter(
    (invitation) =>
      invitation.providerId === actor.providerId &&
      (invitation.notificationStatus === "accepted" || Boolean(invitation.sentAt)),
  );
}

export function getProviderOpportunity(
  store: ServiceRequestStore,
  actor: ProviderRequestActor,
  invitationId: string,
) {
  const invitation = getInvitation(store, invitationId);
  assertProviderInvitationAccess(invitation, actor);
  if (!isServiceRequestsEnabled(store, invitation.organisationId)) {
    throw new ServiceRequestWorkflowError("feature_disabled", "Requests is not enabled for this opportunity.");
  }
  const version = store.requestVersions.find(
    (item) => item.requestId === invitation.requestId && item.version === invitation.requestVersion,
  );
  if (!version) throw new ServiceRequestWorkflowError("version_not_found", "Published Request brief was not found.");
  return { invitation, version };
}

export function markInvitationViewed(
  store: ServiceRequestStore,
  actor: ProviderRequestActor,
  invitationId: string,
  input: { idempotencyKey: string; now?: string },
) {
  const invitation = getInvitation(store, invitationId);
  assertProviderInvitationAccess(invitation, actor);
  if (!["sent", "viewed", "responded"].includes(invitation.status)) {
    throw new ServiceRequestWorkflowError("invitation_unavailable", "Invitation is not available to view.");
  }
  if (invitation.viewedAt) return invitation;
  const timestamp = nowIso(input.now);
  invitation.viewedAt = timestamp;
  if (invitation.status !== "responded") invitation.status = "viewed";
  invitation.updatedAt = timestamp;
  emitEvent(store, {
    organisationId: invitation.organisationId,
    requestId: invitation.requestId,
    invitationId,
    providerId: invitation.providerId,
    eventType: "invitation_viewed",
    actorType: "provider_member",
    actorId: actor.membershipId,
    idempotencyKey: `view:${input.idempotencyKey}`,
    metadata: { requestVersion: invitation.requestVersion },
    occurredAt: timestamp,
  });
  return invitation;
}

function validateProviderResponseContent(content: ProviderResponseContent) {
  requireText(content.whyThisFits, "Why this fits");
  requireText(content.earliestAvailableStart, "Earliest available start");
  if (!content.deliveryApproach.models.length) {
    throw new ServiceRequestWorkflowError("validation_failed", "Delivery approach is required.");
  }
  requireText(content.workplaceRequirements, "Workplace requirements");
  requireText(content.employerReportingSupport, "Employer reporting and support");
  if (
    content.proposedTrainingAssessmentPricePence !== undefined &&
    (!Number.isInteger(content.proposedTrainingAssessmentPricePence) ||
      content.proposedTrainingAssessmentPricePence < 0)
  ) {
    throw new ServiceRequestWorkflowError("validation_failed", "Proposed price is invalid.");
  }
  if (
    content.proposedProgramme.kind === "alternative_to_discuss" &&
    !clean(content.proposedProgramme.description)
  ) {
    throw new ServiceRequestWorkflowError("validation_failed", "Describe the alternative pathway.");
  }
}

export function saveProviderResponseDraft(
  store: ServiceRequestStore,
  actor: ProviderRequestActor,
  invitationId: string,
  content: ProviderResponseContent,
  input: { idempotencyKey: string; allowRevision?: boolean; now?: string },
) {
  const invitation = getInvitation(store, invitationId);
  assertProviderInvitationAccess(invitation, actor);
  if (invitation.status === "declined") return invitation;
  assertProviderResponseWindow(store, invitation, input.now);
  const timestamp = nowIso(input.now);
  let response = store.responses.find((item) => item.invitationId === invitationId);
  if (response?.status === "submitted") {
    const requestUpdated = invitation.requestVersion > response.requestVersion;
    if (!requestUpdated) {
      throw new ServiceRequestWorkflowError("response_already_submitted", "Submitted response is read-only.");
    }
    response.status = "draft";
    response.requestVersion = invitation.requestVersion;
  }
  if (!response) {
    response = {
      id: stableId("response", `${invitation.organisationId}:${invitationId}`),
      requestId: invitation.requestId,
      invitationId,
      organisationId: invitation.organisationId,
      providerId: invitation.providerId,
      providerMembershipId: actor.membershipId,
      requestVersion: invitation.requestVersion,
      status: "draft",
      draftContent: clone(content),
      currentVersion: 0,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    store.responses.push(response);
    emitEvent(store, {
      organisationId: response.organisationId,
      requestId: response.requestId,
      invitationId,
      responseId: response.id,
      providerId: response.providerId,
      eventType: "provider_response_started",
      actorType: "provider_member",
      actorId: actor.membershipId,
      idempotencyKey: `response-start:${input.idempotencyKey}`,
      metadata: { requestVersion: response.requestVersion },
      occurredAt: timestamp,
    });
  } else {
    response.draftContent = clone(content);
    response.providerMembershipId = actor.membershipId;
    response.requestVersion = invitation.requestVersion;
    response.updatedAt = timestamp;
  }
  return response;
}

export function submitProviderResponse(
  store: ServiceRequestStore,
  actor: ProviderRequestActor,
  responseId: string,
  input: { idempotencyKey: string; now?: string },
) {
  const response = store.responses.find((item) => item.id === responseId);
  if (!response) throw new ServiceRequestWorkflowError("response_not_found", "Response was not found.");
  const invitation = getInvitation(store, response.invitationId);
  assertProviderInvitationAccess(invitation, actor);
  if (response.providerId !== actor.providerId) {
    throw new ServiceRequestWorkflowError("cross_provider_denied", "Response is outside this provider workspace.");
  }
  const existingEvent = store.events.find(
    (event) =>
      event.organisationId === response.organisationId &&
      event.requestId === response.requestId &&
      event.invitationId === response.invitationId &&
      event.idempotencyKey === `response-submit:${input.idempotencyKey}`,
  );
  if (existingEvent) {
    return store.responseVersions.find(
      (version) =>
        version.responseId === responseId && version.version === Number(existingEvent.metadata.responseVersion),
    )!;
  }
  assertProviderResponseWindow(store, invitation, input.now);
  if (response.status !== "draft") {
    throw new ServiceRequestWorkflowError("response_already_submitted", "Response has already been submitted.");
  }
  if (response.requestVersion !== invitation.requestVersion) {
    throw new ServiceRequestWorkflowError(
      "request_updated",
      "Review the current Request version before submitting this response.",
    );
  }
  validateProviderResponseContent(response.draftContent);
  const timestamp = nowIso(input.now);
  const versionNumber = response.currentVersion + 1;
  const version: ServiceRequestResponseVersion = deepFreeze({
    responseId: response.id,
    requestId: response.requestId,
    organisationId: response.organisationId,
    providerId: response.providerId,
    requestVersion: response.requestVersion,
    version: versionNumber,
    submittedContent: deepFreeze(clone(response.draftContent)),
    submittedByProviderMembershipId: actor.membershipId,
    submittedAt: timestamp,
  });
  store.responseVersions.push(version);
  response.status = "submitted";
  response.currentVersion = versionNumber;
  response.submittedAt = timestamp;
  response.updatedAt = timestamp;
  invitation.status = "responded";
  invitation.updatedAt = timestamp;
  const request = getRequest(store, response.requestId);
  if (request.status === "open") request.status = "responses_received";
  request.updatedAt = timestamp;
  emitEvent(store, {
    organisationId: response.organisationId,
    requestId: response.requestId,
    invitationId: response.invitationId,
    responseId,
    providerId: response.providerId,
    eventType: versionNumber === 1 ? "provider_response_submitted" : "provider_response_revised",
    actorType: "provider_member",
    actorId: actor.membershipId,
    idempotencyKey: `response-submit:${input.idempotencyKey}`,
    metadata: { requestVersion: response.requestVersion, responseVersion: versionNumber },
    occurredAt: timestamp,
  });
  return version;
}

export function declineInvitation(
  store: ServiceRequestStore,
  actor: ProviderRequestActor,
  invitationId: string,
  input: {
    reasonCategory: ServiceRequestInvitation["declineReasonCategory"];
    note?: string;
    idempotencyKey: string;
    now?: string;
  },
) {
  const invitation = getInvitation(store, invitationId);
  assertProviderInvitationAccess(invitation, actor);
  if (!input.reasonCategory) {
    throw new ServiceRequestWorkflowError("validation_failed", "Decline reason is required.");
  }
  const declineNote = input.note ? clean(input.note) || undefined : undefined;
  const existingEvent = store.events.find(
    (event) =>
      event.organisationId === invitation.organisationId &&
      event.requestId === invitation.requestId &&
      event.invitationId === invitationId &&
      event.idempotencyKey === `provider-decline:${input.idempotencyKey}`,
  );
  if (existingEvent) {
    if (
      invitation.status === "declined" &&
      invitation.declineReasonCategory === input.reasonCategory &&
      invitation.declineNote === declineNote
    ) {
      return invitation;
    }
    throw new ServiceRequestWorkflowError(
      "idempotency_conflict",
      "This idempotency key has already been used for a different invitation decline.",
    );
  }
  assertProviderResponseWindow(store, invitation, input.now);
  if (invitation.status === "responded") {
    throw new ServiceRequestWorkflowError("response_exists", "A submitted response cannot be replaced by a decline.");
  }
  const timestamp = nowIso(input.now);
  invitation.status = "declined";
  invitation.declinedAt = timestamp;
  invitation.declineReasonCategory = input.reasonCategory;
  invitation.declineNote = declineNote;
  invitation.updatedAt = timestamp;
  emitEvent(store, {
    organisationId: invitation.organisationId,
    requestId: invitation.requestId,
    invitationId,
    providerId: invitation.providerId,
    eventType: "provider_declined",
    actorType: "provider_member",
    actorId: actor.membershipId,
    idempotencyKey: `provider-decline:${input.idempotencyKey}`,
    metadata: { reasonCategory: input.reasonCategory },
    occurredAt: timestamp,
  });
  return invitation;
}

export function askClarification(
  store: ServiceRequestStore,
  actor: ProviderRequestActor,
  invitationId: string,
  input: { question: string; idempotencyKey: string; now?: string },
) {
  const invitation = getInvitation(store, invitationId);
  assertProviderInvitationAccess(invitation, actor);
  assertProviderResponseWindow(store, invitation, input.now);
  const id = stableId("clarification", `${invitationId}:${input.idempotencyKey}`);
  const existing = store.clarifications.find((item) => item.id === id);
  if (existing) return existing;
  const timestamp = nowIso(input.now);
  const clarification: ServiceRequestClarification = {
    id,
    requestId: invitation.requestId,
    invitationId,
    organisationId: invitation.organisationId,
    providerId: invitation.providerId,
    requestVersion: invitation.requestVersion,
    askedByType: "provider_member",
    askedByProviderMembershipId: actor.membershipId,
    question: requireText(input.question, "Question"),
    visibility: "provider_specific",
    askedAt: timestamp,
  };
  store.clarifications.push(clarification);
  emitEvent(store, {
    organisationId: clarification.organisationId,
    requestId: clarification.requestId,
    invitationId,
    providerId: clarification.providerId,
    eventType: "clarification_asked",
    actorType: "provider_member",
    actorId: actor.membershipId,
    idempotencyKey: `clarification-ask:${input.idempotencyKey}`,
    metadata: { requestVersion: clarification.requestVersion },
    occurredAt: timestamp,
  });
  return clarification;
}

export function askProviderClarification(
  store: ServiceRequestStore,
  actor: EmployerRequestActor,
  invitationId: string,
  input: { question: string; idempotencyKey: string; now?: string },
) {
  const invitation = getInvitation(store, invitationId);
  const requestId = invitation.requestId;
  const request = getRequest(store, requestId);
  assertEmployerAccess(store, actor, request.organisationId, "serviceRequests:write");
  assertProviderOpportunityNotTerminal(store, invitation);
  const response = store.responses.find(
    (item) => item.invitationId === invitationId && item.status === "submitted",
  );
  if (!response) {
    throw new ServiceRequestWorkflowError("response_not_submitted", "A submitted response is required.");
  }
  const id = stableId("clarification", `${response.id}:${input.idempotencyKey}`);
  const existing = store.clarifications.find((item) => item.id === id);
  if (existing) return existing;
  const timestamp = nowIso(input.now);
  const clarification: ServiceRequestClarification = {
    id,
    requestId,
    invitationId: invitation.id,
    organisationId: request.organisationId,
    providerId: response.providerId,
    requestVersion: response.requestVersion,
    askedByType: "employer_user",
    askedByEmployerUserId: actor.userId,
    question: requireText(input.question, "Question"),
    visibility: "provider_specific",
    askedAt: timestamp,
  };
  store.clarifications.push(clarification);
  emitEvent(store, {
    organisationId: request.organisationId,
    requestId,
    invitationId: invitation.id,
    responseId: response.id,
    providerId: response.providerId,
    eventType: "clarification_asked",
    actorType: "employer_user",
    actorId: actor.userId,
    idempotencyKey: `employer-clarification-ask:${input.idempotencyKey}`,
    metadata: { requestVersion: response.requestVersion },
    occurredAt: timestamp,
  });
  return clarification;
}

export function answerClarification(
  store: ServiceRequestStore,
  actor: EmployerRequestActor,
  clarificationId: string,
  input: {
    answer: string;
    shareWithAllInvitees?: boolean;
    shareWithAll?: boolean;
    idempotencyKey: string;
    now?: string;
  },
) {
  const clarification = store.clarifications.find((item) => item.id === clarificationId);
  if (!clarification) throw new ServiceRequestWorkflowError("clarification_not_found", "Clarification was not found.");
  assertEmployerAccess(store, actor, clarification.organisationId, "serviceRequests:write");
  if (clarification.askedByType !== "provider_member") {
    throw new ServiceRequestWorkflowError("wrong_answering_party", "This question requires a provider response.");
  }
  const answer = requireText(input.answer, "Answer");
  const shouldShareWithAllInvitees = input.shareWithAllInvitees ?? input.shareWithAll ?? false;
  const existingEvent = store.events.find(
    (event) =>
      event.organisationId === clarification.organisationId &&
      event.requestId === clarification.requestId &&
      event.invitationId === clarification.invitationId &&
      event.idempotencyKey === `clarification-answer:${input.idempotencyKey}`,
  );
  if (existingEvent) {
    if (
      clarification.answer === answer &&
      clarification.answeredByType === "employer_user" &&
      existingEvent.metadata.sharedWithAllInvitees === shouldShareWithAllInvitees
    ) {
      return clarification;
    }
    throw new ServiceRequestWorkflowError(
      "idempotency_conflict",
      "This idempotency key has already been used for a different clarification answer.",
    );
  }
  if (clarification.answeredAt || clarification.answer !== undefined) {
    throw new ServiceRequestWorkflowError(
      "clarification_already_answered",
      "This clarification has already been answered and is read-only.",
    );
  }
  const timestamp = nowIso(input.now);
  clarification.answer = answer;
  clarification.answeredByType = "employer_user";
  clarification.answeredByEmployerUserId = actor.userId;
  clarification.answeredAt = timestamp;
  if (shouldShareWithAllInvitees) {
    clarification.visibility = "shared_with_invited_providers";
    clarification.sharedByEmployerUserId = actor.userId;
    clarification.sharedAt = timestamp;
  }
  emitEvent(store, {
    organisationId: clarification.organisationId,
    requestId: clarification.requestId,
    invitationId: clarification.invitationId,
    providerId: clarification.providerId,
    eventType: "clarification_answered",
    actorType: "employer_user",
    actorId: actor.userId,
    idempotencyKey: `clarification-answer:${input.idempotencyKey}`,
    metadata: { sharedWithAllInvitees: shouldShareWithAllInvitees },
    occurredAt: timestamp,
  });
  if (shouldShareWithAllInvitees) {
    emitEvent(store, {
      organisationId: clarification.organisationId,
      requestId: clarification.requestId,
      invitationId: clarification.invitationId,
      eventType: "clarification_shared",
      actorType: "employer_user",
      actorId: actor.userId,
      idempotencyKey: `clarification-share:${input.idempotencyKey}`,
      metadata: { requestVersion: clarification.requestVersion },
      occurredAt: timestamp,
    });
  }
  return clarification;
}

export function answerEmployerClarification(
  store: ServiceRequestStore,
  actor: ProviderRequestActor,
  clarificationId: string,
  input: { answer: string; idempotencyKey: string; now?: string },
) {
  const clarification = store.clarifications.find((item) => item.id === clarificationId);
  if (!clarification) throw new ServiceRequestWorkflowError("clarification_not_found", "Clarification was not found.");
  const invitation = getInvitation(store, clarification.invitationId);
  assertProviderInvitationAccess(invitation, actor);
  if (clarification.askedByType !== "employer_user") {
    throw new ServiceRequestWorkflowError("wrong_answering_party", "This question requires an employer response.");
  }
  const answer = requireText(input.answer, "Answer");
  const existingEvent = store.events.find(
    (event) =>
      event.organisationId === clarification.organisationId &&
      event.requestId === clarification.requestId &&
      event.invitationId === clarification.invitationId &&
      event.idempotencyKey === `provider-clarification-answer:${input.idempotencyKey}`,
  );
  if (existingEvent) {
    if (clarification.answer === answer && clarification.answeredByType === "provider_member") {
      return clarification;
    }
    throw new ServiceRequestWorkflowError(
      "idempotency_conflict",
      "This idempotency key has already been used for a different clarification answer.",
    );
  }
  if (clarification.answeredAt || clarification.answer !== undefined) {
    throw new ServiceRequestWorkflowError(
      "clarification_already_answered",
      "This clarification has already been answered and is read-only.",
    );
  }
  assertProviderOpportunityNotTerminal(store, invitation);
  const timestamp = nowIso(input.now);
  clarification.answer = answer;
  clarification.answeredByType = "provider_member";
  clarification.answeredByProviderMembershipId = actor.membershipId;
  clarification.answeredAt = timestamp;
  emitEvent(store, {
    organisationId: clarification.organisationId,
    requestId: clarification.requestId,
    invitationId: clarification.invitationId,
    providerId: clarification.providerId,
    eventType: "clarification_answered",
    actorType: "provider_member",
    actorId: actor.membershipId,
    idempotencyKey: `provider-clarification-answer:${input.idempotencyKey}`,
    metadata: { requestVersion: clarification.requestVersion },
    occurredAt: timestamp,
  });
  return clarification;
}

export function listProviderVisibleClarifications(
  store: ServiceRequestStore,
  actor: ProviderRequestActor,
  requestId: string,
): ProviderVisibleClarification[] {
  const invitation = store.invitations.find(
    (item) => item.requestId === requestId && item.providerId === actor.providerId,
  );
  if (!invitation) throw new ServiceRequestWorkflowError("invitation_not_found", "Provider is not invited.");
  assertProviderInvitationAccess(invitation, actor);
  return store.clarifications
    .filter(
      (item) =>
        item.requestId === requestId &&
        (item.providerId === actor.providerId || item.visibility === "shared_with_invited_providers"),
    )
    .map((item) => ({
      id: item.id,
      requestId: item.requestId,
      requestVersion: item.requestVersion,
      label:
        item.askedByType === "employer_user"
          ? "Employer clarification"
          : item.providerId === actor.providerId
            ? "Your question"
            : "Employer clarification",
      askedBy: item.askedByType === "employer_user" ? "employer" : "provider",
      visibility: item.visibility,
      question: item.question,
      ...(item.answer ? { answer: item.answer } : {}),
      askedAt: item.askedAt,
      ...(item.answeredAt ? { answeredAt: item.answeredAt } : {}),
    }));
}

function latestSubmittedVersions(store: ServiceRequestStore, requestId: string) {
  const submitted = store.responses.filter((response) => response.requestId === requestId && response.currentVersion > 0);
  return submitted.map((response) => {
    const version = store.responseVersions.find(
      (item) => item.responseId === response.id && item.version === response.currentVersion,
    );
    if (!version) throw new ServiceRequestWorkflowError("response_version_not_found", "Response version was not found.");
    return { response, version };
  });
}

function capacityLabel(content: ProviderResponseContent) {
  const { cohortCapacity } = content;
  if (cohortCapacity.kind === "can_accommodate") return "Can accommodate requested cohort";
  if (cohortCapacity.kind === "minimum_required") return `Minimum cohort ${cohortCapacity.value ?? "not stated"}`;
  if (cohortCapacity.kind === "maximum_places") return `Maximum ${cohortCapacity.value ?? "not stated"} places`;
  return "Requires discussion";
}

function priceLabel(content: ProviderResponseContent) {
  if (content.proposedTrainingAssessmentPricePence === undefined) return "Not stated";
  return `£${(content.proposedTrainingAssessmentPricePence / 100).toLocaleString("en-GB", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} provider proposed training/assessment price`;
}

function comparisonColumn(
  response: ServiceRequestResponse,
  version: ServiceRequestResponseVersion,
): RequestComparisonColumn {
  const content = version.submittedContent;
  return {
    providerId: response.providerId,
    responseId: response.id,
    programme:
      content.proposedProgramme.kind === "canonical_programme"
        ? content.proposedProgramme.programmeTitle ?? content.proposedProgramme.programmeId
        : `Alternative / pathway to discuss: ${content.proposedProgramme.description}`,
    startAvailability: content.earliestAvailableStart,
    delivery: [...content.deliveryApproach.models, content.deliveryApproach.notes].filter(Boolean).join(" — "),
    cohortCapacity: capacityLabel(content),
    workplaceRequirements: content.workplaceRequirements,
    learningCommitment: content.learningCommitment ?? "Not stated",
    supportAndReporting: content.employerReportingSupport,
    proposedPrice: priceLabel(content),
    evidence: content.relevantEvidence ?? "Not stated",
    exceptions: content.exceptionsOrClarifications ?? "None stated",
  };
}

export function compareSubmittedResponses(
  store: ServiceRequestStore,
  actor: EmployerRequestActor,
  requestId: string,
): RequestComparison {
  const request = getRequest(store, requestId);
  assertEmployerAccess(store, actor, request.organisationId, "serviceRequests:read");
  const columns = latestSubmittedVersions(store, requestId).map(({ response, version }) =>
    comparisonColumn(response, version),
  );
  const pointsToResolve: string[] = [];
  const starts = new Set(columns.map((column) => column.startAvailability));
  if (starts.size > 1) pointsToResolve.push("Providers have stated different start availability.");
  const delivery = new Set(columns.map((column) => column.delivery));
  if (delivery.size > 1) pointsToResolve.push("Delivery approaches differ and should be reviewed against the requirement.");
  const capacityExceptions = columns.filter((column) => /Minimum cohort|Requires discussion/.test(column.cohortCapacity));
  if (capacityExceptions.length) {
    pointsToResolve.push(`${capacityExceptions.length} response${capacityExceptions.length === 1 ? "" : "s"} includes a cohort condition to resolve.`);
  }
  const statedPrices = new Set(columns.map((column) => column.proposedPrice).filter((value) => value !== "Not stated"));
  if (statedPrices.size > 1) pointsToResolve.push("Provider proposed prices and assumptions differ; no employer cost is inferred.");
  return { requestId, requestVersion: request.currentVersion, columns, pointsToResolve };
}

function responseForDecision(store: ServiceRequestStore, requestId: string, responseId: string) {
  const request = getRequest(store, requestId);
  const response = store.responses.find(
    (item) => item.id === responseId && item.requestId === requestId && item.status === "submitted",
  );
  if (!response) throw new ServiceRequestWorkflowError("response_not_submitted", "A submitted response is required.");
  if (response.requestVersion !== request.currentVersion) {
    throw new ServiceRequestWorkflowError(
      "response_version_stale",
      "The provider must submit a response to the current Request version before a decision is recorded.",
    );
  }
  return response;
}

function assertEmployerDecisionAvailable(
  request: ServiceRequest,
  options: { allowProgressed?: boolean } = {},
) {
  if (["cancelled", "closed"].includes(request.status)) {
    throw new ServiceRequestWorkflowError("request_closed", "This Request can no longer accept decisions.");
  }
  if (request.status === "progressed_to_agreement" && !options.allowProgressed) {
    throw new ServiceRequestWorkflowError(
      "decision_conflict",
      "A provider is already progressing to agreement.",
    );
  }
}

function getOrCreateDecision(
  store: ServiceRequestStore,
  response: ServiceRequestResponse,
  now: string,
) {
  let decision = store.decisions.find(
    (item) => item.requestId === response.requestId && item.providerId === response.providerId,
  );
  if (!decision) {
    decision = {
      id: stableId("decision", `${response.organisationId}:${response.requestId}:${response.providerId}`),
      requestId: response.requestId,
      invitationId: response.invitationId,
      responseId: response.id,
      organisationId: response.organisationId,
      providerId: response.providerId,
      state: "pending",
      updatedAt: now,
    };
    store.decisions.push(decision);
  }
  return decision;
}

export function shortlistProvider(
  store: ServiceRequestStore,
  actor: EmployerRequestActor,
  requestId: string,
  responseId: string,
  input: { privateNote?: string; idempotencyKey: string; now?: string },
) {
  const request = getRequest(store, requestId);
  assertEmployerAccess(store, actor, request.organisationId, "serviceRequests:decide");
  assertEmployerDecisionAvailable(request);
  const response = responseForDecision(store, requestId, responseId);
  const timestamp = nowIso(input.now);
  const decision = getOrCreateDecision(store, response, timestamp);
  if (decision.state === "shortlisted") return decision;
  if (["declined", "progressed_to_agreement", "agreement_confirmed"].includes(decision.state)) {
    throw new ServiceRequestWorkflowError("decision_conflict", "This provider decision cannot be shortlisted.");
  }
  decision.state = "shortlisted";
  decision.privateDecisionNote = input.privateNote ? clean(input.privateNote) : undefined;
  decision.shortlistedAt = timestamp;
  decision.shortlistedBy = actor.userId;
  decision.updatedAt = timestamp;
  request.status = "decision_in_progress";
  request.updatedAt = timestamp;
  emitEvent(store, {
    organisationId: request.organisationId,
    requestId,
    invitationId: response.invitationId,
    responseId,
    providerId: response.providerId,
    eventType: "provider_shortlisted",
    actorType: "employer_user",
    actorId: actor.userId,
    idempotencyKey: `shortlist:${input.idempotencyKey}`,
    metadata: {},
    occurredAt: timestamp,
  });
  return decision;
}

export function declineProviderByEmployer(
  store: ServiceRequestStore,
  actor: EmployerRequestActor,
  requestId: string,
  responseId: string,
  input: { privateNote?: string; idempotencyKey: string; now?: string },
) {
  const request = getRequest(store, requestId);
  assertEmployerAccess(store, actor, request.organisationId, "serviceRequests:decide");
  assertEmployerDecisionAvailable(request);
  const response = responseForDecision(store, requestId, responseId);
  const timestamp = nowIso(input.now);
  const decision = getOrCreateDecision(store, response, timestamp);
  if (decision.state === "declined") return decision;
  if (["progressed_to_agreement", "agreement_confirmed"].includes(decision.state)) {
    throw new ServiceRequestWorkflowError("decision_conflict", "A progressed provider cannot be declined here.");
  }
  decision.state = "declined";
  decision.privateDecisionNote = input.privateNote ? clean(input.privateNote) : undefined;
  decision.declinedAt = timestamp;
  decision.declinedBy = actor.userId;
  decision.updatedAt = timestamp;
  request.status = "decision_in_progress";
  request.updatedAt = timestamp;
  emitEvent(store, {
    organisationId: request.organisationId,
    requestId,
    invitationId: response.invitationId,
    responseId,
    providerId: response.providerId,
    eventType: "provider_declined_by_employer",
    actorType: "employer_user",
    actorId: actor.userId,
    idempotencyKey: `employer-decline:${input.idempotencyKey}`,
    metadata: {},
    occurredAt: timestamp,
  });
  return decision;
}

export function progressProviderToAgreement(
  store: ServiceRequestStore,
  actor: EmployerRequestActor,
  requestId: string,
  responseId: string,
  input: { privateNote?: string; idempotencyKey: string; now?: string },
) {
  const request = getRequest(store, requestId);
  assertEmployerAccess(store, actor, request.organisationId, "serviceRequests:decide");
  assertEmployerDecisionAvailable(request, { allowProgressed: true });
  const response = responseForDecision(store, requestId, responseId);
  const conflicting = store.decisions.find(
    (item) =>
      item.requestId === requestId &&
      item.providerId !== response.providerId &&
      ["progressed_to_agreement", "agreement_confirmed"].includes(item.state),
  );
  if (conflicting) {
    throw new ServiceRequestWorkflowError("agreement_already_progressed", "Another provider is already progressing to agreement.");
  }
  const timestamp = nowIso(input.now);
  const decision = getOrCreateDecision(store, response, timestamp);
  if (decision.state === "progressed_to_agreement" || decision.state === "agreement_confirmed") return decision;
  if (decision.state === "declined") {
    throw new ServiceRequestWorkflowError("decision_conflict", "A declined provider cannot be progressed.");
  }
  decision.state = "progressed_to_agreement";
  decision.privateDecisionNote = input.privateNote ? clean(input.privateNote) : decision.privateDecisionNote;
  decision.progressedAt = timestamp;
  decision.progressedBy = actor.userId;
  decision.updatedAt = timestamp;
  request.status = "progressed_to_agreement";
  request.updatedAt = timestamp;
  emitEvent(store, {
    organisationId: request.organisationId,
    requestId,
    invitationId: response.invitationId,
    responseId,
    providerId: response.providerId,
    eventType: "provider_progressed_to_agreement",
    actorType: "employer_user",
    actorId: actor.userId,
    idempotencyKey: `progress:${input.idempotencyKey}`,
    metadata: { createsContract: false, approvesFunding: false, enrolsLearners: false },
    occurredAt: timestamp,
  });
  return decision;
}

function agreementSnapshotFromResponse(
  response: ServiceRequestResponse,
  version: ServiceRequestResponseVersion,
  actor: EmployerRequestActor,
  timestamp: string,
): RequestAgreementSnapshot {
  const content = version.submittedContent;
  return deepFreeze({
    id: stableId("agreement", `${response.organisationId}:${response.requestId}:${response.providerId}`),
    requestId: response.requestId,
    organisationId: response.organisationId,
    providerId: response.providerId,
    invitationId: response.invitationId,
    responseId: response.id,
    responseVersion: version.version,
    ...(content.proposedProgramme.kind === "canonical_programme"
      ? { proposedProgrammeId: content.proposedProgramme.programmeId }
      : {}),
    proposedStart: content.earliestAvailableStart,
    deliveryApproach: clone(content.deliveryApproach),
    workplaceRequirements: content.workplaceRequirements,
    ...(content.learningCommitment ? { learningCommitment: content.learningCommitment } : {}),
    employerReportingSupport: content.employerReportingSupport,
    ...(content.proposedTrainingAssessmentPricePence !== undefined
      ? { proposedTrainingAssessmentPricePence: content.proposedTrainingAssessmentPricePence }
      : {}),
    ...(content.priceBasisAndAssumptions
      ? { priceBasisAndAssumptions: content.priceBasisAndAssumptions }
      : {}),
    ...(content.additionalCommercialCosts
      ? { additionalCommercialCosts: content.additionalCommercialCosts }
      : {}),
    ...(content.exceptionsOrClarifications
      ? { exceptionsOrClarifications: content.exceptionsOrClarifications }
      : {}),
    label: "Request agreement snapshot",
    confirmedAt: timestamp,
    confirmedBy: actor.userId,
  });
}

export function confirmAgreement(
  store: ServiceRequestStore,
  actor: EmployerRequestActor,
  requestId: string,
  providerId: string,
  input: { idempotencyKey: string; now?: string },
) {
  const request = getRequest(store, requestId);
  assertEmployerAccess(store, actor, request.organisationId, "serviceRequests:decide");
  const existing = store.agreementSnapshots.find(
    (snapshot) => snapshot.requestId === requestId && snapshot.providerId === providerId,
  );
  if (existing) return existing;
  if (request.status !== "progressed_to_agreement") {
    throw new ServiceRequestWorkflowError("request_not_progressed", "This Request is not progressing to agreement.");
  }
  const decision = store.decisions.find(
    (item) => item.requestId === requestId && item.providerId === providerId,
  );
  if (!decision || decision.state !== "progressed_to_agreement") {
    throw new ServiceRequestWorkflowError("provider_not_progressed", "Progress the provider before confirming agreement.");
  }
  const response = responseForDecision(store, requestId, decision.responseId);
  const version = store.responseVersions.find(
    (item) => item.responseId === response.id && item.version === response.currentVersion,
  );
  if (!version) throw new ServiceRequestWorkflowError("response_version_not_found", "Response version was not found.");
  const timestamp = nowIso(input.now);
  const snapshot = agreementSnapshotFromResponse(response, version, actor, timestamp);
  store.agreementSnapshots.push(snapshot);
  decision.state = "agreement_confirmed";
  decision.agreementConfirmedAt = timestamp;
  decision.agreementConfirmedBy = actor.userId;
  decision.updatedAt = timestamp;
  request.status = "closed";
  request.closedAt = timestamp;
  request.updatedAt = timestamp;
  emitEvent(store, {
    organisationId: request.organisationId,
    requestId,
    invitationId: response.invitationId,
    responseId: response.id,
    providerId,
    eventType: "agreement_confirmed",
    actorType: "employer_user",
    actorId: actor.userId,
    idempotencyKey: `agreement:${input.idempotencyKey}`,
    metadata: { responseVersion: version.version, legallyBindingContract: false },
    occurredAt: timestamp,
  });
  return snapshot;
}

export function recordAgreementNotProceeded(
  store: ServiceRequestStore,
  actor: EmployerRequestActor,
  requestId: string,
  providerId: string,
  input: { privateNote?: string; idempotencyKey: string; now?: string },
) {
  const request = getRequest(store, requestId);
  assertEmployerAccess(store, actor, request.organisationId, "serviceRequests:decide");
  if (request.status !== "progressed_to_agreement") {
    const existing = store.decisions.find(
      (item) => item.requestId === requestId && item.providerId === providerId && item.state === "not_proceeded",
    );
    if (existing) return existing;
    throw new ServiceRequestWorkflowError("request_not_progressed", "This Request is not progressing to agreement.");
  }
  const decision = store.decisions.find(
    (item) => item.requestId === requestId && item.providerId === providerId,
  );
  if (!decision || decision.state !== "progressed_to_agreement") {
    throw new ServiceRequestWorkflowError("provider_not_progressed", "Provider is not progressing to agreement.");
  }
  const timestamp = nowIso(input.now);
  decision.state = "not_proceeded";
  decision.privateDecisionNote = input.privateNote ? clean(input.privateNote) : decision.privateDecisionNote;
  decision.notProceededAt = timestamp;
  decision.notProceededBy = actor.userId;
  decision.updatedAt = timestamp;
  request.status = "closed";
  request.closedAt = timestamp;
  request.updatedAt = timestamp;
  emitEvent(store, {
    organisationId: request.organisationId,
    requestId,
    providerId,
    eventType: "agreement_not_proceeded",
    actorType: "employer_user",
    actorId: actor.userId,
    idempotencyKey: `not-proceeded:${input.idempotencyKey}`,
    metadata: {},
    occurredAt: timestamp,
  });
  return decision;
}

export function completeWorkspaceHandover(
  store: ServiceRequestStore,
  actor: EmployerRequestActor,
  requestId: string,
  input: { addProvider: boolean; addProgramme: boolean; idempotencyKey: string; now?: string },
) {
  const request = getRequest(store, requestId);
  assertEmployerAccess(store, actor, request.organisationId, "serviceRequests:decide");
  const agreement = store.agreementSnapshots.find((snapshot) => snapshot.requestId === requestId);
  if (!agreement) {
    throw new ServiceRequestWorkflowError("agreement_not_confirmed", "Confirm an agreement before workspace handover.");
  }
  const existing = store.handovers.find(
    (handover) =>
      handover.organisationId === request.organisationId && handover.requestId === requestId,
  );
  if (existing) {
    if (existing.addProvider === input.addProvider && existing.addProgramme === input.addProgramme) {
      return existing;
    }
    throw new ServiceRequestWorkflowError(
      "handover_already_completed",
      "Workspace handover has already been completed with different selections.",
    );
  }
  if (input.addProgramme && !agreement.proposedProgrammeId) {
    throw new ServiceRequestWorkflowError("canonical_programme_required", "A canonical programme is required for My Programmes.");
  }
  const providerExists = store.organisationProviderSelections.some(
    (item) => item.organisationId === request.organisationId && item.providerId === agreement.providerId,
  );
  const programmeExists = agreement.proposedProgrammeId
    ? store.organisationProgrammeSelections.some(
        (item) =>
          item.organisationId === request.organisationId && item.programmeId === agreement.proposedProgrammeId,
      )
    : false;
  if (input.addProvider && !providerExists) {
    store.organisationProviderSelections.push({
      organisationId: request.organisationId,
      providerId: agreement.providerId,
    });
  }
  if (input.addProgramme && agreement.proposedProgrammeId && !programmeExists) {
    store.organisationProgrammeSelections.push({
      organisationId: request.organisationId,
      programmeId: agreement.proposedProgrammeId,
      providerId: agreement.providerId,
    });
  }
  const timestamp = nowIso(input.now);
  const handover: RequestWorkspaceHandover = {
    id: stableId("handover", `${request.organisationId}:${requestId}:${input.idempotencyKey}`),
    requestId,
    organisationId: request.organisationId,
    agreementSnapshotId: agreement.id,
    providerId: agreement.providerId,
    ...(agreement.proposedProgrammeId ? { programmeId: agreement.proposedProgrammeId } : {}),
    addProvider: input.addProvider,
    addProgramme: input.addProgramme,
    providerAdded: input.addProvider && !providerExists,
    programmeAdded: input.addProgramme && !programmeExists,
    completedBy: actor.userId,
    completedAt: timestamp,
    idempotencyKey: input.idempotencyKey,
  };
  store.handovers.push(handover);
  emitEvent(store, {
    organisationId: request.organisationId,
    requestId,
    providerId: agreement.providerId,
    eventType: "workspace_handover_completed",
    actorType: "employer_user",
    actorId: actor.userId,
    idempotencyKey: `handover:${input.idempotencyKey}`,
    metadata: {
      providerSelected: input.addProvider,
      programmeSelected: input.addProgramme,
      learnerCreated: false,
      applicationCreated: false,
    },
    occurredAt: timestamp,
  });
  return handover;
}

export function cancelServiceRequest(
  store: ServiceRequestStore,
  actor: EmployerRequestActor,
  requestId: string,
  input: { reason: string; idempotencyKey: string; now?: string },
) {
  const request = getRequest(store, requestId);
  assertEmployerAccess(store, actor, request.organisationId, "serviceRequests:write");
  if (request.status === "cancelled") return request;
  if (request.status === "progressed_to_agreement") {
    throw new ServiceRequestWorkflowError(
      "decision_conflict",
      "Record that the progressed provider did not proceed instead of cancelling this Request.",
    );
  }
  if (["closed", "expired"].includes(request.status)) {
    throw new ServiceRequestWorkflowError("request_closed", "Closed or expired Requests cannot be cancelled.");
  }
  const timestamp = nowIso(input.now);
  request.status = "cancelled";
  request.cancellationReason = requireText(input.reason, "Cancellation reason");
  request.closedAt = timestamp;
  request.updatedAt = timestamp;
  for (const invitation of store.invitations.filter(
    (item) => item.requestId === requestId && !["declined", "responded"].includes(item.status),
  )) {
    invitation.status = "cancelled";
    invitation.updatedAt = timestamp;
  }
  emitEvent(store, {
    organisationId: request.organisationId,
    requestId,
    eventType: "request_cancelled",
    actorType: "employer_user",
    actorId: actor.userId,
    idempotencyKey: `cancel:${input.idempotencyKey}`,
    metadata: { reasonRecorded: true },
    occurredAt: timestamp,
  });
  return request;
}

export function extendServiceRequestDeadline(
  store: ServiceRequestStore,
  actor: EmployerRequestActor,
  requestId: string,
  deadlineOrInput: string | { deadline: string; idempotencyKey: string; now?: string },
  options?: { idempotencyKey: string; now?: string },
) {
  const request = getRequest(store, requestId);
  const input =
    typeof deadlineOrInput === "string"
      ? { deadline: deadlineOrInput, idempotencyKey: options?.idempotencyKey ?? "", now: options?.now }
      : deadlineOrInput;
  requireText(input.idempotencyKey, "Idempotency key");
  assertEmployerAccess(store, actor, request.organisationId, "serviceRequests:publish");
  const existingEvent = store.events.find(
    (event) =>
      event.organisationId === request.organisationId &&
      event.requestId === requestId &&
      event.idempotencyKey === `deadline:${input.idempotencyKey}`,
  );
  if (existingEvent) {
    if (existingEvent.metadata.deadline !== input.deadline) {
      throw new ServiceRequestWorkflowError(
        "idempotency_conflict",
        "This idempotency key has already been used for a different response deadline.",
      );
    }
    const existingVersion = store.requestVersions.find(
      (version) =>
        version.requestId === requestId &&
        version.version === Number(existingEvent.metadata.requestVersion),
    );
    if (!existingVersion) {
      throw new ServiceRequestWorkflowError("version_not_found", "Extended Request version was not found.");
    }
    return existingVersion;
  }
  if (input.deadline <= request.content.responseDeadline) {
    throw new ServiceRequestWorkflowError("invalid_deadline", "Extended deadline must be later than the current deadline.");
  }
  const previousStatus = request.status;
  const version = updatePublishedServiceRequest(store, actor, requestId, {
    content: { ...clone(request.content), responseDeadline: input.deadline },
    changeSummary: `Response deadline extended to ${input.deadline}`,
    idempotencyKey: `deadline-version:${input.idempotencyKey}`,
    now: input.now,
    reopenExpired: true,
  });
  const timestamp = nowIso(input.now);
  for (const invitation of store.invitations.filter((item) => item.requestId === requestId)) {
    invitation.deadline = input.deadline;
    if (invitation.status === "deadline_passed") {
      invitation.status = invitation.viewedAt
        ? "viewed"
        : invitation.notificationStatus === "accepted"
          ? "sent"
          : invitation.notificationStatus === "failed"
            ? "delivery_failed"
            : "pending_delivery";
    }
    invitation.updatedAt = timestamp;
  }
  if (previousStatus === "expired") {
    const hasDecision = store.decisions.some(
      (decision) => decision.requestId === requestId && ["shortlisted", "declined"].includes(decision.state),
    );
    const hasResponse = store.responses.some(
      (response) => response.requestId === requestId && response.currentVersion > 0,
    );
    request.status = hasDecision ? "decision_in_progress" : hasResponse ? "responses_received" : "open";
    request.closedAt = undefined;
    request.updatedAt = timestamp;
  }
  emitEvent(store, {
    organisationId: request.organisationId,
    requestId,
    eventType: "request_deadline_extended",
    actorType: "employer_user",
    actorId: actor.userId,
    idempotencyKey: `deadline:${input.idempotencyKey}`,
    metadata: { requestVersion: version.version, deadline: input.deadline },
    occurredAt: timestamp,
  });
  return version;
}

export function markPastDeadlineInvitations(store: ServiceRequestStore, date: string) {
  parseIsoDate(date, "Deadline check date");
  const changed: ServiceRequestInvitation[] = [];
  for (const invitation of store.invitations) {
    if (
      invitation.deadline < date &&
      ["sent", "viewed", "pending_delivery", "delivery_failed"].includes(invitation.status)
    ) {
      invitation.status = "deadline_passed";
      invitation.updatedAt = `${date}T00:00:00.000Z`;
      changed.push(invitation);
    }
  }
  const timestamp = `${date}T00:00:00.000Z`;
  for (const request of store.requests) {
    if (
      request.content.responseDeadline >= date ||
      !["open", "responses_received", "decision_in_progress"].includes(request.status)
    ) {
      continue;
    }
    const invitations = store.invitations.filter((invitation) => invitation.requestId === request.id);
    if (!invitations.length) continue;
    const hasSubmittedResponse = store.responses.some(
      (response) => response.requestId === request.id && response.status === "submitted",
    );
    // The response deadline closes provider submissions, not the employer's
    // comparison and decision window.
    if (hasSubmittedResponse) continue;
    const hasStillOpenInvitation = invitations.some((invitation) =>
      ["pending_delivery", "sent", "viewed", "delivery_failed"].includes(invitation.status),
    );
    if (hasStillOpenInvitation) continue;
    request.status = "expired";
    request.closedAt = timestamp;
    request.updatedAt = timestamp;
    emitEvent(store, {
      organisationId: request.organisationId,
      requestId: request.id,
      eventType: "request_expired",
      actorType: "system",
      idempotencyKey: `expire:${request.content.responseDeadline}`,
      metadata: { responseDeadline: request.content.responseDeadline },
      occurredAt: timestamp,
    });
  }
  return changed;
}

export function listEmployerRequests(store: ServiceRequestStore, actor: EmployerRequestActor) {
  if (!isServiceRequestsEnabled(store, actor.organisationId)) return [];
  if (!hasEmployerRequestPermission(actor.role, "serviceRequests:read")) return [];
  return store.requests.filter((request) => request.organisationId === actor.organisationId);
}

export function getEmployerRequest(
  store: ServiceRequestStore,
  actor: EmployerRequestActor,
  requestId: string,
) {
  const request = getRequest(store, requestId);
  assertEmployerAccess(store, actor, request.organisationId, "serviceRequests:read");
  return request;
}

export function getProviderResponse(
  store: ServiceRequestStore,
  actor: ProviderRequestActor,
  responseId: string,
) {
  const response = store.responses.find((item) => item.id === responseId);
  if (!response) throw new ServiceRequestWorkflowError("response_not_found", "Response was not found.");
  if (!actor.active || response.providerId !== actor.providerId) {
    throw new ServiceRequestWorkflowError("cross_provider_denied", "Response is outside this provider workspace.");
  }
  return response;
}

export function getProviderDecisionOutcome(
  store: ServiceRequestStore,
  actor: ProviderRequestActor,
  requestId: string,
) {
  const invitation = store.invitations.find(
    (item) => item.requestId === requestId && item.providerId === actor.providerId,
  );
  if (!invitation) throw new ServiceRequestWorkflowError("invitation_not_found", "Provider is not invited.");
  assertProviderInvitationAccess(invitation, actor);
  const decision = store.decisions.find(
    (item) => item.requestId === requestId && item.providerId === actor.providerId,
  );
  return {
    requestId,
    providerId: actor.providerId,
    state: decision?.state ?? "pending",
  };
}

export function providerActivityMetrics(
  store: ServiceRequestStore,
  actor: ProviderRequestActor,
): ProviderActivityMetrics {
  if (!actor.active) {
    return { opportunitiesReceived: 0, responsesSubmitted: 0, shortlisted: 0, progressedToAgreement: 0, declined: 0 };
  }
  const invitations = store.invitations.filter((item) => item.providerId === actor.providerId);
  const invitationIds = new Set(invitations.map((item) => item.id));
  return {
    opportunitiesReceived: invitations.length,
    responsesSubmitted: store.responses.filter(
      (item) => item.providerId === actor.providerId && item.currentVersion > 0,
    ).length,
    shortlisted: store.decisions.filter(
      (item) => item.providerId === actor.providerId && item.shortlistedAt,
    ).length,
    progressedToAgreement: store.decisions.filter(
      (item) => item.providerId === actor.providerId && item.progressedAt,
    ).length,
    declined: invitations.filter((item) => item.status === "declined" && invitationIds.has(item.id)).length,
  };
}

export function employerRequestMetrics(
  store: ServiceRequestStore,
  actor: EmployerRequestActor,
): EmployerRequestMetrics {
  const requests = listEmployerRequests(store, actor);
  const requestIds = new Set(requests.map((request) => request.id));
  return {
    openRequests: requests.filter((request) => ["open", "responses_received"].includes(request.status)).length,
    responsesReceived: store.responses.filter(
      (response) => requestIds.has(response.requestId) && response.currentVersion > 0,
    ).length,
    requestsInDecision: requests.filter((request) => request.status === "decision_in_progress").length,
    progressedToAgreement: requests.filter((request) => request.status === "progressed_to_agreement").length,
  };
}

export function addProviderMembershipForTest(
  store: ServiceRequestStore,
  membership: ProviderMembership,
) {
  if (
    store.providerMemberships.some(
      (item) => item.email === membership.email || item.authSubject === membership.authSubject,
    )
  ) {
    throw new ServiceRequestWorkflowError("duplicate_provider_membership", "Provider identity already has a membership.");
  }
  store.providerMemberships.push(clone(membership));
  return membership;
}

export const REQUESTS_NO_AUTOMATIC_RECORD_TYPES = [
  "employee",
  "learner",
  "application",
  "enrolment",
] as const;

export function closeServiceRequest(
  store: ServiceRequestStore,
  actor: EmployerRequestActor,
  requestId: string,
  input: { idempotencyKey: string; now?: string },
) {
  const request = getRequest(store, requestId);
  assertEmployerAccess(store, actor, request.organisationId, "serviceRequests:write");
  if (request.status === "closed") return request;
  if (!["open", "responses_received", "decision_in_progress", "expired"].includes(request.status)) {
    throw new ServiceRequestWorkflowError(
      request.status === "progressed_to_agreement" ? "decision_conflict" : "request_closed",
      request.status === "progressed_to_agreement"
        ? "Record Agreement confirmed or Did not proceed before closing this Request."
        : "Draft or cancelled Requests cannot be closed as a decision.",
    );
  }
  const timestamp = nowIso(input.now);
  if (request.content.responseDeadline >= dateFromTimestamp(timestamp)) {
    throw new ServiceRequestWorkflowError(
      "response_deadline_not_passed",
      "A Request decision may be closed only after its response deadline has passed.",
    );
  }
  request.status = "closed";
  request.closedAt = timestamp;
  request.updatedAt = timestamp;
  emitEvent(store, {
    organisationId: request.organisationId,
    requestId,
    eventType: "request_closed",
    actorType: "employer_user",
    actorId: actor.userId,
    idempotencyKey: `close:${input.idempotencyKey}`,
    metadata: {},
    occurredAt: timestamp,
  });
  return request;
}
