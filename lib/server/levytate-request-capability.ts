import { getLevyTateSupabaseConfig, readRuntimeEnv, supabaseSelect } from "@/lib/server/levytate-supabase";

type OrganisationCapabilityRow = {
  organisation_id: string;
  requests_enabled: boolean;
};

export const requestsCapabilityTable = "levytate_organisation_capabilities";

export function isRequestsEnvironmentEnabled() {
  if (process.env.VERCEL_ENV === "production") return false;
  if (process.env.NODE_ENV === "production" && process.env.VERCEL_ENV !== "preview") return false;
  return readRuntimeEnv("LEVYTATE_REQUESTS_ENABLED").toLowerCase() === "true";
}

export async function isRequestsEnabledForOrganisation(organisationId: string) {
  if (!isRequestsEnvironmentEnabled() || !organisationId) return false;

  if (process.env.NODE_ENV !== "production") {
    const localAllowList = new Set(
      readRuntimeEnv("LEVYTATE_REQUESTS_LOCAL_ORGANISATIONS")
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean),
    );
    if (localAllowList.has(organisationId)) return true;
  }

  const config = getLevyTateSupabaseConfig();
  if (!config) return false;

  try {
    const rows = await supabaseSelect<OrganisationCapabilityRow>(
      config,
      requestsCapabilityTable,
      new URLSearchParams({
        select: "organisation_id,requests_enabled",
        organisation_id: `eq.${organisationId}`,
        requests_enabled: "eq.true",
        limit: "1",
      }),
    );
    return rows.length === 1;
  } catch {
    // Migration 028 is intentionally not live during the build stage. A missing
    // capability table must leave the feature closed without affecting Client V1.
    return false;
  }
}
