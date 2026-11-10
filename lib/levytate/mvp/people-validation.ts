import type { MvpEmployee, MvpRole } from "@/lib/levytate/mvp/workspace";

export class PeopleValidationError extends Error {
  constructor(message: string) { super(message); this.name = "PeopleValidationError"; }
}

export const peoplePlatformRoles = ["Employee", "Line Manager", "Department Head", "Apprenticeship Lead"] as const;
const fields = new Set(["id", "employeeNumber", "name", "email", "jobTitle", "roleId", "managerId", "managerName", "department", "site", "platformRole", "status", "startDate", "createdAt", "updatedAt"]);

/** Runtime validation is shared by forms and the server; TypeScript is not an input boundary. */
export function normalisePeopleRecord(input: unknown): MvpEmployee {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new PeopleValidationError("An employee record is required.");
  const value = input as Record<string, unknown>;
  if (Object.keys(value).some((key) => !fields.has(key))) throw new PeopleValidationError("The employee record contains unsupported fields.");
  const text = (key: string, label: string, max: number, required = true) => {
    if (typeof value[key] !== "string") throw new PeopleValidationError(`${label} must be text.`);
    const result = value[key].trim();
    if ((required && !result) || result.length > max || /[\u0000-\u001f\u007f]/.test(result)) throw new PeopleValidationError(`${label} is required and must be no longer than ${max} characters.`);
    return result;
  };
  const identifier = (key: string, label: string, required = false) => {
    const result = text(key, label, 100, required);
    if (result && !/^[a-zA-Z0-9_-]+$/.test(result)) throw new PeopleValidationError(`${label} is invalid.`);
    return result;
  };
  const email = text("email", "Work email", 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new PeopleValidationError("Work email is invalid.");
  const platformRole = value.platformRole;
  if (!peoplePlatformRoles.includes(platformRole as MvpEmployee["platformRole"])) throw new PeopleValidationError("Platform role is not recognised.");
  if (value.status !== "Active" && value.status !== "Archived") throw new PeopleValidationError("Status must be Active or Archived.");
  const startDate = text("startDate", "Start date", 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !Number.isFinite(Date.parse(startDate)) || new Date(startDate).toISOString().slice(0, 10) !== startDate) throw new PeopleValidationError("Start date must be a valid calendar date.");
  const timestamp = (key: string) => {
    const result = text(key, key === "createdAt" ? "Created date" : "Updated date", 40);
    if (!/^\d{4}-\d{2}-\d{2}T/.test(result) || !Number.isFinite(Date.parse(result))) throw new PeopleValidationError("The employee dates are invalid.");
    return new Date(result).toISOString();
  };
  return {
    id: identifier("id", "Employee identifier", true), employeeNumber: text("employeeNumber", "Employee number", 80), name: text("name", "Name", 160), email,
    jobTitle: text("jobTitle", "Job title", 160), roleId: identifier("roleId", "Role identifier"), managerId: identifier("managerId", "Manager identifier"),
    department: text("department", "Department", 160), site: text("site", "Site", 160, false), platformRole: platformRole as MvpEmployee["platformRole"], status: value.status,
    startDate, createdAt: timestamp("createdAt"), updatedAt: timestamp("updatedAt"),
  };
}

export function validatePeopleChanges(
  changes: readonly MvpEmployee[],
  existing: readonly MvpEmployee[],
  roles: readonly Pick<MvpRole, "id" | "status">[],
  options: { createOnly?: boolean } = {},
) {
  if (!changes.length || changes.length > 500) throw new PeopleValidationError("Save between 1 and 500 employee records at a time.");
  const changeIds = new Set<string>();
  const current = new Map(existing.map((employee) => [employee.id, employee]));
  for (const employee of changes) {
    if (changeIds.has(employee.id)) throw new PeopleValidationError("The import repeats an employee identifier.");
    if (options.createOnly && current.has(employee.id)) throw new PeopleValidationError("An imported employee already exists. Refresh People before preparing a new import.");
    changeIds.add(employee.id); current.set(employee.id, employee);
  }
  const emails = new Set<string>(); const numbers = new Set<string>();
  for (const employee of current.values()) {
    const email = employee.email.trim().toLowerCase(); const number = employee.employeeNumber.trim().toLowerCase();
    if (email && emails.has(email)) throw new PeopleValidationError("Each employee must have a unique work email in this workspace.");
    if (number && numbers.has(number)) throw new PeopleValidationError("Each employee must have a unique employee number in this workspace.");
    if (email) emails.add(email); if (number) numbers.add(number);
    // Archived historical records may reference a subsequently archived manager or role.
    if (employee.status !== "Active") continue;
    if (employee.roleId && !roles.some((role) => role.id === employee.roleId && role.status === "Active")) throw new PeopleValidationError("Select an active role from this workspace.");
    if (employee.managerId) {
      const manager = current.get(employee.managerId);
      if (employee.managerId === employee.id || !manager || manager.status !== "Active" || manager.platformRole !== "Line Manager") throw new PeopleValidationError("Select an active Line Manager from this workspace; an employee cannot manage themselves.");
      const visited = new Set([employee.id]); let next: MvpEmployee | undefined = manager;
      while (next) {
        if (visited.has(next.id)) throw new PeopleValidationError("Manager relationships cannot form a cycle.");
        visited.add(next.id); next = next.managerId ? current.get(next.managerId) : undefined;
      }
    }
  }
}
