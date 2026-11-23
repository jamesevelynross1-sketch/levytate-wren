import type { LevyTateBetaSession } from "@/lib/levytate/config/beta-access";
import type { LevyTateProviderSession } from "@/lib/server/levytate-provider-auth";
import {
  employerDeliveryActionSchema,
  providerDeliverySubmitSchema,
  type EmployerDeliveryWorkspace,
  type ProviderDeliveryUpdateView,
  type ProviderDeliveryWorkspace,
} from "@/lib/levytate/provider-delivery";
import { getLearnerLifecycleServerContext } from "@/lib/server/levytate-learner-lifecycle";
import {
  getLevyTateSupabaseConfig,
  readRuntimeEnv,
  supabaseFetchJson,
  supabaseSelect,
  supabaseSelectAll,
} from "@/lib/server/levytate-supabase";

type CapabilityRow = { organisation_id: string; provider_delivery_enabled: boolean };
type GrantRow = { organisation_id: string; provider_id: string; enabled: boolean };
type SelectionRow = { organisation_id: string; provider_id: string; status: string };
type ProgrammeRow = { organisation_id: string; programme_id: string; provider_id: string; status: string };
type CanonicalProgrammeRow = { id: string; programme_name: string };
type CanonicalProviderRow = { provider_id: string; provider_name: string };
type LearnerRow = { id: string; employee_id: string; programme_id: string; provider_id: string; lifecycle_status: string; record_status: string };
type EmployeeRow = { id: string; name: string };
type UpdateRow = {
  id: string; organisation_id: string; provider_id: string; update_kind: "learner_progress"|"programme_note";
  target_id: string; report_date: string; payload: ProviderDeliveryUpdateView["payload"];
  review_status: "pending"|"accepted"|"rejected"; submitted_at: string; reviewed_at: string|null; idempotency_key: string;
};

const acceptedLearnerStatuses = new Set(["enrolled", "assessment_preparation", "in_assessment"]);

export class LevyTateProviderDeliveryError extends Error {
  constructor(message: string, readonly status: 400|403|404|409|503 = 400) {
    super(message);
    this.name = "LevyTateProviderDeliveryError";
  }
}

// Every operation requires the global preview/local kill-switch AND employer opt-in.
// Deliberately disabled on Production; turning this on is a separate acceptance gate.
export function isProviderDeliveryEnvironmentEnabled() {
  if (process.env.VERCEL_ENV === "production") return false;
  if (process.env.NODE_ENV === "production" && process.env.VERCEL_ENV !== "preview") return false;
  return readRuntimeEnv("LEVYTATE_PROVIDER_DELIVERY_ENABLED").toLowerCase() === "true";
}
function config() {
  const value = getLevyTateSupabaseConfig();
  if (!value) throw new LevyTateProviderDeliveryError("Provider delivery is unavailable.", 503);
  return value;
}
function assertEnabled() {
  if (!isProviderDeliveryEnvironmentEnabled()) throw new LevyTateProviderDeliveryError("Provider delivery is not enabled.", 404);
}
async function isOrganisationEnabled(organisationId: string) {
  const rows = await supabaseSelect<CapabilityRow>(config(), "levytate_organisation_capabilities", new URLSearchParams({
    select: "organisation_id,provider_delivery_enabled",
    organisation_id: `eq.${organisationId}`, provider_delivery_enabled: "eq.true", limit: "1",
  }));
  return rows.length === 1;
}
async function activeProviderSelection(organisationId: string, providerId: string) {
  const rows = await supabaseSelect<SelectionRow>(config(), "levytate_organisation_providers", new URLSearchParams({
    select: "organisation_id,provider_id,status",
    organisation_id: `eq.${organisationId}`, provider_id: `eq.${providerId}`, status: "eq.Active", limit: "1",
  }));
  return rows.length === 1;
}
async function authorisedGrantRows(providerId: string) {
  const grants = await supabaseSelectAll<GrantRow>(config(), "levytate_provider_delivery_grants", new URLSearchParams({
    select: "organisation_id,provider_id,enabled", provider_id: `eq.${providerId}`, enabled: "eq.true",
  }), { maxRows: 500 });
  const accepted: GrantRow[] = [];
  for (const grant of grants) {
    if (await isOrganisationEnabled(grant.organisation_id) && await activeProviderSelection(grant.organisation_id, providerId)) accepted.push(grant);
  }
  return accepted;
}

