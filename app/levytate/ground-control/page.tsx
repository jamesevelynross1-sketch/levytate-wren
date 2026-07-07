import type { Metadata } from "next";
import { LevyTateMvpApp } from "@/components/levytate-mvp/LevyTateMvpApp";
import { groundControlWorkspace } from "@/lib/levytate/data/demo/ground-control-workspace";

export const metadata: Metadata = {
  title: "Ground Control Workspace | LevyTate",
  description: "Seeded Ground Control demonstration workspace powered by LevyTate.",
};

export default function GroundControlWorkspacePage() {
  return <LevyTateMvpApp initialWorkspace={groundControlWorkspace} persistLocal={false} />;
}
