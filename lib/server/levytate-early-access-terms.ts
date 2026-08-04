import "server-only";
import { createHash, randomUUID } from "node:crypto";
import type { LevyTateBetaSession } from "@/lib/levytate/config/beta-access";
import { getPublicTrustPage } from "@/lib/levytate/public-trust-content";
import { normaliseMvpUserRole, type MvpUserRole } from "@/lib/levytate/mvp/rbac";
import { assertProspectLoginAccess } from "@/lib/server/levytate-prospect-access";
import { getLevyTateSupabaseConfig, supabaseInsert, supabaseSelect } from "@/lib/server/levytate-supabase";

export const earlyAccessTermsDocumentType = "early_access_terms";
export const earlyAccessTermsAcceptanceMethod = "authenticated_explicit_acceptance";

type MembershipRow = { id: string; organisation_id: string; email: string; display_name: string; role: string; active: boolean; auth_subject: string | null };
type OrganisationRow = { id: string; name: string };
type AcceptanceRow = { id: string; organisation_id: string; accepted_by_user_id: string; document_type: string; document_version: string; document_content_hash: string; accepted_at: string; acceptance_method: string; role_at_acceptance: string; created_at: string };

export type TermsGateState = {
  bypass: boolean;
  accepted: boolean;
  reacceptanceRequired: boolean;
  authorisedAcceptor: boolean;
  role: MvpUserRole;
  organisationId?: string;
  organisationName?: string;
  version: string;
  contentHash: string;
};

export class EarlyAccessTermsError extends Error {
  constructor(public code: "unauthorised" | "forbidden" | "inactive" | "configuration", message: string, public status = 403) { super(message); this.name = "EarlyAccessTermsError"; }
}

export function getCurrentEarlyAccessTermsDocument() {
  const page = getPublicTrustPage("early-access-terms");
  const representation = JSON.stringify({
    documentType: earlyAccessTermsDocumentType,
    version: page.version,
    effectiveDate: page.effectiveDate,
    title: page.title,
    summary: page.summary,
    sections: page.sections.map((section) => ({ heading: section.heading, paragraphs: [...section.paragraphs], bullets: section.bullets ? [...section.bullets] : [] })),
  });
  return { page, version: page.version, contentHash: createHash("sha256").update(representation, "utf8").digest("hex"), representation };
}

export async function getTermsGateState(session: LevyTateBetaSession): Promise<TermsGateState> {
  const document = getCurrentEarlyAccessTermsDocument();
  if (session.authMode !== "supabase_email") return { bypass: true, accepted: true, reacceptanceRequired: false, authorisedAcceptor: false, role: session.accessLevel === "beta_admin" ? "Platform Admin" : "Employee", version: document.version, contentHash: document.contentHash };
  const membership = await resolveMembership(session);
  const role = normaliseMvpUserRole(membership.role);
  if (role === "Platform Admin") return { bypass: true, accepted: true, reacceptanceRequired: false, authorisedAcceptor: false, role, version: document.version, contentHash: document.contentHash };
  await assertProspectLoginAccess(membership.email);
  const organisation = await organisationFor(membership.organisation_id);
  const current = await currentAcceptance(membership.organisation_id, document.version, document.contentHash);
  const historic = current ? [] : await anyAcceptance(membership.organisation_id);
  return { bypass: false, accepted: Boolean(current), reacceptanceRequired: !current && historic.length > 0, authorisedAcceptor: role === "Apprenticeship Lead", role, organisationId: organisation.id, organisationName: organisation.name, version: document.version, contentHash: document.contentHash };
}

export async function acceptCurrentEarlyAccessTerms(session: LevyTateBetaSession) {
  if (session.authMode !== "supabase_email") throw new EarlyAccessTermsError("forbidden", "Internal demonstration sessions do not create legal acceptance records.");
  const membership = await resolveMembership(session);
  const role = normaliseMvpUserRole(membership.role);
  if (role !== "Apprenticeship Lead") {
    await audit(membership, "terms.acceptance_denied", "Acceptance denied because the current canonical role is not authorised.");
    throw new EarlyAccessTermsError("forbidden", "Only an authorised Apprenticeship Lead can accept organisation Early Access Terms.");
  }
  await assertProspectLoginAccess(membership.email);
  const document = getCurrentEarlyAccessTermsDocument();
  const existing = await currentAcceptance(membership.organisation_id, document.version, document.contentHash);
  if (existing) { await audit(membership, "terms.duplicate_acceptance_request", "Current Early Access Terms were already accepted."); return { acceptance: existing, duplicate: true }; }
  const rows = await supabaseInsert<AcceptanceRow>(requireConfig(), "levytate_early_access_terms_acceptances", [{
    organisation_id: membership.organisation_id,
    accepted_by_user_id: membership.id,
    document_type: earlyAccessTermsDocumentType,
    document_version: document.version,
    document_content_hash: document.contentHash,
    acceptance_method: earlyAccessTermsAcceptanceMethod,
    role_at_acceptance: "Apprenticeship Lead",
  }], { query: "on_conflict=organisation_id,accepted_by_user_id,document_type,document_version,document_content_hash", prefer: "resolution=ignore-duplicates,return=representation" });
  const acceptance = rows[0] ?? await currentAcceptance(membership.organisation_id, document.version, document.contentHash);
  if (!acceptance) throw new EarlyAccessTermsError("configuration", "Terms acceptance could not be recorded safely.", 503);
  await audit(membership, rows[0] ? "terms.accepted" : "terms.duplicate_acceptance_request", rows[0] ? "Current Early Access Terms accepted explicitly." : "Concurrent acceptance request resolved idempotently.", acceptance.id);
  return { acceptance, duplicate: !rows[0] };
}

