"use client";

import {
  ArrowUpRight,
  Award,
  BadgeCheck,
  BriefcaseBusiness,
  CheckCircle2,
  CalendarCheck,
  Download,
  ExternalLink,
  Globe2,
  Layers3,
  MapPin,
  ShieldCheck,
  Sparkles,
  Star,
  Users,
} from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import type {
  ApprenticeshipStandard,
  CommercialLink,
  FundingRoute,
  ProviderCatalogueFilters,
  ProviderCatalogueRecord,
  ProviderEmployerSize,
  ProviderProgramme,
  ProviderProgrammeSeniority,
  ProviderProgrammeStatus,
  ProviderProgrammeVerificationStatus,
  ProviderType,
} from "@/lib/levytate/domain";
import {
  commercialProfileCompletion,
  defaultProviderCatalogueFilters,
  emptyProgrammeCommercialProfile,
  emptyProviderCommercialProfile,
  filterProviderCatalogue,
  formatFundingBand,
  normalisedProviderCatalogueFilterOptions,
  programmePrimaryStandard,
  programmeProfileCompletion,
} from "@/lib/levytate/domain";
import {
  EmptyState,
  FormActions,
  FormField,
  FormGrid,
  FormSection,
  FormSelect,
  FormTagInput,
  FormTextArea,
  MvpModal,
  MvpPanel,
  MvpToolbar,
  StatusBadge,
  TableAction,
} from "@/components/levytate-mvp/MvpUi";
import { useLevyTateStandards } from "@/components/levytate-mvp/LevyTateStandardsProvider";
import { useMvpWorkspace } from "@/components/levytate-mvp/MvpWorkspaceStore";
import {
  createMvpId,
  normaliseProviderProgramme,
  normaliseProviderRecord,
  nowIso,
  todayIso,
} from "@/lib/levytate/mvp/workspace";

const providerTypes: ProviderType[] = [
  "Independent training provider",
  "University",
  "College",
  "Specialist consultancy",
  "Employer programme partner",
  "National provider",
  "Regional provider",
  "Employer Provider",
];

const programmeStatuses: ProviderProgrammeStatus[] = [
  "Active",
  "Needs verification",
  "Paused",
  "Not available",
  "Defunded / unavailable for new starts",
];
const verificationStatuses: ProviderProgrammeVerificationStatus[] = [
  "Verified from provider website",
  "Needs manual verification",
  "Provider confirmed",
  "LevyTate reviewed",
];
const fundingRoutes: FundingRoute[] = [
  "Potentially levy-funded",
  "Potentially funded through levy/co-investment",
  "Commercial training budget",
];
const seniorityOptions: ProviderProgrammeSeniority[] = ["Entry", "Early career", "Experienced", "Supervisor", "Manager", "Mixed"];
const employerSizeOptions: ProviderEmployerSize[] = ["SME", "Mid-market", "Large enterprise", "Mixed employer base"];
const marketplaceStatusFilters: Array<ProviderCatalogueFilters["status"]> = ["Active", "Archived", "All"];

type ProviderView = {
  providerId: string;
};

type ProgrammeView = {
  providerId: string;
  programmeId: string;
};

