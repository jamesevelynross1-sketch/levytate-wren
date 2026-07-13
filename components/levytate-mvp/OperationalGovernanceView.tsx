"use client";

import { AlertCircle, ArrowRight, CalendarDays, Clock3, History, Search, UsersRound } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { StatusBadge } from "@/components/levytate-mvp/MvpUi";
import { operationalActionStatusLabels, type OperationalActionStatus } from "@/lib/levytate/mvp/operational-actions";
import type {
  OperationalGovernanceItem,
  OperationalGovernanceResponse,
  OperationalGovernanceView,
  OwnerOperationalSummary,
} from "@/lib/server/levytate-operational-governance";

type ApiResponse = Partial<OperationalGovernanceResponse> & { ok?: boolean; message?: string };

const viewOptions: Array<{ value: OperationalGovernanceView; label: string }> = [
  { value: "summary", label: "Overview" },
  { value: "overdue", label: "Overdue" },
  { value: "unacknowledged", label: "Awaiting acknowledgement" },
  { value: "stalled", label: "Stalled" },
  { value: "closed", label: "Closed register" },
  { value: "owners", label: "Owner summary" },
];

export function OperationalGovernanceView({ onOpenAction }: { onOpenAction: (actionId: string) => void }) {
  const [view, setView] = useState<OperationalGovernanceView>("summary");
  const [data, setData] = useState<OperationalGovernanceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [priority, setPriority] = useState("All");
  const [owner, setOwner] = useState("All");
  const [status, setStatus] = useState("All");
  const [completionMethod, setCompletionMethod] = useState("All");
  const [ageingBand, setAgeingBand] = useState("All");
  const [period, setPeriod] = useState<"30" | "90" | "365" | "custom">("90");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError("");
      const params = new URLSearchParams({ view, datePeriod: period, page: String(page), pageSize: "50" });
      if (search.trim()) params.set("search", search.trim());
      if (priority !== "All") params.set("priority", priority);
      if (owner !== "All") params.set("owner", owner);
      if (view === "closed" && status !== "All") params.set("status", status);
      if (view === "closed" && completionMethod !== "All") params.set("completionMethod", completionMethod);
      if (view !== "closed" && ageingBand !== "All") params.set("ageingBand", ageingBand);
      if (period === "custom" && dateFrom) params.set("dateFrom", dateFrom);
      if (period === "custom" && dateTo) params.set("dateTo", dateTo);
      try {
        const response = await fetch(`/api/levytate-operational-governance?${params}`, { cache: "no-store", signal: controller.signal });
        const payload = (await response.json()) as ApiResponse;
        if (!response.ok || !payload.summary || !payload.closed || !payload.filterOptions || !payload.period) throw new Error(payload.message || "Operational governance is unavailable.");
        setData(payload as OperationalGovernanceResponse);
      } catch (loadError) {
        if (!(loadError instanceof DOMException && loadError.name === "AbortError")) setError(loadError instanceof Error ? loadError.message : "Operational governance is unavailable.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, search ? 250 : 0);
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [ageingBand, completionMethod, dateFrom, dateTo, owner, page, period, priority, search, status, view]);

  useEffect(() => setPage(1), [ageingBand, completionMethod, dateFrom, dateTo, owner, period, priority, search, status, view]);

  const activeRows = useMemo(() => {
    if (!data) return [];
    if (view === "overdue") return data.overdue;
    if (view === "unacknowledged") return data.unacknowledged;
    if (view === "stalled") return data.stalled;
    return [];
  }, [data, view]);

  return (
    <div className="grid min-w-0 gap-4" data-testid="operational-governance">
      <section className="rounded-2xl border border-[#102c3d]/[0.075] bg-white p-5 shadow-[0_14px_34px_rgba(16,44,61,0.035)] sm:p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-2xl">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#c95568]">Operational governance</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-[-0.025em] text-[#102c3d]">Action ageing and closed outcomes</h2>
            <p className="mt-2 text-sm leading-6 text-[#102c3d]/56">Review unresolved work, ownership pressure points and how previous actions were closed.</p>
          </div>
          <span className="w-fit rounded-full bg-[#edf7f3] px-3 py-2 text-xs font-semibold text-[#0b6f63]">Read-only governance</span>
        </div>
        <div className="mt-5 flex max-w-full gap-1 overflow-x-auto rounded-xl bg-[#f3f7f5] p-1" role="tablist" aria-label="Operational governance views">
          {viewOptions.map((option) => <button key={option.value} type="button" role="tab" aria-selected={view === option.value} onClick={() => setView(option.value)} className={`shrink-0 rounded-lg px-3.5 py-2 text-xs font-semibold transition ${view === option.value ? "bg-white text-[#102c3d] shadow-[0_5px_14px_rgba(16,44,61,0.08)]" : "text-[#102c3d]/50 hover:text-[#0b6f63]"}`}>{option.label}</button>)}
        </div>
      </section>

      <GovernanceFilters data={data} search={search} setSearch={setSearch} priority={priority} setPriority={setPriority} owner={owner} setOwner={setOwner} status={status} setStatus={setStatus} completionMethod={completionMethod} setCompletionMethod={setCompletionMethod} ageingBand={ageingBand} setAgeingBand={setAgeingBand} period={period} setPeriod={setPeriod} dateFrom={dateFrom} setDateFrom={setDateFrom} dateTo={dateTo} setDateTo={setDateTo} view={view} />

      {error ? <div className="rounded-xl border border-[#b13b51]/10 bg-[#fff0f2] px-4 py-3 text-sm font-semibold text-[#b13b51]">{error}</div> : null}
      {loading && !data ? <div className="rounded-2xl border border-[#102c3d]/[0.07] bg-white px-5 py-12 text-center text-sm font-semibold text-[#102c3d]/52">Preparing organisation governance.</div> : null}

      {data ? <>
        {view === "summary" ? <GovernanceSummary data={data} onSelect={setView} /> : null}
        {view === "owners" ? <OwnerSummary rows={data.owners} /> : null}
        {view === "closed" ? <ClosedRegister data={data} onOpenAction={onOpenAction} onPage={setPage} /> : null}
        {view === "overdue" || view === "unacknowledged" || view === "stalled" ? <ActiveGovernanceTable view={view} rows={activeRows} onOpenAction={onOpenAction} /> : null}
      </> : null}
    </div>
  );
}

function GovernanceSummary({ data, onSelect }: { data: OperationalGovernanceResponse; onSelect: (view: OperationalGovernanceView) => void }) {
  const cards = [
    { label: "Active actions", value: data.summary.activeActions, detail: "Current organisation work", icon: CalendarDays, view: "overdue" as const },
    { label: "Overdue", value: data.summary.overdueActions, detail: "Past their recorded due date", icon: AlertCircle, view: "overdue" as const },
    { label: "Awaiting acknowledgement", value: data.summary.awaitingAcknowledgement, detail: "Past the central attention threshold", icon: Clock3, view: "unacknowledged" as const },
    { label: "Stalled in progress", value: data.summary.stalledInProgress, detail: `No movement for more than ${data.policy.stalledInProgressDays} days`, icon: History, view: "stalled" as const },
  ];
  return <>
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{cards.map(({ label, value, detail, icon: Icon, view }) => <button key={label} type="button" onClick={() => onSelect(view)} className="group rounded-2xl border border-[#102c3d]/[0.075] bg-white p-4 text-left shadow-[0_12px_30px_rgba(16,44,61,0.035)] transition hover:-translate-y-0.5 hover:shadow-[0_16px_34px_rgba(16,44,61,0.07)]"><div className="flex items-start justify-between gap-3"><span className="text-3xl font-semibold tracking-[-0.04em] text-[#102c3d]">{value}</span><span className="grid h-9 w-9 place-items-center rounded-lg bg-[#edf7f3] text-[#0b6f63]"><Icon size={17} /></span></div><p className="mt-3 text-sm font-semibold text-[#102c3d]">{label}</p><p className="mt-1 text-xs leading-5 text-[#102c3d]/48">{detail}</p></button>)}</section>
    <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
      <div className="rounded-2xl border border-[#102c3d]/[0.075] bg-white p-5 shadow-[0_14px_34px_rgba(16,44,61,0.035)]">
        <div className="flex items-end justify-between gap-4"><div><h3 className="text-base font-semibold text-[#102c3d]">Active action ageing</h3><p className="mt-1 text-xs leading-5 text-[#102c3d]/48">Age is measured from the date each condition was detected.</p></div><span className="text-xs font-semibold text-[#102c3d]/42">{data.summary.activeActions} active</span></div>
        <div className="mt-5 grid gap-3">{data.ageing.map((item) => <div key={item.band} className="grid grid-cols-[145px_minmax(0,1fr)_32px] items-center gap-3"><span className="text-xs font-semibold text-[#102c3d]/62">{item.band}</span><span className="h-2 overflow-hidden rounded-full bg-[#edf3f0]"><span className="block h-full rounded-full bg-[#159b8f]" style={{ width: `${data.summary.activeActions ? Math.max(4, item.count / data.summary.activeActions * 100) : 0}%` }} /></span><span className="text-right text-xs font-semibold text-[#102c3d]">{item.count}</span></div>)}</div>
      </div>
      <div className="rounded-2xl border border-[#102c3d]/[0.075] bg-white p-5 shadow-[0_14px_34px_rgba(16,44,61,0.035)]">
        <div className="flex items-center justify-between gap-3"><div><h3 className="text-base font-semibold text-[#102c3d]">Resolution summary</h3><p className="mt-1 text-xs leading-5 text-[#102c3d]/48">{periodLabel(data.period.value)}</p></div><button type="button" onClick={() => onSelect("closed")} className="text-xs font-semibold text-[#0b6f63]">Open register</button></div>
        <div className="mt-4 grid grid-cols-2 gap-2"><Metric label="Actions closed" value={String(data.summary.actionsClosed)} /><Metric label="Median acknowledgement" value={durationLabel(data.summary.medianAcknowledgementDays)} /><Metric label="Median resolution" value={durationLabel(data.summary.medianResolutionDays)} /><Metric label="Still overdue" value={String(data.summary.overdueActions)} /></div>
        <div className="mt-4 flex flex-wrap gap-2 text-[11px] font-semibold text-[#102c3d]/56"><span>Automatic {data.summary.completedAutomatically}</span><span>Manual {data.summary.completedManually}</span><span>Dismissed {data.summary.dismissed}</span><span>Cancelled {data.summary.cancelled}</span></div>
      </div>
    </section>
  </>;
}

function ActiveGovernanceTable({ view, rows, onOpenAction }: { view: OperationalGovernanceView; rows: OperationalGovernanceItem[]; onOpenAction: (id: string) => void }) {
  const empty = view === "overdue" ? "No operational actions are currently overdue." : view === "unacknowledged" ? "All current actions have been acknowledged or progressed." : "No in-progress actions currently appear stalled.";
  const title = view === "overdue" ? "Overdue actions" : view === "unacknowledged" ? "Awaiting acknowledgement" : "In progress without recent movement";
  return <section className="overflow-hidden rounded-2xl border border-[#102c3d]/[0.075] bg-white shadow-[0_14px_34px_rgba(16,44,61,0.035)]"><div className="border-b border-[#102c3d]/[0.06] px-5 py-4"><h3 className="text-base font-semibold text-[#102c3d]">{title}</h3><p className="mt-1 text-xs leading-5 text-[#102c3d]/48">Read-only oversight. Open the action to review its authoritative history.</p></div>{rows.length ? <div className="overflow-x-auto"><table className="w-full min-w-[960px] border-collapse text-left"><thead><tr className="bg-[#f8fbfa] text-[10px] font-semibold uppercase tracking-[0.1em] text-[#102c3d]/38"><Th>Action and learner</Th><Th>Priority</Th><Th>Status</Th><Th>Owner</Th><Th>{view === "stalled" ? "Last movement" : "Due"}</Th><Th>Age</Th><Th /></tr></thead><tbody>{rows.map((row) => <tr key={row.id} className="border-t border-[#102c3d]/[0.055]"><Td><p className="font-semibold text-[#102c3d]">{row.title}</p><p className="mt-1 text-xs text-[#102c3d]/48">{row.learnerName} · {row.programmeName}</p></Td><Td><StatusBadge tone={priorityTone(row.priority)}>{row.priority}</StatusBadge></Td><Td>{row.statusLabel}</Td><Td><p className="font-semibold text-[#102c3d]/70">{row.ownerName}</p><p className="mt-1 text-xs text-[#102c3d]/42">{row.ownerType}</p></Td><Td>{view === "stalled" ? <><p>{formatDate(row.lastMeaningfulUpdate)}</p><p className="mt-1 text-xs font-semibold text-[#b13b51]">{row.daysWithoutMovement} days without movement</p></> : <><p>{row.dueDate ? formatDate(row.dueDate) : "No due date"}</p>{row.daysOverdue ? <p className="mt-1 text-xs font-semibold text-[#b13b51]">{row.daysOverdue} days overdue</p> : null}</>}</Td><Td><p>{row.ageInDays} days</p><p className="mt-1 text-xs text-[#102c3d]/42">{row.ageingBand}</p></Td><Td><OpenButton label="Open action" onClick={() => onOpenAction(row.id)} /></Td></tr>)}</tbody></table></div> : <p className="px-5 py-10 text-center text-sm font-semibold text-[#102c3d]/50">{empty}</p>}</section>;
}

function ClosedRegister({ data, onOpenAction, onPage }: { data: OperationalGovernanceResponse; onOpenAction: (id: string) => void; onPage: (page: number) => void }) {
  return <section className="overflow-hidden rounded-2xl border border-[#102c3d]/[0.075] bg-white shadow-[0_14px_34px_rgba(16,44,61,0.035)]"><div className="flex flex-col gap-2 border-b border-[#102c3d]/[0.06] px-5 py-4 sm:flex-row sm:items-end sm:justify-between"><div><h3 className="text-base font-semibold text-[#102c3d]">Closed Action Register</h3><p className="mt-1 text-xs leading-5 text-[#102c3d]/48">Completed, dismissed and cancelled actions remain separate and immutable.</p></div><span className="text-xs font-semibold text-[#102c3d]/46">{data.closed.total} results · Page {data.closed.page} of {data.closed.totalPages}</span></div>{data.closed.items.length ? <div className="overflow-x-auto"><table className="w-full min-w-[1120px] border-collapse text-left"><thead><tr className="bg-[#f8fbfa] text-[10px] font-semibold uppercase tracking-[0.1em] text-[#102c3d]/38"><Th>Action and learner</Th><Th>Final status</Th><Th>Final owner</Th><Th>Detected</Th><Th>Closed</Th><Th>Resolution</Th><Th>Outcome</Th><Th /></tr></thead><tbody>{data.closed.items.map((row) => <tr key={row.id} className="border-t border-[#102c3d]/[0.055]"><Td><p className="font-semibold text-[#102c3d]">{row.title}</p><p className="mt-1 text-xs text-[#102c3d]/48">{row.learnerName} · {row.programmeName}</p>{row.previousOccurrences ? <p className="mt-1 text-xs font-semibold text-[#0b6f63]">Previous occurrences: {row.previousOccurrences}</p> : null}</Td><Td><StatusBadge tone={row.status === "completed" ? "green" : row.status === "dismissed" ? "yellow" : "neutral"}>{row.statusLabel}</StatusBadge><p className="mt-1 text-xs text-[#102c3d]/42">{row.completionMethodLabel}</p></Td><Td><p>{row.ownerName}</p><p className="mt-1 text-xs text-[#102c3d]/42">Closed by {row.closedBy}</p></Td><Td>{formatDate(row.detectedAt)}</Td><Td>{formatDate(row.closedAt)}</Td><Td>{durationLabel(row.resolutionDuration)}</Td><Td><p className="max-w-[310px] text-xs leading-5 text-[#102c3d]/60">{row.outcomeSummary}</p></Td><Td><OpenButton label="View history" onClick={() => onOpenAction(row.id)} /></Td></tr>)}</tbody></table></div> : <p className="px-5 py-10 text-center text-sm font-semibold text-[#102c3d]/50">No operational actions have been closed in the selected period.</p>}<div className="flex items-center justify-end gap-2 border-t border-[#102c3d]/[0.06] px-5 py-3"><button type="button" disabled={data.closed.page <= 1} onClick={() => onPage(data.closed.page - 1)} className="rounded-lg border border-[#102c3d]/[0.08] px-3 py-2 text-xs font-semibold text-[#102c3d]/60 disabled:opacity-35">Previous</button><button type="button" disabled={data.closed.page >= data.closed.totalPages} onClick={() => onPage(data.closed.page + 1)} className="rounded-lg border border-[#102c3d]/[0.08] px-3 py-2 text-xs font-semibold text-[#102c3d]/60 disabled:opacity-35">Next</button></div></section>;
}

function OwnerSummary({ rows }: { rows: OwnerOperationalSummary[] }) {
  return <section className="overflow-hidden rounded-2xl border border-[#102c3d]/[0.075] bg-white shadow-[0_14px_34px_rgba(16,44,61,0.035)]"><div className="border-b border-[#102c3d]/[0.06] px-5 py-4"><div className="flex items-center gap-2"><UsersRound size={17} className="text-[#0b6f63]" /><h3 className="text-base font-semibold text-[#102c3d]">Owner summary</h3></div><p className="mt-1 text-xs leading-5 text-[#102c3d]/48">Workflow accountability only. This does not score employee performance or imply platform access.</p></div>{rows.length ? <div className="overflow-x-auto"><table className="w-full min-w-[820px] border-collapse text-left"><thead><tr className="bg-[#f8fbfa] text-[10px] font-semibold uppercase tracking-[0.1em] text-[#102c3d]/38"><Th>Owner</Th><Th>Active</Th><Th>Overdue</Th><Th>Unacknowledged</Th><Th>In progress</Th><Th>Oldest active</Th><Th>Highest priority</Th></tr></thead><tbody>{rows.map((row) => <tr key={`${row.ownerType}:${row.owner}`} className="border-t border-[#102c3d]/[0.055]"><Td><p className="font-semibold text-[#102c3d]">{row.owner}</p><p className="mt-1 text-xs text-[#102c3d]/42">{row.accessNote}</p></Td><Td>{row.activeActions}</Td><Td>{row.overdueActions}</Td><Td>{row.unacknowledgedActions}</Td><Td>{row.inProgressActions}</Td><Td>{row.oldestActiveDays} days</Td><Td>{row.highestPriority}</Td></tr>)}</tbody></table></div> : <p className="px-5 py-10 text-center text-sm font-semibold text-[#102c3d]/50">No actions match the selected owner.</p>}</section>;
}

function GovernanceFilters(props: { data: OperationalGovernanceResponse | null; search: string; setSearch: (value: string) => void; priority: string; setPriority: (value: string) => void; owner: string; setOwner: (value: string) => void; status: string; setStatus: (value: string) => void; completionMethod: string; setCompletionMethod: (value: string) => void; ageingBand: string; setAgeingBand: (value: string) => void; period: "30" | "90" | "365" | "custom"; setPeriod: (value: "30" | "90" | "365" | "custom") => void; dateFrom: string; setDateFrom: (value: string) => void; dateTo: string; setDateTo: (value: string) => void; view: OperationalGovernanceView }) {
  const { data, search, setSearch, priority, setPriority, owner, setOwner, status, setStatus, completionMethod, setCompletionMethod, ageingBand, setAgeingBand, period, setPeriod, dateFrom, setDateFrom, dateTo, setDateTo, view } = props;
  const closed = view === "closed";
  return <section className="rounded-2xl border border-[#102c3d]/[0.075] bg-white p-4 shadow-[0_12px_28px_rgba(16,44,61,0.03)]" aria-label="Governance filters"><div className="grid gap-2 xl:grid-cols-[minmax(260px,1.5fr)_repeat(4,minmax(130px,0.7fr))]"><label className="flex h-11 items-center gap-2 rounded-xl border border-[#102c3d]/[0.09] bg-[#f8fbfa] px-3 focus-within:border-[#159b8f]"><Search size={15} className="text-[#102c3d]/38" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search action, learner, programme, provider or owner" className="min-w-0 flex-1 bg-transparent text-sm text-[#102c3d] outline-none placeholder:text-[#102c3d]/34" /></label><Filter label="Priority" value={priority} options={["All", ...(data?.filterOptions.priorities ?? [])]} onChange={setPriority} /><Filter label="Owner" value={owner} options={["All", ...(data?.filterOptions.owners ?? [])]} onChange={setOwner} />{closed ? <Filter label="Status" value={status} options={["All", "completed", "dismissed", "cancelled"]} optionLabel={(value) => value === "All" ? "All outcomes" : operationalActionStatusLabels[value as OperationalActionStatus]} onChange={setStatus} /> : <Filter label="Age" value={ageingBand} options={["All", ...(data?.filterOptions.ageingBands ?? [])]} onChange={setAgeingBand} />}<Filter label="Period" value={period} options={["30", "90", "365", "custom"]} optionLabel={periodLabel} onChange={(value) => setPeriod(value as typeof period)} /></div>{closed ? <div className="mt-2 grid gap-2 sm:grid-cols-3"><Filter label="Method" value={completionMethod} options={["All", ...(data?.filterOptions.completionMethods ?? [])]} optionLabel={(value) => value === "All" ? "All methods" : sentenceCase(value)} onChange={setCompletionMethod} />{period === "custom" ? <><DateFilter label="From" value={dateFrom} onChange={setDateFrom} /><DateFilter label="To" value={dateTo} onChange={setDateTo} /></> : null}</div> : null}</section>;
}

function Filter({ label, value, options, optionLabel, onChange }: { label: string; value: string; options: readonly string[]; optionLabel?: (value: string) => string; onChange: (value: string) => void }) { return <label className="grid h-11 grid-cols-[auto_1fr] items-center gap-2 rounded-xl border border-[#102c3d]/[0.09] bg-[#f8fbfa] px-3"><span className="text-[9px] font-semibold uppercase tracking-[0.11em] text-[#102c3d]/38">{label}</span><select value={value} onChange={(event) => onChange(event.target.value)} className="min-w-0 bg-transparent text-xs font-semibold text-[#102c3d] outline-none">{options.map((option) => <option key={option} value={option}>{optionLabel?.(option) ?? option}</option>)}</select></label>; }
function DateFilter({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <label className="grid h-11 grid-cols-[auto_1fr] items-center gap-2 rounded-xl border border-[#102c3d]/[0.09] bg-[#f8fbfa] px-3"><span className="text-[9px] font-semibold uppercase tracking-[0.11em] text-[#102c3d]/38">{label}</span><input type="date" value={value} onChange={(event) => onChange(event.target.value)} className="min-w-0 bg-transparent text-xs font-semibold text-[#102c3d] outline-none" /></label>; }
function Metric({ label, value }: { label: string; value: string }) { return <div className="rounded-xl bg-[#f8fbfa] p-3"><p className="text-lg font-semibold tracking-[-0.025em] text-[#102c3d]">{value}</p><p className="mt-1 text-[11px] font-semibold leading-4 text-[#102c3d]/48">{label}</p></div>; }
function OpenButton({ label, onClick }: { label: string; onClick: () => void }) { return <button type="button" onClick={onClick} className="inline-flex h-9 shrink-0 items-center gap-2 rounded-full bg-[#102c3d] px-3.5 text-xs font-semibold text-white transition hover:-translate-y-0.5 hover:bg-[#17394d]">{label}<ArrowRight size={13} /></button>; }
function Th({ children }: { children?: React.ReactNode }) { return <th className="px-4 py-3">{children}</th>; }
function Td({ children }: { children: React.ReactNode }) { return <td className="px-4 py-3.5 align-top text-sm text-[#102c3d]/62">{children}</td>; }
function priorityTone(priority: string) { return priority === "Critical" || priority === "High" ? "red" as const : priority === "Medium" ? "yellow" as const : priority === "Low" ? "blue" as const : "neutral" as const; }
function formatDate(value: string) { return value ? new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(new Date(value)) : "Not recorded"; }
function durationLabel(value: number | null) { if (value === null) return "Not recorded"; return `${Number.isInteger(value) ? value : value.toFixed(1)} days`; }
function periodLabel(value: string) { return ({ "30": "Last 30 days", "90": "Last 90 days", "365": "Last 12 months", custom: "Custom range" } as Record<string, string>)[value] ?? value; }
function sentenceCase(value: string) { return value.replace(/_/g, " ").replace(/^\w/, (letter) => letter.toUpperCase()); }
