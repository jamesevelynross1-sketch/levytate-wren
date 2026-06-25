"use client";

import { FormEvent, useMemo, useState, type ReactNode } from "react";
import { LevyTateLogo, PlatformButton, PlatformTopBar } from "@/components/levytate-demo/PlatformShell";
import { mvpProviderCatalogue } from "@/lib/levytate/data/mvp";
import { defaultProviderCatalogueFilters, filterProviderCatalogue, fundingLabel, shortlistProvidersForNeed, uniqueProgrammeNames, uniqueProviderValues } from "@/lib/levytate/domain";
import type { ProviderCatalogueFilters, ProviderCatalogueRecord, ProviderProgramme, ProviderRecordStatus } from "@/lib/levytate/domain";

const allOption = "All" as const;
const statusOptions: ProviderRecordStatus[] = ["Active", "Archived"];

export function ProviderManagementModule() {
  const [providers, setProviders] = useState<ProviderCatalogueRecord[]>(mvpProviderCatalogue);
  const [filters, setFilters] = useState<ProviderCatalogueFilters>(defaultProviderCatalogueFilters);
  const [selectedProviderId, setSelectedProviderId] = useState(providers[0]?.providerId ?? "");
  const [profileId, setProfileId] = useState<string | null>(null);
  const [providerDraft, setProviderDraft] = useState<ProviderCatalogueRecord | null>(null);
  const [programmeDraft, setProgrammeDraft] = useState<{ providerId: string; programme: ProviderProgramme } | null>(null);
  const [matchQuery, setMatchQuery] = useState("Data analyst remote delivery");

  const visibleProviders = useMemo(() => filterProviderCatalogue(providers, filters), [providers, filters]);
  const selectedProvider = providers.find((provider) => provider.providerId === selectedProviderId) ?? visibleProviders[0] ?? providers[0];
  const profileProvider = profileId ? providers.find((provider) => provider.providerId === profileId) : null;
  const sectors = useMemo(() => uniqueProviderValues(providers, "sectors"), [providers]);
  const deliveryModels = useMemo(() => uniqueProviderValues(providers, "deliveryModel"), [providers]);
  const regions = useMemo(() => uniqueProviderValues(providers, "regions"), [providers]);
  const programmes = useMemo(() => uniqueProgrammeNames(providers), [providers]);
  const shortlist = useMemo(() => shortlistProvidersForNeed(providers, { query: matchQuery, programme: filters.programme === "All" ? undefined : filters.programme, sector: filters.sector === "All" ? undefined : filters.sector, deliveryModel: filters.deliveryModel === "All" ? undefined : filters.deliveryModel, region: filters.region === "All" ? undefined : filters.region }), [providers, matchQuery, filters]);

  function updateFilter<K extends keyof ProviderCatalogueFilters>(key: K, value: ProviderCatalogueFilters[K]) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function archiveProvider(provider: ProviderCatalogueRecord) {
    setProviders((current) => current.map((item) => item.providerId === provider.providerId ? { ...item, status: item.status === "Archived" ? "Active" : "Archived" } : item));
  }

  function saveProvider(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!providerDraft) return;
    const cleaned = { ...providerDraft, providerName: providerDraft.providerName.trim(), website: providerDraft.website.trim(), sectors: tidyList(providerDraft.sectors), deliveryModel: tidyList(providerDraft.deliveryModel), regions: tidyList(providerDraft.regions) };
    if (!cleaned.providerName || !cleaned.website) return;
    setProviders((current) => current.some((item) => item.providerId === cleaned.providerId) ? current.map((item) => item.providerId === cleaned.providerId ? cleaned : item) : [cleaned, ...current]);
    setSelectedProviderId(cleaned.providerId);
    setProfileId(cleaned.providerId);
    setProviderDraft(null);
  }

  function saveProgramme(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!programmeDraft) return;
    setProviders((current) => current.map((provider) => {
      if (provider.providerId !== programmeDraft.providerId) return provider;
      const exists = provider.programmes.some((programme) => programme.programmeId === programmeDraft.programme.programmeId);
      return { ...provider, programmes: exists ? provider.programmes.map((programme) => programme.programmeId === programmeDraft.programme.programmeId ? programmeDraft.programme : programme) : [programmeDraft.programme, ...provider.programmes] };
    }));
    setProgrammeDraft(null);
  }

  return (
    <main className="min-h-screen bg-[#f5f7f6] text-[#102c3d]">
      <PlatformTopBar tenantName="LevyTate MVP" tenantSubtitle="Provider Catalogue" controlsOnly>
        <div className="grid w-full gap-3 xl:grid-cols-[auto_minmax(300px,1fr)_auto] xl:items-center">
          <div className="flex items-center gap-4">
            <LevyTateLogo className="[--levytate-logo-size:2.35rem]" />
            <div className="hidden h-8 w-px bg-[#102c3d]/10 sm:block" />
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#0b6f63]">MVP workspace</p>
              <p className="text-sm font-semibold text-[#102c3d]">Provider Management</p>
            </div>
          </div>
          <label className="flex h-11 min-w-0 items-center gap-3 rounded-full border border-[#102c3d]/[0.08] bg-[#f8fbfa] px-4 focus-within:border-[#159b8f] focus-within:bg-white focus-within:ring-4 focus-within:ring-[#159b8f]/10">
            <span className="text-sm text-[#102c3d]/36">Search</span>
            <input value={filters.search} onChange={(event) => updateFilter("search", event.target.value)} className="min-w-0 flex-1 bg-transparent text-sm font-medium text-[#102c3d] outline-none" placeholder="Provider, programme, sector or region" />
          </label>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setFilters(defaultProviderCatalogueFilters)} className="h-10 rounded-full bg-white px-4 text-xs font-semibold text-[#102c3d]/62 ring-1 ring-[#102c3d]/[0.08]">Reset</button>
            <PlatformButton onClick={() => setProviderDraft(blankProvider())}>Add provider</PlatformButton>
          </div>
        </div>
      </PlatformTopBar>

      <div className="mx-auto grid w-full max-w-[1500px] gap-5 px-5 py-5 sm:px-7 lg:px-8">
        <section className="rounded-[1rem] border border-[#102c3d]/[0.065] bg-white p-4 shadow-[0_10px_28px_rgba(16,44,61,0.045)]">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#c95568]">LevyTate asset</p>
              <h1 className="mt-1 text-2xl font-semibold tracking-[-0.025em] text-[#102c3d]">Provider Catalogue</h1>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-[#102c3d]/58">A seeded provider catalogue for LevyTate-led matching. Employers do not browse this as an open marketplace.</p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs text-[#102c3d]/52">
              <Pill>{providers.length} providers</Pill>
              <Pill>{providers.reduce((sum, provider) => sum + provider.programmes.length, 0)} programmes</Pill>
              <Pill>{providers.filter((provider) => provider.verificationStatus === "needs_verification").length} need verification</Pill>
            </div>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <FilterSelect label="Sector" value={filters.sector} options={[allOption, ...sectors]} onChange={(value) => updateFilter("sector", value)} />
            <FilterSelect label="Programme" value={filters.programme} options={[allOption, ...programmes]} onChange={(value) => updateFilter("programme", value)} />
            <FilterSelect label="Delivery" value={filters.deliveryModel} options={[allOption, ...deliveryModels]} onChange={(value) => updateFilter("deliveryModel", value)} />
            <FilterSelect label="Region" value={filters.region} options={[allOption, ...regions]} onChange={(value) => updateFilter("region", value)} />
            <FilterSelect label="Status" value={filters.status} options={[allOption, ...statusOptions]} onChange={(value) => updateFilter("status", value as ProviderCatalogueFilters["status"])} />
          </div>
        </section>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_390px]">
          <section className="overflow-hidden rounded-[1rem] border border-[#102c3d]/[0.065] bg-white shadow-[0_10px_28px_rgba(16,44,61,0.045)]">
            <ProviderTable providers={visibleProviders} selectedProviderId={selectedProvider?.providerId ?? ""} onSelect={(provider) => setSelectedProviderId(provider.providerId)} onOpen={(provider) => setProfileId(provider.providerId)} onEdit={setProviderDraft} onArchive={archiveProvider} />
          </section>
          <aside className="grid h-fit gap-5">
            <section className="rounded-[1rem] border border-[#102c3d]/[0.065] bg-white p-4 shadow-[0_10px_28px_rgba(16,44,61,0.045)]">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#c95568]">Provider matching</p>
              <h2 className="mt-1 text-lg font-semibold text-[#102c3d]">Shortlist preview</h2>
              <textarea value={matchQuery} onChange={(event) => setMatchQuery(event.target.value)} rows={3} className="mt-3 w-full rounded-xl border border-[#102c3d]/[0.08] bg-[#f8fbfa] px-3 py-2 text-sm outline-none focus:border-[#159b8f] focus:ring-4 focus:ring-[#159b8f]/10" />
              <div className="mt-3 grid gap-2">
                {shortlist.slice(0, 4).map((item) => <div key={item.provider.providerId} className="rounded-xl bg-[#f8fbfa] px-3 py-2 ring-1 ring-[#102c3d]/[0.055]"><p className="text-sm font-semibold text-[#102c3d]">{item.provider.providerName}</p><p className="text-xs text-[#102c3d]/52">Fit score {item.score}% | {item.reasons.join(", ")}</p></div>)}
              </div>
            </section>
          </aside>
        </div>
      </div>

      {profileProvider ? <ProviderProfile provider={profileProvider} onClose={() => setProfileId(null)} onEdit={setProviderDraft} onArchive={archiveProvider} onAddProgramme={(provider) => setProgrammeDraft({ providerId: provider.providerId, programme: blankProgramme(provider.providerId, provider.programmes.length + 1, provider.website) })} onEditProgramme={(providerId, programme) => setProgrammeDraft({ providerId, programme })} /> : null}
      {providerDraft ? <ProviderForm draft={providerDraft} onDraft={setProviderDraft} onSubmit={saveProvider} onClose={() => setProviderDraft(null)} /> : null}
      {programmeDraft ? <ProgrammeForm draft={programmeDraft.programme} onDraft={(programme) => setProgrammeDraft({ ...programmeDraft, programme })} onSubmit={saveProgramme} onClose={() => setProgrammeDraft(null)} /> : null}
    </main>
  );
}

