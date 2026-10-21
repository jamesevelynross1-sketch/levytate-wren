/**
 * Normalise evidence from Skills England Occupational Maps.
 * The API uses OCC codes for occupations and ST codes for apprenticeship
 * products. Never assume OCC and ST codes are interchangeable; require an
 * explicit linked productCode match.
 *
 * Source: https://occupational-maps-api.skillsengland.education.gov.uk/swagger/
 */
export type OccupationalProduct = { productCode?: string | null; versionNo?: string | null; name?: string | null };
export type OccupationalItem = { detail?: string | null; dutyDetail?: string | null };
export type OccupationalRecord = {
  stdCode?: string | null;
  name?: string | null;
  statusName?: string | null;
  statusLastUpdated?: string | null;
  summary?: string | null;
  overview?: string | null;
  products?: OccupationalProduct[] | null;
  duties?: OccupationalItem[] | null;
  knowledges?: OccupationalItem[] | null;
  skills?: OccupationalItem[] | null;
  behaviours?: OccupationalItem[] | null;
};
export type OccupationalSearchPayload = {
  pagination?: { totalMatched?: number; hasMoreItems?: boolean };
  results?: OccupationalRecord[] | null;
};

export type ExploreSourceEvidence = {
  standardCode: string;
  occupationCode: string;
  occupationName: string;
  occupationStatus: string;
  occupationLastUpdated: string;
  apprenticeshipProductVersion: string;
  sourceUrl: string;
  summary: string;
  overview: string;
  duties: string[];
  knowledge: string[];
  skills: string[];
  behaviours: string[];
};

function toText(value: unknown, maxLength = 8000) {
  if (typeof value !== "string") return "";
  return value
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function strings(items: OccupationalItem[] | null | undefined, field: "detail" | "dutyDetail", limit: number) {
  return (Array.isArray(items) ? items : [])
    .map(item => toText(item?.[field], 450))
    .filter(Boolean)
    .slice(0, limit);
}

export function normaliseExploreSource(code: string, input: OccupationalSearchPayload): ExploreSourceEvidence | null {
  if (!/^ST\d{4}$/i.test(code)) return null;
  const reference = code.toUpperCase();
  if (!input || !Array.isArray(input.results)) return null;
  const match = input.results.find(occupation => (
    /^OCC\d{4}[A-Z]?$/i.test(occupation?.stdCode ?? "") &&
    (occupation.products ?? []).some(product => product.productCode?.toUpperCase() === reference)
  ));
  if (!match?.stdCode) return null;

  const product = match.products?.find(p => p.productCode?.toUpperCase() === reference);
  const duties = strings(match.duties, "dutyDetail", 32);
  const knowledge = strings(match.knowledges, "detail", 60);
  const skills = strings(match.skills, "detail", 60);
  const behaviours = strings(match.behaviours, "detail", 40);
  const summary = toText(match.summary, 9000);
  const overview = toText(match.overview, 1800);

  // An occupation title match or a thin one-line summary is not sufficient
  // factual grounding for AI-generated duties and career claims.
  if (!(summary.length >= 80 && (duties.length >= 3 || knowledge.length + skills.length + behaviours.length >= 8))) return null;
  return {
    standardCode: reference,
    occupationCode: match.stdCode.toUpperCase(),
    occupationName: toText(match.name, 220),
    occupationStatus: toText(match.statusName, 100),
    occupationLastUpdated: (match.statusLastUpdated ?? "").slice(0, 10),
    apprenticeshipProductVersion: toText(product?.versionNo, 30),
    sourceUrl: "https://skillsengland.education.gov.uk/apprenticeships/" + reference.toLowerCase(),
    summary,
    overview,
    duties,
    knowledge,
    skills,
    behaviours,
  };
}
