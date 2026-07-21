"use client";

import { ArrowRight, Check, ClipboardCheck, GraduationCap, LayoutDashboard, Sparkles, X } from "lucide-react";
import { useState } from "react";
import type { ProspectAccessMeta } from "@/lib/levytate/mvp/api";

const steps = [
  { title: "Open Operations Centre", copy: "See which learner and programme actions need attention.", target: "Home", icon: LayoutDashboard },
  { title: "Explore Learners", copy: "Open a learner record to review progress, reviews and lifecycle information.", target: "Learners", icon: GraduationCap },
  { title: "Review Applications", copy: "See how applications move through employee and manager approval.", target: "Applications", icon: ClipboardCheck },
  { title: "Ask Copilot", copy: "Try: ‘What requires attention today?’", target: "Copilot", icon: Sparkles },
] as const;

export function ProspectGettingStarted({ access, onNavigate }: { access: ProspectAccessMeta; onNavigate: (target: string) => void }) {
  const [open, setOpen] = useState(!access.guidanceCompletedAt);
  const [completed, setCompleted] = useState(Boolean(access.guidanceCompletedAt));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function openStep(target: string) {
    onNavigate(target);
    setOpen(false);
  }

  async function complete() {
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/levytate-prospect-access", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ operation: "complete_guidance" }),
      });
      const payload = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(payload.message || "Guidance completion could not be saved.");
      setCompleted(true);
      setOpen(false);
    } catch (completionError) {
      setError(completionError instanceof Error ? completionError.message : "Guidance completion could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[#159b8f]/15 bg-white px-4 text-xs font-semibold text-[#0b6f63] shadow-[0_8px_20px_rgba(16,44,61,0.05)] transition hover:border-[#159b8f]/30 hover:bg-[#f4fbf8]">
        <Sparkles size={15} aria-hidden="true" /> Getting started{completed ? <Check size={14} aria-hidden="true" /> : null}
      </button>

      {open ? (
        <div className="fixed inset-0 z-[70] overflow-y-auto bg-[#102c3d]/45 px-4 py-5 backdrop-blur-sm sm:px-6 sm:py-8" role="dialog" aria-modal="true" aria-labelledby="prospect-welcome-title">
          <section className="mx-auto w-full max-w-3xl overflow-hidden rounded-[1.5rem] border border-white/60 bg-white shadow-[0_30px_100px_rgba(16,44,61,0.28)]">
            <div className="flex items-start justify-between gap-4 border-b border-[#102c3d]/[0.07] bg-[#f3faf7] px-5 py-5 sm:px-7 sm:py-6">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#0b8e82]">Your prepared workspace</p>
                <h2 id="prospect-welcome-title" className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-[#102c3d] sm:text-3xl">Welcome to LevyTate</h2>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-[#102c3d]/64">This workspace has been prepared so you can explore how LevyTate supports apprenticeship applications, learner oversight and day-to-day programme management.</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Show this again later" className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-[#102c3d]/[0.08] bg-white text-[#102c3d]/55 transition hover:text-[#102c3d]"><X size={18} /></button>
            </div>

            <div className="grid gap-3 p-5 sm:grid-cols-2 sm:p-7">
              {steps.map(({ title, copy, target, icon: Icon }) => (
                <button key={title} type="button" onClick={() => openStep(target)} className="group flex min-h-[116px] items-start gap-4 rounded-2xl border border-[#102c3d]/[0.08] bg-white p-4 text-left transition hover:-translate-y-0.5 hover:border-[#159b8f]/25 hover:shadow-[0_16px_30px_rgba(16,44,61,0.08)]">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#eaf5f1] text-[#0b8e82]"><Icon size={19} /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-[#102c3d]">{title}</span>
                    <span className="mt-1.5 block text-xs leading-5 text-[#102c3d]/58">{copy}</span>
                  </span>
                  <ArrowRight size={16} className="mt-1 shrink-0 text-[#102c3d]/30 transition group-hover:translate-x-0.5 group-hover:text-[#0b8e82]" />
                </button>
              ))}
            </div>

            <div className="flex flex-col-reverse gap-3 border-t border-[#102c3d]/[0.07] px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-7">
              <button type="button" onClick={() => setOpen(false)} className="min-h-11 rounded-full px-4 text-xs font-semibold text-[#102c3d]/58 transition hover:bg-[#f5f8f6] hover:text-[#102c3d]">Show this again later</button>
              <div className="flex flex-col gap-2 sm:flex-row">
                <button type="button" onClick={() => { onNavigate("Home"); setOpen(false); }} className="min-h-11 rounded-full border border-[#102c3d]/[0.1] px-5 text-xs font-semibold text-[#102c3d] transition hover:bg-[#f5f8f6]">Continue exploring</button>
                <button type="button" disabled={saving || completed} onClick={() => void complete()} className="min-h-11 rounded-full bg-[#102c3d] px-5 text-xs font-semibold text-white transition hover:bg-[#17394d] disabled:cursor-not-allowed disabled:opacity-55">{completed ? "Guidance complete" : saving ? "Saving…" : "Mark guidance complete"}</button>
              </div>
            </div>
            {error ? <p className="px-7 pb-5 text-sm font-medium text-[#a93d52]" role="alert">{error}</p> : null}
          </section>
        </div>
      ) : null}
    </>
  );
}
