"use client";

import {
  ArrowLeft,
  Building2,
  Check,
  ExternalLink,
  GitCompareArrows,
  GraduationCap,
  MapPin,
  Search,
  Timer,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLevyTateStandards } from "@/components/levytate-mvp/LevyTateStandardsProvider";
import { useMvpWorkspace } from "@/components/levytate-mvp/MvpWorkspaceStore";
import { SemanticStatus } from "@/components/levytate-mvp/OperationalVisuals";
import type { ApprenticeshipStandard, ProviderCatalogueRecord, ProviderProgramme } from "@/lib/levytate/domain";

type DirectoryProgramme = {
  programme: ProviderProgramme;
  provider: ProviderCatalogueRecord;
  standard: ApprenticeshipStandard | undefined;
};

type Filters = {
  search: string;
  level: string;
  provider: string;
  delivery: string;
  location: string;
  category: string;
};

type MarketplaceView = "Programmes" | "Providers";

const emptyFilters: Filters = { search: "", level: "All", provider: "All", delivery: "All", location: "All", category: "All" };
const missingInformation = "Further programme information is being reviewed.";
const directoryPageSize = 24;

function clean(value: string | undefined | null) {
  return value?.trim() || "";
}

function unique(values: Array<string | undefined | null>) {
  return [...new Set(values.map(clean).filter(Boolean))].sort((left, right) => left.localeCompare(right));
}

function levelLabel(item: DirectoryProgramme) {
  const level = item.programme.level ?? item.standard?.level;
  return level ? `Level ${level}` : "Level being reviewed";
}

function levelMarker(item: DirectoryProgramme) {
  const level = item.programme.level ?? item.standard?.level;
  return level ? `L${level}` : "Level —";
}

function standardLabel(item: DirectoryProgramme) {
  return item.standard?.title || clean(item.programme.linkedStandardName) || "Standard information being reviewed";
}

function categoryLabel(item: DirectoryProgramme) {
  return clean(item.programme.route) || item.programme.targetIndustries[0] || item.provider.sectors[0] || "General";
}

function coverageLabel(programme: ProviderProgramme, provider: ProviderCatalogueRecord) {
  const locations = unique([...programme.commercialProfile.locations, ...programme.regions, ...provider.regions]);
  if (provider.providerType === "National provider" || locations.includes("England")) return "National delivery";
  return locations.join(", ") || "Location being reviewed";
}

function deliveryLabel(programme: ProviderProgramme, provider: ProviderCatalogueRecord) {
  return unique([...programme.deliveryModels, ...provider.deliveryModels]).join(", ") || "Delivery model being reviewed";
}

function durationLabel(programme: ProviderProgramme) {
  const duration = clean(programme.duration);
  if (!duration) return "Duration being reviewed";
  return /^\d+$/.test(duration) ? `${duration} months` : duration;
}

function verificationLabel(programme: ProviderProgramme, provider: ProviderCatalogueRecord) {
  const verifiedProgramme = programme.verificationStatus !== "Needs manual verification";
  return verifiedProgramme && provider.verificationStatus === "verified" ? "Information verified" : "Information awaiting review";
}

function programmeSearchIndex(item: DirectoryProgramme) {
  return [
    item.programme.programmeName,
    item.provider.providerName,
    standardLabel(item),
    item.standard?.referenceCode,
    item.programme.shortDescription,
    item.programme.fullDescription,
    item.programme.targetJobRoles,
    item.programme.targetIndustries,
    item.programme.skillsDeveloped,
    item.programme.technologiesCovered,
    item.programme.deliveryModels,
    item.programme.regions,
    item.programme.commercialProfile.typicalDepartments,
    item.programme.commercialProfile.locations,
    item.programme.route,
  ].flat().join(" ").toLowerCase();
}

function matchesSearch(index: string, term: string) {
  if (term === "ai") return /\b(ai|artificial intelligence)\b/.test(index);
  return index.includes(term);
}

