import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { LevyTateMvpApp } from "@/components/levytate-mvp/LevyTateMvpApp";
import { levytateBetaSessionCookie } from "@/lib/levytate/config/beta-access";
import { readAuthorisedLevyTateBetaSession } from "@/lib/server/levytate-authorised-session";
import { getManagerDirectReportLearnerDetail } from "@/lib/server/levytate-manager-learner-detail";
import { getWorkspaceBootstrapForSession } from "@/lib/server/levytate-workspace";
import { getTermsGateState } from "@/lib/server/levytate-early-access-terms";

export const metadata: Metadata = {
  title: "Direct-report apprenticeship journey | LevyTate",
  robots: { index: false, follow: false },
};

export default async function ManagerDirectReportPage({ params }: { params: Promise<{ employeeId: string }> }) {
  const cookieStore = await cookies();
  const session = await readAuthorisedLevyTateBetaSession(cookieStore.get(levytateBetaSessionCookie)?.value, { allowTermsPending: true });
  if (!session) redirect("/levytate/login");
  const termsGate = await getTermsGateState(session);
  if (!termsGate.bypass && !termsGate.accepted) redirect(termsGate.authorisedAcceptor ? "/levytate/accept-terms" : "/levytate/app");

  try {
    const { employeeId } = await params;
    const [initialWorkspace, detail] = await Promise.all([
      getWorkspaceBootstrapForSession(session),
      getManagerDirectReportLearnerDetail(session, employeeId),
    ]);
    return <LevyTateMvpApp initialWorkspace={initialWorkspace} initialManagerDirectReportDetail={detail} />;
  } catch {
    notFound();
  }
}
