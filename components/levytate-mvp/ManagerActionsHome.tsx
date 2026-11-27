"use client";

import { ArrowRight, Clock3, LoaderCircle } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { FormTextArea, MvpModal, MvpPanel, StatusBadge } from "@/components/levytate-mvp/MvpUi";
import { OperationsReadbackRecovery } from "@/components/levytate-mvp/OperationsReadbackRecovery";
import { ClientMutationRecovery } from "@/components/levytate-mvp/ClientMutationRecovery";
import { useOperationsClientCommand } from "@/components/levytate-mvp/useOperationsClientCommand";
import { decodeManagerAction, decodeManagerActions, decodeManagerMutation } from "@/lib/levytate/operations-client-response";
import { useRetainedWorkspaceRequest } from "@/components/levytate-mvp/useRetainedWorkspaceRequest";
import type {
  ManagerOperationalActionDetail,
  ManagerOperationalActionFilter,
  ManagerOperationalActionKindFilter,
  ManagerOperationalActionListItem,
  ManagerOperationalActionsResponse,
} from "@/lib/levytate/mvp/manager-operational-actions";

const filters: Array<{ value: ManagerOperationalActionFilter; label: string; summaryKey?: keyof ManagerOperationalActionsResponse["summary"] }> = [
  { value: "all", label: "All" },
  { value: "open", label: "Open", summaryKey: "open" },
  { value: "acknowledged", label: "Acknowledged", summaryKey: "acknowledged" },
  { value: "in_progress", label: "In progress", summaryKey: "inProgress" },
  { value: "overdue", label: "Overdue", summaryKey: "overdue" },
];

