"use client";
import { useCatalogueAction } from "@/components/levytate-mvp/useCatalogueAction";

import { Check, ChevronDown, Target } from "lucide-react";
import { EmployerSetupJourney } from "@/components/levytate-mvp/EmployerSetupJourney";
import { useEffect, useState, type FormEvent } from "react";
import { FormField, FormGrid, MvpPanel, StatusBadge } from "@/components/levytate-mvp/MvpUi";
import { workspaceFieldGuidance } from "@/components/levytate-mvp/SetupContextHelp";
import { useMvpWorkspace } from "@/components/levytate-mvp/MvpWorkspaceStore";
import { ManagerActionsHome } from "@/components/levytate-mvp/ManagerActionsHome";
import type { EmployerSetupProgress } from "@/components/levytate-mvp/useEmployerSetupProgress";
import { isEmployerSetupRole } from "@/lib/levytate/mvp/employer-setup";
import type { ManagerOperationalActionListItem } from "@/lib/levytate/mvp/manager-operational-actions";
import {
  buildNotifications,
  employeeCurrentApplication,
  providerCoverageSummary,
  upcomingEnrolments,
  employeesNeedingSupport,
} from "@/lib/levytate/mvp/workspace-insights";
import { getApprenticeshipStandard } from "@/lib/levytate/domain";
import {
  createMvpId,
  mvpEmployerPriorityOptions,
  splitMvpList,
  type MvpEmployerPriorityImportance,
  type MvpEmployerPriorityName,
  type MvpWorkspaceProfile,
} from "@/lib/levytate/mvp/workspace";
import type { WorkspaceAccessUser } from "@/lib/server/levytate-workspace-access";
import type { MicrosoftCopilotConnectionStatus } from "@/lib/levytate/microsoft-copilot";

const importanceOptions: Array<{ value: MvpEmployerPriorityImportance; copy: string }> = [
  { value: "Critical", copy: "A defining business priority for the next 12 months." },
  { value: "High", copy: "Important and expected to shape development decisions." },
  { value: "Medium", copy: "Relevant, but balanced with other priorities." },
];

const managerReviewStatuses = ["Submitted to Line Manager", "Awaiting Manager Review"] as const;

