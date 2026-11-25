"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { LevyTateLogo } from "@/components/levytate-demo/PlatformShell";
import { useHydratedForm } from "@/components/levytate-mvp/useHydratedForm";
import { isSignInRequestAcknowledgement } from "@/lib/levytate/sign-in-form";

export function ProviderLoginClient({
  invalidLink = false,
  authIssue,
  providerLogoutWarning = false,
}: {
  invalidLink?: boolean;
  authIssue?: "rate-limited" | "unavailable";
  providerLogoutWarning?: boolean;
}) {
  const ready = useHydratedForm();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function requestLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ready || loading) return;
    const submittedEmail = new FormData(event.currentTarget).get("email");
    if (typeof submittedEmail !== "string" || !submittedEmail.trim()) { setError("Enter your work email to request a sign-in link."); return; }
    setEmail(submittedEmail);
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/levytate-provider-auth/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: submittedEmail }),
      });
      const body = (await response.json().catch(() => null)) as
        | { message?: string }
        | null;

      if (!response.ok) {
        setError(body?.message ?? "We couldn’t complete sign-in just now. Please try again.");
        return;
      }
      if (!isSignInRequestAcknowledgement(body)) throw new Error("Sign-in acknowledgement unavailable");

      setSent(true);
    } catch {
      setError("Secure sign-in is temporarily unavailable. Your email is retained; please try again shortly.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="lt-design lt-auth-shell grid min-h-screen place-items-center px-5 py-10">
      <aside className="lt-auth-story"><div className="lt-auth-mark">LevyTate<span className="ml-3 text-xs font-medium text-white/70">Provider workspace</span></div><div className="lt-auth-message"><p className="mb-4 text-xs font-semibold uppercase tracking-[0.12em]">Work together, with clarity</p><h2>A clearer way to work with employers.</h2><p className="mt-5 max-w-md text-base leading-7">Manage programme information, employer opportunities and delivery updates in one connected workspace.</p></div><p className="text-sm">Private, authorised access to your provider workspace.</p></aside>
      <section className="lt-auth-card w-full max-w-md bg-white p-6">
        <div className="flex items-center justify-between gap-4">
          <LevyTateLogo className="[--levytate-logo-size:2.55rem]" />
          <span className="rounded-full bg-[#eef9f5] px-3 py-2 text-xs font-semibold uppercase tracking-[0.1em] text-lt-accent">
            Provider
          </span>
        </div>

        <div className="mt-8">
          <p className="lt-eyebrow">
            Secure provider access
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.035em]">
            Your provider workspace
          </h1>
          <p className="mt-3 text-sm leading-6 text-lt-muted">
            Enter your work email and we’ll send a secure link to your provider workspace.
          </p>
        </div>

        {invalidLink ? (
          <p role="alert" className="mt-5 rounded-2xl bg-[#fff4f5] px-4 py-3 text-sm text-lt-risk">
            This sign-in link is invalid or has expired. Request a new one.
          </p>
        ) : null}

        {providerLogoutWarning ? (
          <p role="status" className="mt-5 rounded-2xl bg-[#fff8e8] px-4 py-3 text-sm text-[#7a5818]">
            You are signed out locally. Provider sign-out could not be confirmed, so close shared browsers before leaving.
          </p>
        ) : null}
        {authIssue ? <p role="alert" className="mt-5 rounded-2xl bg-[#fff4f5] px-4 py-3 text-sm text-lt-risk">{authIssue === "rate-limited" ? "Too many sign-in attempts. Wait a few minutes before trying again." : "Secure sign-in is temporarily unavailable. Please try again shortly."}</p> : null}

        {sent ? (
          <div aria-live="polite" className="mt-6 rounded-2xl bg-[#eef9f5] p-5 ring-1 ring-[#159b8f]/15">
            <h2 className="font-semibold">Check your email</h2>
            <p className="mt-2 text-sm leading-6 text-lt-muted">
              If this email has active LevyTate provider access, you’ll receive a secure sign-in link.
            </p>
            <button
              type="button"
              onClick={() => setSent(false)}
              className="mt-4 min-h-11 text-sm font-semibold text-lt-accent focus:outline-none focus:ring-4 focus:ring-[#159b8f]/15"
            >
              Use another email
            </button>
          </div>
        ) : (
          <form onSubmit={requestLink} aria-busy={!ready || loading} className="mt-6 grid gap-4">
            {!ready ? <p role="status" className="text-sm text-lt-muted">Preparing secure sign-in…</p> : null}
            <fieldset disabled={!ready || loading} className="m-0 grid min-w-0 gap-4 border-0 p-0">
            <label className="lt-label grid min-w-0 gap-1.5">
              Work email
              <input
                type="email"
                name="email"
                autoComplete="email"
                inputMode="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="lt-control h-12 min-w-0 px-4 text-sm font-medium normal-case tracking-normal outline-none"
                placeholder="you@provider.co.uk"
              />
            </label>
            <button
              type="submit"
              disabled={!ready || loading}
              className="lt-button lt-primary h-12 transition hover:bg-[#17394d] focus:outline-none focus:ring-4 focus:ring-[#159b8f]/20 disabled:cursor-wait disabled:opacity-70"
            >
              {loading ? "Sending secure link" : "Send secure sign-in link"}
            </button>
            </fieldset>
            <noscript>Enable JavaScript and reload this page to use secure sign-in.</noscript>
          </form>
        )}

        {error ? (
          <p role="alert" className="mt-4 rounded-2xl bg-[#fff4f5] px-4 py-3 text-sm text-lt-risk">
            {error}
          </p>
        ) : null}

        <nav aria-label="Provider account help" className="mt-6 flex flex-wrap justify-center gap-x-4 gap-y-2 border-t border-[#102c3d]/[0.08] pt-5 text-xs font-semibold text-lt-muted">
          <Link className="min-h-11 content-center hover:text-lt-accent focus:outline-none focus:ring-2 focus:ring-[#159b8f]/30" href="/levytate/privacy">Privacy</Link>
          <Link className="min-h-11 content-center hover:text-lt-accent focus:outline-none focus:ring-2 focus:ring-[#159b8f]/30" href="/levytate/account-help">Account help</Link>
          <Link className="min-h-11 content-center hover:text-lt-accent focus:outline-none focus:ring-2 focus:ring-[#159b8f]/30" href="/levytate/support">Support</Link>
          <Link className="min-h-11 content-center hover:text-lt-accent focus:outline-none focus:ring-2 focus:ring-[#159b8f]/30" href="/levytate/login">Employer sign in</Link>
        </nav>
      </section>
    </main>
  );
}
