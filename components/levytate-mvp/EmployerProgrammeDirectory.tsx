"use client";

import {
  ArrowLeft,
  Building2,
  Check,
  ChevronDown,
  ExternalLink,
  GitCompareArrows,
  GraduationCap,
  MapPin,
  Search,
  SlidersHorizontal,
  Timer,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState, type KeyboardEvent } from "react";
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
type SelectFilterKey = Exclude<keyof Filters, "search">;

const emptyFilters: Filters = { search: "", level: "All", provider: "All", delivery: "All", location: "All", category: "All" };
const missingInformation = "Further programme information is being reviewed.";
const directoryPageSize = 24;
const marketplaceViews: MarketplaceView[] = ["Programmes", "Providers"];
const selectFilterLabels: Record<SelectFilterKey, string> = {
  level: "Level",
  provider: "Provider",
  delivery: "Delivery",
  location: "Location",
  category: "Category",
};

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

export function EmployerProgrammeDirectory({ onRequest }: { onRequest?: (context: { programmeId?: string; providerId?: string }) => void }) {
  const { data, meta, saveOrganisationProvider, saveOrganisationProgramme } = useMvpWorkspace();
  const { selectableStandards } = useLevyTateStandards();
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [view, setView] = useState<MarketplaceView>("Programmes");
  const [programmeId, setProgrammeId] = useState<string | null>(null);
  const [providerId, setProviderId] = useState<string | null>(null);
  const [comparison, setComparison] = useState<string[]>([]);
  const [visibleCount, setVisibleCount] = useState(directoryPageSize);
  const [advancedFiltersOpen, setAdvancedFiltersOpen] = useState(false);

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
  const activeSelectFilters = (Object.keys(selectFilterLabels) as SelectFilterKey[])
    .filter((key) => filters[key] !== "All")
    .map((key) => ({ key, label: selectFilterLabels[key], value: filters[key] }));
  const hasFilters = Boolean(filters.search.trim()) || activeSelectFilters.length > 0;

  useEffect(() => setVisibleCount(directoryPageSize), [filters]);

  const selectedProgramme = programmeId ? directory.find((item) => item.programme.id === programmeId) ?? null : null;
  const selectedProvider = providerId ? data.providers.find((provider) => provider.providerId === providerId && provider.status === "Active") ?? null : null;
  const providerProgrammes = selectedProvider ? directory.filter((item) => item.provider.providerId === selectedProvider.providerId) : [];
  const compared = comparison.map((id) => directory.find((item) => item.programme.id === id)).filter((item): item is DirectoryProgramme => Boolean(item));

  function updateFilter(key: keyof Filters, value: string) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function selectView(nextView: MarketplaceView) {
    setView(nextView);
    setVisibleCount(directoryPageSize);
  }

  function onViewKeyDown(event: KeyboardEvent<HTMLButtonElement>, currentView: MarketplaceView) {
    const currentIndex = marketplaceViews.indexOf(currentView);
    let nextIndex = currentIndex;
    if (event.key === "ArrowRight") nextIndex = (currentIndex + 1) % marketplaceViews.length;
    if (event.key === "ArrowLeft") nextIndex = (currentIndex - 1 + marketplaceViews.length) % marketplaceViews.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = marketplaceViews.length - 1;
    if (nextIndex === currentIndex) return;
    event.preventDefault();
    const nextView = marketplaceViews[nextIndex];
    selectView(nextView);
    event.currentTarget.parentElement?.querySelector<HTMLButtonElement>(`#marketplace-tab-${nextView.toLowerCase()}`)?.focus();
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

  if (selectedProgramme) return <ProgrammeDetail item={selectedProgramme} selected={data.organisationProgrammes.some((item) => item.programmeId === selectedProgramme.programme.id && item.status === "Active")} onAdd={() => addProgramme(selectedProgramme)} onBack={back} onProvider={() => openProvider(selectedProgramme.provider.providerId)} onRequest={meta?.requestsEnabled && onRequest ? () => onRequest({ programmeId: selectedProgramme.programme.id, providerId: selectedProgramme.provider.providerId }) : undefined} />;
  if (selectedProvider) return <ProviderProfile provider={selectedProvider} programmes={providerProgrammes} selected={data.organisationProviders.some((item) => item.providerId === selectedProvider.providerId && item.status === "Active")} onAdd={() => addProvider(selectedProvider.providerId)} onBack={back} onProgramme={openProgramme} onRequest={meta?.requestsEnabled && onRequest ? () => onRequest({ providerId: selectedProvider.providerId }) : undefined} />;

  const visibleProviders = new Set(results.map((item) => item.provider.providerId)).size;
  const resultSummary = view === "Programmes"
    ? `${results.length} programme${results.length === 1 ? "" : "s"} from ${visibleProviders} provider${visibleProviders === 1 ? "" : "s"}`
    : `${providerResults.length} provider${providerResults.length === 1 ? "" : "s"} offering ${results.length} programme${results.length === 1 ? "" : "s"}`;
  return (
    <div className="grid gap-5 text-[#27456a]">
      <section aria-labelledby="marketplace-directory-heading" className="grid gap-4 rounded-2xl border border-[#27456a]/[0.08] bg-[#fbf6f1] p-4 shadow-[0_12px_30px_rgba(39,69,106,0.035)] sm:p-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#17786e]">Global factual catalogue</p>
          <h2 id="marketplace-directory-heading" className="mt-1.5 text-2xl font-semibold tracking-[-0.025em] text-[#27456a]">Find providers and apprenticeship programmes</h2>
          <p className="mt-1.5 max-w-2xl text-sm leading-6 text-[#52677d]">Browse LevyTate’s verified catalogue information, then choose only the programmes and providers your organisation uses.</p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between lg:flex-col lg:items-end">
          <div className="inline-flex w-fit rounded-xl bg-[#e6eee9] p-1" role="tablist" aria-label="Marketplace view">
            {marketplaceViews.map((item) => (
              <button
                key={item}
                id={`marketplace-tab-${item.toLowerCase()}`}
                type="button"
                role="tab"
                aria-selected={view === item}
                aria-controls="marketplace-results"
                tabIndex={view === item ? 0 : -1}
                onClick={() => selectView(item)}
                onKeyDown={(event) => onViewKeyDown(event, item)}
                className={`min-h-11 rounded-lg px-5 text-sm font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#17786e] focus-visible:ring-offset-2 ${view === item ? "bg-white text-[#27456a] shadow-[0_5px_14px_rgba(39,69,106,0.08)]" : "text-[#5b6e7f] hover:bg-white/60 hover:text-[#27456a]"}`}
              >
                {item}
              </button>
            ))}
          </div>
          <p aria-live="polite" className="text-sm font-semibold tabular-nums text-[#52677d]">{resultSummary}</p>
        </div>
      </section>

      <section aria-label="Programme directory filters" className="rounded-2xl border border-[#27456a]/[0.09] bg-white p-4 shadow-[0_14px_34px_rgba(39,69,106,0.045)] sm:p-5">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#607487]" size={18} aria-hidden="true" />
          <span className="sr-only">Search programmes and providers</span>
          <input value={filters.search} onChange={(event) => updateFilter("search", event.target.value)} placeholder="Search programmes, providers, standards, roles or skills" className="h-12 w-full rounded-xl border border-[#8492a1] bg-[#fbfcfb] pl-11 pr-12 text-sm text-[#27456a] outline-none transition-[border-color,box-shadow,background-color] duration-150 placeholder:text-[#607487] hover:border-[#607487] focus:border-[#17786e] focus:bg-white focus:ring-4 focus:ring-[#17786e]/[0.12]" />
          {filters.search ? <button type="button" aria-label="Clear search" onClick={() => updateFilter("search", "")} className="absolute right-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-lg text-[#607487] transition-colors duration-150 hover:bg-[#e6eee9] hover:text-[#27456a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#17786e]"><X size={16} aria-hidden="true" /></button> : null}
        </label>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Filter label="Level" value={filters.level} values={options.levels} onChange={(value) => updateFilter("level", value)} />
          <Filter label="Provider" value={filters.provider} values={options.providers} onChange={(value) => updateFilter("provider", value)} />
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#27456a]/[0.08] pt-3">
          <button type="button" aria-expanded={advancedFiltersOpen} aria-controls="marketplace-advanced-filters" onClick={() => setAdvancedFiltersOpen((current) => !current)} className="inline-flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm font-semibold text-[#17786e] transition-colors duration-150 hover:bg-[#e6eee9]/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#17786e]"><SlidersHorizontal size={16} aria-hidden="true" />{advancedFiltersOpen ? "Fewer filters" : "More filters"}<ChevronDown size={15} className={`transition-transform duration-150 ${advancedFiltersOpen ? "rotate-180" : ""}`} aria-hidden="true" /></button>

          <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-2">
            {activeSelectFilters.map((filter) => <FilterChip key={filter.key} label={filter.label} value={filter.value} onRemove={() => updateFilter(filter.key, "All")} />)}
            {hasFilters ? <button type="button" onClick={() => setFilters(emptyFilters)} className="min-h-11 rounded-lg px-3 text-sm font-semibold text-[#52677d] underline decoration-[#52677d]/40 underline-offset-4 transition-colors duration-150 hover:text-[#27456a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#17786e]">Clear all filters</button> : null}
          </div>
        </div>

        {advancedFiltersOpen ? <div id="marketplace-advanced-filters" className="mt-3 grid gap-3 border-t border-[#27456a]/[0.08] pt-4 sm:grid-cols-2 lg:grid-cols-3"><Filter label="Delivery" value={filters.delivery} values={options.delivery} onChange={(value) => updateFilter("delivery", value)} /><Filter label="Location" value={filters.location} values={options.locations} onChange={(value) => updateFilter("location", value)} /><Filter label="Category" value={filters.category} values={options.categories} onChange={(value) => updateFilter("category", value)} /></div> : null}
      </section>

      <div className="flex flex-wrap items-baseline justify-between gap-2 px-1">
        <h2 className="text-lg font-semibold text-[#27456a]">{view}</h2>
        <p className="text-xs font-semibold text-[#607487]">Showing {view === "Programmes" ? visibleResults.length : visibleProviderResults.length} of {view === "Programmes" ? results.length : providerResults.length}</p>
      </div>

      {view === "Programmes" && results.length ? (
        <section id="marketplace-results" role="tabpanel" aria-labelledby="marketplace-tab-programmes" aria-label="Programme results" className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visibleResults.map((item) => <ProgrammeCard key={item.programme.id} item={item} selected={data.organisationProgrammes.some((selection) => selection.programmeId === item.programme.id && selection.status === "Active")} compared={comparison.includes(item.programme.id)} onOpen={() => openProgramme(item.programme.id)} onAdd={() => addProgramme(item)} onCompare={() => toggleComparison(item.programme.id)} />)}
        </section>
      ) : null}

      {view === "Providers" && providerResults.length ? (
        <section id="marketplace-results" role="tabpanel" aria-labelledby="marketplace-tab-providers" aria-label="Provider results" className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visibleProviderResults.map((provider) => <ProviderCard key={provider.providerId} provider={provider} programmeCount={directory.filter((item) => item.provider.providerId === provider.providerId).length} selected={data.organisationProviders.some((selection) => selection.providerId === provider.providerId && selection.status === "Active")} onOpen={() => openProvider(provider.providerId)} onAdd={() => addProvider(provider.providerId)} />)}
        </section>
      ) : null}

      {view === "Programmes" && !results.length ? <NoResults copy="No programmes match the selected filters." onClear={() => setFilters(emptyFilters)} /> : null}
      {view === "Providers" && !providerResults.length ? <NoResults copy="No providers match the selected filters." onClear={() => setFilters(emptyFilters)} /> : null}

      {view === "Programmes" && visibleResults.length < results.length ? <button type="button" onClick={() => setVisibleCount((current) => Math.min(current + directoryPageSize, results.length))} className="mx-auto min-h-11 rounded-full border border-[#102c3d]/[0.10] bg-white px-5 text-sm font-semibold text-[#102c3d] hover:bg-[#edf7f3] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#159b8f]">Load more programmes</button> : null}
      {view === "Providers" && visibleProviderResults.length < providerResults.length ? <button type="button" onClick={() => setVisibleCount((current) => Math.min(current + directoryPageSize, providerResults.length))} className="mx-auto min-h-11 rounded-full border border-[#102c3d]/[0.10] bg-white px-5 text-sm font-semibold text-[#102c3d] hover:bg-[#edf7f3] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#159b8f]">Load more providers</button> : null}

      {view === "Programmes" && compared.length ? <ProgrammeComparison items={compared} onRemove={toggleComparison} onOpen={openProgramme} /> : null}
    </div>
  );
}

