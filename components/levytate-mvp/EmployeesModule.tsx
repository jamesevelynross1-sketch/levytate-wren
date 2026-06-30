"use client";

import { ChevronDown, UserPlus } from "lucide-react";
import { useState, type FormEvent } from "react";
import { EmptyState, FormActions, FormField, FormGrid, FormSelect, MvpModal, MvpPanel, MvpToolbar, StatusBadge, TableAction, TableBody, TableHead, TableShell } from "@/components/levytate-mvp/MvpUi";
import { useMvpWorkspace } from "@/components/levytate-mvp/MvpWorkspaceStore";
import { includesSearch, statusTone } from "@/components/levytate-mvp/module-utils";
import { activeApplicationStatuses, createMvpId, nowIso, todayIso, type MvpEmployee } from "@/lib/levytate/mvp/workspace";

export function EmployeesModule({ onStartDiscovery }: { onStartDiscovery?: (employeeId: string) => void }) {
  const { data, saveEmployee, archiveEmployee } = useMvpWorkspace();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("Active");
  const [draft, setDraft] = useState<MvpEmployee | null>(null);
  const [error, setError] = useState("");
  const visible = data.employees.filter((employee) =>
    (status === "All" || employee.status === status) &&
    includesSearch([employee.name, employee.email, employee.employeeNumber, employee.jobTitle, employee.department, employee.site], search),
  );

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
    const matchedRole = data.roles.find((role) =>
      role.status === "Active" && role.title.trim().toLowerCase() === draft.jobTitle.trim().toLowerCase(),
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
        placeholder="Search name, role, department or site"
        actionLabel="Add employee"
        onAction={() => openEmployee()}
        filters={
          <select value={status} onChange={(event) => setStatus(event.target.value)} className="h-10 rounded-lg border border-[#102c3d]/[0.09] bg-white px-3 text-sm font-semibold text-[#102c3d]/66">
            <option>Active</option><option>Archived</option><option>All</option>
          </select>
        }
      />

      {visible.length ? (
        <TableShell>
          <TableHead><tr><th className="px-4 py-3">Employee</th><th className="px-4 py-3">Role</th><th className="px-4 py-3">Department</th><th className="px-4 py-3">Site</th><th className="px-4 py-3">Application</th><th className="px-4 py-3 text-right">Actions</th></tr></TableHead>
          <TableBody>
            {visible.map((employee) => {
              const role = data.roles.find((item) => item.id === employee.roleId);
              const application = data.applications.find((item) => item.employeeId === employee.id && activeApplicationStatuses().includes(item.status));
              const discovery = data.employeeDevelopmentProfiles.find((item) => item.employeeId === employee.id);
              return (
                <tr key={employee.id}>
                  <td className="px-4 py-3">
                    <p className="font-semibold">{employee.name}</p>
                    <p className="mt-0.5 text-xs text-[#102c3d]/48">{employee.email || employee.employeeNumber}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-[#102c3d]/68">{employee.jobTitle || role?.title || "Not set"}</p>
                    {discovery ? <p className="mt-0.5 text-xs font-semibold text-[#0b6f63]">{discovery.stage === "recommendation_ready" ? "Profile ready" : "Discovery in progress"}</p> : null}
                  </td>
                  <td className="px-4 py-3 text-[#102c3d]/62">{employee.department || "Not set"}</td>
                  <td className="px-4 py-3 text-[#102c3d]/62">{employee.site || "Not set"}</td>
                  <td className="px-4 py-3"><StatusBadge tone={application ? statusTone(application.status) : "neutral"}>{application?.status ?? "No active application"}</StatusBadge></td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <TableAction onClick={() => onStartDiscovery?.(employee.id)}>Ask AI</TableAction>
                      <TableAction onClick={() => openEmployee(employee)}>Edit</TableAction>
                      <TableAction onClick={() => archiveEmployee(employee.id)} danger={employee.status === "Active"}>{employee.status === "Archived" ? "Restore" : "Archive"}</TableAction>
                    </div>
                  </td>
                </tr>
              );
            })}
          </TableBody>
        </TableShell>
      ) : (
        <EmptyState title="No employees yet" copy="Create a simple employee record and LevyTate will continue the role discovery in conversation." actionLabel="Add employee" onAction={() => openEmployee()} />
      )}

      {draft ? (
        <MvpModal title={data.employees.some((item) => item.id === draft.id) ? "Edit employee" : "Add employee"} onClose={() => setDraft(null)}>
          <form onSubmit={submit}>
            <div className="mb-5 flex items-start gap-3 rounded-xl bg-[#edf7f3] p-4 ring-1 ring-[#159b8f]/10">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white text-[#0b8e82]"><UserPlus size={17} aria-hidden="true" /></span>
              <div>
                <p className="text-sm font-semibold">Start with the essentials</p>
                <p className="mt-1 text-xs leading-5 text-[#102c3d]/54">After saving, Ask LevyTate AI will learn what the employee does and what capability they need next.</p>
              </div>
            </div>

            <FormGrid>
              <FormField label="Employee name" value={draft.name} onChange={(value) => setDraft({ ...draft, name: value })} required />
              <FormField label="Job title" value={draft.jobTitle} onChange={(value) => setDraft({ ...draft, jobTitle: value })} required />
              <FormField label="Department" value={draft.department} onChange={(value) => setDraft({ ...draft, department: value })} required />
              <FormSelect
                label="Line manager"
                value={draft.managerId}
                onChange={(value) => setDraft({ ...draft, managerId: value })}
                options={[{ value: "", label: data.employees.length ? "Assign later" : "Add managers as employee records" }, ...data.employees.filter((employee) => employee.id !== draft.id && employee.status === "Active").map((employee) => ({ value: employee.id, label: employee.name }))]}
              />
              <FormField label="Site (optional)" value={draft.site} onChange={(value) => setDraft({ ...draft, site: value })} wide />
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
                  <FormSelect label="Assigned role library record" value={draft.roleId} onChange={(value) => { const role = data.roles.find((item) => item.id === value); setDraft({ ...draft, roleId: value, jobTitle: role?.title ?? draft.jobTitle }); }} options={[{ value: "", label: "Match later" }, ...data.roles.filter((role) => role.status === "Active").map((role) => ({ value: role.id, label: role.title }))]} />
                  <FormSelect label="Platform role" value={draft.platformRole} onChange={(value) => setDraft({ ...draft, platformRole: value as MvpEmployee["platformRole"] })} options={["Employee", "Line Manager", "Department Head", "Apprenticeship Lead"]} />
                  <FormField label="Start date" type="date" value={draft.startDate} onChange={(value) => setDraft({ ...draft, startDate: value })} wide />
                </FormGrid>
              </div>
            </details>

            <FormActions onCancel={() => setDraft(null)} label="Save and continue" error={error} />
          </form>
        </MvpModal>
      ) : null}
    </MvpPanel>
  );
}
