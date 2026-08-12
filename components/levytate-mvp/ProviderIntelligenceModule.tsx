"use client";

import { Bookmark, Check, ChevronRight, Eye, Sparkles, X } from "lucide-react";
import { useMemo, useState } from "react";
import { buildFairProviderFeed } from "@/lib/levytate/provider-intelligence/fair-distribution";
import { morningBrief } from "@/lib/levytate/provider-intelligence/feed";
import { intelligenceProviders, marketWatchItems, providerIntelligenceUpdates } from "@/lib/levytate/provider-intelligence/fixtures";
import { intelligenceTopics, type IntelligenceTopic, type ProviderIntelligenceUpdate } from "@/lib/levytate/provider-intelligence/domain";

const providerById = new Map(intelligenceProviders.map((provider) => [provider.id, provider]));

export function ProviderIntelligenceModule() {
  const [topic, setTopic] = useState<IntelligenceTopic>("All");
  const [view, setView] = useState<"Stream" | "Following">("Stream");
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [followedProviders, setFollowedProviders] = useState<Set<string>>(new Set(["northstar", "civic"]));
  const [followedTopics, setFollowedTopics] = useState<Set<string>>(new Set(["AI & Data", "Procurement"]));
  const [selected, setSelected] = useState<ProviderIntelligenceUpdate | null>(null);
  const fairFeed = useMemo(() => buildFairProviderFeed(providerIntelligenceUpdates, { topic }), [topic]);
  const visibleFeed = view === "Following"
    ? fairFeed.filter((item) => followedProviders.has(item.providerId) || item.topics.some((itemTopic) => followedTopics.has(itemTopic)))
    : fairFeed;

  const toggleSet = (setter: React.Dispatch<React.SetStateAction<Set<string>>>, value: string) => setter((current) => {
    const next = new Set(current);
    if (next.has(value)) next.delete(value); else next.add(value);
    return next;
  });

  return (
    <section className="overflow-hidden rounded-[28px] border border-[#102c3d]/[0.08] bg-[#f8faf8] shadow-[0_24px_60px_rgba(16,44,61,0.06)]">
      <div className="border-b border-[#102c3d]/[0.08] bg-[#102c3d] px-5 py-7 text-white sm:px-8 sm:py-9">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#73d4c7]">Market intelligence</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">Good morning</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/64">Your apprenticeship market, in one place. A calm editorial view of provider updates, programme changes and themes worth your attention.</p>
          </div>
          <div className="flex flex-wrap gap-2 text-[11px] font-semibold">
            <span className="rounded-full border border-white/12 bg-white/[0.07] px-3 py-2">Updated this morning</span>
            <span className="rounded-full border border-white/12 bg-white/[0.07] px-3 py-2">Illustrative intelligence feed</span>
          </div>
        </div>
      </div>

      <div className="grid gap-6 p-4 sm:p-6 lg:grid-cols-[minmax(0,7fr)_minmax(17rem,3fr)] lg:p-8">
        <div className="min-w-0">
          <MorningBrief />
          <div className="mt-5 lg:hidden"><MarketWatch /></div>

          <div className="mt-6 flex flex-col gap-4 border-b border-[#102c3d]/[0.09] pb-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="inline-flex rounded-xl border border-[#102c3d]/[0.08] bg-white p-1">
                {(["Stream", "Following"] as const).map((item) => <button key={item} onClick={() => setView(item)} className={`min-h-11 rounded-lg px-4 text-sm font-semibold transition ${view === item ? "bg-[#102c3d] text-white" : "text-[#102c3d]/58 hover:bg-[#f2f7f4]"}`}>{item}</button>)}
              </div>
              <p className="text-xs font-semibold text-[#102c3d]/46">{visibleFeed.length} editorial updates</p>
            </div>
            <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1" aria-label="Intelligence topics">
              {intelligenceTopics.map((item) => <button key={item} onClick={() => setTopic(item)} className={`min-h-11 shrink-0 rounded-full border px-4 text-xs font-semibold transition ${topic === item ? "border-[#159b8f] bg-[#e9f6f2] text-[#0b6f63]" : "border-[#102c3d]/[0.08] bg-white text-[#102c3d]/58 hover:border-[#159b8f]/35"}`}>{item}</button>)}
            </div>
          </div>

          <div className="divide-y divide-[#102c3d]/[0.08]">
            {visibleFeed.map((item) => {
              const provider = providerById.get(item.providerId)!;
              return <article key={item.id} className="py-6 first:pt-5">
                <div className="flex gap-4">
                  <ProviderMark providerId={item.providerId} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                      <p className="text-sm font-semibold text-[#102c3d]">{provider.name}</p>
                      <span className="text-xs text-[#102c3d]/40">{formatDate(item.publishedAt)}</span>
                      <span className="rounded-full bg-[#eef5f2] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-[#0b6f63]">{item.contentType}</span>
                    </div>
                    <h3 className="mt-3 text-xl font-semibold leading-tight tracking-[-0.025em] text-[#102c3d]">{item.displayHeadline}</h3>
                    <p className="mt-2 text-sm leading-6 text-[#102c3d]/62">{item.displaySummary}</p>
                    <div className="mt-3 flex flex-wrap gap-2">{item.topics.map((itemTopic) => <span key={itemTopic} className="text-[11px] font-semibold text-[#0b6f63]">#{itemTopic.replaceAll(" ", "")}</span>)}</div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button onClick={() => setSelected(item)} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#102c3d] px-4 text-xs font-semibold text-white hover:bg-[#17394d]">View update <ChevronRight size={14} /></button>
                      <button onClick={() => toggleSet(setSaved, item.id)} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#102c3d]/[0.09] bg-white px-4 text-xs font-semibold text-[#102c3d]/68"><Bookmark size={14} fill={saved.has(item.id) ? "currentColor" : "none"} />{saved.has(item.id) ? "Saved" : "Save"}</button>
                      <button onClick={() => toggleSet(setFollowedProviders, item.providerId)} className="min-h-11 rounded-xl px-3 text-xs font-semibold text-[#0b6f63]">{followedProviders.has(item.providerId) ? "Following provider" : "Follow provider"}</button>
                    </div>
                  </div>
                </div>
              </article>;
            })}
            {!visibleFeed.length ? <div className="py-12 text-center"><p className="font-semibold">Nothing in Following yet.</p><p className="mt-2 text-sm text-[#102c3d]/54">Follow a provider or topic to create your local reading list.</p></div> : null}
          </div>
          <div className="mt-2 lg:hidden"><FollowingPanel followedProviders={followedProviders} followedTopics={followedTopics} onProvider={(id) => toggleSet(setFollowedProviders, id)} onTopic={(value) => toggleSet(setFollowedTopics, value)} /></div>
        </div>

        <aside className="hidden space-y-5 lg:block">
          <MarketWatch />
          <FollowingPanel followedProviders={followedProviders} followedTopics={followedTopics} onProvider={(id) => toggleSet(setFollowedProviders, id)} onTopic={(value) => toggleSet(setFollowedTopics, value)} />
          <div className="rounded-2xl border border-[#159b8f]/15 bg-[#eaf5f1] p-5">
            <div className="flex items-center gap-2 text-[#0b6f63]"><Sparkles size={16} /><p className="text-xs font-bold uppercase tracking-[0.12em]">Fair by design</p></div>
            <p className="mt-3 text-sm leading-6 text-[#102c3d]/62">The main stream rotates eligible providers after topic relevance. Posting volume, engagement and commercial ranking do not control exposure.</p>
          </div>
        </aside>
      </div>

      {selected ? <UpdateDetail item={selected} onClose={() => setSelected(null)} /> : null}
    </section>
  );
}

function MorningBrief() {
  return <article className="relative overflow-hidden rounded-2xl border border-[#102c3d]/[0.08] bg-white p-5 shadow-[0_16px_36px_rgba(16,44,61,0.05)] sm:p-7">
    <div className="absolute inset-y-0 left-0 w-1 bg-[#159b8f]" />
    <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#c95568]">Morning brief</p><p className="text-xs font-medium text-[#102c3d]/40">Editorial synthesis · illustrative</p></div>
    <h3 className="mt-4 max-w-3xl text-2xl font-semibold leading-tight tracking-[-0.03em] text-[#102c3d] sm:text-[1.75rem]">{morningBrief.headline}</h3>
    <p className="mt-3 max-w-3xl text-sm leading-7 text-[#102c3d]/64">{morningBrief.summary}</p>
    <div className="mt-5 grid gap-3 sm:grid-cols-3">{morningBrief.highlights.map((item) => <div key={item.id} className="border-l border-[#102c3d]/[0.1] pl-3"><p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#0b6f63]">{providerById.get(item.providerId)?.name}</p><p className="mt-1 text-xs font-semibold leading-5 text-[#102c3d]/74">{item.displayHeadline}</p></div>)}</div>
  </article>;
}

function MarketWatch() {
  return <section className="rounded-2xl border border-[#102c3d]/[0.08] bg-white p-5 shadow-[0_14px_30px_rgba(16,44,61,0.04)]">
    <div className="flex items-center justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#c95568]">Market watch</p><h3 className="mt-1 text-lg font-semibold">This morning</h3></div><Eye size={18} className="text-[#0b6f63]" /></div>
    <div className="mt-4 divide-y divide-[#102c3d]/[0.07]">{marketWatchItems.map((item) => <div key={item.label} className="flex min-h-11 items-center justify-between gap-3 py-2"><span className="text-sm text-[#102c3d]/62">{item.label}</span><span className="text-sm font-semibold text-[#102c3d]">{item.count}</span></div>)}</div>
    <p className="mt-3 text-[11px] leading-5 text-[#102c3d]/40">Illustrative counts from the fictional editorial fixture.</p>
  </section>;
}

function FollowingPanel({ followedProviders, followedTopics, onProvider, onTopic }: { followedProviders: Set<string>; followedTopics: Set<string>; onProvider: (id: string) => void; onTopic: (topic: string) => void }) {
  return <section className="rounded-2xl border border-[#102c3d]/[0.08] bg-white p-5">
    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#0b6f63]">Following</p><h3 className="mt-1 text-lg font-semibold">Shape your reading list</h3>
    <p className="mt-2 text-xs leading-5 text-[#102c3d]/48">Stored on this device only. Following never changes the fair main stream.</p>
    <div className="mt-4 grid gap-2">{intelligenceProviders.slice(0, 4).map((provider) => <button key={provider.id} onClick={() => onProvider(provider.id)} className="flex min-h-11 items-center justify-between rounded-xl border border-[#102c3d]/[0.07] px-3 text-left text-xs font-semibold"><span className="flex items-center gap-2"><ProviderMark providerId={provider.id} compact />{provider.name}</span>{followedProviders.has(provider.id) ? <Check size={14} className="text-[#0b6f63]" /> : <span className="text-[#102c3d]/34">Follow</span>}</button>)}</div>
    <div className="mt-4 flex flex-wrap gap-2">{intelligenceTopics.slice(1, 5).map((item) => <button key={item} onClick={() => onTopic(item)} className={`min-h-11 rounded-full border px-3 text-[11px] font-semibold ${followedTopics.has(item) ? "border-[#159b8f] bg-[#eaf5f1] text-[#0b6f63]" : "border-[#102c3d]/[0.08] text-[#102c3d]/54"}`}>{item}</button>)}</div>
  </section>;
}

function ProviderMark({ providerId, compact = false }: { providerId: string; compact?: boolean }) {
  const provider = providerById.get(providerId)!;
  return <span style={{ backgroundColor: provider.accent }} className={`grid shrink-0 place-items-center rounded-xl font-bold text-white shadow-sm ${compact ? "h-7 w-7 text-[9px]" : "h-11 w-11 text-[11px]"}`} aria-hidden="true">{provider.shortName}</span>;
}

function UpdateDetail({ item, onClose }: { item: ProviderIntelligenceUpdate; onClose: () => void }) {
  const provider = providerById.get(item.providerId)!;
  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#071a26]/55 p-0 backdrop-blur-sm sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label="Provider update">
    <article className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-[28px] bg-white p-6 shadow-2xl sm:rounded-[28px] sm:p-8">
      <div className="flex items-start justify-between gap-4"><div className="flex items-center gap-3"><ProviderMark providerId={item.providerId} /><div><p className="text-sm font-semibold">{provider.name}</p><p className="mt-1 text-xs text-[#102c3d]/44">{item.contentType} · {formatDate(item.publishedAt)}</p></div></div><button onClick={onClose} className="grid h-11 w-11 place-items-center rounded-full bg-[#f1f5f3]" aria-label="Close update"><X size={18} /></button></div>
      <h3 className="mt-7 text-3xl font-semibold leading-tight tracking-[-0.035em]">{item.displayHeadline}</h3><p className="mt-4 text-base leading-7 text-[#102c3d]/64">{item.displaySummary}</p>
      <div className="mt-6 grid gap-4 rounded-2xl bg-[#f4f7f5] p-5 sm:grid-cols-2"><Detail label="Programmes" value={item.programmes.join(", ")} /><Detail label="Coverage" value={item.regions.join(", ")} /><Detail label="Source" value={item.sourceType} /><Detail label="Editorial status" value="Published" /></div>
      <p className="mt-5 text-xs leading-5 text-[#102c3d]/42">Fictional provider content for product demonstration. No quality rating, recommendation or provider ranking is implied.</p>
    </article>
  </div>;
}

function Detail({ label, value }: { label: string; value: string }) { return <div><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#0b6f63]">{label}</p><p className="mt-1 text-sm font-semibold text-[#102c3d]/72">{value}</p></div>; }
function formatDate(value: string) { return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(new Date(value)); }
