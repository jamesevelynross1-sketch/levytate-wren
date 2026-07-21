import { randomUUID } from "node:crypto";
import type { LevyTateBetaSession } from "@/lib/levytate/config/beta-access";
import { syncPersistentEarlyAccessState } from "@/lib/server/levytate-beta-access-grants";
import {
  getLevyTateSupabaseConfig,
  supabaseInsert,
  supabaseSelect,
  supabaseUpdate,
} from "@/lib/server/levytate-supabase";

export type ProspectAccessStatus = "prepared" | "active" | "expired" | "revoked";

type ProspectAccessRow = {
  id: string;
  organisation_id: string;
  user_id: string;
  access_status: ProspectAccessStatus;
  access_start_at: string | null;
  access_expires_at: string | null;
  first_login_at: string | null;
  guidance_completed_at: string | null;
  guidance_completed_by: string;
  revoked_at: string | null;
  revoked_by: string;
  revocation_reason: string;
  reactivated_at: string | null;
  reactivated_by: string;
  internal_owner_name: string;
  internal_notes: string;
  last_status_changed_at: string;
  created_at: string;
  updated_at: string;
  version: number;
};

type ProspectMembershipRow = {
  id: string;
  organisation_id: string;
  email: string;
  role: string;
  display_name: string;
  active: boolean;
};

type ProspectOrganisationRow = {
  id: string;
  name: string;
  workspace_template: string;
};

export type ProspectAccessSummary = {
  id: string;
  organisationId: string;
  organisationName: string;
  userId: string;
  prospectName: string;
  email: string;
  role: "Apprenticeship Lead";
  status: ProspectAccessStatus;
  statusLabel: string;
  accessStartAt: string | null;
  accessExpiresAt: string | null;
  firstLoginAt: string | null;
  guidanceCompletedAt: string | null;
  internalOwnerName: string;
  lastStatusChangedAt: string;
  version: number;
};

export class ProspectAccessError extends Error {
  code: "prepared" | "expired" | "revoked" | "configuration" | "forbidden" | "conflict";
  status: number;

  constructor(code: ProspectAccessError["code"], message: string, status = 403) {
    super(message);
    this.name = "ProspectAccessError";
    this.code = code;
    this.status = status;
  }
}

export async function checkProspectSessionAccess(email: string) {
  const context = await findProspectByEmail(email);
  if (!context) return true;
  const access = await resolveExpiry(context);
  return access.access_status === "active" && hasStarted(access);
}

export async function assertProspectLoginAccess(email: string) {
  const context = await findProspectByEmail(email);
  if (!context) return null;
  const access = await resolveExpiry(context);
  assertActive(access);
  return toSummary(context, access);
}

export async function recordProspectFirstLogin(email: string) {
  const context = await findProspectByEmail(email);
  if (!context) return null;
  const access = await resolveExpiry(context);
  assertActive(access);
  if (access.first_login_at) return toSummary(context, access);

  const now = new Date().toISOString();
  const updated = await updateAccess(access, {
    first_login_at: now,
    updated_at: now,
    version: access.version + 1,
  });
  await audit(context.organisation.id, context.membership.id, context.membership.email, "Apprenticeship Lead", "prospect_access.first_login", "First login completed.");
  return toSummary(context, updated);
}

export async function getProspectAccessForSession(session: LevyTateBetaSession) {
  const context = await findProspectByEmail(session.email);
  if (!context) return null;
  const access = await resolveExpiry(context);
  assertActive(access);
  return toSummary(context, access);
}

export async function completeProspectGuidance(session: LevyTateBetaSession) {
  const context = await findProspectByEmail(session.email);
  if (!context) throw new ProspectAccessError("forbidden", "Prospect guidance is not available for this account.");
  const access = await resolveExpiry(context);
  assertActive(access);
  if (access.guidance_completed_at) return toSummary(context, access);

  const now = new Date().toISOString();
  const updated = await updateAccess(access, {
    guidance_completed_at: now,
    guidance_completed_by: session.email,
    updated_at: now,
    version: access.version + 1,
  });
  await audit(context.organisation.id, context.membership.id, session.email, "Apprenticeship Lead", "prospect_access.guidance_completed", "Getting started guidance completed.");
  return toSummary(context, updated);
}

export async function listProspectAccessForAdmin() {
  const config = requireConfig();
  const rows = await supabaseSelect<ProspectAccessRow>(config, "levytate_prospect_access", new URLSearchParams({ select: "*", order: "updated_at.desc" }));
  return Promise.all(rows.map(async (row) => {
    const context = await findProspectByAccess(row);
    return context ? toSummary(context, await resolveExpiry(context)) : null;
  })).then((items) => items.filter((item): item is ProspectAccessSummary => Boolean(item)));
}

