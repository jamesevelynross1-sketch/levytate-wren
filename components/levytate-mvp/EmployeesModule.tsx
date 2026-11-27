"use client";

import { ChevronDown, FileUp, Sparkles, UserPlus } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { employeeFieldGuidance } from "@/components/levytate-mvp/SetupContextHelp";
import {
  EmptyState,
  ListResultsBar,
  FilteredEmptyState,
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
import { WorkspaceAccessPanel } from "@/components/levytate-mvp/WorkspaceAccessPanel";
import { includesSearch, statusTone } from "@/components/levytate-mvp/module-utils";
import type { LevyTateRecommendationResult } from "@/lib/levytate/ai/types";
import { getApprenticeshipStandard } from "@/lib/levytate/domain";
import { deriveEmployeeOperationalSummary } from "@/lib/levytate/mvp/employee-operational-summary";
import { parsePeopleCsv, preparePeopleImport, type PeopleImportResult } from "@/lib/levytate/mvp/people-import";
import { normalisePeopleRecord, validatePeopleChanges } from "@/lib/levytate/mvp/people-validation";
import {
  employeeCurrentApplication,
  employeeDevelopmentInterests,
  managerName,
} from "@/lib/levytate/mvp/workspace-insights";
import {
  activeApplicationStatuses,
  createMvpId,
  nowIso,
  todayIso,
  type MvpEmployee,
} from "@/lib/levytate/mvp/workspace";

export function EmployeesModule({ onStartDiscovery, onSetupPeopleSaved, onOpenDirectReport, initialEmployeeId = null, setupStage }: {
  onStartDiscovery?: (employeeId: string) => void;
  onSetupPeopleSaved?: () => void;
  setupStage?: "manager" | "employees";
  onOpenDirectReport?: (employeeId: string) => void;
  initialEmployeeId?: string | null;
}) {
  const { data, saveEmployee, importEmployees, archiveEmployee, can, meta, sessionRecovery } = useMvpWorkspace();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("Active");
  const [departmentFilter, setDepartmentFilter] = useState("All");
  const [managerFilter, setManagerFilter] = useState("All");
  const [siteFilter, setSiteFilter] = useState("All");
  const [applicationFilter, setApplicationFilter] = useState("All");
  const [draft, setDraft] = useState<MvpEmployee | null>(null);
  const [draftRevision, setDraftRevision] = useState(0);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [peopleImport, setPeopleImport] = useState<{ fileName: string; result: PeopleImportResult; importId: string; employees: MvpEmployee[] } | null>(null);
  const [importComplete, setImportComplete] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (initialEmployeeId) setSelectedEmployeeId(initialEmployeeId);
  }, [initialEmployeeId]);

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

  const filtered = Boolean(search.trim()) || status !== "Active" || [departmentFilter,managerFilter,siteFilter,applicationFilter].some(value=>value!=="All");
  const directoryTotal=data.employees.filter(employee=>status==="All"||employee.status===status).length;
  function clearFilters(){setSearch("");setStatus("Active");setDepartmentFilter("All");setManagerFilter("All");setSiteFilter("All");setApplicationFilter("All");}

  const selectedEmployee = selectedEmployeeId
    ? data.employees.find((employee) => employee.id === selectedEmployeeId) ?? null
    : null;
  const selectedEmployeeApplications = selectedEmployee
    ? data.applications.filter((application) => application.employeeId === selectedEmployee.id)
    : [];
  const selectedProfile = selectedEmployee
    ? data.employeeDevelopmentProfiles.find((item) => item.employeeId === selectedEmployee.id) ?? null
    : null;
  const selectedRouteOutcome = careerRouteOutcome(selectedProfile?.recommendationResult ?? null);
  const selectedCurrentApplication = selectedEmployee
    ? employeeCurrentApplication(data, selectedEmployee.id)
    : null;
  const canWriteEmployees = can("employees:write");
  const isLineManager = meta?.userRole === "Line Manager";
  const operationalSummaries = useMemo(
    () => new Map((meta?.directReportOperationalSummaries ?? []).map((summary) => [summary.employeeId, summary])),
    [meta?.directReportOperationalSummaries],
  );

  function blankEmployee(): MvpEmployee {
    const now = nowIso();
    const id = createMvpId("employee");
    return {
      id,
      employeeNumber: `EMP-${id.slice(-12).toUpperCase()}`,
      name: "",
      email: "",
      jobTitle: "",
      roleId: "",
      managerId: "",
      department: "",
      site: "",
      platformRole: setupStage === "manager" ? "Line Manager" : "Employee",
      status: "Active",
      startDate: todayIso(),
      createdAt: now,
      updatedAt: now,
    };
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!draft || saving) return;
    const isNew = !data.employees.some((item) => item.id === draft.id);
    const matchedRoles = data.roles.filter(
      (role) => role.status === "Active" && role.title.trim().toLowerCase() === draft.jobTitle.trim().toLowerCase(),
    );
    if (!draft.roleId && matchedRoles.length > 1) { setError("This job title matches more than one active role. Select the intended role library record."); return; }

    const input = {
      ...draft,
      name: draft.name.trim(),
      jobTitle: draft.jobTitle.trim(),
      department: draft.department.trim(),
      email: draft.email.trim(),
      roleId: draft.roleId || matchedRoles[0]?.id || "",
      updatedAt: nowIso(),
    };

    setSaving(true); setError("");
    try {
      const employee = normalisePeopleRecord(input);
      validatePeopleChanges([employee], data.employees, data.roles);
      const result = await saveEmployee(employee, draftRevision);
      if (!result.ok) { setError(result.message); return; }
      setDraft(null);
      if (isNew) {
        if (onSetupPeopleSaved) onSetupPeopleSaved();
        else onStartDiscovery?.(employee.id);
      }
    } catch (failure) { setError(failure instanceof Error ? failure.message : "The employee save was not confirmed. Your form has been kept."); }
    finally { setSaving(false); }
  }

  function openEmployee(employee?: MvpEmployee) {
    if (saving) return;
    setError("");
    // Replace the detail dialog, so its focus trap cannot cover the editor.
    setSelectedEmployeeId(null);
    const next = employee ? { ...employee } : blankEmployee();
    setDraft(next);
    setDraftRevision(meta?.mutationRevisions?.[`levytate_employees:${next.id}`] ?? 0);
  }

  async function choosePeopleFile(file?: File) {
    setError(""); setImportComplete(0);
    if (!file || saving) return;
    if (!/\.csv$/i.test(file.name) || file.size > 2 * 1024 * 1024) { setError("Choose a CSV file no larger than 2MB."); return; }
    try {
      const result = parsePeopleCsv(await file.text());
      let employees: MvpEmployee[] = [];
      if (!result.issues.length) {
        try { employees = preparePeopleImport(result, data.employees, data.roles, () => createMvpId("employee"), nowIso()); }
        catch (failure) { result.issues.push({ sourceRow: 0, message: failure instanceof Error ? failure.message : "The file could not be validated." }); }
      }
      setPeopleImport({ fileName: file.name, result, employees, importId: crypto.randomUUID() });
    } catch { setError("The file could not be read. No employees were imported."); }
  }

  async function importPeople() {
    if (!peopleImport?.employees.length || peopleImport.result.issues.length || saving) return;
    setSaving(true); setError("");
    try {
      const result = await importEmployees(peopleImport.importId, peopleImport.employees);
      if (!result.ok) { setError(result.message); return; }
      setImportComplete(peopleImport.employees.length); setPeopleImport(null);
      onSetupPeopleSaved?.();
    } catch { setError("The import outcome was not confirmed. Keep this preview open and retry the same request."); }
    finally { setSaving(false); }
  }

  async function toggleEmployeeArchive(employeeId: string) {
    if (saving) return;
    setSaving(true); setError("");
    try { const result = await archiveEmployee(employeeId); if (!result.ok) setError(result.message); }
    catch { setError("The employee update was not confirmed. Please retry."); }
    finally { setSaving(false); }
  }

  return (
    <div className="space-y-6">
    <MvpPanel title={isLineManager ? "My Team" : "Employees"} eyebrow={isLineManager ? "Direct reports" : "Workforce records"}>
      <MvpToolbar
        search={search}
        onSearch={setSearch}
        placeholder="Search name, role, department, manager or site"
        actionLabel={canWriteEmployees ? (setupStage === "manager" ? "Add line manager" : "Add employee") : undefined}
        onAction={canWriteEmployees ? () => openEmployee() : undefined}
        filters={
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            <select aria-label="Employee record status" value={status} onChange={(event) => setStatus(event.target.value)} className="lt-control h-11 min-w-0 px-3 text-sm"><option value="Active">Active records</option><option value="Archived">Archived records</option><option value="All">All records</option></select>
            <select aria-label="Department" value={departmentFilter} onChange={(event) => setDepartmentFilter(event.target.value)} className="lt-control h-11 min-w-0 px-3 text-sm"><option value="All">All departments</option>{departments.map((department) => <option key={department}>{department}</option>)}</select>
            <details className="group rounded-lg border border-[#102c3d]/[0.09] bg-white">
              <summary className="flex h-11 cursor-pointer list-none items-center justify-between gap-2 px-3 text-sm font-semibold text-lt-secondary">
                More filters
                <ChevronDown size={15} className="transition group-open:rotate-180" aria-hidden="true" />
              </summary>
              <div className="grid gap-2 border-t border-[#102c3d]/[0.06] p-2">
                <select aria-label="Manager" value={managerFilter} onChange={(event) => setManagerFilter(event.target.value)} className="h-10 rounded-lg border border-[#102c3d]/[0.09] bg-white px-3 text-sm font-semibold text-lt-muted"><option value="All">All managers</option>{managers.map((manager) => <option key={manager.id} value={manager.id}>{manager.name}</option>)}</select>
                <select aria-label="Site" value={siteFilter} onChange={(event) => setSiteFilter(event.target.value)} className="h-10 rounded-lg border border-[#102c3d]/[0.09] bg-white px-3 text-sm font-semibold text-lt-muted"><option value="All">All sites</option>{sites.map((site) => <option key={site}>{site}</option>)}</select>
                <select aria-label="Application status" value={applicationFilter} onChange={(event) => setApplicationFilter(event.target.value)} className="h-10 rounded-lg border border-[#102c3d]/[0.09] bg-white px-3 text-sm font-semibold text-lt-muted"><option value="All">All applications</option>{applicationStatuses.map((statusOption) => <option key={statusOption}>{statusOption}</option>)}</select>
              </div>
            </details>
          </div>
        }
      />
      {canWriteEmployees ? <div className="mb-4 flex flex-wrap items-center gap-3"><label className="lt-button lt-secondary cursor-pointer"><FileUp size={15} />Import CSV<input type="file" accept=".csv,text/csv" disabled={saving} className="sr-only" onChange={(event) => { void choosePeopleFile(event.target.files?.[0]); event.target.value = ""; }} /></label><span className="text-xs text-lt-muted">Required: name, work email, job title, department. No invitations are sent.</span>{importComplete ? <span role="status" className="text-xs font-semibold text-lt-accent">{importComplete} employee{importComplete === 1 ? "" : "s"} imported.</span> : null}</div> : null}
      {error && !draft && !peopleImport ? <p role="alert" className="mb-4 text-sm font-semibold text-lt-risk">{error}</p> : null}

      <ListResultsBar count={visible.length} total={directoryTotal} singular="employee" plural="employees" filtered={filtered} onReset={clearFilters}/>
      {visible.length ? (
        <div className={isLineManager?"grid gap-4 xl:grid-cols-2":"lt-people-directory"} role="list" aria-label={isLineManager?"Direct reports":"Employee directory"}>
          {visible.map((employee) => {
            const role = data.roles.find((item) => item.id === employee.roleId);
            const application = employeeCurrentApplication(data, employee.id);
            const profile = data.employeeDevelopmentProfiles.find((item) => item.employeeId === employee.id);
            const routeOutcome = careerRouteOutcome(profile?.recommendationResult ?? null);
            const statusLabel = routeOutcome?.isStrategicDiscussion
              ? "Strategic discussion"
              : routeOutcome
              ? "Recommendation ready"
              : profile
                ? "Discovery in progress"
                : "Needs discovery";
            const operationalSummary = isLineManager
              ? operationalSummaries.get(employee.id) ?? deriveEmployeeOperationalSummary({
                employeeId: employee.id,
                application: application ? {
                  status: application.status,
                  programme: getApprenticeshipStandard(application.apprenticeshipStandardId)?.title ?? application.apprenticeshipStandardId,
                } : null,
                development: {
                  status: statusLabel,
                  programme: routeOutcome?.title,
                  nextAction: profile ? "Continue the employee's development conversation." : "Discuss development goals at the next one-to-one.",
                },
              })
              : null;
            const primaryAction = application
              ? "Review"
              : routeOutcome
                ? "Continue"
                : "Start discovery";

            return (
              <article role="listitem" key={employee.id} className={isLineManager?"lt-panel p-4":"lt-people-row"}>
                <div className="lt-people-identity flex min-w-0 items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-base font-semibold text-lt-ink">{employee.name}</p>
                    <p className="mt-1 text-sm leading-6 text-lt-muted">{employee.jobTitle || role?.title || "Role to confirm"}</p>
                  </div>
                  <StatusBadge tone={operationalSummary ? statusTone(operationalSummary.primaryStatus) : application ? statusTone(application.status) : routeOutcome ? routeOutcome.tone : profile ? "yellow" : "neutral"}>
                    {operationalSummary?.primaryStatus ?? application?.status ?? statusLabel}
                  </StatusBadge>
                </div>

                <div className="lt-people-facts mt-3 grid min-w-0 gap-x-5 gap-y-2 border-t border-lt-border pt-3 sm:grid-cols-2">
                  {isLineManager && operationalSummary ? (
                    <>
                      <DecisionFact label="Programme" value={operationalSummary.programme} />
                      <DecisionFact label="Progress" value={operationalSummary.progressPosition} />
                      <DecisionFact label="Manager support" value={operationalSummary.managerSupportSummary} />
                      <DecisionFact label="Team" value={employee.department || "Department to confirm"} />
                    </>
                  ) : (
                    <>
                      <DecisionFact label="Manager" value={managerName(data, employee)} />
                      <DecisionFact label="Team" value={employee.department || "Department to confirm"} />
                      <DecisionFact label="Development status" value={statusLabel} />
                      <DecisionFact label="AI confidence" value={routeOutcome?.isStrategicDiscussion ? "Adviser review" : routeOutcome ? "High" : profile ? "Building" : "Not started"} />
                    </>
                  )}
                </div>

                {routeOutcome && !operationalSummary?.hasLearnerLifecycle ? (
                  <div className="lt-people-route mt-3 rounded-lg bg-lt-soft px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-lt-accent">{routeOutcome.label}</p>
                    <p className="mt-1 text-sm font-semibold text-lt-ink">{routeOutcome.title}</p>
                  </div>
                ) : null}

                <div className="lt-people-actions mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-lt-border pt-3">
                  {isLineManager ? (
                    <button type="button" onClick={() => onOpenDirectReport?.(employee.id)} className="lt-button lt-primary">
                      View apprenticeship journey
                    </button>
                  ) : (
                    <>
                      <button type="button" onClick={() => application ? setSelectedEmployeeId(employee.id) : onStartDiscovery?.(employee.id)} className="lt-button lt-primary">
                        {primaryAction}
                      </button>
                      <button type="button" onClick={() => setSelectedEmployeeId(employee.id)} className="lt-button lt-secondary">
                        Details
                      </button>
                    </>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        filtered ? <FilteredEmptyState title="No employees match these filters" onReset={clearFilters}/> : canWriteEmployees ? (
          <EmptyState
            title={setupStage === "manager" ? "Add your first line manager" : "Add the first employee"}
            copy="Create one record. LevyTate will guide discovery and recommend the next development route."
            actionLabel={setupStage === "manager" ? "Add line manager" : "Add employee"}
            onAction={() => openEmployee()}
          />
        ) : (
          <div className="rounded-xl border border-dashed border-[#102c3d]/[0.14] bg-[#f8fbfa] px-5 py-10 text-center">
            <h3 className="text-base font-semibold text-lt-ink">No direct reports found</h3>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-lt-muted">Your view is limited to your own profile and direct reports. Ask a workspace admin if your reporting line looks incorrect.</p>
          </div>
        )
      )}

      {draft ? (
        <MvpModal title={data.employees.some((item) => item.id === draft.id) ? "Edit employee" : setupStage === "manager" ? "Add line manager" : "Add employee"} onClose={() => { if (!saving) setDraft(null); }}>
          <form onSubmit={submit}>
            <fieldset disabled={saving} className="min-w-0">
            <div className="mb-5 flex items-start gap-3 rounded-xl bg-[#edf7f3] p-4 ring-1 ring-[#159b8f]/[0.10]">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white text-lt-accent"><UserPlus size={17} aria-hidden="true" /></span>
              <div>
                <p className="text-sm font-semibold">Start with the essentials</p>
                <p className="mt-1 text-xs leading-5 text-lt-muted">{onSetupPeopleSaved ? "Your saved team stays here so you can add another person, assign a line manager or continue setup when ready." : "After saving, LevyTate Copilot can guide the role and capability conversation before any application begins."}</p>
              </div>
            </div>

            <FormGrid>
              <FormField label="Employee name" value={draft.name} onChange={(value) => setDraft({ ...draft, name: value })} help={employeeFieldGuidance.name} required />
              <FormField label="Work email" type="email" value={draft.email} onChange={(value) => setDraft({ ...draft, email: value })} help={employeeFieldGuidance.email} required />
              <FormField label="Job title" value={draft.jobTitle} onChange={(value) => setDraft({ ...draft, jobTitle: value })} help={employeeFieldGuidance.jobTitle} required />
              <FormField label="Department" value={draft.department} onChange={(value) => setDraft({ ...draft, department: value })} help={employeeFieldGuidance.department} required />
              <FormSelect label="Line manager" help={employeeFieldGuidance.lineManager} value={draft.managerId} onChange={(value) => setDraft({ ...draft, managerId: value })} options={[{ value: "", label: managers.length ? "Assign later" : "Add a Line Manager record first" }, ...managers.filter((employee) => employee.id !== draft.id).map((employee) => ({ value: employee.id, label: employee.name }))]} />
              <FormField label="Site" value={draft.site} onChange={(value) => setDraft({ ...draft, site: value })} help={employeeFieldGuidance.site} hint="Physical work location (e.g. Hull office), not a website." wide />
            </FormGrid>

            <details className="group mt-5 rounded-xl border border-[#102c3d]/[0.07] bg-[#f8fbfa]">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-xs font-semibold text-lt-muted">
                Additional record details
                <ChevronDown size={16} className="transition group-open:rotate-180" aria-hidden="true" />
              </summary>
              <div className="border-t border-[#102c3d]/[0.07] p-4">
                <FormGrid>
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

            <FormActions onCancel={() => setDraft(null)} label={saving ? "Saving…" : "Save employee"} error={error} disabled={saving} submissionBlocked={Boolean(sessionRecovery)} />
            </fieldset>
          </form>
        </MvpModal>
      ) : null}

      {peopleImport ? <MvpModal title="Review employee import" eyebrow={peopleImport.fileName} onClose={() => { if (!saving) setPeopleImport(null); }} wide>
        <div className="grid gap-4">
          <div className="grid gap-3 sm:grid-cols-2"><DecisionFact label="Employees to import" value={String(peopleImport.employees.length)} /><DecisionFact label="Issues requiring correction" value={String(peopleImport.result.issues.length)} /></div>
          <p className="text-sm text-lt-secondary">All rows are saved together or none are. Existing emails are not skipped or overwritten. Access must be prepared and invited separately.</p>
          {peopleImport.result.issues.length ? <div role="alert" className="max-h-48 overflow-y-auto rounded-xl bg-[#fff8df] p-4 text-xs text-[#765b00]">{peopleImport.result.issues.slice(0, 30).map((issue) => <p key={`${issue.sourceRow}:${issue.message}`} className="py-1">{issue.sourceRow ? `Row ${issue.sourceRow}: ` : ""}{issue.message}</p>)}</div> : null}
          {error ? <p role="alert" className="text-sm font-semibold text-lt-risk">{error}</p> : null}
          <div className="flex flex-wrap gap-3"><button type="button" disabled={saving || Boolean(sessionRecovery) || !peopleImport.employees.length || Boolean(peopleImport.result.issues.length)} onClick={() => void importPeople()} className="min-h-11 rounded-full bg-[#102c3d] px-5 text-sm font-semibold text-white disabled:opacity-40">{saving ? "Importing…" : "Import all employees"}</button><button type="button" disabled={saving} onClick={() => setPeopleImport(null)} className="min-h-11 rounded-full px-4 text-sm font-semibold text-lt-muted disabled:opacity-40">Cancel</button></div>
        </div>
      </MvpModal> : null}

      {selectedEmployee ? (
        <MvpModal title={selectedEmployee.name} eyebrow="Employee record" description={[selectedEmployee.jobTitle||"Role to confirm",selectedEmployee.department,selectedEmployee.site].filter(Boolean).join(" · ")} onClose={() => setSelectedEmployeeId(null)} wide>
          <div className="lt-employee-record" data-testid="employee-record-detail">
            <div className="lt-record-toolbar">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <StatusBadge tone={selectedCurrentApplication ? statusTone(selectedCurrentApplication.status) : "neutral"}>{selectedCurrentApplication?.status ?? "No active application"}</StatusBadge>
                {selectedProfile?<StatusBadge tone={selectedProfile.stage==="recommendation_ready"?"green":"yellow"}>{selectedProfile.stage==="recommendation_ready"?"Recommendation ready":"Discovery in progress"}</StatusBadge>:null}
              </div>
              <div className="lt-record-actions">
                {onStartDiscovery?<button type="button" onClick={()=>onStartDiscovery(selectedEmployee.id)} className="lt-button lt-primary"><Sparkles size={15} aria-hidden="true"/>Open Copilot</button>:null}
                {canWriteEmployees?<><TableAction onClick={()=>openEmployee(selectedEmployee)}>Edit</TableAction><TableAction onClick={()=>void toggleEmployeeArchive(selectedEmployee.id)} danger={selectedEmployee.status==="Active"}>{selectedEmployee.status==="Archived"?"Restore":"Archive"}</TableAction></>:null}
              </div>
            </div>
            {error?<p role="alert" className="mt-3 text-sm font-semibold text-lt-risk">{error}</p>:null}
            <div className="lt-record-columns">
              <div className="lt-record-profile min-w-0">
                <section className="lt-record-section">
                  <h3 className="lt-section-title">Current profile</h3>
                  <dl className="lt-profile-facts">
                    <div><dt>Role</dt><dd>{selectedEmployee.jobTitle||"Role to confirm"}</dd></div>
                    <div><dt>Department</dt><dd>{selectedEmployee.department||"Not confirmed"}</dd></div>
                    <div><dt>Site</dt><dd>{selectedEmployee.site||"Not confirmed"}</dd></div>
                    <div><dt>Line manager</dt><dd>{managerName(data,selectedEmployee)}</dd></div>
                  </dl>
                </section>
                <section className="lt-record-section">
                  <h3 className="lt-section-title">Development interests</h3>
                  <div className="mt-3 flex flex-wrap gap-2">{employeeDevelopmentInterests(data,selectedEmployee.id).length?employeeDevelopmentInterests(data,selectedEmployee.id).map(interest=><span key={interest} className="rounded-md bg-lt-soft px-2.5 py-1.5 text-xs font-medium text-lt-secondary">{interest}</span>):<p className="text-sm text-lt-muted">No interests captured yet.</p>}</div>
                </section>
                <section className="lt-record-section">
                  <h3 className="lt-section-title">Recommended pathway</h3>
                  <p className="mt-1 text-xs leading-5 text-lt-muted">Based on the development conversation and role library.</p>
                  {selectedRouteOutcome?<div className="mt-3"><div className="flex flex-wrap items-start gap-2"><p className="text-sm font-semibold text-lt-ink">{selectedRouteOutcome.title}</p><StatusBadge tone={selectedRouteOutcome.tone}>{selectedRouteOutcome.badge}</StatusBadge></div><p className="mt-2 text-sm leading-6 text-lt-muted">{selectedRouteOutcome.copy}</p></div>:<p className="mt-3 text-sm leading-6 text-lt-muted">A recommendation will appear when discovery is complete.</p>}
                </section>
              </div>
              <div className="lt-record-activity min-w-0">
                <section className="lt-record-section">
                  <div className="flex items-baseline justify-between gap-3"><h3 className="lt-section-title">Application history</h3><span className="shrink-0 text-xs tabular-nums text-lt-muted">{selectedEmployeeApplications.length} {selectedEmployeeApplications.length===1?"application":"applications"}</span></div>
                  {selectedEmployeeApplications.length?selectedEmployeeApplications.map(application=><article key={application.id} className="lt-application-history">
                    <div className="flex flex-wrap items-start justify-between gap-2"><div className="min-w-0"><p className="lt-record-name">{applicationLabel(application.apprenticeshipStandardId)}</p><p className="mt-1 text-sm leading-6 text-lt-muted">{application.reason||"No reason recorded yet."}</p></div><StatusBadge tone={statusTone(application.status)}>{application.status}</StatusBadge></div>
                    <ol className="lt-history-list">{application.history.map(entry=><li key={entry.id} className="lt-history-event"><div className="flex flex-wrap items-baseline justify-between gap-2"><p className="font-semibold text-lt-ink">{entry.status}</p><time className="text-xs tabular-nums text-lt-muted">{entry.createdAt.slice(0,10)}</time></div><p className="mt-1 text-xs text-lt-muted">{entry.owner}</p><p className="mt-1 text-sm leading-6 text-lt-secondary">{entry.note}</p></li>)}</ol>
                  </article>):<p className="mt-3 text-sm leading-6 text-lt-muted">No applications created yet for this employee.</p>}
                </section>
                <section className="lt-record-section">
                  <h3 className="lt-section-title">Conversation history</h3>
                  <div className="mt-3 grid gap-3">{selectedProfile?.conversationHistory.length?selectedProfile.conversationHistory.slice(-6).map((message,index)=><div key={`${message.role}-${index}`} className={`rounded-lg px-3 py-2.5 text-sm leading-6 ${message.role==="user"?"bg-lt-ink text-white":"bg-lt-soft text-lt-secondary"}`}>{message.content}</div>):<p className="text-sm leading-6 text-lt-muted">Conversation history will appear after guided discovery begins.</p>}</div>
                </section>
              </div>
            </div>
          </div>
        </MvpModal>
      ) : null}
    </MvpPanel>
    {meta?.storageMode === "supabase" && ["Apprenticeship Lead", "Employer Admin"].includes(meta.userRole) ? <WorkspaceAccessPanel /> : null}
    </div>
  );
}

function DecisionFact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.13em] text-lt-muted">{label}</p>
      <p className="mt-1 line-clamp-2 text-sm font-semibold leading-5 text-lt-secondary">{value}</p>
    </div>
  );
}

function applicationLabel(standardId: string) {
  return getApprenticeshipStandard(standardId)?.title ?? standardId;
}

function careerRouteOutcome(result: LevyTateRecommendationResult | null): {
  label: string;
  title: string;
  copy: string;
  badge: string;
  tone: "neutral" | "green" | "yellow" | "red" | "blue";
  isStrategicDiscussion: boolean;
} | null {
  if (!result) return null;
  const top = result.topRecommendation;
  if (top) {
    return {
      label: "Leading route",
      title: top.title,
      copy: top.rationale,
      badge: top.recommendationCategory,
      tone: top.recommendationCategory === "Strong Recommendation" ? "green" : "blue",
      isStrategicDiscussion: false,
    };
  }
  if (result.strategicDiscussion) {
    return {
      label: "Career Intelligence outcome",
      title: "Strategic Discussion Required",
      copy: result.strategicDiscussion,
      badge: result.careerStage,
      tone: "yellow",
      isStrategicDiscussion: true,
    };
  }
  return null;
}
