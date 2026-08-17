"use client";

import { PanelRightOpen, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { AskLevyTateAiWorkspace } from "@/components/levytate-mvp/AskLevyTateAiWorkspace";
import type { LevyTateCopilotContext } from "@/lib/levytate/copilot-context";

export function PersistentCopilot({ context, initialEmployeeId, onNavigate }: { context: LevyTateCopilotContext; initialEmployeeId?: string | null; onNavigate?: (target: string) => void }) {
  const [open, setOpen] = useState(false);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
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
    <button ref={launcherRef} type="button" aria-expanded={open} aria-controls="levytate-persistent-copilot" onClick={() => setOpen(true)} className={`fixed right-0 top-[46%] z-40 flex min-h-11 items-center gap-2 rounded-l-xl border border-r-0 border-[#102c3d]/15 bg-[#102c3d] px-3 py-3 text-xs font-semibold text-white shadow-[0_12px_30px_rgba(16,44,61,.18)] transition hover:bg-[#17394d] max-sm:bottom-5 max-sm:top-auto ${open ? "pointer-events-none translate-x-full opacity-0" : ""}`}><PanelRightOpen size={16} aria-hidden="true" />Copilot</button>
    <aside id="levytate-persistent-copilot" role="dialog" aria-labelledby="levytate-persistent-copilot-title" aria-hidden={!open} inert={!open} className={`fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l border-[#102c3d]/[0.1] bg-white shadow-[-18px_0_45px_rgba(16,44,61,.14)] transition-transform duration-200 sm:w-[min(420px,calc(100vw-3rem))] ${open ? "translate-x-0" : "pointer-events-none translate-x-full"}`}>
      <header className="flex min-h-20 items-center justify-between gap-4 border-b border-[#102c3d]/[0.08] px-5"><div><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#b94f64]">LevyTate</p><h2 id="levytate-persistent-copilot-title" className="mt-1 text-xl font-semibold tracking-[-0.025em] text-[#102c3d]">Copilot</h2></div><button ref={closeRef} type="button" onClick={close} className="grid h-11 w-11 place-items-center rounded-full bg-[#f1f5f3] text-[#102c3d]" aria-label="Close Copilot"><X size={18} /></button></header>
      <div className="min-h-0 flex-1"><AskLevyTateAiWorkspace presentation="drawer" context={context} initialEmployeeId={initialEmployeeId} onNavigate={onNavigate} /></div>
    </aside>
  </>;
}
