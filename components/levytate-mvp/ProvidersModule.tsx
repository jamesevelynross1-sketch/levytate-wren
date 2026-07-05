"use client";

import {
  ArrowUpRight,
  Award,
  BadgeCheck,
  Building2,
  Globe,
  ImageIcon,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  Trophy,
  Users,
} from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import type {
  ApprenticeshipStandard,
  FundingRoute,
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
  emptyProviderCommercialProfile,
  formatFundingBand,
  getApprenticeshipStandard,
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
import { includesSearch, statusTone } from "@/components/levytate-mvp/module-utils";
import { createMvpId, normaliseProviderProgramme, normaliseProviderRecord, nowIso, todayIso } from "@/lib/levytate/mvp/workspace";

const tabs = ["Commercial Profile", "Programmes", "Internal Notes"] as const;
type ProviderTab = (typeof tabs)[number];

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

const programmeStatuses: ProviderProgrammeStatus[] = ["Active", "Needs verification", "Paused", "Not available", "Defunded / unavailable for new starts"];
const verificationStatuses: ProviderProgrammeVerificationStatus[] = ["Verified from provider website", "Needs manual verification", "Provider confirmed", "LevyTate reviewed"];
const fundingRoutes: FundingRoute[] = ["Potentially levy-funded", "Potentially funded through levy/co-investment", "Commercial training budget"];
const seniorityOptions: ProviderProgrammeSeniority[] = ["Entry", "Early career", "Experienced", "Supervisor", "Manager", "Mixed"];
const employerSizeOptions: ProviderEmployerSize[] = ["SME", "Mid-market", "Large enterprise", "Mixed employer base"];
const confidenceOptions = ["High", "Medium", "Low"] as const;

function programmeTone(status: ProviderProgrammeStatus) {
  if (status === "Active") return "green" as const;
  if (status === "Needs verification" || status === "Paused") return "yellow" as const;
  return "red" as const;
}

function average(values: number[]) {
  if (!values.length) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function fallbackProviderDescription(provider: ProviderCatalogueRecord) {
  return provider.commercialProfile.organisationDescription || provider.notes || "Commercial profile summary to confirm.";
}

function fallbackProgrammeHighlights(programme: ProviderProgramme) {
  if (programme.commercialProfile.keyOutcomes.length) return programme.commercialProfile.keyOutcomes;
  if (programme.expectedOutcomes.length) return programme.expectedOutcomes;
  return ["Employer outcomes to confirm"];
}

export function ProvidersModule() {
  const { data, saveProvider, archiveProvider, saveProviderProgramme, archiveProviderProgramme, removeProviderProgramme } = useMvpWorkspace();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("Active");
  const [draft, setDraft] = useState<ProviderCatalogueRecord | null>(null);
  const [activeTab, setActiveTab] = useState<ProviderTab>("Commercial Profile");
  const [programmeDraft, setProgrammeDraft] = useState<ProviderProgramme | null>(null);
  const [programmeSearch, setProgrammeSearch] = useState("");
  const [standardSearch, setStandardSearch] = useState("");
  const [levelFilter, setLevelFilter] = useState("All");
  const [routeFilter, setRouteFilter] = useState("All");
  const [deliveryFilter, setDeliveryFilter] = useState("All");
  const [programmeStatusFilter, setProgrammeStatusFilter] = useState("All");
  const [error, setError] = useState("");
  const { selectableStandards } = useLevyTateStandards();

  const providerStats = useMemo(() => {
    const activeProviders = data.providers.filter((provider) => provider.status === "Active");
    const visibleProgrammes = data.providerProgrammes.filter((programme) => programme.recordStatus === "Active");
    const verifiedProgrammes = visibleProgrammes.filter((programme) => programme.verificationStatus !== "Needs manual verification");
    return {
      activeProviders: activeProviders.length,
      programmeCount: visibleProgrammes.length,
      providerCompletion: average(activeProviders.map((provider) => commercialProfileCompletion(provider.commercialProfile))),
      programmeCompletion: average(visibleProgrammes.map((programme) => programmeProfileCompletion(programme.commercialProfile))),
      verifiedProgrammes: verifiedProgrammes.length,
      verifiedPartnerCount: new Set(verifiedProgrammes.map((programme) => programme.providerId)).size,
    };
  }, [data.providerProgrammes, data.providers]);

  const visible = useMemo(() => data.providers.filter((provider) => {
    const programmes = data.providerProgrammes.filter((item) => item.providerId === provider.providerId);
    const programmeText = programmes.map((programme) => [
      programme.programmeName,
      programme.shortDescription,
      programme.targetJobRoles.join(" "),
      programme.technologiesCovered.join(" "),
      programme.businessProblemsSolved.join(" "),
      programme.commercialProfile.tagline,
      programme.commercialProfile.idealAudience,
      programme.commercialProfile.employerBenefits.join(" "),
      programme.commercialProfile.futureCapabilityImpact.join(" "),
    ].join(" ")).join(" ");

    return (status === "All" || provider.status === status)
      && includesSearch([
        provider.providerName,
        provider.providerType,
        provider.sectors.join(" "),
        provider.industries.join(" "),
        provider.technologies.join(" "),
        provider.deliveryModels.join(" "),
        provider.regions.join(" "),
        provider.employerTypes.join(" "),
        provider.specialisms.join(" "),
        fallbackProviderDescription(provider),
        provider.commercialProfile.awards.join(" "),
        provider.commercialProfile.accreditations.join(" "),
        provider.commercialProfile.caseStudies.join(" "),
        provider.commercialProfile.testimonials.join(" "),
        provider.commercialProfile.employerSizesSupported.join(" "),
        provider.commercialProfile.pricingNotes,
        provider.commercialProfile.commercialNotes,
        programmeText,
      ], search);
  }).sort((left, right) => commercialProfileCompletion(right.commercialProfile) - commercialProfileCompletion(left.commercialProfile) || left.providerName.localeCompare(right.providerName)), [data.providerProgrammes, data.providers, search, status]);

  const selectedProviderProgrammes = useMemo(() => {
    if (!draft) return [];
    return data.providerProgrammes.filter((programme) => {
      if (programme.providerId !== draft.providerId) return false;
      const primaryStandard = programmePrimaryStandard(programme, selectableStandards);
      return includesSearch([
        programme.programmeName,
        programme.shortDescription,
        programme.fullDescription,
        programme.targetIndustries.join(" "),
        programme.targetJobRoles.join(" "),
        programme.technologiesCovered.join(" "),
        programme.expectedOutcomes.join(" "),
        programme.commercialProfile.tagline,
        programme.commercialProfile.idealAudience,
        programme.commercialProfile.keyOutcomes.join(" "),
        primaryStandard?.title,
        primaryStandard?.referenceCode,
        primaryStandard?.occupationalRoute,
      ], programmeSearch)
        && (levelFilter === "All" || String(primaryStandard?.level) === levelFilter)
        && (routeFilter === "All" || primaryStandard?.occupationalRoute === routeFilter)
        && (deliveryFilter === "All" || programme.deliveryModels.includes(deliveryFilter))
        && (programmeStatusFilter === "All" || programme.status === programmeStatusFilter);
    }).sort((a, b) => a.programmeName.localeCompare(b.programmeName));
  }, [data.providerProgrammes, deliveryFilter, draft, levelFilter, programmeSearch, programmeStatusFilter, routeFilter, selectableStandards]);

  const allRoutes = useMemo(() => Array.from(new Set(selectableStandards.map((standard) => standard.occupationalRoute))).sort(), [selectableStandards]);
  const allDeliveryModels = useMemo(() => Array.from(new Set(data.providerProgrammes.flatMap((programme) => programme.deliveryModels))).sort(), [data.providerProgrammes]);

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
      recordStatus: "Active",
      createdAt: now,
      updatedAt: now,
    });
  }
  function openProvider(provider?: ProviderCatalogueRecord, tab: ProviderTab = "Commercial Profile") {
    setDraft(provider ? structuredClone(provider) : blankProvider());
    setActiveTab(tab);
    setProgrammeDraft(null);
    setError("");
  }

  function submitProvider(event: FormEvent) {
    event.preventDefault();
    if (!draft) return;
    if (!draft.providerName.trim()) {
      setError("Provider name is required.");
      return;
    }
    saveProvider(normaliseProviderRecord({ ...draft, providerName: draft.providerName.trim(), lastVerified: todayIso() }));
    setDraft(null);
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
    const duplicate = data.providerProgrammes.some((programme) => programme.providerId === programmeDraft.providerId && programme.programmeName.trim().toLowerCase() === programmeDraft.programmeName.trim().toLowerCase() && programme.id !== programmeDraft.id);
    if (duplicate) {
      setError("This provider already has a programme with that name.");
      return;
    }
    saveProviderProgramme(normaliseProviderProgramme({ ...programmeDraft, programmeName: programmeDraft.programmeName.trim(), updatedAt: nowIso() }));
    setProgrammeDraft(null);
    setStandardSearch("");
    setError("");
  }

  function removeProgramme(programme: ProviderProgramme) {
    if (window.confirm(`Remove ${programme.programmeName} from the provider catalogue?`)) {
      removeProviderProgramme(programme.id);
    }
  }

  const providerExists = Boolean(draft && data.providers.some((provider) => provider.providerId === draft.providerId));
  const selectedProviderCompletion = draft ? commercialProfileCompletion(draft.commercialProfile) : 0;
  const selectedProgrammeCompletion = selectedProviderProgrammes.length ? average(selectedProviderProgrammes.map((programme) => programmeProfileCompletion(programme.commercialProfile))) : 0;

  return (
    <div className="grid gap-5">
      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <SummaryCard label="Active provider partners" value={providerStats.activeProviders} copy="Organisations currently active in the controlled LevyTate partner catalogue." tone="blue" />
        <SummaryCard label="Commercial profile completion" value={`${providerStats.providerCompletion}%`} copy="Average partner profile quality across proof points, contacts and buyer signals." tone="green" />
        <SummaryCard label="Programme catalogue" value={providerStats.programmeCount} copy="Programme-first propositions available for employer matching and consultancy shortlists." tone="blue" />
        <SummaryCard label="Programme readiness" value={`${providerStats.programmeCompletion}%`} copy="Average programme completeness across outcomes, audience, delivery and compliance metadata." tone="green" />
        <SummaryCard label="Verified partners" value={providerStats.verifiedPartnerCount} copy={`${providerStats.verifiedProgrammes} programmes already verified for shortlist-ready matching.`} tone="yellow" />
      </section>

      <MvpPanel title="Provider partners" eyebrow="Commercial provider intelligence">
        <MvpToolbar
          search={search}
          onSearch={setSearch}
          placeholder="Search providers, sectors, technologies, outcomes or buyer signals"
          actionLabel="Add provider"
          onAction={() => openProvider()}
          filters={<select value={status} onChange={(event) => setStatus(event.target.value)} className="h-10 rounded-lg border border-[#102c3d]/[0.09] bg-white px-3 text-sm font-semibold"><option>Active</option><option>Archived</option><option>All</option></select>}
        />

        {visible.length ? (
          <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
            {visible.map((provider) => {
              const programmes = data.providerProgrammes.filter((programme) => programme.providerId === provider.providerId && programme.recordStatus === "Active");
              const verifiedCount = programmes.filter((programme) => programme.verificationStatus !== "Needs manual verification").length;
              const completeness = commercialProfileCompletion(provider.commercialProfile);
              return (
                <article key={provider.providerId} className="group rounded-2xl border border-[#102c3d]/[0.07] bg-white p-5 shadow-[0_18px_36px_rgba(16,44,61,0.045)] transition hover:-translate-y-0.5 hover:shadow-[0_22px_42px_rgba(16,44,61,0.075)]">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-lg font-semibold text-[#102c3d]">{provider.providerName}</p>
                        <StatusBadge tone={statusTone(provider.status)}>{provider.status}</StatusBadge>
                      </div>
                      <p className="mt-1 text-sm text-[#102c3d]/58">{provider.providerType}</p>
                    </div>
                    <StatusBadge tone={completeness >= 70 ? "green" : completeness >= 45 ? "yellow" : "red"}>{completeness}% complete</StatusBadge>
                  </div>

                  <p className="mt-4 text-sm leading-6 text-[#102c3d]/58">{fallbackProviderDescription(provider)}</p>

                  <div className="mt-4 grid grid-cols-3 gap-2">
                    <MetricPill icon={Building2} label="Programmes" value={programmes.length} />
                    <MetricPill icon={BadgeCheck} label="Verified" value={verifiedCount} />
                    <MetricPill icon={Users} label="Employer fit" value={provider.commercialProfile.employerSizesSupported[0] || provider.employerTypes[0] || "Mixed"} />
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {provider.industries.slice(0, 3).map((item) => <Tag key={item}>{item}</Tag>)}
                    {provider.commercialProfile.accreditations.slice(0, 2).map((item) => <Tag key={item} tone="accent">{item}</Tag>)}
                  </div>

                  <div className="mt-4 grid gap-3 rounded-2xl bg-[#f8fbfa] p-4 ring-1 ring-[#102c3d]/[0.06]">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#0b6f63]">Commercial proof</p>
                      <div className="flex items-center gap-1 text-xs text-[#102c3d]/48"><Globe size={13} /><span>{provider.regions.slice(0, 2).join(" | ") || "Regions to confirm"}</span></div>
                    </div>
                    <div className="grid gap-2 text-sm text-[#102c3d]/62">
                      <ProofRow icon={Trophy} label="Awards" value={provider.commercialProfile.awards[0] || "Awards to confirm"} />
                      <ProofRow icon={ShieldCheck} label="Delivery" value={provider.deliveryModels.slice(0, 2).join(", ") || "Delivery models to confirm"} />
                      <ProofRow icon={Star} label="Buyer note" value={provider.commercialProfile.pricingNotes || provider.commercialProfile.commercialNotes || "Commercial notes to confirm"} />
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <TableAction onClick={() => openProvider(provider)}>Manage profile</TableAction>
                    <TableAction onClick={() => openProvider(provider, "Programmes")}>Open programmes</TableAction>
                    <TableAction onClick={() => archiveProvider(provider.providerId)} danger={provider.status === "Active"}>{provider.status === "Archived" ? "Restore" : "Archive"}</TableAction>
                  </div>
                </article>
              );
            })}
          </div>
        ) : <EmptyState title="No providers added yet" copy="Add a provider partner to start building a premium programme-led directory for employer matching." actionLabel="Add provider" onAction={() => openProvider()} />}
      </MvpPanel>

      {draft ? (
        <MvpModal title={providerExists ? draft.providerName || "Provider profile" : "Add provider partner"} eyebrow="Commercial partner management" onClose={() => setDraft(null)} wide>
          <div className="flex gap-1 overflow-x-auto border-b border-[#102c3d]/[0.07]" role="tablist" aria-label="Provider editor">
            {tabs.map((tab) => <button key={tab} type="button" role="tab" aria-selected={activeTab === tab} disabled={!providerExists && tab === "Programmes"} onClick={() => { setActiveTab(tab); setProgrammeDraft(null); setError(""); }} className={`border-b-2 px-4 py-3 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-35 ${activeTab === tab ? "border-[#159b8f] text-[#102c3d]" : "border-transparent text-[#102c3d]/48 hover:text-[#102c3d]"}`}>{tab}</button>)}
          </div>
          {activeTab === "Commercial Profile" ? (
            <form onSubmit={submitProvider} className="grid gap-5 pt-5 lg:grid-cols-[minmax(0,1.45fr)_minmax(300px,0.85fr)]">
              <div className="grid gap-4">
                <FormSection title="Core identity" copy="Capture the provider identity and the commercial details LevyTate carries into matching.">
                  <FormGrid>
                    <FormField label="Provider name" value={draft.providerName} onChange={(value) => setDraft({ ...draft, providerName: value })} required />
                    <FormSelect label="Provider type" value={draft.providerType} onChange={(value) => setDraft({ ...draft, providerType: value as ProviderType })} options={providerTypes} />
                    <FormField label="Website" value={draft.website} onChange={(value) => setDraft({ ...draft, website: value })} />
                    <FormField label="Ofsted rating" value={draft.ofstedRating} onChange={(value) => setDraft({ ...draft, ofstedRating: value })} />
                    <FormField label="Primary contact" value={draft.contactName} onChange={(value) => setDraft({ ...draft, contactName: value })} />
                    <FormField label="Primary contact email" type="email" value={draft.contactEmail} onChange={(value) => setDraft({ ...draft, contactEmail: value })} />
                    <FormTextArea label="Organisation description" value={draft.commercialProfile.organisationDescription} onChange={(value) => setDraft({ ...draft, commercialProfile: { ...draft.commercialProfile, organisationDescription: value } })} rows={4} wide />
                  </FormGrid>
                </FormSection>
                <FormSection title="Commercial proof" copy="Use these signals to make provider credibility obvious to employers and internal reviewers.">
                  <FormGrid>
                    <FormField label="Years established" value={draft.commercialProfile.yearsEstablished} onChange={(value) => setDraft({ ...draft, commercialProfile: { ...draft.commercialProfile, yearsEstablished: value } })} />
                    <FormField label="Learner numbers" value={draft.commercialProfile.learnerNumbers} onChange={(value) => setDraft({ ...draft, commercialProfile: { ...draft.commercialProfile, learnerNumbers: value } })} />
                    <FormField label="Achievement rate" value={draft.commercialProfile.achievementRate} onChange={(value) => setDraft({ ...draft, commercialProfile: { ...draft.commercialProfile, achievementRate: value } })} />
                    <FormField label="Employer satisfaction" value={draft.commercialProfile.employerSatisfaction} onChange={(value) => setDraft({ ...draft, commercialProfile: { ...draft.commercialProfile, employerSatisfaction: value } })} />
                    <FormTagInput label="Awards" values={draft.commercialProfile.awards} onChange={(value) => setDraft({ ...draft, commercialProfile: { ...draft.commercialProfile, awards: value } })} wide />
                    <FormTagInput label="Accreditations" values={draft.commercialProfile.accreditations} onChange={(value) => setDraft({ ...draft, commercialProfile: { ...draft.commercialProfile, accreditations: value } })} wide />
                    <FormTagInput label="Case studies" values={draft.commercialProfile.caseStudies} onChange={(value) => setDraft({ ...draft, commercialProfile: { ...draft.commercialProfile, caseStudies: value } })} wide />
                    <FormTagInput label="Testimonials" values={draft.commercialProfile.testimonials} onChange={(value) => setDraft({ ...draft, commercialProfile: { ...draft.commercialProfile, testimonials: value } })} wide />
                  </FormGrid>
                </FormSection>
                <FormSection title="Capability profile" copy="These structured tags drive programme-first search and provider matching.">
                  <FormGrid>
                    <FormTagInput label="Sectors" values={draft.sectors} onChange={(value) => setDraft({ ...draft, sectors: value })} wide />
                    <FormTagInput label="Industries" values={draft.industries} onChange={(value) => setDraft({ ...draft, industries: value })} wide />
                    <FormTagInput label="Technologies" values={draft.technologies} onChange={(value) => setDraft({ ...draft, technologies: value })} wide />
                    <FormTagInput label="Delivery models" values={draft.deliveryModels} onChange={(value) => setDraft({ ...draft, deliveryModels: value })} wide />
                    <FormTagInput label="Regions" values={draft.regions} onChange={(value) => setDraft({ ...draft, regions: value })} wide />
                    <FormTagInput label="Employer sizes supported" values={draft.commercialProfile.employerSizesSupported} onChange={(value) => setDraft({ ...draft, commercialProfile: { ...draft.commercialProfile, employerSizesSupported: value } })} wide />
                    <FormTagInput label="Specialisms" values={draft.specialisms} onChange={(value) => setDraft({ ...draft, specialisms: value })} wide />
                    <FormTextArea label="Pricing notes" value={draft.commercialProfile.pricingNotes} onChange={(value) => setDraft({ ...draft, commercialProfile: { ...draft.commercialProfile, pricingNotes: value } })} rows={3} wide />
                    <FormTextArea label="Commercial notes" value={draft.commercialProfile.commercialNotes} onChange={(value) => setDraft({ ...draft, commercialProfile: { ...draft.commercialProfile, commercialNotes: value } })} rows={3} wide />
                  </FormGrid>
                </FormSection>
                <FormActions onCancel={() => setDraft(null)} label="Save provider profile" error={error} />
              </div>
              <div className="grid gap-4 self-start">
                <ProviderPreviewCard provider={draft} programmeCount={selectedProviderProgrammes.length} completion={selectedProviderCompletion} />
                <InsightCard eyebrow="LevyTate view" title="Buyer confidence" copy="Use this profile to explain why the provider belongs in a controlled shortlist." items={[`${selectedProviderProgrammes.length} programme records available`, `${draft.commercialProfile.accreditations.length || draft.specialisms.length} trust signals captured`, draft.commercialProfile.commercialNotes || "No internal commercial note yet"]} />
              </div>
            </form>
          ) : null}

          {activeTab === "Internal Notes" ? (
            <form onSubmit={submitProvider} className="pt-5">
              <FormTextArea label="Internal notes" value={draft.notes} onChange={(value) => setDraft({ ...draft, notes: value })} rows={8} wide />
              <FormActions onCancel={() => setDraft(null)} label="Save notes" error={error} />
            </form>
          ) : null}

          {activeTab === "Programmes" ? (
            <div className="grid gap-5 pt-5">
              <section className="grid gap-3 md:grid-cols-3">
                <SummaryCard label="Programmes" value={selectedProviderProgrammes.length} copy="Active propositions currently linked to this provider partner." tone="blue" />
                <SummaryCard label="Programme completeness" value={`${selectedProgrammeCompletion}%`} copy="How well the programme pages tell an employer-facing proposition." tone="green" />
                <SummaryCard label="Verified shortlist-ready" value={selectedProviderProgrammes.filter((programme) => programme.verificationStatus !== "Needs manual verification").length} copy="Programmes already ready to appear in controlled LevyTate matching." tone="yellow" />
              </section>
              {programmeDraft ? (
                <ProgrammeEditor draft={programmeDraft} onDraft={setProgrammeDraft} standardSearch={standardSearch} onStandardSearch={setStandardSearch} onSubmit={submitProgramme} onCancel={() => { setProgrammeDraft(null); setError(""); }} error={error} />
              ) : (
                <>
                  <div className="grid gap-3 xl:grid-cols-[minmax(220px,1fr)_repeat(4,minmax(120px,auto))_auto]">
                    <label className="flex h-10 min-w-0 items-center gap-2 rounded-lg border border-[#102c3d]/[0.09] bg-[#f8fbfa] px-3"><Search size={15} className="text-[#102c3d]/38" /><input value={programmeSearch} onChange={(event) => setProgrammeSearch(event.target.value)} placeholder="Search programmes, roles or outcomes" className="min-w-0 flex-1 bg-transparent text-sm outline-none" /></label>
                    <select value={levelFilter} onChange={(event) => setLevelFilter(event.target.value)} className="h-10 rounded-lg border border-[#102c3d]/[0.09] bg-white px-3 text-xs font-semibold"><option>All</option>{[2, 3, 4, 5, 6, 7].map((level) => <option key={level} value={String(level)}>Level {level}</option>)}</select>
                    <select value={routeFilter} onChange={(event) => setRouteFilter(event.target.value)} className="h-10 rounded-lg border border-[#102c3d]/[0.09] bg-white px-3 text-xs font-semibold"><option>All</option>{allRoutes.map((route) => <option key={route}>{route}</option>)}</select>
                    <select value={deliveryFilter} onChange={(event) => setDeliveryFilter(event.target.value)} className="h-10 rounded-lg border border-[#102c3d]/[0.09] bg-white px-3 text-xs font-semibold"><option>All</option>{allDeliveryModels.map((delivery) => <option key={delivery}>{delivery}</option>)}</select>
                    <select value={programmeStatusFilter} onChange={(event) => setProgrammeStatusFilter(event.target.value)} className="h-10 rounded-lg border border-[#102c3d]/[0.09] bg-white px-3 text-xs font-semibold"><option>All</option>{programmeStatuses.map((item) => <option key={item}>{item}</option>)}</select>
                    <button type="button" onClick={() => setProgrammeDraft(blankProgramme(draft.providerId))} className="h-10 rounded-full bg-[#102c3d] px-4 text-xs font-semibold text-white">Add programme</button>
                  </div>
                  {selectedProviderProgrammes.length ? (
                    <div className="grid gap-4 xl:grid-cols-2">
                      {selectedProviderProgrammes.map((programme) => {
                        const standard = programmePrimaryStandard(programme, selectableStandards);
                        const completion = programmeProfileCompletion(programme.commercialProfile);
                        return (
                          <article key={programme.id} className={`rounded-2xl border border-[#102c3d]/[0.07] bg-white p-4 shadow-[0_16px_34px_rgba(16,44,61,0.045)] ${programme.recordStatus === "Archived" ? "opacity-60" : ""}`}>
                            <div className="flex items-start justify-between gap-4">
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2"><p className="truncate text-base font-semibold text-[#102c3d]">{programme.programmeName}</p><StatusBadge tone={programmeTone(programme.status)}>{programme.status}</StatusBadge></div>
                                <p className="mt-1 text-sm text-[#0b6f63]">{programme.commercialProfile.tagline || programme.shortDescription}</p>
                              </div>
                              <StatusBadge tone={completion >= 70 ? "green" : completion >= 45 ? "yellow" : "red"}>{completion}% complete</StatusBadge>
                            </div>
                            <div className="mt-4 grid gap-3 sm:grid-cols-2">
                              <ProgrammeFact label="Linked standard" value={programme.linkedStandardName || standard?.title || "Not linked"} />
                              <ProgrammeFact label="Funding route" value={programme.fundingRoute} />
                              <ProgrammeFact label="Delivery" value={programme.deliveryModels.join(", ") || "To confirm"} />
                              <ProgrammeFact label="Confidence" value={programme.commercialProfile.confidenceLabel || "High"} />
                            </div>
                            <div className="mt-4"><p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#102c3d]/42">Employer benefits</p><div className="mt-2 flex flex-wrap gap-2">{fallbackProgrammeHighlights(programme).slice(0, 4).map((item) => <Tag key={item}>{item}</Tag>)}</div></div>
                            <div className="mt-4 flex flex-wrap gap-2">
                              <TableAction onClick={() => { setProgrammeDraft({ ...programme }); setStandardSearch(standard?.title ?? ""); }}>Edit programme</TableAction>
                              <TableAction onClick={() => archiveProviderProgramme(programme.id)} danger={programme.recordStatus !== "Archived"}>{programme.recordStatus === "Archived" ? "Restore" : "Archive"}</TableAction>
                              <TableAction onClick={() => removeProgramme(programme)} danger>Remove</TableAction>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  ) : <EmptyState title="No programmes match these filters" copy="Add a branded programme proposition or widen the current filters." actionLabel="Add programme" onAction={() => setProgrammeDraft(blankProgramme(draft.providerId))} />}
                </>
              )}
            </div>
          ) : null}
        </MvpModal>
      ) : null}
    </div>
  );
}
function ProgrammeEditor({
  draft,
  onDraft,
  standardSearch,
  onStandardSearch,
  onSubmit,
  onCancel,
  error,
}: {
  draft: ProviderProgramme;
  onDraft: (draft: ProviderProgramme) => void;
  standardSearch: string;
  onStandardSearch: (value: string) => void;
  onSubmit: (event: FormEvent) => void;
  onCancel: () => void;
  error: string;
}) {
  const { search: searchStandards } = useLevyTateStandards();
  const selectedStandard = getApprenticeshipStandard(draft.linkedStandardIds[0] ?? "");
  const options = searchStandards(standardSearch, { programmeType: "Apprenticeship standard" }).slice(0, 16);
  const completion = programmeProfileCompletion(draft.commercialProfile);

  function selectStandard(standardId: string) {
    onDraft(normaliseProviderProgramme({ ...draft, linkedStandardIds: [standardId] }));
    const standard = getApprenticeshipStandard(standardId);
    onStandardSearch(standard?.title ?? "");
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-5">
      <section className="grid gap-4 lg:grid-cols-[minmax(0,1.45fr)_minmax(300px,0.85fr)]">
        <div className="grid gap-4">
          <FormSection title="Programme proposition" copy="The programme should read like an employer proposition, with the standard sitting underneath as compliance metadata.">
            <FormGrid>
              <FormField label="Programme name" value={draft.programmeName} onChange={(value) => onDraft({ ...draft, programmeName: value })} required />
              <FormField label="Tagline" value={draft.commercialProfile.tagline} onChange={(value) => onDraft({ ...draft, commercialProfile: { ...draft.commercialProfile, tagline: value } })} />
              <FormTextArea label="Short description" value={draft.shortDescription} onChange={(value) => onDraft({ ...draft, shortDescription: value })} wide rows={3} />
              <FormTextArea label="Full description" value={draft.fullDescription} onChange={(value) => onDraft({ ...draft, fullDescription: value })} wide rows={4} />
              <FormField label="Ideal audience" value={draft.commercialProfile.idealAudience} onChange={(value) => onDraft({ ...draft, commercialProfile: { ...draft.commercialProfile, idealAudience: value } })} wide />
              <FormField label="Duration" value={draft.duration} onChange={(value) => onDraft({ ...draft, duration: value })} required />
              <FormSelect label="Programme status" value={draft.status} onChange={(value) => onDraft({ ...draft, status: value as ProviderProgrammeStatus })} options={programmeStatuses} />
              <FormSelect label="Verification status" value={draft.verificationStatus} onChange={(value) => onDraft({ ...draft, verificationStatus: value as ProviderProgrammeVerificationStatus })} options={verificationStatuses} />
            </FormGrid>
          </FormSection>
          <FormSection title="Audience and outcomes" copy="These structured fields drive programme-first matching and shortlist quality.">
            <FormGrid>
              <FormTagInput label="Target industries" values={draft.targetIndustries} onChange={(value) => onDraft({ ...draft, targetIndustries: value })} wide />
              <FormTagInput label="Target job roles" values={draft.targetJobRoles} onChange={(value) => onDraft({ ...draft, targetJobRoles: value })} wide />
              <FormTagInput label="Business problems solved" values={draft.businessProblemsSolved} onChange={(value) => onDraft({ ...draft, businessProblemsSolved: value })} wide />
              <FormTagInput label="Skills developed" values={draft.skillsDeveloped} onChange={(value) => onDraft({ ...draft, skillsDeveloped: value })} wide />
              <FormTagInput label="Technologies covered" values={draft.technologiesCovered} onChange={(value) => onDraft({ ...draft, technologiesCovered: value })} wide />
              <FormTagInput label="Employer benefits" values={draft.commercialProfile.employerBenefits} onChange={(value) => onDraft({ ...draft, commercialProfile: { ...draft.commercialProfile, employerBenefits: value } })} wide />
              <FormTagInput label="Future capability impact" values={draft.commercialProfile.futureCapabilityImpact} onChange={(value) => onDraft({ ...draft, commercialProfile: { ...draft.commercialProfile, futureCapabilityImpact: value } })} wide />
            </FormGrid>
          </FormSection>
          <FormSection title="Delivery and commercial fit" copy="Show how this programme lands in the employer environment and what LevyTate should communicate commercially.">
            <FormGrid>
              <FormTagInput label="Delivery models" values={draft.deliveryModels} onChange={(value) => onDraft({ ...draft, deliveryModels: value })} />
              <FormTagInput label="Regions" values={draft.regions} onChange={(value) => onDraft({ ...draft, regions: value })} />
              <FormTagInput label="Cohort options" values={draft.cohortOptions} onChange={(value) => onDraft({ ...draft, cohortOptions: value })} wide />
              <FormTagInput label="Progression routes" values={draft.commercialProfile.progressionRoutes} onChange={(value) => onDraft({ ...draft, commercialProfile: { ...draft.commercialProfile, progressionRoutes: value } })} wide />
              <FormSelect label="Employer size" value={draft.employerSize} onChange={(value) => onDraft({ ...draft, employerSize: value as ProviderEmployerSize })} options={employerSizeOptions} />
              <FormSelect label="Seniority" value={draft.seniority} onChange={(value) => onDraft({ ...draft, seniority: value as ProviderProgrammeSeniority })} options={seniorityOptions} />
              <FormSelect label="Funding route" value={draft.fundingRoute} onChange={(value) => onDraft({ ...draft, fundingRoute: value as FundingRoute })} options={fundingRoutes} />
              <FormSelect label="Confidence" value={draft.commercialProfile.confidenceLabel} onChange={(value) => onDraft({ ...draft, commercialProfile: { ...draft.commercialProfile, confidenceLabel: value as "High" | "Medium" | "Low" } })} options={[...confidenceOptions]} />
              <FormTextArea label="Commercial notes" value={draft.commercialNotes} onChange={(value) => onDraft({ ...draft, commercialNotes: value })} rows={3} wide />
            </FormGrid>
          </FormSection>
        </div>
        <div className="grid gap-4 self-start">
          <ProgrammePreviewCard programme={draft} standard={selectedStandard} completion={completion} />
          <FormSection title="Linked apprenticeship standard" copy="The standard sits underneath the branded programme proposition as funding and compliance metadata.">
            <label className="grid gap-1.5 text-xs font-semibold text-[#102c3d]/58">Search apprenticeship standards<input value={standardSearch} onChange={(event) => onStandardSearch(event.target.value)} placeholder="Search title, reference code or job title" className="h-11 rounded-lg border border-[#102c3d]/[0.09] bg-[#f8fbfa] px-3 text-sm font-medium outline-none focus:border-[#159b8f] focus:bg-white focus:ring-4 focus:ring-[#159b8f]/10" /></label>
            <div className="mt-2 max-h-72 overflow-y-auto rounded-lg border border-[#102c3d]/[0.08] bg-white">
              {options.map((standard) => <button key={standard.id} type="button" onClick={() => selectStandard(standard.id)} className={`flex w-full items-center justify-between gap-3 border-b border-[#102c3d]/[0.05] px-3 py-2.5 text-left transition last:border-0 hover:bg-[#f7faf8] ${draft.linkedStandardIds.includes(standard.id) ? "bg-[#edf7f3]" : ""}`}><span><span className="block text-sm font-semibold">{standard.title}</span><span className="text-xs text-[#102c3d]/44">{standard.referenceCode} | Level {standard.level}</span></span><StatusBadge tone={standard.status === "Live" ? "green" : standard.status === "Paused" ? "yellow" : "red"}>{standard.status}</StatusBadge></button>)}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">{draft.linkedStandardIds.map((standardId) => { const standard = getApprenticeshipStandard(standardId); return standard ? <span key={standardId} className="inline-flex items-center gap-2 rounded-full bg-[#edf7f3] px-3 py-1 text-xs font-semibold text-[#0b6f63]">{standard.title}<button type="button" onClick={() => onDraft(normaliseProviderProgramme({ ...draft, linkedStandardIds: draft.linkedStandardIds.filter((item) => item !== standardId) }))} className="text-[#0b6f63]/70 hover:text-[#0b6f63]">x</button></span> : null; })}</div>
          </FormSection>
        </div>
      </section>
      <FormActions onCancel={onCancel} label="Save programme" error={error} />
    </form>
  );
}

function ProviderPreviewCard({ provider, completion, programmeCount }: { provider: ProviderCatalogueRecord; completion: number; programmeCount: number }) {
  return <div className="overflow-hidden rounded-2xl border border-[#102c3d]/[0.07] bg-white shadow-[0_18px_38px_rgba(16,44,61,0.06)]"><div className="relative bg-[linear-gradient(135deg,#102c3d_0%,#174761_60%,#1f7b78_100%)] px-5 py-5 text-white"><div className="absolute right-4 top-4 rounded-full bg-white/12 px-2.5 py-1 text-[11px] font-semibold backdrop-blur-sm">{completion}% complete</div><div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white/12 text-white backdrop-blur-sm">{provider.commercialProfile.logoUrl ? <ImageIcon size={18} /> : <Building2 size={18} />}</div><h3 className="mt-4 text-lg font-semibold">{provider.providerName || "Provider partner"}</h3><p className="mt-1 text-sm text-white/72">{provider.providerType}</p></div><div className="grid gap-4 p-5"><p className="text-sm leading-6 text-[#102c3d]/58">{fallbackProviderDescription(provider)}</p><div className="grid grid-cols-2 gap-3"><MiniMetric title="Programme records" value={String(programmeCount)} /><MiniMetric title="Employer fit" value={provider.commercialProfile.employerSizesSupported[0] || provider.employerTypes[0] || "Mixed"} /><MiniMetric title="Achievement" value={provider.commercialProfile.achievementRate || "To confirm"} /><MiniMetric title="Satisfaction" value={provider.commercialProfile.employerSatisfaction || provider.commercialProfile.learnerSatisfaction || "To confirm"} /></div><div className="flex flex-wrap gap-2">{provider.commercialProfile.awards.slice(0, 2).map((item) => <Tag key={item} tone="accent">{item}</Tag>)}{provider.specialisms.slice(0, 3).map((item) => <Tag key={item}>{item}</Tag>)}</div></div></div>;
}

function ProgrammePreviewCard({ programme, standard, completion }: { programme: ProviderProgramme; standard?: ApprenticeshipStandard; completion: number }) {
  return <div className="overflow-hidden rounded-2xl border border-[#102c3d]/[0.07] bg-white shadow-[0_18px_38px_rgba(16,44,61,0.06)]"><div className="bg-[linear-gradient(135deg,#f8fbfa_0%,#edf7f3_100%)] px-5 py-5"><div className="flex items-start justify-between gap-3"><div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-[#0b6f63] shadow-[0_12px_24px_rgba(16,44,61,0.08)]"><Sparkles size={18} /></div><StatusBadge tone={completion >= 70 ? "green" : completion >= 45 ? "yellow" : "red"}>{completion}% complete</StatusBadge></div><h3 className="mt-4 text-lg font-semibold text-[#102c3d]">{programme.programmeName || "Programme proposition"}</h3><p className="mt-1 text-sm text-[#0b6f63]">{programme.commercialProfile.tagline || "Position this programme in employer language."}</p></div><div className="grid gap-4 p-5"><p className="text-sm leading-6 text-[#102c3d]/58">{programme.shortDescription || "Programme summary to confirm."}</p><div className="grid gap-3"><MiniMetric title="Best for" value={programme.commercialProfile.idealAudience || "Audience to confirm"} /><MiniMetric title="Confidence" value={programme.commercialProfile.confidenceLabel || "High"} /><MiniMetric title="Funding route" value={programme.fundingRoute} /><MiniMetric title="Linked standard" value={standard?.title || programme.linkedStandardName || "Not linked"} /></div>{standard ? <div className="rounded-2xl bg-[#f8fbfa] p-4 ring-1 ring-[#102c3d]/[0.06]"><p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#0b6f63]">Compliance metadata</p><p className="mt-2 text-sm font-semibold text-[#102c3d]">{standard.title}</p><p className="mt-1 text-xs text-[#102c3d]/46">{standard.referenceCode} | Level {standard.level}</p><p className="mt-1 text-xs text-[#102c3d]/46">{formatFundingBand(standard)}</p></div> : null}</div></div>;
}

function SummaryCard({ label, value, copy, tone }: { label: string; value: string | number; copy: string; tone: "green" | "yellow" | "blue" }) {
  const accent = { green: "bg-[#e9f7f2] text-[#0b6f63]", yellow: "bg-[#fff7cf] text-[#756000]", blue: "bg-[#eef4f8] text-[#315e78]" }[tone];
  return <article className="rounded-xl border border-[#102c3d]/[0.07] bg-white p-4 shadow-[0_12px_26px_rgba(16,44,61,0.04)]"><div className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${accent}`}>{label}</div><p className="mt-3 text-2xl font-semibold text-[#102c3d]">{value}</p><p className="mt-1 text-sm leading-6 text-[#102c3d]/58">{copy}</p></article>;
}

function MetricPill({ icon: Icon, label, value }: { icon: typeof Building2; label: string; value: string | number }) {
  return <div className="rounded-2xl bg-[#f8fbfa] px-3 py-3 ring-1 ring-[#102c3d]/[0.05]"><div className="flex items-center gap-2 text-[#102c3d]/42"><Icon size={14} /><span className="text-[11px] font-semibold uppercase tracking-[0.12em]">{label}</span></div><p className="mt-2 text-sm font-semibold text-[#102c3d]">{value}</p></div>;
}

function MiniMetric({ title, value }: { title: string; value: string }) {
  return <div className="rounded-2xl bg-[#f8fbfa] p-3 ring-1 ring-[#102c3d]/[0.06]"><p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#102c3d]/42">{title}</p><p className="mt-2 text-sm font-semibold text-[#102c3d]">{value}</p></div>;
}

function ProgrammeFact({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl bg-[#f8fbfa] p-3 ring-1 ring-[#102c3d]/[0.06]"><p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#102c3d]/42">{label}</p><p className="mt-2 text-sm font-semibold text-[#102c3d]">{value}</p></div>;
}

function ProofRow({ icon: Icon, label, value }: { icon: typeof Award; label: string; value: string }) {
  return <div className="flex items-start gap-2"><Icon size={14} className="mt-0.5 text-[#0b8e82]" /><div><p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#102c3d]/42">{label}</p><p className="mt-1 text-sm leading-5 text-[#102c3d]/62">{value}</p></div></div>;
}

function Tag({ children, tone = "neutral" }: { children: string; tone?: "neutral" | "accent" }) {
  return <span className={`inline-flex rounded-full px-3 py-1.5 text-xs font-semibold ${tone === "accent" ? "bg-[#edf7f3] text-[#0b6f63]" : "bg-[#f5f7f3] text-[#102c3d]/64"}`}>{children}</span>;
}

function InsightCard({ eyebrow, title, copy, items }: { eyebrow: string; title: string; copy: string; items: string[] }) {
  return <div className="rounded-2xl border border-[#102c3d]/[0.07] bg-white p-5 shadow-[0_14px_30px_rgba(16,44,61,0.05)]"><p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#c95568]">{eyebrow}</p><h3 className="mt-1 text-base font-semibold text-[#102c3d]">{title}</h3><p className="mt-2 text-sm leading-6 text-[#102c3d]/58">{copy}</p><ul className="mt-4 grid gap-2 text-sm text-[#102c3d]/62">{items.filter(Boolean).map((item) => <li key={item} className="flex items-start gap-2"><ArrowUpRight size={14} className="mt-1 shrink-0 text-[#0b8e82]" /><span>{item}</span></li>)}</ul></div>;
}
