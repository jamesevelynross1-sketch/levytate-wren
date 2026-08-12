import { buildFairProviderFeed } from "@/lib/levytate/provider-intelligence/fair-distribution";
import { providerIntelligenceUpdates } from "@/lib/levytate/provider-intelligence/fixtures";

export const morningBrief = {
  generatedAt: "2026-08-12T07:30:00Z",
  headline: "Skills leaders are turning attention into practical workforce capability",
  summary: "Today’s provider intelligence brings together responsible AI adoption, operational leadership and clearer workplace evidence. The strongest common thread is practical implementation: giving managers and learners the structure to turn new knowledge into confident action.",
  highlights: buildFairProviderFeed(providerIntelligenceUpdates, { limit: 3 }),
} as const;
