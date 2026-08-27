"use client";

import { Plus, Search, X } from "lucide-react";
import { useState, type KeyboardEvent, type ReactNode } from "react";

export function MvpPanel({ title, eyebrow, actions, children }: { title: string; eyebrow?: string; actions?: ReactNode; children: ReactNode }) {
  return (
    <section className="min-w-0 rounded-xl border border-[#102c3d]/[0.075] bg-white shadow-[0_14px_36px_rgba(16,44,61,0.045)]">
      <div className="flex flex-col gap-3 border-b border-[#102c3d]/[0.06] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          {eyebrow ? <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#c95568]">{eyebrow}</p> : null}
          <h2 className="mt-0.5 text-lg font-semibold text-[#102c3d]">{title}</h2>
        </div>
        {actions}
      </div>
      <div className="min-w-0 p-5">{children}</div>
    </section>
  );
}

export function MvpToolbar({ search, onSearch, placeholder, actionLabel, onAction, filters }: { search: string; onSearch: (value: string) => void; placeholder: string; actionLabel?: string; onAction?: () => void; filters?: ReactNode }) {
  return (
    <div className={`mb-4 grid gap-3 ${filters ? "xl:grid-cols-[minmax(260px,0.8fr)_minmax(480px,1.4fr)_auto] xl:items-end" : "lg:grid-cols-[minmax(260px,1fr)_auto] lg:items-end"}`}>
      <label className="flex h-10 min-w-0 items-center gap-2 rounded-lg border border-[#102c3d]/[0.09] bg-[#f8fbfa] px-3 focus-within:border-[#159b8f] focus-within:bg-white focus-within:ring-4 focus-within:ring-[#159b8f]/[0.10]">
        <Search size={16} strokeWidth={1.8} className="shrink-0 text-[#102c3d]/[0.38]" aria-hidden="true" />
        <input value={search} onChange={(event) => onSearch(event.target.value)} className="min-w-0 flex-1 bg-transparent text-sm text-[#102c3d] outline-none placeholder:text-[#102c3d]/[0.34]" placeholder={placeholder} />
      </label>
      {filters ? <div className="min-w-0">{filters}</div> : null}
      {actionLabel && onAction ? (
        <button type="button" onClick={onAction} className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-[#102c3d] px-4 text-xs font-semibold text-white shadow-[0_8px_18px_rgba(16,44,61,0.12)] transition hover:-translate-y-0.5 hover:bg-[#17394d]">
          <Plus size={15} strokeWidth={2} aria-hidden="true" />
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}

export function EmptyState({ title, copy, actionLabel, onAction }: { title: string; copy: string; actionLabel: string; onAction: () => void }) {
  return (
    <div className="grid min-h-52 place-items-center rounded-xl border border-dashed border-[#102c3d]/[0.14] bg-[#f8fbfa] px-5 py-10 text-center">
      <div className="max-w-md">
        <h3 className="text-base font-semibold text-[#102c3d]">{title}</h3>
        <p className="mt-2 text-sm leading-6 text-[#102c3d]/[0.56]">{copy}</p>
        <button type="button" onClick={onAction} className="mt-5 inline-flex h-10 items-center gap-2 rounded-full bg-[#102c3d] px-4 text-xs font-semibold text-white">
          <Plus size={15} aria-hidden="true" />{actionLabel}
        </button>
      </div>
    </div>
  );
}

export function MvpModal({ title, eyebrow, children, onClose, wide = false }: { title: string; eyebrow?: string; children: ReactNode; onClose: () => void; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[#102c3d]/[0.35] px-4 py-6 backdrop-blur-sm">
      <section role="dialog" aria-modal="true" aria-label={title} className={`mx-auto rounded-xl bg-white shadow-[0_30px_90px_rgba(16,44,61,0.24)] ${wide ? "max-w-6xl" : "max-w-2xl"}`}>
        <div className="flex items-start justify-between gap-4 border-b border-[#102c3d]/[0.07] px-5 py-4">
          <div>{eyebrow ? <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#c95568]">{eyebrow}</p> : null}<h2 className="mt-0.5 text-xl font-semibold text-[#102c3d]">{title}</h2></div>
          <button type="button" onClick={onClose} title="Close" aria-label="Close" className="grid h-9 w-9 place-items-center rounded-lg text-[#102c3d]/[0.52] transition hover:bg-[#f5f8f6] hover:text-[#102c3d]"><X size={18} /></button>
        </div>
        <div className="p-5">{children}</div>
      </section>
    </div>
  );
}

export function FormSection({ title, copy, children }: { title: string; copy?: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-[#102c3d]/[0.07] bg-[#fbfcfb] p-4">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-[#102c3d]">{title}</h3>
        {copy ? <p className="mt-1 text-xs leading-5 text-[#102c3d]/[0.52]">{copy}</p> : null}
      </div>
      {children}
    </section>
  );
}

export function FormGrid({ children }: { children: ReactNode }) { return <div className="grid gap-4 md:grid-cols-2">{children}</div>; }

export function FormField({ label, value, onChange, required = false, type = "text", wide = false, placeholder }: { label: string; value: string; onChange: (value: string) => void; required?: boolean; type?: string; wide?: boolean; placeholder?: string }) {
  return <label className={`grid gap-1.5 text-xs font-semibold text-[#102c3d]/[0.58] ${wide ? "md:col-span-2" : ""}`}>{label}<input type={type} required={required} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="h-11 min-w-0 rounded-lg border border-[#102c3d]/[0.09] bg-[#f8fbfa] px-3 text-sm font-medium text-[#102c3d] outline-none transition focus:border-[#159b8f] focus:bg-white focus:ring-4 focus:ring-[#159b8f]/[0.10]" /></label>;
}

export function FormSelect({ label, value, options, onChange, required = false, wide = false }: { label: string; value: string; options: Array<string | { value: string; label: string }>; onChange: (value: string) => void; required?: boolean; wide?: boolean }) {
  return <label className={`grid gap-1.5 text-xs font-semibold text-[#102c3d]/[0.58] ${wide ? "md:col-span-2" : ""}`}>{label}<select required={required} value={value} onChange={(event) => onChange(event.target.value)} className="h-11 min-w-0 rounded-lg border border-[#102c3d]/[0.09] bg-[#f8fbfa] px-3 text-sm font-medium text-[#102c3d] outline-none transition focus:border-[#159b8f] focus:bg-white focus:ring-4 focus:ring-[#159b8f]/[0.10]">{options.map((option) => typeof option === "string" ? <option key={option} value={option}>{option}</option> : <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>;
}

export function FormTextArea({ label, value, onChange, required = false, wide = false, rows = 3, placeholder }: { label: string; value: string; onChange: (value: string) => void; required?: boolean; wide?: boolean; rows?: number; placeholder?: string }) {
  return <label className={`grid gap-1.5 text-xs font-semibold text-[#102c3d]/[0.58] ${wide ? "md:col-span-2" : ""}`}>{label}<textarea required={required} rows={rows} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="min-w-0 resize-y rounded-lg border border-[#102c3d]/[0.09] bg-[#f8fbfa] px-3 py-2.5 text-sm font-medium leading-6 text-[#102c3d] outline-none transition focus:border-[#159b8f] focus:bg-white focus:ring-4 focus:ring-[#159b8f]/[0.10]" /></label>;
}

export function FormTagInput({ label, values, onChange, wide = false, placeholder = "Type and press Enter or comma" }: { label: string; values: string[]; onChange: (value: string[]) => void; wide?: boolean; placeholder?: string }) {
  const [draft, setDraft] = useState("");

  function commitValue(value: string) {
    const next = value.trim();
    if (!next) return;
    onChange(Array.from(new Set([...values, next])));
    setDraft("");
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      commitValue(draft);
    }
    if (event.key === "Backspace" && !draft && values.length) {
      event.preventDefault();
      onChange(values.slice(0, -1));
    }
  }

  function onPaste(value: string) {
    const parts = value.split(",").map((item) => item.trim()).filter(Boolean);
    if (parts.length <= 1) return false;
    onChange(Array.from(new Set([...values, ...parts])));
    setDraft("");
    return true;
  }

  return (
    <label className={`grid gap-1.5 text-xs font-semibold text-[#102c3d]/[0.58] ${wide ? "md:col-span-2" : ""}`}>
      {label}
      <div className="rounded-lg border border-[#102c3d]/[0.09] bg-[#f8fbfa] px-3 py-2.5 transition focus-within:border-[#159b8f] focus-within:bg-white focus-within:ring-4 focus-within:ring-[#159b8f]/[0.10]">
        <div className="flex flex-wrap gap-2">
          {values.map((value) => (
            <span key={value} className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-[#102c3d] ring-1 ring-[#102c3d]/[0.08]">
              {value}
              <button type="button" onClick={() => onChange(values.filter((item) => item !== value))} className="text-[#102c3d]/[0.42] transition hover:text-[#102c3d]" aria-label={`Remove ${value}`}>
                <X size={12} />
              </button>
            </span>
          ))}
          <input
            value={draft}
            onChange={(event) => {
              if (event.target.value.includes(",")) {
                const parts = event.target.value.split(",");
                const latest = parts.pop() ?? "";
                const committed = parts.map((item) => item.trim()).filter(Boolean);
                if (committed.length) {
                  onChange(Array.from(new Set([...values, ...committed])));
                }
                setDraft(latest);
                return;
              }
              setDraft(event.target.value);
            }}
            onKeyDown={onKeyDown}
            onBlur={() => commitValue(draft)}
            onPaste={(event) => {
              const pasted = event.clipboardData.getData("text");
              if (onPaste(pasted)) {
                event.preventDefault();
              }
            }}
            placeholder={values.length ? "Add another" : placeholder}
            className="min-w-[8rem] flex-1 bg-transparent py-1 text-sm font-medium text-[#102c3d] outline-none placeholder:text-[#102c3d]/[0.34]"
          />
        </div>
      </div>
    </label>
  );
}

export function FormActions({ onCancel, label = "Save changes", error }: { onCancel: () => void; label?: string; error?: string }) {
  return <div className="mt-5 flex flex-col gap-3 border-t border-[#102c3d]/[0.07] pt-4 sm:flex-row sm:items-center sm:justify-between">{error ? <p className="text-xs font-semibold text-[#b53c52]">{error}</p> : <span />}<div className="flex justify-end gap-2"><button type="button" onClick={onCancel} className="h-10 rounded-full bg-white px-4 text-xs font-semibold text-[#102c3d]/[0.62] ring-1 ring-[#102c3d]/[0.1]">Cancel</button><button className="h-10 rounded-full bg-[#102c3d] px-5 text-xs font-semibold text-white">{label}</button></div></div>;
}

export function StatusBadge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "green" | "yellow" | "red" | "blue" }) {
  const tones = { neutral: "bg-[#f5f7f3] text-[#102c3d]/[0.62]", green: "bg-[#e9f7f2] text-[#0b6f63]", yellow: "bg-[#fff7cf] text-[#756000]", red: "bg-[#fff0f2] text-[#b13b51]", blue: "bg-[#eef4f8] text-[#315e78]" };
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${tones[tone]}`}>{children}</span>;
}

export function TableShell({ children }: { children: ReactNode }) { return <div className="min-w-0 max-w-full overflow-x-auto rounded-xl border border-[#102c3d]/[0.07]"><table className="w-full min-w-[900px] border-collapse text-left text-sm">{children}</table></div>; }
export function TableHead({ children }: { children: ReactNode }) { return <thead className="bg-[#f8fbfa] text-[10px] font-semibold uppercase tracking-[0.12em] text-[#102c3d]/[0.42]">{children}</thead>; }
export function TableBody({ children }: { children: ReactNode }) { return <tbody className="divide-y divide-[#102c3d]/[0.055] bg-white">{children}</tbody>; }
export function TableAction({ children, onClick, danger = false }: { children: ReactNode; onClick: () => void; danger?: boolean }) { return <button type="button" onClick={onClick} className={`rounded-full px-3 py-1.5 text-xs font-semibold ring-1 transition ${danger ? "bg-white text-[#b13b51] ring-[#b13b51]/[0.15] hover:bg-[#fff0f2]" : "bg-[#f5f7f3] text-[#102c3d]/[0.68] ring-[#102c3d]/[0.07] hover:text-[#102c3d]"}`}>{children}</button>; }
