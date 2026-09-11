"use client";

import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  FileCheck2,
  Handshake,
  Info,
  ListChecks,
  MessageCircleQuestion,
  Pencil,
  Plus,
  Search,
  Send,
  Sparkles,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";

export type EmployerRequestMode = "programme_led" | "need_led";
export type EmployerRequestReadiness = "exploring" | "planning" | "approved_to_proceed";
export type EmployerRequestStatus =
  | "draft"
  | "open"
  | "responses_received"
  | "decision_in_progress"
  | "progressed_to_agreement"
  | "closed"
  | "cancelled"
  | "expired";
export type EmployerRequestInvitationStatus = "pending" | "sent" | "delivery_failed" | "viewed" | "responded" | "declined" | "deadline_passed";
export type EmployerRequestDecisionState = "none" | "shortlisted" | "declined" | "progressed_to_agreement" | "agreement_confirmed" | "did_not_proceed";
export type EmployerRequestLearnerVolume =
  | { kind: "exact"; exact: number }
  | { kind: "approximate"; approximate: number }
  | { kind: "range"; minimum: number; maximum: number }
  | { kind: "not_confirmed" };

export type EmployerRequestProgrammeOption = {
  id: string;
  name: string;
  providerId: string;
  providerName: string;
  standardName?: string;
  level?: string;
  deliveryModels?: string[];
  regions?: string[];
  fundingBandMaximum?: string;
};

export type EmployerRequestProviderOption = {
  id: string;
  name: string;
  programmeIds: string[];
  deliveryModels: string[];
  regions: string[];
  subjects?: string[];
  isMyProvider?: boolean;
  providerAccessReady?: boolean;
  relevanceReasons?: string[];
};

export type EmployerRequestBrief = {
  title: string;
  requestMode: EmployerRequestMode;
  businessOutcome: string;
  learnerVolume: EmployerRequestLearnerVolume;
  locations: string[];
  locationMode: "locations" | "remote_distributed" | "not_confirmed";
  deliveryPreference: string;
  preferredStart: string;
  readiness: EmployerRequestReadiness;
  programmeId?: string;
  programmeName?: string;
  programmeProviderName?: string;
  departments: string[];
  targetRoles: string[];
  workforceComposition?: "existing_employees" | "new_recruits" | "mixed" | "unknown";
  workplaceProjectRequirements?: string;
  accessibilityConsiderations?: string;
  procurementRequirements?: string;
  additionalNotes?: string;
};

export type EmployerRequestVersion = {
  id: string;
  versionNumber: number;
  publishedAt: string;
  publishedBy: string;
  changeSummary?: string;
  brief: EmployerRequestBrief;
};

export type EmployerRequestInvitation = {
  id: string;
  providerId: string;
  providerName: string;
  requestVersionNumber: number;
  status: EmployerRequestInvitationStatus;
  sentAt?: string;
  viewedAt?: string;
  respondedAt?: string;
  declinedAt?: string;
  declineReason?: string;
  notificationError?: boolean;
};

export type EmployerRequestResponse = {
  id: string;
  invitationId: string;
  providerId: string;
  providerName: string;
  requestVersionNumber: number;
  responseVersionNumber: number;
  status: "draft" | "submitted" | "revised";
  submittedAt?: string;
  proposedProgramme: string;
  proposedProgrammeId?: string;
  whyThisFits: string;
  earliestAvailableStart: string;
  deliveryApproach: string;
  cohortCapacity: string;
  workplaceRequirements: string;
  learningCommitment: string;
  employerSupport: string;
  proposedPrice: string;
  priceBasis: string;
  additionalCommercialCosts?: string;
  evidence: string;
  exceptions: string;
  decisionState: EmployerRequestDecisionState;
};

export type EmployerRequestClarification = {
  id: string;
  invitationId: string;
  providerId: string;
  providerName: string;
  question: string;
  askedBy?: "provider" | "employer";
  askedAt: string;
  answer?: string;
  answeredAt?: string;
  visibility: "provider_specific" | "shared_with_invited_providers";
};

export type EmployerRequestAgreementSnapshot = {
  providerId: string;
  providerName: string;
  programmeId?: string;
  programmeName: string;
  proposedStart: string;
  deliveryApproach: string;
  workplaceRequirements: string;
  employerSupport: string;
  proposedPrice: string;
  priceBasis: string;
  exceptions: string;
  confirmedAt: string;
  handoverCompleted: boolean;
  providerAddedToWorkspace: boolean;
  programmeAddedToWorkspace: boolean;
};

export type EmployerServiceRequest = {
  id: string;
  title: string;
  status: EmployerRequestStatus;
  currentVersionNumber: number;
  createdAt: string;
  publishedAt?: string;
  responseDeadline?: string;
  brief: EmployerRequestBrief;
  versions: EmployerRequestVersion[];
  invitations: EmployerRequestInvitation[];
  responses: EmployerRequestResponse[];
  clarifications: EmployerRequestClarification[];
  differenceSummary?: string[];
  agreementSnapshot?: EmployerRequestAgreementSnapshot;
};

export type EmployerRequestSendInput = {
  requestId?: string;
  brief: EmployerRequestBrief;
  approvedProviderSnapshot: EmployerRequestBrief;
  providerIds: string[];
  responseDeadline: string;
};

export type EmployerRequestDraftInput = {
  requestId?: string;
  brief: EmployerRequestBrief;
};

type MaybePromise<T = void> = T | Promise<T>;

export type EmployerRequestsModuleProps = {
  organisationName: string;
  requests: EmployerServiceRequest[];
  providers: EmployerRequestProviderOption[];
  programmes: EmployerRequestProgrammeOption[];
  initialRequestId?: string | null;
  initialContext?: { programmeId?: string; providerId?: string; mode?: EmployerRequestMode };
  onInitialContextConsumed?: () => void;
  onSaveDraft?: (input: EmployerRequestDraftInput) => MaybePromise<{ requestId?: string } | void>;
  onSendRequest: (input: EmployerRequestSendInput) => MaybePromise<{ requestId?: string } | void>;
  onImproveBrief?: (brief: EmployerRequestBrief) => MaybePromise<Partial<EmployerRequestBrief>>;
  onPublishRevision?: (requestId: string, brief: EmployerRequestBrief, changeSummary: string) => MaybePromise;
  onExtendDeadline?: (requestId: string, deadline: string) => MaybePromise;
  onRetryInvitation?: (requestId: string, invitationId: string) => MaybePromise;
  onCancelRequest?: (requestId: string, reason: string) => MaybePromise;
  onCloseRequest?: (requestId: string) => MaybePromise;
  onAskClarification?: (requestId: string, responseId: string, question: string) => MaybePromise;
  onAnswerClarification?: (requestId: string, clarificationId: string, answer: string, shareWithAll: boolean) => MaybePromise;
  onDecideResponse?: (requestId: string, responseId: string, decision: "shortlist" | "decline" | "progress_to_agreement", privateNote?: string) => MaybePromise;
  onConfirmAgreement?: (requestId: string, responseId: string, handover: { addProvider: boolean; addProgramme: boolean }) => MaybePromise;
  onRecordDidNotProceed?: (requestId: string, responseId: string, privateNote?: string) => MaybePromise;
  onOpenMarketplace?: () => void;
  onOpenMyProviders?: () => void;
  onOpenMyProgrammes?: () => void;
};

type RequestsView = "dashboard" | "create" | "detail";
type DashboardTab = "Open" | "Decision" | "Closed";
type CreationStep = 1 | 2 | 3;

type RequestFormState = {
  title: string;
  requestMode: EmployerRequestMode;
  programmeId: string;
  businessOutcome: string;
  learnerVolumeKind: EmployerRequestLearnerVolume["kind"];
  learnerExact: string;
  learnerMinimum: string;
  learnerMaximum: string;
  locationMode: EmployerRequestBrief["locationMode"];
  locations: string;
  deliveryPreference: string;
  preferredStart: string;
  readiness: EmployerRequestReadiness;
  departments: string;
  targetRoles: string;
  workforceComposition: NonNullable<EmployerRequestBrief["workforceComposition"]>;
  workplaceProjectRequirements: string;
  accessibilityConsiderations: string;
  procurementRequirements: string;
  additionalNotes: string;
};

const statusLabels: Record<EmployerRequestStatus, string> = {
  draft: "Draft",
  open: "Open",
  responses_received: "Responses received",
  decision_in_progress: "Decision in progress",
  progressed_to_agreement: "Progressed to agreement",
  closed: "Closed",
  cancelled: "Cancelled",
  expired: "Deadline passed",
};

const invitationLabels: Record<EmployerRequestInvitationStatus, string> = {
  pending: "Preparing",
  sent: "Sent",
  delivery_failed: "Delivery needs attention",
  viewed: "Viewed",
  responded: "Responded",
  declined: "Declined",
  deadline_passed: "Deadline passed",
};

const readinessLabels: Record<EmployerRequestReadiness, string> = {
  exploring: "Exploring options",
  planning: "Planning a cohort",
  approved_to_proceed: "Approved to proceed",
};

const closedStatuses = new Set<EmployerRequestStatus>(["closed", "cancelled", "expired"]);
const decisionStatuses = new Set<EmployerRequestStatus>(["decision_in_progress", "progressed_to_agreement"]);
const decisionLabels: Record<EmployerRequestDecisionState, string> = {
  none: "No decision recorded",
  shortlisted: "Shortlisted",
  declined: "Not progressing",
  progressed_to_agreement: "Progressing to agreement",
  agreement_confirmed: "Agreement confirmed",
  did_not_proceed: "Did not proceed",
};

function initialForm(context: EmployerRequestsModuleProps["initialContext"]): RequestFormState {
  return {
    title: "",
    requestMode: context?.mode ?? (context?.programmeId ? "programme_led" : "need_led"),
    programmeId: context?.programmeId ?? "",
    businessOutcome: "",
    learnerVolumeKind: "not_confirmed",
    learnerExact: "",
    learnerMinimum: "",
    learnerMaximum: "",
    locationMode: "not_confirmed",
    locations: "",
    deliveryPreference: "Flexible",
    preferredStart: "Not confirmed",
    readiness: "planning",
    departments: "",
    targetRoles: "",
    workforceComposition: "unknown",
    workplaceProjectRequirements: "",
    accessibilityConsiderations: "",
    procurementRequirements: "",
    additionalNotes: "",
  };
}

function initialProviderIds(
  context: EmployerRequestsModuleProps["initialContext"],
  providers: EmployerRequestProviderOption[],
) {
  if (!context?.providerId) return [];
  const provider = providers.find((item) => item.id === context.providerId);
  return provider?.providerAccessReady === false ? [] : [context.providerId];
}

