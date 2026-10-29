"use client";

import { useEffect, useState } from "react";
import { englandWorkingHoursDeclarationWording } from "@/lib/levytate/mvp/learner-lifecycle";
import type { LearnerRecordDetail } from "@/lib/levytate/mvp/learner-record-view";

export function EmployeeEligibilityPanel({ learnerId }: { learnerId: string }) {
  const [detail, setDetail] = useState<LearnerRecordDetail | null>(null);
  const [percentage, setPercentage] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const [key] = useState(() => `declaration-${crypto.randomUUID()}`);
  useEffect(() => {
    let cancelled = false;
    void fetch(`/api/levytate-learners/${encodeURIComponent(learnerId)}`, { cache: "no-store" }).then(async (response) => {
      const result = await response.json() as { learner?: LearnerRecordDetail; message?: string };
      if (!response.ok || !result.learner) throw new Error(result.message || "Your declaration could not be loaded.");
      if (!cancelled) { setDetail(result.learner); setError(""); }
    }).catch((failure) => { if (!cancelled) setError(failure instanceof Error ? failure.message : "Your declaration could not be loaded."); });
    return () => { cancelled = true; };
  }, [learnerId, reload]);

  async function submit() {
    if (!detail || !confirmed || busy) return;
    const hours = Number(percentage);
    if (percentage === "" || !Number.isFinite(hours) || hours < 50 || hours > 100) { setError("Enter the expected percentage between 50 and 100. If the declaration does not apply, contact your Apprenticeship Lead."); return; }
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/levytate-learners/${encodeURIComponent(learnerId)}/employee-declaration`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idempotencyKey: key, expectedUpdatedAt: detail.updatedAt, confirmed: true, expectedEnglandWorkingHoursPercentage: hours }) });
      const result = await response.json() as { learner?: LearnerRecordDetail; message?: string };
      if (!response.ok || !result.learner) throw new Error(result.message || "The declaration could not be confirmed. Your input is retained.");
      setDetail(result.learner);
    } catch (failure) { setError(failure instanceof Error ? failure.message : "The declaration could not be confirmed. Retry with the same input."); }
    finally { setBusy(false); }
  }

  return <section className="rounded-2xl border border-[#159b8f]/20 bg-white p-5 sm:p-6"><h2 className="text-lg font-semibold text-[#102c3d]">Your pre-enrolment declaration</h2>
    {detail?.eligibilityDeclaration?.confirmed ? <p role="status" className="mt-3 text-sm leading-6">Your declaration is saved. {detail.eligibilityDeclaration.verificationStatus === "employer_verified" ? "Your employer has verified it." : "Employer verification is still required before enrolment."}</p>
      : detail ? <div className="mt-3 grid gap-4"><p className="text-sm leading-6">{englandWorkingHoursDeclarationWording}</p><label className="grid gap-1 text-sm font-semibold">Expected working hours in England (%)<input type="number" min="50" max="100" value={percentage} onChange={(event) => setPercentage(event.target.value)} disabled={busy} className="min-h-11 rounded-lg border p-3" /></label><label className="flex items-start gap-3 text-sm leading-6"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} disabled={busy} className="mt-1" />I have read the declaration and confirm that it applies to me.</label><button type="button" disabled={busy || !confirmed} onClick={() => void submit()} className="min-h-11 rounded-xl bg-[#102c3d] px-4 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Saving declaration…" : "Confirm my declaration"}</button><p className="text-xs leading-5 text-[#102c3d]/60">If this declaration does not apply, do not confirm it. Ask your Apprenticeship Lead to review eligibility.</p></div>
      : !error ? <p className="mt-3 text-sm">Loading your declaration…</p> : null}
    {error ? <div role="alert" className="mt-3 text-sm text-red-800"><p>{error}</p><button type="button" disabled={busy} onClick={() => setReload((value) => value + 1)} className="mt-2 min-h-11 font-semibold">Refresh declaration</button></div> : null}
  </section>;
}
