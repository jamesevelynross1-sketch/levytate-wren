import { randomUUID } from "node:crypto";
import type {
  ProviderCatalogueRecord,
  ProviderProgramme,
  RequestStatus,
} from "@/lib/levytate/domain";
import { mvpProviderCatalogue, mvpProviderProgrammes } from "@/lib/levytate/data/mvp/provider-catalogue";
import type { LevyTateBetaSession } from "@/lib/levytate/config/beta-access";
import type { LevyTateWorkspaceBootstrap, LevyTateWorkspaceMeta, LevyTateWorkspaceMutation } from "@/lib/levytate/mvp/api";
import {
  applicationOwnerForStatus,
  buildApplicationHistoryEntry,
  createEmptyMvpWorkspace,
  nowIso,
  type MvpApplication,
  type MvpApplicationHistoryEntry,
  type MvpEmployee,
  type MvpEmployeeDevelopmentProfile,
  type MvpEnrolment,
  type MvpMatchingRequest,
  type MvpPathwayMapping,
  type MvpProviderRelationship,
  type MvpRole,
  type MvpWorkspaceData,
  type MvpWorkspaceProfile,
} from "@/lib/levytate/mvp/workspace";
import {
  getLevyTateSupabaseConfig,
  supabaseDelete,
  supabaseInsert,
  supabaseSelect,
  supabaseUpdate,
} from "@/lib/server/levytate-supabase";
import { getEarlyAccessRequestByEmail } from "@/lib/server/levytate-early-access";

type OrganisationRow = {
  id: string;
  name: string;
  slug: string;
  workspace_name?: string | null;
  primary_contact?: string | null;
  contact_email?: string | null;
  default_site?: string | null;
  sites?: unknown;
  departments?: unknown;
  priorities?: unknown;
  status?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type UserRow = {
  id: string;
  organisation_id: string;
  email: string;
  role: LevyTateWorkspaceMeta["userRole"];
  access_level: string;
  auth_subject?: string | null;
  last_login_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type EmployeeRow = {
  organisation_id: string;
  id: string;
  employee_number: string;
  name: string;
  email: string;
  job_title: string;
  role_id: string;
  manager_id: string;
  department: string;
  site: string;
  platform_role: MvpEmployee["platformRole"];
  status: MvpEmployee["status"];
  start_date: string;
  created_at: string;
  updated_at: string;
};

type EmployeeDevelopmentProfileRow = {
  organisation_id: string;
  employee_id: string;
  stage: MvpEmployeeDevelopmentProfile["stage"];
  responsibilities: unknown;
  current_skills: unknown;
  business_functions: unknown;
  current_capabilities: unknown;
  apprenticeship_indicators: unknown;
  ai_opportunities: unknown;
  data_opportunities: unknown;
  automation_opportunities: unknown;
  future_capabilities: unknown;
  conversation_history: unknown;
  conversation_profile: unknown;
  recommendation_result: unknown;
  preferred_standard_id: string;
  updated_at: string;
};

type RoleRow = {
  organisation_id: string;
  id: string;
  title: string;
  department: string;
  business_area: string;
  career_level: MvpRole["careerLevel"];
  skills_tags: unknown;
  progression: unknown;
  status: MvpRole["status"];
  created_at: string;
  updated_at: string;
};

type RoleMappingRow = {
  organisation_id: string;
  id: string;
  role_id: string;
  apprenticeship_standard_id: string;
  recommendation_type: MvpPathwayMapping["recommendationType"];
  priority: number;
  business_rationale: string;
  funding_route: MvpPathwayMapping["fundingRoute"];
  delivery_preference: MvpPathwayMapping["deliveryPreference"];
};

type ApplicationRow = {
  organisation_id: string;
  id: string;
  employee_id: string;
  apprenticeship_standard_id: string;
  status: RequestStatus;
  current_owner: MvpApplication["currentOwner"];
  reason: string;
  career_goal: string;
  support_required: string;
  manager_note: string;
  submitted_at: string;
  updated_at: string;
};

type ApplicationHistoryRow = {
  organisation_id: string;
  id: string;
  application_id: string;
  status: RequestStatus;
  owner: MvpApplicationHistoryEntry["owner"];
  note: string;
  created_at: string;
};

type ProviderRow = {
  organisation_id: string;
  provider_id: string;
  provider_name: string;
  website: string;
  provider_type: ProviderCatalogueRecord["providerType"];
  sectors: unknown;
  delivery_model: unknown;
  regions: unknown;
  contact_name: string;
  contact_email: string;
  ofsted_rating: string;
  status: ProviderCatalogueRecord["status"];
  source_urls: unknown;
  notes: string;
  last_verified: string;
  verification_status: ProviderCatalogueRecord["verificationStatus"];
};

type ProviderProgrammeRow = {
  organisation_id: string;
  id: string;
  provider_id: string;
  apprenticeship_standard_id: string;
  delivery_mode: string;
  regions: unknown;
  status: ProviderProgramme["status"];
  verification_status: ProviderProgramme["verificationStatus"];
  source_url: string;
  notes: string;
  record_status: ProviderProgramme["recordStatus"];
  created_at: string;
  updated_at: string;
};

type ProviderRelationshipRow = {
  organisation_id: string;
  id: string;
  category: MvpProviderRelationship["category"];
  preferred_provider_id: string;
  backup_provider_ids: unknown;
  apprenticeship_standard_ids: unknown;
  status: MvpProviderRelationship["status"];
  notes: string;
  review_date: string;
  last_used_date: string;
};

type MatchingRequestRow = {
  organisation_id: string;
  id: string;
  role_need: string;
  apprenticeship_standard_id: string;
  learner_count: number;
  sites: unknown;
  delivery_preference: string;
  funding_position: string;
  urgency: string;
  notes: string;
  status: MvpMatchingRequest["status"];
  shortlist_provider_ids: unknown;
  created_at: string;
  updated_at: string;
};

type EnrolmentRow = {
  organisation_id: string;
  id: string;
  application_id: string;
  employee_id: string;
  provider_id: string;
  apprenticeship_standard_id: string;
  status: MvpEnrolment["status"];
  start_date: string;
  notes: string;
  created_at: string;
  updated_at: string;
};

type AuditEventRow = {
  id: string;
  organisation_id: string;
  actor_email: string;
  actor_role: string;
  entity_type: string;
  entity_id: string;
  action: string;
  summary: string;
  metadata: unknown;
  created_at: string;
};

type WorkspaceContext = {
  organisation: OrganisationRow;
  user: UserRow;
  warnings: string[];
};

const organisationsTable = "levytate_organisations";
const usersTable = "levytate_users";
const employeesTable = "levytate_employees";
const employeeProfilesTable = "levytate_employee_development_profiles";
const rolesTable = "levytate_roles";
const roleMappingsTable = "levytate_role_pathway_mappings";
const applicationsTable = "levytate_applications";
const applicationHistoryTable = "levytate_application_history";
const providersTable = "levytate_providers";
const providerProgrammesTable = "levytate_provider_programmes";
const providerRelationshipsTable = "levytate_provider_relationships";
const matchingRequestsTable = "levytate_matching_requests";
const enrolmentsTable = "levytate_enrolments";
const auditEventsTable = "levytate_audit_events";

export class LevyTateWorkspacePersistenceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LevyTateWorkspacePersistenceError";
  }
}

