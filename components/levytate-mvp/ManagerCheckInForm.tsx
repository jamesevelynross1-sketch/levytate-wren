"use client";

import { useState } from "react";
import { CalendarDays, Check, Plus, X } from "lucide-react";
import {
  managerActionOwnerLabels,
  managerCheckInPurposeLabels,
  managerConcernLabels,
  managerSupportAvailableLabels,
  managerSupportRequiredLabels,
  managerWorkplaceApplicationLabels,
  type ManagerActionOwner,
  type ManagerCheckInAgreedAction,
  type ManagerCheckInInput,
  type ManagerCheckInPurpose,
  type ManagerCheckInStatus,
  type ManagerConcern,
  type ManagerSupportAvailable,
  type ManagerSupportRequired,
  type ManagerWorkplaceApplication,
} from "@/lib/levytate/mvp/manager-check-in";
import type { ManagerDirectReportLearnerDetail } from "@/lib/levytate/mvp/manager-learner-detail";

type Props = {
  detail: ManagerDirectReportLearnerDetail;
  onClose: () => void;
  onSaved: (detail: ManagerDirectReportLearnerDetail) => void;
};

type FormState = Omit<ManagerCheckInInput, "idempotencyKey" | "expectedActivityVersion">;

export function ManagerCheckInForm({ detail, onClose, onSaved }: Props) {
  const [form, setForm] = useState<FormState>(() => initialForm());
  const [submissionKey] = useState(() => createSubmissionKey());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch(detail.managerCheckIn.submitUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, idempotencyKey: submissionKey, expectedActivityVersion: detail.managerCheckIn.formVersion }),
      });
      const payload = await response.json() as { message?: string; detail?: ManagerDirectReportLearnerDetail };
      if (!response.ok || !payload.detail) throw new Error(payload.message || "This check-in could not be recorded. Refresh the learner record and try again.");
      onSaved(payload.detail);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "This check-in could not be recorded. Refresh the learner record and try again.");
    } finally {
      setSaving(false);
    }
  }

  function toggleSupportAvailable(value: ManagerSupportAvailable) {
    setForm((current) => ({ ...current, supportAvailable: toggleValue(current.supportAvailable, value) }));
  }

  function toggleSupportRequired(value: ManagerSupportRequired) {
    setForm((current) => ({
      ...current,
      supportRequired: value === "no_additional_support"
        ? current.supportRequired.includes(value) ? [] : [value]
        : toggleValue(current.supportRequired.filter((item) => item !== "no_additional_support"), value),
    }));
  }

  function toggleConcern(value: ManagerConcern) {
    setForm((current) => {
      if (value === "no_current_concern") {
        return { ...current, concerns: current.concerns.some((item) => item.type === value) ? [] : [{ type: value, detail: "" }] };
      }
      const withoutNoConcern = current.concerns.filter((item) => item.type !== "no_current_concern");
      return {
        ...current,
        concerns: withoutNoConcern.some((item) => item.type === value)
          ? withoutNoConcern.filter((item) => item.type !== value)
          : [...withoutNoConcern, { type: value, detail: "" }],
      };
    });
  }

  function updateConcern(value: ManagerConcern, detailText: string) {
    setForm((current) => ({ ...current, concerns: current.concerns.map((item) => item.type === value ? { ...item, detail: detailText } : item) }));
  }

  function addAction() {
    setForm((current) => ({ ...current, agreedActions: [...current.agreedActions, { description: "", responsibleParty: "shared", targetDate: "" }] }));
  }

  function updateAction(index: number, changes: Partial<ManagerCheckInAgreedAction>) {
    setForm((current) => ({ ...current, agreedActions: current.agreedActions.map((item, actionIndex) => actionIndex === index ? { ...item, ...changes } : item) }));
  }

  function removeAction(index: number) {
    setForm((current) => ({ ...current, agreedActions: current.agreedActions.filter((_, actionIndex) => actionIndex !== index) }));
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-[#081d29]/45 p-0 backdrop-blur-[2px] sm:items-center sm:p-5" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="manager-check-in-title" className="flex max-h-[96vh] w-full max-w-4xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-[0_30px_90px_rgba(6,25,37,0.28)] sm:max-h-[92vh] sm:rounded-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-[#102c3d]/[0.08] px-5 py-4 sm:px-6">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#0b766b]">Workplace support record</p>
            <h2 id="manager-check-in-title" className="mt-1 text-xl font-semibold tracking-[-0.02em] text-[#102c3d]">Record manager check-in</h2>
            <p className="mt-1 text-sm text-[#102c3d]/58">{detail.employee.name} · {detail.programme?.programmeName ?? detail.journey.stage}</p>
          </div>
          <button type="button" onClick={onClose} disabled={saving} className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-[#102c3d]/52 transition hover:bg-[#f1f6f4] hover:text-[#102c3d] disabled:opacity-40" aria-label="Close manager check-in form"><X size={18} /></button>
        </div>

        <form onSubmit={submit} className="overflow-y-auto">
          <div className="grid gap-6 px-5 py-5 sm:px-6 sm:py-6">
            <FormSection number="1" title="Conversation" copy="Record when and why the workplace-support conversation took place.">
              <div className="grid gap-4 md:grid-cols-3">
                <Field label="Check-in date" required><input type="date" value={form.checkInDate} onChange={(event) => setForm((current) => ({ ...current, checkInDate: event.target.value }))} required className={inputClass} /></Field>
                <Field label="Discussion purpose" required><select value={form.discussionPurpose} onChange={(event) => setForm((current) => ({ ...current, discussionPurpose: event.target.value as ManagerCheckInPurpose }))} className={inputClass}>{options(managerCheckInPurposeLabels)}</select></Field>
                <Field label="Overall status" required><select value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as ManagerCheckInStatus }))} className={inputClass}><option value="completed">Completed</option><option value="action_required">Action required</option></select></Field>
              </div>
              {form.discussionPurpose === "other" ? <Field label="Other discussion purpose" required><textarea value={form.discussionPurposeDetail} onChange={(event) => setForm((current) => ({ ...current, discussionPurposeDetail: event.target.value }))} rows={2} className={inputClass} /></Field> : null}
            </FormSection>

            <FormSection number="2" title="Workplace application" copy="Describe practical learning application, not employee performance.">
              <Field label="Current workplace application" required><select value={form.workplaceApplication} onChange={(event) => setForm((current) => ({ ...current, workplaceApplication: event.target.value as ManagerWorkplaceApplication }))} className={inputClass}>{options(managerWorkplaceApplicationLabels)}</select></Field>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="How learning is being applied"><textarea value={form.learningApplied} onChange={(event) => setForm((current) => ({ ...current, learningApplied: event.target.value }))} rows={3} className={inputClass} placeholder="Concise workplace example" /></Field>
                <Field label="Opportunity currently available"><textarea value={form.workplaceOpportunityAvailable} onChange={(event) => setForm((current) => ({ ...current, workplaceOpportunityAvailable: event.target.value }))} rows={3} className={inputClass} placeholder="Project, task or evidence opportunity" /></Field>
                <Field label="Further opportunity needed"><textarea value={form.workplaceOpportunityNeeded} onChange={(event) => setForm((current) => ({ ...current, workplaceOpportunityNeeded: event.target.value }))} rows={3} className={inputClass} /></Field>
                <Field label="Supporting note"><textarea value={form.workplaceApplicationNote} onChange={(event) => setForm((current) => ({ ...current, workplaceApplicationNote: event.target.value }))} rows={3} className={inputClass} /></Field>
              </div>
            </FormSection>

            <FormSection number="3" title="Support and concerns" copy="Select only what was discussed. Avoid sensitive personal or medical detail.">
              <ChoiceGroup label="Support available" values={managerSupportAvailableLabels} selected={form.supportAvailable} onToggle={toggleSupportAvailable} />
              {form.supportAvailable.includes("other") ? <Field label="Other support available" required><textarea value={form.supportAvailableOtherDetail} onChange={(event) => setForm((current) => ({ ...current, supportAvailableOtherDetail: event.target.value }))} rows={2} className={inputClass} /></Field> : null}
              <ChoiceGroup label="Concerns or blockers" values={managerConcernLabels} selected={form.concerns.map((item) => item.type)} onToggle={toggleConcern} />
              {form.concerns.filter((item) => item.type !== "no_current_concern").map((concern) => <Field key={concern.type} label={`${managerConcernLabels[concern.type]} detail`} required><textarea value={concern.detail} onChange={(event) => updateConcern(concern.type, event.target.value)} rows={2} className={inputClass} /></Field>)}
            </FormSection>

            <FormSection number="4" title="Agreed actions" copy="These actions are check-in evidence and do not create general operational tasks.">
              <div className="grid gap-3">
                {form.agreedActions.map((action, index) => (
                  <div key={index} className="grid gap-3 rounded-xl bg-[#f7faf9] p-4 ring-1 ring-[#102c3d]/[0.06] md:grid-cols-[minmax(0,1fr)_180px_150px_36px] md:items-end">
                    <Field label="Action"><input value={action.description} onChange={(event) => updateAction(index, { description: event.target.value })} className={inputClass} /></Field>
                    <Field label="Responsible party"><select value={action.responsibleParty} onChange={(event) => updateAction(index, { responsibleParty: event.target.value as ManagerActionOwner })} className={inputClass}>{options(managerActionOwnerLabels)}</select></Field>
                    <Field label="Target date"><input type="date" value={action.targetDate} onChange={(event) => updateAction(index, { targetDate: event.target.value })} className={inputClass} /></Field>
                    <button type="button" onClick={() => removeAction(index)} className="grid h-10 w-9 place-items-center rounded-lg text-[#d84c5d] transition hover:bg-[#fff0f2]" aria-label={`Remove agreed action ${index + 1}`}><X size={16} /></button>
                  </div>
                ))}
              </div>
              <button type="button" onClick={addAction} disabled={form.agreedActions.length >= 8} className="inline-flex h-9 items-center gap-2 rounded-full border border-[#102c3d]/10 px-3.5 text-xs font-semibold text-[#102c3d] transition hover:bg-[#f4f8f6] disabled:opacity-40"><Plus size={14} /> Add agreed action</button>
            </FormSection>

            <FormSection number="5" title="Follow-up" copy="Record support still required and the next agreed check-in.">
              <ChoiceGroup label="Support required" values={managerSupportRequiredLabels} selected={form.supportRequired} onToggle={toggleSupportRequired} />
              {(form.supportRequired.includes("escalation_recommended") || form.supportRequired.includes("other")) ? <Field label="Support detail" required><textarea value={form.supportRequiredDetail} onChange={(event) => setForm((current) => ({ ...current, supportRequiredDetail: event.target.value }))} rows={2} className={inputClass} /></Field> : null}
              {form.status === "action_required" ? <Field label="Why action is required" required><textarea value={form.actionRequiredReason} onChange={(event) => setForm((current) => ({ ...current, actionRequiredReason: event.target.value }))} rows={2} className={inputClass} /></Field> : null}
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Next check-in date"><div className="relative"><CalendarDays size={15} className="pointer-events-none absolute left-3 top-3 text-[#102c3d]/35" /><input type="date" value={form.nextCheckInDate} onChange={(event) => setForm((current) => ({ ...current, nextCheckInDate: event.target.value }))} className={`${inputClass} pl-9`} /></div></Field>
                <Field label="Optional concise note"><textarea value={form.note} onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))} rows={2} className={inputClass} /></Field>
              </div>
            </FormSection>

            {error ? <div role="alert" className="rounded-xl bg-[#fff1f3] px-4 py-3 text-sm font-medium text-[#a9283b] ring-1 ring-[#d84c5d]/15">{error}</div> : null}
          </div>

          <div className="sticky bottom-0 flex flex-col-reverse gap-2 border-t border-[#102c3d]/[0.08] bg-white/95 px-5 py-4 backdrop-blur sm:flex-row sm:items-center sm:justify-end sm:px-6">
            <button type="button" onClick={onClose} disabled={saving} className="h-10 rounded-full px-5 text-sm font-semibold text-[#102c3d]/62 transition hover:bg-[#f3f7f5] disabled:opacity-40">Cancel</button>
            <button type="submit" disabled={saving} className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-[#102c3d] px-5 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-[#173f55] disabled:translate-y-0 disabled:opacity-55"><Check size={16} /> {saving ? "Recording…" : "Record manager check-in"}</button>
          </div>
        </form>
      </section>
    </div>
  );
}

