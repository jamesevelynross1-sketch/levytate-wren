"use client";

import {
  ArrowUpRight,
  BriefcaseBusiness,
  Building2,
  CircleAlert,
  Gauge,
  Network,
  ShieldCheck,
  Sparkles,
  Target,
} from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import type { ProviderShortlistResult } from "@/lib/levytate/domain";
import { shortlistProvidersForNeed } from "@/lib/levytate/domain";
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

function confidenceTone(confidence: ProviderShortlistResult["confidence"]) {
  if (confidence === "High") return "green" as const;
  if (confidence === "Medium") return "yellow" as const;
  return "blue" as const;
}

function buildShortlist(
  request: MvpMatchingRequest,
  providers: ReturnType<typeof useMvpWorkspace>["data"]["providers"],
  programmes: ReturnType<typeof useMvpWorkspace>["data"]["providerProgrammes"],
  standards: ReturnType<typeof useLevyTateStandards>["selectableStandards"],
  relationships: ReturnType<typeof useMvpWorkspace>["data"]["providerRelationships"],
) {
  return shortlistProvidersForNeed(
    providers,
    programmes,
    standards,
    {
      roleNeed: request.roleNeed,
      department: request.department || undefined,
      futureCapability: request.futureCapability || undefined,
      employerSize: request.employerSize || undefined,
      programmeId: request.programmeId || undefined,
      linkedStandardId: request.linkedStandardId || undefined,
      deliveryModel: request.deliveryPreference || undefined,
      region: request.sites[0],
      technologies: request.technologies,
      industries: request.industries,
      businessProblems: request.businessProblems,
      targetRoles: request.targetRoles,
    },
    relationships.map((relationship) => ({
      preferredProviderId: relationship.preferredProviderId,
      programmeIds: relationship.programmeIds,
      status: relationship.status,
    })),
  );
}

