"use client";

import { ArrowRight, BarChart3, CalendarClock, CheckCircle2, Download, Info, Printer, RefreshCw, ShieldCheck, TriangleAlert } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { EmployerExecutiveReport } from "@/components/levytate-mvp/EmployerExecutiveReport";
import { useMvpWorkspace } from "@/components/levytate-mvp/MvpWorkspaceStore";
import { formatGbp } from "@/lib/levytate/finance/calculations";
import { buildEmployerExecutiveReportContract } from "@/lib/levytate/intelligence/executive-report";
import type { EmployerIntelligenceResponse, IntelligencePriority, WorkforceIntelligenceReport } from "@/lib/levytate/intelligence/types";
import { authenticatedClientFetch } from "@/lib/levytate/client-session";
import { decodeEvidenceDownload } from "@/lib/levytate/client-module-responses";
import { usePinnedClientMutation } from "@/components/levytate-mvp/usePinnedClientMutation";
import { ClientMutationRecovery } from "@/components/levytate-mvp/ClientMutationRecovery";

type View = "overview" | "workforce";

const panel = "lt-panel";
const eyebrow = "lt-eyebrow";
const button = "lt-button lt-secondary";

export function EmployerInsightsModule({ view }: { view: View }) {
  const { meta } = useMvpWorkspace();
  const identity = useRef(meta ? { email: meta.userEmail, organisationId: meta.organisationId } : null);
  const mutation = usePinnedClientMutation(identity.current, "/api/levytate-employer-insights/export", (value) => decodeEvidenceDownload(value, identity.current?.organisationId), (response) => response.text());
  const [data, setData] = useState<EmployerIntelligenceResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedCampaignId, setSelectedCampaignId] = useState("");
  const [printing, setPrinting] = useState(false);
  const exporting = mutation.working;
  const [exportError, setExportError] = useState("");

  async function downloadEvidence() {
    if (mutation.locked) return;
    setExportError("");
    try {
      await mutation.execute({}, (text) => {
        const url = URL.createObjectURL(new Blob([text], { type: "application/json; charset=utf-8" }));
        const anchor = document.createElement("a");
        anchor.href = url; anchor.download = "levytate-employer-evidence-v1.json";
        document.body.appendChild(anchor); anchor.click(); anchor.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
        setExportError("");
      });
    } catch (failure) { setExportError(failure instanceof Error ? failure.message : "Evidence export could not be prepared."); }
  }

  async function load() {
    setLoading(true);
    setError("");
    setData(null);
    try {
      const response = await authenticatedClientFetch("/api/levytate-employer-insights", {}, identity.current ?? undefined);
      const payload = await response.json() as { intelligence?: EmployerIntelligenceResponse; message?: string };
      if (!response.ok || !payload.intelligence || payload.intelligence.organisation.id !== identity.current?.organisationId) throw new Error(payload.message || "Employer intelligence could not be loaded for this account. Reload to reconnect.");
      setData(payload.intelligence);
      setSelectedCampaignId((current) => current && payload.intelligence!.workforce.reports.some((item) => item.campaignId === current) ? current : payload.intelligence!.workforce.reports[0]?.campaignId ?? "");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Employer intelligence could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);
  useEffect(() => {
    if (!printing) return;
    document.body.classList.add("employer-intelligence-printing");
    const timer = window.setTimeout(() => window.print(), 0);
    const clear = () => { document.body.classList.remove("employer-intelligence-printing"); setPrinting(false); };
    window.addEventListener("afterprint", clear, { once: true });
    return () => { window.clearTimeout(timer); window.removeEventListener("afterprint", clear); document.body.classList.remove("employer-intelligence-printing"); };
  }, [printing]);

  if (loading) return <LoadingState />;
  if (error || !data) return <ErrorState message={error || "Employer intelligence is unavailable."} onRetry={() => void load()} />;
  const selected = data.workforce.reports.find((item) => item.campaignId === selectedCampaignId) ?? data.workforce.reports[0] ?? null;

  return <div className="space-y-4"><ClientMutationRecovery mutation={mutation}/><fieldset disabled={mutation.locked} className="min-w-0 border-0 p-0"><div className="space-y-5" data-testid={`employer-insights-${view}`}>
    <section className={`${panel} overflow-hidden`}>
      <div className="lt-insight-heading px-5 py-5 sm:px-7">
        <div className="flex flex-col gap-3">
          <div className="max-w-3xl">
            <p className="lt-eyebrow">Employer intelligence · {data.organisation.name}</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-[-0.025em] sm:text-[1.8rem]">{view === "overview" ? "Operating brief" : "Workforce development brief"}</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-lt-muted">{view === "overview" ? "A factual view of current position, material exceptions and the next authorised actions." : "Campaign-pinned workforce evidence, reported conditions and proportionate development priorities."}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 border-t border-lt-border pt-4">
            <span className="mr-auto inline-flex min-h-10 items-center gap-2 text-sm text-lt-muted"><CalendarClock size={14} aria-hidden="true" />Reported {dateTime(data.generatedAt)}</span>
            {view === "overview" ? <button type="button" onClick={() => setPrinting(true)} className="lt-button lt-primary"><Printer size={14} aria-hidden="true" />Print executive report</button> : null}
            <button type="button" disabled={exporting} onClick={() => void downloadEvidence()} className={`${button} disabled:cursor-wait disabled:opacity-60`}><Download size={14} aria-hidden="true" />{exporting ? "Preparing evidence…" : "Download aggregate evidence"}</button>
            <button type="button" onClick={() => void load()} className={button}><RefreshCw size={14} aria-hidden="true" />Refresh sources</button>
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 px-5 py-3 text-xs text-lt-muted sm:px-7">
        <span className="inline-flex items-center gap-1.5"><ShieldCheck size={14} className="text-lt-accent" aria-hidden="true" />Organisation-scoped</span>
        <span>Source timestamps and limitations are shown with the evidence.</span>
        <a href="#metric-definitions" className="font-semibold text-lt-accent hover:underline">View definitions</a>
      </div>
    </section>

    {exportError ? <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{exportError} Your current report remains available. Retry the download after reconnecting if needed.</p> : null}

    {meta?.liftEnabled ? <section className={`${panel} flex flex-col gap-3 border-[#159b8f]/20 bg-[#f4faf7] p-5 sm:flex-row sm:items-center sm:justify-between`}><div><p className={eyebrow}>LevyTate Lift</p><h3 className="mt-1 text-base font-semibold text-lt-ink">Continue from evidence to opportunity and proof</h3><p className="mt-1 text-xs leading-5 text-lt-muted">Lift evidence remains separate from historical assessment scores and workforce aggregates.</p></div><a className={`${button} shrink-0`} href="/levytate/app?module=Assessments">Open Lift <ArrowRight size={14} aria-hidden="true"/></a></section> : null}

    {view === "overview"
      ? <Overview intelligence={data} selectedCampaign={selected} />
      : <Workforce intelligence={data} selected={selected} selectedCampaignId={selectedCampaignId} onSelect={setSelectedCampaignId} />}

    <Definitions intelligence={data} />
    {printing ? <ExecutivePrintReport intelligence={data} campaign={selected} /> : null}
  </div></fieldset></div>;
}

