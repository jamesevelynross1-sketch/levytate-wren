"use client";

import { Archive, BookOpen, FileText, Pencil, Search, Trash2 } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import type {
  ApprenticeshipStandard,
  ProviderCatalogueRecord,
  ProviderProgramme,
  ProviderProgrammeStatus,
  ProviderProgrammeVerificationStatus,
} from "@/lib/levytate/domain";
import {
  formatFundingBand,
  getApprenticeshipStandard,
  searchApprenticeshipStandards,
} from "@/lib/levytate/domain";
import { EmptyState, FormActions, FormField, FormGrid, FormSelect, FormTextArea, MvpModal, MvpPanel, MvpToolbar, StatusBadge, TableAction, TableBody, TableHead, TableShell } from "@/components/levytate-mvp/MvpUi";
import { useMvpWorkspace } from "@/components/levytate-mvp/MvpWorkspaceStore";
import { includesSearch, statusTone } from "@/components/levytate-mvp/module-utils";
import { createMvpId, nowIso, splitMvpList, todayIso } from "@/lib/levytate/mvp/workspace";

const tabs = ["Provider Details", "Programmes", "Notes"] as const;
type ProviderTab = (typeof tabs)[number];

const programmeStatuses: ProviderProgrammeStatus[] = ["Active", "Needs verification", "Paused", "Not available", "Defunded / unavailable for new starts"];
const verificationStatuses: ProviderProgrammeVerificationStatus[] = ["Verified from provider website", "Needs manual verification", "Provider confirmed", "LevyTate reviewed"];

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
  const [programmeStatusFilter, setProgrammeStatusFilter] = useState("All");
  const [error, setError] = useState("");

  const visible = data.providers.filter((provider) => {
    const programmes = data.providerProgrammes.filter((item) => item.providerId === provider.providerId);
    const standardText = programmes.map((programme) => getApprenticeshipStandard(programme.apprenticeshipStandardId)?.title ?? "").join(" ");
    return (status === "All" || provider.status === status)
      && includesSearch([provider.providerName, provider.sectors.join(" "), provider.regions.join(" "), standardText], search);
  });

  const selectedProviderProgrammes = useMemo(() => {
    if (!draft) return [];
    return data.providerProgrammes.filter((programme) => {
      if (programme.providerId !== draft.providerId) return false;
      const standard = getApprenticeshipStandard(programme.apprenticeshipStandardId);
      return includesSearch([standard?.title, standard?.referenceCode, standard?.occupationalRoute, programme.deliveryMode, programme.status], programmeSearch)
        && (levelFilter === "All" || String(standard?.level) === levelFilter)
        && (routeFilter === "All" || standard?.occupationalRoute === routeFilter)
        && (programmeStatusFilter === "All" || programme.status === programmeStatusFilter);
    }).sort((a, b) => {
      const aTitle = getApprenticeshipStandard(a.apprenticeshipStandardId)?.title ?? "";
      const bTitle = getApprenticeshipStandard(b.apprenticeshipStandardId)?.title ?? "";
      return aTitle.localeCompare(bTitle);
    });
  }, [data.providerProgrammes, draft, levelFilter, programmeSearch, programmeStatusFilter, routeFilter]);

  const allRoutes = useMemo(() => Array.from(new Set(data.providerProgrammes.map((programme) => getApprenticeshipStandard(programme.apprenticeshipStandardId)?.occupationalRoute).filter((value): value is string => Boolean(value)))).sort(), [data.providerProgrammes]);

  function blankProvider(): ProviderCatalogueRecord {
    return {
      providerId: createMvpId("provider"),
      providerName: "",
      website: "",
      providerType: "Independent training provider",
      sectors: [],
      deliveryModel: [],
      regions: [],
      contactName: "",
      contactEmail: "",
      ofstedRating: "Requires verification",
      status: "Active",
      sourceUrls: [],
      notes: "",
      lastVerified: todayIso(),
      verificationStatus: "needs_verification",
    };
  }

  function blankProgramme(providerId: string): ProviderProgramme {
    const now = nowIso();
    return {
      id: createMvpId("programme"),
      providerId,
      apprenticeshipStandardId: "",
      deliveryMode: "Blended",
      regions: [],
      status: "Needs verification",
      verificationStatus: "Needs manual verification",
      sourceUrl: data.providers.find((provider) => provider.providerId === providerId)?.website ?? "",
      notes: "",
      recordStatus: "Active",
      createdAt: now,
      updatedAt: now,
    };
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
    saveProvider({ ...draft, providerName: draft.providerName.trim(), lastVerified: todayIso() });
    setDraft(null);
    setError("");
  }

  function submitProgramme(event: FormEvent) {
    event.preventDefault();
    if (!programmeDraft) return;
    const standard = getApprenticeshipStandard(programmeDraft.apprenticeshipStandardId);
    if (!standard) {
      setError("Select an apprenticeship standard from the central library.");
      return;
    }
    const duplicate = data.providerProgrammes.some((programme) =>
      programme.providerId === programmeDraft.providerId
      && programme.apprenticeshipStandardId === programmeDraft.apprenticeshipStandardId
      && programme.id !== programmeDraft.id
    );
    if (duplicate) {
      setError("This provider already has a delivery record for that apprenticeship standard.");
      return;
    }
    saveProviderProgramme({
      ...programmeDraft,
      status: standard.status === "Live" ? programmeDraft.status : "Defunded / unavailable for new starts",
      updatedAt: nowIso(),
    });
    setProgrammeDraft(null);
    setStandardSearch("");
    setError("");
  }

  function removeProgramme(programme: ProviderProgramme) {
    const standard = getApprenticeshipStandard(programme.apprenticeshipStandardId);
    if (window.confirm(`Remove ${standard?.title ?? "this programme"} from the provider catalogue?`)) {
      removeProviderProgramme(programme.id);
    }
  }

  const providerExists = Boolean(draft && data.providers.some((provider) => provider.providerId === draft.providerId));

  return (
    <MvpPanel title="Providers" eyebrow="LevyTate provider catalogue">
      <MvpToolbar
        search={search}
        onSearch={setSearch}
        placeholder="Search providers, standards, sectors or regions"
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
                  <td className="px-4 py-3 text-[#102c3d]/62">{provider.deliveryModel.join(", ") || "Not set"}</td>
                  <td className="px-4 py-3"><StatusBadge>{programmeCount}</StatusBadge></td>
                  <td className="px-4 py-3"><StatusBadge tone={statusTone(provider.status)}>{provider.status}</StatusBadge></td>
                  <td className="px-4 py-3"><div className="flex justify-end gap-2"><TableAction onClick={() => openProvider(provider)}>Manage</TableAction><TableAction onClick={() => archiveProvider(provider.providerId)} danger={provider.status === "Active"}>{provider.status === "Archived" ? "Restore" : "Archive"}</TableAction></div></td>
                </tr>
              );
            })}
          </TableBody>
        </TableShell>
      ) : (
        <EmptyState title="No providers added yet" copy="Add a provider to start building verified apprenticeship delivery records." actionLabel="Add provider" onAction={() => openProvider()} />
      )}

      {draft ? (
        <MvpModal title={providerExists ? draft.providerName || "Provider" : "Add provider"} eyebrow="Provider management" onClose={() => setDraft(null)} wide>
          <div className="flex gap-1 overflow-x-auto border-b border-[#102c3d]/[0.07]" role="tablist" aria-label="Provider editor">
            {tabs.map((tab) => <button key={tab} type="button" role="tab" aria-selected={activeTab === tab} disabled={!providerExists && tab === "Programmes"} onClick={() => { setActiveTab(tab); setProgrammeDraft(null); setError(""); }} className={`border-b-2 px-4 py-3 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-35 ${activeTab === tab ? "border-[#159b8f] text-[#102c3d]" : "border-transparent text-[#102c3d]/48 hover:text-[#102c3d]"}`}>{tab}</button>)}
          </div>

          {activeTab === "Provider Details" ? (
            <form onSubmit={submitProvider} className="pt-5">
              <FormGrid>
                <FormField label="Provider name" value={draft.providerName} onChange={(value) => setDraft({ ...draft, providerName: value })} required />
                <FormField label="Website" value={draft.website} onChange={(value) => setDraft({ ...draft, website: value })} />
                <FormField label="Contact name" value={draft.contactName} onChange={(value) => setDraft({ ...draft, contactName: value })} />
                <FormField label="Contact email" type="email" value={draft.contactEmail} onChange={(value) => setDraft({ ...draft, contactEmail: value })} />
                <FormField label="Sectors" value={draft.sectors.join(", ")} onChange={(value) => setDraft({ ...draft, sectors: splitMvpList(value) })} wide />
                <FormField label="Delivery models" value={draft.deliveryModel.join(", ")} onChange={(value) => setDraft({ ...draft, deliveryModel: splitMvpList(value) })} wide />
                <FormField label="Regions" value={draft.regions.join(", ")} onChange={(value) => setDraft({ ...draft, regions: splitMvpList(value) })} wide />
              </FormGrid>
              {!providerExists ? <p className="mt-4 text-xs text-[#102c3d]/52">Save provider details before adding programme delivery records.</p> : null}
              <FormActions onCancel={() => setDraft(null)} label="Save provider" error={error} />
            </form>
          ) : null}

          {activeTab === "Notes" ? (
            <form onSubmit={submitProvider} className="pt-5">
              <FormTextArea label="Internal notes" value={draft.notes} onChange={(value) => setDraft({ ...draft, notes: value })} rows={7} wide />
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
                  <div className="grid gap-3 lg:grid-cols-[minmax(220px,1fr)_repeat(3,minmax(130px,auto))_auto]">
                    <label className="flex h-10 min-w-0 items-center gap-2 rounded-lg border border-[#102c3d]/[0.09] bg-[#f8fbfa] px-3"><Search size={15} className="text-[#102c3d]/38" /><input value={programmeSearch} onChange={(event) => setProgrammeSearch(event.target.value)} placeholder="Search programmes" className="min-w-0 flex-1 bg-transparent text-sm outline-none" /></label>
                    <select value={levelFilter} onChange={(event) => setLevelFilter(event.target.value)} className="h-10 rounded-lg border border-[#102c3d]/[0.09] bg-white px-3 text-xs font-semibold"><option>All</option>{[2, 3, 4, 5, 6, 7].map((level) => <option key={level} value={String(level)}>Level {level}</option>)}</select>
                    <select value={routeFilter} onChange={(event) => setRouteFilter(event.target.value)} className="h-10 max-w-52 rounded-lg border border-[#102c3d]/[0.09] bg-white px-3 text-xs font-semibold"><option>All</option>{allRoutes.map((route) => <option key={route}>{route}</option>)}</select>
                    <select value={programmeStatusFilter} onChange={(event) => setProgrammeStatusFilter(event.target.value)} className="h-10 max-w-52 rounded-lg border border-[#102c3d]/[0.09] bg-white px-3 text-xs font-semibold"><option>All</option>{programmeStatuses.map((item) => <option key={item}>{item}</option>)}</select>
                    <button type="button" onClick={() => setProgrammeDraft(blankProgramme(draft.providerId))} className="h-10 rounded-full bg-[#102c3d] px-4 text-xs font-semibold text-white">Add programme</button>
                  </div>
                  <div className="mt-4 overflow-x-auto rounded-lg border border-[#102c3d]/[0.07]">
                    <table className="min-w-[980px] w-full border-collapse text-left text-sm">
                      <TableHead><tr><th className="px-3 py-3">Programme</th><th className="px-3 py-3">Level</th><th className="px-3 py-3">Sector</th><th className="px-3 py-3">Delivery</th><th className="px-3 py-3">Status</th><th className="px-3 py-3">Verification</th><th className="px-3 py-3 text-right">Actions</th></tr></TableHead>
                      <TableBody>
                        {selectedProviderProgrammes.map((programme) => {
                          const standard = getApprenticeshipStandard(programme.apprenticeshipStandardId);
                          return (
                            <tr key={programme.id} className={programme.recordStatus === "Archived" ? "opacity-55" : ""}>
                              <td className="px-3 py-3"><p className="font-semibold">{standard?.title ?? "Unknown standard"}</p><p className="mt-0.5 text-xs text-[#102c3d]/44">{standard?.referenceCode}</p></td>
                              <td className="px-3 py-3">Level {standard?.level}</td>
                              <td className="px-3 py-3 text-[#102c3d]/58">{standard?.occupationalRoute}</td>
                              <td className="px-3 py-3 text-[#102c3d]/58">{programme.deliveryMode}</td>
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
  const selectedStandard = getApprenticeshipStandard(draft.apprenticeshipStandardId);
  const options = searchApprenticeshipStandards(standardSearch).slice(0, 8);

  return (
    <form onSubmit={onSubmit}>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.72fr)]">
        <div>
          <label className="grid gap-1.5 text-xs font-semibold text-[#102c3d]/58">
            Apprenticeship standard
            <input value={standardSearch} onChange={(event) => onStandardSearch(event.target.value)} placeholder="Search title or reference code" className="h-11 rounded-lg border border-[#102c3d]/[0.09] bg-[#f8fbfa] px-3 text-sm font-medium outline-none focus:border-[#159b8f] focus:bg-white focus:ring-4 focus:ring-[#159b8f]/10" />
          </label>
          <div className="mt-2 max-h-56 overflow-y-auto rounded-lg border border-[#102c3d]/[0.08] bg-white">
            {options.map((standard) => <button key={standard.id} type="button" onClick={() => { onDraft({ ...draft, apprenticeshipStandardId: standard.id, status: standard.status === "Live" ? draft.status : "Defunded / unavailable for new starts" }); onStandardSearch(standard.title); }} className={`flex w-full items-center justify-between gap-3 border-b border-[#102c3d]/[0.05] px-3 py-2.5 text-left transition last:border-0 hover:bg-[#f7faf8] ${draft.apprenticeshipStandardId === standard.id ? "bg-[#edf7f3]" : ""}`}><span><span className="block text-sm font-semibold">{standard.title}</span><span className="text-xs text-[#102c3d]/44">{standard.referenceCode} · Level {standard.level}</span></span><StatusBadge tone={standard.status === "Live" ? "green" : "red"}>{standard.status}</StatusBadge></button>)}
          </div>
        </div>
        <StandardSummary standard={selectedStandard} />
      </div>

      <div className="mt-5"><FormGrid>
        <FormField label="Delivery model" value={draft.deliveryMode} onChange={(value) => onDraft({ ...draft, deliveryMode: value })} required />
        <FormField label="Regions" value={draft.regions.join(", ")} onChange={(value) => onDraft({ ...draft, regions: splitMvpList(value) })} required />
        <FormSelect label="Programme status" value={draft.status} onChange={(value) => onDraft({ ...draft, status: value as ProviderProgrammeStatus })} options={programmeStatuses} />
        <FormSelect label="Verification" value={draft.verificationStatus} onChange={(value) => onDraft({ ...draft, verificationStatus: value as ProviderProgrammeVerificationStatus })} options={verificationStatuses} />
        <FormField label="Source URL" value={draft.sourceUrl} onChange={(value) => onDraft({ ...draft, sourceUrl: value })} wide />
        <FormTextArea label="Internal notes" value={draft.notes} onChange={(value) => onDraft({ ...draft, notes: value })} wide />
      </FormGrid></div>
      <FormActions onCancel={onCancel} label="Save programme" error={error} />
    </form>
  );
}

function StandardSummary({ standard }: { standard?: ApprenticeshipStandard }) {
  if (!standard) return <div className="grid min-h-52 place-items-center rounded-lg border border-dashed border-[#102c3d]/[0.14] bg-[#f8fbfa] p-5 text-center"><div><BookOpen size={22} className="mx-auto text-[#159b8f]" /><p className="mt-3 text-sm font-semibold">Select an official standard</p><p className="mt-1 text-xs leading-5 text-[#102c3d]/48">Official details populate automatically from the central Skills England library.</p></div></div>;
  const facts = [
    ["Reference", standard.referenceCode],
    ["Level", `Level ${standard.level}`],
    ["Route", standard.occupationalRoute],
    ["Duration", standard.typicalDuration],
    ["Funding", formatFundingBand(standard)],
    ["Status", standard.status],
  ];
  return <div className="rounded-lg border border-[#102c3d]/[0.07] bg-[#f8fbfa] p-4"><p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#0b6f63]">Official standard</p><h3 className="mt-1 text-base font-semibold">{standard.title}</h3><dl className="mt-4 grid gap-2 sm:grid-cols-2">{facts.map(([label, value]) => <div key={label}><dt className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#102c3d]/38">{label}</dt><dd className="mt-0.5 text-xs font-semibold text-[#102c3d]/72">{value}</dd></div>)}</dl><p className="mt-4 flex items-center gap-2 text-[11px] text-[#102c3d]/48"><FileText size={13} /> Skills England record stored with the library</p></div>;
}

function IconAction({ label, icon: Icon, onClick, danger = false }: { label: string; icon: typeof Pencil; onClick: () => void; danger?: boolean }) {
  return <button type="button" title={label} aria-label={label} onClick={onClick} className={`grid h-8 w-8 place-items-center rounded-lg transition ${danger ? "text-[#b13b51] hover:bg-[#fff0f2]" : "text-[#102c3d]/48 hover:bg-[#f1f6f3] hover:text-[#102c3d]"}`}><Icon size={15} /></button>;
}