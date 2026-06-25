"use client";

import { FormEvent, useMemo, useState, type ReactNode } from "react";
import { LevyTateLogo, PlatformButton, PlatformTopBar } from "@/components/levytate-demo/PlatformShell";
import { employeeManagementRecords, initialRequests, portakabinLearners, portakabinPathwayStandards, portakabinRoleLibrary, roleCapabilityTags } from "@/lib/levytate/data/portakabin";
import { defaultRoleLibraryFilters, filterRoleLibraryRoles, nextRoleId, orderedRoleRecommendations, pathwaysForRole, roleById, uniqueRoleSites, uniqueRoleValues } from "@/lib/levytate/domain";
import type { ApprenticeshipPathway, CareerLevel, DeliveryPreference, FundingRoute, RoleCapabilityTag, RoleLibraryFilters, RoleLibraryRole, RolePathwayMapping, RoleRecordStatus } from "@/lib/levytate/domain";

const allOption = "All" as const;
const statusOptions: RoleRecordStatus[] = ["Active", "Archived"];
const careerLevelOptions: CareerLevel[] = ["Entry", "Experienced", "Supervisor", "Manager", "Senior Manager"];
const fundingRouteOptions: FundingRoute[] = ["Potentially levy-funded", "Potentially funded through levy/co-investment", "Commercial training budget"];
const deliveryPreferenceOptions: DeliveryPreference[] = ["Blended", "Site based", "Remote workshops", "Hybrid", "Online + coaching"];
type FormMode = "add" | "edit";

