export type NewsCategory =
  | "AI & Automation"
  | "Apprenticeships"
  | "Employer Strategy"
  | "Funding & Levy"
  | "Policy"
  | "Provider Intelligence"
  | "Workforce Capability";

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
  group: "ai-workforce" | "apprenticeship-sector";
  format?: "feed" | "html";
};

type FeedItem = ApprenticeshipNewsArticle;

type ScoredFeedItem = FeedItem & {
  score: number;
  signalScore: number;
  timestamp: number;
  rejectionReason?: string;
};

const FEED_REVALIDATE_SECONDS = 86400;
const FEED_FETCH_TIMEOUT_MS = 8000;
const HTML_PARSE_CHARACTER_LIMIT = 500_000;
const TOP_SECTION_LIMIT = 5;
const MAX_PER_SOURCE_TOP_SECTION = 1;
const MAX_PER_SOURCE_FULL_FEED = 2;
const RELEVANCE_THRESHOLD = 28;
const DEBUG_NEWS_RELEVANCE = process.env.DEBUG_NEWS_RELEVANCE === "1";

const FEEDS: FeedSource[] = [
  {
    name: "FE Week",
    url: "https://feweek.co.uk/feed/",
    defaultCategory: "Provider Intelligence",
    sourceWeight: 8,
    group: "apprenticeship-sector",
  },
  {
    name: "FE News",
    url: "https://www.fenews.co.uk/feed/",
    defaultCategory: "Provider Intelligence",
    sourceWeight: 4,
    group: "apprenticeship-sector",
  },
  {
    name: "Department for Education",
    url: "https://www.gov.uk/search/news-and-communications.atom?organisations%5B%5D=department-for-education",
    defaultCategory: "Policy",
    sourceWeight: 10,
    group: "apprenticeship-sector",
  },
  {
    name: "GOV.UK apprenticeships",
    url: "https://www.gov.uk/search/all.atom?keywords=apprenticeships&organisations%5B%5D=department-for-education",
    defaultCategory: "Policy",
    sourceWeight: 10,
    group: "apprenticeship-sector",
  },
  {
    name: "GOV.UK AI and skills",
    url: "https://www.gov.uk/search/news-and-communications.atom?keywords=artificial%20intelligence%20skills",
    defaultCategory: "AI & Automation",
    sourceWeight: 9,
    group: "ai-workforce",
  },
  {
    name: "Ofsted",
    url: "https://www.gov.uk/search/news-and-communications.atom?organisations%5B%5D=ofsted",
    defaultCategory: "Policy",
    sourceWeight: 11,
    group: "apprenticeship-sector",
  },
  {
    name: "Skills England",
    url: "https://skillsengland.education.gov.uk/rss-feed",
    defaultCategory: "Workforce Capability",
    sourceWeight: 10,
    group: "apprenticeship-sector",
  },
  {
    name: "AELP",
    url: "https://www.aelp.org.uk/news/feed/",
    defaultCategory: "Provider Intelligence",
    sourceWeight: 7,
    group: "apprenticeship-sector",
  },
  {
    name: "CIPD",
    url: "https://www.cipd.org/uk/about/news/",
    defaultCategory: "Employer Strategy",
    sourceWeight: 11,
    group: "ai-workforce",
    format: "html",
  },
  {
    name: "Personnel Today",
    url: "https://www.personneltoday.com/feed/",
    defaultCategory: "Employer Strategy",
    sourceWeight: 9,
    group: "ai-workforce",
  },
  {
    name: "Training Journal",
    url: "https://www.trainingjournal.com/feed/",
    defaultCategory: "Workforce Capability",
    sourceWeight: 9,
    group: "ai-workforce",
  },
  {
    name: "TechRepublic AI",
    url: "https://www.techrepublic.com/rssfeeds/topic/artificial-intelligence/",
    defaultCategory: "AI & Automation",
    sourceWeight: 5,
    group: "ai-workforce",
  },
  {
    name: "Microsoft WorkLab",
    url: "https://www.microsoft.com/en-us/worklab/",
    defaultCategory: "AI & Automation",
    sourceWeight: 11,
    group: "ai-workforce",
    format: "html",
  },
  {
    name: "McKinsey Future of Work",
    url: "https://www.mckinsey.com/featured-insights/future-of-work",
    defaultCategory: "Workforce Capability",
    sourceWeight: 12,
    group: "ai-workforce",
    format: "html",
  },
  {
    name: "WEF Future of Work",
    url: "https://www.weforum.org/topics/future-of-work/",
    defaultCategory: "Workforce Capability",
    sourceWeight: 10,
    group: "ai-workforce",
    format: "html",
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
    category: "Workforce Capability",
  },
  {
    title: "FE Week sector coverage",
    summary:
      "Further education, skills and apprenticeship coverage for employers and providers.",
    url: "https://feweek.co.uk/",
    source: "FE Week",
    publishedAt: "2026-05-22T00:00:00.000Z",
    category: "Provider Intelligence",
  },
];

