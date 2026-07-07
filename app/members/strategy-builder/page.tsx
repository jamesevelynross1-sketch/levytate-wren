import type { Metadata } from "next";
import StrategyBuilderClient from "./StrategyBuilderClient";

export const metadata: Metadata = {
  title: "Apprenticeship Opportunity Review | MPR Consulting",
  description:
    "Understand your current apprenticeship position, identify immediate opportunities and create practical next steps.",
};

export default function StrategyBuilderPage() {
  return <StrategyBuilderClient />;
}
