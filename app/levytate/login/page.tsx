import type { Metadata } from "next";
import { LevyTateLoginClient } from "@/components/levytate-mvp/LevyTateLoginClient";
import { isInternalBetaLoginEnabled } from "@/lib/levytate/config/beta-access";

export const metadata: Metadata = {
  title: "Beta Login | LevyTate",
  description: "Log in to the LevyTate beta workspace.",
};

export default async function LevyTateLoginPage({ searchParams }: { searchParams: Promise<{ auth?: string }> }) {
  const { auth } = await searchParams;
  return <LevyTateLoginClient internalLoginEnabled={isInternalBetaLoginEnabled()} invalidLink={auth === "invalid-link"} />;
}
