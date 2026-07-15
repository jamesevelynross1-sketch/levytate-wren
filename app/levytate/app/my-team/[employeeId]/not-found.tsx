import { ArrowLeft, ShieldAlert } from "lucide-react";
import { LevyTateLogo } from "@/components/levytate-demo/PlatformShell";

export default function DirectReportNotFound() {
  return (
    <main className="min-h-screen bg-[#f4f7f5] text-[#102c3d]">
      <header className="border-b border-[#102c3d]/[0.08] bg-white">
        <div className="mx-auto flex min-h-20 max-w-[1180px] items-center px-5 sm:px-8">
          <LevyTateLogo className="[--levytate-logo-size:2.35rem]" />
        </div>
      </header>
      <section className="mx-auto grid min-h-[calc(100vh-5rem)] max-w-[1180px] place-items-center px-5 py-12 sm:px-8">
        <div className="w-full max-w-lg rounded-2xl border border-[#102c3d]/[0.07] bg-white p-7 text-center shadow-[0_20px_54px_rgba(16,44,61,0.07)] sm:p-9">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-[#fff1f2] text-[#c95568]"><ShieldAlert size={21} aria-hidden="true" /></span>
          <p className="mt-5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#c95568]">Direct-report access</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-[-0.025em]">This employee record could not be opened.</h1>
          <p className="mt-3 text-sm leading-6 text-[#102c3d]/58">You can only view apprenticeship information for your current direct reports.</p>
          <a href="/levytate/app?module=My%20Team" className="mt-6 inline-flex h-10 items-center gap-2 rounded-full bg-[#102c3d] px-4 text-xs font-semibold text-white transition hover:-translate-y-0.5">
            <ArrowLeft size={15} aria-hidden="true" /> Back to My Team
          </a>
        </div>
      </section>
    </main>
  );
}