function Filter({ label, value, values, onChange }: { label: string; value: string; values: string[]; onChange: (value: string) => void }) {
  return <label className="grid gap-1.5 text-xs font-semibold text-[#52677d]">{label}<span className="relative block"><select aria-label={label} value={value} onChange={(event) => onChange(event.target.value)} className="h-11 w-full min-w-0 appearance-none rounded-xl border border-[#8492a1] bg-[#fbfcfb] px-3 pr-10 text-sm font-semibold text-[#27456a] outline-none transition-[border-color,box-shadow,background-color] duration-150 hover:border-[#607487] focus:border-[#17786e] focus:bg-white focus:ring-4 focus:ring-[#17786e]/[0.12]"><option>All</option>{values.map((item) => <option key={item}>{item}</option>)}</select><ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#607487]" aria-hidden="true" /></span></label>;
}

function FilterChip({ label, value, onRemove }: { label: string; value: string; onRemove: () => void }) {
  return <button type="button" onClick={onRemove} aria-label={`Remove ${label.toLowerCase()} filter: ${value}`} className="inline-flex min-h-9 max-w-full items-center gap-1.5 rounded-lg bg-[#e6eee9] px-3 text-xs font-semibold text-[#27456a] transition-colors duration-150 hover:bg-[#cfe9de] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#17786e]"><span className="truncate"><span className="text-[#52677d]">{label}:</span> {value}</span><X size={13} className="shrink-0" aria-hidden="true" /></button>;
}