const BOOST_TERMS: Array<{ term: string; score: number }> = [
  { term: "future of work", score: 34 },
  { term: "workforce transformation", score: 34 },
  { term: "workforce strategy", score: 32 },
  { term: "skills intelligence", score: 32 },
  { term: "future of jobs", score: 32 },
  { term: "people strategy", score: 30 },
  { term: "organisation design", score: 28 },
  { term: "organizational design", score: 28 },
  { term: "talent strategy", score: 28 },
  { term: "reskilling", score: 26 },
  { term: "upskilling", score: 26 },
  { term: "ai apprenticeships", score: 34 },
  { term: "ai apprenticeship", score: 34 },
  { term: "artificial intelligence", score: 34 },
  { term: "machine learning", score: 32 },
  { term: "process automation", score: 30 },
  { term: "digital transformation", score: 30 },
  { term: "business transformation", score: 24 },
  { term: "data apprenticeships", score: 30 },
  { term: "data apprenticeship", score: 30 },
  { term: "digital apprenticeships", score: 30 },
  { term: "digital apprenticeship", score: 30 },
  { term: "technology apprenticeships", score: 30 },
  { term: "technology apprenticeship", score: 30 },
  { term: "software apprenticeships", score: 30 },
  { term: "software apprenticeship", score: 30 },
  { term: "cyber apprenticeships", score: 30 },
  { term: "cyber apprenticeship", score: 30 },
  { term: "workplace technology", score: 28 },
  { term: "workplace tech", score: 24 },
  { term: "automation", score: 24 },
  { term: "analytics", score: 24 },
  { term: "copilot", score: 24 },
  { term: "chatgpt", score: 24 },
  { term: "ai skills", score: 24 },
  { term: "data skills", score: 22 },
  { term: "tech skills", score: 22 },
  { term: "digital skills", score: 22 },
  { term: "cyber skills", score: 22 },
  { term: "workforce capability", score: 22 },
  { term: "productivity", score: 20 },
  { term: "management apprenticeship", score: 20 },
  { term: "management apprenticeships", score: 20 },
  { term: "leadership apprenticeship", score: 20 },
  { term: "leadership apprenticeships", score: 20 },
  { term: "hr apprenticeship", score: 20 },
  { term: "hr apprenticeships", score: 20 },
  { term: "human resources apprenticeship", score: 20 },
  { term: "human resources apprenticeships", score: 20 },
  { term: "l&d apprenticeship", score: 20 },
  { term: "l&d apprenticeships", score: 20 },
  { term: "learning and development apprenticeship", score: 20 },
  { term: "learning and development apprenticeships", score: 20 },
  { term: "procurement apprenticeship", score: 20 },
  { term: "procurement apprenticeships", score: 20 },
  { term: "private training provider", score: 18 },
  { term: "independent training provider", score: 18 },
  { term: "private provider", score: 18 },
  { term: "apprenticeship provider", score: 17 },
  { term: "employer skills", score: 16 },
  { term: "apprenticeship funding", score: 16 },
  { term: "apprenticeship levy", score: 16 },
  { term: "growth and skills levy", score: 16 },
  { term: "provider market", score: 15 },
  { term: "training provider", score: 14 },
  { term: "funded training", score: 12 },
  { term: "skills england", score: 12 },
  { term: "department for education", score: 11 },
  { term: "apprenticeship standard", score: 10 },
  { term: "adult skills", score: 10 },
  { term: "learning and development", score: 16 },
  { term: "human resources", score: 16 },
  { term: "hr", score: 12 },
  { term: "cipd", score: 14 },
  { term: "inspection", score: 10 },
  { term: "aelp", score: 10 },
  { term: "employers", score: 10 },
  { term: "employer", score: 10 },
  { term: "workforce", score: 10 },
  { term: "public sector workforce", score: 10 },
  { term: "private sector", score: 8 },
  { term: "ofsted", score: 9 },
  { term: "levy", score: 9 },
  { term: "funding", score: 8 },
  { term: "dfe", score: 8 },
  { term: "cyber", score: 8 },
  { term: "digital", score: 8 },
  { term: "data", score: 7 },
  { term: "skills", score: 5 },
  { term: "apprenticeships", score: 5 },
  { term: "apprenticeship", score: 5 },
];