export async function controlProspectAccess(input: {
  operation: "activate" | "revoke" | "reactivate" | "update_expiry" | "reset_guidance";
  accessId: string;
  actorEmail: string;
  actorRole: string;
  confirmation?: string;
  accessStartAt?: string;
  accessExpiresAt?: string | null;
  internalOwnerName?: string;
  reason?: string;
  version?: number;
}) {
  if (input.actorRole !== "Platform Admin") throw new ProspectAccessError("forbidden", "Only LevyTate Platform Admin can control prospect access.");
  if (!["activate", "revoke", "reactivate", "update_expiry", "reset_guidance"].includes(input.operation)) {
    throw new ProspectAccessError("configuration", "A supported prospect access operation is required.", 400);
  }
  const context = await findProspectByAccessId(input.accessId);
  if (!context) throw new ProspectAccessError("forbidden", "Prospect access was not found.", 404);
  const current = context.access;
  const now = new Date().toISOString();
  let patch: Partial<ProspectAccessRow>;
  let event: string;
  let summary: string;

  if (input.operation === "activate") {
    requireConfirmation(input.confirmation, "ACTIVATE");
    const start = requiredDate(input.accessStartAt, "Access start date");
    const expiry = optionalDate(input.accessExpiresAt);
    validateRange(start, expiry);
    if (!input.internalOwnerName?.trim()) throw new ProspectAccessError("configuration", "Internal owner is required.", 400);
    patch = { access_status: "active", access_start_at: start, access_expires_at: expiry, internal_owner_name: input.internalOwnerName.trim(), revoked_at: null, revoked_by: "", revocation_reason: "", last_status_changed_at: now };
    event = "prospect_access.activated"; summary = "Access activated.";
  } else if (input.operation === "revoke") {
    if (!input.reason?.trim()) throw new ProspectAccessError("configuration", "A revocation reason is required.", 400);
    patch = { access_status: "revoked", revoked_at: now, revoked_by: input.actorEmail, revocation_reason: input.reason.trim(), last_status_changed_at: now };
    event = "prospect_access.revoked"; summary = "Access revoked.";
  } else if (input.operation === "reactivate") {
    requireConfirmation(input.confirmation, "REACTIVATE");
    const start = current.access_start_at ?? now;
    const expiry = input.accessExpiresAt === undefined ? current.access_expires_at : optionalDate(input.accessExpiresAt);
    validateRange(start, expiry);
    if (expiry && Date.parse(expiry) <= Date.now()) {
      throw new ProspectAccessError("configuration", "A future expiry date is required to reactivate expired access.", 400);
    }
    patch = { access_status: "active", access_expires_at: expiry, reactivated_at: now, reactivated_by: input.actorEmail, revoked_at: null, revoked_by: "", revocation_reason: "", last_status_changed_at: now };
    event = "prospect_access.reactivated"; summary = "Access reactivated.";
  } else if (input.operation === "update_expiry") {
    if (input.version !== current.version) throw new ProspectAccessError("conflict", "Prospect access changed before this update. Refresh and try again.", 409);
    const expiry = requiredDate(input.accessExpiresAt, "Expiry date");
    validateRange(current.access_start_at, expiry);
    if (Date.parse(expiry) <= Date.now()) {
      throw new ProspectAccessError("configuration", "Expiry must be in the future.", 400);
    }
    if (current.access_expires_at && Date.parse(expiry) < Date.parse(current.access_expires_at) && !input.reason?.trim()) {
      throw new ProspectAccessError("configuration", "A reason is required when shortening access.", 400);
    }
    patch = { access_expires_at: expiry, last_status_changed_at: now };
    event = "prospect_access.expiry_updated"; summary = "Access expiry updated.";
  } else {
    requireConfirmation(input.confirmation, "RESET_GUIDANCE");
    patch = { guidance_completed_at: null, guidance_completed_by: "" };
    event = "prospect_access.guidance_reset"; summary = "Getting started guidance reset for internal testing.";
  }

  const updated = await updateAccess(current, { ...patch, updated_at: now, version: current.version + 1 });
  const active = updated.access_status === "active";
  await supabaseUpdate<ProspectMembershipRow>(requireConfig(), "levytate_users", `id=eq.${encodeURIComponent(context.membership.id)}`, { active, role: "Apprenticeship Lead", updated_at: now });
  await syncLegacyAccess(context.membership.email, active ? "Approved" : updated.access_status === "prepared" ? "New" : "Declined");
  await audit(context.organisation.id, context.membership.id, input.actorEmail, "Platform Admin", event, summary);
  return toSummary(context, updated);
}