function Overview({ intelligence, selectedCampaign }: { intelligence: EmployerIntelligenceResponse; selectedCampaign: WorkforceIntelligenceReport | null }) {
  const finance = intelligence.finance;
  return <>
    <section aria-labelledby="current-position-heading">
      <div className="mb-3 flex items-end justify-between gap-3"><div><p className={eyebrow}>Current position</p><h3 id="current-position-heading" className="mt-1 text-lg font-semibold tracking-[-0.02em] text-lt-ink">The position at a glance</h3></div><p className="hidden text-xs text-lt-muted sm:block">Based on recorded evidence</p></div>
      <div className="lt-panel lt-insight-rail" data-testid="insight-metric-rail"><div className="lt-insight-metrics">
        {intelligence.overview.signals.map(signal=><article key={signal.metricId} className="lt-insight-metric" data-testid="insight-metric">
          <div className="lt-insight-metric-label" data-testid="insight-metric-label"><p>{signal.label}</p>{signal.availability==="available"?<CheckCircle2 size={15} className="shrink-0 text-lt-accent" aria-label="Available"/>:<TriangleAlert size={15} className="shrink-0 text-[#9a6a00]" aria-label="Unavailable"/>}</div>
          <p className="lt-insight-metric-value" data-testid="insight-metric-value">{signal.value??"—"}</p>
          <p className="lt-insight-metric-detail" data-testid="insight-metric-detail">{signal.detail}</p>
          <p className="lt-insight-metric-evidence" data-testid="insight-metric-evidence">{signal.evidenceAt?`Evidence ${dateTime(signal.evidenceAt)}`:"Evidence timestamp unavailable"}</p>
        </article>)}
      </div></div>
    </section>

    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(19rem,.85fr)]">
      <section className={`${panel} p-5 sm:p-6`} aria-labelledby="priorities-heading"><div className="flex items-center justify-between gap-3"><div><p className={eyebrow}>Priorities</p><h3 id="priorities-heading" className="mt-1 text-lg font-semibold text-lt-ink">What needs attention next</h3></div><span className="shrink-0 text-xs font-medium tabular-nums text-lt-muted">{intelligence.overview.priorities.length} priorities</span></div>{intelligence.overview.priorities.length ? <ol className="mt-5 divide-y divide-[#102c3d]/[0.07]">{intelligence.overview.priorities.map((priority, index) => <PriorityRow key={priority.id} priority={priority} index={index} />)}</ol> : <div className="mt-4 border-t border-lt-border pt-4"><p className="text-sm font-semibold text-lt-accent">No current decision or operational priority</p><p className="mt-1 text-xs leading-5 text-lt-muted">The authorised records did not identify an outstanding priority at the reporting time.</p></div>}</section>
      <section className={`${panel} p-5 sm:p-6`} aria-labelledby="evidence-heading"><p className={eyebrow}>Evidence coverage</p><h3 id="evidence-heading" className="mt-1 text-lg font-semibold text-lt-ink">What this brief can support</h3><div className="mt-4 space-y-3">{intelligence.overview.sourceStatus.map((source) => <div key={source.source} className="flex gap-3 border-b border-lt-border py-3 last:border-0"><span className={`mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full ${source.available ? "bg-[#159b8f]" : "bg-[#d2983f]"}`} aria-hidden="true"/><div><p className="text-sm font-semibold text-lt-ink">{source.source} <span className="ml-1 text-xs font-medium text-lt-muted">· {source.available?"Available":"Unavailable"}</span></p><p className="mt-1 text-xs leading-5 text-lt-muted">{source.message}</p></div></div>)}</div></section>
    </div>

    <section className="grid gap-5 lg:grid-cols-2">
      <article className={`${panel} p-5 sm:p-6`}><p className={eyebrow}>Workforce development</p><h3 className="mt-1 text-lg font-semibold text-lt-ink">{selectedCampaign ? selectedCampaign.campaignTitle : "No eligible campaign"}</h3>{selectedCampaign ? <><p className="mt-3 text-sm leading-6 text-lt-muted">{selectedCampaign.suppressed ? selectedCampaign.limitation : selectedCampaign.priorities[0]?.finding || "Comparable evidence is available for detailed review."}</p><div className="mt-4 flex flex-wrap gap-2 text-xs"><span className="rounded-full bg-[#edf7f3] px-3 py-1.5 font-semibold text-lt-accent">{selectedCampaign.submitted} submitted</span><span className="rounded-full bg-[#f4f5f2] px-3 py-1.5 text-lt-muted">{selectedCampaign.nonResponse} non-response</span><span className="rounded-full bg-[#f4f5f2] px-3 py-1.5 text-lt-muted">{selectedCampaign.frameworkTitle}</span></div><a href="/levytate/app?module=Workforce%20Development" className={`${button} mt-5`}>Open workforce evidence <ArrowRight size={14} aria-hidden="true" /></a></> : <p className="mt-3 text-sm leading-6 text-lt-muted">Create and run an employer assessment campaign before drawing workforce-development conclusions.</p>}</article>
      <article className={`${panel} p-5 sm:p-6`}><p className={eyebrow}>Levy financial position</p><h3 className="mt-1 text-lg font-semibold text-lt-ink">{finance.currentBalancePence === null ? "Balance unavailable" : formatGbp(finance.currentBalancePence)}</h3><p className="mt-3 text-sm leading-6 text-lt-muted">{finance.importedPeriod ? `Persisted imported transaction history covers ${date(finance.importedPeriod.from)} to ${date(finance.importedPeriod.to)}.` : "No imported DAS reporting period is available."} {finance.latestImportAt ? `Latest import ${dateTime(finance.latestImportAt)}.` : ""} {finance.balanceEvidenceAt ? `Balance evidence dated ${date(finance.balanceEvidenceAt)}.` : ""}</p><div className="mt-4 grid gap-2 sm:grid-cols-3"><MiniMetric label="Imported contributions" value={moneyOrDash(finance.contributionsPence)}/><MiniMetric label="Recorded spend" value={moneyOrDash(finance.apprenticeshipSpendPence)}/><MiniMetric label="Recorded expiry" value={moneyOrDash(finance.expiredPence)}/></div><a href="/levytate/app?module=Finance" className={`${button} mt-5`}>Open levy evidence <ArrowRight size={14} aria-hidden="true" /></a></article>
    </section>
  </>;
}

