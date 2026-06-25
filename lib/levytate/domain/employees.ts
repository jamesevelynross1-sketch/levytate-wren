import type { EmployeeRecord, EmployeeRecordStatus, RequestStatus } from "./types";

export type EmployeeManagementFilters = {
  search: string;
  status: EmployeeRecordStatus | "All";
  department: string;
  site: string;
  manager: string;
  applicationStatus: EmployeeRecord["applicationStatus"] | "All";
};

export const noActiveApplicationLabel = "No active application" as const;

export function filterEmployeeRecords(employees: EmployeeRecord[], filters: EmployeeManagementFilters) {
  const query = filters.search.trim().toLowerCase();

  return employees.filter((employee) => {
    const matchesSearch = !query || [employee.name, employee.email, employee.employeeNumber, employee.role, employee.department, employee.manager, employee.site]
      .join(" ")
      .toLowerCase()
      .includes(query);
    const matchesStatus = filters.status === "All" || employee.status === filters.status;
    const matchesDepartment = filters.department === "All" || employee.department === filters.department;
    const matchesSite = filters.site === "All" || employee.site === filters.site;
    const matchesManager = filters.manager === "All" || employee.manager === filters.manager;
    const matchesApplicationStatus = filters.applicationStatus === "All" || employee.applicationStatus === filters.applicationStatus;

    return matchesSearch && matchesStatus && matchesDepartment && matchesSite && matchesManager && matchesApplicationStatus;
  });
}

export function uniqueEmployeeValues(employees: EmployeeRecord[], field: keyof Pick<EmployeeRecord, "department" | "site" | "manager" | "applicationStatus">) {
  return Array.from(new Set(employees.map((employee) => String(employee[field])))).sort((a, b) => a.localeCompare(b));
}

export function nextEmployeeNumber(employees: EmployeeRecord[]) {
  const highest = employees.reduce((max, employee) => {
    const numeric = Number(employee.employeeNumber.replace(/[^0-9]/g, ""));
    return Number.isFinite(numeric) ? Math.max(max, numeric) : max;
  }, 0);

  return `PK-${String(highest + 1).padStart(4, "0")}`;
}

export function isClosedApplicationStatus(status: EmployeeRecord["applicationStatus"]) {
  const closedStatuses: Array<RequestStatus | typeof noActiveApplicationLabel> = [
    noActiveApplicationLabel,
    "Declined by Line Manager",
    "Declined by Apprenticeship Lead",
    "Withdrawn",
    "Completed",
    "Cancelled",
  ];

  return closedStatuses.includes(status);
}
