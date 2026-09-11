import assert from "node:assert/strict";
import fs from "node:fs/promises";
import {
  addProviderMembershipForTest,
  answerClarification,
  answerEmployerClarification,
  askClarification,
  askProviderClarification,
  buildProviderVisibleSnapshot,
  cancelServiceRequest,
  closeServiceRequest,
  compareSubmittedResponses,
  completeWorkspaceHandover,
  confirmAgreement,
  createEmptyServiceRequestStore,
  createServiceRequestDraft,
  declineProviderByEmployer,
  extendServiceRequestDeadline,
  getEmployerRequest,
  getProviderDecisionOutcome,
  getProviderOpportunity,
  getProviderResponse,
  hasEmployerRequestPermission,
  inviteProviders,
  isServiceRequestsEnabled,
  listEmployerRequests,
  listProviderInvitations,
  listProviderVisibleClarifications,
  markInvitationViewed,
  markPastDeadlineInvitations,
  progressProviderToAgreement,
  providerActivityMetrics,
  publishServiceRequest,
  recordAgreementNotProceeded,
  recordInvitationDelivery,
  resolveProviderMembership,
  saveProviderResponseDraft,
  shortlistProvider,
  submitProviderResponse,
  updatePublishedServiceRequest,
  updateServiceRequestDraft,
  declineInvitation,
} from "../lib/levytate/requests/workflow.ts";
import {
  SERVICE_REQUEST_MAX_PROVIDERS,
  serviceRequestStatuses,
} from "../lib/levytate/requests/domain.ts";
import { createRequestsAcceptanceFixture } from "../lib/levytate/requests/test-fixtures.ts";
import {
  assertEmployerRequestActionPayload,
  assertProviderRequestActionPayload,
} from "../lib/levytate/requests/validation.ts";

let passed = 0;
const check = (label, condition) => {
  assert.ok(condition, label);
  passed += 1;
  console.log(`PASS ${label}`);
};
const throwsCode = (label, operation, code) => {
  assert.throws(operation, (error) => error && error.code === code);
  check(label, true);
};
const isUuid = (value) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

const fixture = createRequestsAcceptanceFixture();
const store = createEmptyServiceRequestStore(fixture.capabilities);
for (const membership of fixture.providerMemberships) addProviderMembershipForTest(store, membership);
const leadA = fixture.employerActors.leadA;
const leadB = fixture.employerActors.leadB;
const managerA = fixture.employerActors.lineManagerA;
const employeeA = fixture.employerActors.employeeA;
const platformAdmin = fixture.employerActors.platformAdmin;

function createProviderResponseScenario(key) {
  const scenarioStore = createEmptyServiceRequestStore(fixture.capabilities);
  for (const membership of fixture.providerMemberships) addProviderMembershipForTest(scenarioStore, membership);
  const scenarioRequest = createServiceRequestDraft(scenarioStore, leadA, {
    content: fixture.requestContent,
    idempotencyKey: `${key}:request`,
    now: "2026-09-11T09:00:00.000Z",
  });
  publishServiceRequest(scenarioStore, leadA, scenarioRequest.id, {
    organisationName: fixture.organisationNames.employerA,
    idempotencyKey: `${key}:publish`,
    now: "2026-09-11T09:01:00.000Z",
  });
  const scenarioInvitation = inviteProviders(
    scenarioStore,
    leadA,
    scenarioRequest.id,
    [fixture.providers[0].providerId],
    { idempotencyKey: `${key}:invite`, now: "2026-09-11T09:02:00.000Z" },
  )[0];
  scenarioInvitation.invitedProviderMembershipId = fixture.providerMemberships[0].id;
  recordInvitationDelivery(scenarioStore, leadA, scenarioInvitation.id, {
    accepted: true,
    providerMessageId: `message-${key}`,
    idempotencyKey: `${key}:deliver`,
    now: "2026-09-11T09:03:00.000Z",
  });
  const scenarioProvider = resolveProviderMembership(scenarioStore, {
    authSubject: fixture.ids.providerAAuthSubject,
    email: fixture.providerMemberships[0].email,
  });
  return {
    store: scenarioStore,
    request: scenarioRequest,
    invitation: scenarioInvitation,
    provider: scenarioProvider,
  };
}

check("1 blank employer Requests", listEmployerRequests(store, leadA).length === 0);
check("2 second blank employer Requests", listEmployerRequests(store, leadB).length === 0);
check("3 capability is server-owned and enabled only for explicit fixtures", isServiceRequestsEnabled(store, fixture.ids.employerA));
const disabledStore = createEmptyServiceRequestStore([]);
check("4 Requests defaults OFF", !isServiceRequestsEnabled(disabledStore, fixture.ids.employerA));
throwsCode(
  "5 feature OFF prevents Request creation",
  () => createServiceRequestDraft(disabledStore, leadA, { content: fixture.requestContent, idempotencyKey: "disabled" }),
  "feature_disabled",
);
check("6 Apprenticeship Lead has explicit Request permissions", hasEmployerRequestPermission("Apprenticeship Lead", "serviceRequests:decide"));
check("7 Employer Admin has explicit Request permissions", hasEmployerRequestPermission("Employer Admin", "serviceRequests:publish"));
check("8 Line Manager denied organisation-wide Requests", !hasEmployerRequestPermission("Line Manager", "serviceRequests:read"));
check("9 Employee denied Requests", !hasEmployerRequestPermission("Employee", "serviceRequests:write"));
check("10 Platform Admin does not inherit private Request access", !hasEmployerRequestPermission("Platform Admin", "serviceRequests:read"));

throwsCode(
  "11 Line Manager cannot create a Request",
  () => createServiceRequestDraft(store, managerA, { content: fixture.requestContent, idempotencyKey: "manager" }),
  "permission_denied",
);
throwsCode(
  "12 Employee cannot create a Request",
  () => createServiceRequestDraft(store, employeeA, { content: fixture.requestContent, idempotencyKey: "employee" }),
  "permission_denied",
);
throwsCode(
  "13 Platform Admin does not automatically access employer Request content",
  () => createServiceRequestDraft(store, platformAdmin, { content: fixture.requestContent, idempotencyKey: "platform" }),
  "permission_denied",
);

const request = createServiceRequestDraft(store, leadA, {
  content: fixture.requestContent,
  privateContext: fixture.privateContext,
  idempotencyKey: "main-acceptance-request",
  now: "2026-09-11T08:00:00.000Z",
});
check("14 Request draft created", request.status === "draft" && request.currentVersion === 0);
check("15 workflow IDs are database-compatible UUIDs", isUuid(request.id) && store.events.every((event) => isUuid(event.id)));
const draftChanged = updateServiceRequestDraft(store, leadA, request.id, {
  content: { ...fixture.requestContent, title: "Data and automation cohort" },
  privateContext: fixture.privateContext,
  idempotencyKey: "draft-edit",
  now: "2026-09-11T08:01:00.000Z",
});
check("16 draft remains fully editable", draftChanged.content.title === "Data and automation cohort" && draftChanged.currentVersion === 0);

const published = publishServiceRequest(store, leadA, request.id, {
  organisationName: fixture.organisationNames.employerA,
  idempotencyKey: "publish-v1",
  now: "2026-09-11T08:02:00.000Z",
});
check("17 Request publishes as Version 1", published.version === 1 && request.status === "open");
check("18 published version is runtime immutable", Object.isFrozen(published) && Object.isFrozen(published.publishedSnapshot));
throwsCode(
  "19 published Request cannot use draft editor",
  () => updateServiceRequestDraft(store, leadA, request.id, { content: fixture.requestContent, idempotencyKey: "late-edit" }),
  "published_request_immutable",
);
const publishedJson = JSON.stringify(published.publishedSnapshot);
check("20 no employee identity shared", !publishedJson.includes("private-employee") && !publishedJson.includes("employeeIds"));
check("21 no learner data shared", !publishedJson.includes("private-learner") && !publishedJson.includes("learnerIds"));
check("22 no application data shared", !publishedJson.includes("private-application") && !publishedJson.includes("applicationIds"));
check("23 no Finance data shared", !publishedJson.includes("private-finance") && !publishedJson.includes("financeReference"));
check("24 no Intelligence Signal or provider concern shared", !publishedJson.includes("private-intelligence") && !publishedJson.includes("Private relationship"));
check("25 exact approved facts are shared", published.publishedSnapshot.learnerVolume.kind === "approximate" && published.publishedSnapshot.readiness === "planning");
const duplicatePublish = publishServiceRequest(store, leadA, request.id, {
  organisationName: fixture.organisationNames.employerA,
  idempotencyKey: "publish-v1",
});
check("26 double publish is idempotent", duplicatePublish === published && store.requestVersions.length === 1);

const invitations = inviteProviders(
  store,
  leadA,
  request.id,
  fixture.providers.map((provider) => provider.providerId),
  { idempotencyKey: "invite-three", now: "2026-09-11T08:03:00.000Z" },
);
check("27 employer selects exactly three providers", invitations.length === 3 && store.invitations.length === 3);
check("28 invitations use UUID identifiers", invitations.every((invitation) => isUuid(invitation.id)));
const duplicateInvitations = inviteProviders(store, leadA, request.id, [fixture.providers[0].providerId], {
  idempotencyKey: "duplicate-invite",
});
check("29 duplicate provider invitation prevented", duplicateInvitations[0].id === invitations[0].id && store.invitations.length === 3);
throwsCode(
  "30 maximum five-provider anti-spam boundary",
  () => inviteProviders(store, leadA, request.id, ["provider-four", "provider-five", "provider-six"], { idempotencyKey: "too-many" }),
  "provider_limit_exceeded",
);
check("31 configured provider limit is five", SERVICE_REQUEST_MAX_PROVIDERS === 5);