function Workforce({ intelligence, selected, selectedCampaignId, onSelect }: { intelligence: EmployerIntelligenceResponse; selected: WorkforceIntelligenceReport | null; selectedCampaignId: string; onSelect: (id: string) => void }) {
  if (!intelligence.workforce.sourceAvailable) return <EmptyState title="Workforce evidence is unavailable" copy={intelligence.workforce.message}/>;
  if (!selected) return <EmptyState title="No employer campaign evidence yet" copy="Run an employer assessment campaign to establish a recorded audience, participation evidence and privacy-safe aggregate findings."/>;
  return <>
    <section className={`${panel} p-5 sm:p-6`}><div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,.45fr)] lg:items-end"><div><p className={eyebrow}>Selected evidence population</p><h3 className="mt-1 text-xl font-semibold tracking-[-0.025em] text-lt-ink">{selected.campaignTitle}</h3><p className="mt-2 max-w-3xl text-sm leading-6 text-lt-muted">{selected.campaignPurpose}</p></div><label className="text-xs font-semibold text-lt-muted">Campaign<select value={selectedCampaignId} onChange={(event) => onSelect(event.target.value)} className="lt-control mt-1.5 min-h-11 w-full px-3 text-sm">{intelligence.workforce.reports.map((report) => <option value={report.campaignId} key={report.campaignId}>{report.campaignTitle} · {report.frameworkTitle}</option>)}</select></label></div><div className="mt-5 grid gap-2 sm:grid-cols-4"><MiniMetric label="Invited" value={selected.invited}/><MiniMetric label="Submitted" value={selected.submitted}/><MiniMetric label="Non-response" value={selected.nonResponse}/><MiniMetric label="Participation" value={`${selected.participationPercent}%`}/></div><div className="mt-4 flex flex-wrap gap-2 text-xs text-lt-muted"><span className="rounded-full bg-[#edf7f3] px-3 py-1.5">Framework: {selected.frameworkTitle}</span><span className="rounded-full bg-[#f4f5f2] px-3 py-1.5">Version: {selected.questionnaireVersion}</span><span className="rounded-full bg-[#f4f5f2] px-3 py-1.5">Campaign: {selected.campaignStatus}</span></div><p className="mt-4 flex gap-2 rounded-xl bg-[#f7f8f5] p-3 text-xs leading-5 text-lt-muted"><Info size={15} className="mt-0.5 shrink-0 text-lt-accent" aria-hidden="true" />{selected.definition} Non-response is not capability evidence.</p></section>

    {selected.suppressed ? <section className={`${panel} border-[#d2983f]/20 bg-[#fffaf0] p-6`}><p className={eyebrow}>Privacy threshold</p><h3 className="mt-1 text-lg font-semibold text-lt-ink">Aggregate findings are suppressed</h3><p className="mt-2 max-w-3xl text-sm leading-6 text-lt-muted">{selected.limitation} Participation remains visible, but capability, barrier, workplace-use, cohort and department findings are withheld consistently across screen, print and CSV. {selected.disclosure.residualRisk}</p></section> : <>
      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,.85fr)]">
        <article className={`${panel} p-5 sm:p-6`}><p className={eyebrow}>Capability evidence</p><h3 className="mt-1 text-lg font-semibold text-lt-ink">Six evidence dimensions</h3><p className="mt-2 text-xs leading-5 text-lt-muted">Whole-number aggregate indicators from available submitted evidence. These are not competence scores.</p><div className="mt-5 space-y-4">{selected.dimensions.map((dimension) => <DimensionBar key={dimension.id} {...dimension}/>)}</div></article>
        <article className={`${panel} p-5 sm:p-6`}><p className={eyebrow}>Development profiles</p><h3 className="mt-1 text-lg font-semibold text-lt-ink">Where evidence is concentrated</h3><div className="mt-5 space-y-3">{selected.profiles.map((profile) => <CountBar key={profile.label} label={profile.label} count={profile.count} total={selected.submitted}/>)}</div><p className="mt-5 text-xs leading-5 text-lt-muted">Profiles guide development discussion. They do not classify suitability or determine an apprenticeship decision.</p></article>
      </section>
      <section className="grid gap-5 lg:grid-cols-3"><EvidenceList title="Reported barriers" copy="Workplace conditions, not assumed personal deficits." items={selected.barriers}/><EvidenceList title="Workplace use patterns" copy="Reported patterns that may support practical development." items={selected.useCases}/><EvidenceList title="Development cohorts" copy="Indicative groups for proportionate support." items={selected.cohorts}/></section>
      <DepartmentEvidence report={selected}/>
      <section className={`${panel} p-5 sm:p-6`}><p className={eyebrow}>Proposed priorities</p><h3 className="mt-1 text-lg font-semibold text-lt-ink">Evidence → implication → next action</h3><div className="mt-5 grid gap-4 xl:grid-cols-3">{selected.priorities.map((priority, index) => <article key={priority.id} className="min-w-0 border-l-2 border-lt-border pl-4 py-2"><span className="grid h-7 w-7 place-items-center rounded-lg bg-[#102c3d] text-xs font-bold text-white">{index + 1}</span><h4 className="mt-3 text-sm font-semibold leading-5 text-lt-ink">{priority.finding}</h4><dl className="mt-3 space-y-2 text-xs leading-5"><div><dt className="font-semibold text-lt-accent">Evidence</dt><dd className="text-lt-muted">{priority.evidence}</dd></div><div><dt className="font-semibold text-lt-accent">Suggested intervention</dt><dd className="text-lt-muted">{priority.intervention}</dd></div><div><dt className="font-semibold text-lt-accent">Why it may help</dt><dd className="text-lt-muted">{priority.rationale}</dd></div><div><dt className="font-semibold text-lt-accent">Owner / review</dt><dd className="text-lt-muted">{priority.owner} · {priority.review}</dd></div></dl><a className={`${button} mt-4 w-full`} href={priority.href}>Open assessment workflow <ArrowRight size={14} aria-hidden="true" /></a></article>)}</div></section>
    </>}
  </>;
}

