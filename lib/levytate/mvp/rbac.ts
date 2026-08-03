export type MvpUserRole =
  | "Platform Admin"
  | "Employer Admin"
  | "Apprenticeship Lead"
  | "Line Manager"
  | "Employee";

export type MvpPermission =
  | "workspace:read"
  | "workspace:migrate"
  | "settings:read"
  | "settings:write"
  | "employees:read"
  | "employees:write"
  | "employees:archive"
  | "employeeDevelopment:write"
  | "roles:read"
  | "roles:write"
  | "roles:archive"
  | "applications:read"
  | "applications:write"
  | "applications:status"
  | "providers:read"
  | "providers:write"
  | "providers:archive"
  | "providerRelationships:read"
  | "providerRelationships:write"
  | "providerMatching:read"
  | "providerMatching:write"
  | "providerMatching:status"
  | "enrolments:read"
  | "enrolments:write"
  | "enrolments:status"
  | "learnerLifecycle:read"
  | "learnerLifecycle:write"
  | "learnerLifecycle:status"
  | "operationalActions:read"
  | "operationalActions:write"
  | "copilot:use"
  | "knowledge:read"
  | "knowledge:manage"
  | "reports:read"
  | "earlyAccess:manage";

export type MvpWorkspaceMutationType =
  | "saveProfile"
  | "saveEmployee"
  | "archiveEmployee"
  | "saveEmployeeDevelopmentProfile"
  | "saveRole"
  | "archiveRole"
  | "saveApplication"
  | "updateApplicationStatus"
  | "saveProvider"
  | "archiveProvider"
  | "saveProviderProgramme"
  | "archiveProviderProgramme"
  | "removeProviderProgramme"
  | "saveProviderRelationship"
  | "saveMatchingRequest"
  | "updateMatchingStatus"
  | "saveEnrolment"
  | "updateEnrolmentStatus"
  | "createLearnerRecord"
  | "updateLearnerLifecycleStatus"
  | "recordEligibilityDeclaration"
  | "updatePreEnrolmentChecks"
  | "addLearnerReview"
  | "addProgressUpdate"
  | "startBreakInLearning"
  | "returnFromBreak"
  | "recordWithdrawal"
  | "updateAssessmentReadiness"
  | "recordAchievement"
  | "completeOperationalAction"
  | "migrateWorkspaceSnapshot";

const allPermissions = [
  "workspace:read",
  "workspace:migrate",
  "settings:read",
  "settings:write",
  "employees:read",
  "employees:write",
  "employees:archive",
  "employeeDevelopment:write",
  "roles:read",
  "roles:write",
  "roles:archive",
  "applications:read",
  "applications:write",
  "applications:status",
  "providers:read",
  "providers:write",
  "providers:archive",
  "providerRelationships:read",
  "providerRelationships:write",
  "providerMatching:read",
  "providerMatching:write",
  "providerMatching:status",
  "enrolments:read",
  "enrolments:write",
  "enrolments:status",
  "learnerLifecycle:read",
  "learnerLifecycle:write",
  "learnerLifecycle:status",
  "operationalActions:read",
  "operationalActions:write",
  "copilot:use",
  "knowledge:read",
  "knowledge:manage",
  "reports:read",
  "earlyAccess:manage",
] as const satisfies readonly MvpPermission[];

