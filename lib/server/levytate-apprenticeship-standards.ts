import {
  getApprenticeshipStandardsImport,
  searchApprenticeshipStandardsList,
} from "@/lib/levytate/domain";
import type { ApprenticeshipStandard } from "@/lib/levytate/domain";
import { getLevyTateSupabaseConfig, supabaseSelect } from "@/lib/server/levytate-supabase";

type ApprenticeshipStandardRow = {
  id: string;
  title: string;
  reference_code: string;
  version?: string | null;
  status?: string | null;
  route?: string | null;
  occupational_route?: string | null;
  level?: number | null;
  funding_band?: number | null;
  typical_duration?: string | null;
  official_url?: string | null;
  last_updated?: string | null;
  last_verified?: string | null;
  job_titles?: unknown;
  overview?: string | null;
  programme_type?: string | null;
  integrated_degree?: string | null;
  professional_recognition?: string | null;
};

export type LevyTateStandardsResponse = {
  source: "supabase" | "fallback";
  counts: {
    totalRecords: number;
    apprenticeshipStandards: number;
    approvedForDelivery: number;
  };
  standards: ApprenticeshipStandard[];
};

export type LevyTateStandardsQuery = {
  search?: string;
  status?: string;
  programmeType?: string;
};

const standardsTable = "levytate_apprenticeship_standards";

function toOfficialUrl(referenceCode: string, officialUrl?: string | null) {
  if (officialUrl?.startsWith("http")) return officialUrl;
  return `https://skillsengland.education.gov.uk/apprenticeships/${referenceCode.toLowerCase()}`;
}

function toDateString(value?: string | null) {
  if (!value) return "";
  return value.slice(0, 10);
}

function stringArray(value: unknown) {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  }
  if (typeof value === "string") {
    return value.split(";").map((item) => item.trim()).filter(Boolean);
  }
  return [];
}

function normaliseDomainStatus(status?: string | null) {
  switch ((status ?? "").trim().toLowerCase()) {
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
      return "Live" as const;
  }
}

function rowToDomain(row: ApprenticeshipStandardRow): ApprenticeshipStandard {
  const referenceCode = row.reference_code || row.id;
  const route = row.route || row.occupational_route || "Unknown";
  const lastUpdated = toDateString(row.last_updated) || toDateString(row.last_verified) || new Date().toISOString().slice(0, 10);
  const sourceStatus = row.status || "Approved for delivery";

  return {
    id: row.id || referenceCode,
    title: row.title,
    referenceCode,
    level: Number(row.level ?? 0) || 0,
    occupationalRoute: route,
    fundingBand: typeof row.funding_band === "number" ? row.funding_band : null,
    typicalDuration: row.typical_duration || "Duration to confirm",
    status: normaliseDomainStatus(sourceStatus),
    officialUrl: toOfficialUrl(referenceCode, row.official_url),
    version: row.version || "Current",
    lastVerified: lastUpdated,
    lastSyncedAt: lastUpdated,
    programmeType: row.programme_type || "Apprenticeship standard",
    sourceStatus,
    integratedDegree: row.integrated_degree || "",
    professionalRecognition: row.professional_recognition || "",
    lastUpdated,
    jobTitles: stringArray(row.job_titles),
    overview: row.overview || "",
  };
}

export async function loadLevyTateStandards(query: LevyTateStandardsQuery = {}): Promise<LevyTateStandardsResponse> {
  const config = getLevyTateSupabaseConfig();

  if (!config) {
    return loadFallbackStandards(query);
  }

  try {
    const rows = await supabaseSelect<ApprenticeshipStandardRow>(config, standardsTable, new URLSearchParams({
      select: "id,title,reference_code,version,status,route,occupational_route,level,funding_band,typical_duration,official_url,last_updated,last_verified,job_titles,overview,programme_type,integrated_degree,professional_recognition",
      order: "title.asc",
    }));

    if (!rows.length) {
      return loadFallbackStandards(query);
    }

    const standards = rows.map(rowToDomain);
    const apprenticeshipStandards = standards.filter((standard) => standard.programmeType === "Apprenticeship standard").length;
    const approvedForDelivery = standards.filter((standard) => standard.programmeType === "Apprenticeship standard" && standard.sourceStatus === "Approved for delivery").length;

    return {
      source: "supabase",
      counts: {
        totalRecords: standards.length,
        apprenticeshipStandards,
        approvedForDelivery,
      },
      standards: searchApprenticeshipStandardsList(standards, query.search ?? "", {
        status: query.status,
        programmeType: query.programmeType,
      }),
    };
  } catch {
    return loadFallbackStandards(query);
  }
}

function loadFallbackStandards(query: LevyTateStandardsQuery = {}): LevyTateStandardsResponse {
  const fallbackImport = getApprenticeshipStandardsImport();
  const fallback = fallbackImport.standards;

  return {
    source: "fallback",
    counts: {
      totalRecords: fallbackImport.source.totalRecords ?? fallback.length,
      apprenticeshipStandards: fallbackImport.source.totalStandards ?? fallback.filter((standard) => standard.programmeType === "Apprenticeship standard").length,
      approvedForDelivery: fallbackImport.source.approvedForDelivery ?? fallbackImport.source.activeStandards ?? fallback.filter((standard) => standard.programmeType === "Apprenticeship standard" && (standard.sourceStatus === "Approved for delivery" || standard.status === "Live")).length,
    },
    standards: searchApprenticeshipStandardsList(fallback, query.search ?? "", {
      status: query.status,
      programmeType: query.programmeType,
    }),
  };
}