export async function getWorkspaceBootstrapForSession(session: LevyTateBetaSession): Promise<LevyTateWorkspaceBootstrap> {
  const config = getLevyTateSupabaseConfig();

  if (!config) {
    return {
      data: createEmptyMvpWorkspace(),
      meta: buildFallbackMeta(session, [
        "Supabase environment variables are not configured. LevyTate is running in local fallback mode.",
      ]),
    };
  }

  const context = await ensureWorkspaceContext(session);
  const data = await loadWorkspaceData(context.organisation.id);

  return {
    data,
    meta: {
      organisationId: context.organisation.id,
      organisationName: context.organisation.name,
      userEmail: session.email,
      userRole: context.user.role,
      storageMode: "supabase",
      warnings: context.warnings,
    },
  };
}

export async function applyWorkspaceMutationForSession(
  session: LevyTateBetaSession,
  mutation: LevyTateWorkspaceMutation,
): Promise<LevyTateWorkspaceBootstrap> {
  if (!getLevyTateSupabaseConfig()) {
    throw new LevyTateWorkspacePersistenceError("Supabase environment variables are not configured.");
  }

  const context = await ensureWorkspaceContext(session);
  const organisationId = context.organisation.id;

  switch (mutation.type) {
    case "saveProfile":
      await saveProfile(organisationId, mutation.profile);
      await recordAuditEvent(context, "organisation_profile", organisationId, "profile.saved", "Organisation workspace settings updated.");
      break;
    case "saveEmployee":
      await saveEmployee(organisationId, mutation.employee);
      await recordAuditEvent(context, "employee", mutation.employee.id, "employee.saved", `Employee record saved for ${mutation.employee.name}.`);
      break;
    case "archiveEmployee":
      await toggleArchive(organisationId, employeesTable, "id", mutation.id, "status");
      await recordAuditEvent(context, "employee", mutation.id, "employee.archived", "Employee record archive state changed.");
      break;
    case "saveEmployeeDevelopmentProfile":
      await saveEmployeeDevelopmentProfile(organisationId, mutation.profile);
      await recordAuditEvent(context, "employee_profile", mutation.profile.employeeId, "employee_profile.saved", "Employee development profile updated.");
      break;
    case "saveRole":
      await saveRole(organisationId, mutation.role);
      await recordAuditEvent(context, "role", mutation.role.id, "role.saved", `Role library record saved for ${mutation.role.title}.`);
      break;
    case "archiveRole":
      await toggleArchive(organisationId, rolesTable, "id", mutation.id, "status");
      await recordAuditEvent(context, "role", mutation.id, "role.archived", "Role archive state changed.");
      break;
    case "saveApplication":
      await saveApplication(organisationId, mutation.application);
      await recordAuditEvent(context, "application", mutation.application.id, "application.saved", "Application record saved.");
      break;
    case "updateApplicationStatus":
      await updateApplicationStatus(organisationId, mutation.id, mutation.status, mutation.note);
      await recordAuditEvent(context, "application", mutation.id, "application.status_updated", `Application moved to ${mutation.status}.`, { note: mutation.note ?? "" });
      break;
    case "saveProvider":
      await saveProvider(organisationId, mutation.provider);
      await recordAuditEvent(context, "provider", mutation.provider.providerId, "provider.saved", `Provider record saved for ${mutation.provider.providerName}.`);
      break;
    case "archiveProvider":
      await toggleArchive(organisationId, providersTable, "provider_id", mutation.id, "status");
      await recordAuditEvent(context, "provider", mutation.id, "provider.archived", "Provider archive state changed.");
      break;
    case "saveProviderProgramme":
      await saveProviderProgramme(organisationId, mutation.programme);
      await recordAuditEvent(context, "provider_programme", mutation.programme.id, "provider_programme.saved", "Provider programme record saved.");
      break;
    case "archiveProviderProgramme":
      await toggleArchive(organisationId, providerProgrammesTable, "id", mutation.id, "record_status");
      await recordAuditEvent(context, "provider_programme", mutation.id, "provider_programme.archived", "Provider programme archive state changed.");
      break;
    case "removeProviderProgramme":
      await supabaseDelete(assertSupabase(), providerProgrammesTable, buildOrganisationQuery(organisationId, { id: mutation.id }));
      await recordAuditEvent(context, "provider_programme", mutation.id, "provider_programme.deleted", "Provider programme removed from the catalogue.");
      break;
    case "saveProviderRelationship":
      await saveProviderRelationship(organisationId, mutation.relationship);
      await recordAuditEvent(context, "provider_relationship", mutation.relationship.id, "provider_relationship.saved", "Provider relationship record saved.");
      break;
    case "saveMatchingRequest":
      await saveMatchingRequest(organisationId, mutation.request);
      await recordAuditEvent(context, "provider_matching_request", mutation.request.id, "provider_matching_request.saved", "Provider matching request saved.");
      break;
    case "updateMatchingStatus":
      await patchByOrganisation(organisationId, matchingRequestsTable, "id", mutation.id, {
        status: mutation.status,
        updated_at: nowIso(),
      });
      await recordAuditEvent(context, "provider_matching_request", mutation.id, "provider_matching_request.status_updated", `Provider matching request moved to ${mutation.status}.`);
      break;
    case "saveEnrolment":
      await saveEnrolment(organisationId, mutation.enrolment);
      await recordAuditEvent(context, "enrolment", mutation.enrolment.id, "enrolment.saved", "Enrolment record saved.");
      break;
    case "updateEnrolmentStatus":
      await patchByOrganisation(organisationId, enrolmentsTable, "id", mutation.id, {
        status: mutation.status,
        updated_at: nowIso(),
      });
      await recordAuditEvent(context, "enrolment", mutation.id, "enrolment.status_updated", `Enrolment moved to ${mutation.status}.`);
      break;
    case "migrateWorkspaceSnapshot":
      await replaceWorkspaceSnapshot(organisationId, mutation.snapshot);
      await recordAuditEvent(context, "workspace", organisationId, "workspace.migrated", "Legacy browser workspace snapshot migrated into Supabase.");
      break;
    default:
      throw new LevyTateWorkspacePersistenceError("Mutation type is not supported.");
  }

  return getWorkspaceBootstrapForSession(session);
}

