"use client";

import { Activity, BookOpenCheck, Building2, KeyRound, RefreshCw, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { useMvpWorkspace } from "@/components/levytate-mvp/MvpWorkspaceStore";
import { ClientWorkspaceAdminModule } from "@/components/levytate-mvp/ClientWorkspaceAdminModule";

type PublicationMetadata = { slug: string; title: string; version: string; effectiveDate: string; lastReviewedDate: string; reviewStatus: string; internalOwner: string; active: boolean };
type TermsAcceptanceStatus = { organisation: string; currentTermsVersion: string; accepted: boolean; acceptedAt: string | null; acceptingUser: string | null; roleSnapshot: string | null; reacceptanceRequired: boolean };
type DiagnosticState = "operational" | "degraded" | "unavailable";
type Diagnostics = { status: DiagnosticState; checkedAt: string; environment: string; termsVersion: string; migrationBaseline: string; supportOwnership: string; incidentOwnership: string; configuration: Array<{ label: string; configured: boolean }>; components: Array<{ label: string; state: DiagnosticState; checkedAt: string; summary: string; durationMs?: number }> };

export function PlatformAdminWorkspacesModule({ onNavigate }: { onNavigate: (module: string) => void }) {
  const { data, meta } = useMvpWorkspace();
  const cards = [
    { title: "Provider Catalogue", copy: `${data.providers.length} catalogue provider${data.providers.length === 1 ? "" : "s"} available for platform administration.`, target: "Providers", icon: Building2 },
    { title: "Access & Tenant Support", copy: "Review controlled access and workspace support status without entering employer operations.", target: "Settings", icon: KeyRound },
    { title: "Guidance Administration", copy: "Maintain trusted guidance and its internal review controls.", target: "Knowledge", icon: BookOpenCheck },
  ];

  return (
    <div className="grid gap-5">
      <section className="rounded-[1.5rem] bg-[#102c3d] p-6 text-white sm:p-8">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8fe0d2]">Platform administration</p>
        <h2 className="mt-3 text-2xl font-semibold">Employer workspace support</h2>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-white/68">Administer catalogue, guidance and controlled access. Employer applications, learners and operational decisions are intentionally unavailable in this role.</p>
        <p className="mt-5 text-xs font-semibold text-white/55">{meta?.organisationName ?? "LevyTate Internal"} · {meta?.storageMode === "supabase" ? "Persistent platform workspace" : "Fallback support workspace"}</p>
      </section>
      <section className="grid gap-4 md:grid-cols-3">
        {cards.map(({ title, copy, target, icon: Icon }) => <button key={title} type="button" onClick={() => onNavigate(target)} className="min-h-44 rounded-[1.35rem] border border-[#102c3d]/[0.08] bg-white p-5 text-left shadow-[0_14px_34px_rgba(16,44,61,0.045)] transition hover:-translate-y-0.5 hover:border-[#159b8f]/25"><Icon size={20} className="text-[#0b8e82]" /><h3 className="mt-5 text-lg font-semibold">{title}</h3><p className="mt-2 text-sm leading-6 text-[#102c3d]/58">{copy}</p></button>)}
      </section>
      <ClientWorkspaceAdminModule />
    </div>
  );
}

