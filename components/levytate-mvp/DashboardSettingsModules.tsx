"use client";

import { BellRing, Building2, Check, ChevronDown, Sparkles, Target, Users } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { FormField, FormGrid, MvpPanel, StatusBadge, TableAction } from "@/components/levytate-mvp/MvpUi";
import { useMvpWorkspace } from "@/components/levytate-mvp/MvpWorkspaceStore";
import {
  buildNotifications,
  employeeName,
  employerWorkspaceSummary,
  managerName,
  providerCoverageSummary,
  recentRecommendations,
  upcomingEnrolments,
  employeesNeedingSupport,
} from "@/lib/levytate/mvp/workspace-insights";
import {
  createMvpId,
  mvpEmployerPriorityOptions,
  splitMvpList,
  type MvpEmployerPriorityImportance,
  type MvpEmployerPriorityName,
  type MvpWorkspaceProfile,
} from "@/lib/levytate/mvp/workspace";

const importanceOptions: Array<{ value: MvpEmployerPriorityImportance; copy: string }> = [
  { value: "Critical", copy: "A defining business priority for the next 12 months." },
  { value: "High", copy: "Important and expected to shape development decisions." },
  { value: "Medium", copy: "Relevant, but balanced with other priorities." },
];

export function DashboardModule({ onNavigate }: { onNavigate: (module: string) => void }) {
  const { data } = useMvpWorkspace();
  const summary = employerWorkspaceSummary(data);
  const notifications = buildNotifications(data);
  const recommendations = recentRecommendations(data);
  const support = employeesNeedingSupport(data);
  const enrolments = upcomingEnrolments(data);
  const providerCoverage = providerCoverageSummary(data);

  if (!data.profile.priorities.length) {
    return <EmployerPrioritiesSetup />;
  }

  return (
    <div className="grid gap-5">
      <section className="rounded-[1.25rem] border border-[#102c3d]/[0.07] bg-[#102c3d] p-5 text-white shadow-[0_20px_55px_rgba(16,44,61,0.12)] sm:p-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-2xl">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8fe0d2]">Employer workspace</p>
            <h2 className="mt-2 text-2xl font-semibold">What needs attention today</h2>
            <p className="mt-2 text-sm leading-6 text-white/62">LevyTate is now organised around workforce records, approval workflow, provider relationships and operational reporting.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => onNavigate("Employees")} className="h-11 rounded-full bg-[#ffde59] px-5 text-sm font-semibold text-[#102c3d] transition hover:-translate-y-0.5">Add employee</button>
            <button type="button" onClick={() => onNavigate("Applications")} className="h-11 rounded-full bg-white/10 px-5 text-sm font-semibold text-white ring-1 ring-white/10">Review workflow</button>
          </div>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <SummaryCard icon={Building2} label="Sites" value={summary.sites} />
          <SummaryCard icon={Users} label="Employees" value={summary.employees} />
          <SummaryCard icon={Users} label="Managers" value={summary.managers} />
          <SummaryCard icon={BellRing} label="Awaiting approval" value={summary.applicationsAwaitingApproval} />
          <SummaryCard icon={Sparkles} label="Provider partners" value={summary.providerPartners} />
          <SummaryCard icon={Target} label="Departments" value={summary.departments} />
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.85fr)]">
        <MvpPanel title="Applications awaiting approval" eyebrow="Today">
          {notifications.length ? (
            <div className="grid gap-3">
              {notifications.map((notification) => (
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
            <p className="text-sm leading-6 text-[#102c3d]/56">Nothing urgent is waiting for approval right now. Use the reports workspace to check readiness, enrolments, and provider coverage.</p>
          )}
        </MvpPanel>

        <MvpPanel title="Recommended next actions" eyebrow="Operational focus">
          <div className="grid gap-3">
            <ActionCard title="Support employee discovery" copy={`${support.length} employee records still need role or future-capability context before recommendations are complete.`} cta="Open employees" onClick={() => onNavigate("Employees")} />
            <ActionCard title="Protect provider continuity" copy={providerCoverage.missing.length ? `${providerCoverage.missing.length} partner categories still need a preferred provider relationship.` : "Provider partner coverage is in place across all core categories."} cta="Open provider relationships" onClick={() => onNavigate("Provider Relationships")} />
            <ActionCard title="Move approved learners into starts" copy={enrolments.length ? `${enrolments.length} enrolment records are active and should be checked for dates, providers, and readiness.` : "No enrolments are currently in flight. The next milestone is turning approvals into starts."} cta="Open enrolments" onClick={() => onNavigate("Enrolments")} />
          </div>
        </MvpPanel>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
        <MvpPanel title="Employees needing support" eyebrow="People records">
          <div className="grid gap-3">
            {support.length ? support.map((employee) => (
              <div key={employee.id} className="rounded-xl border border-[#102c3d]/[0.07] bg-white px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-[#102c3d]">{employee.name}</p>
                    <p className="mt-1 text-xs leading-5 text-[#102c3d]/54">{employee.jobTitle || "Role to confirm"} · {employee.department || "Department to confirm"} · {employee.site || "Site to confirm"}</p>
                  </div>
                  <TableAction onClick={() => onNavigate("Employees")}>Open</TableAction>
                </div>
              </div>
            )) : <p className="text-sm leading-6 text-[#102c3d]/56">Every active employee has a role-linked profile and recommendation-ready record.</p>}
          </div>
        </MvpPanel>

        <MvpPanel title="Recent AI recommendations" eyebrow="Ask LevyTate AI">
          <div className="grid gap-3">
            {recommendations.length ? recommendations.map(({ employee, recommendation }) => (
              <div key={employee.id} className="rounded-xl border border-[#102c3d]/[0.07] bg-[#f8fbfa] px-4 py-3">
                <p className="text-sm font-semibold text-[#102c3d]">{employee.name}</p>
                <p className="mt-1 text-xs leading-5 text-[#102c3d]/54">{recommendation.title} · {recommendation.fitScore}% fit</p>
                <p className="mt-2 text-xs leading-5 text-[#102c3d]/56">{recommendation.rationale}</p>
              </div>
            )) : <p className="text-sm leading-6 text-[#102c3d]/56">Recommendations will appear here as employees complete guided discovery and role mapping.</p>}
          </div>
        </MvpPanel>
      </div>

      <MvpPanel title="Upcoming enrolments" eyebrow="Starts">
        <div className="grid gap-3 lg:grid-cols-3">
          {enrolments.length ? enrolments.map((enrolment) => (
            <div key={enrolment.id} className="rounded-xl border border-[#102c3d]/[0.07] bg-[#f8fbfa] px-4 py-3">
              <p className="text-sm font-semibold text-[#102c3d]">{employeeName(data, enrolment.employeeId)}</p>
              <p className="mt-1 text-xs leading-5 text-[#102c3d]/54">{enrolment.startDate || "Start date to confirm"}</p>
              <p className="mt-2 text-xs leading-5 text-[#102c3d]/56">{managerName(data, data.employees.find((employee) => employee.id === enrolment.employeeId) ?? data.employees[0])}</p>
              <div className="mt-3"><StatusBadge tone={enrolment.status === "Live learner" ? "green" : "yellow"}>{enrolment.status}</StatusBadge></div>
            </div>
          )) : <p className="text-sm leading-6 text-[#102c3d]/56">No enrolments are active yet. This section will become the daily handoff view once approvals begin moving into starts.</p>}
        </div>
      </MvpPanel>
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value }: { icon: typeof Building2; label: string; value: number }) {
  return (
    <div className="rounded-xl bg-white/8 px-4 py-3 ring-1 ring-white/10">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/62">{label}</p>
        <Icon size={15} className="text-[#8fe0d2]" aria-hidden="true" />
      </div>
      <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
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

function EmployerPrioritiesSetup({ compact = false }: { compact?: boolean }) {
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
          <button type="button" onClick={() => setStep("priorities")} className="shrink-0 rounded-full bg-[#f5f8f6] px-4 py-2 text-xs font-semibold text-[#102c3d]/64 ring-1 ring-[#102c3d]/[0.07]">
            Refine priorities
          </button>
        </div>
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
  const { data, saveProfile } = useMvpWorkspace();
  const [draft, setDraft] = useState<MvpWorkspaceProfile>(data.profile);
  const [saved, setSaved] = useState(false);

  useEffect(() => { setDraft(data.profile); }, [data.profile]);

  function submit(event: FormEvent) {
    event.preventDefault();
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
      <EmployerPrioritiesSetup compact />
      <details className="group rounded-[1.25rem] border border-[#102c3d]/[0.07] bg-white shadow-[0_16px_44px_rgba(16,44,61,0.045)]">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4">
          <div>
            <p className="text-sm font-semibold">Workspace details</p>
            <p className="mt-1 text-xs text-[#102c3d]/48">Organisation, contacts, sites and departments</p>
          </div>
          <ChevronDown size={18} className="text-[#102c3d]/42 transition group-open:rotate-180" aria-hidden="true" />
        </summary>
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
            {saved ? <p className="text-xs font-semibold text-[#0b6f63]">Workspace settings saved locally.</p> : <span />}
            <button className="h-10 rounded-full bg-[#102c3d] px-5 text-xs font-semibold text-white">Save details</button>
          </div>
        </form>
      </details>
    </div>
  );
}
