"use client";

import { CheckCircle2, Clock3, FileText, GraduationCap, LockKeyhole, MessageCircle, ShieldCheck } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import type { LucideIcon } from "lucide-react";
import { getApprenticeshipStandard } from "@/lib/levytate/domain";
import {
  applicationOwnerForStatus,
  buildApplicationHistoryEntry,
  createMvpId,
  nowIso,
  type MvpApplication,
  type MvpEmployee,
  type MvpEmployeeDevelopmentProfile,
  type MvpPathwayMapping,
  type MvpRole,
  type MvpWorkspaceData,
} from "@/lib/levytate/mvp/workspace";
import { employeeCurrentApplication, managerName } from "@/lib/levytate/mvp/workspace-insights";
import { useMvpWorkspace } from "@/components/levytate-mvp/MvpWorkspaceStore";
import {
  FormGrid,
  FormTextArea,
  MvpPanel,
  StatusBadge,
} from "@/components/levytate-mvp/MvpUi";
import { statusTone } from "@/components/levytate-mvp/module-utils";

type EmployeeModuleTarget = "Home" | "My Programme" | "My Application" | "Copilot" | "Knowledge";

type EmployeeContext = {
  employee: MvpEmployee | null;
  role: MvpRole | null;
  profile: MvpEmployeeDevelopmentProfile | null;
  application: MvpApplication | null;
  mapping: MvpPathwayMapping | null;
  standardTitle: string;
  standardLevel: string;
  programmeName: string;
  providerName: string;
};

const employeeQuestions = {
  reason: "Why are you interested in this programme?",
  careerGoal: "How could it help your current role or future development?",
  supportRequired: "What support will you need from your manager?",
  managerNote: "Is there anything your manager should know before reviewing the application?",
};

const applicationStages = [
  "Not started",
  "Draft",
  "Submitted",
  "Manager review",
  "More information requested",
  "Manager approved",
  "Apprenticeship Lead review",
  "Approved for enrolment",
  "Declined",
] as const;

type EmployeeApplicationState =
  | "none"
  | "draft"
  | "manager-review"
  | "more-info"
  | "manager-approved"
  | "lead-review"
  | "approved-enrolment"
  | "declined";

type EmployeeActionSummary = {
  primaryLabel: string;
  target: EmployeeModuleTarget;
  heading: string;
  copy: string;
  owner: string;
};

export function EmployeeHomeModule({ onNavigate }: { onNavigate: (target: EmployeeModuleTarget) => void }) {
  const { data } = useMvpWorkspace();
  const context = useEmployeeContext(data);
  const nextAction = nextEmployeeAction(context, data);

  if (!context.employee) return <EmployeeSetupNotice />;

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
      <section className="rounded-2xl border border-[#102c3d]/[0.07] bg-white p-6 shadow-[0_18px_44px_rgba(16,44,61,0.055)]">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#c95568]">Employee workspace</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-[-0.025em] text-[#102c3d]">Good to see you, {firstName(context.employee.name)}.</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#102c3d]/58">
          Your LevyTate workspace is focused on one thing: knowing where you are now and what you should do next.
        </p>

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <EmployeeSummaryTile label="Recommended programme" value={context.programmeName} />
          <EmployeeSummaryTile label="Current application" value={employeeStatusLabel(context.application)} />
          <EmployeeSummaryTile label="Line manager" value={managerName(data, context.employee)} />
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <button type="button" onClick={() => onNavigate(nextAction.target)} className="inline-flex h-11 items-center justify-center rounded-full bg-[#102c3d] px-5 text-xs font-semibold text-white shadow-[0_12px_24px_rgba(16,44,61,0.14)] transition hover:-translate-y-0.5 hover:bg-[#17394d]">
            {nextAction.primaryLabel}
          </button>
          <button type="button" onClick={() => onNavigate("Copilot")} className="inline-flex h-11 items-center justify-center rounded-full bg-white px-5 text-xs font-semibold text-[#102c3d] ring-1 ring-[#102c3d]/[0.1] transition hover:-translate-y-0.5 hover:ring-[#159b8f]/25">
            Ask LevyTate Copilot
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-[#102c3d]/[0.07] bg-white p-6 shadow-[0_18px_44px_rgba(16,44,61,0.055)]">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#0b6f63]">Needs attention</p>
        <h2 className="mt-2 text-xl font-semibold text-[#102c3d]">What should I do next?</h2>
        <div className="mt-4 rounded-xl border border-[#102c3d]/[0.07] bg-[#f8fbfa] p-4">
          <div className="flex items-start gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#e9f7f2] text-[#0b6f63]">
              <FileText size={17} strokeWidth={1.9} aria-hidden="true" />
            </span>
            <div>
          <p className="text-sm font-semibold text-[#102c3d]">{nextAction.heading}</p>
          <p className="mt-1 text-sm leading-6 text-[#102c3d]/56">{nextAction.copy}</p>
          <p className="mt-2 text-xs font-semibold text-[#102c3d]/46">Next owner: {nextAction.owner}</p>
            </div>
          </div>
        </div>
        {context.application ? (
          <div className="mt-4">
            <ApplicationProgress application={context.application} compact />
          </div>
        ) : null}
      </section>
    </div>
  );
}