function PriorityRow({ priority, index }: { priority: IntelligencePriority; index: number }) { return <li className="grid gap-3 py-4 first:pt-0 last:pb-0 sm:grid-cols-[2rem_minmax(0,1fr)_auto] sm:items-start"><span className="grid h-8 w-8 place-items-center rounded-lg bg-[#102c3d] text-xs font-semibold text-white">{index + 1}</span><div><div className="flex flex-wrap items-center gap-2"><h4 className="text-sm font-semibold text-lt-ink">{priority.title}</h4><span className={`rounded-full px-2 py-0.5 text-xs font-bold uppercase tracking-wide ${priority.level === "Critical" || priority.level === "High" ? "bg-[#fff0f1] text-lt-risk" : "bg-[#f4f5f2] text-lt-muted"}`}>{priority.level}</span></div><p className="mt-1 text-sm leading-6 text-lt-muted"><b className="font-semibold text-lt-secondary">{priority.subject}</b> · {priority.why}</p><p className="mt-1 text-xs text-lt-muted">Owner: {priority.owner} · Next: {priority.nextStep}</p></div><a href={priority.href} className={`${button} w-full sm:w-auto`}>Open action <ArrowRight size={14} aria-hidden="true" /></a></li>; }
function DimensionBar({ label, value }: { label: string; value: number }) { return <div><div className="flex justify-between gap-3 text-xs"><span className="font-medium text-lt-secondary">{label}</span><b className="text-lt-ink">{value}</b></div><div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-[#eef1ed]" role="img" aria-label={`${label}: ${value} out of 100`}><div className="h-full rounded-full bg-lt-accent" style={{ width: `${Math.max(0, Math.min(100, value))}%` }}/></div></div>; }
function CountBar({ label, count, total }: { label: string; count: number; total: number }) { const percent = total ? Math.round(count / total * 100) : 0; return <div><div className="flex justify-between gap-3 text-xs"><span className="font-medium text-lt-secondary">{label}</span><b className="text-lt-ink">{count}</b></div><div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[#eef1ed]"><div className="h-full rounded-full bg-[#102c3d]" style={{ width: `${percent}%` }}/></div></div>; }
function EvidenceList({ title, copy, items }: { title: string; copy: string; items: Array<{ label: string; count: number }> }) { return <article className={`${panel} p-5`}><h3 className="text-sm font-semibold text-lt-ink">{title}</h3><p className="mt-1 text-xs leading-5 text-lt-muted">{copy}</p><ol className="mt-4 space-y-2">{items.length ? items.slice(0, 6).map((item) => <li key={item.label} className="flex items-start justify-between gap-3 rounded-lg bg-[#f7f8f5] px-3 py-2.5 text-xs"><span className="leading-5 text-lt-muted">{item.label}</span><b className="shrink-0 text-lt-accent">{item.count}</b></li>) : <li className="text-xs text-lt-muted">No comparable evidence available.</li>}</ol></article>; }
function DepartmentEvidence({ report }: { report: WorkforceIntelligenceReport }) { return <section className={`${panel} overflow-hidden`}><div className="p-5 sm:p-6"><p className={eyebrow}>Department comparison</p><h3 className="mt-1 text-lg font-semibold text-lt-ink">Comparable evidence only</h3><p className="mt-2 text-xs leading-5 text-lt-muted">A department is displayed only when its own submitted population meets the five-response threshold. Suppressed groups are not combined into a visible complement.</p></div><div className="overflow-x-auto"><table className="min-w-[720px] w-full border-collapse text-left text-xs"><thead><tr className="border-y border-[#102c3d]/[0.07] bg-[#f7f8f5] text-lt-muted"><th className="px-5 py-3 font-semibold">Department</th><th className="px-4 py-3 font-semibold">Invited</th><th className="px-4 py-3 font-semibold">Submitted</th><th className="px-4 py-3 font-semibold">Participation</th><th className="px-4 py-3 font-semibold">Evidence</th></tr></thead><tbody>{report.groups.map((group) => <tr key={group.department} className="border-b border-[#102c3d]/[0.06] last:border-0"><td className="px-5 py-4 font-semibold text-lt-ink">{group.department}</td><td className="px-4 py-4 text-lt-muted">{group.invited}</td><td className="px-4 py-4 text-lt-muted">{group.submitted}</td><td className="px-4 py-4 text-lt-muted">{group.participationPercent}%</td><td className="px-4 py-4 text-lt-muted">{group.suppressed ? `Suppressed below ${report.suppressionThreshold}` : [...group.recurringNeeds.slice(0, 2).map((item) => item.label), ...group.blockers.slice(0, 1).map((item) => item.label)].join(" · ") || "Comparable evidence available"}</td></tr>)}</tbody></table></div></section>; }

function Definitions({ intelligence }: { intelligence: EmployerIntelligenceResponse }) { return <details id="metric-definitions" className={`${panel} group p-5`}><summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-lt-ink">Definitions, coverage and limitations <span className="text-xs font-normal text-lt-muted">{intelligence.metricCatalogue.length} governed measures</span></summary><div className="mt-5 overflow-x-auto"><table className="min-w-[920px] w-full text-left text-xs"><thead><tr className="border-y border-[#102c3d]/[0.08] bg-[#f7f8f5] text-lt-muted"><th className="px-3 py-3">Measure</th><th className="px-3 py-3">Source and calculation</th><th className="px-3 py-3">Period / timestamp</th><th className="px-3 py-3">Missing data and privacy</th></tr></thead><tbody>{intelligence.metricCatalogue.map((metric) => <tr key={metric.id} className="border-b border-[#102c3d]/[0.06] align-top"><td className="px-3 py-4 font-semibold text-lt-ink">{metric.displayLabel}</td><td className="px-3 py-4 leading-5 text-lt-muted">{metric.source}<br/>{metric.calculation}<br/><span className="text-lt-muted">Population: {metric.population}</span></td><td className="px-3 py-4 leading-5 text-lt-muted">{metric.reportingPeriod}<br/>{metric.timestamp}</td><td className="px-3 py-4 leading-5 text-lt-muted">{metric.missingData}<br/>{metric.privacy}</td></tr>)}</tbody></table></div><ul className="mt-5 grid gap-2 sm:grid-cols-2">{intelligence.limitations.map((item) => <li key={item} className="flex gap-2 rounded-xl bg-[#f7f8f5] p-3 text-xs leading-5 text-lt-muted"><Info size={14} className="mt-0.5 shrink-0 text-lt-accent" aria-hidden="true"/>{item}</li>)}</ul></details>; }

function ExecutivePrintReport({ intelligence, campaign }: { intelligence: EmployerIntelligenceResponse; campaign: WorkforceIntelligenceReport | null }) {
  if (typeof document === "undefined") return null;
  return createPortal(<EmployerExecutiveReport report={buildEmployerExecutiveReportContract(intelligence, campaign)} />, document.body);
}

function MiniMetric({ label, value }: { label: string; value: string | number }) { return <div className="lt-record-fact p-3"><b className="block break-words text-lg font-semibold tabular-nums text-lt-ink">{value}</b><span className="mt-1 block text-xs font-semibold uppercase tracking-wide text-lt-muted">{label}</span></div>; }
function EmptyState({ title, copy }: { title: string; copy: string }) { return <section className={`${panel} p-7`}><BarChart3 size={22} className="text-lt-accent" aria-hidden="true"/><h3 className="mt-4 text-lg font-semibold text-lt-ink">{title}</h3><p className="mt-2 max-w-2xl text-sm leading-6 text-lt-muted">{copy}</p></section>; }
function LoadingState() { return <div className="grid gap-4" aria-live="polite" aria-label="Loading employer intelligence"><div className="h-48 animate-pulse rounded-2xl bg-[#e8ede8]"/><div className="grid gap-3 sm:grid-cols-3"><div className="h-36 animate-pulse rounded-2xl bg-white"/><div className="h-36 animate-pulse rounded-2xl bg-white"/><div className="h-36 animate-pulse rounded-2xl bg-white"/></div></div>; }
function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) { return <section className={`${panel} p-7`} role="alert"><TriangleAlert size={22} className="text-lt-risk" aria-hidden="true"/><h3 className="mt-3 text-lg font-semibold text-lt-ink">Employer intelligence could not be loaded</h3><p className="mt-2 text-sm text-lt-muted">{message} Historical results are not displayed as current.</p><button type="button" className={`${button} mt-5`} onClick={onRetry}><RefreshCw size={14} aria-hidden="true"/>Try again</button></section>; }
function moneyOrDash(value: number | null) { return value === null ? "Unavailable" : formatGbp(value); }
function date(value: string) { const input = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00Z` : value; return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(input)); }
function dateTime(value: string) { return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/London" }).format(new Date(value)); }
