"use client";

import { useEffect, useMemo, useState } from "react";
import {
  EmployerRequestsModule,
  type EmployerRequestAgreementSnapshot,
  type EmployerRequestBrief,
  type EmployerRequestClarification,
  type EmployerRequestInvitation,
  type EmployerRequestProgrammeOption,
  type EmployerRequestProviderOption,
  type EmployerRequestResponse,
  type EmployerRequestsModuleProps,
  type EmployerServiceRequest,
} from "@/components/levytate-mvp/EmployerRequestsModule";
import type {
  EmployerRequestAction,
  EmployerRequestsWorkspaceBootstrap,
  EmployerServiceRequestView,
} from "@/lib/levytate/requests/api";
import type {
  ProviderResponseContent,
  ServiceRequestContent,
} from "@/lib/levytate/requests/domain";

export function EmployerRequestsContainer({
  onOpenMarketplace,
  onOpenMyProviders,
  onOpenMyProgrammes,
}: Pick<EmployerRequestsModuleProps, "onOpenMarketplace" | "onOpenMyProviders" | "onOpenMyProgrammes">) {
  const [workspace, setWorkspace] = useState<EmployerRequestsWorkspaceBootstrap | null>(null);
  const [error, setError] = useState("");
  const initialContext = useMemo(() => {
    if (typeof window === "undefined") return undefined;
    const params = new URLSearchParams(window.location.search);
    const programmeId = params.get("programme") ?? undefined;
    const providerId = params.get("provider") ?? undefined;
    return programmeId || providerId ? { programmeId, providerId, mode: programmeId ? "programme_led" as const : "need_led" as const } : undefined;
  }, []);

  useEffect(() => {
    let live = true;
    void fetch("/api/levytate-requests", { credentials: "same-origin", cache: "no-store" })
      .then(async (response) => {
        const body = await response.json() as { workspace?: EmployerRequestsWorkspaceBootstrap; message?: string };
        if (!response.ok || !body.workspace) throw new Error(body.message ?? "Requests could not be loaded.");
        if (live) setWorkspace(body.workspace);
      })
      .catch((caught) => { if (live) setError(message(caught)); });
    return () => { live = false; };
  }, []);

  async function mutate(action: EmployerRequestAction) {
    const response = await fetch("/api/levytate-requests", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(action),
    });
    const body = await response.json().catch(() => null) as { workspace?: EmployerRequestsWorkspaceBootstrap; message?: string } | null;
    if (!response.ok || !body?.workspace) throw new Error(body?.message ?? "We couldn’t save this Request. Please try again.");
    setWorkspace(body.workspace);
    return body.workspace;
  }

  if (error) return <RequestLoadState title="Requests are unavailable" copy={error} />;
  if (!workspace) return <RequestLoadState title="Loading Requests" copy="Preparing this employer workspace…" />;

  const providers = providerOptions(workspace);
  const programmes = programmeOptions(workspace);
  const requests = workspace.requests.map((request) => requestView(request, workspace));
  const convert = (brief: EmployerRequestBrief, responseDeadline?: string) => contentFromBrief(brief, responseDeadline, workspace);

  return (
    <EmployerRequestsModule
      organisationName={workspace.organisation.name}
      requests={requests}
      providers={providers}
      programmes={programmes}
      initialContext={initialContext}
      onInitialContextConsumed={() => clearRequestEntryContext()}
      onOpenMarketplace={onOpenMarketplace}
      onOpenMyProviders={onOpenMyProviders}
      onOpenMyProgrammes={onOpenMyProgrammes}
      onSaveDraft={async ({ requestId, brief }) => {
        const next = await mutate(requestId
          ? { action: "update_draft", requestId, content: convert(brief), idempotencyKey: crypto.randomUUID() }
          : { action: "create_draft", content: convert(brief), idempotencyKey: crypto.randomUUID() });
        const saved = requestId ? next.requests.find((item) => item.id === requestId) : [...next.requests].sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0];
        return { requestId: saved?.id };
      }}
      onSendRequest={async ({ requestId, brief, providerIds, responseDeadline }) => {
        const content = convert(brief, responseDeadline);
        if (!requestId) {
          const next = await mutate({ action: "send_request", content, providerIds, idempotencyKey: crypto.randomUUID() });
          return { requestId: [...next.requests].sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0]?.id };
        }
        await mutate({ action: "send_existing_draft", requestId, content, providerIds, idempotencyKey: crypto.randomUUID() });
        return { requestId };
      }}
      onPublishRevision={(requestId, brief, changeSummary) => {
        const current = workspace.requests.find((request) => request.id === requestId);
        if (!current) throw new Error("The Request could not be found.");
        return mutate({ action: "publish_revision", requestId, content: convert(brief, current.content.responseDeadline), changeSummary, idempotencyKey: crypto.randomUUID() }).then(() => undefined);
      }}
      onExtendDeadline={(requestId, deadline) => mutate({ action: "extend_deadline", requestId, deadline, idempotencyKey: crypto.randomUUID() }).then(() => undefined)}
      onRetryInvitation={(requestId, invitationId) => mutate({ action: "retry_invitation", requestId, invitationId, idempotencyKey: crypto.randomUUID() }).then(() => undefined)}
      onCancelRequest={(requestId, reason) => mutate({ action: "cancel", requestId, reason, idempotencyKey: crypto.randomUUID() }).then(() => undefined)}
      onCloseRequest={(requestId) => mutate({ action: "close_request", requestId, idempotencyKey: crypto.randomUUID() }).then(() => undefined)}
      onAskClarification={(requestId, responseId, question) => {
        const response = workspace.requests.find((item) => item.id === requestId)?.responses.find((item) => item.id === responseId);
        if (!response) throw new Error("The provider response could not be found.");
        return mutate({ action: "ask_clarification", requestId, invitationId: response.invitationId, question, idempotencyKey: crypto.randomUUID() }).then(() => undefined);
      }}
      onAnswerClarification={(requestId, clarificationId, answer, shareWithAll) => mutate({ action: "answer_clarification", requestId, clarificationId, answer, shareWithAll, idempotencyKey: crypto.randomUUID() }).then(() => undefined)}
      onDecideResponse={(requestId, responseId, decision, privateDecisionNote) => mutate({ action: decision === "decline" ? "decline_provider" : decision, requestId, responseId, privateDecisionNote, idempotencyKey: crypto.randomUUID() }).then(() => undefined)}
      onConfirmAgreement={(requestId, responseId, handover) => mutate({ action: "confirm_and_handover", requestId, responseId, ...handover, idempotencyKey: crypto.randomUUID() }).then(() => undefined)}
      onRecordDidNotProceed={(requestId, responseId, privateDecisionNote) => mutate({ action: "not_proceeded", requestId, responseId, privateDecisionNote, idempotencyKey: crypto.randomUUID() }).then(() => undefined)}
    />
  );
}

