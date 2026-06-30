import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { LevyTateMvpApp } from "@/components/levytate-mvp/LevyTateMvpApp";
import { levytateBetaSessionCookie, readLevyTateBetaSession } from "@/lib/levytate/config/beta-access";
import { getWorkspaceBootstrapForSession } from "@/lib/server/levytate-workspace";

export const metadata: Metadata = {
  title: "MVP App | LevyTate",
  description: "Protected LevyTate beta MVP workspace.",
};

export default async function LevyTateAppPage() {
  const cookieStore = await cookies();
  const session = await readLevyTateBetaSession(cookieStore.get(levytateBetaSessionCookie)?.value);

  if (!session) redirect("/login");

  const initialWorkspace = await getWorkspaceBootstrapForSession(session);

  return <LevyTateMvpApp initialWorkspace={initialWorkspace} />;
}
