import { randomUUID } from "node:crypto";
import { listManagerDirectReportOperationalSummaries } from "@/lib/server/levytate-manager-operational-summaries";
import type {
  ProviderCatalogueRecord,
  ProviderProgramme,
  RequestStatus,
} from "@/lib/levytate/domain";
import {
  serialiseProgrammeRecordNotes,
  serialiseProviderRecordNotes,
} from "@/lib/levytate/domain";
import type { LevyTateBetaSession } from "@/lib/levytate/config/beta-access";
import type { LevyTateWorkspaceBootstrap, LevyTateWorkspaceMeta, LevyTateWorkspaceMutation } from "@/lib/levytate/mvp/api";
import {
  activeApplicationStatuses,
  applicationOwnerForStatus,
  buildApplicationHistoryEntry,
  createEmptyMvpWorkspace,
  normaliseMatchingRequest,
  normaliseProviderProgramme,
  normaliseProviderRecord,
  normaliseProviderRelationship,
  nowIso,
  type MvpApplication,
  type MvpApplicationHistoryEntry,
  type MvpEmployee,
  type MvpEmployeeDevelopmentProfile,
  type MvpEnrolment,
  type MvpMatchingRequest,
  type MvpOrganisationProgramme,
  type MvpOrganisationProvider,
  type MvpPathwayMapping,
  type MvpProviderRelationship,
  type MvpRole,
  type MvpWorkspaceData,
  type MvpWorkspaceProfile,
} from "@/lib/levytate/mvp/workspace";
import {
  canRunMvpMutation,
  hasMvpPermission,
  normaliseMvpUserRole,
  permissionsForMvpRole,
} from "@/lib/levytate/mvp/rbac";
import { getCoreEarlyAccessPolicy, hasCoreEarlyAccessCapability } from "@/lib/levytate/core-early-access-policy";
import {
  getLevyTateSupabaseConfig,
  supabaseDelete,
  supabaseInsert,
  supabaseSelect,
  supabaseUpdate,
} from "@/lib/server/levytate-supabase";
import { getEarlyAccessRequestByEmail } from "@/lib/server/levytate-early-access";
import { getPersistentEarlyAccessState } from "@/lib/server/levytate-beta-access-grants";
import { getProspectAccessForSession } from "@/lib/server/levytate-prospect-access";
import { synchroniseApplicationReviewOperationalActions } from "@/lib/server/levytate-operational-actions";
import { getOrganisationLearnerLifecycleCollectionsForWorkspace } from "@/lib/server/levytate-learner-lifecycle";
import { isBetaApprovedEarlyAccessStatus } from "@/lib/levytate/early-access/domain";
import { isRequestsEnabledForOrganisation } from "@/lib/server/levytate-request-capability";

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
  logo_reference?: string | null;
  workspace_template?: string | null;
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
  display_name?: string | null;
  active?: boolean | null;
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
  industries: unknown;
  technologies: unknown;
  delivery_models: unknown;
  regions: unknown;
  employer_types: unknown;
  specialisms: unknown;
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
  programme_name: string;
  short_description: string;
  full_description: string;
  status: ProviderProgramme["status"];
  verification_status: ProviderProgramme["verificationStatus"];
  target_organisations: unknown;
  target_industries: unknown;
  target_job_roles: unknown;
  seniority: ProviderProgramme["seniority"];
  employer_size: ProviderProgramme["employerSize"];
  business_problems_solved: unknown;
  skills_developed: unknown;
  technologies_covered: unknown;
  expected_outcomes: unknown;
  delivery_models: unknown;
  regions: unknown;
  duration: string;
  cohort_options: unknown;
  commercial_notes: string;
  apprenticeship_standard_id: string;
  linked_standard_id?: string | null;
  linked_standard_ids: unknown;
  linked_standard_name: string;
  level?: number | null;
  route: string;
  funding_band?: number | null;
  official_url: string;
  source_url: string;
  notes: string;
  funding_route: ProviderProgramme["fundingRoute"];
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
  apprenticeship_standard_ids?: unknown;
  programme_ids: unknown;
  status: MvpProviderRelationship["status"];
  notes: string;
  review_date: string;
  last_used_date: string;
};

type OrganisationProviderRow = {
  organisation_id: string;
  provider_id: string;
  status: MvpOrganisationProvider["status"];
  selected_by?: string;
  selected_at: string;
  updated_at: string;
};

type OrganisationProgrammeRow = {
  organisation_id: string;
  programme_id: string;
  provider_id: string;
  status: MvpOrganisationProgramme["status"];
  selected_by?: string;
  selected_at: string;
  updated_at: string;
};

type MatchingRequestRow = {
  organisation_id: string;
  id: string;
  role_need: string;
  department: string;
  future_capability: string;
  employer_size: string;
  programme_id: string;
  linked_standard_id: string;
  learner_count: number;
  sites: unknown;
  delivery_preference: string;
  funding_position: string;
  urgency: string;
  notes: string;
  business_problems: unknown;
  target_roles: unknown;
  technologies: unknown;
  industries: unknown;
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
const organisationProvidersTable = "levytate_organisation_providers";
const organisationProgrammesTable = "levytate_organisation_programmes";
const matchingRequestsTable = "levytate_matching_requests";
const enrolmentsTable = "levytate_enrolments";
const auditEventsTable = "levytate_audit_events";
const lineManagerReviewStatuses: RequestStatus[] = ["Submitted to Line Manager", "Awaiting Manager Review"];
const lineManagerDecisionStatuses: RequestStatus[] = ["Approved by Line Manager", "More information requested", "Declined by Line Manager"];

export class LevyTateWorkspacePersistenceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LevyTateWorkspacePersistenceError";
  }
}

export class LevyTateWorkspacePermissionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LevyTateWorkspacePermissionError";
  }
}

