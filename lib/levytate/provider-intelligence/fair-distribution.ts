import type { FairFeedOptions, ProviderIntelligenceArticle } from "./domain.ts";

const dateDescending = (left: ProviderIntelligenceArticle, right: ProviderIntelligenceArticle) =>
  (right.publishedAt ?? "").localeCompare(left.publishedAt ?? "") || left.id.localeCompare(right.id);

export function buildFairProviderFeed(
  updates: readonly ProviderIntelligenceArticle[],
  { topic = "All", limit = updates.length }: FairFeedOptions = {},
) {
  const eligible = updates
    .filter((item) => item.status === "published")
    .filter((item) => topic === "All" || item.topics.includes(topic))
    .sort(dateDescending);

  const queues = new Map<string, ProviderIntelligenceArticle[]>();
  for (const item of eligible) queues.set(item.providerId, [...(queues.get(item.providerId) ?? []), item]);
  for (const queue of queues.values()) queue.sort(dateDescending);

  const providerOrder = [...queues]
    .sort(([, left], [, right]) => dateDescending(left[0], right[0]) || left[0].providerId.localeCompare(right[0].providerId))
    .map(([providerId]) => providerId);
  const result: ProviderIntelligenceArticle[] = [];
  let previousProvider: string | null = null;

  while (result.length < limit && providerOrder.some((providerId) => (queues.get(providerId)?.length ?? 0) > 0)) {
    const round = providerOrder
      .filter((providerId) => (queues.get(providerId)?.length ?? 0) > 0)
      .sort((left, right) => {
        if (left === previousProvider) return 1;
        if (right === previousProvider) return -1;
        return providerOrder.indexOf(left) - providerOrder.indexOf(right);
      });
    for (const providerId of round) {
      if (result.length >= limit) break;
      const next = queues.get(providerId)?.shift();
      if (!next) continue;
      result.push(next);
      previousProvider = providerId;
    }
  }

  return result;
}

export function providerExposure(feed: readonly ProviderIntelligenceArticle[]) {
  return feed.reduce<Record<string, number>>((counts, item) => {
    counts[item.providerId] = (counts[item.providerId] ?? 0) + 1;
    return counts;
  }, {});
}
