"use client";

import { BookOpenCheck, Building2, KeyRound, ShieldCheck } from "lucide-react";
import { useMvpWorkspace } from "@/components/levytate-mvp/MvpWorkspaceStore";

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
  return (
    <section className="rounded-[1.5rem] border border-[#102c3d]/[0.08] bg-white p-6 shadow-[0_14px_34px_rgba(16,44,61,0.045)] sm:p-8">
      <div className="grid h-11 w-11 place-items-center rounded-xl bg-[#edf7f3] text-[#0b8e82]"><ShieldCheck size={21} /></div>
      <p className="mt-5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#0b6f63]">Safe support context</p>
      <h2 className="mt-2 text-2xl font-semibold">Platform boundary active</h2>
      <p className="mt-3 max-w-3xl text-sm leading-7 text-[#102c3d]/60">This view confirms platform-support access without exposing employer applications, learner records, operational actions or employer governance. Support impersonation and audit exports are not available in Core Early Access.</p>
      <dl className="mt-6 grid gap-3 sm:grid-cols-2"><SafeFact label="Role" value={meta?.userRole ?? "Platform Admin"} /><SafeFact label="Workspace storage" value={meta?.storageMode === "supabase" ? "Persistent" : "Fallback"} /></dl>
    </section>
  );
}

function SafeFact({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-[#f6f9f7] px-4 py-3"><dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#102c3d]/40">{label}</dt><dd className="mt-1 text-sm font-semibold text-[#102c3d]">{value}</dd></div>;
}
