import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { levytateProviderSessionCookie, readAuthorisedLevyTateProviderSession } from "@/lib/server/levytate-provider-auth";
import { getProviderDeliveryWorkspace } from "@/lib/server/levytate-provider-delivery";
import { getProviderWorkspaceBootstrapForSession } from "@/lib/server/levytate-service-requests";
import { isRequestsEnvironmentEnabled } from "@/lib/server/levytate-request-capability";
import { ProviderDeliveryWorkspace } from "@/components/levytate-provider/ProviderDeliveryWorkspace";

export const metadata:Metadata = {
  title:"Delivery updates | LevyTate Provider",
  description:"Employer-approved provider reporting and learner programme updates.",
  robots:{index:false,follow:false},
};
export const dynamic="force-dynamic";
export const revalidate=0;

export default async function ProviderDeliveryPage(){
  const store=await cookies();
  const session=await readAuthorisedLevyTateProviderSession(store.get(levytateProviderSessionCookie)?.value);
  if (!session) redirect("/levytate/provider/login");
  const workspace=await getProviderDeliveryWorkspace(session);
  if (!workspace) notFound();
  const opportunities=isRequestsEnvironmentEnabled() ? await getProviderWorkspaceBootstrapForSession(session) : null;
  return <ProviderDeliveryWorkspace initialWorkspace={workspace} opportunitiesAvailable={Boolean(opportunities?.requestsEnabled)} />;
}
