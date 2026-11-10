import { normalisePeopleRecord, PeopleValidationError, validatePeopleChanges } from "@/lib/levytate/mvp/people-validation";
import type { MvpEmployee, MvpRole } from "@/lib/levytate/mvp/workspace";

export type PeopleImportRow = {
  sourceRow: number;
  name: string;
  email: string;
  jobTitle: string;
  department: string;
  employeeNumber: string;
  site: string;
  managerEmail: string;
  platformRole: "Employee" | "Line Manager" | "Department Head" | "Apprenticeship Lead";
  status: "Active" | "Archived";
};

export type PeopleImportResult = { rows: PeopleImportRow[]; issues: Array<{ sourceRow: number; message: string }> };
const roleValues = new Set<PeopleImportRow["platformRole"]>(["Employee", "Line Manager", "Department Head", "Apprenticeship Lead"]);

export function parsePeopleCsv(csv: string): PeopleImportResult {
  let table: string[][];
  try { table = parseCsv(csv.replace(/^\uFEFF/, "")); }
  catch { return { rows: [], issues: [{ sourceRow: 1, message: "The CSV contains an invalid or unclosed quoted field." }] }; }
  if (table.length < 2) return { rows: [], issues: [{ sourceRow: 1, message: "The CSV contains no employee rows." }] };
  if (table.length > 501) return { rows: [], issues: [{ sourceRow: 1, message: "Import no more than 500 employees at a time." }] };
  const headers = table[0].map(normaliseHeader);
  if (new Set(headers).size !== headers.length || headers.some((header) => !header)) return { rows: [], issues: [{ sourceRow: 1, message: "Column headings must be non-empty and unique." }] };
  const index = (aliases: string[]) => aliases.map((value) => headers.indexOf(value)).find((value) => value >= 0) ?? -1;
  const columns = {
    name: index(["name", "employee name", "full name"]), email: index(["email", "work email", "employee email"]),
    jobTitle: index(["job title", "role", "position"]), department: index(["department", "team"]), employeeNumber: index(["employee number", "employee ref", "employee reference"]),
    site: index(["site", "location"]), managerEmail: index(["manager email", "line manager email"]), platformRole: index(["platform role", "levytate role"]), status: index(["status"]),
  };
  const missing = (["name", "email", "jobTitle", "department"] as const).filter((key) => columns[key] < 0);
  if (missing.length) return { rows: [], issues: [{ sourceRow: 1, message: `Missing required columns: ${missing.join(", ")}.` }] };
  const rows: PeopleImportRow[] = []; const issues: PeopleImportResult["issues"] = []; const seen = new Set<string>(); const numbers = new Set<string>();
  table.slice(1).forEach((cells, offset) => {
    if (!cells.some((cell) => cell.trim())) return;
    const sourceRow = offset + 2; const read = (position: number) => position >= 0 ? (cells[position] ?? "").trim() : "";
    if (cells.length !== headers.length) { issues.push({ sourceRow, message: "The row must contain the same number of columns as the headings." }); return; }
    const name = read(columns.name); const email = read(columns.email).toLowerCase(); const jobTitle = read(columns.jobTitle); const department = read(columns.department);
    if (!name || !email || !jobTitle || !department) { issues.push({ sourceRow, message: "Name, work email, job title and department are required." }); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { issues.push({ sourceRow, message: "Work email is invalid." }); return; }
    if (seen.has(email)) { issues.push({ sourceRow, message: "Duplicate work email in this CSV." }); return; } seen.add(email);
    const requestedRole = read(columns.platformRole) || "Employee";
    if (!roleValues.has(requestedRole as PeopleImportRow["platformRole"])) { issues.push({ sourceRow, message: "Platform role is not recognised." }); return; }
    const requestedStatus = read(columns.status).toLowerCase();
    if (requestedStatus && requestedStatus !== "active" && requestedStatus !== "archived") { issues.push({ sourceRow, message: "Status must be Active or Archived." }); return; }
    const managerEmail = read(columns.managerEmail).toLowerCase(); const employeeNumber = read(columns.employeeNumber); const site = read(columns.site);
    if (managerEmail && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(managerEmail) || managerEmail === email)) { issues.push({ sourceRow, message: "Manager email must be valid and different from the employee email." }); return; }
    if ([name, jobTitle, department, site].some((value) => value.length > 160 || /[\u0000-\u001f\u007f]/.test(value)) || email.length > 254 || managerEmail.length > 254 || employeeNumber.length > 80) { issues.push({ sourceRow, message: "A field exceeds the permitted length or contains control characters." }); return; }
    if (employeeNumber && numbers.has(employeeNumber.toLowerCase())) { issues.push({ sourceRow, message: "Duplicate employee number in this CSV." }); return; }
    if (employeeNumber) numbers.add(employeeNumber.toLowerCase());
    rows.push({ sourceRow, name, email, jobTitle, department, employeeNumber, site, managerEmail, platformRole: requestedRole as PeopleImportRow["platformRole"], status: requestedStatus === "archived" ? "Archived" : "Active" });
  });
  return { rows, issues };
}

