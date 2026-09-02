"use client";

import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
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
import { OperationalMetricRail, StageTracker } from "@/components/levytate-mvp/OperationalVisuals";
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

type ApplicationsModuleProps = {
  onOpenDirectReport?: (employeeId: string) => void;
  initialApplicationId?: string | null;
  onApplicationSelectionChange?: (applicationId: string | null) => void;
};

export function ApplicationsModule({
  onOpenDirectReport,
  initialApplicationId = null,
  onApplicationSelectionChange,
}: ApplicationsModuleProps = {}) {
  const { data, saveApplication, updateApplicationStatus, meta } = useMvpWorkspace();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("All");
  const [ownerFilter, setOwnerFilter] = useState("All");
  const [draft, setDraft] = useState<MvpApplication | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(initialApplicationId ?? null);
  const [error, setError] = useState("");

  useEffect(() => {
    setSelectedId(initialApplicationId ?? null);
  }, [initialApplicationId]);

  useEffect(() => {
    onApplicationSelectionChange?.(selectedId);
  }, [onApplicationSelectionChange, selectedId]);

  const activeSet = useMemo(() => new Set(activeApplicationStatuses()), []);

  if (meta?.userRole === "Line Manager") {
    return <LineManagerApprovalsModule onOpenDirectReport={onOpenDirectReport} initialApplicationId={initialApplicationId} onApplicationSelectionChange={onApplicationSelectionChange} />;
  }
  const visible = data.applications.filter((application) => {
    const employee = data.employees.find((item) => item.id === application.employeeId);
    const standard = getApprenticeshipStandard(application.apprenticeshipStandardId);
    return (status === "All" || application.status === status)
      && (ownerFilter === "All" || application.currentOwner === ownerFilter)
      && includesSearch(
        [employee?.name, employee?.department, employee?.site, standard?.title, standard?.referenceCode, application.status, application.currentOwner],
        search,
      );
  });

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
    <div className="grid min-w-0 gap-5">
      <OperationalMetricRail items={[
        { label: "Active applications", value: queueSummary.total },
        { label: "Manager review", value: queueSummary.manager, tone: "watch" },
        { label: "Lead review", value: queueSummary.lead, tone: "watch" },
        { label: "Ready for enrolment", value: queueSummary.enrolment, tone: "healthy" },
      ]} />

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
                      <p className="mt-0.5 text-xs text-[#102c3d]/[0.46]">{employee?.department || "Department to confirm"} · {employee?.site || "Site to confirm"}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-[#102c3d]/[0.72]">{standard?.title ?? application.apprenticeshipStandardId}</p>
                      <p className="mt-0.5 text-xs text-[#102c3d]/[0.42]">{standard?.referenceCode ?? "Reference to confirm"}</p>
                    </td>
                    <td className="px-4 py-3"><p className="text-sm font-semibold text-[#102c3d]">{application.currentOwner}</p></td>
                    <td className="px-4 py-3"><StatusBadge tone={statusTone(application.status)}>{application.status}</StatusBadge><p className="mt-1 text-xs text-[#102c3d]/[0.45]">Stage {applicationStage(application.status) + 1} of 4</p></td>
                    <td className="px-4 py-3 text-[#102c3d]/[0.54]">{application.submittedAt.slice(0, 10)}</td>
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

function LineManagerApprovalsModule({ onOpenDirectReport, initialApplicationId, onApplicationSelectionChange }: ApplicationsModuleProps) {
  const { data, updateApplicationStatus, meta } = useMvpWorkspace();
  const [selectedId, setSelectedId] = useState<string | null>(initialApplicationId ?? null);

  useEffect(() => {
    setSelectedId(initialApplicationId ?? null);
  }, [initialApplicationId]);

  function selectApplication(applicationId: string | null) {
    setSelectedId(applicationId);
    onApplicationSelectionChange?.(applicationId);
  }

  const manager = data.employees.find((employee) =>
    employee.status === "Active" && employee.email.trim().toLowerCase() === (meta?.userEmail ?? "").trim().toLowerCase()
  );
  const directReports = data.employees.filter((employee) => employee.managerId === manager?.id);
  const directReportIds = new Set(directReports.map((employee) => employee.id));
  const queue = data.applications
    .filter((application) => directReportIds.has(application.employeeId) && reviewableManagerStatuses.includes(application.status))
    .sort((a, b) => {
      const statusRank = reviewableManagerStatuses.indexOf(a.status) - reviewableManagerStatuses.indexOf(b.status);
      return statusRank || a.submittedAt.localeCompare(b.submittedAt);
    });
  const supportCount = data.applications.filter((application) =>
    directReportIds.has(application.employeeId) && application.status === "More information requested"
  ).length;
  const selectedApplication = selectedId ? queue.find((application) => application.id === selectedId) ?? null : null;
  const selectionFailed = Boolean(selectedId && !selectedApplication);

  return (
    <div className="grid min-w-0 gap-5">
      <OperationalMetricRail items={[
        { label: "Awaiting review", value: queue.length, tone: queue.length ? "watch" : "healthy" },
        { label: "Returned to employee", value: supportCount, tone: supportCount ? "watch" : "healthy" },
        { label: "Direct reports", value: directReports.length },
      ]} />

      <MvpPanel title="Approvals" eyebrow="Line manager review">
        {selectionFailed ? (
          <div role="alert" className="mb-4 rounded-xl border border-[#bf4159]/[0.12] bg-[#fff4f5] px-4 py-3 text-sm leading-6 text-[#9d344b]">
            This application could not be opened. Refresh the page and try again.
          </div>
        ) : null}
        {queue.length ? (
          <div className="grid gap-3">
            {queue.map((application) => {
              const employee = data.employees.find((item) => item.id === application.employeeId);
              const standard = getApprenticeshipStandard(application.apprenticeshipStandardId);
              return (
                <article key={application.id} className="rounded-xl border border-[#102c3d]/[0.07] bg-white p-4 shadow-[0_14px_32px_rgba(16,44,61,0.035)]">
                  <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-semibold text-[#102c3d]">{displayEmployee(employee)}</h3>
                        <StatusBadge tone={statusTone(application.status)}>{application.status}</StatusBadge>
                      </div>
                      <p className="mt-1 text-sm leading-6 text-[#102c3d]/[0.58]">{employee?.jobTitle || "Role to confirm"} - {employee?.department || "Department to confirm"} - {employee?.site || "Site to confirm"}</p>
                      <p className="mt-3 text-sm font-semibold text-[#102c3d]">{standard?.title ?? application.apprenticeshipStandardId}</p>
                      <p className="mt-1 line-clamp-2 text-sm leading-6 text-[#102c3d]/[0.58]">{application.reason || "No reason recorded yet."}</p>
                      <p className="mt-2 text-xs font-medium text-[#102c3d]/[0.42]">Submitted {application.submittedAt.slice(0, 10)}</p>
                    </div>
                    <div className="flex flex-col items-stretch gap-2">
                      <button type="button" onClick={() => selectApplication(application.id)} className="h-10 rounded-full bg-[#102c3d] px-4 text-xs font-semibold text-white transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#159b8f]/[0.15]">
                        Review application
                      </button>
                      {employee ? <button type="button" onClick={() => onOpenDirectReport?.(employee.id)} className="px-2 py-1 text-xs font-semibold text-[#0b766b] transition hover:text-[#102c3d]">View apprenticeship journey</button> : null}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-[#102c3d]/[0.14] bg-[#f8fbfa] px-5 py-10 text-center">
            <h3 className="text-base font-semibold text-[#102c3d]">No applications awaiting review</h3>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#102c3d]/[0.56]">Applications will appear here only when a direct report has submitted or resubmitted a request for your decision.</p>
          </div>
        )}
      </MvpPanel>

      {selectedApplication ? (
        <ManagerReviewModal
          application={selectedApplication}
          managerName={manager?.name ?? "Line Manager"}
          onClose={() => selectApplication(null)}
          onDecision={(status, note) => updateApplicationStatus(selectedApplication.id, status, note)}
        />
      ) : null}
    </div>
  );
}

function ManagerReviewModal({ application, managerName: reviewerName, onClose, onDecision }: {
  application: MvpApplication;
  managerName: string;
  onClose: () => void;
  onDecision: (status: RequestStatus, note: string) => void;
}) {
  const { data } = useMvpWorkspace();
  const [decision, setDecision] = useState<"approve" | "info" | "decline" | null>(null);
  const [supportReason, setSupportReason] = useState("");
  const [workplaceSupport, setWorkplaceSupport] = useState("");
  const [leadNote, setLeadNote] = useState("");
  const [informationRequest, setInformationRequest] = useState("");
  const [declineReason, setDeclineReason] = useState("");
  const [nextStep, setNextStep] = useState("");
  const [error, setError] = useState("");
  const [confirmation, setConfirmation] = useState("");

  const employee = data.employees.find((item) => item.id === application.employeeId);
  const role = data.roles.find((item) => item.id === employee?.roleId);
  const standard = getApprenticeshipStandard(application.apprenticeshipStandardId);
  const mapping = role?.pathwayMappings.find((item) => item.apprenticeshipStandardId === application.apprenticeshipStandardId);
  const programme = data.providerProgrammes.find((item) =>
    item.linkedStandardId === application.apprenticeshipStandardId || item.linkedStandardIds.includes(application.apprenticeshipStandardId)
  );
  const profile = data.employeeDevelopmentProfiles.find((item) => item.employeeId === application.employeeId);
  const latestHistory = application.history.at(-1);
  const canDecide = reviewableManagerStatuses.includes(application.status);

  function submitDecision(event: FormEvent) {
    event.preventDefault();
    setError("");

    if (decision === "approve") {
      if (!supportReason.trim() || !workplaceSupport.trim()) {
        setError("Please confirm why you support the application and what workplace support the team can provide.");
        return;
      }
      onDecision("Approved by Line Manager", [
        `Manager decision by ${reviewerName}: approved for Apprenticeship Lead review.`,
        `Why supported: ${supportReason.trim()}`,
        `Workplace opportunity or support: ${workplaceSupport.trim()}`,
        leadNote.trim() ? `Notes for Apprenticeship Lead: ${leadNote.trim()}` : "",
      ].filter(Boolean).join("\n"));
      setConfirmation("Application approved and sent to the Apprenticeship Lead for final review.");
      return;
    }

    if (decision === "info") {
      if (!informationRequest.trim()) {
        setError("Please write the information you need from the employee.");
        return;
      }
      onDecision("More information requested", [
        `Manager decision by ${reviewerName}: more information requested.`,
        `Request: ${informationRequest.trim()}`,
      ].join("\n"));
      setConfirmation("The application has been returned to the employee for more information.");
      return;
    }

    if (decision === "decline") {
      if (!declineReason.trim()) {
        setError("Please provide a clear reason for declining the application.");
        return;
      }
      onDecision("Declined by Line Manager", [
        `Manager decision by ${reviewerName}: declined.`,
        `Reason: ${declineReason.trim()}`,
        nextStep.trim() ? `Suggested next step: ${nextStep.trim()}` : "",
        leadNote.trim() ? `Note for Apprenticeship Lead: ${leadNote.trim()}` : "",
      ].filter(Boolean).join("\n"));
      setConfirmation("The application has been declined and the employee will be able to review your feedback.");
      return;
    }

    setError("Choose approve, request more information or decline.");
  }

  return (
    <MvpModal title="Review application" eyebrow="Line manager decision" onClose={onClose} wide>
      <div className="mb-5 border-y border-[#102c3d]/[0.07] py-4"><StageTracker stages={["Employee", "Manager", "Apprenticeship Lead", "Enrolment"]} currentIndex={applicationStage(application.status)} tone={application.status === "More information requested" ? "watch" : "info"} exceptionalStatus={application.status.startsWith("Declined") ? { label: application.status, tone: "risk" } : undefined} /></div>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <div className="grid gap-4">
          <ReviewSection title="Employee">
            <div className="grid gap-3 sm:grid-cols-2">
              <ReviewFact label="Employee" value={displayEmployee(employee)} />
              <ReviewFact label="Current role" value={employee?.jobTitle || "Role to confirm"} />
              <ReviewFact label="Team" value={employee?.department || "Department to confirm"} />
              <ReviewFact label="Site" value={employee?.site || "Site to confirm"} />
              <ReviewFact label="Manager" value={employee ? managerName(data, employee) : "Manager to confirm"} />
              <ReviewFact label="Development status" value={profile?.stage === "recommendation_ready" ? "Recommendation ready" : "Discovery in progress"} />
            </div>
          </ReviewSection>

          <ReviewSection title="Programme">
            <h3 className="text-lg font-semibold text-[#102c3d]">{programme?.programmeName ?? standard?.title ?? application.apprenticeshipStandardId}</h3>
            <p className="mt-2 text-sm leading-6 text-[#102c3d]/[0.58]">{programme?.shortDescription || standard?.overview || "Programme summary will be confirmed by the Apprenticeship Lead."}</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <ReviewFact label="Provider" value={data.providers.find((provider) => provider.providerId === programme?.providerId)?.providerName ?? "Provider to confirm"} />
              <ReviewFact label="Duration" value={programme?.duration || standard?.typicalDuration || "Duration to confirm"} />
              <ReviewFact label="Delivery model" value={programme?.deliveryModels[0] || "Delivery to confirm"} />
              <ReviewFact label="Time commitment" value="Manager to confirm protected learning time" />
            </div>
            <details className="mt-4 rounded-xl border border-[#102c3d]/[0.07] bg-white">
              <summary className="cursor-pointer list-none px-4 py-3 text-xs font-semibold text-[#102c3d]/[0.62]">Funding and standard details</summary>
              <div className="border-t border-[#102c3d]/[0.06] px-4 py-3 text-sm leading-6 text-[#102c3d]/[0.58]">
                <p>{standard ? `Level ${standard.level} - ${standard.title} - ${standard.referenceCode}` : application.apprenticeshipStandardId}</p>
                <p>{mapping?.fundingRoute ?? programme?.fundingRoute ?? "Potential funding route to confirm"}</p>
              </div>
            </details>
          </ReviewSection>

          <ReviewSection title="Why this may fit">
            <p className="text-sm leading-6 text-[#102c3d]/[0.62]">
              LevyTate identified a credible alignment between the {employee?.jobTitle || "current role"} responsibilities held by {employee?.name ?? "the employee"} and {standard?.title ?? "the selected programme"}. The manager should still confirm workload, role relevance and available support before approving.
            </p>
            <div className="mt-4 grid gap-3">
              <EvidenceItem label="Role relevance" value={mapping?.businessRationale || `${employee?.jobTitle || "The role"} has responsibilities that can generate workplace evidence for this route.`} />
              <EvidenceItem label="Employee development goal" value={application.careerGoal || "Career goal not yet captured."} />
              <EvidenceItem label="Business benefit" value={programme?.expectedOutcomes[0] || "Improved capability should be evidenced through current team priorities."} />
              <EvidenceItem label="Uncertainty to check" value="Confirm workload, evidence opportunities and protected learning support before deciding." />
            </div>
          </ReviewSection>
        </div>

        <div className="grid gap-4">
          <ReviewSection title="Employee answers">
            <div className="grid gap-3">
              <AnswerBlock question="Why are you interested?" answer={application.reason} />
              <AnswerBlock question="How could it help your current role or future development?" answer={application.careerGoal} />
              <AnswerBlock question="What support will you need?" answer={application.supportRequired} />
              <AnswerBlock question="Is there anything your manager should know?" answer={application.managerNote} />
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <ReviewFact label="Submitted" value={application.submittedAt.slice(0, 10)} />
              <ReviewFact label="Version" value="Submitted version 1" />
              <ReviewFact label="Latest update" value={latestHistory?.createdAt.slice(0, 10) ?? application.updatedAt.slice(0, 10)} />
            </div>
          </ReviewSection>

          <ReviewSection title="Manager considerations">
            <ul className="grid gap-2 text-sm leading-6 text-[#102c3d]/[0.62]">
              {[
                "Is the programme relevant to the employee's current or planned role?",
                "Can the learning be applied in the workplace?",
                "Can the team support the time commitment?",
                "Is the employee ready to participate?",
                "Is further information needed?",
                "Is there a clear employee and business benefit?",
              ].map((item) => <li key={item} className="rounded-lg bg-[#f8fbfa] px-3 py-2 ring-1 ring-[#102c3d]/[0.05]">{item}</li>)}
            </ul>
          </ReviewSection>

          <ReviewSection title="Decision">
            {confirmation ? (
              <div className="rounded-xl bg-[#edf7f3] p-4 text-sm font-semibold leading-6 text-[#0b6f63] ring-1 ring-[#159b8f]/[0.15]">{confirmation}</div>
            ) : null}
            {!confirmation && canDecide ? (
              <form onSubmit={submitDecision}>
                <div className="grid gap-2 sm:grid-cols-3">
                  <DecisionButton active={decision === "approve"} onClick={() => setDecision("approve")}>Approve</DecisionButton>
                  <DecisionButton active={decision === "info"} onClick={() => setDecision("info")}>Request more information</DecisionButton>
                  <DecisionButton active={decision === "decline"} onClick={() => setDecision("decline")} danger>Decline</DecisionButton>
                </div>

                {decision === "approve" ? (
                  <div className="mt-4 grid gap-3">
                    <FormTextArea label="Why do you support this application?" value={supportReason} onChange={setSupportReason} required />
                    <FormTextArea label="What workplace opportunity or support can the team provide?" value={workplaceSupport} onChange={setWorkplaceSupport} required />
                    <FormTextArea label="Any notes for the Apprenticeship Lead?" value={leadNote} onChange={setLeadNote} />
                  </div>
                ) : null}

                {decision === "info" ? (
                  <div className="mt-4">
                    <FormTextArea label="What information do you need from the employee?" value={informationRequest} onChange={setInformationRequest} required rows={4} />
                  </div>
                ) : null}

                {decision === "decline" ? (
                  <div className="mt-4 grid gap-3">
                    <FormTextArea label="Clear reason for declining" value={declineReason} onChange={setDeclineReason} required />
                    <FormTextArea label="Suggested next step" value={nextStep} onChange={setNextStep} />
                    <FormTextArea label="Optional note for the Apprenticeship Lead" value={leadNote} onChange={setLeadNote} />
                  </div>
                ) : null}

                <div className="mt-4 flex flex-col gap-3 border-t border-[#102c3d]/[0.07] pt-4 sm:flex-row sm:items-center sm:justify-between">
                  {error ? <p className="text-xs font-semibold text-[#b53c52]">{error}</p> : <p className="text-xs leading-5 text-[#102c3d]/[0.48]">Your decision will be recorded in the application history.</p>}
                  <button className="h-10 rounded-full bg-[#102c3d] px-5 text-xs font-semibold text-white">Confirm decision</button>
                </div>
              </form>
            ) : null}
            {!canDecide && !confirmation ? <p className="text-sm leading-6 text-[#102c3d]/[0.56]">This application is no longer awaiting a line manager decision.</p> : null}
          </ReviewSection>

          <ReviewSection title="Application history">
            <div className="grid gap-3">
              {application.history.map((entry) => (
                <div key={entry.id} className="rounded-xl bg-[#f8fbfa] px-4 py-3 ring-1 ring-[#102c3d]/[0.06]">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-[#102c3d]">{entry.status}</p>
                      <p className="mt-1 whitespace-pre-line text-xs leading-5 text-[#102c3d]/[0.54]">{entry.note}</p>
                    </div>
                    <span className="text-xs font-semibold text-[#102c3d]/[0.52]">{entry.owner}</span>
                  </div>
                  <p className="mt-2 text-[11px] font-medium text-[#102c3d]/[0.42]">{entry.createdAt.slice(0, 10)}</p>
                </div>
              ))}
            </div>
          </ReviewSection>
        </div>
      </div>
    </MvpModal>
  );
}

function ReviewSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-[#102c3d]/[0.07] bg-[#fbfcfb] p-4">
      <h3 className="text-sm font-semibold text-[#102c3d]">{title}</h3>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function ReviewFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white px-3.5 py-3 ring-1 ring-[#102c3d]/[0.055]">
      <p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-[#102c3d]/[0.38]">{label}</p>
      <p className="mt-1 line-clamp-2 text-sm font-semibold text-[#102c3d]/[0.72]">{value}</p>
    </div>
  );
}

function EvidenceItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white px-4 py-3 ring-1 ring-[#102c3d]/[0.06]">
      <p className="text-xs font-semibold text-[#102c3d]">{label}</p>
      <p className="mt-1 text-sm leading-6 text-[#102c3d]/[0.58]">{value}</p>
    </div>
  );
}

function AnswerBlock({ question, answer }: { question: string; answer: string }) {
  return (
    <div className="rounded-xl bg-white px-4 py-3 ring-1 ring-[#102c3d]/[0.06]">
      <p className="text-xs font-semibold text-[#102c3d]">{question}</p>
      <p className="mt-1 text-sm leading-6 text-[#102c3d]/[0.58]">{answer || "No answer recorded yet."}</p>
    </div>
  );
}

function DecisionButton({ active, onClick, danger = false, children }: { active: boolean; onClick: () => void; danger?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-10 rounded-xl px-3 py-2 text-xs font-semibold ring-1 transition ${active
        ? danger
          ? "bg-[#fff0f2] text-[#b13b51] ring-[#b13b51]/[0.20]"
          : "bg-[#102c3d] text-white ring-[#102c3d]"
        : "bg-white text-[#102c3d]/[0.64] ring-[#102c3d]/[0.08] hover:text-[#102c3d]"}`}
    >
      {children}
    </button>
  );
}

function ApplicationDetailModal({ application, onClose }: { application: MvpApplication; onClose: () => void }) {
  const { data } = useMvpWorkspace();
  const employee = data.employees.find((item) => item.id === application.employeeId);
  const standard = getApprenticeshipStandard(application.apprenticeshipStandardId);

  return (
    <MvpModal title={displayEmployee(employee)} eyebrow="Application record" onClose={onClose} wide>
      <div className="mb-5 border-y border-[#102c3d]/[0.07] py-4"><StageTracker stages={["Employee", "Manager", "Apprenticeship Lead", "Enrolment"]} currentIndex={applicationStage(application.status)} tone={application.status === "More information requested" ? "watch" : "info"} exceptionalStatus={application.status.startsWith("Declined") || application.status === "Withdrawn" || application.status === "Cancelled" ? { label: application.status, tone: "risk" } : undefined} /></div>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className="space-y-4 rounded-xl border border-[#102c3d]/[0.07] bg-[#f8fbfa] p-4">
          <section>
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#c95568]">Application summary</p>
            <h3 className="mt-1 text-lg font-semibold text-[#102c3d]">{standard?.title ?? application.apprenticeshipStandardId}</h3>
            <p className="mt-2 text-sm leading-6 text-[#102c3d]/[0.56]">{employee?.jobTitle || "Role to confirm"} · {employee?.department || "Department to confirm"} · {employee?.site || "Site to confirm"}</p>
          </section>
          <section>
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#0b6f63]">Workflow status</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <StatusBadge tone={statusTone(application.status)}>{application.status}</StatusBadge>
              <span className="inline-flex items-center text-xs font-semibold text-[#102c3d]/[0.52]">Owner: {application.currentOwner}</span>
            </div>
            <p className="mt-3 text-xs leading-5 text-[#102c3d]/[0.54]">Submitted {application.submittedAt.slice(0, 10)}</p>
          </section>
          <section>
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#0b6f63]">Business case</p>
            <div className="mt-2 space-y-3 rounded-xl bg-white p-4 ring-1 ring-[#102c3d]/[0.06]">
              <div>
                <p className="text-xs font-semibold text-[#102c3d]">Reason for interest</p>
                <p className="mt-1 text-sm leading-6 text-[#102c3d]/[0.60]">{application.reason || "No reason recorded yet."}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-[#102c3d]">Career goal</p>
                <p className="mt-1 text-sm leading-6 text-[#102c3d]/[0.60]">{application.careerGoal || "No career goal recorded yet."}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-[#102c3d]">Support required</p>
                <p className="mt-1 text-sm leading-6 text-[#102c3d]/[0.60]">{application.supportRequired || "No support needs recorded."}</p>
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
                    <p className="mt-1 text-xs leading-5 text-[#102c3d]/[0.54]">{entry.note}</p>
                  </div>
                  <span className="text-xs font-semibold text-[#102c3d]/[0.52]">{entry.owner}</span>
                </div>
                <p className="mt-2 text-[11px] font-medium text-[#102c3d]/[0.42]">{entry.createdAt.slice(0, 10)}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </MvpModal>
  );
}

function applicationStage(status: RequestStatus) {
  if (["Approved for Enrolment", "Completed"].includes(status)) return 3;
  if (["Approved by Line Manager", "Submitted to Apprenticeship Lead", "Awaiting Final Approval", "Declined by Apprenticeship Lead"].includes(status)) return 2;
  if (["Submitted to Line Manager", "Awaiting Manager Review", "More information requested", "Declined by Line Manager"].includes(status)) return 1;
  return 0;
}
