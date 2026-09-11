"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { LevyTateLogo } from "@/components/levytate-demo/PlatformShell";

export function ProviderLoginClient({
  invalidLink = false,
  providerLogoutWarning = false,
}: {
  invalidLink?: boolean;
  providerLogoutWarning?: boolean;
}) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function requestLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/levytate-provider-auth/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const body = (await response.json().catch(() => null)) as
        | { message?: string }
        | null;

      if (!response.ok) {
        setError(body?.message ?? "We couldn’t complete sign-in just now. Please try again.");
        return;
      }

      setSent(true);
    } catch {
      setError("Secure sign-in is temporarily unavailable. Please try again shortly.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center overflow-x-hidden bg-[#f6fbf8] px-5 py-10 text-[#102c3d]">
      <section className="w-full max-w-md rounded-[1.5rem] border border-[#102c3d]/[0.08] bg-white p-6 shadow-[0_30px_90px_rgba(16,44,61,0.1)]">
        <div className="flex items-center justify-between gap-4">
          <LevyTateLogo className="[--levytate-logo-size:2.55rem]" />
          <span className="rounded-full bg-[#eef9f5] px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-[#087c73]">
            Provider
          </span>
        </div>

        <div className="mt-8">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#c95568]">
            Secure provider access
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.035em]">
            View your opportunities
          </h1>
          <p className="mt-3 text-sm leading-6 text-[#102c3d]/60">
            Enter your work email and we’ll send a secure link to your provider workspace.
          </p>
        </div>

        {invalidLink ? (
          <p role="alert" className="mt-5 rounded-2xl bg-[#fff4f5] px-4 py-3 text-sm text-[#ad344e]">
            This sign-in link is invalid or has expired. Request a new one.
          </p>
        ) : null}

        {providerLogoutWarning ? (
          <p role="status" className="mt-5 rounded-2xl bg-[#fff8e8] px-4 py-3 text-sm text-[#7a5818]">
            You are signed out locally. Provider sign-out could not be confirmed, so close shared browsers before leaving.
          </p>
        ) : null}

        {sent ? (
          <div aria-live="polite" className="mt-6 rounded-2xl bg-[#eef9f5] p-5 ring-1 ring-[#159b8f]/15">
            <h2 className="font-semibold">Check your email</h2>
            <p className="mt-2 text-sm leading-6 text-[#102c3d]/64">
              If this email has active LevyTate provider access, you’ll receive a secure sign-in link.
            </p>
            <button
              type="button"
              onClick={() => setSent(false)}
              className="mt-4 min-h-11 text-sm font-semibold text-[#087c73] focus:outline-none focus:ring-4 focus:ring-[#159b8f]/15"
            >
              Use another email
            </button>
          </div>
        ) : (
          <form onSubmit={requestLink} className="mt-6 grid gap-4">
            <label className="grid min-w-0 gap-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-[#102c3d]/42">
              Work email
              <input
                type="email"
                autoComplete="email"
                inputMode="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="h-12 min-w-0 rounded-2xl border border-[#102c3d]/[0.08] bg-[#f8fbfa] px-4 text-sm font-medium normal-case tracking-normal text-[#102c3d] outline-none focus:border-[#159b8f] focus:bg-white focus:ring-4 focus:ring-[#159b8f]/10"
                placeholder="you@provider.co.uk"
              />
            </label>
            <button
              disabled={loading}
              className="h-12 rounded-full bg-[#102c3d] px-5 text-sm font-semibold text-white transition hover:bg-[#17394d] focus:outline-none focus:ring-4 focus:ring-[#159b8f]/20 disabled:cursor-wait disabled:opacity-70"
            >
              {loading ? "Sending secure link" : "Send secure sign-in link"}
            </button>
          </form>
        )}

        {error ? (
          <p role="alert" className="mt-4 rounded-2xl bg-[#fff4f5] px-4 py-3 text-sm text-[#ad344e]">
            {error}
          </p>
        ) : null}

        <nav aria-label="Provider account help" className="mt-6 flex flex-wrap justify-center gap-x-4 gap-y-2 border-t border-[#102c3d]/[0.08] pt-5 text-xs font-semibold text-[#102c3d]/55">
          <Link className="min-h-11 content-center hover:text-[#087c73] focus:outline-none focus:ring-2 focus:ring-[#159b8f]/30" href="/levytate/privacy">Privacy</Link>
          <Link className="min-h-11 content-center hover:text-[#087c73] focus:outline-none focus:ring-2 focus:ring-[#159b8f]/30" href="/levytate/account-help">Account help</Link>
          <Link className="min-h-11 content-center hover:text-[#087c73] focus:outline-none focus:ring-2 focus:ring-[#159b8f]/30" href="/levytate/support">Support</Link>
          <Link className="min-h-11 content-center hover:text-[#087c73] focus:outline-none focus:ring-2 focus:ring-[#159b8f]/30" href="/levytate/login">Employer sign in</Link>
        </nav>
      </section>
    </main>
  );
}