export function PlatformAdminSupportContextModule() {
  const { meta } = useMvpWorkspace();
  const [publications, setPublications] = useState<PublicationMetadata[]>([]);
  const [termsAcceptance, setTermsAcceptance] = useState<TermsAcceptanceStatus[]>([]);
  const [metadataError, setMetadataError] = useState(false);
  useEffect(() => {
    let active = true;
    fetch("/api/levytate-publication-metadata", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Publication metadata unavailable");
        const body = await response.json() as { publications?: PublicationMetadata[]; termsAcceptance?: TermsAcceptanceStatus[] };
        if (active) { setPublications(body.publications ?? []); setTermsAcceptance(body.termsAcceptance ?? []); }
      })
      .catch(() => { if (active) setMetadataError(true); });
    return () => { active = false; };
  }, []);
  return (
    <div className="grid gap-5"><section className="rounded-[1.5rem] border border-[#102c3d]/[0.08] bg-white p-6 shadow-[0_14px_34px_rgba(16,44,61,0.045)] sm:p-8">
      <div className="grid h-11 w-11 place-items-center rounded-xl bg-[#edf7f3] text-[#0b8e82]"><ShieldCheck size={21} /></div>
      <p className="mt-5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#0b6f63]">Safe support context</p>
      <h2 className="mt-2 text-2xl font-semibold">Platform boundary active</h2>
      <p className="mt-3 max-w-3xl text-sm leading-7 text-[#102c3d]/60">This view confirms platform-support access without exposing employer applications, learner records, operational actions or employer governance. Support impersonation and audit exports are not available in Core Early Access.</p>
      <dl className="mt-6 grid gap-3 sm:grid-cols-2"><SafeFact label="Role" value={meta?.userRole ?? "Platform Admin"} /><SafeFact label="Workspace storage" value={meta?.storageMode === "supabase" ? "Persistent" : "Fallback"} /></dl>
    </section>
    <PlatformAdminServiceHealth />
    <ProviderIntelligenceHealth />
    <section className="rounded-[1.5rem] border border-[#102c3d]/[0.08] bg-white p-6 shadow-[0_14px_34px_rgba(16,44,61,0.045)] sm:p-8">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#0b6f63]">Publication control</p>
      <h2 className="mt-2 text-xl font-semibold">Public trust-page status</h2>
      <p className="mt-2 text-sm leading-6 text-[#102c3d]/60">Internal review metadata is available only to Platform Admin. Content updates remain code-reviewed during Early Access.</p>
      {metadataError ? <p className="mt-4 rounded-xl bg-[#fff4f5] p-3 text-sm text-[#ad344e]">Publication metadata could not be loaded.</p> : null}
      <div className="mt-5 grid gap-3">{publications.map((publication) => <article key={publication.slug} className="rounded-xl bg-[#f6f9f7] p-4"><div className="flex flex-wrap items-start justify-between gap-2"><h3 className="text-sm font-semibold">{publication.title}</h3><span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${publication.reviewStatus === "approved_for_early_access" ? "bg-[#e4f5ee] text-[#0b6f63]" : "bg-[#fff3dc] text-[#7a5818]"}`}>{publication.reviewStatus.replaceAll("_", " ")}</span></div><dl className="mt-3 grid gap-2 text-xs text-[#102c3d]/60 sm:grid-cols-3"><SafeFact label="Version" value={publication.version} /><SafeFact label="Reviewed" value={publication.lastReviewedDate} /><SafeFact label="Internal owner" value={publication.internalOwner} /></dl></article>)}</div>
    </section>
    <section className="rounded-[1.5rem] border border-[#102c3d]/[0.08] bg-white p-6 shadow-[0_14px_34px_rgba(16,44,61,0.045)] sm:p-8">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#0b6f63]">Employer acceptance</p>
      <h2 className="mt-2 text-xl font-semibold">Current Early Access Terms</h2>
      <p className="mt-2 text-sm leading-6 text-[#102c3d]/60">Read-only organisation status. Platform Admin cannot accept employer terms.</p>
      <div className="mt-5 grid gap-3">{termsAcceptance.map((item) => <article key={item.organisation} className="rounded-xl bg-[#f6f9f7] p-4"><div className="flex flex-wrap items-start justify-between gap-2"><h3 className="text-sm font-semibold">{item.organisation}</h3><span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${item.accepted ? "bg-[#e4f5ee] text-[#0b6f63]" : "bg-[#fff3dc] text-[#7a5818]"}`}>{item.accepted ? "Accepted" : item.reacceptanceRequired ? "Reacceptance required" : "Not accepted"}</span></div><dl className="mt-3 grid gap-2 sm:grid-cols-3"><SafeFact label="Current version" value={item.currentTermsVersion} /><SafeFact label="Accepted" value={item.acceptedAt ? new Date(item.acceptedAt).toLocaleString("en-GB") : "Not recorded"} /><SafeFact label="Role snapshot" value={item.roleSnapshot ?? "Not recorded"} /></dl>{item.acceptingUser ? <p className="mt-3 text-xs text-[#102c3d]/52">Accepted by {item.acceptingUser}</p> : null}</article>)}</div>
    </section></div>
  );
}

