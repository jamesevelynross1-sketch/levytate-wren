import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { ProviderLoginClient } from "@/components/levytate-provider/ProviderLoginClient";
import {
  levytateProviderSessionCookie,
  readAuthorisedLevyTateProviderSession,
} from "@/lib/server/levytate-provider-auth";
import { getProviderWorkspaceBootstrapForSession } from "@/lib/server/levytate-service-requests";
import { isRequestsEnvironmentEnabled } from "@/lib/server/levytate-request-capability";
import { getProviderDeliveryWorkspace, isProviderDeliveryEnvironmentEnabled } from "@/lib/server/levytate-provider-delivery";

export const metadata: Metadata = {
  title: "Provider sign in | LevyTate",
  description: "Secure access to LevyTate provider opportunities.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function LevyTateProviderLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ auth?: string; logout?: string }>;
}) {
  if (!isRequestsEnvironmentEnabled() && !isProviderDeliveryEnvironmentEnabled()) notFound();
  const cookieStore = await cookies();
  const session = await readAuthorisedLevyTateProviderSession(
    cookieStore.get(levytateProviderSessionCookie)?.value,
  );

  if (session) {
    if (isProviderDeliveryEnvironmentEnabled() && await getProviderDeliveryWorkspace(session)) redirect("/levytate/provider/delivery");
    const workspace = isRequestsEnvironmentEnabled() ? await getProviderWorkspaceBootstrapForSession(session) : null;
    if (workspace?.requestsEnabled) redirect("/levytate/provider");
  }

  const { auth, logout } = await searchParams;
  return (
    <ProviderLoginClient
      invalidLink={auth === "invalid-link"}
      authIssue={auth === "rate-limited" || auth === "unavailable" ? auth : undefined}
      providerLogoutWarning={logout === "local-only"}
    />
  );
}
