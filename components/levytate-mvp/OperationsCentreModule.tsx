"use client";

import { AlertTriangle, ArrowRight, CalendarClock, CheckCircle2, ChevronDown, CircleAlert, Clock3, PauseCircle, Search, TrendingDown } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { EmptyState, StatusBadge } from "@/components/levytate-mvp/MvpUi";
import { OperationalActionDetail } from "@/components/levytate-mvp/OperationalActionDetail";
import { useMvpWorkspace } from "@/components/levytate-mvp/MvpWorkspaceStore";
import { operationalActionStatusLabels, type OperationalActionStatus } from "@/lib/levytate/mvp/operational-actions";
import {
  operationalQueueLabels,
  type OperationalActionType,
  type OperationalDueStatus,
  type OperationalItem,
  type OperationalPriorityLevel,
  type OperationalQueueType,
  type OperationsResponse,
} from "@/lib/levytate/mvp/operations-centre";

type OperationsApiResponse = Partial<OperationsResponse> & { ok?: boolean; message?: string };
type LearnerAction = { learnerRecordId: string; actionType: OperationalActionType };

const queueOrder: OperationalQueueType[] = ["urgent", "ready_to_enrol", "reviews", "progress", "breaks", "pre_enrolment"];
const dueStatuses: Array<OperationalDueStatus | "All"> = ["All", "Overdue", "Due today", "Due soon", "No due date"];