function RequestLoadState({ title, copy }: { title: string; copy: string }) {
  return <section role="status" className="rounded-2xl border border-[#27456a]/[0.09] bg-white p-6"><h2 className="text-lg font-semibold text-[#27456a]">{title}</h2><p className="mt-2 text-sm leading-6 text-[#52677d]">{copy}</p></section>;
}

function providerOptions(workspace: EmployerRequestsWorkspaceBootstrap): EmployerRequestProviderOption[] {
  return workspace.providerOptions.map((item) => ({ id: item.providerId, name: item.providerName, programmeIds: item.programmeIds, deliveryModels: item.deliveryModels, regions: item.regions, isMyProvider: item.relationshipStatus === "existing", providerAccessReady: item.providerAccessReady, relevanceReasons: [...item.deliveryModels.slice(0, 1), ...item.regions.slice(0, 1)] }));
}

function programmeOptions(workspace: EmployerRequestsWorkspaceBootstrap): EmployerRequestProgrammeOption[] {
  const names = new Map(workspace.providerOptions.map((item) => [item.providerId, item.providerName]));
  return workspace.programmeOptions.map((item) => ({ id: item.programmeId, name: item.programmeName, providerId: item.providerId, providerName: names.get(item.providerId) ?? "Provider", standardName: item.apprenticeshipStandardId, level: item.level ? `Level ${item.level}` : undefined, fundingBandMaximum: item.fundingBandMaximumPence == null ? undefined : pounds(item.fundingBandMaximumPence) }));
}

