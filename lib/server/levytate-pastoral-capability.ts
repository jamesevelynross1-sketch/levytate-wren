import type { MvpUserRole } from "@/lib/levytate/mvp/rbac";
import { isPastoralEncryptionConfigured } from "@/lib/server/levytate-pastoral-crypto";
import { getLevyTateSupabaseConfig, readRuntimeEnv, supabaseSelect } from "@/lib/server/levytate-supabase";

type CapabilityRow = { organisation_id: string; pastoral_support_enabled: boolean };
type EmployeeRow = { id: string };
type EligibilityRow = { id: string };
type RecipientRow = { id: string };

export type PastoralNavigationAccess = {
  organisationEnabled: boolean;
  employeeAccess: boolean;
  supportInboxAccess: boolean;
};

export function isPastoralSupportEnvironmentEnabled() {
  if (process.env.VERCEL_ENV === "production") return false;
  if (process.env.NODE_ENV === "production" && process.env.VERCEL_ENV !== "preview") return false;
  if (readRuntimeEnv("LEVYTATE_PASTORAL_SUPPORT_ENABLED").toLowerCase() !== "true") return false;
  if (!isPastoralEncryptionConfigured()) return false;
  return readRuntimeEnv("LEVYTATE_PASTORAL_SUPPORT_RATE_LIMIT_SECRET").length >= 32;
}

export async function isPastoralSupportEnabledForOrganisation(organisationId: string) {
  if (!isPastoralSupportEnvironmentEnabled() || !organisationId) return false;
  const config = getLevyTateSupabaseConfig();
  if (!config) return false;
  try {
    const rows = await supabaseSelect<CapabilityRow>(config, "levytate_organisation_capabilities", new URLSearchParams({
      select: "organisation_id,pastoral_support_enabled",
      organisation_id: `eq.${organisationId}`,
      pastoral_support_enabled: "eq.true",
      limit: "1",
    }));
    if (rows.length!==1) return false;
    // The excluded human-follow-up migration must never be silently assumed.
    // These zero-row schema probes read no content and do not activate anything.
    await Promise.all([
      supabaseSelect(config,"levytate_pastoral_preferences",new URLSearchParams({select:"id,lock_version",organisation_id:`eq.${organisationId}`,limit:"0"})),
      supabaseSelect(config,"levytate_pastoral_conversations",new URLSearchParams({select:"id,last_sequence_number",organisation_id:`eq.${organisationId}`,limit:"0"})),
      supabaseSelect(config,"levytate_pastoral_support_requests",new URLSearchParams({select:"id,agreed_follow_up_at,administratively_closed_at,employee_resolution_status,employee_responded_at,employee_confirmed_resolved_at",organisation_id:`eq.${organisationId}`,limit:"0"})),
      supabaseSelect(config,"levytate_pastoral_support_actions",new URLSearchParams({select:"id,support_request_id,responsible_recipient_id,lock_version",organisation_id:`eq.${organisationId}`,limit:"0"})),
      supabaseSelect(config,"levytate_pastoral_support_action_events",new URLSearchParams({select:"id,support_action_id,event_type",organisation_id:`eq.${organisationId}`,limit:"0"})),
    ]);
    return true;
  } catch {
    return false;
  }
}

export async function getPastoralNavigationAccess(input: {
  organisationId: string;
  userId: string;
  email: string;
  role: MvpUserRole;
}): Promise<PastoralNavigationAccess> {
  const organisationEnabled = await isPastoralSupportEnabledForOrganisation(input.organisationId);
  if (!organisationEnabled || input.role === "Platform Admin") {
    return { organisationEnabled, employeeAccess: false, supportInboxAccess: false };
  }
  const config = getLevyTateSupabaseConfig();
  if (!config) return { organisationEnabled: false, employeeAccess: false, supportInboxAccess: false };

  if (input.role === "Employee") {
    const employees = await supabaseSelect<EmployeeRow>(config, "levytate_employees", new URLSearchParams({
      select: "id",
      organisation_id: `eq.${input.organisationId}`,
      email: `eq.${input.email.trim().toLowerCase()}`,
      status: "eq.Active",
      limit: "1",
    }));
    const employee = employees[0];
    if (!employee) return { organisationEnabled, employeeAccess: false, supportInboxAccess: false };
    const [eligibility, recipients] = await Promise.all([
      supabaseSelect<EligibilityRow>(config, "levytate_pastoral_access_eligibility", new URLSearchParams({
        select: "id",
        organisation_id: `eq.${input.organisationId}`,
        employee_id: `eq.${employee.id}`,
        owner_user_id: `eq.${input.userId}`,
        active: "eq.true",
        age_assurance_status: "eq.adult",
        or: `(expires_at.is.null,expires_at.gt.${new Date().toISOString()})`,
        limit: "1",
      })),
      supabaseSelect<RecipientRow>(config, "levytate_pastoral_support_recipients", new URLSearchParams({
        select: "id",
        organisation_id: `eq.${input.organisationId}`,
        active: "eq.true",
        limit: "1",
      })),
    ]);
    return { organisationEnabled, employeeAccess: eligibility.length === 1 && recipients.length === 1, supportInboxAccess: false };
  }

  const recipients = await supabaseSelect<RecipientRow>(config, "levytate_pastoral_support_recipients", new URLSearchParams({
    select: "id",
    organisation_id: `eq.${input.organisationId}`,
    employer_user_id: `eq.${input.userId}`,
    active: "eq.true",
    limit: "1",
  }));
  return { organisationEnabled, employeeAccess: false, supportInboxAccess: recipients.length === 1 };
}