export function EmployerProgrammeDirectory() {
  const { data, saveOrganisationProvider, saveOrganisationProgramme } = useMvpWorkspace();
  const { selectableStandards } = useLevyTateStandards();
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [view, setView] = useState<MarketplaceView>("Programmes");
  const [programmeId, setProgrammeId] = useState<string | null>(null);
  const [providerId, setProviderId] = useState<string | null>(null);
  const [comparison, setComparison] = useState<string[]>([]);
  const [visibleCount, setVisibleCount] = useState(directoryPageSize);

  const directory = useMemo(() => data.providerProgrammes
    .filter((programme) => programme.recordStatus === "Active" && programme.status === "Active")
    .map((programme) => {
      const provider = data.providers.find((candidate) => candidate.providerId === programme.providerId && candidate.status === "Active");
      if (!provider) return null;
      const standard = selectableStandards.find((candidate) => programme.linkedStandardIds.includes(candidate.id) || candidate.id === programme.linkedStandardId);
      return { programme, provider, standard } satisfies DirectoryProgramme;
    })
    .filter((item): item is DirectoryProgramme => Boolean(item))
    .sort((left, right) => left.programme.programmeName.localeCompare(right.programme.programmeName) || left.provider.providerName.localeCompare(right.provider.providerName)), [data.providerProgrammes, data.providers, selectableStandards]);

  useEffect(() => {
    function readDeepLink() {
      const params = new URLSearchParams(window.location.search);
      const requestedProgramme = params.get("programme");
      const requestedProvider = params.get("provider");
      setProgrammeId(directory.some((item) => item.programme.id === requestedProgramme) ? requestedProgramme : null);
      setProviderId(!requestedProgramme && directory.some((item) => item.provider.providerId === requestedProvider) ? requestedProvider : null);
    }
    readDeepLink();
    window.addEventListener("popstate", readDeepLink);
    return () => window.removeEventListener("popstate", readDeepLink);
  }, [directory]);

  const options = useMemo(() => ({
    levels: unique(directory.map(levelLabel)),
    providers: unique(directory.map((item) => item.provider.providerName)),
    delivery: unique(directory.flatMap((item) => item.programme.deliveryModels)),
    locations: unique(directory.map((item) => coverageLabel(item.programme, item.provider))),
    categories: unique(directory.map(categoryLabel)),
  }), [directory]);

  const results = useMemo(() => directory.filter((item) => {
    const term = filters.search.trim().toLowerCase();
    return (!term || matchesSearch(programmeSearchIndex(item), term))
      && (filters.level === "All" || levelLabel(item) === filters.level)
      && (filters.provider === "All" || item.provider.providerName === filters.provider)
      && (filters.delivery === "All" || item.programme.deliveryModels.includes(filters.delivery) || item.provider.deliveryModels.includes(filters.delivery))
      && (filters.location === "All" || coverageLabel(item.programme, item.provider) === filters.location)
      && (filters.category === "All" || categoryLabel(item) === filters.category);
  }), [directory, filters]);
  const visibleResults = results.slice(0, visibleCount);
  const providerResults = useMemo(() => [...new Map(results.map((item) => [item.provider.providerId, item.provider])).values()], [results]);
  const visibleProviderResults = providerResults.slice(0, visibleCount);

  useEffect(() => setVisibleCount(directoryPageSize), [filters]);

  const selectedProgramme = programmeId ? directory.find((item) => item.programme.id === programmeId) ?? null : null;
  const selectedProvider = providerId ? data.providers.find((provider) => provider.providerId === providerId && provider.status === "Active") ?? null : null;
  const providerProgrammes = selectedProvider ? directory.filter((item) => item.provider.providerId === selectedProvider.providerId) : [];
  const compared = comparison.map((id) => directory.find((item) => item.programme.id === id)).filter((item): item is DirectoryProgramme => Boolean(item));

  function updateFilter(key: keyof Filters, value: string) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function setUrl(next: { programme?: string; provider?: string }) {
    const params = new URLSearchParams({ module: "Marketplace" });
    if (next.programme) params.set("programme", next.programme);
    if (next.provider) params.set("provider", next.provider);
    window.history.replaceState(null, "", `/levytate/app?${params.toString()}`);
  }

  function openProgramme(id: string) {
    setProviderId(null);
    setProgrammeId(id);
    setUrl({ programme: id });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function openProvider(id: string) {
    setProgrammeId(null);
    setProviderId(id);
    setUrl({ provider: id });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function back() {
    setProgrammeId(null);
    setProviderId(null);
    setUrl({});
  }

  function toggleComparison(id: string) {
    setComparison((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id].slice(-3));
  }

  function addProvider(id: string) {
    const now = new Date().toISOString();
    saveOrganisationProvider({ providerId: id, status: "Active", selectedAt: now, updatedAt: now });
  }

  function addProgramme(item: DirectoryProgramme) {
    const now = new Date().toISOString();
    saveOrganisationProgramme({ programmeId: item.programme.id, providerId: item.provider.providerId, status: "Active", selectedAt: now, updatedAt: now });
  }

  if (selectedProgramme) return <ProgrammeDetail item={selectedProgramme} selected={data.organisationProgrammes.some((item) => item.programmeId === selectedProgramme.programme.id && item.status === "Active")} onAdd={() => addProgramme(selectedProgramme)} onBack={back} onProvider={() => openProvider(selectedProgramme.provider.providerId)} />;
  if (selectedProvider) return <ProviderProfile provider={selectedProvider} programmes={providerProgrammes} selected={data.organisationProviders.some((item) => item.providerId === selectedProvider.providerId && item.status === "Active")} onAdd={() => addProvider(selectedProvider.providerId)} onBack={back} onProgramme={openProgramme} />;

  const visibleProviders = new Set(results.map((item) => item.provider.providerId)).size;
  return (
    <div className="grid gap-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#0b8e82]">Global factual marketplace</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-0.03em] text-[#102c3d]">Providers and apprenticeship programmes</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#102c3d]/[0.58]">Browse LevyTate’s verified catalogue, then add only the providers and programmes your organisation uses.</p>
      </header>

      <div className="flex w-fit rounded-full bg-[#edf3f0] p-1" role="tablist" aria-label="Marketplace view">
        {(["Programmes", "Providers"] as MarketplaceView[]).map((item) => <button key={item} type="button" role="tab" aria-selected={view === item} onClick={() => { setView(item); setVisibleCount(directoryPageSize); }} className={`min-h-11 rounded-full px-5 text-sm font-semibold ${view === item ? "bg-white text-[#102c3d] shadow-sm" : "text-[#102c3d]/[0.58]"}`}>{item}</button>)}
      </div>

      <section aria-label="Directory summary" className="grid grid-cols-2 border-y border-[#102c3d]/[0.08] sm:max-w-md">
        <Count label="Programmes" value={results.length} />
        <Count label="Providers" value={visibleProviders} />
      </section>

      <section aria-label="Programme directory filters" className="grid gap-3 border-y border-[#102c3d]/[0.07] bg-white py-4">
        <label className="relative block">
          <Search className="absolute left-4 top-3.5 text-[#102c3d]/[0.40]" size={18} aria-hidden="true" />
          <span className="sr-only">Search programmes and providers</span>
          <input value={filters.search} onChange={(event) => updateFilter("search", event.target.value)} placeholder="Search programmes, providers, standards, roles or skills" className="min-h-12 w-full rounded-xl border border-[#102c3d]/[0.10] bg-[#fbfcfb] pl-11 pr-4 text-sm outline-none transition focus:border-[#159b8f] focus:ring-4 focus:ring-[#159b8f]/[0.10]" />
        </label>
        <div className="grid gap-2 sm:grid-cols-2 lg:max-w-2xl">
          <Filter label="Level" value={filters.level} values={options.levels} onChange={(value) => updateFilter("level", value)} />
          <Filter label="Provider" value={filters.provider} values={options.providers} onChange={(value) => updateFilter("provider", value)} />
        </div>
        <details><summary className="min-h-11 w-fit cursor-pointer py-3 text-xs font-semibold text-[#0b6f63]">More filters</summary><div className="grid gap-2 border-t border-[#102c3d]/[0.06] pt-3 sm:grid-cols-3"><Filter label="Delivery" value={filters.delivery} values={options.delivery} onChange={(value) => updateFilter("delivery", value)} /><Filter label="Location" value={filters.location} values={options.locations} onChange={(value) => updateFilter("location", value)} /><Filter label="Category" value={filters.category} values={options.categories} onChange={(value) => updateFilter("category", value)} /></div></details>
        {Object.values(filters).some((value) => value && value !== "All") ? <button type="button" onClick={() => setFilters(emptyFilters)} className="min-h-11 w-fit rounded-full px-4 text-sm font-semibold text-[#0b6f63] hover:bg-[#edf7f3] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#159b8f]">Clear filters</button> : null}
      </section>

      {view === "Programmes" && results.length ? (
        <section aria-label="Programme results" className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visibleResults.map((item) => <ProgrammeCard key={item.programme.id} item={item} selected={data.organisationProgrammes.some((selection) => selection.programmeId === item.programme.id && selection.status === "Active")} compared={comparison.includes(item.programme.id)} onOpen={() => openProgramme(item.programme.id)} onAdd={() => addProgramme(item)} onCompare={() => toggleComparison(item.programme.id)} />)}
        </section>
      ) : null}

      {view === "Providers" && providerResults.length ? (
        <section aria-label="Provider results" className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visibleProviderResults.map((provider) => <ProviderCard key={provider.providerId} provider={provider} programmeCount={directory.filter((item) => item.provider.providerId === provider.providerId).length} selected={data.organisationProviders.some((selection) => selection.providerId === provider.providerId && selection.status === "Active")} onOpen={() => openProvider(provider.providerId)} onAdd={() => addProvider(provider.providerId)} />)}
        </section>
      ) : null}

      {view === "Programmes" && !results.length ? <p className="rounded-2xl border border-dashed border-[#102c3d]/[0.15] py-12 text-center text-sm text-[#102c3d]/[0.55]">No programmes match the selected filters.</p> : null}
      {view === "Providers" && !providerResults.length ? <p className="rounded-2xl border border-dashed border-[#102c3d]/[0.15] py-12 text-center text-sm text-[#102c3d]/[0.55]">No providers match the selected filters.</p> : null}

      {view === "Programmes" && visibleResults.length < results.length ? <button type="button" onClick={() => setVisibleCount((current) => Math.min(current + directoryPageSize, results.length))} className="mx-auto min-h-11 rounded-full border border-[#102c3d]/[0.10] bg-white px-5 text-sm font-semibold text-[#102c3d] hover:bg-[#edf7f3] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#159b8f]">Load more programmes</button> : null}
      {view === "Providers" && visibleProviderResults.length < providerResults.length ? <button type="button" onClick={() => setVisibleCount((current) => Math.min(current + directoryPageSize, providerResults.length))} className="mx-auto min-h-11 rounded-full border border-[#102c3d]/[0.10] bg-white px-5 text-sm font-semibold text-[#102c3d] hover:bg-[#edf7f3] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#159b8f]">Load more providers</button> : null}

      {view === "Programmes" && compared.length ? <ProgrammeComparison items={compared} onRemove={toggleComparison} onOpen={openProgramme} /> : null}
    </div>
  );
}