function contentFromBrief(brief: EmployerRequestBrief, responseDeadline: string | undefined, workspace: EmployerRequestsWorkspaceBootstrap): ServiceRequestContent {
  const programme = brief.programmeId ? workspace.programmeOptions.find((item) => item.programmeId === brief.programmeId) : undefined;
  return {
    title: brief.title.trim(), requestMode: brief.requestMode, requirement: brief.businessOutcome.trim(), businessOutcome: brief.businessOutcome.trim(), readiness: brief.readiness,
    learnerVolume: brief.learnerVolume.kind === "exact" ? { kind: "exact", count: brief.learnerVolume.exact } : brief.learnerVolume.kind === "approximate" ? { kind: "approximate", count: brief.learnerVolume.approximate } : brief.learnerVolume,
    workplaceLocation: brief.locationMode === "locations" ? { kind: "sites", siteIds: [], labels: brief.locations } : brief.locationMode === "remote_distributed" ? { kind: "remote_or_distributed" } : { kind: "not_confirmed" },
    deliveryPreferences: brief.deliveryPreference && brief.deliveryPreference !== "Not confirmed" ? [brief.deliveryPreference] : [],
    preferredStart: preferredStart(brief.preferredStart),
    responseDeadline: responseDeadline ?? dateAfterDays(14),
    programmeId: brief.programmeId || undefined,
    programmeTitle: programme?.programmeName ?? brief.programmeName,
    apprenticeshipStandardId: programme?.apprenticeshipStandardId,
    departments: brief.departments, targetRoles: brief.targetRoles, workforceMix: brief.workforceComposition,
    workplaceProjectRequirements: brief.workplaceProjectRequirements, accessibilityConsiderations: brief.accessibilityConsiderations,
    procurementRequirements: brief.procurementRequirements, additionalNotes: brief.additionalNotes,
  };
}

function preferredStart(value: string): ServiceRequestContent["preferredStart"] {
  const clean = value.trim();
  if (!clean || /not confirmed/i.test(clean)) return { kind: "not_confirmed" };
  if (/flexible/i.test(clean)) return { kind: "flexible" };
  if (/\bq[1-4]\b/i.test(clean)) return { kind: "quarter", value: clean };
  return { kind: "month", value: clean };
}

function briefFromContent(content: ServiceRequestContent): EmployerRequestBrief {
  return {
    title: content.title, requestMode: content.requestMode, businessOutcome: content.businessOutcome ?? content.requirement,
    learnerVolume: content.learnerVolume.kind === "exact" ? { kind: "exact", exact: content.learnerVolume.count } : content.learnerVolume.kind === "approximate" ? { kind: "approximate", approximate: content.learnerVolume.count } : content.learnerVolume,
    locations: content.workplaceLocation.kind === "sites" ? content.workplaceLocation.labels : [],
    locationMode: content.workplaceLocation.kind === "sites" ? "locations" : content.workplaceLocation.kind === "remote_or_distributed" ? "remote_distributed" : "not_confirmed",
    deliveryPreference: content.deliveryPreferences.join(", ") || "Not confirmed",
    preferredStart: content.preferredStart.kind === "month" || content.preferredStart.kind === "quarter" ? content.preferredStart.value : content.preferredStart.kind === "flexible" ? "Flexible" : "Not confirmed",
    readiness: content.readiness, programmeId: content.programmeId, programmeName: content.programmeTitle,
    departments: content.departments ?? [], targetRoles: content.targetRoles ?? [], workforceComposition: content.workforceMix,
    workplaceProjectRequirements: content.workplaceProjectRequirements, accessibilityConsiderations: content.accessibilityConsiderations,
    procurementRequirements: content.procurementRequirements, additionalNotes: content.additionalNotes,
  };
}

