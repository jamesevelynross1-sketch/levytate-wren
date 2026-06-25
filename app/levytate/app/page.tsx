import type { Metadata } from "next";
import { LevyTateMvpApp } from "@/components/levytate-mvp/LevyTateMvpApp";

export const metadata: Metadata = {
  title: "MVP App | LevyTate",
  description: "Protected LevyTate beta MVP workspace.",
};

export default function LevyTateAppPage() {
  return <LevyTateMvpApp />;
}