export function RoleLibraryModule() {
  const [roles, setRoles] = useState<RoleLibraryRole[]>(portakabinRoleLibrary);
  const [filters, setFilters] = useState<RoleLibraryFilters>(defaultRoleLibraryFilters);
  const [selectedRoleId, setSelectedRoleId] = useState(portakabinRoleLibrary[0]?.id ?? "");
  const [profileRoleId, setProfileRoleId] = useState<string | null>(null);
  const [formMode, setFormMode] = useState<FormMode | null>(null);
  const [draft, setDraft] = useState<RoleLibraryRole | null>(null);

  const visibleRoles = useMemo(() => filterRoleLibraryRoles(roles, filters), [roles, filters]);
  const selectedRole = roleById(roles, selectedRoleId) ?? visibleRoles[0] ?? roles[0];
  const profileRole = profileRoleId ? roleById(roles, profileRoleId) : null;
  const departments = useMemo(() => uniqueRoleValues(roles, "department"), [roles]);
  const businessAreas = useMemo(() => uniqueRoleValues(roles, "businessArea"), [roles]);
  const sites = useMemo(() => uniqueRoleSites(roles), [roles]);

  function updateFilter<K extends keyof RoleLibraryFilters>(key: K, value: RoleLibraryFilters[K]) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function updateRole(id: string, updates: Partial<RoleLibraryRole>) {
    setRoles((current) => current.map((role) => role.id === id ? { ...role, ...updates, lastUpdated: todayStamp() } : role));
  }

  function openAddForm() {
    setDraft({
      id: nextRoleId(roles),
      roleTitle: "",
      department: departments[0] ?? "Manufacturing",
      businessArea: businessAreas[0] ?? "Manufacturing & Production",
      siteApplicability: ["All sites"],
      careerLevel: "Experienced",
      typicalProgression: [],
      futureProgressionRoleIds: [],
      skillsTags: [],
      aiTags: ["Operational"],
      businessOutcomes: [],
      overview: "",
      recommendations: [createMapping(portakabinPathwayStandards[0]?.id ?? "path-l3-team-leader", "Primary", 1)],
      status: "Active",
      lastUpdated: todayStamp(),
    });
    setFormMode("add");
  }

  function openEditForm(role: RoleLibraryRole) {
    setDraft(cloneRole(role));
    setFormMode("edit");
  }

  function closeForm() {
    setDraft(null);
    setFormMode(null);
  }

  function submitRole(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft) return;
    const cleaned = cleanRoleDraft(draft);
    if (!cleaned.roleTitle || !cleaned.department || !cleaned.businessArea || !cleaned.recommendations.length) return;
    if (formMode === "add") {
      setRoles((current) => [cleaned, ...current]);
      setSelectedRoleId(cleaned.id);
      setProfileRoleId(cleaned.id);
    } else {
      setRoles((current) => current.map((role) => role.id === cleaned.id ? cleaned : role));
      setSelectedRoleId(cleaned.id);
      setProfileRoleId(cleaned.id);
    }
    closeForm();
  }

  function archiveRole(role: RoleLibraryRole) {
    updateRole(role.id, { status: role.status === "Archived" ? "Active" : "Archived" });
  }

  return (
    <main className="min-h-screen bg-[#f5f7f6] text-[#102c3d]">
      <PlatformTopBar tenantName="Portakabin" tenantSubtitle="Role Library" controlsOnly>
        <div className="grid w-full gap-3 xl:grid-cols-[auto_minmax(300px,1fr)_auto] xl:items-center">
          <div className="flex items-center gap-4">
            <LevyTateLogo className="[--levytate-logo-size:2.35rem]" />
            <div className="hidden h-8 w-px bg-[#102c3d]/10 sm:block" />
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#0b6f63]">Portakabin</p>
              <p className="text-sm font-semibold text-[#102c3d]">Role Library & Pathway Mapping</p>
            </div>
          </div>
          <label className="flex h-11 min-w-0 items-center gap-3 rounded-full border border-[#102c3d]/[0.08] bg-[#f8fbfa] px-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.78)] focus-within:border-[#159b8f] focus-within:bg-white focus-within:ring-4 focus-within:ring-[#159b8f]/10">
            <span className="text-sm text-[#102c3d]/36">Search</span>
            <input value={filters.search} onChange={(event) => updateFilter("search", event.target.value)} className="min-w-0 flex-1 bg-transparent text-sm font-medium text-[#102c3d] outline-none placeholder:text-[#102c3d]/34" placeholder="Role, department, skill, AI tag or progression" />
          </label>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setFilters(defaultRoleLibraryFilters)} className="h-10 rounded-full bg-white px-4 text-xs font-semibold text-[#102c3d]/62 ring-1 ring-[#102c3d]/[0.08] transition hover:text-[#102c3d]">Reset</button>
            <PlatformButton onClick={openAddForm}>Add role</PlatformButton>
          </div>
        </div>
      </PlatformTopBar>

      <div className="mx-auto grid w-full max-w-[1500px] gap-5 px-5 py-5 sm:px-7 lg:px-8">
        {profileRole ? (
          <RoleProfilePage role={profileRole} roles={roles} onBack={() => setProfileRoleId(null)} onEdit={() => openEditForm(profileRole)} onArchive={() => archiveRole(profileRole)} />
        ) : (
          <>
            <section className="rounded-[1rem] border border-[#102c3d]/[0.065] bg-white p-4 shadow-[0_10px_28px_rgba(16,44,61,0.045)]">
              <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#c95568]">Single source of truth</p>
                  <h1 className="mt-1 text-2xl font-semibold tracking-[-0.025em] text-[#102c3d]">Role Library & Pathway Mapping</h1>
                  <p className="mt-1 max-w-3xl text-sm leading-6 text-[#102c3d]/58">Manage role records and the approved apprenticeship recommendations used by employee profiles, pathway discovery and future AI guidance. Generic management routes are retained only as historic records.</p>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-[#102c3d]/52">
                  <span className="rounded-full bg-[#f8fbfa] px-3 py-1.5 ring-1 ring-[#102c3d]/[0.06]">{visibleRoles.length} visible</span>
                  <span className="rounded-full bg-[#f8fbfa] px-3 py-1.5 ring-1 ring-[#102c3d]/[0.06]">{roles.length} total</span>
                </div>
              </div>
              <RoleFiltersBar filters={filters} departments={departments} businessAreas={businessAreas} sites={sites} onFilter={updateFilter} />
            </section>

            <section className="overflow-hidden rounded-[1rem] border border-[#102c3d]/[0.065] bg-white shadow-[0_10px_28px_rgba(16,44,61,0.045)]">
              <RoleTable roles={visibleRoles} selectedRoleId={selectedRole?.id ?? ""} onSelect={(role) => setSelectedRoleId(role.id)} onOpenProfile={(role) => { setSelectedRoleId(role.id); setProfileRoleId(role.id); }} onEdit={openEditForm} onArchive={archiveRole} />
            </section>
          </>
        )}
      </div>

      {draft && formMode ? <RoleFormModal mode={formMode} draft={draft} roles={roles} onDraft={setDraft} onSubmit={submitRole} onClose={closeForm} /> : null}
    </main>
  );
}