export async function getWorkspaceBootstrapForSession(session: LevyTateBetaSession): Promise<LevyTateWorkspaceBootstrap> {
  const config = getLevyTateSupabaseConfig();

  if (!config) {
    throw new LevyTateWorkspacePersistenceError("Supabase environment variables are not configured.");
  }

  try {
    const context = await ensureWorkspaceContext(session);
    await assertWorkspaceReadAllowed(context);
    const [data, requestsEnabled] = await Promise.all([
      loadWorkspaceData(context, session),
      isRequestsEnabledForOrganisation(context.organisation.id),
    ]);
    const userRole = normaliseMvpUserRole(context.user.role);
    const prospectAccess = await getProspectAccessForSession(session);
    const warnings = [...context.warnings];
    let directReportOperationalSummaries;
    if (userRole === "Line Manager") {
      try {
        directReportOperationalSummaries = await listManagerDirectReportOperationalSummaries(session, data);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown direct-report summary error.";
        warnings.push(`Current learner summaries could not be loaded. ${message}`);
      }
    }

    return {
      data,
      meta: {
        organisationId: context.organisation.id,
        organisationName: context.organisation.name,
        userEmail: session.email,
        userRole,
        permissions: permissionsForMvpRole(context.user.role),
        coreEarlyAccess: getCoreEarlyAccessPolicy(userRole, { requestsEnabled }),
        requestsEnabled,
        directReportOperationalSummaries,
        prospectAccess: prospectAccess ? {
          id: prospectAccess.id,
          status: prospectAccess.status,
          statusLabel: prospectAccess.statusLabel,
          accessStartAt: prospectAccess.accessStartAt,
          accessExpiresAt: prospectAccess.accessExpiresAt,
          firstLoginAt: prospectAccess.firstLoginAt,
          guidanceCompletedAt: prospectAccess.guidanceCompletedAt,
          version: prospectAccess.version,
        } : null,
        storageMode: "supabase",
        warnings,
      },
    };
  } catch (error) {
    if (error instanceof LevyTateWorkspacePermissionError) {
      throw error;
    }

    const message = error instanceof Error ? error.message : "Unknown Supabase workspace bootstrap error.";
    throw new LevyTateWorkspacePersistenceError(`Supabase workspace bootstrap failed. ${message}`);
  }
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
  await assertMutationAllowed(context, mutation);

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
      await synchroniseApplicationReviewOperationalActions(session, [mutation.application.id]);
      await recordAuditEvent(context, "application", mutation.application.id, "application.saved", "Application record saved.");
      break;
    case "updateApplicationStatus":
      await updateApplicationStatus(organisationId, mutation.id, mutation.status, mutation.note);
      await synchroniseApplicationReviewOperationalActions(session, [mutation.id]);
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
    case "saveOrganisationProvider":
      await saveOrganisationProviderSelection(context, mutation.selection);
      await recordAuditEvent(context, "organisation_provider", mutation.selection.providerId, "organisation_provider.saved", `Organisation provider selection set to ${mutation.selection.status}.`);
      break;
    case "saveOrganisationProgramme":
      await saveOrganisationProgrammeSelection(context, mutation.selection);
      await recordAuditEvent(context, "organisation_programme", mutation.selection.programmeId, "organisation_programme.saved", `Organisation programme selection set to ${mutation.selection.status}.`);
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
    default:
      throw new LevyTateWorkspacePersistenceError("Mutation type is not supported.");
  }

  return getWorkspaceBootstrapForSession(session);
}

async function assertMutationAllowed(context: WorkspaceContext, mutation: LevyTateWorkspaceMutation) {
  const role = normaliseMvpUserRole(context.user.role);
  if (role === "Platform Admin") {
    const workspaceAdministration = mutation.type === "saveProfile";
    const providerCatalogueAdministration = ["saveProvider", "archiveProvider", "saveProviderProgramme", "archiveProviderProgramme", "removeProviderProgramme"].includes(mutation.type);
    if (
      (!workspaceAdministration || !hasCoreEarlyAccessCapability(role, "platform-workspace-administration")) &&
      (!providerCatalogueAdministration || !hasCoreEarlyAccessCapability(role, "platform-provider-catalogue"))
    ) {
      throw new LevyTateWorkspacePermissionError("Platform Admin cannot perform employer operational mutations.");
    }
  }
  if (!canRunMvpMutation(context.user.role, mutation.type)) {
    throw new LevyTateWorkspacePermissionError(
      `${normaliseMvpUserRole(context.user.role)} cannot perform ${mutation.type}.`,
    );
  }

  if (mutation.type === "saveApplication") {
    await assertOneActiveApplication(context.organisation.id, mutation.application);
  }

  if (role === "Employer Admin" || role === "Apprenticeship Lead") return;

  const employees = await selectMany<EmployeeRow>(
    employeesTable,
    context.organisation.id,
    "id,email,manager_id,status,employee_number,name,job_title,role_id,department,site,platform_role,start_date,created_at,updated_at",
    "name.asc",
  );
  const currentEmployee = employees.find((employee) =>
    employee.status === "Active" && employee.email.trim().toLowerCase() === context.user.email.trim().toLowerCase()
  );
  const visibleEmployeeIds = readableEmployeeIdsForUser(context.user.email, role, employees);

  if (visibleEmployeeIds.size === 0) {
    throw new LevyTateWorkspacePermissionError("Your user account is not linked to an active employee record.");
  }

  const assertCanAccessEmployee = (employeeId: string) => {
    if (visibleEmployeeIds.has(employeeId)) return;
    throw new LevyTateWorkspacePermissionError("You cannot access that employee record.");
  };

  switch (mutation.type) {
    case "saveEmployeeDevelopmentProfile":
      assertCanAccessEmployee(mutation.profile.employeeId);
      return;
    case "saveApplication":
      assertCanAccessEmployee(mutation.application.employeeId);
      await assertEmployeeCanSaveApplication(context.organisation.id, mutation.application, role, employees);
      return;
    case "updateApplicationStatus": {
      const application = await selectOne<ApplicationRow>(applicationsTable, new URLSearchParams({
        select: "id,employee_id,status,current_owner",
        organisation_id: `eq.${context.organisation.id}`,
        id: `eq.${mutation.id}`,
        limit: "1",
      }));
      if (!application) {
        throw new LevyTateWorkspacePermissionError("Application record was not found.");
      }
      assertCanAccessEmployee(application.employee_id);
      if (role === "Line Manager") {
        assertLineManagerCanUpdateApplication(currentEmployee, application, mutation.status, mutation.note);
      }
      return;
    }
    default:
      return;
  }
}

