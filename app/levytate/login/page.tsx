import type { Metadata } from "next";
import { LevyTateLoginClient } from "@/components/levytate-mvp/LevyTateLoginClient";

export const metadata: Metadata = {
  title: "Beta Login | LevyTate",
  description: "Log in to the LevyTate beta workspace.",
};

export default function LevyTateLoginPage() {
  return <LevyTateLoginClient />;
}
