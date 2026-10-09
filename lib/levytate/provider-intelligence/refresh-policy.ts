import type { ProviderIntelligenceArticle, ProviderIntelligenceSource } from "./domain";
import { isLikelyProviderArticleUrl, isRelevantProviderArticle } from "./parsers";

export const providerIntelligenceStaleAfterMs = 48 * 60 * 60 * 1000;

type RefreshSource = Pick<ProviderIntelligenceSource, "status" | "lastSuccessfulFetchAt">;

export function getProviderIntelligenceFreshness(
  sources: readonly RefreshSource[],
  now = Date.now(),
) {
  const refreshedAt = sources
    .filter((source) => source.status === "active")
    .map((source) => source.lastSuccessfulFetchAt)
    .filter((value): value is string => Boolean(value) && Number.isFinite(Date.parse(value!)))
    .sort()
    .at(-1) ?? null;

  return {
    refreshedAt,
    stale: !refreshedAt || now - Date.parse(refreshedAt) > providerIntelligenceStaleAfterMs,
  };
}

export function planProviderIntelligenceRefresh(
  source: ProviderIntelligenceSource,
  existingArticles: readonly ProviderIntelligenceArticle[],
  discoveredArticles: readonly ProviderIntelligenceArticle[],
) {
  const hidden = existingArticles.filter((article) =>
    article.status === "published"
    && (!isRelevantProviderArticle(article) || !isLikelyProviderArticleUrl(article.canonicalUrl, source))
  );
  const existing = new Map(existingArticles.map((article) => [article.fingerprint, article]));
  const inserted = discoveredArticles.filter((article) => !existing.has(article.fingerprint));
  const updated = discoveredArticles.filter((article) => {
    const current = existing.get(article.fingerprint);
    return current ? comparableArticle(article) !== comparableArticle(current) : false;
  });

  return {
    hidden,
    inserted,
    updated,
    duplicates: discoveredArticles.length - inserted.length - updated.length,
  };
}

export function successfulSourceRefreshPatch(attemptedAt: string) {
  return {
    last_attempt_at: attemptedAt,
    last_successful_fetch_at: attemptedAt,
    last_error: null,
  };
}

export function failedSourceRefreshPatch(attemptedAt: string, error: unknown) {
  return {
    last_attempt_at: attemptedAt,
    last_error: error instanceof Error ? error.message.slice(0, 300) : "Refresh failed",
  };
}

export function isProviderIntelligenceRefreshAuthorised(
  authorisation: string | null,
  secrets: readonly (string | undefined)[],
) {
  return secrets.some((secret) => Boolean(secret && authorisation === `Bearer ${secret}`));
}

function comparableArticle(article: ProviderIntelligenceArticle) {
  return JSON.stringify({
    title: article.title,
    excerpt: article.excerpt,
    canonicalUrl: article.canonicalUrl,
    imageUrl: article.imageUrl,
    publishedAt: article.publishedAt ? Date.parse(article.publishedAt) : null,
    contentType: article.contentType,
    topics: [...article.topics].sort(),
    status: article.status,
  });
}