type ProspectAdminControl = Omit<Parameters<typeof controlProspectAccess>[0], "operation">;
export function activateProspectAccess(input: ProspectAdminControl) { return controlProspectAccess({ ...input, operation: "activate" }); }
export function revokeProspectAccess(input: ProspectAdminControl) { return controlProspectAccess({ ...input, operation: "revoke" }); }
export function reactivateProspectAccess(input: ProspectAdminControl) { return controlProspectAccess({ ...input, operation: "reactivate" }); }
export function updateProspectAccessExpiry(input: ProspectAdminControl) { return controlProspectAccess({ ...input, operation: "update_expiry" }); }
export function resetProspectGuidance(input: ProspectAdminControl) { return controlProspectAccess({ ...input, operation: "reset_guidance" }); }

export async function prepareProspectAccess(input: {
  organisationId: string;
  userId: string;
  internalOwnerName?: string;
  internalNotes?: string;
}) {
  const config = requireConfig();
  const now = new Date().toISOString();
  const rows = await supabaseInsert<ProspectAccessRow>(config, "levytate_prospect_access", [{
    organisation_id: input.organisationId,
    user_id: input.userId,
    access_status: "prepared",
    internal_owner_name: input.internalOwnerName?.trim() ?? "",
    internal_notes: input.internalNotes?.trim() ?? "",
    last_status_changed_at: now,
    created_at: now,
    updated_at: now,
    version: 1,
  }], { query: "on_conflict=organisation_id,user_id", prefer: "resolution=ignore-duplicates,return=representation" });
  const existing = rows[0] ?? await selectAccessByUser(input.userId);
  if (!existing) throw new ProspectAccessError("configuration", "Prospect access could not be prepared.", 500);
  return existing;
}

function assertActive(access: ProspectAccessRow) {
  if (access.access_status === "prepared" || !hasStarted(access)) throw new ProspectAccessError("prepared", "Your LevyTate access has not yet been activated.");
  if (access.access_status === "expired") throw new ProspectAccessError("expired", "Your LevyTate access period has ended.");
  if (access.access_status === "revoked") throw new ProspectAccessError("revoked", "Your LevyTate access is no longer active. Contact your LevyTate representative if you need assistance.");
}

function hasStarted(access: ProspectAccessRow) {
  return !access.access_start_at || Date.parse(access.access_start_at) <= Date.now();
}

async function resolveExpiry(context: ProspectContext) {
  const access = context.access;
  if (access.access_status !== "active" || !access.access_expires_at || Date.parse(access.access_expires_at) > Date.now()) return access;
  const now = new Date().toISOString();
  const updated = await updateAccess(access, { access_status: "expired", last_status_changed_at: now, updated_at: now, version: access.version + 1 });
  await supabaseUpdate<ProspectMembershipRow>(requireConfig(), "levytate_users", `id=eq.${encodeURIComponent(context.membership.id)}`, { active: false, updated_at: now });
  await syncLegacyAccess(context.membership.email, "Declined");
  await audit(context.organisation.id, context.membership.id, "LevyTate access service", "Platform Admin", "prospect_access.expired", "Access expired at the configured end date.");
  context.access = updated;
  return updated;
}

type ProspectContext = { organisation: ProspectOrganisationRow; membership: ProspectMembershipRow; access: ProspectAccessRow };

async function findProspectByEmail(email: string): Promise<ProspectContext | null> {
  const config = getLevyTateSupabaseConfig();
  if (!config) return null;
  const users = await supabaseSelect<ProspectMembershipRow>(config, "levytate_users", new URLSearchParams({ select: "id,organisation_id,email,role,display_name,active", email: `eq.${email.trim().toLowerCase()}`, limit: "1" }));
  const membership = users[0];
  if (!membership) return null;
  const organisations = await supabaseSelect<ProspectOrganisationRow>(config, "levytate_organisations", new URLSearchParams({ select: "id,name,workspace_template", id: `eq.${membership.organisation_id}`, limit: "1" }));
  const organisation = organisations[0];
  if (!organisation || organisation.workspace_template !== "levytate-prospect-sandbox") return null;
  const access = await selectAccessByUser(membership.id);
  if (!access) throw new ProspectAccessError("configuration", "Your LevyTate access could not be verified. Please try again later.", 503);
  return { organisation, membership, access };
}

