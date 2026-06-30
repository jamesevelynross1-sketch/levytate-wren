"use client";

import { Check, ChevronDown, Target } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { FormField, FormGrid, MvpPanel } from "@/components/levytate-mvp/MvpUi";
import { useMvpWorkspace } from "@/components/levytate-mvp/MvpWorkspaceStore";
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
  const items = [
    ["Employees", data.employees.filter((item) => item.status === "Active").length, "Create or continue an employee profile", "Employees"],
    ["Role mappings", data.roles.filter((item) => item.status === "Active").length, "Review the standards linked to roles", "Roles"],
    ["Applications", data.applications.length, "Continue an approval workflow", "Applications"],
    ["Provider requests", data.matchingRequests.length, "Progress needs with a selected standard", "Provider Matching"],
  ] as const;

  if (!data.profile.priorities.length) {
    return <EmployerPrioritiesSetup />;
  }

  return (
    <div className="grid gap-5">
      <section className="rounded-[1.25rem] border border-[#102c3d]/[0.07] bg-[#102c3d] p-5 text-white shadow-[0_20px_55px_rgba(16,44,61,0.12)] sm:p-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-2xl">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8fe0d2]">Your workforce priorities</p>
            <h2 className="mt-2 text-2xl font-semibold">LevyTate will use these outcomes to guide every recommendation.</h2>
            <p className="mt-2 text-sm leading-6 text-white/62">Employee evidence and official apprenticeship standards still determine the recommendation. Provider data is considered only after a standard is selected.</p>
          </div>
          <button type="button" onClick={() => onNavigate("Employees")} className="h-11 rounded-full bg-[#ffde59] px-5 text-sm font-semibold text-[#102c3d] transition hover:-translate-y-0.5">
            Add an employee
          </button>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          {data.profile.priorities.map((priority) => (
            <span key={priority.id} className="rounded-full bg-white/10 px-3 py-2 text-xs font-semibold text-white ring-1 ring-white/10">
              {priority.name} <span className="ml-1 text-[#8fe0d2]">{priority.importance}</span>
            </span>
          ))}
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {items.map(([label, value, copy, target]) => (
          <button key={label} onClick={() => onNavigate(target)} className="group rounded-xl border border-[#102c3d]/[0.075] bg-white p-4 text-left shadow-[0_14px_36px_rgba(16,44,61,0.045)] transition hover:-translate-y-0.5 hover:border-[#159b8f]/20 hover:shadow-[0_18px_42px_rgba(16,44,61,0.075)]">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-[#102c3d]/48">{label}</p>
              <span className="h-2 w-2 rounded-full bg-[#159b8f]/55 transition group-hover:bg-[#159b8f]" />
            </div>
            <p className="mt-2 text-3xl font-semibold">{value}</p>
            <p className="mt-2 text-xs leading-5 text-[#102c3d]/52">{copy}</p>
          </button>
        ))}
      </section>
    </div>
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
                {priority.name} · {priority.importance}
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
          <p className="mt-2 text-sm leading-6 text-[#102c3d]/56">Choose up to three priorities. LevyTate will use them as business context, not as a substitute for employee evidence.</p>
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
            <button type="button" disabled={!selected.length} onClick={() => setStep("importance")} className="h-11 rounded-full bg-[#102c3d] px-5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40">
              Continue
            </button>
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
            <button type="button" onClick={save} className="h-11 rounded-full bg-[#102c3d] px-5 text-sm font-semibold text-white">
              Save priorities
            </button>
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
            <p className="mt-1 text-xs text-[#102c3d]/48">Employer name, contacts, sites and departments</p>
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
