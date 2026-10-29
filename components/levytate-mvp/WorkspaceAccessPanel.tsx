"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import type { ClientWorkspaceUser } from "@/lib/server/levytate-client-workspace-admin";
import type { MvpUserRole } from "@/lib/levytate/mvp/rbac";
import { MvpPanel } from "@/components/levytate-mvp/MvpUi";

export function InvitationControls({ user, endpoint, onChanged, onError }: { user: ClientWorkspaceUser; endpoint: string; onChanged: (user: ClientWorkspaceUser) => void; onError: (message: string) => void }) {
  const [busy, setBusy] = useState(false);
  const retry = useRef<{ requestId: string; expectedGeneration: number } | null>(null);
  async function send() {
    if (busy) return;
    setBusy(true); onError("");
    retry.current ??= { requestId: crypto.randomUUID(), expectedGeneration: user.invitationGeneration };
    try {
      const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "invite_user", userId: user.id, ...retry.current }) });
      const payload = await response.json() as { user?: ClientWorkspaceUser; message?: string };
      if (!response.ok || !payload.user) {
        if (response.status === 409) retry.current = null;
        throw new Error(payload.message || "Invitation outcome could not be confirmed. Refresh or retry this request.");
      }
      retry.current = null;
      onChanged(payload.user);
    } catch (error) { onError(error instanceof Error ? error.message : "Invitation outcome could not be confirmed."); }
    finally { setBusy(false); }
  }
  return <div className="flex flex-wrap items-center gap-2">
    <button type="button" disabled={busy} onClick={() => void send()} className="min-h-11 rounded-full bg-[#102c3d] px-4 text-xs font-semibold text-white disabled:opacity-50">{busy ? "Sending…" : user.invitationGeneration ? "Send new invitation" : "Send invitation"}</button>
    <span className="text-xs text-[#102c3d]/70" role="status">Link: {user.invitationStatus.replaceAll("_", " ")} · Email: {user.deliveryStatus === "accepted" ? "provider accepted; delivery unconfirmed" : user.deliveryStatus.replaceAll("_", " ")}</span>
  </div>;
}

export function WorkspaceAccessPanel() {
  const endpoint = "/api/levytate-workspace/invitations";
  const [users, setUsers] = useState<ClientWorkspaceUser[]>([]);
  const [roles, setRoles] = useState<MvpUserRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [draft, setDraft] = useState({ displayName: "", email: "", role: "Employee" });
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const response = await fetch(endpoint, { cache: "no-store" });
      const payload = await response.json() as { users?: ClientWorkspaceUser[]; roles?: MvpUserRole[]; message?: string };
      if (!response.ok) throw new Error(payload.message || "Workspace access could not be loaded.");
      setUsers(payload.users ?? []); setRoles(payload.roles ?? []);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Workspace access could not be loaded."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const changed = (user: ClientWorkspaceUser) => setUsers((current) => current.map((candidate) => candidate.id === user.id ? user : candidate));
  async function prepare(event: FormEvent) {
    event.preventDefault(); if (busy) return; setBusy("prepare"); setError("");
    try {
      const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "provision_user", ...draft }) });
      const payload = await response.json() as { user?: ClientWorkspaceUser; message?: string };
      if (!response.ok || !payload.user) throw new Error(payload.message || "Access could not be prepared.");
      setUsers((current) => [...current, payload.user!]); setDraft({ displayName: "", email: "", role: "Employee" });
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Access could not be prepared."); }
    finally { setBusy(""); }
  }
  async function revoke(user: ClientWorkspaceUser) {
    setBusy(user.id); setError("");
    try {
      const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "revoke_user", userId: user.id }) });
      const payload = await response.json() as { user?: ClientWorkspaceUser; message?: string };
      if (!response.ok || !payload.user) throw new Error(payload.message || "Access revocation could not be confirmed.");
      changed(payload.user);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Access revocation could not be confirmed."); }
    finally { setBusy(""); }
  }
  return <MvpPanel title="Individual account access" eyebrow="Invitations" actions={<button type="button" onClick={() => void load()} disabled={loading} className="min-h-11 rounded-full px-4 text-xs font-semibold ring-1 ring-[#102c3d]/20">Refresh access</button>}>
    <p className="mb-4 text-sm leading-6 text-[#102c3d]/70">Create People records first for Employees and Line Managers. Preparing access sends no email; use Send invitation to request an individual secure sign-in link. Provider acceptance is separate from inbox delivery.</p>
    {error ? <p role="alert" className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p> : null}
    {loading ? <p role="status">Loading account access…</p> : <>
      <form onSubmit={(event) => void prepare(event)} className="mb-5 grid gap-3 rounded-xl border p-4 sm:grid-cols-2">
        <label className="text-sm">Name<input required maxLength={160} value={draft.displayName} onChange={(event) => setDraft({ ...draft, displayName: event.target.value })} className="mt-1 min-h-11 w-full rounded-lg border px-3" /></label>
        <label className="text-sm">Work email<input required type="email" maxLength={254} value={draft.email} onChange={(event) => setDraft({ ...draft, email: event.target.value })} className="mt-1 min-h-11 w-full rounded-lg border px-3" /></label>
        <label className="text-sm">Account role<select value={draft.role} onChange={(event) => setDraft({ ...draft, role: event.target.value })} className="mt-1 min-h-11 w-full rounded-lg border px-3">{roles.map((role) => <option key={role}>{role}</option>)}</select></label>
        <button type="submit" disabled={Boolean(busy)} className="min-h-11 self-end rounded-full bg-[#102c3d] px-4 text-sm font-semibold text-white disabled:opacity-50">{busy === "prepare" ? "Preparing…" : "Prepare account"}</button>
      </form>
      <div className="grid gap-3">{users.map((user) => <article key={user.id} className="grid gap-3 rounded-xl border p-4">
        <div><p className="font-semibold">{user.displayName || user.email}</p><p className="break-all text-sm text-[#102c3d]/70">{user.email} · {user.role} · {user.active ? "Access active" : "Access inactive"}</p></div>
        <InvitationControls user={user} endpoint={endpoint} onChanged={changed} onError={setError} />
        {user.active || user.invitationStatus === "sending" ? <button type="button" disabled={Boolean(busy)} onClick={() => void revoke(user)} className="min-h-11 justify-self-start rounded-full px-4 text-xs font-semibold text-red-800 ring-1 ring-red-200">Revoke account access</button> : null}
      </article>)}</div>
    </>}
  </MvpPanel>;
}