function average(values: number[]) {
  if (!values.length) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function firstProgramme(programmes: ProviderProgramme[]) {
  return [...programmes].sort((left, right) => Number(right.verificationStatus !== "Needs manual verification") - Number(left.verificationStatus !== "Needs manual verification") || left.programmeName.localeCompare(right.programmeName))[0];
}

function providerReachLabel(provider: ProviderCatalogueRecord) {
  if (provider.providerType === "National provider" || provider.regions.includes("England")) return "National delivery";
  if (provider.regions.length > 1) return "Multi-region delivery";
  if (provider.regions.length === 1) return provider.regions[0];
  return "Delivery scope to confirm";
}

function providerTheme(providerId: string) {
  if (providerId.includes("qa")) return "from-[#102c3d] via-[#174761] to-[#1f7b78]";
  if (providerId.includes("baltic")) return "from-[#0f2f4a] via-[#15537b] to-[#0b8e82]";
  if (providerId.includes("learning-curve")) return "from-[#243f56] via-[#405e72] to-[#5d7b85]";
  if (providerId.includes("multiverse")) return "from-[#22163f] via-[#50368d] to-[#0b8e82]";
  return "from-[#3b2b1e] via-[#5a4838] to-[#0b8e82]";
}

function providerWordmark(provider: ProviderCatalogueRecord) {
  const words = provider.providerName.split(/\s+/).slice(0, 2);
  return words.join(" ");
}

function fallbackProviderDescription(provider: ProviderCatalogueRecord) {
  return cleanDisplayText(provider.commercialProfile.organisationDescription) || cleanDisplayText(provider.notes);
}

function downloadLabels(links: CommercialLink[]) {
  return links.map((item) => item.label);
}

function labelsToLinks(labels: string[], kind: CommercialLink["kind"] = "Download") {
  return labels.map((label) => ({ label, url: "", kind }));
}

function cleanDisplayText(value: unknown) {
  if (typeof value !== "string") return "";
  const text = value.trim();
  if (!text) return "";
  const lower = text.toLowerCase();
  if (text.includes("__LEVYTATE_PROVIDER_META__") || text.includes("__LEVYTATE_PROGRAMME_META__")) return "";
  if (text === "[object Object]" || lower === "json") return "";
  if ((text.startsWith("{") && text.endsWith("}")) || (text.startsWith("[") && text.endsWith("]"))) return "";
  if (lower.includes("commercialprofile") || lower.includes("sourceurls")) return "";
  return text;
}

function cleanDisplayList(values: unknown[]) {
  return Array.from(new Set(values.flatMap((value) => Array.isArray(value) ? value : [value]).map(cleanDisplayText).filter(Boolean)));
}

function cleanSourceUrls(values: string[]) {
  return cleanDisplayList(values).filter((value) => /^https?:\/\//i.test(value));
}

function formatReviewedDate(value: string) {
  const clean = cleanDisplayText(value);
  if (!clean) return "";
  const parsed = new Date(clean);
  if (Number.isNaN(parsed.getTime())) return clean;
  return parsed.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function sourceHost(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "Official source";
  }
}

function programmeTone(status: ProviderProgrammeStatus) {
  if (status === "Active") return "green" as const;
  if (status === "Needs verification" || status === "Paused") return "yellow" as const;
  return "red" as const;
}

function uniqueValues(values: string[]) {
  return cleanDisplayList(values);
}

function limitedTags(values: string[], limit = 4) {
  const unique = uniqueValues(values);
  return {
    visible: unique.slice(0, limit),
    overflow: Math.max(unique.length - limit, 0),
  };
}

function providerCardSummary(provider: ProviderCatalogueRecord) {
  return cleanDisplayText(provider.commercialProfile.positioningStatement) || fallbackProviderDescription(provider) || provider.providerType;
}

function providerCardTags(provider: ProviderCatalogueRecord, featuredProgramme?: ProviderProgramme) {
  return limitedTags([
    ...provider.specialisms,
    ...(featuredProgramme?.technologiesCovered ?? []),
    ...(featuredProgramme?.targetIndustries ?? []),
    ...provider.technologies,
  ]);
}

function providerCardBadges(provider: ProviderCatalogueRecord, featuredProgramme?: ProviderProgramme) {
  return uniqueValues([...(featuredProgramme?.deliveryModels ?? []), providerReachLabel(provider)]).slice(0, 3);
}


type ProviderFilterOptions = ReturnType<typeof normalisedProviderCatalogueFilterOptions>;

function MarketplaceFilterSelect({
  label,
  value,
  options,
  onChange,
  includeAll = true,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  includeAll?: boolean;
}) {
  const selectOptions = includeAll ? ["All", ...options.filter((option) => option !== "All")] : options;
  return (
    <label className="grid gap-1 text-[10px] font-semibold uppercase tracking-[0.13em] text-[#102c3d]/42">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 min-w-0 rounded-lg border border-[#102c3d]/[0.09] bg-white px-3 text-[12px] font-semibold normal-case tracking-normal text-[#102c3d]/78 outline-none transition focus:border-[#159b8f] focus:ring-4 focus:ring-[#159b8f]/10"
      >
        {selectOptions.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    </label>
  );
}

function ProviderFilterControls({
  filters,
  options,
  onFilter,
}: {
  filters: ProviderCatalogueFilters;
  options: ProviderFilterOptions;
  onFilter: (key: keyof ProviderCatalogueFilters, value: string) => void;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
      <MarketplaceFilterSelect label="Sector" value={filters.sector} options={options.sectors} onChange={(value) => onFilter("sector", value)} />
      <MarketplaceFilterSelect label="Technology" value={filters.technology} options={options.technologies} onChange={(value) => onFilter("technology", value)} />
      <MarketplaceFilterSelect label="Business challenge" value={filters.businessChallenge} options={options.businessChallenges} onChange={(value) => onFilter("businessChallenge", value)} />
      <MarketplaceFilterSelect label="Delivery" value={filters.deliveryModel} options={options.deliveryModels} onChange={(value) => onFilter("deliveryModel", value)} />
      <MarketplaceFilterSelect label="Region" value={filters.region} options={options.regions} onChange={(value) => onFilter("region", value)} />
      <MarketplaceFilterSelect label="Employer type" value={filters.employerType} options={options.employerTypes} onChange={(value) => onFilter("employerType", value)} />
      <MarketplaceFilterSelect label="Level" value={filters.programmeLevel} options={options.programmeLevels} onChange={(value) => onFilter("programmeLevel", value)} />
      <MarketplaceFilterSelect label="Status" value={filters.status} options={marketplaceStatusFilters} includeAll={false} onChange={(value) => onFilter("status", value)} />
    </div>
  );
}
export function ProvidersModule() {
  const { data, saveProvider, saveProviderProgramme, archiveProviderProgramme, removeProviderProgramme } = useMvpWorkspace();
  const { selectableStandards } = useLevyTateStandards();
  const [filters, setFilters] = useState<ProviderCatalogueFilters>(defaultProviderCatalogueFilters);
  const [compareProviderIds, setCompareProviderIds] = useState<string[]>([]);
  const [profileView, setProfileView] = useState<ProviderView | null>(null);
  const [programmeView, setProgrammeView] = useState<ProgrammeView | null>(null);
  const [providerDraft, setProviderDraft] = useState<ProviderCatalogueRecord | null>(null);
  const [programmeDraft, setProgrammeDraft] = useState<ProviderProgramme | null>(null);
  const [standardSearch, setStandardSearch] = useState("");
  const [error, setError] = useState("");

  const providerStats = useMemo(() => {
    const activeProviders = data.providers.filter((provider) => provider.status === "Active");
    const activeProgrammes = data.providerProgrammes.filter((programme) => programme.recordStatus === "Active");
    return {
      activeProviders: activeProviders.length,
      verifiedProviders: activeProviders.filter((provider) => provider.verificationStatus === "verified").length,
      providerCompletion: average(activeProviders.map((provider) => commercialProfileCompletion(provider.commercialProfile))),
      liveProgrammes: activeProgrammes.length,
      programmeCompletion: average(activeProgrammes.map((programme) => programmeProfileCompletion(programme.commercialProfile))),
    };
  }, [data.providerProgrammes, data.providers]);

  const filterOptions = useMemo(
    () => normalisedProviderCatalogueFilterOptions(data.providers, data.providerProgrammes),
    [data.providerProgrammes, data.providers],
  );

  const visibleProviders = useMemo(
    () => filterProviderCatalogue(data.providers, data.providerProgrammes, selectableStandards, filters),
    [data.providerProgrammes, data.providers, filters, selectableStandards],
  );

  function updateFilter(key: keyof ProviderCatalogueFilters, value: string) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  const comparisonProviders = useMemo(
    () => compareProviderIds.map((providerId) => data.providers.find((provider) => provider.providerId === providerId)).filter(Boolean) as ProviderCatalogueRecord[],
    [compareProviderIds, data.providers],
  );

  const profileProvider = profileView ? data.providers.find((provider) => provider.providerId === profileView.providerId) ?? null : null;
  const profileProgrammes = useMemo(() => {
    if (!profileProvider) return [] as ProviderProgramme[];
    return data.providerProgrammes
      .filter((programme) => programme.providerId === profileProvider.providerId && programme.recordStatus === "Active")
      .sort((left, right) => left.programmeName.localeCompare(right.programmeName));
  }, [data.providerProgrammes, profileProvider]);

  const selectedProgramme = programmeView
    ? data.providerProgrammes.find((programme) => programme.id === programmeView.programmeId && programme.providerId === programmeView.providerId) ?? null
    : null;
  const selectedProgrammeProvider = selectedProgramme
    ? data.providers.find((provider) => provider.providerId === selectedProgramme.providerId) ?? null
    : null;

  function toggleCompare(providerId: string) {
    setCompareProviderIds((current) => current.includes(providerId) ? current.filter((item) => item !== providerId) : [...current, providerId].slice(-3));
  }

  function blankProvider(): ProviderCatalogueRecord {
    return normaliseProviderRecord({
      providerId: createMvpId("provider"),
      providerName: "",
      website: "",
      providerType: "Independent training provider",
      sectors: [],
      industries: [],
      technologies: [],
      deliveryModels: [],
      regions: [],
      employerTypes: [],
      specialisms: [],
      contactName: "",
      contactEmail: "",
      ofstedRating: "Requires verification",
      status: "Active",
      sourceUrls: [],
      notes: "",
      lastVerified: todayIso(),
      verificationStatus: "needs_verification",
      commercialProfile: emptyProviderCommercialProfile(),
    });
  }

  function blankProgramme(providerId: string): ProviderProgramme {
    const now = nowIso();
    return normaliseProviderProgramme({
      id: createMvpId("programme"),
      providerId,
      programmeName: "",
      shortDescription: "",
      fullDescription: "",
      targetOrganisations: [],
      targetIndustries: [],
      targetJobRoles: [],
      seniority: "Mixed",
      employerSize: "Mixed employer base",
      businessProblemsSolved: [],
      skillsDeveloped: [],
      technologiesCovered: [],
      expectedOutcomes: [],
      deliveryModels: ["Blended"],
      regions: [],
      duration: "",
      cohortOptions: [],
      commercialNotes: "",
      fundingRoute: "Potentially funded through levy/co-investment",
      linkedStandardIds: [],
      status: "Needs verification",
      verificationStatus: "Needs manual verification",
      sourceUrl: data.providers.find((provider) => provider.providerId === providerId)?.website ?? "",
      notes: "",
      commercialProfile: emptyProgrammeCommercialProfile(),
      recordStatus: "Active",
      createdAt: now,
      updatedAt: now,
    });
  }

  function openProviderEditor(provider?: ProviderCatalogueRecord) {
    setProviderDraft(provider ? structuredClone(provider) : blankProvider());
    setProgrammeDraft(null);
    setError("");
  }

  function openProgrammeEditor(providerId: string, programme?: ProviderProgramme) {
    setProgrammeDraft(programme ? structuredClone(programme) : blankProgramme(providerId));
    setProviderDraft(null);
    setStandardSearch("");
    setError("");
  }

  function submitProvider(event: FormEvent) {
    event.preventDefault();
    if (!providerDraft) return;
    if (!providerDraft.providerName.trim()) {
      setError("Provider name is required.");
      return;
    }

    saveProvider(
      normaliseProviderRecord({
        ...providerDraft,
        providerName: providerDraft.providerName.trim(),
        lastVerified: todayIso(),
      }),
    );
    setProviderDraft(null);
    setError("");
  }

  function submitProgramme(event: FormEvent) {
    event.preventDefault();
    if (!programmeDraft) return;
    if (!programmeDraft.programmeName.trim()) {
      setError("Programme name is required.");
      return;
    }
    if (!programmeDraft.linkedStandardIds.length) {
      setError("Select at least one linked apprenticeship standard.");
      return;
    }

    const duplicate = data.providerProgrammes.some(
      (programme) =>
        programme.providerId === programmeDraft.providerId
        && programme.programmeName.trim().toLowerCase() === programmeDraft.programmeName.trim().toLowerCase()
        && programme.id !== programmeDraft.id,
    );
    if (duplicate) {
      setError("This provider already has a programme with that name.");
      return;
    }

    saveProviderProgramme(
      normaliseProviderProgramme({
        ...programmeDraft,
        programmeName: programmeDraft.programmeName.trim(),
        updatedAt: nowIso(),
      }),
    );
    setProgrammeDraft(null);
    setError("");
  }

  function removeProgramme(programme: ProviderProgramme) {
    if (window.confirm(`Remove ${programme.programmeName} from the marketplace catalogue?`)) {
      removeProviderProgramme(programme.id);
    }
  }

  return (
    <div className="grid gap-5">
      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <SummaryCard label="Marketplace partners" value={providerStats.activeProviders} copy="Active provider profiles currently visible in the LevyTate marketplace." tone="blue" />
        <SummaryCard label="Verified providers" value={providerStats.verifiedProviders} copy="Partners already carrying a verified provider signal in the marketplace." tone="green" />
        <SummaryCard label="Profile quality" value={`${providerStats.providerCompletion}%`} copy="Average provider profile completeness across proof, reach and buyer confidence signals." tone="green" />
        <SummaryCard label="Live programmes" value={providerStats.liveProgrammes} copy="Programme destinations currently available to support employer discovery and matching." tone="blue" />
        <SummaryCard label="Programme quality" value={`${providerStats.programmeCompletion}%`} copy="Average programme completeness across audience, outcomes, delivery and compliance content." tone="yellow" />
      </section>

      {comparisonProviders.length >= 2 ? (
        <MvpPanel
          title="Provider comparison"
          eyebrow="Marketplace shortlist"
          actions={<button type="button" onClick={() => setCompareProviderIds([])} className="inline-flex h-9 items-center rounded-full bg-[#f5f7f3] px-3 text-xs font-semibold text-[#102c3d]/64 ring-1 ring-[#102c3d]/[0.07]">Clear comparison</button>}
        >
          <ProviderComparison providers={comparisonProviders} programmes={data.providerProgrammes} standards={selectableStandards} onOpenProfile={(providerId) => setProfileView({ providerId })} onOpenProgramme={(providerId, programmeId) => setProgrammeView({ providerId, programmeId })} />
        </MvpPanel>
      ) : null}

      <MvpPanel title="Provider marketplace" eyebrow="Commercial provider discovery">
        <MvpToolbar
          search={filters.search}
          onSearch={(value) => updateFilter("search", value)}
          placeholder="Search provider profiles, technologies, industries, programmes or outcomes"
          actionLabel="Add provider"
          onAction={() => openProviderEditor()}
          filters={<ProviderFilterControls filters={filters} options={filterOptions} onFilter={updateFilter} />}
        />

        {visibleProviders.length ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {visibleProviders.map((provider) => {
              const providerProgrammes = data.providerProgrammes.filter((programme) => programme.providerId === provider.providerId && programme.recordStatus === "Active");
              const featuredProgramme = firstProgramme(providerProgrammes);
              const compared = compareProviderIds.includes(provider.providerId);
              const cardTags = providerCardTags(provider, featuredProgramme);
              const cardBadges = providerCardBadges(provider, featuredProgramme);
              const summary = providerCardSummary(provider);
              return (
                <article key={provider.providerId} className="flex h-full flex-col overflow-hidden rounded-[26px] border border-[#102c3d]/[0.08] bg-white shadow-[0_16px_34px_rgba(16,44,61,0.045)] transition hover:-translate-y-0.5 hover:shadow-[0_24px_46px_rgba(16,44,61,0.08)]">
                  <div className={`h-1.5 w-full bg-gradient-to-r ${providerTheme(provider.providerId)}`} />

                  <div className="flex h-full flex-col p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#102c3d]/42">{provider.providerType}</p>
                        <h3 className="mt-2 text-[22px] font-semibold tracking-[-0.02em] text-[#102c3d]">{provider.providerName}</h3>
                      </div>
                      <StatusBadge tone={provider.verificationStatus === "verified" ? "green" : "yellow"}>
                        {provider.verificationStatus === "verified" ? "Verified" : "Review"}
                      </StatusBadge>
                    </div>

                    <p className="mt-3 min-h-[44px] text-sm font-medium leading-6 text-[#102c3d]/68" title={summary}>{summary}</p>

                    {cardBadges.length ? (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {cardBadges.map((item) => (
                          <StatusBadge key={item} tone={item === providerReachLabel(provider) ? "blue" : "neutral"}>{item}</StatusBadge>
                        ))}
                      </div>
                    ) : null}

                    {cardTags.visible.length ? (
                      <div className="mt-4 flex min-h-[68px] flex-wrap content-start gap-2 overflow-hidden">
                        {cardTags.visible.map((item) => <Tag key={item}>{item}</Tag>)}
                        {cardTags.overflow ? <Tag tone="accent">{`+${cardTags.overflow} more`}</Tag> : null}
                      </div>
                    ) : null}

                    {featuredProgramme ? (
                      <button
                        type="button"
                        onClick={() => setProgrammeView({ providerId: provider.providerId, programmeId: featuredProgramme.id })}
                        className="mt-5 min-h-[112px] rounded-2xl border border-[#102c3d]/[0.07] bg-[#f8fbfa] p-4 text-left transition hover:border-[#159b8f]/20 hover:bg-white"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#c95568]">Featured programme</p>
                            <p className="mt-2 text-sm font-semibold text-[#102c3d]">{featuredProgramme.programmeName}</p>
                          </div>
                          <StatusBadge tone={programmeTone(featuredProgramme.status)}>{featuredProgramme.status}</StatusBadge>
                        </div>
                        <p className="mt-2 truncate text-sm text-[#102c3d]/56" title={featuredProgramme.commercialProfile.tagline || featuredProgramme.shortDescription}>
                          {featuredProgramme.commercialProfile.tagline || featuredProgramme.shortDescription}
                        </p>
                      </button>
                    ) : null}

                    <div className="mt-auto grid grid-cols-2 gap-2 pt-5">
                      <button
                        type="button"
                        onClick={() => setProfileView({ providerId: provider.providerId })}
                        className="inline-flex h-11 items-center justify-center rounded-full bg-[#102c3d] px-4 text-sm font-semibold text-white shadow-[0_10px_20px_rgba(16,44,61,0.12)] transition hover:bg-[#17394d]"
                      >
                        View profile
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleCompare(provider.providerId)}
                        className={`inline-flex h-11 items-center justify-center rounded-full px-4 text-sm font-semibold ring-1 transition ${compared ? "bg-[#edf7f3] text-[#0b6f63] ring-[#159b8f]/16" : "bg-white text-[#102c3d]/70 ring-[#102c3d]/[0.08] hover:text-[#102c3d]"}`}
                      >
                        {compared ? "Compared" : "Compare"}
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <EmptyState title="No provider profiles yet" copy="Add a provider partner to begin building LevyTate's premium employer-facing provider marketplace." actionLabel="Add provider" onAction={() => openProviderEditor()} />
        )}
      </MvpPanel>

      {profileProvider ? (
        <MvpModal title={profileProvider.providerName} eyebrow="Provider marketplace profile" onClose={() => setProfileView(null)} wide>
          <ProviderProfileModal provider={profileProvider} programmes={profileProgrammes} standards={selectableStandards} onEdit={() => { setProfileView(null); openProviderEditor(profileProvider); }} onEditProgrammes={() => { setProfileView(null); openProgrammeEditor(profileProvider.providerId); }} onOpenProgramme={(programmeId) => setProgrammeView({ providerId: profileProvider.providerId, programmeId })} />
        </MvpModal>
      ) : null}

      {selectedProgramme && selectedProgrammeProvider ? (
        <MvpModal title={selectedProgramme.programmeName} eyebrow="Programme destination" onClose={() => setProgrammeView(null)} wide>
          <ProgrammeDestination programme={selectedProgramme} provider={selectedProgrammeProvider} standard={programmePrimaryStandard(selectedProgramme, selectableStandards)} onEdit={() => { setProgrammeView(null); openProgrammeEditor(selectedProgramme.providerId, selectedProgramme); }} />
        </MvpModal>
      ) : null}

      {providerDraft ? (
        <MvpModal title={providerDraft.providerName || "Add provider partner"} eyebrow="Marketplace record" onClose={() => setProviderDraft(null)} wide>
          <form onSubmit={submitProvider} className="grid gap-5 lg:grid-cols-[minmax(0,1.3fr)_360px]">
            <div className="grid gap-4">
              <FormSection title="Core identity" copy="Capture the provider positioning LevyTate will use in the marketplace.">
                <FormGrid>
                  <FormField label="Provider name" value={providerDraft.providerName} onChange={(value) => setProviderDraft({ ...providerDraft, providerName: value })} required />
                  <FormSelect label="Provider type" value={providerDraft.providerType} onChange={(value) => setProviderDraft({ ...providerDraft, providerType: value as ProviderType })} options={providerTypes} />
                  <FormField label="Website" value={providerDraft.website} onChange={(value) => setProviderDraft({ ...providerDraft, website: value })} />
                  <FormField label="Ofsted" value={providerDraft.ofstedRating} onChange={(value) => setProviderDraft({ ...providerDraft, ofstedRating: value })} />
                  <FormField label="Positioning statement" value={providerDraft.commercialProfile.positioningStatement} onChange={(value) => setProviderDraft({ ...providerDraft, commercialProfile: { ...providerDraft.commercialProfile, positioningStatement: value } })} wide />
                  <FormTextArea label="Provider summary" value={providerDraft.commercialProfile.organisationDescription} onChange={(value) => setProviderDraft({ ...providerDraft, commercialProfile: { ...providerDraft.commercialProfile, organisationDescription: value } })} rows={4} wide />
                </FormGrid>
              </FormSection>

              <FormSection title="Trust and reach" copy="These metrics help employers understand scale, quality and commercial confidence quickly.">
                <FormGrid>
                  <FormField label="Years established" value={providerDraft.commercialProfile.yearsEstablished} onChange={(value) => setProviderDraft({ ...providerDraft, commercialProfile: { ...providerDraft.commercialProfile, yearsEstablished: value } })} />
                  <FormField label="Learner numbers" value={providerDraft.commercialProfile.learnerNumbers} onChange={(value) => setProviderDraft({ ...providerDraft, commercialProfile: { ...providerDraft.commercialProfile, learnerNumbers: value } })} />
                  <FormField label="Employer partners" value={providerDraft.commercialProfile.employerPartners} onChange={(value) => setProviderDraft({ ...providerDraft, commercialProfile: { ...providerDraft.commercialProfile, employerPartners: value } })} />
                  <FormField label="Achievement rate" value={providerDraft.commercialProfile.achievementRate} onChange={(value) => setProviderDraft({ ...providerDraft, commercialProfile: { ...providerDraft.commercialProfile, achievementRate: value } })} />
                  <FormField label="Employer satisfaction" value={providerDraft.commercialProfile.employerSatisfaction} onChange={(value) => setProviderDraft({ ...providerDraft, commercialProfile: { ...providerDraft.commercialProfile, employerSatisfaction: value } })} />
                  <FormField label="Learner satisfaction" value={providerDraft.commercialProfile.learnerSatisfaction} onChange={(value) => setProviderDraft({ ...providerDraft, commercialProfile: { ...providerDraft.commercialProfile, learnerSatisfaction: value } })} />
                  <FormTagInput label="Accreditations" values={providerDraft.commercialProfile.accreditations} onChange={(value) => setProviderDraft({ ...providerDraft, commercialProfile: { ...providerDraft.commercialProfile, accreditations: value } })} wide />
                  <FormTagInput label="Awards" values={providerDraft.commercialProfile.awards} onChange={(value) => setProviderDraft({ ...providerDraft, commercialProfile: { ...providerDraft.commercialProfile, awards: value } })} wide />
                </FormGrid>
              </FormSection>

              <FormSection title="Marketplace fit" copy="These tags drive filtering, discovery and buyer relevance.">
                <FormGrid>
                  <FormTagInput label="Industries" values={providerDraft.industries} onChange={(value) => setProviderDraft({ ...providerDraft, industries: value })} wide />
                  <FormTagInput label="Technologies" values={providerDraft.technologies} onChange={(value) => setProviderDraft({ ...providerDraft, technologies: value })} wide />
                  <FormTagInput label="Specialisms" values={providerDraft.specialisms} onChange={(value) => setProviderDraft({ ...providerDraft, specialisms: value })} wide />
                  <FormTagInput label="Delivery methods" values={providerDraft.deliveryModels} onChange={(value) => setProviderDraft({ ...providerDraft, deliveryModels: value })} wide />
                  <FormTagInput label="Regions" values={providerDraft.regions} onChange={(value) => setProviderDraft({ ...providerDraft, regions: value })} wide />
                  <FormTagInput label="Employer sizes" values={providerDraft.commercialProfile.employerSizesSupported} onChange={(value) => setProviderDraft({ ...providerDraft, commercialProfile: { ...providerDraft.commercialProfile, employerSizesSupported: value } })} wide />
                  <FormTagInput label="Case studies" values={providerDraft.commercialProfile.caseStudies} onChange={(value) => setProviderDraft({ ...providerDraft, commercialProfile: { ...providerDraft.commercialProfile, caseStudies: value } })} wide />
                  <FormTagInput label="Testimonials" values={providerDraft.commercialProfile.testimonials} onChange={(value) => setProviderDraft({ ...providerDraft, commercialProfile: { ...providerDraft.commercialProfile, testimonials: value } })} wide />
                  <FormTagInput label="Downloads" values={downloadLabels(providerDraft.commercialProfile.downloads)} onChange={(value) => setProviderDraft({ ...providerDraft, commercialProfile: { ...providerDraft.commercialProfile, downloads: labelsToLinks(value) } })} wide />
                  <FormTextArea label="Pricing notes" value={providerDraft.commercialProfile.pricingNotes} onChange={(value) => setProviderDraft({ ...providerDraft, commercialProfile: { ...providerDraft.commercialProfile, pricingNotes: value } })} rows={3} wide />
                  <FormTextArea label="Commercial notes" value={providerDraft.commercialProfile.commercialNotes} onChange={(value) => setProviderDraft({ ...providerDraft, commercialProfile: { ...providerDraft.commercialProfile, commercialNotes: value } })} rows={3} wide />
                </FormGrid>
              </FormSection>

              <FormActions onCancel={() => setProviderDraft(null)} label="Save provider profile" error={error} />
            </div>

            <div className="grid gap-4 self-start">
              <ProviderHeroCard provider={providerDraft} programmeCount={data.providerProgrammes.filter((programme) => programme.providerId === providerDraft.providerId && programme.recordStatus === "Active").length} />
              <MarketplaceSignalCard title="Buyer confidence" copy="Use this preview to keep the provider record sounding commercial, clear and employer-ready." items={[providerDraft.commercialProfile.positioningStatement || "Add a sharper marketplace positioning statement", providerDraft.commercialProfile.pricingNotes || "Add a brief commercial fit note", `${commercialProfileCompletion(providerDraft.commercialProfile)}% profile completeness`]} />
            </div>
          </form>
        </MvpModal>
      ) : null}

      {programmeDraft ? (
        <MvpModal title={programmeDraft.programmeName || "Add programme"} eyebrow="Programme catalogue" onClose={() => setProgrammeDraft(null)} wide>
          <ProgrammeEditor draft={programmeDraft} onDraft={setProgrammeDraft} standardSearch={standardSearch} onStandardSearch={setStandardSearch} onSubmit={submitProgramme} onCancel={() => setProgrammeDraft(null)} onArchive={() => archiveProviderProgramme(programmeDraft.id)} onRemove={() => removeProgramme(programmeDraft)} error={error} standards={selectableStandards} />
        </MvpModal>
      ) : null}
    </div>
  );
}

function ProviderProfileModal({
  provider,
  programmes,
  standards,
  onEdit,
  onEditProgrammes,
  onOpenProgramme,
}: {
  provider: ProviderCatalogueRecord;
  programmes: ProviderProgramme[];
  standards: ApprenticeshipStandard[];
  onEdit: () => void;
  onEditProgrammes: () => void;
  onOpenProgramme: (programmeId: string) => void;
}) {
  const summary = fallbackProviderDescription(provider);
  const positioning = cleanDisplayText(provider.commercialProfile.positioningStatement) || summary;
  const heroSpecialisms = cleanDisplayList([...provider.specialisms, ...provider.industries]).slice(0, 6);
  const deliveryValues = cleanDisplayList([...provider.deliveryModels, ...provider.regions]);
  const technologyValues = cleanDisplayList([...provider.industries, ...provider.technologies]);
  const employerFitValues = cleanDisplayList([...provider.specialisms, ...provider.commercialProfile.employerSizesSupported]);
  const trustSignals = cleanDisplayList([
    provider.ofstedRating && provider.ofstedRating !== "Requires verification" ? provider.ofstedRating : "",
    ...provider.commercialProfile.accreditations,
    provider.verificationStatus === "verified" ? `Source reviewed ${formatReviewedDate(provider.lastVerified)}` : "",
  ]);
  const awards = cleanDisplayList(provider.commercialProfile.awards);
  const proofPoints = cleanDisplayList([
    ...provider.commercialProfile.caseStudies,
    ...provider.commercialProfile.testimonials,
    provider.notes,
  ]);

  return (
    <div className="grid gap-5">
      <section className={`overflow-hidden rounded-3xl bg-gradient-to-br ${providerTheme(provider.providerId)} text-white shadow-[0_22px_54px_rgba(16,44,61,0.16)]`}>
        <div className="grid gap-6 px-6 py-6 lg:grid-cols-[minmax(0,1fr)_280px] lg:px-7">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-white/14 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/74 ring-1 ring-white/12">Provider</span>
              <StatusBadge tone={provider.verificationStatus === "verified" ? "green" : "yellow"}>{provider.verificationStatus === "verified" ? "Verified" : "Review needed"}</StatusBadge>
              <StatusBadge tone="blue">{provider.providerType}</StatusBadge>
            </div>
            <h3 className="mt-5 text-3xl font-semibold tracking-[-0.03em]">{provider.providerName}</h3>
            {positioning ? <p className="mt-3 max-w-3xl text-base leading-7 text-white/86">{positioning}</p> : null}
            {summary && summary !== positioning ? <p className="mt-3 max-w-3xl text-sm leading-6 text-white/72">{summary}</p> : null}
            {heroSpecialisms.length ? (
              <div className="mt-5 flex flex-wrap gap-2">
                {heroSpecialisms.map((item) => <Tag key={item}>{item}</Tag>)}
              </div>
            ) : null}
          </div>

          <div className="grid gap-3 self-start rounded-3xl bg-white/10 p-4 backdrop-blur-sm ring-1 ring-white/10">
            <MetricTile inverse label="Verification" value={provider.verificationStatus === "verified" ? "Source verified" : "Needs review"} />
            <MetricTile inverse label="Specialisms" value={String(heroSpecialisms.length || provider.specialisms.length || 0)} />
            <MetricTile inverse label="Delivery" value={cleanDisplayList(provider.deliveryModels).join(", ")} />
            <MetricTile inverse label="Coverage" value={providerReachLabel(provider)} />
          </div>
        </div>
      </section>

      <div className="flex flex-wrap gap-2">
        <TableAction onClick={onEdit}>Edit profile</TableAction>
        <TableAction onClick={onEditProgrammes}>Manage programmes</TableAction>
      </div>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
        <div className="grid gap-5">
          <InfoSection title="Provider summary" copy={summary} />
          <InfoChips title="Delivery and coverage" icon={MapPin} items={deliveryValues} />
          <InfoChips title="Industries and technologies" icon={Layers3} items={technologyValues} />
          <InfoChips title="Specialisms and employer fit" icon={BriefcaseBusiness} items={employerFitValues} />
        </div>

        <div className="grid gap-5">
          <VerifiedSourcesCard urls={provider.sourceUrls} lastReviewed={provider.lastVerified} />
          <MarketplaceSignalCard title="Trust signals" copy="Source-backed proof points for employer review." items={trustSignals} />
          <InfoChips title="Accreditations" icon={ShieldCheck} items={provider.commercialProfile.accreditations} />
          <InfoChips title="Awards" icon={Award} items={awards} />
        </div>
      </section>

      {proofPoints.length || provider.commercialProfile.downloads.length ? (
        <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.9fr)]">
          <MarketplaceSignalCard title="Evidence" copy="Published or directly confirmed provider evidence only." items={proofPoints} />
          <DownloadsCard links={provider.commercialProfile.downloads} contactEmail={provider.commercialProfile.commercialContactEmail || provider.contactEmail} />
        </section>
      ) : null}

      <MvpPanel title="Programme catalogue" eyebrow="Employer-facing programme destinations">
        {programmes.length ? (
          <div className="grid gap-4 xl:grid-cols-2">
            {programmes.map((programme) => (
              <ProgrammeMarketplaceCard key={programme.id} programme={programme} provider={provider} standard={programmePrimaryStandard(programme, standards)} onOpen={() => onOpenProgramme(programme.id)} />
            ))}
          </div>
        ) : (
          <EmptyState title="No programmes yet" copy="Add programme destinations so employers can understand the real commercial proposition behind this provider." actionLabel="Manage programmes" onAction={onEditProgrammes} />
        )}
      </MvpPanel>
    </div>
  );
}
function ProgrammeDestination({
  programme,
  provider,
  standard,
  onEdit,
}: {
  programme: ProviderProgramme;
  provider: ProviderCatalogueRecord;
  standard?: ApprenticeshipStandard;
  onEdit: () => void;
}) {
  return (
    <div className="grid gap-5">
      <section className="overflow-hidden rounded-3xl border border-[#102c3d]/[0.07] bg-white shadow-[0_18px_40px_rgba(16,44,61,0.06)]">
        <div className="grid gap-6 px-6 py-6 lg:grid-cols-[minmax(0,1fr)_280px] lg:px-7">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge tone={programmeTone(programme.status)}>{programme.status}</StatusBadge>
              <StatusBadge tone={programme.verificationStatus === "Needs manual verification" ? "yellow" : "green"}>{programme.verificationStatus === "Needs manual verification" ? "Verification pending" : "Verified for shortlist"}</StatusBadge>
              <StatusBadge tone="blue">{provider.providerName}</StatusBadge>
            </div>
            <h3 className="mt-5 text-3xl font-semibold tracking-[-0.03em] text-[#102c3d]">{programme.programmeName}</h3>
            {cleanDisplayText(programme.commercialProfile.tagline) ? <p className="mt-3 text-base font-medium text-[#0b6f63]">{cleanDisplayText(programme.commercialProfile.tagline)}</p> : null}
            {cleanDisplayText(programme.fullDescription || programme.shortDescription) ? <p className="mt-4 max-w-3xl text-sm leading-7 text-[#102c3d]/60">{cleanDisplayText(programme.fullDescription || programme.shortDescription)}</p> : null}
            <div className="mt-5 flex flex-wrap gap-2">
              {programme.targetIndustries.slice(0, 3).map((item) => <Tag key={item}>{item}</Tag>)}
              {programme.technologiesCovered.slice(0, 3).map((item) => <Tag key={item}>{item}</Tag>)}
              {programme.businessProblemsSolved.slice(0, 2).map((item) => <Tag key={item} tone="accent">{item}</Tag>)}
            </div>
          </div>
          <div className="grid gap-3 self-start rounded-3xl bg-[#f8fbfa] p-4 ring-1 ring-[#102c3d]/[0.06]">
            <MetricTile label="Verification" value={programme.verificationStatus === "Needs manual verification" ? "Needs verification" : "Source verified"} />
            <MetricTile label="Delivery" value={cleanDisplayList(programme.deliveryModels).join(", ")} />
            <MetricTile label="Linked standard" value={standard?.title || programme.linkedStandardName || "Needs verification"} />
            <MetricTile label="Funding route" value={programme.fundingRoute} />
          </div>
        </div>
      </section>

      <div className="flex flex-wrap gap-2">
        <TableAction onClick={onEdit}>Edit programme</TableAction>
      </div>

      <section className="grid gap-5 xl:grid-cols-2">
        <InfoSection title="Who this programme is for" copy={programme.commercialProfile.idealAudience} />
        <InfoSection title="Business challenges solved" copy={cleanDisplayList(programme.businessProblemsSolved).join(" / ")} />
        <InfoChips title="Target roles" icon={Users} items={programme.targetJobRoles} />
        <InfoChips title="Technologies" icon={Layers3} items={programme.technologiesCovered} />
        <InfoChips title="Skills developed" icon={Sparkles} items={programme.skillsDeveloped} />
        <InfoChips title="Expected outcomes" icon={CheckCircle2} items={programme.expectedOutcomes} />
        <InfoSection title="Employer commitment" copy={programme.commercialProfile.employerCommitment} />
        <InfoSection title="Assessment approach" copy={programme.commercialProfile.assessmentApproach} />
        <InfoChips title="Progression routes" icon={ArrowUpRight} items={programme.commercialProfile.progressionRoutes} />
        <InfoChips title="Case studies and FAQs" icon={Star} items={[...programme.commercialProfile.caseStudies, ...programme.commercialProfile.faqs]} />
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <MarketplaceSignalCard title="Employer value" copy="This programme should lead with employer outcomes, not the standard." items={programme.commercialProfile.employerBenefits.length ? programme.commercialProfile.employerBenefits : programme.expectedOutcomes} />
        <div className="rounded-2xl border border-[#102c3d]/[0.07] bg-white p-5 shadow-[0_14px_32px_rgba(16,44,61,0.045)]">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#c95568]">Funding and compliance</p>
          <h4 className="mt-2 text-base font-semibold text-[#102c3d]">{standard?.title || cleanDisplayText(programme.linkedStandardName) || "Linked standard under review"}</h4>
          {standard ? <p className="mt-1 text-sm text-[#102c3d]/56">{`${standard.referenceCode} | Level ${standard.level}`}</p> : null}
          <p className="mt-3 text-sm text-[#102c3d]/60">{standard ? formatFundingBand(standard) : programme.fundingRoute}</p>
          {programme.commercialProfile.downloads.length ? <div className="mt-4 grid gap-2 text-sm text-[#102c3d]/58">{downloadLabels(programme.commercialProfile.downloads).map((item) => <div key={item} className="flex items-center gap-2"><Download size={14} className="text-[#0b8e82]" />{item}</div>)}</div> : null}
        </div>
      </section>
    </div>
  );
}


type ProgrammeEditorProps = {
  draft: ProviderProgramme;
  onDraft: (draft: ProviderProgramme) => void;
  standardSearch: string;
  onStandardSearch: (value: string) => void;
  onSubmit: (event: FormEvent) => void;
  onCancel: () => void;
  onArchive: () => void;
  onRemove: () => void;
  error: string;
  standards: ApprenticeshipStandard[];
};

function ProgrammeEditor({
  draft,
  onDraft,
  standardSearch,
  onStandardSearch,
  onSubmit,
  onCancel,
  onArchive,
  onRemove,
  error,
  standards,
}: ProgrammeEditorProps) {
  const selectedStandards = useMemo(
    () => draft.linkedStandardIds.map((id) => standards.find((standard) => standard.id === id)).filter(Boolean) as ApprenticeshipStandard[],
    [draft.linkedStandardIds, standards],
  );

  const filteredStandards = useMemo(() => {
    const query = standardSearch.trim().toLowerCase();
    return standards
      .filter((standard) => {
        if (!query) return true;
        const jobTitles = (standard.jobTitles ?? []).join(" ").toLowerCase();
        return [standard.title, standard.referenceCode, standard.occupationalRoute, jobTitles].join(" ").toLowerCase().includes(query);
      })
      .slice(0, 14);
  }, [standardSearch, standards]);

  function applyStandards(nextIds: string[]) {
    const primary = nextIds[0] ?? "";
    const primaryStandard = standards.find((standard) => standard.id === primary);
    onDraft(
      normaliseProviderProgramme({
        ...draft,
        linkedStandardIds: nextIds,
        linkedStandardId: primary,
        linkedStandardName: primaryStandard?.title ?? "",
        level: primaryStandard?.level ?? null,
        route: primaryStandard?.occupationalRoute ?? "",
        fundingBand: primaryStandard?.fundingBand ?? null,
        officialUrl: primaryStandard?.officialUrl ?? "",
      }),
    );
  }

  function toggleStandard(standard: ApprenticeshipStandard) {
    const exists = draft.linkedStandardIds.includes(standard.id);
    applyStandards(exists ? draft.linkedStandardIds.filter((id) => id !== standard.id) : [...draft.linkedStandardIds, standard.id]);
  }

  const primaryStandard = selectedStandards[0];

  return (
    <form onSubmit={onSubmit} className="grid gap-5 lg:grid-cols-[minmax(0,1.35fr)_360px]">
      <div className="grid gap-4">
        <FormSection title="Programme proposition" copy="Lead with employer value, audience and outcomes before funding metadata.">
          <FormGrid>
            <FormField label="Programme name" value={draft.programmeName} onChange={(value) => onDraft({ ...draft, programmeName: value })} required wide />
            <FormField label="Tagline" value={draft.commercialProfile.tagline} onChange={(value) => onDraft({ ...draft, commercialProfile: { ...draft.commercialProfile, tagline: value } })} wide />
            <FormTextArea label="Short description" value={draft.shortDescription} onChange={(value) => onDraft({ ...draft, shortDescription: value })} rows={3} wide />
            <FormTextArea label="Full description" value={draft.fullDescription} onChange={(value) => onDraft({ ...draft, fullDescription: value })} rows={5} wide />
            <FormField label="Ideal audience" value={draft.commercialProfile.idealAudience} onChange={(value) => onDraft({ ...draft, commercialProfile: { ...draft.commercialProfile, idealAudience: value } })} wide />
            <FormSelect label="Seniority" value={draft.seniority} onChange={(value) => onDraft({ ...draft, seniority: value as ProviderProgrammeSeniority })} options={seniorityOptions} />
            <FormSelect label="Employer size" value={draft.employerSize} onChange={(value) => onDraft({ ...draft, employerSize: value as ProviderEmployerSize })} options={employerSizeOptions} />
          </FormGrid>
        </FormSection>

        <FormSection title="Audience, outcomes and capability" copy="These fields power discovery, matching and employer comparison.">
          <FormGrid>
            <FormTagInput label="Target industries" values={draft.targetIndustries} onChange={(value) => onDraft({ ...draft, targetIndustries: value })} wide />
            <FormTagInput label="Typical job roles" values={draft.targetJobRoles} onChange={(value) => onDraft({ ...draft, targetJobRoles: value })} wide />
            <FormTagInput label="Business problems solved" values={draft.businessProblemsSolved} onChange={(value) => onDraft({ ...draft, businessProblemsSolved: value })} wide />
            <FormTagInput label="Skills developed" values={draft.skillsDeveloped} onChange={(value) => onDraft({ ...draft, skillsDeveloped: value })} wide />
            <FormTagInput label="Technologies covered" values={draft.technologiesCovered} onChange={(value) => onDraft({ ...draft, technologiesCovered: value })} wide />
            <FormTagInput label="Expected outcomes" values={draft.expectedOutcomes} onChange={(value) => onDraft({ ...draft, expectedOutcomes: value })} wide />
            <FormTagInput label="Employer benefits" values={draft.commercialProfile.employerBenefits} onChange={(value) => onDraft({ ...draft, commercialProfile: { ...draft.commercialProfile, employerBenefits: value } })} wide />
            <FormTagInput label="Future capability impact" values={draft.commercialProfile.futureCapabilityImpact} onChange={(value) => onDraft({ ...draft, commercialProfile: { ...draft.commercialProfile, futureCapabilityImpact: value } })} wide />
            <FormTagInput label="Typical departments" values={draft.commercialProfile.typicalDepartments} onChange={(value) => onDraft({ ...draft, commercialProfile: { ...draft.commercialProfile, typicalDepartments: value } })} wide />
            <FormTagInput label="Progression routes" values={draft.commercialProfile.progressionRoutes} onChange={(value) => onDraft({ ...draft, commercialProfile: { ...draft.commercialProfile, progressionRoutes: value } })} wide />
            <FormTagInput label="Case studies" values={draft.commercialProfile.caseStudies} onChange={(value) => onDraft({ ...draft, commercialProfile: { ...draft.commercialProfile, caseStudies: value } })} wide />
            <FormTagInput label="FAQs" values={draft.commercialProfile.faqs} onChange={(value) => onDraft({ ...draft, commercialProfile: { ...draft.commercialProfile, faqs: value } })} wide />
          </FormGrid>
        </FormSection>

        <FormSection title="Delivery and compliance" copy="The apprenticeship standard supports compliance and funding once the programme proposition is already clear.">
          <FormGrid>
            <FormTagInput label="Delivery models" values={draft.deliveryModels} onChange={(value) => onDraft({ ...draft, deliveryModels: value })} wide />
            <FormTagInput label="Regions" values={draft.regions} onChange={(value) => onDraft({ ...draft, regions: value })} wide />
            <FormField label="Duration" value={draft.duration} onChange={(value) => onDraft({ ...draft, duration: value })} />
            <FormSelect label="Funding route" value={draft.fundingRoute} onChange={(value) => onDraft({ ...draft, fundingRoute: value as FundingRoute })} options={fundingRoutes} />
            <FormSelect label="Status" value={draft.status} onChange={(value) => onDraft({ ...draft, status: value as ProviderProgrammeStatus })} options={programmeStatuses} />
            <FormSelect label="Verification" value={draft.verificationStatus} onChange={(value) => onDraft({ ...draft, verificationStatus: value as ProviderProgrammeVerificationStatus })} options={verificationStatuses} />
            <FormField label="Confidence label" value={draft.commercialProfile.confidenceLabel} onChange={(value) => onDraft({ ...draft, commercialProfile: { ...draft.commercialProfile, confidenceLabel: value } })} />
            <FormField label="Source record" value={draft.sourceUrl} onChange={(value) => onDraft({ ...draft, sourceUrl: value })} />
            <FormTextArea label="Employer commitment" value={draft.commercialProfile.employerCommitment} onChange={(value) => onDraft({ ...draft, commercialProfile: { ...draft.commercialProfile, employerCommitment: value } })} rows={3} wide />
            <FormTextArea label="Assessment approach" value={draft.commercialProfile.assessmentApproach} onChange={(value) => onDraft({ ...draft, commercialProfile: { ...draft.commercialProfile, assessmentApproach: value } })} rows={3} wide />
            <FormTextArea label="Commercial notes" value={draft.commercialNotes} onChange={(value) => onDraft({ ...draft, commercialNotes: value })} rows={3} wide />
          </FormGrid>
        </FormSection>

        <FormSection title="Linked apprenticeship standards" copy="Keep standards underneath the programme proposition. The first selected standard becomes the primary funding record.">
          <div className="grid gap-4">
            <label className="grid gap-1.5 text-xs font-semibold text-[#102c3d]/58">
              Search standards
              <input value={standardSearch} onChange={(event) => onStandardSearch(event.target.value)} placeholder="Search by title, reference or job title" className="h-11 rounded-lg border border-[#102c3d]/[0.09] bg-[#f8fbfa] px-3 text-sm font-medium text-[#102c3d] outline-none transition focus:border-[#159b8f] focus:bg-white focus:ring-4 focus:ring-[#159b8f]/10" />
            </label>
            {selectedStandards.length ? (
              <div className="flex flex-wrap gap-2">
                {selectedStandards.map((standard) => (
                  <button key={standard.id} type="button" onClick={() => toggleStandard(standard)} className="inline-flex items-center gap-2 rounded-full bg-[#edf7f3] px-3 py-1.5 text-xs font-semibold text-[#0b6f63] ring-1 ring-[#159b8f]/12">
                    {standard.title}
                    <span className="text-[#0b6f63]/60">Remove</span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-sm text-[#102c3d]/52">No standards linked yet. Add at least one standard before saving.</p>
            )}
            <div className="grid gap-2 rounded-2xl bg-[#f8fbfa] p-3 ring-1 ring-[#102c3d]/[0.06]">
              {filteredStandards.map((standard) => {
                const active = draft.linkedStandardIds.includes(standard.id);
                return (
                  <button key={standard.id} type="button" onClick={() => toggleStandard(standard)} className={`rounded-xl border px-3 py-3 text-left transition ${active ? "border-[#159b8f]/30 bg-white shadow-[0_10px_18px_rgba(21,155,143,0.08)]" : "border-[#102c3d]/[0.07] bg-white hover:border-[#159b8f]/18"}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-[#102c3d]">{standard.title}</p>
                        <p className="mt-1 text-xs text-[#102c3d]/48">{standard.referenceCode} | Level {standard.level} | {standard.occupationalRoute}</p>
                      </div>
                      <StatusBadge tone={active ? "green" : "neutral"}>{active ? "Selected" : "Add"}</StatusBadge>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </FormSection>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#102c3d]/[0.07] pt-4">
          <div className="flex gap-2">
            <TableAction onClick={onArchive} danger={draft.recordStatus === "Active"}>{draft.recordStatus === "Archived" ? "Restore programme" : "Archive programme"}</TableAction>
            <TableAction onClick={onRemove} danger>Remove programme</TableAction>
          </div>
          <div className="min-w-[220px] text-right text-xs font-semibold text-[#102c3d]/48">{programmeProfileCompletion(draft.commercialProfile)}% programme completeness</div>
        </div>

        <FormActions onCancel={onCancel} label="Save programme" error={error} />
      </div>

      <div className="grid gap-4 self-start">
        <MarketplaceSignalCard title="Programme preview" copy="The marketplace should sell the employer value in a few seconds." items={[
          draft.commercialProfile.tagline || "Add a sharper employer-facing tagline",
          draft.shortDescription || "Add a short proposition summary",
          primaryStandard ? `${primaryStandard.title} linked for compliance` : "Select a primary apprenticeship standard",
        ]} />
        <ProgrammeMarketplaceCard programme={draft} provider={undefined} standard={primaryStandard} onOpen={() => undefined} preview />
      </div>
    </form>
  );
}

function ProviderComparison({
  providers,
  programmes,
  standards,
  onOpenProfile,
  onOpenProgramme,
}: {
  providers: ProviderCatalogueRecord[];
  programmes: ProviderProgramme[];
  standards: ApprenticeshipStandard[];
  onOpenProfile: (providerId: string) => void;
  onOpenProgramme: (providerId: string, programmeId: string) => void;
}) {
  const cards = providers.map((provider) => {
    const providerProgrammes = programmes.filter((programme) => programme.providerId === provider.providerId && programme.recordStatus === "Active");
    const featuredProgramme = firstProgramme(providerProgrammes);
    const standard = featuredProgramme ? programmePrimaryStandard(featuredProgramme, standards) : undefined;
    return { provider, providerProgrammes, featuredProgramme, standard };
  });

  const rows = [
    {
      label: "Delivery",
      render: (card: (typeof cards)[number]) => card.featuredProgramme?.deliveryModels.join(", ") || card.provider.deliveryModels.join(", ") || "Not published",
    },
    {
      label: "Technologies",
      render: (card: (typeof cards)[number]) => (card.featuredProgramme?.technologiesCovered.slice(0, 3).join(", ") || card.provider.technologies.slice(0, 3).join(", ") || "Not published"),
    },
    {
      label: "Industries",
      render: (card: (typeof cards)[number]) => (card.featuredProgramme?.targetIndustries.slice(0, 3).join(", ") || card.provider.industries.slice(0, 3).join(", ") || "Not published"),
    },
    {
      label: "Strengths",
      render: (card: (typeof cards)[number]) => (card.featuredProgramme?.commercialProfile.employerBenefits[0] || card.provider.specialisms[0] || "Not published"),
    },
    {
      label: "Limitations",
      render: (card: (typeof cards)[number]) => (card.featuredProgramme?.verificationStatus === "Needs manual verification" ? "Verification still required" : "No material concern flagged"),
    },
    {
      label: "Employer size",
      render: (card: (typeof cards)[number]) => card.featuredProgramme?.employerSize || card.provider.commercialProfile.employerSizesSupported[0] || "Not published",
    },
    {
      label: "Regions",
      render: (card: (typeof cards)[number]) => card.provider.regions.slice(0, 3).join(", ") || "Not published",
    },
    {
      label: "Funding",
      render: (card: (typeof cards)[number]) => card.featuredProgramme?.fundingRoute || "Not published",
    },
    {
      label: "Duration",
      render: (card: (typeof cards)[number]) => card.featuredProgramme?.duration || "Not published",
    },
    {
      label: "Recommendation",
      render: (card: (typeof cards)[number]) => card.provider.commercialProfile.positioningStatement || fallbackProviderDescription(card.provider),
    },
  ];

  return (
    <div className="grid gap-4">
      <div className="overflow-x-auto">
        <div className="grid min-w-[980px] gap-3" style={{ gridTemplateColumns: `220px repeat(${cards.length}, minmax(0, 1fr))` }}>
          <div className="rounded-2xl border border-dashed border-[#102c3d]/[0.12] bg-[#f8fbfa] p-4">
            <p className="text-sm font-semibold text-[#102c3d]">Comparison focus</p>
            <p className="mt-2 text-sm leading-6 text-[#102c3d]/56">Compare provider profiles the way an employer buyer would: proposition first, compliance after.</p>
          </div>
          {cards.map(({ provider, featuredProgramme, standard }) => (
            <div key={provider.providerId} className="rounded-2xl border border-[#102c3d]/[0.07] bg-white p-4 shadow-[0_14px_30px_rgba(16,44,61,0.045)]">
              <div className={`rounded-2xl bg-gradient-to-br ${providerTheme(provider.providerId)} p-4 text-white`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-white/70">{provider.providerType}</p>
                    <h3 className="mt-2 text-lg font-semibold">{provider.providerName}</h3>
                    <p className="mt-2 text-sm text-white/78">{provider.commercialProfile.positioningStatement || fallbackProviderDescription(provider)}</p>
                  </div>
                  <StatusBadge tone={provider.verificationStatus === "verified" ? "green" : "yellow"}>{provider.verificationStatus === "verified" ? "Verified" : "Review"}</StatusBadge>
                </div>
              </div>
              <div className="mt-4 grid gap-3">
                <MetricTile label="Featured programme" value={featuredProgramme?.programmeName || "Needs verification"} />
                <MetricTile label="Linked standard" value={standard?.title || featuredProgramme?.linkedStandardName || "Needs verification"} />
                <div className="flex gap-2">
                  <TableAction onClick={() => onOpenProfile(provider.providerId)}>Open profile</TableAction>
                  {featuredProgramme ? <TableAction onClick={() => onOpenProgramme(provider.providerId, featuredProgramme.id)}>View programme</TableAction> : null}
                </div>
              </div>
            </div>
          ))}

          {rows.map((row) => (
            <div key={row.label} className="contents">
              <div className="rounded-2xl bg-[#f8fbfa] p-4 ring-1 ring-[#102c3d]/[0.06]">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#102c3d]/50">{row.label}</p>
              </div>
              {cards.map((card) => (
                <div key={`${row.label}-${card.provider.providerId}`} className="rounded-2xl bg-white p-4 ring-1 ring-[#102c3d]/[0.06]">
                  <p className="text-sm leading-6 text-[#102c3d]/62">{row.render(card)}</p>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ProgrammeMarketplaceCard({
  programme,
  provider,
  standard,
  onOpen,
  preview = false,
}: {
  programme: ProviderProgramme;
  provider?: ProviderCatalogueRecord;
  standard?: ApprenticeshipStandard;
  onOpen: () => void;
  preview?: boolean;
}) {
  return (
    <article className="rounded-2xl border border-[#102c3d]/[0.07] bg-white p-4 shadow-[0_14px_32px_rgba(16,44,61,0.045)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#c95568]">Programme destination</p>
          <h4 className="mt-1 text-base font-semibold text-[#102c3d]">{programme.programmeName || "Programme name"}</h4>
          <p className="mt-1 text-sm font-medium text-[#0b6f63]">{provider?.providerName || "Current provider"}</p>
        </div>
        <StatusBadge tone={programme.verificationStatus === "Needs manual verification" ? "yellow" : "green"}>{programme.commercialProfile.confidenceLabel || "High"}</StatusBadge>
      </div>
      <p className="mt-3 text-sm leading-6 text-[#102c3d]/58">{programme.commercialProfile.tagline || programme.shortDescription || "Add employer-facing programme copy."}</p>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <MetricTile label="Delivery" value={programme.deliveryModels.join(", ") || "Not published"} compact />
        <MetricTile label="Standard" value={standard?.title || programme.linkedStandardName || "Needs verification"} compact />
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {programme.technologiesCovered.slice(0, 3).map((item) => <Tag key={item}>{item}</Tag>)}
        {programme.targetIndustries.slice(0, 2).map((item) => <Tag key={item}>{item}</Tag>)}
        {programme.businessProblemsSolved.slice(0, 2).map((item) => <Tag key={item} tone="accent">{item}</Tag>)}
      </div>
      {!preview ? (
        <div className="mt-4 flex justify-end">
          <TableAction onClick={onOpen}>View programme</TableAction>
        </div>
      ) : null}
    </article>
  );
}

function ProviderHeroCard({ provider, programmeCount }: { provider: ProviderCatalogueRecord; programmeCount: number }) {
  return (
    <section className={`overflow-hidden rounded-3xl bg-gradient-to-br ${providerTheme(provider.providerId)} text-white shadow-[0_18px_42px_rgba(16,44,61,0.16)]`}>
      <div className="grid gap-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="inline-flex rounded-2xl bg-white/12 px-3 py-2 text-sm font-semibold backdrop-blur-sm">{providerWordmark(provider)}</div>
            <h3 className="mt-4 text-xl font-semibold">{provider.providerName || "Provider partner"}</h3>
            <p className="mt-2 text-sm text-white/78">{provider.commercialProfile.positioningStatement || "Add a buyer-facing positioning statement."}</p>
          </div>
          <BadgeCheck size={18} className="text-white/80" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <MetricTile inverse label="Programmes" value={String(programmeCount)} compact />
          <MetricTile inverse label="Reach" value={providerReachLabel(provider)} compact />
        </div>
      </div>
    </section>
  );
}

function VerifiedSourcesCard({ urls, lastReviewed }: { urls: string[]; lastReviewed: string }) {
  const sources = cleanSourceUrls(urls);
  const reviewed = formatReviewedDate(lastReviewed);
  if (!sources.length && !reviewed) return null;

  return (
    <section className="rounded-2xl border border-[#102c3d]/[0.07] bg-white p-5 shadow-[0_14px_32px_rgba(16,44,61,0.045)]">
      <div className="flex items-center gap-2 text-[#0b8e82]">
        <ShieldCheck size={15} />
        <p className="text-sm font-semibold text-[#102c3d]">Verified Sources</p>
      </div>
      {reviewed ? (
        <div className="mt-4 flex items-center gap-3 rounded-2xl bg-[#f8fbfa] px-3 py-3 ring-1 ring-[#102c3d]/[0.06]">
          <CalendarCheck size={15} className="shrink-0 text-[#0b8e82]" />
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-[#102c3d]/42">Last reviewed</p>
            <p className="mt-0.5 text-sm font-semibold text-[#102c3d]">{reviewed}</p>
          </div>
        </div>
      ) : null}
      {sources.length ? (
        <div className="mt-3 grid gap-2">
          {sources.map((url) => (
            <a key={url} href={url} target="_blank" rel="noreferrer" className="group flex items-center justify-between gap-3 rounded-2xl bg-[#f8fbfa] px-3 py-3 text-sm ring-1 ring-[#102c3d]/[0.06] transition hover:bg-white hover:ring-[#159b8f]/20">
              <span className="flex min-w-0 items-center gap-3">
                <Globe2 size={15} className="shrink-0 text-[#0b8e82]" />
                <span className="min-w-0">
                  <span className="block font-semibold text-[#102c3d]">Official provider website</span>
                  <span className="block truncate text-xs text-[#102c3d]/48">{sourceHost(url)}</span>
                </span>
              </span>
              <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-[#0b6f63]">View source <ExternalLink size={13} /></span>
            </a>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function DownloadsCard({ links, contactEmail }: { links: CommercialLink[]; contactEmail?: string }) {
  const downloads = links.filter((link) => cleanDisplayText(link.label));
  const email = cleanDisplayText(contactEmail);
  if (!downloads.length && !email) return null;

  return (
    <section className="rounded-2xl border border-[#102c3d]/[0.07] bg-white p-5 shadow-[0_14px_32px_rgba(16,44,61,0.045)]">
      <div className="flex items-center gap-2 text-[#0b8e82]">
        <Download size={15} />
        <p className="text-sm font-semibold text-[#102c3d]">Downloads and contact</p>
      </div>
      <div className="mt-4 grid gap-2">
        {downloads.map((link) => (
          <div key={`${link.kind}-${link.label}`} className="flex items-center gap-3 rounded-2xl bg-[#f8fbfa] px-3 py-3 text-sm text-[#102c3d]/64 ring-1 ring-[#102c3d]/[0.06]">
            <Download size={14} className="shrink-0 text-[#0b8e82]" />
            <span>{cleanDisplayText(link.label)}</span>
          </div>
        ))}
        {email ? (
          <div className="flex items-center gap-3 rounded-2xl bg-[#f8fbfa] px-3 py-3 text-sm text-[#102c3d]/64 ring-1 ring-[#102c3d]/[0.06]">
            <Users size={14} className="shrink-0 text-[#0b8e82]" />
            <span>{email}</span>
          </div>
        ) : null}
      </div>
    </section>
  );
}
function MarketplaceSignalCard({ title, copy, items }: { title: string; copy: string; items: string[] }) {
  const values = cleanDisplayList(items);
  if (!values.length) return null;
  return (
    <section className="rounded-2xl border border-[#102c3d]/[0.07] bg-white p-5 shadow-[0_14px_28px_rgba(16,44,61,0.045)]">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#c95568]">{title}</p>
      <p className="mt-2 text-sm leading-6 text-[#102c3d]/58">{copy}</p>
      <div className="mt-4 grid gap-3">
        {values.map((item) => (
          <div key={item} className="flex items-start gap-3 rounded-2xl bg-[#f8fbfa] px-3 py-3 ring-1 ring-[#102c3d]/[0.06]">
            <Sparkles size={15} className="mt-0.5 shrink-0 text-[#0b8e82]" />
            <p className="text-sm leading-6 text-[#102c3d]/60">{item}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function SummaryCard({ label, value, copy, tone }: { label: string; value: string | number; copy: string; tone: "green" | "yellow" | "blue" }) {
  const accent = {
    green: "bg-[#e9f7f2] text-[#0b6f63]",
    yellow: "bg-[#fff7cf] text-[#756000]",
    blue: "bg-[#eef4f8] text-[#315e78]",
  }[tone];
  return (
    <article className="rounded-xl border border-[#102c3d]/[0.07] bg-white p-4 shadow-[0_12px_26px_rgba(16,44,61,0.04)]">
      <div className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${accent}`}>{label}</div>
      <p className="mt-3 text-2xl font-semibold text-[#102c3d]">{value}</p>
      <p className="mt-1 text-sm leading-6 text-[#102c3d]/58">{copy}</p>
    </article>
  );
}

function MetricTile({ label, value, inverse = false, compact = false }: { label: string; value: string; inverse?: boolean; compact?: boolean }) {
  const displayValue = cleanDisplayText(value);
  if (!displayValue) return null;
  return (
    <div className={`rounded-2xl ${inverse ? "bg-white/10 ring-white/10 text-white" : "bg-[#f8fbfa] ring-[#102c3d]/[0.06] text-[#102c3d]"} ${compact ? "p-3" : "p-4"} ring-1`}>
      <p className={`text-[10px] font-semibold uppercase tracking-[0.12em] ${inverse ? "text-white/62" : "text-[#102c3d]/42"}`}>{label}</p>
      <p className={`mt-2 ${compact ? "text-sm" : "text-base"} font-semibold ${inverse ? "text-white" : "text-[#102c3d]"}`}>{displayValue}</p>
    </div>
  );
}

function InfoSection({ title, copy }: { title: string; copy: string }) {
  const value = cleanDisplayText(copy);
  if (!value) return null;
  return (
    <section className="rounded-2xl border border-[#102c3d]/[0.07] bg-white p-5 shadow-[0_14px_32px_rgba(16,44,61,0.045)]">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#c95568]">{title}</p>
      <p className="mt-3 text-sm leading-7 text-[#102c3d]/60">{value}</p>
    </section>
  );
}

function InfoChips({ title, icon: Icon, items }: { title: string; icon: typeof Users; items: string[] }) {
  const values = cleanDisplayList(items);
  if (!values.length) return null;
  return (
    <section className="rounded-2xl border border-[#102c3d]/[0.07] bg-white p-5 shadow-[0_14px_32px_rgba(16,44,61,0.045)]">
      <div className="flex items-center gap-2 text-[#0b8e82]">
        <Icon size={15} />
        <p className="text-sm font-semibold text-[#102c3d]">{title}</p>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {values.map((item) => <Tag key={item}>{item}</Tag>)}
      </div>
    </section>
  );
}

function Tag({ children, tone = "default" }: { children: string; tone?: "default" | "accent" }) {
  const label = cleanDisplayText(children);
  if (!label) return null;
  return (
    <span className={`inline-flex rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ${tone === "accent" ? "bg-[#edf7f3] text-[#0b6f63] ring-[#159b8f]/12" : "bg-white text-[#102c3d]/68 ring-[#102c3d]/[0.07]"}`}>
      {label}
    </span>
  );
}
