import { apprenticeshipStandards, skillsEnglandLibraryMetadata } from "@/lib/levytate/data/mvp/apprenticeship-standards";
import type { ApprenticeshipStandard } from "./types";

export type ApprenticeshipStandardsImport = {
  source: typeof skillsEnglandLibraryMetadata;
  standards: ApprenticeshipStandard[];
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

function searchableHaystack(standard: ApprenticeshipStandard) {
  return normalise([
    standard.title,
    standard.referenceCode,
    `level ${standard.level}`,
    standard.occupationalRoute,
    standard.programmeType ?? "",
    standard.jobTitles?.join(" ") ?? "",
    standard.overview ?? "",
  ].join(" "));
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

export function searchApprenticeshipStandards(query: string, filters?: { level?: string; route?: string; status?: string }) {
  const search = normalise(query);
  return runtimeStandards.filter((standard) => {
    const requestedStatus = filters?.status?.trim().toLowerCase();
    const standardSourceStatus = (standard.sourceStatus ?? "").trim().toLowerCase();
    const standardDomainStatus = standard.status.trim().toLowerCase();

    const statusMatches = !requestedStatus || requestedStatus === "all"
      || requestedStatus === standardDomainStatus
      || requestedStatus === standardSourceStatus
      || (requestedStatus === "live" && isApprovedSourceStatus(standard.sourceStatus));

    return (!search || searchableHaystack(standard).includes(search))
      && (!filters?.level || filters.level === "All" || String(standard.level) === filters.level)
      && (!filters?.route || filters.route === "All" || standard.occupationalRoute === filters.route)
      && statusMatches;
  });
}

export function resolveApprenticeshipStandardId(value: string) {
  const search = normalise(value);
  if (!search) return undefined;
  const alias = aliases[search];
  if (alias) return alias;
  return runtimeStandards.find((standard) => {
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
