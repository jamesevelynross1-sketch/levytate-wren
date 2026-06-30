"use client";

import { AlertCircle, ArrowRightLeft, Link2 } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { getApprenticeshipStandard, getLiveApprenticeshipStandards, shortlistProvidersForNeed } from "@/lib/levytate/domain";
import {
  EmptyState,
  FormActions,
  FormField,
  FormGrid,
  FormSelect,
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
  nowIso,
  splitMvpList,
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

export function ProviderMatchingModule() {
  const { data, saveProviderRelationship, saveMatchingRequest, updateMatchingStatus } = useMvpWorkspace();
  const [search, setSearch] = useState("");
  const [relationshipDraft, setRelationshipDraft] = useState<MvpProviderRelationship | null>(null);
  const [requestDraft, setRequestDraft] = useState<MvpMatchingRequest | null>(null);
  const [selectedRelationshipProviders, setSelectedRelationshipProviders] = useState<string[]>([]);
  const [selectedRelationshipStandards, setSelectedRelationshipStandards] = useState<string[]>([]);
  const [error, setError] = useState("");

  const activeProviders = useMemo(
    () => data.providers.filter((provider) => provider.status === "Active").sort((a, b) => a.providerName.localeCompare(b.providerName)),
    [data.providers],
  );

  const visibleRelationships = useMemo(() => data.providerRelationships.filter((relationship) => {
    const preferred = data.providers.find((provider) => provider.providerId === relationship.preferredProviderId)?.providerName ?? "";
    const standards = relationship.apprenticeshipStandardIds.map((id) => getApprenticeshipStandard(id)?.title ?? id).join(" ");
    return includesSearch([relationship.category, relationship.status, preferred, standards, relationship.notes], search);
  }), [data.providerRelationships, data.providers, search]);

  const visibleRequests = useMemo(() => data.matchingRequests.filter((request) => {
    const standard = getApprenticeshipStandard(request.apprenticeshipStandardId);
    return includesSearch([request.roleNeed, standard?.title, request.status, request.sites.join(" "), request.notes], search);
  }), [data.matchingRequests, search]);

  const requestShortlist = useMemo(() => requestDraft && requestDraft.apprenticeshipStandardId
    ? shortlistProvidersForNeed(data.providers, data.providerProgrammes, getLiveApprenticeshipStandards(), {
        apprenticeshipStandardId: requestDraft.apprenticeshipStandardId,
        deliveryModel: requestDraft.deliveryPreference || undefined,
        region: requestDraft.sites[0],
      })
    : [], [data.providerProgrammes, data.providers, requestDraft]);

  function blankRelationship(): MvpProviderRelationship {
    const now = nowIso();
    return {
      id: createMvpId("relationship"),
      category: "Digital",
      preferredProviderId: activeProviders[0]?.providerId ?? "",
      backupProviderIds: [],
      apprenticeshipStandardIds: [],
      status: "Preferred",
      notes: "",
      reviewDate: now.slice(0, 10),
      lastUsedDate: now.slice(0, 10),
    };
  }

  function blankRequest(): MvpMatchingRequest {
    const now = nowIso();
    return {
      id: createMvpId("match"),
      roleNeed: "",
      apprenticeshipStandardId: "",
      learnerCount: 1,
      sites: [],
      deliveryPreference: "Blended",
      fundingPosition: "Potentially funded through levy/co-investment",
      urgency: "Exploring",
      notes: "",
      status: "Submitted",
      shortlistProviderIds: [],
      createdAt: now,
      updatedAt: now,
    };
  }

  function openRelationship(relationship?: MvpProviderRelationship) {
    const next = relationship ? structuredClone(relationship) : blankRelationship();
    setRelationshipDraft(next);
    setSelectedRelationshipProviders(next.backupProviderIds);
    setSelectedRelationshipStandards(next.apprenticeshipStandardIds);
    setRequestDraft(null);
    setError("");
  }

  function openRequest(request?: MvpMatchingRequest) {
    setRequestDraft(request ? structuredClone(request) : blankRequest());
    setRelationshipDraft(null);
    setSelectedRelationshipProviders([]);
    setSelectedRelationshipStandards([]);
    setError("");
  }

  function submitRelationship(event: FormEvent) {
    event.preventDefault();
    if (!relationshipDraft) return;
    if (!relationshipDraft.category || !relationshipDraft.preferredProviderId) {
      setError("Category and preferred provider are required.");
      return;
    }
    saveProviderRelationship({
      ...relationshipDraft,
      backupProviderIds: selectedRelationshipProviders.filter((id) => id !== relationshipDraft.preferredProviderId),
      apprenticeshipStandardIds: selectedRelationshipStandards,
    });
    setRelationshipDraft(null);
    setSelectedRelationshipProviders([]);
    setSelectedRelationshipStandards([]);
    setError("");
  }

  function submitRequest(event: FormEvent) {
    event.preventDefault();
    if (!requestDraft) return;
    if (!requestDraft.roleNeed.trim() || !requestDraft.apprenticeshipStandardId) {
      setError("Workforce need and apprenticeship standard are required.");
      return;
    }
    const shortlistProviderIds = requestShortlist.filter((item) => item.verified).slice(0, 3).map((item) => item.provider.providerId);
    saveMatchingRequest({
      ...requestDraft,
      roleNeed: requestDraft.roleNeed.trim(),
      shortlistProviderIds,
      updatedAt: nowIso(),
    });
    setRequestDraft(null);
    setError("");
  }

  const relationshipCoverage = relationshipCategories.filter((category) => visibleRelationships.some((relationship) => relationship.category === category && relationship.preferredProviderId)).length;

  return (
    <div className="grid gap-5">
      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Covered categories" value={`${relationshipCoverage}/${relationshipCategories.length}`} copy="Preferred partner relationships currently in place." tone="green" />
        <SummaryCard label="Relationships to review" value={data.providerRelationships.filter((relationship) => relationship.status === "Review due").length} copy="Partner relationships that should be checked before demand lands." tone="yellow" />
        <SummaryCard label="Alternative sourcing" value={data.matchingRequests.length} copy="Exception requests where preferred coverage is missing or needs alternatives." tone="blue" />
        <SummaryCard label="Verified shortlist providers" value={requestShortlist.filter((item) => item.verified).length} copy="Live shortlist candidates for the current exception request." tone="green" />
      </section>

      <MvpPanel title="Provider relationships" eyebrow="Preferred partner management">
        <MvpToolbar
          search={search}
          onSearch={setSearch}
          placeholder="Search categories, providers, standards or notes"
          actionLabel="Add relationship"
          onAction={() => openRelationship()}
          filters={<button type="button" onClick={() => openRequest()} className="inline-flex h-10 items-center justify-center rounded-full bg-[#edf7f3] px-4 text-xs font-semibold text-[#0b6f63] ring-1 ring-[#159b8f]/12">Create alternative request</button>}
        />

        {visibleRelationships.length ? (
          <TableShell>
            <TableHead>
              <tr>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Preferred partner</th>
                <th className="px-4 py-3">Fallback partners</th>
                <th className="px-4 py-3">Standards</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </TableHead>
            <TableBody>
              {visibleRelationships.map((relationship) => {
                const preferred = data.providers.find((provider) => provider.providerId === relationship.preferredProviderId);
                const backups = relationship.backupProviderIds.map((id) => data.providers.find((provider) => provider.providerId === id)?.providerName).filter(Boolean);
                return (
                  <tr key={relationship.id}>
                    <td className="px-4 py-3 font-semibold">{relationship.category}</td>
                    <td className="px-4 py-3">
                      <p className="text-[#102c3d]/72">{preferred?.providerName ?? "Preferred partner not assigned"}</p>
                      <p className="mt-0.5 text-xs text-[#102c3d]/42">Review {relationship.reviewDate || "date to confirm"}</p>
                    </td>
                    <td className="px-4 py-3 text-[#102c3d]/62">{backups.length ? backups.join(", ") : "No fallback providers"}</td>
                    <td className="px-4 py-3 text-[#102c3d]/62">{relationship.apprenticeshipStandardIds.length}</td>
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
          <EmptyState title="No provider relationships yet" copy="Create preferred provider relationships by category so the employer keeps continuity instead of starting from zero each time." actionLabel="Add relationship" onAction={() => openRelationship()} />
        )}
      </MvpPanel>

      <MvpPanel title="Alternative sourcing requests" eyebrow="Exception workflow">
        {visibleRequests.length ? (
          <TableShell>
            <TableHead>
              <tr>
                <th className="px-4 py-3">Need</th>
                <th className="px-4 py-3">Standard</th>
                <th className="px-4 py-3">Sites</th>
                <th className="px-4 py-3">Shortlist</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </TableHead>
            <TableBody>
              {visibleRequests.map((request) => {
                const standard = getApprenticeshipStandard(request.apprenticeshipStandardId);
                return (
                  <tr key={request.id}>
                    <td className="px-4 py-3 font-semibold">{request.roleNeed}</td>
                    <td className="px-4 py-3">
                      <p className="text-[#102c3d]/72">{standard?.title ?? request.apprenticeshipStandardId}</p>
                      <p className="mt-0.5 text-xs text-[#102c3d]/42">{standard?.referenceCode ?? "Reference to confirm"}</p>
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
          <EmptyState title="No alternative sourcing requests yet" copy="Only raise a sourcing request when a preferred partner cannot deliver, a capability gap exists, or the employer wants alternatives." actionLabel="Create request" onAction={() => openRequest()} />
        )}
      </MvpPanel>

      {relationshipDraft ? (
        <MvpModal title="Provider relationship" eyebrow="Preferred partner setup" onClose={() => setRelationshipDraft(null)} wide>
          <form onSubmit={submitRelationship}>
            <FormGrid>
              <FormSelect label="Category" value={relationshipDraft.category} onChange={(value) => setRelationshipDraft({ ...relationshipDraft, category: value as MvpProviderRelationshipCategory })} options={relationshipCategories} />
              <FormSelect label="Preferred provider" value={relationshipDraft.preferredProviderId} onChange={(value) => setRelationshipDraft({ ...relationshipDraft, preferredProviderId: value })} options={[{ value: "", label: "Select preferred provider" }, ...activeProviders.map((provider) => ({ value: provider.providerId, label: provider.providerName }))]} />
              <FormSelect label="Relationship status" value={relationshipDraft.status} onChange={(value) => setRelationshipDraft({ ...relationshipDraft, status: value as MvpProviderRelationshipStatus })} options={relationshipStatuses} />
              <FormField label="Review date" type="date" value={relationshipDraft.reviewDate} onChange={(value) => setRelationshipDraft({ ...relationshipDraft, reviewDate: value })} />
              <FormField label="Last used" type="date" value={relationshipDraft.lastUsedDate} onChange={(value) => setRelationshipDraft({ ...relationshipDraft, lastUsedDate: value })} />
              <FormTextArea label="Relationship notes" value={relationshipDraft.notes} onChange={(value) => setRelationshipDraft({ ...relationshipDraft, notes: value })} wide />
            </FormGrid>

            <div className="mt-5 grid gap-5 lg:grid-cols-2">
              <section className="rounded-xl border border-[#102c3d]/[0.07] bg-[#f8fbfa] p-4">
                <div className="flex items-center gap-2">
                  <Link2 size={16} className="text-[#0b6f63]" aria-hidden="true" />
                  <p className="text-sm font-semibold text-[#102c3d]">Fallback providers</p>
                </div>
                <div className="mt-3 grid gap-2">
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
              </section>

              <section className="rounded-xl border border-[#102c3d]/[0.07] bg-[#f8fbfa] p-4">
                <div className="flex items-center gap-2">
                  <ArrowRightLeft size={16} className="text-[#0b6f63]" aria-hidden="true" />
                  <p className="text-sm font-semibold text-[#102c3d]">Covered standards</p>
                </div>
                <div className="mt-3 grid max-h-72 gap-2 overflow-y-auto">
                  {getLiveApprenticeshipStandards().slice(0, 18).map((standard) => {
                    const checked = selectedRelationshipStandards.includes(standard.id);
                    return (
                      <label key={standard.id} className={`rounded-xl px-3 py-2 text-sm ring-1 transition ${checked ? "bg-white ring-[#159b8f]/20 text-[#102c3d]" : "bg-transparent ring-[#102c3d]/[0.06] text-[#102c3d]/62"}`}>
                        <span className="flex items-start gap-3">
                          <input type="checkbox" checked={checked} onChange={() => setSelectedRelationshipStandards((current) => checked ? current.filter((item) => item !== standard.id) : [...current, standard.id])} className="mt-1 accent-[#159b8f]" />
                          <span>
                            <span className="block font-semibold">{standard.title}</span>
                            <span className="text-xs text-[#102c3d]/46">Level {standard.level} · {standard.referenceCode}</span>
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </section>
            </div>

            <FormActions onCancel={() => setRelationshipDraft(null)} label="Save relationship" error={error} />
          </form>
        </MvpModal>
      ) : null}

      {requestDraft ? (
        <MvpModal title="Alternative sourcing request" eyebrow="Provider relationship exception" onClose={() => setRequestDraft(null)} wide>
          <form onSubmit={submitRequest}>
            <FormGrid>
              <FormField label="Role or workforce need" value={requestDraft.roleNeed} onChange={(value) => setRequestDraft({ ...requestDraft, roleNeed: value })} required />
              <FormSelect label="Apprenticeship standard" value={requestDraft.apprenticeshipStandardId} onChange={(value) => setRequestDraft({ ...requestDraft, apprenticeshipStandardId: value, shortlistProviderIds: [] })} required options={[{ value: "", label: "Select standard" }, ...getLiveApprenticeshipStandards().map((standard) => ({ value: standard.id, label: `Level ${standard.level} · ${standard.title} · ${standard.referenceCode}` }))]} />
              <FormField label="Learner count" type="number" value={String(requestDraft.learnerCount)} onChange={(value) => setRequestDraft({ ...requestDraft, learnerCount: Math.max(1, Number(value) || 1) })} />
              <FormField label="Sites" value={requestDraft.sites.join(", ")} onChange={(value) => setRequestDraft({ ...requestDraft, sites: splitMvpList(value) })} />
              <FormField label="Delivery preference" value={requestDraft.deliveryPreference} onChange={(value) => setRequestDraft({ ...requestDraft, deliveryPreference: value })} />
              <FormField label="Funding position" value={requestDraft.fundingPosition} onChange={(value) => setRequestDraft({ ...requestDraft, fundingPosition: value })} />
              <FormSelect label="Status" value={requestDraft.status} onChange={(value) => setRequestDraft({ ...requestDraft, status: value as MvpMatchingStatus })} options={matchingStatuses} />
              <FormField label="Urgency" value={requestDraft.urgency} onChange={(value) => setRequestDraft({ ...requestDraft, urgency: value })} />
              <FormTextArea label="Why does this need alternatives?" value={requestDraft.notes} onChange={(value) => setRequestDraft({ ...requestDraft, notes: value })} wide />
            </FormGrid>

            <div className="mt-5 rounded-xl border border-[#102c3d]/[0.07] bg-[#f8fbfa] p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-[#102c3d]">Suggested verified shortlist</p>
                  <p className="mt-1 text-xs text-[#102c3d]/48">These are exception candidates only. Preferred partner continuity remains the default operating model.</p>
                </div>
                <StatusBadge tone={requestShortlist.filter((item) => item.verified).length ? "green" : "yellow"}>{requestShortlist.filter((item) => item.verified).length} verified</StatusBadge>
              </div>

              {!requestShortlist.filter((item) => item.verified).length ? (
                <div className="mt-3 flex gap-3 rounded-xl border border-[#d9b53b]/20 bg-[#fff9dc] px-4 py-3 text-sm text-[#655415]">
                  <AlertCircle size={18} className="mt-0.5 shrink-0" />
                  <p><span className="font-semibold">No verified provider currently matches this need.</span> Save the request to flag the relationship gap for manual follow-up.</p>
                </div>
              ) : null}

              <div className="mt-3 grid gap-2 md:grid-cols-2">
                {requestShortlist.slice(0, 6).map((item) => (
                  <div key={item.programme.id} className={`rounded-xl px-3 py-3 ring-1 ${item.verified ? "bg-white ring-[#159b8f]/18" : "bg-[#f5f7f3] ring-[#102c3d]/[0.06]"}`}>
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-semibold text-[#102c3d]">{item.provider.providerName}</p>
                      <StatusBadge tone={item.verified ? "green" : "yellow"}>{item.score}% fit</StatusBadge>
                    </div>
                    <p className="mt-2 text-xs leading-5 text-[#102c3d]/56">{item.reasons.join(" · ")}</p>
                  </div>
                ))}
              </div>
            </div>

            <FormActions onCancel={() => setRequestDraft(null)} label="Save request" error={error} />
          </form>
        </MvpModal>
      ) : null}
    </div>
  );
}

function SummaryCard({ label, value, copy, tone = "neutral" }: { label: string; value: string | number; copy: string; tone?: "neutral" | "green" | "yellow" | "blue" }) {
  return (
    <div className="rounded-xl border border-[#102c3d]/[0.07] bg-white px-4 py-4 shadow-[0_14px_32px_rgba(16,44,61,0.045)]">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#c95568]">{label}</p>
        <StatusBadge tone={tone}>{value}</StatusBadge>
      </div>
      <p className="mt-3 text-sm leading-6 text-[#102c3d]/58">{copy}</p>
    </div>
  );
}