function Count({ label, value }: { label: string; value: number }) {
  return <div className="border-r border-[#102c3d]/[0.08] px-4 py-3 last:border-r-0"><p className="text-2xl font-semibold tabular-nums text-[#102c3d]">{value}</p><p className="mt-1 text-xs font-semibold text-[#102c3d]/[0.55]">{label}</p></div>;
}

function Filter({ label, value, values, onChange }: { label: string; value: string; values: string[]; onChange: (value: string) => void }) {
  return <label className="grid gap-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#102c3d]/[0.45]">{label}<select aria-label={label} value={value} onChange={(event) => onChange(event.target.value)} className="min-h-11 min-w-0 rounded-xl border border-[#102c3d]/[0.10] bg-white px-3 text-sm font-semibold normal-case tracking-normal text-[#102c3d]"><option>All</option>{values.map((item) => <option key={item}>{item}</option>)}</select></label>;
}

function ProviderCard({ provider, programmeCount, selected, onOpen, onAdd }: { provider: ProviderCatalogueRecord; programmeCount: number; selected: boolean; onOpen: () => void; onAdd: () => void }) {
  return (
    <article className="flex min-h-[260px] flex-col border border-[#102c3d]/[0.08] bg-white p-5 shadow-[0_10px_24px_rgba(16,44,61,0.035)]">
      <div className="flex items-start justify-between gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#eaf5f1] text-[#0b776e]"><Building2 size={19} /></span><SemanticStatus label={provider.verificationStatus === "verified" ? "Information verified" : "Information awaiting review"} tone={provider.verificationStatus === "verified" ? "healthy" : "watch"} /></div>
      <h2 className="mt-4 text-xl font-semibold tracking-[-0.02em]">{provider.providerName}</h2>
      <p className="mt-2 text-sm leading-6 text-[#102c3d]/[0.58]">{provider.specialisms.slice(0, 3).join(", ") || "Provider specialisms are being reviewed."}</p>
      <dl className="mt-4 grid grid-cols-2 gap-3"><DetailFact label="Programmes" value={String(programmeCount)} /><DetailFact label="Coverage" value={provider.regions.slice(0, 2).join(", ") || "Being reviewed"} /></dl>
      <div className="mt-auto grid gap-2 pt-5"><button type="button" onClick={onOpen} className="min-h-11 rounded-full bg-[#102c3d] px-4 text-sm font-semibold text-white">View provider</button><button type="button" disabled={selected} onClick={onAdd} className="min-h-11 rounded-full border border-[#159b8f]/[0.22] px-4 text-sm font-semibold text-[#0b6f63] disabled:bg-[#edf7f3] disabled:text-[#0b6f63]/70">{selected ? "In My Providers" : "Add to My Providers"}</button></div>
    </article>
  );
}