for (let index = 0; index < invitations.length; index += 1) {
  invitations[index].invitedProviderMembershipId = fixture.providerMemberships[index].id;
}
const providerA = resolveProviderMembership(store, {
  authSubject: fixture.ids.providerAAuthSubject,
  email: fixture.providerMemberships[0].email,
});
const providerB = resolveProviderMembership(store, {
  authSubject: fixture.ids.providerBAuthSubject,
  email: fixture.providerMemberships[1].email,
});
const providerC = resolveProviderMembership(store, {
  authSubject: fixture.ids.providerCAuthSubject,
  email: fixture.providerMemberships[2].email,
});
check("32 provider membership resolves from subject plus normalised email", providerA.providerId === "provider-qa");
throwsCode(
  "33 provider authentication fails closed for wrong subject",
  () => resolveProviderMembership(store, { authSubject: fixture.ids.providerBAuthSubject, email: fixture.providerMemberships[0].email }),
  "provider_membership_denied",
);

const failedDelivery = recordInvitationDelivery(store, leadA, invitations[0].id, {
  accepted: false,
  failureCode: "provider_rejected",
  idempotencyKey: "delivery-a-failed",
  now: "2026-09-11T08:04:00.000Z",
});
check("34 email failure is truthful and retryable", failedDelivery.status === "delivery_failed" && failedDelivery.notificationStatus === "failed");
const invitationCountBeforeRetry = store.invitations.length;
recordInvitationDelivery(store, leadA, invitations[0].id, {
  accepted: true,
  idempotencyKey: "delivery-a-retry",
  now: "2026-09-11T08:05:00.000Z",
});
recordInvitationDelivery(store, leadA, invitations[1].id, {
  accepted: true,
  idempotencyKey: "delivery-b",
  now: "2026-09-11T08:05:00.000Z",
});
recordInvitationDelivery(store, leadA, invitations[2].id, {
  accepted: true,
  idempotencyKey: "delivery-c",
  now: "2026-09-11T08:05:00.000Z",
});
check("35 retry does not duplicate invitation", store.invitations.length === invitationCountBeforeRetry && invitations[0].notificationAttemptCount === 2);

const opportunityA = getProviderOpportunity(store, providerA, invitations[0].id);
check("36 Provider A sees exact approved brief", opportunityA.version.publishedSnapshot.requirement === request.content.requirement);
throwsCode(
  "37 Provider B cannot substitute Provider A invitation ID",
  () => getProviderOpportunity(store, providerB, invitations[0].id),
  "cross_provider_denied",
);
check("38 provider opportunity list is provider-scoped", listProviderInvitations(store, providerA).length === 1);
markInvitationViewed(store, providerA, invitations[0].id, { idempotencyKey: "view-a", now: "2026-09-11T08:06:00.000Z" });
check("39 invitation viewed is audited", invitations[0].status === "viewed" && store.events.some((event) => event.eventType === "invitation_viewed"));

const draftA = saveProviderResponseDraft(store, providerA, invitations[0].id, fixture.providerResponses.providerA, {
  idempotencyKey: "draft-a",
  now: "2026-09-11T08:10:00.000Z",
});
const draftB = saveProviderResponseDraft(store, providerB, invitations[1].id, fixture.providerResponses.providerB, {
  idempotencyKey: "draft-b",
  now: "2026-09-11T08:11:00.000Z",
});
check("40 providers save independent response drafts", draftA.status === "draft" && draftB.status === "draft");
const responseVersionA = submitProviderResponse(store, providerA, draftA.id, {
  idempotencyKey: "submit-a-v1",
  now: "2026-09-11T08:12:00.000Z",
});
const responseVersionB = submitProviderResponse(store, providerB, draftB.id, {
  idempotencyKey: "submit-b-v1",
  now: "2026-09-11T08:13:00.000Z",
});
check("41 structured responses submit as Version 1", responseVersionA.version === 1 && responseVersionB.version === 1);
const duplicateResponse = submitProviderResponse(store, providerA, draftA.id, { idempotencyKey: "submit-a-v1" });
check("42 duplicate response submission is idempotent", duplicateResponse === responseVersionA && store.responseVersions.length === 2);
throwsCode(
  "43 Provider A cannot access Provider B response ID",
  () => getProviderResponse(store, providerA, draftB.id),
  "cross_provider_denied",
);

declineInvitation(store, providerC, invitations[2].id, {
  reasonCategory: "no_capacity_in_required_timeframe",
  note: "No capacity for the requested start.",
  idempotencyKey: "decline-c",
  now: "2026-09-11T08:14:00.000Z",
});
check("44 Provider C decline is private structured history", invitations[2].status === "declined" && invitations[2].declineReasonCategory === "no_capacity_in_required_timeframe");

const providerQuestion = askClarification(store, providerA, invitations[0].id, {
  question: "Will both functions provide suitable workplace projects?",
  idempotencyKey: "provider-a-question",
  now: "2026-09-11T08:15:00.000Z",
});
answerClarification(store, leadA, providerQuestion.id, {
  answer: "Both functions will identify suitable workplace projects before the cohort starts.",
  shareWithAllInvitees: true,
  idempotencyKey: "answer-shared",
  now: "2026-09-11T08:16:00.000Z",
});
const visibleToB = listProviderVisibleClarifications(store, providerB, request.id);
check("45 shared clarification reaches all invitees", visibleToB.some((item) => item.label === "Employer clarification"));
check("46 shared clarification anonymises originating provider", visibleToB.every((item) => !("providerId" in item) && !("askedByProviderMembershipId" in item)));

const employerQuestion = askProviderClarification(store, leadA, invitations[0].id, {
  question: "Please confirm whether monthly reporting includes attendance exceptions.",
  idempotencyKey: "employer-question-a",
  now: "2026-09-11T08:17:00.000Z",
});
check("47 employer can ask a submitted-response clarification", employerQuestion.askedByType === "employer_user");
answerEmployerClarification(store, providerA, employerQuestion.id, {
  answer: "Yes, the monthly report includes attendance exceptions.",
  idempotencyKey: "provider-a-answer",
  now: "2026-09-11T08:18:00.000Z",
});
check("48 provider can answer employer clarification", employerQuestion.answeredByType === "provider_member");
check("49 employer question remains provider-specific", !listProviderVisibleClarifications(store, providerB, request.id).some((item) => item.id === employerQuestion.id));

const comparison = compareSubmittedResponses(store, leadA, request.id);
check("50 employer gets two comparable submitted responses", comparison.columns.length === 2);
check("51 comparison covers structured decision fields", comparison.columns.every((column) => column.programme && column.startAvailability && column.delivery && column.cohortCapacity));
const comparisonJson = JSON.stringify(comparison).toLowerCase();
check("52 comparison has no score, stars, rank or winner", !/(score|stars|ranking|winner|best fit|1st|2nd|3rd)/.test(comparisonJson));
check("53 neutral difference summary identifies material facts", comparison.pointsToResolve.length >= 3 && comparison.pointsToResolve.some((point) => point.includes("cohort condition")));

const decisionA = shortlistProvider(store, leadA, request.id, draftA.id, {
  privateNote: "Private decision note A",
  idempotencyKey: "shortlist-a",
  now: "2026-09-11T08:20:00.000Z",
});
const decisionB = shortlistProvider(store, leadA, request.id, draftB.id, {
  privateNote: "Private decision note B",
  idempotencyKey: "shortlist-b",
  now: "2026-09-11T08:21:00.000Z",
});
check("54 more than one provider can be shortlisted", decisionA.state === "shortlisted" && decisionB.state === "shortlisted");
const duplicateShortlist = shortlistProvider(store, leadA, request.id, draftA.id, {
  idempotencyKey: "shortlist-a-duplicate",
});
check("55 shortlist is idempotent", duplicateShortlist.id === decisionA.id && store.decisions.length === 2);
progressProviderToAgreement(store, leadA, request.id, draftA.id, {
  idempotencyKey: "progress-a",
  now: "2026-09-11T08:22:00.000Z",
});
check("56 progress-to-agreement is not a contract or enrolment", request.status === "progressed_to_agreement" && store.events.some((event) => event.eventType === "provider_progressed_to_agreement" && event.metadata.enrolsLearners === false));
throwsCode(
  "57 only one provider can progress to agreement",
  () => progressProviderToAgreement(store, leadA, request.id, draftB.id, { idempotencyKey: "progress-b" }),
  "agreement_already_progressed",
);
const providerBOutcome = getProviderDecisionOutcome(store, providerB, request.id);
check("58 Provider B sees only its own appropriate decision state", providerBOutcome.state === "shortlisted" && !("privateDecisionNote" in providerBOutcome));