export function EmployeeProgrammeModule({ onNavigate }: { onNavigate: (target: EmployeeModuleTarget) => void }) {
  const { data } = useMvpWorkspace();
  const context = useEmployeeContext(data);
  const standard = context.mapping ? getApprenticeshipStandard(context.mapping.apprenticeshipStandardId) : null;
  const capabilities = [
    ...(context.profile?.futureCapabilities ?? []),
    ...(context.profile?.dataOpportunities ?? []),
    ...(context.profile?.aiOpportunities ?? []),
    ...(context.profile?.automationOpportunities ?? []),
  ].filter(Boolean).slice(0, 8);

  if (!context.employee) return <EmployeeSetupNotice />;

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
      <MvpPanel title={context.programmeName} eyebrow="My programme">
        <div className="grid gap-5">
          <div className="rounded-xl border border-[#102c3d]/[0.07] bg-[#f8fbfa] p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-[#102c3d]">{context.standardTitle}</p>
                <p className="mt-1 text-sm leading-6 text-[#102c3d]/56">
                  Suggested for your role as {context.employee.jobTitle}. This page explains what the programme involves and what you need to do next.
                </p>
              </div>
              <StatusBadge tone="green">{context.providerName}</StatusBadge>
            </div>
          </div>

          <section className="grid gap-4 lg:grid-cols-2">
            <InfoBlock title="Why it is relevant" copy={context.mapping?.businessRationale || "This programme is mapped to your assigned role and development profile."} />
            <InfoBlock title="Skills you will build" copy={capabilities.length ? capabilities.join(", ") : "Role capability, confidence and progression readiness."} />
            <InfoBlock title="Expected outcomes" copy="Clearer evidence of capability, stronger workplace contribution and a structured route into future responsibilities." />
            <InfoBlock title="Delivery and commitment" copy={`${deliveryForProgramme(data, context.mapping)}. Typical duration ${standard?.typicalDuration ?? "to be confirmed"}. Time commitment will be agreed with your manager before enrolment.`} />
          </section>

          <details className="rounded-xl border border-[#102c3d]/[0.07] bg-white p-4">
            <summary className="cursor-pointer text-sm font-semibold text-[#102c3d]">Funding and programme details</summary>
            <div className="mt-4 grid gap-3 text-sm leading-6 text-[#102c3d]/62 sm:grid-cols-2">
              <p><span className="font-semibold text-[#102c3d]">Level:</span> {context.standardLevel}</p>
              <p><span className="font-semibold text-[#102c3d]">Funding route:</span> {context.mapping?.fundingRoute ?? "Potentially funded through levy/co-investment"}</p>
              <p><span className="font-semibold text-[#102c3d]">Reference:</span> {standard?.referenceCode ?? "To confirm"}</p>
              <p><span className="font-semibold text-[#102c3d]">Route:</span> {standard?.occupationalRoute ?? "To confirm"}</p>
            </div>
          </details>

          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={() => onNavigate("My Application")} className="inline-flex h-10 items-center justify-center rounded-full bg-[#102c3d] px-5 text-xs font-semibold text-white">
              Open my application
            </button>
            <button type="button" onClick={() => onNavigate("Copilot")} className="inline-flex h-10 items-center justify-center rounded-full bg-white px-5 text-xs font-semibold text-[#102c3d]/70 ring-1 ring-[#102c3d]/[0.1]">
              Ask about this programme
            </button>
          </div>
        </div>
      </MvpPanel>

      <aside className="grid gap-4 content-start">
        <SideCard icon={GraduationCap} title="What you need to do" copy="Review the programme, complete your application answers and speak with your manager about support and workload." />
        <SideCard icon={ShieldCheck} title="Employer support" copy="Your manager and apprenticeship lead will review fit, work impact and readiness before any enrolment." />
      </aside>
    </div>
  );
}

