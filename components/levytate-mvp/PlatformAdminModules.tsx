"use client";

import { BookOpenCheck, Building2, KeyRound, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { useMvpWorkspace } from "@/components/levytate-mvp/MvpWorkspaceStore";

type PublicationMetadata = { slug: string; title: string; version: string; effectiveDate: string; lastReviewedDate: string; reviewStatus: string; internalOwner: string; active: boolean };
type TermsAcceptanceStatus = { organisation: string; currentTermsVersion: string; accepted: boolean; acceptedAt: string | null; acceptingUser: string | null; roleSnapshot: string | null; reacceptanceRequired: boolean };

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

function SafeFact({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-[#f6f9f7] px-4 py-3"><dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#102c3d]/40">{label}</dt><dd className="mt-1 text-sm font-semibold text-[#102c3d]">{value}</dd></div>;
}
