"use client";

import { Check, LoaderCircle } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type {
  DemoPerspectiveId,
  DemoRoleSwitcherState,
} from "@/lib/levytate/demo-role-switcher";

export type DemoPerspectiveController = {
  state: DemoRoleSwitcherState | null;
  switchingTo: DemoPerspectiveId | null;
  error: string;
  switchPerspective: (perspective: DemoPerspectiveId) => Promise<void>;
};

export function useDemoPerspectiveSwitcher(): DemoPerspectiveController {
  const [state, setState] = useState<DemoRoleSwitcherState | null>(null);
  const [switchingTo, setSwitchingTo] = useState<DemoPerspectiveId | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch("/api/levytate-demo-perspective", {
          cache: "no-store",
          credentials: "same-origin",
          signal: controller.signal,
        });
        if (response.status === 404 || !response.ok) return;
        const payload = await response.json() as { switcher?: DemoRoleSwitcherState };
        if (payload.switcher?.enabled) setState(payload.switcher);
      } catch (cause) {
        if (!(cause instanceof DOMException && cause.name === "AbortError")) setState(null);
      }
    }
    void load();
    return () => controller.abort();
  }, []);

  const switchPerspective = useCallback(async (perspective: DemoPerspectiveId) => {
    if (!state || perspective === state.currentPerspective || switchingTo) return;
    setSwitchingTo(perspective);
    setError("");
    try {
      const response = await fetch("/api/levytate-demo-perspective", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ perspective }),
      });
      const payload = await response.json().catch(() => null) as { message?: string } | null;
      if (!response.ok) {
        setError(payload?.message ?? "We could not change the demo perspective. Try again.");
        return;
      }
      window.location.assign("/levytate/app");
    } catch {
      setError("We could not change the demo perspective. Check your connection and try again.");
    } finally {
      setSwitchingTo(null);
    }
  }, [state, switchingTo]);

  return { state, switchingTo, error, switchPerspective };
}

export function DemoModeIndicator({ state }: { state: DemoRoleSwitcherState }) {
  return (
    <div
      data-testid="demo-mode-indicator"
      className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-[#159b8f]/20 bg-[#eaf5f1] px-2.5 text-[10px] font-semibold uppercase tracking-[0.09em] text-[#0b6f63] sm:px-3"
      aria-label={`Demo mode. Current perspective: ${state.currentRole}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-[#159b8f] ring-2 ring-white" aria-hidden="true" />
      <span>Demo mode</span>
      <span className="hidden normal-case tracking-normal text-[#102c3d]/55 lg:inline">· {state.currentRole}</span>
    </div>
  );
}

export function DemoPerspectiveMenu({ controller }: { controller: DemoPerspectiveController }) {
  const { state, switchingTo, error, switchPerspective } = controller;
  if (!state) return null;

  return (
    <section className="mt-2 border-t border-[#102c3d]/[0.08] pt-3" aria-labelledby="demo-perspective-label">
      <div className="px-2">
        <p id="demo-perspective-label" className="text-[10px] font-semibold uppercase tracking-[0.13em] text-[#0b6f63]">Demo perspective</p>
        <p className="mt-1 text-[11px] leading-4 text-[#102c3d]/52">Switch between the connected fictional roles.</p>
      </div>
      <div className="mt-2 grid gap-1" role="group" aria-label="Demo perspectives">
        {state.options.map((option) => {
          const selected = option.id === state.currentPerspective;
          const pending = option.id === switchingTo;
          return (
            <button
              key={option.id}
              role="menuitemradio"
              aria-checked={selected}
              type="button"
              disabled={selected || Boolean(switchingTo)}
              onClick={() => void switchPerspective(option.id)}
              className={`flex min-h-12 w-full items-start gap-2 rounded-xl px-2.5 py-2 text-left transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#159b8f]/20 disabled:cursor-default ${selected ? "bg-[#eaf5f1] text-[#102c3d]" : "text-[#102c3d]/72 hover:bg-[#f4f8f5]"}`}
            >
              <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border ${selected ? "border-[#159b8f] bg-[#159b8f] text-white" : "border-[#102c3d]/15 bg-white text-[#0b6f63]"}`}>
                {pending ? <LoaderCircle size={12} className="animate-spin" aria-hidden="true" /> : selected ? <Check size={12} aria-hidden="true" /> : null}
              </span>
              <span className="min-w-0">
                <span className="block text-xs font-semibold">{option.label}{selected ? " — selected" : ""}</span>
                <span className="mt-0.5 block text-[10px] leading-4 text-[#102c3d]/48">{option.description}</span>
              </span>
            </button>
          );
        })}
      </div>
      <p className="mt-2 min-h-4 px-2 text-[11px] leading-4 text-[#b13b51]" role="status" aria-live="polite">{error}</p>
    </section>
  );
}
