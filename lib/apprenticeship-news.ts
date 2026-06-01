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
};

const TOP_SECTION_LIMIT = 5;
const MAX_PER_SOURCE_TOP_SECTION = 1;
const MAX_PER_SOURCE_FULL_FEED = 2;
const SIMILAR_SCORE_RANGE = 6;

const FEEDS: FeedSource[] = [
  {
    name: "FE Week",
    url: "https://feweek.co.uk/feed/",
    defaultCategory: "Provider Market",
  },
  {
    name: "FE News",
    url: "https://www.fenews.co.uk/feed/",
    defaultCategory: "Provider Market",
  },
  {
    name: "Department for Education",
    url: "https://www.gov.uk/search/news-and-communications.atom?organisations%5B%5D=department-for-education",
    defaultCategory: "Policy",
  },
  {
    name: "GOV.UK apprenticeships",
    url: "https://www.gov.uk/search/all.atom?keywords=apprenticeships&organisations%5B%5D=department-for-education",
    defaultCategory: "Policy",
  },
  {
    name: "Skills England",
    url: "https://skillsengland.education.gov.uk/rss-feed",
    defaultCategory: "Skills",
  },
  {
    name: "Baltic Apprenticeships",
    url: "https://www.balticapprenticeships.com/blog/feed/",
    defaultCategory: "Private Providers",
  },
  {
    name: "Avado",
    url: "https://www.avadolearning.com/blog/feed/",
    defaultCategory: "Private Providers",
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
  "Baltic Apprenticeships": 8,
  Avado: 8,
  "Skills England": 7,
  "GOV.UK apprenticeships": 7,
  "Department for Education": 6,
  "FE Week": 4,
  "FE News": 2,
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
  const results = await Promise.allSettled(FEEDS.map(fetchFeed));
  const items = results.flatMap((result) =>
    result.status === "fulfilled" ? result.value : [],
  );

  const relevantItems = items
    .map(scoreArticle)
    .filter((item) => item.signalScore >= 5 && item.score >= 8)
    .map((item) => ({
      ...item,
      category: categoriseArticle(item),
      summary: trimSummary(item.summary || item.title),
    }));

  const deduped = dedupeArticles(relevantItems);

  const sorted = deduped.sort(
    (a, b) =>
      b.score - a.score ||
      new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
  );

  const balanced = applySourceDiversity(sorted, limit);

  return (balanced.length > 0 ? balanced : FALLBACK_ARTICLES).slice(0, limit);
}

async function fetchFeed(source: FeedSource): Promise<FeedItem[]> {
  const response = await fetch(source.url, {
    next: { revalidate: 86400 },
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
  return decodeEntities(
    value
      .replace(/<!\[CDATA\[/g, "")
      .replace(/\]\]>/g, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
  );
}

function decodeEntities(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function trimSummary(summary: string) {
  if (summary.length <= 180) {
    return summary;
  }

  return `${summary.slice(0, 177).trim()}...`;
}

function scoreArticle(item: FeedItem): ScoredFeedItem {
  const haystack = `${item.title} ${item.summary} ${item.source}`.toLowerCase();
  const boost = BOOST_TERMS.reduce(
    (score, entry) => score + (haystack.includes(entry.term) ? entry.score : 0),
    0,
  );
  const drag = DOWNRANK_TERMS.reduce(
    (score, entry) => score + (haystack.includes(entry.term) ? entry.score : 0),
    0,
  );

  return {
    ...item,
    score: boost + drag + (SOURCE_WEIGHTS[item.source] ?? 0),
    signalScore: boost,
  };
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
  const strongestScore = pool[0].score;
  const similarStrength = pool.filter(
    (candidate) => strongestScore - candidate.score <= SIMILAR_SCORE_RANGE,
  );

  return similarStrength.sort((a, b) => {
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
      b.score - a.score ||
      new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
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

function normaliseKey(value: string) {
  return value
    .toLowerCase()
    .replace(/^https?:\/\/(www\.)?/, "")
    .replace(/[?#].*$/, "")
    .replace(/\/$/, "");
}
