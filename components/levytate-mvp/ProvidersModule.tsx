"use client";

import { Archive, BookOpen, Pencil, Search, Trash2 } from "lucide-react";
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
} from "@/lib/levytate/domain";
import {
  formatFundingBand,
  getApprenticeshipStandard,
  getSelectableApprenticeshipStandards,
  programmePrimaryStandard,
  searchApprenticeshipStandards,
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
  TableBody,
  TableHead,
  TableShell,
} from "@/components/levytate-mvp/MvpUi";
import { useMvpWorkspace } from "@/components/levytate-mvp/MvpWorkspaceStore";
import { includesSearch, statusTone } from "@/components/levytate-mvp/module-utils";
import { createMvpId, normaliseProviderProgramme, normaliseProviderRecord, nowIso, todayIso } from "@/lib/levytate/mvp/workspace";

const tabs = ["Provider Details", "Programmes", "Notes"] as const;
type ProviderTab = (typeof tabs)[number];

const programmeStatuses: ProviderProgrammeStatus[] = ["Active", "Needs verification", "Paused", "Not available", "Defunded / unavailable for new starts"];
const verificationStatuses: ProviderProgrammeVerificationStatus[] = ["Verified from provider website", "Needs manual verification", "Provider confirmed", "LevyTate reviewed"];
const fundingRoutes: FundingRoute[] = ["Potentially levy-funded", "Potentially funded through levy/co-investment", "Commercial training budget"];
const seniorityOptions: ProviderProgrammeSeniority[] = ["Entry", "Early career", "Experienced", "Supervisor", "Manager", "Mixed"];
const employerSizeOptions: ProviderEmployerSize[] = ["SME", "Mid-market", "Large enterprise", "Mixed employer base"];

function programmeTone(status: ProviderProgrammeStatus) {
  if (status === "Active") return "green" as const;
  if (status === "Needs verification" || status === "Paused") return "yellow" as const;
  return "red" as const;
}

function verificationTone(status: ProviderProgrammeVerificationStatus) {
  return status === "Needs manual verification" ? "yellow" as const : "blue" as const;
}

