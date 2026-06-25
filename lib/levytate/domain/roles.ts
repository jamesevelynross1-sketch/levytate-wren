import type { Role, RequestStatus, SectionKey } from './types';

type NavSection = { title: string; items: SectionKey[] };

export const roles: Role[] = ["Employee", "Line Manager", "Department Head", "Apprenticeship Lead"];
export const requestStages: RequestStatus[] = ["Draft", "Submitted to Line Manager", "Awaiting Manager Review", "Declined by Line Manager", "Approved by Line Manager", "Submitted to Apprenticeship Lead", "Awaiting Final Approval", "Declined by Apprenticeship Lead", "Approved for Enrolment", "Withdrawn", "Completed", "Cancelled"];
export const publicStages: RequestStatus[] = ["Draft", "Submitted to Line Manager", "Awaiting Manager Review", "Approved by Line Manager", "Submitted to Apprenticeship Lead", "Awaiting Final Approval", "Approved for Enrolment"];
export const activeApplicationStatuses: RequestStatus[] = ["Draft", "Submitted to Line Manager", "Awaiting Manager Review", "Approved by Line Manager", "Submitted to Apprenticeship Lead", "Awaiting Final Approval", "Approved for Enrolment"];
export const currentManagerName = "Ryan Booth";
export const sidebarStateKey = "levytate:portakabin:sidebar-collapsed";

export const navSectionsByRole: Record<Role, NavSection[]> = {
  Employee: [
    { title: "Employee", items: ["Ask LevyTate AI", "Dashboard", "My Applications", "Development Passport"] },
  ],
  "Line Manager": [
    { title: "Manager", items: ["Dashboard", "Applications to Review", "Team Development", "Ask LevyTate AI"] },
  ],
  "Department Head": [
    { title: "Department", items: ["Dashboard", "Department Analytics", "Reporting", "Ask LevyTate AI"] },
  ],
  "Apprenticeship Lead": [
    { title: "Operations", items: ["Dashboard", "Applications for Final Approval", "Approved for Enrolment", "Providers", "Reporting", "Ask LevyTate AI"] },
  ],
  "Admin Console": [
    { title: "Admin Console", items: ["Dashboard", "User Management", "Role Management", "Permission Management", "Provider Management", "Programme Catalogue"] },
    { title: "Configuration", items: ["Employer Configuration", "Site Configuration", "Audit Logs", "Platform Analytics", "System Settings"] },
  ],
};