function buildFallbackMeta(session: LevyTateBetaSession, warnings: string[]): LevyTateWorkspaceMeta {
  return {
    organisationId: "local-fallback",
    organisationName: session.accessLevel === "beta_admin" ? "LevyTate Internal" : "LevyTate employer workspace",
    userEmail: session.email,
    userRole: session.accessLevel === "beta_admin" ? "Platform Admin" : "Employer Admin",
    storageMode: "local_fallback",
    warnings,
  };
}

async function ensureWorkspaceContext(session: LevyTateBetaSession): Promise<WorkspaceContext> {
  const config = assertSupabase();
  const seed = await deriveOrganisationSeed(session);
  const now = nowIso();

  const existingOrganisation = await selectOne<OrganisationRow>(
    organisationsTable,
    new URLSearchParams({
      select: "id,name,slug,workspace_name,primary_contact,contact_email,default_site,sites,departments,priorities,status,created_at,updated_at",
      slug: `eq.${seed.slug}`,
      limit: "1",
    }),
  );

  const organisation = existingOrganisation ?? await createOrganisation(seed);
  if (!existingOrganisation) {
    await seedOrganisationProviders(organisation.id);
  } else {
    await updateOrganisationDefaults(organisation.id, seed);
  }

  const existingUser = await selectOne<UserRow>(
    usersTable,
    new URLSearchParams({
      select: "id,organisation_id,email,role,access_level,auth_subject,last_login_at,created_at,updated_at",
      email: `eq.${session.email}`,
      limit: "1",
    }),
  );

  const nextUser: UserRow = existingUser
    ? {
        ...existingUser,
        organisation_id: organisation.id,
        role: seed.userRole,
        access_level: session.accessLevel,
        last_login_at: now,
        updated_at: now,
      }
    : {
        id: randomUUID(),
        organisation_id: organisation.id,
        email: session.email,
        role: seed.userRole,
        access_level: session.accessLevel,
        auth_subject: null,
        last_login_at: now,
        created_at: now,
        updated_at: now,
      };

  await supabaseInsert<UserRow>(config, usersTable, [nextUser], {
    query: "on_conflict=email",
    prefer: "resolution=merge-duplicates,return=representation",
  });

  const savedUser = await selectOne<UserRow>(
    usersTable,
    new URLSearchParams({
      select: "id,organisation_id,email,role,access_level,auth_subject,last_login_at,created_at,updated_at",
      email: `eq.${session.email}`,
      limit: "1",
    }),
  );

  if (!savedUser) {
    throw new LevyTateWorkspacePersistenceError("LevyTate user context could not be created.");
  }

  return {
    organisation: existingOrganisation ? { ...existingOrganisation, ...organisation } : organisation,
    user: savedUser,
    warnings: [],
  };
}

async function deriveOrganisationSeed(session: LevyTateBetaSession) {
  if (session.accessLevel === "beta_admin") {
    return {
      name: "LevyTate Internal",
      slug: "levytate-internal",
      workspaceName: "LevyTate internal workspace",
      primaryContact: "LevyTate Team",
      contactEmail: session.email,
      defaultSite: "",
      userRole: "Platform Admin" as const,
    };
  }

  const earlyAccessLead = await getEarlyAccessRequestByEmail(session.email);
  const employerName = earlyAccessLead?.organisation?.trim() || deriveEmployerNameFromEmail(session.email);
  const contactName = earlyAccessLead?.contactName?.trim() || session.email.split("@")[0];

  return {
    name: employerName,
    slug: slugify(employerName),
    workspaceName: `${employerName} workspace`,
    primaryContact: contactName,
    contactEmail: session.email,
    defaultSite: "",
    userRole: "Employer Admin" as const,
  };
}

async function createOrganisation(seed: {
  name: string;
  slug: string;
  workspaceName: string;
  primaryContact: string;
  contactEmail: string;
  defaultSite: string;
}) {
  const now = nowIso();
  const row: OrganisationRow = {
    id: randomUUID(),
    name: seed.name,
    slug: seed.slug,
    workspace_name: seed.workspaceName,
    primary_contact: seed.primaryContact,
    contact_email: seed.contactEmail,
    default_site: seed.defaultSite,
    sites: [],
    departments: [],
    priorities: [],
    status: "Active",
    created_at: now,
    updated_at: now,
  };

  const inserted = await supabaseInsert<OrganisationRow>(assertSupabase(), organisationsTable, [row], {
    query: "on_conflict=slug",
    prefer: "resolution=merge-duplicates,return=representation",
  });

  return inserted[0] ?? row;
}