const CORE_RELEVANCE_TERMS: Array<{ term: string; score: number }> = [
  { term: "apprenticeship", score: 28 },
  { term: "apprenticeships", score: 28 },
  { term: "levy", score: 24 },
  { term: "skills england", score: 24 },
  { term: "dfe apprenticeships", score: 24 },
  { term: "workforce", score: 22 },
  { term: "workforce planning", score: 28 },
  { term: "future skills", score: 26 },
  { term: "future of work", score: 26 },
  { term: "capability", score: 22 },
  { term: "skills", score: 20 },
  { term: "digital skills", score: 24 },
  { term: "ai", score: 18 },
  { term: "artificial intelligence", score: 24 },
  { term: "automation", score: 22 },
  { term: "employer", score: 18 },
  { term: "talent", score: 18 },
  { term: "learning", score: 16 },
  { term: "development", score: 16 },
  { term: "learning and development", score: 24 },
  { term: "training", score: 16 },
  { term: "provider", score: 16 },
  { term: "ofsted", score: 16 },
  { term: "reskilling", score: 24 },
  { term: "upskilling", score: 24 },
  { term: "productivity", score: 20 },
  { term: "education workforce", score: 22 },
];

const HARD_NEGATIVE_TERMS = [
  "waste",
  "recycling",
  "childcare",
  "childcare costs",
  "schools admissions",
  "school admissions",
  "weather",
  "crime",
  "courts",
  "court",
  "housing",
  "flooding",
  "transport",
  "roadworks",
  "consumer protection",
  "food safety",
  "environment enforcement",
  "environmental enforcement",
  "environment prosecution",
  "environment prosecutions",
  "general politics",
  "military",
  "nhs clinical",
  "clinical trial",
  "international diplomacy",
];

const SOURCE_RELEVANCE_WEIGHTS: Record<string, number> = {
  "Skills England": 22,
  "FE Week": 18,
  "Department for Education": 8,
  "GOV.UK apprenticeships": 18,
  "GOV.UK AI and skills": 14,
  Ofsted: 16,
  CIPD: 18,
  "Personnel Today": 16,
  "McKinsey Future of Work": 18,
  "Microsoft WorkLab": 18,
  "Training Journal": 14,
  AELP: 12,
  "TechRepublic AI": 8,
  "FE News": 8,
  "WEF Future of Work": 14,
};

const GENERIC_OFFICIAL_SOURCES = new Set([
  "Department for Education",
  "GOV.UK AI and skills",
  "Ofsted",
]);

const TECH_PROVIDER_TERMS = [
  "ai",
  "artificial intelligence",
  "automation",
  "data",
  "digital",
  "technology",
  "tech",
  "cyber",
  "software",
  "analytics",
  "business transformation",
  "workplace technology",
  "workforce capability",
  "productivity",
  "copilot",
  "chatgpt",
  "machine learning",
];

const PROVIDER_TERMS = [
  "provider",
  "training provider",
  "private training provider",
  "independent training provider",
  "apprenticeship provider",
];

const DOWNRANK_TERMS: Array<{ term: string; score: number }> = [
  { term: "award", score: -10 },
  { term: "awards", score: -12 },
  { term: "webinar", score: -8 },
  { term: "sponsored", score: -14 },
  { term: "discount", score: -16 },
  { term: "enrol now", score: -18 },
  { term: "book now", score: -12 },
  { term: "free course", score: -12 },
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
  { term: "student stories", score: -10 },
  { term: "consumer gadget", score: -12 },
  { term: "smartphone", score: -10 },
  { term: "gaming", score: -10 },
  { term: "camera", score: -8 },
];

