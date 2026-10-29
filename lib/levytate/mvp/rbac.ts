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
  | "applicationWorkflows:manage"
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
  | "serviceRequests:read"
  | "serviceRequests:write"
  | "serviceRequests:publish"
  | "serviceRequests:decide"
  | "enrolments:read"
  | "enrolments:write"
  | "enrolments:status"
  | "learnerLifecycle:read"
  | "learnerLifecycle:write"
  | "learnerLifecycle:status"
  | "learningTime:read"
  | "learningTime:write"
  | "learningTime:manage"
  | "assessments:read"
  | "assessments:write"
  | "assessments:review"
  | "assessments:manage"
  | "operationalActions:read"
  | "operationalActions:write"
  | "copilot:use"
  | "knowledge:read"
  | "knowledge:manage"
  | "reports:read"
  | "finance:read"
  | "finance:manage"
  | "earlyAccess:manage"
  | "diagnostics:read";

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
  | "saveOrganisationProvider"
  | "saveOrganisationProgramme"
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
  | "completeOperationalAction";

const allPermissions = [
  "workspace:read",
  "workspace:migrate",
  "settings:read",
  "settings:write",
  "applicationWorkflows:manage",
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
  "serviceRequests:read",
  "serviceRequests:write",
  "serviceRequests:publish",
  "serviceRequests:decide",
  "enrolments:read",
  "enrolments:write",
  "enrolments:status",
  "learnerLifecycle:read",
  "learnerLifecycle:write",
  "learnerLifecycle:status",
  "learningTime:read",
  "learningTime:write",
  "learningTime:manage",
  "assessments:read",
  "assessments:write",
  "assessments:review",
  "assessments:manage",
  "operationalActions:read",
  "operationalActions:write",
  "copilot:use",
  "knowledge:read",
  "knowledge:manage",
  "reports:read",
  "finance:read",
  "finance:manage",
  "earlyAccess:manage",
  "diagnostics:read",
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
    "diagnostics:read",
  ],
  "Employer Admin": allPermissions.filter((permission) => !["earlyAccess:manage", "diagnostics:read"].includes(permission)),
  "Apprenticeship Lead": [
    "workspace:read",
    "settings:read",
    "applicationWorkflows:manage",
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
    "serviceRequests:read",
    "serviceRequests:write",
    "serviceRequests:publish",
    "serviceRequests:decide",
    "enrolments:read",
    "enrolments:write",
    "enrolments:status",
    "learnerLifecycle:read",
    "learnerLifecycle:write",
    "learnerLifecycle:status",
    "learningTime:read",
    "learningTime:write",
    "learningTime:manage",
    "assessments:read",
    "assessments:review",
    "assessments:manage",
    "operationalActions:read",
    "operationalActions:write",
    "copilot:use",
    "knowledge:read",
    "reports:read",
    "finance:read",
    "finance:manage",
  ],
  "Line Manager": [
    "workspace:read",
    "employees:read",
    "employeeDevelopment:write",
    "applications:read",
    "applications:status",
    "learnerLifecycle:read",
    "learningTime:read",
    "assessments:read",
    "assessments:review",
    "providers:read",
    "copilot:use",
    "knowledge:read",
  ],
  Employee: [
    "workspace:read",
    "employeeDevelopment:write",
    "applications:read",
    "applications:write",
    "assessments:read",
    "assessments:write",
    "learnerLifecycle:read",
    "learningTime:read",
    "learningTime:write",
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
  saveOrganisationProvider: "providerRelationships:write",
  saveOrganisationProgramme: "providerRelationships:write",
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
} as const satisfies Record<MvpWorkspaceMutationType, MvpPermission>;

export function parseMvpUserRole(role: unknown): MvpUserRole | null {
  if (
    role === "Platform Admin" ||
    role === "Employer Admin" ||
    role === "Apprenticeship Lead" ||
    role === "Line Manager" ||
    role === "Employee"
  ) {
    return role;
  }

  return null;
}

export function normaliseMvpUserRole(role: string | null | undefined): MvpUserRole {
  const parsed = parseMvpUserRole(role);
  if (!parsed) throw new RangeError("Unsupported LevyTate role.");
  return parsed;
}

export function permissionsForMvpRole(role: MvpUserRole | string | null | undefined): MvpPermission[] {
  const parsed = parseMvpUserRole(role);
  return parsed ? [...mvpRolePermissions[parsed]] : [];
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