function initialForm(): FormState {
  return {
    checkInDate: new Date().toISOString().slice(0, 10),
    nextCheckInDate: "",
    discussionPurpose: "routine_progress",
    discussionPurposeDetail: "",
    workplaceApplication: "some_application",
    learningApplied: "",
    workplaceOpportunityAvailable: "",
    workplaceOpportunityNeeded: "",
    workplaceApplicationNote: "",
    supportAvailable: ["manager_feedback"],
    supportAvailableOtherDetail: "",
    concerns: [{ type: "no_current_concern", detail: "" }],
    agreedActions: [],
    supportRequired: ["no_additional_support"],
    supportRequiredDetail: "",
    actionRequiredReason: "",
    note: "",
    status: "completed",
  };
}

function FormSection({ number, title, copy, children }: { number: string; title: string; copy: string; children: React.ReactNode }) {
  return <fieldset className="grid gap-4 rounded-2xl border border-[#102c3d]/[0.07] p-4 sm:p-5"><legend className="sr-only">{title}</legend><div className="flex gap-3"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[#e8f6f2] text-xs font-semibold text-[#0b766b]">{number}</span><div><h3 className="text-sm font-semibold text-[#102c3d]">{title}</h3><p className="mt-0.5 text-xs leading-5 text-[#102c3d]/52">{copy}</p></div></div>{children}</fieldset>;
}

function Field({ label, required = false, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return <label className="grid min-w-0 gap-1.5 text-xs font-semibold text-[#102c3d]/68"><span>{label}{required ? <span className="ml-1 text-[#d84c5d]" aria-hidden="true">*</span> : null}</span>{children}</label>;
}

function ChoiceGroup<T extends string>({ label, values, selected, onToggle }: { label: string; values: Record<T, string>; selected: T[]; onToggle: (value: T) => void }) {
  return <div><p className="mb-2 text-xs font-semibold text-[#102c3d]/68">{label}<span className="ml-1 text-[#d84c5d]" aria-hidden="true">*</span></p><div className="flex flex-wrap gap-2">{(Object.entries(values) as Array<[T, string]>).map(([value, text]) => { const active = selected.includes(value); return <button key={value} type="button" aria-pressed={active} onClick={() => onToggle(value)} className={`rounded-full border px-3 py-2 text-xs font-semibold transition ${active ? "border-[#159b8f]/35 bg-[#e8f6f2] text-[#0b766b]" : "border-[#102c3d]/10 bg-white text-[#102c3d]/58 hover:border-[#159b8f]/30 hover:text-[#102c3d]"}`}>{text}</button>; })}</div></div>;
}

function options<T extends string>(values: Record<T, string>) {
  return (Object.entries(values) as Array<[T, string]>).map(([value, label]) => <option key={value} value={value}>{label}</option>);
}

function toggleValue<T>(values: T[], value: T) {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

function createSubmissionKey() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID().replace(/-/g, "");
  return `${Date.now()}_${Math.random().toString(36).slice(2, 14)}`;
}

const inputClass = "min-h-10 w-full rounded-xl border border-[#102c3d]/10 bg-white px-3 py-2.5 text-sm font-medium text-[#102c3d] outline-none transition placeholder:text-[#102c3d]/30 focus:border-[#159b8f]/55 focus:ring-2 focus:ring-[#159b8f]/10";
