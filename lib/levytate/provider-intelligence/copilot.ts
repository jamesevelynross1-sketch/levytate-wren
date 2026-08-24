import type { ProviderIntelligenceArticle } from "./domain.ts";

const normalise = (value: string) => value.toLowerCase().replace(/[^a-z0-9&]+/g, " ").trim();
const dated = (article: ProviderIntelligenceArticle) => article.publishedAt ? new Date(article.publishedAt).getTime() : 0;

export function answerProviderIntelligenceQuestion(
  question: string,
  articles: readonly ProviderIntelligenceArticle[],
  providerLabel: (providerId: string) => string,
) {
  const query = normalise(question);
  const published = articles.filter((article) => article.status === "published");
  let matches = published;

  if (query.includes("qa")) matches = matches.filter((article) => normalise(providerLabel(article.providerId)).includes("qa"));
  else if (query.includes("ai data") || query.includes("ai & data")) matches = matches.filter((article) => article.topics.includes("AI & Data"));
  else if (!query.includes("changed") && !query.includes("read first") && !query.includes("today")) {
    const terms = query.split(" ").filter((term) => term.length > 3);
    matches = matches.filter((article) => terms.some((term) => normalise(`${article.title} ${article.excerpt}`).includes(term)));
  }

  matches = [...matches].sort((left, right) => dated(right) - dated(left) || left.title.localeCompare(right.title)).slice(0, 3);
  if (!matches.length) return "I could not find a verified stored Provider Intelligence article matching that request.";
  return `I found ${matches.length} relevant verified provider ${matches.length === 1 ? "article" : "articles"}:\n\n${matches.map((article) => `• ${providerLabel(article.providerId)}: ${article.title}${article.publishedAt ? ` (${new Date(article.publishedAt).toLocaleDateString("en-GB")})` : " (publication date unavailable)"}\n${article.canonicalUrl}`).join("\n\n")}\n\nThese are source-grounded links, not provider ratings or recommendations.`;
}