export async function providerHasDeliveryAccess(providerId: string): Promise<boolean> {
  if (!isProviderDeliveryEnvironmentEnabled()) return false;
  try {
    return (await authorisedGrantRows(providerId)).length > 0;
  } catch {
    // Unapplied candidate SQL/missing table must never grant access.
    return false;
  }
}

function toUpdateView(row: UpdateRow): ProviderDeliveryUpdateView {
  return {
    id: row.id, organisationId: row.organisation_id, providerId: row.provider_id,
    kind: row.update_kind, targetId: row.target_id, reportDate: row.report_date,
    payload: row.payload, status: row.review_status, submittedAt: row.submitted_at, reviewedAt: row.reviewed_at,
    requestKey: row.idempotency_key,
  };
}
async function updatesForOrganisation(organisationId: string, providerId?: string) {
  const rows = await supabaseSelectAll<UpdateRow>(config(), "levytate_provider_delivery_updates", new URLSearchParams({
    select: "id,organisation_id,provider_id,update_kind,target_id,report_date,payload,review_status,submitted_at,reviewed_at,idempotency_key",
    organisation_id: `eq.${organisationId}`,
    ...(providerId ? { provider_id: `eq.${providerId}` } : {}),
    order: "submitted_at.desc,id.desc",
  }), { maxRows: 2500 });
  return rows.map(toUpdateView);
}
async function canonicalCatalogue() {
  const organisations = await supabaseSelect<{id:string}>(config(), "levytate_organisations", new URLSearchParams({
    select: "id", slug: "eq.levytate-internal", status: "eq.Active", limit: "1",
  }));
  if (!organisations[0]) throw new LevyTateProviderDeliveryError("Provider catalogue is unavailable.", 503);
  const [providers,programmes] = await Promise.all([
    supabaseSelectAll<CanonicalProviderRow>(config(),"levytate_providers",new URLSearchParams({
      select:"provider_id,provider_name",organisation_id:`eq.${organisations[0].id}`,
    }),{maxRows:5000}),
    supabaseSelectAll<CanonicalProgrammeRow>(config(),"levytate_provider_programmes",new URLSearchParams({
      select:"id,programme_name",organisation_id:`eq.${organisations[0].id}`,
    }),{maxRows:10000}),
  ]);
  return {
    providerNames: new Map(providers.map(item => [item.provider_id,item.provider_name])),
    programmeNames: new Map(programmes.map(item => [item.id,item.programme_name])),
  };
}

export async function getProviderDeliveryWorkspace(session: LevyTateProviderSession): Promise<ProviderDeliveryWorkspace | null> {
  if (!isProviderDeliveryEnvironmentEnabled()) return null;
  const grants = await authorisedGrantRows(session.providerId);
  if (!grants.length) return null;
  const catalogue = await canonicalCatalogue();
  const employers: ProviderDeliveryWorkspace["employers"] = [];
  for (const grant of grants) {
    const org = grant.organisation_id;
    const organisations = await supabaseSelect<{name:string}>(config(),"levytate_organisations",new URLSearchParams({
      select:"name",id:`eq.${org}`,status:"eq.Active",limit:"1",
    }));
    if (organisations.length !== 1) continue;
    const [programmes,learners,employees,updates] = await Promise.all([
      supabaseSelectAll<ProgrammeRow>(config(),"levytate_organisation_programmes",new URLSearchParams({
        select:"organisation_id,programme_id,provider_id,status",organisation_id:`eq.${org}`,
        provider_id:`eq.${session.providerId}`,status:"eq.Active",
      }),{maxRows:1000}),
      supabaseSelectAll<LearnerRow>(config(),"levytate_learner_records",new URLSearchParams({
        select:"id,employee_id,programme_id,provider_id,lifecycle_status,record_status",
        organisation_id:`eq.${org}`,provider_id:`eq.${session.providerId}`,record_status:"eq.Active",
      }),{maxRows:1000}),
      supabaseSelectAll<EmployeeRow>(config(),"levytate_employees",new URLSearchParams({
        select:"id,name",organisation_id:`eq.${org}`,status:"eq.Active",
      }),{maxRows:10000}),
      updatesForOrganisation(org,session.providerId),
    ]);
    const allowedProgrammes = new Set(programmes.map(item=>item.programme_id));
    const names = new Map(employees.map(item=>[item.id,item.name]));
    employers.push({
      id:org,name:organisations[0].name,
      programmes:programmes.map(item=>({id:item.programme_id,name:catalogue.programmeNames.get(item.programme_id)??"Selected programme"})),
      learners:learners.filter(item=>acceptedLearnerStatuses.has(item.lifecycle_status)&&allowedProgrammes.has(item.programme_id))
        .map(item=>({id:item.id,name:names.get(item.employee_id)??"Learner record",status:item.lifecycle_status,programmeName:catalogue.programmeNames.get(item.programme_id)??"Selected programme"})),
      updates,
    });
  }
  if (!employers.length) return null;
  return {
    provider:{id:session.providerId,name:catalogue.providerNames.get(session.providerId)??"Training provider",memberRole:session.role},
    employers,
  };
}

