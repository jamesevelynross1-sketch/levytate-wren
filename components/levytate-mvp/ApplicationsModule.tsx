"use client";

import { useMemo, useState, type FormEvent } from "react";
import type { RequestStatus } from "@/lib/levytate/domain";
import { getApprenticeshipStandard } from "@/lib/levytate/domain";
import {
  EmptyState,
  FormActions,
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
import { managerName } from "@/lib/levytate/mvp/workspace-insights";

import {
  applicationOwnerForStatus,
  buildApplicationHistoryEntry,
  activeApplicationStatuses,
  createMvpId,
  nowIso,
  type MvpApplication,
} from "@/lib/levytate/mvp/workspace";

const requestStatuses: RequestStatus[] = [
  "Draft",
  "Submitted to Line Manager",
  "Awaiting Manager Review",
  "More information requested",
  "Declined by Line Manager",
  "Approved by Line Manager",
  "Submitted to Apprenticeship Lead",
  "Awaiting Final Approval",
  "Declined by Apprenticeship Lead",
  "Approved for Enrolment",
  "Withdrawn",
  "Completed",
  "Cancelled",
];

const reviewableManagerStatuses: RequestStatus[] = ["Submitted to Line Manager", "Awaiting Manager Review"];
const reviewableLeadStatuses: RequestStatus[] = ["Approved by Line Manager", "Submitted to Apprenticeship Lead", "Awaiting Final Approval"];

export function ApplicationsModule() {
  const { data, saveApplication, updateApplicationStatus } = useMvpWorkspace();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("All");
  const [ownerFilter, setOwnerFilter] = useState("All");
  const [draft, setDraft] = useState<MvpApplication | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const activeSet = useMemo(() => new Set(activeApplicationStatuses()), []);
  const visible = useMemo(() => data.applications.filter((application) => {
    const employee = data.employees.find((item) => item.id === application.employeeId);
    const standard = getApprenticeshipStandard(application.apprenticeshipStandardId);
    return (status === "All" || application.status === status)
      && (ownerFilter === "All" || application.currentOwner === ownerFilter)
      && includesSearch(
        [employee?.name, employee?.department, employee?.site, standard?.title, standard?.referenceCode, application.status, application.currentOwner],
        search,
      );
  }), [data.applications, data.employees, ownerFilter, search, status]);

  const queueSummary = {
    total: data.applications.filter((application) => activeSet.has(application.status)).length,
    manager: data.applications.filter((application) => reviewableManagerStatuses.includes(application.status)).length,
    lead: data.applications.filter((application) => reviewableLeadStatuses.includes(application.status)).length,
    enrolment: data.applications.filter((application) => application.status === "Approved for Enrolment").length,
  };

  const selectedApplication = selectedId
    ? data.applications.find((application) => application.id === selectedId) ?? null
    : null;

  function pathwaysForEmployee(employeeId: string) {
    const employee = data.employees.find((item) => item.id === employeeId);
    const role = data.roles.find((item) => item.id === employee?.roleId);
    return role ? [...role.pathwayMappings].sort((a, b) => a.priority - b.priority) : [];
  }

  function blank(): MvpApplication {
    const employee = data.employees.find((item) => item.status === "Active");
    const mappedPathways = employee ? pathwaysForEmployee(employee.id) : [];
    const now = nowIso();
    return {
      id: createMvpId("application"),
      employeeId: employee?.id ?? "",
      apprenticeshipStandardId: mappedPathways[0]?.apprenticeshipStandardId ?? "",
      status: "Draft",
      currentOwner: "Employee",
      reason: "",
      careerGoal: "",
      supportRequired: "",
      managerNote: "",
      submittedAt: now,
      updatedAt: now,
      history: [buildApplicationHistoryEntry("Draft", "Application draft created.", now)],
    };
  }

  function saveDraft(event: FormEvent) {
    event.preventDefault();
    if (!draft) return;
    if (!draft.employeeId || !draft.apprenticeshipStandardId) {
      setError("Employee and apprenticeship standard are required.");
      return;
    }
    const allowed = pathwaysForEmployee(draft.employeeId).some(
      (mapping) => mapping.apprenticeshipStandardId === draft.apprenticeshipStandardId,
    );
    if (!allowed) {
      setError("Select a pathway that is mapped to the employee's assigned role.");
      return;
    }
    const anotherActive = data.applications.some(
      (item) => item.employeeId === draft.employeeId && item.id !== draft.id && activeSet.has(item.status),
    );
    if (anotherActive && activeSet.has(draft.status)) {
      setError("This employee already has an active application.");
      return;
    }
    saveApplication({
      ...draft,
      currentOwner: applicationOwnerForStatus(draft.status),
      updatedAt: nowIso(),
    });
    setDraft(null);
    setError("");
  }

  function submitToManager(application: MvpApplication) {
    updateApplicationStatus(application.id, "Submitted to Line Manager", "Application submitted for line manager review.");
  }

  function approveManager(application: MvpApplication) {
    updateApplicationStatus(application.id, "Submitted to Apprenticeship Lead", "Line manager approved. Sent to apprenticeship lead for final review.");
  }

  function declineManager(application: MvpApplication) {
    updateApplicationStatus(application.id, "Declined by Line Manager", "Line manager declined the request.");
  }

  function approveLead(application: MvpApplication) {
    updateApplicationStatus(application.id, "Approved for Enrolment", "Apprenticeship lead approved the request for provider allocation and enrolment.");
  }

  function declineLead(application: MvpApplication) {
    updateApplicationStatus(application.id, "Declined by Apprenticeship Lead", "Apprenticeship lead declined the request.");
  }

  return (
    <div className="grid gap-5">
      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <QueueCard label="Active applications" value={queueSummary.total} copy="Requests progressing through the live workflow." />
        <QueueCard label="Manager review" value={queueSummary.manager} copy="Awaiting a line manager decision." tone="yellow" />
        <QueueCard label="Lead review" value={queueSummary.lead} copy="Approved by managers and waiting for final approval." tone="yellow" />
        <QueueCard label="Ready for enrolment" value={queueSummary.enrolment} copy="Approved applications ready for provider allocation." tone="green" />
      </section>

      <MvpPanel title="Applications" eyebrow="Approval workflow">
        <MvpToolbar
          search={search}
          onSearch={setSearch}
          placeholder="Search employee, standard, site or status"
          actionLabel="Create application"
          onAction={() => setDraft(blank())}
          filters={
            <div className="grid gap-2 sm:grid-cols-2">
              <select value={status} onChange={(event) => setStatus(event.target.value)} className="h-10 rounded-lg border border-[#102c3d]/[0.09] bg-white px-3 text-sm font-semibold"><option>All</option>{requestStatuses.map((item) => <option key={item}>{item}</option>)}</select>
              <select value={ownerFilter} onChange={(event) => setOwnerFilter(event.target.value)} className="h-10 rounded-lg border border-[#102c3d]/[0.09] bg-white px-3 text-sm font-semibold"><option>All</option><option>Employee</option><option>Line Manager</option><option>Apprenticeship Lead</option><option>Provider Partner</option><option>Completed</option></select>
            </div>
          }
        />

        {visible.length ? (
          <TableShell>
            <TableHead>
              <tr>
                <th className="px-4 py-3">Employee</th>
                <th className="px-4 py-3">Pathway</th>
                <th className="px-4 py-3">Owner</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Submitted</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </TableHead>
            <TableBody>
              {visible.map((application) => {
                const employee = data.employees.find((item) => item.id === application.employeeId);
                const standard = getApprenticeshipStandard(application.apprenticeshipStandardId);

                return (
                  <tr key={application.id}>
                    <td className="px-4 py-3">
                      <p className="font-semibold">{displayEmployee(employee)}</p>
                      <p className="mt-0.5 text-xs text-[#102c3d]/46">{employee?.department || "Department to confirm"} · {employee?.site || "Site to confirm"}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-[#102c3d]/72">{standard?.title ?? application.apprenticeshipStandardId}</p>
                      <p className="mt-0.5 text-xs text-[#102c3d]/42">{standard?.referenceCode ?? "Reference to confirm"}</p>
                    </td>
                    <td className="px-4 py-3"><StatusBadge tone="blue">{application.currentOwner}</StatusBadge></td>
                    <td className="px-4 py-3"><StatusBadge tone={statusTone(application.status)}>{application.status}</StatusBadge></td>
                    <td className="px-4 py-3 text-[#102c3d]/54">{application.submittedAt.slice(0, 10)}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <TableAction onClick={() => setSelectedId(application.id)}>View</TableAction>
                        <TableAction onClick={() => setDraft({ ...application })}>Edit</TableAction>
                        {application.status === "Draft" ? <TableAction onClick={() => submitToManager(application)}>Submit</TableAction> : null}
                        {reviewableManagerStatuses.includes(application.status) ? (
                          <>
                            <TableAction onClick={() => approveManager(application)}>Approve</TableAction>
                            <TableAction onClick={() => declineManager(application)} danger>Decline</TableAction>
                          </>
                        ) : null}
                        {reviewableLeadStatuses.includes(application.status) ? (
                          <>
                            <TableAction onClick={() => approveLead(application)}>Final approve</TableAction>
                            <TableAction onClick={() => declineLead(application)} danger>Decline</TableAction>
                          </>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </TableBody>
          </TableShell>
        ) : (
          <EmptyState
            title="No applications yet"
            copy="Create an application from a role-mapped pathway and track it through manager review, lead review and enrolment readiness."
            actionLabel="Create application"
            onAction={() => setDraft(blank())}
          />
        )}
      </MvpPanel>

      {draft ? (
        <MvpModal title={data.applications.some((item) => item.id === draft.id) ? "Edit application" : "Create application"} eyebrow="Application workflow" onClose={() => setDraft(null)}>
          <form onSubmit={saveDraft}>
            <FormGrid>
              <FormSelect
                label="Employee"
                value={draft.employeeId}
                onChange={(value) => {
                  const pathways = pathwaysForEmployee(value);
                  const employee = data.employees.find((item) => item.id === value);
                  setDraft({
                    ...draft,
                    employeeId: value,
                    apprenticeshipStandardId: pathways[0]?.apprenticeshipStandardId ?? "",
                    supportRequired: draft.supportRequired || `Manager: ${employee ? managerName(data, employee) : "Not assigned"}`,
                  });
                }}
                required
                options={[{ value: "", label: "Select employee" }, ...data.employees.filter((item) => item.status === "Active").map((item) => ({ value: item.id, label: item.name }))]}
              />
              <FormSelect label="Status" value={draft.status} onChange={(value) => setDraft({ ...draft, status: value as RequestStatus })} options={requestStatuses} />
              <FormSelect
                label="Apprenticeship standard"
                value={draft.apprenticeshipStandardId}
                onChange={(value) => setDraft({ ...draft, apprenticeshipStandardId: value })}
                required
                wide
                options={[
                  { value: "", label: "Select role-mapped pathway" },
                  ...pathwaysForEmployee(draft.employeeId).map((mapping) => {
                    const standard = getApprenticeshipStandard(mapping.apprenticeshipStandardId);
                    return {
                      value: mapping.apprenticeshipStandardId,
                      label: standard
                        ? `Level ${standard.level} · ${standard.title} · ${standard.referenceCode}`
                        : mapping.apprenticeshipStandardId,
                    };
                  }),
                ]}
              />
              <FormTextArea label="Reason for interest" value={draft.reason} onChange={(value) => setDraft({ ...draft, reason: value })} wide />
              <FormTextArea label="Career goal" value={draft.careerGoal} onChange={(value) => setDraft({ ...draft, careerGoal: value })} wide />
              <FormTextArea label="Support required" value={draft.supportRequired} onChange={(value) => setDraft({ ...draft, supportRequired: value })} wide />
              <FormTextArea label="Decision note" value={draft.managerNote} onChange={(value) => setDraft({ ...draft, managerNote: value })} wide />
            </FormGrid>
            <FormActions onCancel={() => setDraft(null)} label="Save application" error={error} />
          </form>
        </MvpModal>
      ) : null}

      {selectedApplication ? (
        <ApplicationDetailModal application={selectedApplication} onClose={() => setSelectedId(null)} />
      ) : null}
    </div>
  );
}

function QueueCard({ label, value, copy, tone = "neutral" }: { label: string; value: number; copy: string; tone?: "neutral" | "green" | "yellow" }) {
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

function ApplicationDetailModal({ application, onClose }: { application: MvpApplication; onClose: () => void }) {
  const { data } = useMvpWorkspace();
  const employee = data.employees.find((item) => item.id === application.employeeId);
  const standard = getApprenticeshipStandard(application.apprenticeshipStandardId);

  return (
    <MvpModal title={displayEmployee(employee)} eyebrow="Application record" onClose={onClose} wide>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className="space-y-4 rounded-xl border border-[#102c3d]/[0.07] bg-[#f8fbfa] p-4">
          <section>
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#c95568]">Application summary</p>
            <h3 className="mt-1 text-lg font-semibold text-[#102c3d]">{standard?.title ?? application.apprenticeshipStandardId}</h3>
            <p className="mt-2 text-sm leading-6 text-[#102c3d]/56">{employee?.jobTitle || "Role to confirm"} · {employee?.department || "Department to confirm"} · {employee?.site || "Site to confirm"}</p>
          </section>
          <section>
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#0b6f63]">Workflow status</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <StatusBadge tone={statusTone(application.status)}>{application.status}</StatusBadge>
              <StatusBadge tone="blue">Owner: {application.currentOwner}</StatusBadge>
            </div>
            <p className="mt-3 text-xs leading-5 text-[#102c3d]/54">Submitted {application.submittedAt.slice(0, 10)}</p>
          </section>
          <section>
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#0b6f63]">Business case</p>
            <div className="mt-2 space-y-3 rounded-xl bg-white p-4 ring-1 ring-[#102c3d]/[0.06]">
              <div>
                <p className="text-xs font-semibold text-[#102c3d]">Reason for interest</p>
                <p className="mt-1 text-sm leading-6 text-[#102c3d]/60">{application.reason || "No reason recorded yet."}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-[#102c3d]">Career goal</p>
                <p className="mt-1 text-sm leading-6 text-[#102c3d]/60">{application.careerGoal || "No career goal recorded yet."}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-[#102c3d]">Support required</p>
                <p className="mt-1 text-sm leading-6 text-[#102c3d]/60">{application.supportRequired || "No support needs recorded."}</p>
              </div>
            </div>
          </section>
        </div>

        <section className="rounded-xl border border-[#102c3d]/[0.07] bg-white p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#c95568]">Workflow history</p>
          <div className="mt-4 grid gap-3">
            {application.history.map((entry) => (
              <div key={entry.id} className="rounded-xl bg-[#f8fbfa] px-4 py-3 ring-1 ring-[#102c3d]/[0.06]">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-[#102c3d]">{entry.status}</p>
                    <p className="mt-1 text-xs leading-5 text-[#102c3d]/54">{entry.note}</p>
                  </div>
                  <StatusBadge tone="blue">{entry.owner}</StatusBadge>
                </div>
                <p className="mt-2 text-[11px] font-medium text-[#102c3d]/42">{entry.createdAt.slice(0, 10)}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </MvpModal>
  );
}
