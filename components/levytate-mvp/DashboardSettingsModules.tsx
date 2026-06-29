"use client";

import { useEffect, useState, type FormEvent } from "react";
import { FormField, FormGrid, MvpPanel } from "@/components/levytate-mvp/MvpUi";
import { useMvpWorkspace } from "@/components/levytate-mvp/MvpWorkspaceStore";
import { splitMvpList, type MvpWorkspaceProfile } from "@/lib/levytate/mvp/workspace";

export function DashboardModule({ onNavigate }: { onNavigate: (module: string) => void }) {
  const { data } = useMvpWorkspace();
  const items = [
    ["Employees", data.employees.filter((item) => item.status === "Active").length, "Manage workforce records", "Employees"],
    ["Roles", data.roles.filter((item) => item.status === "Active").length, "Map role-led pathways", "Roles"],
    ["Applications", data.applications.length, "Track approval workflows", "Applications"],
    ["Enrolments", data.enrolments.length, "Manage approved starts", "Enrolments"],
  ] as const;
  return <div className="grid gap-5"><section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">{items.map(([label, value, copy, target]) => <button key={label} onClick={() => onNavigate(target)} className="rounded-xl border border-[#102c3d]/[0.075] bg-white p-4 text-left shadow-[0_14px_36px_rgba(16,44,61,0.045)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_42px_rgba(16,44,61,0.075)]"><p className="text-xs font-semibold text-[#102c3d]/48">{label}</p><p className="mt-2 text-3xl font-semibold tracking-[-0.04em]">{value}</p><p className="mt-2 text-xs text-[#102c3d]/52">{copy}</p></button>)}</section><MvpPanel title="Workspace setup" eyebrow="MVP foundation"><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">{["Set employer profile", "Create role library", "Add employees", "Start approval workflows"].map((item, index) => <div key={item} className="rounded-xl bg-[#f8fbfa] px-4 py-3 ring-1 ring-[#102c3d]/[0.055]"><p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#0b6f63]">Step {index + 1}</p><p className="mt-1 text-sm font-semibold">{item}</p></div>)}</div></MvpPanel></div>;
}

export function SettingsModule() {
  const { data, saveProfile } = useMvpWorkspace();
  const [draft, setDraft] = useState<MvpWorkspaceProfile>(data.profile);
  const [saved, setSaved] = useState(false);
  useEffect(() => { setDraft(data.profile); }, [data.profile]);
  function submit(event: FormEvent) { event.preventDefault(); saveProfile({ ...draft, sites: splitMvpList(draft.sites.join(", ")), departments: splitMvpList(draft.departments.join(", ")) }); setSaved(true); }
  return <MvpPanel title="Workspace settings" eyebrow="Employer configuration"><form onSubmit={submit}><FormGrid><FormField label="Employer name" value={draft.employerName} onChange={(value) => setDraft({ ...draft, employerName: value })} /><FormField label="Workspace name" value={draft.workspaceName} onChange={(value) => setDraft({ ...draft, workspaceName: value })} required /><FormField label="Primary contact" value={draft.primaryContact} onChange={(value) => setDraft({ ...draft, primaryContact: value })} /><FormField label="Contact email" type="email" value={draft.contactEmail} onChange={(value) => setDraft({ ...draft, contactEmail: value })} /><FormField label="Default site" value={draft.defaultSite} onChange={(value) => setDraft({ ...draft, defaultSite: value })} /><FormField label="Sites" value={draft.sites.join(", ")} onChange={(value) => setDraft({ ...draft, sites: splitMvpList(value) })} /><FormField label="Departments" value={draft.departments.join(", ")} onChange={(value) => setDraft({ ...draft, departments: splitMvpList(value) })} wide /></FormGrid><div className="mt-5 flex items-center justify-between border-t border-[#102c3d]/[0.07] pt-4">{saved ? <p className="text-xs font-semibold text-[#0b6f63]">Workspace settings saved locally.</p> : <span />}<button className="h-10 rounded-full bg-[#102c3d] px-5 text-xs font-semibold text-white">Save settings</button></div></form></MvpPanel>;
}