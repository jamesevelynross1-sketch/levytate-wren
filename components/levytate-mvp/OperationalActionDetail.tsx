"use client";

import { ArrowLeft, ArrowRight, CalendarClock, CheckCircle2, CircleDot, Clock3, History, UserRound } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { StatusBadge } from "@/components/levytate-mvp/MvpUi";
import { operationalActionStatusLabels, type OperationalActionEvent, type PersistentOperationalAction } from "@/lib/levytate/mvp/operational-actions";
import type { OperationalActionType } from "@/lib/levytate/mvp/operations-centre";
import type { OperationalActionManagementDetail, OperationalActionOwnerOption } from "@/lib/server/levytate-operational-actions";

type ActionDetailResponse = Partial<OperationalActionManagementDetail> & { ok?: boolean; message?: string };
type LearnerTarget = { learnerRecordId: string; actionType: OperationalActionType };

export function OperationalActionDetail({ actionId, onBack, onOpenAction, onOpenLearner, onChanged }: { actionId: string; onBack: () => void; onOpenAction: (actionId: string) => void; onOpenLearner: (target: LearnerTarget) => void; onChanged: () => void }) {
  const [detail, setDetail] = useState<OperationalActionManagementDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/levytate-operational-actions/${encodeURIComponent(actionId)}?management=true`, { cache: "no-store" });
      const payload = await response.json() as ActionDetailResponse;
      if (!response.ok || !payload.action || !payload.context || !payload.history || !payload.previousOccurrences || !payload.ownerOptions) throw new Error(payload.message ?? "The action could not be loaded.");
      setDetail(payload as OperationalActionManagementDetail);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "The action could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [actionId]);

  useEffect(() => { void load(); }, [load]);

  async function mutate(command: string, payload: Record<string, unknown>, success: string) {
    if (!detail) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/levytate-operational-actions/${encodeURIComponent(actionId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command, expectedVersion: detail.action.version, ...payload }),
      });
      const result = await response.json() as { message?: string };
      if (!response.ok) {
        if (response.status === 409) throw new Error("This action was updated by someone else. Refresh to see the latest version.");
        throw new Error(result.message ?? "The action could not be updated.");
      }
      setNotice(success);
      await load();
      onChanged();
    } catch (mutationError) {
      setError(mutationError instanceof Error ? mutationError.message : "The action could not be updated.");
    } finally {
      setSaving(false);
    }
  }

  if (loading && !detail) return <div className="rounded-2xl border border-[#102c3d]/[0.07] bg-white px-6 py-16 text-center text-sm font-semibold text-[#102c3d]/[0.52]">Loading operational action.</div>;
  if (!detail) return <div className="rounded-2xl border border-[#b13b51]/[0.10] bg-[#fff0f2] p-5"><p className="text-sm font-semibold text-[#b13b51]">{error || "The action is unavailable."}</p><button type="button" onClick={onBack} className="mt-4 text-xs font-semibold text-[#102c3d]">Return to Operations Centre</button></div>;

  const { action, context } = detail;
  const terminal = ["completed", "dismissed", "cancelled"].includes(action.status);
  const applicationReview = action.actionType === "review_application";
  const primary = applicationReview
    ? { label: context.workflowLabel, run: () => window.location.assign(action.sourceUrl) }
    : action.status === "open"
    ? { label: "Acknowledge", run: () => mutate("acknowledge", {}, "Action acknowledged.") }
    : action.status === "acknowledged"
      ? { label: "Start work", run: () => mutate("start", {}, "Action marked as in progress.") }
      : action.status === "in_progress"
        ? { label: context.workflowLabel, run: () => applicationReview ? window.location.assign(action.sourceUrl) : onOpenLearner({ learnerRecordId: action.learnerRecordId, actionType: context.workflowActionType }) }
        : { label: "View history", run: () => document.getElementById("operational-action-history")?.scrollIntoView({ behavior: "smooth" }) };

  return (
    <div className="grid min-w-0 gap-5" data-testid="operational-action-detail" data-action-status={action.status}>
      <button type="button" onClick={onBack} className="inline-flex w-fit items-center gap-2 text-xs font-semibold text-[#102c3d]/[0.58] transition hover:text-[#0b6f63]"><ArrowLeft size={15} />Back to Operations Centre</button>

      <section className="overflow-hidden rounded-2xl border border-[#102c3d]/[0.075] bg-white shadow-[0_18px_46px_rgba(16,44,61,0.055)]">
        <div className="border-b border-[#102c3d]/[0.06] bg-[linear-gradient(135deg,#ffffff_0%,#f4faf7_100%)] p-5 sm:p-7">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div className="max-w-3xl">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge tone={priorityTone(action.priority)}>{action.priority}</StatusBadge>
                <StatusBadge tone={statusTone(action.status)}>{operationalActionStatusLabels[action.status]}</StatusBadge>
                <span className="text-xs font-semibold text-[#102c3d]/[0.45]">Detected {formatDateTime(action.detectedAt)}</span>
              </div>
              <h2 className="mt-3 text-2xl font-semibold tracking-[-0.025em] text-[#102c3d] sm:text-[1.75rem]">{action.title}</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[#102c3d]/[0.62]">{context.sourceReason}</p>
            </div>
            <button type="button" onClick={primary.run} disabled={saving} className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-full bg-[#102c3d] px-5 text-xs font-semibold text-white shadow-[0_12px_24px_rgba(16,44,61,0.14)] transition hover:-translate-y-0.5 hover:bg-[#17394d] disabled:cursor-wait disabled:opacity-55">{primary.label}<ArrowRight size={15} /></button>
          </div>

          <div className="mt-6 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            <HeaderFact icon={UserRound} label="Learner" value={context.learnerName} detail={`${context.jobTitle} · ${context.site}`} />
            <HeaderFact icon={CircleDot} label="Owner" value={action.ownerDisplayName || action.ownerType} detail={action.ownerUserId ? "Assigned platform user" : `${action.ownerType} accountability`} />
            <HeaderFact icon={CalendarClock} label="Due date" value={action.dueDate ? formatDate(action.dueDate) : "No due date"} detail={dueLabel(action.dueDate, action.status)} />
            <HeaderFact icon={Clock3} label="Programme" value={context.programmeName} detail={context.providerName || "Provider not confirmed"} />
          </div>
        </div>

        <div className="grid gap-6 p-5 sm:p-7 xl:grid-cols-[minmax(0,1.25fr)_minmax(330px,0.75fr)]">
          <div className="grid content-start gap-5">
            <section>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#c95568]">Source context</p>
              <h3 className="mt-1 text-lg font-semibold text-[#102c3d]">Why this action exists</h3>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {context.sourceFacts.map((fact) => <div key={`${fact.label}-${fact.value}`} className="rounded-xl border border-[#102c3d]/[0.065] bg-[#f8fbfa] p-3.5"><p className="text-[10px] font-semibold uppercase tracking-[0.11em] text-[#102c3d]/[0.38]">{fact.label}</p><p className="mt-1.5 text-sm font-semibold leading-5 text-[#102c3d]">{fact.value}</p></div>)}
              </div>
              <button type="button" onClick={() => applicationReview ? window.location.assign(action.sourceUrl) : onOpenLearner({ learnerRecordId: action.learnerRecordId, actionType: "open_learner" })} className="mt-3 inline-flex items-center gap-2 text-xs font-semibold text-[#0b6f63] hover:text-[#102c3d]">{applicationReview ? "Open application review" : "Open learner record"}<ArrowRight size={14} /></button>
            </section>

            <section id="operational-action-history" className="border-t border-[#102c3d]/[0.07] pt-5">
              <div className="flex items-center gap-2"><History size={17} className="text-[#0b6f63]" /><h3 className="text-lg font-semibold text-[#102c3d]">Action history</h3></div>
              <p className="mt-1 text-xs leading-5 text-[#102c3d]/[0.48]">A complete, chronological record of how this issue has been managed.</p>
              <HistoryList items={detail.history} />
            </section>

            {detail.previousOccurrences.length ? <section className="border-t border-[#102c3d]/[0.07] pt-5"><h3 className="text-base font-semibold text-[#102c3d]">Previous occurrences</h3><div className="mt-3 grid gap-2">{detail.previousOccurrences.map((occurrence) => <button type="button" key={occurrence.id} onClick={() => onOpenAction(occurrence.id)} className="grid gap-2 rounded-xl border border-[#102c3d]/[0.065] bg-[#f8fbfa] p-3.5 text-left transition hover:-translate-y-0.5 hover:border-[#159b8f]/[0.25] hover:bg-white hover:shadow-[0_10px_24px_rgba(16,44,61,0.06)] sm:grid-cols-[1fr_auto] sm:items-center"><div><p className="text-sm font-semibold text-[#102c3d]">Detected {formatDate(occurrence.detectedAt)}</p><p className="mt-1 text-xs text-[#102c3d]/[0.52]">{occurrence.completionNote || occurrence.dismissalReason || "Occurrence closed."}</p></div><StatusBadge tone={statusTone(occurrence.status)}>{operationalActionStatusLabels[occurrence.status]}</StatusBadge></button>)}</div></section> : null}
          </div>

          <aside className="grid content-start gap-3">
            {notice ? <div className="rounded-xl border border-[#159b8f]/[0.15] bg-[#edf7f3] px-4 py-3 text-sm font-semibold text-[#0b6f63]">{notice}</div> : null}
            {error ? <div className="rounded-xl border border-[#b13b51]/[0.12] bg-[#fff0f2] px-4 py-3 text-sm font-semibold leading-5 text-[#b13b51]">{error}</div> : null}

            {!terminal ? <>
              {applicationReview ? <SourceWorkflowCard label={context.workflowLabel} onOpen={() => window.location.assign(action.sourceUrl)} applicationReview /> : <>
                <ActionStateControls action={action} saving={saving} mutate={mutate} />
                <AssignmentForm action={action} options={detail.ownerOptions} saving={saving} onSave={(option) => mutate("assign", { ownerType: option.ownerType, ownerUserId: option.ownerUserId }, "Action owner updated.")} />
                <DueDateForm action={action} origin={context.dueDateOrigin} saving={saving} onSave={(date, reason) => mutate("due_date", { dueDate: date, dueDateReason: reason }, "Due date updated.")} />
                <SourceWorkflowCard label={context.workflowLabel} onOpen={() => onOpenLearner({ learnerRecordId: action.learnerRecordId, actionType: context.workflowActionType })} />
                <CompletionForm saving={saving} onSubmit={(note) => mutate("complete", { completionNote: note, resolvedOutsideLevyTate: true }, "Action completed.")} />
                <DismissalForm protectedAction={context.terminalProtection} saving={saving} onSubmit={(kind, reason) => mutate("dismiss", { dismissalKind: kind, dismissalReason: reason }, "Action dismissed.")} />
                <CancellationForm protectedAction={context.terminalProtection} saving={saving} onSubmit={(kind, reason) => mutate("cancel", { cancellationKind: kind, cancellationReason: reason }, "Action cancelled.")} />
              </>}
            </> : <TerminalSummary action={action} />}
          </aside>
        </div>
      </section>
    </div>
  );
}

function ActionStateControls({ action, saving, mutate }: { action: PersistentOperationalAction; saving: boolean; mutate: (command: string, payload: Record<string, unknown>, success: string) => Promise<void> }) {
  return <section className="rounded-2xl border border-[#102c3d]/[0.075] bg-[#f8fbfa] p-4"><p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-[#0b6f63]">Current next step</p><h3 className="mt-1 text-base font-semibold text-[#102c3d]">{action.status === "open" ? "Acknowledge responsibility" : action.status === "acknowledged" ? "Begin the work" : "Resolve the learner issue"}</h3><p className="mt-1 text-xs leading-5 text-[#102c3d]/[0.52]">Status changes record the signed-in actor and time. They do not change learner lifecycle data.</p><div className="mt-3 flex flex-wrap gap-2">{action.status === "open" ? <button type="button" disabled={saving} onClick={() => mutate("acknowledge", {}, "Action acknowledged.")} className="action-button-primary">Acknowledge</button> : null}{action.status === "open" || action.status === "acknowledged" ? <button type="button" disabled={saving} onClick={() => mutate("start", {}, "Action marked as in progress.")} className="action-button-secondary">Start work</button> : null}</div></section>;
}

function AssignmentForm({ action, options, saving, onSave }: { action: PersistentOperationalAction; options: OperationalActionOwnerOption[]; saving: boolean; onSave: (option: OperationalActionOwnerOption) => void }) {
  const keys = useMemo(() => options.map(ownerOptionKey), [options]);
  const current = options.find((option) => option.ownerType === action.ownerType && option.ownerUserId === action.ownerUserId) ?? options.find((option) => option.ownerType === action.ownerType);
  const [value, setValue] = useState(current ? ownerOptionKey(current) : keys[0] ?? "");
  useEffect(() => { if (current) setValue(ownerOptionKey(current)); }, [action.id, action.version, current]);
  const selected = options.find((option) => ownerOptionKey(option) === value);
  return <details className="action-management-panel" open><summary>Ownership</summary><div className="mt-3"><label className="text-[10px] font-semibold uppercase tracking-[0.11em] text-[#102c3d]/[0.42]">Accountable owner<select value={value} onChange={(event) => setValue(event.target.value)} className="action-input mt-1.5">{options.map((option) => <option key={ownerOptionKey(option)} value={ownerOptionKey(option)}>{option.label} · {option.ownerType}</option>)}</select></label>{selected ? <p className="mt-2 text-xs leading-5 text-[#102c3d]/[0.48]">{selected.accessNote}</p> : null}<button type="button" disabled={saving || !selected || ownerOptionKey(selected) === ownerOptionKey(current)} onClick={() => selected && onSave(selected)} className="action-button-secondary mt-3">Save owner</button></div></details>;
}

function DueDateForm({ action, origin, saving, onSave }: { action: PersistentOperationalAction; origin: string; saving: boolean; onSave: (date: string, reason: string) => void }) {
  const [date, setDate] = useState(action.dueDate);
  const [reason, setReason] = useState("");
  useEffect(() => { setDate(action.dueDate); setReason(""); }, [action.dueDate, action.id, action.version]);
  return <details className="action-management-panel"><summary>Due date</summary><div className="mt-3 grid gap-3"><label className="text-[10px] font-semibold uppercase tracking-[0.11em] text-[#102c3d]/[0.42]">Due date<input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="action-input mt-1.5" /></label><label className="text-[10px] font-semibold uppercase tracking-[0.11em] text-[#102c3d]/[0.42]">Override reason<textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={2} className="action-input mt-1.5 resize-none" placeholder="Required when changing the current due date" /></label><p className="text-xs text-[#102c3d]/[0.48]">Current basis: {origin}</p><button type="button" disabled={saving || date === action.dueDate} onClick={() => onSave(date, reason)} className="action-button-secondary">Save due date</button></div></details>;
}

function SourceWorkflowCard({ label, onOpen, applicationReview = false }: { label: string; onOpen: () => void; applicationReview?: boolean }) {
  return <section className="rounded-2xl border border-[#159b8f]/[0.15] bg-[#edf7f3] p-4"><p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-[#0b6f63]">Linked workflow</p><h3 className="mt-1 text-base font-semibold text-[#102c3d]">{applicationReview ? "Open the application record" : "Resolve the learner issue"}</h3><p className="mt-1 text-xs leading-5 text-[#102c3d]/[0.54]">{applicationReview ? "Review the application context in Approvals. Only the authorised current Line Manager can record its decision." : "Complete the linked workflow. LevyTate will then close this action automatically and retain its history."}</p><button type="button" onClick={onOpen} className="action-button-primary mt-3">{label}<ArrowRight size={14} /></button></section>;
}

function CompletionForm({ saving, onSubmit }: { saving: boolean; onSubmit: (note: string) => void }) {
  const [note, setNote] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  return <details className="action-management-panel"><summary>Manual completion</summary><div className="mt-3 grid gap-3"><p className="text-xs leading-5 text-[#102c3d]/[0.52]">Use only when the issue has already been resolved outside LevyTate and is no longer active.</p><textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3} className="action-input resize-none" placeholder="Record how the issue was resolved" /><label className="flex items-start gap-2 text-xs leading-5 text-[#102c3d]/[0.58]"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} className="mt-1 accent-[#159b8f]" />I confirm the issue was resolved outside LevyTate.</label><button type="button" disabled={saving || !confirmed || note.trim().length < 12} onClick={() => onSubmit(note)} className="action-button-secondary">Complete action</button></div></details>;
}

function DismissalForm({ protectedAction, saving, onSubmit }: { protectedAction: boolean; saving: boolean; onSubmit: (kind: string, reason: string) => void }) {
  const [kind, setKind] = useState("not_applicable");
  const [reason, setReason] = useState("");
  return <details className="action-management-panel" data-testid="dismiss-action-panel"><summary>Dismiss action</summary><form onSubmit={(event) => { event.preventDefault(); onSubmit(kind, reason); }} className="mt-3 grid gap-3"><div className="rounded-xl bg-[#fff8df] px-3 py-2.5 text-xs leading-5 text-[#6d5900]">Dismissing this action does not change the learner&apos;s underlying record.</div><select value={kind} onChange={(event) => setKind(event.target.value)} className="action-input"><option value="not_applicable">Not applicable</option><option value="duplicate_administrative_warning">Duplicate administrative warning</option><option value="managed_outside_levytate">Managed outside LevyTate</option><option value="incorrect_source_data">Incorrect source data</option><option value="no_action_required">No action required</option><option value="other">Other</option></select><textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={3} className="action-input resize-none" placeholder="Explain why this action should be dismissed" /><button type="submit" disabled={saving || reason.trim().length < 12} className="action-button-danger">{protectedAction ? "Test protected dismissal" : "Dismiss action"}</button>{protectedAction ? <p className="text-xs font-semibold text-[#b13b51]">This compliance blocker remains protected by the server.</p> : null}</form></details>;
}

function CancellationForm({ protectedAction, saving, onSubmit }: { protectedAction: boolean; saving: boolean; onSubmit: (kind: string, reason: string) => void }) {
  const [kind, setKind] = useState("invalidly_generated");
  const [reason, setReason] = useState("");
  return <details className="action-management-panel"><summary>Administrative cancellation</summary><form onSubmit={(event) => { event.preventDefault(); onSubmit(kind, reason); }} className="mt-3 grid gap-3"><p className="text-xs leading-5 text-[#102c3d]/[0.52]">Only for duplicate, invalid or superseded administrative actions. It does not resolve the learner issue.</p><select value={kind} onChange={(event) => setKind(event.target.value)} className="action-input"><option value="duplicate_legacy_action">Duplicate legacy action</option><option value="invalidly_generated">Invalidly generated action</option><option value="superseded_administrative_action">Superseded administrative action</option></select><textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={3} className="action-input resize-none" placeholder="Record the administrative correction" /><button type="submit" disabled={saving || protectedAction || reason.trim().length < 12} className="action-button-danger">Cancel action</button></form></details>;
}

function TerminalSummary({ action }: { action: PersistentOperationalAction }) {
  const copy = action.status === "dismissed" ? action.dismissalReason : action.completionNote;
  return <section className="rounded-2xl border border-[#102c3d]/[0.075] bg-[#f8fbfa] p-4"><div className="flex items-center gap-2"><CheckCircle2 size={17} className="text-[#0b6f63]" /><h3 className="text-base font-semibold text-[#102c3d]">{operationalActionStatusLabels[action.status]}</h3></div><p className="mt-2 text-xs leading-5 text-[#102c3d]/[0.56]">{copy || "This occurrence is closed and cannot be reopened."}</p><p className="mt-2 text-xs font-semibold text-[#102c3d]/[0.44]">Closed {formatDateTime(action.completedAt || action.dismissedAt || action.updatedAt)}</p></section>;
}

function HistoryList({ items }: { items: OperationalActionEvent[] }) {
  if (!items.length) return <p className="mt-4 rounded-xl bg-[#f8fbfa] px-4 py-5 text-sm text-[#102c3d]/[0.50]">No action events have been recorded.</p>;
  return <ol className="mt-4 grid gap-1">{items.map((item) => <li key={item.id} className="grid grid-cols-[22px_minmax(0,1fr)] gap-3 py-2"><span className="mt-1 grid h-5 w-5 place-items-center rounded-full bg-[#edf7f3] text-[#0b6f63]"><CircleDot size={10} /></span><div className="min-w-0"><div className="flex flex-wrap items-baseline justify-between gap-2"><p className="text-sm font-semibold capitalize text-[#102c3d]">{item.eventType.replace(/_/g, " ")}</p><time className="text-[11px] font-semibold text-[#102c3d]/[0.38]">{formatDateTime(item.eventDate)}</time></div><p className="mt-0.5 text-xs leading-5 text-[#102c3d]/[0.54]">{item.summary}</p><p className="mt-1 text-[11px] text-[#102c3d]/[0.38]">{item.actorName}{item.previousStatus || item.newStatus ? ` · ${statusJourney(item)}` : ""}</p></div></li>)}</ol>;
}

function HeaderFact({ icon: Icon, label, value, detail }: { icon: typeof UserRound; label: string; value: string; detail: string }) {
  return <div className="flex min-w-0 items-start gap-3 rounded-xl border border-[#102c3d]/[0.065] bg-white/[0.86] p-3.5"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#edf7f3] text-[#0b6f63]"><Icon size={15} /></span><div className="min-w-0"><p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[#102c3d]/[0.38]">{label}</p><p className="mt-1 truncate text-sm font-semibold text-[#102c3d]">{value}</p><p className="mt-0.5 truncate text-[11px] text-[#102c3d]/[0.44]">{detail}</p></div></div>;
}

function ownerOptionKey(option?: OperationalActionOwnerOption) { return option ? `${option.ownerType}|${option.ownerUserId}|${option.label}` : ""; }
function priorityTone(priority: string) { return priority === "Critical" || priority === "High" ? "red" as const : priority === "Medium" ? "yellow" as const : "blue" as const; }
function statusTone(status: PersistentOperationalAction["status"]) { return status === "completed" ? "green" as const : status === "dismissed" || status === "cancelled" ? "neutral" as const : status === "in_progress" ? "blue" as const : status === "acknowledged" ? "yellow" as const : "neutral" as const; }
function formatDate(value: string) { if (!value) return ""; return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${value.slice(0, 10)}T00:00:00.000Z`)); }
function formatDateTime(value: string) { if (!value) return ""; return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(value)); }
function dueLabel(value: string, status: string) { if (["completed", "dismissed", "cancelled"].includes(status)) return "Closed occurrence"; if (!value) return "No deadline recorded"; const days = Math.ceil((new Date(`${value}T00:00:00.000Z`).getTime() - new Date().setHours(0, 0, 0, 0)) / 86_400_000); return days < 0 ? `${Math.abs(days)} days overdue` : days === 0 ? "Due today" : `${days} days remaining`; }
function statusJourney(item: OperationalActionEvent) { const from = item.previousStatus ? operationalActionStatusLabels[item.previousStatus] : "Detected"; const to = item.newStatus ? operationalActionStatusLabels[item.newStatus] : from; return from === to ? to : `${from} to ${to}`; }
