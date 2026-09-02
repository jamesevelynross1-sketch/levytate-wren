"use client";

import { ExternalLink, RefreshCw, ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useMvpWorkspace } from "@/components/levytate-mvp/MvpWorkspaceStore";
import { intelligenceTopics, type IntelligenceTopic, type ProviderIntelligencePayload } from "@/lib/levytate/provider-intelligence/domain";
import { buildFairProviderFeed } from "@/lib/levytate/provider-intelligence/fair-distribution";

export function ProviderIntelligenceModule({ onOpenProvider }: { onOpenProvider?: (providerId: string) => void }) {
  const { data } = useMvpWorkspace();
  const [payload, setPayload] = useState<ProviderIntelligencePayload | null>(null);
  const [topic, setTopic] = useState<IntelligenceTopic>("All");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/levytate-provider-intelligence", { cache: "no-store" });
      const result = await response.json() as ProviderIntelligencePayload & { message?: string };
      if (!response.ok) throw new Error(result.message || "Provider Intelligence could not be loaded.");
      setPayload(result);
    } catch (cause) {
      setPayload(null);
      setError(cause instanceof Error ? cause.message : "Provider Intelligence could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const providerMap = useMemo(() => new Map(data.providers.filter((provider) => provider.status !== "Archived").map((provider) => [provider.providerId, provider])), [data.providers]);
  const eligible = (payload?.articles ?? []).filter((article) => providerMap.has(article.providerId));
  const feed = buildFairProviderFeed(eligible, { topic });
  const counts = {
    updates: eligible.length,
    providers: new Set(eligible.map((article) => article.providerId)).size,
    programmes: eligible.filter((article) => article.contentType === "Programme update").length,
    guides: eligible.filter((article) => article.contentType === "Employer guide").length,
    events: eligible.filter((article) => article.contentType === "Event").length,
    stories: eligible.filter((article) => article.contentType === "Employer story").length,
  };

  return (
    <section className="min-w-0 bg-[#f6f7f4]">
      <header className="mb-6 border-b border-[#102c3d]/[0.10] pb-5">
        <p className="text-[10px] font-bold uppercase tracking-[.2em] text-[#b94f64]">Provider intelligence</p>
        <h2 className="mt-2 text-3xl font-semibold tracking-[-.04em] text-[#102c3d]">The apprenticeship market, from the source</h2>
        <p className="mt-2 flex items-center gap-2 text-xs text-[#102c3d]/[0.45]"><RefreshCw size={13} />{payload?.refreshedAt ? `Updated ${formatDate(payload.refreshedAt)}` : loading ? "Loading current intelligence" : "Current source status unavailable"}</p>
      </header>

      {loading ? <IntelligenceState title="Loading Provider Intelligence" copy="Retrieving the latest persisted provider updates." /> : null}
      {!loading && error ? <IntelligenceState title="Provider Intelligence is temporarily unavailable" copy={error} action="Try again" onAction={() => void load()} /> : null}

      {!loading && payload ? <>
        {payload.stale ? <p className="mb-4 border-l-2 border-[#d6a62d] bg-[#fff8df] px-4 py-3 text-sm text-[#765b00]">Update pending. The most recent persisted provider articles remain available while sources refresh.</p> : null}
        <section className="grid gap-5 border border-[#102c3d]/[0.10] bg-[#102c3d] p-6 text-white md:grid-cols-[1.4fr_1fr]">
          <div><p className="text-[10px] font-bold uppercase tracking-[.18em] text-[#82d7c8]">Morning brief</p><h3 className="mt-3 text-2xl font-semibold">{counts.updates} verified updates across {counts.providers} providers</h3></div>
          <dl className="grid grid-cols-2 gap-4">{[[counts.programmes, "programme updates"], [counts.guides, "employer guides"], [counts.providers, "providers covered"], [payload.sources.filter((source) => source.status === "needs-review").length, "sources to review"]].map(([value, label]) => <div key={String(label)} className="border-l border-white/[0.20] pl-4"><dt className="text-2xl font-semibold">{value}</dt><dd className="text-xs text-white/[0.55]">{label}</dd></div>)}</dl>
        </section>
        <section className="mt-4 grid gap-3 border border-[#102c3d]/[0.10] bg-white p-4 sm:grid-cols-4" aria-label="Market Watch">{[[counts.programmes, "Programme"], [counts.events, "Events"], [counts.stories, "Employer stories"], [counts.guides, "Guides"]].map(([value, label]) => <div key={String(label)}><p className="text-xl font-semibold text-[#102c3d]">{value}</p><p className="text-[10px] font-bold uppercase tracking-[.12em] text-[#102c3d]/[0.45]">{label}</p></div>)}</section>
        <div className="mt-6 flex gap-1 overflow-x-auto border-y border-[#102c3d]/[0.10] py-2">{intelligenceTopics.map((item) => <button key={item} onClick={() => setTopic(item)} className={`min-h-11 shrink-0 border-b-2 px-3 text-xs font-semibold ${topic === item ? "border-[#b94f64] text-[#102c3d]" : "border-transparent text-[#102c3d]/[0.45]"}`}>{item}</button>)}</div>
        <div className="mt-5 grid gap-5 md:grid-cols-2">{feed.map((article) => {
          const provider = providerMap.get(article.providerId)!;
          return <article key={article.fingerprint} className="flex flex-col border border-[#102c3d]/[0.10] bg-white p-5 shadow-[0_12px_28px_rgba(16,44,61,.04)]"><button onClick={() => onOpenProvider?.(article.providerId)} className="min-h-11 text-left"><p className="text-xs font-semibold text-[#0b776e]">{provider.providerName}</p><p className="mt-1 text-[10px] text-[#102c3d]/[0.42]">{provider.providerType} · {article.publishedAt ? formatDate(article.publishedAt) : "Publication date unavailable"}</p></button><p className="mt-5 text-[10px] font-bold uppercase tracking-[.15em] text-[#b94f64]">{article.contentType}</p><h3 className="mt-2 text-xl font-semibold leading-tight tracking-[-.025em] text-[#102c3d]">{article.title}</h3><p className="mt-3 line-clamp-3 flex-1 text-sm leading-6 text-[#102c3d]/[0.60]">{article.excerpt}</p><div className="mt-5 flex flex-wrap gap-2">{article.topics.map((item) => <span key={item} className="bg-[#edf3f0] px-2 py-1 text-[10px] font-semibold text-[#0b776e]">{item}</span>)}</div><div className="mt-5 flex flex-wrap items-center gap-3 border-t border-[#102c3d]/[0.10] pt-4"><a href={article.canonicalUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-2 bg-[#102c3d] px-4 text-xs font-semibold text-white">Read original <ExternalLink size={13} /></a><button onClick={() => onOpenProvider?.(article.providerId)} className="min-h-11 text-xs font-semibold text-[#0b776e]">View provider</button></div></article>;
        })}</div>
        {!feed.length ? <IntelligenceState title="No verified provider articles match this topic" copy="Choose another topic to see the current persisted intelligence feed." /> : null}
        <details className="mt-6 border-l-2 border-[#0b776e] bg-[#eaf2ee] p-4"><summary className="flex min-h-11 cursor-pointer items-center gap-3 text-xs font-semibold text-[#0b6f63]"><ShieldCheck className="shrink-0" size={18} />How provider visibility stays fair</summary><p className="mt-2 pl-8 text-xs leading-5 text-[#102c3d]/[0.60]">Provider rotation comes before freshness. Ratings, spend, popularity and engagement never influence order.</p></details>
      </> : null}
    </section>
  );
}

function IntelligenceState({ title, copy, action, onAction }: { title: string; copy: string; action?: string; onAction?: () => void }) {
  return <div className="border border-dashed border-[#102c3d]/[0.14] bg-white p-10 text-center"><h3 className="text-lg font-semibold text-[#102c3d]">{title}</h3><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#102c3d]/[0.55]">{copy}</p>{action && onAction ? <button type="button" onClick={onAction} className="mt-4 min-h-11 rounded-full bg-[#102c3d] px-5 text-xs font-semibold text-white">{action}</button> : null}</div>;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(new Date(value));
}