const CATEGORY_RULES: Array<{ category: NewsCategory; terms: string[] }> = [
  {
    category: "AI & Automation",
    terms: [
      "ai apprenticeships",
      "ai apprenticeship",
      "artificial intelligence",
      "automation",
      "copilot",
      "chatgpt",
      "machine learning",
      "process automation",
      "ai skills",
    ],
  },
  {
    category: "Workforce Capability",
    terms: [
      "data apprenticeships",
      "data apprenticeship",
      "digital apprenticeships",
      "digital apprenticeship",
      "technology apprenticeships",
      "technology apprenticeship",
      "software apprenticeships",
      "software apprenticeship",
      "cyber apprenticeships",
      "cyber apprenticeship",
      "analytics",
      "digital transformation",
      "workplace technology",
      "data skills",
      "tech skills",
      "workforce capability",
      "future of work",
      "future of jobs",
      "upskilling",
      "reskilling",
      "skills intelligence",
    ],
  },
  {
    category: "Provider Intelligence",
    terms: [
      "provider market",
      "training provider",
      "private training provider",
      "independent training provider",
      "apprenticeship provider",
      "ofsted",
      "achievement rates",
      "apprenticeship starts",
    ],
  },
  {
    category: "Funding & Levy",
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
      "ofsted",
      "inspection",
    ],
  },
  {
    category: "Employer Strategy",
    terms: [
      "employer",
      "employers",
      "employer skills",
      "workforce",
      "business",
      "industry",
      "management apprenticeship",
      "leadership apprenticeship",
      "hr apprenticeship",
      "l&d apprenticeship",
      "procurement apprenticeship",
      "people strategy",
      "talent strategy",
      "workforce strategy",
      "organisation design",
      "organizational design",
      "cipd",
    ],
  },
  {
    category: "Apprenticeships",
    terms: [
      "apprenticeship",
      "apprenticeships",
      "apprenticeship standard",
      "apprenticeship starts",
      "apprenticeship funding",
    ],
  },
];

export async function getApprenticeshipNews(limit = 8): Promise<ApprenticeshipNewsArticle[]> {
  const results = await Promise.allSettled(FEEDS.map(fetchFeed));
  const items = results.flatMap((result) =>
    result.status === "fulfilled" ? result.value : [],
  );

  const relevantItems = items
    .map(scoreArticle)
    .filter(isRelevantArticle)
    .map((item) => ({
      ...item,
      category: categoriseArticle(item),
      title: cleanDisplayText(item.title),
      summary: trimSummary(item.summary || item.title),
      source: cleanDisplayText(item.source),
    }));

  const deduped = dedupeArticles(relevantItems);
  const ranked = sortByScoreAndRecency(deduped);
  const balanced = applySourceDiversity(ranked, limit);
  const newestFirst = sortByPublishDate(balanced);

  return (newestFirst.length > 0 ? newestFirst : FALLBACK_ARTICLES).slice(0, limit);
}

async function fetchFeed(source: FeedSource): Promise<FeedItem[]> {
  const response = await fetch(source.url, {
    next: { revalidate: FEED_REVALIDATE_SECONDS },
    signal: AbortSignal.timeout(FEED_FETCH_TIMEOUT_MS),
    headers: {
      Accept:
        source.format === "html"
          ? "text/html, application/xhtml+xml"
          : "application/rss+xml, application/atom+xml, application/xml, text/xml",
    },
  });

  if (!response.ok) {
    throw new Error(`Feed failed: ${source.name}`);
  }

  const xml = await response.text();

  if (source.format === "html") {
    return parseHtmlSource(xml.slice(0, HTML_PARSE_CHARACTER_LIMIT), source);
  }

  const blocks = xml.includes("<entry")
    ? getBlocks(xml, "entry")
    : getBlocks(xml, "item");

  return blocks
    .map((block) => parseFeedItem(block, source))
    .filter((item): item is FeedItem => Boolean(item));
}

function parseHtmlSource(html: string, source: FeedSource): FeedItem[] {
  const blocks = getHtmlBlocks(html);
  const seen = new Set<string>();

  return blocks
    .map((block) => parseHtmlItem(block, source))
    .filter((item): item is FeedItem => Boolean(item))
    .filter((item) => {
      const key = normaliseKey(item.url);

      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    })
    .slice(0, 10);
}

