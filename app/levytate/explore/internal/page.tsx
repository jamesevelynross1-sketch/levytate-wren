import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { ExploreAdminPipeline } from "@/components/levytate-explore/ExploreAdminPipeline";
import { levytateBetaSessionCookie } from "@/lib/levytate/config/beta-access";
import { readAuthorisedLevyTateBetaSession } from "@/lib/server/levytate-authorised-session";

export const metadata: Metadata = {
  title: "Explore enquiry pipeline | Internal LevyTate",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ExploreInternalPage() {
  const cookieStore = await cookies();
  const session = await readAuthorisedLevyTateBetaSession(
    cookieStore.get(levytateBetaSessionCookie)?.value,
  );
  if (!session) redirect("/levytate/login");
  if (session.accessLevel !== "beta_admin") notFound();
  return <ExploreAdminPipeline />;
}
