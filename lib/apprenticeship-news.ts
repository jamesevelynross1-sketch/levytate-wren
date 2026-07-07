import { cleanDisplayText } from "@/lib/html-text";

export type NewsCategory =
  | "Private Providers"
  | "Provider Market"
  | "Employers"
  | "Funding"
  | "Policy"
  | "Skills";

export type ApprenticeshipNewsArticle = {
  title: string;
  summary: string;
  url: string;
  source: string;
  publishedAt: string;
  category: NewsCategory;
};

type FeedSource = {
  name: string;
  url: string;
  defaultCategory: NewsCategory;
  sourceWeight?: number;
};

type FeedItem = {
  title: string;
  summary: string;
  url: string;
  publishedAt: string;
  source: string;
  category: NewsCategory;
};

type ScoredFeedItem = FeedItem & {
  score: number;
  signalScore: number;
  timestamp: number;
};

const FEED_REVALIDATE_SECONDS = 86400;
const RECENT_ARTICLE_DAYS = 90;
const FRESH_ARTICLE_DAYS = 180;
const TOP_SECTION_LIMIT = 5;
const MAX_PER_SOURCE_TOP_SECTION = 1;
const MAX_PER_SOURCE_FULL_FEED = 2;
const DEBUG_NEWS_INGESTION =
  process.env.NODE_ENV === "development" || process.env.MPR_NEWS_DEBUG === "1";

const FEEDS: FeedSource[] = [
  {
    name: "FE Week",
    url: "https://feweek.co.uk/feed/",
    defaultCategory: "Provider Market",
    sourceWeight: 8,
  },
  {
    name: "FE News",
    url: "https://www.fenews.co.uk/feed/",
    defaultCategory: "Provider Market",
    sourceWeight: 5,
  },
  {
    name: "Department for Education",
    url: "https://www.gov.uk/search/news-and-communications.atom?organisations%5B%5D=department-for-education",
    defaultCategory: "Policy",
    sourceWeight: 8,
  },
  {
    name: "GOV.UK apprenticeships",
    url: "https://www.gov.uk/search/all.atom?keywords=apprenticeships&organisations%5B%5D=department-for-education",
    defaultCategory: "Policy",
    sourceWeight: 12,
  },
  {
    name: "GOV.UK AI and skills",
    url: "https://www.gov.uk/search/news-and-communications.atom?keywords=artificial%20intelligence%20skills",
    defaultCategory: "Skills",
    sourceWeight: 9,
  },
  {
    name: "Ofsted",
    url: "https://www.gov.uk/search/news-and-communications.atom?organisations%5B%5D=ofsted",
    defaultCategory: "Policy",
    sourceWeight: 8,
  },
  {
    name: "Skills England",
    url: "https://skillsengland.education.gov.uk/rss-feed",
    defaultCategory: "Skills",
    sourceWeight: 10,
  },
  {
    name: "AELP",
    url: "https://www.aelp.org.uk/news/feed/",
    defaultCategory: "Provider Market",
    sourceWeight: 8,
  },
  {
    name: "Personnel Today",
    url: "https://www.personneltoday.com/feed/",
    defaultCategory: "Employers",
    sourceWeight: 7,
  },
  {
    name: "Training Journal",
    url: "https://www.trainingjournal.com/feed/",
    defaultCategory: "Skills",
    sourceWeight: 7,
  },
  {
    name: "TechRepublic AI",
    url: "https://www.techrepublic.com/rssfeeds/topic/artificial-intelligence/",
    defaultCategory: "Skills",
    sourceWeight: 3,
  },
  {
    name: "Baltic Apprenticeships",
    url: "https://www.balticapprenticeships.com/blog/feed/",
    defaultCategory: "Private Providers",
    sourceWeight: 1,
  },
  {
    name: "Avado",
    url: "https://www.avadolearning.com/blog/feed/",
    defaultCategory: "Private Providers",
    sourceWeight: 1,
  },
];