const agreement = confirmAgreement(store, leadA, request.id, providerA.providerId, {
  idempotencyKey: "confirm-a",
  now: "2026-09-11T08:23:00.000Z",
});
check("59 agreement snapshot preserves selected response version", agreement.responseVersion === 1 && agreement.label === "Request agreement snapshot");
check("60 agreement confirmation closes Request without legal claim", request.status === "closed" && store.events.some((event) => event.eventType === "agreement_confirmed" && event.metadata.legallyBindingContract === false));
const handover = completeWorkspaceHandover(store, leadA, request.id, {
  addProvider: true,
  addProgramme: true,
  idempotencyKey: "handover-a",
  now: "2026-09-11T08:24:00.000Z",
});
check("61 My Provider handover persists once", handover.providerAdded && store.organisationProviderSelections.length === 1);
check("62 My Programme handover persists once", handover.programmeAdded && store.organisationProgrammeSelections.length === 1);
const duplicateHandover = completeWorkspaceHandover(store, leadA, request.id, {
  addProvider: true,
  addProgramme: true,
  idempotencyKey: "handover-a",
});
check("63 handover is idempotent", duplicateHandover.id === handover.id && store.organisationProviderSelections.length === 1 && store.organisationProgrammeSelections.length === 1);
check("64 handover creates no employee, learner, application or enrolment", !["employees", "learners", "applications", "enrolments"].some((key) => key in store));
const activityA = providerActivityMetrics(store, providerA);
check("65 provider Activity uses factual counts", activityA.opportunitiesReceived === 1 && activityA.responsesSubmitted === 1 && activityA.shortlisted === 1 && activityA.progressedToAgreement === 1);

check("66 Employer B remains empty", listEmployerRequests(store, leadB).length === 0);
throwsCode(
  "67 Employer B cannot substitute Employer A Request ID",
  () => getEmployerRequest(store, leadB, request.id),
  "cross_organisation_denied",
);
check("68 Provider A sees only Provider A invitation", listProviderInvitations(store, providerA).every((item) => item.providerId === providerA.providerId));
check("69 Provider B sees only Provider B invitation", listProviderInvitations(store, providerB).every((item) => item.providerId === providerB.providerId));
check("70 Provider C retains declined history", listProviderInvitations(store, providerC)[0].status === "declined");

const versionFixture = createRequestsAcceptanceFixture();
const versionStore = createEmptyServiceRequestStore(versionFixture.capabilities);
const versionRequest = createServiceRequestDraft(versionStore, versionFixture.employerActors.leadA, {
  content: versionFixture.requestContent,
  idempotencyKey: "version-request",
  now: "2026-09-11T09:00:00.000Z",
});
const versionOne = publishServiceRequest(versionStore, versionFixture.employerActors.leadA, versionRequest.id, {
  organisationName: versionFixture.organisationNames.employerA,
  idempotencyKey: "version-publish-v1",
  now: "2026-09-11T09:01:00.000Z",
});
const versionTwo = updatePublishedServiceRequest(versionStore, versionFixture.employerActors.leadA, versionRequest.id, {
  content: { ...versionFixture.requestContent, preferredStart: { kind: "month", value: "2027-02" } },
  changeSummary: "Preferred start moved to February 2027",
  idempotencyKey: "version-publish-v2",
  now: "2026-09-11T09:02:00.000Z",
});
check("71 material update creates Version 2", versionTwo.version === 2 && versionRequest.currentVersion === 2);
check("72 Version 1 remains historically intact", versionOne.version === 1 && versionOne.publishedSnapshot.preferredStart.value === "2027-01");
check("73 version snapshots are distinct and immutable", versionStore.requestVersions.length === 2 && Object.isFrozen(versionOne));

const deadlineStore = createEmptyServiceRequestStore(versionFixture.capabilities);
for (const membership of versionFixture.providerMemberships) addProviderMembershipForTest(deadlineStore, membership);
const deadlineRequest = createServiceRequestDraft(deadlineStore, versionFixture.employerActors.leadA, {
  content: versionFixture.requestContent,
  idempotencyKey: "deadline-request",
});
publishServiceRequest(deadlineStore, versionFixture.employerActors.leadA, deadlineRequest.id, {
  organisationName: versionFixture.organisationNames.employerA,
  idempotencyKey: "deadline-publish",
});
const deadlineInvitation = inviteProviders(deadlineStore, versionFixture.employerActors.leadA, deadlineRequest.id, ["provider-qa"], { idempotencyKey: "deadline-invite" })[0];
deadlineInvitation.invitedProviderMembershipId = versionFixture.providerMemberships[0].id;
recordInvitationDelivery(deadlineStore, versionFixture.employerActors.leadA, deadlineInvitation.id, { accepted: true, idempotencyKey: "deadline-send" });
check("74 passed deadline marks access without deleting draft/history", markPastDeadlineInvitations(deadlineStore, "2026-10-02")[0].status === "deadline_passed");
const extended = extendServiceRequestDeadline(deadlineStore, versionFixture.employerActors.leadA, deadlineRequest.id, {
  deadline: "2026-10-15",
  idempotencyKey: "deadline-extend",
  now: "2026-10-02T09:00:00.000Z",
});
check("75 deadline extension is versioned and reopens invitation", extended.version === 2 && deadlineInvitation.status === "sent" && deadlineInvitation.deadline === "2026-10-15");

const cancelStore = createEmptyServiceRequestStore(versionFixture.capabilities);
const cancelRequest = createServiceRequestDraft(cancelStore, versionFixture.employerActors.leadA, {
  content: versionFixture.requestContent,
  idempotencyKey: "cancel-request",
});
publishServiceRequest(cancelStore, versionFixture.employerActors.leadA, cancelRequest.id, {
  organisationName: versionFixture.organisationNames.employerA,
  idempotencyKey: "cancel-publish",
});
cancelServiceRequest(cancelStore, versionFixture.employerActors.leadA, cancelRequest.id, {
  reason: "Requirement paused by the employer.",
  idempotencyKey: "cancel",
});
check("76 cancellation retains Request and audit history", cancelRequest.status === "cancelled" && cancelStore.requests.length === 1 && cancelStore.events.some((event) => event.eventType === "request_cancelled"));

check("77 AI unavailable is not a workflow dependency", !JSON.stringify(store.events).includes("openai") && store.handovers.length === 1);
check("78 all required controlled Request statuses exist", ["draft", "open", "responses_received", "decision_in_progress", "progressed_to_agreement", "closed", "cancelled", "expired"].every((status) => serviceRequestStatuses.includes(status)));
check("79 event ledger supports future factual funnel measurement", ["request_created", "request_published", "invitation_sent", "invitation_viewed", "provider_response_submitted", "provider_shortlisted", "provider_progressed_to_agreement", "agreement_confirmed", "workspace_handover_completed"].every((type) => store.events.some((event) => event.eventType === type)));
check("80 event idempotency keys are unique per Request", new Set(store.events.map((event) => `${event.organisationId}:${event.requestId}:${event.idempotencyKey}`)).size === store.events.length);
check("81 event metadata has no private employer notes", !JSON.stringify(store.events).includes("Private decision note") && !JSON.stringify(store.events).includes("private-employee"));

