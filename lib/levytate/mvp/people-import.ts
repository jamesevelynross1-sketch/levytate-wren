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
  const table = parseCsv(csv.replace(/^\uFEFF/, ""));
  if (table.length < 2) return { rows: [], issues: [{ sourceRow: 1, message: "The CSV contains no employee rows." }] };
  const headers = table[0].map(normaliseHeader);
  const index = (aliases: string[]) => aliases.map((value) => headers.indexOf(value)).find((value) => value >= 0) ?? -1;
  const columns = {
    name: index(["name", "employee name", "full name"]), email: index(["email", "work email", "employee email"]),
    jobTitle: index(["job title", "role", "position"]), department: index(["department", "team"]), employeeNumber: index(["employee number", "employee ref", "employee reference"]),
    site: index(["site", "location"]), managerEmail: index(["manager email", "line manager email"]), platformRole: index(["platform role", "levytate role"]), status: index(["status"]),
  };
  const missing = (["name", "email", "jobTitle", "department"] as const).filter((key) => columns[key] < 0);
  if (missing.length) return { rows: [], issues: [{ sourceRow: 1, message: `Missing required columns: ${missing.join(", ")}.` }] };
  const rows: PeopleImportRow[] = []; const issues: PeopleImportResult["issues"] = []; const seen = new Set<string>();
  table.slice(1).forEach((cells, offset) => {
    if (!cells.some((cell) => cell.trim())) return;
    const sourceRow = offset + 2; const read = (position: number) => position >= 0 ? (cells[position] ?? "").trim() : "";
    const name = read(columns.name); const email = read(columns.email).toLowerCase(); const jobTitle = read(columns.jobTitle); const department = read(columns.department);
    if (!name || !email || !jobTitle || !department) { issues.push({ sourceRow, message: "Name, work email, job title and department are required." }); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { issues.push({ sourceRow, message: "Work email is invalid." }); return; }
    if (seen.has(email)) { issues.push({ sourceRow, message: "Duplicate work email in this CSV." }); return; } seen.add(email);
    const requestedRole = read(columns.platformRole) || "Employee";
    if (!roleValues.has(requestedRole as PeopleImportRow["platformRole"])) { issues.push({ sourceRow, message: "Platform role is not recognised." }); return; }
    rows.push({ sourceRow, name, email, jobTitle, department, employeeNumber: read(columns.employeeNumber), site: read(columns.site), managerEmail: read(columns.managerEmail).toLowerCase(), platformRole: requestedRole as PeopleImportRow["platformRole"], status: read(columns.status).toLowerCase() === "archived" ? "Archived" : "Active" });
  });
  return { rows, issues };
}

function normaliseHeader(value: string) { return value.trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " "); }
function parseCsv(value: string) { const rows:string[][]=[];let row:string[]=[];let cell="";let quoted=false;for(let i=0;i<value.length;i+=1){const char=value[i];if(char==='"'&&quoted&&value[i+1]==='"'){cell+='"';i+=1;}else if(char==='"')quoted=!quoted;else if(char===","&&!quoted){row.push(cell);cell="";}else if((char==="\n"||char==="\r")&&!quoted){if(char==="\r"&&value[i+1]==="\n")i+=1;row.push(cell);rows.push(row);row=[];cell="";}else cell+=char;}if(cell||row.length){row.push(cell);rows.push(row);}return rows;}