async function assertOneActiveApplication(organisationId: string, application: MvpApplication) {
  if (!activeApplicationStatuses().includes(application.status)) return;

  const applications = await selectMany<ApplicationRow>(
    applicationsTable,
    organisationId,
    "id,employee_id,status",
    "updated_at.desc",
  );

  const existingActive = applications.find((item) =>
    item.employee_id === application.employeeId &&
    item.id !== application.id &&
    activeApplicationStatuses().includes(item.status)
  );

  if (existingActive) {
    throw new LevyTateWorkspacePermissionError("This employee already has an active apprenticeship application.");
  }
}

async function assertEmployeeCanSaveApplication(
  organisationId: string,
  application: MvpApplication,
  role: ReturnType<typeof normaliseMvpUserRole>,
  employees: EmployeeRow[],
) {
  if (role !== "Employee") return;

  const employeeEditableStatuses: RequestStatus[] = ["Draft", "More information requested"];
  const employeeSaveStatuses: RequestStatus[] = ["Draft", "Submitted to Line Manager", "Awaiting Manager Review"];

  if (!employeeSaveStatuses.includes(application.status)) {
    throw new LevyTateWorkspacePermissionError("Employees can save drafts or submit applications to their line manager only.");
  }

  const existing = await selectOne<ApplicationRow>(
    applicationsTable,
    new URLSearchParams({
      select: "id,employee_id,status",
      organisation_id: `eq.${organisationId}`,
      id: `eq.${application.id}`,
      limit: "1",
    }),
  );

  if (existing && !employeeEditableStatuses.includes(existing.status)) {
    throw new LevyTateWorkspacePermissionError("Submitted applications cannot be edited unless more information has been requested.");
  }

  if (!existing) {
    await assertOrganisationProgrammeAllowsApplication(organisationId, application.apprenticeshipStandardId);
  }

  const employee = employees.find((item) => item.id === application.employeeId);
  if (!employee?.role_id) {
    throw new LevyTateWorkspacePermissionError("Your employee record is not linked to a role library entry.");
  }

  const mapping = await selectOne<RoleMappingRow>(
    roleMappingsTable,
    new URLSearchParams({
      select: "id",
      organisation_id: `eq.${organisationId}`,
      role_id: `eq.${employee.role_id}`,
      apprenticeship_standard_id: `eq.${application.apprenticeshipStandardId}`,
      limit: "1",
    }),
  );

  if (!mapping) {
    throw new LevyTateWorkspacePermissionError("Employees can only apply for programmes mapped to their assigned role.");
  }
}

async function assertOrganisationProgrammeAllowsApplication(organisationId: string, apprenticeshipStandardId: string) {
  const selections = await selectMany<OrganisationProgrammeRow>(
    organisationProgrammesTable,
    organisationId,
    "programme_id,provider_id,status,selected_at,updated_at",
    "selected_at.desc",
  );
  const activeProgrammeIds = new Set(selections.filter((selection) => selection.status === "Active").map((selection) => selection.programme_id));
  if (!activeProgrammeIds.size) {
    throw new LevyTateWorkspacePermissionError("Your organisation has not published any apprenticeship programmes yet.");
  }

  const canonicalOrganisationId = await getCanonicalCatalogueOrganisationId();
  const programmes = await selectMany<ProviderProgrammeRow>(
    providerProgrammesTable,
    canonicalOrganisationId,
    "id,linked_standard_id,linked_standard_ids,status,record_status",
    "created_at.asc",
  );
  const permitted = programmes.some((programme) =>
    activeProgrammeIds.has(programme.id) &&
    programme.status === "Active" &&
    programme.record_status === "Active" &&
    (programme.linked_standard_id === apprenticeshipStandardId || stringArray(programme.linked_standard_ids).includes(apprenticeshipStandardId))
  );
  if (!permitted) {
    throw new LevyTateWorkspacePermissionError("Employees can only apply for an active programme in My Programmes.");
  }
}

function assertLineManagerCanUpdateApplication(
  manager: EmployeeRow | undefined,
  application: ApplicationRow,
  nextStatus: RequestStatus,
  note: string | undefined,
) {
  if (!manager) {
    throw new LevyTateWorkspacePermissionError("Your user account is not linked to an active line manager record.");
  }

  if (application.employee_id === manager.id) {
    throw new LevyTateWorkspacePermissionError("Line managers cannot review their own application.");
  }

  if (!lineManagerDecisionStatuses.includes(nextStatus)) {
    throw new LevyTateWorkspacePermissionError("Line managers can only approve, request more information or decline applications.");
  }

  if (!lineManagerReviewStatuses.includes(application.status)) {
    throw new LevyTateWorkspacePermissionError("This application is not awaiting a line manager decision.");
  }

  if (!note?.trim()) {
    throw new LevyTateWorkspacePermissionError("A manager decision note is required.");
  }
}

function readableEmployeeIdsForUser(userEmail: string, role: ReturnType<typeof normaliseMvpUserRole>, employees: EmployeeRow[]) {
  const normalisedEmail = userEmail.trim().toLowerCase();
  const currentEmployee = employees.find((employee) =>
    employee.status === "Active" && employee.email.trim().toLowerCase() === normalisedEmail
  );
  const ids = new Set<string>();

  if (!currentEmployee) return ids;

  ids.add(currentEmployee.id);

  if (role === "Line Manager") {
    employees
      .filter((employee) => employee.status === "Active" && employee.manager_id === currentEmployee.id)
      .forEach((employee) => ids.add(employee.id));
  }

  return ids;
}

function scopedProfile(profile: MvpWorkspaceProfile, employees: MvpEmployee[], includeSettings: boolean): MvpWorkspaceProfile {
  if (includeSettings) return profile;

  return {
    ...profile,
    primaryContact: "",
    contactEmail: "",
    defaultSite: employees[0]?.site ?? "",
    sites: [...new Set(employees.map((employee) => employee.site).filter(Boolean))],
    departments: [...new Set(employees.map((employee) => employee.department).filter(Boolean))],
  };
}