async function findProspectByAccessId(id: string) {
  const rows = await supabaseSelect<ProspectAccessRow>(requireConfig(), "levytate_prospect_access", new URLSearchParams({ select: "*", id: `eq.${id}`, limit: "1" }));
  return rows[0] ? findProspectByAccess(rows[0]) : null;
}

async function findProspectByAccess(access: ProspectAccessRow): Promise<ProspectContext | null> {
  const config = requireConfig();
  const users = await supabaseSelect<ProspectMembershipRow>(config, "levytate_users", new URLSearchParams({ select: "id,organisation_id,email,role,display_name,active", id: `eq.${access.user_id}`, limit: "1" }));
  const organisations = await supabaseSelect<ProspectOrganisationRow>(config, "levytate_organisations", new URLSearchParams({ select: "id,name,workspace_template", id: `eq.${access.organisation_id}`, limit: "1" }));
  if (!users[0] || organisations[0]?.workspace_template !== "levytate-prospect-sandbox") return null;
  return { membership: users[0], organisation: organisations[0], access };
}

async function selectAccessByUser(userId: string) {
  return (await supabaseSelect<ProspectAccessRow>(requireConfig(), "levytate_prospect_access", new URLSearchParams({ select: "*", user_id: `eq.${userId}`, limit: "1" })))[0] ?? null;
}

async function updateAccess(current: ProspectAccessRow, patch: Partial<ProspectAccessRow>) {
  const rows = await supabaseUpdate<ProspectAccessRow>(requireConfig(), "levytate_prospect_access", `id=eq.${encodeURIComponent(current.id)}&version=eq.${current.version}`, patch);
  if (!rows[0]) throw new ProspectAccessError("conflict", "Prospect access changed before this update. Refresh and try again.", 409);
  return rows[0];
}

async function syncLegacyAccess(email: string, status: "New" | "Approved" | "Declined") {
  await syncPersistentEarlyAccessState(email, status);
  await supabaseUpdate(requireConfig(), "levytate_early_access_requests", `email=eq.${encodeURIComponent(email)}`, { status, updated_at: new Date().toISOString() }, { prefer: "return=minimal" });
}

async function audit(organisationId: string, userId: string, actorEmail: string, actorRole: string, action: string, summary: string) {
  await supabaseInsert(requireConfig(), "levytate_audit_events", [{ id: randomUUID(), organisation_id: organisationId, actor_email: actorEmail, actor_role: actorRole, entity_type: "prospect_access", entity_id: userId, action, summary, metadata: {}, created_at: new Date().toISOString() }]);
}

function toSummary(context: ProspectContext, access: ProspectAccessRow): ProspectAccessSummary {
  return { id: access.id, organisationId: context.organisation.id, organisationName: context.organisation.name, userId: context.membership.id, prospectName: context.membership.display_name, email: context.membership.email, role: "Apprenticeship Lead", status: access.access_status, statusLabel: ({ prepared: "Access prepared", active: "Active", expired: "Expired", revoked: "Revoked" })[access.access_status], accessStartAt: access.access_start_at, accessExpiresAt: access.access_expires_at, firstLoginAt: access.first_login_at, guidanceCompletedAt: access.guidance_completed_at, internalOwnerName: access.internal_owner_name, lastStatusChangedAt: access.last_status_changed_at, version: access.version };
}

function requireConfig() {
  const config = getLevyTateSupabaseConfig();
  if (!config) throw new ProspectAccessError("configuration", "Prospect access storage is unavailable.", 503);
  return config;
}
function requireConfirmation(value: string | undefined, expected: string) { if (value !== expected) throw new ProspectAccessError("configuration", `Explicit ${expected} confirmation is required.`, 400); }
function requiredDate(value: string | null | undefined, label: string) { const date = optionalDate(value); if (!date) throw new ProspectAccessError("configuration", `${label} is required.`, 400); return date; }
function optionalDate(value: string | null | undefined) { if (value === null || value === undefined || value === "") return null; const date = new Date(value); if (Number.isNaN(date.getTime())) throw new ProspectAccessError("configuration", "A valid ISO date is required.", 400); return date.toISOString(); }
function validateRange(start: string | null, expiry: string | null) { if (start && expiry && Date.parse(expiry) < Date.parse(start)) throw new ProspectAccessError("configuration", "Expiry cannot be before the access start date.", 400); }