function getHtmlBlocks(html: string) {
  const articleBlocks = Array.from(
    html.matchAll(/<article[^>]*>[\s\S]*?<\/article>/gi),
    (match) => match[0],
  );

  if (articleBlocks.length > 0) {
    return articleBlocks;
  }

  const listBlocks = Array.from(
    html.matchAll(/<li[^>]*>[\s\S]*?<\/li>/gi),
    (match) => match[0],
  );

  if (listBlocks.length > 0) {
    return listBlocks;
  }

  return Array.from(
    html.matchAll(/<a[^>]+href=["'][^"']+["'][^>]*>[\s\S]*?<\/a>/gi),
    (match) => match[0],
  );
}

function parseHtmlItem(block: string, source: FeedSource): FeedItem | null {
  const href = getHtmlHref(block);
  const title = cleanDisplayText(
    getFirstHtmlTag(block, "h1") ||
      getFirstHtmlTag(block, "h2") ||
      getFirstHtmlTag(block, "h3") ||
      getFirstHtmlTag(block, "a"),
  );

  if (!href || title.length < 18 || isNavigationLabel(title)) {
    return null;
  }

  const summary = cleanDisplayText(
    getFirstHtmlTag(block, "p") || getMetaDescription(block) || title,
  );
  const publishedAt = getHtmlDate(block);
  const timestamp = toTimestamp(publishedAt);

  return {
    title,
    summary,
    url: resolveUrl(href, source.url),
    publishedAt:
      timestamp > 0 ? new Date(timestamp).toISOString() : "1970-01-01T00:00:00.000Z",
    source: cleanDisplayText(source.name),
    category: source.defaultCategory,
  };
}

function getHtmlHref(block: string) {
  return block.match(/href=["']([^"']+)["']/i)?.[1] ?? "";
}

function getFirstHtmlTag(block: string, tag: string) {
  const match = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match?.[1] ?? "";
}