async function updateOrganisationDefaults(
  organisationId: string,
  seed: {
    workspaceName: string;
    primaryContact: string;
    contactEmail: string;
    defaultSite: string;
  },
) {
  const current = await selectOne<OrganisationRow>(
    organisationsTable,
    new URLSearchParams({
      select: "id,workspace_name,primary_contact,contact_email,default_site",
      id: `eq.${organisationId}`,
      limit: "1",
    }),
  );

  if (!current) return;

  const needsPatch = !current.workspace_name || !current.primary_contact || !current.contact_email;
  if (!needsPatch) return;

  await supabaseUpdate(assertSupabase(), organisationsTable, `id=eq.${organisationId}`, {
    workspace_name: current.workspace_name || seed.workspaceName,
    primary_contact: current.primary_contact || seed.primaryContact,
    contact_email: current.contact_email || seed.contactEmail,
    default_site: current.default_site || seed.defaultSite,
    updated_at: nowIso(),
  });
}

async function seedOrganisationProviders(organisationId: string) {
  if (!mvpProviderCatalogue.length) return;

  const providerRows: ProviderRow[] = mvpProviderCatalogue.map((provider) => ({
    organisation_id: organisationId,
    provider_id: provider.providerId,
    provider_name: provider.providerName,
    website: provider.website,
    provider_type: provider.providerType,
    sectors: provider.sectors,
    delivery_model: provider.deliveryModel,
    regions: provider.regions,
    contact_name: provider.contactName,
    contact_email: provider.contactEmail,
    ofsted_rating: provider.ofstedRating,
    status: provider.status,
    source_urls: provider.sourceUrls,
    notes: provider.notes,
    last_verified: provider.lastVerified,
    verification_status: provider.verificationStatus,
  }));

  const programmeRows: ProviderProgrammeRow[] = mvpProviderProgrammes.map((programme) => ({
    organisation_id: organisationId,
    id: programme.id,
    provider_id: programme.providerId,
    apprenticeship_standard_id: programme.apprenticeshipStandardId,
    delivery_mode: programme.deliveryMode,
    regions: programme.regions,
    status: programme.status,
    verification_status: programme.verificationStatus,
    source_url: programme.sourceUrl,
    notes: programme.notes,
    record_status: programme.recordStatus,
    created_at: programme.createdAt,
    updated_at: programme.updatedAt,
  }));

  await supabaseInsert<ProviderRow>(assertSupabase(), providersTable, providerRows, {
    query: "on_conflict=organisation_id,provider_id",
    prefer: "resolution=merge-duplicates,return=minimal",
  });
  await supabaseInsert<ProviderProgrammeRow>(assertSupabase(), providerProgrammesTable, programmeRows, {
    query: "on_conflict=organisation_id,id",
    prefer: "resolution=merge-duplicates,return=minimal",
  });
}

async function loadWorkspaceData(organisationId: string): Promise<MvpWorkspaceData> {
  const [
    organisation,
    employees,
    employeeProfiles,
    roles,
    roleMappings,
    applications,
    applicationHistory,
    providers,
    providerProgrammes,
    providerRelationships,
    matchingRequests,
    enrolments,
  ] = await Promise.all([
    selectOne<OrganisationRow>(organisationsTable, new URLSearchParams({
      select: "id,name,slug,workspace_name,primary_contact,contact_email,default_site,sites,departments,priorities,status,created_at,updated_at",
      id: `eq.${organisationId}`,
      limit: "1",
    })),
    selectMany<EmployeeRow>(employeesTable, organisationId, "id,employee_number,name,email,job_title,role_id,manager_id,department,site,platform_role,status,start_date,created_at,updated_at", "name.asc"),
    selectMany<EmployeeDevelopmentProfileRow>(employeeProfilesTable, organisationId, "employee_id,stage,responsibilities,current_skills,business_functions,current_capabilities,apprenticeship_indicators,ai_opportunities,data_opportunities,automation_opportunities,future_capabilities,conversation_history,conversation_profile,recommendation_result,preferred_standard_id,updated_at", "updated_at.desc"),
    selectMany<RoleRow>(rolesTable, organisationId, "id,title,department,business_area,career_level,skills_tags,progression,status,created_at,updated_at", "title.asc"),
    selectMany<RoleMappingRow>(roleMappingsTable, organisationId, "id,role_id,apprenticeship_standard_id,recommendation_type,priority,business_rationale,funding_route,delivery_preference", "priority.asc"),
    selectMany<ApplicationRow>(applicationsTable, organisationId, "id,employee_id,apprenticeship_standard_id,status,current_owner,reason,career_goal,support_required,manager_note,submitted_at,updated_at", "submitted_at.desc"),
    selectMany<ApplicationHistoryRow>(applicationHistoryTable, organisationId, "id,application_id,status,owner,note,created_at", "created_at.asc"),
    selectMany<ProviderRow>(providersTable, organisationId, "provider_id,provider_name,website,provider_type,sectors,delivery_model,regions,contact_name,contact_email,ofsted_rating,status,source_urls,notes,last_verified,verification_status", "provider_name.asc"),
    selectMany<ProviderProgrammeRow>(providerProgrammesTable, organisationId, "id,provider_id,apprenticeship_standard_id,delivery_mode,regions,status,verification_status,source_url,notes,record_status,created_at,updated_at", "created_at.asc"),
    selectMany<ProviderRelationshipRow>(providerRelationshipsTable, organisationId, "id,category,preferred_provider_id,backup_provider_ids,apprenticeship_standard_ids,status,notes,review_date,last_used_date", "review_date.asc"),
    selectMany<MatchingRequestRow>(matchingRequestsTable, organisationId, "id,role_need,apprenticeship_standard_id,learner_count,sites,delivery_preference,funding_position,urgency,notes,status,shortlist_provider_ids,created_at,updated_at", "created_at.desc"),
    selectMany<EnrolmentRow>(enrolmentsTable, organisationId, "id,application_id,employee_id,provider_id,apprenticeship_standard_id,status,start_date,notes,created_at,updated_at", "created_at.desc"),
  ]);

  const workspace = createEmptyMvpWorkspace();

  if (organisation) {
    workspace.profile = organisationToProfile(organisation);
  }

  workspace.employees = employees.map(employeeRowToRecord);
  workspace.employeeDevelopmentProfiles = employeeProfiles.map(employeeProfileRowToRecord);
  workspace.roles = roles.map((role) => roleRowToRecord(role, roleMappings.filter((mapping) => mapping.role_id === role.id)));
  workspace.applications = applications.map((application) => applicationRowToRecord(application, applicationHistory.filter((entry) => entry.application_id === application.id)));
  workspace.providers = providers.map(providerRowToRecord);
  workspace.providerProgrammes = providerProgrammes.map(providerProgrammeRowToRecord);
  workspace.providerRelationships = providerRelationships.map(providerRelationshipRowToRecord);
  workspace.matchingRequests = matchingRequests.map(matchingRequestRowToRecord);
  workspace.enrolments = enrolments.map(enrolmentRowToRecord);

  return workspace;
}