function NoResults({ copy, onClear }: { copy: string; onClear: () => void }) {
  return <section aria-live="polite" className="grid min-h-52 place-items-center rounded-2xl border border-dashed border-[#27456a]/20 bg-white px-5 py-10 text-center"><div className="max-w-md"><span className="mx-auto grid h-11 w-11 place-items-center rounded-xl bg-[#e6eee9] text-[#17786e]"><Search size={19} aria-hidden="true" /></span><h2 className="mt-4 text-lg font-semibold text-[#27456a]">Nothing matches yet</h2><p className="mt-1.5 text-sm leading-6 text-[#52677d]">{copy}</p><button type="button" onClick={onClear} className="mt-4 min-h-11 rounded-xl bg-[#27456a] px-4 text-sm font-semibold text-white transition-colors duration-150 hover:bg-[#1d3654] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#17786e] focus-visible:ring-offset-2">Clear all filters</button></div></section>;
}

function ProviderCard({ provider, programmeCount, selected, onOpen, onAdd }: { provider: ProviderCatalogueRecord; programmeCount: number; selected: boolean; onOpen: () => void; onAdd: () => void }) {
  const overview = clean(provider.commercialProfile.organisationDescription)
    || clean(provider.commercialProfile.positioningStatement)
    || provider.specialisms.slice(0, 3).join(", ")
    || "Provider information is being reviewed.";
  return (
    <article className="flex h-full min-h-[320px] flex-col rounded-2xl border border-[#27456a]/[0.09] bg-white p-5 shadow-[0_12px_30px_rgba(39,69,106,0.045)] transition-[border-color,box-shadow] duration-150 hover:border-[#27456a]/[0.16] hover:shadow-[0_16px_34px_rgba(39,69,106,0.07)] sm:p-6">
      <div className="flex items-start justify-between gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#e6eee9] text-[#17786e]"><Building2 size={19} aria-hidden="true" /></span><span className="rounded-lg bg-[#f2f7f4] px-2.5 py-1.5"><SemanticStatus label={provider.verificationStatus === "verified" ? "Information verified" : "Information awaiting review"} tone={provider.verificationStatus === "verified" ? "healthy" : "watch"} /></span></div>
      <h2 className="mt-4 text-xl font-semibold tracking-[-0.02em] text-[#27456a]">{provider.providerName}</h2>
      <p className="mt-2 text-sm leading-6 text-[#52677d]">{overview}</p>
      <dl className="mt-5 grid grid-cols-2 gap-3"><CardDetail label="Programmes" value={String(programmeCount)} /><CardDetail label="Coverage" value={provider.regions.slice(0, 2).join(", ") || "Being reviewed"} /></dl>
      <div className="mt-auto grid gap-2 pt-5"><button type="button" onClick={onOpen} className="min-h-11 rounded-xl bg-[#27456a] px-4 text-sm font-semibold text-white transition-colors duration-150 hover:bg-[#1d3654] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#17786e] focus-visible:ring-offset-2">View provider</button><button type="button" disabled={selected} onClick={onAdd} className="min-h-11 rounded-xl border border-[#8492a1] bg-white px-4 text-sm font-semibold text-[#176d65] transition-colors duration-150 hover:bg-[#e6eee9]/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#17786e] disabled:cursor-not-allowed disabled:bg-[#e6eee9] disabled:text-[#52677d]">{selected ? "In My Providers" : "Add to My Providers"}</button></div>
    </article>
  );
}