function getMetaDescription(block: string) {
  return block.match(/(?:description|summary)["'][^>]*content=["']([^"']+)["']/i)?.[1] ?? "";
}

function getHtmlDate(block: string) {
  return (
    block.match(/datetime=["']([^"']+)["']/i)?.[1] ??
    block.match(/datePublished["']?\s*:\s*["']([^"']+)["']/i)?.[1] ??
    ""
  );
}

function resolveUrl(href: string, baseUrl: string) {
  try {
    return new URL(href, baseUrl).toString();
  } catch {
    return href;
  }
}

function isNavigationLabel(title: string) {
  const normalised = title.toLowerCase();
  return [
    "home",
    "about",
    "contact",
    "subscribe",
    "privacy",
    "terms",
    "search",
    "learn more",
  ].includes(normalised);
}

function parseFeedItem(block: string, source: FeedSource): FeedItem | null {
  const title = cleanDisplayText(getTag(block, "title"));
  const summary = cleanDisplayText(
    getTag(block, "description") ||
      getTag(block, "summary") ||
      getTag(block, "content"),
  );
  const url =
    cleanDisplayText(getTag(block, "link")) ||
    getAtomLink(block) ||
    cleanDisplayText(getTag(block, "guid"));
  const publishedAt =
    cleanDisplayText(getTag(block, "pubDate")) ||
    cleanDisplayText(getTag(block, "published")) ||
    cleanDisplayText(getTag(block, "updated")) ||
    "";
  const timestamp = toTimestamp(publishedAt);

  if (!title || !url) {
    return null;
  }

  return {
    title,
    summary,
    url,
    publishedAt:
      timestamp > 0 ? new Date(timestamp).toISOString() : "1970-01-01T00:00:00.000Z",
    source: cleanDisplayText(source.name),
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

function cleanDisplayText(value: string) {
  return decodeHtmlEntities(value)
    .replace(/<!\[CDATA\[/g, "")
    .replace(/\]\]>/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function decodeHtmlEntities(value: string) {
  const namedEntities: Record<string, string> = {
    amp: "&",
    apos: "’",
    hellip: "…",
    lt: "<",
    gt: ">",
    nbsp: " ",
    ndash: "–",
    mdash: "—",
    quot: "\"",
    rsquo: "’",
    lsquo: "‘",
    rdquo: "”",
    ldquo: "“",
  };

  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, entity: string) => {
    const normalised = entity.toLowerCase();

    if (normalised.startsWith("#x")) {
      return decodeCodePoint(Number.parseInt(normalised.slice(2), 16), match);
    }

    if (normalised.startsWith("#")) {
      return decodeCodePoint(Number.parseInt(normalised.slice(1), 10), match);
    }

    return namedEntities[normalised] ?? match;
  });
}

function decodeCodePoint(codePoint: number, fallback: string) {
  if (!Number.isFinite(codePoint)) {
    return fallback;
  }

  try {
    return String.fromCodePoint(codePoint);
  } catch {
    return fallback;
  }
}

function trimSummary(summary: string) {
  const cleanSummary = cleanDisplayText(summary);

  if (cleanSummary.length <= 180) {
    return tidySummaryEnding(cleanSummary);
  }

  return tidySummaryEnding(`${cleanSummary.slice(0, 176).trim()}…`);
}

function tidySummaryEnding(summary: string) {
  return summary
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/([,;:])$/, ".")
    .trim();
}

function scoreArticle(item: FeedItem): ScoredFeedItem {
  const haystack = `${item.title} ${item.summary} ${item.source}`.toLowerCase();
  const relevance = relevanceScore(item);
  const boost = BOOST_TERMS.reduce(
    (score, entry) => score + (haystack.includes(entry.term) ? entry.score : 0),
    0,
  );
  const drag = DOWNRANK_TERMS.reduce(
    (score, entry) => score + (haystack.includes(entry.term) ? entry.score : 0),
    0,
  );
  const aiKeywordScore = /\bai\b/.test(haystack) ? 14 : 0;
  const providerPenalty = isProviderArticle(haystack) && !hasTechOrCapabilitySignal(haystack) ? -18 : 0;
  const genericAiPenalty = isGenericAiArticle(haystack) ? -18 : 0;
  const source = FEEDS.find((feed) => feed.name === item.source);
  const timestamp = toTimestamp(item.publishedAt);
  const recencyScore = getRecencyScore(timestamp);

  return {
    ...item,
    score:
      relevance.score +
      boost +
      aiKeywordScore +
      drag +
      providerPenalty +
      genericAiPenalty +
      recencyScore +
      (source?.sourceWeight ?? 0),
    signalScore: boost + aiKeywordScore,
    timestamp,
    rejectionReason: relevance.reason,
  };
}

function relevanceScore(item: FeedItem) {
  const haystack = getArticleHaystack(item);
  const hardNegative = HARD_NEGATIVE_TERMS.find((term) => haystack.includes(term));

  if (hardNegative) {
    return {
      score: -100,
      reason: `hard negative: ${hardNegative}`,
    };
  }

  const termScore = CORE_RELEVANCE_TERMS.reduce(
    (score, entry) => score + (haystack.includes(entry.term) ? entry.score : 0),
    0,
  );
  const sourceScore = SOURCE_RELEVANCE_WEIGHTS[item.source] ?? 0;
  const categoryScore = getCategoryRelevanceScore(item.category);
  const genericOfficialPenalty =
    GENERIC_OFFICIAL_SOURCES.has(item.source) && termScore < 28 ? -28 : 0;
  const genericEducationPenalty =
    isGenericEducationArticle(haystack) && !hasCoreMprSignal(haystack) ? -30 : 0;
  const score = termScore + sourceScore + categoryScore + genericOfficialPenalty + genericEducationPenalty;
  const reason =
    score >= RELEVANCE_THRESHOLD
      ? `accepted: relevance ${score}`
      : `below threshold: relevance ${score}`;

  return {
    score,
    reason,
  };
}

function getArticleHaystack(item: FeedItem) {
  return `${item.title} ${item.summary} ${item.category} ${item.source}`.toLowerCase();
}

function getCategoryRelevanceScore(category: NewsCategory) {
  switch (category) {
    case "Apprenticeships":
      return 18;
    case "Workforce Capability":
      return 16;
    case "AI & Automation":
      return 14;
    case "Employer Strategy":
      return 14;
    case "Provider Intelligence":
      return 12;
    case "Policy":
      return 4;
    case "Funding & Levy":
      return 16;
  }
}

function isGenericEducationArticle(haystack: string) {
  return (
    haystack.includes("education") ||
    haystack.includes("school") ||
    haystack.includes("schools") ||
    haystack.includes("college")
  );
}

function hasCoreMprSignal(haystack: string) {
  return CORE_RELEVANCE_TERMS.some((entry) => haystack.includes(entry.term));
}

function getRecencyScore(timestamp: number) {
  if (timestamp <= 0) {
    return -30;
  }

  const ageDays = (Date.now() - timestamp) / 86_400_000;

  if (ageDays <= 7) {
    return 18;
  }

  if (ageDays <= 30) {
    return 10;
  }

  if (ageDays <= 90) {
    return 2;
  }

  if (ageDays <= 180) {
    return -10;
  }

  return -26;
}

function isProviderArticle(haystack: string) {
  return PROVIDER_TERMS.some((term) => haystack.includes(term));
}

function hasTechOrCapabilitySignal(haystack: string) {
  return TECH_PROVIDER_TERMS.some((term) => haystack.includes(term)) ||
    haystack.includes("levy") ||
    haystack.includes("funding") ||
    haystack.includes("employer");
}

function isGenericAiArticle(haystack: string) {
  const hasAiSignal =
    haystack.includes(" ai ") ||
    haystack.includes("artificial intelligence") ||
    haystack.includes("automation") ||
    haystack.includes("machine learning");
  return hasAiSignal && !hasWorkforceSignal(haystack);
}

function isRelevantArticle(item: ScoredFeedItem) {
  const haystack = `${item.title} ${item.summary} ${item.source}`.toLowerCase();
  const source = FEEDS.find((feed) => feed.name === item.source);

  if ((item.rejectionReason?.startsWith("hard negative") ?? false)) {
    logNewsRelevance("rejected", item);
    return false;
  }

  if (source?.group === "ai-workforce" && !hasWorkforceSignal(haystack)) {
    logNewsRelevance("rejected", {
      ...item,
      rejectionReason: "AI/workforce source without workforce signal",
    });
    return false;
  }

  const accepted = item.score >= RELEVANCE_THRESHOLD;
  logNewsRelevance(accepted ? "accepted" : "rejected", item);

  return accepted;
}

function logNewsRelevance(status: "accepted" | "rejected", item: ScoredFeedItem) {
  if (!DEBUG_NEWS_RELEVANCE) {
    return;
  }

  console.info("MPR intelligence relevance", {
    status,
    source: item.source,
    title: item.title,
    score: item.score,
    reason: item.rejectionReason,
  });
}

function hasWorkforceSignal(haystack: string) {
  return (
    haystack.includes("workforce") ||
    haystack.includes("skills") ||
    haystack.includes("employer") ||
    haystack.includes("workplace") ||
    haystack.includes("productivity") ||
    haystack.includes("training") ||
    haystack.includes("apprentice") ||
    haystack.includes("education") ||
    haystack.includes("jobs") ||
    haystack.includes("learning") ||
    haystack.includes("hr ") ||
    haystack.includes("human resources") ||
    haystack.includes("leadership") ||
    haystack.includes("management") ||
    haystack.includes("procurement")
  );
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

function sortByScoreAndRecency(items: ScoredFeedItem[]) {
  return [...items].sort(
    (a, b) => b.score - a.score || b.timestamp - a.timestamp,
  );
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
  const remaining = items
    .slice(0, Math.max(limit * 6, 36))
    .sort((a, b) => b.timestamp - a.timestamp || b.score - a.score);

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
    canSelectSource(candidate, sourceCounts, isTopSection),
  );

  if (allowed.length === 0) {
    return null;
  }

  const nonConsecutive = allowed.filter(
    (candidate) => selected.at(-1)?.source !== candidate.source,
  );
  const pool = nonConsecutive.length > 0 ? nonConsecutive : allowed;
  const newestTimestamp = pool[0].timestamp;
  const similarRecency = pool.filter(
    (candidate) => Math.abs(newestTimestamp - candidate.timestamp) <= 86_400_000,
  );

  return similarRecency.sort((a, b) => {
    const sourceBalance = getSourceCount(a.source, sourceCounts) - getSourceCount(b.source, sourceCounts);

    if (sourceBalance !== 0) {
      return sourceBalance;
    }

    return b.timestamp - a.timestamp || b.score - a.score;
  })[0];
}

function canSelectSource(
  candidate: ScoredFeedItem,
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

function getSourceCount(source: string, sourceCounts: Map<string, number>) {
  return sourceCounts.get(source) ?? 0;
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
