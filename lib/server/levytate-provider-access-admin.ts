import { randomUUID } from "node:crypto";
import type { LevyTateBetaSession } from "@/lib/levytate/config/beta-access";
import { normaliseBetaEmail } from "@/lib/levytate/config/beta-access";
import { normaliseMvpUserRole } from "@/lib/levytate/mvp/rbac";
import { providerMembershipRoles, type ProviderMembershipRole } from "@/lib/levytate/requests/domain";
import { getLearnerLifecycleServerContext } from "@/lib/server/levytate-learner-lifecycle";
import { isRequestsEnvironmentEnabled } from "@/lib/server/levytate-request-capability";
import { hasCurrentPlatformDiagnosticBinding } from "@/lib/server/levytate-service-health";
import {
  getLevyTateSupabaseConfig,
  LevyTateSupabaseError,
  supabaseFetchJson,
  supabaseSelect,
} from "@/lib/server/levytate-supabase";

const canonicalCatalogueSlug = "levytate-internal";
const organisationsTable = "levytate_organisations";
const providersTable = "levytate_providers";
const providerMembershipsTable = "levytate_provider_memberships";

type CanonicalOrganisationRow = {
  id: string;
};

type CanonicalProviderRow = {
  provider_id: string;
  provider_name: string;
  status: string;
};

type ProviderMembershipRow = {
  id: string;
  provider_id: string;
  email: string;
  display_name: string;
  auth_subject: string | null;
  auth_binding_status: string;
  auth_bound_at: string | null;
  last_login_at: string | null;
  role: string;
  active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

type SupabaseAuthUser = {
  id: string;
  email?: string;
};

type PlatformAdminContext = Awaited<ReturnType<typeof getLearnerLifecycleServerContext>>;

export type ProviderAccessMembershipSummary = {
  id: string;
  providerId: string;
  email: string;
  displayName: string;
  role: ProviderMembershipRole;
  active: boolean;
  authBindingStatus: "pending" | "bound";
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ProviderAccessProviderSummary = {
  providerId: string;
  providerName: string;
  status: string;
  memberships: ProviderAccessMembershipSummary[];
};

export class LevyTateProviderAccessAdminError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
    this.name = "LevyTateProviderAccessAdminError";
  }
}

export async function listProviderAccessForAdmin(session: LevyTateBetaSession) {
  const { canonicalOrganisation } = await requireProviderAccessAdmin(session);
  const [providers, memberships] = await Promise.all([
    supabaseSelect<CanonicalProviderRow>(
      config(),
      providersTable,
      new URLSearchParams({
        select: "provider_id,provider_name,status",
        organisation_id: `eq.${canonicalOrganisation.id}`,
        order: "provider_name.asc",
      }),
    ),
    supabaseSelect<ProviderMembershipRow>(
      config(),
      providerMembershipsTable,
      new URLSearchParams({
        select: providerMembershipSelect,
        order: "created_at.asc",
      }),
    ),
  ]);

  const summaries = providers.map<ProviderAccessProviderSummary>((provider) => ({
    providerId: provider.provider_id,
    providerName: provider.provider_name,
    status: provider.status,
    memberships: memberships
      .filter((membership) => membership.provider_id === provider.provider_id)
      .map(toMembershipSummary),
  }));
  const canonicalProviderIds = new Set(providers.map((provider) => provider.provider_id));
  for (const providerId of new Set(memberships.map((membership) => membership.provider_id))) {
    if (canonicalProviderIds.has(providerId)) continue;
    summaries.push({
      providerId,
      providerName: "Unavailable catalogue provider",
      status: "Unavailable",
      memberships: memberships
        .filter((membership) => membership.provider_id === providerId)
        .map(toMembershipSummary),
    });
  }
  return summaries;
}