function employerSafeProvider(provider: ProviderCatalogueRecord): ProviderCatalogueRecord {
  return {
    ...provider,
    contactName: "",
    contactEmail: "",
    ofstedRating: "",
    sourceUrls: [],
    notes: "",
    commercialProfile: {
      ...provider.commercialProfile,
      primaryContactTitle: "",
      commercialContactName: "",
      commercialContactEmail: "",
      commercialContactTitle: "",
      commercialContactPhone: "",
      learnerNumbers: "",
      employerPartners: "",
      achievementRate: "",
      learnerSatisfaction: "",
      employerSatisfaction: "",
      googleReviewSignal: "",
      awards: [],
      caseStudies: [],
      successStories: [],
      testimonials: [],
      downloads: [],
      pricingNotes: "",
      commercialNotes: "",
    },
  };
}

function employerSafeProgramme(programme: ProviderProgramme): ProviderProgramme {
  return {
    ...programme,
    commercialNotes: "",
    sourceUrl: "",
    notes: "",
    commercialProfile: {
      ...programme.commercialProfile,
      confidenceLabel: "",
      caseStudies: [],
      downloads: [],
    },
  };
}

function scopeWorkspaceDataForContext(workspace: MvpWorkspaceData, context: WorkspaceContext) {
  const role = normaliseMvpUserRole(context.user.role);
  if (role === "Platform Admin") {
    return {
      ...workspace,
      employees: [],
      employeeDevelopmentProfiles: [],
      roles: [],
      applications: [],
      providerRelationships: [],
      organisationProviders: [],
      organisationProgrammes: [],
      matchingRequests: [],
      enrolments: [],
      learnerRecords: [],
      eligibilityDeclarations: [],
      preEnrolmentChecks: [],
      breaksInLearning: [],
      withdrawals: [],
      learnerReviews: [],
      progressUpdates: [],
      assessmentReadiness: [],
      achievements: [],
      operationalActions: [],
      lifecycleEvents: [],
    } satisfies MvpWorkspaceData;
  }
  const safeProviders = workspace.providers.map(employerSafeProvider);
  const safeProgrammes = workspace.providerProgrammes.map(employerSafeProgramme);
  if (role === "Employer Admin" || role === "Apprenticeship Lead") return { ...workspace, providers: safeProviders, providerProgrammes: safeProgrammes };

  const visibleEmployeeIds = readableEmployeeIdsForUser(context.user.email, role, workspace.employees.map(employeeRecordToRow));
  const visibleEmployees = workspace.employees
    .filter((employee) => visibleEmployeeIds.has(employee.id))
    .map((employee) => ({
      ...employee,
      managerName: workspace.employees.find((manager) => manager.id === employee.managerId)?.name ?? employee.managerName ?? "",
    }));
  const visibleRoleIds = new Set(visibleEmployees.map((employee) => employee.roleId).filter(Boolean));
  const visibleApplications = workspace.applications.filter((application) => visibleEmployeeIds.has(application.employeeId));
  const visibleApplicationIds = new Set(visibleApplications.map((application) => application.id));
  const visibleEnrolmentIds = new Set(
    workspace.enrolments
      .filter((enrolment) => visibleEmployeeIds.has(enrolment.employeeId) || visibleApplicationIds.has(enrolment.applicationId))
      .map((enrolment) => enrolment.id),
  );
  const visibleLearnerRecords = workspace.learnerRecords.filter((record) =>
    visibleEmployeeIds.has(record.employeeId) ||
    visibleApplicationIds.has(record.applicationId) ||
    visibleEnrolmentIds.has(record.enrolmentId)
  );
  const visibleLearnerRecordIds = new Set(visibleLearnerRecords.map((record) => record.id));
  const visibleStandardIds = new Set([
    ...visibleApplications.map((application) => application.apprenticeshipStandardId),
    ...workspace.roles
      .filter((roleRecord) => visibleRoleIds.has(roleRecord.id))
      .flatMap((roleRecord) => roleRecord.pathwayMappings.map((mapping) => mapping.apprenticeshipStandardId)),
  ].filter(Boolean));

  const visibleRoles = workspace.roles
    .filter((roleRecord) => visibleRoleIds.has(roleRecord.id))
    .map((roleRecord) => ({
      ...roleRecord,
      pathwayMappings: roleRecord.pathwayMappings.filter((mapping) => visibleStandardIds.has(mapping.apprenticeshipStandardId)),
    }));

  const readProviders = hasMvpPermission(role, "providers:read");
  const readProviderRelationships = hasMvpPermission(role, "providerRelationships:read");
  const readProviderMatching = hasMvpPermission(role, "providerMatching:read");
  const readEnrolments = hasMvpPermission(role, "enrolments:read");

  const activeOrganisationProgrammes = workspace.organisationProgrammes.filter((selection) => selection.status === "Active");
  const visibleOrganisationProgrammeIds = new Set(activeOrganisationProgrammes.map((selection) => selection.programmeId));
  const historicalStandardIds = new Set(visibleApplications.map((application) => application.apprenticeshipStandardId).filter(Boolean));
  const visibleProgrammes = safeProgrammes.filter((programme) =>
    visibleOrganisationProgrammeIds.has(programme.id) ||
    historicalStandardIds.has(programme.linkedStandardId) ||
    programme.linkedStandardIds.some((id) => historicalStandardIds.has(id))
  );
  const visibleProviderIds = new Set([
    ...workspace.organisationProviders.filter((selection) => selection.status === "Active").map((selection) => selection.providerId),
    ...visibleProgrammes.map((programme) => programme.providerId),
  ]);

  return {
    ...workspace,
    profile: scopedProfile(workspace.profile, visibleEmployees, hasMvpPermission(role, "settings:read")),
    employees: visibleEmployees,
    employeeDevelopmentProfiles: workspace.employeeDevelopmentProfiles.filter((profile) => visibleEmployeeIds.has(profile.employeeId)),
    roles: visibleRoles,
    applications: visibleApplications,
    providers: readProviders ? safeProviders.filter((provider) => visibleProviderIds.has(provider.providerId)) : [],
    providerProgrammes: visibleProgrammes,
    providerRelationships: readProviderRelationships ? workspace.providerRelationships : [],
    organisationProviders: workspace.organisationProviders.filter((selection) => selection.status === "Active" && visibleProviderIds.has(selection.providerId)),
    organisationProgrammes: activeOrganisationProgrammes.filter((selection) => visibleOrganisationProgrammeIds.has(selection.programmeId)),
    matchingRequests: readProviderMatching ? workspace.matchingRequests : [],
    enrolments: readEnrolments ? workspace.enrolments : workspace.enrolments.filter((enrolment) =>
      visibleEmployeeIds.has(enrolment.employeeId) || visibleApplicationIds.has(enrolment.applicationId)
    ),
    learnerRecords: visibleLearnerRecords,
    eligibilityDeclarations: workspace.eligibilityDeclarations.filter((declaration) => visibleLearnerRecordIds.has(declaration.learnerRecordId)),
    preEnrolmentChecks: workspace.preEnrolmentChecks.filter((checks) => visibleLearnerRecordIds.has(checks.learnerRecordId)),
    breaksInLearning: workspace.breaksInLearning.filter((breakRecord) => visibleLearnerRecordIds.has(breakRecord.learnerRecordId)),
    withdrawals: workspace.withdrawals.filter((withdrawal) => visibleLearnerRecordIds.has(withdrawal.learnerRecordId)),
    learnerReviews: workspace.learnerReviews.filter((review) => visibleLearnerRecordIds.has(review.learnerRecordId)),
    progressUpdates: workspace.progressUpdates.filter((update) => visibleLearnerRecordIds.has(update.learnerRecordId)),
    assessmentReadiness: workspace.assessmentReadiness.filter((readiness) => visibleLearnerRecordIds.has(readiness.learnerRecordId)),
    achievements: workspace.achievements.filter((achievement) => visibleLearnerRecordIds.has(achievement.learnerRecordId)),
    operationalActions: workspace.operationalActions.filter((action) => visibleLearnerRecordIds.has(action.learnerRecordId)),
    lifecycleEvents: workspace.lifecycleEvents.filter((event) => visibleLearnerRecordIds.has(event.learnerRecordId)),
  } satisfies MvpWorkspaceData;
}

