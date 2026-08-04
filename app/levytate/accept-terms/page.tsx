import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { LevyTateLogo } from "@/components/levytate-demo/PlatformShell";
import { EarlyAccessTermsAcceptanceForm } from "@/components/levytate-mvp/EarlyAccessTermsAcceptanceForm";
import { levytateBetaSessionCookie } from "@/lib/levytate/config/beta-access";
import { readAuthorisedLevyTateBetaSession } from "@/lib/server/levytate-authorised-session";
import { getCurrentEarlyAccessTermsDocument, getTermsGateState, recordTermsAcceptanceViewed } from "@/lib/server/levytate-early-access-terms";

export const metadata: Metadata = { title: { absolute: "Accept Early Access Terms | LevyTate" }, robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AcceptTermsPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const cookieStore = await cookies();
  const session = await readAuthorisedLevyTateBetaSession(cookieStore.get(levytateBetaSessionCookie)?.value, { allowTermsPending: true });
  if (!session) redirect("/levytate/login");
  const gate = await getTermsGateState(session);
  if (gate.bypass || gate.accepted) redirect("/levytate/app");
  if (!gate.authorisedAcceptor) return <WaitingForOrganisationAcceptance />;
  await recordTermsAcceptanceViewed(session);
  const document = getCurrentEarlyAccessTermsDocument();
  const { error } = await searchParams;
  return <main className="min-h-screen overflow-x-hidden bg-[#f6fbf8] px-5 py-8 text-[#102c3d] sm:px-8 sm:py-12">
    <div className="mx-auto max-w-4xl"><LevyTateLogo className="[--levytate-logo-size:2.55rem]" />
      <header className="mt-7 rounded-[1.5rem] bg-[#102c3d] p-6 text-white sm:p-9"><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8fe0d2]">Organisation access · Early Access</p><h1 className="mt-3 text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">Accept Early Access Terms</h1><p className="mt-3 text-sm leading-7 text-white/70">An authorised Apprenticeship Lead must explicitly accept the current terms before this organisation can use its operational workspace.</p><div className="mt-5 flex flex-wrap gap-3 text-xs font-semibold text-white/60"><span>Version {document.version}</span><span>Effective {document.page.effectiveDate}</span></div></header>
      {error ? <p className="mt-5 rounded-xl bg-[#fff4f5] p-4 text-sm text-[#ad344e]">Acceptance could not be recorded. Check your current access and try again, or contact Support.</p> : null}
      <div className="my-6 grid gap-5">{document.page.sections.map((section) => <section key={section.heading} className="rounded-[1.25rem] border border-[#102c3d]/[0.08] bg-white p-5 sm:p-7"><h2 className="text-xl font-semibold">{section.heading}</h2><div className="mt-3 grid gap-3 text-sm leading-7 text-[#102c3d]/68">{section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}</div></section>)}</div>
      <EarlyAccessTermsAcceptanceForm />
      <nav aria-label="Terms help" className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm font-semibold text-[#087c73]"><Link className="min-h-11 content-center" href="/levytate/support">Support</Link><Link className="min-h-11 content-center" href="/levytate/privacy">Privacy</Link><Link className="min-h-11 content-center" href="/levytate/data-processing">Data processing</Link></nav>
    </div>
  </main>;
}

function WaitingForOrganisationAcceptance() { return <main className="grid min-h-screen place-items-center bg-[#f6fbf8] px-5 py-10 text-[#102c3d]"><section className="w-full max-w-lg rounded-[1.5rem] border border-[#102c3d]/[0.08] bg-white p-7"><LevyTateLogo className="[--levytate-logo-size:2.4rem]" /><p className="mt-7 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#c95568]">Organisation access</p><h1 className="mt-3 text-3xl font-semibold">Acceptance pending</h1><p className="mt-3 text-sm leading-7 text-[#102c3d]/64">Your organisation’s operational workspace is waiting for acceptance of the current Early Access Terms by an authorised representative.</p><nav className="mt-5 flex gap-5 text-sm font-semibold text-[#087c73]"><Link href="/levytate/support">Support</Link><Link href="/levytate/account-help">Account help</Link></nav></section></main>; }