export function EmployeeApplicationModule() {
  const { data, saveApplication } = useMvpWorkspace();
  const context = useEmployeeContext(data);
  const existing = context.application;
  const state = employeeApplicationState(existing);
  const editable = state === "none" || state === "draft" || state === "more-info";
  const stateContent = applicationStateContent(context, data);
  const [draft, setDraft] = useState(() => buildEmployeeDraft(context, existing));
  const [formOpen, setFormOpen] = useState(() => state === "draft" || state === "more-info");
  const [error, setError] = useState("");
  const [savedMessage, setSavedMessage] = useState("");

  if (!context.employee) return <EmployeeSetupNotice />;

  const primaryAction = stateContent.primaryAction;
  const showReadOnly = existing && !editable;
  const showForm = editable && (formOpen || state === "draft" || state === "more-info");
  const manager = managerName(data, context.employee);

  function save(status: MvpApplication["status"], note: string) {
    if (!context.employee || !context.mapping) return;
    if (!editable) {
      setError("Your submitted answers are locked. You can edit them only if your manager requests more information.");
      return;
    }
    if (status !== "Draft" && (!draft.reason.trim() || !draft.careerGoal.trim() || !draft.supportRequired.trim())) {
      setError("Please complete the first three questions before submitting.");
      return;
    }
    const now = nowIso();
    const next: MvpApplication = {
      ...(existing ?? {
        id: createMvpId("application"),
        employeeId: context.employee.id,
        apprenticeshipStandardId: context.mapping.apprenticeshipStandardId,
        submittedAt: now,
        history: [],
      }),
      employeeId: context.employee.id,
      apprenticeshipStandardId: context.mapping.apprenticeshipStandardId,
      status,
      currentOwner: applicationOwnerForStatus(status),
      reason: draft.reason,
      careerGoal: draft.careerGoal,
      supportRequired: draft.supportRequired,
      managerNote: draft.managerNote,
      submittedAt: status === "Draft" ? existing?.submittedAt ?? now : existing?.submittedAt || now,
      updatedAt: now,
      history: [
        ...(existing?.history ?? []),
        buildApplicationHistoryEntry(status, note, now),
      ],
    };
    saveApplication(next);
    setError("");
    setSavedMessage(status === "Draft" ? "Draft saved." : "Application submitted to your line manager.");
    if (status !== "Draft") setFormOpen(false);
  }

  function onSaveDraft(event: FormEvent) {
    event.preventDefault();
    save("Draft", "Employee saved an application draft.");
  }

  function submitCurrent() {
    save("Submitted to Line Manager", existing?.status === "More information requested" ? "Employee responded to the manager request and resubmitted." : "Employee submitted the application to line manager.");
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_390px]">
      <MvpPanel title="My application" eyebrow="Employee workflow">
        <div className="grid gap-5">
          <ApplicationStateHero
            title={stateContent.title}
            copy={stateContent.copy}
            supportingCopy={stateContent.supportingCopy}
            tone={stateContent.tone}
            icon={stateContent.icon}
            status={existing?.status ?? "Not started"}
          />

          <section className="rounded-xl border border-[#102c3d]/[0.07] bg-[#f8fbfa] p-4">
            <div className="grid gap-3 md:grid-cols-2">
              <ReadonlyField label="Programme" value={context.programmeName} />
              <ReadonlyField label="Provider" value={context.providerName} />
              <ReadonlyField label="Current owner" value={stateContent.owner} />
              <ReadonlyField label="Latest update" value={existing ? formatDate(existing.updatedAt) : "Not started"} />
            </div>
          </section>

          {state === "more-info" && existing ? (
            <ManagerRequestPanel application={existing} manager={manager} />
          ) : null}

          {state === "approved-enrolment" && existing ? (
            <EnrolmentNextSteps context={context} data={data} />
          ) : null}

          {state === "declined" && existing ? (
            <DeclinedFeedback application={existing} />
          ) : null}

          {!showForm && !showReadOnly ? (
            <ActionCard
              title="You have not started an application yet."
              copy="Start when you are ready. You can save a draft before anything is sent to your line manager."
              primaryLabel={primaryAction}
              onPrimary={() => setFormOpen(true)}
              secondaryLabel="View programme"
              onSecondary={() => undefined}
            />
          ) : null}

          {showReadOnly && existing ? (
            <SubmittedAnswerSummary application={existing} context={context} data={data} />
          ) : null}

          {showForm ? (
            <form onSubmit={onSaveDraft}>
              <div className="rounded-xl border border-[#102c3d]/[0.07] bg-white p-4">
                <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-[#102c3d]">{state === "more-info" ? "Provide requested information" : state === "draft" ? "Continue application" : "Start application"}</p>
                    <p className="mt-1 text-xs leading-5 text-[#102c3d]/52">You can save this as a draft. It will not be sent to {manager} until you submit it.</p>
                  </div>
                  <StatusBadge tone={state === "more-info" ? "yellow" : "blue"}>{state === "more-info" ? "Reopened" : existing?.status ?? "Not started"}</StatusBadge>
                </div>
                <FormGrid>
                  <ReadonlyField label="Selected apprenticeship" value={context.programmeName} />
                  <ReadonlyField label="Current role" value={context.employee.jobTitle} />
                  <ReadonlyField label="Site" value={context.employee.site || "Site to confirm"} />
                  <ReadonlyField label="Department" value={context.employee.department || "Department to confirm"} />
                  <ReadonlyField label="Line manager" value={manager} />
                  <ReadonlyField label="Current status" value={existing?.status ?? "Not started"} />
                  <FormTextArea wide label={employeeQuestions.reason} value={draft.reason} onChange={(value) => setDraft({ ...draft, reason: value })} rows={4} />
                  <FormTextArea wide label={employeeQuestions.careerGoal} value={draft.careerGoal} onChange={(value) => setDraft({ ...draft, careerGoal: value })} rows={4} />
                  <FormTextArea wide label={employeeQuestions.supportRequired} value={draft.supportRequired} onChange={(value) => setDraft({ ...draft, supportRequired: value })} rows={3} />
                  <FormTextArea wide label={employeeQuestions.managerNote} value={draft.managerNote} onChange={(value) => setDraft({ ...draft, managerNote: value })} rows={3} />
                </FormGrid>
              </div>

              <div className="mt-4 flex flex-col gap-3 rounded-xl border border-[#102c3d]/[0.07] bg-[#f8fbfa] p-4 sm:flex-row sm:items-center sm:justify-between">
                <p className={`text-xs font-semibold ${error ? "text-[#b53c52]" : "text-[#102c3d]/52"}`}>{error || savedMessage || "Save a draft or submit when the first three answers are complete."}</p>
                <div className="flex flex-wrap justify-end gap-2">
                  <button type="submit" className="h-10 rounded-full bg-white px-4 text-xs font-semibold text-[#102c3d]/62 ring-1 ring-[#102c3d]/[0.1]">Save draft</button>
                  <button type="button" onClick={submitCurrent} className="h-10 rounded-full bg-[#102c3d] px-5 text-xs font-semibold text-white">
                    {state === "more-info" ? "Respond and resubmit" : "Submit to line manager"}
                  </button>
                </div>
              </div>
            </form>
          ) : null}
        </div>
      </MvpPanel>

      <aside className="grid gap-4 content-start">
        {existing ? <ApplicationProgress application={existing} /> : <ApplicationProgress application={null} />}
        <SideCard icon={MessageCircle} title="Need help?" copy="Use Copilot to prepare clearer answers before you submit, or ask your manager what support would be realistic." />
      </aside>
    </div>
  );
}

