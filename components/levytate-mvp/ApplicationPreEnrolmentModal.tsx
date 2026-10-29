"use client";

import { useState, type FormEvent } from "react";
import { useMvpWorkspace } from "@/components/levytate-mvp/MvpWorkspaceStore";
import { FormField, FormGrid, FormSelect, MvpModal } from "@/components/levytate-mvp/MvpUi";
import type { MvpApplication } from "@/lib/levytate/mvp/workspace";
import type { LearnerRecordDetail } from "@/lib/levytate/mvp/learner-record-view";

export function ApplicationPreEnrolmentModal({ application, onClose, onComplete }: {
  application?: MvpApplication; onClose: () => void; onComplete: (learner: LearnerRecordDetail) => void;
}) {
  const { data } = useMvpWorkspace();
  const approved = data.applications.filter((item) => item.status === "Approved for Enrolment"
    && !data.learnerRecords.some((learner) => learner.applicationId === item.id && learner.recordStatus === "Active"));
  const [applicationId, setApplicationId] = useState(application?.id ?? approved[0]?.id ?? "");
  const [programmeId, setProgrammeId] = useState("");
  const [expectedStartDate, setStart] = useState("");
  const [expectedEndDate, setEnd] = useState("");
  const [employmentRoute, setRoute] = useState("not_confirmed");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const selected = application ?? approved.find((item) => item.id === applicationId);
  const programmes = data.organisationProgrammes.filter((item) => item.status === "Active").flatMap((selection) => {
    const programme = data.providerProgrammes.find((item) => item.id === selection.programmeId && item.providerId === selection.providerId
      && item.status === "Active" && item.recordStatus === "Active"
      && (item.linkedStandardId === selected?.apprenticeshipStandardId || item.linkedStandardIds.includes(selected?.apprenticeshipStandardId ?? "")));
    return programme ? [programme] : [];
  });
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    const programme = programmes.find((item) => item.id === programmeId);
    if (!selected || !programme || !expectedStartDate || !expectedEndDate) { setError("Choose the approved application, matching programme and planned dates."); return; }
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/levytate-learners", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        applicationId: selected.id, expectedApplicationRevision: selected.revision, employeeId: selected.employeeId,
        programmeId: programme.id, providerId: programme.providerId, employmentRoute, expectedStartDate, expectedEndDate,
        lifecycleStatus: "pre_enrolment", actualStartDate: "", actualEndDate: "", enrolmentId: "",
      }) });
      const payload = await response.json() as { learner?: LearnerRecordDetail; message?: string };
      if (!response.ok || !payload.learner) throw new Error(payload.message ?? "Pre-enrolment could not be confirmed. Retry the same details.");
      onComplete(payload.learner);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Pre-enrolment could not be confirmed."); }
    finally { setBusy(false); }
  }
  return <MvpModal title="Start pre-enrolment" eyebrow="Approved application handoff" onClose={() => { if (!busy) onClose(); }}>
    <p className="mb-4 text-sm text-[#102c3d]/65">Create the learner record from final approval. Eligibility and employer checks must be completed before enrolment. Historical learner import is not enabled.</p>
    <form onSubmit={(event) => void submit(event)}><FormGrid>
      {!application ? <FormSelect label="Final-approved application" value={applicationId} onChange={(value) => { setApplicationId(value); setProgrammeId(""); }} options={[{ value: "", label: "Select approved application" }, ...approved.map((item) => ({ value: item.id, label: data.employees.find((person) => person.id === item.employeeId)?.name ?? item.employeeId }))]} /> : null}
      <FormSelect label="Matching My Programme" value={programmeId} onChange={setProgrammeId} options={[{ value: "", label: "Select programme" }, ...programmes.map((item) => ({ value: item.id, label: item.programmeName }))]} />
      <FormSelect label="Employment route" value={employmentRoute} onChange={setRoute} options={[{ value: "not_confirmed", label: "Not yet confirmed" }, { value: "existing_employee_upskill", label: "Existing employee — upskill" }, { value: "recruited_as_apprentice", label: "Recruited as apprentice" }]} />
      <FormField label="Expected start" type="date" value={expectedStartDate} onChange={setStart} />
      <FormField label="Expected end" type="date" value={expectedEndDate} onChange={setEnd} />
    </FormGrid>{error ? <p role="alert" className="mt-4 text-sm text-red-700">{error}</p> : null}
      <div className="mt-5 flex justify-end gap-3"><button type="button" disabled={busy} onClick={onClose} className="min-h-11 px-4 text-sm">Cancel</button><button type="submit" disabled={busy || !selected} className="min-h-11 rounded-full bg-[#102c3d] px-5 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Saving…" : "Start pre-enrolment"}</button></div>
    </form>
  </MvpModal>;
}