function ProgrammeCard({ item, selected, compared, onOpen, onAdd, onCompare }: { item: DirectoryProgramme; selected: boolean; compared: boolean; onOpen: () => void; onAdd: () => void; onCompare: () => void }) {
  return (
    <article className="flex min-h-[275px] flex-col border border-[#102c3d]/[0.08] bg-white p-5 shadow-[0_10px_24px_rgba(16,44,61,0.035)]">
      <div className="flex items-start justify-between gap-3"><span className="inline-flex h-9 min-w-9 items-center justify-center rounded-lg bg-[#eef5fa] px-2 text-sm font-semibold text-[#315d78]">{levelMarker(item)}</span><SemanticStatus label={verificationLabel(item.programme, item.provider)} tone={verificationLabel(item.programme, item.provider) === "Information verified" ? "healthy" : "watch"} /></div>
      <h2 className="mt-4 text-xl font-semibold tracking-[-0.02em]">{item.programme.programmeName}</h2>
      <p className="mt-2 text-sm font-semibold text-[#0b6f63]">{item.provider.providerName}</p>
      <dl className="mt-4 grid gap-2 text-xs text-[#102c3d]/[0.58]"><Fact icon={GraduationCap} value={standardLabel(item)} /><Fact icon={Timer} value={durationLabel(item.programme)} /><Fact icon={Building2} value={deliveryLabel(item.programme, item.provider)} /><Fact icon={MapPin} value={coverageLabel(item.programme, item.provider)} /></dl>
      <div className="mt-auto grid gap-2 pt-5"><button type="button" onClick={onOpen} className="min-h-11 rounded-full bg-[#102c3d] px-4 text-sm font-semibold text-white hover:bg-[#17394d] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#159b8f]">View programme</button><div className="grid grid-cols-[1fr_auto] gap-2"><button type="button" disabled={selected} onClick={onAdd} className="min-h-11 rounded-full border border-[#159b8f]/[0.22] px-4 text-sm font-semibold text-[#0b6f63] disabled:bg-[#edf7f3] disabled:text-[#0b6f63]/70">{selected ? "In My Programmes" : "Add to My Programmes"}</button><button type="button" aria-label={`${compared ? "Remove" : "Add"} ${item.programme.programmeName} ${compared ? "from" : "to"} comparison`} onClick={onCompare} className={`grid min-h-11 min-w-11 place-items-center rounded-full ring-1 ${compared ? "bg-[#edf7f3] text-[#0b6f63] ring-[#159b8f]/[0.20]" : "bg-white text-[#102c3d]/[0.60] ring-[#102c3d]/[0.10]"}`}><GitCompareArrows size={17} /></button></div></div>
    </article>
  );
}