export function EmployerRequestsModule({
  organisationName,
  requests,
  providers,
  programmes,
  initialRequestId = null,
  initialContext,
  onInitialContextConsumed,
  onSaveDraft,
  onSendRequest,
  onImproveBrief,
  onPublishRevision,
  onExtendDeadline,
  onRetryInvitation,
  onCancelRequest,
  onCloseRequest,
  onAskClarification,
  onAnswerClarification,
  onDecideResponse,
  onConfirmAgreement,
  onRecordDidNotProceed,
  onOpenMarketplace,
  onOpenMyProviders,
  onOpenMyProgrammes,
}: EmployerRequestsModuleProps) {
  const [view, setView] = useState<RequestsView>(initialRequestId ? "detail" : "dashboard");
  const [tab, setTab] = useState<DashboardTab>("Open");
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(initialRequestId);
  const [creationStep, setCreationStep] = useState<CreationStep>(1);
  const [editingDraftId, setEditingDraftId] = useState<string | null>(null);
  const [form, setForm] = useState<RequestFormState>(() => initialForm(initialContext));
  const [approved, setApproved] = useState(false);
  const [providerIds, setProviderIds] = useState<string[]>(() => initialProviderIds(initialContext, providers));
  const [providerSearch, setProviderSearch] = useState("");
  const [responseDeadline, setResponseDeadline] = useState(() => dateAfterDays(14));
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const pendingInitialContext = useRef(initialContext);

  const selectedRequest = selectedRequestId ? requests.find((request) => request.id === selectedRequestId) ?? null : null;
  const brief = useMemo(() => briefFromForm(form, programmes), [form, programmes]);

  function startRequest() {
    const context = pendingInitialContext.current;
    pendingInitialContext.current = undefined;
    if (context) onInitialContextConsumed?.();
    setEditingDraftId(null);
    setForm(initialForm(context));
    setProviderIds(initialProviderIds(context, providers));
    setResponseDeadline(dateAfterDays(14));
    setCreationStep(1);
    setApproved(false);
    setError("");
    setNotice("");
    setView("create");
  }

  function editDraft(request: EmployerServiceRequest) {
    setEditingDraftId(request.id);
    setForm(formFromBrief(request.brief, initialForm({ mode: request.brief.requestMode, programmeId: request.brief.programmeId })));
    setProviderIds(request.invitations.map((invitation) => invitation.providerId).slice(0, 5));
    setResponseDeadline(request.responseDeadline?.slice(0, 10) ?? dateAfterDays(14));
    setCreationStep(1);
    setApproved(false);
    setError("");
    setNotice("");
    setView("create");
  }

  function openRequest(id: string) {
    setSelectedRequestId(id);
    setError("");
    setNotice("");
    setView("detail");
  }

  function showDashboard() {
    setEditingDraftId(null);
    setSelectedRequestId(null);
    setError("");
    setView("dashboard");
  }

  async function run(label: string, action: () => MaybePromise<unknown>, success: string) {
    setBusy(label);
    setError("");
    setNotice("");
    try {
      await action();
      setNotice(success);
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The request could not be completed. Try again.");
      return false;
    } finally {
      setBusy("");
    }
  }

  async function saveDraft() {
    if (!onSaveDraft) return;
    const valid = validateStepOne(form);
    if (valid) {
      setError(valid);
      return;
    }
    const result: { current?: { requestId?: string } } = {};
    const succeeded = await run("save-draft", async () => {
      const response = await onSaveDraft({ requestId: editingDraftId ?? undefined, brief });
      if (response) result.current = response;
    }, "Draft saved.");
    if (succeeded && result.current?.requestId) setEditingDraftId(result.current.requestId);
  }

  async function sendRequest() {
    if (!approved) {
      setError("Approve the provider-facing brief before sending.");
      setCreationStep(2);
      return;
    }
    if (!providerIds.length) {
      setError("Choose at least one provider.");
      return;
    }
    if (providerIds.length > 5) {
      setError("A Request can be sent to no more than five providers.");
      return;
    }
    if (!responseDeadline) {
      setError("Choose a response deadline.");
      return;
    }
    if (!isFutureDate(responseDeadline)) {
      setError("Choose a response deadline after today.");
      return;
    }
    if (providerIds.some((providerId) => providers.find((provider) => provider.id === providerId)?.providerAccessReady === false)) {
      setError("Remove providers whose secure Opportunities access still needs to be configured.");
      return;
    }
    const result: { current?: { requestId?: string } } = {};
    const succeeded = await run("send", async () => {
      const response = await onSendRequest({ requestId: editingDraftId ?? undefined, brief, approvedProviderSnapshot: brief, providerIds, responseDeadline });
      if (response) result.current = response;
    }, "Request sent to the selected providers.");
    if (!succeeded) return;
    if (result.current?.requestId) openRequest(result.current.requestId);
    else showDashboard();
  }

  if (view === "create") {
    return (
      <RequestCreation
        organisationName={organisationName}
        editingDraft={Boolean(editingDraftId)}
        step={creationStep}
        form={form}
        brief={brief}
        programmes={programmes}
        providers={providers}
        providerIds={providerIds}
        providerSearch={providerSearch}
        responseDeadline={responseDeadline}
        approved={approved}
        busy={busy}
        error={error}
        onBack={showDashboard}
        onFormChange={(patch) => { setForm((current) => ({ ...current, ...patch })); setApproved(false); setError(""); }}
        onStep={(next) => {
          if (next > 1) {
            const validation = validateStepOne(form);
            if (validation) { setError(validation); return; }
          }
          setError("");
          setCreationStep(next);
        }}
        onApprove={setApproved}
        onProviderSearch={setProviderSearch}
        onToggleProvider={(providerId) => {
          setError("");
          if (providers.find((provider) => provider.id === providerId)?.providerAccessReady === false) {
            setError("This provider needs secure Opportunities access before it can receive a Request.");
            return;
          }
          setProviderIds((current) => current.includes(providerId) ? current.filter((id) => id !== providerId) : current.length < 5 ? [...current, providerId] : current);
          if (!providerIds.includes(providerId) && providerIds.length >= 5) setError("You can invite up to five providers in V1.1.");
        }}
        onDeadline={setResponseDeadline}
        onSaveDraft={onSaveDraft ? () => void saveDraft() : undefined}
        onImproveBrief={onImproveBrief ? async () => {
          await run("improve-brief", async () => {
            const improved = await onImproveBrief(brief);
            setForm((current) => formFromBrief({ ...brief, ...improved }, current));
            setApproved(false);
          }, "Draft structure updated. Review every detail before approval.");
        } : undefined}
        onSend={() => void sendRequest()}
      />
    );
  }

  if (view === "detail" && selectedRequest) {
    return (
      <EmployerRequestDetail
        request={selectedRequest}
        programmes={programmes}
        busy={busy}
        notice={notice}
        error={error}
        onBack={showDashboard}
        onExtendDeadline={onExtendDeadline ? (deadline) => run("extend-deadline", () => onExtendDeadline(selectedRequest.id, deadline), "Response deadline updated.") : undefined}
        onPublishRevision={onPublishRevision ? (revisedBrief, changeSummary) => run("publish-revision", () => onPublishRevision(selectedRequest.id, revisedBrief, changeSummary), `Request Version ${selectedRequest.currentVersionNumber + 1} published.`) : undefined}
        onRetryInvitation={onRetryInvitation ? (invitationId) => run(`retry-${invitationId}`, () => onRetryInvitation(selectedRequest.id, invitationId), "Provider notification retry started.") : undefined}
        onCancelRequest={onCancelRequest ? (reason) => run("cancel", () => onCancelRequest(selectedRequest.id, reason), "Request cancelled. Its history remains available.") : undefined}
        onCloseRequest={onCloseRequest ? () => run("close-request", () => onCloseRequest(selectedRequest.id), "Decision closed. Request history remains available.") : undefined}
        onAskClarification={onAskClarification ? (responseId, question) => run(`ask-${responseId}`, () => onAskClarification(selectedRequest.id, responseId, question), "Clarification sent to the provider.") : undefined}
        onAnswerClarification={onAnswerClarification ? (clarificationId, answer, shareWithAll) => run(`answer-${clarificationId}`, () => onAnswerClarification(selectedRequest.id, clarificationId, answer, shareWithAll), shareWithAll ? "Answer shared with all invited providers without identifying the question author." : "Answer sent to the provider.") : undefined}
        onDecideResponse={onDecideResponse ? (responseId, decision, note) => run(`decide-${responseId}`, () => onDecideResponse(selectedRequest.id, responseId, decision, note), decision === "shortlist" ? "Provider shortlisted." : decision === "decline" ? "Decision recorded privately." : "Provider progressed to agreement discussions.") : undefined}
        onConfirmAgreement={onConfirmAgreement ? (responseId, handover) => run(`agreement-${responseId}`, () => onConfirmAgreement(selectedRequest.id, responseId, handover), "Agreement confirmation and selected workspace handover recorded.") : undefined}
        onRecordDidNotProceed={onRecordDidNotProceed ? (responseId, note) => run(`not-proceeded-${responseId}`, () => onRecordDidNotProceed(selectedRequest.id, responseId, note), "Outcome recorded as did not proceed.") : undefined}
        onOpenMyProviders={onOpenMyProviders}
        onOpenMyProgrammes={onOpenMyProgrammes}
      />
    );
  }

  return (
    <RequestsDashboard
      requests={requests}
      tab={tab}
      onTab={setTab}
      onCreate={startRequest}
      onOpen={(id) => {
        const request = requests.find((item) => item.id === id);
        if (request?.status === "draft") editDraft(request);
        else openRequest(id);
      }}
      onOpenMarketplace={onOpenMarketplace}
      notice={notice}
      error={error}
    />
  );
}