export function ProvidersModule() {
  const {
    data,
    saveProvider,
    archiveProvider,
    saveProviderProgramme,
    archiveProviderProgramme,
    removeProviderProgramme,
  } = useMvpWorkspace();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("Active");
  const [draft, setDraft] = useState<ProviderCatalogueRecord | null>(null);
  const [activeTab, setActiveTab] = useState<ProviderTab>("Provider Details");
  const [programmeDraft, setProgrammeDraft] = useState<ProviderProgramme | null>(null);
  const [programmeSearch, setProgrammeSearch] = useState("");
  const [standardSearch, setStandardSearch] = useState("");
  const [levelFilter, setLevelFilter] = useState("All");
  const [routeFilter, setRouteFilter] = useState("All");
  const [deliveryFilter, setDeliveryFilter] = useState("All");
  const [programmeStatusFilter, setProgrammeStatusFilter] = useState("All");
  const [error, setError] = useState("");

  const selectableStandards = useMemo(() => getSelectableApprenticeshipStandards(), []);

  const visible = data.providers.filter((provider) => {
    const programmes = data.providerProgrammes.filter((item) => item.providerId === provider.providerId);
    const programmeText = programmes.map((programme) => [programme.programmeName, programme.targetJobRoles.join(" "), programme.technologiesCovered.join(" "), programme.businessProblemsSolved.join(" ")].join(" ")).join(" ");
    return (status === "All" || provider.status === status)
      && includesSearch([
        provider.providerName,
        provider.sectors.join(" "),
        provider.industries.join(" "),
        provider.technologies.join(" "),
        provider.deliveryModels.join(" "),
        provider.regions.join(" "),
        provider.employerTypes.join(" "),
        provider.specialisms.join(" "),
        programmeText,
      ], search);
  });

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

  function openProvider(provider?: ProviderCatalogueRecord) {
    setDraft(provider ? structuredClone(provider) : blankProvider());
    setActiveTab("Provider Details");
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
    const duplicate = data.providerProgrammes.some((programme) =>
      programme.providerId === programmeDraft.providerId
      && programme.programmeName.trim().toLowerCase() === programmeDraft.programmeName.trim().toLowerCase()
      && programme.id !== programmeDraft.id,
    );
    if (duplicate) {
      setError("This provider already has a programme with that name.");
      return;
    }
    saveProviderProgramme(normaliseProviderProgramme({
      ...programmeDraft,
      programmeName: programmeDraft.programmeName.trim(),
      updatedAt: nowIso(),
    }));
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

  return (
    <MvpPanel title="Providers" eyebrow="Programme-first provider catalogue">
      <MvpToolbar
        search={search}
        onSearch={setSearch}
        placeholder="Search providers, programmes, sectors or outcomes"
        actionLabel="Add provider"
        onAction={() => openProvider()}
        filters={<select value={status} onChange={(event) => setStatus(event.target.value)} className="h-10 rounded-lg border border-[#102c3d]/[0.09] bg-white px-3 text-sm font-semibold"><option>Active</option><option>Archived</option><option>All</option></select>}
      />
      {visible.length ? (
        <TableShell>
          <TableHead><tr><th className="px-4 py-3">Provider</th><th className="px-4 py-3">Sectors</th><th className="px-4 py-3">Delivery</th><th className="px-4 py-3">Programmes</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Actions</th></tr></TableHead>
          <TableBody>
            {visible.map((provider) => {
              const programmeCount = data.providerProgrammes.filter((programme) => programme.providerId === provider.providerId && programme.recordStatus === "Active").length;
              return (
                <tr key={provider.providerId}>
                  <td className="px-4 py-3"><button onClick={() => openProvider(provider)} className="text-left font-semibold">{provider.providerName}<span className="mt-0.5 block text-xs font-normal text-[#102c3d]/46">{provider.contactEmail || "No contact email"}</span></button></td>
                  <td className="px-4 py-3 text-[#102c3d]/62">{provider.sectors.slice(0, 3).join(", ") || "Not set"}</td>
                  <td className="px-4 py-3 text-[#102c3d]/62">{provider.deliveryModels.join(", ") || "Not set"}</td>
                  <td className="px-4 py-3"><StatusBadge>{programmeCount}</StatusBadge></td>
                  <td className="px-4 py-3"><StatusBadge tone={statusTone(provider.status)}>{provider.status}</StatusBadge></td>
                  <td className="px-4 py-3"><div className="flex justify-end gap-2"><TableAction onClick={() => openProvider(provider)}>Manage</TableAction><TableAction onClick={() => archiveProvider(provider.providerId)} danger={provider.status === "Active"}>{provider.status === "Archived" ? "Restore" : "Archive"}</TableAction></div></td>
                </tr>
              );
            })}
          </TableBody>
        </TableShell>
      ) : (
        <EmptyState title="No providers added yet" copy="Add a provider to start building a programme-led delivery catalogue." actionLabel="Add provider" onAction={() => openProvider()} />
      )}

      {draft ? (
        <MvpModal title={providerExists ? draft.providerName || "Provider" : "Add provider"} eyebrow="Provider management" onClose={() => setDraft(null)} wide>
          <div className="flex gap-1 overflow-x-auto border-b border-[#102c3d]/[0.07]" role="tablist" aria-label="Provider editor">
            {tabs.map((tab) => <button key={tab} type="button" role="tab" aria-selected={activeTab === tab} disabled={!providerExists && tab === "Programmes"} onClick={() => { setActiveTab(tab); setProgrammeDraft(null); setError(""); }} className={`border-b-2 px-4 py-3 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-35 ${activeTab === tab ? "border-[#159b8f] text-[#102c3d]" : "border-transparent text-[#102c3d]/48 hover:text-[#102c3d]"}`}>{tab}</button>)}
          </div>

          {activeTab === "Provider Details" ? (
            <form onSubmit={submitProvider} className="grid gap-4 pt-5">
              <FormSection title="Provider details" copy="Capture the core identity LevyTate will use across relationship management and matching.">
                <FormGrid>
                  <FormField label="Provider name" value={draft.providerName} onChange={(value) => setDraft({ ...draft, providerName: value })} required />
                  <FormField label="Website" value={draft.website} onChange={(value) => setDraft({ ...draft, website: value })} />
                  <FormField label="Contact name" value={draft.contactName} onChange={(value) => setDraft({ ...draft, contactName: value })} />
                  <FormField label="Contact email" type="email" value={draft.contactEmail} onChange={(value) => setDraft({ ...draft, contactEmail: value })} />
                </FormGrid>
              </FormSection>
              <FormSection title="Capability profile" copy="These tags describe the provider's employer-facing proposition and searchable capability areas.">
                <FormGrid>
                  <FormTagInput label="Sectors" values={draft.sectors} onChange={(value) => setDraft({ ...draft, sectors: value })} wide />
                  <FormTagInput label="Industries" values={draft.industries} onChange={(value) => setDraft({ ...draft, industries: value })} wide />
                  <FormTagInput label="Technologies" values={draft.technologies} onChange={(value) => setDraft({ ...draft, technologies: value })} wide />
                  <FormTagInput label="Delivery models" values={draft.deliveryModels} onChange={(value) => setDraft({ ...draft, deliveryModels: value })} wide />
                  <FormTagInput label="Regions" values={draft.regions} onChange={(value) => setDraft({ ...draft, regions: value })} wide />
                  <FormTagInput label="Employer types" values={draft.employerTypes} onChange={(value) => setDraft({ ...draft, employerTypes: value })} wide />
                  <FormTagInput label="Specialisms" values={draft.specialisms} onChange={(value) => setDraft({ ...draft, specialisms: value })} wide />
                  <FormTagInput label="Source URLs" values={draft.sourceUrls} onChange={(value) => setDraft({ ...draft, sourceUrls: value })} wide placeholder="Paste URLs and press Enter" />
                </FormGrid>
              </FormSection>
              {!providerExists ? <p className="text-xs text-[#102c3d]/52">Save provider details before adding branded programme records.</p> : null}
              <FormActions onCancel={() => setDraft(null)} label="Save provider" error={error} />
            </form>
          ) : null}

          {activeTab === "Notes" ? (
            <form onSubmit={submitProvider} className="pt-5">
              <FormTextArea label="Internal notes" value={draft.notes} onChange={(value) => setDraft({ ...draft, notes: value })} rows={7} wide placeholder="Internal relationship notes, verification commentary or sourcing context." />
              <FormActions onCancel={() => setDraft(null)} label="Save notes" error={error} />
            </form>
          ) : null}

          {activeTab === "Programmes" ? (
            <div className="pt-5">
              {programmeDraft ? (
                <ProgrammeEditor
                  draft={programmeDraft}
                  onDraft={setProgrammeDraft}
                  standardSearch={standardSearch}
                  onStandardSearch={setStandardSearch}
                  onSubmit={submitProgramme}
                  onCancel={() => { setProgrammeDraft(null); setError(""); }}
                  error={error}
                />
              ) : (
                <>
                  <div className="grid gap-3 xl:grid-cols-[minmax(220px,1fr)_repeat(4,minmax(120px,auto))_auto]">
                    <label className="flex h-10 min-w-0 items-center gap-2 rounded-lg border border-[#102c3d]/[0.09] bg-[#f8fbfa] px-3"><Search size={15} className="text-[#102c3d]/38" /><input value={programmeSearch} onChange={(event) => setProgrammeSearch(event.target.value)} placeholder="Search programmes" className="min-w-0 flex-1 bg-transparent text-sm outline-none" /></label>
                    <select value={levelFilter} onChange={(event) => setLevelFilter(event.target.value)} className="h-10 rounded-lg border border-[#102c3d]/[0.09] bg-white px-3 text-xs font-semibold"><option>All</option>{[2, 3, 4, 5, 6, 7].map((level) => <option key={level} value={String(level)}>Level {level}</option>)}</select>
                    <select value={routeFilter} onChange={(event) => setRouteFilter(event.target.value)} className="h-10 rounded-lg border border-[#102c3d]/[0.09] bg-white px-3 text-xs font-semibold"><option>All</option>{allRoutes.map((route) => <option key={route}>{route}</option>)}</select>
                    <select value={deliveryFilter} onChange={(event) => setDeliveryFilter(event.target.value)} className="h-10 rounded-lg border border-[#102c3d]/[0.09] bg-white px-3 text-xs font-semibold"><option>All</option>{allDeliveryModels.map((delivery) => <option key={delivery}>{delivery}</option>)}</select>
                    <select value={programmeStatusFilter} onChange={(event) => setProgrammeStatusFilter(event.target.value)} className="h-10 rounded-lg border border-[#102c3d]/[0.09] bg-white px-3 text-xs font-semibold"><option>All</option>{programmeStatuses.map((item) => <option key={item}>{item}</option>)}</select>
                    <button type="button" onClick={() => setProgrammeDraft(blankProgramme(draft.providerId))} className="h-10 rounded-full bg-[#102c3d] px-4 text-xs font-semibold text-white">Add programme</button>
                  </div>
                  <div className="mt-4 overflow-x-auto rounded-lg border border-[#102c3d]/[0.07]">
                    <table className="min-w-[1320px] w-full border-collapse text-left text-sm">
                      <TableHead><tr><th className="px-3 py-3">Programme name</th><th className="px-3 py-3">Linked standard</th><th className="px-3 py-3">Level</th><th className="px-3 py-3">Delivery</th><th className="px-3 py-3">Status</th><th className="px-3 py-3">Verification</th><th className="px-3 py-3 text-right">Actions</th></tr></TableHead>
                      <TableBody>
                        {selectedProviderProgrammes.map((programme) => {
                          const standard = programmePrimaryStandard(programme, selectableStandards);
                          return (
                            <tr key={programme.id} className={programme.recordStatus === "Archived" ? "opacity-55" : ""}>
                              <td className="px-3 py-3"><p className="font-semibold">{programme.programmeName}</p><p className="mt-0.5 text-xs text-[#102c3d]/44">{programme.targetJobRoles.slice(0, 2).join(", ") || "Job roles to confirm"}</p></td>
                              <td className="px-3 py-3"><p className="text-[#102c3d]/68">{programme.linkedStandardName || standard?.title || "Not linked"}</p>{standard ? <p className="mt-0.5 text-xs text-[#102c3d]/42">{standard.referenceCode}</p> : null}</td>
                              <td className="px-3 py-3 text-[#102c3d]/58">{programme.level ?? standard?.level ?? "-"}</td>
                              <td className="px-3 py-3 text-[#102c3d]/58">{programme.deliveryModels.join(", ") || "Not set"}</td>
                              <td className="px-3 py-3"><StatusBadge tone={programmeTone(programme.status)}>{programme.status}</StatusBadge></td>
                              <td className="px-3 py-3"><StatusBadge tone={verificationTone(programme.verificationStatus)}>{programme.verificationStatus}</StatusBadge></td>
                              <td className="px-3 py-3"><div className="flex justify-end gap-1.5"><IconAction label="Edit programme" onClick={() => { setProgrammeDraft({ ...programme }); setStandardSearch(standard?.title ?? ""); }} icon={Pencil} /><IconAction label={programme.recordStatus === "Archived" ? "Restore programme" : "Archive programme"} onClick={() => archiveProviderProgramme(programme.id)} icon={Archive} /><IconAction label="Remove programme" onClick={() => removeProgramme(programme)} icon={Trash2} danger /></div></td>
                            </tr>
                          );
                        })}
                      </TableBody>
                    </table>
                    {!selectedProviderProgrammes.length ? <div className="px-5 py-10 text-center text-sm text-[#102c3d]/52">No programmes match these filters.</div> : null}
                  </div>
                </>
              )}
            </div>
          ) : null}
        </MvpModal>
      ) : null}
    </MvpPanel>
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
  const selectedStandard = getApprenticeshipStandard(draft.linkedStandardIds[0] ?? "");
  const options = searchApprenticeshipStandards(standardSearch, { status: "Live" }).slice(0, 16);

  function selectStandard(standardId: string) {
    onDraft(normaliseProviderProgramme({ ...draft, linkedStandardIds: [standardId] }));
    const standard = getApprenticeshipStandard(standardId);
    onStandardSearch(standard?.title ?? "");
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      <FormSection title="Programme overview" copy="The programme should read like an employer proposition, not a standards directory entry.">
        <FormGrid>
          <FormField label="Programme name" value={draft.programmeName} onChange={(value) => onDraft({ ...draft, programmeName: value })} required />
          <FormField label="Duration" value={draft.duration} onChange={(value) => onDraft({ ...draft, duration: value })} required />
          <FormTextArea label="Short description" value={draft.shortDescription} onChange={(value) => onDraft({ ...draft, shortDescription: value })} wide rows={3} placeholder="A concise employer-facing summary." />
          <FormTextArea label="Full description" value={draft.fullDescription} onChange={(value) => onDraft({ ...draft, fullDescription: value })} wide rows={4} placeholder="Expand the proposition, business relevance and delivery shape." />
          <FormSelect label="Programme status" value={draft.status} onChange={(value) => onDraft({ ...draft, status: value as ProviderProgrammeStatus })} options={programmeStatuses} />
          <FormSelect label="Verification status" value={draft.verificationStatus} onChange={(value) => onDraft({ ...draft, verificationStatus: value as ProviderProgrammeVerificationStatus })} options={verificationStatuses} />
        </FormGrid>
      </FormSection>

      <FormSection title="Who it is for" copy="Capture the audience, target roles and employer profile that should trigger this programme in matching.">
        <FormGrid>
          <FormTagInput label="Target organisations" values={draft.targetOrganisations} onChange={(value) => onDraft({ ...draft, targetOrganisations: value })} wide />
          <FormTagInput label="Target industries" values={draft.targetIndustries} onChange={(value) => onDraft({ ...draft, targetIndustries: value })} wide />
          <FormTagInput label="Target job roles" values={draft.targetJobRoles} onChange={(value) => onDraft({ ...draft, targetJobRoles: value })} wide />
          <FormSelect label="Seniority" value={draft.seniority} onChange={(value) => onDraft({ ...draft, seniority: value as ProviderProgrammeSeniority })} options={seniorityOptions} />
          <FormSelect label="Employer size" value={draft.employerSize} onChange={(value) => onDraft({ ...draft, employerSize: value as ProviderEmployerSize })} options={employerSizeOptions} />
        </FormGrid>
      </FormSection>

      <FormSection title="Outcomes and skills" copy="These fields drive the programme-first matching engine and should describe business value in plain language.">
        <FormGrid>
          <FormTagInput label="Business problems solved" values={draft.businessProblemsSolved} onChange={(value) => onDraft({ ...draft, businessProblemsSolved: value })} wide />
          <FormTagInput label="Skills developed" values={draft.skillsDeveloped} onChange={(value) => onDraft({ ...draft, skillsDeveloped: value })} wide />
          <FormTagInput label="Technologies covered" values={draft.technologiesCovered} onChange={(value) => onDraft({ ...draft, technologiesCovered: value })} wide />
          <FormTagInput label="Expected outcomes" values={draft.expectedOutcomes} onChange={(value) => onDraft({ ...draft, expectedOutcomes: value })} wide />
        </FormGrid>
      </FormSection>

      <FormSection title="Delivery" copy="Define how the programme is delivered, where it can run and any commercial or cohort notes.">
        <FormGrid>
          <FormTagInput label="Delivery models" values={draft.deliveryModels} onChange={(value) => onDraft({ ...draft, deliveryModels: value })} />
          <FormTagInput label="Regions" values={draft.regions} onChange={(value) => onDraft({ ...draft, regions: value })} />
          <FormTagInput label="Cohort options" values={draft.cohortOptions} onChange={(value) => onDraft({ ...draft, cohortOptions: value })} wide />
          <FormSelect label="Funding route" value={draft.fundingRoute} onChange={(value) => onDraft({ ...draft, fundingRoute: value as FundingRoute })} options={fundingRoutes} />
          <FormTextArea label="Commercial notes" value={draft.commercialNotes} onChange={(value) => onDraft({ ...draft, commercialNotes: value })} wide rows={3} />
        </FormGrid>
      </FormSection>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.78fr)]">
        <FormSection title="Linked apprenticeship standard" copy="Use the official standard as compliance and funding metadata, not the headline offer.">
          <label className="grid gap-1.5 text-xs font-semibold text-[#102c3d]/58">
            Search active standards
            <input value={standardSearch} onChange={(event) => onStandardSearch(event.target.value)} placeholder="Search title or reference code" className="h-11 rounded-lg border border-[#102c3d]/[0.09] bg-[#f8fbfa] px-3 text-sm font-medium outline-none focus:border-[#159b8f] focus:bg-white focus:ring-4 focus:ring-[#159b8f]/10" />
          </label>
          <div className="mt-2 max-h-72 overflow-y-auto rounded-lg border border-[#102c3d]/[0.08] bg-white">
            {options.map((standard) => <button key={standard.id} type="button" onClick={() => selectStandard(standard.id)} className={`flex w-full items-center justify-between gap-3 border-b border-[#102c3d]/[0.05] px-3 py-2.5 text-left transition last:border-0 hover:bg-[#f7faf8] ${draft.linkedStandardIds.includes(standard.id) ? "bg-[#edf7f3]" : ""}`}><span><span className="block text-sm font-semibold">{standard.title}</span><span className="text-xs text-[#102c3d]/44">{standard.referenceCode} | Level {standard.level}</span></span><StatusBadge tone={standard.status === "Live" ? "green" : standard.status === "Paused" ? "yellow" : "red"}>{standard.status}</StatusBadge></button>)}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {draft.linkedStandardIds.map((standardId) => {
              const standard = getApprenticeshipStandard(standardId);
              return standard ? <span key={standardId} className="inline-flex items-center gap-2 rounded-full bg-[#edf7f3] px-3 py-1 text-xs font-semibold text-[#0b6f63]">{standard.title}<button type="button" onClick={() => onDraft(normaliseProviderProgramme({ ...draft, linkedStandardIds: draft.linkedStandardIds.filter((item) => item !== standardId) }))} className="text-[#0b6f63]/70 hover:text-[#0b6f63]">x</button></span> : null;
            })}
          </div>
        </FormSection>
        <StandardSummary standard={selectedStandard} />
      </div>

      <FormSection title="Notes" copy="Keep source and internal validation notes alongside the programme record.">
        <FormGrid>
          <FormField label="Source URL" value={draft.sourceUrl} onChange={(value) => onDraft({ ...draft, sourceUrl: value })} wide />
          <FormTextArea label="Internal notes" value={draft.notes} onChange={(value) => onDraft({ ...draft, notes: value })} rows={4} wide />
        </FormGrid>
      </FormSection>

      <FormActions onCancel={onCancel} label="Save programme" error={error} />
    </form>
  );
}

