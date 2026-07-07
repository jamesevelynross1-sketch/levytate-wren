"use client";

import { ChevronDown, Sparkles, UserPlus } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import {
  EmptyState,
  FormActions,
  FormField,
  FormGrid,
  FormSelect,
  MvpModal,
  MvpPanel,
  MvpToolbar,
  StatusBadge,
  TableAction,
} from "@/components/levytate-mvp/MvpUi";
import { useMvpWorkspace } from "@/components/levytate-mvp/MvpWorkspaceStore";
import { includesSearch, statusTone } from "@/components/levytate-mvp/module-utils";
import { getApprenticeshipStandard } from "@/lib/levytate/domain";
import {
  employeeCurrentApplication,
  employeeDevelopmentInterests,
  employeeRecommendedPathway,
  managerName,
} from "@/lib/levytate/mvp/workspace-insights";
import {
  activeApplicationStatuses,
  createMvpId,
  nowIso,
  todayIso,
  type MvpEmployee,
} from "@/lib/levytate/mvp/workspace";

export function EmployeesModule({ onStartDiscovery }: { onStartDiscovery?: (employeeId: string) => void }) {
  const { data, saveEmployee, archiveEmployee } = useMvpWorkspace();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("Active");
  const [departmentFilter, setDepartmentFilter] = useState("All");
  const [managerFilter, setManagerFilter] = useState("All");
  const [siteFilter, setSiteFilter] = useState("All");
  const [applicationFilter, setApplicationFilter] = useState("All");
  const [draft, setDraft] = useState<MvpEmployee | null>(null);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const departments = useMemo(
    () => [...new Set(data.employees.map((employee) => employee.department).filter(Boolean))].sort(),
    [data.employees],
  );
  const sites = useMemo(
    () => [...new Set(data.employees.map((employee) => employee.site).filter(Boolean))].sort(),
    [data.employees],
  );
  const managers = useMemo(
    () => data.employees.filter((employee) => employee.status === "Active" && employee.platformRole === "Line Manager"),
    [data.employees],
  );
  const applicationStatuses = useMemo(
    () => ["No active application", ...activeApplicationStatuses()],
    [],
  );

  const visible = data.employees.filter((employee) => {
    const application = employeeCurrentApplication(data, employee.id);
    return (status === "All" || employee.status === status)
      && (departmentFilter === "All" || employee.department === departmentFilter)
      && (managerFilter === "All" || employee.managerId === managerFilter)
      && (siteFilter === "All" || employee.site === siteFilter)
      && (applicationFilter === "All" || (applicationFilter === "No active application" ? !application : application?.status === applicationFilter))
      && includesSearch(
        [employee.name, employee.email, employee.employeeNumber, employee.jobTitle, employee.department, employee.site, managerName(data, employee)],
        search,
      );
  });

  const selectedEmployee = selectedEmployeeId
    ? data.employees.find((employee) => employee.id === selectedEmployeeId) ?? null
    : null;
  const selectedEmployeeApplications = selectedEmployee
    ? data.applications.filter((application) => application.employeeId === selectedEmployee.id)
    : [];
  const selectedProfile = selectedEmployee
    ? data.employeeDevelopmentProfiles.find((item) => item.employeeId === selectedEmployee.id) ?? null
    : null;
  const selectedRecommendation = selectedEmployee
    ? employeeRecommendedPathway(data, selectedEmployee.id)
    : null;
  const selectedCurrentApplication = selectedEmployee
    ? employeeCurrentApplication(data, selectedEmployee.id)
    : null;

  function blankEmployee(): MvpEmployee {
    const now = nowIso();
    return {
      id: createMvpId("employee"),
      employeeNumber: `EMP-${String(data.employees.length + 1).padStart(4, "0")}`,
      name: "",
      email: "",
      jobTitle: "",
      roleId: "",
      managerId: "",
      department: "",
      site: "",
      platformRole: "Employee",
      status: "Active",
      startDate: todayIso(),
      createdAt: now,
      updatedAt: now,
    };
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!draft) return;
    if (!draft.name.trim() || !draft.jobTitle.trim() || !draft.department.trim()) {
      setError("Name, job title and department are required.");
      return;
    }

    const isNew = !data.employees.some((item) => item.id === draft.id);
    const matchedRole = data.roles.find(
      (role) => role.status === "Active" && role.title.trim().toLowerCase() === draft.jobTitle.trim().toLowerCase(),
    );

    const employee = {
      ...draft,
      name: draft.name.trim(),
      jobTitle: draft.jobTitle.trim(),
      department: draft.department.trim(),
      email: draft.email.trim(),
      roleId: draft.roleId || matchedRole?.id || "",
      updatedAt: nowIso(),
    };

    saveEmployee(employee);
    setDraft(null);
    setError("");
    if (isNew) onStartDiscovery?.(employee.id);
  }

  function openEmployee(employee?: MvpEmployee) {
    setError("");
    setDraft(employee ? { ...employee } : blankEmployee());
  }

  return (
    <MvpPanel title="Employees" eyebrow="Workforce records">
      <MvpToolbar
        search={search}
        onSearch={setSearch}
        placeholder="Search name, role, department, manager or site"
        actionLabel="Add employee"
        onAction={() => openEmployee()}
        filters={
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            <select value={status} onChange={(event) => setStatus(event.target.value)} className="h-10 rounded-lg border border-[#102c3d]/[0.09] bg-white px-3 text-sm font-semibold text-[#102c3d]/66"><option>Active</option><option>Archived</option><option>All</option></select>
            <select value={departmentFilter} onChange={(event) => setDepartmentFilter(event.target.value)} className="h-10 rounded-lg border border-[#102c3d]/[0.09] bg-white px-3 text-sm font-semibold text-[#102c3d]/66"><option>All</option>{departments.map((department) => <option key={department}>{department}</option>)}</select>
            <details className="group rounded-lg border border-[#102c3d]/[0.09] bg-white">
              <summary className="flex h-10 cursor-pointer list-none items-center justify-between gap-2 px-3 text-sm font-semibold text-[#102c3d]/66">
                More filters
                <ChevronDown size={15} className="transition group-open:rotate-180" aria-hidden="true" />
              </summary>
              <div className="grid gap-2 border-t border-[#102c3d]/[0.06] p-2">
                <select value={managerFilter} onChange={(event) => setManagerFilter(event.target.value)} className="h-10 rounded-lg border border-[#102c3d]/[0.09] bg-white px-3 text-sm font-semibold text-[#102c3d]/66"><option value="All">All managers</option>{managers.map((manager) => <option key={manager.id} value={manager.id}>{manager.name}</option>)}</select>
                <select value={siteFilter} onChange={(event) => setSiteFilter(event.target.value)} className="h-10 rounded-lg border border-[#102c3d]/[0.09] bg-white px-3 text-sm font-semibold text-[#102c3d]/66"><option value="All">All sites</option>{sites.map((site) => <option key={site}>{site}</option>)}</select>
                <select value={applicationFilter} onChange={(event) => setApplicationFilter(event.target.value)} className="h-10 rounded-lg border border-[#102c3d]/[0.09] bg-white px-3 text-sm font-semibold text-[#102c3d]/66"><option value="All">All applications</option>{applicationStatuses.map((statusOption) => <option key={statusOption}>{statusOption}</option>)}</select>
              </div>
            </details>
          </div>
        }
      />

      {visible.length ? (
        <div className="grid gap-4 xl:grid-cols-2">
          {visible.map((employee) => {
            const role = data.roles.find((item) => item.id === employee.roleId);
            const application = employeeCurrentApplication(data, employee.id);
            const profile = data.employeeDevelopmentProfiles.find((item) => item.employeeId === employee.id);
            const recommendation = employeeRecommendedPathway(data, employee.id);
            const statusLabel = recommendation
              ? "Recommendation ready"
              : profile
                ? "Discovery in progress"
                : "Needs discovery";
            const primaryAction = application
              ? "Review"
              : recommendation
                ? "Continue"
                : "Start AI";

            return (
              <article key={employee.id} className="rounded-2xl border border-[#102c3d]/[0.07] bg-white p-4 shadow-[0_14px_32px_rgba(16,44,61,0.04)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_42px_rgba(16,44,61,0.07)]">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="truncate text-base font-semibold text-[#102c3d]">{employee.name}</p>
                    <p className="mt-1 text-sm leading-6 text-[#102c3d]/58">{employee.jobTitle || role?.title || "Role to confirm"}</p>
                  </div>
                  <StatusBadge tone={application ? statusTone(application.status) : recommendation ? "green" : profile ? "yellow" : "neutral"}>
                    {application?.status ?? statusLabel}
                  </StatusBadge>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <DecisionFact label="Manager" value={managerName(data, employee)} />
                  <DecisionFact label="Team" value={employee.department || "Department to confirm"} />
                  <DecisionFact label="Development status" value={statusLabel} />
                  <DecisionFact label="AI confidence" value={recommendation ? "High" : profile ? "Building" : "Not started"} />
                </div>

                {recommendation ? (
                  <div className="mt-4 rounded-xl bg-[#f8fbfa] px-4 py-3 ring-1 ring-[#102c3d]/[0.055]">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#0b6f63]">Leading route</p>
                    <p className="mt-1 text-sm font-semibold text-[#102c3d]">{recommendation.title}</p>
                  </div>
                ) : null}

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#102c3d]/[0.06] pt-4">
                  <button type="button" onClick={() => application ? setSelectedEmployeeId(employee.id) : onStartDiscovery?.(employee.id)} className="rounded-full bg-[#102c3d] px-4 py-2 text-xs font-semibold text-white transition hover:-translate-y-0.5">
                    {primaryAction}
                  </button>
                  <button type="button" onClick={() => setSelectedEmployeeId(employee.id)} className="rounded-full bg-[#f5f7f3] px-4 py-2 text-xs font-semibold text-[#102c3d]/62 ring-1 ring-[#102c3d]/[0.07] transition hover:text-[#102c3d]">
                    Details
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <EmptyState
          title="Add the first employee"
          copy="Create one record. LevyTate will guide discovery and recommend the next development route."
          actionLabel="Add employee"
          onAction={() => openEmployee()}
        />
      )}

      {draft ? (
        <MvpModal title={data.employees.some((item) => item.id === draft.id) ? "Edit employee" : "Add employee"} onClose={() => setDraft(null)}>
          <form onSubmit={submit}>
            <div className="mb-5 flex items-start gap-3 rounded-xl bg-[#edf7f3] p-4 ring-1 ring-[#159b8f]/10">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white text-[#0b8e82]"><UserPlus size={17} aria-hidden="true" /></span>
              <div>
                <p className="text-sm font-semibold">Start with the essentials</p>
                <p className="mt-1 text-xs leading-5 text-[#102c3d]/54">After saving, Ask LevyTate AI will guide the role and capability conversation before any application begins.</p>
              </div>
            </div>

            <FormGrid>
              <FormField label="Employee name" value={draft.name} onChange={(value) => setDraft({ ...draft, name: value })} required />
              <FormField label="Job title" value={draft.jobTitle} onChange={(value) => setDraft({ ...draft, jobTitle: value })} required />
              <FormField label="Department" value={draft.department} onChange={(value) => setDraft({ ...draft, department: value })} required />
              <FormSelect label="Line manager" value={draft.managerId} onChange={(value) => setDraft({ ...draft, managerId: value })} options={[{ value: "", label: data.employees.length ? "Assign later" : "Add managers as employee records" }, ...data.employees.filter((employee) => employee.id !== draft.id && employee.status === "Active").map((employee) => ({ value: employee.id, label: employee.name }))]} />
              <FormField label="Site" value={draft.site} onChange={(value) => setDraft({ ...draft, site: value })} wide />
            </FormGrid>

            <details className="group mt-5 rounded-xl border border-[#102c3d]/[0.07] bg-[#f8fbfa]">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-xs font-semibold text-[#102c3d]/58">
                Additional record details
                <ChevronDown size={16} className="transition group-open:rotate-180" aria-hidden="true" />
              </summary>
              <div className="border-t border-[#102c3d]/[0.07] p-4">
                <FormGrid>
                  <FormField label="Email" type="email" value={draft.email} onChange={(value) => setDraft({ ...draft, email: value })} />
                  <FormField label="Employee number" value={draft.employeeNumber} onChange={(value) => setDraft({ ...draft, employeeNumber: value })} />
                  <FormSelect label="Assigned role library record" value={draft.roleId} onChange={(value) => {
                    const role = data.roles.find((item) => item.id === value);
                    setDraft({ ...draft, roleId: value, jobTitle: role?.title ?? draft.jobTitle });
                  }} options={[{ value: "", label: "Match later" }, ...data.roles.filter((role) => role.status === "Active").map((role) => ({ value: role.id, label: role.title }))]} />
                  <FormSelect label="Platform role" value={draft.platformRole} onChange={(value) => setDraft({ ...draft, platformRole: value as MvpEmployee["platformRole"] })} options={["Employee", "Line Manager", "Department Head", "Apprenticeship Lead"]} />
                  <FormField label="Start date" type="date" value={draft.startDate} onChange={(value) => setDraft({ ...draft, startDate: value })} wide />
                </FormGrid>
              </div>
            </details>

            <FormActions onCancel={() => setDraft(null)} label="Save employee" error={error} />
          </form>
        </MvpModal>
      ) : null}

      {selectedEmployee ? (
        <MvpModal title={selectedEmployee.name} eyebrow="Employee apprenticeship record" onClose={() => setSelectedEmployeeId(null)} wide>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[#f8fbfa] px-4 py-3 ring-1 ring-[#102c3d]/[0.055]">
            <p className="text-sm leading-6 text-[#102c3d]/58">Keep the record simple. Use AI for discovery, then open details only when needed.</p>
            <div className="flex flex-wrap gap-2">
              <TableAction onClick={() => onStartDiscovery?.(selectedEmployee.id)}>Ask AI</TableAction>
              <TableAction onClick={() => openEmployee(selectedEmployee)}>Edit</TableAction>
              <TableAction onClick={() => archiveEmployee(selectedEmployee.id)} danger={selectedEmployee.status === "Active"}>
                {selectedEmployee.status === "Archived" ? "Restore" : "Archive"}
              </TableAction>
            </div>
          </div>
          <div className="grid gap-5 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
            <div className="space-y-4 rounded-xl border border-[#102c3d]/[0.07] bg-[#f8fbfa] p-4">
              <section>
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#c95568]">Current profile</p>
                <h3 className="mt-1 text-lg font-semibold text-[#102c3d]">{selectedEmployee.jobTitle || "Role to confirm"}</h3>
                <p className="mt-2 text-sm leading-6 text-[#102c3d]/56">{selectedEmployee.department || "Department to confirm"} · {selectedEmployee.site || "Site to confirm"}</p>
                <p className="mt-2 text-sm leading-6 text-[#102c3d]/56">Manager: {managerName(data, selectedEmployee)}</p>
              </section>

              <section>
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#0b6f63]">Current status</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <StatusBadge tone={selectedCurrentApplication ? statusTone(selectedCurrentApplication.status) : "neutral"}>
                    {selectedCurrentApplication?.status ?? "No active application"}
                  </StatusBadge>
                  {selectedProfile ? (
                    <StatusBadge tone={selectedProfile.stage === "recommendation_ready" ? "green" : "yellow"}>
                      {selectedProfile.stage === "recommendation_ready" ? "Recommendation ready" : "Discovery in progress"}
                    </StatusBadge>
                  ) : null}
                </div>
              </section>

              <section>
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#0b6f63]">Development interests</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {employeeDevelopmentInterests(data, selectedEmployee.id).length ? employeeDevelopmentInterests(data, selectedEmployee.id).map((interest) => (
                    <span key={interest} className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-[#102c3d]/68 ring-1 ring-[#102c3d]/[0.08]">{interest}</span>
                  )) : <p className="text-sm text-[#102c3d]/54">No interests captured yet.</p>}
                </div>
              </section>

              <section>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#0b6f63]">Recommended pathway</p>
                    <p className="mt-1 text-xs text-[#102c3d]/48">Sourced from the employee conversation and role library.</p>
                  </div>
                  <button type="button" onClick={() => onStartDiscovery?.(selectedEmployee.id)} className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-[11px] font-semibold text-[#0b6f63] ring-1 ring-[#102c3d]/[0.08]">
                    <Sparkles size={12} aria-hidden="true" />
                    Ask AI
                  </button>
                </div>
                {selectedRecommendation ? (
                  <div className="mt-2 rounded-xl bg-white px-4 py-3 ring-1 ring-[#102c3d]/[0.07]">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-[#102c3d]">{selectedRecommendation.title}</p>
                        <p className="mt-1 text-xs leading-5 text-[#102c3d]/56">{selectedRecommendation.rationale}</p>
                      </div>
                      <StatusBadge tone="green">{selectedRecommendation.fitScore}% fit</StatusBadge>
                    </div>
                  </div>
                ) : <p className="mt-2 text-sm text-[#102c3d]/54">LevyTate will show the leading recommendation once discovery is complete.</p>}
              </section>
            </div>

            <div className="space-y-5">
              <section className="rounded-xl border border-[#102c3d]/[0.07] bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#c95568]">Application history</p>
                    <p className="mt-1 text-sm text-[#102c3d]/54">Every workflow step is kept on the employee record.</p>
                  </div>
                  <TableAction onClick={() => onStartDiscovery?.(selectedEmployee.id)}>Ask AI</TableAction>
                </div>
                <div className="mt-4 grid gap-3">
                  {selectedEmployeeApplications.length ? selectedEmployeeApplications.map((application) => (
                    <div key={application.id} className="rounded-xl bg-[#f8fbfa] px-4 py-3 ring-1 ring-[#102c3d]/[0.06]">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-[#102c3d]">{applicationLabel(application.apprenticeshipStandardId)}</p>
                          <p className="mt-1 text-xs leading-5 text-[#102c3d]/54">{application.reason || "No reason recorded yet."}</p>
                        </div>
                        <StatusBadge tone={statusTone(application.status)}>{application.status}</StatusBadge>
                      </div>
                      <div className="mt-3 space-y-2">
                        {application.history.map((entry) => (
                          <div key={entry.id} className="rounded-lg bg-white px-3 py-2 text-xs text-[#102c3d]/62 ring-1 ring-[#102c3d]/[0.05]">
                            <div className="flex items-center justify-between gap-3">
                              <p className="font-semibold text-[#102c3d]">{entry.status}</p>
                              <span className="text-[#102c3d]/42">{entry.owner}</span>
                            </div>
                            <p className="mt-1">{entry.note}</p>
                            <p className="mt-1 text-[#102c3d]/42">{entry.createdAt.slice(0, 10)}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )) : <p className="text-sm text-[#102c3d]/54">No applications created yet for this employee.</p>}
                </div>
              </section>

              <section className="rounded-xl border border-[#102c3d]/[0.07] bg-white p-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#0b6f63]">Conversation history</p>
                <div className="mt-4 grid gap-3">
                  {selectedProfile?.conversationHistory.length ? selectedProfile.conversationHistory.slice(-6).map((message, index) => (
                    <div key={`${message.role}-${index}`} className={`rounded-xl px-4 py-3 text-sm leading-6 ${message.role === "user" ? "bg-[#102c3d] text-white" : "bg-[#f8fbfa] text-[#102c3d]/68 ring-1 ring-[#102c3d]/[0.06]"}`}>
                      {message.content}
                    </div>
                  )) : <p className="text-sm text-[#102c3d]/54">Conversation history will appear after guided discovery begins.</p>}
                </div>
              </section>
            </div>
          </div>
        </MvpModal>
      ) : null}
    </MvpPanel>
  );
}

function DecisionFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-[#f8fbfa] px-3.5 py-3 ring-1 ring-[#102c3d]/[0.055]">
      <p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-[#102c3d]/38">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold text-[#102c3d]/72">{value}</p>
    </div>
  );
}

function applicationLabel(standardId: string) {
  return getApprenticeshipStandard(standardId)?.title ?? standardId;
}
