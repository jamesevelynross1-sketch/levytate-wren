import { apprenticeshipStandards, skillsEnglandLibraryMetadata } from "@/lib/levytate/data/mvp/apprenticeship-standards";
import type { ApprenticeshipStandard } from "./types";

export type ApprenticeshipStandardsImport = {
  source: typeof skillsEnglandLibraryMetadata;
  standards: ApprenticeshipStandard[];
};

export type ApprenticeshipStandardsSearchFilters = {
  level?: string;
  route?: string;
  status?: string;
  programmeType?: string;
};

const aliases: Record<string, string> = {
  "data essentials": "ST0795",
  ict: "ST0973",
  "it support technician": "ST0973",
  "software engineer": "ST0116",
  "junior developer": "ST0128",
  "project manager degree apprenticeship": "ST0411",
  "manufacturing engineer degree apprenticeship": "ST0025",
  "procurement and supply chain practitioner": "ST0313",
  "level 3 team leader": "ST0384",
  "team leader": "ST0384",
  "level 5 operations manager": "ST0385",
  "operations manager": "ST0385",
  "operations departmental manager": "ST0385",
};

let runtimeStandards = structuredClone(apprenticeshipStandards);

function normalise(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function tokenise(value: string) {
  const normalised = normalise(value);
  return normalised ? normalised.split(" ").filter(Boolean) : [];
}

function sourceStatusToDomainStatus(sourceStatus?: string) {
  switch ((sourceStatus ?? "").trim().toLowerCase()) {
    case "approved for delivery":
      return "Live" as const;
    case "approved for delivery - paused":
    case "approved for delivery paused":
      return "Paused" as const;
    case "withdrawn":
      return "Defunded" as const;
    case "retired":
      return "Retired" as const;
    case "proposal in development":
      return "Proposed" as const;
    case "in development":
      return "In development" as const;
    default:
      return undefined;
  }
}

function isApprovedSourceStatus(sourceStatus?: string) {
  return (sourceStatus ?? "").trim().toLowerCase() === "approved for delivery";
}

function isLiveStandard(standard: ApprenticeshipStandard) {
  if (standard.programmeType && standard.sourceStatus) {
    return standard.programmeType === "Apprenticeship standard" && isApprovedSourceStatus(standard.sourceStatus);
  }
  return standard.status === "Live";
}

function isSelectableStandard(standard: ApprenticeshipStandard) {
  if (standard.programmeType && standard.sourceStatus) {
    return standard.programmeType === "Apprenticeship standard" && isApprovedSourceStatus(standard.sourceStatus);
  }
  return standard.status === "Live" || standard.status === "Paused";
}

function searchableParts(standard: ApprenticeshipStandard) {
  return {
    title: normalise(standard.title),
    referenceCode: normalise(standard.referenceCode),
    route: normalise(standard.occupationalRoute),
    programmeType: normalise(standard.programmeType ?? ""),
    overview: normalise(standard.overview ?? ""),
    jobTitles: (standard.jobTitles ?? []).map(normalise).filter(Boolean),
  };
}

function searchableHaystack(standard: ApprenticeshipStandard) {
  const parts = searchableParts(standard);
  return [
    parts.title,
    parts.referenceCode,
    `level ${standard.level}`,
    parts.route,
    parts.programmeType,
    parts.jobTitles.join(" "),
    parts.overview,
  ]
    .filter(Boolean)
    .join(" ")
    .trim();
}

function hasPrefixWordMatch(value: string, queryTokens: string[]) {
  if (!value || !queryTokens.length) return false;
  const words = value.split(" ").filter(Boolean);
  return queryTokens.every((token) => words.some((word) => word.startsWith(token)));
}

function scoreStandard(standard: ApprenticeshipStandard, query: string) {
  const search = normalise(query);
  if (!search) return 0;

  const queryTokens = tokenise(search);
  const parts = searchableParts(standard);
  const haystack = searchableHaystack(standard);
  let score = 0;

  if (parts.title === search) score += 1200;
  else if (parts.title.startsWith(search)) score += 950;
  else if (hasPrefixWordMatch(parts.title, queryTokens)) score += 900;
  else if (parts.title.includes(search)) score += 700;

  if (parts.referenceCode === search) score += 900;
  else if (parts.referenceCode.startsWith(search)) score += 650;
  else if (parts.referenceCode.includes(search)) score += 450;

  for (const jobTitle of parts.jobTitles) {
    if (jobTitle === search) {
      score += 840;
      break;
    }
    if (jobTitle.startsWith(search)) {
      score += 720;
      break;
    }
  }

  if (score === 0 && hasPrefixWordMatch(parts.jobTitles.join(" "), queryTokens)) {
    score += 560;
  }

  if (parts.route.startsWith(search)) score += 320;
  if (parts.programmeType.startsWith(search)) score += 180;

  for (const token of queryTokens) {
    if (parts.title.split(" ").some((word) => word.startsWith(token))) score += 90;
    if (parts.jobTitles.some((jobTitle) => jobTitle.split(" ").some((word) => word.startsWith(token)))) score += 65;
    if (parts.referenceCode.includes(token)) score += 40;
    if (parts.route.split(" ").some((word) => word.startsWith(token))) score += 24;
    if (parts.overview.includes(token)) score += 12;
  }

  if (haystack.includes(search)) score += 180;
  if (queryTokens.every((token) => haystack.includes(token))) score += 120;

  return score;
}

function matchesFilters(standard: ApprenticeshipStandard, filters?: ApprenticeshipStandardsSearchFilters) {
  const requestedStatus = filters?.status?.trim().toLowerCase();
  const requestedProgrammeType = filters?.programmeType?.trim().toLowerCase();
  const standardSourceStatus = (standard.sourceStatus ?? "").trim().toLowerCase();
  const standardDomainStatus = standard.status.trim().toLowerCase();
  const standardProgrammeType = (standard.programmeType ?? "").trim().toLowerCase();

  const statusMatches = !requestedStatus || requestedStatus === "all"
    || requestedStatus === standardDomainStatus
    || requestedStatus === standardSourceStatus
    || (requestedStatus === "live" && isApprovedSourceStatus(standard.sourceStatus));

  const programmeTypeMatches = !requestedProgrammeType
    || requestedProgrammeType === "all"
    || standardProgrammeType === requestedProgrammeType;

  return (!filters?.level || filters.level === "All" || String(standard.level) === filters.level)
    && (!filters?.route || filters.route === "All" || standard.occupationalRoute === filters.route)
    && statusMatches
    && programmeTypeMatches;
}

function sortAlphabetically(standards: ApprenticeshipStandard[]) {
  return [...standards].sort((left, right) => left.title.localeCompare(right.title, undefined, { sensitivity: "base" }));
}

export function hydrateApprenticeshipStandards(standards: ApprenticeshipStandard[]) {
  runtimeStandards = standards.map((standard) => ({
    ...standard,
    status: sourceStatusToDomainStatus(standard.sourceStatus) ?? standard.status,
  }));
}

export function resetApprenticeshipStandards() {
  runtimeStandards = structuredClone(apprenticeshipStandards);
}

export function getApprenticeshipStandardsImport(): ApprenticeshipStandardsImport {
  return {
    source: skillsEnglandLibraryMetadata,
    standards: structuredClone(runtimeStandards),
  };
}

export function getApprenticeshipStandard(id: string) {
  return runtimeStandards.find((standard) => standard.id === id);
}

export function getLiveApprenticeshipStandards() {
  return runtimeStandards.filter(isLiveStandard);
}

export function getSelectableApprenticeshipStandards() {
  return runtimeStandards.filter(isSelectableStandard);
}

export function searchApprenticeshipStandardsList(
  standards: ApprenticeshipStandard[],
  query: string,
  filters?: ApprenticeshipStandardsSearchFilters,
) {
  const filtered = standards.filter((standard) => matchesFilters(standard, filters));
  const search = normalise(query);

  if (!search) {
    return sortAlphabetically(filtered);
  }

  return filtered
    .map((standard) => ({ standard, score: scoreStandard(standard, search) }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score || left.standard.title.localeCompare(right.standard.title, undefined, { sensitivity: "base" }))
    .map((entry) => entry.standard);
}

export function searchApprenticeshipStandards(query: string, filters?: ApprenticeshipStandardsSearchFilters) {
  return searchApprenticeshipStandardsList(runtimeStandards, query, filters);
}

export function resolveApprenticeshipStandardId(value: string) {
  const search = normalise(value);
  if (!search) return undefined;
  const alias = aliases[search];
  if (alias) return alias;
  return searchApprenticeshipStandards(search).find((standard) => {
    const title = normalise(standard.title);
    return normalise(standard.id) === search || title === search || search.includes(title) || title.includes(search);
  })?.id;
}

export function isAvailableForNewStarts(standardId: string) {
  const standard = getApprenticeshipStandard(standardId);
  return standard ? isSelectableStandard(standard) : false;
}

export function formatFundingBand(standard: ApprenticeshipStandard) {
  return standard.fundingBand === null ? "Check official record" : new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(standard.fundingBand);
}
