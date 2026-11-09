"use client";

import { useId } from "react";
import { tenantRetentionClasses, type LifecycleOwnerOption, type TenantRetentionForm } from "@/lib/levytate/mvp/tenant-retention-form";

const inputClass = "mt-1 min-h-11 w-full rounded-lg border border-[#102c3d]/20 bg-white px-3 text-sm disabled:opacity-60";
const references = [
  ["approvalReference", "Retention policy approval"], ["clientNoticeReference", "Approved client notice"],
  ["supportHandoverReference", "Support handover"], ["recoveryBoundaryReference", "Recovery and irreversibility boundary"],
] as const;

export function TenantRetentionPolicyEditor({ value, onChange, owners, disabled = false }: {
  value: TenantRetentionForm; onChange: (value: TenantRetentionForm) => void; owners: LifecycleOwnerOption[]; disabled?: boolean;
}) {
  const id = useId();
  return <fieldset disabled={disabled} className="mt-5 grid min-w-0 gap-5">
    <legend className="text-sm font-semibold">Approved retention and ownership</legend>
    <p className="text-sm leading-6 text-[#102c3d]/65">Record the approved decisions for each data class. Every action, date and evidence reference must be chosen explicitly. These entries do not replace independent approval.</p>
    <div className="grid gap-3 sm:grid-cols-2">
      {([['dataOwnerUserId', 'Data owner'], ['serviceOwnerUserId', 'Service owner']] as const).map(([key, label]) => <div key={key}>
        <label htmlFor={`${id}-${key}`} className="text-sm font-semibold">{label}</label>
        <select id={`${id}-${key}`} required value={value[key]} onChange={(event) => onChange({ ...value, [key]: event.target.value })} className={inputClass}>
          <option value="">Choose an authorised owner</option>{owners.map((owner) => <option key={owner.id} value={owner.id}>{owner.label}</option>)}
        </select>
      </div>)}
      {references.map(([key, label]) => <div key={key}>
        <label htmlFor={`${id}-${key}`} className="text-sm font-semibold">{label} reference</label>
        <input id={`${id}-${key}`} required minLength={5} maxLength={500} value={value[key]} onChange={(event) => onChange({ ...value, [key]: event.target.value })} className={inputClass} />
      </div>)}
      <div className="sm:col-span-2"><label htmlFor={`${id}-evidence`} className="text-sm font-semibold">Retain lifecycle evidence until (your local time)</label>
        <input id={`${id}-evidence`} required type="datetime-local" value={value.evidenceRetainUntilLocal} onChange={(event) => onChange({ ...value, evidenceRetainUntilLocal: event.target.value })} className={inputClass} />
      </div>
    </div>
    {!owners.length ? <p role="status" className="rounded-lg bg-amber-50 p-3 text-sm">No authorised owners are available. Refresh access before requesting approval.</p> : null}
    <div className="grid gap-3">{tenantRetentionClasses.map(({ key, label }) => {
      const schedule = value.schedules[key];
      const update = (patch: Partial<typeof schedule>) => onChange({ ...value, schedules: { ...value.schedules, [key]: { ...schedule, ...patch } } });
      return <fieldset key={key} className="grid min-w-0 gap-3 rounded-xl border border-[#102c3d]/10 p-4 sm:grid-cols-2">
        <legend className="px-1 text-sm font-semibold">{label}</legend>
        <div><label htmlFor={`${id}-${key}-action`} className="text-sm">{label} action</label>
          <select id={`${id}-${key}-action`} required value={schedule.action} onChange={(event) => update({ action: event.target.value as typeof schedule.action })} className={inputClass}>
            <option value="">Choose an approved action</option><option value="delete">Delete when due</option><option value="retain">Retain — blocks whole-employer deletion</option>
          </select>
        </div>
        <div><label htmlFor={`${id}-${key}-date`} className="text-sm">{label} retain until (local time)</label>
          <input id={`${id}-${key}-date`} required type="datetime-local" value={schedule.retainUntilLocal} onChange={(event) => update({ retainUntilLocal: event.target.value })} className={inputClass} />
        </div>
        <div className="sm:col-span-2"><label htmlFor={`${id}-${key}-reference`} className="text-sm">{label} schedule approval reference</label>
          <input id={`${id}-${key}-reference`} required minLength={5} maxLength={500} value={schedule.approvalReference} onChange={(event) => update({ approvalReference: event.target.value })} className={inputClass} />
        </div>
      </fieldset>;
    })}</div>
  </fieldset>;
}
