import rawCatalogue from "./apprenticeship-standards.generated.json";
import type { ApprenticeshipStandard, ApprenticeshipStandardStatus } from "@/lib/levytate/domain/types";

type RawStandard = {
  id: string;
  title: string;
  referenceCode: string;
  level: number;
  occupationalRoute: string;
  fundingBand: number | null;
  typicalDuration: string;
  status: ApprenticeshipStandardStatus;
  officialUrl: string;
  version: string;
  lastVerified: string;
  programmeType?: string;
  sourceStatus?: string;
  integratedDegree?: string;
  professionalRecognition?: string;
  lastUpdated?: string;
  jobTitles?: string[];
  overview?: string;
};

type RawMetadata = {
  sourceName: string;
  sourceUrl: string;
  snapshotDate: string;
  importVersion: number;
  totalStandards: number;
  activeStandards: number;
  totalRecords?: number;
  approvedForDelivery?: number;
};

const catalogue = rawCatalogue as unknown as { metadata: RawMetadata; standards: RawStandard[] };
const verified = catalogue.metadata.snapshotDate;
const official = (referenceCode: string) => `https://skillsengland.education.gov.uk/apprenticeships/${referenceCode.toLowerCase()}`;

const historicalStandards: ApprenticeshipStandard[] = [
  {
    id: "ST0384",
    title: "Team leader or supervisor",
    referenceCode: "ST0384",
    level: 3,
    occupationalRoute: "Business and administration",
    fundingBand: 5000,
    typicalDuration: "15 months",
    status: "Defunded",
    officialUrl: official("ST0384"),
    version: "1.4",
    lastVerified: verified,
    lastSyncedAt: verified,
    programmeType: "Apprenticeship standard",
    sourceStatus: "Withdrawn",
    lastUpdated: verified,
    jobTitles: [],
    overview: "",
  },
  {
    id: "ST0385",
    title: "Operations or departmental manager",
    referenceCode: "ST0385",
    level: 5,
    occupationalRoute: "Business and administration",
    fundingBand: 7000,
    typicalDuration: "30 months",
    status: "Defunded",
    officialUrl: official("ST0385"),
    version: "Historical",
    lastVerified: verified,
    lastSyncedAt: verified,
    programmeType: "Apprenticeship standard",
    sourceStatus: "Withdrawn",
    lastUpdated: verified,
    jobTitles: [],
    overview: "",
  },
];

export const apprenticeshipStandards: ApprenticeshipStandard[] = [
  ...catalogue.standards.map((standard) => ({
    id: standard.id,
    title: standard.title,
    referenceCode: standard.referenceCode,
    level: standard.level,
    occupationalRoute: standard.occupationalRoute,
    fundingBand: standard.fundingBand,
    typicalDuration: standard.typicalDuration,
    status: standard.status,
    officialUrl: standard.officialUrl,
    version: standard.version,
    lastVerified: standard.lastVerified,
    lastSyncedAt: standard.lastUpdated ?? standard.lastVerified,
    programmeType: standard.programmeType ?? "Apprenticeship standard",
    sourceStatus: standard.sourceStatus,
    integratedDegree: standard.integratedDegree,
    professionalRecognition: standard.professionalRecognition,
    lastUpdated: standard.lastUpdated ?? standard.lastVerified,
    jobTitles: Array.isArray(standard.jobTitles) ? standard.jobTitles : [],
    overview: standard.overview ?? "",
  })),
  ...historicalStandards.filter((historical) => !catalogue.standards.some((standard) => standard.id === historical.id)),
];

export const skillsEnglandLibraryMetadata = {
  sourceName: catalogue.metadata.sourceName,
  sourceUrl: catalogue.metadata.sourceUrl,
  snapshotDate: catalogue.metadata.snapshotDate,
  importVersion: catalogue.metadata.importVersion,
  totalStandards: catalogue.metadata.totalStandards,
  activeStandards: catalogue.metadata.activeStandards,
  totalRecords: catalogue.metadata.totalRecords ?? catalogue.metadata.totalStandards,
  approvedForDelivery: catalogue.metadata.approvedForDelivery ?? catalogue.metadata.activeStandards,
} as const;
