"use client";

import { WorkspaceSessionRecovery } from "@/components/levytate-mvp/MvpWorkspaceStore";
import { dialogTabBoundary, dialogTabStops, isTopmostDialog, restoreDialogFocus } from "@/lib/levytate/dialog-focus";
import { filterSearchableOptions, type SearchableOption } from "@/lib/levytate/mvp/searchable-options";

import { Plus, Search, X } from "lucide-react";
import { useEffect, useId, useRef, useState, type ButtonHTMLAttributes, type KeyboardEvent, type ReactNode } from "react";

export function MvpPanel({ title, eyebrow, actions, children }: { title: string; eyebrow?: string; actions?: ReactNode; children: ReactNode }) {
  return (
    <section className="lt-panel min-w-0">
      <div className="lt-panel-heading flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div>
          {eyebrow ? <p className="lt-eyebrow">{eyebrow}</p> : null}
          <h2 className="mt-0.5 text-lg font-semibold text-lt-ink">{title}</h2>
        </div>
        {actions}
      </div>
      <div className="min-w-0 p-5 sm:p-6">{children}</div>
    </section>
  );
}

export function MvpToolbar({ search, onSearch, placeholder, actionLabel, onAction, filters }: { search: string; onSearch: (value: string) => void; placeholder: string; actionLabel?: string; onAction?: () => void; filters?: ReactNode }) {
  return (
    <div className={`mb-4 grid gap-3 ${filters ? "xl:grid-cols-[minmax(180px,0.8fr)_minmax(0,1.4fr)_auto] xl:items-end" : "lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end"}`}>
      <label className="lt-control flex min-h-11 min-w-0 items-center gap-2 px-3">
        <Search size={16} strokeWidth={1.8} className="shrink-0 text-lt-muted" aria-hidden="true" />
        <input aria-label={placeholder} value={search} onChange={(event) => onSearch(event.target.value)} className="min-w-0 flex-1 bg-transparent text-sm text-lt-ink outline-none placeholder:text-lt-muted" placeholder={placeholder} />
      </label>
      {filters ? <div className="min-w-0">{filters}</div> : null}
      {actionLabel && onAction ? (
        <button type="button" onClick={onAction} className="lt-button lt-primary">
          <Plus size={15} strokeWidth={2} aria-hidden="true" />
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}

export function ListResultsBar({ count, total, singular, plural, filtered, onReset, actions }: { count:number;total:number;singular:string;plural:string;filtered:boolean;onReset:()=>void;actions?:ReactNode }) {
  return <div className="mb-3 flex min-h-10 flex-wrap items-center justify-between gap-2 border-b border-lt-border pb-2">
    <p role="status" aria-live="polite" className="text-sm text-lt-muted"><strong className="font-semibold tabular-nums text-lt-ink">{count}</strong>{filtered?` of ${total}`:""} {total===1?singular:plural}</p>
    <div className="flex flex-wrap items-center gap-3">{actions}{filtered?<button type="button" onClick={onReset} className="min-h-10 px-2 text-sm font-semibold text-lt-accent hover:underline">Clear filters</button>:null}</div>
  </div>;
}

export function FilteredEmptyState({title,onReset}:{title:string;onReset:()=>void}) {
  return <div className="lt-empty grid min-h-44 place-items-center p-5 text-center"><div><Search className="mx-auto mb-3 text-lt-muted" size={22} aria-hidden="true"/><h3 className="text-base font-semibold">{title}</h3><p className="mt-1 text-sm text-lt-muted">Try another search or clear the filters.</p><button type="button" className="lt-button lt-secondary mt-4" onClick={onReset}>Clear filters</button></div></div>;
}

export function EmptyState({ title, copy, actionLabel, onAction }: { title: string; copy: string; actionLabel: string; onAction: () => void }) {
  return (
    <div className="lt-empty grid min-h-52 place-items-center px-5 py-10 text-center">
      <div className="max-w-md">
        <h3 className="text-base font-semibold text-lt-ink">{title}</h3>
        <p className="mt-2 text-sm leading-6 text-lt-muted">{copy}</p>
        <button type="button" onClick={onAction} className="lt-button lt-primary mt-5">
          <Plus size={15} aria-hidden="true" />{actionLabel}
        </button>
      </div>
    </div>
  );
}

export function MvpModal({ title, eyebrow, description, children, onClose, wide = false }: { title: string; eyebrow?: string; description?: string; children: ReactNode; onClose: () => void; wide?: boolean }) {
  const titleId = useId();
  const modalRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const modal = modalRef.current;
    if (!modal) return;
    closeRef.current?.focus();
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.defaultPrevented || !isTopmostDialog(modal)) return;
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const target = dialogTabBoundary(modal, document.activeElement, event.shiftKey);
      if (target) {
        event.preventDefault();
        target.focus();
      }
    };
    const onFocusIn = (event: FocusEvent) => {
      if (isTopmostDialog(modal) && event.target instanceof Node && !modal.contains(event.target)) {
        (dialogTabStops(modal)[0] ?? modal).focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("focusin", onFocusIn);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("focusin", onFocusIn);
      restoreDialogFocus(previousFocus);
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[#102c3d]/[0.38] px-4 py-6 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section ref={modalRef} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} className={`lt-modal mx-auto bg-white ${wide ? "max-w-6xl" : "max-w-2xl"}`}>
        <div className="lt-dialog-heading flex items-start justify-between gap-4">
          <div className="min-w-0">{eyebrow ? <p className="lt-eyebrow">{eyebrow}</p> : null}<h2 id={titleId} className="lt-dialog-title">{title}</h2>{description?<p className="mt-1 text-sm leading-5 text-lt-muted">{description}</p>:null}</div>
          <button ref={closeRef} type="button" onClick={onClose} title="Close" aria-label="Close dialog" className="grid h-11 w-11 place-items-center rounded-xl text-lt-muted transition hover:bg-[#f5f8f6] hover:text-lt-ink focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#159b8f]/20"><X size={18} /></button>
        </div>
        <div className="lt-dialog-body min-w-0"><WorkspaceSessionRecovery />{children}</div>
      </section>
    </div>
  );
}

export function FormSection({ title, copy, children }: { title: string; copy?: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-[#102c3d]/[0.07] bg-[#fbfcfb] p-4">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-lt-ink">{title}</h3>
        {copy ? <p className="mt-1 text-xs leading-5 text-lt-muted">{copy}</p> : null}
      </div>
      {children}
    </section>
  );
}

export function FormGrid({ children }: { children: ReactNode }) { return <div className="grid gap-4 md:grid-cols-2">{children}</div>; }

export function FormField({ label, value, onChange, required = false, type = "text", wide = false, placeholder }: { label: string; value: string; onChange: (value: string) => void; required?: boolean; type?: string; wide?: boolean; placeholder?: string }) {
  return <label className={`lt-label grid gap-1.5 ${wide ? "md:col-span-2" : ""}`}>{label}<input type={type} required={required} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="lt-control h-11 min-w-0 px-3 text-sm font-medium outline-none" /></label>;
}

export function FormSelect({ label, value, options, onChange, required = false, wide = false }: { label: string; value: string; options: Array<string | { value: string; label: string }>; onChange: (value: string) => void; required?: boolean; wide?: boolean }) {
  return <label className={`lt-label grid gap-1.5 ${wide ? "md:col-span-2" : ""}`}>{label}<select required={required} value={value} onChange={(event) => onChange(event.target.value)} className="lt-control h-11 min-w-0 px-3 text-sm font-medium outline-none">{options.map((option) => typeof option === "string" ? <option key={option} value={option}>{option}</option> : <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>;
}

/** Search long option lists while keeping native select semantics, required
 * validation and the selected option. No hidden automatic programme selection. */
export function SearchableFormSelect({ label, value, options, onChange, required=false, wide=false, placeholder="Search programmes" }: { label:string;value:string;options:SearchableOption[];onChange:(value:string)=>void;required?:boolean;wide?:boolean;placeholder?:string }) {
  const [query,setQuery]=useState("");
  const {choices,matches}=filterSearchableOptions(options,value,query);
  return <div className={`lt-form-search ${wide?"md:col-span-2":""}`}>
    <label className="lt-label grid gap-1.5">Find {label.toLowerCase()}<span className="lt-control flex min-h-11 min-w-0 items-center gap-2 px-3"><Search size={16} className="shrink-0 text-lt-muted" aria-hidden="true"/><input type="search" value={query} onChange={event=>setQuery(event.target.value)} onKeyDown={event=>{if(event.key==="Enter")event.preventDefault();}} placeholder={placeholder} className="min-w-0 flex-1 bg-transparent text-sm font-normal text-lt-ink outline-none"/></span></label>
    <FormSelect label={label} value={value} options={choices} onChange={onChange} required={required}/>
    <p className="lt-form-search-count" aria-live="polite">{matches===0?"No matching programmes. Try another search.":`${matches} programme${matches===1?"":"s"} available`}</p>
  </div>;
}

export function FormTextArea({ label, value, onChange, required = false, wide = false, rows = 3, placeholder }: { label: string; value: string; onChange: (value: string) => void; required?: boolean; wide?: boolean; rows?: number; placeholder?: string }) {
  return <label className={`lt-label grid gap-1.5 ${wide ? "md:col-span-2" : ""}`}>{label}<textarea required={required} rows={rows} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="lt-control min-w-0 resize-y px-3 py-2.5 text-sm font-medium leading-6 outline-none" /></label>;
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
    <label className={`lt-label grid gap-1.5 ${wide ? "md:col-span-2" : ""}`}>
      {label}
      <div className="rounded-lg border border-[#102c3d]/[0.09] bg-[#f8fbfa] px-3 py-2.5 transition focus-within:border-[#159b8f] focus-within:bg-white focus-within:ring-4 focus-within:ring-[#159b8f]/[0.10]">
        <div className="flex flex-wrap gap-2">
          {values.map((value) => (
            <span key={value} className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-lt-ink ring-1 ring-[#102c3d]/[0.08]">
              {value}
              <button type="button" onClick={() => onChange(values.filter((item) => item !== value))} className="text-lt-muted transition hover:text-lt-ink" aria-label={`Remove ${value}`}>
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
            className="min-w-[8rem] flex-1 bg-transparent py-1 text-sm font-medium text-lt-ink outline-none placeholder:text-lt-muted"
          />
        </div>
      </div>
    </label>
  );
}

export function FormActions({ onCancel, label = "Save changes", error, disabled = false, submissionBlocked = false }: { onCancel: () => void; label?: string; error?: string; disabled?: boolean; submissionBlocked?: boolean }) {
  return <div className="mt-5 flex flex-col gap-3 border-t border-[#102c3d]/[0.07] pt-4 sm:flex-row sm:items-center sm:justify-between">{error ? <p role="alert" className="text-xs font-semibold text-lt-risk">{error}</p> : <span />}<div className="flex justify-end gap-2"><button type="button" disabled={disabled} onClick={onCancel} className="lt-button lt-secondary">Cancel</button><button type="submit" disabled={disabled || submissionBlocked} className="lt-button lt-primary">{label}</button></div></div>;
}

export function StatusBadge({ children, tone = "neutral", testId }: { children: ReactNode; tone?: "neutral" | "green" | "yellow" | "red" | "blue"; testId?: string }) {
  const tones = { neutral: "bg-[#f5f7f3] text-lt-muted", green: "bg-[#e9f7f2] text-lt-accent", yellow: "bg-[#fff7cf] text-[#756000]", red: "bg-[#fff0f2] text-lt-risk", blue: "bg-[#eef4f8] text-[#315e78]" };
  return <span data-testid={testId} className={`inline-flex max-w-full items-center rounded-lg px-2.5 py-1 text-xs font-semibold leading-4 ${tones[tone]}`}>{children}</span>;
}

export function MvpButton({ variant = "primary", className = "", children, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "destructive" }) {
  const variants = {
    primary: "lt-primary",
    secondary: "lt-secondary",
    destructive: "lt-danger",
  };
  return <button {...props} className={`lt-button ${variants[variant]} ${className}`}>{children}</button>;
}

export function MvpNotice({ tone = "info", children }: { tone?: "info" | "success" | "error"; children: ReactNode }) {
  const tones = { info: "border-[#315e78]/15 bg-[#eef4f8] text-[#315e78]", success: "border-[#0b6f63]/15 bg-[#e9f7f2] text-lt-accent", error: "border-[#b13b51]/15 bg-[#fff0f2] text-lt-risk" };
  return <div role={tone === "error" ? "alert" : "status"} className={`rounded-xl border px-4 py-3 text-sm font-semibold leading-6 ${tones[tone]}`}>{children}</div>;
}

export function MvpLoadingState({ label = "Loading workspace…" }: { label?: string }) {
  return <div role="status" aria-live="polite" className="rounded-2xl border border-[#102c3d]/[0.07] bg-white p-6"><span className="sr-only">{label}</span><div aria-hidden="true" className="grid animate-pulse gap-3"><div className="h-3 w-24 rounded-full bg-[#102c3d]/10" /><div className="h-7 w-2/5 rounded-lg bg-[#102c3d]/10" /><div className="h-16 rounded-xl bg-[#f1f5f2]" /></div></div>;
}

export function TableShell({ children, minimumWidthClass = "min-w-[900px]", tableClassName = "", testId, responsive=false, label }: { children: ReactNode; minimumWidthClass?: string; tableClassName?: string; testId?: string; responsive?:boolean;label?:string }) { return <div data-testid={testId} className={`lt-table min-w-0 max-w-full overflow-x-auto ${responsive?"lt-responsive-table":""}`}><table role="table" aria-label={label} className={`w-full ${responsive?"min-w-0":minimumWidthClass} border-collapse text-left text-sm ${tableClassName}`}>{children}</table></div>; }
export function TableHead({ children }: { children: ReactNode }) { return <thead role="rowgroup" className="bg-[#f5f7f6] text-xs font-semibold text-lt-secondary">{children}</thead>; }
export function TableBody({ children }: { children: ReactNode }) { return <tbody role="rowgroup" className="divide-y divide-[#102c3d]/[0.055] bg-white">{children}</tbody>; }
export function TableAction({ children, onClick, danger = false, testId }: { children: ReactNode; onClick: () => void; danger?: boolean; testId?: string }) { return <button data-testid={testId} type="button" onClick={onClick} className={`lt-row-action ${danger?"lt-row-action-danger":""}`}>{children}</button>; }