export function DashboardModule({ onNavigate, setup }: { onNavigate: (module: string) => void; setup?: EmployerSetupProgress | null }) {
  const { data, can, meta } = useMvpWorkspace();
  const [keepSetupOpen, setKeepSetupOpen] = useState(false);
  const [reviewSetup, setReviewSetup] = useState(false);
  useEffect(() => {
    if (setup?.complete === false) setKeepSetupOpen(true);
  }, [setup?.complete]);
  const notifications = buildNotifications(data);
  const support = employeesNeedingSupport(data);
  const enrolments = upcomingEnrolments(data);
  const providerCoverage = providerCoverageSummary(data);
  const providerIssues = providerCoverage.missing.slice(0, 3);
  const primaryAction = notifications[0]
    ? { label: "Review urgent work", target: notifications[0].target ?? notifications[0].module }
    : support[0]
      ? { label: "Continue employee discovery", target: "Employees" }
      : providerIssues[0]
        ? { label: "Improve provider coverage", target: "Marketplace" }
        : { label: "Open LevyTate Copilot", target: "LevyTate Copilot" };

  const setupVisible = Boolean(setup && (!setup.complete || keepSetupOpen || reviewSetup));
  const checklist = setupVisible && setup
    ? <EmployerSetupJourney progress={setup} prioritiesPanel={<EmployerPrioritiesSetup compact readOnly={!can("settings:write")} />} onNavigate={onNavigate} onFinish={() => { setKeepSetupOpen(false); setReviewSetup(false); }} />
    : setup?.complete
      ? <section className="lt-panel flex flex-wrap items-center justify-between gap-3 px-5 py-4" data-testid="employer-setup-complete">
          <p className="flex items-center gap-2 text-sm font-semibold"><Check size={17} className="text-lt-accent" aria-hidden="true"/> Your essential setup is complete.</p>
          <button type="button" onClick={() => setReviewSetup(true)} className="min-h-11 text-sm font-semibold text-lt-accent">Review setup</button>
        </section>
      : null;

  // Setup is a single focused workspace until the employer explicitly finishes.
  // Do not render the normal attention briefing under an unfinished journey.
  if (setupVisible && checklist) return checklist;

  const overview = (
      <section className="lt-panel grid divide-y divide-lt-border sm:grid-cols-3 sm:divide-x sm:divide-y-0" aria-label="Workspace overview">
        {[{label:"Active employee records",value:data.employees.filter(item=>item.status==="Active").length},{label:"Active learner records",value:data.learnerRecords.filter(item=>item.recordStatus==="Active" && !["withdrawn","achieved","completed_without_achievement","pre_enrolment"].includes(item.lifecycleStatus)).length},{label:"Published programmes",value:data.organisationProgrammes.filter(item=>item.status==="Active").length}].map(metric=><div key={metric.label} className="px-5 py-4"><p className="text-sm text-lt-muted">{metric.label}</p><p className="mt-1 text-3xl font-semibold tabular-nums tracking-tight">{metric.value}</p></div>)}
      </section>
  );

  if (!data.profile.priorities.length && !(setupVisible && isEmployerSetupRole(meta?.userRole))) {
    if (!can("settings:write")) {
      return (
        <div className="grid gap-5">
          {checklist}
          {overview}
          <MvpPanel title="Workspace setup required" eyebrow="Protected workspace">
            <p className="text-sm leading-6 text-lt-muted">
              Employer priorities have not been configured yet. A workspace admin needs to complete setup before role-specific operating signals appear.
            </p>
          </MvpPanel>
        </div>
      );
    }

    return <div className="grid gap-5">{checklist}{overview}<EmployerPrioritiesSetup /></div>;
  }

  return (
    <div className="grid gap-5">
      {checklist}
      <section data-testid="home-attention-hero" className="lt-hero p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#8fe0d2]">Today</p>
            <h2 className="mt-1.5 text-2xl font-semibold">What needs attention?</h2>
            <p className="mt-1.5 text-sm leading-5 text-white/62">A short operating briefing. Open the next decision, then let LevyTate handle the detail.</p>
          </div>
          <button type="button" onClick={() => onNavigate(primaryAction.target)} className="lt-button lt-hero-action self-start lg:self-center">
            {primaryAction.label}
          </button>
        </div>
      </section>

      {overview}
      <div data-testid="home-attention-grid" className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <div data-testid="home-urgent-card" className="min-w-0 self-start">
          <MvpPanel title="Urgent approvals" eyebrow="Decision">
          {notifications.length ? (
            <div className="grid gap-3">
              {notifications.slice(0, 4).map((notification) => (
                <button key={notification.id} type="button" onClick={() => onNavigate(notification.target ?? notification.module)} className="lt-attention-row px-3 py-3 text-left">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-lt-ink">{notification.title}</p>
                      <p className="mt-1 text-xs leading-5 text-lt-muted">{notification.copy}</p>
                    </div>
                    <StatusBadge tone={notification.tone}>{notification.module}</StatusBadge>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm leading-6 text-lt-muted">Nothing urgent is waiting. Use LevyTate Copilot if you want to plan the next development move.</p>
          )}
          </MvpPanel>
        </div>

        <div data-testid="home-employee-card" className="min-w-0 self-start">
          <MvpPanel title="Employees requiring attention" eyebrow="People">
          <div className="grid gap-3">
            {support.length ? support.slice(0, 4).map((employee) => (
              <button key={employee.id} type="button" onClick={() => onNavigate(`Employees:${employee.id}`)} className="lt-attention-row px-3 py-3 text-left">
                <p className="text-sm font-semibold text-lt-ink">{employee.name}</p>
                <p className="mt-1 text-xs leading-5 text-lt-muted">{employee.jobTitle || "Role to confirm"} needs discovery context.</p>
              </button>
            )) : <p className="text-sm leading-6 text-lt-muted">Employee records look ready. New recommendations will appear as AI conversations progress.</p>}
          </div>
          </MvpPanel>
        </div>

        <div data-testid="home-provider-card" className="min-w-0 self-start">
          <MvpPanel title="Provider issues" eyebrow="Coverage">
          <div className="grid gap-3">
            {providerIssues.length ? providerIssues.map((issue) => (
              <ActionCard key={issue} title={issue} copy="Preferred provider coverage is not complete for this category." cta="Explore providers" onClick={() => onNavigate("Marketplace")} />
            )) : <p className="text-sm leading-6 text-lt-muted">Provider coverage is in place for the current priority areas.</p>}
            {enrolments.length ? <ActionCard title="Approved learners need handoff" copy={`${enrolments.length} enrolment record${enrolments.length === 1 ? "" : "s"} need dates, provider or learner readiness checked.`} cta="Open enrolments" onClick={() => onNavigate("Enrolments")} /> : null}
          </div>
          </MvpPanel>
        </div>
      </div>
    </div>
  );
}

export function LineManagerHomeModule({ onNavigate, onOpenApplicationReview }: {
  onNavigate: (module: string) => void;
  onOpenApplicationReview: (applicationId: string) => void;
}) {
  const { data, meta } = useMvpWorkspace();
  const [allActionsMode, setAllActionsMode] = useState(false);
  const [reviewActions, setReviewActions] = useState<ManagerOperationalActionListItem[]>([]);

  useEffect(() => {
    setAllActionsMode(new URLSearchParams(window.location.search).get("actions") === "all");
    void fetch("/api/levytate-manager/actions?kind=application_review", { cache: "no-store" })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("Review actions unavailable")))
      .then((body: { actions?: ManagerOperationalActionListItem[] }) => setReviewActions(body.actions ?? []))
      .catch(() => setReviewActions([]));
  }, []);
  const manager = data.employees.find((employee) =>
    employee.status === "Active" && employee.email.trim().toLowerCase() === (meta?.userEmail ?? "").trim().toLowerCase()
  );
  const directReports = data.employees.filter((employee) => employee.managerId === manager?.id);
  const directReportIds = new Set(directReports.map((employee) => employee.id));
  const awaitingReview = data.applications
    .filter((application) => directReportIds.has(application.employeeId) && managerReviewStatuses.includes(application.status as typeof managerReviewStatuses[number]))
    .sort((a, b) => a.submittedAt.localeCompare(b.submittedAt));
  const operationalSummaries = new Map((meta?.directReportOperationalSummaries ?? []).map((summary) => [summary.employeeId, summary]));
  const needingSupport = directReports.filter((employee) => {
    const operationalSummary = operationalSummaries.get(employee.id);
    if (operationalSummary) return operationalSummary.managerSupportState !== "no_action";
    const application = employeeCurrentApplication(data, employee.id);
    return !application || application.status === "More information requested" || application.status === "Draft";
  });
  const nextApplication = awaitingReview[0] ?? null;
  const nextEmployee = nextApplication ? data.employees.find((employee) => employee.id === nextApplication.employeeId) : null;
  const nextStandard = nextApplication ? getApprenticeshipStandard(nextApplication.apprenticeshipStandardId) : null;
  const nextReviewAction = nextApplication
    ? reviewActions.find((action) => action.sourceUrl.includes(`application=${encodeURIComponent(nextApplication.id)}`)) ?? null
    : null;

  if (allActionsMode) return <ManagerActionsHome kind="all" />;

  return (
    <div className="grid gap-5">
      <section className="rounded-[1.25rem] border border-[#102c3d]/[0.07] bg-[#102c3d] p-5 text-white shadow-[0_20px_55px_rgba(16,44,61,0.12)] sm:p-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#8fe0d2]">Line Manager</p>
            <h2 className="mt-2 text-2xl font-semibold">What needs my decision today?</h2>
            <p className="mt-2 text-sm leading-6 text-white/62">
              {awaitingReview.length
                ? `${awaitingReview.length} direct-report application${awaitingReview.length === 1 ? "" : "s"} awaiting manager review.`
                : "No direct-report applications are awaiting review right now."}
            </p>
          </div>
          <button type="button" onClick={() => nextApplication ? onOpenApplicationReview(nextApplication.id) : onNavigate("My Team")} className="h-11 self-start rounded-full bg-[#ffde59] px-5 text-sm font-semibold text-lt-ink transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#ffde59]/35 xl:self-center">
            {awaitingReview.length ? "Review application" : "View my team"}
          </button>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]">
        <MvpPanel title="Next manager decision" eyebrow="Approval review">
          {nextApplication && nextEmployee ? (
            <button type="button" aria-label={`Open review for ${nextEmployee.name}`} onClick={() => onOpenApplicationReview(nextApplication.id)} className="w-full rounded-xl border border-[#102c3d]/[0.07] bg-[#f8fbfa] p-4 text-left transition hover:border-[#159b8f]/18 hover:bg-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#159b8f]/15">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-base font-semibold text-lt-ink">{nextEmployee.name}</p>
                  <p className="mt-1 text-sm leading-6 text-lt-muted">{nextEmployee.jobTitle || "Role to confirm"} - {nextEmployee.department || "Department to confirm"}</p>
                </div>
                <div className="flex flex-wrap justify-end gap-2">
                  <StatusBadge tone="yellow">{nextApplication.status}</StatusBadge>
                  {nextReviewAction ? <StatusBadge tone={nextReviewAction.status === "in_progress" ? "green" : nextReviewAction.status === "acknowledged" ? "blue" : "yellow"}>Action: {nextReviewAction.statusLabel}</StatusBadge> : null}
                </div>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <DashboardFact label="Programme" value={nextStandard?.title ?? nextApplication.apprenticeshipStandardId} />
                <DashboardFact label="Submitted" value={nextApplication.submittedAt.slice(0, 10)} />
              </div>
              <p className="mt-4 line-clamp-2 text-sm leading-6 text-lt-muted">{nextApplication.reason || "No reason recorded yet."}</p>
              <p className="mt-4 text-xs font-semibold text-lt-accent">Open review</p>
            </button>
          ) : (
            <p className="text-sm leading-6 text-lt-muted">Your approval queue is clear. Use My Team to check direct-report development status.</p>
          )}
        </MvpPanel>

        <MvpPanel title="Direct reports needing support" eyebrow="Team support">
          <div className="grid gap-3">
            <div className="rounded-xl bg-[#f8fbfa] px-4 py-3 ring-1 ring-[#102c3d]/[0.055]">
              <p className="text-2xl font-semibold text-lt-ink">{needingSupport.length}</p>
              <p className="mt-1 text-sm leading-6 text-lt-muted">Direct reports with a current application or learner support action.</p>
            </div>
            <button type="button" onClick={() => onNavigate("My Team")} className="h-10 rounded-full bg-[#102c3d] px-4 text-xs font-semibold text-white transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#159b8f]/15">
              View my team
            </button>
          </div>
        </MvpPanel>
      </div>
      <ManagerActionsHome kind="manager_support" />
    </div>
  );
}

function DashboardFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white px-3.5 py-3 ring-1 ring-[#102c3d]/[0.055]">
      <p className="text-xs font-semibold uppercase tracking-[0.13em] text-lt-muted">{label}</p>
      <p className="mt-1 line-clamp-2 text-sm font-semibold text-lt-secondary">{value}</p>
    </div>
  );
}

function ActionCard({ title, copy, cta, onClick }: { title: string; copy: string; cta: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="lt-attention-row px-3 py-3 text-left">
      <p className="text-sm font-semibold text-lt-ink">{title}</p>
      <p className="mt-1 text-xs leading-5 text-lt-muted">{copy}</p>
      <p className="mt-3 text-xs font-semibold text-lt-accent">{cta}</p>
    </button>
  );
}

function EmployerPrioritiesSetup({ compact = false, readOnly = false }: { compact?: boolean; readOnly?: boolean }) {
  const { data, meta, saveProfile } = useMvpWorkspace();
  const [draftRevision, setDraftRevision] = useState(meta?.mutationRevisions?.[`levytate_organisations:${meta?.organisationId}`] ?? 0);
  const [step, setStep] = useState<"priorities" | "importance" | "complete">(data.profile.priorities.length ? "complete" : "priorities");
  const [selected, setSelected] = useState<MvpEmployerPriorityName[]>(data.profile.priorities.map((item) => item.name));
  const [importance, setImportance] = useState<MvpEmployerPriorityImportance>(data.profile.priorities[0]?.importance ?? "High");
  const [error, setError] = useState("");
  const { saving, perform } = useCatalogueAction(setError);

  function togglePriority(priority: MvpEmployerPriorityName) {
    setSelected((current) => current.includes(priority)
      ? current.filter((item) => item !== priority)
      : current.length < 3
        ? [...current, priority]
        : current);
  }

  async function save() {
    const saved = await perform(() => saveProfile({
      ...data.profile,
      priorities: selected.map((name) => ({
        id: data.profile.priorities.find((item) => item.name === name)?.id ?? createMvpId("priority"),
        name,
        importance,
        detail: "",
      })),
    }, draftRevision));
    if (saved) setStep("complete");
  }

  if (step === "complete") {
    return (
      <MvpPanel title="Business priorities" eyebrow="Recommendation context">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2">
            {data.profile.priorities.map((priority) => (
              <span key={priority.id} className="rounded-full bg-[#edf7f3] px-3 py-2 text-xs font-semibold text-lt-accent ring-1 ring-[#159b8f]/10">
                {priority.name} - {priority.importance}
              </span>
            ))}
          </div>
          {readOnly ? <p className="text-xs font-semibold text-lt-muted">Read-only</p> : (
            <button type="button" onClick={() => { setDraftRevision(meta?.mutationRevisions?.[`levytate_organisations:${meta?.organisationId}`] ?? 0); setStep("priorities"); }} className="shrink-0 rounded-full bg-[#f5f8f6] px-4 py-2 text-xs font-semibold text-lt-muted ring-1 ring-[#102c3d]/[0.07]">
              Refine priorities
            </button>
          )}
        </div>
      </MvpPanel>
    );
  }

  if (readOnly) {
    return (
      <MvpPanel title="Business priorities" eyebrow="Recommendation context">
        <p className="text-sm leading-6 text-lt-muted">No business priorities have been configured. A workspace administrator can add them.</p>
      </MvpPanel>
    );
  }

  return (
    <section className={`mx-auto w-full max-w-4xl rounded-[1.35rem] border border-[#102c3d]/[0.07] bg-white ${compact ? "p-5" : "p-6 sm:p-8"} shadow-[0_24px_70px_rgba(16,44,61,0.07)]`}>
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#edf7f3] text-lt-accent"><Target size={19} aria-hidden="true" /></span>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-lt-risk">Workspace setup</p>
          <p className="mt-0.5 text-xs text-lt-muted">Question {step === "priorities" ? "1" : "2"} of 2</p>
        </div>
      </div>

      {step === "priorities" ? (
        <div className="mt-6">
          <h2 className="text-2xl font-semibold">What are you hoping to achieve?</h2>
          <p className="mt-2 text-sm leading-6 text-lt-muted">Choose up to three priorities. LevyTate uses them as business context, not as a substitute for employee evidence.</p>
          <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {mvpEmployerPriorityOptions.map((priority) => {
              const active = selected.includes(priority);
              return (
                <button key={priority} type="button" onClick={() => togglePriority(priority)} aria-pressed={active} className={`flex min-h-12 items-center justify-between gap-3 rounded-xl px-3.5 py-3 text-left text-sm font-semibold ring-1 transition ${active ? "bg-[#edf7f3] text-lt-accent ring-[#159b8f]/25" : "bg-[#f8fbfa] text-lt-muted ring-[#102c3d]/[0.06] hover:bg-white hover:ring-[#159b8f]/20"}`}>
                  <span>{priority}</span>
                  {active ? <Check size={16} className="shrink-0" aria-hidden="true" /> : null}
                </button>
              );
            })}
          </div>
          <div className="mt-6 flex items-center justify-between">
            <p className="text-xs font-semibold text-lt-muted">{selected.length} of 3 selected</p>
            <button type="button" disabled={!selected.length} onClick={() => setStep("importance")} className="h-11 rounded-full bg-[#102c3d] px-5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40">Continue</button>
          </div>
        </div>
      ) : (
        <div className="mt-6">
          <h2 className="text-2xl font-semibold">How important is this over the next 12 months?</h2>
          <p className="mt-2 text-sm leading-6 text-lt-muted">This helps LevyTate weigh organisational urgency alongside role and capability evidence.</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {importanceOptions.map((option) => (
              <button key={option.value} type="button" onClick={() => setImportance(option.value)} className={`rounded-xl p-4 text-left ring-1 transition ${importance === option.value ? "bg-[#102c3d] text-white ring-[#102c3d]" : "bg-[#f8fbfa] text-lt-ink ring-[#102c3d]/[0.06] hover:ring-[#159b8f]/20"}`}>
                <p className="text-sm font-semibold">{option.value}</p>
                <p className={`mt-2 text-xs leading-5 ${importance === option.value ? "text-white/62" : "text-lt-muted"}`}>{option.copy}</p>
              </button>
            ))}
          </div>
          <div className="mt-6 flex items-center justify-between">
            <button type="button" onClick={() => setStep("priorities")} className="text-xs font-semibold text-lt-muted">Back</button>
            {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
            <button type="button" disabled={saving} onClick={save} className="h-11 rounded-full bg-[#102c3d] px-5 text-sm font-semibold text-white">{saving ? "Saving…" : "Save priorities"}</button>
          </div>
        </div>
      )}
    </section>
  );
}

export function SettingsModule() {
  const { data, saveProfile, can, meta } = useMvpWorkspace();
  const [draft, setDraft] = useState<MvpWorkspaceProfile>(data.profile);
  const [draftRevision, setDraftRevision] = useState(meta?.mutationRevisions?.[`levytate_organisations:${meta?.organisationId}`] ?? 0);
  const [saved, setSaved] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saveError, setSaveError] = useState("");
  const { saving, perform } = useCatalogueAction(setSaveError);
  const [accessUsers, setAccessUsers] = useState<WorkspaceAccessUser[] | null>(null);
  const [accessError, setAccessError] = useState("");
  const [microsoftCopilot, setMicrosoftCopilot] = useState<MicrosoftCopilotConnectionStatus | null>(null);
  const [microsoftCopilotError, setMicrosoftCopilotError] = useState("");
  const canEdit = can("settings:write");

  useEffect(() => {
    if (!dirty) { setDraft(data.profile); setDraftRevision(meta?.mutationRevisions?.[`levytate_organisations:${meta?.organisationId}`] ?? 0); }
  }, [data.profile, dirty, meta?.mutationRevisions, meta?.organisationId]);
  useEffect(() => {
    let active = true;
    void fetch("/api/levytate-workspace/access", { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json() as { users?: WorkspaceAccessUser[]; message?: string };
        if (!response.ok) throw new Error(body.message || "Workspace access could not be loaded.");
        if (active) setAccessUsers(body.users ?? []);
      })
      .catch((error: unknown) => {
        if (active) setAccessError(error instanceof Error ? error.message : "Workspace access could not be loaded.");
      });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (meta?.userRole !== "Employer Admin") return;
    let active = true;
    void fetch("/api/levytate-workspace/integrations/microsoft-copilot", { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json() as { connection?: MicrosoftCopilotConnectionStatus; message?: string };
        if (!response.ok) throw new Error(body.message || "Microsoft 365 Copilot status could not be loaded.");
        if (active) setMicrosoftCopilot(body.connection ?? null);
      })
      .catch((error: unknown) => {
        if (active) setMicrosoftCopilotError(error instanceof Error ? error.message : "Microsoft 365 Copilot status could not be loaded.");
      });
    return () => { active = false; };
  }, [meta?.userRole]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!canEdit) return;
    setSaved(false);
    const confirmed = await perform(() => saveProfile({
      ...draft,
      priorities: data.profile.priorities,
      sites: splitMvpList(draft.sites.join(", ")),
      departments: splitMvpList(draft.departments.join(", ")),
    }, draftRevision));
    if (confirmed) { setSaved(true); setDirty(false); }
  }

  return (
    <div className="grid gap-5">
      <EmployerPrioritiesSetup compact readOnly={!canEdit} />
      <details className="group rounded-[1.25rem] border border-[#102c3d]/[0.07] bg-white shadow-[0_16px_44px_rgba(16,44,61,0.045)]">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4">
          <div>
            <p className="text-sm font-semibold">Workspace details</p>
            <p className="mt-1 text-xs text-lt-muted">Organisation, contacts, sites and departments</p>
          </div>
          <ChevronDown size={18} className="text-lt-muted transition group-open:rotate-180" aria-hidden="true" />
        </summary>
        {canEdit ? (
          <form onSubmit={submit} onChange={() => { setDirty(true); setSaved(false); }} className="border-t border-[#102c3d]/[0.07] p-5"><fieldset disabled={saving}>
            <FormGrid>
              <FormField label="Employer name" value={draft.employerName} onChange={(value) => setDraft({ ...draft, employerName: value })} help={workspaceFieldGuidance.employerName} />
              <FormField label="Workspace name" value={draft.workspaceName} onChange={(value) => setDraft({ ...draft, workspaceName: value })} help={workspaceFieldGuidance.workspaceName} required />
              <FormField label="Primary contact" value={draft.primaryContact} onChange={(value) => setDraft({ ...draft, primaryContact: value })} help={workspaceFieldGuidance.primaryContact} />
              <FormField label="Contact email" type="email" value={draft.contactEmail} onChange={(value) => setDraft({ ...draft, contactEmail: value })} help={workspaceFieldGuidance.contactEmail} />
              <FormField label="Default site" value={draft.defaultSite} onChange={(value) => setDraft({ ...draft, defaultSite: value })} help={workspaceFieldGuidance.defaultSite} hint="Your main physical work location, not your website." />
              <FormField label="Sites" value={draft.sites.join(", ")} onChange={(value) => setDraft({ ...draft, sites: splitMvpList(value) })} help={workspaceFieldGuidance.sites} hint="Offices, depots or other physical workplaces — not web addresses." />
              <FormField label="Departments" value={draft.departments.join(", ")} onChange={(value) => setDraft({ ...draft, departments: splitMvpList(value) })} help={workspaceFieldGuidance.departments} wide />
            </FormGrid>
            <div className="mt-5 flex items-center justify-between border-t border-[#102c3d]/[0.07] pt-4">
              {saveError ? <p role="alert" className="text-sm text-red-700">{saveError}</p> : saved ? <p role="status" className="text-xs font-semibold text-lt-accent">Workspace saved.</p> : <span />}
              <button className="h-10 rounded-full bg-[#102c3d] px-5 text-xs font-semibold text-white">{saving ? "Saving…" : "Save details"}</button>
            </div>
          </fieldset></form>
        ) : (
          <div className="border-t border-[#102c3d]/[0.07] p-5">
            <div className="grid gap-4 md:grid-cols-2">
              <ReadOnlySetting label="Employer name" value={data.profile.employerName} />
              <ReadOnlySetting label="Workspace name" value={data.profile.workspaceName} />
              <ReadOnlySetting label="Primary contact" value={data.profile.primaryContact} />
              <ReadOnlySetting label="Contact email" value={data.profile.contactEmail} />
              <ReadOnlySetting label="Default site" value={data.profile.defaultSite} />
              <ReadOnlySetting label="Sites" value={data.profile.sites.join(", ")} />
              <ReadOnlySetting label="Departments" value={data.profile.departments.join(", ")} wide />
            </div>
            <p className="mt-5 border-t border-[#102c3d]/[0.07] pt-4 text-xs font-semibold text-lt-muted">Workspace settings are read-only for this role.</p>
          </div>
        )}
      </details>
      <MvpPanel title="Authorised users" eyebrow="Access">
        {accessError ? (
          <p className="text-sm leading-6 text-lt-risk">{accessError}</p>
        ) : accessUsers === null ? (
          <p className="text-sm leading-6 text-lt-muted">Loading authorised users...</p>
        ) : accessUsers.length ? (
          <div className="grid gap-2">
            {accessUsers.map((user) => (
              <div key={user.id} className="grid gap-3 rounded-xl border border-[#102c3d]/[0.07] bg-[#f8fbfa] px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center">
                <div className="min-w-0"><p className="truncate text-sm font-semibold text-lt-ink">{user.displayName}</p><p className="truncate text-xs text-lt-muted">{user.email}</p></div>
                <StatusBadge tone="blue">{user.role}</StatusBadge>
                <StatusBadge tone={user.accessState === "Active" ? "green" : "red"}>{user.accessState} · {user.authenticationState}</StatusBadge>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm leading-6 text-lt-muted">No authorised users are configured.</p>
        )}
        <p className="mt-4 border-t border-[#102c3d]/[0.07] pt-4 text-xs leading-5 text-lt-muted">Platform Admin controls user provisioning, roles and access state. Workspace settings never expose authentication credentials.</p>
      </MvpPanel>
      {meta?.userRole === "Employer Admin" ? (
        <MvpPanel title="Microsoft 365 Copilot" eyebrow="Integrations">
          {microsoftCopilotError ? (
            <p className="text-sm leading-6 text-lt-risk">{microsoftCopilotError}</p>
          ) : microsoftCopilot === null ? (
            <p className="text-sm leading-6 text-lt-muted">Loading connection status...</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
              <div>
                <p className="text-sm font-semibold text-lt-ink">{microsoftCopilot.displayName || "LevyTate for Microsoft 365 Copilot"}</p>
                <p className="mt-1 text-sm leading-6 text-lt-muted">Read-only access to role-scoped LevyTate operations through your organisation&apos;s Microsoft tenant.</p>
                <p className="mt-3 text-xs leading-5 text-lt-muted">Connection identifiers, bearer tokens and credentials are never displayed here. Setup and tenant consent are completed by an authorised administrator.</p>
              </div>
              <StatusBadge tone={microsoftCopilot.status === "active" && microsoftCopilot.runtimeEnabled && microsoftCopilot.organisationEnabled ? "green" : "blue"}>
                {microsoftCopilot.status === "active" && microsoftCopilot.runtimeEnabled && microsoftCopilot.organisationEnabled ? "Connected" : microsoftCopilot.status === "suspended" ? "Suspended" : "Not active"}
              </StatusBadge>
              <div className="grid gap-2 border-t border-[#102c3d]/[0.07] pt-4 text-xs text-lt-muted sm:col-span-2 sm:grid-cols-2">
                <p>Connected: <span className="font-semibold text-lt-ink">{microsoftCopilot.connectedAt ? new Date(microsoftCopilot.connectedAt).toLocaleDateString("en-GB") : "Not configured"}</span></p>
                <p>Last activity: <span className="font-semibold text-lt-ink">{microsoftCopilot.lastSuccessfulActivityAt ? new Date(microsoftCopilot.lastSuccessfulActivityAt).toLocaleString("en-GB") : "No activity recorded"}</span></p>
              </div>
            </div>
          )}
        </MvpPanel>
      ) : null}
    </div>
  );
}

function ReadOnlySetting({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={wide ? "md:col-span-2" : ""}>
      <p className="text-xs font-semibold text-lt-muted">{label}</p>
      <p className="mt-1 text-sm font-medium text-lt-ink">{value || "Not configured"}</p>
    </div>
  );
}