const FALLBACK_ARTICLES: ApprenticeshipNewsArticle[] = [
  {
    title: "Department for Education news and communications",
    summary:
      "Official policy updates, announcements and guidance from the Department for Education.",
    url: "https://www.gov.uk/search/news-and-communications?organisations%5B%5D=department-for-education",
    source: "Department for Education",
    publishedAt: "2026-05-22T00:00:00.000Z",
    category: "Policy",
  },
  {
    title: "Skills England apprenticeship updates",
    summary:
      "Updates on apprenticeship standards, skills priorities and occupational pathways.",
    url: "https://skillsengland.education.gov.uk/rss-feed-subscriptions/",
    source: "Skills England",
    publishedAt: "2026-05-22T00:00:00.000Z",
    category: "Skills",
  },
  {
    title: "FE Week sector coverage",
    summary:
      "Further education, skills and apprenticeship coverage for employers and providers.",
    url: "https://feweek.co.uk/",
    source: "FE Week",
    publishedAt: "2026-05-22T00:00:00.000Z",
    category: "Provider Market",
  },
];

const BOOST_TERMS: Array<{ term: string; score: number }> = [
  { term: "private provider", score: 18 },
  { term: "private training provider", score: 18 },
  { term: "independent training provider", score: 18 },
  { term: "apprenticeship provider", score: 16 },
  { term: "provider market", score: 16 },
  { term: "training provider", score: 14 },
  { term: "apprenticeship funding", score: 14 },
  { term: "apprenticeship levy", score: 14 },
  { term: "growth and skills levy", score: 14 },
  { term: "achievement rates", score: 12 },
  { term: "apprenticeship starts", score: 12 },
  { term: "funded training", score: 12 },
  { term: "skills england", score: 12 },
  { term: "department for education", score: 11 },
  { term: "apprenticeship standard", score: 10 },
  { term: "adult skills", score: 10 },
  { term: "employers", score: 10 },
  { term: "employer", score: 10 },
  { term: "workforce", score: 10 },
  { term: "ofsted", score: 9 },
  { term: "levy", score: 9 },
  { term: "funding", score: 8 },
  { term: "dfe", score: 8 },
  { term: "skills", score: 5 },
  { term: "apprenticeships", score: 5 },
  { term: "apprenticeship", score: 5 },
];

const DOWNRANK_TERMS: Array<{ term: string; score: number }> = [
  { term: "college campus", score: -18 },
  { term: "students celebrate", score: -16 },
  { term: "college awards", score: -16 },
  { term: "university campus", score: -14 },
  { term: "local college", score: -12 },
  { term: "school leavers", score: -12 },
  { term: "sixth form", score: -12 },
  { term: "open day", score: -10 },
  { term: "graduation", score: -10 },
  { term: "estates", score: -10 },
  { term: "gcse", score: -10 },
  { term: "a-level", score: -10 },
];

const SOURCE_WEIGHTS: Record<string, number> = {
  "GOV.UK apprenticeships": 12,
  "Skills England": 10,
  "GOV.UK AI and skills": 9,
  "Department for Education": 8,
  "FE Week": 8,
  Ofsted: 8,
  AELP: 8,
  "Personnel Today": 7,
  "Training Journal": 7,
  "FE News": 5,
  "TechRepublic AI": 3,
  "Baltic Apprenticeships": 1,
  Avado: 1,
};

const CATEGORY_RULES: Array<{ category: NewsCategory; terms: string[] }> = [
  {
    category: "Private Providers",
    terms: [
      "private provider",
      "private training provider",
      "independent training provider",
      "apprenticeship provider",
    ],
  },
  {
    category: "Provider Market",
    terms: [
      "provider market",
      "training provider",
      "providers",
      "ofsted",
      "achievement rates",
      "apprenticeship starts",
    ],
  },
  {
    category: "Employers",
    terms: ["employer", "employers", "workforce", "business", "industry"],
  },
  {
    category: "Funding",
    terms: ["levy", "funding", "funded", "co-investment", "growth and skills levy"],
  },
  {
    category: "Policy",
    terms: [
      "government",
      "department for education",
      "dfe",
      "minister",
      "gov.uk",
      "policy",
      "reform",
      "consultation",
      "announcement",
    ],
  },
  {
    category: "Skills",
    terms: ["skills", "technical education", "skills england", "workforce"],
  },
];