export async function provisionProviderAccess(
  session: LevyTateBetaSession,
  input: { providerId?: unknown; email?: unknown; displayName?: unknown; role?: unknown },
) {
  const { actor, canonicalOrganisation } = await requireProviderAccessAdmin(session);
  const providerId = requiredText(input.providerId, "Provider", 160);
  const provider = await requireActiveCanonicalProvider(canonicalOrganisation.id, providerId);
  const email = validEmail(input.email);
  const displayName = requiredText(input.displayName, "Display name", 160);
  const role = providerRole(input.role, "Provider User");
  const existing = await findMembershipsByEmail(email);
  if (existing.length) {
    throw new LevyTateProviderAccessAdminError(
      existing[0].active
        ? "This email already has active provider access."
        : "This email already has inactive provider access. Reactivate the existing membership instead.",
      409,
    );
  }

  const timestamp = new Date().toISOString();
  const row: ProviderMembershipRow = {
    id: randomUUID(),
    provider_id: provider.provider_id,
    email,
    display_name: displayName,
    auth_subject: null,
    auth_binding_status: "pending",
    auth_bound_at: null,
    last_login_at: null,
    role,
    active: true,
    created_by: actor.user.id,
    created_at: timestamp,
    updated_at: timestamp,
  };
  try {
    await ensureAuthUser(email);
    const saved = await mutateProviderMembership(
      "provision",
      row,
      null,
      providerAccessAudit(
        actor,
        row.id,
        "provider_access.provisioned",
        `Provider access provisioned for ${provider.provider_name} as ${role}.`,
        { providerId: provider.provider_id, role, active: true },
      ),
    );
    return toMembershipSummary(saved);
  } catch (error) {
    if (error instanceof LevyTateProviderAccessAdminError) throw error;
    throw new LevyTateProviderAccessAdminError("Provider access could not be provisioned safely.", 503);
  }
}

export async function updateProviderAccess(
  session: LevyTateBetaSession,
  input: { membershipId?: unknown; operation?: unknown; role?: unknown; displayName?: unknown },
) {
  const { actor, canonicalOrganisation } = await requireProviderAccessAdmin(session);
  const membershipId = requiredText(input.membershipId, "Provider membership", 80);
  const operation = providerAccessOperation(input.operation);
  const current = await findMembershipById(membershipId);
  if (!current) throw new LevyTateProviderAccessAdminError("The provider membership was not found.", 404);
  const provider = await findCanonicalProvider(canonicalOrganisation.id, current.provider_id);
  if (operation !== "revoke" && provider?.status !== "Active") {
    throw new LevyTateProviderAccessAdminError("Only access for an active canonical provider can be updated or reactivated.", 409);
  }

  const role = operation === "update"
    ? providerRole(input.role, normaliseProviderRole(current.role))
    : normaliseProviderRole(current.role);
  const displayName = operation === "update" && input.displayName !== undefined
    ? requiredText(input.displayName, "Display name", 160)
    : current.display_name;
  const active = operation === "revoke" ? false : operation === "reactivate" ? true : current.active;
  if (operation === "revoke" && !current.active) return toMembershipSummary(current);
  if (operation === "reactivate" && current.active) return toMembershipSummary(current);

  const patch: Partial<ProviderMembershipRow> = {
    role,
    display_name: displayName,
    active,
    updated_at: new Date().toISOString(),
  };
  if (operation === "reactivate") {
    await ensureAuthUser(current.email);
    // Reactivation is a new access grant. Reset the binding so any session
    // issued before revocation remains invalid until a fresh magic link binds it.
    patch.auth_subject = null;
    patch.auth_binding_status = "pending";
    patch.auth_bound_at = null;
  }
  try {
    const action = operation === "revoke"
      ? "provider_access.revoked"
      : operation === "reactivate"
        ? "provider_access.reactivated"
        : "provider_access.updated";
    const updated = await mutateProviderMembership(
      operation,
      { ...current, ...patch },
      current.updated_at,
      providerAccessAudit(
        actor,
        current.id,
        action,
        `Provider access for ${provider?.provider_name ?? "an unavailable catalogue provider"} was ${operation === "update" ? "updated" : operation === "revoke" ? "revoked" : "reactivated"}.`,
        { providerId: current.provider_id, role, active },
      ),
    );
    return toMembershipSummary(updated);
  } catch (error) {
    if (error instanceof LevyTateProviderAccessAdminError) throw error;
    throw new LevyTateProviderAccessAdminError("Provider access could not be updated safely.", 503);
  }
}