function employeeRecordToRow(employee: MvpEmployee): EmployeeRow {
  return {
    organisation_id: "",
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
}

async function ensureWorkspaceContext(session: LevyTateBetaSession): Promise<WorkspaceContext> {
  const config = assertSupabase();
  await assertSessionStillAllowed(session);
  const now = nowIso();

  const existingUser = await selectOne<UserRow>(
    usersTable,
    new URLSearchParams({
      select: "id,organisation_id,email,role,access_level,display_name,active,auth_subject,last_login_at,created_at,updated_at",
      email: `eq.${session.email}`,
      limit: "1",
    }),
  );

  if (existingUser?.active === false) {
    throw new LevyTateWorkspacePermissionError("Your LevyTate access is not active. Please contact your Apprenticeship Lead.");
  }

  const provisionedOrganisation = existingUser
    ? await selectOne<OrganisationRow>(
      organisationsTable,
      new URLSearchParams({
        select: "id,name,slug,workspace_name,primary_contact,contact_email,default_site,sites,departments,priorities,logo_reference,workspace_template,status,created_at,updated_at",
        id: `eq.${existingUser.organisation_id}`,
        limit: "1",
      }),
    )
    : null;
  const seed = await deriveOrganisationSeed(session);

  const existingOrganisation = provisionedOrganisation ?? await selectOne<OrganisationRow>(
    organisationsTable,
    new URLSearchParams({
      select: "id,name,slug,workspace_name,primary_contact,contact_email,default_site,sites,departments,priorities,logo_reference,workspace_template,status,created_at,updated_at",
      slug: `eq.${seed.slug}`,
      limit: "1",
    }),
  );

  const organisation = existingOrganisation ?? await createOrganisation(seed);
  if (existingOrganisation) {
    await updateOrganisationDefaults(organisation.id, seed);
  }
  const userRole = resolveSessionWorkspaceRole(session, seed.userRole, existingUser?.role);
  const nextUser: UserRow = existingUser
    ? {
        ...existingUser,
        organisation_id: organisation.id,
        role: userRole,
        access_level: session.accessLevel,
        active: true,
        last_login_at: now,
        updated_at: now,
      }
    : {
        id: randomUUID(),
        organisation_id: organisation.id,
        email: session.email,
        role: userRole,
        access_level: session.accessLevel,
        display_name: "",
        active: true,
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
      select: "id,organisation_id,email,role,access_level,display_name,active,auth_subject,last_login_at,created_at,updated_at",
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

async function assertSessionStillAllowed(session: LevyTateBetaSession) {
  if (session.accessLevel === "beta_admin") return;

  // Normal client users are authorised by an active, Auth-bound membership.
  // Early Access approval remains an additional gate only for prospect/demo access.
  if (session.authMode === "supabase_email" && session.authSubject) {
    const membership = await selectOne<UserRow>(
      usersTable,
      new URLSearchParams({
        select: "id,organisation_id,email,role,access_level,display_name,active,auth_subject,last_login_at,created_at,updated_at",
        email: `eq.${session.email}`,
        auth_subject: `eq.${session.authSubject}`,
        active: "eq.true",
        limit: "1",
      }),
    );
    if (membership) {
      await getProspectAccessForSession(session);
      return;
    }
  }

  const [lead, persistentState] = await Promise.all([
    getEarlyAccessRequestByEmail(session.email),
    getPersistentEarlyAccessState(session.email),
  ]);

  if (persistentState === "approved" || (lead && isBetaApprovedEarlyAccessStatus(lead.status))) {
    return;
  }

  throw new LevyTateWorkspacePermissionError(
    "Your LevyTate account is not fully configured. Please contact your Apprenticeship Lead.",
  );
}

async function assertWorkspaceReadAllowed(context: WorkspaceContext) {
  const role = normaliseMvpUserRole(context.user.role);
  if (role !== "Employee" && role !== "Line Manager") return;

  const employees = await selectMany<EmployeeRow>(
    employeesTable,
    context.organisation.id,
    "id,email,manager_id,status,employee_number,name,job_title,role_id,department,site,platform_role,start_date,created_at,updated_at",
    "name.asc",
  );

  if (readableEmployeeIdsForUser(context.user.email, role, employees).size > 0) return;

  throw new LevyTateWorkspacePermissionError(
    "Your LevyTate account is not fully configured. Please contact your Apprenticeship Lead.",
  );
}

function resolveSessionWorkspaceRole(
  session: LevyTateBetaSession,
  seedRole: UserRow["role"],
  existingRole?: string | null,
): UserRow["role"] {
  if (session.accessLevel === "beta_admin") {
    return "Platform Admin";
  }

  if (!existingRole) {
    return seedRole;
  }

  const normalisedExistingRole = normaliseMvpUserRole(existingRole);
  if (normalisedExistingRole !== "Platform Admin") {
    return normalisedExistingRole;
  }

  return seedRole;
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

async function loadWorkspaceData(context: WorkspaceContext, session: LevyTateBetaSession): Promise<MvpWorkspaceData> {
  const organisationId = context.organisation.id;
  const canonicalOrganisation = await selectOne<OrganisationRow>(
    organisationsTable,
    new URLSearchParams({
      select: "id,slug",
      slug: "eq.levytate-internal",
      limit: "1",
    }),
  );
  const canonicalOrganisationId = canonicalOrganisation?.id;
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
    organisationProviders,
    organisationProgrammes,
    matchingRequests,
    enrolments,
    lifecycle,
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
    canonicalOrganisationId
      ? selectMany<ProviderRow>(providersTable, canonicalOrganisationId, "provider_id,provider_name,website,provider_type,sectors,industries,technologies,delivery_models,regions,employer_types,specialisms,contact_name,contact_email,ofsted_rating,status,source_urls,notes,last_verified,verification_status", "provider_name.asc")
      : Promise.resolve([]),
    canonicalOrganisationId
      ? selectMany<ProviderProgrammeRow>(providerProgrammesTable, canonicalOrganisationId, "id,provider_id,programme_name,short_description,full_description,status,verification_status,target_organisations,target_industries,target_job_roles,seniority,employer_size,business_problems_solved,skills_developed,technologies_covered,expected_outcomes,delivery_models,regions,duration,cohort_options,commercial_notes,apprenticeship_standard_id,linked_standard_id,linked_standard_ids,linked_standard_name,level,route,funding_band,official_url,source_url,notes,funding_route,record_status,created_at,updated_at", "created_at.asc")
      : Promise.resolve([]),
    selectMany<ProviderRelationshipRow>(providerRelationshipsTable, organisationId, "id,category,preferred_provider_id,backup_provider_ids,apprenticeship_standard_ids,programme_ids,status,notes,review_date,last_used_date", "review_date.asc"),
    selectMany<OrganisationProviderRow>(organisationProvidersTable, organisationId, "provider_id,status,selected_at,updated_at", "selected_at.desc"),
    selectMany<OrganisationProgrammeRow>(organisationProgrammesTable, organisationId, "programme_id,provider_id,status,selected_at,updated_at", "selected_at.desc"),
    selectMany<MatchingRequestRow>(matchingRequestsTable, organisationId, "id,role_need,department,future_capability,employer_size,programme_id,linked_standard_id,learner_count,sites,delivery_preference,funding_position,urgency,notes,business_problems,target_roles,technologies,industries,status,shortlist_provider_ids,created_at,updated_at", "created_at.desc"),
    selectMany<EnrolmentRow>(enrolmentsTable, organisationId, "id,application_id,employee_id,provider_id,apprenticeship_standard_id,status,start_date,notes,created_at,updated_at", "created_at.desc"),
    normaliseMvpUserRole(context.user.role) === "Platform Admin"
      ? Promise.resolve(null)
      : getOrganisationLearnerLifecycleCollectionsForWorkspace(session),
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
  workspace.organisationProviders = organisationProviders.map((selection) => ({
    providerId: selection.provider_id,
    status: selection.status,
    selectedAt: selection.selected_at,
    updatedAt: selection.updated_at,
  }));
  workspace.organisationProgrammes = organisationProgrammes.map((selection) => ({
    programmeId: selection.programme_id,
    providerId: selection.provider_id,
    status: selection.status,
    selectedAt: selection.selected_at,
    updatedAt: selection.updated_at,
  }));
  workspace.matchingRequests = matchingRequests.map(matchingRequestRowToRecord);
  workspace.enrolments = enrolments.map(enrolmentRowToRecord);
  if (lifecycle) {
    workspace.learnerRecords = lifecycle.learnerRecords;
    workspace.eligibilityDeclarations = lifecycle.eligibilityDeclarations;
    workspace.preEnrolmentChecks = lifecycle.preEnrolmentChecks;
    workspace.breaksInLearning = lifecycle.breaksInLearning;
    workspace.withdrawals = lifecycle.withdrawals;
    workspace.learnerReviews = lifecycle.learnerReviews;
    workspace.progressUpdates = lifecycle.progressUpdates;
    workspace.assessmentReadiness = lifecycle.assessmentReadiness;
    workspace.achievements = lifecycle.achievements;
    workspace.operationalActions = lifecycle.operationalActions;
    workspace.lifecycleEvents = lifecycle.lifecycleEvents;
  }

  return scopeWorkspaceDataForContext(workspace, context);
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
  const existing = await selectOne<ApplicationRow>(
    applicationsTable,
    new URLSearchParams({
      select: "id,status,current_owner",
      organisation_id: `eq.${organisationId}`,
      id: `eq.${application.id}`,
      limit: "1",
    }),
  );
  const history = [...application.history];
  const latestHistory = history.at(-1);
  const resubmittedForManagerReview = existing?.status === "More information requested"
    && lineManagerReviewStatuses.includes(application.status)
    && (!latestHistory || !lineManagerReviewStatuses.includes(latestHistory.status));
  if (resubmittedForManagerReview) {
    history.push(buildApplicationHistoryEntry(application.status, "Application resubmitted to Line Manager."));
  }
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
  if (history.length) {
    const historyRows: ApplicationHistoryRow[] = history.map((entry) => ({
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
    industries: provider.industries,
    technologies: provider.technologies,
    delivery_models: provider.deliveryModels,
    regions: provider.regions,
    employer_types: provider.employerTypes,
    specialisms: provider.specialisms,
    contact_name: provider.contactName,
    contact_email: provider.contactEmail,
    ofsted_rating: provider.ofstedRating,
    status: provider.status,
    source_urls: provider.sourceUrls,
    notes: serialiseProviderRecordNotes(provider.notes, provider.commercialProfile),
    last_verified: provider.lastVerified,
    verification_status: provider.verificationStatus,
  };

  await supabaseInsert<ProviderRow>(assertSupabase(), providersTable, [row], {
    query: "on_conflict=organisation_id,provider_id",
    prefer: "resolution=merge-duplicates,return=minimal",
  });
}
async function saveProviderProgramme(organisationId: string, programme: ProviderProgramme) {
  const normalised = normaliseProviderProgramme(programme);
  const row: ProviderProgrammeRow = {
    organisation_id: organisationId,
    id: normalised.id,
    provider_id: normalised.providerId,
    programme_name: normalised.programmeName,
    short_description: normalised.shortDescription,
    full_description: normalised.fullDescription,
    status: normalised.status,
    verification_status: normalised.verificationStatus,
    target_organisations: normalised.targetOrganisations,
    target_industries: normalised.targetIndustries,
    target_job_roles: normalised.targetJobRoles,
    seniority: normalised.seniority,
    employer_size: normalised.employerSize,
    business_problems_solved: normalised.businessProblemsSolved,
    skills_developed: normalised.skillsDeveloped,
    technologies_covered: normalised.technologiesCovered,
    expected_outcomes: normalised.expectedOutcomes,
    delivery_models: normalised.deliveryModels,
    regions: normalised.regions,
    duration: normalised.duration,
    cohort_options: normalised.cohortOptions,
    commercial_notes: normalised.commercialNotes,
    apprenticeship_standard_id: normalised.linkedStandardId || normalised.linkedStandardIds[0] || '',
    linked_standard_id: normalised.linkedStandardId || normalised.linkedStandardIds[0] || null,
    linked_standard_ids: normalised.linkedStandardIds,
    linked_standard_name: normalised.linkedStandardName,
    level: normalised.level,
    route: normalised.route,
    funding_band: normalised.fundingBand,
    official_url: normalised.officialUrl,
    source_url: normalised.sourceUrl,
    notes: serialiseProgrammeRecordNotes(normalised.notes, normalised.commercialProfile),
    funding_route: normalised.fundingRoute,
    record_status: normalised.recordStatus,
    created_at: normalised.createdAt,
    updated_at: normalised.updatedAt,
  };

  await supabaseInsert<ProviderProgrammeRow>(assertSupabase(), providerProgrammesTable, [row], {
    query: "on_conflict=organisation_id,id",
    prefer: "resolution=merge-duplicates,return=minimal",
  });
}
async function saveProviderRelationship(organisationId: string, relationship: MvpProviderRelationship) {
  const normalised = normaliseProviderRelationship(relationship);
  const row: ProviderRelationshipRow = {
    organisation_id: organisationId,
    id: normalised.id,
    category: normalised.category,
    preferred_provider_id: normalised.preferredProviderId,
    backup_provider_ids: normalised.backupProviderIds,
    programme_ids: normalised.programmeIds,
    status: normalised.status,
    notes: normalised.notes,
    review_date: normalised.reviewDate,
    last_used_date: normalised.lastUsedDate,
  };

  await supabaseInsert<ProviderRelationshipRow>(assertSupabase(), providerRelationshipsTable, [row], {
    query: "on_conflict=organisation_id,id",
    prefer: "resolution=merge-duplicates,return=minimal",
  });
}

async function getCanonicalCatalogueOrganisationId() {
  const organisation = await selectOne<OrganisationRow>(
    organisationsTable,
    new URLSearchParams({ select: "id", slug: "eq.levytate-internal", limit: "1" }),
  );
  if (!organisation) {
    throw new LevyTateWorkspacePersistenceError("The canonical LevyTate catalogue is unavailable.");
  }
  return organisation.id;
}

async function saveOrganisationProviderSelection(context: WorkspaceContext, selection: MvpOrganisationProvider) {
  const canonicalOrganisationId = await getCanonicalCatalogueOrganisationId();
  const provider = await selectOne<ProviderRow>(providersTable, new URLSearchParams({
    select: "provider_id,status",
    organisation_id: `eq.${canonicalOrganisationId}`,
    provider_id: `eq.${selection.providerId}`,
    limit: "1",
  }));
  if (!provider || provider.status !== "Active") {
    throw new LevyTateWorkspacePermissionError("Only an active canonical provider can be added to My Providers.");
  }

  const row: OrganisationProviderRow = {
    organisation_id: context.organisation.id,
    provider_id: selection.providerId,
    status: selection.status,
    selected_by: context.user.email,
    selected_at: selection.selectedAt || nowIso(),
    updated_at: nowIso(),
  };
  await supabaseInsert<OrganisationProviderRow>(assertSupabase(), organisationProvidersTable, [row], {
    query: "on_conflict=organisation_id,provider_id",
    prefer: "resolution=merge-duplicates,return=minimal",
  });
  if (selection.status === "Inactive") {
    await supabaseUpdate(
      assertSupabase(),
      organisationProgrammesTable,
      `organisation_id=eq.${context.organisation.id}&provider_id=eq.${encodeURIComponent(selection.providerId)}&status=eq.Active`,
      { status: "Inactive", updated_at: nowIso() },
      { prefer: "return=minimal" },
    );
  }
}

async function saveOrganisationProgrammeSelection(context: WorkspaceContext, selection: MvpOrganisationProgramme) {
  const canonicalOrganisationId = await getCanonicalCatalogueOrganisationId();
  const programme = await selectOne<ProviderProgrammeRow>(providerProgrammesTable, new URLSearchParams({
    select: "id,provider_id,status,record_status",
    organisation_id: `eq.${canonicalOrganisationId}`,
    id: `eq.${selection.programmeId}`,
    provider_id: `eq.${selection.providerId}`,
    limit: "1",
  }));
  if (!programme || programme.status !== "Active" || programme.record_status !== "Active") {
    throw new LevyTateWorkspacePermissionError("Only an active canonical programme can be added to My Programmes.");
  }

  const now = nowIso();
  if (selection.status === "Active") {
    await saveOrganisationProviderSelection(context, {
      providerId: programme.provider_id,
      status: "Active",
      selectedAt: selection.selectedAt || now,
      updatedAt: now,
    });
  }
  const row: OrganisationProgrammeRow = {
    organisation_id: context.organisation.id,
    programme_id: selection.programmeId,
    provider_id: programme.provider_id,
    status: selection.status,
    selected_by: context.user.email,
    selected_at: selection.selectedAt || now,
    updated_at: now,
  };
  await supabaseInsert<OrganisationProgrammeRow>(assertSupabase(), organisationProgrammesTable, [row], {
    query: "on_conflict=organisation_id,programme_id",
    prefer: "resolution=merge-duplicates,return=minimal",
  });
}

async function saveMatchingRequest(organisationId: string, request: MvpMatchingRequest) {
  const normalised = normaliseMatchingRequest(request);
  const row: MatchingRequestRow = {
    organisation_id: organisationId,
    id: normalised.id,
    role_need: normalised.roleNeed,
    department: normalised.department,
    future_capability: normalised.futureCapability,
    employer_size: normalised.employerSize,
    programme_id: normalised.programmeId,
    linked_standard_id: normalised.linkedStandardId,
    learner_count: normalised.learnerCount,
    sites: normalised.sites,
    delivery_preference: normalised.deliveryPreference,
    funding_position: normalised.fundingPosition,
    urgency: normalised.urgency,
    notes: normalised.notes,
    business_problems: normalised.businessProblems,
    target_roles: normalised.targetRoles,
    technologies: normalised.technologies,
    industries: normalised.industries,
    status: normalised.status,
    shortlist_provider_ids: normalised.shortlistProviderIds,
    created_at: normalised.createdAt,
    updated_at: normalised.updatedAt,
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
  return normaliseProviderRecord({
    providerId: row.provider_id,
    providerName: row.provider_name,
    website: row.website,
    providerType: row.provider_type,
    sectors: stringArray(row.sectors),
    industries: stringArray(row.industries),
    technologies: stringArray(row.technologies),
    deliveryModels: stringArray(row.delivery_models),
    regions: stringArray(row.regions),
    employerTypes: stringArray(row.employer_types),
    specialisms: stringArray(row.specialisms),
    contactName: row.contact_name,
    contactEmail: row.contact_email,
    ofstedRating: row.ofsted_rating,
    status: row.status,
    sourceUrls: stringArray(row.source_urls),
    notes: row.notes,
    lastVerified: row.last_verified,
    verificationStatus: row.verification_status,
  });
}
function providerProgrammeRowToRecord(row: ProviderProgrammeRow): ProviderProgramme {
  return normaliseProviderProgramme({
    id: row.id,
    providerId: row.provider_id,
    programmeName: row.programme_name,
    shortDescription: row.short_description,
    fullDescription: row.full_description,
    status: row.status,
    verificationStatus: row.verification_status,
    targetOrganisations: stringArray(row.target_organisations),
    targetIndustries: stringArray(row.target_industries),
    targetJobRoles: stringArray(row.target_job_roles),
    seniority: row.seniority,
    employerSize: row.employer_size,
    businessProblemsSolved: stringArray(row.business_problems_solved),
    skillsDeveloped: stringArray(row.skills_developed),
    technologiesCovered: stringArray(row.technologies_covered),
    expectedOutcomes: stringArray(row.expected_outcomes),
    deliveryModels: stringArray(row.delivery_models),
    regions: stringArray(row.regions),
    duration: row.duration,
    cohortOptions: stringArray(row.cohort_options),
    commercialNotes: row.commercial_notes,
    fundingRoute: row.funding_route,
    linkedStandardId: row.linked_standard_id ?? row.apprenticeship_standard_id ?? undefined,
    linkedStandardIds: stringArray(row.linked_standard_ids).length
      ? stringArray(row.linked_standard_ids)
      : (row.apprenticeship_standard_id ? [row.apprenticeship_standard_id] : []),
    linkedStandardName: row.linked_standard_name,
    level: row.level ?? null,
    route: row.route,
    fundingBand: row.funding_band ?? null,
    officialUrl: row.official_url,
    sourceUrl: row.source_url,
    notes: row.notes,
    recordStatus: row.record_status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}
function providerRelationshipRowToRecord(row: ProviderRelationshipRow): MvpProviderRelationship {
  return normaliseProviderRelationship({
    id: row.id,
    category: row.category,
    preferredProviderId: row.preferred_provider_id,
    backupProviderIds: stringArray(row.backup_provider_ids),
    programmeIds: stringArray(row.programme_ids),
    apprenticeshipStandardIds: stringArray(row.apprenticeship_standard_ids),
    status: row.status,
    notes: row.notes,
    reviewDate: row.review_date,
    lastUsedDate: row.last_used_date,
  });
}

function matchingRequestRowToRecord(row: MatchingRequestRow): MvpMatchingRequest {
  return normaliseMatchingRequest({
    id: row.id,
    roleNeed: row.role_need,
    department: row.department,
    futureCapability: row.future_capability,
    employerSize: row.employer_size as MvpMatchingRequest["employerSize"],
    programmeId: row.programme_id,
    linkedStandardId: row.linked_standard_id,
    learnerCount: row.learner_count,
    sites: stringArray(row.sites),
    deliveryPreference: row.delivery_preference,
    fundingPosition: row.funding_position,
    urgency: row.urgency,
    notes: row.notes,
    businessProblems: stringArray(row.business_problems),
    targetRoles: stringArray(row.target_roles),
    technologies: stringArray(row.technologies),
    industries: stringArray(row.industries),
    status: row.status,
    shortlistProviderIds: stringArray(row.shortlist_provider_ids),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
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