function Fact({ icon: Icon, value }: { icon: typeof GraduationCap; value: string }) {
  return <div className="flex items-start gap-2"><Icon size={14} className="mt-0.5 shrink-0 text-[#0b8e82]" aria-hidden="true" /><span>{value}</span></div>;
}

function ProgrammeDetail({ item, selected, onAdd, onBack, onProvider }: { item: DirectoryProgramme; selected: boolean; onAdd: () => void; onBack: () => void; onProvider: () => void }) {
  const overview = clean(item.programme.fullDescription) || clean(item.programme.shortDescription) || missingInformation;
  return (
    <div className="mx-auto grid max-w-5xl gap-5">
      <Back onClick={onBack}>Back to Programmes &amp; Providers</Back>
      <header className="rounded-[1.6rem] bg-[#eaf5f1] p-6 sm:p-8"><div className="flex flex-wrap gap-2"><Badge>{levelLabel(item)}</Badge><Badge>{verificationLabel(item.programme, item.provider)}</Badge></div><h1 className="mt-4 text-3xl font-semibold tracking-[-0.03em]">{item.programme.programmeName}</h1><button type="button" onClick={onProvider} className="mt-2 min-h-11 text-left text-sm font-semibold text-[#0b6f63] underline-offset-4 hover:underline">Delivered by {item.provider.providerName}</button><p className="mt-3 max-w-3xl text-sm leading-7 text-[#102c3d]/[0.65]">{overview}</p><button type="button" disabled={selected} onClick={onAdd} className="mt-5 min-h-11 rounded-full bg-[#102c3d] px-5 text-sm font-semibold text-white disabled:bg-[#0b6f63]">{selected ? "In My Programmes" : "Add provider and programme"}</button></header>
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><DetailFact label="Standard" value={standardLabel(item)} /><DetailFact label="Duration" value={durationLabel(item.programme)} /><DetailFact label="Delivery" value={deliveryLabel(item.programme, item.provider)} /><DetailFact label="Locations" value={coverageLabel(item.programme, item.provider)} /></section>
      <section className="grid gap-5 lg:grid-cols-2"><Info title="Typical learner activities" items={unique([...item.programme.skillsDeveloped, ...item.programme.technologiesCovered])} /><Info title="Suitable roles or teams" items={unique([...item.programme.targetJobRoles, ...item.programme.commercialProfile.typicalDepartments])} /><Copy title="Employer considerations" value={clean(item.programme.commercialProfile.employerCommitment) || missingInformation} /><Copy title="Learner support" value={clean(item.programme.commercialProfile.idealAudience) || missingInformation} /><Copy title="Assessment model" value={clean(item.programme.commercialProfile.assessmentApproach) || missingInformation} /><Info title="Programme outcomes" items={unique([...item.programme.commercialProfile.keyOutcomes, ...item.programme.expectedOutcomes])} /></section>
    </div>
  );
}

