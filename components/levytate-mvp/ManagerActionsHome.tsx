"use client";

import { ArrowRight, Clock3, LoaderCircle } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { FormTextArea, MvpModal, MvpPanel, StatusBadge } from "@/components/levytate-mvp/MvpUi";
import type {
  ManagerOperationalActionDetail,
  ManagerOperationalActionFilter,
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

export function ManagerActionsHome() {
  const [filter, setFilter] = useState<ManagerOperationalActionFilter>("all");
  const [response, setResponse] = useState<ManagerOperationalActionsResponse | null>(null);
  const [selected, setSelected] = useState<ManagerOperationalActionDetail | null>(null);
  const [startNote, setStartNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [mutating, setMutating] = useState(false);
  const [error, setError] = useState("");
  const [confirmation, setConfirmation] = useState("");

  const load = useCallback(async (nextFilter: ManagerOperationalActionFilter) => {
    setLoading(true);
    setError("");
    try {
      const request = await fetch(`/api/levytate-manager/actions?status=${encodeURIComponent(nextFilter)}`, { cache: "no-store" });
      const body = await request.json() as ManagerOperationalActionsResponse & { message?: string };
      if (!request.ok) throw new Error(body.message || "Your actions could not be loaded.");
      setResponse(body);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Your actions could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  const openAction = useCallback(async (actionId: string, updateUrl = true) => {
    setError("");
    setConfirmation("");
    try {
      const request = await fetch(`/api/levytate-manager/actions/${encodeURIComponent(actionId)}`, { cache: "no-store" });
      const body = await request.json() as { action?: ManagerOperationalActionDetail; message?: string };
      if (!request.ok || !body.action) throw new Error(body.message || "That action could not be opened.");
      setSelected(body.action);
      setStartNote("");
      if (updateUrl) window.history.replaceState(null, "", `/levytate/app?module=Home&managerAction=${encodeURIComponent(actionId)}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "That action could not be opened.");
    }
  }, []);

  useEffect(() => { void load(filter); }, [filter, load]);

  useEffect(() => {
    const actionId = new URLSearchParams(window.location.search).get("managerAction");
    if (actionId) void openAction(actionId, false);
  }, [openAction]);

  function closeAction() {
    setSelected(null);
    setStartNote("");
    setConfirmation("");
    window.history.replaceState(null, "", "/levytate/app?module=Home");
  }

  async function transition(action: ManagerOperationalActionListItem, command: "acknowledge" | "start", note = "") {
    setMutating(true);
    setError("");
    setConfirmation("");
    try {
      const request = await fetch(`/api/levytate-manager/actions/${encodeURIComponent(action.actionId)}/${command}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expectedVersion: action.version, ...(command === "start" && note.trim() ? { note: note.trim() } : {}) }),
      });
      const body = await request.json() as { action?: ManagerOperationalActionDetail; message?: string };
      if (!request.ok || !body.action) throw new Error(body.message || "The action could not be updated.");
      if (selected?.actionId === action.actionId) setSelected(body.action);
      setStartNote("");
      setConfirmation(command === "acknowledge" ? "Action acknowledged." : "Action marked as in progress.");
      await load(filter);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The action could not be updated.");
    } finally {
      setMutating(false);
    }
  }

  function runPrimary(action: ManagerOperationalActionListItem) {
    if (action.status === "open") return void transition(action, "acknowledge");
    if (action.status === "acknowledged") return void transition(action, "start");
    if (action.status === "in_progress") return window.location.assign(action.sourceUrl);
    return void openAction(action.actionId);
  }

  return (
    <MvpPanel title="My actions" eyebrow="Direct-report work" actions={loading ? <LoaderCircle size={18} className="animate-spin text-[#0b6f63]" aria-label="Loading actions" /> : null}>
      <div className="grid gap-4">
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {filters.filter((item) => item.summaryKey).map((item) => {
            const active = filter === item.value;
            return (
              <button key={item.value} type="button" onClick={() => setFilter(item.value)} className={`rounded-xl px-4 py-3 text-left ring-1 transition ${active ? "bg-[#102c3d] text-white ring-[#102c3d]" : "bg-[#f8fbfa] text-[#102c3d] ring-[#102c3d]/[0.07] hover:bg-white"}`}>
                <p className={`text-[10px] font-semibold uppercase tracking-[0.13em] ${active ? "text-white/58" : "text-[#102c3d]/40"}`}>{item.label}</p>
                <p className="mt-1 text-2xl font-semibold">{response?.summary[item.summaryKey!] ?? 0}</p>
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap gap-2" aria-label="Action status filters">
          {filters.map((item) => <button key={item.value} type="button" onClick={() => setFilter(item.value)} className={`rounded-full px-3.5 py-2 text-xs font-semibold transition ${filter === item.value ? "bg-[#eaf5f1] text-[#0b6f63] ring-1 ring-[#159b8f]/15" : "bg-[#f5f8f6] text-[#102c3d]/58 hover:text-[#102c3d]"}`}>{item.label}</button>)}
        </div>

        {error ? <p role="alert" className="rounded-xl bg-[#fff0f2] px-4 py-3 text-sm font-semibold text-[#b13b51]">{error}</p> : null}
        {confirmation ? <p role="status" className="rounded-xl bg-[#e9f7f2] px-4 py-3 text-sm font-semibold text-[#0b6f63]">{confirmation}</p> : null}
        {!loading && !response?.actions.length ? <p className="rounded-xl bg-[#f8fbfa] px-4 py-5 text-sm leading-6 text-[#102c3d]/56">No direct-report actions match this filter.</p> : null}

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
                  <h3 className="mt-3 text-base font-semibold text-[#102c3d]">{action.title}</h3>
                  <p className="mt-1 text-sm font-semibold text-[#102c3d]/64">{action.employeeName} · {action.programmeName}</p>
                  <p className="mt-2 text-sm leading-6 text-[#102c3d]/56">{action.reason}</p>
                  <p className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-[#102c3d]/46"><Clock3 size={13} aria-hidden="true" />{action.dueDate ? action.timingLabel : "No due date"}</p>
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
              <Fact label="Programme" value={selected.programme.name} />
              <Fact label="Department" value={selected.employee.department || "Not recorded"} />
              <Fact label="Due" value={selected.dueDate || "No due date"} />
              <Fact label="Owner" value={selected.ownerLabel} />
              <Fact label="Detected" value={formatDateTime(selected.detectedAt)} />
            </div>
            <section className="rounded-xl bg-[#f8fbfa] p-4"><h3 className="text-sm font-semibold text-[#102c3d]">Why this needs attention</h3><p className="mt-2 text-sm leading-6 text-[#102c3d]/60">{selected.reason}</p></section>
            <section className="rounded-xl bg-[#edf7f3] p-4"><h3 className="text-sm font-semibold text-[#0b6f63]">Next manager step</h3><p className="mt-2 text-sm leading-6 text-[#102c3d]/64">{selected.nextStep}</p></section>
            {selected.status === "acknowledged" ? <FormTextArea label="Optional start-work note" value={startNote} onChange={setStartNote} rows={2} placeholder="Add a concise coordination note (optional)" /> : null}
            <div className="flex flex-wrap gap-2">
              {selected.status === "open" ? <button type="button" disabled={mutating} onClick={() => void transition(selected, "acknowledge")} className="h-10 rounded-full bg-[#102c3d] px-5 text-xs font-semibold text-white disabled:opacity-55">Acknowledge</button> : null}
              {selected.status === "acknowledged" ? <button type="button" disabled={mutating} onClick={() => void transition(selected, "start", startNote)} className="h-10 rounded-full bg-[#102c3d] px-5 text-xs font-semibold text-white disabled:opacity-55">Start work</button> : null}
              <a href={selected.sourceUrl} className={`inline-flex h-10 items-center rounded-full px-5 text-xs font-semibold ${selected.status === "in_progress" ? "bg-[#102c3d] text-white" : "bg-[#eaf5f1] text-[#0b6f63]"}`}>Open source workflow</a>
            </div>
            <section><h3 className="text-sm font-semibold text-[#102c3d]">History</h3><div className="mt-3 grid gap-2">{selected.history.map((event, index) => <div key={`${event.eventDate}-${event.eventType}-${index}`} className="rounded-xl border border-[#102c3d]/[0.07] px-4 py-3"><p className="text-xs font-semibold text-[#102c3d]">{event.summary}</p><p className="mt-1 text-[11px] text-[#102c3d]/46">{event.actorName} · {formatDateTime(event.eventDate)}</p></div>)}</div></section>
          </div>
        </MvpModal>
      ) : null}
    </MvpPanel>
  );
}

function Fact({ label, value }: { label: string; value: string }) { return <div className="rounded-xl bg-[#f8fbfa] px-4 py-3"><p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-[#102c3d]/38">{label}</p><p className="mt-1 text-sm font-semibold text-[#102c3d]/72">{value}</p></div>; }
function statusTone(action: Pick<ManagerOperationalActionListItem, "status">): "neutral" | "green" | "yellow" | "blue" { return action.status === "open" ? "yellow" : action.status === "acknowledged" ? "blue" : action.status === "in_progress" ? "green" : "neutral"; }
function priorityTone(priority: ManagerOperationalActionListItem["priority"]): "neutral" | "red" | "yellow" { return priority === "Critical" || priority === "High" ? "red" : priority === "Medium" ? "yellow" : "neutral"; }
function formatDateTime(value: string) { return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)); }
