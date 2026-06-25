"use client";

import { FormEvent, useMemo, useState } from "react";
import { LevyTateLogo, PlatformButton, PlatformTopBar } from "@/components/levytate-demo/PlatformShell";
import {
  employeeManagementRecords,
  employeeRoleOptions,
  portakabinSites,
} from "@/lib/levytate/data/portakabin";
import {
  filterEmployeeRecords,
  nextEmployeeNumber,
  noActiveApplicationLabel,
  requestStages,
  roles,
  uniqueEmployeeValues,
} from "@/lib/levytate/domain";
import type { EmployeeManagementFilters, EmployeeRecord, EmployeeRecordStatus, Role } from "@/lib/levytate/domain";

const allOption = "All" as const;
const employeeStatuses: EmployeeRecordStatus[] = ["Active", "Archived"];
const applicationStatusOptions: EmployeeRecord["applicationStatus"][] = [noActiveApplicationLabel, ...requestStages];
const defaultFilters: EmployeeManagementFilters = {
  search: "",
  status: "Active",
  department: allOption,
  site: allOption,
  manager: allOption,
  applicationStatus: allOption,
};

type FormMode = "add" | "edit";

export function EmployeeManagementModule() {
  const [employees, setEmployees] = useState<EmployeeRecord[]>(employeeManagementRecords);
  const [filters, setFilters] = useState<EmployeeManagementFilters>(defaultFilters);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(employeeManagementRecords[0]?.id ?? "");
  const [profileEmployeeId, setProfileEmployeeId] = useState<string | null>(null);
  const [formMode, setFormMode] = useState<FormMode | null>(null);
  const [draft, setDraft] = useState<EmployeeRecord | null>(null);

  const visibleEmployees = useMemo(() => filterEmployeeRecords(employees, filters), [employees, filters]);
  const selectedEmployee = employees.find((employee) => employee.id === selectedEmployeeId) ?? visibleEmployees[0] ?? employees[0];
  const profileEmployee = profileEmployeeId ? employees.find((employee) => employee.id === profileEmployeeId) : null;

  const departments = useMemo(() => uniqueEmployeeValues(employees, "department"), [employees]);
  const managers = useMemo(() => uniqueEmployeeValues(employees, "manager"), [employees]);
  const sites = useMemo(() => uniqueEmployeeValues(employees, "site"), [employees]);
  const appStatuses = useMemo(() => uniqueEmployeeValues(employees, "applicationStatus") as EmployeeRecord["applicationStatus"][], [employees]);

  function updateFilter<K extends keyof EmployeeManagementFilters>(key: K, value: EmployeeManagementFilters[K]) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function updateEmployee(id: string, updates: Partial<EmployeeRecord>) {
    setEmployees((current) => current.map((employee) => employee.id === id ? { ...employee, ...updates, lastUpdated: todayStamp() } : employee));
  }

  function openAddForm() {
    const nextNumber = nextEmployeeNumber(employees);
    setDraft({
      id: `emp-${Date.now()}`,
      employeeNumber: nextNumber,
      name: "",
      email: "",
      role: employeeRoleOptions[0],
      platformRole: "Employee",
      manager: managers[0] ?? "",
      department: departments[0] ?? "Manufacturing",
      site: portakabinSites[0],
      applicationStatus: noActiveApplicationLabel,
      status: "Active",
      startDate: todayStamp(),
      lastUpdated: todayStamp(),
    });
    setFormMode("add");
  }

  function openEditForm(employee: EmployeeRecord) {
    setDraft(employee);
    setFormMode("edit");
  }

  function closeForm() {
    setFormMode(null);
    setDraft(null);
  }

  function submitEmployee(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft) return;

    const cleanDraft: EmployeeRecord = {
      ...draft,
      name: draft.name.trim(),
      email: draft.email.trim(),
      lastUpdated: todayStamp(),
    };

    if (!cleanDraft.name || !cleanDraft.email) return;

    if (formMode === "add") {
      setEmployees((current) => [cleanDraft, ...current]);
      setSelectedEmployeeId(cleanDraft.id);
      setProfileEmployeeId(cleanDraft.id);
    } else {
      setEmployees((current) => current.map((employee) => employee.id === cleanDraft.id ? cleanDraft : employee));
      setSelectedEmployeeId(cleanDraft.id);
    }

    closeForm();
  }

  function archiveEmployee(employee: EmployeeRecord) {
    updateEmployee(employee.id, { status: employee.status === "Archived" ? "Active" : "Archived" });
  }

  return (
    <main className="min-h-screen bg-[#f5f7f6] text-[#102c3d]">
      <PlatformTopBar tenantName="Portakabin" tenantSubtitle="Employee Management" controlsOnly>
        <div className="grid w-full gap-3 xl:grid-cols-[auto_minmax(280px,1fr)_auto] xl:items-center">
          <div className="flex items-center gap-4">
            <LevyTateLogo className="[--levytate-logo-size:2.35rem]" />
            <div className="hidden h-8 w-px bg-[#102c3d]/10 sm:block" />
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#0b6f63]">Portakabin</p>
              <p className="text-sm font-semibold text-[#102c3d]">Employee Management</p>
            </div>
          </div>
          <label className="flex h-11 min-w-0 items-center gap-3 rounded-full border border-[#102c3d]/[0.08] bg-[#f8fbfa] px-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.78)] focus-within:border-[#159b8f] focus-within:bg-white focus-within:ring-4 focus-within:ring-[#159b8f]/10">
            <span className="text-sm text-[#102c3d]/36">Search</span>
            <input
              value={filters.search}
              onChange={(event) => updateFilter("search", event.target.value)}
              className="min-w-0 flex-1 bg-transparent text-sm font-medium text-[#102c3d] outline-none placeholder:text-[#102c3d]/34"
              placeholder="Name, role, email, manager or site"
            />
          </label>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setFilters(defaultFilters)} className="h-10 rounded-full bg-white px-4 text-xs font-semibold text-[#102c3d]/62 ring-1 ring-[#102c3d]/[0.08] transition hover:text-[#102c3d]">Reset</button>
            <PlatformButton onClick={openAddForm}>Add employee</PlatformButton>
          </div>
        </div>
      </PlatformTopBar>

      <div className="mx-auto grid w-full max-w-[1500px] gap-5 px-5 py-5 sm:px-7 lg:px-8">
        {profileEmployee ? (
          <EmployeeProfilePage
            employee={profileEmployee}
            employees={employees}
            departments={departments}
            managers={managers}
            sites={sites}
            onBack={() => setProfileEmployeeId(null)}
            onEdit={() => openEditForm(profileEmployee)}
            onArchive={() => archiveEmployee(profileEmployee)}
            onInlineUpdate={(updates) => updateEmployee(profileEmployee.id, updates)}
          />
        ) : (
          <>
            <section className="rounded-[1rem] border border-[#102c3d]/[0.065] bg-white p-4 shadow-[0_10px_28px_rgba(16,44,61,0.045)]">
              <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#c95568]">People operations</p>
                  <h1 className="mt-1 text-2xl font-semibold tracking-[-0.025em] text-[#102c3d]">Employees</h1>
                  <p className="mt-1 text-sm leading-6 text-[#102c3d]/58">Manage employee records, role access, reporting lines, departments, sites and apprenticeship application status.</p>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-[#102c3d]/52">
                  <span className="rounded-full bg-[#f8fbfa] px-3 py-1.5 ring-1 ring-[#102c3d]/[0.06]">{visibleEmployees.length} visible</span>
                  <span className="rounded-full bg-[#f8fbfa] px-3 py-1.5 ring-1 ring-[#102c3d]/[0.06]">{employees.length} total</span>
                </div>
              </div>

              <EmployeeFiltersBar
                filters={filters}
                departments={departments}
                managers={managers}
                sites={sites}
                applicationStatuses={appStatuses}
                onFilter={updateFilter}
              />
            </section>

            <section className="overflow-hidden rounded-[1rem] border border-[#102c3d]/[0.065] bg-white shadow-[0_10px_28px_rgba(16,44,61,0.045)]">
              <EmployeeTable
                employees={visibleEmployees}
                selectedEmployeeId={selectedEmployee?.id ?? ""}
                managers={managers}
                departments={departments}
                sites={sites}
                onSelect={(employee) => setSelectedEmployeeId(employee.id)}
                onOpenProfile={(employee) => {
                  setSelectedEmployeeId(employee.id);
                  setProfileEmployeeId(employee.id);
                }}
                onInlineUpdate={updateEmployee}
                onEdit={openEditForm}
                onArchive={archiveEmployee}
              />
            </section>
          </>
        )}
      </div>

      {draft && formMode ? (
        <EmployeeFormModal
          mode={formMode}
          draft={draft}
          employees={employees}
          departments={departments}
          managers={managers}
          onDraft={setDraft}
          onSubmit={submitEmployee}
          onClose={closeForm}
        />
      ) : null}
    </main>
  );
}