function useEmployeeContext(data: MvpWorkspaceData): EmployeeContext {
  return useMemo(() => buildEmployeeContext(data), [data]);
}

function buildEmployeeContext(data: MvpWorkspaceData): EmployeeContext {
  const employee = data.employees.find((item) => item.status === "Active") ?? data.employees[0] ?? null;
  const role = data.roles.find((item) => item.id === employee?.roleId) ?? null;
  const profile = data.employeeDevelopmentProfiles.find((item) => item.employeeId === employee?.id) ?? null;
  const application = employee ? employeeCurrentApplication(data, employee.id) : null;
  const mappings = role ? [...role.pathwayMappings].sort((left, right) => left.priority - right.priority) : [];
  const mapping = application
    ? mappings.find((item) => item.apprenticeshipStandardId === application.apprenticeshipStandardId) ?? mappings[0] ?? null
    : mappings[0] ?? null;
  const standard = mapping ? getApprenticeshipStandard(mapping.apprenticeshipStandardId) : null;
  const programme = mapping ? data.providerProgrammes.find((item) =>
    item.linkedStandardId === mapping.apprenticeshipStandardId || item.linkedStandardIds.includes(mapping.apprenticeshipStandardId)
  ) ?? null : null;

  return {
    employee,
    role,
    profile,
    application,
    mapping,
    standardTitle: standard?.title ?? mapping?.apprenticeshipStandardId ?? "Programme to confirm",
    standardLevel: standard?.level ? `Level ${standard.level}` : "Level to confirm",
    programmeName: programme?.programmeName ?? standard?.title ?? "Recommended programme to confirm",
    providerName: providerLabel(data, programme?.providerId),
  };
}

function buildEmployeeDraft(context: EmployeeContext, existing: MvpApplication | null): Pick<MvpApplication, "reason" | "careerGoal" | "supportRequired" | "managerNote"> {
  return {
    reason: existing?.reason ?? "",
    careerGoal: existing?.careerGoal ?? context.profile?.futureCapabilities?.[0] ?? "",
    supportRequired: existing?.supportRequired ?? "",
    managerNote: existing?.managerNote ?? "",
  };
}

function EmployeeSetupNotice() {
  return (
    <MvpPanel title="Employee setup required" eyebrow="Employee workspace">
      <p className="text-sm leading-6 text-[#102c3d]/58">Your account is not linked to an active employee record yet. Please contact your apprenticeship lead.</p>
    </MvpPanel>
  );
}

function EmployeeSummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-h-[96px] rounded-xl border border-[#102c3d]/[0.07] bg-[#f8fbfa] p-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#102c3d]/38">{label}</p>
      <p className="mt-2 text-sm font-semibold leading-5 text-[#102c3d]">{value}</p>
    </div>
  );
}

function InfoBlock({ title, copy }: { title: string; copy: string }) {
  return (
    <article className="rounded-xl border border-[#102c3d]/[0.07] bg-white p-4">
      <p className="text-sm font-semibold text-[#102c3d]">{title}</p>
      <p className="mt-2 text-sm leading-6 text-[#102c3d]/58">{copy}</p>
    </article>
  );
}

function SideCard({ icon: Icon, title, copy }: { icon: LucideIcon; title: string; copy: string }) {
  return (
    <article className="rounded-xl border border-[#102c3d]/[0.07] bg-white p-5 shadow-[0_14px_34px_rgba(16,44,61,0.045)]">
      <div className="flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#e9f7f2] text-[#0b6f63]">
          <Icon size={17} strokeWidth={1.9} aria-hidden="true" />
        </span>
        <div>
          <p className="text-sm font-semibold text-[#102c3d]">{title}</p>
          <p className="mt-1 text-sm leading-6 text-[#102c3d]/56">{copy}</p>
        </div>
      </div>
    </article>
  );
}

