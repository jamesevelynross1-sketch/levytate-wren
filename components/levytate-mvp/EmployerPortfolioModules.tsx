"use client";

import { Building2, CalendarDays, GraduationCap, Store } from "lucide-react";
import { useMvpWorkspace } from "@/components/levytate-mvp/MvpWorkspaceStore";

export function MyProvidersModule({ onOpenMarketplace, onRequest }: { onOpenMarketplace: () => void; onRequest?: (providerId: string) => void }) {
  const { data, saveOrganisationProvider } = useMvpWorkspace();
  const active = data.organisationProviders.filter((selection) => selection.status === "Active");
  const providers = active.flatMap((selection) => {
    const provider = data.providers.find((item) => item.providerId === selection.providerId);
    return provider ? [{ provider, selection }] : [];
  });

  if (!providers.length) {
    return <EmptyPortfolio icon={Building2} title="No providers added yet" copy="Add a provider from Marketplace to build your organisation’s delivery network." action="Explore Marketplace" onAction={onOpenMarketplace} />;
  }

  return <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" data-testid="my-providers">
    {providers.map(({ provider, selection }) => {
      const programmeIds = new Set(data.organisationProgrammes.filter((item) => item.providerId === provider.providerId && item.status === "Active").map((item) => item.programmeId));
      const learnerCount = data.learnerRecords.filter((record) => record.providerId === provider.providerId && record.recordStatus === "Active").length;
      const relationship = data.providerRelationships.find((item) => item.preferredProviderId === provider.providerId || item.backupProviderIds.includes(provider.providerId));
      const reviews = data.learnerReviews.filter((review) => review.providerId === provider.providerId && review.reviewType === "provider_review").sort((a, b) => b.reviewDate.localeCompare(a.reviewDate));
      return <article key={provider.providerId} className="border border-[#102c3d]/[0.08] bg-white p-5 shadow-[0_10px_24px_rgba(16,44,61,0.035)]">
        <div className="flex items-start justify-between gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-[#eaf5f1] text-[#0b776e]"><Building2 size={19} /></div><span className="rounded-full bg-[#edf7f3] px-3 py-1 text-xs font-semibold text-[#0b6f63]">Active</span></div>
        <h2 className="mt-4 text-xl font-semibold">{provider.providerName}</h2>
        <p className="mt-2 text-sm text-[#102c3d]/[0.56]">{provider.deliveryModels.slice(0, 2).join(", ") || "Delivery details under review"} · {provider.regions.slice(0, 2).join(", ") || "Coverage under review"}</p>
        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm"><Fact label="My programmes" value={String(programmeIds.size)} /><Fact label="Learners" value={String(learnerCount)} /><Fact label="Latest review" value={reviews[0] ? displayDate(reviews[0].reviewDate) : "Not recorded"} /><Fact label="Next review" value={relationship?.reviewDate ? displayDate(relationship.reviewDate) : reviews[0]?.nextReviewDate ? displayDate(reviews[0].nextReviewDate) : "Not scheduled"} /></dl>
        {reviews[0]?.supportRequired ? <p className="mt-4 border-t border-[#102c3d]/[0.07] pt-3 text-xs leading-5 text-[#102c3d]/[0.56]"><strong>Support:</strong> {reviews[0].supportRequired}</p> : null}
        <div className="mt-5 flex flex-wrap gap-2">{onRequest ? <button type="button" onClick={() => onRequest(provider.providerId)} className="min-h-11 rounded-full bg-[#edf7f3] px-4 text-xs font-semibold text-[#0b6f63]">Request proposal</button> : null}<button type="button" onClick={() => saveOrganisationProvider({ ...selection, status: "Inactive", updatedAt: new Date().toISOString() })} className="min-h-11 rounded-full px-3 text-xs font-semibold text-[#ad344e] hover:bg-[#fff2f4]">Remove from My Providers</button></div>
      </article>;
    })}
  </div>;
}