function RequestsDashboard({ requests, tab, onTab, onCreate, onOpen, onOpenMarketplace, notice, error }: {
  requests: EmployerServiceRequest[];
  tab: DashboardTab;
  onTab: (tab: DashboardTab) => void;
  onCreate: () => void;
  onOpen: (id: string) => void;
  onOpenMarketplace?: () => void;
  notice: string;
  error: string;
}) {
  const tabs: DashboardTab[] = ["Open", "Decision", "Closed"];
  const visible = requests.filter((request) => tab === "Closed" ? closedStatuses.has(request.status) : tab === "Decision" ? decisionStatuses.has(request.status) : !closedStatuses.has(request.status) && !decisionStatuses.has(request.status));
  const submittedResponses = requests.reduce((total, request) => total + request.responses.filter((response) => response.status !== "draft").length, 0);
  const metrics = [
    { label: "Open Requests", value: requests.filter((request) => !closedStatuses.has(request.status)).length },
    { label: "Responses received", value: submittedResponses },
    { label: "In decision", value: requests.filter((request) => decisionStatuses.has(request.status)).length },
    { label: "Progressed", value: requests.filter((request) => request.status === "progressed_to_agreement" || request.agreementSnapshot).length },
  ];

  return (
    <div className="min-w-0 space-y-5 text-[#27456a]" data-testid="employer-requests-module">
      <header className="flex flex-col gap-4 border-b border-[#27456a]/[0.10] pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#b94f64]">Employer controlled</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-[-0.04em]">Requests</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#52677d]">One brief. Comparable proposals. Your organisation controls the selection.</p>
        </div>
        <button type="button" onClick={onCreate} className={primaryButton}><Plus size={16} aria-hidden="true" />Request proposals</button>
      </header>

      <Feedback notice={notice} error={error} />

      <section aria-label="Request activity" className="grid overflow-hidden rounded-2xl border border-[#27456a]/[0.09] bg-white sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => <div key={metric.label} className="border-b border-r border-[#27456a]/[0.07] p-4 last:border-r-0 sm:p-5 xl:border-b-0"><p className="text-2xl font-semibold tabular-nums">{metric.value}</p><p className="mt-1 text-xs font-semibold text-[#607487]">{metric.label}</p></div>)}
      </section>

      <section className="min-w-0 rounded-2xl border border-[#27456a]/[0.09] bg-white p-4 shadow-[0_14px_34px_rgba(39,69,106,0.045)] sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#27456a]/[0.08] pb-4">
          <div role="tablist" aria-label="Request status" className="inline-flex rounded-xl bg-[#e6eee9] p-1">
            {tabs.map((item, index) => <button key={item} id={requestTabId(item)} type="button" role="tab" aria-selected={tab === item} aria-controls={requestPanelId(item)} tabIndex={tab === item ? 0 : -1} onClick={() => onTab(item)} onKeyDown={(event) => moveRequestTabFocus(event, tabs, index, onTab)} className={`min-h-11 rounded-lg px-4 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#17786e] ${tab === item ? "bg-white text-[#27456a] shadow-[0_5px_14px_rgba(39,69,106,0.08)]" : "text-[#607487] hover:text-[#27456a]"}`}>{item}</button>)}
          </div>
          <p aria-live="polite" className="text-xs font-semibold text-[#607487]">{visible.length} request{visible.length === 1 ? "" : "s"}</p>
        </div>

        <div id={requestPanelId(tab)} role="tabpanel" aria-labelledby={requestTabId(tab)} tabIndex={0} className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#17786e]">
          {visible.length ? <div className="mt-4 grid gap-3">{visible.map((request) => <RequestRow key={request.id} request={request} onOpen={() => onOpen(request.id)} />)}</div> : (
            <div className="grid min-h-64 place-items-center px-4 py-10 text-center">
              <div className="max-w-md">
                <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-[#e6eee9] text-[#17786e]"><FileCheck2 size={22} aria-hidden="true" /></div>
                <h2 className="mt-4 text-xl font-semibold">{requests.length ? `No ${tab.toLowerCase()} requests` : "No requests yet"}</h2>
                <p className="mt-2 text-sm leading-6 text-[#52677d]">Use the Marketplace to ask selected providers to respond to a real apprenticeship requirement.</p>
                <div className="mt-5 flex flex-col justify-center gap-2 sm:flex-row">
                  <button type="button" onClick={onCreate} className={primaryButton}><Plus size={16} aria-hidden="true" />Request proposals</button>
                  {onOpenMarketplace ? <button type="button" onClick={onOpenMarketplace} className={secondaryButton}>Explore Marketplace</button> : null}
                </div>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function RequestRow({ request, onOpen }: { request: EmployerServiceRequest; onOpen: () => void }) {
  const responded = request.invitations.filter((invitation) => invitation.status === "responded").length;
  return (
    <article className="grid min-w-0 gap-4 rounded-xl border border-[#27456a]/[0.08] bg-[#fbfcfb] p-4 transition-colors hover:border-[#17786e]/30 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2"><Status label={statusLabels[request.status]} tone={statusTone(request.status)} /><span className="text-xs font-semibold text-[#607487]">Version {request.currentVersionNumber}</span></div>
        <h2 className="mt-2 truncate text-lg font-semibold">{request.title}</h2>
        <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-[#52677d]">
          <InlineFact icon={CalendarDays} label="Published" value={request.publishedAt ? displayDate(request.publishedAt) : "Not published"} />
          <InlineFact icon={Building2} label="Providers" value={String(request.invitations.length)} />
          <InlineFact icon={ListChecks} label="Responses" value={`${responded} of ${request.invitations.length}`} />
          <InlineFact icon={Clock3} label="Deadline" value={request.responseDeadline ? displayDate(request.responseDeadline) : "Not set"} />
        </dl>
      </div>
      <button type="button" onClick={onOpen} className={`${secondaryButton} justify-center`}>Review <ChevronRight size={15} aria-hidden="true" /></button>
    </article>
  );
}

function RequestCreation({ organisationName, editingDraft, step, form, brief, programmes, providers, providerIds, providerSearch, responseDeadline, approved, busy, error, onBack, onFormChange, onStep, onApprove, onProviderSearch, onToggleProvider, onDeadline, onSaveDraft, onImproveBrief, onSend }: {
  organisationName: string;
  editingDraft: boolean;
  step: CreationStep;
  form: RequestFormState;
  brief: EmployerRequestBrief;
  programmes: EmployerRequestProgrammeOption[];
  providers: EmployerRequestProviderOption[];
  providerIds: string[];
  providerSearch: string;
  responseDeadline: string;
  approved: boolean;
  busy: string;
  error: string;
  onBack: () => void;
  onFormChange: (patch: Partial<RequestFormState>) => void;
  onStep: (step: CreationStep) => void;
  onApprove: (approved: boolean) => void;
  onProviderSearch: (value: string) => void;
  onToggleProvider: (id: string) => void;
  onDeadline: (value: string) => void;
  onSaveDraft?: () => void;
  onImproveBrief?: () => void;
  onSend: () => void;
}) {
  return (
    <div className="mx-auto min-w-0 max-w-6xl space-y-5 text-[#27456a]" data-testid="request-creation-flow">
      <button type="button" onClick={onBack} className={backButton}><ArrowLeft size={16} aria-hidden="true" />Back to Requests</button>
      <header className="rounded-2xl border border-[#27456a]/[0.08] bg-[#fbf6f1] p-5 sm:p-6">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#b94f64]">{editingDraft ? "Draft Request" : "Request proposals"}</p>
        <h2 className="mt-2 text-3xl font-semibold tracking-[-0.04em]">{editingDraft ? "Complete your provider brief" : "Create one clear provider brief"}</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#52677d]">Describe one requirement, approve exactly what providers will see, then choose the recipients.</p>
        <ol className="mt-6 grid gap-2 sm:grid-cols-3" aria-label="Request creation progress">
          {["What do you need?", "Review your brief", "Choose providers and send"].map((label, index) => {
            const number = (index + 1) as CreationStep;
            return <li key={label} aria-current={step === number ? "step" : undefined} className={`flex min-h-12 items-center gap-3 rounded-xl px-3 text-sm font-semibold ${step === number ? "bg-white text-[#27456a] ring-1 ring-[#17786e]/25" : number < step ? "bg-[#e6eee9] text-[#176d65]" : "text-[#607487]"}`}><span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs ${number < step ? "bg-[#17786e] text-white" : "bg-[#edf1ef]"}`}>{number < step ? <Check size={14} aria-hidden="true" /> : number}</span>{label}</li>;
          })}
        </ol>
      </header>

      <Feedback error={error} />

      {step === 1 ? <RequirementForm form={form} programmes={programmes} busy={busy} onChange={onFormChange} onSaveDraft={onSaveDraft} onImproveBrief={onImproveBrief} onContinue={() => onStep(2)} /> : null}
      {step === 2 ? <BriefReview organisationName={organisationName} brief={brief} approved={approved} busy={busy} onApprove={onApprove} onEdit={() => onStep(1)} onBack={() => onStep(1)} onContinue={() => onStep(3)} /> : null}
      {step === 3 ? <ProviderSelection brief={brief} providers={providers} providerIds={providerIds} providerSearch={providerSearch} responseDeadline={responseDeadline} busy={busy} onSearch={onProviderSearch} onToggle={onToggleProvider} onDeadline={onDeadline} onBack={() => onStep(2)} onSend={onSend} /> : null}
    </div>
  );
}

function RequirementForm({ form, programmes, busy, onChange, onSaveDraft, onImproveBrief, onContinue }: {
  form: RequestFormState;
  programmes: EmployerRequestProgrammeOption[];
  busy: string;
  onChange: (patch: Partial<RequestFormState>) => void;
  onSaveDraft?: () => void;
  onImproveBrief?: () => void;
  onContinue: () => void;
}) {
  return (
    <form onSubmit={(event) => { event.preventDefault(); onContinue(); }} className="space-y-5">
      <Panel title="What do you need?" copy="Keep this to one business requirement or proposed cohort.">
        <fieldset>
          <legend className={labelClass}>How would you like to start?</legend>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            <ChoiceCard checked={form.requestMode === "programme_led"} title="I know the programme" copy="Start from a Marketplace or My Programme record." onClick={() => onChange({ requestMode: "programme_led" })} />
            <ChoiceCard checked={form.requestMode === "need_led"} title="Help me specify the requirement" copy="Describe the outcome and let providers propose a pathway." onClick={() => onChange({ requestMode: "need_led", programmeId: "" })} />
          </div>
        </fieldset>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {form.requestMode === "programme_led" ? <SelectField label="Programme" required value={form.programmeId} onChange={(programmeId) => onChange({ programmeId })} options={[{ value: "", label: "Select a programme" }, ...programmes.map((programme) => ({ value: programme.id, label: `${programme.name} — ${programme.providerName}` }))]} /> : null}
          <TextField label="Request title" required value={form.title} onChange={(title) => onChange({ title })} placeholder="Data and automation development" wide={form.requestMode !== "programme_led"} />
          <TextArea label="Requirement / outcome" required value={form.businessOutcome} onChange={(businessOutcome) => onChange({ businessOutcome })} placeholder="What should this programme help the organisation achieve?" wide />
        </div>
      </Panel>

      <Panel title="Cohort and delivery" copy="Use ‘Not confirmed’ rather than inventing detail.">
        <div className="grid gap-4 md:grid-cols-2">
          <SelectField label="Approximate learners" value={form.learnerVolumeKind} onChange={(learnerVolumeKind) => onChange({ learnerVolumeKind: learnerVolumeKind as RequestFormState["learnerVolumeKind"] })} options={[
            { value: "not_confirmed", label: "Not confirmed" }, { value: "exact", label: "Exact number" }, { value: "approximate", label: "Approximate number" }, { value: "range", label: "Range" },
          ]} />
          {form.learnerVolumeKind === "exact" || form.learnerVolumeKind === "approximate" ? <TextField label={form.learnerVolumeKind === "exact" ? "Number of learners" : "Approximate number"} type="number" min="1" value={form.learnerExact} onChange={(learnerExact) => onChange({ learnerExact })} /> : null}
          {form.learnerVolumeKind === "range" ? <><TextField label="Minimum learners" type="number" min="1" value={form.learnerMinimum} onChange={(learnerMinimum) => onChange({ learnerMinimum })} /><TextField label="Maximum learners" type="number" min="1" value={form.learnerMaximum} onChange={(learnerMaximum) => onChange({ learnerMaximum })} /></> : null}
          <SelectField label="Workplace location" value={form.locationMode} onChange={(locationMode) => onChange({ locationMode: locationMode as RequestFormState["locationMode"] })} options={[{ value: "not_confirmed", label: "Not confirmed" }, { value: "locations", label: "One or more locations" }, { value: "remote_distributed", label: "Remote / distributed workforce" }]} />
          {form.locationMode === "locations" ? <TextField label="Locations" value={form.locations} onChange={(locations) => onChange({ locations })} placeholder="London, Manchester" /> : null}
          <SelectField label="Delivery preference" value={form.deliveryPreference} onChange={(deliveryPreference) => onChange({ deliveryPreference })} options={["Online", "Blended", "Face-to-face", "Flexible", "Not confirmed"]} />
          <TextField label="Preferred start" value={form.preferredStart} onChange={(preferredStart) => onChange({ preferredStart })} placeholder="January 2027, Q1 2027 or flexible" />
          <SelectField label="Readiness" value={form.readiness} onChange={(readiness) => onChange({ readiness: readiness as EmployerRequestReadiness })} options={Object.entries(readinessLabels).map(([value, label]) => ({ value, label }))} />
        </div>
      </Panel>

      <details className="rounded-2xl border border-[#27456a]/[0.09] bg-white p-5">
        <summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#17786e]">Add useful detail <span className="ml-2 text-xs font-normal text-[#607487]">Optional</span></summary>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <TextField label="Departments / functions" value={form.departments} onChange={(departments) => onChange({ departments })} placeholder="Finance, Operations" />
          <TextField label="Target roles" value={form.targetRoles} onChange={(targetRoles) => onChange({ targetRoles })} placeholder="Analysts, team leaders" />
          <SelectField label="Who is the cohort for?" value={form.workforceComposition} onChange={(workforceComposition) => onChange({ workforceComposition: workforceComposition as RequestFormState["workforceComposition"] })} options={[{ value: "unknown", label: "Not confirmed" }, { value: "existing_employees", label: "Existing employees" }, { value: "new_recruits", label: "New recruits" }, { value: "mixed", label: "A mixed cohort" }]} />
          <TextArea label="Workplace project requirements" value={form.workplaceProjectRequirements} onChange={(workplaceProjectRequirements) => onChange({ workplaceProjectRequirements })} />
          <TextArea label="Accessibility / delivery considerations" value={form.accessibilityConsiderations} onChange={(accessibilityConsiderations) => onChange({ accessibilityConsiderations })} />
          <TextArea label="Procurement requirements" value={form.procurementRequirements} onChange={(procurementRequirements) => onChange({ procurementRequirements })} />
          <TextArea label="Additional notes" value={form.additionalNotes} onChange={(additionalNotes) => onChange({ additionalNotes })} wide />
        </div>
      </details>

      <div className="flex flex-col-reverse gap-3 border-t border-[#27456a]/[0.09] pt-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {onSaveDraft ? <button type="button" disabled={Boolean(busy)} onClick={onSaveDraft} className={secondaryButton}>Save draft</button> : null}
          {onImproveBrief ? <button type="button" disabled={Boolean(busy)} onClick={onImproveBrief} className={secondaryButton}><Sparkles size={15} aria-hidden="true" />{busy === "improve-brief" ? "Structuring…" : "Improve brief"}</button> : null}
        </div>
        <button type="submit" disabled={Boolean(busy)} className={primaryButton}>Review brief <ArrowRight size={16} aria-hidden="true" /></button>
      </div>
    </form>
  );
}

function BriefReview({ organisationName, brief, approved, busy, onApprove, onEdit, onBack, onContinue }: {
  organisationName: string;
  brief: EmployerRequestBrief;
  approved: boolean;
  busy: string;
  onApprove: (approved: boolean) => void;
  onEdit: () => void;
  onBack: () => void;
  onContinue: () => void;
}) {
  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-2xl border border-[#27456a]/[0.09] bg-white shadow-[0_14px_34px_rgba(39,69,106,0.045)]" aria-labelledby="approved-brief-title">
        <header className="flex flex-col gap-3 border-b border-[#27456a]/[0.08] bg-[#e6eee9] p-5 sm:flex-row sm:items-start sm:justify-between sm:p-6">
          <div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#17786e]">Provider-facing brief · Draft version 1</p><h2 id="approved-brief-title" className="mt-2 text-2xl font-semibold tracking-[-0.03em]">{brief.title}</h2><p className="mt-1 text-xs font-semibold text-[#607487]">From {organisationName}</p></div>
          <button type="button" onClick={onEdit} className={secondaryButton}><Pencil size={15} aria-hidden="true" />Edit brief</button>
        </header>
        <div className="grid min-w-0 gap-5 p-5 sm:p-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(240px,.75fr)]">
          <div className="min-w-0 space-y-5">
            <BriefFacts brief={brief} />
            <div><h3 className={sectionTitle}>Business objective</h3><p className="mt-2 whitespace-pre-wrap break-words text-sm leading-7 text-[#52677d]">{brief.businessOutcome}</p></div>
            <OptionalBriefFields brief={brief} />
          </div>
          <aside className="rounded-xl bg-[#f2f7f4] p-4"><h3 className={sectionTitle}>Providers should address</h3><ul className="mt-3 space-y-2 text-sm leading-6 text-[#52677d]">{["Suitable programme or pathway", "Workplace requirements", "Delivery commitment", "Start availability", "Provider proposed price and assumptions"].map((item) => <li key={item} className="flex gap-2"><Check size={15} className="mt-1 shrink-0 text-[#17786e]" aria-hidden="true" />{item}</li>)}</ul></aside>
        </div>
      </section>

      <label className="flex min-h-14 cursor-pointer items-start gap-3 rounded-xl border border-[#17786e]/25 bg-[#edf7f3] p-4 text-sm leading-6 text-[#27456a]"><input type="checkbox" checked={approved} onChange={(event) => onApprove(event.target.checked)} className="mt-1 h-5 w-5 accent-[#17786e]" /><span><strong className="block">I approve this brief for providers</strong><span className="text-[#52677d]">This snapshot will be frozen as Version 1 when sent. Material later changes must create a new version.</span></span></label>
      <p className="flex gap-2 rounded-xl bg-[#fbf6f1] p-4 text-xs leading-5 text-[#52677d]"><Info size={16} className="mt-0.5 shrink-0 text-[#b94f64]" aria-hidden="true" />LevyTate supports provider discovery and comparison. Your organisation remains responsible for its own procurement, contracting, funding and approval requirements.</p>
      <div className="flex flex-col-reverse gap-3 border-t border-[#27456a]/[0.09] pt-4 sm:flex-row sm:justify-between"><button type="button" onClick={onBack} className={secondaryButton}><ArrowLeft size={15} aria-hidden="true" />Back</button><button type="button" disabled={!approved || Boolean(busy)} onClick={onContinue} className={primaryButton}>Choose providers <ArrowRight size={16} aria-hidden="true" /></button></div>
    </div>
  );
}

function ProviderSelection({ brief, providers, providerIds, providerSearch, responseDeadline, busy, onSearch, onToggle, onDeadline, onBack, onSend }: {
  brief: EmployerRequestBrief;
  providers: EmployerRequestProviderOption[];
  providerIds: string[];
  providerSearch: string;
  responseDeadline: string;
  busy: string;
  onSearch: (value: string) => void;
  onToggle: (id: string) => void;
  onDeadline: (value: string) => void;
  onBack: () => void;
  onSend: () => void;
}) {
  const term = providerSearch.trim().toLowerCase();
  const filtered = providers.filter((provider) => !term || [provider.name, ...provider.deliveryModels, ...provider.regions, ...(provider.subjects ?? [])].join(" ").toLowerCase().includes(term)).sort((left, right) => left.name.localeCompare(right.name));
  return (
    <div className="space-y-5">
      <Panel title="Choose providers" copy="Three providers is often useful for comparison. You remain in control, with a V1.1 maximum of five.">
        <label className="relative block"><span className="sr-only">Search providers</span><Search size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#607487]" aria-hidden="true" /><input value={providerSearch} onChange={(event) => onSearch(event.target.value)} placeholder="Search provider, delivery or region" className={`${inputClass} pl-10`} /></label>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2"><p aria-live="polite" className="text-sm font-semibold">{providerIds.length} of 5 selected</p><p className="text-xs text-[#607487]">Alphabetical order · no paid placement or ranking</p></div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{filtered.map((provider) => {
          const selected = providerIds.includes(provider.id);
          const accessReady = provider.providerAccessReady !== false;
          const reasons = providerReasons(provider, brief);
          return <button key={provider.id} type="button" aria-pressed={selected} disabled={!accessReady && !selected} onClick={() => onToggle(provider.id)} className={`min-h-36 rounded-xl border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#17786e] disabled:cursor-not-allowed ${selected ? "border-[#17786e] bg-[#edf7f3]" : accessReady ? "border-[#27456a]/[0.10] bg-white hover:border-[#17786e]/40" : "border-[#b94f64]/20 bg-[#fff8f8]"}`}><span className="flex items-start justify-between gap-3"><span className="min-w-0"><span className="block break-words text-base font-semibold">{provider.name}</span>{provider.isMyProvider ? <span className="mt-1 block text-xs font-semibold text-[#176d65]">In My Providers</span> : <span className="mt-1 block text-xs text-[#607487]">Marketplace provider</span>}</span><span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border ${selected ? "border-[#17786e] bg-[#17786e] text-white" : "border-[#8492a1] text-transparent"}`}><Check size={14} aria-hidden="true" /></span></span>{accessReady ? <><span className="mt-4 block text-[10px] font-bold uppercase tracking-[0.12em] text-[#607487]">Factual relevance</span><span className="mt-1 block text-xs leading-5 text-[#52677d]">{reasons.join(" · ") || "Review the provider’s factual Marketplace profile"}</span></> : <span className="mt-4 block text-xs font-semibold leading-5 text-[#a7354a]">Secure Opportunities access needs Platform Admin setup before this provider can receive a Request.</span>}</button>;
        })}</div>
        {!filtered.length ? <p className="mt-5 rounded-xl bg-[#f8fbfa] p-5 text-center text-sm text-[#52677d]">No providers match this search.</p> : null}
      </Panel>

      <Panel title="Response deadline" copy="Providers receive the same deadline. You can extend it later without deleting drafts.">
        <div className="flex flex-wrap gap-2">{[{ label: "7 days", days: 7 }, { label: "14 days", days: 14 }, { label: "21 days", days: 21 }].map((preset) => <button key={preset.days} type="button" onClick={() => onDeadline(dateAfterDays(preset.days))} className={secondaryButton}>{preset.label}</button>)}</div>
        <TextField label="Custom deadline" type="date" min={dateAfterDays(1)} value={responseDeadline} onChange={onDeadline} />
      </Panel>

      <section className="grid gap-4 rounded-2xl border border-[#27456a]/[0.09] bg-[#fbf6f1] p-5 lg:grid-cols-2">
        <ShareList title="Providers will receive" items={["Your organisation name", "The approved Request brief", "Learner volume or range", "Locations and delivery requirements you chose to share", "Target timing and readiness", "The same response deadline"]} />
        <ShareList title="Providers will not receive" items={["Employee or learner personal data", "Finance or DAS information", "Internal provider notes", "Competing provider identities or responses", "Applications, progress or review records"]} negative />
      </section>

      <div className="flex flex-col-reverse gap-3 border-t border-[#27456a]/[0.09] pt-4 sm:flex-row sm:items-center sm:justify-between"><button type="button" onClick={onBack} className={secondaryButton}><ArrowLeft size={15} aria-hidden="true" />Back</button><button type="button" disabled={!providerIds.length || !responseDeadline || Boolean(busy)} onClick={onSend} className={primaryButton}><Send size={15} aria-hidden="true" />{busy === "send" ? "Sending…" : `Send request to ${providerIds.length || "selected"} provider${providerIds.length === 1 ? "" : "s"}`}</button></div>
    </div>
  );
}

function EmployerRequestDetail({ request, programmes, busy, notice, error, onBack, onExtendDeadline, onPublishRevision, onRetryInvitation, onCancelRequest, onCloseRequest, onAskClarification, onAnswerClarification, onDecideResponse, onConfirmAgreement, onRecordDidNotProceed, onOpenMyProviders, onOpenMyProgrammes }: {
  request: EmployerServiceRequest;
  programmes: EmployerRequestProgrammeOption[];
  busy: string;
  notice: string;
  error: string;
  onBack: () => void;
  onExtendDeadline?: (deadline: string) => Promise<boolean>;
  onPublishRevision?: (brief: EmployerRequestBrief, changeSummary: string) => Promise<boolean>;
  onRetryInvitation?: (invitationId: string) => Promise<boolean>;
  onCancelRequest?: (reason: string) => Promise<boolean>;
  onCloseRequest?: () => Promise<boolean>;
  onAskClarification?: (responseId: string, question: string) => Promise<boolean>;
  onAnswerClarification?: (clarificationId: string, answer: string, shareWithAll: boolean) => Promise<boolean>;
  onDecideResponse?: (responseId: string, decision: "shortlist" | "decline" | "progress_to_agreement", note?: string) => Promise<boolean>;
  onConfirmAgreement?: (responseId: string, handover: { addProvider: boolean; addProgramme: boolean }) => Promise<boolean>;
  onRecordDidNotProceed?: (responseId: string, note?: string) => Promise<boolean>;
  onOpenMyProviders?: () => void;
  onOpenMyProgrammes?: () => void;
}) {
  const [compareIds, setCompareIds] = useState<string[]>(() => request.responses.filter((response) => response.status !== "draft").slice(0, 3).map((response) => response.id));
  const [clarifyResponseId, setClarifyResponseId] = useState<string | null>(null);
  const [clarificationQuestion, setClarificationQuestion] = useState("");
  const [answerId, setAnswerId] = useState<string | null>(null);
  const [answer, setAnswer] = useState("");
  const [shareAnswer, setShareAnswer] = useState(false);
  const [decision, setDecision] = useState<{ response: EmployerRequestResponse; action: "shortlist" | "decline" | "progress_to_agreement" } | null>(null);
  const [decisionNote, setDecisionNote] = useState("");
  const [agreement, setAgreement] = useState<EmployerRequestResponse | null>(null);
  const [addProvider, setAddProvider] = useState(true);
  const [addProgramme, setAddProgramme] = useState(true);
  const [outcomeResponse, setOutcomeResponse] = useState<EmployerRequestResponse | null>(null);
  const [deadlineOpen, setDeadlineOpen] = useState(false);
  const [deadline, setDeadline] = useState(request.responseDeadline?.slice(0, 10) ?? dateAfterDays(14));
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [closeOpen, setCloseOpen] = useState(false);
  const [revisionForm, setRevisionForm] = useState<RequestFormState | null>(null);
  const [revisionStep, setRevisionStep] = useState<1 | 2>(1);
  const [revisionApproved, setRevisionApproved] = useState(false);
  const [revisionSummary, setRevisionSummary] = useState("");
  const headingRef = useRef<HTMLHeadingElement>(null);
  const submitted = request.responses.filter((response) => response.status !== "draft");
  const compared = submitted.filter((response) => compareIds.includes(response.id));
  const points = request.differenceSummary?.length ? request.differenceSummary : deterministicDifferences(compared);
  const progressed = request.responses.find((response) => response.decisionState === "progressed_to_agreement");
  const agreementResponse = request.agreementSnapshot
    ? request.responses.find((response) => response.providerId === request.agreementSnapshot?.providerId)
    : undefined;
  const canManageResponses = ["open", "responses_received", "decision_in_progress"].includes(request.status);
  const canDecideResponses = canManageResponses;
  const canExtendDeadline = request.currentVersionNumber > 0 && !["closed", "cancelled", "progressed_to_agreement"].includes(request.status);
  const responseDeadlinePassed = Boolean(
    request.responseDeadline && request.responseDeadline.slice(0, 10) < new Date().toISOString().slice(0, 10),
  );
  const canCloseDecision = responseDeadlinePassed && ["open", "responses_received", "decision_in_progress", "expired"].includes(request.status);
  const extensionIsValid = isFutureDate(deadline) && (!request.responseDeadline || deadline > request.responseDeadline.slice(0, 10));

  useEffect(() => {
    setDeadline(request.responseDeadline?.slice(0, 10) ?? dateAfterDays(14));
  }, [request.responseDeadline]);

  function beginAgreement(response: EmployerRequestResponse, handoverOnly = false) {
    setAddProvider(handoverOnly ? !request.agreementSnapshot?.providerAddedToWorkspace : true);
    setAddProgramme(Boolean(response.proposedProgrammeId) && (handoverOnly ? !request.agreementSnapshot?.programmeAddedToWorkspace : true));
    setAgreement(response);
  }

  async function commitDecision() {
    if (!decision || !onDecideResponse) return;
    const ok = await onDecideResponse(decision.response.id, decision.action, decisionNote.trim() || undefined);
    if (ok) { setDecision(null); setDecisionNote(""); headingRef.current?.focus(); }
  }

  if (revisionForm && onPublishRevision) {
    const revisedBrief = briefFromForm(revisionForm, programmes);
    return <RequestRevisionFlow
      currentVersion={request.currentVersionNumber}
      step={revisionStep}
      form={revisionForm}
      brief={revisedBrief}
      programmes={programmes}
      approved={revisionApproved}
      changeSummary={revisionSummary}
      busy={busy}
      onBack={() => { setRevisionForm(null); setRevisionStep(1); setRevisionApproved(false); setRevisionSummary(""); }}
      onFormChange={(patch) => { setRevisionForm((current) => current ? { ...current, ...patch } : current); setRevisionApproved(false); }}
      onStep={setRevisionStep}
      onApprove={setRevisionApproved}
      onChangeSummary={setRevisionSummary}
      onPublish={async () => {
        if (!revisionApproved || !revisionSummary.trim()) return;
        const ok = await onPublishRevision(revisedBrief, revisionSummary.trim());
        if (ok) { setRevisionForm(null); setRevisionStep(1); setRevisionApproved(false); setRevisionSummary(""); }
      }}
    />;
  }

  return (
    <div className="min-w-0 space-y-5 text-[#27456a]" data-testid="employer-request-detail">
      <button type="button" onClick={onBack} className={backButton}><ArrowLeft size={16} aria-hidden="true" />Back to Requests</button>
      <header className="overflow-hidden rounded-2xl bg-[#27456a] p-5 text-white shadow-[0_16px_36px_rgba(39,69,106,0.14)] sm:p-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#b8e1d3]">Request · Version {request.currentVersionNumber}</p><h2 ref={headingRef} tabIndex={-1} className="mt-2 break-words text-3xl font-semibold tracking-[-0.04em] outline-none">{request.title}</h2><div className="mt-3 flex flex-wrap items-center gap-3"><Status label={statusLabels[request.status]} tone="light" /><span className="text-xs text-white/65">{request.responseDeadline ? `Responses due ${displayDate(request.responseDeadline)}` : "Draft — no deadline"}</span></div></div>
          {!["closed", "cancelled"].includes(request.status) ? <div className="flex flex-wrap gap-2">{onPublishRevision && (request.status === "open" || request.status === "responses_received") ? <button type="button" onClick={() => { setRevisionForm(formFromBrief(request.brief, initialForm({ mode: request.brief.requestMode, programmeId: request.brief.programmeId }))); setRevisionStep(1); }} className={darkSecondaryButton}>Update brief</button> : null}{onExtendDeadline && canExtendDeadline ? <button type="button" onClick={() => setDeadlineOpen(true)} className={darkSecondaryButton}>Extend deadline</button> : null}{onCloseRequest && canCloseDecision ? <button type="button" onClick={() => setCloseOpen(true)} className={darkSecondaryButton}>Close decision</button> : null}{onCancelRequest && !["expired", "progressed_to_agreement"].includes(request.status) ? <button type="button" onClick={() => setCancelOpen(true)} className={darkSecondaryButton}>Cancel Request</button> : null}</div> : null}
        </div>
        <div className="mt-6 grid gap-2 sm:grid-cols-4"><Stage current={requestStage(request.status)} index={0}>Brief approved</Stage><Stage current={requestStage(request.status)} index={1}>Providers invited</Stage><Stage current={requestStage(request.status)} index={2}>Compare &amp; decide</Stage><Stage current={requestStage(request.status)} index={3}>Agreement</Stage></div>
      </header>

      <Feedback notice={notice} error={error} />

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(280px,.65fr)]">
        <Panel title="Approved brief" copy={`Published snapshot · Version ${request.currentVersionNumber}`}>
          <BriefFacts brief={request.brief} />
          <div className="mt-5"><h3 className={sectionTitle}>Business objective</h3><p className="mt-2 whitespace-pre-wrap break-words text-sm leading-7 text-[#52677d]">{request.brief.businessOutcome}</p></div>
          <OptionalBriefFields brief={request.brief} />
          {request.versions.length > 1 ? <details className="mt-5 border-t border-[#27456a]/[0.08] pt-3"><summary className="min-h-11 cursor-pointer py-3 text-sm font-semibold text-[#176d65]">View {request.versions.length} published versions</summary><ol className="space-y-2">{[...request.versions].sort((left, right) => right.versionNumber - left.versionNumber).map((version) => <li key={version.id} className="rounded-xl bg-[#f8fbfa] text-xs text-[#52677d]"><details><summary className="min-h-11 cursor-pointer px-3 py-3"><strong className="text-[#27456a]">Version {version.versionNumber}</strong> · {displayDate(version.publishedAt)} · {version.publishedBy}{version.changeSummary ? <span className="mt-1 block">{version.changeSummary}</span> : null}</summary><div className="border-t border-[#27456a]/[0.07] p-3"><BriefFacts brief={version.brief} /><div className="mt-4"><h3 className={sectionTitle}>Business objective</h3><p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6">{version.brief.businessOutcome}</p></div><OptionalBriefFields brief={version.brief} /></div></details></li>)}</ol></details> : null}
        </Panel>
        <InvitationPanel request={request} busy={busy} onRetry={canManageResponses ? onRetryInvitation : undefined} />
      </section>

      <ResponsesSection submitted={submitted} compareIds={compareIds} onToggleCompare={(id) => setCompareIds((current) => current.includes(id) ? current.filter((item) => item !== id) : current.length < 3 ? [...current, id] : [...current.slice(1), id])} compared={compared} points={points} busy={busy} clarifyResponseId={clarifyResponseId} clarificationQuestion={clarificationQuestion} onClarify={canManageResponses ? (responseId) => { setClarifyResponseId(responseId); setClarificationQuestion(""); } : undefined} onClarificationQuestion={setClarificationQuestion} onSendClarification={canManageResponses && onAskClarification ? async (responseId) => { if (!clarificationQuestion.trim()) return; const ok = await onAskClarification(responseId, clarificationQuestion.trim()); if (ok) { setClarifyResponseId(null); setClarificationQuestion(""); } } : undefined} onDecision={canDecideResponses && onDecideResponse ? (response, action) => { setDecision({ response, action }); setDecisionNote(""); } : undefined} />

      <ClarificationsSection clarifications={request.clarifications} busy={busy} answerId={answerId} answer={answer} shareAnswer={shareAnswer} onBeginAnswer={canManageResponses && onAnswerClarification ? (id) => { setAnswerId(id); setAnswer(""); setShareAnswer(false); } : undefined} onAnswer={setAnswer} onShare={setShareAnswer} onSubmit={canManageResponses && onAnswerClarification ? async (id) => { if (!answer.trim()) return; const ok = await onAnswerClarification(id, answer.trim(), shareAnswer); if (ok) { setAnswerId(null); setAnswer(""); setShareAnswer(false); } } : undefined} />

      {(progressed || request.agreementSnapshot) ? <AgreementSection request={request} response={progressed} onConfirm={onConfirmAgreement && progressed ? () => beginAgreement(progressed) : undefined} onRetryHandover={onConfirmAgreement && agreementResponse && request.agreementSnapshot && !request.agreementSnapshot.handoverCompleted ? () => beginAgreement(agreementResponse, true) : undefined} onDidNotProceed={onRecordDidNotProceed ? () => progressed && setOutcomeResponse(progressed) : undefined} onOpenMyProviders={onOpenMyProviders} onOpenMyProgrammes={onOpenMyProgrammes} /> : null}

      {decision ? <ActionDialog title={decision.action === "progress_to_agreement" ? "Progress to agreement" : decision.action === "shortlist" ? "Shortlist provider" : "Do not progress provider"} onClose={() => setDecision(null)}>
        <p className="text-sm leading-6 text-[#52677d]">{decision.action === "progress_to_agreement" ? "Progressing a provider means you intend to continue commercial or operational discussions. It does not create a contract, approve funding or enrol learners." : decision.action === "shortlist" ? `${decision.response.providerName} will be marked for further consideration. Other providers are not automatically declined.` : `Record that ${decision.response.providerName} will not progress. The note remains private to your organisation.`}</p>
        <TextArea label="Private decision note (optional)" value={decisionNote} onChange={setDecisionNote} />
        <DialogActions busy={Boolean(busy)} destructive={decision.action === "decline"} confirmLabel={decision.action === "progress_to_agreement" ? "Progress to agreement" : decision.action === "shortlist" ? "Shortlist" : "Confirm decision"} onCancel={() => setDecision(null)} onConfirm={() => void commitDecision()} />
      </ActionDialog> : null}

      {agreement ? <ActionDialog title={request.agreementSnapshot ? "Complete workspace handover" : "Confirm agreement and add to workspace"} onClose={() => setAgreement(null)}>
        <p className="text-sm leading-6 text-[#52677d]">{request.agreementSnapshot ? "The agreement snapshot is already safe. Retry only the selected, idempotent My Providers / My Programmes handover." : "Confirm only after commercial and operational discussions are complete. LevyTate will retain the selected response commitments as a non-contractual Request agreement snapshot."}</p>
        <div className="mt-4 space-y-2"><Checkbox checked={addProvider} onChange={setAddProvider} label="Add provider to My Providers" /><Checkbox checked={addProgramme} onChange={setAddProgramme} disabled={!agreement.proposedProgrammeId} label="Add selected programme to My Programmes" description={!agreement.proposedProgrammeId ? "This response proposes an alternative pathway, so no canonical programme can be added yet." : undefined} /></div>
        <p className="mt-4 rounded-xl bg-[#fbf6f1] p-3 text-xs leading-5 text-[#52677d]">This does not create an application, learner record, enrolment or funding approval.</p>
        <DialogActions busy={Boolean(busy)} disabled={Boolean(request.agreementSnapshot) && !addProvider && !addProgramme} confirmLabel={request.agreementSnapshot ? "Complete handover" : "Agreement confirmed"} onCancel={() => setAgreement(null)} onConfirm={async () => { if (!onConfirmAgreement) return; const ok = await onConfirmAgreement(agreement.id, { addProvider, addProgramme }); if (ok) setAgreement(null); }} />
      </ActionDialog> : null}

      {outcomeResponse ? <ActionDialog title="Record did not proceed" onClose={() => setOutcomeResponse(null)}><TextArea label="Private outcome note (optional)" value={decisionNote} onChange={setDecisionNote} /><DialogActions busy={Boolean(busy)} destructive confirmLabel="Record outcome" onCancel={() => setOutcomeResponse(null)} onConfirm={async () => { if (!onRecordDidNotProceed) return; const ok = await onRecordDidNotProceed(outcomeResponse.id, decisionNote.trim() || undefined); if (ok) { setOutcomeResponse(null); setDecisionNote(""); } }} /></ActionDialog> : null}

      {deadlineOpen ? <ActionDialog title="Extend response deadline" onClose={() => setDeadlineOpen(false)}><TextField label="New response deadline" type="date" min={dateAfterDays(1)} value={deadline} onChange={setDeadline} /><p className={`mt-3 text-xs leading-5 ${extensionIsValid ? "text-[#52677d]" : "text-[#a7354a]"}`}>{extensionIsValid ? "Existing provider drafts remain available. The change will be recorded in Request history." : "Choose a future date later than the current response deadline."}</p><DialogActions busy={Boolean(busy)} disabled={!extensionIsValid} confirmLabel="Update deadline" onCancel={() => setDeadlineOpen(false)} onConfirm={async () => { if (!onExtendDeadline || !extensionIsValid) return; const ok = await onExtendDeadline(deadline); if (ok) setDeadlineOpen(false); }} /></ActionDialog> : null}

      {cancelOpen ? <ActionDialog title="Cancel Request" onClose={() => setCancelOpen(false)}><p className="text-sm leading-6 text-[#52677d]">Providers will see that the Request was cancelled. Briefs, responses and audit history are retained.</p><TextArea label="Cancellation reason" required value={cancelReason} onChange={setCancelReason} /><DialogActions busy={Boolean(busy)} destructive confirmLabel="Cancel Request" disabled={!cancelReason.trim()} onCancel={() => setCancelOpen(false)} onConfirm={async () => { if (!onCancelRequest || !cancelReason.trim()) return; const ok = await onCancelRequest(cancelReason.trim()); if (ok) setCancelOpen(false); }} /></ActionDialog> : null}

      {closeOpen ? <ActionDialog title="Close decision" onClose={() => setCloseOpen(false)}><p className="text-sm leading-6 text-[#52677d]">Close this Request without selecting a provider. Published briefs, responses, clarifications and decision history will remain available.</p><DialogActions busy={Boolean(busy)} confirmLabel="Close decision" onCancel={() => setCloseOpen(false)} onConfirm={async () => { if (!onCloseRequest) return; const ok = await onCloseRequest(); if (ok) setCloseOpen(false); }} /></ActionDialog> : null}
    </div>
  );
}

function RequestRevisionFlow({ currentVersion, step, form, brief, programmes, approved, changeSummary, busy, onBack, onFormChange, onStep, onApprove, onChangeSummary, onPublish }: {
  currentVersion: number;
  step: 1 | 2;
  form: RequestFormState;
  brief: EmployerRequestBrief;
  programmes: EmployerRequestProgrammeOption[];
  approved: boolean;
  changeSummary: string;
  busy: string;
  onBack: () => void;
  onFormChange: (patch: Partial<RequestFormState>) => void;
  onStep: (step: 1 | 2) => void;
  onApprove: (approved: boolean) => void;
  onChangeSummary: (summary: string) => void;
  onPublish: () => void | Promise<void>;
}) {
  const [validationError, setValidationError] = useState("");
  function reviewRevision() {
    const validation = validateStepOne(form);
    if (validation) { setValidationError(validation); return; }
    setValidationError("");
    onStep(2);
  }

  return <div className="mx-auto min-w-0 max-w-5xl space-y-5 text-[#27456a]" data-testid="request-revision-flow">
    <button type="button" onClick={onBack} className={backButton}><ArrowLeft size={16} aria-hidden="true" />Back to Request</button>
    <header className="rounded-2xl border border-[#27456a]/[0.08] bg-[#fbf6f1] p-5 sm:p-6"><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#b94f64]">Published Request update</p><h2 className="mt-2 text-3xl font-semibold tracking-[-0.04em]">Prepare Version {currentVersion + 1}</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-[#52677d]">The current published brief remains unchanged. Publishing this update creates a new immutable snapshot for every invited provider.</p></header>
    <Feedback error={validationError} />
    {step === 1 ? <RequirementForm form={form} programmes={programmes} busy={busy} onChange={(patch) => { setValidationError(""); onFormChange(patch); }} onContinue={reviewRevision} /> : <div className="space-y-5">
      <section className="rounded-2xl border border-[#27456a]/[0.09] bg-white p-5 shadow-[0_14px_34px_rgba(39,69,106,0.045)] sm:p-6"><div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#27456a]/[0.08] pb-4"><div><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#17786e]">Provider-facing preview</p><h2 className="mt-1 text-2xl font-semibold">Version {currentVersion + 1} · {brief.title}</h2></div><button type="button" onClick={() => onStep(1)} className={secondaryButton}><Pencil size={15} aria-hidden="true" />Edit</button></div><div className="mt-5"><BriefFacts brief={brief} /><div className="mt-5"><h3 className={sectionTitle}>Business objective</h3><p className="mt-2 whitespace-pre-wrap break-words text-sm leading-7 text-[#52677d]">{brief.businessOutcome}</p></div><OptionalBriefFields brief={brief} /></div></section>
      <Panel title="Explain the update" copy="Invited providers see that the Request changed and can review the current version. Earlier versions and version-bound responses remain available."><TextArea label="Change summary" required value={changeSummary} onChange={onChangeSummary} /><Checkbox checked={approved} onChange={onApprove} label={`I approve Version ${currentVersion + 1} for every invited provider`} description="Publishing never silently rewrites the version providers previously reviewed or responded to." /></Panel>
      <div className="flex flex-col-reverse gap-3 border-t border-[#27456a]/[0.09] pt-4 sm:flex-row sm:justify-between"><button type="button" onClick={() => onStep(1)} className={secondaryButton}><ArrowLeft size={15} aria-hidden="true" />Back</button><button type="button" disabled={!approved || !changeSummary.trim() || Boolean(busy)} onClick={() => void onPublish()} className={primaryButton}>{busy === "publish-revision" ? "Publishing…" : `Publish Version ${currentVersion + 1}`}</button></div>
    </div>}
  </div>;
}

function InvitationPanel({ request, busy, onRetry }: { request: EmployerServiceRequest; busy: string; onRetry?: (invitationId: string) => Promise<boolean> }) {
  return <Panel title="Provider invitations" copy={`${request.invitations.length} selected provider${request.invitations.length === 1 ? "" : "s"}`}><ul className="space-y-3">{request.invitations.map((invitation) => <li key={invitation.id} className="rounded-xl bg-[#f8fbfa] p-3"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="break-words text-sm font-semibold">{invitation.providerName}</p><p className="mt-1 text-xs text-[#607487]">Request version {invitation.requestVersionNumber}</p></div><Status label={invitationLabels[invitation.status]} tone={invitationTone(invitation.status)} /></div>{invitation.declineReason ? <p className="mt-2 text-xs leading-5 text-[#52677d]">Reason: {invitation.declineReason}</p> : null}{(invitation.status === "delivery_failed" || invitation.status === "pending") && onRetry ? <button type="button" disabled={Boolean(busy)} onClick={() => void onRetry(invitation.id)} className={`${secondaryButton} mt-3`}>{invitation.status === "pending" ? "Send notification" : "Retry notification"}</button> : null}</li>)}</ul>{!request.invitations.length ? <p className="text-sm text-[#52677d]">No providers have been invited.</p> : null}</Panel>;
}

function ResponsesSection({ submitted, compareIds, onToggleCompare, compared, points, busy, clarifyResponseId, clarificationQuestion, onClarify, onClarificationQuestion, onSendClarification, onDecision }: {
  submitted: EmployerRequestResponse[];
  compareIds: string[];
  onToggleCompare: (id: string) => void;
  compared: EmployerRequestResponse[];
  points: string[];
  busy: string;
  clarifyResponseId: string | null;
  clarificationQuestion: string;
  onClarify?: (responseId: string) => void;
  onClarificationQuestion: (value: string) => void;
  onSendClarification?: (responseId: string) => void;
  onDecision?: (response: EmployerRequestResponse, decision: "shortlist" | "decline" | "progress_to_agreement") => void;
}) {
  return <Panel title="Compare responses" copy="Structured provider information shown without scores, rankings or a selected winner.">
    {!submitted.length ? <div className="rounded-xl border border-dashed border-[#27456a]/[0.14] bg-[#f8fbfa] p-8 text-center"><MessageCircleQuestion className="mx-auto text-[#17786e]" size={24} aria-hidden="true" /><h3 className="mt-3 font-semibold">No submitted responses yet</h3><p className="mt-2 text-sm text-[#52677d]">Draft provider responses remain private until submitted.</p></div> : <>
      <div className="flex flex-wrap gap-2" aria-label="Choose responses to compare">{submitted.map((response) => <button key={response.id} type="button" aria-pressed={compareIds.includes(response.id)} onClick={() => onToggleCompare(response.id)} className={compareIds.includes(response.id) ? selectedChip : unselectedChip}><span className={`h-2 w-2 rounded-full ${compareIds.includes(response.id) ? "bg-white" : "bg-[#17786e]"}`} aria-hidden="true" />{response.providerName}</button>)}</div>
      <p className="mt-2 text-xs text-[#607487]">Choose up to three. On smaller screens responses stack vertically.</p>
      <div className="mt-5 grid min-w-0 gap-4 lg:grid-cols-2 2xl:grid-cols-3" data-testid="request-response-comparison">{compared.map((response) => <ResponseCard key={response.id} response={response} busy={busy} clarifyOpen={clarifyResponseId === response.id} clarificationQuestion={clarificationQuestion} onClarify={onClarify ? () => onClarify(response.id) : undefined} onClarificationQuestion={onClarificationQuestion} onSendClarification={onSendClarification ? () => onSendClarification(response.id) : undefined} onDecision={onDecision ? (action) => onDecision(response, action) : undefined} />)}</div>
      {compared.length > 1 ? <section className="mt-5 rounded-xl border-l-4 border-[#d6a62d] bg-[#fff8df] p-4"><h3 className="text-sm font-semibold text-[#765b00]">Points to resolve</h3>{points.length ? <ul className="mt-2 space-y-2 text-sm leading-6 text-[#66560f]">{points.map((point) => <li key={point} className="flex gap-2"><span aria-hidden="true">•</span><span>{point}</span></li>)}</ul> : <p className="mt-2 text-sm text-[#66560f]">Review each structured field. No material difference has been automatically identified.</p>}</section> : null}
    </>}
  </Panel>;
}

function ResponseCard({ response, busy, clarifyOpen, clarificationQuestion, onClarify, onClarificationQuestion, onSendClarification, onDecision }: {
  response: EmployerRequestResponse;
  busy: string;
  clarifyOpen: boolean;
  clarificationQuestion: string;
  onClarify?: () => void;
  onClarificationQuestion: (value: string) => void;
  onSendClarification?: () => void;
  onDecision?: (decision: "shortlist" | "decline" | "progress_to_agreement") => void;
}) {
  const headingId = `request-response-${response.id.replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const mayShortlist = response.decisionState === "none";
  const mayProgress = response.decisionState === "none" || response.decisionState === "shortlisted";
  const mayDecline = response.decisionState === "none" || response.decisionState === "shortlisted";
  const mayClarify = !["declined", "agreement_confirmed", "did_not_proceed"].includes(response.decisionState);
  const hasActions = Boolean((onClarify && mayClarify) || (onDecision && (mayShortlist || mayProgress || mayDecline)));
  const showClarification = Boolean(clarifyOpen && onSendClarification);
  const rows: Array<[string, string]> = [
    ["Programme", response.proposedProgramme], ["Start availability", response.earliestAvailableStart], ["Delivery", response.deliveryApproach], ["Cohort / capacity", response.cohortCapacity], ["Workplace requirements", response.workplaceRequirements], ["Learning commitment", response.learningCommitment], ["Support / reporting", response.employerSupport], ["Provider proposed price", response.proposedPrice], ["Price basis", response.priceBasis], ["Additional commercial costs", response.additionalCommercialCosts || "None identified"], ["Evidence", response.evidence], ["Exceptions", response.exceptions || "None identified"],
  ];
  return <article aria-labelledby={headingId} className="min-w-0 overflow-hidden rounded-xl border border-[#27456a]/[0.10] bg-white">
    <header className="bg-[#e6eee9] p-4"><div className="flex flex-wrap items-start justify-between gap-2"><div><h3 id={headingId} className="break-words text-lg font-semibold">{response.providerName}</h3><p className="mt-1 text-xs text-[#607487]">Response version {response.responseVersionNumber} · Request version {response.requestVersionNumber}</p></div>{response.decisionState !== "none" ? <Status label={decisionLabels[response.decisionState]} tone={response.decisionState === "declined" || response.decisionState === "did_not_proceed" ? "risk" : "healthy"} /> : null}</div></header>
    <dl className="divide-y divide-[#27456a]/[0.07]">{rows.map(([label, value]) => <div key={label} className="min-w-0 p-3"><dt className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#607487]">{label}</dt><dd className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-[#52677d]">{value || "Not provided"}</dd></div>)}</dl>
    {hasActions || showClarification ? <div className="space-y-3 border-t border-[#27456a]/[0.08] p-3">
      {hasActions ? <div className="grid gap-2 sm:grid-cols-2">{onDecision && mayShortlist ? <button type="button" disabled={Boolean(busy)} onClick={() => onDecision("shortlist")} className={secondaryButton}>Shortlist</button> : null}{onDecision && mayProgress ? <button type="button" disabled={Boolean(busy)} onClick={() => onDecision("progress_to_agreement")} className={primaryButton}>Progress to agreement</button> : null}{onDecision && mayDecline ? <button type="button" disabled={Boolean(busy)} onClick={() => onDecision("decline")} className={dangerButton}>Decline</button> : null}{onClarify && mayClarify ? <button type="button" disabled={Boolean(busy)} onClick={onClarify} className={secondaryButton}>Ask clarification</button> : null}</div> : null}
      {clarifyOpen && onSendClarification ? <div className="rounded-xl bg-[#f8fbfa] p-3"><TextArea label={`Question for ${response.providerName}`} value={clarificationQuestion} onChange={onClarificationQuestion} /><button type="button" disabled={!clarificationQuestion.trim() || Boolean(busy)} onClick={onSendClarification} className={`${primaryButton} mt-3`}>Send question</button></div> : null}
    </div> : null}
  </article>;
}

function ClarificationsSection({ clarifications, busy, answerId, answer, shareAnswer, onBeginAnswer, onAnswer, onShare, onSubmit }: {
  clarifications: EmployerRequestClarification[];
  busy: string;
  answerId: string | null;
  answer: string;
  shareAnswer: boolean;
  onBeginAnswer?: (id: string) => void;
  onAnswer: (value: string) => void;
  onShare: (share: boolean) => void;
  onSubmit?: (id: string) => void;
}) {
  if (!clarifications.length) return null;
  return <Panel title="Clarifications" copy="Share material answers fairly without revealing another provider’s identity."><div className="space-y-3">{clarifications.map((item) => {
    const employerAsked = item.askedBy === "employer";
    return <article key={item.id} className="rounded-xl border border-[#27456a]/[0.08] bg-[#fbfcfb] p-4"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs font-semibold text-[#176d65]">{item.providerName}</p><Status label={employerAsked ? "Asked by employer" : item.visibility === "shared_with_invited_providers" ? "Shared employer clarification" : "Provider specific"} tone="info" /></div><p className="mt-3 text-sm font-semibold leading-6">{item.question}</p>{item.answer ? <div className="mt-3 border-l-2 border-[#17786e] pl-3"><p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#607487]">{employerAsked ? "Provider answer" : "Employer answer"}</p><p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-[#52677d]">{item.answer}</p></div> : !employerAsked && onBeginAnswer ? <button type="button" onClick={() => onBeginAnswer(item.id)} className={`${secondaryButton} mt-3`}>Answer</button> : employerAsked ? <p className="mt-3 text-xs text-[#607487]">Waiting for the provider to respond.</p> : null}{answerId === item.id && onSubmit ? <div className="mt-3 rounded-xl bg-white p-3"><TextArea label="Answer" value={answer} onChange={onAnswer} /><Checkbox checked={shareAnswer} onChange={onShare} label="Share as an employer clarification with all invited providers" description="Providers will not see which provider originally asked." /><button type="button" disabled={!answer.trim() || Boolean(busy)} onClick={() => onSubmit(item.id)} className={`${primaryButton} mt-3`}>Send answer</button></div> : null}</article>;
  })}</div></Panel>;
}

function AgreementSection({ request, response, onConfirm, onRetryHandover, onDidNotProceed, onOpenMyProviders, onOpenMyProgrammes }: { request: EmployerServiceRequest; response?: EmployerRequestResponse; onConfirm?: () => void; onRetryHandover?: () => void; onDidNotProceed?: () => void; onOpenMyProviders?: () => void; onOpenMyProgrammes?: () => void }) {
  const snapshot = request.agreementSnapshot;
  return <Panel title={snapshot ? "Request agreement snapshot" : "Agreement discussions"} copy={snapshot ? "Operational reference only — not a legally binding contract." : "Record the outcome explicitly; inactivity never confirms an agreement."}>
    {snapshot ? <><dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"><Detail label="Provider" value={snapshot.providerName} /><Detail label="Programme" value={snapshot.programmeName} /><Detail label="Proposed start" value={snapshot.proposedStart} /><Detail label="Delivery" value={snapshot.deliveryApproach} /><Detail label="Workplace requirements" value={snapshot.workplaceRequirements} /><Detail label="Support / reporting" value={snapshot.employerSupport} /><Detail label="Provider proposed price" value={snapshot.proposedPrice} /><Detail label="Price basis" value={snapshot.priceBasis} /><Detail label="Exceptions / assumptions" value={snapshot.exceptions || "None recorded"} /></dl><div className="mt-4 flex flex-wrap gap-2">{snapshot.providerAddedToWorkspace && onOpenMyProviders ? <button type="button" onClick={onOpenMyProviders} className={secondaryButton}>Open My Providers</button> : null}{snapshot.programmeAddedToWorkspace && onOpenMyProgrammes ? <button type="button" onClick={onOpenMyProgrammes} className={secondaryButton}>Open My Programmes</button> : null}{!snapshot.handoverCompleted && onRetryHandover ? <button type="button" onClick={onRetryHandover} className={primaryButton}>Complete workspace handover</button> : null}</div></> : response ? <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold">{response.providerName}</p><p className="mt-1 text-sm text-[#52677d]">Progressed for commercial and operational discussion. No contract or funding approval has been created.</p></div><div className="flex flex-wrap gap-2">{onDidNotProceed ? <button type="button" onClick={onDidNotProceed} className={dangerButton}>Did not proceed</button> : null}{onConfirm ? <button type="button" onClick={onConfirm} className={primaryButton}><Handshake size={16} aria-hidden="true" />Agreement confirmed</button> : null}</div></div> : null}
  </Panel>;
}

function Panel({ title, copy, children }: { title: string; copy?: string; children: ReactNode }) {
  return <section className="min-w-0 rounded-2xl border border-[#27456a]/[0.09] bg-white p-5 shadow-[0_14px_34px_rgba(39,69,106,0.04)] sm:p-6"><header className="mb-5"><h2 className="text-xl font-semibold tracking-[-0.02em]">{title}</h2>{copy ? <p className="mt-1 text-sm leading-6 text-[#52677d]">{copy}</p> : null}</header>{children}</section>;
}

function BriefFacts({ brief }: { brief: EmployerRequestBrief }) {
  return <dl className="grid gap-3 sm:grid-cols-2"><Detail label="Learners" value={learnerVolumeLabel(brief.learnerVolume)} /><Detail label="Teams" value={brief.departments.join(", ") || "Not confirmed"} /><Detail label="Delivery" value={brief.deliveryPreference} /><Detail label="Location" value={locationLabel(brief)} /><Detail label="Preferred start" value={brief.preferredStart} /><Detail label="Readiness" value={readinessLabels[brief.readiness]} />{brief.programmeName ? <Detail label="Programme context" value={`${brief.programmeName}${brief.programmeProviderName ? ` — ${brief.programmeProviderName}` : ""}`} /> : null}</dl>;
}

function OptionalBriefFields({ brief }: { brief: EmployerRequestBrief }) {
  const items = [
    ["Target roles", brief.targetRoles.join(", ")],
    ["Cohort composition", workforceLabel(brief.workforceComposition)],
    ["Workplace project requirements", brief.workplaceProjectRequirements],
    ["Accessibility / delivery considerations", brief.accessibilityConsiderations],
    ["Procurement requirements", brief.procurementRequirements],
    ["Additional notes", brief.additionalNotes],
  ].filter((item): item is [string, string] => Boolean(item[1]));
  if (!items.length) return null;
  return <div className="mt-5"><h3 className={sectionTitle}>Additional information shared</h3><dl className="mt-3 grid gap-3 sm:grid-cols-2">{items.map(([label, value]) => <Detail key={label} label={label} value={value} />)}</dl></div>;
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0 rounded-xl bg-[#f2f7f4] p-3"><dt className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#607487]">{label}</dt><dd className="mt-1 whitespace-pre-wrap break-words text-sm font-semibold leading-6">{value || "Not confirmed"}</dd></div>;
}

function ChoiceCard({ checked, title, copy, onClick }: { checked: boolean; title: string; copy: string; onClick: () => void }) {
  return <label className={`relative block min-h-28 cursor-pointer rounded-xl border p-4 text-left focus-within:ring-2 focus-within:ring-[#17786e] ${checked ? "border-[#17786e] bg-[#edf7f3]" : "border-[#27456a]/[0.10] bg-white hover:border-[#17786e]/40"}`}><input type="radio" name="request-mode" checked={checked} onChange={onClick} className="sr-only" /><span className="flex items-center justify-between gap-3"><span className="font-semibold">{title}</span><span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border ${checked ? "border-[#17786e] bg-[#17786e] text-white" : "border-[#8492a1] text-transparent"}`}><Check size={13} aria-hidden="true" /></span></span><span className="mt-2 block text-xs leading-5 text-[#52677d]">{copy}</span></label>;
}

function TextField({ label, value, onChange, required = false, type = "text", min, placeholder, wide = false }: { label: string; value: string; onChange: (value: string) => void; required?: boolean; type?: string; min?: string; placeholder?: string; wide?: boolean }) {
  return <label className={`grid min-w-0 gap-1.5 ${wide ? "md:col-span-2" : ""}`}><span className={labelClass}>{label}{required ? <span aria-hidden="true"> *</span> : null}</span><input required={required} type={type} min={min} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className={inputClass} /></label>;
}

function SelectField({ label, value, options, onChange, required = false }: { label: string; value: string; options: Array<string | { value: string; label: string }>; onChange: (value: string) => void; required?: boolean }) {
  return <label className="grid min-w-0 gap-1.5"><span className={labelClass}>{label}{required ? <span aria-hidden="true"> *</span> : null}</span><select required={required} value={value} onChange={(event) => onChange(event.target.value)} className={inputClass}>{options.map((option) => typeof option === "string" ? <option key={option} value={option}>{option}</option> : <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>;
}

function TextArea({ label, value, onChange, required = false, wide = false, placeholder }: { label: string; value: string; onChange: (value: string) => void; required?: boolean; wide?: boolean; placeholder?: string }) {
  return <label className={`grid min-w-0 gap-1.5 ${wide ? "md:col-span-2" : ""}`}><span className={labelClass}>{label}{required ? <span aria-hidden="true"> *</span> : null}</span><textarea required={required} rows={3} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className={`${inputClass} h-auto min-h-24 resize-y py-3 leading-6`} /></label>;
}

function Checkbox({ checked, onChange, label, description, disabled = false }: { checked: boolean; onChange: (value: boolean) => void; label: string; description?: string; disabled?: boolean }) {
  return <label className={`mt-3 flex min-h-11 items-start gap-3 text-sm ${disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}><input type="checkbox" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} className="mt-1 h-5 w-5 shrink-0 accent-[#17786e]" /><span><span className="font-semibold">{label}</span>{description ? <span className="mt-0.5 block text-xs leading-5 text-[#52677d]">{description}</span> : null}</span></label>;
}

function ShareList({ title, items, negative = false }: { title: string; items: string[]; negative?: boolean }) {
  return <div><h2 className="text-sm font-semibold">{title}</h2><ul className="mt-3 space-y-2">{items.map((item) => <li key={item} className="flex gap-2 text-sm leading-6 text-[#52677d]">{negative ? <X size={15} className="mt-1 shrink-0 text-[#b94f64]" aria-hidden="true" /> : <Check size={15} className="mt-1 shrink-0 text-[#17786e]" aria-hidden="true" />}{item}</li>)}</ul></div>;
}

function ActionDialog({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  const dialogRef = useRef<HTMLElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = dialogRef.current;
    dialog?.querySelector<HTMLElement>("button, input, select, textarea")?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") closeRef.current();
      if (event.key !== "Tab" || !dialog) return;
      const focusable = [...dialog.querySelectorAll<HTMLElement>("button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex='-1'])")];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => { document.removeEventListener("keydown", onKeyDown); previous?.focus(); };
  }, []);

  return <div className="fixed inset-0 z-50 overflow-y-auto bg-[#27456a]/40 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}><section ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="request-dialog-title" className="mx-auto mt-[8vh] w-full max-w-xl rounded-2xl bg-white p-5 shadow-[0_30px_90px_rgba(39,69,106,0.3)] sm:p-6"><header className="flex items-start justify-between gap-4"><h2 id="request-dialog-title" className="text-xl font-semibold">{title}</h2><button type="button" onClick={onClose} aria-label="Close dialog" className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-[#607487] hover:bg-[#f2f7f4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#17786e]"><X size={18} aria-hidden="true" /></button></header><div className="mt-4">{children}</div></section></div>;
}

function DialogActions({ confirmLabel, onCancel, onConfirm, busy, destructive = false, disabled = false }: { confirmLabel: string; onCancel: () => void; onConfirm: () => void | Promise<void>; busy: boolean; destructive?: boolean; disabled?: boolean }) {
  return <div className="mt-5 flex flex-col-reverse gap-2 border-t border-[#27456a]/[0.08] pt-4 sm:flex-row sm:justify-end"><button type="button" onClick={onCancel} className={secondaryButton}>Keep reviewing</button><button type="button" disabled={disabled || busy} onClick={() => void onConfirm()} className={destructive ? dangerButton : primaryButton}>{busy ? "Working…" : confirmLabel}</button></div>;
}

function Feedback({ notice, error }: { notice?: string; error?: string }) {
  if (!notice && !error) return null;
  return <div role={error ? "alert" : "status"} className={`flex items-start gap-3 rounded-xl border p-4 text-sm leading-6 ${error ? "border-[#b94f64]/25 bg-[#fff2f4] text-[#92384a]" : "border-[#17786e]/25 bg-[#edf7f3] text-[#176d65]"}`}>{error ? <Info size={17} className="mt-0.5 shrink-0" aria-hidden="true" /> : <CheckCircle2 size={17} className="mt-0.5 shrink-0" aria-hidden="true" />}<span>{error || notice}</span></div>;
}

function InlineFact({ icon: Icon, label, value }: { icon: typeof CalendarDays; label: string; value: string }) {
  return <div className="flex items-center gap-1.5"><Icon size={14} className="shrink-0 text-[#17786e]" aria-hidden="true" /><dt className="sr-only">{label}</dt><dd>{value}</dd></div>;
}

function Status({ label, tone }: { label: string; tone: "neutral" | "healthy" | "watch" | "risk" | "info" | "light" }) {
  const styles = { neutral: "bg-[#edf1ef] text-[#52677d]", healthy: "bg-[#dff2ea] text-[#176d65]", watch: "bg-[#fff4cf] text-[#765b00]", risk: "bg-[#fff0f2] text-[#a7354a]", info: "bg-[#eef5fa] text-[#315d78]", light: "bg-white/15 text-white" };
  const dots = { neutral: "bg-[#71808a]", healthy: "bg-[#17786e]", watch: "bg-[#d6a62d]", risk: "bg-[#c95568]", info: "bg-[#4f7b95]", light: "bg-[#b8e1d3]" };
  return <span className={`inline-flex max-w-full items-center gap-2 rounded-lg px-2.5 py-1 text-[11px] font-semibold ${styles[tone]}`}><span className={`h-2 w-2 shrink-0 rounded-full ${dots[tone]}`} aria-hidden="true" />{label}</span>;
}

function Stage({ current, index, children }: { current: number; index: number; children: ReactNode }) {
  const complete = index < current;
  const active = index === current;
  return <div className={`flex min-h-12 items-center gap-2 rounded-xl px-3 text-xs font-semibold ${active ? "bg-white/15 text-white ring-1 ring-white/20" : complete ? "bg-[#17786e] text-white" : "bg-white/[0.07] text-white/55"}`}><span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full ${complete ? "bg-white text-[#17786e]" : "bg-white/10"}`}>{complete ? <Check size={13} aria-hidden="true" /> : index + 1}</span>{children}</div>;
}

function briefFromForm(form: RequestFormState, programmes: EmployerRequestProgrammeOption[]): EmployerRequestBrief {
  const programme = programmes.find((item) => item.id === form.programmeId);
  return {
    title: form.title.trim(), requestMode: form.requestMode, businessOutcome: form.businessOutcome.trim(), learnerVolume: volumeFromForm(form), locations: splitValues(form.locations), locationMode: form.locationMode, deliveryPreference: form.deliveryPreference, preferredStart: form.preferredStart.trim() || "Not confirmed", readiness: form.readiness,
    ...(programme ? { programmeId: programme.id, programmeName: programme.name, programmeProviderName: programme.providerName } : {}),
    departments: splitValues(form.departments), targetRoles: splitValues(form.targetRoles), workforceComposition: form.workforceComposition, workplaceProjectRequirements: optional(form.workplaceProjectRequirements), accessibilityConsiderations: optional(form.accessibilityConsiderations), procurementRequirements: optional(form.procurementRequirements), additionalNotes: optional(form.additionalNotes),
  };
}

function formFromBrief(brief: EmployerRequestBrief, current: RequestFormState): RequestFormState {
  const volume = brief.learnerVolume;
  return {
    ...current,
    title: brief.title,
    requestMode: brief.requestMode,
    programmeId: brief.programmeId ?? "",
    businessOutcome: brief.businessOutcome,
    learnerVolumeKind: volume.kind,
    learnerExact: volume.kind === "exact" ? String(volume.exact) : volume.kind === "approximate" ? String(volume.approximate) : "",
    learnerMinimum: volume.kind === "range" ? String(volume.minimum) : "",
    learnerMaximum: volume.kind === "range" ? String(volume.maximum) : "",
    locationMode: brief.locationMode,
    locations: brief.locations.join(", "),
    deliveryPreference: brief.deliveryPreference,
    preferredStart: brief.preferredStart,
    readiness: brief.readiness,
    departments: brief.departments.join(", "),
    targetRoles: brief.targetRoles.join(", "),
    workforceComposition: brief.workforceComposition ?? "unknown",
    workplaceProjectRequirements: brief.workplaceProjectRequirements ?? "",
    accessibilityConsiderations: brief.accessibilityConsiderations ?? "",
    procurementRequirements: brief.procurementRequirements ?? "",
    additionalNotes: brief.additionalNotes ?? "",
  };
}

function volumeFromForm(form: RequestFormState): EmployerRequestLearnerVolume {
  if (form.learnerVolumeKind === "exact") return { kind: "exact", exact: positiveNumber(form.learnerExact) };
  if (form.learnerVolumeKind === "approximate") return { kind: "approximate", approximate: positiveNumber(form.learnerExact) };
  if (form.learnerVolumeKind === "range") return { kind: "range", minimum: positiveNumber(form.learnerMinimum), maximum: positiveNumber(form.learnerMaximum) };
  return { kind: "not_confirmed" };
}

function validateStepOne(form: RequestFormState) {
  if (!form.title.trim()) return "Add a short Request title.";
  if (!form.businessOutcome.trim()) return "Describe the requirement or business outcome.";
  if (form.requestMode === "programme_led" && !form.programmeId) return "Choose the programme this Request is based on.";
  if ((form.learnerVolumeKind === "exact" || form.learnerVolumeKind === "approximate") && positiveNumber(form.learnerExact) < 1) return "Enter a valid learner number or choose Not confirmed.";
  if (form.learnerVolumeKind === "range" && (positiveNumber(form.learnerMinimum) < 1 || positiveNumber(form.learnerMaximum) < positiveNumber(form.learnerMinimum))) return "Enter a valid learner range, with the maximum at least the minimum.";
  if (form.locationMode === "locations" && !splitValues(form.locations).length) return "Add at least one workplace location or choose Not confirmed.";
  return "";
}

function learnerVolumeLabel(volume: EmployerRequestLearnerVolume) {
  if (volume.kind === "exact") return `${volume.exact} learner${volume.exact === 1 ? "" : "s"}`;
  if (volume.kind === "approximate") return `Approximately ${volume.approximate} learners`;
  if (volume.kind === "range") return `${volume.minimum}–${volume.maximum} learners`;
  return "Not confirmed";
}

function locationLabel(brief: EmployerRequestBrief) {
  if (brief.locationMode === "remote_distributed") return "Remote / distributed workforce";
  if (brief.locationMode === "locations") return brief.locations.join(", ") || "Not confirmed";
  return "Not confirmed";
}

function workforceLabel(value: EmployerRequestBrief["workforceComposition"]) {
  return value === "existing_employees" ? "Existing employees" : value === "new_recruits" ? "New recruits" : value === "mixed" ? "Mixed cohort" : value === "unknown" ? "Not confirmed" : "";
}

function providerReasons(provider: EmployerRequestProviderOption, brief: EmployerRequestBrief) {
  const reasons = [...(provider.relevanceReasons ?? [])];
  if (brief.programmeId && provider.programmeIds.includes(brief.programmeId)) reasons.unshift(`Offers ${brief.programmeName ?? "the selected programme"}`);
  if (brief.deliveryPreference !== "Not confirmed" && provider.deliveryModels.some((item) => item.toLowerCase().includes(brief.deliveryPreference.toLowerCase()))) reasons.push(`Supports ${brief.deliveryPreference.toLowerCase()} delivery`);
  if (brief.locationMode === "locations" && brief.locations.some((location) => provider.regions.some((region) => region.toLowerCase().includes(location.toLowerCase()) || location.toLowerCase().includes(region.toLowerCase())))) reasons.push("Catalogue coverage includes a shared location");
  return [...new Set(reasons)].slice(0, 3);
}

function deterministicDifferences(responses: EmployerRequestResponse[]) {
  const points: string[] = [];
  const starts = new Set(responses.map((response) => response.earliestAvailableStart.trim()).filter(Boolean));
  if (starts.size > 1) points.push(`Start availability differs: ${responses.map((response) => `${response.providerName} — ${response.earliestAvailableStart}`).join("; ")}.`);
  const capacities = new Set(responses.map((response) => response.cohortCapacity.trim()).filter(Boolean));
  if (capacities.size > 1) points.push("Cohort capacity and minimum-cohort requirements differ across the responses.");
  if (responses.some((response) => response.exceptions.trim())) points.push("One or more providers recorded exceptions or points that need clarification.");
  const prices = new Set(responses.map((response) => `${response.proposedPrice}|${response.priceBasis}`).filter((value) => value !== "|"));
  if (prices.size > 1) points.push("Proposed price or pricing assumptions differ; compare each provider’s stated basis before deciding.");
  return points;
}

function statusTone(status: EmployerRequestStatus): "neutral" | "healthy" | "watch" | "risk" | "info" {
  if (status === "cancelled" || status === "expired") return "risk";
  if (status === "progressed_to_agreement" || status === "closed") return "healthy";
  if (status === "responses_received" || status === "decision_in_progress") return "watch";
  if (status === "open") return "info";
  return "neutral";
}

function invitationTone(status: EmployerRequestInvitationStatus): "neutral" | "healthy" | "watch" | "risk" | "info" {
  if (status === "delivery_failed" || status === "deadline_passed") return "risk";
  if (status === "responded") return "healthy";
  if (status === "viewed" || status === "declined") return "watch";
  if (status === "sent") return "info";
  return "neutral";
}

function requestStage(status: EmployerRequestStatus) {
  if (status === "progressed_to_agreement" || status === "closed") return 3;
  if (status === "responses_received" || status === "decision_in_progress") return 2;
  if (status === "open" || status === "expired" || status === "cancelled") return 1;
  return 0;
}

function splitValues(value: string) { return [...new Set(value.split(",").map((item) => item.trim()).filter(Boolean))]; }
function optional(value: string) { return value.trim() || undefined; }
function positiveNumber(value: string) { const result = Number.parseInt(value, 10); return Number.isFinite(result) && result > 0 ? result : 0; }
function dateAfterDays(days: number) { const date = new Date(); date.setDate(date.getDate() + days); return date.toISOString().slice(0, 10); }
function isFutureDate(value: string) { return /^\d{4}-\d{2}-\d{2}$/.test(value) && value >= dateAfterDays(1); }
function displayDate(value: string) { const date = new Date(value); return Number.isNaN(date.valueOf()) ? "Not recorded" : new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(date); }

function requestTabId(tab: DashboardTab) { return `requests-tab-${tab.toLowerCase()}`; }
function requestPanelId(tab: DashboardTab) { return `requests-panel-${tab.toLowerCase()}`; }
function moveRequestTabFocus(
  event: ReactKeyboardEvent<HTMLButtonElement>,
  tabs: DashboardTab[],
  index: number,
  onTab: (tab: DashboardTab) => void,
) {
  let nextIndex: number | null = null;
  if (event.key === "ArrowRight") nextIndex = (index + 1) % tabs.length;
  if (event.key === "ArrowLeft") nextIndex = (index - 1 + tabs.length) % tabs.length;
  if (event.key === "Home") nextIndex = 0;
  if (event.key === "End") nextIndex = tabs.length - 1;
  if (nextIndex === null) return;
  event.preventDefault();
  const nextTab = tabs[nextIndex];
  onTab(nextTab);
  window.requestAnimationFrame(() => document.getElementById(requestTabId(nextTab))?.focus());
}

const inputClass = "h-11 min-w-0 w-full rounded-xl border border-[#8492a1] bg-[#fbfcfb] px-3 text-sm text-[#27456a] outline-none transition-[border-color,box-shadow,background-color] placeholder:text-[#607487] focus:border-[#17786e] focus:bg-white focus:ring-4 focus:ring-[#17786e]/[0.12]";
const labelClass = "text-xs font-semibold text-[#52677d]";
const sectionTitle = "text-[11px] font-bold uppercase tracking-[0.12em] text-[#607487]";
const primaryButton = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#27456a] px-5 text-sm font-semibold text-white transition-colors hover:bg-[#1d3654] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#17786e] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-45";
const secondaryButton = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#8492a1] bg-white px-4 text-sm font-semibold text-[#27456a] transition-colors hover:bg-[#f2f7f4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#17786e] disabled:cursor-not-allowed disabled:opacity-45";
const dangerButton = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#b94f64]/30 bg-white px-4 text-sm font-semibold text-[#a7354a] transition-colors hover:bg-[#fff0f2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b94f64] disabled:cursor-not-allowed disabled:opacity-45";
const darkSecondaryButton = "inline-flex min-h-11 items-center justify-center rounded-xl border border-white/25 bg-white/10 px-4 text-sm font-semibold text-white hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white";
const backButton = "inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-[#52677d] hover:bg-white hover:text-[#27456a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#17786e]";
const selectedChip = "inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#27456a] px-4 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#17786e] focus-visible:ring-offset-2";
const unselectedChip = "inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#8492a1] bg-white px-4 text-sm font-semibold text-[#52677d] hover:bg-[#f2f7f4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#17786e]";