export const mvpRolePermissions = {
  "Platform Admin": [
    "workspace:read",
    "workspace:migrate",
    "settings:read",
    "settings:write",
    "providers:read",
    "providers:write",
    "providers:archive",
    "knowledge:read",
    "knowledge:manage",
    "earlyAccess:manage",
  ],
  "Employer Admin": allPermissions.filter((permission) => permission !== "earlyAccess:manage"),
  "Apprenticeship Lead": [
    "workspace:read",
    "settings:read",
    "employees:read",
    "employees:write",
    "employeeDevelopment:write",
    "roles:read",
    "roles:write",
    "applications:read",
    "applications:write",
    "applications:status",
    "providers:read",
    "providers:write",
    "providerRelationships:read",
    "providerRelationships:write",
    "providerMatching:read",
    "providerMatching:write",
    "providerMatching:status",
    "enrolments:read",
    "enrolments:write",
    "enrolments:status",
    "learnerLifecycle:read",
    "learnerLifecycle:write",
    "learnerLifecycle:status",
    "operationalActions:read",
    "operationalActions:write",
    "copilot:use",
    "knowledge:read",
    "reports:read",
  ],
  "Line Manager": [
    "workspace:read",
    "employees:read",
    "employeeDevelopment:write",
    "applications:read",
    "applications:status",
    "learnerLifecycle:read",
    "providers:read",
    "copilot:use",
    "knowledge:read",
  ],
  Employee: [
    "workspace:read",
    "employeeDevelopment:write",
    "applications:read",
    "applications:write",
    "learnerLifecycle:read",
    "providers:read",
    "copilot:use",
    "knowledge:read",
  ],
} as const satisfies Record<MvpUserRole, readonly MvpPermission[]>;

export const mvpMutationPermission = {
  saveProfile: "settings:write",
  saveEmployee: "employees:write",
  archiveEmployee: "employees:archive",
  saveEmployeeDevelopmentProfile: "employeeDevelopment:write",
  saveRole: "roles:write",
  archiveRole: "roles:archive",
  saveApplication: "applications:write",
  updateApplicationStatus: "applications:status",
  saveProvider: "providers:write",
  archiveProvider: "providers:archive",
  saveProviderProgramme: "providers:write",
  archiveProviderProgramme: "providers:archive",
  removeProviderProgramme: "providers:archive",
  saveProviderRelationship: "providerRelationships:write",
  saveMatchingRequest: "providerMatching:write",
  updateMatchingStatus: "providerMatching:status",
  saveEnrolment: "enrolments:write",
  updateEnrolmentStatus: "enrolments:status",
  createLearnerRecord: "learnerLifecycle:write",
  updateLearnerLifecycleStatus: "learnerLifecycle:status",
  recordEligibilityDeclaration: "learnerLifecycle:write",
  updatePreEnrolmentChecks: "learnerLifecycle:write",
  addLearnerReview: "learnerLifecycle:write",
  addProgressUpdate: "learnerLifecycle:write",
  startBreakInLearning: "learnerLifecycle:status",
  returnFromBreak: "learnerLifecycle:status",
  recordWithdrawal: "learnerLifecycle:status",
  updateAssessmentReadiness: "learnerLifecycle:write",
  recordAchievement: "learnerLifecycle:status",
  completeOperationalAction: "learnerLifecycle:write",
  migrateWorkspaceSnapshot: "workspace:migrate",
} as const satisfies Record<MvpWorkspaceMutationType, MvpPermission>;

export function normaliseMvpUserRole(role: string | null | undefined): MvpUserRole {
  if (
    role === "Platform Admin" ||
    role === "Employer Admin" ||
    role === "Apprenticeship Lead" ||
    role === "Line Manager" ||
    role === "Employee"
  ) {
    return role;
  }

  return "Employee";
}

export function permissionsForMvpRole(role: MvpUserRole | string | null | undefined): MvpPermission[] {
  return [...mvpRolePermissions[normaliseMvpUserRole(role)]];
}

export function hasMvpPermission(
  roleOrPermissions: MvpUserRole | MvpPermission[] | readonly MvpPermission[] | string | null | undefined,
  permission: MvpPermission,
) {
  const permissions = Array.isArray(roleOrPermissions)
    ? roleOrPermissions as readonly MvpPermission[]
    : permissionsForMvpRole(roleOrPermissions as MvpUserRole | string | null | undefined);

  return permissions.includes(permission);
}

export function canRunMvpMutation(role: MvpUserRole | string | null | undefined, mutationType: MvpWorkspaceMutationType) {
  return hasMvpPermission(role, mvpMutationPermission[mutationType]);
}