function EmployeeFiltersBar({
  filters,
  departments,
  managers,
  sites,
  applicationStatuses,
  onFilter,
}: {
  filters: EmployeeManagementFilters;
  departments: string[];
  managers: string[];
  sites: string[];
  applicationStatuses: EmployeeRecord["applicationStatus"][];
  onFilter: <K extends keyof EmployeeManagementFilters>(key: K, value: EmployeeManagementFilters[K]) => void;
}) {
  return (
    <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
      <FilterSelect label="Status" value={filters.status} options={[allOption, ...employeeStatuses]} onChange={(value) => onFilter("status", value as EmployeeManagementFilters["status"])} />
      <FilterSelect label="Department" value={filters.department} options={[allOption, ...departments]} onChange={(value) => onFilter("department", value)} />
      <FilterSelect label="Manager" value={filters.manager} options={[allOption, ...managers]} onChange={(value) => onFilter("manager", value)} />
      <FilterSelect label="Site" value={filters.site} options={[allOption, ...sites]} onChange={(value) => onFilter("site", value)} />
      <FilterSelect label="Application" value={filters.applicationStatus} options={[allOption, ...applicationStatuses]} onChange={(value) => onFilter("applicationStatus", value as EmployeeManagementFilters["applicationStatus"])} />
    </div>
  );
}

