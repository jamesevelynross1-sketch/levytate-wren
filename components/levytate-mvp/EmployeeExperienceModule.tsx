"use client";

import { FileText, GraduationCap, MessageCircle, ShieldCheck } from "lucide-react";
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
  FormActions,
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
  reason: "Why are you interested?",
  careerGoal: "How could it help your current role or future development?",
  supportRequired: "What support would you need from your manager?",
  managerNote: "Anything your manager should know?",
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

export function EmployeeHomeModule({ onNavigate }: { onNavigate: (target: EmployeeModuleTarget) => void }) {
  const { data } = useMvpWorkspace();
  const context = useEmployeeContext(data);
  const nextAction = nextEmployeeAction(context.application);

  if (!context.employee) return <EmployeeSetupNotice />;

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
      <section className="rounded-2xl border border-[#102c3d]/[0.07] bg-white p-6 shadow-[0_18px_44px_rgba(16,44,61,0.055)]">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#c95568]">Employee workspace</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-[-0.025em] text-[#102c3d]">Good to see you, {firstName(context.employee.name)}.</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#102c3d]/58">
          Your LevyTate workspace is focused on one thing: understanding your recommended programme and the next step in your current application.
        </p>

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <EmployeeSummaryTile label="Recommended programme" value={context.programmeName} />
          <EmployeeSummaryTile label="Current application" value={context.application ? context.application.status : "Not started"} />
          <EmployeeSummaryTile label="Line manager" value={managerName(data, context.employee)} />
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <button type="button" onClick={() => onNavigate(nextAction.target)} className="inline-flex h-11 items-center justify-center rounded-full bg-[#102c3d] px-5 text-xs font-semibold text-white shadow-[0_12px_24px_rgba(16,44,61,0.14)] transition hover:-translate-y-0.5 hover:bg-[#17394d]">
            {nextAction.label}
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
              <p className="text-sm font-semibold text-[#102c3d]">{nextAction.title}</p>
              <p className="mt-1 text-sm leading-6 text-[#102c3d]/56">{nextAction.copy}</p>
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
  const editable = !existing || existing.status === "Draft" || existing.status === "More information requested";
  const [draft, setDraft] = useState(() => buildEmployeeDraft(context, existing));
  const [error, setError] = useState("");
  const [savedMessage, setSavedMessage] = useState("");

  if (!context.employee) return <EmployeeSetupNotice />;

  function save(status: MvpApplication["status"], note: string) {
    if (!context.employee || !context.mapping) return;
    if (!editable) {
      setError("Your application is already submitted. You can track it here, but it cannot be edited unless your manager asks for more information.");
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
      managerNote: status === "Submitted to Line Manager" ? "" : draft.managerNote,
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
          {existing ? (
            <div className="rounded-xl border border-[#102c3d]/[0.07] bg-[#f8fbfa] p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-[#102c3d]">{context.programmeName}</p>
                  <p className="mt-1 text-sm leading-6 text-[#102c3d]/56">Current owner: {existing.currentOwner}. Latest update: {formatDate(existing.updatedAt)}.</p>
                </div>
                <StatusBadge tone={statusTone(existing.status)}>{existing.status}</StatusBadge>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-[#159b8f]/15 bg-[#edf7f3] p-5">
              <p className="text-sm font-semibold text-[#102c3d]">No active application yet</p>
              <p className="mt-1 text-sm leading-6 text-[#102c3d]/58">You can create one application at a time. Your manager will review it before the apprenticeship lead makes a final decision.</p>
            </div>
          )}

          {existing?.status === "More information requested" ? (
            <div className="rounded-xl border border-[#d8a900]/20 bg-[#fff9dc] p-4">
              <p className="text-sm font-semibold text-[#102c3d]">Your manager has asked for more information</p>
              <p className="mt-1 text-sm leading-6 text-[#102c3d]/62">{existing.managerNote || "Please add more detail before your manager reviews this again."}</p>
            </div>
          ) : null}

          {existing?.status === "Declined by Line Manager" || existing?.status === "Declined by Apprenticeship Lead" ? (
            <DecisionPanel title="Application declined" copy={existing.managerNote || "The decision note will appear here when available."} />
          ) : null}

          {existing?.status === "Approved for Enrolment" ? (
            <DecisionPanel title="Approved for enrolment" copy="Your apprenticeship lead has approved this application. The next step is enrolment preparation with the approved delivery partner." tone="green" />
          ) : null}

          <form onSubmit={onSaveDraft} className={editable ? "" : "pointer-events-none opacity-70"}>
            <FormGrid>
              <ReadonlyField label="Selected apprenticeship" value={context.programmeName} />
              <ReadonlyField label="Current role" value={context.employee.jobTitle} />
              <ReadonlyField label="Site" value={context.employee.site || "Site to confirm"} />
              <ReadonlyField label="Department" value={context.employee.department || "Department to confirm"} />
              <ReadonlyField label="Line manager" value={managerName(data, context.employee)} />
              <ReadonlyField label="Current status" value={existing?.status ?? "Not started"} />
              <FormTextArea wide label={employeeQuestions.reason} value={draft.reason} onChange={(value) => setDraft({ ...draft, reason: value })} rows={4} />
              <FormTextArea wide label={employeeQuestions.careerGoal} value={draft.careerGoal} onChange={(value) => setDraft({ ...draft, careerGoal: value })} rows={4} />
              <FormTextArea wide label={employeeQuestions.supportRequired} value={draft.supportRequired} onChange={(value) => setDraft({ ...draft, supportRequired: value })} rows={3} />
              <FormTextArea wide label={employeeQuestions.managerNote} value={draft.managerNote} onChange={(value) => setDraft({ ...draft, managerNote: value })} rows={3} />
            </FormGrid>
            {editable ? (
              <div className="mt-5 rounded-xl border border-[#102c3d]/[0.07] bg-[#f8fbfa] p-4">
                <label className="flex items-start gap-3 text-sm leading-6 text-[#102c3d]/62">
                  <input type="checkbox" required className="mt-1 h-4 w-4 rounded border-[#102c3d]/20 text-[#159b8f]" />
                  <span>I confirm these answers are accurate and I understand this will be sent to my line manager for review.</span>
                </label>
              </div>
            ) : null}
            <div className={editable ? "" : "hidden"}>
              <FormActions onCancel={() => setDraft(buildEmployeeDraft(context, existing))} label="Save draft" error={error || savedMessage} />
              <div className="mt-3 flex justify-end">
                <button type="button" onClick={submitCurrent} className="inline-flex h-11 items-center justify-center rounded-full bg-[#102c3d] px-5 text-xs font-semibold text-white">
                  {existing?.status === "More information requested" ? "Respond and resubmit" : "Submit to line manager"}
                </button>
              </div>
            </div>
          </form>
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

function DecisionPanel({ title, copy, tone = "red" }: { title: string; copy: string; tone?: "red" | "green" }) {
  const styles = tone === "green" ? "border-[#159b8f]/15 bg-[#edf7f3]" : "border-[#b13b51]/15 bg-[#fff0f2]";
  return (
    <div className={`rounded-xl border p-4 ${styles}`}>
      <p className="text-sm font-semibold text-[#102c3d]">{title}</p>
      <p className="mt-1 text-sm leading-6 text-[#102c3d]/62">{copy}</p>
    </div>
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
  const current = applicationStage(application);
  const currentIndex = applicationStages.indexOf(current);

  return (
    <section className="rounded-xl border border-[#102c3d]/[0.07] bg-white p-5 shadow-[0_14px_34px_rgba(16,44,61,0.04)]">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-[#102c3d]">Application timeline</p>
        <StatusBadge tone={application ? statusTone(application.status) : "neutral"}>{current}</StatusBadge>
      </div>
      <div className={`mt-4 grid gap-2 ${compact ? "grid-cols-3" : ""}`}>
        {applicationStages.map((stage, index) => {
          const complete = currentIndex >= index;
          if (compact && index > 5) return null;
          return (
            <div key={stage} className="flex items-center gap-2">
              <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${complete ? "bg-[#159b8f]" : "bg-[#102c3d]/12"}`} />
              <span className={`text-xs font-semibold ${complete ? "text-[#102c3d]" : "text-[#102c3d]/40"}`}>{stage}</span>
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

function nextEmployeeAction(application: MvpApplication | null): { label: string; target: EmployeeModuleTarget; title: string; copy: string } {
  if (!application) {
    return {
      label: "Start my application",
      target: "My Application",
      title: "Start your expression of interest",
      copy: "Complete four short answers and submit one application to your line manager.",
    };
  }
  if (application.status === "Draft") {
    return { label: "Continue application", target: "My Application", title: "Finish your draft", copy: "Your draft has not been sent to your line manager yet." };
  }
  if (application.status === "More information requested") {
    return { label: "Respond to manager", target: "My Application", title: "More information requested", copy: "Your manager needs a little more detail before making a decision." };
  }
  if (application.status === "Approved for Enrolment") {
    return { label: "View enrolment next step", target: "My Application", title: "Approved for enrolment", copy: "Your apprenticeship lead has approved this for enrolment preparation." };
  }
  return { label: "Track application", target: "My Application", title: "Track your current application", copy: "Your request is already active. You can view the stage, owner and latest comment." };
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