export async function getApprenticeshipNews(limit = 8): Promise<ApprenticeshipNewsArticle[]> {
  const results = await Promise.allSettled(
    FEEDS.map(async (source) => ({
      source: source.name,
      items: await fetchFeed(source),
    })),
  );
  const successfulSources = results.filter(
    (result): result is PromiseFulfilledResult<{ source: string; items: FeedItem[] }> =>
      result.status === "fulfilled",
  );
  const failedSources = results
    .filter((result): result is PromiseRejectedResult => result.status === "rejected")
    .map((result) => (result.reason instanceof Error ? result.reason.message : "Unknown feed failure"));
  const items = successfulSources.flatMap((result) => result.value.items);

  const relevantItems = items
    .map(scoreArticle)
    .filter(isRelevantArticle)
    .map((item) => ({
      ...item,
      category: categoriseArticle(item),
      summary: trimSummary(item.summary || item.title),
    }));

  const deduped = dedupeArticles(relevantItems);
  const candidatePool = getRecentCandidatePool(deduped, limit);
  const rankedForDiversity = sortByRecencyAndScore(candidatePool);
  const balanced = applySourceDiversity(rankedForDiversity, limit);
  const newestFirst = sortByPublishDate(balanced);
  const finalArticles = (newestFirst.length > 0 ? newestFirst : FALLBACK_ARTICLES).slice(0, limit);

  logIngestionDiagnostics({
    fetchedItems: items,
    sourceCounts: successfulSources.map((result) => ({
      source: result.value.source,
      count: result.value.items.length,
    })),
    failedSources,
    relevantItems,
    deduped,
    finalArticles,
  });

  return finalArticles;
}

async function fetchFeed(source: FeedSource): Promise<FeedItem[]> {
  const response = await fetch(source.url, {
    next: { revalidate: FEED_REVALIDATE_SECONDS },
    headers: {
      Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml",
    },
  });

  if (!response.ok) {
    throw new Error(`Feed failed: ${source.name}`);
  }

  const xml = await response.text();
  const blocks = xml.includes("<entry")
    ? getBlocks(xml, "entry")
    : getBlocks(xml, "item");

  return blocks
    .map((block) => parseFeedItem(block, source))
    .filter((item): item is FeedItem => Boolean(item));
}

function parseFeedItem(block: string, source: FeedSource): FeedItem | null {
  const title = cleanText(getTag(block, "title"));
  const summary = cleanText(
    getTag(block, "description") ||
      getTag(block, "summary") ||
      getTag(block, "content"),
  );
  const url =
    cleanText(getTag(block, "link")) ||
    getAtomLink(block) ||
    cleanText(getTag(block, "guid"));
  const publishedAt =
    cleanText(getTag(block, "pubDate")) ||
    cleanText(getTag(block, "published")) ||
    cleanText(getTag(block, "updated")) ||
    new Date().toISOString();
  const date = new Date(publishedAt);

  if (!title || !url || Number.isNaN(date.getTime())) {
    return null;
  }

  return {
    title,
    summary,
    url,
    publishedAt: date.toISOString(),
    source: source.name,
    category: source.defaultCategory,
  };
}

function getBlocks(xml: string, tag: string) {
  return Array.from(
    xml.matchAll(new RegExp(`<${tag}[^>]*>[\\s\\S]*?<\\/${tag}>`, "gi")),
    (match) => match[0],
  );
}

function getTag(block: string, tag: string) {
  const match = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match?.[1] ?? "";
}

