import type { Metadata } from "next";
import Link from "next/link";
import { LevyTateLogo } from "@/components/levytate-demo/PlatformShell";

export const metadata: Metadata = {
  title: "LevyTate | Apprenticeship and Workforce Development Platform",
  description: "LevyTate helps employers manage apprenticeships, workforce development and provider matching in one place.",
};

const sections = [
  {
    title: "What LevyTate does",
    copy: "A clean operating layer for employees, roles, applications, providers and apprenticeship decisions.",
  },
  {
    title: "Who it is for",
    copy: "Built for HR, L&D, apprenticeship leads, managers and operational teams who need clearer development pathways.",
  },
  {
    title: "Core workflows",
    copy: "Manage employee records, role mapping, applications, enrolments and provider relationships from one workspace.",
  },
  {
    title: "Provider matching",
    copy: "Use a controlled LevyTate-led catalogue to prepare relevant provider shortlists, not an open marketplace.",
  },
  {
    title: "AI-supported guidance",
    copy: "Ask LevyTate AI helps people understand pathways, suitability and next steps while respecting product rules.",
  },
  {
    title: "Beta access",
    copy: "The MVP is available by invitation while the product moves from demo environment into real employer workspaces.",
  },
];

export default function LevyTateLandingPage() {
  return (
    <main className="min-h-screen bg-[#f6fbf8] text-[#102c3d]">
      <header className="mx-auto flex w-full max-w-7xl items-center justify-between px-5 py-5 sm:px-8">
        <LevyTateLogo className="[--levytate-logo-size:2.8rem]" />
        <nav className="flex items-center gap-3">
          <Link href="/login" className="hidden rounded-full px-4 py-2 text-sm font-semibold text-[#102c3d]/70 ring-1 ring-[#102c3d]/10 transition hover:bg-white sm:inline-flex">Beta Login</Link>
          <Link href="/login" className="rounded-full bg-[#102c3d] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_14px_30px_rgba(16,44,61,0.14)] transition hover:-translate-y-0.5">Request Beta Access</Link>
        </nav>
      </header>

      <section className="mx-auto grid max-w-7xl gap-10 px-5 pb-12 pt-8 sm:px-8 lg:grid-cols-[minmax(0,1fr)_420px] lg:items-center lg:pb-20 lg:pt-16">
        <div>
          <p className="inline-flex rounded-full bg-[#dff7ef] px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#0b6f63]">Beta platform</p>
          <h1 className="mt-6 max-w-5xl text-4xl font-semibold leading-[1.03] tracking-[-0.04em] text-[#102c3d] sm:text-5xl lg:text-6xl">
            LevyTate helps employers manage apprenticeships, workforce development and provider matching in one place.
          </h1>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-[#102c3d]/64">
            A beta platform for employers who want a clearer way to manage employees, roles, applications and provider relationships.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/login" className="rounded-full bg-[#102c3d] px-6 py-3 text-sm font-semibold text-white shadow-[0_16px_32px_rgba(16,44,61,0.16)] transition hover:-translate-y-0.5">Request Beta Access</Link>
            <Link href="/login" className="rounded-full bg-white px-6 py-3 text-sm font-semibold text-[#102c3d] ring-1 ring-[#102c3d]/10 transition hover:-translate-y-0.5 hover:ring-[#159b8f]/30">Beta Login</Link>
          </div>
        </div>

        <aside className="rounded-[1.5rem] border border-[#102c3d]/[0.08] bg-white p-5 shadow-[0_30px_80px_rgba(16,44,61,0.08)]">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#c95568]">MVP modules</p>
          <div className="mt-4 grid gap-2">
            {["Dashboard", "Employees", "Roles", "Applications", "Providers", "Provider Matching", "Enrolments", "Settings"].map((item) => (
              <div key={item} className="flex items-center justify-between rounded-2xl bg-[#f6fbf8] px-4 py-3 text-sm font-semibold text-[#102c3d] ring-1 ring-[#102c3d]/[0.055]">
                <span>{item}</span>
                <span className="h-2 w-2 rounded-full bg-[#159b8f]" />
              </div>
            ))}
          </div>
        </aside>
      </section>

      <section className="mx-auto grid max-w-7xl gap-4 px-5 pb-16 sm:px-8 md:grid-cols-2 lg:grid-cols-3">
        {sections.map((section) => (
          <article key={section.title} className="rounded-[1.25rem] border border-[#102c3d]/[0.07] bg-white p-5 shadow-[0_18px_46px_rgba(16,44,61,0.055)]">
            <h2 className="text-lg font-semibold tracking-[-0.01em] text-[#102c3d]">{section.title}</h2>
            <p className="mt-3 text-sm leading-6 text-[#102c3d]/60">{section.copy}</p>
          </article>
        ))}
      </section>
    </main>
  );
}
