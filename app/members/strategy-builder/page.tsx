import type { Metadata } from "next";
import StrategyBuilderClient from "./StrategyBuilderClient";

export const metadata: Metadata = {
  title: "AI Apprenticeship Strategy Builder | MPR Consulting",
  description:
    "Create a practical apprenticeship strategy brief using organisation context, scorecard signals and AI refinement.",
};

export default function StrategyBuilderPage() {
  return <StrategyBuilderClient />;
}
