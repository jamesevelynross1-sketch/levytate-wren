"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LevyTateLogo } from "@/components/levytate-demo/PlatformShell";
import {
  earlyAccessApprovalTokenStorageKey,
  earlyAccessStorageKey,
  type EarlyAccessRequest,
} from "@/lib/levytate/early-access/domain";

export function LevyTateLoginClient() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    const normalisedEmail = email.trim().toLowerCase();
    const localLead = readLocalLead(normalisedEmail);
    const approvalToken = readApprovalToken(normalisedEmail);

    const response = await fetch("/api/levytate-beta-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, code, approvalToken }),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      const shouldUseLocalPendingMessage =
        body?.message === "Beta access is currently invite-only. Please request Early Access first." &&
        localLead &&
        localLead.status !== "Approved" &&
        localLead.status !== "Onboarded";

      setError(
        shouldUseLocalPendingMessage
          ? "Your Early Access request has been received and is currently under review."
          : body?.message ?? "Beta access is currently invite-only. Please request Early Access first.",
      );
      setLoading(false);
      return;
    }

    router.push("/app");
    router.refresh();
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[#f6fbf8] px-5 py-10 text-[#102c3d]">
      <section className="w-full max-w-md rounded-[1.5rem] border border-[#102c3d]/[0.08] bg-white p-6 shadow-[0_30px_90px_rgba(16,44,61,0.1)]">
        <div className="flex items-center justify-between gap-4">
          <LevyTateLogo className="[--levytate-logo-size:2.55rem]" />
          <Link href="/" className="rounded-full bg-[#f5f8f6] px-4 py-2 text-xs font-semibold text-[#102c3d]/64 ring-1 ring-[#102c3d]/[0.07]">Public site</Link>
        </div>
        <div className="mt-8">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#c95568]">Beta access</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.035em]">Log in to LevyTate</h1>
          <p className="mt-3 text-sm leading-6 text-[#102c3d]/60">Enter your beta access details to open the LevyTate MVP workspace.</p>
        </div>

        <form onSubmit={submit} className="mt-6 grid gap-4">
          <label className="grid gap-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-[#102c3d]/42">
            Email
            <input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} className="h-12 rounded-2xl border border-[#102c3d]/[0.08] bg-[#f8fbfa] px-4 text-sm font-medium normal-case tracking-normal text-[#102c3d] outline-none focus:border-[#159b8f] focus:bg-white focus:ring-4 focus:ring-[#159b8f]/10" placeholder="you@company.co.uk" />
          </label>
          <label className="grid gap-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-[#102c3d]/42">
            Beta access code
            <input required value={code} onChange={(event) => setCode(event.target.value)} className="h-12 rounded-2xl border border-[#102c3d]/[0.08] bg-[#f8fbfa] px-4 text-sm font-medium normal-case tracking-normal text-[#102c3d] outline-none focus:border-[#159b8f] focus:bg-white focus:ring-4 focus:ring-[#159b8f]/10" placeholder="LEVYTATE-BETA" />
          </label>
          {error ? <p className="rounded-2xl bg-[#fff4f5] px-4 py-3 text-sm leading-6 text-[#ad344e] ring-1 ring-[#bf4159]/[0.12]">{error}</p> : null}
          <button disabled={loading} className="h-12 rounded-full bg-[#102c3d] px-5 text-sm font-semibold text-white shadow-[0_14px_30px_rgba(16,44,61,0.14)] transition hover:-translate-y-0.5 disabled:cursor-wait disabled:opacity-70">
            {loading ? "Checking access" : "Open beta workspace"}
          </button>
        </form>
      </section>
    </main>
  );
}

function readLocalLead(email: string) {
  if (typeof window === "undefined") return null;

  try {
    const parsed = JSON.parse(window.localStorage.getItem(earlyAccessStorageKey) ?? "[]") as EarlyAccessRequest[];
    return parsed.find((lead) => lead.email.toLowerCase() === email) ?? null;
  } catch {
    return null;
  }
}

function readApprovalToken(email: string) {
  if (typeof window === "undefined") return "";

  try {
    const parsed = JSON.parse(window.localStorage.getItem(earlyAccessApprovalTokenStorageKey) ?? "{}") as Record<string, string>;
    return parsed[email] ?? "";
  } catch {
    return "";
  }
}

