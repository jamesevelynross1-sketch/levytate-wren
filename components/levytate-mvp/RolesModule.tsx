"use client";

import { useMemo, useState, type FormEvent } from "react";
import { getApprenticeshipStandard } from "@/lib/levytate/domain";
import { EmptyState, FormActions, FormField, FormGrid, FormSelect, FormTextArea, MvpModal, MvpPanel, MvpToolbar, StatusBadge, TableAction, TableBody, TableHead, TableShell } from "@/components/levytate-mvp/MvpUi";
import { useLevyTateStandards } from "@/components/levytate-mvp/LevyTateStandardsProvider";
import { useMvpWorkspace } from "@/components/levytate-mvp/MvpWorkspaceStore";
import { includesSearch } from "@/components/levytate-mvp/module-utils";
import { createMvpId, nowIso, splitMvpList, type MvpRole } from "@/lib/levytate/mvp/workspace";

const careerLevels = ["Entry", "Experienced", "Supervisor", "Manager", "Senior Manager"];

export function RolesModule() {
  const { data, saveRole, archiveRole } = useMvpWorkspace();
  const { liveStandards } = useLevyTateStandards();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("Active");
  const [draft, setDraft] = useState<MvpRole | null>(null);
  const [primaryStandardId, setPrimaryStandardId] = useState("");
  const [alternativeStandardId, setAlternativeStandardId] = useState("");
  const [rationale, setRationale] = useState("");
  const [error, setError] = useState("");
  const visible = data.roles.filter((role) => (status === "All" || role.status === status) && includesSearch([role.title, role.department, role.businessArea, role.skillsTags.join(" ")], search));
  const standardOptions = useMemo(() => liveStandards.map((standard) => ({ value: standard.id, label: `Level ${standard.level} · ${standard.title} · ${standard.referenceCode}` })), [liveStandards]);

  function open(role?: MvpRole) {
    const now = nowIso();
    const next: MvpRole = role ? structuredClone(role) : { id: createMvpId("role"), title: "", department: "", businessArea: "", careerLevel: "Entry", skillsTags: [], progression: [], pathwayMappings: [], status: "Active", createdAt: now, updatedAt: now };
    setDraft(next);
    setPrimaryStandardId(next.pathwayMappings.find((item) => item.recommendationType === "Primary")?.apprenticeshipStandardId ?? "");
    setAlternativeStandardId(next.pathwayMappings.find((item) => item.recommendationType === "Alternative")?.apprenticeshipStandardId ?? "");
    setRationale(next.pathwayMappings.find((item) => item.recommendationType === "Primary")?.businessRationale ?? "");
    setError("");
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!draft) return;
    if (!draft.title.trim() || !draft.department.trim() || !primaryStandardId) {
      setError("Role title, department and primary apprenticeship standard are required.");
      return;
    }
    const mappings = [
      { id: createMvpId("mapping"), apprenticeshipStandardId: primaryStandardId, recommendationType: "Primary" as const, priority: 1, businessRationale: rationale.trim() || "Primary role-led pathway mapping.", fundingRoute: "Potentially funded through levy/co-investment" as const, deliveryPreference: "Blended" as const },
      ...(alternativeStandardId && alternativeStandardId !== primaryStandardId ? [{ id: createMvpId("mapping"), apprenticeshipStandardId: alternativeStandardId, recommendationType: "Alternative" as const, priority: 2, businessRationale: "Alternative role-led pathway.", fundingRoute: "Potentially funded through levy/co-investment" as const, deliveryPreference: "Blended" as const }] : []),
    ];
    saveRole({ ...draft, title: draft.title.trim(), department: draft.department.trim(), pathwayMappings: mappings, updatedAt: nowIso() });
    setDraft(null);
  }

  return <MvpPanel title="Role library" eyebrow="Standards-led pathway source of truth"><MvpToolbar search={search} onSearch={setSearch} placeholder="Search roles, departments or skills" actionLabel="Add role" onAction={() => open()} filters={<select value={status} onChange={(event) => setStatus(event.target.value)} className="h-10 rounded-lg border border-[#102c3d]/[0.09] bg-white px-3 text-sm font-semibold"><option>Active</option><option>Archived</option><option>All</option></select>} />{visible.length ? <TableShell><TableHead><tr><th className="px-4 py-3">Role</th><th className="px-4 py-3">Department</th><th className="px-4 py-3">Career level</th><th className="px-4 py-3">Primary pathway</th><th className="px-4 py-3">Linked employees</th><th className="px-4 py-3 text-right">Actions</th></tr></TableHead><TableBody>{visible.map((role) => { const mapping = role.pathwayMappings.find((item) => item.recommendationType === "Primary"); const standard = mapping ? getApprenticeshipStandard(mapping.apprenticeshipStandardId) : undefined; return <tr key={role.id}><td className="px-4 py-3"><p className="font-semibold">{role.title}</p><p className="mt-0.5 text-xs text-[#102c3d]/48">{role.businessArea || "Business area not set"}</p></td><td className="px-4 py-3 text-[#102c3d]/62">{role.department}</td><td className="px-4 py-3"><StatusBadge>{role.careerLevel}</StatusBadge></td><td className="px-4 py-3"><p className="text-[#102c3d]/68">{standard?.title ?? "Not mapped"}</p>{standard ? <p className="mt-0.5 text-xs text-[#102c3d]/42">{standard.referenceCode}</p> : null}</td><td className="px-4 py-3 text-[#102c3d]/62">{data.employees.filter((employee) => employee.roleId === role.id).length}</td><td className="px-4 py-3"><div className="flex justify-end gap-2"><TableAction onClick={() => open(role)}>Edit</TableAction><TableAction onClick={() => archiveRole(role.id)} danger={role.status === "Active"}>{role.status === "Archived" ? "Restore" : "Archive"}</TableAction></div></td></tr>; })}</TableBody></TableShell> : <EmptyState title="No roles yet" copy="Add a role and map it to official apprenticeship standards." actionLabel="Add role" onAction={() => open()} />}{draft ? <MvpModal title={data.roles.some((item) => item.id === draft.id) ? "Edit role" : "Add role"} onClose={() => setDraft(null)} wide><form onSubmit={submit}><FormGrid><FormField label="Role title" value={draft.title} onChange={(value) => setDraft({ ...draft, title: value })} required /><FormField label="Department" value={draft.department} onChange={(value) => setDraft({ ...draft, department: value })} required /><FormField label="Business area" value={draft.businessArea} onChange={(value) => setDraft({ ...draft, businessArea: value })} /><FormSelect label="Career level" value={draft.careerLevel} onChange={(value) => setDraft({ ...draft, careerLevel: value as MvpRole["careerLevel"] })} options={careerLevels} /><FormField label="Skills tags" value={draft.skillsTags.join(", ")} onChange={(value) => setDraft({ ...draft, skillsTags: splitMvpList(value) })} wide /><FormField label="Typical progression" value={draft.progression.join(", ")} onChange={(value) => setDraft({ ...draft, progression: splitMvpList(value) })} wide /><FormSelect label="Primary apprenticeship standard" value={primaryStandardId} onChange={setPrimaryStandardId} required wide options={[{ value: "", label: "Select official standard" }, ...standardOptions]} /><FormSelect label="Alternative apprenticeship standard" value={alternativeStandardId} onChange={setAlternativeStandardId} wide options={[{ value: "", label: "No alternative selected" }, ...standardOptions]} /><FormTextArea label="Business rationale" value={rationale} onChange={setRationale} wide /></FormGrid><FormActions onCancel={() => setDraft(null)} label="Save role" error={error} /></form></MvpModal> : null}</MvpPanel>;
}
