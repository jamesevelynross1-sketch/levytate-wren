import { getLevyTateSupabaseConfig, readRuntimeEnv, supabaseSelect } from "@/lib/server/levytate-supabase";

type CapabilityRow = { organisation_id: string; off_the_job_assistant_enabled: boolean };

export function isOffTheJobAssistantEnvironmentEnabled() {
  if (process.env.VERCEL_ENV === "production") return false;
  if (process.env.NODE_ENV === "production" && process.env.VERCEL_ENV !== "preview") return false;
  return readRuntimeEnv("LEVYTATE_OFF_THE_JOB_ASSISTANT_ENABLED").toLowerCase() === "true";
}

export async function isOffTheJobAssistantEnabledForOrganisation(organisationId: string) {
  if (!isOffTheJobAssistantEnvironmentEnabled() || !organisationId) return false;
  if (process.env.NODE_ENV !== "production") {
    const localOrganisations = readRuntimeEnv("LEVYTATE_OFF_THE_JOB_ASSISTANT_LOCAL_ORGANISATIONS")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
    if (localOrganisations.includes(organisationId)) return true;
  }
  const config = getLevyTateSupabaseConfig();
  if (!config) return false;
  try {
    const rows = await supabaseSelect<CapabilityRow>(config, "levytate_organisation_capabilities", new URLSearchParams({
      select: "organisation_id,off_the_job_assistant_enabled",
      organisation_id: `eq.${organisationId}`,
      off_the_job_assistant_enabled: "eq.true",
      limit: "1",
    }));
    return rows.length === 1;
  } catch {
    // Migration 033 may not yet be present. The product must fail closed.
    return false;
  }
}
