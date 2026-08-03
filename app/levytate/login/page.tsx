import type { Metadata } from "next";
import { LevyTateLoginClient } from "@/components/levytate-mvp/LevyTateLoginClient";
import { isInternalBetaLoginEnabled } from "@/lib/levytate/config/beta-access";

export const metadata: Metadata = {
  title: "Beta Login | LevyTate",
  description: "Log in to the LevyTate beta workspace.",
};

export default function LevyTateLoginPage() {
  return <LevyTateLoginClient internalLoginEnabled={isInternalBetaLoginEnabled()} />;
}
