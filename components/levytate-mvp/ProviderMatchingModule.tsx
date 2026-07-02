"use client";


import { useMemo, useState, type FormEvent } from "react";
import { getApprenticeshipStandard, getSelectableApprenticeshipStandards, shortlistProvidersForNeed } from "@/lib/levytate/domain";
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
import {
  createMvpId,
  normaliseMatchingRequest,
  normaliseProviderRelationship,
  nowIso,
  todayIso,
  type MvpMatchingRequest,
  type MvpMatchingStatus,
  type MvpProviderRelationship,
  type MvpProviderRelationshipCategory,
  type MvpProviderRelationshipStatus,
} from "@/lib/levytate/mvp/workspace";

const relationshipCategories: MvpProviderRelationshipCategory[] = [
  "Digital",
  "Engineering",
  "Business Improvement",
  "Marketing",
  "Leadership",
  "Data",
  "Customer",
  "Procurement",
];

const relationshipStatuses: MvpProviderRelationshipStatus[] = ["Preferred", "Review due", "Alternative required"];
const matchingStatuses: MvpMatchingStatus[] = ["Submitted", "Under Review", "Provider Shortlist Being Prepared", "Shortlist Ready"];
const employerSizeOptions = ["", "SME", "Mid-market", "Large enterprise", "Mixed employer base"] as const;

