"use client";

import { PanelRightOpen, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { AskLevyTateAiWorkspace } from "@/components/levytate-mvp/AskLevyTateAiWorkspace";
import type { LevyTateCopilotContext } from "@/lib/levytate/copilot-context";
import { topmostModalDialog } from "@/lib/levytate/dialog-focus";

export function PersistentCopilot({ context, initialEmployeeId, onNavigate }: { context: LevyTateCopilotContext; initialEmployeeId?: string | null; onNavigate?: (target: string) => void }) {
  const [open, setOpen] = useState(false);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented || topmostModalDialog(document)) return;
      event.preventDefault();
      setOpen(false);
      requestAnimationFrame(() => launcherRef.current?.focus());
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open]);

  function close() {
    setOpen(false);
    requestAnimationFrame(() => launcherRef.current?.focus());
  }

  return <>
    <button ref={launcherRef} type="button" aria-label="Open Copilot" aria-expanded={open} aria-controls="levytate-persistent-copilot" onClick={() => setOpen(true)} data-testid="contextual-copilot-trigger" className={`lt-contextual-copilot-trigger fixed bottom-5 right-5 z-40 hidden min-h-11 items-center justify-center gap-2 rounded-xl border border-lt-border bg-lt-ink px-4 py-3 text-sm font-semibold text-white shadow-lg transition duration-150 hover:bg-[#17394d] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#159b8f] focus-visible:ring-offset-2 lg:flex ${open ? "pointer-events-none translate-x-full opacity-0" : ""}`}><PanelRightOpen size={16} aria-hidden="true" />Ask Copilot</button>
    <aside id="levytate-persistent-copilot" role="dialog" aria-labelledby="levytate-persistent-copilot-title" aria-hidden={!open} inert={!open} className={`fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l border-[#102c3d]/[0.1] bg-white shadow-[-18px_0_45px_rgba(16,44,61,.14)] transition-transform duration-200 sm:w-[min(400px,calc(100vw-3rem))] ${open ? "translate-x-0" : "pointer-events-none translate-x-full"}`}>
      <header className="flex min-h-16 items-center justify-between gap-3 border-b border-[#102c3d]/[0.08] px-5 py-3"><div className="min-w-0"><h2 id="levytate-persistent-copilot-title" className="text-lg font-semibold tracking-[-0.025em] text-lt-ink">Copilot</h2><p className="mt-0.5 truncate text-xs text-lt-muted" title={context.contextLabel}>{context.contextLabel}</p></div><button ref={closeRef} type="button" onClick={close} className="grid h-11 w-11 shrink-0 place-items-center rounded-lg text-lt-muted transition hover:bg-[#f1f5f3] hover:text-lt-ink" aria-label="Close Copilot"><X size={18} /></button></header>
      <div className="min-h-0 flex-1"><AskLevyTateAiWorkspace presentation="drawer" context={context} initialEmployeeId={initialEmployeeId} onNavigate={onNavigate} /></div>
    </aside>
  </>;
}
