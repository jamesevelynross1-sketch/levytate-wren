import { getLevyTateSupabaseConfig, readRuntimeEnv, supabaseSelect } from "@/lib/server/levytate-supabase";

type CapabilityRow = { organisation_id: string; lift_enabled: boolean };

export function isLiftEnvironmentEnabled() {
  if (readRuntimeEnv("LEVYTATE_LIFT_ENABLED") !== "true") return false;
  const scope = readRuntimeEnv("LEVYTATE_LIFT_RUNTIME_SCOPE");
  if (scope === "local") return process.env.NODE_ENV === "development" && !process.env.VERCEL_ENV;
  if (scope !== "preview" || process.env.VERCEL_ENV !== "preview") return false;
  return readRuntimeEnv("LEVYTATE_LIFT_ALLOWED_BRANCH") === "feature/operational-rbac"
    && process.env.VERCEL_GIT_COMMIT_REF === "feature/operational-rbac";
}

export async function isLiftEnabledForOrganisation(organisationId: string) {
  if (!isLiftEnvironmentEnabled()) return false;
  if (readRuntimeEnv("LEVYTATE_LIFT_ALLOWED_ORGANISATION_ID") !== organisationId) return false;
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