export async function recordTermsAcceptanceViewed(session: LevyTateBetaSession) {
  if (session.authMode !== "supabase_email") return;
  const membership = await resolveMembership(session);
  if (normaliseMvpUserRole(membership.role) !== "Apprenticeship Lead") return;
  const document = getCurrentEarlyAccessTermsDocument();
  const historic = await anyAcceptance(membership.organisation_id);
  await auditOnce(membership, historic[0] ? "terms.reacceptance_required" : "terms.acceptance_required", historic[0] ? "A new acceptance is required for the current Early Access Terms." : "Organisation acceptance is required for the current Early Access Terms.");
  await auditOnce(membership, "terms.acceptance_viewed", `Current Early Access Terms version ${document.version} acceptance page viewed.`);
}

export async function listTermsAcceptanceStatusForAdmin() {
  const document = getCurrentEarlyAccessTermsDocument();
  const organisations = await supabaseSelect<OrganisationRow>(requireConfig(), "levytate_organisations", new URLSearchParams({ select: "id,name", order: "name.asc" }));
  const acceptances = await supabaseSelect<AcceptanceRow>(requireConfig(), "levytate_early_access_terms_acceptances", new URLSearchParams({ select: "*", document_type: `eq.${earlyAccessTermsDocumentType}`, order: "accepted_at.desc" }));
  const users = await supabaseSelect<Pick<MembershipRow, "id" | "display_name">>(requireConfig(), "levytate_users", new URLSearchParams({ select: "id,display_name" }));
  const names = new Map(users.map((user) => [user.id, user.display_name]));
  return organisations.map((organisation) => {
    const latest = acceptances.find((item) => item.organisation_id === organisation.id);
    const current = acceptances.find((item) => item.organisation_id === organisation.id && item.document_version === document.version && item.document_content_hash === document.contentHash);
    return { organisation: organisation.name, currentTermsVersion: document.version, accepted: Boolean(current), acceptedAt: current?.accepted_at ?? null, acceptingUser: current ? names.get(current.accepted_by_user_id) ?? "Authorised user" : null, roleSnapshot: current?.role_at_acceptance ?? null, reacceptanceRequired: !current && Boolean(latest) };
  });
}

async function resolveMembership(session: LevyTateBetaSession) {
  const rows = await supabaseSelect<MembershipRow>(requireConfig(), "levytate_users", new URLSearchParams({ select: "id,organisation_id,email,display_name,role,active,auth_subject", auth_subject: `eq.${session.authSubject ?? ""}`, limit: "2" }));
  const membership = rows[0];
  if (!membership || membership.email.trim().toLowerCase() !== session.email) throw new EarlyAccessTermsError("unauthorised", "Your authenticated LevyTate membership could not be resolved.", 401);
  if (!membership.active) throw new EarlyAccessTermsError("inactive", "Your LevyTate membership is not active.");
  return membership;
}

async function organisationFor(id: string) {
  const row = (await supabaseSelect<OrganisationRow>(requireConfig(), "levytate_organisations", new URLSearchParams({ select: "id,name", id: `eq.${id}`, limit: "1" })))[0];
  if (!row) throw new EarlyAccessTermsError("configuration", "Your organisation could not be resolved.", 503);
  return row;
}
async function currentAcceptance(organisationId: string, version: string, hash: string) { return (await supabaseSelect<AcceptanceRow>(requireConfig(), "levytate_early_access_terms_acceptances", new URLSearchParams({ select: "*", organisation_id: `eq.${organisationId}`, document_type: `eq.${earlyAccessTermsDocumentType}`, document_version: `eq.${version}`, document_content_hash: `eq.${hash}`, limit: "1" })))[0] ?? null; }
async function anyAcceptance(organisationId: string) { return supabaseSelect<AcceptanceRow>(requireConfig(), "levytate_early_access_terms_acceptances", new URLSearchParams({ select: "*", organisation_id: `eq.${organisationId}`, document_type: `eq.${earlyAccessTermsDocumentType}`, order: "accepted_at.desc", limit: "1" })); }
async function audit(membership: MembershipRow, action: string, summary: string, entityId = membership.organisation_id) { await supabaseInsert(requireConfig(), "levytate_audit_events", [{ id: randomUUID(), organisation_id: membership.organisation_id, actor_email: membership.email, actor_role: normaliseMvpUserRole(membership.role), entity_type: "early_access_terms_acceptance", entity_id: entityId, action, summary, metadata: {}, created_at: new Date().toISOString() }]); }
async function auditOnce(membership: MembershipRow, action: string, summary: string) { const recent = await supabaseSelect<{ id: string }>(requireConfig(), "levytate_audit_events", new URLSearchParams({ select: "id", organisation_id: `eq.${membership.organisation_id}`, actor_email: `eq.${membership.email}`, action: `eq.${action}`, created_at: `gte.${new Date(Date.now() - 15 * 60 * 1000).toISOString()}`, limit: "1" })); if (!recent[0]) await audit(membership, action, summary); }
function requireConfig() { const config = getLevyTateSupabaseConfig(); if (!config) throw new EarlyAccessTermsError("configuration", "Terms acceptance storage is unavailable.", 503); return config; }