function ProviderProfile({ provider, programmes, selected, onAdd, onBack, onProgramme }: { provider: ProviderCatalogueRecord; programmes: DirectoryProgramme[]; selected: boolean; onAdd: () => void; onBack: () => void; onProgramme: (id: string) => void }) {
  const overview = clean(provider.commercialProfile.organisationDescription) || clean(provider.commercialProfile.positioningStatement) || "Further provider information is being reviewed.";
  const employerSupport = unique(programmes.map((item) => item.programme.commercialProfile.employerCommitment));
  return (
    <div className="mx-auto grid max-w-5xl gap-5">
      <Back onClick={onBack}>Back to Programmes &amp; Providers</Back>
      <header className="bg-[#102c3d] p-6 text-white sm:p-8"><p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#7ad1c5]">Provider profile</p><h1 className="mt-3 text-3xl font-semibold tracking-[-0.03em]">{provider.providerName}</h1><dl className="mt-5 grid gap-3 sm:grid-cols-4"><QuickFact label="Programmes" value={String(programmes.length)} /><QuickFact label="Delivery" value={unique(provider.deliveryModels).slice(0, 2).join(", ") || "Being reviewed"} /><QuickFact label="Coverage" value={unique(provider.regions).slice(0, 2).join(", ") || "Being reviewed"} /><QuickFact label="Specialisms" value={unique(provider.specialisms).slice(0, 2).join(", ") || "Being reviewed"} /></dl><button type="button" disabled={selected} onClick={onAdd} className="mt-5 min-h-11 rounded-full bg-white px-5 text-sm font-semibold text-[#102c3d] disabled:bg-[#82d7c8]">{selected ? "In My Providers" : "Add to My Providers"}</button><details className="mt-5 border-t border-white/[0.15] pt-3"><summary className="min-h-11 cursor-pointer py-3 text-xs font-semibold text-[#82d7c8]">About this provider</summary><p className="max-w-3xl text-sm leading-7 text-white/[0.72]">{overview}</p></details></header>
      <section className="grid gap-5 lg:grid-cols-2"><Info title="Delivery approach" items={unique(provider.deliveryModels)} /><Info title="Geographic coverage" items={unique(provider.regions)} /><Info title="Learner support" items={unique(programmes.flatMap((item) => item.programme.commercialProfile.idealAudience ? [item.programme.commercialProfile.idealAudience] : []))} /><Info title="Employer support" items={employerSupport} /></section>
      {provider.website ? <a href={provider.website} target="_blank" rel="noreferrer" className="inline-flex min-h-11 w-fit items-center gap-2 rounded-full bg-[#edf7f3] px-4 text-sm font-semibold text-[#0b6f63]">Visit provider website <ExternalLink size={15} /></a> : null}
      <section className="rounded-[1.4rem] border border-[#102c3d]/[0.07] bg-white p-5 sm:p-6"><h2 className="text-xl font-semibold">Programmes available</h2>{programmes.length ? <div className="mt-4 grid gap-3 md:grid-cols-2">{programmes.map((item) => <button key={item.programme.id} type="button" onClick={() => onProgramme(item.programme.id)} className="min-h-24 rounded-2xl bg-[#f6f9f7] p-4 text-left hover:bg-[#edf7f3] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#159b8f]"><span className="block text-sm font-semibold">{item.programme.programmeName}</span><span className="mt-2 block text-xs text-[#102c3d]/[0.55]">{levelLabel(item)} · {deliveryLabel(item.programme, item.provider)}</span></button>)}</div> : <p className="mt-4 text-sm text-[#102c3d]/[0.55]">No active programmes are currently listed for this provider.</p>}</section>
    </div>
  );
}

