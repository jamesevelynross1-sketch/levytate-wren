"use client";

import { Building2, Plus, RefreshCw, UserPlus } from "lucide-react";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { FormActions, FormField, FormGrid, FormSelect, MvpModal, MvpPanel } from "@/components/levytate-mvp/MvpUi";
import type { MvpUserRole } from "@/lib/levytate/mvp/rbac";
import type { ClientWorkspaceUser } from "@/lib/server/levytate-client-workspace-admin";
import { InvitationControls } from "@/components/levytate-mvp/WorkspaceAccessPanel";

type ClientUser = ClientWorkspaceUser;
type ClientWorkspace = { id: string; name: string; slug: string; workspaceName: string; status: string; createdAt: string; users: ClientUser[] };
const employerRoles: MvpUserRole[] = ["Employer Admin", "Apprenticeship Lead", "Line Manager", "Employee"];

export function ClientWorkspaceAdminModule() {
  const [workspaces, setWorkspaces] = useState<ClientWorkspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [workspaceDraft, setWorkspaceDraft] = useState<{ requestId: string; name: string; workspaceName: string; primaryContact: string; contactEmail: string; initialRole: MvpUserRole } | null>(null);
  const [userDraft, setUserDraft] = useState<{ requestId: string; organisationId: string; displayName: string; email: string; role: MvpUserRole } | null>(null);
  const [accessCommand, setAccessCommand] = useState<{ requestId: string; userId: string; role: MvpUserRole; active: boolean; expectedGeneration: number } | null>(null);
  const [suspensionDraft, setSuspensionDraft] = useState<{ organisationId: string; reason: string; requestId: string } | null>(null);

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
    event.preventDefault(); if (!workspaceDraft || busy) return; setBusy("workspace"); setError("");
    try {
      const response = await fetch("/api/levytate-platform/workspaces", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "create_workspace", ...workspaceDraft }) });
      const payload = await response.json() as { workspace?: ClientWorkspace; message?: string };
      if (!response.ok || !payload.workspace) throw new Error(payload.message || "The client workspace could not be created.");
      setWorkspaces((current) => [payload.workspace!, ...current.filter((workspace) => workspace.id !== payload.workspace!.id)]); setWorkspaceDraft(null);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "The client workspace could not be created."); }
    finally { setBusy(""); }
  }

  async function provisionUser(event: FormEvent) {
    event.preventDefault(); if (!userDraft || busy) return; setBusy("user"); setError("");
    try {
      const response = await fetch("/api/levytate-platform/workspaces", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "provision_user", ...userDraft }) });
      const payload = await response.json() as { user?: ClientUser; message?: string };
      if (!response.ok || !payload.user) throw new Error(payload.message || "The client workspace user could not be provisioned.");
      setWorkspaces((current) => current.map((workspace) => workspace.id === userDraft.organisationId ? { ...workspace, users: [...workspace.users.filter((user) => user.id !== payload.user!.id), payload.user!] } : workspace)); setUserDraft(null);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "The client workspace user could not be provisioned."); }
    finally { setBusy(""); }
  }

  async function updateUser(user: ClientUser, role: MvpUserRole, active: boolean) {
    const command = accessCommand?.userId === user.id && accessCommand.role === role && accessCommand.active === active
      ? accessCommand : { userId: user.id, role, active, expectedGeneration: user.invitationGeneration, requestId: crypto.randomUUID() };
    await submitAccessCommand(command);
  }

  async function submitAccessCommand(command: NonNullable<typeof accessCommand>) {
    if (busy) return;
    setAccessCommand(command); setBusy(command.userId); setError("");
    try {
      const response = await fetch("/api/levytate-platform/workspaces", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(command) });
      const payload = await response.json() as { user?: ClientUser; message?: string };
      if (!response.ok || !payload.user) throw new Error(payload.message || "The client workspace user could not be updated.");
      setWorkspaces((current) => current.map((workspace) => ({ ...workspace, users: workspace.users.map((candidate) => candidate.id === command.userId ? payload.user! : candidate) })));
      setAccessCommand(null);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "The client workspace user could not be updated."); }
    finally { setBusy(""); }
  }

  async function suspendWorkspace(event: FormEvent) {
    event.preventDefault();
    if (!suspensionDraft || busy) return;
    setBusy("suspension"); setError("");
    try {
      const response = await fetch("/api/levytate-platform/workspaces", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "suspend_workspace", ...suspensionDraft }) });
      const payload = await response.json() as { suspension?: { organisationId: string; status: string }; message?: string };
      if (!response.ok || payload.suspension?.organisationId !== suspensionDraft.organisationId || payload.suspension.status !== "Suspended") throw new Error(payload.message || "Suspension was not confirmed. Refresh, then retry the same request if necessary.");
      setSuspensionDraft(null); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Suspension was not confirmed. Your reason and request have been retained."); }
    finally { setBusy(""); }
  }

  return (
    <MvpPanel title="Client workspaces" eyebrow="Controlled provisioning" actions={<div className="flex flex-wrap gap-2"><button type="button" onClick={() => void load()} disabled={loading} className="inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-xs font-semibold ring-1 ring-[#102c3d]/[0.1]"><RefreshCw size={14} className={loading ? "animate-spin" : ""} />Refresh</button><button type="button" onClick={() => setWorkspaceDraft({ requestId: crypto.randomUUID(), name: "", workspaceName: "", primaryContact: "", contactEmail: "", initialRole: "Apprenticeship Lead" })} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[#102c3d] px-4 text-xs font-semibold text-white"><Plus size={14} />Create employer</button></div>}>
      <p className="mb-4 max-w-3xl text-sm leading-6 text-[#102c3d]/[0.58]">Create a blank private employer workspace, then prepare individual passwordless accounts. Use Send invitation to send a secure sign-in link. Email delivery is reported separately from provider acceptance.</p>
      {error ? <p role="alert" className="mb-4 rounded-xl bg-[#fff2f3] px-4 py-3 text-sm font-semibold text-[#a93d52]">{error}</p> : null}
      {accessCommand && !busy ? <div role="status" className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm"><p>The previous access change was not confirmed. Retry the original request, or refresh and inspect the current account before starting a different change.</p><button type="button" className="mt-2 min-h-11 rounded-full px-4 font-semibold ring-1 ring-current" onClick={() => void submitAccessCommand(accessCommand)}>Retry access change</button><button type="button" className="ml-2 min-h-11 rounded-full px-4 font-semibold" onClick={() => { setAccessCommand(null); void load(); }}>Discard retry and refresh</button></div> : null}
      {loading ? <p className="py-8 text-center text-sm text-[#102c3d]/[0.48]">Loading client workspaces…</p> : workspaces.length ? <div className="grid gap-4">{workspaces.map((workspace) => <article key={workspace.id} className="rounded-2xl border border-[#102c3d]/[0.08] bg-[#f9fbfa] p-5">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="flex items-center gap-2 text-sm font-semibold"><Building2 size={16} className="text-[#0b8e82]" />{workspace.name}</p><p className="mt-1 text-xs text-[#102c3d]/[0.48]">{workspace.workspaceName} · {workspace.users.length} account{workspace.users.length === 1 ? "" : "s"}</p></div><button type="button" onClick={() => setUserDraft({ requestId: crypto.randomUUID(), organisationId: workspace.id, displayName: "", email: "", role: "Employee" })} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-white px-4 text-xs font-semibold ring-1 ring-[#102c3d]/[0.1]"><UserPlus size={14} />Prepare account</button></div>
        <div className="mt-3 flex flex-wrap items-center gap-3"><p role="status" className="text-sm">{workspace.status}</p>{workspace.status === "Active" ? <button type="button" disabled={Boolean(busy)} onClick={() => setSuspensionDraft({ organisationId: workspace.id, reason: "", requestId: crypto.randomUUID() })} className="min-h-11 rounded-full px-4 text-xs font-semibold text-[#a93d52] ring-1 ring-[#a93d52]/20">Suspend employer</button> : <p className="text-sm">Access and invitations are blocked. Reactivation, export and deletion require separately approved lifecycle procedures. Suspension does not delete data.</p>}</div>
        <div className="mt-4 grid gap-2">{workspace.users.map((user) => <div key={user.id} className="grid gap-2 rounded-xl bg-white p-3 sm:grid-cols-[minmax(0,1fr)_180px_auto] sm:items-center">
          <div className="min-w-0"><p className="truncate text-sm font-semibold">{user.displayName || user.email}</p><p className="break-all text-xs text-[#102c3d]/[0.48]">{user.email} · {user.active ? "active" : "inactive"} · {user.authBindingStatus.replaceAll("_", " ")}</p></div>
          <select aria-label={`Role for ${user.displayName || user.email}`} value={user.role} disabled={Boolean(busy) || accessCommand !== null} onChange={(event) => void updateUser(user, event.target.value as MvpUserRole, user.active)} className="min-h-11 rounded-xl border border-[#102c3d]/[0.1] bg-white px-3 text-xs font-semibold">{employerRoles.map((role) => <option key={role}>{role}</option>)}</select>
          {user.active || user.invitationStatus === "sending" ? <button type="button" disabled={Boolean(busy) || accessCommand !== null} onClick={() => void updateUser(user, user.role, false)} className="min-h-11 rounded-full px-4 text-xs font-semibold text-[#a93d52] ring-1 ring-[#a93d52]/20">Revoke access</button> : null}
          {workspace.status === "Active" ? <div className="sm:col-span-3"><InvitationControls user={user} endpoint="/api/levytate-platform/workspaces" onError={setError} onChanged={(updated) => setWorkspaces((current) => current.map((item) => ({ ...item, users: item.users.map((candidate) => candidate.id === updated.id ? updated : candidate) })))} /></div> : null}
        </div>)}</div>
      </article>)}</div> : <p className="rounded-xl border border-dashed border-[#102c3d]/[0.14] py-8 text-center text-sm text-[#102c3d]/[0.48]">No Client V1 employer workspaces have been created yet.</p>}

      {workspaceDraft ? <MvpModal title="Create employer workspace" eyebrow="Blank Client V1 workspace" onClose={() => { if (!busy) setWorkspaceDraft(null); }}><form onSubmit={(event) => void createWorkspace(event)}><fieldset disabled={Boolean(busy)}><FormGrid><FormField label="Organisation name" value={workspaceDraft.name} onChange={(name) => setWorkspaceDraft({ ...workspaceDraft, name, requestId: crypto.randomUUID() })} required /><FormField label="Workspace name" value={workspaceDraft.workspaceName} onChange={(workspaceName) => setWorkspaceDraft({ ...workspaceDraft, workspaceName, requestId: crypto.randomUUID() })} placeholder="Defaults from organisation name" /><FormField label="Primary contact" value={workspaceDraft.primaryContact} onChange={(primaryContact) => setWorkspaceDraft({ ...workspaceDraft, primaryContact, requestId: crypto.randomUUID() })} required /><FormField label="Primary contact email" type="email" value={workspaceDraft.contactEmail} onChange={(contactEmail) => setWorkspaceDraft({ ...workspaceDraft, contactEmail, requestId: crypto.randomUUID() })} required /><FormSelect label="Initial role" value={workspaceDraft.initialRole} onChange={(initialRole) => setWorkspaceDraft({ ...workspaceDraft, initialRole: initialRole as MvpUserRole, requestId: crypto.randomUUID() })} options={[{ value: "Apprenticeship Lead", label: "Apprenticeship Lead" }, { value: "Employer Admin", label: "Employer Admin" }]} /></FormGrid><FormActions label={busy === "workspace" ? "Creating…" : "Create blank workspace"} disabled={Boolean(busy)} onCancel={() => { if (!busy) setWorkspaceDraft(null); }} error={error} /></fieldset></form></MvpModal> : null}
      {userDraft ? <MvpModal title="Provision workspace user" eyebrow={workspaces.find((workspace) => workspace.id === userDraft.organisationId)?.name ?? "Client workspace"} onClose={() => { if (!busy) setUserDraft(null); }}><form onSubmit={(event) => void provisionUser(event)}><fieldset disabled={Boolean(busy)}><FormGrid><FormField label="Display name" value={userDraft.displayName} onChange={(displayName) => setUserDraft({ ...userDraft, displayName, requestId: crypto.randomUUID() })} required /><FormField label="Work email" type="email" value={userDraft.email} onChange={(email) => setUserDraft({ ...userDraft, email, requestId: crypto.randomUUID() })} required /><FormSelect label="Role" value={userDraft.role} onChange={(role) => setUserDraft({ ...userDraft, role: role as MvpUserRole, requestId: crypto.randomUUID() })} options={employerRoles.map((role) => ({ value: role, label: role }))} /></FormGrid><FormActions label={busy === "user" ? "Provisioning…" : "Provision user"} disabled={Boolean(busy)} onCancel={() => { if (!busy) setUserDraft(null); }} error={error} /></fieldset></form></MvpModal> : null}
      {suspensionDraft ? <MvpModal title="Suspend employer access" eyebrow={workspaces.find((workspace) => workspace.id === suspensionDraft.organisationId)?.name ?? "Client workspace"} onClose={() => { if (!busy) setSuspensionDraft(null); }}><form onSubmit={(event) => void suspendWorkspace(event)}><p className="mb-4 text-sm leading-6">This immediately blocks all employer accounts, existing application sessions and pending invitations. It retains the employer’s records. No email, deletion or automatic reactivation is performed.</p><FormField label="Reason for suspension" value={suspensionDraft.reason} onChange={(reason) => setSuspensionDraft({ ...suspensionDraft, reason })} required /><FormActions label={busy === "suspension" ? "Suspending…" : "Confirm suspension"} disabled={Boolean(busy) || suspensionDraft.reason.trim().length < 10} onCancel={() => { if (!busy) setSuspensionDraft(null); }} error={error} /></form></MvpModal> : null}
    </MvpPanel>
  );
}