function EmployeeTable({
  employees,
  selectedEmployeeId,
  managers,
  departments,
  sites,
  onSelect,
  onOpenProfile,
  onInlineUpdate,
  onEdit,
  onArchive,
}: {
  employees: EmployeeRecord[];
  selectedEmployeeId: string;
  managers: string[];
  departments: string[];
  sites: string[];
  onSelect: (employee: EmployeeRecord) => void;
  onOpenProfile: (employee: EmployeeRecord) => void;
  onInlineUpdate: (id: string, updates: Partial<EmployeeRecord>) => void;
  onEdit: (employee: EmployeeRecord) => void;
  onArchive: (employee: EmployeeRecord) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-[1180px] w-full border-collapse text-left text-sm">
        <thead className="bg-[#f8fbfa] text-[10px] font-semibold uppercase tracking-[0.14em] text-[#102c3d]/40">
          <tr>
            <th className="px-4 py-3">Employee</th>
            <th className="px-4 py-3">Role access</th>
            <th className="px-4 py-3">Manager</th>
            <th className="px-4 py-3">Department</th>
            <th className="px-4 py-3">Site</th>
            <th className="px-4 py-3">Application status</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#102c3d]/[0.055] bg-white">
          {employees.length ? employees.map((employee) => (
            <tr key={employee.id} onClick={() => onSelect(employee)} className={`transition hover:bg-[#f8fbfa] ${selectedEmployeeId === employee.id ? "bg-[#f8fbfa]" : ""}`}>
              <td className="px-4 py-3 align-top">
                <button type="button" onClick={(event) => { event.stopPropagation(); onOpenProfile(employee); }} className="text-left">
                  <span className="block font-semibold text-[#102c3d]">{employee.name}</span>
                  <span className="mt-0.5 block text-xs text-[#102c3d]/48">{employee.employeeNumber} ï¿½ {employee.email}</span>
                  <span className="mt-1 block text-xs text-[#102c3d]/58">{employee.role}</span>
                </button>
              </td>
              <td className="px-4 py-3 align-top"><InlineSelect value={employee.platformRole} options={roles} onChange={(value) => onInlineUpdate(employee.id, { platformRole: value as Role })} /></td>
              <td className="px-4 py-3 align-top"><InlineSelect value={employee.manager} options={managers} onChange={(value) => onInlineUpdate(employee.id, { manager: value })} /></td>
              <td className="px-4 py-3 align-top"><InlineSelect value={employee.department} options={departments} onChange={(value) => onInlineUpdate(employee.id, { department: value })} /></td>
              <td className="px-4 py-3 align-top"><InlineSelect value={employee.site} options={sites} onChange={(value) => onInlineUpdate(employee.id, { site: value })} /></td>
              <td className="px-4 py-3 align-top"><InlineSelect value={employee.applicationStatus} options={applicationStatusOptions} onChange={(value) => onInlineUpdate(employee.id, { applicationStatus: value as EmployeeRecord["applicationStatus"] })} /></td>
              <td className="px-4 py-3 align-top"><StatusBadge status={employee.status} /></td>
              <td className="px-4 py-3 align-top">
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={(event) => { event.stopPropagation(); onEdit(employee); }} className="rounded-full bg-[#f5f7f3] px-3 py-1.5 text-xs font-semibold text-[#102c3d] ring-1 ring-[#102c3d]/[0.06] transition hover:bg-white">Edit</button>
                  <button type="button" onClick={(event) => { event.stopPropagation(); onArchive(employee); }} className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-[#102c3d]/58 ring-1 ring-[#102c3d]/[0.08] transition hover:text-[#102c3d]">{employee.status === "Archived" ? "Restore" : "Archive"}</button>
                </div>
              </td>
            </tr>
          )) : (
            <tr>
              <td colSpan={8} className="px-4 py-10 text-center text-sm text-[#102c3d]/54">No employees match the current filters.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function EmployeeProfilePage({
  employee,
  employees,
  departments,
  managers,
  sites,
  onBack,
  onEdit,
  onArchive,
  onInlineUpdate,
}: {
  employee: EmployeeRecord;
  employees: EmployeeRecord[];
  departments: string[];
  managers: string[];
  sites: string[];
  onBack: () => void;
  onEdit: () => void;
  onArchive: () => void;
  onInlineUpdate: (updates: Partial<EmployeeRecord>) => void;
}) {
  const directReports = employees.filter((item) => item.manager === employee.name && item.status === "Active");

  return (
    <section className="grid gap-5">
      <div className="rounded-[1rem] border border-[#102c3d]/[0.065] bg-white p-4 shadow-[0_10px_28px_rgba(16,44,61,0.045)]">
        <button type="button" onClick={onBack} className="text-xs font-semibold text-[#102c3d]/54 transition hover:text-[#102c3d]">Back to employee list</button>
        <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#c95568]">Employee profile</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-[-0.03em] text-[#102c3d]">{employee.name}</h1>
            <p className="mt-1 text-sm font-medium text-[#102c3d]/62">{employee.role} ï¿½ {employee.department}</p>
            <p className="mt-1 text-sm text-[#102c3d]/48">{employee.email}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <StatusBadge status={employee.status} />
            <ApplicationBadge status={employee.applicationStatus} />
            <button type="button" onClick={onEdit} className="h-10 rounded-full bg-[#102c3d] px-4 text-xs font-semibold text-white shadow-[0_10px_22px_rgba(16,44,61,0.12)] transition hover:-translate-y-0.5">Edit profile</button>
            <button type="button" onClick={onArchive} className="h-10 rounded-full bg-white px-4 text-xs font-semibold text-[#102c3d]/58 ring-1 ring-[#102c3d]/[0.08] transition hover:text-[#102c3d]">{employee.status === "Archived" ? "Restore" : "Archive"}</button>
          </div>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="rounded-[1rem] border border-[#102c3d]/[0.065] bg-white p-4 shadow-[0_10px_28px_rgba(16,44,61,0.045)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#c95568]">Assignments</p>
              <h2 className="mt-1 text-lg font-semibold text-[#102c3d]">Role, manager, department and site</h2>
            </div>
            <p className="text-xs text-[#102c3d]/42">Updated {employee.lastUpdated}</p>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <ProfileSelect label="Role assignment" value={employee.platformRole} options={roles} onChange={(value) => onInlineUpdate({ platformRole: value as Role })} />
            <ProfileSelect label="Manager assignment" value={employee.manager} options={managers} onChange={(value) => onInlineUpdate({ manager: value })} />
            <ProfileSelect label="Department assignment" value={employee.department} options={departments} onChange={(value) => onInlineUpdate({ department: value })} />
            <ProfileSelect label="Site assignment" value={employee.site} options={sites} onChange={(value) => onInlineUpdate({ site: value })} />
            <ProfileSelect label="Application status" value={employee.applicationStatus} options={applicationStatusOptions} onChange={(value) => onInlineUpdate({ applicationStatus: value as EmployeeRecord["applicationStatus"] })} />
            <ProfileSelect label="Record status" value={employee.status} options={employeeStatuses} onChange={(value) => onInlineUpdate({ status: value as EmployeeRecordStatus })} />
          </div>
        </section>

        <aside className="rounded-[1rem] border border-[#102c3d]/[0.065] bg-white p-4 shadow-[0_10px_28px_rgba(16,44,61,0.045)]">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#c95568]">Record detail</p>
          <dl className="mt-4 grid gap-3 text-sm">
            <ProfileFact label="Employee number" value={employee.employeeNumber} />
            <ProfileFact label="Start date" value={employee.startDate} />
            <ProfileFact label="Direct reports" value={String(directReports.length)} />
            <ProfileFact label="Platform role" value={employee.platformRole} />
          </dl>
          {directReports.length ? (
            <div className="mt-5 border-t border-[#102c3d]/[0.06] pt-4">
              <p className="text-xs font-semibold text-[#102c3d]">Direct reports</p>
              <div className="mt-3 grid gap-2">
                {directReports.slice(0, 5).map((report) => (
                  <div key={report.id} className="rounded-xl bg-[#f8fbfa] px-3 py-2">
                    <p className="text-sm font-semibold text-[#102c3d]">{report.name}</p>
                    <p className="text-xs text-[#102c3d]/52">{report.role}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </aside>
      </div>
    </section>
  );
}

function EmployeeFormModal({
  mode,
  draft,
  employees,
  departments,
  managers,
  onDraft,
  onSubmit,
  onClose,
}: {
  mode: FormMode;
  draft: EmployeeRecord;
  employees: EmployeeRecord[];
  departments: string[];
  managers: string[];
  onDraft: (draft: EmployeeRecord) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onClose: () => void;
}) {
  const editableDepartments = Array.from(new Set([...departments, draft.department])).filter(Boolean).sort();
  const editableManagers = Array.from(new Set([...managers, draft.manager])).filter(Boolean).sort();
  const editableSites = Array.from(new Set([...portakabinSites, draft.site])).filter(Boolean);
  const existingEmails = employees.filter((employee) => employee.id !== draft.id).map((employee) => employee.email.toLowerCase());
  const emailExists = draft.email ? existingEmails.includes(draft.email.toLowerCase()) : false;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[#102c3d]/30 px-4 py-8 backdrop-blur-sm">
      <form onSubmit={onSubmit} className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-[1.25rem] bg-white p-5 shadow-[0_30px_90px_rgba(16,44,61,0.24)]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#c95568]">{mode === "add" ? "Add employee" : "Edit employee"}</p>
            <h2 className="mt-1 text-2xl font-semibold tracking-[-0.025em] text-[#102c3d]">{mode === "add" ? "Create employee record" : draft.name}</h2>
          </div>
          <button type="button" onClick={onClose} className="h-10 rounded-full bg-[#f5f7f3] px-4 text-xs font-semibold text-[#102c3d] ring-1 ring-[#102c3d]/[0.06]">Close</button>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <FormField label="Employee number" value={draft.employeeNumber} onChange={(value) => onDraft({ ...draft, employeeNumber: value })} />
          <FormField label="Name" value={draft.name} onChange={(value) => onDraft({ ...draft, name: value })} required />
          <FormField label="Email" value={draft.email} onChange={(value) => onDraft({ ...draft, email: value })} required type="email" error={emailExists ? "Email already exists" : undefined} />
          <FormSelect label="Role" value={draft.role} options={employeeRoleOptions} onChange={(value) => onDraft({ ...draft, role: value })} />
          <FormSelect label="Role assignment" value={draft.platformRole} options={roles} onChange={(value) => onDraft({ ...draft, platformRole: value as Role })} />
          <FormSelect label="Manager assignment" value={draft.manager} options={editableManagers} onChange={(value) => onDraft({ ...draft, manager: value })} />
          <FormSelect label="Department assignment" value={draft.department} options={editableDepartments} onChange={(value) => onDraft({ ...draft, department: value })} />
          <FormSelect label="Site assignment" value={draft.site} options={editableSites} onChange={(value) => onDraft({ ...draft, site: value })} />
          <FormSelect label="Application status" value={draft.applicationStatus} options={applicationStatusOptions} onChange={(value) => onDraft({ ...draft, applicationStatus: value as EmployeeRecord["applicationStatus"] })} />
          <FormSelect label="Record status" value={draft.status} options={employeeStatuses} onChange={(value) => onDraft({ ...draft, status: value as EmployeeRecordStatus })} />
          <FormField label="Start date" value={draft.startDate} onChange={(value) => onDraft({ ...draft, startDate: value })} type="date" />
        </div>

        <div className="mt-5 flex items-center justify-between gap-3 rounded-2xl bg-[#f8fbfa] px-4 py-3">
          <p className="text-sm text-[#102c3d]/58">Changes are saved to local mock state for this MVP module. The data shape is ready for a database-backed repository.</p>
          <button disabled={emailExists || !draft.name.trim() || !draft.email.trim()} className="h-10 rounded-full bg-[#102c3d] px-5 text-xs font-semibold text-white transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:bg-[#102c3d]/30">Save employee</button>
        </div>
      </form>
    </div>
  );
}

function FilterSelect({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return (
    <label className="grid gap-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-[#102c3d]/38">
      {label}
      <select value={value} onChange={(event) => onChange(event.target.value)} className="h-10 min-w-0 rounded-xl border border-[#102c3d]/[0.08] bg-white px-3 text-sm font-semibold normal-case tracking-normal text-[#102c3d]/72 outline-none transition focus:border-[#159b8f] focus:ring-4 focus:ring-[#159b8f]/10">
        {options.map((option) => <option key={option}>{option}</option>)}
      </select>
    </label>
  );
}

function InlineSelect({ value, options, onChange }: { value: string; options: string[]; onChange: (value: string) => void }) {
  return (
    <select value={value} onChange={(event) => onChange(event.target.value)} onClick={(event) => event.stopPropagation()} className="h-9 max-w-[190px] rounded-full border border-[#102c3d]/[0.07] bg-[#f8fbfa] px-3 text-xs font-semibold text-[#102c3d]/70 outline-none transition hover:bg-white focus:border-[#159b8f] focus:ring-4 focus:ring-[#159b8f]/10">
      {options.map((option) => <option key={option}>{option}</option>)}
    </select>
  );
}

function ProfileSelect({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return (
    <label className="grid gap-2 rounded-2xl border border-[#102c3d]/[0.055] bg-[#f8fbfa] p-3">
      <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#102c3d]/38">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="h-10 rounded-xl border border-[#102c3d]/[0.08] bg-white px-3 text-sm font-semibold text-[#102c3d] outline-none focus:border-[#159b8f] focus:ring-4 focus:ring-[#159b8f]/10">
        {options.map((option) => <option key={option}>{option}</option>)}
      </select>
    </label>
  );
}

function FormField({ label, value, onChange, required = false, type = "text", error }: { label: string; value: string; onChange: (value: string) => void; required?: boolean; type?: string; error?: string }) {
  return (
    <label className="grid gap-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-[#102c3d]/42">
      {label}
      <input type={type} value={value} required={required} onChange={(event) => onChange(event.target.value)} className="h-11 rounded-xl border border-[#102c3d]/[0.08] bg-[#f8fbfa] px-3 text-sm font-medium normal-case tracking-normal text-[#102c3d] outline-none transition focus:border-[#159b8f] focus:bg-white focus:ring-4 focus:ring-[#159b8f]/10" />
      {error ? <span className="text-xs font-semibold normal-case tracking-normal text-[#ad344e]">{error}</span> : null}
    </label>
  );
}

function FormSelect({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return (
    <label className="grid gap-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-[#102c3d]/42">
      {label}
      <select value={value} onChange={(event) => onChange(event.target.value)} className="h-11 rounded-xl border border-[#102c3d]/[0.08] bg-[#f8fbfa] px-3 text-sm font-medium normal-case tracking-normal text-[#102c3d] outline-none transition focus:border-[#159b8f] focus:bg-white focus:ring-4 focus:ring-[#159b8f]/10">
        {options.map((option) => <option key={option}>{option}</option>)}
      </select>
    </label>
  );
}

function StatusBadge({ status }: { status: EmployeeRecordStatus }) {
  const active = status === "Active";
  return <span className={`inline-flex w-fit rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ${active ? "bg-[#edf8f5] text-[#0b6f63] ring-[#159b8f]/[0.14]" : "bg-[#f4f1ee] text-[#8b6f54] ring-[#8b6f54]/[0.12]"}`}>{status}</span>;
}

function ApplicationBadge({ status }: { status: EmployeeRecord["applicationStatus"] }) {
  const muted = status === noActiveApplicationLabel || status.includes("Declined") || status === "Completed" || status === "Cancelled" || status === "Withdrawn";
  return <span className={`inline-flex w-fit rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ${muted ? "bg-[#f5f7f3] text-[#102c3d]/54 ring-[#102c3d]/[0.06]" : "bg-[#fff4bd] text-[#7b6100] ring-[#8a6a00]/[0.08]"}`}>{status}</span>;
}

function ProfileFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-[#f8fbfa] px-3 py-2.5">
      <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#102c3d]/36">{label}</dt>
      <dd className="mt-1 text-sm font-semibold text-[#102c3d]">{value}</dd>
    </div>
  );
}

function todayStamp() {
  return new Date().toISOString().slice(0, 10);
}