function ProgrammeComparison({ items, onRemove, onOpen }: { items: DirectoryProgramme[]; onRemove: (id: string) => void; onOpen: (id: string) => void }) {
  return <section aria-label="Programme comparison" className="rounded-[1.5rem] border border-[#102c3d]/[0.07] bg-[#f6f9f7] p-5 sm:p-6"><div className="flex items-center gap-2"><GitCompareArrows size={18} className="text-[#0b8e82]" /><h2 className="text-xl font-semibold">Compare programmes</h2><span className="text-xs text-[#102c3d]/[0.50]">Up to three</span></div><div className="mt-4 grid gap-3 lg:grid-cols-3">{items.map((item) => <article key={item.programme.id} className="rounded-2xl bg-white p-4"><h3 className="font-semibold">{item.programme.programmeName}</h3><p className="mt-1 text-sm text-[#0b6f63]">{item.provider.providerName}</p><dl className="mt-4 grid gap-2 text-sm"><CompareFact label="Level" value={levelLabel(item)} /><CompareFact label="Duration" value={durationLabel(item.programme)} /><CompareFact label="Delivery" value={deliveryLabel(item.programme, item.provider)} /><CompareFact label="Locations" value={coverageLabel(item.programme, item.provider)} /><CompareFact label="Standard" value={standardLabel(item)} /><CompareFact label="Assessment" value={clean(item.programme.commercialProfile.assessmentApproach) || "Being reviewed"} /></dl><div className="mt-4 flex gap-2"><button type="button" onClick={() => onOpen(item.programme.id)} className="min-h-11 rounded-full bg-[#102c3d] px-4 text-xs font-semibold text-white">View programme</button><button type="button" onClick={() => onRemove(item.programme.id)} className="min-h-11 rounded-full px-3 text-xs font-semibold text-[#102c3d]/[0.60]">Remove</button></div></article>)}</div><p className="mt-4 text-xs leading-5 text-[#102c3d]/[0.50]">Comparison presents factual programme differences so your organisation can make its own decision.</p></section>;
}

