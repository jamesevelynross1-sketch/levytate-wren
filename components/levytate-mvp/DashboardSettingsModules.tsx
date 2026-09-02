"use client";

import { Check, ChevronDown, Target } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { FormField, FormGrid, MvpPanel, StatusBadge } from "@/components/levytate-mvp/MvpUi";
import { useMvpWorkspace } from "@/components/levytate-mvp/MvpWorkspaceStore";
import { ManagerActionsHome } from "@/components/levytate-mvp/ManagerActionsHome";
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

const importanceOptions: Array<{ value: MvpEmployerPriorityImportance; copy: string }> = [
  { value: "Critical", copy: "A defining business priority for the next 12 months." },
  { value: "High", copy: "Important and expected to shape development decisions." },
  { value: "Medium", copy: "Relevant, but balanced with other priorities." },
];

const managerReviewStatuses = ["Submitted to Line Manager", "Awaiting Manager Review"] as const;

export function DashboardModule({ onNavigate }: { onNavigate: (module: string) => void }) {
  const { data, can } = useMvpWorkspace();
  const notifications = buildNotifications(data);
  const support = employeesNeedingSupport(data);
  const enrolments = upcomingEnrolments(data);
  const providerCoverage = providerCoverageSummary(data);
  const providerIssues = providerCoverage.missing.slice(0, 3);
  const primaryAction = notifications[0]
    ? { label: "Review urgent work", target: notifications[0].module }
    : support[0]
      ? { label: "Continue employee discovery", target: "Employees" }
      : providerIssues[0]
        ? { label: "Improve provider coverage", target: "Provider Relationships" }
        : { label: "Open LevyTate Copilot", target: "LevyTate Copilot" };

  const setupSteps = [
    { label: "Add your first employee", complete: data.employees.length > 0, target: "Employees" },
    { label: "Add a provider", complete: data.organisationProviders.some((item) => item.status === "Active"), target: "Marketplace" },
    { label: "Publish a programme", complete: data.organisationProgrammes.some((item) => item.status === "Active"), target: "Marketplace" },
    { label: "Import an existing learner", complete: data.learnerRecords.length > 0, target: "Learners" },
    { label: "Bring in DAS finance data", complete: false, target: "Finance" },
  ];

  if (data.employees.length === 0 && data.applications.length === 0 && data.learnerRecords.length === 0) {
    return <ClientSetupHome steps={setupSteps} onNavigate={onNavigate} />;
  }

  if (!data.profile.priorities.length) {
    if (!can("settings:write")) {
      return (
        <MvpPanel title="Workspace setup required" eyebrow="Protected workspace">
          <p className="text-sm leading-6 text-[#102c3d]/58">
            Employer priorities have not been configured yet. A workspace admin needs to complete setup before role-specific operating signals appear.
          </p>
        </MvpPanel>
      );
    }

    return <EmployerPrioritiesSetup />;
  }

  return (
    <div className="grid gap-5">
      <section className="rounded-[1.25rem] border border-[#102c3d]/[0.07] bg-[#102c3d] p-5 text-white shadow-[0_20px_55px_rgba(16,44,61,0.12)] sm:p-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div className="max-w-2xl">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8fe0d2]">Today</p>
            <h2 className="mt-2 text-2xl font-semibold">What needs attention?</h2>
            <p className="mt-2 text-sm leading-6 text-white/62">A short operating briefing. Open the next decision, then let LevyTate handle the detail.</p>
          </div>
          <button type="button" onClick={() => onNavigate(primaryAction.target)} className="h-11 self-start rounded-full bg-[#ffde59] px-5 text-sm font-semibold text-[#102c3d] transition hover:-translate-y-0.5 xl:self-center">
            {primaryAction.label}
          </button>
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-3">
        <MvpPanel title="Urgent approvals" eyebrow="Decision">
          {notifications.length ? (
            <div className="grid gap-3">
              {notifications.slice(0, 4).map((notification) => (
                <button key={notification.id} type="button" onClick={() => onNavigate(notification.module)} className="rounded-xl border border-[#102c3d]/[0.07] bg-[#f8fbfa] px-4 py-3 text-left transition hover:border-[#159b8f]/18 hover:bg-white">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-[#102c3d]">{notification.title}</p>
                      <p className="mt-1 text-xs leading-5 text-[#102c3d]/54">{notification.copy}</p>
                    </div>
                    <StatusBadge tone={notification.tone}>{notification.module}</StatusBadge>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm leading-6 text-[#102c3d]/56">Nothing urgent is waiting. Use LevyTate Copilot if you want to plan the next development move.</p>
          )}
        </MvpPanel>

        <MvpPanel title="Employees requiring attention" eyebrow="People">
          <div className="grid gap-3">
            {support.length ? support.slice(0, 4).map((employee) => (
              <button key={employee.id} type="button" onClick={() => onNavigate("Employees")} className="rounded-xl border border-[#102c3d]/[0.07] bg-[#f8fbfa] px-4 py-3 text-left transition hover:border-[#159b8f]/18 hover:bg-white">
                <p className="text-sm font-semibold text-[#102c3d]">{employee.name}</p>
                <p className="mt-1 text-xs leading-5 text-[#102c3d]/54">{employee.jobTitle || "Role to confirm"} needs discovery context.</p>
              </button>
            )) : <p className="text-sm leading-6 text-[#102c3d]/56">Employee records look ready. New recommendations will appear as AI conversations progress.</p>}
          </div>
        </MvpPanel>

        <MvpPanel title="Provider issues" eyebrow="Coverage">
          <div className="grid gap-3">
            {providerIssues.length ? providerIssues.map((issue) => (
              <ActionCard key={issue} title={issue} copy="Preferred provider coverage is not complete for this category." cta="Resolve" onClick={() => onNavigate("Provider Relationships")} />
            )) : <p className="text-sm leading-6 text-[#102c3d]/56">Provider coverage is in place for the current priority areas.</p>}
            {enrolments.length ? <ActionCard title="Approved learners need handoff" copy={`${enrolments.length} enrolment record${enrolments.length === 1 ? "" : "s"} need dates, provider or learner readiness checked.`} cta="Open enrolments" onClick={() => onNavigate("Enrolments")} /> : null}
          </div>
        </MvpPanel>
      </div>
    </div>
  );
}

function ClientSetupHome({ steps, onNavigate }: { steps: Array<{ label: string; complete: boolean; target: string }>; onNavigate: (module: string) => void }) {
  const complete = steps.filter((step) => step.complete).length;
  return <div className="grid gap-5" data-testid="blank-employer-home">
    <section className="rounded-[1.25rem] bg-[#102c3d] p-6 text-white sm:p-7"><p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8fe0d2]">Client workspace</p><h2 className="mt-2 text-2xl font-semibold">Set up your LevyTate workspace</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-white/65">Start with your people and the providers and programmes you want employees to use. No demonstration records have been added.</p><p className="mt-5 text-sm font-semibold">{complete} of {steps.length} setup steps complete</p></section>
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{steps.map((step, index) => <button key={step.label} type="button" onClick={() => onNavigate(step.target)} className="flex min-h-28 items-start gap-4 border border-[#102c3d]/[0.08] bg-white p-5 text-left shadow-[0_10px_24px_rgba(16,44,61,0.035)] hover:border-[#159b8f]/30"><span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-semibold ${step.complete ? "bg-[#159b8f] text-white" : "bg-[#edf7f3] text-[#0b6f63]"}`}>{step.complete ? <Check size={15} /> : index + 1}</span><span><strong className="block text-sm">{step.label}</strong><span className="mt-2 block text-xs text-[#102c3d]/[0.48]">{step.complete ? "Complete" : "Open setup"}</span></span></button>)}</section>
  </div>;
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
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8fe0d2]">Line Manager</p>
            <h2 className="mt-2 text-2xl font-semibold">What needs my decision today?</h2>
            <p className="mt-2 text-sm leading-6 text-white/62">
              {awaitingReview.length
                ? `${awaitingReview.length} direct-report application${awaitingReview.length === 1 ? "" : "s"} awaiting manager review.`
                : "No direct-report applications are awaiting review right now."}
            </p>
          </div>
          <button type="button" onClick={() => nextApplication ? onOpenApplicationReview(nextApplication.id) : onNavigate("My Team")} className="h-11 self-start rounded-full bg-[#ffde59] px-5 text-sm font-semibold text-[#102c3d] transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#ffde59]/35 xl:self-center">
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
                  <p className="text-base font-semibold text-[#102c3d]">{nextEmployee.name}</p>
                  <p className="mt-1 text-sm leading-6 text-[#102c3d]/58">{nextEmployee.jobTitle || "Role to confirm"} - {nextEmployee.department || "Department to confirm"}</p>
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
              <p className="mt-4 line-clamp-2 text-sm leading-6 text-[#102c3d]/62">{nextApplication.reason || "No reason recorded yet."}</p>
              <p className="mt-4 text-xs font-semibold text-[#0b6f63]">Open review</p>
            </button>
          ) : (
            <p className="text-sm leading-6 text-[#102c3d]/56">Your approval queue is clear. Use My Team to check direct-report development status.</p>
          )}
        </MvpPanel>

        <MvpPanel title="Direct reports needing support" eyebrow="Team support">
          <div className="grid gap-3">
            <div className="rounded-xl bg-[#f8fbfa] px-4 py-3 ring-1 ring-[#102c3d]/[0.055]">
              <p className="text-2xl font-semibold text-[#102c3d]">{needingSupport.length}</p>
              <p className="mt-1 text-sm leading-6 text-[#102c3d]/56">Direct reports with a current application or learner support action.</p>
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
      <p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-[#102c3d]/38">{label}</p>
      <p className="mt-1 line-clamp-2 text-sm font-semibold text-[#102c3d]/72">{value}</p>
    </div>
  );
}

function ActionCard({ title, copy, cta, onClick }: { title: string; copy: string; cta: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="rounded-xl border border-[#102c3d]/[0.07] bg-[#f8fbfa] px-4 py-3 text-left transition hover:border-[#159b8f]/18 hover:bg-white">
      <p className="text-sm font-semibold text-[#102c3d]">{title}</p>
      <p className="mt-1 text-xs leading-5 text-[#102c3d]/54">{copy}</p>
      <p className="mt-3 text-xs font-semibold text-[#0b6f63]">{cta}</p>
    </button>
  );
}

function EmployerPrioritiesSetup({ compact = false, readOnly = false }: { compact?: boolean; readOnly?: boolean }) {
  const { data, saveProfile } = useMvpWorkspace();
  const [step, setStep] = useState<"priorities" | "importance" | "complete">(data.profile.priorities.length ? "complete" : "priorities");
  const [selected, setSelected] = useState<MvpEmployerPriorityName[]>(data.profile.priorities.map((item) => item.name));
  const [importance, setImportance] = useState<MvpEmployerPriorityImportance>(data.profile.priorities[0]?.importance ?? "High");

  useEffect(() => {
    if (!data.profile.priorities.length) return;
    setSelected(data.profile.priorities.map((item) => item.name));
    setImportance(data.profile.priorities[0]?.importance ?? "High");
  }, [data.profile.priorities]);

  function togglePriority(priority: MvpEmployerPriorityName) {
    setSelected((current) => current.includes(priority)
      ? current.filter((item) => item !== priority)
      : current.length < 3
        ? [...current, priority]
        : current);
  }

  function save() {
    saveProfile({
      ...data.profile,
      priorities: selected.map((name) => ({
        id: data.profile.priorities.find((item) => item.name === name)?.id ?? createMvpId("priority"),
        name,
        importance,
        detail: "",
      })),
    });
    setStep("complete");
  }

  if (step === "complete") {
    return (
      <MvpPanel title="Business priorities" eyebrow="Recommendation context">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2">
            {data.profile.priorities.map((priority) => (
              <span key={priority.id} className="rounded-full bg-[#edf7f3] px-3 py-2 text-xs font-semibold text-[#0b6f63] ring-1 ring-[#159b8f]/10">
                {priority.name} - {priority.importance}
              </span>
            ))}
          </div>
          {readOnly ? <p className="text-xs font-semibold text-[#102c3d]/42">Read-only</p> : (
            <button type="button" onClick={() => setStep("priorities")} className="shrink-0 rounded-full bg-[#f5f8f6] px-4 py-2 text-xs font-semibold text-[#102c3d]/64 ring-1 ring-[#102c3d]/[0.07]">
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
        <p className="text-sm leading-6 text-[#102c3d]/58">No business priorities have been configured. A workspace administrator can add them.</p>
      </MvpPanel>
    );
  }

  return (
    <section className={`mx-auto w-full max-w-4xl rounded-[1.35rem] border border-[#102c3d]/[0.07] bg-white ${compact ? "p-5" : "p-6 sm:p-8"} shadow-[0_24px_70px_rgba(16,44,61,0.07)]`}>
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#edf7f3] text-[#0b8e82]"><Target size={19} aria-hidden="true" /></span>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#c95568]">Workspace setup</p>
          <p className="mt-0.5 text-xs text-[#102c3d]/48">Question {step === "priorities" ? "1" : "2"} of 2</p>
        </div>
      </div>

      {step === "priorities" ? (
        <div className="mt-6">
          <h2 className="text-2xl font-semibold">What are you hoping to achieve?</h2>
          <p className="mt-2 text-sm leading-6 text-[#102c3d]/56">Choose up to three priorities. LevyTate uses them as business context, not as a substitute for employee evidence.</p>
          <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {mvpEmployerPriorityOptions.map((priority) => {
              const active = selected.includes(priority);
              return (
                <button key={priority} type="button" onClick={() => togglePriority(priority)} aria-pressed={active} className={`flex min-h-12 items-center justify-between gap-3 rounded-xl px-3.5 py-3 text-left text-sm font-semibold ring-1 transition ${active ? "bg-[#edf7f3] text-[#0b6f63] ring-[#159b8f]/25" : "bg-[#f8fbfa] text-[#102c3d]/64 ring-[#102c3d]/[0.06] hover:bg-white hover:ring-[#159b8f]/20"}`}>
                  <span>{priority}</span>
                  {active ? <Check size={16} className="shrink-0" aria-hidden="true" /> : null}
                </button>
              );
            })}
          </div>
          <div className="mt-6 flex items-center justify-between">
            <p className="text-xs font-semibold text-[#102c3d]/42">{selected.length} of 3 selected</p>
            <button type="button" disabled={!selected.length} onClick={() => setStep("importance")} className="h-11 rounded-full bg-[#102c3d] px-5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40">Continue</button>
          </div>
        </div>
      ) : (
        <div className="mt-6">
          <h2 className="text-2xl font-semibold">How important is this over the next 12 months?</h2>
          <p className="mt-2 text-sm leading-6 text-[#102c3d]/56">This helps LevyTate weigh organisational urgency alongside role and capability evidence.</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {importanceOptions.map((option) => (
              <button key={option.value} type="button" onClick={() => setImportance(option.value)} className={`rounded-xl p-4 text-left ring-1 transition ${importance === option.value ? "bg-[#102c3d] text-white ring-[#102c3d]" : "bg-[#f8fbfa] text-[#102c3d] ring-[#102c3d]/[0.06] hover:ring-[#159b8f]/20"}`}>
                <p className="text-sm font-semibold">{option.value}</p>
                <p className={`mt-2 text-xs leading-5 ${importance === option.value ? "text-white/62" : "text-[#102c3d]/52"}`}>{option.copy}</p>
              </button>
            ))}
          </div>
          <div className="mt-6 flex items-center justify-between">
            <button type="button" onClick={() => setStep("priorities")} className="text-xs font-semibold text-[#102c3d]/52">Back</button>
            <button type="button" onClick={save} className="h-11 rounded-full bg-[#102c3d] px-5 text-sm font-semibold text-white">Save priorities</button>
          </div>
        </div>
      )}
    </section>
  );
}

export function SettingsModule() {
  const { data, saveProfile, can } = useMvpWorkspace();
  const [draft, setDraft] = useState<MvpWorkspaceProfile>(data.profile);
  const [saved, setSaved] = useState(false);
  const [accessUsers, setAccessUsers] = useState<WorkspaceAccessUser[] | null>(null);
  const [accessError, setAccessError] = useState("");
  const canEdit = can("settings:write");

  useEffect(() => { setDraft(data.profile); }, [data.profile]);
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

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!canEdit) return;
    saveProfile({
      ...draft,
      priorities: data.profile.priorities,
      sites: splitMvpList(draft.sites.join(", ")),
      departments: splitMvpList(draft.departments.join(", ")),
    });
    setSaved(true);
  }

  return (
    <div className="grid gap-5">
      <EmployerPrioritiesSetup compact readOnly={!canEdit} />
      <details className="group rounded-[1.25rem] border border-[#102c3d]/[0.07] bg-white shadow-[0_16px_44px_rgba(16,44,61,0.045)]">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4">
          <div>
            <p className="text-sm font-semibold">Workspace details</p>
            <p className="mt-1 text-xs text-[#102c3d]/48">Organisation, contacts, sites and departments</p>
          </div>
          <ChevronDown size={18} className="text-[#102c3d]/42 transition group-open:rotate-180" aria-hidden="true" />
        </summary>
        {canEdit ? (
          <form onSubmit={submit} className="border-t border-[#102c3d]/[0.07] p-5">
            <FormGrid>
              <FormField label="Employer name" value={draft.employerName} onChange={(value) => setDraft({ ...draft, employerName: value })} />
              <FormField label="Workspace name" value={draft.workspaceName} onChange={(value) => setDraft({ ...draft, workspaceName: value })} required />
              <FormField label="Primary contact" value={draft.primaryContact} onChange={(value) => setDraft({ ...draft, primaryContact: value })} />
              <FormField label="Contact email" type="email" value={draft.contactEmail} onChange={(value) => setDraft({ ...draft, contactEmail: value })} />
              <FormField label="Default site" value={draft.defaultSite} onChange={(value) => setDraft({ ...draft, defaultSite: value })} />
              <FormField label="Sites" value={draft.sites.join(", ")} onChange={(value) => setDraft({ ...draft, sites: splitMvpList(value) })} />
              <FormField label="Departments" value={draft.departments.join(", ")} onChange={(value) => setDraft({ ...draft, departments: splitMvpList(value) })} wide />
            </FormGrid>
            <div className="mt-5 flex items-center justify-between border-t border-[#102c3d]/[0.07] pt-4">
              {saved ? <p className="text-xs font-semibold text-[#0b6f63]">Workspace saved.</p> : <span />}
              <button className="h-10 rounded-full bg-[#102c3d] px-5 text-xs font-semibold text-white">Save details</button>
            </div>
          </form>
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
            <p className="mt-5 border-t border-[#102c3d]/[0.07] pt-4 text-xs font-semibold text-[#102c3d]/42">Workspace settings are read-only for this role.</p>
          </div>
        )}
      </details>
      <MvpPanel title="Authorised users" eyebrow="Access">
        {accessError ? (
          <p className="text-sm leading-6 text-[#ad344e]">{accessError}</p>
        ) : accessUsers === null ? (
          <p className="text-sm leading-6 text-[#102c3d]/56">Loading authorised users...</p>
        ) : accessUsers.length ? (
          <div className="grid gap-2">
            {accessUsers.map((user) => (
              <div key={user.id} className="grid gap-3 rounded-xl border border-[#102c3d]/[0.07] bg-[#f8fbfa] px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center">
                <div className="min-w-0"><p className="truncate text-sm font-semibold text-[#102c3d]">{user.displayName}</p><p className="truncate text-xs text-[#102c3d]/52">{user.email}</p></div>
                <StatusBadge tone="blue">{user.role}</StatusBadge>
                <StatusBadge tone={user.accessState === "Active" ? "green" : "red"}>{user.accessState} · {user.authenticationState}</StatusBadge>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm leading-6 text-[#102c3d]/56">No authorised users are configured.</p>
        )}
        <p className="mt-4 border-t border-[#102c3d]/[0.07] pt-4 text-xs leading-5 text-[#102c3d]/48">Platform Admin controls user provisioning, roles and access state. Workspace settings never expose authentication credentials.</p>
      </MvpPanel>
    </div>
  );
}

function ReadOnlySetting({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={wide ? "md:col-span-2" : ""}>
      <p className="text-xs font-semibold text-[#102c3d]/48">{label}</p>
      <p className="mt-1 text-sm font-medium text-[#102c3d]">{value || "Not configured"}</p>
    </div>
  );
}
