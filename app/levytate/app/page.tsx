import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { LevyTateMvpApp } from "@/components/levytate-mvp/LevyTateMvpApp";
import { levytateBetaSessionCookie } from "@/lib/levytate/config/beta-access";
import { readAuthorisedLevyTateBetaSession } from "@/lib/server/levytate-authorised-session";
import { LevyTateWorkspacePermissionError, getWorkspaceBootstrapForSession } from "@/lib/server/levytate-workspace";
import { resolveCoreEarlyAccessRouteAccess } from "@/lib/levytate/core-early-access-policy";
import { getTermsGateState } from "@/lib/server/levytate-early-access-terms";

export const metadata: Metadata = {
  title: "MVP App | LevyTate",
  description: "Protected LevyTate beta MVP workspace.",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function LevyTateAppPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const cookieStore = await cookies();
  const session = await readAuthorisedLevyTateBetaSession(cookieStore.get(levytateBetaSessionCookie)?.value, { allowTermsPending: true });

  if (!session) redirect("/levytate/login");

  try {
    const termsGate = await getTermsGateState(session);
    if (!termsGate.bypass && !termsGate.accepted) {
      if (termsGate.authorisedAcceptor) redirect("/levytate/accept-terms");
      return <AwaitingOrganisationAcceptance />;
    }
    const initialWorkspace = await getWorkspaceBootstrapForSession(session);
    const query = await searchParams;
    const requestedModule = typeof query.module === "string" ? query.module : null;
    if (requestedModule) {
      const access = resolveCoreEarlyAccessRouteAccess(
        initialWorkspace.meta.userRole,
        requestedModule,
        initialWorkspace.meta.coreEarlyAccess,
      );
      if (!access.permitted) redirect(access.safeRedirect);
    }
    return <LevyTateMvpApp initialWorkspace={initialWorkspace} />;
  } catch (error) {
    if (error instanceof LevyTateWorkspacePermissionError) {
      return <AccountSetupRequired message={error.message} />;
    }

    throw error;
  }
}

function AwaitingOrganisationAcceptance() {
  return <main className="grid min-h-screen place-items-center bg-[#f6fbf8] px-5 py-10 text-[#102c3d]"><section className="w-full max-w-lg rounded-[1.5rem] border border-[#102c3d]/[0.08] bg-white p-7 shadow-[0_30px_90px_rgba(16,44,61,0.1)]"><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#c95568]">Organisation access</p><h1 className="mt-3 text-3xl font-semibold tracking-[-0.035em]">Acceptance pending</h1><p className="mt-4 text-sm leading-7 text-[#102c3d]/64">Your organisation’s operational workspace is waiting for acceptance of the current Early Access Terms by an authorised representative.</p><div className="mt-6 flex flex-wrap gap-4 text-sm font-semibold text-[#087c73]"><a href="/levytate/support">Support</a><a href="/levytate/account-help">Account help</a></div></section></main>;
}

function AccountSetupRequired({ message }: { message: string }) {
  return (
    <main className="grid min-h-screen place-items-center bg-[#f6fbf8] px-5 py-10 text-[#102c3d]">
      <section className="w-full max-w-lg rounded-[1.5rem] border border-[#102c3d]/[0.08] bg-white p-7 shadow-[0_30px_90px_rgba(16,44,61,0.1)]">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#c95568]">Workspace access</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-[-0.035em]">Account setup required</h1>
        <p className="mt-4 text-sm leading-6 text-[#102c3d]/64">{message}</p>
        <a
          href="/levytate/login"
          className="mt-6 inline-flex h-11 items-center justify-center rounded-full bg-[#102c3d] px-5 text-sm font-semibold text-white shadow-[0_14px_30px_rgba(16,44,61,0.14)]"
        >
          Return to login
        </a>
      </section>
    </main>
  );
}