function ProgrammeCard({ item, selected, compared, onOpen, onAdd, onCompare }: { item: DirectoryProgramme; selected: boolean; compared: boolean; onOpen: () => void; onAdd: () => void; onCompare: () => void }) {
  const description = clean(item.programme.shortDescription) || clean(item.programme.fullDescription) || missingInformation;
  return (
    <article className="flex h-full min-h-[390px] flex-col rounded-2xl border border-[#27456a]/[0.09] bg-white p-5 shadow-[0_12px_30px_rgba(39,69,106,0.045)] transition-[border-color,box-shadow] duration-150 hover:border-[#27456a]/[0.16] hover:shadow-[0_16px_34px_rgba(39,69,106,0.07)] sm:p-6">
      <div className="flex items-start justify-between gap-3"><span className="inline-flex h-9 min-w-9 shrink-0 items-center justify-center rounded-lg bg-[#eef4f8] px-2 text-sm font-semibold text-[#315d78]">{levelMarker(item)}</span><span className="rounded-lg bg-[#f2f7f4] px-2.5 py-1.5"><SemanticStatus label={verificationLabel(item.programme, item.provider)} tone={verificationLabel(item.programme, item.provider) === "Information verified" ? "healthy" : "watch"} /></span></div>
      <h2 className="mt-4 text-xl font-semibold leading-7 tracking-[-0.02em] text-[#27456a]">{item.programme.programmeName}</h2>
      <p className="mt-1.5 text-sm font-semibold leading-6 text-[#176d65]">{item.provider.providerName}</p>
      <p className="mt-2 text-sm leading-6 text-[#52677d]">{description}</p>
      <div className="mt-4 rounded-xl bg-[#f2f7f4] p-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#607487]">Apprenticeship standard</p>
        <p className="mt-1 text-sm font-semibold leading-5 text-[#27456a]">{standardLabel(item)}</p>
      </div>
      <dl className="mt-4 grid gap-2.5 text-sm text-[#52677d]"><Fact icon={Timer} label="Duration" value={durationLabel(item.programme)} /><Fact icon={Building2} label="Delivery" value={deliveryLabel(item.programme, item.provider)} /><Fact icon={MapPin} label="Coverage" value={coverageLabel(item.programme, item.provider)} /></dl>
      <div className="mt-auto grid gap-2 pt-5"><button type="button" onClick={onOpen} className="min-h-11 rounded-xl bg-[#27456a] px-4 text-sm font-semibold text-white transition-colors duration-150 hover:bg-[#1d3654] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#17786e] focus-visible:ring-offset-2">View programme</button><div className="grid grid-cols-[1fr_auto] gap-2"><button type="button" disabled={selected} onClick={onAdd} className="min-h-11 rounded-xl border border-[#8492a1] bg-white px-4 text-sm font-semibold text-[#176d65] transition-colors duration-150 hover:bg-[#e6eee9]/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#17786e] disabled:cursor-not-allowed disabled:bg-[#e6eee9] disabled:text-[#52677d]">{selected ? "In My Programmes" : "Add to My Programmes"}</button><button type="button" aria-pressed={compared} aria-label={`${compared ? "Remove" : "Add"} ${item.programme.programmeName} ${compared ? "from" : "to"} comparison`} onClick={onCompare} className={`grid min-h-11 min-w-11 place-items-center rounded-xl ring-1 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#17786e] ${compared ? "bg-[#cfe9de] text-[#176d65] ring-[#17786e]" : "bg-white text-[#52677d] ring-[#8492a1] hover:bg-[#e6eee9]/70 hover:text-[#27456a]"}`}><GitCompareArrows size={17} aria-hidden="true" /></button></div></div>
    </article>
  );
}