function ProviderIntelligenceHealth(){const [sources,setSources]=useState<Array<{id:string;label:string;status:string;lastSuccessfulFetchAt:string|null;lastError:string|null}>>([]);const [error,setError]=useState(false);useEffect(()=>{fetch("/api/levytate-platform/provider-intelligence",{cache:"no-store"}).then(async response=>{if(!response.ok)throw new Error("health");const body=await response.json() as {sources?:typeof sources};setSources(body.sources??[])}).catch(()=>setError(true));},[]);return <section className="rounded-[1.5rem] border border-[#102c3d]/[0.08] bg-white p-6 shadow-[0_14px_34px_rgba(16,44,61,0.045)] sm:p-8"><p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#0b6f63]">Provider Intelligence</p><h2 className="mt-2 text-xl font-semibold">Source health</h2><p className="mt-2 text-sm text-[#102c3d]/60">Read-only status for official provider sources. Refresh remains service-controlled.</p>{error?<p className="mt-4 text-sm text-[#ad344e]">Source health is unavailable.</p>:<div className="mt-5 grid gap-2 sm:grid-cols-2">{sources.map(source=><div key={source.id} className="rounded-xl bg-[#f6f9f7] p-4"><div className="flex items-center justify-between gap-2"><p className="text-sm font-semibold">{source.label}</p><span className="text-[10px] font-semibold uppercase text-[#0b6f63]">{source.status.replace("-"," ")}</span></div><p className="mt-2 text-xs text-[#102c3d]/48">{source.lastSuccessfulFetchAt?`Last success ${new Date(source.lastSuccessfulFetchAt).toLocaleString("en-GB")}`:"Awaiting first persisted refresh"}</p>{source.lastError?<p className="mt-1 text-xs text-[#ad344e]">Refresh needs attention</p>:null}</div>)}</div>}</section>}

function PlatformAdminServiceHealth() {
  const [data, setData] = useState<Diagnostics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  async function refresh() {
    setLoading(true); setError(false);
    try {
      const response = await fetch("/api/levytate-platform/diagnostics", { cache: "no-store" });
      if (!response.ok) throw new Error("diagnostics");
      setData(await response.json() as Diagnostics);
    } catch { setError(true); } finally { setLoading(false); }
  }
  useEffect(() => { void refresh(); }, []);
  const tone = data?.status === "operational" ? "bg-[#e4f5ee] text-[#0b6f63]" : data?.status === "degraded" ? "bg-[#fff3dc] text-[#7a5818]" : "bg-[#fff0f2] text-[#ad344e]";
  return <section className="min-w-0 rounded-[1.5rem] border border-[#102c3d]/[0.08] bg-white p-6 shadow-[0_14px_34px_rgba(16,44,61,0.045)] sm:p-8">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><div className="grid h-11 w-11 place-items-center rounded-xl bg-[#edf7f3] text-[#0b8e82]"><Activity size={21} /></div><p className="mt-5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#0b6f63]">Service diagnostics</p><h2 className="mt-2 text-xl font-semibold">LevyTate service health</h2></div><button type="button" onClick={() => void refresh()} disabled={loading} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[#102c3d] px-4 text-xs font-semibold text-white focus:outline-none focus:ring-4 focus:ring-[#159b8f]/25 disabled:opacity-55"><RefreshCw size={15} className={loading ? "animate-spin" : ""} />Refresh</button></div>
    {error ? <p role="status" className="mt-5 rounded-xl bg-[#fff0f2] p-4 text-sm font-medium text-[#ad344e]">Diagnostics are temporarily unavailable.</p> : null}
    {data ? <div aria-live="polite" aria-atomic="true" className="mt-5 grid gap-5">
      <div className="flex flex-wrap items-center gap-3"><span className={`rounded-full px-3 py-1.5 text-xs font-semibold ${tone}`}>{stateLabel(data.status)}</span><span className="text-xs text-[#102c3d]/50">Checked {new Date(data.checkedAt).toLocaleString("en-GB")}</span></div>
      <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><SafeFact label="Environment" value={data.environment} /><SafeFact label="Terms version" value={data.termsVersion} /><SafeFact label="Migration baseline" value={data.migrationBaseline} /><SafeFact label="Ownership" value={data.supportOwnership} /></dl>
      <div className="grid min-w-0 gap-3 sm:grid-cols-2">{data.components.map((component) => <article key={component.label} className="min-w-0 rounded-xl bg-[#f6f9f7] p-4"><div className="flex flex-wrap items-start justify-between gap-2"><h3 className="text-sm font-semibold">{component.label}</h3><span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${component.state === "operational" ? "bg-[#e4f5ee] text-[#0b6f63]" : component.state === "degraded" ? "bg-[#fff3dc] text-[#7a5818]" : "bg-[#fff0f2] text-[#ad344e]"}`}>{stateLabel(component.state)}</span></div><p className="mt-2 break-words text-xs leading-5 text-[#102c3d]/58">{component.summary}</p>{typeof component.durationMs === "number" ? <p className="mt-2 text-[10px] font-semibold text-[#102c3d]/38">{component.durationMs} ms</p> : null}</article>)}</div>
      <div><h3 className="text-sm font-semibold">Configuration presence</h3><div className="mt-3 grid gap-2 sm:grid-cols-2">{data.configuration.map((item) => <div key={item.label} className="flex min-h-11 items-center justify-between gap-3 rounded-xl bg-[#f6f9f7] px-4 py-2.5 text-xs"><span>{item.label}</span><strong>{item.configured ? "Yes" : "No"}</strong></div>)}</div></div>
      <p className="text-xs leading-5 text-[#102c3d]/52">Support owner: {data.supportOwnership}. Privacy/incident owner: {data.incidentOwnership}. No external uptime monitor is configured.</p>
    </div> : loading ? <p role="status" className="mt-5 text-sm text-[#102c3d]/55">Checking service health…</p> : null}
  </section>;
}

function stateLabel(state: DiagnosticState) { return state === "operational" ? "Operational" : state === "degraded" ? "Degraded" : "Unavailable"; }

function SafeFact({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-[#f6f9f7] px-4 py-3"><dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#102c3d]/40">{label}</dt><dd className="mt-1 text-sm font-semibold text-[#102c3d]">{value}</dd></div>;
}