export function ManagerActionsHome({ kind = "manager_support" }: { kind?: ManagerOperationalActionKindFilter }) {
  const retainedRequest = useRetainedWorkspaceRequest();
  const [filter, setFilter] = useState<ManagerOperationalActionFilter>("all");
  const [response, setResponse] = useState<ManagerOperationalActionsResponse | null>(null);
  const [selected, setSelected] = useState<ManagerOperationalActionDetail | null>(null);
  const [startNote, setStartNote] = useState("");
  const [loading, setLoading] = useState(true);
  const mutation = useOperationsClientCommand();
  const [readbackRequired, setReadbackRequired] = useState(false);
  const confirmedVersions = useRef(new Map<string, number>());
  const mutating = mutation.locked || readbackRequired;
  const scope = mutation.scope;
  const [error, setError] = useState("");
  const [confirmation, setConfirmation] = useState("");

  const load = useCallback(async (nextFilter: ManagerOperationalActionFilter) => {
    setLoading(true);
    setError("");
    try {
      const request = await retainedRequest(`/api/levytate-manager/actions?status=${encodeURIComponent(nextFilter)}&kind=${encodeURIComponent(kind)}`, { cache: "no-store" });
      if (!request.ok) throw new Error("Your actions could not be loaded.");
      const next = decodeManagerActions(await request.json(), scope);
      if (next.actions.some(action => action.version < (confirmedVersions.current.get(action.actionId) ?? 0))) throw new Error("The latest saved actions have not been returned yet.");
      setResponse(next); setReadbackRequired(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Your actions could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [kind, retainedRequest, scope]);

  const openAction = useCallback(async (actionId: string, updateUrl = true) => {
    setError("");
    setConfirmation("");
    try {
      const request = await retainedRequest(`/api/levytate-manager/actions/${encodeURIComponent(actionId)}`, { cache: "no-store" });
      if (!request.ok) throw new Error("That action could not be opened.");
      setSelected(decodeManagerAction(await request.json(), scope, actionId));
      setStartNote("");
      if (updateUrl) window.history.replaceState(null, "", `/levytate/app?module=Home&managerAction=${encodeURIComponent(actionId)}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "That action could not be opened.");
    }
  }, [retainedRequest, scope]);

  useEffect(() => { void load(filter); }, [filter, load]);

  useEffect(() => {
    const actionId = new URLSearchParams(window.location.search).get("managerAction");
    if (actionId) void openAction(actionId, false);
  }, [openAction]);

  function closeAction() {
    if (mutating) return;
    setSelected(null);
    setStartNote("");
    setConfirmation("");
    window.history.replaceState(null, "", "/levytate/app?module=Home");
  }

  async function transition(action: ManagerOperationalActionListItem, command: "acknowledge" | "start", note = "") {
    setError(""); setConfirmation("");
    const original = { actionId: action.actionId, version: action.version, command };
    try {
      await mutation.execute(`/api/levytate-manager/actions/${encodeURIComponent(action.actionId)}/${command}`,
        { expectedVersion: action.version, ...(command === "start" && note.trim() ? { note: note.trim() } : {}) },
        value => decodeManagerMutation(value, scope, original),
        next => {
          confirmedVersions.current.set(action.actionId, next.version); setReadbackRequired(true);
          setSelected(current => current?.actionId === action.actionId ? next : current);
          setStartNote(""); setConfirmation(command === "acknowledge" ? "Action acknowledged." : "Action marked as in progress.");
          void load(filter);
        });
    } catch { /* Keep the original command and note until its receipt is confirmed. */ }
  }

  function runPrimary(action: ManagerOperationalActionListItem) {
    if (action.status === "open") return void transition(action, "acknowledge");
    if (action.status === "acknowledged") return void transition(action, "start");
    if (action.status === "in_progress") return window.location.assign(action.sourceUrl);
    return void openAction(action.actionId);
  }

  return (
    <>
    <fieldset disabled={mutating} className="min-w-0">
    <MvpPanel title={kind === "all" ? "My actions" : "Other manager actions"} eyebrow="Direct-report work" actions={loading ? <LoaderCircle size={18} className="animate-spin text-lt-accent" aria-label="Loading actions" /> : null}>
      <div className="grid gap-4">
        <div className="flex justify-end">
          <button type="button" onClick={() => !mutating && window.location.assign(kind === "all" ? "/levytate/app?module=Home" : "/levytate/app?module=Home&actions=all")} className="text-xs font-semibold text-lt-accent hover:text-lt-ink">
            {kind === "all" ? "Back to Home" : "View all actions"}
          </button>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {filters.filter((item) => item.summaryKey).map((item) => {
            const active = filter === item.value;
            return (
              <button key={item.value} type="button" onClick={() => setFilter(item.value)} className={`rounded-xl px-4 py-3 text-left ring-1 transition ${active ? "bg-[#102c3d] text-white ring-[#102c3d]" : "bg-[#f8fbfa] text-lt-ink ring-[#102c3d]/[0.07] hover:bg-white"}`}>
                <p className={`text-xs font-semibold uppercase tracking-[0.13em] ${active ? "text-white/58" : "text-lt-muted"}`}>{item.label}</p>
                <p className="mt-1 text-2xl font-semibold">{response?.summary[item.summaryKey!] ?? 0}</p>
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap gap-2" aria-label="Action status filters">
          {filters.map((item) => <button key={item.value} type="button" onClick={() => setFilter(item.value)} className={`rounded-full px-3.5 py-2 text-xs font-semibold transition ${filter === item.value ? "bg-[#eaf5f1] text-lt-accent ring-1 ring-[#159b8f]/15" : "bg-[#f5f8f6] text-lt-muted hover:text-lt-ink"}`}>{item.label}</button>)}
        </div>

        {error ? <p role="alert" className="rounded-xl bg-[#fff0f2] px-4 py-3 text-sm font-semibold text-lt-risk">{error}</p> : null}
        {confirmation ? <p role="status" className="rounded-xl bg-[#e9f7f2] px-4 py-3 text-sm font-semibold text-lt-accent">{confirmation}</p> : null}
        {!loading && !response?.actions.length ? <p className="rounded-xl bg-[#f8fbfa] px-4 py-5 text-sm leading-6 text-lt-muted">No direct-report actions match this filter.</p> : null}

        <div className="grid gap-3">
          {response?.actions.map((action) => (
            <article key={action.actionId} className="rounded-xl border border-[#102c3d]/[0.07] bg-[#fbfcfb] p-4 transition hover:border-[#159b8f]/18 hover:bg-white">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <button type="button" onClick={() => void openAction(action.actionId)} className="min-w-0 flex-1 text-left focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#159b8f]/15">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge tone={statusTone(action)}>{action.statusLabel}</StatusBadge>
                    <StatusBadge tone={priorityTone(action.priority)}>{action.priority}</StatusBadge>
                    {action.overdue ? <StatusBadge tone="red">{action.timingLabel}</StatusBadge> : null}
                  </div>
                  <h3 className="mt-3 text-base font-semibold text-lt-ink">{action.title}</h3>
                  <p className="mt-1 text-sm font-semibold text-lt-muted">{action.employeeName} · {action.programmeName}</p>
                  <p className="mt-2 text-sm leading-6 text-lt-muted">{action.reason}</p>
                  <p className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-lt-muted"><Clock3 size={13} aria-hidden="true" />{action.dueDate ? action.timingLabel : "No due date"}</p>
                </button>
                <button type="button" disabled={mutating} onClick={() => runPrimary(action)} className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-full bg-[#102c3d] px-4 text-xs font-semibold text-white transition hover:-translate-y-0.5 disabled:cursor-wait disabled:opacity-55">
                  {action.primaryAction}<ArrowRight size={14} aria-hidden="true" />
                </button>
              </div>
            </article>
          ))}
        </div>
      </div>

      {selected ? (
        <MvpModal title={selected.title} eyebrow="Manager action" onClose={closeAction}>
          <div className="grid gap-5">
            <div className="flex flex-wrap gap-2"><StatusBadge tone={statusTone(selected)}>{selected.statusLabel}</StatusBadge><StatusBadge tone={priorityTone(selected.priority)}>{selected.priority}</StatusBadge>{selected.overdue ? <StatusBadge tone="red">{selected.timingLabel}</StatusBadge> : null}</div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Fact label="Employee" value={selected.employee.name} />
              <Fact label="Current role" value={selected.employee.jobTitle || "Not recorded"} />
              <Fact label="Programme" value={selected.programme.name} />
              <Fact label="Department" value={selected.employee.department || "Not recorded"} />
              <Fact label="Due" value={selected.dueDate || "No due date"} />
              <Fact label="Owner" value={selected.ownerLabel} />
              <Fact label="Detected" value={formatDateTime(selected.detectedAt)} />
              {selected.kind === "application_review" ? <Fact label="Submitted" value={formatDateTime(selected.submittedDate)} /> : null}
              {selected.kind === "application_review" ? <Fact label="Submitted version" value={`Version ${selected.submittedVersion ?? 1}`} /> : null}
            </div>
            <section className="rounded-xl bg-[#f8fbfa] p-4"><h3 className="text-sm font-semibold text-lt-ink">Why this needs attention</h3><p className="mt-2 text-sm leading-6 text-lt-muted">{selected.reason}</p></section>
            <section className="rounded-xl bg-[#edf7f3] p-4"><h3 className="text-sm font-semibold text-lt-accent">Next manager step</h3><p className="mt-2 text-sm leading-6 text-lt-muted">{selected.nextStep}</p></section>
            {selected.status === "acknowledged" ? <FormTextArea label="Optional start-work note" value={startNote} onChange={setStartNote} rows={2} placeholder="Add a concise coordination note (optional)" /> : null}
            <div className="flex flex-wrap gap-2">
              {selected.status === "open" ? <button type="button" disabled={mutating} onClick={() => void transition(selected, "acknowledge")} className="h-10 rounded-full bg-[#102c3d] px-5 text-xs font-semibold text-white disabled:opacity-55">Acknowledge</button> : null}
              {selected.status === "acknowledged" ? <button type="button" disabled={mutating} onClick={() => void transition(selected, "start", startNote)} className="h-10 rounded-full bg-[#102c3d] px-5 text-xs font-semibold text-white disabled:opacity-55">Start work</button> : null}
              <a aria-disabled={mutating} onClick={event => { if (mutating) event.preventDefault(); }} href={selected.sourceUrl} className={`inline-flex h-10 items-center rounded-full px-5 text-xs font-semibold ${selected.status === "in_progress" ? "bg-[#102c3d] text-white" : "bg-[#eaf5f1] text-lt-accent"}`}>Open source workflow</a>
            </div>
            <section><h3 className="text-sm font-semibold text-lt-ink">History</h3><div className="mt-3 grid gap-2">{selected.history.map((event, index) => <div key={`${event.eventDate}-${event.eventType}-${index}`} className="rounded-xl border border-[#102c3d]/[0.07] px-4 py-3"><p className="text-xs font-semibold text-lt-ink">{event.summary}</p><p className="mt-1 text-xs text-lt-muted">{event.actorName} · {formatDateTime(event.eventDate)}</p></div>)}</div></section>
          </div>
        </MvpModal>
      ) : null}
    </MvpPanel>
    </fieldset>
    <ClientMutationRecovery mutation={mutation} />
    <OperationsReadbackRecovery required={readbackRequired} loading={loading} retry={() => void load(filter)} />
    </>
  );
}

function Fact({ label, value }: { label: string; value: string }) { return <div className="rounded-xl bg-[#f8fbfa] px-4 py-3"><p className="text-xs font-semibold uppercase tracking-[0.13em] text-lt-muted">{label}</p><p className="mt-1 text-sm font-semibold text-lt-secondary">{value}</p></div>; }
function statusTone(action: Pick<ManagerOperationalActionListItem, "status">): "neutral" | "green" | "yellow" | "blue" { return action.status === "open" ? "yellow" : action.status === "acknowledged" ? "blue" : action.status === "in_progress" ? "green" : "neutral"; }
function priorityTone(priority: ManagerOperationalActionListItem["priority"]): "neutral" | "red" | "yellow" { return priority === "Critical" || priority === "High" ? "red" : priority === "Medium" ? "yellow" : "neutral"; }
function formatDateTime(value: string) { return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)); }
