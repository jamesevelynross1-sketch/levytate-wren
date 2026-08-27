"use client";

import { ArrowRight, CheckCircle2, ChevronDown, RefreshCw, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { EmptyState } from "@/components/levytate-mvp/MvpUi";
import { OperationalMetricRail, SemanticStatus, type OperationalTone } from "@/components/levytate-mvp/OperationalVisuals";
import { OperationalActionDetail } from "@/components/levytate-mvp/OperationalActionDetail";
import { OperationalGovernanceView } from "@/components/levytate-mvp/OperationalGovernanceView";
import { ProgressReviewIntelligencePanel } from "@/components/levytate-mvp/ProgressReviewIntelligencePanel";
import { useMvpWorkspace } from "@/components/levytate-mvp/MvpWorkspaceStore";
import { operationalActionStatusLabels, type OperationalActionStatus } from "@/lib/levytate/mvp/operational-actions";
import type { IntelligenceSignal } from "@/lib/levytate/intelligence/progress-review";
import {
  operationalQueueLabels,
  type OperationalActionType,
  type OperationalDueStatus,
  type OperationalItem,
  type OperationalPriorityLevel,
  type OperationalQueueType,
  type OperationsResponse,
} from "@/lib/levytate/mvp/operations-centre";

type OperationsApiResponse = Partial<OperationsResponse> & { ok?: boolean; error?: string; message?: string };
type LearnerAction = { learnerRecordId: string; actionType: OperationalActionType };

const queueOrder: OperationalQueueType[] = ["urgent", "ready_to_enrol", "assessment", "reviews", "progress", "breaks", "pre_enrolment"];
const dueStatuses: Array<OperationalDueStatus | "All"> = ["All", "Overdue", "Due today", "Due soon", "No due date"];

export function OperationsCentreModule({ onOpenLearner, onSignalContext }: { onOpenLearner: (target: LearnerAction) => void; onSignalContext?: (signal: IntelligenceSignal | null) => void }) {
  const { can, meta } = useMvpWorkspace();
  const authorised = can("learnerLifecycle:read") && ["Apprenticeship Lead", "Employer Admin"].includes(meta?.userRole ?? "");
  const [data, setData] = useState<OperationsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [priority, setPriority] = useState("All");
  const [queue, setQueue] = useState<OperationalQueueType | "All">("All");
  const [owner, setOwner] = useState("All");
  const [dueStatus, setDueStatus] = useState<OperationalDueStatus | "All">("All");
  const [status, setStatus] = useState<OperationalActionStatus | "All">("All");
  const [actionType, setActionType] = useState("All");
  const [learner, setLearner] = useState("All");
  const [programme, setProgramme] = useState("All");
  const [assignment, setAssignment] = useState<"all" | "mine" | "unassigned" | "shared">("all");
  const [moreFilters, setMoreFilters] = useState(false);
  const [selectedActionId, setSelectedActionId] = useState("");
  const [workspaceView, setWorkspaceView] = useState<"active" | "closed">("active");
  const [refreshKey, setRefreshKey] = useState(0);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ urgent: true, ready_to_enrol: true });
  const initialSynchronisationPending = useRef(true);

  useEffect(() => {
    if (!authorised) {
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError("");
      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      if (priority !== "All") params.set("priority", priority);
      if (queue !== "All") params.set("queue", queue);
      if (owner !== "All") params.set("owner", owner);
      if (dueStatus !== "All") params.set("dueStatus", dueStatus);
      if (status !== "All") params.set("status", status);
      if (actionType !== "All") params.set("actionType", actionType);
      if (learner !== "All") params.set("learner", learner);
      if (programme !== "All") params.set("programme", programme);
      if (assignment !== "all") params.set("assignment", assignment);
      if (initialSynchronisationPending.current) {
        params.set("synchronise", "true");
        initialSynchronisationPending.current = false;
      }
      try {
        const response = await fetch(`/api/levytate-operations${params.size ? `?${params}` : ""}`, { cache: "no-store", signal: controller.signal });
        const payload = (await response.json()) as OperationsApiResponse;
        if (!response.ok || !payload.summary || !payload.queues || !payload.filterOptions || !payload.recentActivity) {
          throw new Error(payload.message ?? "Operations data is unavailable.");
        }
        setData(payload as OperationsResponse);
      } catch (loadError) {
        if (!(loadError instanceof DOMException && loadError.name === "AbortError")) {
          setError(loadError instanceof Error ? loadError.message : "Operations data is unavailable.");
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, search ? 250 : 0);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [actionType, assignment, authorised, dueStatus, learner, owner, priority, programme, queue, refreshKey, search, status]);

  const hasFilters = Boolean(search.trim()) || priority !== "All" || queue !== "All" || owner !== "All" || dueStatus !== "All" || status !== "All" || actionType !== "All" || learner !== "All" || programme !== "All" || assignment !== "all";
  const nextUpcoming = useMemo(() => data ? queueOrder.flatMap((key) => data.queues[key]).find((item) => item.dueStatus === "Due soon") : undefined, [data]);

  function retryOperations() {
    initialSynchronisationPending.current = true;
    setRefreshKey((current) => current + 1);
  }

  if (!authorised) {
    return <EmptyState title="Operations Centre is not available for this role" copy="Organisation-wide learner operations are restricted to authorised employer roles." actionLabel="Return home" onAction={() => window.scrollTo({ top: 0, behavior: "smooth" })} />;
  }

  if (selectedActionId) {
    return <OperationalActionDetail actionId={selectedActionId} onBack={() => setSelectedActionId("")} onOpenAction={setSelectedActionId} onOpenLearner={onOpenLearner} onChanged={() => setRefreshKey((current) => current + 1)} />;
  }

  if (workspaceView === "closed") {
    return <div className="grid min-w-0 gap-4"><OperationsModeTabs value={workspaceView} onChange={setWorkspaceView} /><OperationalGovernanceView onOpenAction={setSelectedActionId} /></div>;
  }

  return (
    <div className="grid min-w-0 gap-5" data-testid="operations-centre">
      <OperationsModeTabs value={workspaceView} onChange={setWorkspaceView} />
      <ProgressReviewIntelligencePanel enabled={Boolean(meta?.userEmail?.endsWith(".test"))} onSignalContext={onSignalContext} />
      <section>
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div><p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#c95568]">Daily learner operations</p><h2 className="mt-1 text-xl font-semibold tracking-[-0.02em] text-[#102c3d]">Operational status</h2></div>
          {data?.generatedAt ? <span className="text-xs font-semibold text-[#102c3d]/[0.48]">Updated {formatTime(data.generatedAt)}</span> : null}
        </div>
        {data ? <OperationalMetricRail items={[
          { label: "Needs attention", value: data.summary.needsAttentionNow, tone: "risk", onClick: () => focusQueue("urgent", setQueue, setExpanded) },
          { label: "Ready to enrol", value: data.summary.readyToEnrol, tone: "healthy", onClick: () => focusQueue("ready_to_enrol", setQueue, setExpanded) },
          { label: "Reviews overdue", value: data.summary.reviewsOverdue, tone: "watch", onClick: () => focusQueue("reviews", setQueue, setExpanded) },
          { label: "Behind target", value: data.summary.behindTarget, tone: "risk", onClick: () => focusQueue("progress", setQueue, setExpanded) },
          { label: "Active breaks", value: data.summary.activeBreaks, tone: "info", onClick: () => focusQueue("breaks", setQueue, setExpanded) },
          { label: "Approaching completion", value: data.summary.approachingAssessmentCompletion, tone: "info", onClick: () => { setQueue("All"); document.getElementById("operations-queues")?.scrollIntoView({ behavior: "smooth" }); } },
        ]} /> : null}
      </section>

      {data && (queue === "All" || queue === "urgent") ? <div className="grid gap-2"><h2 className="text-lg font-semibold text-[#102c3d]">Priority actions</h2><QueueSection queue="urgent" items={data.queues.urgent} expanded={Boolean(expanded.urgent)} onToggle={() => setExpanded((current) => ({ ...current, urgent: !current.urgent }))} onOpenLearner={onOpenLearner} onOpenAction={setSelectedActionId} /></div> : null}

      <section className="rounded-2xl border border-[#102c3d]/[0.075] bg-white p-4 shadow-[0_14px_34px_rgba(16,44,61,0.035)]" aria-label="Operations filters">
        <div className="flex flex-wrap gap-2 border-b border-[#102c3d]/[0.06] pb-3" aria-label="Action ownership">
          {([['all', 'All actions'], ['mine', 'My actions'], ['unassigned', 'Unassigned'], ['shared', 'Shared actions']] as const).map(([value, label]) => <button key={value} type="button" onClick={() => setAssignment(value)} className={`rounded-full px-3.5 py-2 text-xs font-semibold transition ${assignment === value ? "bg-[#102c3d] text-white shadow-[0_8px_18px_rgba(16,44,61,0.12)]" : "bg-[#f5f8f6] text-[#102c3d]/[0.58] hover:bg-[#edf7f3] hover:text-[#0b6f63]"}`}>{label}</button>)}
        </div>
        <div className="mt-3 grid gap-2 xl:grid-cols-[minmax(260px,1.4fr)_repeat(2,minmax(140px,0.6fr))_auto]">
          <label className="flex h-11 min-w-0 items-center gap-2 rounded-xl border border-[#102c3d]/[0.09] bg-[#f8fbfa] px-3 focus-within:border-[#159b8f] focus-within:bg-white focus-within:ring-4 focus-within:ring-[#159b8f]/[0.10]">
            <Search size={16} className="shrink-0 text-[#102c3d]/[0.38]" aria-hidden="true" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} className="min-w-0 flex-1 bg-transparent text-sm text-[#102c3d] outline-none placeholder:text-[#102c3d]/[0.34]" placeholder="Search action, learner, programme, provider or owner" aria-label="Search operations" />
          </label>
          <FilterSelect label="Priority" value={priority} options={["All", ...(data?.filterOptions.priorities ?? [])]} onChange={setPriority} />
          <FilterSelect label="Due" value={dueStatus} options={dueStatuses} onChange={(value) => setDueStatus(value as OperationalDueStatus | "All")} />
          <button type="button" onClick={() => setMoreFilters((current) => !current)} className="h-11 rounded-xl border border-[#102c3d]/[0.09] bg-white px-4 text-xs font-semibold text-[#102c3d]/[0.62] transition hover:bg-[#f8fbfa] hover:text-[#102c3d]">{moreFilters ? "Fewer filters" : "More filters"}</button>
        </div>
        {moreFilters ? <div className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-6"><FilterSelect label="Status" value={status} options={["All", "open", "acknowledged", "in_progress"]} optionLabel={(value) => value === "All" ? "All statuses" : operationalActionStatusLabels[value as OperationalActionStatus]} onChange={(value) => setStatus(value as OperationalActionStatus | "All")} /><FilterSelect label="Queue" value={queue} options={["All", ...(data?.filterOptions.queues.map((item) => item.value) ?? [])]} optionLabel={(value) => value === "All" ? "All queues" : operationalQueueLabels[value as OperationalQueueType]} onChange={(value) => setQueue(value as OperationalQueueType | "All")} /><FilterSelect label="Owner" value={owner} options={["All", ...(data?.filterOptions.owners ?? [])]} onChange={setOwner} /><FilterSelect label="Action" value={actionType} options={["All", ...(data?.filterOptions.actionTypes ?? [])]} optionLabel={(value) => value === "All" ? "All action types" : sentenceCase(value)} onChange={setActionType} /><FilterSelect label="Learner" value={learner} options={["All", ...(data?.filterOptions.learners ?? [])]} onChange={setLearner} /><FilterSelect label="Programme" value={programme} options={["All", ...(data?.filterOptions.programmes ?? [])]} onChange={setProgramme} /></div> : null}
        {hasFilters ? <button type="button" onClick={() => { setSearch(""); setPriority("All"); setQueue("All"); setOwner("All"); setDueStatus("All"); setStatus("All"); setActionType("All"); setLearner("All"); setProgramme("All"); setAssignment("all"); }} className="mt-3 text-xs font-semibold text-[#0b6f63] hover:text-[#102c3d]">Clear filters</button> : null}
      </section>

      {error ? <div className="flex flex-col gap-3 rounded-xl border border-[#b13b51]/[0.10] bg-[#fff0f2] px-4 py-3 sm:flex-row sm:items-center sm:justify-between" role="alert"><p className="text-sm font-semibold text-[#b13b51]">{error}</p><button type="button" onClick={retryOperations} disabled={loading} className="inline-flex h-9 w-fit items-center justify-center gap-2 rounded-full bg-white px-4 text-xs font-semibold text-[#b13b51] shadow-[0_6px_16px_rgba(177,59,81,0.08)] ring-1 ring-[#b13b51]/[0.10] transition hover:bg-[#fff8f9] disabled:cursor-wait disabled:opacity-60"><RefreshCw size={14} className={loading ? "animate-spin" : ""} aria-hidden="true" />Retry</button></div> : null}
      {loading && !data ? <div className="rounded-2xl border border-[#102c3d]/[0.07] bg-white px-5 py-12 text-center text-sm font-semibold text-[#102c3d]/[0.52]">Prioritising live learner records.</div> : null}

      {data ? (
        <div id="operations-queues" className="grid gap-4">
          {queueOrder.filter((key) => key !== "urgent" && (queue === "All" || queue === key)).map((key) => (
            <QueueSection key={key} queue={key} items={data.queues[key]} expanded={Boolean(expanded[key])} onToggle={() => setExpanded((current) => ({ ...current, [key]: !current[key] }))} onOpenLearner={onOpenLearner} onOpenAction={setSelectedActionId} />
          ))}

          {!data.totalAttentionItems ? (
            <section className="rounded-2xl border border-[#159b8f]/[0.15] bg-[#f4fbf8] p-6 text-center">
              <CheckCircle2 className="mx-auto text-[#159b8f]" size={28} aria-hidden="true" />
              <h3 className="mt-3 text-lg font-semibold text-[#102c3d]">{assignment === "mine" ? "You do not currently own any active actions." : hasFilters ? "No actions match the selected filters." : "No active operational actions currently require attention."}</h3>
              <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-[#102c3d]/[0.56]">{nextUpcoming ? `${nextUpcoming.learnerName}: ${nextUpcoming.reason}` : data.recentActivity[0] ? `Most recent completion: ${data.recentActivity[0].action}` : "New reviews and lifecycle changes will appear here as they are recorded."}</p>
            </section>
          ) : null}

          <RecentActivity items={data.recentActivity} onOpenLearner={(learnerRecordId) => onOpenLearner({ learnerRecordId, actionType: "open_learner" })} />
        </div>
      ) : null}
    </div>
  );
}

function OperationsModeTabs({ value, onChange }: { value: "active" | "closed"; onChange: (value: "active" | "closed") => void }) {
  return <nav className="flex w-fit gap-1 rounded-xl border border-[#102c3d]/[0.07] bg-[#f3f7f5] p-1" aria-label="Operations Centre views">{([['active', 'Active work'], ['closed', 'Closed actions']] as const).map(([id, label]) => <button key={id} type="button" onClick={() => onChange(id)} aria-current={value === id ? "page" : undefined} className={`rounded-lg px-4 py-2 text-xs font-semibold transition ${value === id ? "bg-white text-[#102c3d] shadow-[0_5px_14px_rgba(16,44,61,0.08)]" : "text-[#102c3d]/[0.52] hover:text-[#0b6f63]"}`}>{label}</button>)}</nav>;
}

function QueueSection({ queue, items, expanded, onToggle, onOpenLearner, onOpenAction }: { queue: OperationalQueueType; items: OperationalItem[]; expanded: boolean; onToggle: () => void; onOpenLearner: (target: LearnerAction) => void; onOpenAction: (actionId: string) => void }) {
  const visible = expanded ? items.slice(0, 12) : [];
  return (
    <section id={`operations-${queue}`} className="overflow-hidden rounded-2xl border border-[#102c3d]/[0.075] bg-white shadow-[0_14px_34px_rgba(16,44,61,0.035)]">
      <button type="button" onClick={onToggle} className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition hover:bg-[#f8fbfa]" aria-expanded={expanded}>
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-[#102c3d]">{operationalQueueLabels[queue]}</h3>
            <span className="rounded-full bg-[#edf7f3] px-2.5 py-1 text-[10px] font-semibold text-[#0b6f63]">{items.length}</span>
          </div>
          <p className="mt-1 text-xs leading-5 text-[#102c3d]/[0.48]">{queueDescription(queue)}</p>
        </div>
        <ChevronDown size={17} className={`shrink-0 text-[#102c3d]/[0.42] transition ${expanded ? "rotate-180" : ""}`} aria-hidden="true" />
      </button>
      {expanded ? (
        <div className="border-t border-[#102c3d]/[0.06]">
          {visible.length ? visible.map((item) => <OperationalRow key={item.id} item={item} onOpenLearner={onOpenLearner} onOpenAction={onOpenAction} />) : <p className="px-5 py-6 text-sm text-[#102c3d]/[0.50]">No current items in this queue.</p>}
          {items.length > visible.length ? <button type="button" onClick={onToggle} className="m-4 text-xs font-semibold text-[#0b6f63]">Show all {items.length}</button> : null}
        </div>
      ) : null}
    </section>
  );
}

function OperationalRow({ item, onOpenLearner, onOpenAction }: { item: OperationalItem; onOpenLearner: (target: LearnerAction) => void; onOpenAction: (actionId: string) => void }) {
  const status = item.persistentActionStatus ?? "open";
  const primaryLabel = status === "open" ? "Acknowledge" : status === "acknowledged" ? "Start work" : status === "in_progress" ? "Update action" : "View history";
  return (
    <article className={`grid gap-3 border-b border-l-2 border-b-[#102c3d]/[0.055] px-5 py-4 last:border-b-0 lg:grid-cols-[minmax(0,1.3fr)_minmax(190px,0.7fr)_auto] lg:items-center ${priorityEdge(item.priorityLevel)}`}>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => onOpenLearner({ learnerRecordId: item.learnerRecordId, actionType: "open_learner" })} className="truncate text-left text-sm font-semibold text-[#102c3d] hover:text-[#0b6f63]">{item.learnerName}</button>
          <SemanticStatus label={item.priorityLevel} tone={priorityTone(item.priorityLevel)} />
          <span className="text-xs font-semibold text-[#102c3d]/[0.52]">{operationalActionStatusLabels[status]}</span>
          <span className="text-xs font-semibold text-[#102c3d]/[0.42]">{item.lifecycleStatus}</span>
        </div>
        <p className="mt-1 truncate text-xs font-semibold text-[#102c3d]/[0.54]">{item.programmeName}</p>
        <p className="mt-1 text-sm leading-5 text-[#102c3d]/[0.68]">{item.reason}</p>
        {item.targetProgress !== undefined ? <p className="mt-1 text-xs text-[#102c3d]/[0.48]">Target {item.targetProgress}% · Actual {item.actualProgress}% · Variance {item.variance}%</p> : null}
      </div>
      <div className="grid gap-1 text-xs text-[#102c3d]/[0.52]">
        <span><strong className="font-semibold text-[#102c3d]/[0.70]">Owner:</strong> {item.persistentOwnerDisplayName || item.ownerType}</span>
        <span className={item.dueStatus === "Overdue" ? "font-semibold text-[#b13b51]" : ""}>{item.timingLabel}</span>
        {item.persistentDetectedAt ? <span>Detected {formatDate(item.persistentDetectedAt)}</span> : null}
        <span className="truncate">{item.providerName}</span>
      </div>
      <div className="flex flex-wrap gap-2 lg:justify-end">
        <button type="button" onClick={() => item.persistentActionId ? onOpenAction(item.persistentActionId) : onOpenLearner({ learnerRecordId: item.learnerRecordId, actionType: item.actionType })} className="inline-flex h-9 items-center justify-center gap-2 rounded-full bg-[#102c3d] px-4 text-xs font-semibold text-white transition hover:-translate-y-0.5 hover:bg-[#17394d]">{primaryLabel}<ArrowRight size={14} /></button>
        <button type="button" onClick={() => onOpenLearner({ learnerRecordId: item.learnerRecordId, actionType: item.actionType })} className="inline-flex h-9 items-center justify-center rounded-full border border-[#102c3d]/[0.09] bg-white px-4 text-xs font-semibold text-[#102c3d]/[0.64] transition hover:bg-[#f8fbfa] hover:text-[#102c3d]">{item.actionLabel}</button>
      </div>
    </article>
  );
}

function RecentActivity({ items, onOpenLearner }: { items: OperationsResponse["recentActivity"]; onOpenLearner: (id: string) => void }) {
  return (
    <section className="rounded-2xl border border-[#102c3d]/[0.075] bg-white p-5 shadow-[0_14px_34px_rgba(16,44,61,0.035)]">
      <h3 className="text-base font-semibold text-[#102c3d]">Recently completed</h3>
      <p className="mt-1 text-xs leading-5 text-[#102c3d]/[0.48]">Meaningful learner operations recorded in the last 30 days.</p>
      <div className="mt-4 grid gap-1">
        {items.length ? items.slice(0, 8).map((item) => (
          <button key={item.id} type="button" onClick={() => onOpenLearner(item.learnerRecordId)} className="grid gap-1 rounded-xl px-3 py-2.5 text-left transition hover:bg-[#f8fbfa] sm:grid-cols-[120px_180px_minmax(0,1fr)] sm:items-center">
            <span className="text-xs font-semibold text-[#102c3d]/[0.44]">{formatDateTime(item.eventDate)}</span>
            <span className="truncate text-sm font-semibold text-[#102c3d]">{item.learnerName}</span>
            <span className="text-sm leading-5 text-[#102c3d]/[0.58]">{item.action} <span className="text-xs text-[#102c3d]/[0.36]">by {item.actorName}</span></span>
          </button>
        )) : <p className="rounded-xl bg-[#f8fbfa] px-4 py-5 text-sm text-[#102c3d]/[0.50]">No recent operational completions are available.</p>}
      </div>
    </section>
  );
}

function FilterSelect({ label, value, options, optionLabel, onChange }: { label: string; value: string; options: readonly string[]; optionLabel?: (value: string) => string; onChange: (value: string) => void }) {
  return <label className="grid h-11 grid-cols-[auto_1fr] items-center gap-2 rounded-xl border border-[#102c3d]/[0.09] bg-[#f8fbfa] px-3"><span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[#102c3d]/[0.38]">{label}</span><select value={value} onChange={(event) => onChange(event.target.value)} className="min-w-0 bg-transparent text-xs font-semibold text-[#102c3d] outline-none">{options.map((option) => <option key={option} value={option}>{optionLabel?.(option) ?? option}</option>)}</select></label>;
}

function focusQueue(queue: OperationalQueueType, setQueue: (value: OperationalQueueType | "All") => void, setExpanded: Dispatch<SetStateAction<Record<string, boolean>>>) {
  setQueue(queue);
  setExpanded((current) => ({ ...current, [queue]: true }));
  window.setTimeout(() => document.getElementById(`operations-${queue}`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
}

function queueDescription(queue: OperationalQueueType) {
  const descriptions: Record<OperationalQueueType, string> = {
    urgent: "The highest-risk learner issues requiring action now.",
    ready_to_enrol: "Pre-enrolment records with every mandatory check complete.",
    reviews: "Overdue, action-required and upcoming learner conversations.",
    progress: "Learners behind target or missing a recent progress update.",
    breaks: "Active breaks, return dates and post-return support.",
    pre_enrolment: "Clear owners and next actions for incomplete enrolment checks.",
    assessment: "Assessment models, readiness confirmations, gateway dates and entry into assessment.",
  };
  return descriptions[queue];
}

function priorityTone(priority: OperationalPriorityLevel): OperationalTone {
  if (priority === "Critical" || priority === "High") return "risk";
  if (priority === "Medium") return "watch";
  if (priority === "Low") return "info";
  return "neutral";
}

function priorityEdge(priority: OperationalPriorityLevel) {
  if (priority === "Critical" || priority === "High") return "border-l-[#c95568]";
  if (priority === "Medium") return "border-l-[#d6a62d]";
  if (priority === "Low") return "border-l-[#4f7b95]";
  return "border-l-[#aab6b0]";
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(new Date(value));
}

function sentenceCase(value: string) {
  return value.replace(/_/g, " ").replace(/^\w/, (letter) => letter.toUpperCase());
}