function requestView(request: EmployerServiceRequestView, workspace: EmployerRequestsWorkspaceBootstrap): EmployerServiceRequest {
  const programmes = new Map(workspace.programmeOptions.map((item) => [item.programmeId, item.programmeName]));
  const decisions = new Map(request.decisions.map((item) => [item.responseId, item.state]));
  const responses = request.responses.map((response) => responseView(response, decisions.get(response.id)));
  const handover = request.handovers[0];
  const agreement = request.agreementSnapshots[0];
  const agreementSnapshot: EmployerRequestAgreementSnapshot | undefined = agreement ? {
    providerId: agreement.providerId,
    providerName: request.invitations.find((item) => item.providerId === agreement.providerId)?.providerName ?? "Provider",
    programmeId: agreement.proposedProgrammeId,
    programmeName: agreement.proposedProgrammeId ? programmes.get(agreement.proposedProgrammeId) ?? "Agreed programme" : "Alternative pathway to discuss",
    proposedStart: agreement.proposedStart,
    deliveryApproach: [...agreement.deliveryApproach.models, agreement.deliveryApproach.notes].filter(Boolean).join(" — "),
    workplaceRequirements: agreement.workplaceRequirements,
    employerSupport: agreement.employerReportingSupport,
    proposedPrice: agreement.proposedTrainingAssessmentPricePence == null ? "Not stated" : pounds(agreement.proposedTrainingAssessmentPricePence),
    priceBasis: agreement.priceBasisAndAssumptions ?? "Not stated",
    exceptions: agreement.exceptionsOrClarifications ?? "None stated",
    confirmedAt: agreement.confirmedAt,
    handoverCompleted: Boolean(handover),
    providerAddedToWorkspace: handover?.addProvider ?? false,
    programmeAddedToWorkspace: handover?.addProgramme ?? false,
  } : undefined;
  return {
    id: request.id, title: request.content.title, status: request.status, currentVersionNumber: request.currentVersion,
    createdAt: request.createdAt, publishedAt: request.publishedAt, responseDeadline: request.content.responseDeadline,
    brief: briefFromContent(request.content),
    versions: request.versions.map((version) => ({ id: `${version.requestId}:${version.version}`, versionNumber: version.version, publishedAt: version.publishedAt, publishedBy: "Employer workspace", changeSummary: version.changeSummary, brief: briefFromSnapshot(version.publishedSnapshot) })),
    invitations: request.invitations.map(invitationView), responses,
    clarifications: request.clarifications.map(clarificationView),
    differenceSummary: request.comparison.pointsToResolve,
    agreementSnapshot,
  };
}

function invitationView(invitation: EmployerServiceRequestView["invitations"][number]): EmployerRequestInvitation {
  const status = invitation.status === "pending_delivery" || invitation.status === "cancelled" ? "pending" : invitation.status;
  return { id: invitation.id, providerId: invitation.providerId, providerName: invitation.providerName, requestVersionNumber: invitation.requestVersion, status, sentAt: invitation.sentAt, viewedAt: invitation.viewedAt, declinedAt: invitation.declinedAt, declineReason: invitation.declineReasonCategory?.replaceAll("_", " "), notificationError: invitation.notificationStatus === "failed" };
}

