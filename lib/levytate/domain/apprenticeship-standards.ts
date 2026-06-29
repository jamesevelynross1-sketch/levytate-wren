import { apprenticeshipStandards, skillsEnglandLibraryMetadata } from "@/lib/levytate/data/mvp/apprenticeship-standards";
import type { ApprenticeshipStandard } from "./types";

export type ApprenticeshipStandardsImport = {
  source: typeof skillsEnglandLibraryMetadata;
  standards: ApprenticeshipStandard[];
};

const aliases: Record<string, string> = {
  "data essentials": "ST0795",
  "ict": "ST0973",
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

function normalise(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function getApprenticeshipStandardsImport(): ApprenticeshipStandardsImport {
  return {
    source: skillsEnglandLibraryMetadata,
    standards: structuredClone(apprenticeshipStandards),
  };
}

export function getApprenticeshipStandard(id: string) {
  return apprenticeshipStandards.find((standard) => standard.id === id);
}

export function getLiveApprenticeshipStandards() {
  return apprenticeshipStandards.filter((standard) => standard.status === "Live");
}

export function searchApprenticeshipStandards(query: string, filters?: { level?: string; route?: string; status?: string }) {
  const search = normalise(query);
  return apprenticeshipStandards.filter((standard) => {
    const haystack = normalise(`${standard.title} ${standard.referenceCode} level ${standard.level} ${standard.occupationalRoute}`);
    return (!search || haystack.includes(search))
      && (!filters?.level || filters.level === "All" || String(standard.level) === filters.level)
      && (!filters?.route || filters.route === "All" || standard.occupationalRoute === filters.route)
      && (!filters?.status || filters.status === "All" || standard.status === filters.status);
  });
}

export function resolveApprenticeshipStandardId(value: string) {
  const search = normalise(value);
  if (!search) return undefined;
  const alias = aliases[search];
  if (alias) return alias;
  return apprenticeshipStandards.find((standard) => {
    const title = normalise(standard.title);
    return normalise(standard.id) === search || title === search || search.includes(title) || title.includes(search);
  })?.id;
}

export function isAvailableForNewStarts(standardId: string) {
  return getApprenticeshipStandard(standardId)?.status === "Live";
}

export function formatFundingBand(standard: ApprenticeshipStandard) {
  return standard.fundingBand === null ? "Check official record" : new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(standard.fundingBand);
}