async function saveProfile(organisationId: string, profile: MvpWorkspaceProfile) {
  await supabaseUpdate(assertSupabase(), organisationsTable, `id=eq.${organisationId}`, {
    name: profile.employerName.trim() || "LevyTate employer workspace",
    workspace_name: profile.workspaceName.trim() || `${profile.employerName.trim() || "LevyTate employer"} workspace`,
    primary_contact: profile.primaryContact.trim(),
    contact_email: profile.contactEmail.trim(),
    default_site: profile.defaultSite.trim(),
    sites: profile.sites,
    departments: profile.departments,
    priorities: profile.priorities,
    updated_at: nowIso(),
  });
}

async function saveEmployee(organisationId: string, employee: MvpEmployee) {
  const row: EmployeeRow = {
    organisation_id: organisationId,
    id: employee.id,
    employee_number: employee.employeeNumber,
    name: employee.name,
    email: employee.email,
    job_title: employee.jobTitle,
    role_id: employee.roleId,
    manager_id: employee.managerId,
    department: employee.department,
    site: employee.site,
    platform_role: employee.platformRole,
    status: employee.status,
    start_date: employee.startDate,
    created_at: employee.createdAt,
    updated_at: employee.updatedAt,
  };

  await supabaseInsert<EmployeeRow>(assertSupabase(), employeesTable, [row], {
    query: "on_conflict=organisation_id,id",
    prefer: "resolution=merge-duplicates,return=minimal",
  });
}

async function saveEmployeeDevelopmentProfile(organisationId: string, profile: MvpEmployeeDevelopmentProfile) {
  const row: EmployeeDevelopmentProfileRow = {
    organisation_id: organisationId,
    employee_id: profile.employeeId,
    stage: profile.stage,
    responsibilities: profile.responsibilities,
    current_skills: profile.currentSkills,
    business_functions: profile.businessFunctions,
    current_capabilities: profile.currentCapabilities,
    apprenticeship_indicators: profile.apprenticeshipIndicators,
    ai_opportunities: profile.aiOpportunities,
    data_opportunities: profile.dataOpportunities,
    automation_opportunities: profile.automationOpportunities,
    future_capabilities: profile.futureCapabilities,
    conversation_history: profile.conversationHistory,
    conversation_profile: profile.conversationProfile,
    recommendation_result: profile.recommendationResult,
    preferred_standard_id: profile.preferredStandardId,
    updated_at: profile.updatedAt,
  };

  await supabaseInsert<EmployeeDevelopmentProfileRow>(assertSupabase(), employeeProfilesTable, [row], {
    query: "on_conflict=organisation_id,employee_id",
    prefer: "resolution=merge-duplicates,return=minimal",
  });
}

async function saveRole(organisationId: string, role: MvpRole) {
  const row: RoleRow = {
    organisation_id: organisationId,
    id: role.id,
    title: role.title,
    department: role.department,
    business_area: role.businessArea,
    career_level: role.careerLevel,
    skills_tags: role.skillsTags,
    progression: role.progression,
    status: role.status,
    created_at: role.createdAt,
    updated_at: role.updatedAt,
  };

  await supabaseInsert<RoleRow>(assertSupabase(), rolesTable, [row], {
    query: "on_conflict=organisation_id,id",
    prefer: "resolution=merge-duplicates,return=minimal",
  });

  await supabaseDelete(assertSupabase(), roleMappingsTable, buildOrganisationQuery(organisationId, { role_id: role.id }));
  if (role.pathwayMappings.length) {
    const mappings: RoleMappingRow[] = role.pathwayMappings.map((mapping) => ({
      organisation_id: organisationId,
      id: mapping.id,
      role_id: role.id,
      apprenticeship_standard_id: mapping.apprenticeshipStandardId,
      recommendation_type: mapping.recommendationType,
      priority: mapping.priority,
      business_rationale: mapping.businessRationale,
      funding_route: mapping.fundingRoute,
      delivery_preference: mapping.deliveryPreference,
    }));
    await supabaseInsert<RoleMappingRow>(assertSupabase(), roleMappingsTable, mappings, {
      query: "on_conflict=organisation_id,id",
      prefer: "resolution=merge-duplicates,return=minimal",
    });
  }
}

async function saveApplication(organisationId: string, application: MvpApplication) {
  const row: ApplicationRow = {
    organisation_id: organisationId,
    id: application.id,
    employee_id: application.employeeId,
    apprenticeship_standard_id: application.apprenticeshipStandardId,
    status: application.status,
    current_owner: application.currentOwner,
    reason: application.reason,
    career_goal: application.careerGoal,
    support_required: application.supportRequired,
    manager_note: application.managerNote,
    submitted_at: application.submittedAt,
    updated_at: application.updatedAt,
  };

  await supabaseInsert<ApplicationRow>(assertSupabase(), applicationsTable, [row], {
    query: "on_conflict=organisation_id,id",
    prefer: "resolution=merge-duplicates,return=minimal",
  });

  await supabaseDelete(assertSupabase(), applicationHistoryTable, buildOrganisationQuery(organisationId, { application_id: application.id }));
  if (application.history.length) {
    const historyRows: ApplicationHistoryRow[] = application.history.map((entry) => ({
      organisation_id: organisationId,
      id: entry.id,
      application_id: application.id,
      status: entry.status,
      owner: entry.owner,
      note: entry.note,
      created_at: entry.createdAt,
    }));
    await supabaseInsert<ApplicationHistoryRow>(assertSupabase(), applicationHistoryTable, historyRows, {
      query: "on_conflict=organisation_id,id",
      prefer: "resolution=merge-duplicates,return=minimal",
    });
  }
}

