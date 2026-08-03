"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { LevyTateLogo } from "@/components/levytate-demo/PlatformShell";

export function LevyTateLoginClient({ internalLoginEnabled }: { internalLoginEnabled: boolean }) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showInternal, setShowInternal] = useState(false);
  const [demoEmail, setDemoEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const invalidLink = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("auth") === "invalid-link";

  async function requestLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setLoading(true); setError("");
    const response = await fetch("/api/levytate-auth/request", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
    setLoading(false);
    if (!response.ok) { setError("We couldn’t complete sign-in just now. Please try again."); return; }
    setSent(true);
  }

  async function internalLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setLoading(true); setError("");
    const response = await fetch("/api/levytate-beta-login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: demoEmail, code }) });
    const body = await response.json().catch(() => null); setLoading(false);
    if (!response.ok) { setError(body?.message ?? "Internal demonstration sign-in failed."); return; }
    window.location.assign("/levytate/app");
  }

  return <main className="grid min-h-screen place-items-center overflow-x-hidden bg-[#f6fbf8] px-5 py-10 text-[#102c3d]">
    <section className="w-full max-w-md rounded-[1.5rem] border border-[#102c3d]/[0.08] bg-white p-6 shadow-[0_30px_90px_rgba(16,44,61,0.1)]">
      <div className="flex items-center justify-between gap-4"><LevyTateLogo className="[--levytate-logo-size:2.55rem]" /><Link href="/" className="rounded-full bg-[#f5f8f6] px-4 py-2 text-xs font-semibold text-[#102c3d]/64 ring-1 ring-[#102c3d]/[0.07]">Public site</Link></div>
      <div className="mt-8"><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#c95568]">Secure access</p><h1 className="mt-2 text-3xl font-semibold tracking-[-0.035em]">Sign in to LevyTate</h1><p className="mt-3 text-sm leading-6 text-[#102c3d]/60">Enter your work email and we’ll send you a secure sign-in link.</p></div>
      {invalidLink ? <p className="mt-5 rounded-2xl bg-[#fff4f5] px-4 py-3 text-sm text-[#ad344e]">This sign-in link is invalid or has expired. Request a new one.</p> : null}
      {sent ? <div className="mt-6 rounded-2xl bg-[#eef9f5] p-5 ring-1 ring-[#159b8f]/15"><h2 className="font-semibold">Check your email</h2><p className="mt-2 text-sm leading-6 text-[#102c3d]/64">If this email is authorised for LevyTate, you’ll receive a secure sign-in link.</p><button onClick={() => setSent(false)} className="mt-4 text-sm font-semibold text-[#087c73]">Use another email</button></div> : <form onSubmit={requestLink} className="mt-6 grid gap-4"><EmailField value={email} onChange={setEmail} /><button disabled={loading} className="h-12 rounded-full bg-[#102c3d] px-5 text-sm font-semibold text-white disabled:opacity-70">{loading ? "Sending secure link" : "Send secure sign-in link"}</button></form>}
      {internalLoginEnabled ? <div className="mt-6 border-t border-[#102c3d]/[0.08] pt-5"><button onClick={() => setShowInternal(!showInternal)} className="text-xs font-semibold text-[#102c3d]/55">Internal demonstration access</button>{showInternal ? <form onSubmit={internalLogin} className="mt-4 grid gap-3 rounded-2xl bg-[#f8fbfa] p-4"><EmailField value={demoEmail} onChange={setDemoEmail} /><input aria-label="Internal access code" required value={code} onChange={(event) => setCode(event.target.value)} className="h-11 min-w-0 rounded-xl border border-[#102c3d]/10 bg-white px-3 text-sm" placeholder="Internal access code" /><button disabled={loading} className="h-11 rounded-full bg-[#102c3d] text-sm font-semibold text-white">Open demonstration</button></form> : null}</div> : null}
      {error ? <p className="mt-4 rounded-2xl bg-[#fff4f5] px-4 py-3 text-sm text-[#ad344e]">{error}</p> : null}
    </section>
  </main>;
}

function EmailField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return <label className="grid min-w-0 gap-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-[#102c3d]/42">Work email<input type="email" autoComplete="email" inputMode="email" required value={value} onChange={(event) => onChange(event.target.value)} className="h-12 min-w-0 rounded-2xl border border-[#102c3d]/[0.08] bg-[#f8fbfa] px-4 text-sm font-medium normal-case tracking-normal text-[#102c3d] outline-none focus:border-[#159b8f] focus:bg-white focus:ring-4 focus:ring-[#159b8f]/10" placeholder="you@company.co.uk" /></label>;
}
