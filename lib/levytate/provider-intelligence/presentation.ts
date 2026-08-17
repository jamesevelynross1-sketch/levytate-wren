import type { IntelligencePresentation, PresentedIntelligenceUpdate, ProviderIntelligenceUpdate } from "./domain.ts";

const rhythm: readonly IntelligencePresentation[] = ["feature", "standard", "standard", "split", "compact", "compact", "standard", "case-study", "event", "standard", "split", "compact"];
const prominent = new Set<IntelligencePresentation>(["feature", "split", "case-study"]);

export function assignFeedPresentation(feed: readonly ProviderIntelligenceUpdate[]): PresentedIntelligenceUpdate[] {
  const prominentProviders = new Set<string>();
  return feed.map((item, index) => {
    let presentation = item.presentationHint ?? (item.contentType === "Event" ? "event" : rhythm[index % rhythm.length]);
    if (prominent.has(presentation) && prominentProviders.has(item.providerId)) presentation = item.contentType === "Event" ? "event" : index % 3 === 0 ? "compact" : "standard";
    if (prominent.has(presentation)) prominentProviders.add(item.providerId);
    return { ...item, presentation };
  });
}

export function prominentExposure(feed: readonly PresentedIntelligenceUpdate[]) {
  return feed.reduce<Record<string, number>>((counts, item) => {
    if (prominent.has(item.presentation)) counts[item.providerId] = (counts[item.providerId] ?? 0) + 1;
    return counts;
  }, {});
}
