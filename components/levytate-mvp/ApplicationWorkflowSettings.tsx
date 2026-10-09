"use client";

import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  applicationWorkflowPreview,
  applicationWorkflowRoles,
  validateApplicationWorkflowSteps,
  type ApplicationWorkflowStep,
  type ApplicationWorkflowVersion,
} from "@/lib/levytate/application-workflows/domain";

type AdminState = { published: ApplicationWorkflowVersion | null; draft: ApplicationWorkflowVersion | null; history: ApplicationWorkflowVersion[]; syntheticDefault: boolean };

export function ApplicationWorkflowSettings() {
  const [state, setState] = useState<AdminState | null>(null);
  const [steps, setSteps] = useState<ApplicationWorkflowStep[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const errors = useMemo(() => validateApplicationWorkflowSteps(steps), [steps]);

  useEffect(() => { void load(); }, []);

  async function load() {
    const response = await fetch("/api/levytate-application-workflows", { cache: "no-store" });
    const body = await response.json() as AdminState & { message?: string };
    if (!response.ok) { setMessage(body.message ?? "Application workflow could not be loaded."); return; }
    setState(body);
    setSteps(body.draft?.steps ?? body.published?.steps ?? []);
  }

  async function mutate(payload: object) {
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/levytate-application-workflows", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const body = await response.json() as { message?: string };
      if (!response.ok) throw new Error(body.message ?? "Workflow operation failed.");
      await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Workflow operation failed."); }
    finally { setBusy(false); }
  }

  function move(index: number, change: -1 | 1) {
    const target = index + change;
    if (index <= 0 || index >= steps.length - 1 || target <= 0 || target >= steps.length - 1) return;
    const next = [...steps];
    [next[index], next[target]] = [next[target], next[index]];
    setSteps(next);
  }

  function addStep() {
    if (steps.length >= 8) return;
    const next = [...steps];
    next.splice(next.length - 1, 0, { id: `approval-${crypto.randomUUID().slice(0, 8)}`, type: "role_approval", label: "Approval", responsibleRole: "Apprenticeship Lead", allowDecline: true });
    setSteps(next);
  }

  if (!state) return <section className="rounded-[1.25rem] border border-[#102c3d]/[0.07] bg-white p-5"><p className="text-sm text-[#102c3d]/60">{message || "Loading application workflow…"}</p></section>;
  const draft = state.draft;

  return (
    <section className="rounded-[1.25rem] border border-[#102c3d]/[0.07] bg-white p-5 shadow-[0_16px_44px_rgba(16,44,61,0.045)]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><h2 className="text-lg font-semibold text-[#102c3d]">Application workflow</h2><p className="mt-1 max-w-2xl text-sm leading-6 text-[#102c3d]/56">Configure the employer decisions between employee submission and provider handoff. Published versions remain fixed for applications already in progress.</p></div>
        {!draft ? <button type="button" disabled={busy} onClick={() => void mutate({ action: "create_draft" })} className="h-10 rounded-full bg-[#102c3d] px-5 text-xs font-semibold text-white">Create draft</button> : null}
      </div>

      <div className="mt-5 grid gap-3" aria-label="Application workflow steps">
        {steps.map((step, index) => {
          const fixed = index === 0 || index === steps.length - 1;
          return <article key={step.id} className="rounded-2xl border border-[#102c3d]/[0.08] bg-[#f8fbfa] p-4">
            <div className="flex flex-wrap items-start gap-3 sm:flex-nowrap">
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-white text-xs font-bold text-[#087c73]">{index + 1}</span>
              {fixed ? <span className="mt-1 rounded-full bg-[#e7f3f1] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-[#087c73]">Required</span> : null}
              <div className="order-2 grid min-w-0 basis-full flex-1 gap-3 sm:order-none sm:basis-auto sm:grid-cols-3">
                <label className="text-[11px] font-semibold uppercase tracking-[0.13em] text-[#102c3d]/46">Step label<input disabled={!draft || fixed} value={step.label} maxLength={80} onChange={(event) => setSteps(steps.map((item) => item.id === step.id ? { ...item, label: event.target.value } : item))} className="mt-1 h-10 w-full rounded-xl border border-[#102c3d]/10 bg-white px-3 text-sm normal-case tracking-normal text-[#102c3d] disabled:opacity-70" /></label>
                <label className="text-[11px] font-semibold uppercase tracking-[0.13em] text-[#102c3d]/46">Type<select disabled={!draft || fixed} value={step.type} onChange={(event) => setSteps(steps.map((item) => item.id === step.id ? { ...item, type: event.target.value as ApplicationWorkflowStep["type"] } : item))} className="mt-1 h-10 w-full rounded-xl border border-[#102c3d]/10 bg-white px-3 text-sm normal-case tracking-normal text-[#102c3d] disabled:opacity-70">{fixed ? <option value={step.type}>{step.type === "employee_submission" ? "Employee submission" : "Provider handoff"}</option> : <><option value="role_review">Review</option><option value="role_approval">Approval</option></>}</select></label>
                <label className="text-[11px] font-semibold uppercase tracking-[0.13em] text-[#102c3d]/46">Responsible role<select disabled={!draft || fixed} value={step.responsibleRole} onChange={(event) => setSteps(steps.map((item) => item.id === step.id ? { ...item, responsibleRole: event.target.value as ApplicationWorkflowStep["responsibleRole"] } : item))} className="mt-1 h-10 w-full rounded-xl border border-[#102c3d]/10 bg-white px-3 text-sm normal-case tracking-normal text-[#102c3d] disabled:opacity-70">{fixed ? <option>{step.responsibleRole}</option> : applicationWorkflowRoles.map((role) => <option key={role}>{role}</option>)}</select></label>
              </div>
              {draft && !fixed ? <div className="ml-auto flex gap-1 sm:ml-0"><button type="button" aria-label={`Move ${step.label} up`} onClick={() => move(index, -1)} className="grid size-9 place-items-center rounded-full bg-white"><ArrowUp size={15} /></button><button type="button" aria-label={`Move ${step.label} down`} onClick={() => move(index, 1)} className="grid size-9 place-items-center rounded-full bg-white"><ArrowDown size={15} /></button><button type="button" aria-label={`Remove ${step.label}`} onClick={() => setSteps(steps.filter((item) => item.id !== step.id))} className="grid size-9 place-items-center rounded-full bg-white text-red-700"><Trash2 size={15} /></button></div> : null}
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-[#102c3d]/[0.06] pt-3 text-xs text-[#102c3d]/55"><span>Available actions: {step.type === "employee_submission" ? "Submit" : step.type === "provider_handoff" ? "Operational handoff" : step.type === "role_approval" ? "Approve · Request information · Decline" : `Continue · Request information${step.allowDecline ? " · Decline" : ""}`}</span>{draft && !fixed && step.type === "role_review" ? <label className="inline-flex items-center gap-2 font-semibold text-[#102c3d]"><input type="checkbox" checked={step.allowDecline} onChange={(event) => setSteps(steps.map((item) => item.id === step.id ? { ...item, allowDecline: event.target.checked } : item))} />Allow decline</label> : null}</div>
          </article>;
        })}
      </div>

      {draft ? <div className="mt-4 flex flex-wrap items-center gap-3"><button type="button" disabled={steps.length >= 8} onClick={addStep} className="inline-flex h-10 items-center gap-2 rounded-full border border-[#102c3d]/10 px-4 text-xs font-semibold"><Plus size={15} />Add decision step</button><button type="button" disabled={busy || errors.length > 0} onClick={() => void mutate({ action: "save_draft", versionId: draft.id, steps })} className="h-10 rounded-full bg-[#102c3d] px-5 text-xs font-semibold text-white disabled:opacity-40">Save draft</button><button type="button" disabled={busy || errors.length > 0} onClick={() => { if (window.confirm("Publish this workflow? Existing applications will remain on their current version.")) void mutate({ action: "publish", versionId: draft.id }); }} className="h-10 rounded-full bg-[#087c73] px-5 text-xs font-semibold text-white disabled:opacity-40">Publish version {draft.version}</button></div> : null}
      {errors.length ? <ul className="mt-4 list-disc pl-5 text-xs leading-5 text-red-700">{errors.map((error) => <li key={error}>{error}</li>)}</ul> : null}
      {message ? <p role="status" className="mt-4 text-xs font-semibold text-[#102c3d]/65">{message}</p> : null}

      {!errors.length && steps.length ? <div className="mt-6 border-t border-[#102c3d]/[0.07] pt-5"><p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#102c3d]/45">Journey preview</p><ol className="mt-3 flex flex-wrap gap-2">{applicationWorkflowPreview(steps).map((step) => <li key={step.id} className="rounded-full bg-[#eef6f4] px-3 py-2 text-xs font-semibold text-[#102c3d]">{step.order}. {step.label}</li>)}</ol></div> : null}
      <div className="mt-6 border-t border-[#102c3d]/[0.07] pt-5"><p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#102c3d]/45">Version history</p><div className="mt-2 grid gap-2">{state.history.map((version) => <p key={version.id} className="text-sm text-[#102c3d]/65">Version {version.version} · {version.status} · {version.steps.length} steps</p>)}</div></div>
    </section>
  );
}