export function ProviderMatchingModule() {
  const { data, saveProviderRelationship, saveMatchingRequest, updateMatchingStatus } = useMvpWorkspace();
  const [search, setSearch] = useState("");
  const [relationshipDraft, setRelationshipDraft] = useState<MvpProviderRelationship | null>(null);
  const [requestDraft, setRequestDraft] = useState<MvpMatchingRequest | null>(null);
  const [selectedRelationshipProviders, setSelectedRelationshipProviders] = useState<string[]>([]);
  const [selectedRelationshipProgrammes, setSelectedRelationshipProgrammes] = useState<string[]>([]);
  const [error, setError] = useState("");

  const selectableStandards = useMemo(() => getSelectableApprenticeshipStandards(), []);

  const activeProviders = useMemo(
    () => data.providers.filter((provider) => provider.status === "Active").sort((a, b) => a.providerName.localeCompare(b.providerName)),
    [data.providers],
  );

  const activeProgrammes = useMemo(
    () => data.providerProgrammes.filter((programme) => programme.recordStatus === "Active").sort((a, b) => a.programmeName.localeCompare(b.programmeName)),
    [data.providerProgrammes],
  );

  const visibleRelationships = useMemo(() => data.providerRelationships.filter((relationship) => {
    const preferred = data.providers.find((provider) => provider.providerId === relationship.preferredProviderId)?.providerName ?? "";
    const programmeText = relationship.programmeIds.map((id) => data.providerProgrammes.find((programme) => programme.id === id)?.programmeName ?? id).join(" ");
    return includesSearch([relationship.category, relationship.status, preferred, programmeText, relationship.notes], search);
  }), [data.providerProgrammes, data.providerRelationships, data.providers, search]);

  const visibleRequests = useMemo(() => data.matchingRequests.filter((request) => {
    const programme = data.providerProgrammes.find((item) => item.id === request.programmeId);
    return includesSearch([
      request.roleNeed,
      request.department,
      request.futureCapability,
      request.employerSize,
      programme?.programmeName,
      request.status,
      request.sites.join(" "),
      request.notes,
      request.targetRoles.join(" "),
      request.businessProblems.join(" "),
      request.technologies.join(" "),
      request.industries.join(" "),
    ], search);
  }), [data.matchingRequests, data.providerProgrammes, search]);

  const requestShortlist = useMemo(() => requestDraft
    ? shortlistProvidersForNeed(
        data.providers,
        data.providerProgrammes,
        selectableStandards,
        {
          roleNeed: requestDraft.roleNeed,
          department: requestDraft.department || undefined,
          futureCapability: requestDraft.futureCapability || undefined,
          employerSize: requestDraft.employerSize || undefined,
          programmeId: requestDraft.programmeId || undefined,
          linkedStandardId: requestDraft.linkedStandardId || undefined,
          deliveryModel: requestDraft.deliveryPreference || undefined,
          region: requestDraft.sites[0],
          technologies: requestDraft.technologies,
          industries: requestDraft.industries,
          businessProblems: requestDraft.businessProblems,
          targetRoles: requestDraft.targetRoles,
        },
        data.providerRelationships.map((relationship) => ({
          preferredProviderId: relationship.preferredProviderId,
          programmeIds: relationship.programmeIds,
          status: relationship.status,
        })),
      )
    : [], [data.providerProgrammes, data.providerRelationships, data.providers, requestDraft, selectableStandards]);

  function blankRelationship(): MvpProviderRelationship {
    return normaliseProviderRelationship({
      id: createMvpId("relationship"),
      category: "Digital",
      preferredProviderId: activeProviders[0]?.providerId ?? "",
      programmeIds: [],
      status: "Preferred",
      notes: "",
      reviewDate: todayIso(),
      lastUsedDate: todayIso(),
    });
  }

  function blankRequest(): MvpMatchingRequest {
    return normaliseMatchingRequest({
      id: createMvpId("match"),
      roleNeed: "",
      department: "",
      futureCapability: "",
      employerSize: "",
      programmeId: "",
      linkedStandardId: "",
      learnerCount: 1,
      sites: [],
      deliveryPreference: "Blended",
      fundingPosition: "Potentially funded through levy/co-investment",
      urgency: "Exploring",
      notes: "",
      businessProblems: [],
      targetRoles: [],
      technologies: [],
      industries: [],
      status: "Submitted",
      shortlistProviderIds: [],
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
  }

  function openRelationship(relationship?: MvpProviderRelationship) {
    const next = relationship ? structuredClone(relationship) : blankRelationship();
    setRelationshipDraft(next);
    setSelectedRelationshipProviders(next.backupProviderIds);
    setSelectedRelationshipProgrammes(next.programmeIds);
    setRequestDraft(null);
    setError("");
  }

  function openRequest(request?: MvpMatchingRequest) {
    setRequestDraft(request ? structuredClone(request) : blankRequest());
    setRelationshipDraft(null);
    setSelectedRelationshipProviders([]);
    setSelectedRelationshipProgrammes([]);
    setError("");
  }

  function submitRelationship(event: FormEvent) {
    event.preventDefault();
    if (!relationshipDraft) return;
    if (!relationshipDraft.category || !relationshipDraft.preferredProviderId) {
      setError("Category and preferred provider are required.");
      return;
    }
    saveProviderRelationship(normaliseProviderRelationship({
      ...relationshipDraft,
      backupProviderIds: selectedRelationshipProviders.filter((id) => id !== relationshipDraft.preferredProviderId),
      programmeIds: selectedRelationshipProgrammes,
    }));
    setRelationshipDraft(null);
    setSelectedRelationshipProviders([]);
    setSelectedRelationshipProgrammes([]);
    setError("");
  }

  function submitRequest(event: FormEvent) {
    event.preventDefault();
    if (!requestDraft) return;
    if (!requestDraft.roleNeed.trim()) {
      setError("Workforce need is required.");
      return;
    }
    const shortlistProviderIds = requestShortlist.filter((item) => item.verified).slice(0, 3).map((item) => item.provider.providerId);
    saveMatchingRequest(normaliseMatchingRequest({
      ...requestDraft,
      roleNeed: requestDraft.roleNeed.trim(),
      linkedStandardId: requestDraft.linkedStandardId || requestShortlist[0]?.standards[0]?.id || "",
      shortlistProviderIds,
      updatedAt: nowIso(),
    }));
    setRequestDraft(null);
    setError("");
  }

  const relationshipCoverage = relationshipCategories.filter((category) => visibleRelationships.some((relationship) => relationship.category === category && relationship.preferredProviderId)).length;

  return (
    <div className="grid gap-5">
      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Covered categories" value={`${relationshipCoverage}/${relationshipCategories.length}`} copy="Preferred provider relationships with programme coverage already defined." tone="green" />
        <SummaryCard label="Relationships to review" value={data.providerRelationships.filter((relationship) => relationship.status === "Review due").length} copy="Programme relationships that should be checked before new demand lands." tone="yellow" />
        <SummaryCard label="Alternative sourcing" value={data.matchingRequests.length} copy="Programme-led sourcing requests where existing coverage needs support." tone="blue" />
        <SummaryCard label="Verified shortlist options" value={requestShortlist.filter((item) => item.verified).length} copy="Verified programme matches for the current workforce requirement." tone="green" />
      </section>

      <MvpPanel title="Provider relationships" eyebrow="Capability coverage by programme">
        <MvpToolbar
          search={search}
          onSearch={setSearch}
          placeholder="Search categories, providers, programmes or notes"
          actionLabel="Add relationship"
          onAction={() => openRelationship()}
          filters={<button type="button" onClick={() => openRequest()} className="inline-flex h-10 items-center justify-center rounded-full bg-[#edf7f3] px-4 text-xs font-semibold text-[#0b6f63] ring-1 ring-[#159b8f]/12">Create sourcing request</button>}
        />

        {visibleRelationships.length ? (
          <TableShell>
            <TableHead>
              <tr>
                <th className="px-4 py-3">Capability area</th>
                <th className="px-4 py-3">Preferred provider</th>
                <th className="px-4 py-3">Fallback providers</th>
                <th className="px-4 py-3">Programme coverage</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </TableHead>
            <TableBody>
              {visibleRelationships.map((relationship) => {
                const preferred = data.providers.find((provider) => provider.providerId === relationship.preferredProviderId);
                const backups = relationship.backupProviderIds.map((id) => data.providers.find((provider) => provider.providerId === id)?.providerName).filter(Boolean);
                const programmeNames = relationship.programmeIds.map((id) => data.providerProgrammes.find((programme) => programme.id === id)?.programmeName).filter(Boolean);
                return (
                  <tr key={relationship.id}>
                    <td className="px-4 py-3 font-semibold">{relationship.category}</td>
                    <td className="px-4 py-3">
                      <p className="text-[#102c3d]/72">{preferred?.providerName ?? "Preferred provider not assigned"}</p>
                      <p className="mt-0.5 text-xs text-[#102c3d]/42">Review {relationship.reviewDate || "date to confirm"}</p>
                    </td>
                    <td className="px-4 py-3 text-[#102c3d]/62">{backups.length ? backups.join(", ") : "No fallback providers"}</td>
                    <td className="px-4 py-3 text-[#102c3d]/62">{programmeNames.length ? programmeNames.slice(0, 2).join(", ") : "No programmes linked"}</td>
                    <td className="px-4 py-3"><StatusBadge tone={statusTone(relationship.status)}>{relationship.status}</StatusBadge></td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <TableAction onClick={() => openRelationship(relationship)}>Manage</TableAction>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </TableBody>
          </TableShell>
        ) : (
          <EmptyState title="No provider relationships yet" copy="Create preferred provider relationships by capability area and programme coverage so the employer does not restart from zero each time." actionLabel="Add relationship" onAction={() => openRelationship()} />
        )}
      </MvpPanel>

      <MvpPanel title="Sourcing requests" eyebrow="Programme-based matching">
        {visibleRequests.length ? (
          <TableShell>
            <TableHead>
              <tr>
                <th className="px-4 py-3">Need</th>
                <th className="px-4 py-3">Programme focus</th>
                <th className="px-4 py-3">Sites</th>
                <th className="px-4 py-3">Shortlist</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </TableHead>
            <TableBody>
              {visibleRequests.map((request) => {
                const programme = data.providerProgrammes.find((item) => item.id === request.programmeId);
                const standard = getApprenticeshipStandard(request.linkedStandardId);
                return (
                  <tr key={request.id}>
                    <td className="px-4 py-3 font-semibold">{request.roleNeed}</td>
                    <td className="px-4 py-3">
                      <p className="text-[#102c3d]/72">{programme?.programmeName ?? "Programme to confirm"}</p>
                      <p className="mt-0.5 text-xs text-[#102c3d]/42">{standard?.title ?? "Linked standard to confirm"}</p>
                    </td>
                    <td className="px-4 py-3 text-[#102c3d]/62">{request.sites.join(", ") || "All sites"}</td>
                    <td className="px-4 py-3 text-[#102c3d]/62">{request.shortlistProviderIds.length} shortlisted</td>
                    <td className="px-4 py-3"><select value={request.status} onChange={(event) => updateMatchingStatus(request.id, event.target.value as MvpMatchingStatus)} className="h-9 rounded-lg border border-[#102c3d]/[0.08] bg-[#f8fbfa] px-2 text-xs font-semibold">{matchingStatuses.map((item) => <option key={item}>{item}</option>)}</select></td>
                    <td className="px-4 py-3 text-right"><TableAction onClick={() => openRequest(request)}>Review</TableAction></td>
                  </tr>
                );
              })}
            </TableBody>
          </TableShell>
        ) : (
          <EmptyState title="No sourcing requests yet" copy="Raise a sourcing request when the employer needs help finding the best-fit provider programme for a workforce challenge." actionLabel="Create request" onAction={() => openRequest()} />
        )}
      </MvpPanel>

      {relationshipDraft ? (
        <MvpModal title="Provider relationship" eyebrow="Preferred programme setup" onClose={() => setRelationshipDraft(null)} wide>
          <form onSubmit={submitRelationship} className="grid gap-4">
            <FormSection title="Relationship settings" copy="Define the capability area, preferred provider and review cadence.">
              <FormGrid>
                <FormSelect label="Capability area" value={relationshipDraft.category} onChange={(value) => setRelationshipDraft({ ...relationshipDraft, category: value as MvpProviderRelationshipCategory })} options={relationshipCategories} />
                <FormSelect label="Preferred provider" value={relationshipDraft.preferredProviderId} onChange={(value) => setRelationshipDraft({ ...relationshipDraft, preferredProviderId: value })} options={[{ value: "", label: "Select preferred provider" }, ...activeProviders.map((provider) => ({ value: provider.providerId, label: provider.providerName }))]} />
                <FormSelect label="Relationship status" value={relationshipDraft.status} onChange={(value) => setRelationshipDraft({ ...relationshipDraft, status: value as MvpProviderRelationshipStatus })} options={relationshipStatuses} />
                <FormField label="Review date" type="date" value={relationshipDraft.reviewDate} onChange={(value) => setRelationshipDraft({ ...relationshipDraft, reviewDate: value })} />
                <FormField label="Last used" type="date" value={relationshipDraft.lastUsedDate} onChange={(value) => setRelationshipDraft({ ...relationshipDraft, lastUsedDate: value })} />
                <FormTextArea label="Relationship notes" value={relationshipDraft.notes} onChange={(value) => setRelationshipDraft({ ...relationshipDraft, notes: value })} wide />
              </FormGrid>
            </FormSection>

            <div className="grid gap-4 lg:grid-cols-2">
              <FormSection title="Fallback providers" copy="Keep controlled alternatives ready when the preferred provider cannot deliver.">
                <div className="grid gap-2">
                  {activeProviders.filter((provider) => provider.providerId !== relationshipDraft.preferredProviderId).map((provider) => {
                    const checked = selectedRelationshipProviders.includes(provider.providerId);
                    return (
                      <label key={provider.providerId} className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm ring-1 transition ${checked ? "bg-white ring-[#159b8f]/20 text-[#102c3d]" : "bg-transparent ring-[#102c3d]/[0.06] text-[#102c3d]/62"}`}>
                        <input type="checkbox" checked={checked} onChange={() => setSelectedRelationshipProviders((current) => checked ? current.filter((item) => item !== provider.providerId) : [...current, provider.providerId])} className="accent-[#159b8f]" />
                        {provider.providerName}
                      </label>
                    );
                  })}
                </div>
              </FormSection>

              <FormSection title="Programme coverage" copy="Link the specific programmes this relationship is expected to cover.">
                <div className="grid max-h-72 gap-2 overflow-y-auto">
                  {activeProgrammes.map((programme) => {
                    const checked = selectedRelationshipProgrammes.includes(programme.id);
                    return (
                      <label key={programme.id} className={`rounded-xl px-3 py-2 text-sm ring-1 transition ${checked ? "bg-white ring-[#159b8f]/20 text-[#102c3d]" : "bg-transparent ring-[#102c3d]/[0.06] text-[#102c3d]/62"}`}>
                        <span className="flex items-start gap-3">
                          <input type="checkbox" checked={checked} onChange={() => setSelectedRelationshipProgrammes((current) => checked ? current.filter((item) => item !== programme.id) : [...current, programme.id])} className="mt-1 accent-[#159b8f]" />
                          <span>
                            <span className="block font-semibold">{programme.programmeName}</span>
                            <span className="text-xs text-[#102c3d]/46">{programme.targetJobRoles.slice(0, 2).join(", ") || "Programme roles to confirm"}</span>
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </FormSection>
            </div>

            <FormActions onCancel={() => setRelationshipDraft(null)} label="Save relationship" error={error} />
          </form>
        </MvpModal>
      ) : null}

      {requestDraft ? (
        <MvpModal title="Programme sourcing request" eyebrow="LevyTate matching workflow" onClose={() => setRequestDraft(null)} wide>
          <form onSubmit={submitRequest} className="grid gap-4">
            <FormSection title="Workforce requirement" copy="Describe the business challenge and the programme proposition LevyTate should match against.">
              <FormGrid>
                <FormField label="Workforce need" value={requestDraft.roleNeed} onChange={(value) => setRequestDraft({ ...requestDraft, roleNeed: value })} required wide />
                <FormField label="Department" value={requestDraft.department} onChange={(value) => setRequestDraft({ ...requestDraft, department: value })} />
                <FormField label="Future capability" value={requestDraft.futureCapability} onChange={(value) => setRequestDraft({ ...requestDraft, futureCapability: value })} />
                <FormSelect label="Employer size" value={requestDraft.employerSize} onChange={(value) => setRequestDraft({ ...requestDraft, employerSize: value as MvpMatchingRequest["employerSize"] })} options={employerSizeOptions.map((item) => ({ value: item, label: item || "Not specified" }))} />
                <FormSelect label="Preferred programme" value={requestDraft.programmeId} onChange={(value) => {
                  const programme = data.providerProgrammes.find((item) => item.id === value);
                  setRequestDraft({
                    ...requestDraft,
                    programmeId: value,
                    linkedStandardId: programme?.linkedStandardId ?? requestDraft.linkedStandardId,
                  });
                }} options={[{ value: "", label: "Match from requirement" }, ...activeProgrammes.map((programme) => ({ value: programme.id, label: programme.programmeName }))]} wide />
              </FormGrid>
            </FormSection>

            <FormSection title="Matching signals" copy="These inputs help LevyTate rank programme propositions before standards and funding checks are applied.">
              <FormGrid>
                <FormField label="Learners" type="number" value={String(requestDraft.learnerCount)} onChange={(value) => setRequestDraft({ ...requestDraft, learnerCount: Number(value) || 1 })} />
                <FormSelect label="Delivery preference" value={requestDraft.deliveryPreference} onChange={(value) => setRequestDraft({ ...requestDraft, deliveryPreference: value })} options={["Blended", "Remote", "Employer site", "Hybrid", "Online"]} />
                <FormTagInput label="Sites" values={requestDraft.sites} onChange={(value) => setRequestDraft({ ...requestDraft, sites: value })} />
                <FormSelect label="Funding position" value={requestDraft.fundingPosition} onChange={(value) => setRequestDraft({ ...requestDraft, fundingPosition: value })} options={["Potentially levy-funded", "Potentially funded through levy/co-investment", "Commercial training budget", "Unsure"]} />
                <FormSelect label="Urgency" value={requestDraft.urgency} onChange={(value) => setRequestDraft({ ...requestDraft, urgency: value })} options={["Exploring", "This quarter", "Next cohort", "Urgent"]} />
                <FormTagInput label="Target roles" values={requestDraft.targetRoles} onChange={(value) => setRequestDraft({ ...requestDraft, targetRoles: value })} wide />
                <FormTagInput label="Business problems" values={requestDraft.businessProblems} onChange={(value) => setRequestDraft({ ...requestDraft, businessProblems: value })} wide />
                <FormTagInput label="Technologies" values={requestDraft.technologies} onChange={(value) => setRequestDraft({ ...requestDraft, technologies: value })} wide />
                <FormTagInput label="Industries" values={requestDraft.industries} onChange={(value) => setRequestDraft({ ...requestDraft, industries: value })} wide />
                <FormTextArea label="Notes" value={requestDraft.notes} onChange={(value) => setRequestDraft({ ...requestDraft, notes: value })} wide />
              </FormGrid>
            </FormSection>

            <FormSection title="Programme shortlist preview" copy="The shortlist ranks provider programmes first. The official standard is shown as supporting metadata underneath.">
              <div className="grid gap-3 lg:grid-cols-3">
                {requestShortlist.slice(0, 3).map((item) => {
                  const standard = item.standards[0];
                  return (
                    <div key={`${item.provider.providerId}-${item.programme.id}`} className="rounded-xl bg-white p-4 ring-1 ring-[#102c3d]/[0.06]">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-[#102c3d]">{item.programme.programmeName}</p>
                        <StatusBadge tone={item.verified ? "green" : "yellow"}>{item.score}% match</StatusBadge>
                      </div>
                      <p className="mt-1 text-xs font-semibold text-[#0b6f63]">{item.provider.providerName}</p>
                      <p className="mt-2 text-xs leading-5 text-[#102c3d]/56">{item.programme.shortDescription}</p>
                      <p className="mt-2 text-xs text-[#102c3d]/42">Linked standard: {standard?.title ?? "To confirm"}</p>
                      <ul className="mt-3 space-y-1 text-xs text-[#102c3d]/56">
                        {item.reasons.slice(0, 4).map((reason) => <li key={reason}>- {reason}</li>)}
                      </ul>
                    </div>
                  );
                })}
              </div>
              {!requestShortlist.length ? <p className="mt-3 text-sm text-[#102c3d]/52">Add role need, business problems, delivery and industry context to preview programme matches.</p> : null}
            </FormSection>

            <FormActions onCancel={() => setRequestDraft(null)} label="Save request" error={error} />
          </form>
        </MvpModal>
      ) : null}
    </div>
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