function ApplicationStateHero({
  title,
  copy,
  supportingCopy,
  status,
  tone,
  icon: Icon,
}: {
  title: string;
  copy: string;
  supportingCopy: string;
  status: string;
  tone: "blue" | "green" | "yellow" | "red" | "neutral";
  icon: LucideIcon;
}) {
  const toneStyles = {
    blue: "border-[#159b8f]/15 bg-[#edf7f3] text-[#0b6f63]",
    green: "border-[#159b8f]/15 bg-[#edf7f3] text-[#0b6f63]",
    yellow: "border-[#d8a900]/20 bg-[#fff9dc] text-[#8d6f00]",
    red: "border-[#b13b51]/15 bg-[#fff0f2] text-[#b13b51]",
    neutral: "border-[#102c3d]/[0.07] bg-[#f8fbfa] text-[#102c3d]",
  }[tone];

  return (
    <section className={`rounded-xl border p-5 ${toneStyles}`}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/70 text-current ring-1 ring-current/10">
            <Icon size={18} strokeWidth={1.9} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-base font-semibold tracking-[-0.01em] text-[#102c3d]">{title}</p>
            <p className="mt-1 text-sm leading-6 text-[#102c3d]/62">{copy}</p>
            {supportingCopy ? <p className="mt-2 text-xs font-semibold leading-5 text-[#102c3d]/50">{supportingCopy}</p> : null}
          </div>
        </div>
        <StatusBadge tone={statusToneFromState(tone)}>{status}</StatusBadge>
      </div>
    </section>
  );
}

function ActionCard({
  title,
  copy,
  primaryLabel,
  onPrimary,
  secondaryLabel,
  onSecondary,
}: {
  title: string;
  copy: string;
  primaryLabel: string;
  onPrimary: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
}) {
  return (
    <section className="rounded-xl border border-[#102c3d]/[0.07] bg-white p-5 shadow-[0_14px_34px_rgba(16,44,61,0.04)]">
      <p className="text-sm font-semibold text-[#102c3d]">{title}</p>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-[#102c3d]/58">{copy}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={onPrimary} className="h-10 rounded-full bg-[#102c3d] px-5 text-xs font-semibold text-white">
          {primaryLabel}
        </button>
        {secondaryLabel && onSecondary ? (
          <button type="button" onClick={onSecondary} className="h-10 rounded-full bg-white px-4 text-xs font-semibold text-[#102c3d]/62 ring-1 ring-[#102c3d]/[0.1]">
            {secondaryLabel}
          </button>
        ) : null}
      </div>
    </section>
  );
}

function ManagerRequestPanel({ application, manager }: { application: MvpApplication; manager: string }) {
  const latest = latestHistory(application);
  return (
    <section className="rounded-xl border border-[#d8a900]/20 bg-[#fff9dc] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-[#102c3d]">{manager} has requested more information</p>
          <p className="mt-1 text-sm leading-6 text-[#102c3d]/62">{latest?.note || application.managerNote || "Please add the requested detail before your manager reviews this again."}</p>
        </div>
        <StatusBadge tone="yellow">Reopened section</StatusBadge>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <ReadonlyField label="Requested date" value={formatDate(latest?.createdAt ?? application.updatedAt)} />
        <ReadonlyField label="Affected section" value="Application evidence" />
        <ReadonlyField label="Current owner" value="You" />
      </div>
    </section>
  );
}

function SubmittedAnswerSummary({ application, context, data }: { application: MvpApplication; context: EmployeeContext; data: MvpWorkspaceData }) {
  return (
    <section className="rounded-xl border border-[#102c3d]/[0.07] bg-white p-5 shadow-[0_14px_34px_rgba(16,44,61,0.04)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#0b6f63]">Submitted version</p>
          <h3 className="mt-1 text-base font-semibold tracking-[-0.01em] text-[#102c3d]">{context.programmeName}</h3>
          <p className="mt-1 text-sm leading-6 text-[#102c3d]/56">
            These answers are locked while the application is with {applicationOwnerLabel(application, context, data)}.
          </p>
        </div>
        <StatusBadge tone={statusTone(application.status)}>{application.status}</StatusBadge>
      </div>

      <div className="mt-4 grid gap-3">
        {answerRows(application).map((row) => (
          <article key={row.label} className="rounded-xl border border-[#102c3d]/[0.07] bg-[#f8fbfa] p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#102c3d]/38">{row.label}</p>
            <p className="mt-2 text-sm leading-6 text-[#102c3d]/66">{row.value || "No answer recorded."}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function EnrolmentNextSteps({ context, data }: { context: EmployeeContext; data: MvpWorkspaceData }) {
  const enrolment = context.application ? data.enrolments.find((item) => item.applicationId === context.application?.id) : null;
  return (
    <section className="rounded-xl border border-[#159b8f]/15 bg-[#edf7f3] p-4">
      <p className="text-sm font-semibold text-[#102c3d]">Enrolment next steps</p>
      <p className="mt-1 text-sm leading-6 text-[#102c3d]/62">
        Your application is approved. The apprenticeship lead will prepare the provider introduction and confirm the enrolment plan.
      </p>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <ReadonlyField label="Programme" value={context.programmeName} />
        <ReadonlyField label="Approved delivery partner" value={context.providerName} />
        <ReadonlyField label="Indicative start" value={enrolment?.startDate ? formatDate(enrolment.startDate) : "To be confirmed"} />
        <ReadonlyField label="Enrolment status" value={enrolment?.status ?? "Ready for provider"} />
      </div>
    </section>
  );
}

function DeclinedFeedback({ application }: { application: MvpApplication }) {
  const latest = latestHistory(application);
  return (
    <section className="rounded-xl border border-[#b13b51]/15 bg-[#fff0f2] p-4">
      <p className="text-sm font-semibold text-[#102c3d]">Decision feedback</p>
      <p className="mt-1 text-sm leading-6 text-[#102c3d]/62">{latest?.note || application.managerNote || "The decision note will appear here when available."}</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <ReadonlyField label="Decision maker" value={application.currentOwner} />
        <ReadonlyField label="Decision date" value={formatDate(latest?.createdAt ?? application.updatedAt)} />
        <ReadonlyField label="Next step" value="Review feedback" />
      </div>
    </section>
  );
}

function ReadonlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1.5 text-xs font-semibold text-[#102c3d]/58">
      {label}
      <div className="min-h-11 rounded-lg border border-[#102c3d]/[0.07] bg-[#f8fbfa] px-3 py-3 text-sm font-medium leading-5 text-[#102c3d]">
        {value}
      </div>
    </div>
  );
}

function ApplicationProgress({ application, compact = false }: { application: MvpApplication | null; compact?: boolean }) {
  const rows = timelineRows(application);
  const current = applicationStage(application);

  return (
    <section className="rounded-xl border border-[#102c3d]/[0.07] bg-white p-5 shadow-[0_14px_34px_rgba(16,44,61,0.04)]">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-[#102c3d]">Application timeline</p>
        <StatusBadge tone={application ? statusTone(application.status) : "neutral"}>{current}</StatusBadge>
      </div>
      <div className={`mt-4 grid gap-2 ${compact ? "sm:grid-cols-3" : ""}`}>
        {rows.map((row) => {
          return (
            <div key={row.stage} className="flex items-center gap-2">
              <span className={`grid h-4 w-4 shrink-0 place-items-center rounded-full ${
                row.kind === "complete"
                  ? "bg-[#159b8f] text-white"
                  : row.kind === "current"
                    ? "bg-[#102c3d] text-white"
                    : row.kind === "declined"
                      ? "bg-[#b13b51] text-white"
                      : "bg-[#102c3d]/10 text-[#102c3d]/35"
              }`}>
                {row.kind === "complete" ? <CheckCircle2 size={10} strokeWidth={2.2} aria-hidden="true" /> : row.kind === "current" ? <Clock3 size={10} strokeWidth={2.2} aria-hidden="true" /> : null}
              </span>
              <span className={`text-xs font-semibold ${
                row.kind === "future" ? "text-[#102c3d]/40" : row.kind === "declined" ? "text-[#b13b51]" : "text-[#102c3d]"
              }`}>{row.stage}</span>
            </div>
          );
        })}
      </div>
      {application?.history.length ? (
        <div className="mt-4 rounded-xl bg-[#f8fbfa] p-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#102c3d]/36">Latest comment</p>
          <p className="mt-1 text-xs leading-5 text-[#102c3d]/58">{application.history.at(-1)?.note}</p>
        </div>
      ) : null}
    </section>
  );
}

function applicationStage(application: MvpApplication | null): (typeof applicationStages)[number] {
  if (!application) return "Not started";
  if (application.status === "Draft") return "Draft";
  if (application.status === "Submitted to Line Manager") return "Submitted";
  if (application.status === "Awaiting Manager Review") return "Manager review";
  if (application.status === "More information requested") return "More information requested";
  if (application.status === "Approved by Line Manager") return "Manager approved";
  if (application.status === "Submitted to Apprenticeship Lead" || application.status === "Awaiting Final Approval") return "Apprenticeship Lead review";
  if (application.status === "Approved for Enrolment") return "Approved for enrolment";
  if (application.status === "Declined by Line Manager" || application.status === "Declined by Apprenticeship Lead") return "Declined";
  return "Not started";
}

function employeeApplicationState(application: MvpApplication | null): EmployeeApplicationState {
  if (!application) return "none";
  if (application.status === "Draft") return "draft";
  if (application.status === "More information requested") return "more-info";
  if (application.status === "Approved by Line Manager") return "manager-approved";
  if (application.status === "Submitted to Apprenticeship Lead" || application.status === "Awaiting Final Approval") return "lead-review";
  if (application.status === "Approved for Enrolment") return "approved-enrolment";
  if (application.status === "Declined by Line Manager" || application.status === "Declined by Apprenticeship Lead") return "declined";
  return "manager-review";
}

function applicationStateContent(context: EmployeeContext, data: MvpWorkspaceData): {
  title: string;
  copy: string;
  supportingCopy: string;
  primaryAction: string;
  owner: string;
  tone: "blue" | "green" | "yellow" | "red" | "neutral";
  icon: LucideIcon;
} {
  const state = employeeApplicationState(context.application);
  const manager = context.employee ? managerName(data, context.employee) : "your line manager";
  const owner = context.application ? applicationOwnerLabel(context.application, context, data) : "You";

  if (state === "none") {
    return {
      title: "You have not started an application yet.",
      copy: "Start one application when you are ready. You can save it as a draft before it goes to your line manager.",
      supportingCopy: "You can still view your recommended programme and ask LevyTate Copilot for guidance.",
      primaryAction: "Start application",
      owner,
      tone: "neutral",
      icon: FileText,
    };
  }
  if (state === "draft") {
    return {
      title: "Your application is saved as a draft.",
      copy: "It has not been sent to your line manager yet. Continue when you are ready to complete the required answers.",
      supportingCopy: "Draft answers remain editable until you submit.",
      primaryAction: "Continue application",
      owner,
      tone: "blue",
      icon: FileText,
    };
  }
  if (state === "manager-review") {
    return {
      title: `Your application has been submitted and is now with ${manager} for review.`,
      copy: "Your answers are locked while your line manager reviews the request.",
      supportingCopy: "You can view the submitted version, your programme and what happens next.",
      primaryAction: "View submitted application",
      owner,
      tone: "blue",
      icon: LockKeyhole,
    };
  }
  if (state === "more-info") {
    return {
      title: `${manager} has requested more information.`,
      copy: "Only the reopened response area should be updated before you resubmit.",
      supportingCopy: "Your original submitted answers remain visible for context.",
      primaryAction: "Provide requested information",
      owner,
      tone: "yellow",
      icon: MessageCircle,
    };
  }
  if (state === "manager-approved") {
    return {
      title: "Your line manager has approved the application.",
      copy: "It is waiting for the Apprenticeship Lead to complete the final review.",
      supportingCopy: "Your submitted answers are locked while the final review is in progress.",
      primaryAction: "Track application",
      owner,
      tone: "green",
      icon: CheckCircle2,
    };
  }
  if (state === "lead-review") {
    return {
      title: "Your application is with the Apprenticeship Lead.",
      copy: "The final review checks readiness, programme fit and enrolment timing.",
      supportingCopy: "You will see the next step here when a decision is recorded.",
      primaryAction: "Track application",
      owner,
      tone: "blue",
      icon: Clock3,
    };
  }
  if (state === "approved-enrolment") {
    return {
      title: "Your application is approved for enrolment.",
      copy: "The next step is enrolment preparation with the approved delivery partner.",
      supportingCopy: "Your Apprenticeship Lead will confirm provider introduction, dates and support arrangements.",
      primaryAction: "View enrolment next steps",
      owner,
      tone: "green",
      icon: ShieldCheck,
    };
  }
  return {
    title: "A decision has been recorded for your application.",
    copy: "Review the feedback before deciding whether to discuss another route with your manager.",
    supportingCopy: "Closed applications do not block a future application.",
    primaryAction: "Review feedback",
    owner,
    tone: "red",
    icon: FileText,
  };
}

function nextEmployeeAction(context: EmployeeContext, data: MvpWorkspaceData): EmployeeActionSummary {
  const content = applicationStateContent(context, data);
  return {
    primaryLabel: content.primaryAction,
    target: "My Application",
    heading: content.title,
    copy: content.copy,
    owner: content.owner,
  };
}

function employeeStatusLabel(application: MvpApplication | null) {
  const state = employeeApplicationState(application);
  if (state === "none") return "Not started";
  if (state === "draft") return "Draft saved";
  if (state === "manager-review") return "Awaiting manager review";
  if (state === "more-info") return "More information requested";
  if (state === "manager-approved") return "Manager approved";
  if (state === "lead-review") return "Final review";
  if (state === "approved-enrolment") return "Approved for enrolment";
  return "Decision made";
}

function applicationOwnerLabel(application: MvpApplication, context: EmployeeContext, data: MvpWorkspaceData) {
  if (application.currentOwner === "Line Manager" && context.employee) return managerName(data, context.employee);
  if (application.currentOwner === "Employee" && context.employee) return context.employee.name;
  if (application.currentOwner === "Apprenticeship Lead") return data.profile.primaryContact || "Apprenticeship Lead";
  if (application.currentOwner === "Provider Partner") return context.providerName;
  return application.currentOwner;
}

function answerRows(application: MvpApplication) {
  return [
    { label: employeeQuestions.reason, value: application.reason },
    { label: employeeQuestions.careerGoal, value: application.careerGoal },
    { label: employeeQuestions.supportRequired, value: application.supportRequired },
    { label: employeeQuestions.managerNote, value: application.managerNote },
  ];
}

function latestHistory(application: MvpApplication) {
  return application.history.at(-1) ?? null;
}

function statusToneFromState(tone: "blue" | "green" | "yellow" | "red" | "neutral") {
  if (tone === "green") return "green";
  if (tone === "yellow") return "yellow";
  if (tone === "red") return "red";
  if (tone === "blue") return "blue";
  return "neutral";
}

function timelineRows(application: MvpApplication | null) {
  const current = applicationStage(application);
  const currentIndex = applicationStages.indexOf(current);
  if (current === "Declined") {
    return applicationStages
      .filter((stage) => ["Submitted", "Manager review", "Declined"].includes(stage))
      .map((stage) => ({ stage, kind: stage === "Declined" ? "declined" : "complete" as const }));
  }

  return applicationStages
    .filter((stage) => {
      if (!application && stage !== "Not started" && stage !== "Draft" && stage !== "Submitted") return false;
      if (stage === "More information requested" && current !== "More information requested") return false;
      if (stage === "Declined") return false;
      if (currentIndex <= applicationStages.indexOf("Manager review") && applicationStages.indexOf(stage) > applicationStages.indexOf("Manager approved")) return false;
      return true;
    })
    .map((stage, index, stages) => {
      const stageIndex = applicationStages.indexOf(stage);
      if (stage === current) return { stage, kind: "current" as const };
      if (stageIndex < currentIndex) return { stage, kind: "complete" as const };
      if (stageIndex === currentIndex + 1 || (!application && index <= 2)) return { stage, kind: "future" as const };
      if (index === stages.length - 1) return { stage, kind: "future" as const };
      return { stage, kind: "future" as const };
    });
}

function providerLabel(data: MvpWorkspaceData, providerId: string | undefined) {
  if (!providerId) return "Approved delivery partner";
  const provider = data.providers.find((item) => item.providerId === providerId);
  if (provider?.providerName) return provider.providerName;
  const label = providerId
    .replace(/^provider[-_]/, "")
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part.toLowerCase() === "qa" ? "QA" : part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
  return label || "Approved delivery partner";
}

function deliveryForProgramme(data: MvpWorkspaceData, mapping: MvpPathwayMapping | null) {
  if (!mapping) return "Delivery model to confirm";
  const programme = data.providerProgrammes.find((item) =>
    item.linkedStandardId === mapping.apprenticeshipStandardId || item.linkedStandardIds.includes(mapping.apprenticeshipStandardId)
  );
  return programme?.deliveryModels?.[0] ?? mapping.deliveryPreference ?? "Delivery model to confirm";
}

function firstName(name: string) {
  return name.trim().split(/\s+/)[0] || "there";
}

function formatDate(value: string) {
  if (!value) return "date to confirm";
  return value.slice(0, 10);
}
