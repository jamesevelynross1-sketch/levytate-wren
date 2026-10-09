import { getLevyTateSupabaseConfig, readRuntimeEnv, supabaseSelect } from "@/lib/server/levytate-supabase";

type CapabilityRow = { organisation_id: string; application_workflows_enabled: boolean };

export function isApplicationWorkflowsEnvironmentEnabled() {
  if (process.env.VERCEL_ENV === "production") return false;
  if (process.env.NODE_ENV === "production" && process.env.VERCEL_ENV !== "preview") return false;
  return readRuntimeEnv("LEVYTATE_APPLICATION_WORKFLOWS_ENABLED").toLowerCase() === "true";
}

export async function isApplicationWorkflowsEnabledForOrganisation(organisationId: string) {
  if (!isApplicationWorkflowsEnvironmentEnabled() || !organisationId) return false;
  if (process.env.NODE_ENV !== "production") {
    const local = readRuntimeEnv("LEVYTATE_APPLICATION_WORKFLOWS_LOCAL_ORGANISATIONS").split(",").map((value) => value.trim()).filter(Boolean);
    if (local.includes(organisationId)) return true;
  }
  const config = getLevyTateSupabaseConfig();
  if (!config) return false;
  try {
    const rows = await supabaseSelect<CapabilityRow>(config, "levytate_organisation_capabilities", new URLSearchParams({
      select: "organisation_id,application_workflows_enabled",
      organisation_id: `eq.${organisationId}`,
      application_workflows_enabled: "eq.true",
      limit: "1",
    }));
    return rows.length === 1;
  } catch {
    // Migration 032 may not yet be applied. Fail closed without affecting Client V1.
    return false;
  }
}
