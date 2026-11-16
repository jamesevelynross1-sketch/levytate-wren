import { normaliseBetaEmail } from "@/lib/levytate/config/beta-access";
import { parseMvpUserRole, type MvpUserRole } from "@/lib/levytate/mvp/rbac";
import { getLevyTateSupabaseConfig, supabaseSelect } from "@/lib/server/levytate-supabase";

export type IdentityMembership = {
  id: string;
  organisation_id: string;
  email: string;
  role: string;
  active: boolean;
};

export type IdentityPerson = {
  id: string;
  organisation_id: string;
  email: string;
  status: string;
  platform_role: string;
};

/** Pure, shared policy: People never confers an authenticated role. */
export function resolveIdentityPerson(membership: IdentityMembership, people: IdentityPerson[]) {
  const role = parseMvpUserRole(membership.role);
  if (!role || !membership.active) return { allowed: false, employeeId: null } as const;
  if (role !== "Employee" && role !== "Line Manager") return { allowed: true, employeeId: null } as const;
  const matches = people.filter((person) => person.organisation_id === membership.organisation_id
    && person.status === "Active"
    && normaliseBetaEmail(person.email) === normaliseBetaEmail(membership.email));
  if (matches.length !== 1 || matches[0].platform_role !== role) return { allowed: false, employeeId: null } as const;
  return { allowed: true, employeeId: matches[0].id } as const;
}

/** Re-evaluated on every session request, so suspension and hierarchy revocation are immediate. */
export async function validateIdentityMembership(membership: IdentityMembership): Promise<{ role: MvpUserRole; employeeId: string | null } | null> {
  const role = parseMvpUserRole(membership.role);
  const config = getLevyTateSupabaseConfig();
  if (!config || !role || !membership.active) return null;
  const organisations = await supabaseSelect<{ id: string; status: string }>(config, "levytate_organisations", new URLSearchParams({
    select: "id,status", id: `eq.${membership.organisation_id}`, limit: "2",
  }));
  if (organisations.length !== 1 || organisations[0].status !== "Active") return null;
  const people = role === "Employee" || role === "Line Manager"
    ? await supabaseSelect<IdentityPerson>(config, "levytate_employees", new URLSearchParams({
      select: "id,organisation_id,email,status,platform_role", organisation_id: `eq.${membership.organisation_id}`,
      email: `eq.${normaliseBetaEmail(membership.email)}`, status: "eq.Active", limit: "2",
    })) : [];
  const person = resolveIdentityPerson(membership, people);
  return person.allowed ? { role, employeeId: person.employeeId } : null;
}