export function ProviderMatchingModule() {
  const { data, saveProviderRelationship, saveMatchingRequest, updateMatchingStatus } = useMvpWorkspace();
  const { selectableStandards } = useLevyTateStandards();
  const [search, setSearch] = useState("");
  const [relationshipDraft, setRelationshipDraft] = useState<MvpProviderRelationship | null>(null);
  const [requestDraft, setRequestDraft] = useState<MvpMatchingRequest | null>(null);
  const [selectedRelationshipProviders, setSelectedRelationshipProviders] = useState<string[]>([]);
  const [selectedRelationshipProgrammes, setSelectedRelationshipProgrammes] = useState<string[]>([]);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const activeProviders = useMemo(
    () => data.providers.filter((provider) => provider.status === "Active").sort((a, b) => a.providerName.localeCompare(b.providerName)),
    [data.providers],
  );

  const activeProgrammes = useMemo(
    () => data.providerProgrammes.filter((programme) => programme.recordStatus === "Active").sort((a, b) => a.programmeName.localeCompare(b.programmeName)),
    [data.providerProgrammes],
  );

  const relationshipProviderProgrammes = useMemo(
    () =>
      relationshipDraft
        ? activeProgrammes.filter((programme) => programme.providerId === relationshipDraft.preferredProviderId)
        : [],
    [activeProgrammes, relationshipDraft],
  );

  const visibleRelationships = useMemo(
    () => data.providerRelationships.filter((relationship) => {
      const preferred = data.providers.find((provider) => provider.providerId === relationship.preferredProviderId)?.providerName ?? "";
      const programmeText = relationship.programmeIds
        .map((id) => data.providerProgrammes.find((programme) => programme.id === id)?.programmeName ?? id)
        .join(" ");
      return includesSearch([relationship.category, relationship.status, preferred, programmeText, relationship.notes], search);
    }),
    [data.providerProgrammes, data.providerRelationships, data.providers, search],
  );

  const visibleRequests = useMemo(
    () => data.matchingRequests.filter((request) => {
      const programme = data.providerProgrammes.find((item) => item.id === request.programmeId);
      return includesSearch(
        [
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
        ],
        search,
      );
    }),
    [data.matchingRequests, data.providerProgrammes, search],
  );

  const requestShortlists = useMemo(() => {
    const map = new Map<string, ProviderShortlistResult[]>();
    for (const request of data.matchingRequests) {
      map.set(
        request.id,
        buildShortlist(request, data.providers, data.providerProgrammes, selectableStandards, data.providerRelationships),
      );
    }
    return map;
  }, [data.matchingRequests, data.providerProgrammes, data.providerRelationships, data.providers, selectableStandards]);

  const featuredRequest = visibleRequests.find((request) => request.id === selectedRequestId) ?? visibleRequests[0] ?? null;
  const featuredShortlist = featuredRequest ? requestShortlists.get(featuredRequest.id) ?? [] : [];

  const requestShortlist = useMemo(
    () =>
      requestDraft
        ? buildShortlist(requestDraft, data.providers, data.providerProgrammes, selectableStandards, data.providerRelationships)
        : [],
    [data.providerProgrammes, data.providerRelationships, data.providers, requestDraft, selectableStandards],
  );

  const matchingStats = useMemo(() => {
    const allMatches = [...requestShortlists.values()].flat();
    const verifiedMatches = allMatches.filter((item) => item.verified);
    const highConfidenceRequests = [...requestShortlists.values()].filter((items) => items[0]?.confidence === "High").length;
    return {
      relationshipCoverage: relationshipCategories.filter((category) => visibleRelationships.some((relationship) => relationship.category === category && relationship.preferredProviderId)).length,
      requestsInFlight: data.matchingRequests.length,
      highConfidenceRequests,
      verifiedOptions: verifiedMatches.length,
    };
  }, [data.matchingRequests.length, requestShortlists, visibleRelationships]);

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
    const validProgrammeIds = new Set(activeProgrammes.filter((programme) => programme.providerId === next.preferredProviderId).map((programme) => programme.id));
    setRelationshipDraft(next);
    setSelectedRelationshipProviders(Array.from(new Set(next.backupProviderIds.filter((id) => id && id !== next.preferredProviderId))));
    setSelectedRelationshipProgrammes(Array.from(new Set(next.programmeIds.filter((id) => validProgrammeIds.has(id)))));
    setRequestDraft(null);
    setError("");
  }

  function changePreferredProvider(providerId: string) {
    if (!relationshipDraft) return;
    const validProgrammeIds = new Set(activeProgrammes.filter((programme) => programme.providerId === providerId).map((programme) => programme.id));
    setRelationshipDraft({ ...relationshipDraft, preferredProviderId: providerId });
    setSelectedRelationshipProviders((current) => Array.from(new Set(current.filter((id) => id && id !== providerId))));
    setSelectedRelationshipProgrammes((current) => Array.from(new Set(current.filter((id) => validProgrammeIds.has(id)))));
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
      setError("Capability area and preferred provider are required.");
      return;
    }
    const validProgrammeIds = new Set(activeProgrammes.filter((programme) => programme.providerId === relationshipDraft.preferredProviderId).map((programme) => programme.id));
    saveProviderRelationship(
      normaliseProviderRelationship({
        ...relationshipDraft,
        backupProviderIds: Array.from(new Set(selectedRelationshipProviders.filter((id) => id && id !== relationshipDraft.preferredProviderId))),
        programmeIds: Array.from(new Set(selectedRelationshipProgrammes.filter((id) => validProgrammeIds.has(id)))),
      }),
    );
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
    const shortlistProviderIds = requestShortlist
      .filter((item) => item.verified)
      .slice(0, 3)
      .map((item) => item.provider.providerId);
    saveMatchingRequest(
      normaliseMatchingRequest({
        ...requestDraft,
        roleNeed: requestDraft.roleNeed.trim(),
        linkedStandardId: requestDraft.linkedStandardId || requestShortlist[0]?.standards[0]?.id || "",
        shortlistProviderIds,
        updatedAt: nowIso(),
      }),
    );
    setRequestDraft(null);
    setError("");
  }

  return (
    <div className="grid gap-5">
      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="Covered categories"
          value={`${matchingStats.relationshipCoverage}/${relationshipCategories.length}`}
          copy="Capability areas where a preferred provider and programme position are already controlled."
          tone="green"
        />
        <SummaryCard
          label="Sourcing requests"
          value={matchingStats.requestsInFlight}
          copy="Employer workforce needs currently moving through LevyTate's provider matching workflow."
          tone="blue"
        />
        <SummaryCard
          label="High confidence matches"
          value={matchingStats.highConfidenceRequests}
          copy="Requests where the current top recommendation already has strong commercial and delivery alignment."
          tone="green"
        />
        <SummaryCard
          label="Verified shortlist options"
          value={matchingStats.verifiedOptions}
          copy="Programme-first shortlist options that have been verified and can support a controlled recommendation."
          tone="yellow"
        />
      </section>

      <MvpPanel title="Provider relationships" eyebrow="Controlled capability coverage">
        <MvpToolbar
          search={search}
          onSearch={setSearch}
          placeholder="Search categories, providers, programmes or notes"
          actionLabel="Add relationship"
          onAction={() => openRelationship()}
        />

        {visibleRelationships.length ? (
          <div className="grid gap-4 xl:grid-cols-2">
            {visibleRelationships.map((relationship) => {
              const preferred = data.providers.find((provider) => provider.providerId === relationship.preferredProviderId);
              const backups = Array.from(new Set(relationship.backupProviderIds.filter((id) => id && id !== relationship.preferredProviderId)))
                .map((id) => data.providers.find((provider) => provider.providerId === id)?.providerName)
                .filter(Boolean) as string[];
              const programmes = relationship.programmeIds
                .map((id) => data.providerProgrammes.find((programme) => programme.id === id))
                .filter((programme) => programme?.providerId === relationship.preferredProviderId)
                .filter(Boolean);

              return (
                <article
                  key={relationship.id}
                  className="rounded-2xl border border-[#102c3d]/[0.07] bg-white p-5 shadow-[0_14px_34px_rgba(16,44,61,0.045)]"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#c95568]">
                        {relationship.category}
                      </p>
                      <h3 className="mt-1 text-base font-semibold text-[#102c3d]">
                        {preferred?.providerName ?? "Preferred provider not assigned"}
                      </h3>
                    </div>
                    <StatusBadge tone={statusTone(relationship.status)}>{relationship.status}</StatusBadge>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                    <MetricMini title="Programme coverage" value={String(programmes.length)} />
                    <MetricMini title="Backup providers" value={String(backups.length)} />
                    <MetricMini title="Review date" value={relationship.reviewDate || "To confirm"} />
                  </div>

                  <div className="mt-4 grid gap-3 lg:grid-cols-2">
                    <InfoList label="Programme coverage" items={programmes.map((programme) => programme?.programmeName ?? "")} empty="No programmes linked yet" />
                    <InfoList label="Backup providers" items={backups} empty="No backup providers" />
                  </div>

                  <p className="mt-4 text-sm leading-6 text-[#102c3d]/58">
                    {relationship.notes || "Add relationship notes explaining why this preferred provider is suitable for the capability area."}
                  </p>

                  <div className="mt-4 flex justify-end">
                    <TableAction onClick={() => openRelationship(relationship)}>Manage relationship</TableAction>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <EmptyState
            title="No provider relationships yet"
            copy="Create preferred provider relationships by capability area and programme coverage so the employer does not restart from zero each time."
            actionLabel="Add relationship"
            onAction={() => openRelationship()}
          />
        )}
      </MvpPanel>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,0.95fr)_minmax(360px,1.05fr)]">
        <MvpPanel
          title="Sourcing requests"
          eyebrow="Employer matching workflow"
          actions={
            <button
              type="button"
              onClick={() => openRequest()}
              className="inline-flex h-10 items-center justify-center rounded-full bg-[#102c3d] px-4 text-xs font-semibold text-white shadow-[0_8px_18px_rgba(16,44,61,0.12)]"
            >
              New request
            </button>
          }
        >
          {visibleRequests.length ? (
            <div className="grid gap-4">
              {visibleRequests.map((request) => {
                const shortlist = requestShortlists.get(request.id) ?? [];
                const topMatch = shortlist[0];
                return (
                  <RequestCard
                    key={request.id}
                    request={request}
                    topMatch={topMatch}
                    selected={featuredRequest?.id === request.id}
                    onSelect={() => setSelectedRequestId(request.id)}
                    onReview={() => openRequest(request)}
                    onStatusChange={(value) => updateMatchingStatus(request.id, value)}
                  />
                );
              })}
            </div>
          ) : (
            <EmptyState
              title="No sourcing requests yet"
              copy="Raise a sourcing request when an employer needs LevyTate to prepare a controlled shortlist of best-fit provider programmes."
              actionLabel="Create request"
              onAction={() => openRequest()}
            />
          )}
        </MvpPanel>

        <MvpPanel title="Executive shortlist" eyebrow="Programme-led recommendation">
          {featuredRequest && featuredShortlist.length ? (
            <div className="grid gap-4">
              <div className="rounded-2xl border border-[#102c3d]/[0.07] bg-[linear-gradient(135deg,#f8fbfa_0%,#edf7f3_100%)] p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#c95568]">
                      {featuredRequest.department || "Organisation-wide need"}
                    </p>
                    <h3 className="mt-1 text-lg font-semibold text-[#102c3d]">{featuredRequest.roleNeed}</h3>
                    <p className="mt-2 text-sm leading-6 text-[#102c3d]/58">
                      {featuredRequest.futureCapability || "Future capability objective to confirm"}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <StatusBadge tone={statusTone(featuredRequest.status)}>{featuredRequest.status}</StatusBadge>
                    <StatusBadge tone={confidenceTone(featuredShortlist[0].confidence)}>
                      {featuredShortlist[0].confidence} confidence
                    </StatusBadge>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-4">
                  <MetricMini title="Learners" value={String(featuredRequest.learnerCount)} />
                  <MetricMini title="Delivery" value={featuredRequest.deliveryPreference} />
                  <MetricMini title="Funding" value={featuredRequest.fundingPosition} />
                  <MetricMini title="Sites" value={featuredRequest.sites.join(", ") || "All sites"} />
                </div>
              </div>

              <RecommendationCard item={featuredShortlist[0]} featured />

              <div className="grid gap-4 lg:grid-cols-2">
                {featuredShortlist.slice(1, 3).map((item) => (
                  <RecommendationCard key={`${item.provider.providerId}-${item.programme.id}`} item={item} />
                ))}
              </div>
            </div>
          ) : (
            <EmptyState
              title="No shortlist in view"
              copy="Create or select a sourcing request to see LevyTate's programme-led shortlist with rationale, risks and employer fit."
              actionLabel="Create request"
              onAction={() => openRequest()}
            />
          )}
        </MvpPanel>
      </div>

      {relationshipDraft ? (
        <MvpModal title="Provider relationship" eyebrow="Preferred programme setup" onClose={() => setRelationshipDraft(null)} wide>
          <form onSubmit={submitRelationship} className="grid gap-4">
            <FormSection title="Relationship settings" copy="Define the capability area, preferred provider, programme coverage and review cadence.">
              <FormGrid>
                <FormSelect
                  label="Capability area"
                  value={relationshipDraft.category}
                  onChange={(value) =>
                    setRelationshipDraft({ ...relationshipDraft, category: value as MvpProviderRelationshipCategory })
                  }
                  options={relationshipCategories}
                />
                <FormSelect
                  label="Preferred provider"
                  value={relationshipDraft.preferredProviderId}
                  onChange={changePreferredProvider}
                  options={[
                    { value: "", label: "Select preferred provider" },
                    ...activeProviders.map((provider) => ({ value: provider.providerId, label: provider.providerName })),
                  ]}
                />
                <FormSelect
                  label="Relationship status"
                  value={relationshipDraft.status}
                  onChange={(value) => setRelationshipDraft({ ...relationshipDraft, status: value as MvpProviderRelationshipStatus })}
                  options={relationshipStatuses}
                />
                <FormField
                  label="Review date"
                  type="date"
                  value={relationshipDraft.reviewDate}
                  onChange={(value) => setRelationshipDraft({ ...relationshipDraft, reviewDate: value })}
                />
                <FormField
                  label="Last used"
                  type="date"
                  value={relationshipDraft.lastUsedDate}
                  onChange={(value) => setRelationshipDraft({ ...relationshipDraft, lastUsedDate: value })}
                />
                <FormTextArea
                  label="Relationship notes"
                  value={relationshipDraft.notes}
                  onChange={(value) => setRelationshipDraft({ ...relationshipDraft, notes: value })}
                  wide
                />
              </FormGrid>
            </FormSection>

            <div className="grid gap-4 lg:grid-cols-2">
              <FormSection title="Backup providers" copy="Keep controlled alternatives ready when the preferred provider cannot deliver.">
                <div className="grid gap-2">
                  {activeProviders
                    .filter((provider) => provider.providerId !== relationshipDraft.preferredProviderId)
                    .map((provider) => {
                      const checked = selectedRelationshipProviders.includes(provider.providerId);
                      return (
                        <label
                          key={provider.providerId}
                          className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm ring-1 transition ${
                            checked
                              ? "bg-white ring-[#159b8f]/20 text-[#102c3d]"
                              : "bg-transparent ring-[#102c3d]/[0.06] text-[#102c3d]/62"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() =>
                              setSelectedRelationshipProviders((current) =>
                                checked ? current.filter((item) => item !== provider.providerId) : [...current, provider.providerId],
                              )
                            }
                            className="accent-[#159b8f]"
                          />
                          {provider.providerName}
                        </label>
                      );
                    })}
                </div>
              </FormSection>

              <FormSection title="Programme coverage" copy="Only programmes delivered by the preferred provider can be linked to this relationship.">
                <div className="grid max-h-72 gap-2 overflow-y-auto">
                  {relationshipProviderProgrammes.length ? relationshipProviderProgrammes.map((programme) => {
                    const checked = selectedRelationshipProgrammes.includes(programme.id);
                    return (
                      <label
                        key={programme.id}
                        className={`rounded-xl px-3 py-2 text-sm ring-1 transition ${
                          checked
                            ? "bg-white ring-[#159b8f]/20 text-[#102c3d]"
                            : "bg-transparent ring-[#102c3d]/[0.06] text-[#102c3d]/62"
                        }`}
                      >
                        <span className="flex items-start gap-3">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() =>
                              setSelectedRelationshipProgrammes((current) =>
                                checked ? current.filter((item) => item !== programme.id) : [...current, programme.id],
                              )
                            }
                            className="mt-1 accent-[#159b8f]"
                          />
                          <span>
                            <span className="block font-semibold">{programme.programmeName}</span>
                            <span className="text-xs text-[#102c3d]/46">
                              {programme.targetJobRoles.slice(0, 2).join(", ") || "Programme roles to confirm"}
                            </span>
                          </span>
                        </span>
                      </label>
                    );
                  }) : (
                    <p className="rounded-xl bg-[#f8fbfa] px-3 py-3 text-sm leading-6 text-[#102c3d]/58 ring-1 ring-[#102c3d]/[0.06]">
                      Select a preferred provider with active programmes to set programme coverage.
                    </p>
                  )}
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
                <FormField
                  label="Workforce need"
                  value={requestDraft.roleNeed}
                  onChange={(value) => setRequestDraft({ ...requestDraft, roleNeed: value })}
                  required
                  wide
                />
                <FormField
                  label="Department"
                  value={requestDraft.department}
                  onChange={(value) => setRequestDraft({ ...requestDraft, department: value })}
                />
                <FormField
                  label="Future capability"
                  value={requestDraft.futureCapability}
                  onChange={(value) => setRequestDraft({ ...requestDraft, futureCapability: value })}
                />
                <FormSelect
                  label="Employer size"
                  value={requestDraft.employerSize}
                  onChange={(value) => setRequestDraft({ ...requestDraft, employerSize: value as MvpMatchingRequest["employerSize"] })}
                  options={employerSizeOptions.map((item) => ({ value: item, label: item || "Not specified" }))}
                />
                <FormSelect
                  label="Preferred programme"
                  value={requestDraft.programmeId}
                  onChange={(value) => {
                    const programme = data.providerProgrammes.find((item) => item.id === value);
                    setRequestDraft({
                      ...requestDraft,
                      programmeId: value,
                      linkedStandardId: programme?.linkedStandardId ?? requestDraft.linkedStandardId,
                    });
                  }}
                  options={[
                    { value: "", label: "Match from requirement" },
                    ...activeProgrammes.map((programme) => ({ value: programme.id, label: programme.programmeName })),
                  ]}
                  wide
                />
              </FormGrid>
            </FormSection>

            <FormSection title="Matching signals" copy="These inputs help LevyTate rank programme propositions before standards and funding checks are applied.">
              <FormGrid>
                <FormField
                  label="Learners"
                  type="number"
                  value={String(requestDraft.learnerCount)}
                  onChange={(value) => setRequestDraft({ ...requestDraft, learnerCount: Number(value) || 1 })}
                />
                <FormSelect
                  label="Delivery preference"
                  value={requestDraft.deliveryPreference}
                  onChange={(value) => setRequestDraft({ ...requestDraft, deliveryPreference: value })}
                  options={["Blended", "Remote", "Employer site", "Hybrid", "Online"]}
                />
                <FormTagInput label="Sites" values={requestDraft.sites} onChange={(value) => setRequestDraft({ ...requestDraft, sites: value })} />
                <FormSelect
                  label="Funding position"
                  value={requestDraft.fundingPosition}
                  onChange={(value) => setRequestDraft({ ...requestDraft, fundingPosition: value })}
                  options={[
                    "Potentially levy-funded",
                    "Potentially funded through levy/co-investment",
                    "Commercial training budget",
                    "Unsure",
                  ]}
                />
                <FormSelect
                  label="Urgency"
                  value={requestDraft.urgency}
                  onChange={(value) => setRequestDraft({ ...requestDraft, urgency: value })}
                  options={["Exploring", "This quarter", "Next cohort", "Urgent"]}
                />
                <FormTagInput label="Target roles" values={requestDraft.targetRoles} onChange={(value) => setRequestDraft({ ...requestDraft, targetRoles: value })} wide />
                <FormTagInput label="Business problems" values={requestDraft.businessProblems} onChange={(value) => setRequestDraft({ ...requestDraft, businessProblems: value })} wide />
                <FormTagInput label="Technologies" values={requestDraft.technologies} onChange={(value) => setRequestDraft({ ...requestDraft, technologies: value })} wide />
                <FormTagInput label="Industries" values={requestDraft.industries} onChange={(value) => setRequestDraft({ ...requestDraft, industries: value })} wide />
                <FormTextArea label="Notes" value={requestDraft.notes} onChange={(value) => setRequestDraft({ ...requestDraft, notes: value })} wide />
              </FormGrid>
            </FormSection>

            <FormSection title="Programme shortlist preview" copy="The shortlist ranks provider programmes first. The linked standard stays underneath as funding and compliance metadata.">
              {requestShortlist.length ? (
                <div className="grid gap-4">
                  <RecommendationCard item={requestShortlist[0]} featured />
                  <div className="grid gap-4 lg:grid-cols-2">
                    {requestShortlist.slice(1, 3).map((item) => (
                      <RecommendationCard key={`${item.provider.providerId}-${item.programme.id}`} item={item} />
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-[#102c3d]/52">
                  Add role need, business problems, delivery and industry context to preview programme matches.
                </p>
              )}
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

function MetricMini({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-2xl bg-[#f8fbfa] p-3 ring-1 ring-[#102c3d]/[0.06]">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#102c3d]/42">{title}</p>
      <p className="mt-2 text-sm font-semibold text-[#102c3d]">{value}</p>
    </div>
  );
}

function InfoList({ label, items, empty }: { label: string; items: string[]; empty: string }) {
  const values = items.filter(Boolean);
  return (
    <div className="rounded-2xl bg-[#f8fbfa] p-4 ring-1 ring-[#102c3d]/[0.06]">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#102c3d]/42">{label}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {values.length ? values.map((item) => <Tag key={item}>{item}</Tag>) : <p className="text-sm text-[#102c3d]/48">{empty}</p>}
      </div>
    </div>
  );
}

function RequestCard({
  request,
  topMatch,
  selected,
  onSelect,
  onReview,
  onStatusChange,
}: {
  request: MvpMatchingRequest;
  topMatch?: ProviderShortlistResult;
  selected: boolean;
  onSelect: () => void;
  onReview: () => void;
  onStatusChange: (value: MvpMatchingStatus) => void;
}) {
  return (
    <article className={`rounded-2xl border p-4 shadow-[0_12px_28px_rgba(16,44,61,0.04)] transition ${selected ? "border-[#159b8f]/35 bg-[#f8fbfa]" : "border-[#102c3d]/[0.07] bg-white"}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#c95568]">{request.department || "Matching request"}</p>
          <h3 className="mt-1 text-base font-semibold text-[#102c3d]">{request.roleNeed}</h3>
          <p className="mt-1 text-sm text-[#102c3d]/56">{request.futureCapability || "Future capability to confirm"}</p>
        </div>
        <StatusBadge tone={statusTone(request.status)}>{request.status}</StatusBadge>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <MetricMini title="Top match" value={topMatch ? `${topMatch.score}%` : "Pending"} />
        <MetricMini title="Learners" value={String(request.learnerCount)} />
        <MetricMini title="Funding" value={request.fundingPosition} />
      </div>

      <div className="mt-4 rounded-2xl bg-[#f8fbfa] p-4 ring-1 ring-[#102c3d]/[0.06]">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-[#102c3d]">{topMatch?.programme.programmeName ?? "Programme to confirm"}</p>
          {topMatch ? <StatusBadge tone={confidenceTone(topMatch.confidence)}>{topMatch.confidence}</StatusBadge> : null}
        </div>
        <p className="mt-1 text-xs font-semibold text-[#0b6f63]">{topMatch?.provider.providerName ?? "Provider to be shortlisted"}</p>
        <p className="mt-2 text-sm leading-6 text-[#102c3d]/58">{topMatch?.programme.shortDescription ?? "LevyTate will rank provider programmes against business need, delivery fit and workforce context."}</p>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <select value={request.status} onChange={(event) => onStatusChange(event.target.value as MvpMatchingStatus)} className="h-9 rounded-lg border border-[#102c3d]/[0.08] bg-white px-3 text-xs font-semibold text-[#102c3d]">
          {matchingStatuses.map((item) => <option key={item}>{item}</option>)}
        </select>
        <div className="flex gap-2">
          <TableAction onClick={onSelect}>Focus shortlist</TableAction>
          <TableAction onClick={onReview}>Review request</TableAction>
        </div>
      </div>
    </article>
  );
}

function RecommendationCard({ item, featured = false }: { item: ProviderShortlistResult; featured?: boolean }) {
  const standard = item.standards[0];
  return (
    <article className={`overflow-hidden rounded-2xl border bg-white shadow-[0_16px_36px_rgba(16,44,61,0.05)] ${featured ? "border-[#159b8f]/28" : "border-[#102c3d]/[0.07]"}`}>
      <div className={`px-5 py-5 ${featured ? "bg-[linear-gradient(135deg,#102c3d_0%,#174761_60%,#1f7b78_100%)] text-white" : "bg-[linear-gradient(135deg,#f8fbfa_0%,#edf7f3_100%)]"}`}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className={`text-[10px] font-semibold uppercase tracking-[0.14em] ${featured ? "text-white/70" : "text-[#c95568]"}`}>{featured ? "Recommended programme" : "Alternative option"}</p>
            <h3 className={`mt-1 text-lg font-semibold ${featured ? "text-white" : "text-[#102c3d]"}`}>{item.programme.programmeName}</h3>
            <p className={`mt-1 text-sm ${featured ? "text-white/74" : "text-[#0b6f63]"}`}>{item.provider.providerName}</p>
          </div>
          <div className="text-right">
            <StatusBadge tone={featured ? "green" : confidenceTone(item.confidence)}>{item.score}% match</StatusBadge>
            <p className={`mt-2 text-xs font-semibold ${featured ? "text-white/74" : "text-[#102c3d]/46"}`}>{item.confidence} confidence</p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 p-5">
        <p className="text-sm leading-6 text-[#102c3d]/58">{item.programme.shortDescription}</p>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Fact icon={Target} label="Delivery fit" value={item.deliveryFit} />
          <Fact icon={ShieldCheck} label="Funding" value={item.fundingSuitability} />
          <Fact icon={BriefcaseBusiness} label="Employer fit" value={item.recommendedEmployerType} />
          <Fact icon={Gauge} label="Verification" value={item.verified ? "Verified for shortlist" : "Requires verification"} />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <SignalCard title="Why recommended" icon={Sparkles} items={item.reasons.slice(0, 5)} fallback="Recommendation rationale will appear here." />
          <SignalCard title="Strengths" icon={ArrowUpRight} items={item.strengths.length ? item.strengths : item.employerBenefits.slice(0, 4)} fallback="Strengths to confirm." />
          <SignalCard title="Employer benefits" icon={Building2} items={item.employerBenefits.slice(0, 4)} fallback="Employer outcomes to confirm." />
          <SignalCard title="Future capability impact" icon={Network} items={item.futureCapabilityImpact.slice(0, 4)} fallback="Future capability impact to confirm." />
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div className="rounded-2xl bg-[#f8fbfa] p-4 ring-1 ring-[#102c3d]/[0.06]">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#102c3d]/42">Evidence signals</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {item.technologyAlignment.map((value) => <Tag key={value}>{value}</Tag>)}
              {item.industryAlignment.map((value) => <Tag key={value}>{value}</Tag>)}
              {item.businessProblemsMatched.map((value) => <Tag key={value}>{value}</Tag>)}
              {item.skillsMatched.map((value) => <Tag key={value}>{value}</Tag>)}
              {!item.technologyAlignment.length && !item.industryAlignment.length && !item.businessProblemsMatched.length && !item.skillsMatched.length ? <p className="text-sm text-[#102c3d]/48">Add stronger role, industry, technology or business problem context to sharpen the evidence trail.</p> : null}
            </div>
          </div>

          <div className="rounded-2xl bg-[#f8fbfa] p-4 ring-1 ring-[#102c3d]/[0.06]">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#102c3d]/42">Compliance metadata</p>
            <p className="mt-3 text-sm font-semibold text-[#102c3d]">{standard?.title ?? "Linked standard to confirm"}</p>
            <p className="mt-1 text-xs text-[#102c3d]/46">{standard ? `${standard.referenceCode} | Level ${standard.level}` : "Funding and compliance record to confirm"}</p>
            <p className="mt-4 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#102c3d]/42">Potential risks</p>
            <ul className="mt-2 space-y-2 text-sm text-[#102c3d]/58">
              {(item.potentialRisks.length ? item.potentialRisks : ["No material risks flagged at this stage."]).map((risk) => (
                <li key={risk} className="flex gap-2"><CircleAlert size={14} className="mt-1 shrink-0 text-[#c95568]" />{risk}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </article>
  );
}

function Fact({ icon: Icon, label, value }: { icon: typeof Gauge; label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-[#f8fbfa] p-3 ring-1 ring-[#102c3d]/[0.06]">
      <div className="flex items-center gap-2 text-[#0b8e82]"><Icon size={14} /><span className="text-[10px] font-semibold uppercase tracking-[0.12em]">{label}</span></div>
      <p className="mt-2 text-sm font-semibold text-[#102c3d]">{value}</p>
    </div>
  );
}

function SignalCard({ icon: Icon, title, items, fallback }: { icon: typeof Sparkles; title: string; items: string[]; fallback: string }) {
  return (
    <div className="rounded-2xl bg-[#f8fbfa] p-4 ring-1 ring-[#102c3d]/[0.06]">
      <div className="flex items-center gap-2 text-[#0b8e82]"><Icon size={15} /><p className="text-sm font-semibold text-[#102c3d]">{title}</p></div>
      <ul className="mt-3 space-y-2 text-sm text-[#102c3d]/58">
        {(items.length ? items : [fallback]).map((item) => (
          <li key={item} className="flex gap-2"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#159b8f]" />{item}</li>
        ))}
      </ul>
    </div>
  );
}

function Tag({ children }: { children: string }) {
  return <span className="inline-flex rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-[#102c3d]/68 ring-1 ring-[#102c3d]/[0.07]">{children}</span>;
}