function StandardSummary({ standard }: { standard?: ApprenticeshipStandard }) {
  return (
    <FormSection title="Funding and compliance metadata" copy="This is supporting metadata that sits underneath the branded programme proposition.">
      <div className="flex items-center gap-2">
        <BookOpen size={16} className="text-[#159b8f]" />
        <p className="text-sm font-semibold text-[#102c3d]">Official standard summary</p>
      </div>
      {standard ? (
        <div className="mt-3 space-y-2 text-sm text-[#102c3d]/68">
          <p className="font-semibold text-[#102c3d]">{standard.title}</p>
          <p>{standard.referenceCode} | Level {standard.level}</p>
          <p>{standard.occupationalRoute}</p>
          <p>{standard.typicalDuration}</p>
          <p>{formatFundingBand(standard)}</p>
          <StatusBadge tone={standard.status === "Live" ? "green" : standard.status === "Paused" ? "yellow" : "red"}>{standard.status}</StatusBadge>
        </div>
      ) : (
        <p className="mt-3 text-sm text-[#102c3d]/52">Select an active standard so LevyTate can attach funding and compliance metadata to the programme.</p>
      )}
    </FormSection>
  );
}

function IconAction({ icon: Icon, label, onClick, danger = false }: { icon: typeof Pencil; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button type="button" onClick={onClick} title={label} aria-label={label} className={`grid h-8 w-8 place-items-center rounded-lg transition ${danger ? "bg-[#fff0f2] text-[#b13b51] hover:bg-[#ffe6eb]" : "bg-[#f5f7f3] text-[#102c3d]/62 hover:text-[#102c3d]"}`}>
      <Icon size={15} />
    </button>
  );
}