function responseView(
  response: EmployerServiceRequestView["responses"][number],
  decision: EmployerServiceRequestView["decisions"][number]["state"] | undefined,
): EmployerRequestResponse {
  const content = response.submittedContent;
  return {
    id: response.id, invitationId: response.invitationId, providerId: response.providerId, providerName: response.providerName,
    requestVersionNumber: response.requestVersion, responseVersionNumber: response.currentVersion,
    status: response.currentVersion > 1 ? "revised" : "submitted", submittedAt: response.submittedAt,
    proposedProgramme: content.proposedProgramme.kind === "canonical_programme" ? content.proposedProgramme.programmeTitle ?? content.proposedProgramme.programmeId : `Alternative / pathway to discuss: ${content.proposedProgramme.description}`,
    proposedProgrammeId: content.proposedProgramme.kind === "canonical_programme" ? content.proposedProgramme.programmeId : undefined,
    whyThisFits: content.whyThisFits, earliestAvailableStart: content.earliestAvailableStart,
    deliveryApproach: [...content.deliveryApproach.models, content.deliveryApproach.notes].filter(Boolean).join(" — "),
    cohortCapacity: cohortLabel(content), workplaceRequirements: content.workplaceRequirements,
    learningCommitment: content.learningCommitment ?? "Not stated", employerSupport: content.employerReportingSupport,
    proposedPrice: content.proposedTrainingAssessmentPricePence == null ? "Not stated" : pounds(content.proposedTrainingAssessmentPricePence),
    priceBasis: content.priceBasisAndAssumptions ?? "Not stated", additionalCommercialCosts: content.additionalCommercialCosts,
    evidence: content.relevantEvidence ?? "Not stated", exceptions: content.exceptionsOrClarifications ?? "None stated",
    decisionState: decision === "pending" || !decision ? "none" : decision === "not_proceeded" ? "did_not_proceed" : decision,
  };
}

function clarificationView(item: EmployerServiceRequestView["clarifications"][number]): EmployerRequestClarification {
  return { id: item.id, invitationId: item.invitationId, providerId: item.providerId, providerName: item.providerName, question: item.question, askedBy: item.askedByType === "employer_user" ? "employer" : "provider", askedAt: item.askedAt, answer: item.answer, answeredAt: item.answeredAt, visibility: item.visibility };
}

function briefFromSnapshot(snapshot: EmployerServiceRequestView["versions"][number]["publishedSnapshot"]): EmployerRequestBrief {
  return briefFromContent({
    title: snapshot.title, requestMode: snapshot.requestMode, requirement: snapshot.requirement,
    readiness: snapshot.readiness, learnerVolume: snapshot.learnerVolume, workplaceLocation: snapshot.workplaceLocation,
    deliveryPreferences: [...snapshot.deliveryPreferences], preferredStart: snapshot.preferredStart, responseDeadline: snapshot.responseDeadline,
    programmeId: snapshot.programme?.id, programmeTitle: snapshot.programme?.title, apprenticeshipStandardId: snapshot.programme?.apprenticeshipStandardId,
    departments: snapshot.optionalInformation.departments ? [...snapshot.optionalInformation.departments] : [],
    targetRoles: snapshot.optionalInformation.targetRoles ? [...snapshot.optionalInformation.targetRoles] : [],
    workforceMix: snapshot.optionalInformation.workforceMix, businessOutcome: snapshot.optionalInformation.businessOutcome,
    workplaceProjectRequirements: snapshot.optionalInformation.workplaceProjectRequirements,
    accessibilityConsiderations: snapshot.optionalInformation.accessibilityConsiderations,
    procurementRequirements: snapshot.optionalInformation.procurementRequirements,
    additionalNotes: snapshot.optionalInformation.additionalNotes,
  });
}

function cohortLabel(content: ProviderResponseContent) {
  if (content.cohortCapacity.kind === "can_accommodate") return "Can accommodate requested cohort";
  if (content.cohortCapacity.kind === "minimum_required") return `Minimum cohort ${content.cohortCapacity.value ?? "not stated"}`;
  if (content.cohortCapacity.kind === "maximum_places") return `Maximum ${content.cohortCapacity.value ?? "not stated"} places`;
  return content.cohortCapacity.notes || "Requires discussion";
}

function pounds(pence: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(pence / 100);
}

function dateAfterDays(days: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function clearRequestEntryContext() {
  const url = new URL(window.location.href);
  url.searchParams.delete("programme");
  url.searchParams.delete("provider");
  window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
}

function message(error: unknown) {
  return error instanceof Error ? error.message : "Requests could not be loaded.";
}
