"use client";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { FormActions, FormField, FormGrid, FormSelect, MvpModal } from "@/components/levytate-mvp/MvpUi";
import type { OffboardingCase } from "@/lib/server/levytate-tenant-offboarding";
import { authenticatedClientFetch } from "@/lib/levytate/client-session";
import { useMvpWorkspace } from "@/components/levytate-mvp/MvpWorkspaceStore";

type Employer = { id: string; name: string; status: string };
type Draft = { caseId: string; requestId: string; organisationId: string; purpose: "export" | "delete"; policy: string; recipientPublicKey: string; exportExpiresAt: string };
type Action = { caseId: string; requestId: string; expectedRevision: number; action: string; reference: string; hold: boolean; confirmed: boolean };
const endpoint = "/api/levytate-platform/offboarding";
function download(value: unknown, name: string) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }));
  const link = document.createElement("a"); link.href = url; link.download = name; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function actions(item: OffboardingCase) {
  if (item.status === "requested") return ["approve", "hold", "cancel"];
  if (item.status === "approved") return ["export", "hold", "cancel"];
  if (item.status === "exported") return ["download", "record_delivery", ...(item.purpose === "delete" ? ["execute_delete"] : []), "hold", "cancel", "erase_expired_export"];
  if (item.status === "deleting") return ["execute_delete", "hold"];
  if (item.status === "completed") return ["completion_evidence", "erase_evidence"];
  return ["erase_evidence"];
}
export function TenantOffboardingPanel({ employers, onChanged }: { employers: Employer[]; onChanged: () => Promise<void> }) {
  const { meta } = useMvpWorkspace();
  const identity = useRef<{ email: string; organisationId: string } | null>(null);
  if (!identity.current && meta?.userEmail && meta.organisationId) identity.current = { email: meta.userEmail, organisationId: meta.organisationId };
  const request = useCallback((init?: RequestInit) => {
    if (!identity.current) throw new Error("Workspace identity is unavailable. Reload before managing employer data.");
    return authenticatedClientFetch(endpoint, init, identity.current);
  }, []);
  const [cases, setCases] = useState<OffboardingCase[]>([]), [loading, setLoading] = useState(true), [error, setError] = useState("");
  const [busy, setBusy] = useState(false), [draft, setDraft] = useState<Draft | null>(null), [action, setAction] = useState<Action | null>(null);
  const suspended = employers.filter((employer) => employer.status === "Suspended");
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await request({ cache: "no-store" });
      const payload = await response.json() as { cases?: OffboardingCase[]; message?: string };
      if (!response.ok || !Array.isArray(payload.cases)) throw new Error(payload.message || "Lifecycle cases are unavailable.");
      setCases(payload.cases);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Lifecycle cases are unavailable."); }
    finally { setLoading(false); }
  }, [request]);
  useEffect(() => { void load(); }, [load]);
  async function send(body: Record<string, unknown>) {
    if (busy) return; setBusy(true); setError("");
    try {
      const response = await request({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const payload = await response.json() as { message?: string; download?: unknown; completion?: unknown; erasure?: unknown };
      if (!response.ok) throw new Error(payload.message || "The lifecycle step was not confirmed. Inspect the case or retry this request.");
      if (payload.download) download(payload.download, `levytate-encrypted-export-${String(body.caseId)}.json`);
      if (payload.completion) download(payload.completion, `levytate-disposal-evidence-${String(body.caseId)}.json`);
      if (payload.erasure) download(payload.erasure, `levytate-evidence-erasure-${String(body.caseId)}.json`);
      setDraft(null); setAction(null); await load(); await onChanged();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "The step was not confirmed. Your original request is retained for retry."); }
    finally { setBusy(false); }
  }
  function editDraft(patch: Partial<Draft>) { if (draft) setDraft({ ...draft, ...patch, requestId: crypto.randomUUID() }); }
  function editAction(patch: Partial<Action>) { if (action) setAction({ ...action, ...patch, requestId: crypto.randomUUID() }); }
  async function submitRequest(event: FormEvent) {
    event.preventDefault(); if (!draft || busy) return;
    let policy: unknown;
    try { policy = JSON.parse(draft.policy); } catch { setError("Provide the approved retention policy as valid JSON. No retention defaults are assumed."); return; }
    await send({ ...draft, action: "request", policy });
  }
  async function submitAction(event: FormEvent) {
    event.preventDefault(); if (!action || busy) return;
    if (action.action === "execute_delete" && !action.confirmed) return;
    const body: Record<string, unknown> = { action: action.action === "completion_evidence" ? "execute_delete" : action.action, caseId: action.caseId };
    if (!["download", "erase_evidence"].includes(action.action)) Object.assign(body, { requestId: action.requestId, expectedRevision: action.expectedRevision });
    if (action.action === "approve") body.approvalReference = action.reference;
    if (["hold", "record_delivery", "erase_evidence"].includes(action.action)) body.reference = action.reference;
    if (action.action === "hold") body.active = action.hold;
    await send(body);
  }
  return <section aria-labelledby="offboarding-title" className="mt-8 border-t border-[#102c3d]/10 pt-6">
    <h3 id="offboarding-title" className="font-semibold">Employer data lifecycle</h3>
    <p className="mt-2 text-sm leading-6 text-[#102c3d]/65">Suspend first. Exports and disposal require a separately approved policy, named owners and independent approval. Notices are not sent automatically. Private pastoral content is excluded from employer exports.</p>
    <div className="my-3 flex flex-wrap gap-2"><button type="button" disabled={busy || !identity.current || !suspended.length} className="min-h-11 rounded-full px-4 text-sm font-semibold ring-1 ring-[#102c3d]/20" onClick={() => { setError(""); setDraft({ caseId: crypto.randomUUID(), requestId: crypto.randomUUID(), organisationId: suspended[0]?.id ?? "", purpose: "export", policy: "", recipientPublicKey: "", exportExpiresAt: "" }); }}>Request lifecycle case</button><button type="button" disabled={loading || busy} className="min-h-11 rounded-full px-4 text-sm font-semibold ring-1 ring-[#102c3d]/20" onClick={() => { setError(""); void load(); }}>Refresh cases</button></div>
    {error && !draft && !action ? <p role="alert" className="my-3 rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p> : null}
    {loading ? <p role="status" className="text-sm">Loading lifecycle evidence…</p> : cases.length ? <div className="grid gap-3">{cases.map((item) => <article key={item.id} className="rounded-xl border border-[#102c3d]/10 p-4">
      <h4 className="font-semibold">{employers.find((employer) => employer.id === item.tenant_id)?.name ?? `Former employer ${item.tenant_id.slice(0, 8)}`} · {item.purpose}</h4>
      <p className="mt-1 text-sm" role="status">{item.status} · revision {item.revision}{item.legal_hold ? " · LEGAL HOLD — disposal paused" : ""}</p>
      <p className="mt-2 break-words text-xs text-[#102c3d]/65">Case {item.id}. Export expiry: {item.export_expires_at}. Evidence retention: {item.evidence_retain_until}.</p>
      <details className="mt-2 text-sm"><summary className="min-h-11 cursor-pointer py-3 font-semibold">Retention and ownership evidence</summary><p className="break-words">Data owner: {item.policy.dataOwnerUserId}. Service owner: {item.policy.serviceOwnerUserId}.</p><p className="mt-1 break-words">Policy: {item.policy.approvalReference}. Notice: {item.policy.clientNoticeReference}. Support: {item.policy.supportHandoverReference}. Recovery: {item.policy.recoveryBoundaryReference}.</p><ul className="mt-2 grid gap-1">{item.retention.map((entry) => <li key={entry.dataClass}>{entry.dataClass}: {item.status === "completed" ? "completed" : entry.state} · {entry.retainUntil}</li>)}</ul></details>
      <div className="mt-3 flex flex-wrap gap-2">{actions(item).map((value) => <button key={value} type="button" disabled={busy || !identity.current} className="min-h-11 rounded-full px-4 text-xs font-semibold ring-1 ring-[#102c3d]/20" onClick={() => { setError(""); setAction({ caseId: item.id, requestId: crypto.randomUUID(), expectedRevision: item.revision, action: value, reference: "", hold: !item.legal_hold, confirmed: false }); }}>{value === "execute_delete" ? item.status === "deleting" ? "Resume approved disposal" : "Execute approved disposal" : value.replaceAll("_", " ")}</button>)}</div>
    </article>)}</div> : <p className="text-sm text-[#102c3d]/60">No lifecycle cases recorded. Suspension alone does not delete data.</p>}
    {draft ? <MvpModal title="Request employer lifecycle case" eyebrow="Explicit approval record" onClose={() => { if (!busy) setDraft(null); }}><form onSubmit={(event) => void submitRequest(event)}><fieldset disabled={busy || !identity.current}><FormGrid>
      <FormSelect label="Suspended employer" value={draft.organisationId} onChange={(organisationId) => editDraft({ organisationId })} options={suspended.map((employer) => ({ value: employer.id, label: employer.name }))} />
      <FormSelect label="Purpose" value={draft.purpose} onChange={(purpose) => editDraft({ purpose: purpose as Draft["purpose"] })} options={[{ value: "export", label: "Authorised export only" }, { value: "delete", label: "Export and approved disposal" }]} />
      <FormField label="Export expiry (ISO UTC timestamp, within seven days)" value={draft.exportExpiresAt} onChange={(exportExpiresAt) => editDraft({ exportExpiresAt })} required />
    </FormGrid><label className="mt-4 block text-sm font-semibold">Approved retention policy JSON<textarea required rows={8} value={draft.policy} onChange={(event) => editDraft({ policy: event.target.value })} className="mt-2 w-full rounded-xl border border-[#102c3d]/20 p-3 font-mono text-xs" /></label><p className="mt-2 text-xs leading-5">Version levytate-offboarding-v1 requires all eleven data-class schedules, named data/service owner IDs and explicit policy, client notice, support, recovery and evidence-retention references. No real approval is inferred from this form.</p><label className="mt-4 block text-sm font-semibold">Recipient RSA public key (3072 bits or stronger)<textarea required rows={5} value={draft.recipientPublicKey} onChange={(event) => editDraft({ recipientPublicKey: event.target.value })} className="mt-2 w-full rounded-xl border border-[#102c3d]/20 p-3 font-mono text-xs" /></label><p className="mt-2 text-xs">Never paste a private key. Expiry limits new downloads, not copies already downloaded by the recipient.</p><FormActions label={busy ? "Recording…" : "Request independent approval"} disabled={busy || !identity.current} error={error} onCancel={() => { if (!busy) setDraft(null); }} /></fieldset></form></MvpModal> : null}
    {action ? <MvpModal title={action.action.replaceAll("_", " ")} eyebrow="Recorded lifecycle action" onClose={() => { if (!busy) setAction(null); }}><form onSubmit={(event) => void submitAction(event)}><fieldset disabled={busy || !identity.current}><p className="mb-4 text-sm leading-6">Current authority, revision, schedule and approvals are rechecked on the server. An uncertain response keeps the same request for retry. No automatic client email is sent.</p>{["approve", "hold", "record_delivery", "erase_evidence"].includes(action.action) ? <FormField label="Approved evidence reference" value={action.reference} onChange={(reference) => editAction({ reference })} required /> : null}{action.action === "hold" ? <label className="mt-3 flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" checked={action.hold} onChange={(event) => editAction({ hold: event.target.checked })} />Place a hold (uncheck to request independent release)</label> : null}{action.action === "execute_delete" ? <label className="mt-3 flex items-start gap-3 text-sm leading-6"><input type="checkbox" required checked={action.confirmed} onChange={(event) => editAction({ confirmed: event.target.checked })} className="mt-1" />I verified this exact employer, delivered export, due schedules and two-person approval. Disposal is irreversible. A partial failure remains suspended and must be resumed, not automatically restored.</label> : null}<FormActions label={busy ? "Confirming…" : "Confirm recorded action"} disabled={busy || !identity.current || (action.action === "execute_delete" && !action.confirmed)} error={error} onCancel={() => { if (!busy) setAction(null); }} /></fieldset></form></MvpModal> : null}
  </section>;
}
