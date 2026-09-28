"use client";

import { ArrowRight, Bot, CheckCircle2, ChevronDown, ExternalLink, RefreshCw, Sparkles, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { AutopilotLane, AutopilotPersistedSignal } from "@/lib/levytate/autopilot/operations-autopilot";
import type { OperationalOwnerType } from "@/lib/levytate/mvp/operations-centre";

type Workspace = {
  generatedAt: string;
  analyserVersion: string;
  brief: { actionNow: number; thisWeek: number; upcoming: number; waitingExternally: number; preparedNextActions: number; total: number };
  lanes: Record<AutopilotLane, AutopilotPersistedSignal[]>;
};
type ApiResponse = { ok?: boolean; message?: string; workspace?: Workspace; operationalActionId?: string };

const laneOrder: AutopilotLane[] = ["needs_your_decision", "ready_to_action", "waiting_externally", "upcoming", "recently_resolved"];
const laneCopy: Record<AutopilotLane, { title: string; description: string }> = {
  needs_your_decision: { title: "Needs your decision", description: "Evidence that requires an accountable employer decision." },
  ready_to_action: { title: "Ready to action", description: "Clear next steps that can be progressed now." },
  waiting_externally: { title: "Waiting externally", description: "Dependencies currently owned by a provider or external party." },
  upcoming: { title: "Upcoming", description: "Known activity approaching within the next 14 days." },
  recently_resolved: { title: "Recently resolved", description: "Conditions that cleared during the last 14 days." },
};
const ownerOptions: OperationalOwnerType[] = ["Apprenticeship Lead", "Line Manager", "Provider", "Employee", "HR", "Shared"];

export function AutopilotOperationsPanel({ onOpenAction }: { onOpenAction: (actionId: string) => void }) {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [selected, setSelected] = useState<AutopilotPersistedSignal | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/levytate-autopilot", { cache: "no-store" });
      const payload = await response.json() as ApiResponse;
      if (!response.ok || !payload.workspace) throw new Error(payload.message ?? "Operations Autopilot is unavailable.");
      setWorkspace(payload.workspace);
    } catch (loadError) { setError(loadError instanceof Error ? loadError.message : "Operations Autopilot is unavailable."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function refresh() {
    setRefreshing(true); setError("");
    try {
      const payload = await mutate({ action: "refresh" });
      if (payload.workspace) setWorkspace(payload.workspace);
    } catch (refreshError) { setError(refreshError instanceof Error ? refreshError.message : "The intelligence refresh could not be completed."); }
    finally { setRefreshing(false); }
  }

  const visibleTotal = workspace ? laneOrder.reduce((total, lane) => total + workspace.lanes[lane].length, 0) : 0;

  if (loading && !workspace) return <AutopilotSkeleton />;
  return (
    <div className="grid min-w-0 gap-5" data-testid="operations-autopilot">
      <section className="overflow-hidden rounded-2xl border border-[#102c3d]/[0.08] bg-[#102c3d] text-white shadow-[0_18px_42px_rgba(16,44,61,0.12)]">
        <div className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div className="max-w-2xl">
            <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#76d2c2]"><Sparkles size={13} />Autopilot</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-[-0.025em]">Your apprenticeship operation, continuously monitored.</h2>
            <p className="mt-2 text-sm leading-6 text-white/65"><strong className="font-semibold text-white">Operations brief:</strong> {workspace ? `${workspace.brief.total} item${workspace.brief.total === 1 ? "" : "s"} need attention. Autopilot has prepared ${workspace.brief.preparedNextActions} next action${workspace.brief.preparedNextActions === 1 ? "" : "s"} for review.` : "LevyTate checks persisted operational evidence. You decide whether a suggestion becomes an action."}</p>
          </div>
          <button type="button" onClick={refresh} disabled={refreshing} className="inline-flex h-10 w-fit items-center justify-center gap-2 rounded-full bg-[#23aa97] px-4 text-xs font-semibold text-white transition hover:bg-[#199684] disabled:cursor-wait disabled:opacity-65">
            <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />{refreshing ? "Refreshing…" : "Refresh intelligence"}
          </button>
        </div>
        {workspace ? <div className="grid border-t border-white/10 sm:grid-cols-2 lg:grid-cols-4">{[
          ["Action now", workspace.brief.actionNow], ["This week", workspace.brief.thisWeek], ["Upcoming", workspace.brief.upcoming], ["Waiting externally", workspace.brief.waitingExternally],
        ].map(([label, value]) => <div key={label} className="border-b border-white/10 px-5 py-4 last:border-b-0 sm:border-r lg:border-b-0"><strong className="block text-2xl font-semibold">{value}</strong><span className="mt-1 block text-[11px] font-semibold uppercase tracking-[0.11em] text-white/48">{label}</span></div>)}</div> : null}
      </section>

      {error ? <div role="alert" className="rounded-xl border border-[#b13b51]/15 bg-[#fff0f2] px-4 py-3 text-sm font-semibold text-[#b13b51]">{error}</div> : null}

      {workspace && visibleTotal === 0 ? (
        <section className="rounded-2xl border border-[#159b8f]/15 bg-[#f4fbf8] px-6 py-12 text-center">
          <CheckCircle2 className="mx-auto text-[#159b8f]" size={30} />
          <h3 className="mt-3 text-lg font-semibold text-[#102c3d]">Nothing needs attention right now</h3>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-[#102c3d]/55">Autopilot is monitoring applications, learners, reviews and operational actions.</p>
        </section>
      ) : null}

      {workspace ? <div className="grid gap-4">{laneOrder.map((lane) => (
        <AutopilotLaneSection key={lane} lane={lane} signals={workspace.lanes[lane]} onReview={setSelected} onOpenAction={onOpenAction} />
      ))}</div> : null}

      {workspace?.generatedAt ? <p className="text-right text-[11px] font-medium text-[#102c3d]/40">Last evaluated {formatDateTime(workspace.generatedAt)} · deterministic rules with constrained interpretation</p> : null}
      {selected ? <ActionReviewDrawer signal={selected} onClose={() => setSelected(null)} onChanged={(next, actionId) => { setWorkspace(next); setSelected(null); if (actionId) onOpenAction(actionId); }} /> : null}
    </div>
  );
}

function AutopilotLaneSection({ lane, signals, onReview, onOpenAction }: { lane: AutopilotLane; signals: AutopilotPersistedSignal[]; onReview: (signal: AutopilotPersistedSignal) => void; onOpenAction: (id: string) => void }) {
  const [expanded, setExpanded] = useState(lane !== "recently_resolved");
  const copy = laneCopy[lane];
  return (
    <section className="overflow-hidden rounded-2xl border border-[#102c3d]/[0.075] bg-white shadow-[0_12px_32px_rgba(16,44,61,0.03)]">
      <button type="button" onClick={() => setExpanded((value) => !value)} className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left hover:bg-[#f8fbfa]" aria-expanded={expanded}>
        <div><div className="flex items-center gap-2"><h3 className="text-sm font-semibold uppercase tracking-[0.08em] text-[#102c3d]">{copy.title}</h3><span className="rounded-full bg-[#edf7f3] px-2.5 py-1 text-[10px] font-semibold text-[#0b6f63]">{signals.length}</span></div><p className="mt-1 text-xs leading-5 text-[#102c3d]/48">{copy.description}</p></div>
        <ChevronDown size={17} className={`shrink-0 text-[#102c3d]/40 transition ${expanded ? "rotate-180" : ""}`} />
      </button>
      {expanded ? <div className="border-t border-[#102c3d]/[0.06]">{signals.length ? signals.map((signal) => <SignalRow key={signal.id} signal={signal} onReview={onReview} onOpenAction={onOpenAction} />) : <p className="px-5 py-6 text-sm text-[#102c3d]/48">No current items in this lane.</p>}</div> : null}
    </section>
  );
}

function SignalRow({ signal, onReview, onOpenAction }: { signal: AutopilotPersistedSignal; onReview: (signal: AutopilotPersistedSignal) => void; onOpenAction: (id: string) => void }) {
  const resolved = signal.status === "resolved";
  return (
    <article className="grid gap-4 border-b border-[#102c3d]/[0.055] px-5 py-4 last:border-b-0 lg:grid-cols-[minmax(0,1fr)_minmax(180px,0.35fr)_auto] lg:items-center">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2"><PriorityBadge priority={signal.priority} /><span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#102c3d]/38">{signal.category.replace(/_/g, " ")}</span>{signal.interpretation.source === "ai" ? <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#0b6f63]"><Bot size={11} />AI phrasing</span> : null}</div>
        <h4 className="mt-2 text-base font-semibold text-[#102c3d]">{signal.interpretation.headline}</h4>
        <p className="mt-1 text-xs font-semibold text-[#102c3d]/48">{signal.subjectLabel}</p>
        <p className="mt-1 text-sm leading-6 text-[#102c3d]/62">{signal.interpretation.whyItMatters}</p>
        <p className="mt-2 text-sm leading-6 text-[#102c3d]/62"><strong className="font-semibold text-[#102c3d]/75">Suggested next step:</strong> {signal.interpretation.suggestedNextStep}</p>
        <p className="mt-2 text-xs font-medium text-[#102c3d]/48"><strong className="text-[#102c3d]/68">Based on:</strong> {signal.interpretation.evidenceSummary.join(" · ")}</p>
      </div>
      <div className="grid gap-1 text-xs text-[#102c3d]/50"><span><strong className="font-semibold text-[#102c3d]/68">Owner:</strong> {signal.suggestedOwnerType}</span><span><strong className="font-semibold text-[#102c3d]/68">Due:</strong> {signal.suggestedDueDate ? formatDate(signal.suggestedDueDate) : "Review required"}</span><span>{resolved ? `Resolved ${formatDate(signal.resolvedAt ?? signal.lastEvaluatedAt)}` : `Observed ${formatDate(signal.lastEvaluatedAt)}`}</span></div>
      <div className="flex flex-wrap gap-2 lg:justify-end">{signal.linkedOperationalActionId ? <button type="button" onClick={() => onOpenAction(signal.linkedOperationalActionId!)} className="inline-flex h-9 items-center gap-2 rounded-full bg-[#102c3d] px-4 text-xs font-semibold text-white">Open action<ArrowRight size={13} /></button> : !resolved ? <button type="button" onClick={() => onReview(signal)} className="inline-flex h-9 items-center gap-2 rounded-full bg-[#102c3d] px-4 text-xs font-semibold text-white">Review action<ArrowRight size={13} /></button> : null}<a href={signal.evidence[0]?.url ?? "/levytate/app?module=Operations"} className="inline-flex h-9 items-center gap-1.5 rounded-full border border-[#102c3d]/10 px-3 text-xs font-semibold text-[#102c3d]/60">Evidence<ExternalLink size={12} /></a></div>
    </article>
  );
}

function ActionReviewDrawer({ signal, onClose, onChanged }: { signal: AutopilotPersistedSignal; onClose: () => void; onChanged: (workspace: Workspace, actionId?: string) => void }) {
  const [title, setTitle] = useState(signal.interpretation.headline);
  const [ownerType, setOwnerType] = useState<OperationalOwnerType>(signal.suggestedOwnerType);
  const [dueDate, setDueDate] = useState(signal.suggestedDueDate);
  const [communicationDraft, setCommunicationDraft] = useState(signal.interpretation.draftCommunication);
  const [dismissalReason, setDismissalReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(action: "create_action" | "dismiss") {
    setSaving(true); setError("");
    try {
      const payload = await mutate(action === "dismiss" ? { action, signalId: signal.id, reason: dismissalReason } : { action, signalId: signal.id, title, ownerType, dueDate, communicationDraft });
      if (!payload.workspace) throw new Error("The updated Autopilot workspace was not returned.");
      onChanged(payload.workspace, payload.operationalActionId);
    } catch (submitError) { setError(submitError instanceof Error ? submitError.message : "The signal could not be updated."); }
    finally { setSaving(false); }
  }

  return <div className="fixed inset-0 z-[80] bg-[#081d29]/30 backdrop-blur-[2px]" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <aside role="dialog" aria-modal="true" aria-label="Review suggested operational action" className="absolute inset-y-0 right-0 flex w-full max-w-xl flex-col bg-white shadow-[-22px_0_56px_rgba(8,29,41,0.16)]">
      <div className="flex items-start justify-between gap-4 border-b border-[#102c3d]/[0.07] px-5 py-5 sm:px-6"><div><p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#0b6f63]">Human approval required</p><h3 className="mt-1 text-xl font-semibold text-[#102c3d]">Review action</h3></div><button type="button" onClick={onClose} className="rounded-full p-2 text-[#102c3d]/50 hover:bg-[#f3f7f5]" aria-label="Close"><X size={18} /></button></div>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
        <div className="mb-3 flex flex-wrap items-center gap-2"><PriorityBadge priority={signal.priority} /><span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#102c3d]/42">{signal.category.replace(/_/g, " ")}</span></div>
        <div className="rounded-xl bg-[#f4f8f6] p-4"><h4 className="text-sm font-semibold text-[#102c3d]">{signal.interpretation.headline}</h4><p className="mt-2 text-sm leading-6 text-[#102c3d]/60">{signal.interpretation.whyItMatters}</p><p className="mt-3 text-sm leading-6 text-[#102c3d]/60"><strong className="font-semibold text-[#102c3d]/75">Suggested next step:</strong> {signal.interpretation.suggestedNextStep}</p></div>
        <section className="mt-5"><h4 className="text-[10px] font-semibold uppercase tracking-[0.11em] text-[#102c3d]/45">Evidence</h4><div className="mt-2 grid gap-2">{signal.evidence.map((item) => <a key={`${item.sourceType}:${item.sourceId}`} href={item.url} className="flex items-center justify-between gap-3 rounded-xl border border-[#102c3d]/[0.08] px-3 py-3 text-sm text-[#102c3d]/65 hover:bg-[#f8fbfa]"><span><strong className="font-semibold text-[#102c3d]">{item.label}</strong><span className="ml-2 text-xs">{item.value}</span></span><ExternalLink size={13} className="shrink-0" /></a>)}</div></section>
        <div className="mt-5 grid gap-4"><Field label="Action title"><input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={160} className={inputClass} /></Field><div className="grid gap-4 sm:grid-cols-2"><Field label="Owner"><select value={ownerType} onChange={(event) => setOwnerType(event.target.value as OperationalOwnerType)} className={inputClass}>{ownerOptions.map((option) => <option key={option}>{option}</option>)}</select></Field><Field label="Due date"><input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} className={inputClass} /></Field></div><Field label="Communication draft (not sent)"><textarea value={communicationDraft} onChange={(event) => setCommunicationDraft(event.target.value)} rows={5} maxLength={1000} placeholder="Optional draft for a human to review and use later." className={`${inputClass} h-auto py-3`} /></Field><Field label="Dismissal reason"><input value={dismissalReason} onChange={(event) => setDismissalReason(event.target.value)} maxLength={240} placeholder="Required only when dismissing" className={inputClass} /></Field></div>
        {error ? <p className="mt-4 rounded-lg bg-[#fff0f2] px-3 py-2 text-sm font-semibold text-[#b13b51]" role="alert">{error}</p> : null}
      </div>
      <div className="flex flex-wrap justify-end gap-2 border-t border-[#102c3d]/[0.07] px-5 py-4 sm:px-6"><button type="button" onClick={onClose} className="h-10 rounded-full px-4 text-xs font-semibold text-[#102c3d]/55">Cancel</button><button type="button" onClick={() => void submit("dismiss")} disabled={saving || !dismissalReason.trim()} className="h-10 rounded-full border border-[#102c3d]/10 px-4 text-xs font-semibold text-[#102c3d]/62 disabled:opacity-40">Dismiss</button><button type="button" onClick={() => void submit("create_action")} disabled={saving || !title.trim()} className="h-10 rounded-full bg-[#0b6f63] px-5 text-xs font-semibold text-white disabled:opacity-50">{saving ? "Saving…" : "Create action"}</button></div>
    </aside>
  </div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="grid gap-1.5"><span className="text-[10px] font-semibold uppercase tracking-[0.11em] text-[#102c3d]/45">{label}</span>{children}</label>; }
function PriorityBadge({ priority }: { priority: AutopilotPersistedSignal["priority"] }) { const label = priority === "action_now" ? "Action now" : priority === "this_week" ? "This week" : "Upcoming"; const style = priority === "action_now" ? "bg-[#fff0f2] text-[#b13b51]" : priority === "this_week" ? "bg-[#fff8df] text-[#8d6810]" : "bg-[#edf5f8] text-[#3f6f88]"; return <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${style}`}>{label}</span>; }
function AutopilotSkeleton() { return <div className="grid animate-pulse gap-4" aria-label="Loading Operations Autopilot"><div className="h-48 rounded-2xl bg-[#102c3d]/10" />{[1,2,3].map((item) => <div key={item} className="h-24 rounded-2xl bg-[#102c3d]/[0.05]" />)}</div>; }
async function mutate(body: Record<string, unknown>) { const response = await fetch("/api/levytate-autopilot", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); const payload = await response.json() as ApiResponse; if (!response.ok) throw new Error(payload.message ?? "The Autopilot action could not be completed."); return payload; }
const inputClass = "h-11 w-full rounded-xl border border-[#102c3d]/10 bg-white px-3 text-sm text-[#102c3d] outline-none focus:border-[#159b8f] focus:ring-4 focus:ring-[#159b8f]/10";
function formatDate(value: string) { return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(new Date(`${value.slice(0,10)}T12:00:00Z`)); }
function formatDateTime(value: string) { return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(value)); }