async function updateApplicationStatus(organisationId: string, id: string, status: RequestStatus, note?: string) {
  const current = await selectOne<ApplicationRow>(
    applicationsTable,
    new URLSearchParams({
      select: "id,employee_id,apprenticeship_standard_id,status,current_owner,reason,career_goal,support_required,manager_note,submitted_at,updated_at",
      organisation_id: `eq.${organisationId}`,
      id: `eq.${id}`,
      limit: "1",
    }),
  );

  if (!current) {
    throw new LevyTateWorkspacePersistenceError("Application record could not be found.");
  }

  await patchByOrganisation(organisationId, applicationsTable, "id", id, {
    status,
    current_owner: applicationOwnerForStatus(status),
    manager_note: note ?? current.manager_note,
    updated_at: nowIso(),
  });

  const historyEntry = buildApplicationHistoryEntry(status, note ?? `Status updated to ${status}.`);
  const historyRow: ApplicationHistoryRow = {
    organisation_id: organisationId,
    id: historyEntry.id,
    application_id: id,
    status: historyEntry.status,
    owner: historyEntry.owner,
    note: historyEntry.note,
    created_at: historyEntry.createdAt,
  };

  await supabaseInsert<ApplicationHistoryRow>(assertSupabase(), applicationHistoryTable, [historyRow], {
    query: "on_conflict=organisation_id,id",
    prefer: "resolution=merge-duplicates,return=minimal",
  });
}

async function saveProvider(organisationId: string, provider: ProviderCatalogueRecord) {
  const row: ProviderRow = {
    organisation_id: organisationId,
    provider_id: provider.providerId,
    provider_name: provider.providerName,
    website: provider.website,
    provider_type: provider.providerType,
    sectors: provider.sectors,
    delivery_model: provider.deliveryModel,
    regions: provider.regions,
    contact_name: provider.contactName,
    contact_email: provider.contactEmail,
    ofsted_rating: provider.ofstedRating,
    status: provider.status,
    source_urls: provider.sourceUrls,
    notes: provider.notes,
    last_verified: provider.lastVerified,
    verification_status: provider.verificationStatus,
  };

  await supabaseInsert<ProviderRow>(assertSupabase(), providersTable, [row], {
    query: "on_conflict=organisation_id,provider_id",
    prefer: "resolution=merge-duplicates,return=minimal",
  });
}

async function saveProviderProgramme(organisationId: string, programme: ProviderProgramme) {
  const row: ProviderProgrammeRow = {
    organisation_id: organisationId,
    id: programme.id,
    provider_id: programme.providerId,
    apprenticeship_standard_id: programme.apprenticeshipStandardId,
    delivery_mode: programme.deliveryMode,
    regions: programme.regions,
    status: programme.status,
    verification_status: programme.verificationStatus,
    source_url: programme.sourceUrl,
    notes: programme.notes,
    record_status: programme.recordStatus,
    created_at: programme.createdAt,
    updated_at: programme.updatedAt,
  };

  await supabaseInsert<ProviderProgrammeRow>(assertSupabase(), providerProgrammesTable, [row], {
    query: "on_conflict=organisation_id,id",
    prefer: "resolution=merge-duplicates,return=minimal",
  });
}

async function saveProviderRelationship(organisationId: string, relationship: MvpProviderRelationship) {
  const row: ProviderRelationshipRow = {
    organisation_id: organisationId,
    id: relationship.id,
    category: relationship.category,
    preferred_provider_id: relationship.preferredProviderId,
    backup_provider_ids: relationship.backupProviderIds,
    apprenticeship_standard_ids: relationship.apprenticeshipStandardIds,
    status: relationship.status,
    notes: relationship.notes,
    review_date: relationship.reviewDate,
    last_used_date: relationship.lastUsedDate,
  };

  await supabaseInsert<ProviderRelationshipRow>(assertSupabase(), providerRelationshipsTable, [row], {
    query: "on_conflict=organisation_id,id",
    prefer: "resolution=merge-duplicates,return=minimal",
  });
}

async function saveMatchingRequest(organisationId: string, request: MvpMatchingRequest) {
  const row: MatchingRequestRow = {
    organisation_id: organisationId,
    id: request.id,
    role_need: request.roleNeed,
    apprenticeship_standard_id: request.apprenticeshipStandardId,
    learner_count: request.learnerCount,
    sites: request.sites,
    delivery_preference: request.deliveryPreference,
    funding_position: request.fundingPosition,
    urgency: request.urgency,
    notes: request.notes,
    status: request.status,
    shortlist_provider_ids: request.shortlistProviderIds,
    created_at: request.createdAt,
    updated_at: request.updatedAt,
  };

  await supabaseInsert<MatchingRequestRow>(assertSupabase(), matchingRequestsTable, [row], {
    query: "on_conflict=organisation_id,id",
    prefer: "resolution=merge-duplicates,return=minimal",
  });
}

async function saveEnrolment(organisationId: string, enrolment: MvpEnrolment) {
  const row: EnrolmentRow = {
    organisation_id: organisationId,
    id: enrolment.id,
    application_id: enrolment.applicationId,
    employee_id: enrolment.employeeId,
    provider_id: enrolment.providerId,
    apprenticeship_standard_id: enrolment.apprenticeshipStandardId,
    status: enrolment.status,
    start_date: enrolment.startDate,
    notes: enrolment.notes,
    created_at: enrolment.createdAt,
    updated_at: enrolment.updatedAt,
  };

  await supabaseInsert<EnrolmentRow>(assertSupabase(), enrolmentsTable, [row], {
    query: "on_conflict=organisation_id,id",
    prefer: "resolution=merge-duplicates,return=minimal",
  });
}

