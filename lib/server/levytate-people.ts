import { normalisePeopleRecord, PeopleValidationError, validatePeopleChanges } from "@/lib/levytate/mvp/people-validation";
import type { MvpEmployee } from "@/lib/levytate/mvp/workspace";
import { ClientRequestError } from "@/lib/server/levytate-request-boundary";
import { getLevyTateSupabaseConfig, supabaseFetchJson, supabaseInsert, supabaseSelectAll, supabaseUpdate } from "@/lib/server/levytate-supabase";

type EmployeeRow = { organisation_id: string; id: string; employee_number: string; name: string; email: string; job_title: string; role_id: string; manager_id: string; department: string; site: string; platform_role: MvpEmployee["platformRole"]; status: MvpEmployee["status"]; start_date: string; created_at: string; updated_at: string };
const columns = "id,organisation_id,employee_number,name,email,job_title,role_id,manager_id,department,site,platform_role,status,start_date,created_at,updated_at";

function config() {
  const value = getLevyTateSupabaseConfig();
  if (!value) throw new ClientRequestError("People persistence is unavailable.", 503);
  return value;
}

async function context(organisationId: string) {
  const [rows, roles] = await Promise.all([
    supabaseSelectAll<EmployeeRow>(config(), "levytate_employees", new URLSearchParams({ select: columns, organisation_id: `eq.${organisationId}`, order: "id.asc" })),
    supabaseSelectAll<{ id: string; status: "Active" | "Archived" }>(config(), "levytate_roles", new URLSearchParams({ select: "id,status", organisation_id: `eq.${organisationId}`, order: "id.asc" })),
  ]);
  return { employees: rows.map((row): MvpEmployee => ({ id: row.id, employeeNumber: row.employee_number, name: row.name, email: row.email, jobTitle: row.job_title,
    roleId: row.role_id, managerId: row.manager_id, department: row.department, site: row.site, platformRole: row.platform_role, status: row.status,
    startDate: row.start_date, createdAt: row.created_at, updatedAt: row.updated_at })), roles };
}

function row(employee: MvpEmployee) {
  return { id: employee.id, employee_number: employee.employeeNumber, name: employee.name, email: employee.email, job_title: employee.jobTitle,
    role_id: employee.roleId, manager_id: employee.managerId, department: employee.department, site: employee.site, platform_role: employee.platformRole,
    status: employee.status, start_date: employee.startDate, created_at: employee.createdAt, updated_at: employee.updatedAt };
}

export async function savePeopleRecord(organisationId: string, input: unknown) {
  return safely(async () => {
    const employee = normalisePeopleRecord(input);
    const current = await context(organisationId);
    validatePeopleChanges([employee], current.employees, current.roles);
    const now = new Date().toISOString();
    const persisted = await supabaseInsert<EmployeeRow>(config(), "levytate_employees", [{ organisation_id: organisationId, ...row(employee),
      created_at: current.employees.find((item) => item.id === employee.id)?.createdAt ?? now, updated_at: now,
    }], { query: "on_conflict=organisation_id,id", prefer: "resolution=merge-duplicates,return=representation" });
    if (persisted.length !== 1 || persisted[0].id !== employee.id) throw new ClientRequestError("The employee save was not confirmed. Keep this form and retry.", 503);
  });
}

export async function archivePeopleRecord(organisationId: string, employeeId: string, status: "Active" | "Archived") {
  return safely(async () => {
    if (!["Active", "Archived"].includes(status)) throw new ClientRequestError("Choose the requested employee state explicitly.", 422);
    const current = await context(organisationId);
    const employee = current.employees.find((item) => item.id === employeeId);
    if (!employee) throw new ClientRequestError("The employee was not found in this workspace.", 404);
    if (employee.status === status) return;
    validatePeopleChanges([{ ...employee, status }], current.employees, current.roles);
    const updated = await supabaseUpdate<EmployeeRow>(config(), "levytate_employees", new URLSearchParams({ organisation_id: `eq.${organisationId}`, id: `eq.${employeeId}`, status: `eq.${employee.status}`, updated_at: `eq.${employee.updatedAt}` }).toString(), { status, updated_at: new Date().toISOString() });
    if (updated.length !== 1) throw new ClientRequestError("This employee changed. Refresh People before retrying.", 409);
  });
}

export async function importPeopleRecords(organisationId: string, actorUserId: string, importId: string, input: unknown) {
  return safely(async () => {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(importId)) throw new PeopleValidationError("The import receipt identifier is invalid.");
    if (!Array.isArray(input) || !input.length || input.length > 500) throw new PeopleValidationError("Import between 1 and 500 employees at a time.");
    const employees = input.map(normalisePeopleRecord);
    // The transactional RPC owns receipt replay and current reference checks. A
    // pre-read here could reject a valid retry after the original request committed.
    const receipt = await supabaseFetchJson<{ importId: string; importedCount: number; replayed: boolean }>(config(), "rpc/levytate_import_people", {
      method: "POST", body: JSON.stringify({ p_organisation_id: organisationId, p_actor_user_id: actorUserId, p_import_id: importId, p_employees: employees.map(row) }),
    });
    if (receipt.importId !== importId || receipt.importedCount !== employees.length) throw new ClientRequestError("The import receipt was not confirmed. Retry this same file without closing the preview.", 503);
    return receipt;
  });
}

async function safely<T>(operation: () => Promise<T>) {
  try { return await operation(); }
  catch (error) {
    if (error instanceof ClientRequestError) throw error;
    if (error instanceof PeopleValidationError) throw new ClientRequestError(error.message, 422);
    const message = error instanceof Error ? error.message : "";
    if (/^(PT409|23505)/.test(message)) throw new ClientRequestError("An employee email, number or identifier already exists, or this import receipt belongs to different input. Refresh People and check the file.", 409);
    if (message.startsWith("PT403")) throw new ClientRequestError("You cannot import employees into this workspace.", 403);
    if (/^(PT422|23514|23503)/.test(message)) throw new ClientRequestError("Check employee details, unique emails and numbers, active roles and Line Manager relationships. No partial import was applied.", 422);
    throw new ClientRequestError("People persistence is temporarily unavailable. Keep your input and retry.", 503);
  }
}
