import type { LevyTateBetaSession } from "@/lib/levytate/config/beta-access";
import type { RequestStatus } from "@/lib/levytate/domain";
import { normaliseMvpUserRole } from "@/lib/levytate/mvp/rbac";
import type { MvpApplicationHistoryEntry, MvpApplicationOwner } from "@/lib/levytate/mvp/workspace";
import { getLevyTateSupabaseConfig, supabaseSelect } from "@/lib/server/levytate-supabase";

type ManagerUserRow = {
  id: string;
  organisation_id: string;
  email: string;
  role: string;
};

type ManagerOrganisationRow = {
  id: string;
  name: string;
};

type ManagerEmployeeRow = {
  id: string;
  name: string;
  email: string;
  job_title: string;
  role_id: string;
  manager_id: string;
  department: string;
  site: string;
  status: string;
};

type ManagerApplicationRow = {
  id: string;
  employee_id: string;
  apprenticeship_standard_id: string;
  status: RequestStatus;
  current_owner: MvpApplicationOwner;
  reason: string;
  career_goal: string;
  support_required: string;
  manager_note: string;
  submitted_at: string;
  updated_at: string;
};

type ManagerApplicationHistoryRow = {
  id: string;
  application_id: string;
  status: RequestStatus;
  owner: MvpApplicationOwner;
  note: string;
  created_at: string;
};

export type ManagerDirectReport = {
  id: string;
  name: string;
  email: string;
  jobTitle: string;
  roleId: string;
  managerId: string;
  department: string;
  site: string;
};

export type ManagerDirectReportContext = {
  organisation: { id: string; name: string };
  user: { id: string; email: string; role: "Line Manager" };
  manager: ManagerDirectReport;
  directReports: ManagerDirectReport[];
};

export type ManagerDirectReportApplication = {
  id: string;
  employee: ManagerDirectReport;
  apprenticeshipStandardId: string;
  status: RequestStatus;
  currentOwner: MvpApplicationOwner;
  reason: string;
  careerGoal: string;
  supportRequired: string;
  managerNote: string;
  submittedAt: string;
  updatedAt: string;
  history: MvpApplicationHistoryEntry[];
};

export class LevyTateManagerScopeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LevyTateManagerScopeError";
  }
}

export async function getManagerDirectReportContext(session: LevyTateBetaSession): Promise<ManagerDirectReportContext> {
  const config = requireConfig();
  const email = session.email.trim().toLowerCase();
  const users = await supabaseSelect<ManagerUserRow>(config, "levytate_users", new URLSearchParams({
    select: "id,organisation_id,email,role",
    email: `eq.${email}`,
    limit: "1",
  }));
  const user = users[0];
  if (!user || normaliseMvpUserRole(user.role) !== "Line Manager") {
    throw new LevyTateManagerScopeError("Line Manager access is required for direct-report intelligence.");
  }

  const [organisations, managers] = await Promise.all([
    supabaseSelect<ManagerOrganisationRow>(config, "levytate_organisations", new URLSearchParams({
      select: "id,name",
      id: `eq.${user.organisation_id}`,
      limit: "1",
    })),
    supabaseSelect<ManagerEmployeeRow>(config, "levytate_employees", new URLSearchParams({
      select: "id,name,email,job_title,role_id,manager_id,department,site,status",
      organisation_id: `eq.${user.organisation_id}`,
      email: `eq.${email}`,
      status: "eq.Active",
      limit: "1",
    })),
  ]);
  const organisation = organisations[0];
  const manager = managers[0];
  if (!organisation || !manager) {
    throw new LevyTateManagerScopeError("Your account is not linked to an active line manager record.");
  }

  const directReports = await supabaseSelect<ManagerEmployeeRow>(config, "levytate_employees", new URLSearchParams({
    select: "id,name,email,job_title,role_id,manager_id,department,site,status",
    organisation_id: `eq.${organisation.id}`,
    manager_id: `eq.${manager.id}`,
    status: "eq.Active",
    order: "name.asc",
    limit: "500",
  }));

  return {
    organisation,
    user: { id: user.id, email: user.email, role: "Line Manager" },
    manager: employeeFromRow(manager),
    directReports: directReports.map(employeeFromRow),
  };
}

export async function listManagerDirectReportApplications(
  session: LevyTateBetaSession,
  providedScope?: ManagerDirectReportContext,
): Promise<ManagerDirectReportApplication[]> {
  const scope = providedScope ?? await getManagerDirectReportContext(session);
  assertScopeMatchesSession(session, scope);
  if (!scope.directReports.length) return [];

  const config = requireConfig();
  const employeeIds = scope.directReports.map((employee) => employee.id);
  const applications = await supabaseSelect<ManagerApplicationRow>(config, "levytate_applications", new URLSearchParams({
    select: "id,employee_id,apprenticeship_standard_id,status,current_owner,reason,career_goal,support_required,manager_note,submitted_at,updated_at",
    organisation_id: `eq.${scope.organisation.id}`,
    employee_id: `in.(${employeeIds.join(",")})`,
    order: "submitted_at.desc",
    limit: "500",
  }));
  if (!applications.length) return [];

  const history = await supabaseSelect<ManagerApplicationHistoryRow>(config, "levytate_application_history", new URLSearchParams({
    select: "id,application_id,status,owner,note,created_at",
    organisation_id: `eq.${scope.organisation.id}`,
    application_id: `in.(${applications.map((application) => application.id).join(",")})`,
    order: "created_at.asc",
    limit: "2000",
  }));
  const employeeById = new Map(scope.directReports.map((employee) => [employee.id, employee]));

  return applications.flatMap((application) => {
    const employee = employeeById.get(application.employee_id);
    if (!employee) return [];
    return [{
      id: application.id,
      employee,
      apprenticeshipStandardId: application.apprenticeship_standard_id,
      status: application.status,
      currentOwner: application.current_owner,
      reason: application.reason,
      careerGoal: application.career_goal,
      supportRequired: application.support_required,
      managerNote: application.manager_note,
      submittedAt: application.submitted_at,
      updatedAt: application.updated_at,
      history: history.filter((entry) => entry.application_id === application.id).map((entry) => ({
        id: entry.id,
        status: entry.status,
        owner: entry.owner,
        note: entry.note,
        createdAt: entry.created_at,
      })),
    }];
  });
}

export function assertScopeMatchesSession(session: LevyTateBetaSession, scope: ManagerDirectReportContext) {
  if (session.email.trim().toLowerCase() !== scope.user.email.trim().toLowerCase() || scope.user.role !== "Line Manager") {
    throw new LevyTateManagerScopeError("The manager scope does not match the signed-in user.");
  }
}

function employeeFromRow(row: ManagerEmployeeRow): ManagerDirectReport {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    jobTitle: row.job_title,
    roleId: row.role_id,
    managerId: row.manager_id,
    department: row.department,
    site: row.site,
  };
}

function requireConfig() {
  const config = getLevyTateSupabaseConfig();
  if (!config) throw new LevyTateManagerScopeError("Supabase is not configured for manager intelligence.");
  return config;
}
