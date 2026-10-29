"use client";

import { useState, type FormEvent } from "react";
import { FormField, FormGrid, FormSelect, FormTextArea } from "@/components/levytate-mvp/MvpUi";
import type { LearnerRecordDetail } from "@/lib/levytate/mvp/learner-record-view";

export function LearnerOutcomePanel({ detail, onSaved }: { detail: LearnerRecordDetail; onSaved: (detail: LearnerRecordDetail) => void }) {
  const [outcome, setOutcome] = useState("withdrawal");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [key, setKey] = useState(() => `outcome-${crypto.randomUUID()}`);
  const [form, setForm] = useState({ effectiveDate: "", notes: "", reasonCategory: "", initiatedBy: "", grade: "", gradeType: "", certificateReceivedDate: "", providerNotifiedDate: "", employeeNotifiedDate: "" });
  const terminal = ["withdrawn", "achieved", "completed_without_achievement"].includes(detail.lifecycleStatus);
  const update = (field: keyof typeof form, value: string) => setForm((previous) => ({ ...previous, [field]: value }));
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/levytate-learners/${encodeURIComponent(detail.learnerRecordId)}/outcome`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, outcome, idempotencyKey: key, expectedActivityVersion: detail.activityVersion, providerNotified: Boolean(form.providerNotifiedDate), employeeNotified: Boolean(form.employeeNotifiedDate), certificateReceived: Boolean(form.certificateReceivedDate) }) });
      const result = await response.json() as { learner?: LearnerRecordDetail; message?: string };
      if (!response.ok || !result.learner) throw new Error(result.message || "The outcome could not be confirmed. Your input is retained.");
      onSaved(result.learner); setOpen(false); setKey(`outcome-${crypto.randomUUID()}`);
    } catch (failure) { setError(failure instanceof Error ? failure.message : "The outcome could not be confirmed. Retry with the same input."); }
    finally { setBusy(false); }
  }
  return <section className="rounded-2xl border border-[#102c3d]/10 bg-white p-5"><h3 className="font-semibold text-[#102c3d]">Completion and withdrawal</h3>
    {terminal ? <p role="status" className="mt-3 text-sm leading-6">{detail.lifecycleStatusLabel} on {detail.actualEndDate || "the recorded outcome date"}. {detail.achievement ? `${detail.achievement.grade}. ${detail.achievement.resultNotes}` : detail.withdrawal?.reasonNotes} The recorded outcome is retained in the lifecycle history.</p>
      : <><p className="mt-2 text-sm leading-6 text-[#102c3d]/65">Record an evidenced final outcome. This closes the learner journey and cannot be reversed here. No notification messages are sent by this form.</p><button type="button" disabled={busy} onClick={() => setOpen((value) => !value)} className="mt-3 min-h-11 rounded-xl border px-4 text-sm font-semibold">{open ? "Hide outcome form" : "Record final outcome"}</button>
        {open ? <form onSubmit={(event) => void submit(event)} className="mt-4 grid gap-4"><fieldset disabled={busy} className="grid gap-4"><FormSelect label="Outcome" value={outcome} onChange={setOutcome} options={[{ value: "withdrawal", label: "Withdrawal" }, ...(detail.lifecycleStatus === "in_assessment" ? [{ value: "achievement", label: "Confirmed achievement" }, { value: "completion_without_achievement", label: "Completed without achievement" }] : [])]} />
          <FormGrid><FormField label="Effective date" type="date" value={form.effectiveDate} onChange={(value) => update("effectiveDate", value)} required />
            {outcome === "withdrawal" ? <><FormField label="Withdrawal reason category" value={form.reasonCategory} onChange={(value) => update("reasonCategory", value)} required /><FormField label="Initiated by" value={form.initiatedBy} onChange={(value) => update("initiatedBy", value)} required /><FormField label="Provider already notified on (optional)" type="date" value={form.providerNotifiedDate} onChange={(value) => update("providerNotifiedDate", value)} /><FormField label="Employee already notified on (optional)" type="date" value={form.employeeNotifiedDate} onChange={(value) => update("employeeNotifiedDate", value)} /></> : outcome === "achievement" ? <><FormField label="Confirmed grade" value={form.grade} onChange={(value) => update("grade", value)} required /><FormField label="Grade type" value={form.gradeType} onChange={(value) => update("gradeType", value)} required /><FormField label="Certificate received on (optional)" type="date" value={form.certificateReceivedDate} onChange={(value) => update("certificateReceivedDate", value)} /></> : null}</FormGrid>
          <FormTextArea label="Outcome evidence and reason" value={form.notes} onChange={(value) => update("notes", value)} required /><button type="submit" className="min-h-11 rounded-xl bg-[#102c3d] px-4 text-sm font-semibold text-white">{busy ? "Saving outcome…" : "Confirm and close learner journey"}</button></fieldset>{error ? <p role="alert" className="text-sm text-red-800">{error}</p> : null}</form> : null}</>}
  </section>;
}