function Fact({ icon: Icon, label, value }: { icon: typeof GraduationCap; label: string; value: string }) {
  return <div className="flex items-start gap-2"><Icon size={15} className="mt-0.5 shrink-0 text-[#17786e]" aria-hidden="true" /><span><span className="sr-only">{label}: </span>{value}</span></div>;
}

function CardDetail({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-[#f2f7f4] p-3"><dt className="text-[11px] font-semibold uppercase tracking-[0.09em] text-[#607487]">{label}</dt><dd className="mt-1 text-sm font-semibold leading-5 text-[#27456a]">{value}</dd></div>;
}

function ProgrammeDetail({ item, selected, onAdd, onBack, onProvider, onRequest }: { item: DirectoryProgramme; selected: boolean; onAdd: () => void; onBack: () => void; onProvider: () => void; onRequest?: () => void }) {
  const overview = clean(item.programme.fullDescription) || clean(item.programme.shortDescription) || missingInformation;
  return (
    <div className="mx-auto grid max-w-5xl gap-5">
      <Back onClick={onBack}>Back to Programmes &amp; Providers</Back>
      <header className="rounded-2xl border border-[#27456a]/[0.08] bg-[#e6eee9] p-6 text-[#27456a] shadow-[0_14px_34px_rgba(39,69,106,0.04)] sm:p-8"><div className="flex flex-wrap gap-2"><Badge>{levelLabel(item)}</Badge><Badge>{verificationLabel(item.programme, item.provider)}</Badge></div><h1 className="mt-4 text-3xl font-semibold tracking-[-0.03em]">{item.programme.programmeName}</h1><button type="button" onClick={onProvider} className="mt-2 min-h-11 text-left text-sm font-semibold text-[#176d65] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#17786e]">Delivered by {item.provider.providerName}</button><p className="mt-3 max-w-3xl text-sm leading-7 text-[#52677d]">{overview}</p><div className="mt-5 flex flex-wrap gap-3"><button type="button" disabled={selected} onClick={onAdd} className="min-h-11 rounded-xl bg-[#27456a] px-5 text-sm font-semibold text-white transition-colors duration-150 hover:bg-[#1d3654] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#17786e] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-[#607487]">{selected ? "In My Programmes" : "Add provider and programme"}</button>{onRequest ? <button type="button" onClick={onRequest} className="min-h-11 rounded-xl border border-[#17786e] bg-white px-5 text-sm font-semibold text-[#176d65] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#17786e]">Request proposals</button> : null}</div></header>
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><DetailFact label="Standard" value={standardLabel(item)} /><DetailFact label="Duration" value={durationLabel(item.programme)} /><DetailFact label="Delivery" value={deliveryLabel(item.programme, item.provider)} /><DetailFact label="Locations" value={coverageLabel(item.programme, item.provider)} /></section>
      <section className="grid gap-5 lg:grid-cols-2"><Info title="Typical learner activities" items={unique([...item.programme.skillsDeveloped, ...item.programme.technologiesCovered])} /><Info title="Suitable roles or teams" items={unique([...item.programme.targetJobRoles, ...item.programme.commercialProfile.typicalDepartments])} /><Copy title="Employer considerations" value={clean(item.programme.commercialProfile.employerCommitment) || missingInformation} /><Copy title="Learner support" value={clean(item.programme.commercialProfile.idealAudience) || missingInformation} /><Copy title="Assessment model" value={clean(item.programme.commercialProfile.assessmentApproach) || missingInformation} /><Info title="Programme outcomes" items={unique([...item.programme.commercialProfile.keyOutcomes, ...item.programme.expectedOutcomes])} /></section>
    </div>
  );
}

function ProviderProfile({ provider, programmes, selected, onAdd, onBack, onProgramme, onRequest }: { provider: ProviderCatalogueRecord; programmes: DirectoryProgramme[]; selected: boolean; onAdd: () => void; onBack: () => void; onProgramme: (id: string) => void; onRequest?: () => void }) {
  const overview = clean(provider.commercialProfile.organisationDescription) || clean(provider.commercialProfile.positioningStatement) || "Further provider information is being reviewed.";
  const employerSupport = unique(programmes.map((item) => item.programme.commercialProfile.employerCommitment));
  return (
    <div className="mx-auto grid max-w-5xl gap-5">
      <Back onClick={onBack}>Back to Programmes &amp; Providers</Back>
      <header className="rounded-2xl bg-[#27456a] p-6 text-white shadow-[0_16px_36px_rgba(39,69,106,0.14)] sm:p-8"><p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#b8e1d3]">Provider profile</p><h1 className="mt-3 text-3xl font-semibold tracking-[-0.03em]">{provider.providerName}</h1><dl className="mt-5 grid gap-3 sm:grid-cols-4"><QuickFact label="Programmes" value={String(programmes.length)} /><QuickFact label="Delivery" value={unique(provider.deliveryModels).slice(0, 2).join(", ") || "Being reviewed"} /><QuickFact label="Coverage" value={unique(provider.regions).slice(0, 2).join(", ") || "Being reviewed"} /><QuickFact label="Specialisms" value={unique(provider.specialisms).slice(0, 2).join(", ") || "Being reviewed"} /></dl><div className="mt-5 flex flex-wrap gap-3"><button type="button" disabled={selected} onClick={onAdd} className="min-h-11 rounded-xl bg-white px-5 text-sm font-semibold text-[#27456a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#cfe9de] focus-visible:ring-offset-2 focus-visible:ring-offset-[#27456a] disabled:bg-[#cfe9de]">{selected ? "In My Providers" : "Add to My Providers"}</button>{onRequest ? <button type="button" onClick={onRequest} className="min-h-11 rounded-xl border border-white/50 px-5 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#cfe9de]">Request proposal</button> : null}</div><details className="mt-5 border-t border-white/20 pt-3"><summary className="min-h-11 cursor-pointer py-3 text-sm font-semibold text-[#cfe9de] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#cfe9de]">About this provider</summary><p className="max-w-3xl text-sm leading-7 text-white/80">{overview}</p></details></header>
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
