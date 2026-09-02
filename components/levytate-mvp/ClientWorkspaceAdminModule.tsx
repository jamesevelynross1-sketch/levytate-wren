"use client";

import { Building2, Plus, RefreshCw, UserPlus } from "lucide-react";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { FormActions, FormField, FormGrid, FormSelect, MvpModal, MvpPanel } from "@/components/levytate-mvp/MvpUi";
import type { MvpUserRole } from "@/lib/levytate/mvp/rbac";

type ClientUser = { id: string; email: string; displayName: string; role: MvpUserRole; active: boolean; authBindingStatus: string };
type ClientWorkspace = { id: string; name: string; slug: string; workspaceName: string; status: string; createdAt: string; users: ClientUser[] };
const employerRoles: MvpUserRole[] = ["Employer Admin", "Apprenticeship Lead", "Line Manager", "Employee"];

export function ClientWorkspaceAdminModule() {
  const [workspaces, setWorkspaces] = useState<ClientWorkspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [workspaceDraft, setWorkspaceDraft] = useState<{ name: string; workspaceName: string; primaryContact: string; contactEmail: string; initialRole: MvpUserRole } | null>(null);
  const [userDraft, setUserDraft] = useState<{ organisationId: string; displayName: string; email: string; role: MvpUserRole } | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/levytate-platform/workspaces", { cache: "no-store" });
      const payload = await response.json() as { workspaces?: ClientWorkspace[]; message?: string };
      if (!response.ok) throw new Error(payload.message || "Client workspaces could not be loaded.");
      setWorkspaces(payload.workspaces ?? []);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Client workspaces could not be loaded."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function createWorkspace(event: FormEvent) {
    event.preventDefault(); if (!workspaceDraft) return; setBusy("workspace"); setError("");
    try {
      const response = await fetch("/api/levytate-platform/workspaces", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "create_workspace", ...workspaceDraft }) });
      const payload = await response.json() as { workspace?: ClientWorkspace; message?: string };
      if (!response.ok || !payload.workspace) throw new Error(payload.message || "The client workspace could not be created.");
      setWorkspaces((current) => [payload.workspace!, ...current]); setWorkspaceDraft(null);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "The client workspace could not be created."); }
    finally { setBusy(""); }
  }

  async function provisionUser(event: FormEvent) {
    event.preventDefault(); if (!userDraft) return; setBusy("user"); setError("");
    try {
      const response = await fetch("/api/levytate-platform/workspaces", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "provision_user", ...userDraft }) });
      const payload = await response.json() as { user?: ClientUser; message?: string };
      if (!response.ok || !payload.user) throw new Error(payload.message || "The client workspace user could not be provisioned.");
      setWorkspaces((current) => current.map((workspace) => workspace.id === userDraft.organisationId ? { ...workspace, users: [...workspace.users, payload.user!] } : workspace)); setUserDraft(null);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "The client workspace user could not be provisioned."); }
    finally { setBusy(""); }
  }

  async function updateUser(user: ClientUser, role: MvpUserRole, active: boolean) {
    setBusy(user.id); setError("");
    try {
      const response = await fetch("/api/levytate-platform/workspaces", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: user.id, role, active }) });
      const payload = await response.json() as { user?: ClientUser; message?: string };
      if (!response.ok || !payload.user) throw new Error(payload.message || "The client workspace user could not be updated.");
      setWorkspaces((current) => current.map((workspace) => ({ ...workspace, users: workspace.users.map((candidate) => candidate.id === user.id ? payload.user! : candidate) })));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "The client workspace user could not be updated."); }
    finally { setBusy(""); }
  }

  return (
    <MvpPanel title="Client workspaces" eyebrow="Controlled provisioning" actions={<div className="flex flex-wrap gap-2"><button type="button" onClick={() => void load()} disabled={loading} className="inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-xs font-semibold ring-1 ring-[#102c3d]/[0.1]"><RefreshCw size={14} className={loading ? "animate-spin" : ""} />Refresh</button><button type="button" onClick={() => setWorkspaceDraft({ name: "", workspaceName: "", primaryContact: "", contactEmail: "", initialRole: "Apprenticeship Lead" })} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[#102c3d] px-4 text-xs font-semibold text-white"><Plus size={14} />Create employer</button></div>}>
      <p className="mb-4 max-w-3xl text-sm leading-6 text-[#102c3d]/[0.58]">Create a blank private employer workspace, then provision individual passwordless users. No authentication email is sent from this screen.</p>
      {error ? <p role="alert" className="mb-4 rounded-xl bg-[#fff2f3] px-4 py-3 text-sm font-semibold text-[#a93d52]">{error}</p> : null}
      {loading ? <p className="py-8 text-center text-sm text-[#102c3d]/[0.48]">Loading client workspaces…</p> : workspaces.length ? <div className="grid gap-4">{workspaces.map((workspace) => <article key={workspace.id} className="rounded-2xl border border-[#102c3d]/[0.08] bg-[#f9fbfa] p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="flex items-center gap-2 text-sm font-semibold"><Building2 size={16} className="text-[#0b8e82]" />{workspace.name}</p><p className="mt-1 text-xs text-[#102c3d]/[0.48]">{workspace.workspaceName} · {workspace.users.length} authorised user{workspace.users.length === 1 ? "" : "s"}</p></div><button type="button" onClick={() => setUserDraft({ organisationId: workspace.id, displayName: "", email: "", role: "Employee" })} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-white px-4 text-xs font-semibold ring-1 ring-[#102c3d]/[0.1]"><UserPlus size={14} />Provision user</button></div><div className="mt-4 grid gap-2">{workspace.users.map((user) => <div key={user.id} className="grid gap-2 rounded-xl bg-white p-3 sm:grid-cols-[minmax(0,1fr)_180px_auto] sm:items-center"><div className="min-w-0"><p className="truncate text-sm font-semibold">{user.displayName || user.email}</p><p className="truncate text-xs text-[#102c3d]/[0.48]">{user.email} · {user.authBindingStatus.replaceAll("_", " ")}</p></div><select aria-label={`Role for ${user.displayName || user.email}`} value={user.role} disabled={busy === user.id} onChange={(event) => void updateUser(user, event.target.value as MvpUserRole, user.active)} className="min-h-11 rounded-xl border border-[#102c3d]/[0.1] bg-white px-3 text-xs font-semibold">{employerRoles.map((role) => <option key={role}>{role}</option>)}</select><button type="button" disabled={busy === user.id} onClick={() => void updateUser(user, user.role, !user.active)} className={`min-h-11 rounded-full px-4 text-xs font-semibold ${user.active ? "text-[#a93d52] ring-1 ring-[#a93d52]/20" : "bg-[#102c3d] text-white"}`}>{user.active ? "Revoke access" : "Reactivate"}</button></div>)}</div></article>)}</div> : <p className="rounded-xl border border-dashed border-[#102c3d]/[0.14] py-8 text-center text-sm text-[#102c3d]/[0.48]">No Client V1 employer workspaces have been created yet.</p>}

      {workspaceDraft ? <MvpModal title="Create employer workspace" eyebrow="Blank Client V1 workspace" onClose={() => setWorkspaceDraft(null)}><form onSubmit={(event) => void createWorkspace(event)}><FormGrid><FormField label="Organisation name" value={workspaceDraft.name} onChange={(name) => setWorkspaceDraft({ ...workspaceDraft, name })} required /><FormField label="Workspace name" value={workspaceDraft.workspaceName} onChange={(workspaceName) => setWorkspaceDraft({ ...workspaceDraft, workspaceName })} placeholder="Defaults from organisation name" /><FormField label="Primary contact" value={workspaceDraft.primaryContact} onChange={(primaryContact) => setWorkspaceDraft({ ...workspaceDraft, primaryContact })} required /><FormField label="Primary contact email" type="email" value={workspaceDraft.contactEmail} onChange={(contactEmail) => setWorkspaceDraft({ ...workspaceDraft, contactEmail })} required /><FormSelect label="Initial role" value={workspaceDraft.initialRole} onChange={(initialRole) => setWorkspaceDraft({ ...workspaceDraft, initialRole: initialRole as MvpUserRole })} options={[{ value: "Apprenticeship Lead", label: "Apprenticeship Lead" }, { value: "Employer Admin", label: "Employer Admin" }]} /></FormGrid><FormActions label={busy === "workspace" ? "Creating…" : "Create blank workspace"} onCancel={() => setWorkspaceDraft(null)} error={error} /></form></MvpModal> : null}
      {userDraft ? <MvpModal title="Provision workspace user" eyebrow={workspaces.find((workspace) => workspace.id === userDraft.organisationId)?.name ?? "Client workspace"} onClose={() => setUserDraft(null)}><form onSubmit={(event) => void provisionUser(event)}><FormGrid><FormField label="Display name" value={userDraft.displayName} onChange={(displayName) => setUserDraft({ ...userDraft, displayName })} required /><FormField label="Work email" type="email" value={userDraft.email} onChange={(email) => setUserDraft({ ...userDraft, email })} required /><FormSelect label="Role" value={userDraft.role} onChange={(role) => setUserDraft({ ...userDraft, role: role as MvpUserRole })} options={employerRoles.map((role) => ({ value: role, label: role }))} /></FormGrid><FormActions label={busy === "user" ? "Provisioning…" : "Provision user"} onCancel={() => setUserDraft(null)} error={error} /></form></MvpModal> : null}
    </MvpPanel>
  );
}