function ProviderTable({ providers, selectedProviderId, onSelect, onOpen, onEdit, onArchive }: { providers: ProviderCatalogueRecord[]; selectedProviderId: string; onSelect: (provider: ProviderCatalogueRecord) => void; onOpen: (provider: ProviderCatalogueRecord) => void; onEdit: (provider: ProviderCatalogueRecord) => void; onArchive: (provider: ProviderCatalogueRecord) => void }) {
  return <div className="overflow-x-auto"><table className="min-w-[1080px] w-full border-collapse text-left text-sm"><thead className="bg-[#f8fbfa] text-[10px] font-semibold uppercase tracking-[0.14em] text-[#102c3d]/40"><tr><th className="px-4 py-3">Provider</th><th className="px-4 py-3">Sectors</th><th className="px-4 py-3">Programmes</th><th className="px-4 py-3">Delivery</th><th className="px-4 py-3">Regions</th><th className="px-4 py-3">Verification</th><th className="px-4 py-3 text-right">Actions</th></tr></thead><tbody className="divide-y divide-[#102c3d]/[0.055] bg-white">{providers.length ? providers.map((provider) => <tr key={provider.providerId} onClick={() => onSelect(provider)} className={`transition hover:bg-[#f8fbfa] ${selectedProviderId === provider.providerId ? "bg-[#f8fbfa]" : ""}`}><td className="px-4 py-3 align-top"><button type="button" onClick={(event) => { event.stopPropagation(); onOpen(provider); }} className="text-left"><span className="block font-semibold text-[#102c3d]">{provider.providerName}</span><span className="mt-1 block text-xs text-[#102c3d]/48">{provider.website}</span></button></td><td className="px-4 py-3 align-top text-[#102c3d]/62">{provider.sectors.slice(0, 4).join(", ")}</td><td className="px-4 py-3 align-top"><Pill>{provider.programmes.length} programmes</Pill></td><td className="px-4 py-3 align-top text-[#102c3d]/62">{provider.deliveryModel.join(", ")}</td><td className="px-4 py-3 align-top text-[#102c3d]/62">{provider.regions.join(", ")}</td><td className="px-4 py-3 align-top"><VerificationBadge status={provider.verificationStatus} /></td><td className="px-4 py-3 align-top"><div className="flex justify-end gap-2"><button type="button" onClick={(event) => { event.stopPropagation(); onEdit(provider); }} className="rounded-full bg-[#f5f7f3] px-3 py-1.5 text-xs font-semibold text-[#102c3d] ring-1 ring-[#102c3d]/[0.06]">Edit</button><button type="button" onClick={(event) => { event.stopPropagation(); onArchive(provider); }} className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-[#102c3d]/58 ring-1 ring-[#102c3d]/[0.08]">{provider.status === "Archived" ? "Restore" : "Archive"}</button></div></td></tr>) : <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-[#102c3d]/54">No providers match the current filters.</td></tr>}</tbody></table></div>;
}

function ProviderProfile({ provider, onClose, onEdit, onArchive, onAddProgramme, onEditProgramme }: { provider: ProviderCatalogueRecord; onClose: () => void; onEdit: (provider: ProviderCatalogueRecord) => void; onArchive: (provider: ProviderCatalogueRecord) => void; onAddProgramme: (provider: ProviderCatalogueRecord) => void; onEditProgramme: (providerId: string, programme: ProviderProgramme) => void }) {
  return <div className="fixed inset-0 z-50 overflow-y-auto bg-[#102c3d]/30 px-4 py-8 backdrop-blur-sm"><section className="mx-auto max-w-6xl rounded-[1.25rem] bg-white p-5 shadow-[0_30px_90px_rgba(16,44,61,0.24)]"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#c95568]">Provider profile</p><h2 className="mt-1 text-2xl font-semibold tracking-[-0.025em] text-[#102c3d]">{provider.providerName}</h2><p className="mt-1 text-sm text-[#102c3d]/54">{provider.website}</p></div><div className="flex flex-wrap gap-2"><button onClick={() => onAddProgramme(provider)} className="h-10 rounded-full bg-[#f5f7f3] px-4 text-xs font-semibold text-[#102c3d] ring-1 ring-[#102c3d]/[0.06]">Add programme</button><button onClick={() => onEdit(provider)} className="h-10 rounded-full bg-[#102c3d] px-4 text-xs font-semibold text-white">Edit provider</button><button onClick={() => onArchive(provider)} className="h-10 rounded-full bg-white px-4 text-xs font-semibold text-[#102c3d]/58 ring-1 ring-[#102c3d]/[0.08]">{provider.status === "Archived" ? "Restore" : "Archive"}</button><button onClick={onClose} className="h-10 rounded-full bg-[#f5f7f3] px-4 text-xs font-semibold text-[#102c3d] ring-1 ring-[#102c3d]/[0.06]">Close</button></div></div><div className="mt-5 grid gap-4 lg:grid-cols-3"><Fact label="Provider type" value={provider.providerType} /><Fact label="Ofsted" value={provider.ofstedRating} /><Fact label="Verification" value={provider.verificationStatus.replace("_", " ")} /></div><p className="mt-5 rounded-2xl bg-[#f8fbfa] p-4 text-sm leading-6 text-[#102c3d]/62">{provider.notes}</p><div className="mt-5 overflow-hidden rounded-2xl ring-1 ring-[#102c3d]/[0.06]"><table className="min-w-full text-left text-sm"><thead className="bg-[#f8fbfa] text-[10px] uppercase tracking-[0.14em] text-[#102c3d]/40"><tr><th className="px-4 py-3">Programme</th><th className="px-4 py-3">Sector</th><th className="px-4 py-3">Funding</th><th className="px-4 py-3">Verification</th><th className="px-4 py-3 text-right">Action</th></tr></thead><tbody className="divide-y divide-[#102c3d]/[0.055]">{provider.programmes.map((programme) => <tr key={programme.programmeId}><td className="px-4 py-3"><span className="font-semibold text-[#102c3d]">{programme.programmeName}</span><span className="mt-1 block text-xs text-[#102c3d]/52">{programme.level} | {programme.standardName}</span></td><td className="px-4 py-3 text-[#102c3d]/62">{programme.sector}</td><td className="px-4 py-3 text-[#102c3d]/62">{fundingLabel(programme)}</td><td className="px-4 py-3"><VerificationBadge status={programme.verificationStatus} /></td><td className="px-4 py-3 text-right"><button onClick={() => onEditProgramme(provider.providerId, programme)} className="rounded-full bg-[#f5f7f3] px-3 py-1.5 text-xs font-semibold text-[#102c3d] ring-1 ring-[#102c3d]/[0.06]">Edit</button></td></tr>)}</tbody></table></div></section></div>;
}

function ProviderForm({ draft, onDraft, onSubmit, onClose }: { draft: ProviderCatalogueRecord; onDraft: (draft: ProviderCatalogueRecord) => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void; onClose: () => void }) {
  return <ModalForm title="Provider record" onSubmit={onSubmit} onClose={onClose}><FormField label="Provider name" value={draft.providerName} onChange={(value) => onDraft({ ...draft, providerName: value })} /><FormField label="Website" value={draft.website} onChange={(value) => onDraft({ ...draft, website: value })} /><FormField label="Sectors" value={draft.sectors.join(", ")} onChange={(value) => onDraft({ ...draft, sectors: splitList(value) })} /><FormField label="Delivery models" value={draft.deliveryModel.join(", ")} onChange={(value) => onDraft({ ...draft, deliveryModel: splitList(value) })} /><FormField label="Regions" value={draft.regions.join(", ")} onChange={(value) => onDraft({ ...draft, regions: splitList(value) })} /><FormField label="Contact email" value={draft.contactEmail} onChange={(value) => onDraft({ ...draft, contactEmail: value })} /><FormField label="Notes" value={draft.notes} onChange={(value) => onDraft({ ...draft, notes: value })} wide /><button className="h-10 rounded-full bg-[#102c3d] px-5 text-xs font-semibold text-white">Save provider</button></ModalForm>;
}

function ProgrammeForm({ draft, onDraft, onSubmit, onClose }: { draft: ProviderProgramme; onDraft: (draft: ProviderProgramme) => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void; onClose: () => void }) {
  return <ModalForm title="Programme record" onSubmit={onSubmit} onClose={onClose}><FormField label="Programme name" value={draft.programmeName} onChange={(value) => onDraft({ ...draft, programmeName: value })} /><FormField label="Level" value={draft.level} onChange={(value) => onDraft({ ...draft, level: value })} /><FormField label="Standard" value={draft.standardName} onChange={(value) => onDraft({ ...draft, standardName: value })} /><FormField label="Sector" value={draft.sector} onChange={(value) => onDraft({ ...draft, sector: value })} /><FormField label="Delivery mode" value={draft.deliveryMode} onChange={(value) => onDraft({ ...draft, deliveryMode: value })} /><FormField label="Tags" value={draft.tags.join(", ")} onChange={(value) => onDraft({ ...draft, tags: splitList(value), suitableRoles: splitList(value) })} wide /><button className="h-10 rounded-full bg-[#102c3d] px-5 text-xs font-semibold text-white">Save programme</button></ModalForm>;
}

function ModalForm({ title, children, onSubmit, onClose }: { title: string; children: ReactNode; onSubmit: (event: FormEvent<HTMLFormElement>) => void; onClose: () => void }) {
  return <div className="fixed inset-0 z-50 grid place-items-center bg-[#102c3d]/30 px-4 py-8 backdrop-blur-sm"><form onSubmit={onSubmit} className="w-full max-w-4xl rounded-[1.25rem] bg-white p-5 shadow-[0_30px_90px_rgba(16,44,61,0.24)]"><div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#c95568]">Edit</p><h2 className="mt-1 text-2xl font-semibold text-[#102c3d]">{title}</h2></div><button type="button" onClick={onClose} className="h-10 rounded-full bg-[#f5f7f3] px-4 text-xs font-semibold text-[#102c3d] ring-1 ring-[#102c3d]/[0.06]">Close</button></div><div className="mt-5 grid gap-4 md:grid-cols-2">{children}</div></form></div>;
}

function FilterSelect({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) { return <label className="grid gap-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-[#102c3d]/38">{label}<select value={value} onChange={(event) => onChange(event.target.value)} className="h-10 min-w-0 rounded-xl border border-[#102c3d]/[0.08] bg-white px-3 text-sm font-semibold normal-case tracking-normal text-[#102c3d]/72 outline-none focus:border-[#159b8f] focus:ring-4 focus:ring-[#159b8f]/10">{options.map((option) => <option key={option}>{option}</option>)}</select></label>; }
function FormField({ label, value, onChange, wide = false }: { label: string; value: string; onChange: (value: string) => void; wide?: boolean }) { return <label className={`grid gap-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-[#102c3d]/42 ${wide ? "md:col-span-2" : ""}`}>{label}<input value={value} onChange={(event) => onChange(event.target.value)} className="h-11 rounded-xl border border-[#102c3d]/[0.08] bg-[#f8fbfa] px-3 text-sm font-medium normal-case tracking-normal text-[#102c3d] outline-none focus:border-[#159b8f] focus:bg-white focus:ring-4 focus:ring-[#159b8f]/10" /></label>; }
function Pill({ children }: { children: ReactNode }) { return <span className="inline-flex w-fit rounded-full bg-[#f5f7f3] px-3 py-1.5 text-xs font-semibold text-[#102c3d]/62 ring-1 ring-[#102c3d]/[0.06]">{children}</span>; }
function VerificationBadge({ status }: { status: string }) { const verified = status === "verified"; return <span className={`inline-flex w-fit rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ${verified ? "bg-[#edf8f5] text-[#0b6f63] ring-[#159b8f]/[0.14]" : "bg-[#fff4bd] text-[#7b6100] ring-[#8a6a00]/[0.08]"}`}>{status.replace("_", " ")}</span>; }
function Fact({ label, value }: { label: string; value: string }) { return <div className="rounded-xl bg-[#f8fbfa] px-3 py-2.5"><dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#102c3d]/36">{label}</dt><dd className="mt-1 text-sm font-semibold text-[#102c3d]">{value}</dd></div>; }
function splitList(value: string) { return value.split(",").map((item) => item.trim()).filter(Boolean); }
function tidyList(value: string[]) { return value.map((item) => item.trim()).filter(Boolean); }
function blankProvider(): ProviderCatalogueRecord { return { providerId: `provider-new-${Date.now()}`, providerName: "", website: "", providerType: "Independent training provider", sectors: [], programmes: [], deliveryModel: [], regions: ["England"], contactName: "LevyTate provider relationship team", contactEmail: "", ofstedRating: "Requires verification", status: "Active", sourceUrls: [], notes: "", lastVerified: new Date().toISOString().slice(0, 10), verificationStatus: "needs_verification" }; }
function blankProgramme(providerId: string, index: number, website: string): ProviderProgramme { return { programmeId: `${providerId}-programme-${Date.now()}-${index}`, programmeName: "", level: "Level 3", standardName: "", sector: "Business", deliveryMode: "Provider confirmation required", typicalDuration: "Programme dependent", fundingStatus: "potentially_levy_or_co_investment", availableForNewRecommendations: true, suitableRoles: [], tags: [], sourceUrl: website, verificationStatus: "needs_verification" }; }