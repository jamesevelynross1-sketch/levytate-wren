import type { Metadata } from "next";
import { LevyTateLoginClient } from "@/components/levytate-mvp/LevyTateLoginClient";
import { isInternalBetaLoginEnabled } from "@/lib/levytate/config/beta-access";

export const metadata: Metadata = {
  title: "Beta Login | LevyTate",
  description: "Log in to the LevyTate beta workspace.",
};
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function LevyTateLoginPage({ searchParams }: { searchParams: Promise<{ auth?: string; logout?: string }> }) {
  const { auth, logout } = await searchParams;
  return <LevyTateLoginClient internalLoginEnabled={isInternalBetaLoginEnabled()} invalidLink={auth === "invalid-link"} providerLogoutWarning={logout === "local-only"} />;
}
