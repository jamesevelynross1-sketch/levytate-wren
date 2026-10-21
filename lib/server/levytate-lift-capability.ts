import { getLevyTateSupabaseConfig, readRuntimeEnv, supabaseSelect } from "@/lib/server/levytate-supabase";

type CapabilityRow = { organisation_id: string; lift_enabled: boolean };

export function isLiftEnvironmentEnabled() {
  return readRuntimeEnv("LEVYTATE_LIFT_ENABLED") === "true" && process.env.VERCEL_ENV !== "production";
}

export async function isLiftEnabledForOrganisation(organisationId: string) {
  if (!isLiftEnvironmentEnabled()) return false;
  const config = getLevyTateSupabaseConfig();
  if (!config) return false;
  try {
    const rows = await supabaseSelect<CapabilityRow>(config, "levytate_organisation_capabilities", new URLSearchParams({
      select: "organisation_id,lift_enabled",
      organisation_id: `eq.${organisationId}`,
      lift_enabled: "eq.true",
      limit: "1",
    }));
    return rows.length === 1;
  } catch {
    return false;
  }
}