async function replaceWorkspaceSnapshot(organisationId: string, snapshot: MvpWorkspaceData) {
  await saveProfile(organisationId, snapshot.profile);

  await purgeWorkspace(organisationId);

  if (snapshot.employees.length) {
    for (const employee of snapshot.employees) {
      await saveEmployee(organisationId, employee);
    }
  }
  if (snapshot.employeeDevelopmentProfiles.length) {
    for (const profile of snapshot.employeeDevelopmentProfiles) {
      await saveEmployeeDevelopmentProfile(organisationId, profile);
    }
  }
  if (snapshot.roles.length) {
    for (const role of snapshot.roles) {
      await saveRole(organisationId, role);
    }
  }
  if (snapshot.applications.length) {
    for (const application of snapshot.applications) {
      await saveApplication(organisationId, application);
    }
  }
  if (snapshot.providers.length) {
    for (const provider of snapshot.providers) {
      await saveProvider(organisationId, provider);
    }
  }
  if (snapshot.providerProgrammes.length) {
    for (const programme of snapshot.providerProgrammes) {
      await saveProviderProgramme(organisationId, programme);
    }
  }
  if (snapshot.providerRelationships.length) {
    for (const relationship of snapshot.providerRelationships) {
      await saveProviderRelationship(organisationId, relationship);
    }
  }
  if (snapshot.matchingRequests.length) {
    for (const request of snapshot.matchingRequests) {
      await saveMatchingRequest(organisationId, request);
    }
  }
  if (snapshot.enrolments.length) {
    for (const enrolment of snapshot.enrolments) {
      await saveEnrolment(organisationId, enrolment);
    }
  }
}

async function purgeWorkspace(organisationId: string) {
  const config = assertSupabase();
  await supabaseDelete(config, applicationHistoryTable, buildOrganisationQuery(organisationId));
  await supabaseDelete(config, applicationsTable, buildOrganisationQuery(organisationId));
  await supabaseDelete(config, employeeProfilesTable, buildOrganisationQuery(organisationId));
  await supabaseDelete(config, roleMappingsTable, buildOrganisationQuery(organisationId));
  await supabaseDelete(config, rolesTable, buildOrganisationQuery(organisationId));
  await supabaseDelete(config, enrolmentsTable, buildOrganisationQuery(organisationId));
  await supabaseDelete(config, matchingRequestsTable, buildOrganisationQuery(organisationId));
  await supabaseDelete(config, providerRelationshipsTable, buildOrganisationQuery(organisationId));
  await supabaseDelete(config, providerProgrammesTable, buildOrganisationQuery(organisationId));
  await supabaseDelete(config, providersTable, buildOrganisationQuery(organisationId));
  await supabaseDelete(config, employeesTable, buildOrganisationQuery(organisationId));
}

async function recordAuditEvent(
  context: WorkspaceContext,
  entityType: string,
  entityId: string,
  action: string,
  summary: string,
  metadata: Record<string, unknown> = {},
) {
  const row: AuditEventRow = {
    id: randomUUID(),
    organisation_id: context.organisation.id,
    actor_email: context.user.email,
    actor_role: context.user.role,
    entity_type: entityType,
    entity_id: entityId,
    action,
    summary,
    metadata,
    created_at: nowIso(),
  };

  await supabaseInsert<AuditEventRow>(assertSupabase(), auditEventsTable, [row], {
    query: "on_conflict=id",
    prefer: "resolution=merge-duplicates,return=minimal",
  });
}

async function toggleArchive(
  organisationId: string,
  table: string,
  key: string,
  value: string,
  statusField: string,
) {
  const row = await selectOne<Record<string, unknown>>(
    table,
    new URLSearchParams({
      select: `${key},${statusField}`,
      organisation_id: `eq.${organisationId}`,
      [key]: `eq.${value}`,
      limit: "1",
    }),
  );

  if (!row) {
    throw new LevyTateWorkspacePersistenceError("Record could not be found.");
  }

  const current = typeof row[statusField] === "string" ? row[statusField] : "Active";
  const next = current === "Archived" ? "Active" : "Archived";
  await patchByOrganisation(organisationId, table, key, value, {
    [statusField]: next,
    updated_at: nowIso(),
  });
}

async function patchByOrganisation(
  organisationId: string,
  table: string,
  key: string,
  value: string,
  payload: Record<string, unknown>,
) {
  await supabaseUpdate(assertSupabase(), table, buildOrganisationQuery(organisationId, { [key]: value }), payload, {
    prefer: "return=minimal",
  });
}

async function selectOne<T>(table: string, query: URLSearchParams) {
  const rows = await supabaseSelect<T>(assertSupabase(), table, query);
  return rows[0] ?? null;
}

async function selectMany<T>(table: string, organisationId: string, select: string, order: string) {
  return supabaseSelect<T>(assertSupabase(), table, new URLSearchParams({
    select,
    organisation_id: `eq.${organisationId}`,
    order,
  }));
}

function buildOrganisationQuery(organisationId: string, extra: Record<string, string> = {}) {
  const query = new URLSearchParams({
    organisation_id: `eq.${organisationId}`,
  });

  for (const [key, value] of Object.entries(extra)) {
    query.set(key, `eq.${value}`);
  }

  return query.toString();
}

function organisationToProfile(row: OrganisationRow): MvpWorkspaceProfile {
  return {
    employerName: row.name,
    workspaceName: row.workspace_name ?? `${row.name} workspace`,
    primaryContact: row.primary_contact ?? "",
    contactEmail: row.contact_email ?? "",
    defaultSite: row.default_site ?? "",
    sites: stringArray(row.sites),
    departments: stringArray(row.departments),
    priorities: objectArray(row.priorities),
  };
}

