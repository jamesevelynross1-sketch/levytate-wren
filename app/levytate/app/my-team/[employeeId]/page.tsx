import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { LevyTateMvpApp } from "@/components/levytate-mvp/LevyTateMvpApp";
import { levytateBetaSessionCookie, readLevyTateBetaSession } from "@/lib/levytate/config/beta-access";
import { getManagerDirectReportLearnerDetail } from "@/lib/server/levytate-manager-learner-detail";
import { getWorkspaceBootstrapForSession } from "@/lib/server/levytate-workspace";

export const metadata: Metadata = {
  title: "Direct-report apprenticeship journey | LevyTate",
  robots: { index: false, follow: false },
};

export default async function ManagerDirectReportPage({ params }: { params: Promise<{ employeeId: string }> }) {
  const cookieStore = await cookies();
  const session = await readLevyTateBetaSession(cookieStore.get(levytateBetaSessionCookie)?.value);
  if (!session) redirect("/levytate/login");

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
