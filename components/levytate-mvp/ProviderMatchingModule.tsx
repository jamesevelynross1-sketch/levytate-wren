"use client";

import { AlertCircle, CheckCircle2 } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { apprenticeshipStandards } from "@/lib/levytate/data/mvp";
import { getApprenticeshipStandard, getLiveApprenticeshipStandards, shortlistProvidersForNeed } from "@/lib/levytate/domain";
import { EmptyState, FormActions, FormField, FormGrid, FormSelect, FormTextArea, MvpModal, MvpPanel, MvpToolbar, StatusBadge, TableAction, TableBody, TableHead, TableShell } from "@/components/levytate-mvp/MvpUi";
import { useMvpWorkspace } from "@/components/levytate-mvp/MvpWorkspaceStore";
import { includesSearch } from "@/components/levytate-mvp/module-utils";
import { createMvpId, nowIso, splitMvpList, type MvpMatchingRequest, type MvpMatchingStatus } from "@/lib/levytate/mvp/workspace";

const matchingStatuses: MvpMatchingStatus[] = ["Submitted", "Under Review", "Provider Shortlist Being Prepared", "Shortlist Ready"];

export function ProviderMatchingModule() {
  const { data, saveMatchingRequest, updateMatchingStatus } = useMvpWorkspace();
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState<MvpMatchingRequest | null>(null);
  const [error, setError] = useState("");

  const visible = data.matchingRequests.filter((item) => {
    const standard = getApprenticeshipStandard(item.apprenticeshipStandardId);
    return includesSearch([item.roleNeed, standard?.title, standard?.referenceCode, item.status, item.sites.join(" ")], search);
  });

  const shortlist = useMemo(() => draft && draft.apprenticeshipStandardId
    ? shortlistProvidersForNeed(data.providers, data.providerProgrammes, apprenticeshipStandards, {
        apprenticeshipStandardId: draft.apprenticeshipStandardId,
        deliveryModel: draft.deliveryPreference || undefined,
        region: draft.sites[0],
      })
    : [], [data.providerProgrammes, data.providers, draft]);

  const verifiedMatches = shortlist.filter((item) => item.verified);

  function blank(): MvpMatchingRequest {
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

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!draft) return;
    if (!draft.roleNeed.trim() || !draft.apprenticeshipStandardId) {
      setError("Role or workforce need and apprenticeship standard are required.");
      return;
    }
    saveMatchingRequest({ ...draft, updatedAt: nowIso() });
    setDraft(null);
    setError("");
  }

  return (
    <MvpPanel title="Provider matching" eyebrow="Verified delivery matching">
      <MvpToolbar search={search} onSearch={setSearch} placeholder="Search needs, standards, sites or status" actionLabel="Create matching request" onAction={() => setDraft(blank())} />
      {visible.length ? (
        <TableShell>
          <TableHead><tr><th className="px-4 py-3">Need</th><th className="px-4 py-3">Apprenticeship standard</th><th className="px-4 py-3">Learners</th><th className="px-4 py-3">Shortlist</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Actions</th></tr></TableHead>
          <TableBody>
            {visible.map((request) => {
              const standard = getApprenticeshipStandard(request.apprenticeshipStandardId);
              return <tr key={request.id}><td className="px-4 py-3 font-semibold">{request.roleNeed}</td><td className="px-4 py-3"><p className="font-medium text-[#102c3d]/72">{standard?.title ?? "Standard unavailable"}</p><p className="mt-0.5 text-xs text-[#102c3d]/42">{standard?.referenceCode}</p></td><td className="px-4 py-3">{request.learnerCount}</td><td className="px-4 py-3 text-[#102c3d]/62">{request.shortlistProviderIds.length} providers</td><td className="px-4 py-3"><select value={request.status} onChange={(event) => updateMatchingStatus(request.id, event.target.value as MvpMatchingStatus)} className="h-9 rounded-lg border border-[#102c3d]/[0.08] bg-[#f8fbfa] px-2 text-xs font-semibold">{matchingStatuses.map((item) => <option key={item}>{item}</option>)}</select></td><td className="px-4 py-3 text-right"><TableAction onClick={() => setDraft(structuredClone(request))}>Edit</TableAction></td></tr>;
            })}
          </TableBody>
        </TableShell>
      ) : (
        <EmptyState title="No provider matching requests yet" copy="Select an official standard and match only against provider delivery records in the controlled LevyTate catalogue." actionLabel="Create request" onAction={() => setDraft(blank())} />
      )}

      {draft ? (
        <MvpModal title="Provider matching request" onClose={() => setDraft(null)} wide>
          <form onSubmit={submit}>
            <FormGrid>
              <FormField label="Role or workforce need" value={draft.roleNeed} onChange={(value) => setDraft({ ...draft, roleNeed: value })} required />
              <FormSelect label="Apprenticeship standard" value={draft.apprenticeshipStandardId} onChange={(value) => setDraft({ ...draft, apprenticeshipStandardId: value, shortlistProviderIds: [] })} required options={[{ value: "", label: "Select official standard" }, ...getLiveApprenticeshipStandards().map((standard) => ({ value: standard.id, label: `Level ${standard.level} · ${standard.title} · ${standard.referenceCode}` }))]} />
              <FormField label="Learner count" type="number" value={String(draft.learnerCount)} onChange={(value) => setDraft({ ...draft, learnerCount: Math.max(1, Number(value) || 1) })} />
              <FormField label="Sites" value={draft.sites.join(", ")} onChange={(value) => setDraft({ ...draft, sites: splitMvpList(value) })} />
              <FormField label="Delivery preference" value={draft.deliveryPreference} onChange={(value) => setDraft({ ...draft, deliveryPreference: value })} />
              <FormField label="Funding position" value={draft.fundingPosition} onChange={(value) => setDraft({ ...draft, fundingPosition: value })} />
              <FormSelect label="Status" value={draft.status} onChange={(value) => setDraft({ ...draft, status: value as MvpMatchingStatus })} options={matchingStatuses} />
              <FormField label="Urgency" value={draft.urgency} onChange={(value) => setDraft({ ...draft, urgency: value })} />
              <FormTextArea label="Notes" value={draft.notes} onChange={(value) => setDraft({ ...draft, notes: value })} wide />
            </FormGrid>

            {draft.apprenticeshipStandardId ? (
              <div className="mt-5">
                <div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-xs font-semibold text-[#102c3d]/68">Provider delivery matches</p><p className="mt-1 text-xs text-[#102c3d]/46">Exact-standard matches only. Verification, delivery and geography influence ranking.</p></div><StatusBadge tone={verifiedMatches.length ? "green" : "yellow"}>{verifiedMatches.length} verified</StatusBadge></div>

                {!verifiedMatches.length ? <div className="mt-3 flex gap-3 rounded-lg border border-[#d9b53b]/20 bg-[#fff9dc] px-4 py-3 text-sm text-[#655415]"><AlertCircle size={18} className="mt-0.5 shrink-0" /><p><span className="font-semibold">No verified provider currently delivers this apprenticeship.</span> You can still create a manual provider matching request.</p></div> : null}

                <div className="mt-3 grid gap-2 md:grid-cols-2">
                  {shortlist.map((item) => {
                    const checked = draft.shortlistProviderIds.includes(item.provider.providerId);
                    return <label key={item.programme.id} className={`flex items-start gap-3 rounded-lg border p-3 ${item.verified ? "border-[#159b8f]/15 bg-[#f3faf7]" : "border-[#102c3d]/[0.07] bg-[#f8fbfa] opacity-72"}`}><input type="checkbox" disabled={!item.verified} checked={checked} onChange={() => setDraft({ ...draft, shortlistProviderIds: checked ? draft.shortlistProviderIds.filter((id) => id !== item.provider.providerId) : [...draft.shortlistProviderIds, item.provider.providerId] })} className="mt-1 accent-[#159b8f]" /><span className="min-w-0"><span className="flex items-center gap-2 text-sm font-semibold">{item.provider.providerName}{item.verified ? <CheckCircle2 size={14} className="text-[#0b8e82]" /> : null}</span><span className="mt-1 block text-xs leading-5 text-[#102c3d]/48">{item.score}% fit · {item.reasons.join(" · ")}</span></span></label>;
                  })}
                  {!shortlist.length ? <p className="text-sm text-[#102c3d]/48">No active delivery records match this standard and preference.</p> : null}
                </div>
              </div>
            ) : null}
            <FormActions onCancel={() => setDraft(null)} label="Save matching request" error={error} />
          </form>
        </MvpModal>
      ) : null}
    </MvpPanel>
  );
}