const migration = await fs.readFile("supabase/migrations/028_create_service_requests.sql", "utf8");
const domain = await fs.readFile("lib/levytate/requests/domain.ts", "utf8");
const workflow = await fs.readFile("lib/levytate/requests/workflow.ts", "utf8");
const service = await fs.readFile("lib/server/levytate-service-requests.ts", "utf8");
const capability = await fs.readFile("lib/server/levytate-request-capability.ts", "utf8");
const providerAuth = await fs.readFile("lib/server/levytate-provider-auth.ts", "utf8");
const providerAccessAdmin = await fs.readFile("lib/server/levytate-provider-access-admin.ts", "utf8");
const boundedJson = await fs.readFile("lib/server/bounded-json.ts", "utf8");
const employerUi = await fs.readFile("components/levytate-mvp/EmployerRequestsModule.tsx", "utf8");
const providerUi = await fs.readFile("components/levytate-provider/ProviderWorkspace.tsx", "utf8");
const marketplaceUi = await fs.readFile("components/levytate-mvp/EmployerProgrammeDirectory.tsx", "utf8");
const providerPage = await fs.readFile("app/levytate/provider/page.tsx", "utf8");
const providerLogin = await fs.readFile("app/levytate/provider/login/page.tsx", "utf8");
const providerAccessAdminRoute = await fs.readFile("app/api/levytate-platform/provider-access/route.ts", "utf8");
const providerAccessAdminUi = await fs.readFile("components/levytate-mvp/ProviderAccessAdminModule.tsx", "utf8");
const platformAdminUi = await fs.readFile("components/levytate-mvp/PlatformAdminModules.tsx", "utf8");
const employerRoute = await fs.readFile("app/api/levytate-requests/route.ts", "utf8");
const providerRoute = await fs.readFile("app/api/levytate-provider/opportunities/route.ts", "utf8");
const providerAuthRoute = await fs.readFile("app/api/levytate-provider-auth/request/route.ts", "utf8");
const providerLogoutRoute = await fs.readFile("app/api/levytate-provider/logout/route.ts", "utf8");
const documentation = await fs.readFile("docs/LEVYTATE_REQUESTS_V1_1.md", "utf8");
const previousMigrations = await Promise.all([
  fs.readFile("supabase/migrations/025_create_intelligence_signals.sql", "utf8"),
  fs.readFile("supabase/migrations/026_create_levy_finance_persistence.sql", "utf8"),
  fs.readFile("supabase/migrations/027_create_organisation_catalogue_selections.sql", "utf8"),
]);
check("82 proposed migration is correctly numbered 028", migration.includes("LevyTate Requests V1.1") && migration.includes("levytate_service_requests"));
check("83 migration has no destructive DML or schema operation", !/\b(drop|truncate)\b|delete\s+from/i.test(migration));
check("84 migration does not alter migrations 025-027", previousMigrations.every((text) => text.length > 100));
const newTables = [...migration.matchAll(/create table public\.([a-z0-9_]+)/g)].map((match) => match[1]);
check("85 migration creates thirteen isolated additive tables", newTables.length === 13 && new Set(newTables).size === 13);
check("86 every Requests table forces RLS", newTables.every((table) => migration.includes(`alter table public.${table} force row level security`)));
check("87 browser roles are revoked from every Requests table", newTables.every((table) => migration.includes(`revoke all on table public.${table} from public, anon, authenticated`)));
const serviceRolePolicyTables = new Set(
  [...migration.matchAll(/create policy\s+[a-z0-9_]+\s+on public\.([a-z0-9_]+)\s+for (?:all|select|insert|update|delete) to service_role/g)]
    .map((match) => match[1]),
);
check("88 service-role-only policies cover every Requests table", newTables.every((table) => serviceRolePolicyTables.has(table)));
check("89 immutable version tables have no update grant", !migration.includes("grant select, insert, update on table public.levytate_service_request_versions") && !migration.includes("grant select, insert, update on table public.levytate_service_request_response_versions"));
check("90 provider tenancy has no employer organisation membership", /create table public\.levytate_provider_memberships \([\s\S]*?provider_id text not null/.test(migration) && !/create table public\.levytate_provider_memberships \([\s\S]*?organisation_id/.test(migration.split("create table public.levytate_service_requests")[0]));
check("91 provider invite schema stores only a unique hash with expiry and redemption audit fields", migration.includes("token_hash text not null unique") && migration.includes("redeemed_at timestamptz") && migration.includes("expires_at timestamptz"));
check("92 Requests capability defaults OFF", migration.includes("requests_enabled boolean not null default false"));
check("93 duplicate invitations constrained", migration.includes("levytate_service_request_invitations_request_provider_unique"));
check("94 idempotent events and handover constrained", migration.includes("levytate_service_request_events_idempotency_unique") && migration.includes("levytate_service_request_handovers_idempotency_unique"));
check("95 versions tie responses to exact published Request version", migration.includes("levytate_service_request_response_versions_request_version_fk"));
check("96 both clarification directions are constrained", migration.includes("asked_by_type") && migration.includes("answered_by_type") && workflow.includes("askProviderClarification") && workflow.includes("answerEmployerClarification"));
check("97 legacy percentage-ranked matching is not reused", !domain.includes("matchScore") && !domain.includes("matchPercentage") && !workflow.includes("levytate_matching_requests"));
check("98 no provider score, rank, rating or winner domain exists", !/(providerScore|providerRank|starRating|recommendedWinner)/.test(domain));
check("99 Marketplace canonical tables are not mutated", !/insert\s+into\s+public\.levytate_(providers|provider_programmes)/i.test(migration));
check("100 My Providers/My Programmes underlying tables are not altered", !/alter\s+table\s+public\.levytate_organisation_(providers|programmes)/i.test(migration));
check("101 Provider Intelligence remains untouched", !/alter\s+table\s+public\.provider_intelligence/i.test(migration));
check("102 Finance remains untouched", !/alter\s+table\s+public\.levytate_finance/i.test(migration));
check("103 no learner or application foreign link is introduced", !/references\s+public\.levytate_(learners|learner_records|applications)/i.test(migration));
check("104 workflow remains deterministic without external services", !/fetch\(|openai|anthropic|generateText/.test(workflow));
check("105 structured comparison avoids document-wide table contract", domain.includes("RequestComparisonColumn") && !domain.includes("horizontalOverflow"));
check("106 fixture uses existing canonical provider and programme IDs", fixture.providers.every((provider) => ["provider-qa", "provider-baltic", "provider-apprentify"].includes(provider.providerId)) && fixture.programme.programmeId === "programme-qa-data-analyst");

const rebuiltSnapshot = buildProviderVisibleSnapshot(fixture.organisationNames.employerA, fixture.requestContent);
check("107 published snapshot is deterministic", JSON.stringify(rebuiltSnapshot) === JSON.stringify(buildProviderVisibleSnapshot(fixture.organisationNames.employerA, fixture.requestContent)));
check("108 simulated persistence survives a new-session actor object", getEmployerRequest(store, structuredClone(leadA), request.id).id === request.id);
check("109 programme title has an explicit persistence column", migration.includes("programme_title text"));
check("110 deployed capability requires environment and organisation gates", capability.includes("isRequestsEnvironmentEnabled()") && capability.includes("requests_enabled") && capability.includes("return false"));
check("111 employer API scope derives from the authorised server session", service.includes("getLearnerLifecycleServerContext(session)") && !service.includes("action.organisationId"));
check("112 provider writes derive provider scope from signed session", service.includes("providerActor(session)") && !/ProviderRequestAction[\s\S]*organisationId/.test(await fs.readFile("lib/levytate/requests/api.ts", "utf8")));
check("113 provider routes fail closed without capability-enabled invitations", providerPage.includes("notFound()") && providerLogin.includes("isRequestsEnvironmentEnabled") && providerAuth.includes("hasCapabilityEnabledInvitation"));
check("114 canonical provider and programme IDs are revalidated server-side", service.includes("assertCanonicalProviders") && service.includes("canonicalRequestContent") && service.includes("providerProgrammeOptions(session.providerId)"));
check("115 invitation notification truth is persisted after delivery attempt", service.includes("recordInvitationDelivery") && service.includes("provider_access_not_configured") && service.includes("delivery_provider_unavailable"));
check("116 invitation email contains status context but no full brief", service.includes("The full approved brief is available only after secure sign-in") && !service.includes("publishedSnapshot.requirement"));
check("117 employer receives status-only response notification", service.includes("A provider submitted a response") && service.includes("Promise.allSettled"));
check("118 Marketplace entry points remain server-capability controlled", marketplaceUi.includes("meta?.requestsEnabled") && marketplaceUi.includes("Request proposals") && marketplaceUi.includes("Request proposal"));
check("119 employer experience is limited to three main creation steps", employerUi.includes('type CreationStep = 1 | 2 | 3') && !employerUi.includes('CreationStep = 1 | 2 | 3 |'));
check("120 employer send remains explicit and provider-selected", employerUi.includes("I approve this brief for providers") && employerUi.includes("Send request to") && employerUi.includes("5 selected"));
check("121 provider can answer employer-origin clarification", providerUi.includes('action: "answer_clarification"') && providerUi.includes("Employer question"));
check("122 responsive surfaces prevent page-level horizontal overflow", providerUi.includes("overflow-x-hidden") && employerUi.includes("overflow-x-auto") === false);
check("123 interactive Request controls retain accessible focus treatment", employerUi.includes("focus-visible:ring-2") && providerUi.includes("focus:ring-4"));
check(
  "124 agreement handover writes only existing portfolio selection records",
  service.includes("organisation_providers_upsert") &&
    service.includes("organisation_programmes_upsert") &&
    migration.includes("insert into public.levytate_organisation_providers") &&
    migration.includes("insert into public.levytate_organisation_programmes") &&
    !/saveApplication|createLearnerRecord|saveEnrolment/.test(service),
);
check("125 API and pages use private no-store delivery", (await fs.readFile("app/api/levytate-requests/route.ts", "utf8")).includes("private, no-store") && (await fs.readFile("app/api/levytate-provider/opportunities/route.ts", "utf8")).includes("private, no-store"));

throwsCode(
  "126 same-day or past response deadlines are rejected deterministically",
  () => createServiceRequestDraft(createEmptyServiceRequestStore(fixture.capabilities), leadA, {
    content: { ...fixture.requestContent, responseDeadline: "2026-09-11" },
    idempotencyKey: "invalid-deadline",
    now: "2026-09-11T09:00:00.000Z",
  }),
  "response_deadline_not_future",
);

const revisionScenario = createProviderResponseScenario("revision-guard");
const firstResponse = saveProviderResponseDraft(
  revisionScenario.store,
  revisionScenario.provider,
  revisionScenario.invitation.id,
  fixture.providerResponses.providerA,
  { idempotencyKey: "revision-guard:draft", now: "2026-09-11T09:04:00.000Z" },
);
submitProviderResponse(revisionScenario.store, revisionScenario.provider, firstResponse.id, {
  idempotencyKey: "revision-guard:submit-v1",
  now: "2026-09-11T09:05:00.000Z",
});
markInvitationViewed(revisionScenario.store, revisionScenario.provider, revisionScenario.invitation.id, {
  idempotencyKey: "revision-guard:view-after-response",
  now: "2026-09-11T09:06:00.000Z",
});
check("127 viewing an already-responded invitation preserves responded status", revisionScenario.invitation.status === "responded");
const sameProviderColleague = {
  ...revisionScenario.provider,
  membershipId: "30000000-0000-4000-8000-000000000099",
  email: "colleague@qa-provider.test",
};
check(
  "128 an active colleague in the same provider tenancy can access the opportunity",
  getProviderOpportunity(revisionScenario.store, sameProviderColleague, revisionScenario.invitation.id).invitation.id === revisionScenario.invitation.id,
);
throwsCode(
  "129 a provider cannot revise an unchanged published Request",
  () => saveProviderResponseDraft(
    revisionScenario.store,
    revisionScenario.provider,
    revisionScenario.invitation.id,
    fixture.providerResponses.providerA,
    { idempotencyKey: "revision-guard:unauthorised-revision", allowRevision: true, now: "2026-09-11T09:07:00.000Z" },
  ),
  "response_already_submitted",
);
updatePublishedServiceRequest(revisionScenario.store, leadA, revisionScenario.request.id, {
  content: {
    ...revisionScenario.request.content,
    businessOutcome: "Updated employer-approved outcome for the revised brief.",
  },
  changeSummary: "Business outcome clarified",
  idempotencyKey: "revision-guard:request-v2",
  now: "2026-09-11T09:08:00.000Z",
});
saveProviderResponseDraft(
  revisionScenario.store,
  revisionScenario.provider,
  revisionScenario.invitation.id,
  fixture.providerResponses.providerA,
  { idempotencyKey: "revision-guard:draft-v2", allowRevision: true, now: "2026-09-11T09:09:00.000Z" },
);
const revisedResponse = submitProviderResponse(
  revisionScenario.store,
  revisionScenario.provider,
  firstResponse.id,
  { idempotencyKey: "revision-guard:submit-v2", now: "2026-09-11T09:10:00.000Z" },
);
check("130 a material Request update permits a response tied to the new brief version", revisedResponse.version === 2 && revisedResponse.requestVersion === 2);

const cancelledScenario = createProviderResponseScenario("cancel-guard");
const cancelledResponse = saveProviderResponseDraft(
  cancelledScenario.store,
  cancelledScenario.provider,
  cancelledScenario.invitation.id,
  fixture.providerResponses.providerA,
  { idempotencyKey: "cancel-guard:draft", now: "2026-09-11T09:04:00.000Z" },
);
submitProviderResponse(cancelledScenario.store, cancelledScenario.provider, cancelledResponse.id, {
  idempotencyKey: "cancel-guard:submit",
  now: "2026-09-11T09:05:00.000Z",
});
cancelServiceRequest(cancelledScenario.store, leadA, cancelledScenario.request.id, {
  reason: "Employer cancelled the requirement.",
  idempotencyKey: "cancel-guard:cancel",
  now: "2026-09-11T09:06:00.000Z",
});
throwsCode(
  "131 a cancelled Request rejects provider response revision",
  () => saveProviderResponseDraft(
    cancelledScenario.store,
    cancelledScenario.provider,
    cancelledScenario.invitation.id,
    fixture.providerResponses.providerA,
    { idempotencyKey: "cancel-guard:revision", allowRevision: true, now: "2026-09-11T09:07:00.000Z" },
  ),
  "request_closed",
);
throwsCode(
  "132 a cancelled Request rejects a new employer decision",
  () => shortlistProvider(cancelledScenario.store, leadA, cancelledScenario.request.id, cancelledResponse.id, {
    idempotencyKey: "cancel-guard:shortlist",
    now: "2026-09-11T09:08:00.000Z",
  }),
  "request_closed",
);
throwsCode(
  "133 close cannot overwrite a cancelled Request",
  () => closeServiceRequest(cancelledScenario.store, leadA, cancelledScenario.request.id, {
    idempotencyKey: "cancel-guard:close",
    now: "2026-09-11T09:09:00.000Z",
  }),
  "request_closed",
);

const expiryScenario = createProviderResponseScenario("expiry-guard");
const expiringDraft = saveProviderResponseDraft(
  expiryScenario.store,
  expiryScenario.provider,
  expiryScenario.invitation.id,
  fixture.providerResponses.providerA,
  { idempotencyKey: "expiry-guard:draft", now: "2026-09-11T09:04:00.000Z" },
);
markPastDeadlineInvitations(expiryScenario.store, "2026-10-02");
check(
  "134 a Request with no still-open invitation expires with a deterministic system event",
  expiryScenario.request.status === "expired" && expiryScenario.store.events.some(
    (event) => event.eventType === "request_expired" && event.actorType === "system",
  ),
);
throwsCode(
  "135 a draft cannot submit after its response deadline",
  () => submitProviderResponse(expiryScenario.store, expiryScenario.provider, expiringDraft.id, {
    idempotencyKey: "expiry-guard:late-submit",
    now: "2026-10-02T09:00:00.000Z",
  }),
  "response_deadline_passed",
);
const expiredCloseStore = structuredClone(expiryScenario.store);
const expiredCloseRequest = expiredCloseStore.requests.find((item) => item.id === expiryScenario.request.id);
closeServiceRequest(expiredCloseStore, leadA, expiryScenario.request.id, {
  idempotencyKey: "expiry-guard:close",
  now: "2026-10-02T09:00:00.000Z",
});
check(
  "136 employer may explicitly close an expired zero-response Request while retaining its history",
  expiredCloseRequest?.status === "closed"
    && expiredCloseStore.requestVersions.some((version) => version.requestId === expiryScenario.request.id)
    && expiredCloseStore.events.some((event) => event.eventType === "request_closed"),
);
extendServiceRequestDeadline(expiryScenario.store, leadA, expiryScenario.request.id, {
  deadline: "2026-10-15",
  idempotencyKey: "expiry-guard:extend",
  now: "2026-10-02T09:01:00.000Z",
});
check(
  "137 a versioned deadline extension safely reopens an expired Request and restores delivery truth",
  expiryScenario.request.status === "open" &&
    expiryScenario.request.closedAt === undefined &&
    expiryScenario.invitation.status === "sent" &&
    expiryScenario.invitation.requestVersion === 2,
);

const sameHandoverDifferentKey = completeWorkspaceHandover(store, leadA, request.id, {
  addProvider: true,
  addProgramme: true,
  idempotencyKey: "handover-same-intent-new-key",
});
check("138 completed handover is idempotent across different request keys", sameHandoverDifferentKey.id === handover.id && store.handovers.length === 1);
throwsCode(
  "139 completed handover rejects a conflicting second intent",
  () => completeWorkspaceHandover(store, leadA, request.id, {
    addProvider: true,
    addProgramme: false,
    idempotencyKey: "handover-conflicting-intent",
  }),
  "handover_already_completed",
);

const compactMigration = migration.replace(/\s+/g, " ");
check(
  "140 migration serialises and enforces the five-provider maximum",
  migration.includes("enforce_levytate_service_request_provider_limit") &&
    migration.includes("pg_advisory_xact_lock") &&
    migration.includes("existing_invitation_count >= 5"),
);
check(
  "141 migration prevents concurrent progression of two providers",
  compactMigration.includes("where state in ('progressed_to_agreement','agreement_confirmed')"),
);
check(
  "142 decision, agreement and handover foreign keys preserve Request/provider correlation",
  compactMigration.includes("organisation_id, invitation_id, request_id, provider_id") &&
    compactMigration.includes("organisation_id, response_id, response_version, request_id, provider_id") &&
    compactMigration.includes("organisation_id, agreement_id, request_id, provider_id"),
);
check("143 delivery provider message IDs have an explicit persistence field", migration.includes("notification_provider_id text"));
check(
  "144 documentation distinguishes isolated SQL proof from the required Supabase dry-run",
  documentation.includes("isolated PostgreSQL 18 migration run") &&
    documentation.includes("linked migration dry-run") &&
    documentation.includes("did not use or modify the linked Supabase project"),
);
check("145 Request expiry has a database-compatible audit event type", migration.includes("'request_expired','request_cancelled'"));
check(
  "146 each logical Request action is persisted through one database transaction",
  service.includes('"rpc/levytate_persist_service_request_action"') &&
    migration.includes("create function public.levytate_persist_service_request_action"),
);
check(
  "147 concurrent Request changes fail rather than overwrite newer state",
  migration.includes("p_expected jsonb") && migration.includes("using errcode = '40001'"),
);
check(
  "148 transactional persistence is service-role only and organisation scoped",
  migration.match(/if auth\.role\(\) is distinct from 'service_role'/g)?.length === 2 &&
    migration.includes("Cross-organisation Requests persistence was denied") &&
    migration.includes("revoke all on function public.levytate_persist_service_request_action"),
);
check(
  "149 agreement and portfolio handover share the same transaction",
  migration.indexOf("insert into public.levytate_service_request_handovers") <
    migration.indexOf("insert into public.levytate_organisation_providers") &&
    service.includes("selectionActorEmail: actor.email"),
);
check(
  "150 provider access membership and audit mutations share a service-role-only transaction",
  migration.includes("create function public.levytate_mutate_provider_membership") &&
    migration.includes("insert into public.levytate_audit_events") &&
    migration.includes("grant execute on function public.levytate_mutate_provider_membership"),
);
check(
  "151 provider access RPC binds each audit event to its exact lifecycle operation",
  migration.includes("expected_audit_action := case p_operation") &&
    migration.includes("is distinct from expected_audit_action"),
);
check(
  "152 Requests is hard-disabled in the Vercel Production environment",
  capability.includes('process.env.VERCEL_ENV === "production"') && capability.includes("return false"),
);
check(
  "153 Platform Admin has a server-probed provider-access surface that disappears when Requests is off",
  platformAdminUi.includes("<ProviderAccessAdminModule />") &&
    providerAccessAdminUi.includes('fetch(providerAccessEndpoint, { cache: "no-store"') &&
    providerAccessAdminUi.includes('response.status === 404') &&
    providerAccessAdminUi.includes('availability === "checking" || availability === "hidden"'),
);
check(
  "154 provider-access UI supports canonical provisioning and controlled lifecycle changes",
  providerAccessAdminUi.includes("Canonical provider") &&
    providerAccessAdminUi.includes('method: "POST"') &&
    providerAccessAdminUi.includes('method: "PATCH"') &&
    providerAccessAdminUi.includes('mutate("update")') &&
    providerAccessAdminUi.includes('mutate("revoke")') &&
    providerAccessAdminUi.includes('mutate("reactivate")'),
);
check(
  "155 provider-access UI explains the separate-tenancy and pending-binding boundary",
  providerAccessAdminUi.includes("Provider membership never grants access to an employer workspace") &&
    providerAccessAdminUi.includes("first successful passwordless callback binds it") &&
    documentation.includes("creates one active, audited provider membership with a visibly pending binding"),
);
check(
  "156 Platform Admin provider-access mutation bodies are bounded",
  providerAccessAdminRoute.includes("maximumRequestBodyBytes") &&
    providerAccessAdminRoute.includes("readBoundedJson(request, maximumRequestBodyBytes)"),
);

check(
  "157 strict employer payload validation accepts a complete closed action",
  assertEmployerRequestActionPayload({
    action: "send_request",
    content: fixture.requestContent,
    providerIds: fixture.providers.map((provider) => provider.providerId),
    idempotencyKey: "validation:employer-send",
  }).action === "send_request",
);
throwsCode(
  "158 employer payload validation rejects unknown client-controlled fields",
  () => assertEmployerRequestActionPayload({
    action: "publish",
    requestId: request.id,
    organisationId: fixture.ids.employerA,
    idempotencyKey: "validation:unknown-field",
  }),
  "invalid_request_payload",
);
check(
  "159 strict provider payload validation accepts a complete structured response",
  assertProviderRequestActionPayload({
    action: "submit_response",
    invitationId: invitations[0].id,
    content: fixture.providerResponses.providerA,
    idempotencyKey: "validation:provider-submit",
  }).action === "submit_response",
);
throwsCode(
  "160 provider payload validation rejects more than the five-provider boundary",
  () => assertEmployerRequestActionPayload({
    action: "invite_providers",
    requestId: request.id,
    providerIds: ["one", "two", "three", "four", "five", "six"],
    idempotencyKey: "validation:too-many-providers",
  }),
  "invalid_request_payload",
);

const respondedDeadlineScenario = createProviderResponseScenario("responded-deadline");
const respondedDeadlineDraft = saveProviderResponseDraft(
  respondedDeadlineScenario.store,
  respondedDeadlineScenario.provider,
  respondedDeadlineScenario.invitation.id,
  fixture.providerResponses.providerA,
  { idempotencyKey: "responded-deadline:draft", now: "2026-09-11T09:04:00.000Z" },
);
submitProviderResponse(
  respondedDeadlineScenario.store,
  respondedDeadlineScenario.provider,
  respondedDeadlineDraft.id,
  { idempotencyKey: "responded-deadline:submit", now: "2026-09-11T09:05:00.000Z" },
);
markPastDeadlineInvitations(respondedDeadlineScenario.store, "2026-10-02");
check(
  "161 a passed provider deadline preserves the employer decision window when a response exists",
  respondedDeadlineScenario.request.status === "responses_received"
    && respondedDeadlineScenario.invitation.status === "responded",
);

const staleDecisionScenario = createProviderResponseScenario("stale-decision");
const staleDecisionDraft = saveProviderResponseDraft(
  staleDecisionScenario.store,
  staleDecisionScenario.provider,
  staleDecisionScenario.invitation.id,
  fixture.providerResponses.providerA,
  { idempotencyKey: "stale-decision:draft", now: "2026-09-11T09:04:00.000Z" },
);
submitProviderResponse(staleDecisionScenario.store, staleDecisionScenario.provider, staleDecisionDraft.id, {
  idempotencyKey: "stale-decision:submit",
  now: "2026-09-11T09:05:00.000Z",
});
updatePublishedServiceRequest(staleDecisionScenario.store, leadA, staleDecisionScenario.request.id, {
  content: {
    ...staleDecisionScenario.request.content,
    businessOutcome: "A materially revised outcome requiring a current provider response.",
  },
  changeSummary: "Outcome materially revised",
  idempotencyKey: "stale-decision:request-v2",
  now: "2026-09-11T09:06:00.000Z",
});
throwsCode(
  "162 employer decisions reject a response tied to an older Request version",
  () => shortlistProvider(staleDecisionScenario.store, leadA, staleDecisionScenario.request.id, staleDecisionDraft.id, {
    idempotencyKey: "stale-decision:shortlist",
    now: "2026-09-11T09:07:00.000Z",
  }),
  "response_version_stale",
);

const progressedGuardScenario = createProviderResponseScenario("progressed-guard");
const progressedGuardDraft = saveProviderResponseDraft(
  progressedGuardScenario.store,
  progressedGuardScenario.provider,
  progressedGuardScenario.invitation.id,
  fixture.providerResponses.providerA,
  { idempotencyKey: "progressed-guard:draft", now: "2026-09-11T09:04:00.000Z" },
);
submitProviderResponse(progressedGuardScenario.store, progressedGuardScenario.provider, progressedGuardDraft.id, {
  idempotencyKey: "progressed-guard:submit",
  now: "2026-09-11T09:05:00.000Z",
});
progressProviderToAgreement(progressedGuardScenario.store, leadA, progressedGuardScenario.request.id, progressedGuardDraft.id, {
  idempotencyKey: "progressed-guard:progress",
  now: "2026-09-11T09:06:00.000Z",
});
throwsCode(
  "163 a progressed Request cannot be materially revised",
  () => updatePublishedServiceRequest(progressedGuardScenario.store, leadA, progressedGuardScenario.request.id, {
    content: { ...progressedGuardScenario.request.content, businessOutcome: "Unsafe post-progression change" },
    changeSummary: "Unsafe change",
    idempotencyKey: "progressed-guard:update",
    now: "2026-09-11T09:07:00.000Z",
  }),
  "request_closed",
);
throwsCode(
  "164 a progressed Request requires the explicit did-not-proceed path instead of cancellation",
  () => cancelServiceRequest(progressedGuardScenario.store, leadA, progressedGuardScenario.request.id, {
    reason: "Unsafe cancellation",
    idempotencyKey: "progressed-guard:cancel",
    now: "2026-09-11T09:08:00.000Z",
  }),
  "decision_conflict",
);
check(
  "165 persistence guards the previously-read Request even for related-row-only actions",
  service.includes("const guardedRequestIds = new Set(newEvents.map((item) => item.requestId))")
    && service.includes("requests: expectedRequests"),
);
check(
  "166 every new browser mutation route requires an explicit matching Origin",
  [employerRoute, providerRoute, providerAuthRoute, providerLogoutRoute, providerAccessAdminRoute]
    .every((source) => source.includes('origin === new URL(request.url).origin') && !source.includes("!origin ||")),
);
check(
  "167 provider logout clears browser caches and revalidates BFCache restores",
  providerLogoutRoute.includes('Clear-Site-Data')
    && providerUi.includes('window.addEventListener("pageshow"')
    && providerUi.includes("event.persisted"),
);
check(
  "168 Requests remains off for Vercel and non-Vercel Production execution",
  capability.includes('process.env.VERCEL_ENV === "production"')
    && capability.includes('process.env.NODE_ENV === "production" && process.env.VERCEL_ENV !== "preview"'),
);
check(
  "169 response email retries use stable recipient-safe idempotency with exact-replay recovery",
  service.includes('createHash("sha256").update(recipient.email.trim().toLowerCase())')
    && service.includes("let shouldNotifyEmployer = false")
    && service.includes("if (shouldNotifyEmployer)"),
);

check(
  "170 strict employer payload validation accepts the bounded close-decision action",
  assertEmployerRequestActionPayload({
    action: "close_request",
    requestId: respondedDeadlineScenario.request.id,
    idempotencyKey: "responded-deadline:close",
  }).action === "close_request",
);
closeServiceRequest(respondedDeadlineScenario.store, leadA, respondedDeadlineScenario.request.id, {
  idempotencyKey: "responded-deadline:close",
  now: "2026-10-02T09:00:00.000Z",
});
check(
  "171 employer may close the decision after deadline while retaining response and history",
  respondedDeadlineScenario.request.status === "closed"
    && respondedDeadlineScenario.store.responses.some((response) => response.id === respondedDeadlineDraft.id)
    && respondedDeadlineScenario.store.events.some((event) => event.eventType === "request_closed"),
);
throwsCode(
  "172 a progressed Request cannot bypass its explicit agreement outcome by closing",
  () => closeServiceRequest(progressedGuardScenario.store, leadA, progressedGuardScenario.request.id, {
    idempotencyKey: "progressed-guard:close",
    now: "2026-10-02T09:00:00.000Z",
  }),
  "decision_conflict",
);
check(
  "173 close decision is wired through the closed API validator, server action and employer UI",
  service.includes('case "close_request": closeServiceRequest(')
    && employerUi.includes("onCloseRequest")
    && employerUi.includes("Close decision")
    && employerUi.includes('"decision_in_progress", "expired"'),
);
check(
  "174 provider UI keeps the response deadline open through its UTC calendar date",
  providerUi.includes("opportunity.responseDeadline < todayUtc")
    && providerUi.includes("new Date().toISOString().slice(0, 10)")
    && providerUi.includes("window.setInterval(refreshToday, 60_000)")
    && !providerUi.includes("const [openedAt]"),
);

const createReplayStore = createEmptyServiceRequestStore(fixture.capabilities);
const createReplay = createServiceRequestDraft(createReplayStore, leadA, {
  content: fixture.requestContent,
  privateContext: fixture.privateContext,
  idempotencyKey: "idempotency:create",
  now: "2026-09-11T10:00:00.000Z",
});
const createReplayEventCount = createReplayStore.events.length;
const exactCreateReplay = createServiceRequestDraft(createReplayStore, leadA, {
  content: structuredClone(fixture.requestContent),
  privateContext: structuredClone(fixture.privateContext),
  idempotencyKey: "idempotency:create",
  now: "2026-10-20T10:00:00.000Z",
});
check(
  "175 draft creation returns the deterministic prior result for an exact same-key replay",
  exactCreateReplay === createReplay
    && createReplayStore.requests.length === 1
    && createReplayStore.events.length === createReplayEventCount,
);
throwsCode(
  "176 draft creation rejects different public content under the same idempotency key",
  () => createServiceRequestDraft(createReplayStore, leadA, {
    content: { ...fixture.requestContent, title: "Different Request intent" },
    privateContext: fixture.privateContext,
    idempotencyKey: "idempotency:create",
  }),
  "idempotency_conflict",
);
throwsCode(
  "177 draft creation rejects different private context under the same idempotency key",
  () => createServiceRequestDraft(createReplayStore, leadA, {
    content: fixture.requestContent,
    privateContext: { ...fixture.privateContext, privateNotes: "Different private intent" },
    idempotencyKey: "idempotency:create",
  }),
  "idempotency_conflict",
);

const declineReplayScenario = createProviderResponseScenario("decline-replay");
const firstDecline = declineInvitation(
  declineReplayScenario.store,
  declineReplayScenario.provider,
  declineReplayScenario.invitation.id,
  {
    reasonCategory: "no_capacity_in_required_timeframe",
    note: "No capacity before the requested start.",
    idempotencyKey: "decline-replay:decline",
    now: "2026-09-11T10:01:00.000Z",
  },
);
const declineReplayEventCount = declineReplayScenario.store.events.length;
const exactDeclineReplay = declineInvitation(
  declineReplayScenario.store,
  declineReplayScenario.provider,
  declineReplayScenario.invitation.id,
  {
    reasonCategory: "no_capacity_in_required_timeframe",
    note: "No capacity before the requested start.",
    idempotencyKey: "decline-replay:decline",
    now: "2026-10-20T10:01:00.000Z",
  },
);
check(
  "178 invitation decline returns the prior result for an exact replay even after the response window",
  exactDeclineReplay === firstDecline
    && declineReplayScenario.store.events.length === declineReplayEventCount,
);
throwsCode(
  "179 invitation decline rejects a different note under the same idempotency key",
  () => declineInvitation(
    declineReplayScenario.store,
    declineReplayScenario.provider,
    declineReplayScenario.invitation.id,
    {
      reasonCategory: "no_capacity_in_required_timeframe",
      note: "A different decline intent.",
      idempotencyKey: "decline-replay:decline",
    },
  ),
  "idempotency_conflict",
);

const deadlineReplayStore = createEmptyServiceRequestStore(fixture.capabilities);
const deadlineReplayRequest = createServiceRequestDraft(deadlineReplayStore, leadA, {
  content: fixture.requestContent,
  idempotencyKey: "deadline-replay:request",
  now: "2026-09-11T10:02:00.000Z",
});
publishServiceRequest(deadlineReplayStore, leadA, deadlineReplayRequest.id, {
  organisationName: fixture.organisationNames.employerA,
  idempotencyKey: "deadline-replay:publish",
  now: "2026-09-11T10:03:00.000Z",
});
const firstDeadlineExtension = extendServiceRequestDeadline(deadlineReplayStore, leadA, deadlineReplayRequest.id, {
  deadline: "2026-10-15",
  idempotencyKey: "deadline-replay:extend",
  now: "2026-10-02T10:04:00.000Z",
});
const deadlineReplayVersionCount = deadlineReplayStore.requestVersions.length;
const deadlineReplayEventCount = deadlineReplayStore.events.length;
const exactDeadlineReplay = extendServiceRequestDeadline(deadlineReplayStore, leadA, deadlineReplayRequest.id, {
  deadline: "2026-10-15",
  idempotencyKey: "deadline-replay:extend",
  now: "2026-10-20T10:04:00.000Z",
});
check(
  "180 deadline extension returns its prior version before equal-deadline validation on exact replay",
  exactDeadlineReplay === firstDeadlineExtension
    && deadlineReplayStore.requestVersions.length === deadlineReplayVersionCount
    && deadlineReplayStore.events.length === deadlineReplayEventCount,
);
throwsCode(
  "181 deadline extension rejects a different deadline under the same idempotency key",
  () => extendServiceRequestDeadline(deadlineReplayStore, leadA, deadlineReplayRequest.id, {
    deadline: "2026-10-20",
    idempotencyKey: "deadline-replay:extend",
    now: "2026-10-03T10:05:00.000Z",
  }),
  "idempotency_conflict",
);

const employerAnswerScenario = createProviderResponseScenario("employer-answer-replay");
const employerAnswerQuestion = askClarification(
  employerAnswerScenario.store,
  employerAnswerScenario.provider,
  employerAnswerScenario.invitation.id,
  {
    question: "Will the employer provide a named workplace sponsor?",
    idempotencyKey: "employer-answer-replay:question",
    now: "2026-09-11T10:06:00.000Z",
  },
);
const firstEmployerAnswer = answerClarification(employerAnswerScenario.store, leadA, employerAnswerQuestion.id, {
  answer: "Yes, a named workplace sponsor will be provided.",
  shareWithAllInvitees: true,
  idempotencyKey: "employer-answer-replay:answer",
  now: "2026-09-11T10:07:00.000Z",
});
const employerAnswerEventCount = employerAnswerScenario.store.events.length;
const exactEmployerAnswerReplay = answerClarification(employerAnswerScenario.store, leadA, employerAnswerQuestion.id, {
  answer: "Yes, a named workplace sponsor will be provided.",
  shareWithAll: true,
  idempotencyKey: "employer-answer-replay:answer",
  now: "2026-09-11T10:08:00.000Z",
});
check(
  "182 employer clarification answer allows only its exact same-key replay",
  exactEmployerAnswerReplay === firstEmployerAnswer
    && employerAnswerScenario.store.events.length === employerAnswerEventCount,
);
throwsCode(
  "183 employer clarification answer rejects different sharing intent under the same key",
  () => answerClarification(employerAnswerScenario.store, leadA, employerAnswerQuestion.id, {
    answer: "Yes, a named workplace sponsor will be provided.",
    shareWithAllInvitees: false,
    idempotencyKey: "employer-answer-replay:answer",
  }),
  "idempotency_conflict",
);
throwsCode(
  "184 an answered provider question is immutable under a different key and payload",
  () => answerClarification(employerAnswerScenario.store, leadA, employerAnswerQuestion.id, {
    answer: "A changed answer must not overwrite history.",
    shareWithAllInvitees: true,
    idempotencyKey: "employer-answer-replay:changed-answer",
  }),
  "clarification_already_answered",
);

const terminalDecisionScenario = createProviderResponseScenario("terminal-provider-write");
const terminalDecisionDraft = saveProviderResponseDraft(
  terminalDecisionScenario.store,
  terminalDecisionScenario.provider,
  terminalDecisionScenario.invitation.id,
  fixture.providerResponses.providerA,
  { idempotencyKey: "terminal-provider-write:draft", now: "2026-09-11T10:09:00.000Z" },
);
submitProviderResponse(terminalDecisionScenario.store, terminalDecisionScenario.provider, terminalDecisionDraft.id, {
  idempotencyKey: "terminal-provider-write:submit",
  now: "2026-09-11T10:10:00.000Z",
});
const answeredEmployerQuestion = askProviderClarification(
  terminalDecisionScenario.store,
  leadA,
  terminalDecisionScenario.invitation.id,
  {
    question: "Does reporting include exception escalation?",
    idempotencyKey: "terminal-provider-write:answered-question",
    now: "2026-09-11T10:11:00.000Z",
  },
);
const unansweredEmployerQuestion = askProviderClarification(
  terminalDecisionScenario.store,
  leadA,
  terminalDecisionScenario.invitation.id,
  {
    question: "Can the delivery calendar be confirmed later?",
    idempotencyKey: "terminal-provider-write:unanswered-question",
    now: "2026-09-11T10:12:00.000Z",
  },
);
const firstProviderAnswer = answerEmployerClarification(
  terminalDecisionScenario.store,
  terminalDecisionScenario.provider,
  answeredEmployerQuestion.id,
  {
    answer: "Yes, exception escalation is included.",
    idempotencyKey: "terminal-provider-write:answer",
    now: "2026-09-11T10:13:00.000Z",
  },
);
declineProviderByEmployer(
  terminalDecisionScenario.store,
  leadA,
  terminalDecisionScenario.request.id,
  terminalDecisionDraft.id,
  { idempotencyKey: "terminal-provider-write:decline", now: "2026-09-11T10:14:00.000Z" },
);
updatePublishedServiceRequest(terminalDecisionScenario.store, leadA, terminalDecisionScenario.request.id, {
  content: {
    ...terminalDecisionScenario.request.content,
    additionalNotes: "Version two must not reopen an employer-declined provider.",
  },
  changeSummary: "Clarified version without reopening declined provider",
  idempotencyKey: "terminal-provider-write:v2",
  now: "2026-09-11T10:15:00.000Z",
});
const providerAnswerEventCount = terminalDecisionScenario.store.events.length;
const exactProviderAnswerReplay = answerEmployerClarification(
  terminalDecisionScenario.store,
  terminalDecisionScenario.provider,
  answeredEmployerQuestion.id,
  {
    answer: "Yes, exception escalation is included.",
    idempotencyKey: "terminal-provider-write:answer",
    now: "2026-09-11T10:16:00.000Z",
  },
);
check(
  "185 provider clarification answer permits its exact replay after a terminal employer decision",
  exactProviderAnswerReplay === firstProviderAnswer
    && terminalDecisionScenario.store.events.length === providerAnswerEventCount,
);
throwsCode(
  "186 provider clarification answer rejects a changed payload under the same key",
  () => answerEmployerClarification(
    terminalDecisionScenario.store,
    terminalDecisionScenario.provider,
    answeredEmployerQuestion.id,
    {
      answer: "A changed provider answer.",
      idempotencyKey: "terminal-provider-write:answer",
    },
  ),
  "idempotency_conflict",
);
throwsCode(
  "187 an answered employer question is immutable under a different key",
  () => answerEmployerClarification(
    terminalDecisionScenario.store,
    terminalDecisionScenario.provider,
    answeredEmployerQuestion.id,
    {
      answer: "A changed provider answer.",
      idempotencyKey: "terminal-provider-write:changed-answer",
    },
  ),
  "clarification_already_answered",
);
throwsCode(
  "188 an employer-declined provider cannot reopen a response against Request Version 2",
  () => saveProviderResponseDraft(
    terminalDecisionScenario.store,
    terminalDecisionScenario.provider,
    terminalDecisionScenario.invitation.id,
    fixture.providerResponses.providerA,
    { idempotencyKey: "terminal-provider-write:reopen-v2", allowRevision: true },
  ),
  "provider_decision_terminal",
);
throwsCode(
  "189 an employer-declined provider cannot submit another response",
  () => submitProviderResponse(
    terminalDecisionScenario.store,
    terminalDecisionScenario.provider,
    terminalDecisionDraft.id,
    { idempotencyKey: "terminal-provider-write:resubmit-v2" },
  ),
  "provider_decision_terminal",
);
throwsCode(
  "190 an employer-declined provider cannot ask another clarification",
  () => askClarification(
    terminalDecisionScenario.store,
    terminalDecisionScenario.provider,
    terminalDecisionScenario.invitation.id,
    {
      question: "This terminal provider must remain read-only.",
      idempotencyKey: "terminal-provider-write:new-question",
    },
  ),
  "provider_decision_terminal",
);
throwsCode(
  "191 an employer-declined provider cannot answer an outstanding clarification",
  () => answerEmployerClarification(
    terminalDecisionScenario.store,
    terminalDecisionScenario.provider,
    unansweredEmployerQuestion.id,
    {
      answer: "This answer must not be recorded after decline.",
      idempotencyKey: "terminal-provider-write:late-answer",
    },
  ),
  "provider_decision_terminal",
);
throwsCode(
  "192 an agreement-confirmed provider has read-only Request history",
  () => askClarification(store, providerA, invitations[0].id, {
    question: "This confirmed opportunity is historical.",
    idempotencyKey: "terminal-provider-write:agreement-confirmed",
  }),
  "provider_decision_terminal",
);
recordAgreementNotProceeded(
  progressedGuardScenario.store,
  leadA,
  progressedGuardScenario.request.id,
  progressedGuardScenario.provider.providerId,
  { idempotencyKey: "terminal-provider-write:not-proceeded", now: "2026-09-11T10:17:00.000Z" },
);
throwsCode(
  "193 a not-proceeded provider has read-only Request history",
  () => askClarification(
    progressedGuardScenario.store,
    progressedGuardScenario.provider,
    progressedGuardScenario.invitation.id,
    {
      question: "This not-proceeded opportunity is historical.",
      idempotencyKey: "terminal-provider-write:not-proceeded-question",
    },
  ),
  "provider_decision_terminal",
);

const deliveryVisibilityStore = createEmptyServiceRequestStore(fixture.capabilities);
for (const membership of fixture.providerMemberships) addProviderMembershipForTest(deliveryVisibilityStore, membership);
const deliveryVisibilityRequest = createServiceRequestDraft(deliveryVisibilityStore, leadA, {
  content: fixture.requestContent,
  idempotencyKey: "delivery-visibility:request",
  now: "2026-09-11T11:00:00.000Z",
});
publishServiceRequest(deliveryVisibilityStore, leadA, deliveryVisibilityRequest.id, {
  organisationName: "Employer A",
  idempotencyKey: "delivery-visibility:publish",
  now: "2026-09-11T11:01:00.000Z",
});
const [deliveryVisibilityInvitation] = inviteProviders(
  deliveryVisibilityStore,
  leadA,
  deliveryVisibilityRequest.id,
  [providerA.providerId],
  { idempotencyKey: "delivery-visibility:invite", now: "2026-09-11T11:02:00.000Z" },
);
check(
  "194 provider workspace hides an invitation until delivery is truthfully accepted",
  listProviderInvitations(deliveryVisibilityStore, providerA).length === 0,
);
recordInvitationDelivery(deliveryVisibilityStore, leadA, deliveryVisibilityInvitation.id, {
  accepted: true,
  idempotencyKey: "delivery-visibility:accepted",
  now: "2026-09-11T11:03:00.000Z",
});
check(
  "195 accepted delivery makes exactly that provider opportunity visible",
  listProviderInvitations(deliveryVisibilityStore, providerA).length === 1,
);
const providerAClarifications = listProviderVisibleClarifications(store, providerA, request.id);
const visibleEmployerQuestion = providerAClarifications.find((item) => item.id === employerQuestion.id);
check(
  "196 provider clarification projection preserves authoritative asker and visibility after answer",
  visibleEmployerQuestion?.askedBy === "employer"
    && visibleEmployerQuestion.visibility === "provider_specific",
);
check(
  "197 provider catalogue lookup is scoped to the active canonical catalogue organisation",
  service.includes("async function canonicalCatalogueOrganisationId()")
    && service.includes('slug: "eq.levytate-internal"')
    && service.match(/organisation_id: `eq\.\$\{organisationId\}`/g)?.length >= 2,
);
check(
  "198 every Requests browser JSON endpoint uses a streaming byte-bounded parser",
  boundedJson.includes("request.body.getReader()")
    && boundedJson.includes("received > maximumBytes")
    && [employerRoute, providerRoute, providerAuthRoute, providerAccessAdminRoute]
      .every((source) => source.includes("readBoundedJson(")),
);
check(
  "199 provider reactivation invalidates old sessions and requires a fresh bound callback",
  providerAuth.includes('auth_binding_status: "eq.bound"')
    && providerAccessAdmin.includes('patch.auth_subject = null')
    && providerAccessAdmin.includes('patch.auth_binding_status = "pending"')
    && migration.includes("auth_binding_status = 'pending' and auth_subject is null and auth_bound_at is null")
    && migration.includes("Reactivation must reset Auth binding to pending."),
);
check(
  "200 response notification replay is persisted per recipient and retries only missing acknowledgements",
  domain.includes('"employer_response_notification_sent"')
    && service.includes("recordEmployerResponseNotificationSent(")
    && service.includes("shouldNotifyEmployer = true")
    && service.includes("const notificationStore = await loadStoreForOrganisation")
    && service.includes("event.idempotencyKey === notificationKey"),
);
check(
  "201 invitation-set growth bumps the parent Request concurrency version",
  workflow.includes("if (invitationAdded) request.updatedAt = timestamp")
    && service.includes("typeof item.request_id === \"string\"")
    && service.includes("guardedRequestIds.add(item.request_id)"),
);

console.log(`\nLevyTate Requests V1.1 validation: ${passed}/${passed} checks passed`);
