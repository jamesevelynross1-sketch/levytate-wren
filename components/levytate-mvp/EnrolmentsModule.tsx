"use client";

import { useMemo, useState, type FormEvent } from "react";
import { getApprenticeshipStandard, isVerifiedProviderProgramme } from "@/lib/levytate/domain";
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
import { displayEmployee, includesSearch, statusTone } from "@/components/levytate-mvp/module-utils";
import { createMvpId, nowIso, type MvpEnrolment, type MvpEnrolmentStatus } from "@/lib/levytate/mvp/workspace";

const enrolmentStatuses: MvpEnrolmentStatus[] = [
  "Ready for provider",
  "Submitted to provider",
  "Enrolment in progress",
  "Live learner",
  "Completed",
  "Cancelled",
];

export function EnrolmentsModule() {
  const { data, saveEnrolment } = useMvpWorkspace();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [draft, setDraft] = useState<MvpEnrolment | null>(null);
  const [error, setError] = useState("");

  const approved = useMemo(
    () => data.applications.filter((application) => application.status === "Approved for Enrolment" && !data.enrolments.some((enrolment) => enrolment.applicationId === application.id)),
    [data.applications, data.enrolments],
  );

  const visible = useMemo(() => data.enrolments.filter((enrolment) => {
    const standard = getApprenticeshipStandard(enrolment.apprenticeshipStandardId);
    return (statusFilter === "All" || enrolment.status === statusFilter)
      && includesSearch([displayEmployee(data.employees.find((item) => item.id === enrolment.employeeId)), standard?.title, standard?.referenceCode, enrolment.status], search);
  }), [data.employees, data.enrolments, search, statusFilter]);

  const summary = {
    ready: data.enrolments.filter((enrolment) => enrolment.status === "Ready for provider").length,
    submitted: data.enrolments.filter((enrolment) => enrolment.status === "Submitted to provider").length,
    live: data.enrolments.filter((enrolment) => enrolment.status === "Live learner").length,
    approved: approved.length,
  };

  function eligibleProviders(standardId: string) {
    const ids = new Set(
      data.providerProgrammes
        .filter((programme) => programme.linkedStandardIds.includes(standardId) && programme.status === "Active" && programme.recordStatus === "Active" && isVerifiedProviderProgramme(programme))
        .map((programme) => programme.providerId),
    );
    return data.providers.filter((provider) => provider.status === "Active" && ids.has(provider.providerId));
  }

  function blank(): MvpEnrolment {
    const application = approved[0];
    const now = nowIso();
    const standardId = application?.apprenticeshipStandardId ?? "";
    return {
      id: createMvpId("enrolment"),
      applicationId: application?.id ?? "",
      employeeId: application?.employeeId ?? "",
      providerId: eligibleProviders(standardId)[0]?.providerId ?? "",
      apprenticeshipStandardId: standardId,
      status: "Ready for provider",
      startDate: "",
      notes: "",
      createdAt: now,
      updatedAt: now,
    };
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!draft) return;
    if (!draft.applicationId || !draft.providerId) {
      setError("Approved application and verified provider are required.");
      return;
    }
    const application = data.applications.find((item) => item.id === draft.applicationId);
    saveEnrolment({
      ...draft,
      employeeId: application?.employeeId ?? draft.employeeId,
      apprenticeshipStandardId: application?.apprenticeshipStandardId ?? draft.apprenticeshipStandardId,
      updatedAt: nowIso(),
    });
    setDraft(null);
    setError("");
  }

  return (
    <div className="grid gap-5">
      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Approved for enrolment" value={summary.approved} copy="Applications that can now move into provider allocation." tone="yellow" />
        <SummaryCard label="Ready for provider" value={summary.ready} copy="Internal enrolment records prepared and awaiting provider submission." tone="yellow" />
        <SummaryCard label="Submitted to provider" value={summary.submitted} copy="Records already handed over and being progressed into start dates." tone="blue" />
        <SummaryCard label="Live learners" value={summary.live} copy="Employees now active on programme." tone="green" />
      </section>

      <MvpPanel title="Enrolments" eyebrow="Provider handoff">
        <MvpToolbar
          search={search}
          onSearch={setSearch}
          placeholder="Search learner, programme or status"
          actionLabel="Create enrolment"
          onAction={() => setDraft(blank())}
          filters={<select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="h-10 rounded-lg border border-[#102c3d]/[0.09] bg-white px-3 text-sm font-semibold"><option>All</option>{enrolmentStatuses.map((item) => <option key={item}>{item}</option>)}</select>}
        />

        {visible.length ? (
          <TableShell>
            <TableHead>
              <tr>
                <th className="px-4 py-3">Learner</th>
                <th className="px-4 py-3">Programme</th>
                <th className="px-4 py-3">Provider</th>
                <th className="px-4 py-3">Start date</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </TableHead>
            <TableBody>
              {visible.map((enrolment) => {
                const standard = getApprenticeshipStandard(enrolment.apprenticeshipStandardId);
                return (
                  <tr key={enrolment.id}>
                    <td className="px-4 py-3 font-semibold">{displayEmployee(data.employees.find((item) => item.id === enrolment.employeeId))}</td>
                    <td className="px-4 py-3">
                      <p className="text-[#102c3d]/72">{standard?.title ?? enrolment.apprenticeshipStandardId}</p>
                      <p className="mt-0.5 text-xs text-[#102c3d]/42">{standard?.referenceCode ?? "Reference to confirm"}</p>
                    </td>
                    <td className="px-4 py-3 text-[#102c3d]/62">{data.providers.find((item) => item.providerId === enrolment.providerId)?.providerName ?? "Not assigned"}</td>
                    <td className="px-4 py-3 text-[#102c3d]/54">{enrolment.startDate || "Not set"}</td>
                    <td className="px-4 py-3"><StatusBadge tone={statusTone(enrolment.status)}>{enrolment.status}</StatusBadge></td>
                    <td className="px-4 py-3 text-right"><TableAction onClick={() => setDraft({ ...enrolment })}>Edit</TableAction></td>
                  </tr>
                );
              })}
            </TableBody>
          </TableShell>
        ) : (
          <EmptyState title="No enrolments yet" copy={approved.length ? "Create an enrolment from an application approved for enrolment." : "Final-approved applications will appear here once they are ready for provider allocation."} actionLabel="Create enrolment" onAction={() => setDraft(blank())} />
        )}
      </MvpPanel>

      {draft ? (
        <MvpModal title="Enrolment record" eyebrow="Provider allocation" onClose={() => setDraft(null)}>
          <form onSubmit={submit}>
            <FormGrid>
              <FormSelect
                label="Approved application"
                value={draft.applicationId}
                onChange={(value) => {
                  const application = data.applications.find((item) => item.id === value);
                  const standardId = application?.apprenticeshipStandardId ?? "";
                  setDraft({
                    ...draft,
                    applicationId: value,
                    employeeId: application?.employeeId ?? "",
                    apprenticeshipStandardId: standardId,
                    providerId: eligibleProviders(standardId)[0]?.providerId ?? "",
                  });
                }}
                required
                options={[{ value: "", label: "Select approved application" }, ...[...approved, ...data.applications.filter((item) => item.id === draft.applicationId)].map((application) => {
                  const standard = getApprenticeshipStandard(application.apprenticeshipStandardId);
                  return { value: application.id, label: `${displayEmployee(data.employees.find((item) => item.id === application.employeeId))} - ${standard?.title ?? application.apprenticeshipStandardId}` };
                })]}
              />
              <FormSelect label="Verified provider" value={draft.providerId} onChange={(value) => setDraft({ ...draft, providerId: value })} required options={[{ value: "", label: "Select verified provider" }, ...eligibleProviders(draft.apprenticeshipStandardId).map((provider) => ({ value: provider.providerId, label: provider.providerName }))]} />
              <FormSelect label="Status" value={draft.status} onChange={(value) => setDraft({ ...draft, status: value as MvpEnrolmentStatus })} options={enrolmentStatuses} />
              <FormField label="Planned start date" type="date" value={draft.startDate} onChange={(value) => setDraft({ ...draft, startDate: value })} />
              <FormTextArea label="Provider notes" value={draft.notes} onChange={(value) => setDraft({ ...draft, notes: value })} wide />
            </FormGrid>
            <div className="mt-4 rounded-xl bg-[#f8fbfa] px-4 py-3 text-xs leading-5 text-[#102c3d]/56 ring-1 ring-[#102c3d]/[0.06]">
              This record turns final approval into a provider handoff. Start dates, provider status, and live learner movement should all be tracked here instead of spreadsheets.
            </div>
            <FormActions onCancel={() => setDraft(null)} label="Save enrolment" error={error} />
          </form>
        </MvpModal>
      ) : null}
    </div>
  );
}

function SummaryCard({ label, value, copy, tone = "neutral" }: { label: string; value: number; copy: string; tone?: "neutral" | "green" | "yellow" | "blue" }) {
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