async function requireProviderAccessAdmin(session: LevyTateBetaSession) {
  if (
    !isRequestsEnvironmentEnabled()
    || process.env.VERCEL_ENV === "production"
    || (process.env.VERCEL_ENV !== "preview" && process.env.NODE_ENV === "production")
  ) {
    throw new LevyTateProviderAccessAdminError("Provider access administration is unavailable.", 404);
  }
  if (
    session.accessLevel !== "beta_admin"
    || session.authMode !== "supabase_email"
    || !session.authSubject
    || !(await hasCurrentPlatformDiagnosticBinding(session))
  ) {
    throw new LevyTateProviderAccessAdminError("Only an authenticated LevyTate Platform Admin can manage provider access.", 403);
  }

  const [actor, canonicalOrganisation] = await Promise.all([
    getLearnerLifecycleServerContext(session),
    findCanonicalOrganisation(),
  ]);
  if (
    normaliseMvpUserRole(actor.user.role) !== "Platform Admin"
    || actor.organisation.id !== canonicalOrganisation.id
  ) {
    throw new LevyTateProviderAccessAdminError("Only an authenticated LevyTate Platform Admin can manage provider access.", 403);
  }
  return { actor, canonicalOrganisation };
}

async function findCanonicalOrganisation() {
  const organisation = (await supabaseSelect<CanonicalOrganisationRow>(
    config(),
    organisationsTable,
    new URLSearchParams({
      select: "id",
      slug: `eq.${canonicalCatalogueSlug}`,
      status: "eq.Active",
      limit: "1",
    }),
  ))[0];
  if (!organisation) throw new LevyTateProviderAccessAdminError("The canonical provider catalogue is unavailable.", 503);
  return organisation;
}

async function findCanonicalProvider(canonicalOrganisationId: string, providerId: string) {
  const rows = await supabaseSelect<CanonicalProviderRow>(
    config(),
    providersTable,
    new URLSearchParams({
      select: "provider_id,provider_name,status",
      organisation_id: `eq.${canonicalOrganisationId}`,
      provider_id: `eq.${providerId}`,
      limit: "2",
    }),
  );
  return rows.length === 1 ? rows[0] : null;
}

async function requireActiveCanonicalProvider(canonicalOrganisationId: string, providerId: string) {
  const provider = await findCanonicalProvider(canonicalOrganisationId, providerId);
  if (provider?.status !== "Active") {
    throw new LevyTateProviderAccessAdminError("Choose an active provider from the canonical LevyTate catalogue.", 404);
  }
  return provider;
}

async function findMembershipsByEmail(email: string) {
  if (!email) return [];
  return supabaseSelect<ProviderMembershipRow>(
    config(),
    providerMembershipsTable,
    new URLSearchParams({
      select: providerMembershipSelect,
      email: `eq.${email}`,
      limit: "2",
    }),
  );
}

async function findMembershipById(id: string) {
  return (await supabaseSelect<ProviderMembershipRow>(
    config(),
    providerMembershipsTable,
    new URLSearchParams({
      select: providerMembershipSelect,
      id: `eq.${id}`,
      limit: "1",
    }),
  ))[0] ?? null;
}

async function mutateProviderMembership(
  operation: "provision" | "update" | "revoke" | "reactivate",
  membership: ProviderMembershipRow | Partial<ProviderMembershipRow>,
  expectedUpdatedAt: string | null,
  audit: ReturnType<typeof providerAccessAudit>,
) {
  try {
    return await supabaseFetchJson<ProviderMembershipRow>(
      config(),
      "rpc/levytate_mutate_provider_membership",
      {
        method: "POST",
        body: JSON.stringify({
          p_operation: operation,
          p_membership: membership,
          p_expected_updated_at: expectedUpdatedAt,
          p_audit: audit,
        }),
      },
    );
  } catch (error) {
    if (
      error instanceof LevyTateSupabaseError
      && /\b(?:40001|23505)\b/.test(error.message)
    ) {
      throw new LevyTateProviderAccessAdminError(
        operation === "provision"
          ? "This email already has provider access."
          : "Provider access changed before this update was saved. Refresh and try again.",
        409,
      );
    }
    if (error instanceof LevyTateSupabaseError && /\b23514\b/.test(error.message)) {
      throw new LevyTateProviderAccessAdminError("Provider access prerequisites changed. Refresh and try again.", 409);
    }
    if (error instanceof LevyTateSupabaseError && /\b42501\b/.test(error.message)) {
      throw new LevyTateProviderAccessAdminError("Only an authenticated LevyTate Platform Admin can manage provider access.", 403);
    }
    if (error instanceof LevyTateSupabaseError && /\b22023\b/.test(error.message)) {
      throw new LevyTateProviderAccessAdminError("The provider access request is invalid.", 400);
    }
    throw new LevyTateProviderAccessAdminError("Provider access could not be saved safely.", 503);
  }
}