function employeeRowToRecord(row: EmployeeRow): MvpEmployee {
  return {
    id: row.id,
    employeeNumber: row.employee_number,
    name: row.name,
    email: row.email,
    jobTitle: row.job_title,
    roleId: row.role_id,
    managerId: row.manager_id,
    department: row.department,
    site: row.site,
    platformRole: row.platform_role,
    status: row.status,
    startDate: row.start_date,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function employeeProfileRowToRecord(row: EmployeeDevelopmentProfileRow): MvpEmployeeDevelopmentProfile {
  return {
    employeeId: row.employee_id,
    stage: row.stage,
    responsibilities: stringArray(row.responsibilities),
    currentSkills: stringArray(row.current_skills),
    businessFunctions: stringArray(row.business_functions),
    currentCapabilities: stringArray(row.current_capabilities),
    apprenticeshipIndicators: stringArray(row.apprenticeship_indicators),
    aiOpportunities: stringArray(row.ai_opportunities),
    dataOpportunities: stringArray(row.data_opportunities),
    automationOpportunities: stringArray(row.automation_opportunities),
    futureCapabilities: stringArray(row.future_capabilities),
    conversationHistory: objectArray(row.conversation_history),
    conversationProfile: objectValue(row.conversation_profile),
    recommendationResult: objectValue(row.recommendation_result),
    preferredStandardId: row.preferred_standard_id,
    updatedAt: row.updated_at,
  };
}

function roleRowToRecord(row: RoleRow, mappings: RoleMappingRow[]): MvpRole {
  return {
    id: row.id,
    title: row.title,
    department: row.department,
    businessArea: row.business_area,
    careerLevel: row.career_level,
    skillsTags: stringArray(row.skills_tags),
    progression: stringArray(row.progression),
    pathwayMappings: mappings.map((mapping) => ({
      id: mapping.id,
      apprenticeshipStandardId: mapping.apprenticeship_standard_id,
      recommendationType: mapping.recommendation_type,
      priority: mapping.priority,
      businessRationale: mapping.business_rationale,
      fundingRoute: mapping.funding_route,
      deliveryPreference: mapping.delivery_preference,
    })),
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function applicationRowToRecord(row: ApplicationRow, historyRows: ApplicationHistoryRow[]): MvpApplication {
  return {
    id: row.id,
    employeeId: row.employee_id,
    apprenticeshipStandardId: row.apprenticeship_standard_id,
    status: row.status,
    currentOwner: row.current_owner,
    reason: row.reason,
    careerGoal: row.career_goal,
    supportRequired: row.support_required,
    managerNote: row.manager_note,
    submittedAt: row.submitted_at,
    updatedAt: row.updated_at,
    history: historyRows.map((entry) => ({
      id: entry.id,
      status: entry.status,
      owner: entry.owner,
      note: entry.note,
      createdAt: entry.created_at,
    })),
  };
}

function providerRowToRecord(row: ProviderRow): ProviderCatalogueRecord {
  return {
    providerId: row.provider_id,
    providerName: row.provider_name,
    website: row.website,
    providerType: row.provider_type,
    sectors: stringArray(row.sectors),
    deliveryModel: stringArray(row.delivery_model),
    regions: stringArray(row.regions),
    contactName: row.contact_name,
    contactEmail: row.contact_email,
    ofstedRating: row.ofsted_rating,
    status: row.status,
    sourceUrls: stringArray(row.source_urls),
    notes: row.notes,
    lastVerified: row.last_verified,
    verificationStatus: row.verification_status,
  };
}

function providerProgrammeRowToRecord(row: ProviderProgrammeRow): ProviderProgramme {
  return {
    id: row.id,
    providerId: row.provider_id,
    apprenticeshipStandardId: row.apprenticeship_standard_id,
    deliveryMode: row.delivery_mode,
    regions: stringArray(row.regions),
    status: row.status,
    verificationStatus: row.verification_status,
    sourceUrl: row.source_url,
    notes: row.notes,
    recordStatus: row.record_status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function providerRelationshipRowToRecord(row: ProviderRelationshipRow): MvpProviderRelationship {
  return {
    id: row.id,
    category: row.category,
    preferredProviderId: row.preferred_provider_id,
    backupProviderIds: stringArray(row.backup_provider_ids),
    apprenticeshipStandardIds: stringArray(row.apprenticeship_standard_ids),
    status: row.status,
    notes: row.notes,
    reviewDate: row.review_date,
    lastUsedDate: row.last_used_date,
  };
}

function matchingRequestRowToRecord(row: MatchingRequestRow): MvpMatchingRequest {
  return {
    id: row.id,
    roleNeed: row.role_need,
    apprenticeshipStandardId: row.apprenticeship_standard_id,
    learnerCount: row.learner_count,
    sites: stringArray(row.sites),
    deliveryPreference: row.delivery_preference,
    fundingPosition: row.funding_position,
    urgency: row.urgency,
    notes: row.notes,
    status: row.status,
    shortlistProviderIds: stringArray(row.shortlist_provider_ids),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function enrolmentRowToRecord(row: EnrolmentRow): MvpEnrolment {
  return {
    id: row.id,
    applicationId: row.application_id,
    employeeId: row.employee_id,
    providerId: row.provider_id,
    apprenticeshipStandardId: row.apprenticeship_standard_id,
    status: row.status,
    startDate: row.start_date,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function stringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function objectArray<T = Record<string, unknown>>(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value as T[];
}

function objectValue<T = Record<string, unknown> | null>(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null as T;
  return value as T;
}

function slugify(value: string) {
  const base = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return base || "levytate-employer";
}

function deriveEmployerNameFromEmail(email: string) {
  const domain = email.split("@")[1] ?? "employer";
  const brand = domain.split(".")[0] ?? "employer";
  return brand
    .split(/[-_]/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ") || "LevyTate employer";
}

function assertSupabase() {
  const config = getLevyTateSupabaseConfig();
  if (!config) {
    throw new LevyTateWorkspacePersistenceError("Supabase environment variables are not configured.");
  }
  return config;
}