function normaliseHeader(value: string) {
  const header = value.trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
  const aliases: Record<string, string> = { "employee name": "name", "full name": "name", "work email": "email", "employee email": "email", role: "job title", position: "job title", team: "department", "employee ref": "employee number", "employee reference": "employee number", location: "site", "line manager email": "manager email", "levytate role": "platform role" };
  return aliases[header] ?? header;
}

export function preparePeopleImport(result: PeopleImportResult, existing: readonly MvpEmployee[], roles: readonly MvpRole[], newId: () => string, now: string) {
  if (result.issues.length) throw new PeopleValidationError("Correct every CSV issue before importing. No rows have been saved.");
  const identities = new Map(result.rows.map((item) => [item.email, newId()]));
  const employees = result.rows.map((item) => {
    if (existing.some((employee) => employee.email.trim().toLowerCase() === item.email)) throw new PeopleValidationError(`Row ${item.sourceRow}: this work email already exists. Edit its People record instead.`);
    const matches = roles.filter((role) => role.status === "Active" && role.title.trim().toLowerCase() === item.jobTitle.toLowerCase());
    if (matches.length > 1) throw new PeopleValidationError(`Row ${item.sourceRow}: the job title matches more than one active role.`);
    const managerId = item.managerEmail ? identities.get(item.managerEmail) ?? existing.find((employee) => employee.email.trim().toLowerCase() === item.managerEmail)?.id : "";
    if (item.managerEmail && !managerId) throw new PeopleValidationError(`Row ${item.sourceRow}: manager email does not identify someone in this workspace or file.`);
    const id = identities.get(item.email)!;
    return normalisePeopleRecord({ id, employeeNumber: item.employeeNumber || `EMP-${id.slice(-12).toUpperCase()}`, name: item.name, email: item.email, jobTitle: item.jobTitle,
      roleId: matches[0]?.id ?? "", managerId: managerId ?? "", department: item.department, site: item.site, platformRole: item.platformRole, status: item.status,
      startDate: now.slice(0, 10), createdAt: now, updatedAt: now });
  });
  validatePeopleChanges(employees, existing, roles, { createOnly: true });
  return employees;
}

function parseCsv(value: string) {
  const rows: string[][] = []; let row: string[] = []; let cell = ""; let quoted = false; let closed = false;
  for (let i = 0; i < value.length; i++) {
    const char = value[i];
    if (quoted) {
      if (char === '"' && value[i + 1] === '"') { cell += '"'; i++; }
      else if (char === '"') { quoted = false; closed = true; }
      else cell += char;
      continue;
    }
    if (char === '"') { if (cell || closed) throw new Error("quote"); quoted = true; }
    else if (char === ",") { row.push(cell); cell = ""; closed = false; }
    else if (char === "\n" || char === "\r") {
      if (char === "\r" && value[i + 1] === "\n") i++;
      row.push(cell); rows.push(row); row = []; cell = ""; closed = false;
    } else { if (closed) throw new Error("quote"); cell += char; }
  }
  if (quoted) throw new Error("quote");
  if (cell || row.length || closed) { row.push(cell); rows.push(row); }
  return rows;
}
