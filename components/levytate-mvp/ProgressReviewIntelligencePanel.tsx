"use client";

import { ArrowRight, CheckCircle2, Eye, Lightbulb, ShieldAlert, TrendingDown, X } from "lucide-react";
import { useMemo, useState } from "react";
import { SemanticStatus, type OperationalTone } from "@/components/levytate-mvp/OperationalVisuals";
import { progressReviewDemoScenarios } from "@/lib/levytate/intelligence/demo-progress-review";
import { progressReviewDemoSignals } from "@/lib/levytate/intelligence/demo-progress-review-signals";
import { acceptSignalAsOperationalAction, type IntelligenceDismissalReason, type IntelligenceSignal, type IntelligenceSignalStatus } from "@/lib/levytate/intelligence/progress-review";

const dismissalReasons: IntelligenceDismissalReason[] = ["Already resolved", "Incorrect interpretation", "No action required", "Planned intervention already exists", "Other"];
const scenarioNames = new Map(progressReviewDemoScenarios.map((input) => [input.learnerRecordId, input.learnerLabel ?? "Fictional learner"]));
type SignalState = { status: IntelligenceSignalStatus; dismissalReason?: IntelligenceDismissalReason; linkedActionId?: string };

export function ProgressReviewIntelligencePanel({ enabled, onSignalContext }: { enabled: boolean; onSignalContext?: (signal: IntelligenceSignal | null) => void }) {
  const [states, setStates] = useState<Record<string, SignalState>>({});
  const [selected, setSelected] = useState<IntelligenceSignal | null>(null);
  const [dismissalReason, setDismissalReason] = useState<IntelligenceDismissalReason>("No action required");
  const [notice, setNotice] = useState("");
  const signals = useMemo(() => progressReviewDemoSignals.filter((signal) => !["dismissed", "resolved"].includes(states[signal.id]?.status ?? signal.status)).slice(0, 4), [states]);
  if (!enabled) return null;

  const update = (signal: IntelligenceSignal, state: SignalState) => { setStates((current) => ({ ...current, [signal.id]: state })); setNotice(""); };
  const open = (signal: IntelligenceSignal) => { setSelected(signal); setNotice(""); };
  const close = () => { setSelected(null); setNotice(""); };
  const accept = (signal: IntelligenceSignal) => {
    const action = acceptSignalAsOperationalAction(signal);
    update(signal, { status: "accepted", linkedActionId: action.id });
    onSignalContext?.(signal);
    setNotice("Action draft created for review.");
  };
  const primary = signals[0];

  return <section className="border-l-2 border-[#159b8f] bg-[#f4fbf8] px-5 py-5 sm:px-6" aria-labelledby="levytate-intelligence-title" data-testid="progress-review-intelligence">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div><p className="text-[10px] font-semibold uppercase tracking-[.14em] text-[#0b6f63]">LevyTate Intelligence</p><h2 id="levytate-intelligence-title" className="mt-1 text-xl font-semibold tracking-[-.02em] text-[#102c3d]">LevyTate found {signals.length} things worth your attention</h2></div>
      <p className="text-xs font-semibold text-[#102c3d]/[0.48]">Human review required</p>
    </div>

    {primary ? <article className="mt-5 grid gap-4 border-y border-[#102c3d]/[.08] bg-white px-4 py-4 lg:grid-cols-[minmax(0,1fr)_minmax(240px,.65fr)_auto] lg:items-center">
      <div className="min-w-0"><SemanticStatus label={`${primary.priority} priority · ${categoryLabel(primary.category)}`} tone={categoryTone(primary.category)} /><h3 className="mt-2 text-lg font-semibold text-[#102c3d]">{primary.title}</h3><p className="mt-1 text-sm text-[#102c3d]/[0.55]">{scenarioNames.get(primary.learnerRecordId ?? "")} · {reviewCount(primary)} review{reviewCount(primary) === 1 ? "" : "s"} · {primary.evidence.length} evidence items</p></div>
      <SignalEvidenceSummary signal={primary} />
      <button type="button" onClick={() => open(primary)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[#102c3d] px-4 text-xs font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#159b8f]">Review evidence <ArrowRight size={13} aria-hidden="true" /></button>
    </article> : null}

    {signals.length > 1 ? <details className="mt-2"><summary className="min-h-11 cursor-pointer py-3 text-xs font-semibold text-[#0b6f63]">{signals.length - 1} more signal{signals.length === 2 ? "" : "s"}</summary><div className="grid gap-px bg-[#102c3d]/[.07] md:grid-cols-3">{signals.slice(1).map((signal) => <article key={signal.id} className="flex min-w-0 flex-col bg-[#f4fbf8] px-3 py-3"><SemanticStatus label={signal.priority} tone={categoryTone(signal.category)} /><h3 className="mt-2 text-sm font-semibold leading-5 text-[#102c3d]">{signal.title}</h3><p className="mt-1 text-xs text-[#102c3d]/[0.48]">{signal.evidence.length} evidence items</p><button type="button" onClick={() => open(signal)} className="mt-auto min-h-11 self-start text-xs font-semibold text-[#0b6f63] hover:text-[#102c3d]">Review evidence →</button></article>)}</div></details> : null}
    {!signals.length ? <p className="mt-5 bg-white p-5 text-sm text-[#102c3d]/[0.56]">No new signals require review.</p> : null}

    {selected ? <div className="fixed inset-0 z-[60] flex justify-end bg-[#102c3d]/[0.25]" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}><aside role="dialog" aria-modal="true" aria-labelledby="signal-detail-title" className="h-full w-full max-w-xl overflow-y-auto bg-white p-5 shadow-[-20px_0_55px_rgba(16,44,61,.18)] sm:p-7"><div className="flex items-start justify-between gap-4"><div><p className="text-[10px] font-semibold uppercase tracking-[.14em] text-[#0b6f63]">What changed</p><h3 id="signal-detail-title" className="mt-2 text-2xl font-semibold tracking-[-.025em] text-[#102c3d]">{selected.title}</h3></div><button type="button" onClick={close} aria-label="Close signal review" className="grid h-11 w-11 place-items-center rounded-lg text-[#102c3d]/[0.55] hover:bg-[#f3f7f5]"><X size={18} /></button></div>
      <div className="mt-5 border-y border-[#102c3d]/[.08] py-4"><SignalEvidenceSummary signal={selected} /></div>
      <p className="mt-4 text-sm leading-6 text-[#102c3d]/[0.62]">{selected.summary}</p>
      <dl className="mt-5 grid grid-cols-2 gap-3 bg-[#f4f7f5] p-4 text-xs"><div><dt className="text-[#102c3d]/[0.42]">Confidence</dt><dd className="mt-1 font-semibold text-[#102c3d]">{selected.confidence}</dd></div><div><dt className="text-[#102c3d]/[0.42]">Suggested owner</dt><dd className="mt-1 font-semibold text-[#102c3d]">{selected.suggestedOwnerType ?? "Apprenticeship Lead"}</dd></div></dl>
      <section className="mt-6"><h4 className="flex items-center gap-2 text-sm font-semibold text-[#102c3d]"><Eye size={15} aria-hidden="true" />Evidence</h4><div className="mt-3 grid gap-2">{selected.evidence.map((item) => <article key={`${item.sourceType}:${item.sourceId}`} className="border-l-2 border-[#4f7b95] bg-[#f8fbfa] p-3"><p className="text-xs font-semibold text-[#102c3d]">{item.label} · {formatDate(item.sourceDate)}</p>{item.excerpt ? <p className="mt-2 text-sm leading-5 text-[#102c3d]/[0.58]">“{item.excerpt}”</p> : null}{item.metric ? <p className="mt-2 text-sm font-semibold text-[#a7354a]">{item.metric.label}: {item.metric.value}</p> : null}</article>)}</div></section>
      <section className="mt-6 border-l-2 border-[#159b8f] bg-[#f4fbf8] p-4"><h4 className="flex items-center gap-2 text-sm font-semibold text-[#102c3d]"><Lightbulb size={15} aria-hidden="true" />What next</h4><p className="mt-2 text-sm leading-6 text-[#102c3d]/[0.62]">{selected.recommendedAction}</p></section>
      {notice ? <p className="mt-4 bg-[#edf7f3] p-3 text-sm font-semibold text-[#0b6f63]">{notice}</p> : null}
      <div className="mt-6 grid gap-3 border-t border-[#102c3d]/[.08] pt-5"><div className="flex flex-wrap gap-2"><button type="button" onClick={() => accept(selected)} disabled={selected.confidence === "Low"} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[#0b6f63] px-4 text-xs font-semibold text-white disabled:opacity-40"><CheckCircle2 size={14} aria-hidden="true" />Accept action</button><button type="button" onClick={() => { update(selected, { status: "acknowledged" }); setNotice("Signal acknowledged for human follow-up."); }} className="min-h-11 rounded-full border border-[#102c3d]/[0.10] px-4 text-xs font-semibold text-[#102c3d]">Acknowledge</button></div><div className="flex flex-col gap-2 bg-[#fff8df] p-3 sm:flex-row"><label className="sr-only" htmlFor="signal-dismissal-reason">Dismissal reason</label><select id="signal-dismissal-reason" value={dismissalReason} onChange={(event) => setDismissalReason(event.target.value as IntelligenceDismissalReason)} className="min-h-11 flex-1 rounded-lg border border-[#102c3d]/[0.10] bg-white px-3 text-xs text-[#102c3d]">{dismissalReasons.map((reason) => <option key={reason}>{reason}</option>)}</select><button type="button" onClick={() => { update(selected, { status: "dismissed", dismissalReason }); close(); }} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-4 text-xs font-semibold text-[#765b00]"><ShieldAlert size={14} aria-hidden="true" />Dismiss</button></div></div>
    </aside></div> : null}
  </section>;
}

function SignalEvidenceSummary({ signal }: { signal: IntelligenceSignal }) {
  const trend = progressTrend(signal);
  const latest = progressValues(signal)[0];
  if (trend.length) return <div><div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[.12em] text-[#a7354a]"><TrendingDown size={13} aria-hidden="true" />Progress trend</div><p className="mt-2 text-xl font-semibold tabular-nums tracking-[-.025em] text-[#102c3d]">{trend.map(formatSigned).join(" → ")}</p>{latest ? <p className="mt-1 text-xs text-[#102c3d]/[0.48]">Target {latest.target}% · Actual {latest.actual}% · Variance {formatSigned(latest.variance)}</p> : null}</div>;
  const reviews = signal.evidence.filter((item) => item.sourceType.includes("review"));
  return <div><p className="text-[10px] font-semibold uppercase tracking-[.12em] text-[#102c3d]/[0.42]">Evidence pattern</p><div className="mt-3 flex items-center" aria-label={`${reviews.length} review evidence items`}>{reviews.map((item, index) => <span key={item.sourceId} className="contents"><span className={`h-3 w-3 rounded-full ${index ? "bg-[#d6a62d]" : "bg-[#4f7b95]"}`} title={formatDate(item.sourceDate)} />{index < reviews.length - 1 ? <span className="h-px w-8 bg-[#cfd8d3]" /> : null}</span>)}</div><p className="mt-2 text-xs font-semibold text-[#102c3d]/[0.55]">{reviews.length || signal.evidence.length} consecutive evidence point{(reviews.length || signal.evidence.length) === 1 ? "" : "s"}</p></div>;
}

function progressValues(signal: IntelligenceSignal) {
  return signal.evidence.filter((item) => item.sourceType === "progress_update" && item.metric).map((item) => {
    const values = String(item.metric?.value ?? "").match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
    return { target: values[0], actual: values[1], variance: values[2] };
  }).filter((value) => value.target !== undefined && value.actual !== undefined && value.variance !== undefined);
}
function progressTrend(signal: IntelligenceSignal) { return progressValues(signal).map((value) => value.variance).reverse(); }
function reviewCount(signal: IntelligenceSignal) { return signal.evidence.filter((item) => item.sourceType.includes("review")).length; }
function formatSigned(value: number) { return `${value > 0 ? "+" : value < 0 ? "−" : ""}${Math.abs(value)}%`; }
function categoryTone(category: IntelligenceSignal["category"]): OperationalTone { if (category === "risk" || category === "action") return "risk"; if (category === "opportunity") return "healthy"; if (category === "quality") return "watch"; return "info"; }
function categoryLabel(category: IntelligenceSignal["category"]) { return category === "risk" ? "Risk" : category === "action" ? "Action" : category === "quality" ? "Data quality" : category === "opportunity" ? "Opportunity" : "Pattern"; }
function formatDate(value: string) { return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(new Date(value)); }