function getAtomLink(block: string) {
  const alternate = block.match(/<link[^>]+rel=["']alternate["'][^>]+href=["']([^"']+)["'][^>]*>/i);
  const first = block.match(/<link[^>]+href=["']([^"']+)["'][^>]*>/i);
  return alternate?.[1] ?? first?.[1] ?? "";
}

function cleanText(value: string) {
  return cleanDisplayText(value);
}

function trimSummary(summary: string) {
  if (summary.length <= 180) {
    return summary;
  }

  return `${summary.slice(0, 177).trim()}...`;
}

function scoreArticle(item: FeedItem): ScoredFeedItem {
  const haystack = `${item.title} ${item.summary} ${item.source}`.toLowerCase();
  const timestamp = toTimestamp(item.publishedAt);
  const boost = BOOST_TERMS.reduce(
    (score, entry) => score + (haystack.includes(entry.term) ? entry.score : 0),
    0,
  );
  const drag = DOWNRANK_TERMS.reduce(
    (score, entry) => score + (haystack.includes(entry.term) ? entry.score : 0),
    0,
  );
  const recency = getRecencyScore(timestamp);
  const sourceWeight =
    FEEDS.find((source) => source.name === item.source)?.sourceWeight ??
    SOURCE_WEIGHTS[item.source] ??
    0;

  return {
    ...item,
    score: boost + drag + recency + sourceWeight,
    signalScore: boost,
    timestamp,
  };
}

function isRelevantArticle(item: ScoredFeedItem) {
  const haystack = `${item.title} ${item.summary} ${item.category} ${item.source}`.toLowerCase();
  const hasPositiveSignal = item.signalScore >= 5 || hasCoreSignal(haystack);
  const hasHardNegative = DOWNRANK_TERMS.some(
    (entry) => entry.score <= -12 && haystack.includes(entry.term),
  );

  if (!hasPositiveSignal) {
    return false;
  }

  if (hasHardNegative && item.signalScore < 18) {
    return false;
  }

  return item.score >= 5;
}

function hasCoreSignal(haystack: string) {
  return [
    "apprenticeship",
    "apprenticeships",
    "levy",
    "funding",
    "skills england",
    "department for education",
    "dfe",
    "ofsted",
    "training provider",
    "provider",
    "workforce",
    "learning and development",
    "leadership",
    "management",
    "procurement",
    "ai",
    "artificial intelligence",
    "automation",
    "digital skills",
    "data skills",
    "upskilling",
    "reskilling",
    "future of work",
    "productivity",
    "employer",
  ].some((term) => haystack.includes(term));
}

function getRecencyScore(timestamp: number) {
  if (timestamp <= 0) {
    return -40;
  }

  const ageDays = (Date.now() - timestamp) / 86_400_000;

  if (ageDays <= 7) {
    return 24;
  }

  if (ageDays <= 30) {
    return 16;
  }

  if (ageDays <= RECENT_ARTICLE_DAYS) {
    return 8;
  }

  if (ageDays <= FRESH_ARTICLE_DAYS) {
    return -8;
  }

  return -28;
}

function categoriseArticle(item: FeedItem): NewsCategory {
  const haystack = `${item.title} ${item.summary} ${item.source}`.toLowerCase();
  const match = CATEGORY_RULES.find((rule) =>
    rule.terms.some((term) => haystack.includes(term)),
  );

  return match?.category ?? item.category;
}

function dedupeArticles(items: ScoredFeedItem[]): ScoredFeedItem[] {
  const seen = new Set<string>();

  return items.filter((item) => {
    const key = normaliseKey(item.url || item.title);

    if (!item.title || !item.url || seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function getRecentCandidatePool(items: ScoredFeedItem[], limit: number) {
  const dated = items.filter((item) => item.timestamp > 0);
  const recent = dated.filter((item) => getAgeDays(item.timestamp) <= RECENT_ARTICLE_DAYS);
  const fresh = dated.filter((item) => getAgeDays(item.timestamp) <= FRESH_ARTICLE_DAYS);
  const minimumRecentVolume = Math.min(limit, 8);

  if (recent.length >= minimumRecentVolume) {
    return recent;
  }

  if (fresh.length >= minimumRecentVolume) {
    return fresh;
  }

  return items;
}

function sortByRecencyAndScore(items: ScoredFeedItem[]) {
  return [...items].sort((a, b) => b.timestamp - a.timestamp || b.score - a.score);
}

function sortByPublishDate(items: ScoredFeedItem[]): ApprenticeshipNewsArticle[] {
  return [...items]
    .sort((a, b) => b.timestamp - a.timestamp || b.score - a.score)
    .map(toPublicArticle);
}

function toPublicArticle(item: ScoredFeedItem): ApprenticeshipNewsArticle {
  return {
    title: item.title,
    summary: item.summary,
    url: item.url,
    source: item.source,
    publishedAt: item.publishedAt,
    category: item.category,
  };
}

function applySourceDiversity(
  items: ScoredFeedItem[],
  limit: number,
): ScoredFeedItem[] {
  const selected: ScoredFeedItem[] = [];
  const sourceCounts = new Map<string, number>();
  const remaining = [...items];

  while (selected.length < limit && remaining.length > 0) {
    const candidate = pickDiverseCandidate(
      remaining,
      selected,
      sourceCounts,
      selected.length < TOP_SECTION_LIMIT,
    );

    if (!candidate) {
      break;
    }

    selected.push(candidate);
    sourceCounts.set(candidate.source, (sourceCounts.get(candidate.source) ?? 0) + 1);
    remaining.splice(remaining.indexOf(candidate), 1);
  }

  return selected;
}

function pickDiverseCandidate(
  candidates: ScoredFeedItem[],
  selected: ScoredFeedItem[],
  sourceCounts: Map<string, number>,
  isTopSection: boolean,
) {
  const allowed = candidates.filter((candidate) =>
    canSelectSource(candidate, selected, sourceCounts, isTopSection),
  );

  if (allowed.length === 0) {
    return null;
  }

  const nonConsecutive = allowed.filter(
    (candidate) => !isSameSourceAsPrevious(candidate, selected),
  );
  const pool = nonConsecutive.length > 0 ? nonConsecutive : allowed;
  const newestTimestamp = pool[0].timestamp;
  const similarRecency = pool.filter(
    (candidate) => Math.abs(newestTimestamp - candidate.timestamp) <= 7 * 86_400_000,
  );

  return similarRecency.sort((a, b) => {
    const sourceBalance = getSourceCount(a.source, sourceCounts) - getSourceCount(b.source, sourceCounts);

    if (sourceBalance !== 0) {
      return sourceBalance;
    }

    const consecutiveBalance =
      Number(isSameSourceAsPrevious(a, selected)) -
      Number(isSameSourceAsPrevious(b, selected));

    if (consecutiveBalance !== 0) {
      return consecutiveBalance;
    }

    return (
      b.timestamp - a.timestamp ||
      b.score - a.score
    );
  })[0];
}

function canSelectSource(
  candidate: ScoredFeedItem,
  selected: ScoredFeedItem[],
  sourceCounts: Map<string, number>,
  isTopSection: boolean,
) {
  const count = getSourceCount(candidate.source, sourceCounts);

  if (count >= MAX_PER_SOURCE_FULL_FEED) {
    return false;
  }

  if (isTopSection && count >= MAX_PER_SOURCE_TOP_SECTION) {
    return false;
  }

  return true;
}

function isSameSourceAsPrevious(
  candidate: ScoredFeedItem,
  selected: ScoredFeedItem[],
) {
  return selected.at(-1)?.source === candidate.source;
}

function getSourceCount(source: string, sourceCounts: Map<string, number>) {
  return sourceCounts.get(source) ?? 0;
}

function getAgeDays(timestamp: number) {
  return (Date.now() - timestamp) / 86_400_000;
}

function toTimestamp(value: string) {
  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function normaliseKey(value: string) {
  return value
    .toLowerCase()
    .replace(/^https?:\/\/(www\.)?/, "")
    .replace(/[?#].*$/, "")
    .replace(/\/$/, "");
}

function logIngestionDiagnostics({
  fetchedItems,
  sourceCounts,
  failedSources,
  relevantItems,
  deduped,
  finalArticles,
}: {
  fetchedItems: FeedItem[];
  sourceCounts: Array<{ source: string; count: number }>;
  failedSources: string[];
  relevantItems: ScoredFeedItem[];
  deduped: ScoredFeedItem[];
  finalArticles: ApprenticeshipNewsArticle[];
}) {
  if (!DEBUG_NEWS_INGESTION) {
    return;
  }

  const timestamps = finalArticles
    .map((article) => toTimestamp(article.publishedAt))
    .filter((timestamp) => timestamp > 0);

  console.info("MPR intelligence ingestion", {
    totalFetched: fetchedItems.length,
    afterFiltering: relevantItems.length,
    afterDedupe: deduped.length,
    finalRendered: finalArticles.length,
    newestDate:
      timestamps.length > 0 ? new Date(Math.max(...timestamps)).toISOString() : null,
    oldestDate:
      timestamps.length > 0 ? new Date(Math.min(...timestamps)).toISOString() : null,
    sourceCounts,
    finalSources: finalArticles.reduce<Record<string, number>>((counts, article) => {
      counts[article.source] = (counts[article.source] ?? 0) + 1;
      return counts;
    }, {}),
    failedSources,
  });
}