function RoleFiltersBar({ filters, departments, businessAreas, sites, onFilter }: { filters: RoleLibraryFilters; departments: string[]; businessAreas: string[]; sites: string[]; onFilter: <K extends keyof RoleLibraryFilters>(key: K, value: RoleLibraryFilters[K]) => void }) {
  return (
    <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
      <FilterSelect label="Status" value={filters.status} options={[allOption, ...statusOptions]} onChange={(value) => onFilter("status", value as RoleLibraryFilters["status"])} />
      <FilterSelect label="Department" value={filters.department} options={[allOption, ...departments]} onChange={(value) => onFilter("department", value)} />
      <FilterSelect label="Business area" value={filters.businessArea} options={[allOption, ...businessAreas]} onChange={(value) => onFilter("businessArea", value)} />
      <FilterSelect label="Career level" value={filters.careerLevel} options={[allOption, ...careerLevelOptions]} onChange={(value) => onFilter("careerLevel", value as RoleLibraryFilters["careerLevel"])} />
      <FilterSelect label="Site" value={filters.site} options={[allOption, ...sites]} onChange={(value) => onFilter("site", value)} />
    </div>
  );
}

function RoleTable({ roles, selectedRoleId, onSelect, onOpenProfile, onEdit, onArchive }: { roles: RoleLibraryRole[]; selectedRoleId: string; onSelect: (role: RoleLibraryRole) => void; onOpenProfile: (role: RoleLibraryRole) => void; onEdit: (role: RoleLibraryRole) => void; onArchive: (role: RoleLibraryRole) => void }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-[1180px] w-full border-collapse text-left text-sm">
        <thead className="bg-[#f8fbfa] text-[10px] font-semibold uppercase tracking-[0.14em] text-[#102c3d]/40">
          <tr><th className="px-4 py-3">Role</th><th className="px-4 py-3">Department</th><th className="px-4 py-3">Business area</th><th className="px-4 py-3">Career level</th><th className="px-4 py-3">Primary pathway</th><th className="px-4 py-3">Mappings</th><th className="px-4 py-3">AI tags</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Actions</th></tr>
        </thead>
        <tbody className="divide-y divide-[#102c3d]/[0.055] bg-white">
          {roles.length ? roles.map((role) => {
            const primary = primaryPathwayFor(role);
            return (
              <tr key={role.id} onClick={() => onSelect(role)} className={`transition hover:bg-[#f8fbfa] ${selectedRoleId === role.id ? "bg-[#f8fbfa]" : ""}`}>
                <td className="px-4 py-3 align-top"><button type="button" onClick={(event) => { event.stopPropagation(); onOpenProfile(role); }} className="text-left"><span className="block font-semibold text-[#102c3d]">{role.roleTitle}</span><span className="mt-1 line-clamp-2 block max-w-[270px] text-xs leading-5 text-[#102c3d]/52">{role.overview}</span></button></td>
                <td className="px-4 py-3 align-top text-[#102c3d]/64">{role.department}</td>
                <td className="px-4 py-3 align-top text-[#102c3d]/64">{role.businessArea}</td>
                <td className="px-4 py-3 align-top"><Pill>{role.careerLevel}</Pill></td>
                <td className="px-4 py-3 align-top"><span className="block max-w-[210px] font-semibold text-[#102c3d]">{primary?.title ?? "No primary pathway"}</span>{primary ? <span className="mt-0.5 block text-xs text-[#102c3d]/48">{primary.level} {primary.standard}</span> : null}</td>
                <td className="px-4 py-3 align-top"><Pill>{role.recommendations.length} mapped</Pill></td>
                <td className="px-4 py-3 align-top"><div className="flex max-w-[220px] flex-wrap gap-1.5">{role.aiTags.slice(0, 3).map((tag) => <Tag key={tag}>{tag}</Tag>)}{role.aiTags.length > 3 ? <Tag>+{role.aiTags.length - 3}</Tag> : null}</div></td>
                <td className="px-4 py-3 align-top"><StatusBadge status={role.status} /></td>
                <td className="px-4 py-3 align-top"><div className="flex justify-end gap-2"><button type="button" onClick={(event) => { event.stopPropagation(); onEdit(role); }} className="rounded-full bg-[#f5f7f3] px-3 py-1.5 text-xs font-semibold text-[#102c3d] ring-1 ring-[#102c3d]/[0.06] transition hover:bg-white">Edit</button><button type="button" onClick={(event) => { event.stopPropagation(); onArchive(role); }} className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-[#102c3d]/58 ring-1 ring-[#102c3d]/[0.08] transition hover:text-[#102c3d]">{role.status === "Archived" ? "Restore" : "Archive"}</button></div></td>
              </tr>
            );
          }) : <tr><td colSpan={9} className="px-4 py-10 text-center text-sm text-[#102c3d]/54">No roles match the current filters.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function RoleProfilePage({ role, roles, onBack, onEdit, onArchive }: { role: RoleLibraryRole; roles: RoleLibraryRole[]; onBack: () => void; onEdit: () => void; onArchive: () => void }) {
  const linkedEmployees = employeeManagementRecords.filter((employee) => employee.assignedRoleId === role.id || employee.role === role.roleTitle);
  const mappedPathways = pathwaysForRole(role, portakabinPathwayStandards);
  const mappedFamilies = new Set(mappedPathways.map((item) => item.family));
  const openApplications = initialRequests.filter((request) => request.role === role.roleTitle || mappedPathways.some((pathway) => request.pathway.includes(pathway.family) || request.pathway.includes(pathway.title)));
  const currentLearners = portakabinLearners.filter((learner) => learner.role === role.roleTitle || mappedFamilies.has(learner.programme));
  const futureProgressionRoles = role.futureProgressionRoleIds.map((id) => roleById(roles, id)?.roleTitle).filter(Boolean);

  return (
    <section className="grid gap-5">
      <div className="rounded-[1rem] border border-[#102c3d]/[0.065] bg-white p-4 shadow-[0_10px_28px_rgba(16,44,61,0.045)]">
        <button type="button" onClick={onBack} className="text-xs font-semibold text-[#102c3d]/54 transition hover:text-[#102c3d]">Back to role library</button>
        <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#c95568]">Role profile</p><h1 className="mt-1 text-3xl font-semibold tracking-[-0.03em] text-[#102c3d]">{role.roleTitle}</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-[#102c3d]/60">{role.overview}</p><div className="mt-3 flex flex-wrap gap-2"><Pill>{role.department}</Pill><Pill>{role.businessArea}</Pill><Pill>{role.careerLevel}</Pill></div></div>
          <div className="flex flex-wrap gap-2"><StatusBadge status={role.status} /><button type="button" onClick={onEdit} className="h-10 rounded-full bg-[#102c3d] px-4 text-xs font-semibold text-white shadow-[0_10px_22px_rgba(16,44,61,0.12)] transition hover:-translate-y-0.5">Edit role</button><button type="button" onClick={onArchive} className="h-10 rounded-full bg-white px-4 text-xs font-semibold text-[#102c3d]/58 ring-1 ring-[#102c3d]/[0.08] transition hover:text-[#102c3d]">{role.status === "Archived" ? "Restore" : "Archive"}</button></div>
        </div>
      </div>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="grid gap-5">
          <Panel eyebrow="Pathway mapping" title="Recommended pathways"><div className="grid gap-3">{mappedPathways.map((pathway) => <article key={pathway.mapping.id} className="rounded-2xl border border-[#102c3d]/[0.055] bg-[#f8fbfa] p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex flex-wrap gap-2"><Pill>{pathway.mapping.recommendationType}</Pill><Pill>Priority {pathway.mapping.priority}</Pill></div><h2 className="mt-3 text-lg font-semibold text-[#102c3d]">{pathway.title}</h2><p className="mt-1 text-sm text-[#102c3d]/58">{pathway.level} {pathway.standard} | {pathway.family}</p></div><Pill>{pathway.mapping.deliveryPreference}</Pill></div><p className="mt-3 text-sm leading-6 text-[#102c3d]/62">{pathway.mapping.businessRationale}</p><div className="mt-3 grid gap-2 sm:grid-cols-2"><ProfileFact label="Funding route" value={pathway.mapping.fundingRoute} /><ProfileFact label="Duration" value={pathway.typicalDuration} /></div></article>)}</div></Panel>
          <Panel eyebrow="Role outcomes" title="Business outcomes and typical skills"><div className="grid gap-4 lg:grid-cols-2"><InfoList title="Business outcomes" items={role.businessOutcomes} /><InfoList title="Typical skills" items={role.skillsTags} /></div></Panel>
        </section>
        <aside className="grid h-fit gap-5">
          <Panel eyebrow="Role intelligence" title="Linked activity"><div className="grid gap-3"><ProfileFact label="Linked employees" value={String(linkedEmployees.length)} /><ProfileFact label="Open applications" value={String(openApplications.length)} /><ProfileFact label="Current learners" value={String(currentLearners.length)} /></div></Panel>
          <Panel eyebrow="Progression" title="Future roles"><InfoList title="Typical progression" items={role.typicalProgression} />{futureProgressionRoles.length ? <div className="mt-4"><InfoList title="Linked progression roles" items={futureProgressionRoles as string[]} /></div> : null}</Panel>
          <Panel eyebrow="AI metadata" title="Structured tags"><div className="flex flex-wrap gap-2">{role.aiTags.map((tag) => <Tag key={tag}>{tag}</Tag>)}</div></Panel>
        </aside>
      </div>
    </section>
  );
}

function RoleFormModal({ mode, draft, roles, onDraft, onSubmit, onClose }: { mode: FormMode; draft: RoleLibraryRole; roles: RoleLibraryRole[]; onDraft: (role: RoleLibraryRole) => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void; onClose: () => void }) {
  const roleTitleExists = draft.roleTitle ? roles.some((role) => role.id !== draft.id && role.roleTitle.toLowerCase() === draft.roleTitle.toLowerCase()) : false;

  function updateMapping(mappingId: string, updates: Partial<RolePathwayMapping>) {
    onDraft({ ...draft, recommendations: draft.recommendations.map((mapping) => mapping.id === mappingId ? { ...mapping, ...updates } : mapping) });
  }

  function addMapping() {
    onDraft({ ...draft, recommendations: [...draft.recommendations, createMapping(portakabinPathwayStandards[0].id, "Alternative", draft.recommendations.length + 1)] });
  }

  function removeMapping(mappingId: string) {
    const next = draft.recommendations.filter((mapping) => mapping.id !== mappingId);
    onDraft({ ...draft, recommendations: next.length ? next : [createMapping(portakabinPathwayStandards[0].id, "Primary", 1)] });
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[#102c3d]/30 px-4 py-8 backdrop-blur-sm">
      <form onSubmit={onSubmit} className="max-h-[92vh] w-full max-w-6xl overflow-y-auto rounded-[1.25rem] bg-white p-5 shadow-[0_30px_90px_rgba(16,44,61,0.24)]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#c95568]">{mode === "add" ? "Add role" : "Edit role"}</p><h2 className="mt-1 text-2xl font-semibold tracking-[-0.025em] text-[#102c3d]">{mode === "add" ? "Create role record" : draft.roleTitle}</h2></div>
          <button type="button" onClick={onClose} className="h-10 rounded-full bg-[#f5f7f3] px-4 text-xs font-semibold text-[#102c3d] ring-1 ring-[#102c3d]/[0.06]">Close</button>
        </div>
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <FormField label="Role title" value={draft.roleTitle} onChange={(value) => onDraft({ ...draft, roleTitle: value })} required error={roleTitleExists ? "Role title already exists" : undefined} />
          <FormSelect label="Career level" value={draft.careerLevel} options={careerLevelOptions} onChange={(value) => onDraft({ ...draft, careerLevel: value as CareerLevel })} />
          <FormField label="Department" value={draft.department} onChange={(value) => onDraft({ ...draft, department: value })} required />
          <FormField label="Business area" value={draft.businessArea} onChange={(value) => onDraft({ ...draft, businessArea: value })} required />
          <FormField label="Site applicability" value={draft.siteApplicability.join(", ")} onChange={(value) => onDraft({ ...draft, siteApplicability: splitList(value) })} />
          <FormSelect label="Record status" value={draft.status} options={statusOptions} onChange={(value) => onDraft({ ...draft, status: value as RoleRecordStatus })} />
          <FormField label="Typical progression" value={draft.typicalProgression.join(", ")} onChange={(value) => onDraft({ ...draft, typicalProgression: splitList(value) })} />
          <FormField label="Skills tags" value={draft.skillsTags.join(", ")} onChange={(value) => onDraft({ ...draft, skillsTags: splitList(value) })} />
          <FormField label="Business outcomes" value={draft.businessOutcomes.join(", ")} onChange={(value) => onDraft({ ...draft, businessOutcomes: splitList(value) })} />
          <FormField label="Future progression role IDs" value={draft.futureProgressionRoleIds.join(", ")} onChange={(value) => onDraft({ ...draft, futureProgressionRoleIds: splitList(value) })} />
        </div>
        <label className="mt-4 grid gap-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-[#102c3d]/42">Role overview<textarea value={draft.overview} onChange={(event) => onDraft({ ...draft, overview: event.target.value })} rows={3} className="rounded-xl border border-[#102c3d]/[0.08] bg-[#f8fbfa] px-3 py-3 text-sm font-medium normal-case tracking-normal text-[#102c3d] outline-none transition focus:border-[#159b8f] focus:bg-white focus:ring-4 focus:ring-[#159b8f]/10" /></label>
        <div className="mt-5 rounded-2xl border border-[#102c3d]/[0.065] bg-[#f8fbfa] p-4">
          <div className="flex items-center justify-between gap-3"><div><p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#c95568]">Pathway mapping</p><h3 className="mt-1 text-lg font-semibold text-[#102c3d]">Primary and alternative pathways</h3></div><button type="button" onClick={addMapping} className="h-9 rounded-full bg-white px-3 text-xs font-semibold text-[#102c3d] ring-1 ring-[#102c3d]/[0.08] transition hover:bg-[#102c3d] hover:text-white">Add mapping</button></div>
          <div className="mt-4 grid gap-3">
            {draft.recommendations.map((mapping) => <article key={mapping.id} className="rounded-2xl bg-white p-3 ring-1 ring-[#102c3d]/[0.06]"><div className="grid gap-3 lg:grid-cols-[minmax(220px,1fr)_150px_110px_180px_160px_auto] lg:items-end"><FormSelect label="Pathway" value={mapping.pathwayId} options={portakabinPathwayStandards.map((pathway) => pathway.id)} optionLabels={pathwayLabelMap(portakabinPathwayStandards)} onChange={(value) => updateMapping(mapping.id, { pathwayId: value })} /><FormSelect label="Type" value={mapping.recommendationType} options={["Primary", "Alternative"]} onChange={(value) => updateMapping(mapping.id, { recommendationType: value as RolePathwayMapping["recommendationType"] })} /><FormField label="Priority" value={String(mapping.priority)} onChange={(value) => updateMapping(mapping.id, { priority: Number(value) || 1 })} type="number" /><FormSelect label="Funding route" value={mapping.fundingRoute} options={fundingRouteOptions} onChange={(value) => updateMapping(mapping.id, { fundingRoute: value as FundingRoute })} /><FormSelect label="Delivery" value={mapping.deliveryPreference} options={deliveryPreferenceOptions} onChange={(value) => updateMapping(mapping.id, { deliveryPreference: value as DeliveryPreference })} /><button type="button" onClick={() => removeMapping(mapping.id)} className="h-10 rounded-full bg-[#f5f7f3] px-3 text-xs font-semibold text-[#102c3d]/58 ring-1 ring-[#102c3d]/[0.06] transition hover:text-[#102c3d]">Remove</button></div><div className="mt-3 grid gap-3 lg:grid-cols-2"><FormField label="Business rationale" value={mapping.businessRationale} onChange={(value) => updateMapping(mapping.id, { businessRationale: value })} /><FormField label="Internal notes" value={mapping.internalNotes} onChange={(value) => updateMapping(mapping.id, { internalNotes: value })} /></div></article>)}
          </div>
        </div>
        <div className="mt-5 rounded-2xl border border-[#102c3d]/[0.065] bg-[#f8fbfa] p-4"><p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#c95568]">AI tags</p><div className="mt-3 flex flex-wrap gap-2">{roleCapabilityTags.map((tag) => { const active = draft.aiTags.includes(tag); return <button key={tag} type="button" onClick={() => onDraft({ ...draft, aiTags: toggleTag(draft.aiTags, tag) })} className={`rounded-full px-3 py-1.5 text-xs font-semibold ring-1 transition ${active ? "bg-[#102c3d] text-white ring-[#102c3d]" : "bg-white text-[#102c3d]/58 ring-[#102c3d]/[0.08] hover:text-[#102c3d]"}`}>{tag}</button>; })}</div></div>
        <div className="mt-5 flex items-center justify-between gap-3 rounded-2xl bg-[#f8fbfa] px-4 py-3"><p className="text-sm text-[#102c3d]/58">Role records own recommendations. Employee pages resolve pathways from the assigned role.</p><button disabled={roleTitleExists || !draft.roleTitle.trim() || !draft.recommendations.length} className="h-10 rounded-full bg-[#102c3d] px-5 text-xs font-semibold text-white transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:bg-[#102c3d]/30">Save role</button></div>
      </form>
    </div>
  );
}

function FilterSelect({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return <label className="grid gap-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-[#102c3d]/38">{label}<select value={value} onChange={(event) => onChange(event.target.value)} className="h-10 min-w-0 rounded-xl border border-[#102c3d]/[0.08] bg-white px-3 text-sm font-semibold normal-case tracking-normal text-[#102c3d]/72 outline-none transition focus:border-[#159b8f] focus:ring-4 focus:ring-[#159b8f]/10">{options.map((option) => <option key={option}>{option}</option>)}</select></label>;
}

function FormField({ label, value, onChange, required = false, type = "text", error }: { label: string; value: string; onChange: (value: string) => void; required?: boolean; type?: string; error?: string }) {
  return <label className="grid gap-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-[#102c3d]/42">{label}<input type={type} value={value} required={required} onChange={(event) => onChange(event.target.value)} className="h-11 rounded-xl border border-[#102c3d]/[0.08] bg-[#f8fbfa] px-3 text-sm font-medium normal-case tracking-normal text-[#102c3d] outline-none transition focus:border-[#159b8f] focus:bg-white focus:ring-4 focus:ring-[#159b8f]/10" />{error ? <span className="text-xs font-semibold normal-case tracking-normal text-[#ad344e]">{error}</span> : null}</label>;
}

function FormSelect({ label, value, options, onChange, optionLabels }: { label: string; value: string; options: string[]; onChange: (value: string) => void; optionLabels?: Record<string, string> }) {
  return <label className="grid gap-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-[#102c3d]/42">{label}<select value={value} onChange={(event) => onChange(event.target.value)} className="h-11 rounded-xl border border-[#102c3d]/[0.08] bg-[#f8fbfa] px-3 text-sm font-medium normal-case tracking-normal text-[#102c3d] outline-none transition focus:border-[#159b8f] focus:bg-white focus:ring-4 focus:ring-[#159b8f]/10">{options.map((option) => <option key={option} value={option}>{optionLabels?.[option] ?? option}</option>)}</select></label>;
}

function Panel({ eyebrow, title, children }: { eyebrow: string; title: string; children: ReactNode }) {
  return <section className="rounded-[1rem] border border-[#102c3d]/[0.065] bg-white p-4 shadow-[0_10px_28px_rgba(16,44,61,0.045)]"><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#c95568]">{eyebrow}</p><h2 className="mt-1 text-lg font-semibold text-[#102c3d]">{title}</h2><div className="mt-4">{children}</div></section>;
}

function InfoList({ title, items }: { title: string; items: string[] }) {
  return <div><p className="text-xs font-semibold text-[#102c3d]">{title}</p><ul className="mt-3 grid gap-2">{items.length ? items.map((item) => <li key={item} className="rounded-xl bg-[#f8fbfa] px-3 py-2 text-sm leading-5 text-[#102c3d]/66">{item}</li>) : <li className="rounded-xl bg-[#f8fbfa] px-3 py-2 text-sm text-[#102c3d]/46">No entries recorded.</li>}</ul></div>;
}

function StatusBadge({ status }: { status: RoleRecordStatus }) {
  const active = status === "Active";
  return <span className={`inline-flex w-fit rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ${active ? "bg-[#edf8f5] text-[#0b6f63] ring-[#159b8f]/[0.14]" : "bg-[#f4f1ee] text-[#8b6f54] ring-[#8b6f54]/[0.12]"}`}>{status}</span>;
}

function ProfileFact({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-[#f8fbfa] px-3 py-2.5"><dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#102c3d]/36">{label}</dt><dd className="mt-1 text-sm font-semibold text-[#102c3d]">{value}</dd></div>;
}

function Pill({ children }: { children: ReactNode }) {
  return <span className="inline-flex w-fit rounded-full bg-[#f5f7f3] px-3 py-1.5 text-xs font-semibold text-[#102c3d]/62 ring-1 ring-[#102c3d]/[0.06]">{children}</span>;
}

function Tag({ children }: { children: ReactNode }) {
  return <span className="inline-flex w-fit rounded-full bg-[#fff4bd] px-2.5 py-1 text-[11px] font-semibold text-[#7b6100] ring-1 ring-[#8a6a00]/[0.08]">{children}</span>;
}

function primaryPathwayFor(role: RoleLibraryRole) {
  const primary = orderedRoleRecommendations(role).find((mapping) => mapping.recommendationType === "Primary") ?? orderedRoleRecommendations(role)[0];
  return primary ? portakabinPathwayStandards.find((pathway) => pathway.id === primary.pathwayId) : undefined;
}

function createMapping(pathwayId: string, recommendationType: RolePathwayMapping["recommendationType"], priority: number): RolePathwayMapping {
  return { id: `rpm-${Date.now()}-${Math.random().toString(16).slice(2, 7)}`, pathwayId, recommendationType, priority, businessRationale: "Supports role capability and future progression.", fundingRoute: "Potentially levy-funded", deliveryPreference: "Blended", internalNotes: "Confirm cohort timing, provider fit and manager support before launch." };
}

function cleanRoleDraft(role: RoleLibraryRole): RoleLibraryRole {
  const sortedRecommendations = [...role.recommendations].map((mapping, index) => ({ ...mapping, priority: Number(mapping.priority) || index + 1 })).sort((a, b) => a.priority - b.priority);
  return { ...role, roleTitle: role.roleTitle.trim(), department: role.department.trim(), businessArea: role.businessArea.trim(), overview: role.overview.trim(), siteApplicability: role.siteApplicability.length ? role.siteApplicability : ["All sites"], recommendations: sortedRecommendations, aiTags: role.aiTags.length ? role.aiTags : ["Operational"], lastUpdated: todayStamp() };
}

function cloneRole(role: RoleLibraryRole): RoleLibraryRole {
  return { ...role, siteApplicability: [...role.siteApplicability], typicalProgression: [...role.typicalProgression], futureProgressionRoleIds: [...role.futureProgressionRoleIds], skillsTags: [...role.skillsTags], aiTags: [...role.aiTags], businessOutcomes: [...role.businessOutcomes], recommendations: role.recommendations.map((mapping) => ({ ...mapping })) };
}

function splitList(value: string) {
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

function toggleTag(tags: RoleCapabilityTag[], tag: RoleCapabilityTag) {
  return tags.includes(tag) ? tags.filter((item) => item !== tag) : [...tags, tag];
}

function pathwayLabelMap(pathways: ApprenticeshipPathway[]) {
  return Object.fromEntries(pathways.map((pathway) => [pathway.id, `${pathway.title} (${pathway.family})${pathway.availableForNewApplications === false ? " - historic only" : ""}`]));
}

function todayStamp() {
  return new Date().toISOString().slice(0, 10);
}