export function OperationsCentreModule({ onOpenLearner }: { onOpenLearner: (target: LearnerAction) => void }) {
  const { can, meta } = useMvpWorkspace();
  const authorised = can("learnerLifecycle:read") && ["Apprenticeship Lead", "Employer Admin", "Platform Admin"].includes(meta?.userRole ?? "");
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

  if (!authorised) {
    return <EmptyState title="Operations Centre is not available for this role" copy="Organisation-wide learner operations are restricted to Apprenticeship Leads and authorised platform administrators." actionLabel="Return home" onAction={() => window.scrollTo({ top: 0, behavior: "smooth" })} />;
  }

  if (selectedActionId) {
    return <OperationalActionDetail actionId={selectedActionId} onBack={() => setSelectedActionId("")} onOpenLearner={onOpenLearner} onChanged={() => setRefreshKey((current) => current + 1)} />;
  }

  return (
    <div className="grid min-w-0 gap-5" data-testid="operations-centre">
      <section className="rounded-2xl border border-[#102c3d]/[0.075] bg-white p-5 shadow-[0_16px_42px_rgba(16,44,61,0.045)] sm:p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-2xl">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#c95568]">Daily learner operations</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-[-0.025em] text-[#102c3d]">What needs attention today</h2>
            <p className="mt-2 text-sm leading-6 text-[#102c3d]/56">Prioritised from live enrolment, review, progress and Break in Learning records.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-[#102c3d]/52">
            <span className="rounded-full bg-[#edf7f3] px-3 py-2 text-[#0b6f63]">Live Supabase data</span>
            {data?.generatedAt ? <span>Updated {formatTime(data.generatedAt)}</span> : null}
          </div>
        </div>

        <div className="mt-5 grid gap-2 sm:grid-cols-2 xl:grid-cols-6">
          <SummaryButton label="Needs attention now" value={data?.summary.needsAttentionNow ?? 0} icon={CircleAlert} tone="red" onClick={() => focusQueue("urgent", setQueue, setExpanded)} />
          <SummaryButton label="Ready to enrol" value={data?.summary.readyToEnrol ?? 0} icon={CheckCircle2} tone="green" onClick={() => focusQueue("ready_to_enrol", setQueue, setExpanded)} />
          <SummaryButton label="Reviews overdue" value={data?.summary.reviewsOverdue ?? 0} icon={Clock3} tone="yellow" onClick={() => focusQueue("reviews", setQueue, setExpanded)} />
          <SummaryButton label="Behind target" value={data?.summary.behindTarget ?? 0} icon={TrendingDown} tone="red" onClick={() => focusQueue("progress", setQueue, setExpanded)} />
          <SummaryButton label="Active breaks" value={data?.summary.activeBreaks ?? 0} icon={PauseCircle} tone="blue" onClick={() => focusQueue("breaks", setQueue, setExpanded)} />
          <SummaryButton label="Approaching completion" value={data?.summary.approachingAssessmentCompletion ?? 0} icon={CalendarClock} tone="blue" onClick={() => { setQueue("All"); document.getElementById("operations-queues")?.scrollIntoView({ behavior: "smooth" }); }} />
        </div>
      </section>

      <section className="rounded-2xl border border-[#102c3d]/[0.075] bg-white p-4 shadow-[0_14px_34px_rgba(16,44,61,0.035)]" aria-label="Operations filters">
        <div className="flex flex-wrap gap-2 border-b border-[#102c3d]/[0.06] pb-3" aria-label="Action ownership">
          {([['all', 'All actions'], ['mine', 'My actions'], ['unassigned', 'Unassigned'], ['shared', 'Shared actions']] as const).map(([value, label]) => <button key={value} type="button" onClick={() => setAssignment(value)} className={`rounded-full px-3.5 py-2 text-xs font-semibold transition ${assignment === value ? "bg-[#102c3d] text-white shadow-[0_8px_18px_rgba(16,44,61,0.12)]" : "bg-[#f5f8f6] text-[#102c3d]/58 hover:bg-[#edf7f3] hover:text-[#0b6f63]"}`}>{label}</button>)}
        </div>
        <div className="mt-3 grid gap-2 xl:grid-cols-[minmax(260px,1.4fr)_repeat(3,minmax(140px,0.6fr))_auto]">
          <label className="flex h-11 min-w-0 items-center gap-2 rounded-xl border border-[#102c3d]/[0.09] bg-[#f8fbfa] px-3 focus-within:border-[#159b8f] focus-within:bg-white focus-within:ring-4 focus-within:ring-[#159b8f]/10">
            <Search size={16} className="shrink-0 text-[#102c3d]/38" aria-hidden="true" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} className="min-w-0 flex-1 bg-transparent text-sm text-[#102c3d] outline-none placeholder:text-[#102c3d]/34" placeholder="Search action, learner, programme, provider or owner" aria-label="Search operations" />
          </label>
          <FilterSelect label="Status" value={status} options={["All", "open", "acknowledged", "in_progress"]} optionLabel={(value) => value === "All" ? "All statuses" : operationalActionStatusLabels[value as OperationalActionStatus]} onChange={(value) => setStatus(value as OperationalActionStatus | "All")} />
          <FilterSelect label="Priority" value={priority} options={["All", ...(data?.filterOptions.priorities ?? [])]} onChange={setPriority} />
          <FilterSelect label="Due" value={dueStatus} options={dueStatuses} onChange={(value) => setDueStatus(value as OperationalDueStatus | "All")} />
          <button type="button" onClick={() => setMoreFilters((current) => !current)} className="h-11 rounded-xl border border-[#102c3d]/[0.09] bg-white px-4 text-xs font-semibold text-[#102c3d]/62 transition hover:bg-[#f8fbfa] hover:text-[#102c3d]">{moreFilters ? "Fewer filters" : "More filters"}</button>
        </div>
        {moreFilters ? <div className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-5"><FilterSelect label="Queue" value={queue} options={["All", ...(data?.filterOptions.queues.map((item) => item.value) ?? [])]} optionLabel={(value) => value === "All" ? "All queues" : operationalQueueLabels[value as OperationalQueueType]} onChange={(value) => setQueue(value as OperationalQueueType | "All")} /><FilterSelect label="Owner" value={owner} options={["All", ...(data?.filterOptions.owners ?? [])]} onChange={setOwner} /><FilterSelect label="Action" value={actionType} options={["All", ...(data?.filterOptions.actionTypes ?? [])]} optionLabel={(value) => value === "All" ? "All action types" : sentenceCase(value)} onChange={setActionType} /><FilterSelect label="Learner" value={learner} options={["All", ...(data?.filterOptions.learners ?? [])]} onChange={setLearner} /><FilterSelect label="Programme" value={programme} options={["All", ...(data?.filterOptions.programmes ?? [])]} onChange={setProgramme} /></div> : null}
        {hasFilters ? <button type="button" onClick={() => { setSearch(""); setPriority("All"); setQueue("All"); setOwner("All"); setDueStatus("All"); setStatus("All"); setActionType("All"); setLearner("All"); setProgramme("All"); setAssignment("all"); }} className="mt-3 text-xs font-semibold text-[#0b6f63] hover:text-[#102c3d]">Clear filters</button> : null}
      </section>

      {error ? <div className="rounded-xl border border-[#b13b51]/10 bg-[#fff0f2] px-4 py-3 text-sm font-semibold text-[#b13b51]">{error}</div> : null}
      {loading && !data ? <div className="rounded-2xl border border-[#102c3d]/[0.07] bg-white px-5 py-12 text-center text-sm font-semibold text-[#102c3d]/52">Prioritising live learner records.</div> : null}

      {data ? (
        <div id="operations-queues" className="grid gap-4">
          {queueOrder.filter((key) => queue === "All" || queue === key).map((key) => (
            <QueueSection key={key} queue={key} items={data.queues[key]} expanded={Boolean(expanded[key])} onToggle={() => setExpanded((current) => ({ ...current, [key]: !current[key] }))} onOpenLearner={onOpenLearner} onOpenAction={setSelectedActionId} />
          ))}

          {!data.totalAttentionItems ? (
            <section className="rounded-2xl border border-[#159b8f]/15 bg-[#f4fbf8] p-6 text-center">
              <CheckCircle2 className="mx-auto text-[#159b8f]" size={28} aria-hidden="true" />
              <h3 className="mt-3 text-lg font-semibold text-[#102c3d]">{assignment === "mine" ? "You do not currently own any active actions." : hasFilters ? "No actions match the selected filters." : "No active operational actions currently require attention."}</h3>
              <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-[#102c3d]/56">{nextUpcoming ? `${nextUpcoming.learnerName}: ${nextUpcoming.reason}` : data.recentActivity[0] ? `Most recent completion: ${data.recentActivity[0].action}` : "New reviews and lifecycle changes will appear here as they are recorded."}</p>
            </section>
          ) : null}

          <RecentActivity items={data.recentActivity} onOpenLearner={(learnerRecordId) => onOpenLearner({ learnerRecordId, actionType: "open_learner" })} />
        </div>
      ) : null}
    </div>
  );
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
          <p className="mt-1 text-xs leading-5 text-[#102c3d]/48">{queueDescription(queue)}</p>
        </div>
        <ChevronDown size={17} className={`shrink-0 text-[#102c3d]/42 transition ${expanded ? "rotate-180" : ""}`} aria-hidden="true" />
      </button>
      {expanded ? (
        <div className="border-t border-[#102c3d]/[0.06]">
          {visible.length ? visible.map((item) => <OperationalRow key={item.id} item={item} onOpenLearner={onOpenLearner} onOpenAction={onOpenAction} />) : <p className="px-5 py-6 text-sm text-[#102c3d]/50">No current items in this queue.</p>}
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
    <article className="grid gap-3 border-b border-[#102c3d]/[0.055] px-5 py-4 last:border-b-0 lg:grid-cols-[minmax(0,1.3fr)_minmax(190px,0.7fr)_auto] lg:items-center">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => onOpenLearner({ learnerRecordId: item.learnerRecordId, actionType: "open_learner" })} className="truncate text-left text-sm font-semibold text-[#102c3d] hover:text-[#0b6f63]">{item.learnerName}</button>
          <StatusBadge tone={priorityTone(item.priorityLevel)}>{item.priorityLevel}</StatusBadge>
          <StatusBadge tone={status === "in_progress" ? "blue" : status === "acknowledged" ? "yellow" : "neutral"}>{operationalActionStatusLabels[status]}</StatusBadge>
          <span className="text-xs font-semibold text-[#102c3d]/42">{item.lifecycleStatus}</span>
        </div>
        <p className="mt-1 truncate text-xs font-semibold text-[#102c3d]/54">{item.programmeName}</p>
        <p className="mt-1 text-sm leading-5 text-[#102c3d]/68">{item.reason}</p>
        {item.targetProgress !== undefined ? <p className="mt-1 text-xs text-[#102c3d]/48">Target {item.targetProgress}% · Actual {item.actualProgress}% · Variance {item.variance}%</p> : null}
      </div>
      <div className="grid gap-1 text-xs text-[#102c3d]/52">
        <span><strong className="font-semibold text-[#102c3d]/70">Owner:</strong> {item.persistentOwnerDisplayName || item.ownerType}</span>
        <span className={item.dueStatus === "Overdue" ? "font-semibold text-[#b13b51]" : ""}>{item.timingLabel}</span>
        {item.persistentDetectedAt ? <span>Detected {formatDate(item.persistentDetectedAt)}</span> : null}
        <span className="truncate">{item.providerName}</span>
      </div>
      <div className="flex flex-wrap gap-2 lg:justify-end">
        <button type="button" onClick={() => item.persistentActionId ? onOpenAction(item.persistentActionId) : onOpenLearner({ learnerRecordId: item.learnerRecordId, actionType: item.actionType })} className="inline-flex h-9 items-center justify-center gap-2 rounded-full bg-[#102c3d] px-4 text-xs font-semibold text-white transition hover:-translate-y-0.5 hover:bg-[#17394d]">{primaryLabel}<ArrowRight size={14} /></button>
        <button type="button" onClick={() => onOpenLearner({ learnerRecordId: item.learnerRecordId, actionType: item.actionType })} className="inline-flex h-9 items-center justify-center rounded-full border border-[#102c3d]/[0.09] bg-white px-4 text-xs font-semibold text-[#102c3d]/64 transition hover:bg-[#f8fbfa] hover:text-[#102c3d]">{item.actionLabel}</button>
      </div>
    </article>
  );
}

function RecentActivity({ items, onOpenLearner }: { items: OperationsResponse["recentActivity"]; onOpenLearner: (id: string) => void }) {
  return (
    <section className="rounded-2xl border border-[#102c3d]/[0.075] bg-white p-5 shadow-[0_14px_34px_rgba(16,44,61,0.035)]">
      <h3 className="text-base font-semibold text-[#102c3d]">Recently completed</h3>
      <p className="mt-1 text-xs leading-5 text-[#102c3d]/48">Meaningful learner operations recorded in the last 30 days.</p>
      <div className="mt-4 grid gap-1">
        {items.length ? items.slice(0, 8).map((item) => (
          <button key={item.id} type="button" onClick={() => onOpenLearner(item.learnerRecordId)} className="grid gap-1 rounded-xl px-3 py-2.5 text-left transition hover:bg-[#f8fbfa] sm:grid-cols-[120px_180px_minmax(0,1fr)] sm:items-center">
            <span className="text-xs font-semibold text-[#102c3d]/44">{formatDateTime(item.eventDate)}</span>
            <span className="truncate text-sm font-semibold text-[#102c3d]">{item.learnerName}</span>
            <span className="text-sm leading-5 text-[#102c3d]/58">{item.action} <span className="text-xs text-[#102c3d]/36">by {item.actorName}</span></span>
          </button>
        )) : <p className="rounded-xl bg-[#f8fbfa] px-4 py-5 text-sm text-[#102c3d]/50">No recent operational completions are available.</p>}
      </div>
    </section>
  );
}

function SummaryButton({ label, value, icon: Icon, tone, onClick }: { label: string; value: number; icon: typeof AlertTriangle; tone: "red" | "green" | "yellow" | "blue"; onClick: () => void }) {
  const tones = { red: "bg-[#fff0f2] text-[#b13b51]", green: "bg-[#e9f7f2] text-[#0b6f63]", yellow: "bg-[#fff8df] text-[#806500]", blue: "bg-[#eef5fa] text-[#315d78]" };
  return <button type="button" onClick={onClick} className="group min-h-24 rounded-xl border border-[#102c3d]/[0.065] bg-[#f8fbfa] p-3.5 text-left transition hover:-translate-y-0.5 hover:bg-white hover:shadow-[0_12px_24px_rgba(16,44,61,0.07)]"><div className="flex items-start justify-between gap-3"><span className="text-2xl font-semibold tracking-[-0.03em] text-[#102c3d]">{value}</span><span className={`grid h-8 w-8 place-items-center rounded-lg ${tones[tone]}`}><Icon size={15} /></span></div><p className="mt-2 text-xs font-semibold leading-4 text-[#102c3d]/62 group-hover:text-[#102c3d]">{label}</p></button>;
}

function FilterSelect({ label, value, options, optionLabel, onChange }: { label: string; value: string; options: readonly string[]; optionLabel?: (value: string) => string; onChange: (value: string) => void }) {
  return <label className="grid h-11 grid-cols-[auto_1fr] items-center gap-2 rounded-xl border border-[#102c3d]/[0.09] bg-[#f8fbfa] px-3"><span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[#102c3d]/38">{label}</span><select value={value} onChange={(event) => onChange(event.target.value)} className="min-w-0 bg-transparent text-xs font-semibold text-[#102c3d] outline-none">{options.map((option) => <option key={option} value={option}>{optionLabel?.(option) ?? option}</option>)}</select></label>;
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
  };
  return descriptions[queue];
}

function priorityTone(priority: OperationalPriorityLevel) {
  if (priority === "Critical" || priority === "High") return "red" as const;
  if (priority === "Medium") return "yellow" as const;
  if (priority === "Low") return "blue" as const;
  return "neutral" as const;
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