async function ensureAuthUser(email: string) {
  const existing = await findAuthUserByEmail(email);
  if (existing) return existing;

  const response = await providerAuthRequest("admin/users", {
    method: "POST",
    body: JSON.stringify({
      email,
      email_confirm: true,
      user_metadata: { levytate_provider_access: true },
    }),
  });
  if (response.ok) return response.json() as Promise<SupabaseAuthUser>;

  // A concurrent provisioner may have created the Auth identity after the first
  // directory read. Reuse that identity but never create a second membership.
  if (response.status === 422) {
    const raced = await findAuthUserByEmail(email);
    if (raced) return raced;
  }
  throw new LevyTateProviderAccessAdminError("The provider authentication identity could not be prepared.", 503);
}

async function findAuthUserByEmail(email: string) {
  const pageSize = 1000;
  for (let page = 1; page <= 100; page += 1) {
    const response = await providerAuthRequest(`admin/users?page=${page}&per_page=${pageSize}`);
    if (!response.ok) {
      throw new LevyTateProviderAccessAdminError("The authentication directory could not be checked.", 503);
    }
    const payload = await response.json() as { users?: SupabaseAuthUser[] };
    const users = Array.isArray(payload.users) ? payload.users : [];
    const exact = users.find((user) => normaliseBetaEmail(user.email ?? "") === email);
    if (exact) return exact;
    if (users.length < pageSize) return null;
  }
  throw new LevyTateProviderAccessAdminError("The authentication directory could not be checked completely.", 503);
}

async function providerAuthRequest(path: string, init: RequestInit = {}) {
  const value = config();
  return fetch(`${value.url}/auth/v1/${path}`, {
    ...init,
    headers: {
      apikey: value.serviceRoleKey,
      Authorization: `Bearer ${value.serviceRoleKey}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });
}

function providerAccessAudit(
  actor: PlatformAdminContext,
  membershipId: string,
  action: string,
  summary: string,
  metadata: Record<string, unknown>,
) {
  return {
    id: randomUUID(),
    organisation_id: actor.organisation.id,
    actor_user_id: actor.user.id,
    actor_email: actor.user.email,
    actor_role: "Platform Admin",
    entity_type: "provider_membership",
    entity_id: membershipId,
    action,
    summary,
    metadata,
    created_at: new Date().toISOString(),
  };
}

function toMembershipSummary(row: ProviderMembershipRow): ProviderAccessMembershipSummary {
  return {
    id: row.id,
    providerId: row.provider_id,
    email: row.email,
    displayName: row.display_name,
    role: normaliseProviderRole(row.role),
    active: row.active,
    authBindingStatus: row.auth_binding_status === "bound" ? "bound" : "pending",
    lastLoginAt: row.last_login_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function normaliseProviderRole(value: string): ProviderMembershipRole {
  return providerMembershipRoles.includes(value as ProviderMembershipRole)
    ? value as ProviderMembershipRole
    : "Provider User";
}

function providerRole(value: unknown, fallback: ProviderMembershipRole) {
  if (value === undefined) return fallback;
  if (typeof value !== "string" || !providerMembershipRoles.includes(value as ProviderMembershipRole)) {
    throw new LevyTateProviderAccessAdminError("Choose Provider Admin or Provider User.");
  }
  return value as ProviderMembershipRole;
}

function providerAccessOperation(value: unknown) {
  if (value === "update" || value === "revoke" || value === "reactivate") return value;
  throw new LevyTateProviderAccessAdminError("Choose update, revoke or reactivate.");
}

function requiredText(value: unknown, label: string, maximumLength: number) {
  if (typeof value !== "string") throw new LevyTateProviderAccessAdminError(`${label} is required.`);
  const text = value.trim();
  if (!text) throw new LevyTateProviderAccessAdminError(`${label} is required.`);
  if (text.length > maximumLength) throw new LevyTateProviderAccessAdminError(`${label} is too long.`);
  return text;
}

function validEmail(value: unknown) {
  const email = normaliseBetaEmail(typeof value === "string" ? value : "");
  if (
    !email
    || email.length > 254
    || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ) throw new LevyTateProviderAccessAdminError("A valid provider work email is required.");
  return email;
}

function config() {
  const value = getLevyTateSupabaseConfig();
  if (!value) throw new LevyTateProviderAccessAdminError("Provider access administration is unavailable.", 503);
  return value;
}

const providerMembershipSelect = "id,provider_id,email,display_name,auth_subject,auth_binding_status,auth_bound_at,last_login_at,role,active,created_by,created_at,updated_at";
