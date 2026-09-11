import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { ProviderWorkspace } from "@/components/levytate-provider/ProviderWorkspace";
import {
  levytateProviderSessionCookie,
  readAuthorisedLevyTateProviderSession,
} from "@/lib/server/levytate-provider-auth";
import { getProviderWorkspaceBootstrapForSession } from "@/lib/server/levytate-service-requests";

export const metadata: Metadata = {
  title: "Opportunities | LevyTate Provider",
  description: "Respond to employer-approved apprenticeship opportunities in LevyTate.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function LevyTateProviderPage() {
  const cookieStore = await cookies();
  const session = await readAuthorisedLevyTateProviderSession(
    cookieStore.get(levytateProviderSessionCookie)?.value,
  );

  if (!session) redirect("/levytate/provider/login");

  const initialWorkspace = await getProviderWorkspaceBootstrapForSession(session);

  // The bootstrap performs provider-membership, invitation and capability checks.
  // A missing/disabled result must not reveal whether an invitation exists.
  if (!initialWorkspace?.requestsEnabled) notFound();

  return <ProviderWorkspace initialWorkspace={initialWorkspace} />;
}
