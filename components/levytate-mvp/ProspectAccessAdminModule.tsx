"use client";

import { CalendarClock, RefreshCw, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { MvpPanel } from "@/components/levytate-mvp/MvpUi";

type Access = {
  id: string;
  organisationName: string;
  prospectName: string;
  email: string;
  role: string;
  status: "prepared" | "active" | "expired" | "revoked";
  statusLabel: string;
  accessStartAt: string | null;
  accessExpiresAt: string | null;
  firstLoginAt: string | null;
  guidanceCompletedAt: string | null;
  internalOwnerName: string;
  lastStatusChangedAt: string;
  version: number;
};

export function ProspectAccessAdminModule() {
  const [items, setItems] = useState<Access[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [reason, setReason] = useState<Record<string, string>>({});
  const [expiry, setExpiry] = useState<Record<string, string>>({});
  const [owner, setOwner] = useState<Record<string, string>>({});

  async function load() {
    setLoading(true);
    try {
      const response = await fetch("/api/levytate-prospect-access", { cache: "no-store" });
      const payload = (await response.json()) as { access?: Access[]; message?: string };
      if (!response.ok) throw new Error(payload.message || "Prospect access could not be loaded.");
      setItems(payload.access ?? []);
      setError("");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Prospect access could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function control(item: Access, operation: "activate" | "revoke" | "reactivate" | "update_expiry") {
    setBusy(item.id);
    setError("");
    try {
      const chosenExpiry = expiry[item.id] ? new Date(expiry[item.id]).toISOString() : item.accessExpiresAt;
      const response = await fetch("/api/levytate-prospect-access", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          operation,
          accessId: item.id,
          confirmation: operation === "activate" ? "ACTIVATE" : operation === "reactivate" ? "REACTIVATE" : undefined,
          accessStartAt: operation === "activate" ? new Date().toISOString() : undefined,
          accessExpiresAt: chosenExpiry,
          internalOwnerName: operation === "activate" ? owner[item.id]?.trim() : undefined,
          reason: reason[item.id],
          version: item.version,
        }),
      });
      const payload = (await response.json()) as { access?: Access; message?: string };
      if (!response.ok || !payload.access) throw new Error(payload.message || "Prospect access could not be updated.");
      setItems((current) => current.map((candidate) => candidate.id === item.id ? payload.access! : candidate));
      setReason((current) => ({ ...current, [item.id]: "" }));
    } catch (controlError) {
      setError(controlError instanceof Error ? controlError.message : "Prospect access could not be updated.");
    } finally {
      setBusy("");
    }
  }

  return (
    <MvpPanel eyebrow="Controlled prospect access" title="Trial access lifecycle" actions={<button type="button" onClick={() => void load()} className="inline-flex min-h-10 items-center gap-2 rounded-full border border-[#102c3d]/[0.08] px-4 text-xs font-semibold"><RefreshCw size={14} />Refresh</button>}>
      <p className="mb-4 max-w-3xl text-sm leading-6 text-[#102c3d]/58">Inspect and control prepared prospect workspaces. No invitation is sent by these actions.</p>
      {error ? <p role="alert" className="mb-4 rounded-xl bg-[#fff2f3] px-4 py-3 text-sm text-[#a93d52]">{error}</p> : null}
      {loading ? <p className="py-8 text-center text-sm text-[#102c3d]/48">Loading prospect access…</p> : items.length === 0 ? <p className="rounded-2xl border border-dashed border-[#102c3d]/10 py-8 text-center text-sm text-[#102c3d]/48">No prospect workspaces are currently prepared.</p> : (
        <div className="grid gap-4">
          {items.map((item) => (
            <article key={item.id} className="rounded-2xl border border-[#102c3d]/[0.08] bg-[#f9fbfa] p-4 sm:p-5">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2"><ShieldCheck size={17} className="text-[#0b8e82]" /><h3 className="text-sm font-semibold">{item.organisationName}</h3><span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-semibold text-[#0b6f63] ring-1 ring-[#159b8f]/15">{item.statusLabel}</span></div>
                  <p className="mt-2 text-xs text-[#102c3d]/58">{item.prospectName} · {item.email} · {item.role}</p>
                  <div className="mt-3 grid gap-1 text-xs text-[#102c3d]/56 sm:grid-cols-2 lg:grid-cols-4">
                    <span>Start: {format(item.accessStartAt)}</span><span>Expiry: {format(item.accessExpiresAt)}</span><span>First login: {format(item.firstLoginAt)}</span><span>Guidance: {format(item.guidanceCompletedAt)}</span>
                  </div>
                  <p className="mt-2 text-[11px] text-[#102c3d]/42">Owner: {item.internalOwnerName || "Not assigned"} · Last change: {format(item.lastStatusChangedAt)}</p>
                </div>
              </div>
              <div className="mt-4 grid gap-3 border-t border-[#102c3d]/[0.07] pt-4 lg:grid-cols-[minmax(170px,0.7fr)_minmax(180px,0.7fr)_minmax(220px,1fr)_auto] lg:items-end">
                <label className="grid gap-1 text-[11px] font-semibold text-[#102c3d]/55"><span className="inline-flex items-center gap-1"><CalendarClock size={13} />Expiry date</span><input type="datetime-local" value={expiry[item.id] ?? toLocal(item.accessExpiresAt)} onChange={(event) => setExpiry((current) => ({ ...current, [item.id]: event.target.value }))} className="min-h-11 rounded-xl border border-[#102c3d]/10 bg-white px-3 text-sm" /></label>
                <label className="grid gap-1 text-[11px] font-semibold text-[#102c3d]/55">Internal owner<input value={owner[item.id] ?? item.internalOwnerName} onChange={(event) => setOwner((current) => ({ ...current, [item.id]: event.target.value }))} className="min-h-11 rounded-xl border border-[#102c3d]/10 bg-white px-3 text-sm" /></label>
                <label className="grid gap-1 text-[11px] font-semibold text-[#102c3d]/55">Reason for revocation or shortening<input value={reason[item.id] ?? ""} onChange={(event) => setReason((current) => ({ ...current, [item.id]: event.target.value }))} className="min-h-11 rounded-xl border border-[#102c3d]/10 bg-white px-3 text-sm" /></label>
                <div className="flex flex-wrap gap-2">
                  {item.status === "prepared" ? <Action label="Activate" disabled={busy === item.id || !(owner[item.id] ?? item.internalOwnerName).trim()} onClick={() => void control(item, "activate")} /> : null}
                  {item.status === "active" ? <><Action label="Update expiry" disabled={busy === item.id || !expiry[item.id]} onClick={() => void control(item, "update_expiry")} /><Action label="Revoke" tone="danger" disabled={busy === item.id || !reason[item.id]?.trim()} onClick={() => void control(item, "revoke")} /></> : null}
                  {item.status === "expired" || item.status === "revoked" ? <Action label="Reactivate" disabled={busy === item.id || (item.status === "expired" && !expiry[item.id])} onClick={() => void control(item, "reactivate")} /> : null}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </MvpPanel>
  );
}

function Action({ label, onClick, disabled, tone = "default" }: { label: string; onClick: () => void; disabled: boolean; tone?: "default" | "danger" }) { return <button type="button" disabled={disabled} onClick={onClick} className={`min-h-11 rounded-full px-4 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45 ${tone === "danger" ? "bg-[#a93d52]" : "bg-[#102c3d]"}`}>{label}</button>; }
function format(value: string | null) { return value ? new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "Not recorded"; }
function toLocal(value: string | null) { if (!value) return ""; const date = new Date(value); return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16); }