export function MyProgrammesModule({ onOpenMarketplace, onRequest }: { onOpenMarketplace: () => void; onRequest?: (programmeId: string, providerId: string) => void }) {
  const { data, saveOrganisationProgramme } = useMvpWorkspace();
  const programmes = data.organisationProgrammes.filter((selection) => selection.status === "Active").flatMap((selection) => {
    const programme = data.providerProgrammes.find((item) => item.id === selection.programmeId);
    const provider = data.providers.find((item) => item.providerId === selection.providerId);
    return programme && provider ? [{ programme, provider, selection }] : [];
  });

  if (!programmes.length) {
    return <EmptyPortfolio icon={GraduationCap} title="No programmes added yet" copy="Add programmes from Marketplace before employees begin apprenticeship applications." action="Explore Marketplace" onAction={onOpenMarketplace} />;
  }

  return <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" data-testid="my-programmes">
    {programmes.map(({ programme, provider, selection }) => {
      const learnerCount = data.learnerRecords.filter((record) => record.programmeId === programme.id && record.recordStatus === "Active").length;
      const applicationCount = data.applications.filter((application) => programme.linkedStandardIds.includes(application.apprenticeshipStandardId) || programme.linkedStandardId === application.apprenticeshipStandardId).length;
      return <article key={programme.id} className="border border-[#102c3d]/[0.08] bg-white p-5 shadow-[0_10px_24px_rgba(16,44,61,0.035)]">
        <div className="flex items-start justify-between gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-[#eef5fa] text-[#315d78]"><GraduationCap size={19} /></div><span className="rounded-full bg-[#edf7f3] px-3 py-1 text-xs font-semibold text-[#0b6f63]">Published</span></div>
        <h2 className="mt-4 text-xl font-semibold">{programme.programmeName}</h2><p className="mt-2 text-sm font-semibold text-[#0b6f63]">{provider.providerName}</p>
        <p className="mt-3 text-sm leading-6 text-[#102c3d]/[0.56]">{programme.shortDescription || "Programme details are available in Marketplace."}</p>
        <dl className="mt-4 grid grid-cols-2 gap-3"><Fact label="Applications" value={String(applicationCount)} /><Fact label="Learners" value={String(learnerCount)} /><Fact label="Duration" value={programme.duration || "To confirm"} /><Fact label="Level" value={programme.level ? `Level ${programme.level}` : "To confirm"} /></dl>
        <div className="mt-5 flex flex-wrap gap-2">{onRequest ? <button type="button" onClick={() => onRequest(programme.id, provider.providerId)} className="min-h-11 rounded-full bg-[#edf7f3] px-4 text-xs font-semibold text-[#0b6f63]">Request proposals</button> : null}<button type="button" onClick={() => saveOrganisationProgramme({ ...selection, status: "Inactive", updatedAt: new Date().toISOString() })} className="min-h-11 rounded-full px-3 text-xs font-semibold text-[#ad344e] hover:bg-[#fff2f4]">Unpublish programme</button></div>
      </article>;
    })}
  </div>;
}

function EmptyPortfolio({ icon: Icon, title, copy, action, onAction }: { icon: typeof Store; title: string; copy: string; action: string; onAction: () => void }) {
  return <section className="grid min-h-[280px] place-items-center border border-dashed border-[#102c3d]/[0.14] bg-white p-6 text-center"><div className="max-w-md"><div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-[#eaf5f1] text-[#0b776e]"><Icon size={22} /></div><h2 className="mt-4 text-2xl font-semibold">{title}</h2><p className="mt-2 text-sm leading-6 text-[#102c3d]/[0.56]">{copy}</p><button type="button" onClick={onAction} className="mt-4 min-h-11 rounded-lg bg-[#102c3d] px-5 text-sm font-semibold text-white">{action}</button></div></section>;
}

function Fact({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-[#f8fbfa] p-3"><dt className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#102c3d]/[0.42]">{label.includes("review") ? <CalendarDays size={11} /> : null}{label}</dt><dd className="mt-1 text-sm font-semibold">{value}</dd></div>;
}

function displayDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? "Not recorded" : new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(date);
}