export async function submitProviderDeliveryUpdate(session: LevyTateProviderSession, raw: unknown) {
  assertEnabled();
  const parsed = providerDeliverySubmitSchema.safeParse(raw);
  if (!parsed.success) throw new LevyTateProviderDeliveryError("Check the report date, progress, summary and selected record.",400);
  const update=parsed.data;
  if (!(await authorisedGrantRows(session.providerId)).some(row=>row.organisation_id===update.organisationId))
    throw new LevyTateProviderDeliveryError("This employer has not shared that delivery record.",403);
  const saved=await supabaseFetchJson<UpdateRow>(config(),"rpc/levytate_submit_provider_delivery_update",{
    method:"POST",
    body:JSON.stringify({
      p_organisation_id:update.organisationId,p_provider_id:session.providerId,p_membership_id:session.membershipId,
      p_update_kind:update.kind,p_target_id:update.targetId,p_payload:update.payload,p_idempotency_key:update.idempotencyKey,
    }),
  });
  return toUpdateView(saved);
}

async function employerContext(session: LevyTateBetaSession) {
  assertEnabled();
  const context=await getLearnerLifecycleServerContext(session);
  if (!["Employer Admin","Apprenticeship Lead"].includes(context.user.role))
    throw new LevyTateProviderDeliveryError("You do not have access to provider delivery administration.",403);
  if (!(await isOrganisationEnabled(context.organisation.id)))
    throw new LevyTateProviderDeliveryError("Provider delivery has not been enabled for this employer.",404);
  return context;
}

export async function getEmployerDeliveryWorkspace(session: LevyTateBetaSession): Promise<EmployerDeliveryWorkspace | null> {
  if (!isProviderDeliveryEnvironmentEnabled()) return null;
  const context=await employerContext(session);
  const org=context.organisation.id;
  const [selected,grants,updates,catalogue]=await Promise.all([
    supabaseSelectAll<SelectionRow>(config(),"levytate_organisation_providers",new URLSearchParams({
      select:"organisation_id,provider_id,status",organisation_id:`eq.${org}`,status:"eq.Active",
    }),{maxRows:500}),
    supabaseSelectAll<GrantRow>(config(),"levytate_provider_delivery_grants",new URLSearchParams({
      select:"organisation_id,provider_id,enabled",organisation_id:`eq.${org}`,
    }),{maxRows:500}),
    updatesForOrganisation(org),
    canonicalCatalogue(),
  ]);
  const enabled = new Map(grants.map(row=>[row.provider_id,row.enabled]));
  return {
    grants:selected.map(item=>({providerId:item.provider_id,providerName:catalogue.providerNames.get(item.provider_id)??"Selected provider",enabled:enabled.get(item.provider_id)===true})),
    updates,
  };
}

export async function applyEmployerDeliveryAction(session: LevyTateBetaSession,raw:unknown) {
  const context=await employerContext(session);
  const parsed=employerDeliveryActionSchema.safeParse(raw);
  if (!parsed.success) throw new LevyTateProviderDeliveryError("Invalid provider delivery action.",400);
  const action=parsed.data;
  if (action.action==="grant") {
    return supabaseFetchJson(config(),"rpc/levytate_set_provider_delivery_grant",{
      method:"POST",body:JSON.stringify({
        p_organisation_id:context.organisation.id,p_actor_user_id:context.user.id,
        p_provider_id:action.providerId,p_enabled:action.enabled,
      }),
    });
  }
  const saved=await supabaseFetchJson<UpdateRow>(config(),"rpc/levytate_review_provider_delivery_update",{
    method:"POST",body:JSON.stringify({
      p_organisation_id:context.organisation.id,p_actor_user_id:context.user.id,
      p_update_id:action.updateId,p_decision:action.decision,
    }),
  });
  return toUpdateView(saved);
}
