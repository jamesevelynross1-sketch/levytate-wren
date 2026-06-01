export const intelligenceSegments = [
  {
    label: "All MPR Intelligence",
    value: "all",
  },
  {
    label: "AI, Data & Automation",
    value: "ai",
  },
  {
    label: "Apprenticeships & Levy",
    value: "apprenticeships",
  },
  {
    label: "Workforce & Skills Strategy",
    value: "workforce",
  },
  {
    label: "Procurement & Supply Chain",
    value: "procurement",
  },
  {
    label: "Public Sector / Education",
    value: "public_sector",
  },
  {
    label: "Leadership & Future of Work",
    value: "leadership",
  },
] as const;

export type IntelligenceSegment = (typeof intelligenceSegments)[number]["value"];

export const defaultSegments: IntelligenceSegment[] = ["all"];

const segmentValues = new Set<IntelligenceSegment>(
  intelligenceSegments.map((segment) => segment.value),
);

export function normaliseSegments(value: unknown): IntelligenceSegment[] {
  const rawSegments = Array.isArray(value) ? value : [];
  const segments = rawSegments.filter(
    (segment): segment is IntelligenceSegment =>
      typeof segment === "string" && segmentValues.has(segment as IntelligenceSegment),
  );
  const uniqueSegments = Array.from(new Set(segments));

  if (uniqueSegments.length === 0 || uniqueSegments.includes("all")) {
    return defaultSegments;
  }

  return uniqueSegments.filter((segment) => segment !== "all");
}

export function getSegmentLabel(value: string) {
  return intelligenceSegments.find((segment) => segment.value === value)?.label ?? value;
}

export function isIntelligenceSegment(value: string): value is IntelligenceSegment {
  return segmentValues.has(value as IntelligenceSegment);
}

export function articleMatchesSegment(
  article: {
    title: string;
    summary: string;
    category: string;
    source: string;
  },
  segment: IntelligenceSegment,
) {
  if (segment === "all") {
    return true;
  }

  const haystack = `${article.title} ${article.summary} ${article.category} ${article.source}`.toLowerCase();

  switch (segment) {
    case "ai":
      return containsAny(haystack, [
        "ai",
        "artificial intelligence",
        "automation",
        "data",
        "digital",
        "analytics",
        "machine learning",
        "copilot",
        "technology",
      ]);
    case "apprenticeships":
      return containsAny(haystack, [
        "apprenticeship",
        "apprenticeships",
        "levy",
        "funding",
        "provider",
        "training provider",
        "skills england",
        "dfe",
      ]);
    case "workforce":
      return containsAny(haystack, [
        "workforce",
        "skills",
        "capability",
        "reskilling",
        "upskilling",
        "productivity",
        "talent",
        "learning and development",
      ]);
    case "procurement":
      return containsAny(haystack, [
        "procurement",
        "supply chain",
        "commercial",
        "supplier",
        "contract",
        "purchasing",
      ]);
    case "public_sector":
      return containsAny(haystack, [
        "public sector",
        "education",
        "school",
        "college",
        "local authority",
        "government",
        "ofsted",
      ]);
    case "leadership":
      return containsAny(haystack, [
        "leadership",
        "management",
        "future of work",
        "manager",
        "people strategy",
        "organisation design",
        "organizational design",
        "change",
      ]);
  }
}

function containsAny(value: string, terms: string[]) {
  return terms.some((term) => value.includes(term));
}
