"use client";

import { useEffect, useId, useState, type FormEvent, type ReactNode } from "react";
import { ArrowRight, Check, CheckCircle2, ChevronRight, GraduationCap, Landmark, RotateCcw } from "lucide-react";
import { EmployeesModule } from "@/components/levytate-mvp/EmployeesModule";
import { EmployerProgrammeDirectory } from "@/components/levytate-mvp/EmployerProgrammeDirectory";
import { SetupContextHelp, employerSetupGuidance, workspaceFieldGuidance } from "@/components/levytate-mvp/SetupContextHelp";
import { useMvpWorkspace } from "@/components/levytate-mvp/MvpWorkspaceStore";
import type { EmployerSetupProgress } from "@/components/levytate-mvp/useEmployerSetupProgress";
import type { EmployerSetupKey } from "@/lib/levytate/mvp/employer-setup";
import { splitMvpList, type MvpWorkspaceProfile } from "@/lib/levytate/mvp/workspace";

type Props = {
  progress: EmployerSetupProgress;
  prioritiesPanel: ReactNode;
  onNavigate: (target: string) => void;
  onFinish: () => void;
};

export function EmployerSetupJourney({ progress, prioritiesPanel, onNavigate, onFinish }: Props) {
  const required = progress.steps.filter((step) => !step.optional);
  const optional = progress.steps.filter((step) => step.optional);
  const totalDone = required.filter((step) => step.complete).length;
  const firstMissing = required.find((step) => !step.complete);
  const [selectedKey, setSelectedKey] = useState<EmployerSetupKey>(() => firstMissing?.key ?? "organisation");
  const selected = required.find((step) => step.key === selectedKey) ?? required[0];
  const next = required.find((step) => !step.complete && step.key !== selected.key);
  const allReady = progress.complete;

  return <div className="grid min-w-0 gap-4" data-testid="blank-employer-home">
    <header className="lt-hero px-5 py-6 sm:px-7 sm:py-7">
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold tracking-[0.10em] text-[#b8e9df]">GETTING STARTED</p>
          <h2 className="mt-2 text-[clamp(25px,3vw,34px)] font-semibold tracking-[-0.035em]">
            {allReady ? "Your workspace is ready." : "Build your LevyTate workspace."}
          </h2>
          <p className="mt-2 text-sm leading-6 text-white/75">
            {allReady ? "Your essential setup is saved. You can continue with live applications, learner oversight and future levy planning." : "One guided setup for your organisation, people and apprenticeship delivery. Your progress comes from saved records and is ready when you return."}
          </p>
        </div>
        {allReady ? <button type="button" onClick={onFinish} className="lt-button lt-hero-action">Open my dashboard <ArrowRight size={16} aria-hidden="true" /></button> : null}
      </div>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold" data-testid="employer-setup-progress" aria-live="polite">{totalDone} of {required.length} essential steps complete</p>
        <p className="text-xs text-white/70">Changes are saved securely by LevyTate</p>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/20" role="progressbar" aria-label="Workspace setup" aria-valuemin={0} aria-valuemax={required.length} aria-valuenow={totalDone}>
        <div className="h-full rounded-full bg-[#a8ead8] transition-[width] duration-300" style={{ width: required.length ? (100 * totalDone / required.length) + "%" : "0%" }}/>
      </div>
    </header>
    <div className="grid min-w-0 items-start gap-4 lg:grid-cols-[minmax(220px,270px)_minmax(0,1fr)]">
      <nav aria-label="Guided setup steps" className="lt-panel min-w-0 overflow-hidden p-2 sm:p-3">
        <p className="px-3 pb-2 pt-2 text-xs font-semibold text-lt-muted">ESSENTIAL SETUP</p>
        <ol className="grid gap-1">
          {required.map((step, index) => <li key={step.key}>
            <button type="button" aria-current={selected.key === step.key ? "step" : undefined} onClick={() => setSelectedKey(step.key)}
              data-testid={"setup-step-" + step.key}
              title={employerSetupGuidance[step.key]}
              className={"flex min-h-14 w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lt-accent " + (selected.key === step.key ? "bg-[#e8f2ed] text-lt-ink" : "text-lt-secondary hover:bg-lt-soft")}>
              <span className={"grid h-8 w-8 shrink-0 place-items-center rounded-lg text-xs font-semibold " + (step.complete ? "bg-lt-accent text-white" : selected.key === step.key ? "bg-white text-lt-ink" : "bg-lt-soft text-lt-secondary")}>{step.complete ? <Check size={17} aria-hidden="true"/> : index + 1}</span>
              <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{step.label}</span><span className="block text-xs text-lt-muted">{step.complete ? "Complete" : "To do"}</span></span>
              <ChevronRight size={15} className="shrink-0 opacity-55" aria-hidden="true"/>
            </button>
          </li>)}
        </ol>
      </nav>
      <section aria-labelledby="selected-setup-heading" className="lt-panel min-w-0 overflow-hidden">
        <div className="border-b border-lt-border px-5 py-5 sm:px-6">
          <p className="lt-eyebrow">WORKSPACE SETUP · STEP {required.indexOf(selected) + 1} OF {required.length}</p>
          <div className="mt-2 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                <h3 id="selected-setup-heading" className="text-xl font-semibold tracking-[-0.025em] sm:text-2xl">{selected.label}</h3>
                <SetupContextHelp label={selected.label} description={employerSetupGuidance[selected.key]}/>
              </div>
              <p className="mt-2 text-sm leading-6 text-lt-muted">{employerSetupGuidance[selected.key]}</p>
              <p className="mt-1 text-xs leading-5 text-lt-muted">{selected.detail}</p>
            </div>
            {selected.complete ? <CheckCircle2 aria-label="Step complete" size={23} className="shrink-0 text-lt-accent"/> : null}
          </div>
        </div>
        <div className="min-w-0 p-4 sm:p-6">
          {selected.key === "organisation" ? <OrganisationSetupForm/> : null}
          {selected.key === "priorities" ? prioritiesPanel : null}
          {selected.key === "managers" ? <>
            <StepNote title="Start by adding your line managers" copy="Use Add line manager below. New manager records default to the Line Manager role; these colleagues can then be assigned to employees. You can add as many as you need."/>
            <EmployeesModule setupStage="manager" onSetupPeopleSaved={() => {}} />
          </> : null}
          {selected.key === "employees" ? <>
            <StepNote title="Build the rest of your team" copy="Add employees in batches or use the existing CSV importer. Assign an active line manager to each new employee; you can continue adding people after the first save."/>
            <EmployeesModule setupStage="employees" onSetupPeopleSaved={() => {}} />
          </> : null}
          {selected.key === "providers" ? <>
            <StepNote title="Choose your provider partners" copy="Browse the current LevyTate catalogue and add the training providers you work with. Source and verification details stay visible so you can make an informed choice."/>
            <EmployerProgrammeDirectory key="setup-providers" initialView="Providers"/>
          </> : null}
          {selected.key === "programmes" ? <>
            <StepNote title="Publish programmes employees can choose" copy="Select programmes from providers in the catalogue. A published programme counts towards readiness only when its provider is also active in your organisation."/>
            <EmployerProgrammeDirectory key="setup-programmes" initialView="Programmes"/>
          </> : null}
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-lt-border pt-4">
            <button type="button" className="lt-button lt-secondary" onClick={() => onNavigate(selected.target)}>Open full {selected.target === "Settings" ? "workspace settings" : selected.target === "Employees" ? "People workspace" : "Marketplace"} <ArrowRight size={15} aria-hidden="true"/></button>
            {allReady ? <button type="button" className="lt-button lt-primary" onClick={onFinish}>Finish setup <Check size={15} aria-hidden="true"/></button>
              : next && selected.complete ? <button type="button" className="lt-button lt-primary" onClick={() => setSelectedKey(next.key)}>Continue: {next.label} <ArrowRight size={15} aria-hidden="true"/></button>
              : firstMissing && firstMissing.key !== selected.key ? <button type="button" className="min-h-11 text-sm font-semibold text-lt-accent" onClick={() => setSelectedKey(firstMissing.key)}>Go to next unfinished step</button> : null}
          </div>
        </div>
      </section>
    </div>
    <section className="lt-panel px-5 py-5 sm:px-6" aria-labelledby="optional-setup-title">
      <div className="flex items-center gap-3"><Landmark className="text-lt-accent" size={19} aria-hidden="true"/><div><h3 id="optional-setup-title" className="text-base font-semibold">Bring in your existing activity when ready</h3><p className="mt-1 text-sm text-lt-muted">Optional — these do not stop you from finishing setup.</p></div></div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {optional.map((step) => <button key={step.key} type="button" onClick={() => onNavigate(step.target)} className="flex min-h-[92px] items-start gap-3 rounded-lg border border-lt-border bg-white p-4 text-left transition-colors hover:bg-lt-soft">
          {step.complete ? <CheckCircle2 className="mt-0.5 shrink-0 text-lt-accent" size={19} aria-hidden="true"/> : step.key === "finance" ? <Landmark className="mt-0.5 shrink-0 text-lt-muted" size={19} aria-hidden="true"/> : <GraduationCap className="mt-0.5 shrink-0 text-lt-muted" size={19} aria-hidden="true"/>}
          <span className="min-w-0 flex-1"><strong className="block text-sm">{step.label}</strong><span className="mt-1 block text-xs leading-5 text-lt-muted">{step.detail}</span></span><ArrowRight size={15} className="mt-1 shrink-0 text-lt-accent" aria-hidden="true"/>
        </button>)}
      </div>
      {progress.financeStatus === "unavailable" ? <button type="button" onClick={progress.refreshFinance} className="mt-4 flex min-h-11 items-center gap-2 text-xs font-semibold text-lt-accent"><RotateCcw size={14}/> Retry finance status</button> : null}
    </section>
  </div>;
}

function StepNote({ title, copy }: { title: string; copy: string }) {
  return <div className="mb-5 border-l-[3px] border-lt-accent bg-[#f4f8f5] px-4 py-3"><p className="text-sm font-semibold">{title}</p><p className="mt-1 text-sm leading-6 text-lt-secondary">{copy}</p></div>;
}

type OrganisationDraft = Pick<MvpWorkspaceProfile, "employerName" | "primaryContact" | "contactEmail" | "defaultSite"> & {
  sitesText: string;
  departmentsText: string;
};
function toDraft(profile: MvpWorkspaceProfile): OrganisationDraft {
  return { employerName: profile.employerName, primaryContact: profile.primaryContact, contactEmail: profile.contactEmail, defaultSite: profile.defaultSite,
    sitesText: profile.sites.join(", "), departmentsText: profile.departments.join(", ") };
}

function OrganisationSetupForm() {
  const { data, meta, saveProfile, can, sessionRecovery } = useMvpWorkspace();
  const [draft, setDraft] = useState<OrganisationDraft>(() => toDraft(data.profile));
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const revision = meta?.mutationRevisions?.["levytate_organisations:" + meta?.organisationId] ?? 0;
  const [savedRevision, setSavedRevision] = useState(revision);
  const canEdit = can("settings:write");

  useEffect(() => {
    if (dirty) return;
    setDraft(toDraft(data.profile));
    setSavedRevision(revision);
  }, [data.profile, revision, dirty]);

  function change(field: keyof OrganisationDraft, value: string) {
    setDraft((current) => ({ ...current, [field]: value }));
    setDirty(true); setNotice(""); setError("");
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canEdit || saving || sessionRecovery) return;
    if (!splitMvpList(draft.sitesText).length || !splitMvpList(draft.departmentsText).length) {
      setError("Add at least one site and one department."); return;
    }
    setSaving(true); setError(""); setNotice("");
    try {
      const result = await saveProfile({
        ...data.profile,
        employerName: draft.employerName.trim(),
        primaryContact: draft.primaryContact.trim(),
        contactEmail: draft.contactEmail.trim(),
        defaultSite: draft.defaultSite.trim() || splitMvpList(draft.sitesText)[0],
        sites: splitMvpList(draft.sitesText),
        departments: splitMvpList(draft.departmentsText),
      }, savedRevision);
      if (!result.ok) { setError(result.message); return; }
      setDirty(false);
      setNotice("Organisation details saved securely. Continue with the next step.");
    } catch {
      setError("We could not confirm this save. Your entries have been kept — please try again.");
    } finally { setSaving(false); }
  }

  if (!canEdit) return <div className="grid gap-3 rounded-lg border border-lt-border bg-lt-soft p-5">
    <p className="text-base font-semibold">Organisation details are administrator-controlled</p>
    <p className="text-sm leading-6 text-lt-secondary">Your Apprenticeship Lead can set up employees, providers and programmes, but the organisation profile and business priorities must be saved by an Employer Admin. No permissions have been changed.</p>
    <p className="text-sm text-lt-muted">Current employer: {data.profile.employerName || "Not configured"}</p>
  </div>;

  return <form onSubmit={submit} className="grid gap-4" data-testid="employer-organisation-form">
    <div className="grid min-w-0 gap-4 sm:grid-cols-2">
      <SetupField label="Employer name" required value={draft.employerName} onChange={(value) => change("employerName",value)} help={workspaceFieldGuidance.employerName}/>
      <SetupField label="Primary contact" required value={draft.primaryContact} onChange={(value) => change("primaryContact",value)} help={workspaceFieldGuidance.primaryContact}/>
      <SetupField label="Work contact email" type="email" required value={draft.contactEmail} onChange={(value) => change("contactEmail",value)} help={workspaceFieldGuidance.contactEmail}/>
      <SetupField label="Default site" value={draft.defaultSite} onChange={(value) => change("defaultSite",value)} help={workspaceFieldGuidance.defaultSite} hint="Your main physical workplace — not your website."/>
      <SetupField label="Sites" required value={draft.sitesText} onChange={(value) => change("sitesText",value)} help={workspaceFieldGuidance.sites} hint="Physical workplaces, e.g. Hull office or Leeds depot — not website addresses. Separate multiple sites with a comma."/>
      <SetupField label="Departments" required value={draft.departmentsText} onChange={(value) => change("departmentsText",value)} help={workspaceFieldGuidance.departments} hint="Teams such as Operations, Sales or HR. Separate multiple departments with a comma."/>
    </div>
    {error ? <p role="alert" className="text-sm font-semibold text-lt-risk">{error}</p> : null}
    {notice ? <p role="status" className="text-sm font-semibold text-lt-accent">{notice}</p> : null}
    {sessionRecovery ? <p role="status" className="text-sm text-lt-risk">{sessionRecovery.message}</p> : null}
    <div><button type="submit" disabled={saving || Boolean(sessionRecovery)} className="lt-button lt-primary">{saving ? "Saving details…" : "Save organisation details"} <ArrowRight size={15} aria-hidden="true"/></button></div>
  </form>;
}

function SetupField({ label, value, onChange, type = "text", required = false, hint, help }: { label: string; value: string; onChange: (value: string) => void; type?: "text" | "email"; required?: boolean; hint?: string; help?: string }) {
  const inputId = useId();
  return <div className="lt-label grid min-w-0 gap-1.5">
    <div className="flex min-w-0 items-center gap-1">
      <label htmlFor={inputId}>{label}</label>
      {help ? <SetupContextHelp label={label} description={help}/> : null}
    </div>
    <input id={inputId} type={type} required={required} value={value} onChange={(event) => onChange(event.target.value)}
      aria-describedby={hint ? inputId + "-hint" : undefined}
      className="lt-control h-11 min-w-0 px-3 text-sm font-medium outline-none" maxLength={type === "email" ? 254 : 400}/>
    {hint ? <p id={inputId + "-hint"} className="text-xs font-normal leading-5 text-lt-muted">{hint}</p> : null}
  </div>;
}
