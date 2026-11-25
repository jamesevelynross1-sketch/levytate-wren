"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { LevyTateLogo } from "@/components/levytate-demo/PlatformShell";
import { useHydratedForm } from "@/components/levytate-mvp/useHydratedForm";
import { isSignInRequestAcknowledgement } from "@/lib/levytate/sign-in-form";

export function LevyTateLoginClient({ internalLoginEnabled, invalidLink = false, authIssue, providerLogoutWarning = false }: { internalLoginEnabled: boolean; invalidLink?: boolean; authIssue?: "rate-limited" | "unavailable"; providerLogoutWarning?: boolean }) {
  const ready = useHydratedForm();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showInternal, setShowInternal] = useState(false);
  const [demoEmail, setDemoEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  async function requestLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ready || loading) return;
    const submittedEmail = new FormData(event.currentTarget).get("email");
    if (typeof submittedEmail !== "string" || !submittedEmail.trim()) { setError("Enter your work email to request a sign-in link."); return; }
    // Read the actual form so browser autofill cannot leave React state stale.
    setEmail(submittedEmail); setLoading(true); setError("");
    try {
      const response = await fetch("/api/levytate-auth/request", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: submittedEmail }) });
      const body = await response.json().catch(() => null);
      if (!response.ok) { setError(body?.message ?? "We couldn’t complete sign-in just now. Please try again."); return; }
      if (!isSignInRequestAcknowledgement(body)) throw new Error("Sign-in acknowledgement unavailable");
      setSent(true);
    } catch { setError("Secure sign-in is temporarily unavailable. Your email is retained; please try again shortly."); }
    finally { setLoading(false); }
  }

  async function internalLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ready || loading) return;
    setLoading(true); setError("");
    const submittedCode = code;
    setCode("");
    try {
      const response = await fetch("/api/levytate-beta-login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: demoEmail, code: submittedCode }) });
      const body = await response.json().catch(() => null);
      if (!response.ok) { setError(body?.message ?? "Internal demonstration sign-in failed."); return; }
      window.location.assign("/levytate/app");
    } catch { setError("Internal demonstration sign-in is unavailable. Please try again."); }
    finally { setLoading(false); }
  }

  return <main className="lt-design lt-auth-shell grid min-h-screen place-items-center px-5 py-10">
    <aside className="lt-auth-story"><div className="lt-auth-mark">LevyTate<span className="ml-3 text-xs font-medium text-white/70">Apprenticeship operating system</span></div><div className="lt-auth-message"><p className="mb-4 text-xs font-semibold uppercase tracking-[0.12em]">Workforce investment</p><h2>Invest in your people. Build what comes next.</h2><p className="mt-5 max-w-md text-base leading-7">Bring your apprenticeship applications, providers, learner progress and levy planning together.</p></div><p className="text-sm">Private, authorised access to your organisation.</p></aside>
      <section className="lt-auth-card w-full max-w-md bg-white p-6">
      <div className="flex items-center justify-between gap-4"><LevyTateLogo className="[--levytate-logo-size:2.55rem]" /><Link href="/" className="rounded-full bg-[#f5f8f6] px-4 py-2 text-xs font-semibold text-lt-muted ring-1 ring-[#102c3d]/[0.07]">Public site</Link></div>
      <div className="mt-8"><p className="lt-eyebrow">Secure access</p><h1 className="mt-2 text-3xl font-semibold tracking-[-0.035em]">Sign in to LevyTate</h1><p className="mt-3 text-sm leading-6 text-lt-muted">Enter your work email and we’ll send you a secure sign-in link.</p></div>
      {invalidLink ? <p className="mt-5 rounded-2xl bg-[#fff4f5] px-4 py-3 text-sm text-lt-risk">This sign-in link is invalid or has expired. Request a new one.</p> : null}
      {authIssue ? <p role="alert" className="mt-5 rounded-2xl bg-[#fff4f5] px-4 py-3 text-sm text-lt-risk">{authIssue === "rate-limited" ? "Too many sign-in attempts. Wait a few minutes before trying again." : "Secure sign-in is temporarily unavailable. Please try again shortly."}</p> : null}
      {providerLogoutWarning ? <p className="mt-5 rounded-2xl bg-[#fff8e8] px-4 py-3 text-sm text-[#7a5818]">We signed you out locally, but there was a problem completing server sign-out.</p> : null}
      {sent ? <div aria-live="polite" className="mt-6 rounded-xl bg-[#eef9f5] p-5 ring-1 ring-[#159b8f]/15"><h2 className="font-semibold">Check your email</h2><p className="mt-2 text-sm leading-6 text-lt-muted">If this email is authorised for LevyTate, you’ll receive a secure sign-in link.</p><button onClick={() => setSent(false)} className="mt-4 text-sm font-semibold text-lt-accent">Use another email</button></div> : <form onSubmit={requestLink} aria-busy={!ready || loading} className="mt-6 grid gap-4">{!ready ? <p role="status" className="text-sm text-lt-muted">Preparing secure sign-in…</p> : null}<fieldset disabled={!ready || loading} className="m-0 grid min-w-0 gap-4 border-0 p-0"><EmailField value={email} onChange={setEmail} /><button type="submit" disabled={!ready || loading} className="lt-button lt-primary h-12 disabled:opacity-70">{loading ? "Sending secure link" : "Send secure sign-in link"}</button></fieldset><noscript>Enable JavaScript and reload this page to use secure sign-in.</noscript></form>}
      {internalLoginEnabled ? <div className="mt-6 border-t border-[#102c3d]/[0.08] pt-5"><button type="button" disabled={!ready || loading} onClick={() => setShowInternal(!showInternal)} className="text-xs font-semibold text-lt-muted">Internal demonstration access</button>{showInternal ? <form onSubmit={internalLogin} className="mt-4 grid gap-3 rounded-2xl bg-[#f8fbfa] p-4"><EmailField value={demoEmail} onChange={setDemoEmail} /><input aria-label="Internal access code" type="password" autoComplete="off" spellCheck={false} required value={code} onChange={(event) => setCode(event.target.value)} className="h-11 min-w-0 rounded-xl border border-[#102c3d]/10 bg-white px-3 text-sm" placeholder="Internal access code" /><button type="submit" disabled={!ready || loading} className="lt-button lt-primary h-11">Open demonstration</button></form> : null}</div> : null}
      {error ? <p role="alert" className="mt-4 rounded-2xl bg-[#fff4f5] px-4 py-3 text-sm text-lt-risk">{error}</p> : null}
      <nav aria-label="Trust and support" className="mt-6 flex flex-wrap justify-center gap-x-4 gap-y-2 border-t border-[#102c3d]/[0.08] pt-5 text-xs font-semibold text-lt-muted">
        <Link className="min-h-11 content-center hover:text-lt-accent focus:outline-none focus:ring-2 focus:ring-[#159b8f]/30" href="/levytate/privacy">Privacy</Link>
        <Link className="min-h-11 content-center hover:text-lt-accent focus:outline-none focus:ring-2 focus:ring-[#159b8f]/30" href="/levytate/early-access-terms">Terms</Link>
        <Link className="min-h-11 content-center hover:text-lt-accent focus:outline-none focus:ring-2 focus:ring-[#159b8f]/30" href="/levytate/account-help">Account help</Link>
        <Link className="min-h-11 content-center hover:text-lt-accent focus:outline-none focus:ring-2 focus:ring-[#159b8f]/30" href="/levytate/support">Support</Link>
      </nav>
    </section>
  </main>;
}

function EmailField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return <label className="lt-label grid min-w-0 gap-1.5">Work email<input type="email" name="email" autoComplete="email" inputMode="email" required value={value} onChange={(event) => onChange(event.target.value)} className="lt-control h-12 min-w-0 px-4 text-sm font-medium normal-case tracking-normal outline-none" placeholder="you@company.co.uk" /></label>;
}
