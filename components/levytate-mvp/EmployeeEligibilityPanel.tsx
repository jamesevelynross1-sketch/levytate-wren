"use client";

import { useEffect, useState } from "react";
import { englandWorkingHoursDeclarationWording } from "@/lib/levytate/mvp/learner-lifecycle";
import type { LearnerRecordDetail } from "@/lib/levytate/mvp/learner-record-view";
import { authenticatedClientFetch, type ClientIdentity } from "@/lib/levytate/client-session";
import { decodeEmployeeDeclarationResponse } from "@/lib/levytate/employee-declaration-response";
import { useMvpWorkspace } from "@/components/levytate-mvp/MvpWorkspaceStore";
import { usePinnedClientMutation } from "@/components/levytate-mvp/usePinnedClientMutation";
import { ClientMutationRecovery } from "@/components/levytate-mvp/ClientMutationRecovery";

export function EmployeeEligibilityPanel({ learnerId }: { learnerId: string }) {
  const { meta } = useMvpWorkspace();
  if (!meta?.userEmail || !meta.organisationId) return <p role="status" className="text-sm">Confirming your workspace before loading the declaration…</p>;
  return <PersonalEligibilityForm learnerId={learnerId} identity={{ email: meta.userEmail, organisationId: meta.organisationId }} />;
}

function PersonalEligibilityForm({ learnerId, identity }: { learnerId: string; identity: ClientIdentity }) {
  const [owner] = useState(() => ({ identity: { ...identity }, learnerId }));
  const path = `/api/levytate-learners/${encodeURIComponent(owner.learnerId)}`;
  const [detail, setDetail] = useState<LearnerRecordDetail | null>(null);
  const [percentage, setPercentage] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const staleOwner = owner.learnerId !== learnerId || owner.identity.email !== identity.email || owner.identity.organisationId !== identity.organisationId;
  const mutation = usePinnedClientMutation(owner.identity, `${path}/employee-declaration`, (value) => decodeEmployeeDeclarationResponse(value, owner.identity, owner.learnerId, true));

  useEffect(() => {
    let cancelled = false;
    if (staleOwner) return;
    void authenticatedClientFetch(path, {}, owner.identity).then(async (response) => {
      const result: unknown = await response.json();
      if (!response.ok) throw new Error("Your declaration could not be loaded. Sign in to the original account or reload the workspace.");
      const loaded = decodeEmployeeDeclarationResponse(result, owner.identity, owner.learnerId);
      if (!cancelled) { setDetail(loaded); setError(""); }
    }).catch((failure) => { if (!cancelled) setError(failure instanceof Error ? failure.message : "Your declaration could not be loaded."); });
    return () => { cancelled = true; };
  }, [path, owner, reload, staleOwner]);

  async function submit() {
    if (!detail || !confirmed || mutation.locked || staleOwner) return;
    const hours = Number(percentage);
    if (percentage === "" || !Number.isFinite(hours) || hours < 50 || hours > 100) { setError("Enter the expected percentage between 50 and 100. If the declaration does not apply, contact your Apprenticeship Lead."); return; }
    setError("");
    try {
      await mutation.execute({ idempotencyKey: `declaration-${crypto.randomUUID()}`, expectedUpdatedAt: detail.updatedAt, confirmed: true, expectedEnglandWorkingHoursPercentage: hours }, setDetail);
    } catch { /* Recovery retains the exact body, version and request key. */ }
  }

  return <section className="rounded-2xl border border-[#159b8f]/20 bg-white p-5 sm:p-6">
    <ClientMutationRecovery mutation={mutation} />
    <h2 className="text-lg font-semibold text-[#102c3d]">Your pre-enrolment declaration</h2>
    {staleOwner ? <p role="alert" className="mt-3 text-sm text-red-800">Your workspace changed. Reload saved state before completing a declaration.</p> : null}
    {detail?.eligibilityDeclaration?.confirmed ? <p role="status" className="mt-3 text-sm leading-6">Your declaration is saved. {detail.eligibilityDeclaration.verificationStatus === "employer_verified" ? "Your employer has verified it." : "Employer verification is still required before enrolment."}</p>
      : detail ? <fieldset disabled={mutation.locked || staleOwner} className="mt-3 grid min-w-0 gap-4 border-0 p-0">
        <p className="text-sm leading-6">{englandWorkingHoursDeclarationWording}</p>
        <label className="grid gap-1 text-sm font-semibold">Expected working hours in England (%)<input type="number" min="50" max="100" value={percentage} onChange={(event) => setPercentage(event.target.value)} className="min-h-11 rounded-lg border p-3" /></label>
        <label className="flex items-start gap-3 text-sm leading-6"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} className="mt-1" />I have read the declaration and confirm that it applies to me.</label>
        <button type="button" disabled={!confirmed} onClick={() => void submit()} className="min-h-11 rounded-xl bg-[#102c3d] px-4 text-sm font-semibold text-white disabled:opacity-50">{mutation.working ? "Saving declaration…" : "Confirm my declaration"}</button>
        <p className="text-xs leading-5 text-[#102c3d]/60">If this declaration does not apply, do not confirm it. Ask your Apprenticeship Lead to review eligibility.</p>
      </fieldset>
      : !error ? <p className="mt-3 text-sm">Loading your declaration…</p> : null}
    {error ? <div role="alert" className="mt-3 text-sm text-red-800"><p>{error}</p><button type="button" disabled={mutation.locked || staleOwner} onClick={() => setReload((value) => value + 1)} className="mt-2 min-h-11 font-semibold">Refresh declaration</button></div> : null}
  </section>;
}