function Back({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return <button type="button" onClick={onClick} className="inline-flex min-h-11 w-fit items-center gap-2 rounded-full px-3 text-sm font-semibold hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#159b8f]"><ArrowLeft size={17} />{children}</button>;
}

function Badge({ children }: { children: string }) {
  return <span className="rounded-full bg-white/[0.70] px-3 py-1 text-xs font-semibold text-[#0b6f63]">{children}</span>;
}

function DetailFact({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl border border-[#102c3d]/[0.07] bg-white p-4"><dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#102c3d]/[0.45]">{label}</dt><dd className="mt-2 text-sm font-semibold leading-6">{value}</dd></div>;
}

function Copy({ title, value }: { title: string; value: string }) {
  return <section className="rounded-[1.4rem] border border-[#102c3d]/[0.07] bg-white p-5"><h2 className="text-lg font-semibold">{title}</h2><p className="mt-3 text-sm leading-7 text-[#102c3d]/[0.62]">{value}</p></section>;
}

function Info({ title, items }: { title: string; items: string[] }) {
  return <section className="rounded-[1.4rem] border border-[#102c3d]/[0.07] bg-white p-5"><h2 className="text-lg font-semibold">{title}</h2>{items.length ? <ul className="mt-3 grid gap-2">{items.map((item) => <li key={item} className="flex gap-2 text-sm leading-6 text-[#102c3d]/[0.62]"><Check size={15} className="mt-1 shrink-0 text-[#0b8e82]" />{item}</li>)}</ul> : <p className="mt-3 text-sm leading-6 text-[#102c3d]/[0.55]">{missingInformation}</p>}</section>;
}

function CompareFact({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#102c3d]/[0.42]">{label}</dt><dd className="mt-0.5 leading-5 text-[#102c3d]/[0.70]">{value}</dd></div>;
}

function QuickFact({ label, value }: { label: string; value: string }) {
  return <div className="border-l border-white/[0.2] pl-3"><dt className="text-[10px] font-semibold uppercase tracking-[0.1em] text-white/[0.55]">{label}</dt><dd className="mt-1 text-sm font-semibold leading-5 text-white">{value}</dd></div>;
}
