import type { ProviderCatalogueRecord, ProviderProgramme, RequestStatus } from "@/lib/levytate/domain";
import type { EmployeeOperationalSummary } from "@/lib/levytate/mvp/employee-operational-summary";
import type {
  MvpApplication,
  MvpEmployee,
  MvpEmployeeDevelopmentProfile,
  MvpEnrolment,
  MvpEnrolmentStatus,
  MvpMatchingRequest,
  MvpMatchingStatus,
  MvpProviderRelationship,
  MvpRole,
  MvpWorkspaceData,
  MvpWorkspaceProfile,
} from "@/lib/levytate/mvp/workspace";
import type { MvpPermission, MvpUserRole } from "@/lib/levytate/mvp/rbac";

export type MvpWorkspaceStorageMode = "supabase" | "local_fallback";

export type ProspectAccessMeta = {
  id: string;
  status: "prepared" | "active" | "expired" | "revoked";
  statusLabel: string;
  accessStartAt: string | null;
  accessExpiresAt: string | null;
  firstLoginAt: string | null;
  guidanceCompletedAt: string | null;
  version: number;
};

export type LevyTateWorkspaceMeta = {
  organisationId: string;
  organisationName: string;
  userEmail: string;
  userRole: MvpUserRole;
  permissions?: MvpPermission[];
  directReportOperationalSummaries?: EmployeeOperationalSummary[];
  prospectAccess?: ProspectAccessMeta | null;
  storageMode: MvpWorkspaceStorageMode;
  warnings: string[];
};

export type LevyTateWorkspaceBootstrap = {
  data: MvpWorkspaceData;
  meta: LevyTateWorkspaceMeta;
};

export type LevyTateWorkspaceMutation =
  | { type: "saveProfile"; profile: MvpWorkspaceProfile }
  | { type: "saveEmployee"; employee: MvpEmployee }
  | { type: "archiveEmployee"; id: string }
  | { type: "saveEmployeeDevelopmentProfile"; profile: MvpEmployeeDevelopmentProfile }
  | { type: "saveRole"; role: MvpRole }
  | { type: "archiveRole"; id: string }
  | { type: "saveApplication"; application: MvpApplication }
  | { type: "updateApplicationStatus"; id: string; status: RequestStatus; note?: string }
  | { type: "saveProvider"; provider: ProviderCatalogueRecord }
  | { type: "archiveProvider"; id: string }
  | { type: "saveProviderProgramme"; programme: ProviderProgramme }
  | { type: "archiveProviderProgramme"; id: string }
  | { type: "removeProviderProgramme"; id: string }
  | { type: "saveProviderRelationship"; relationship: MvpProviderRelationship }
  | { type: "saveMatchingRequest"; request: MvpMatchingRequest }
  | { type: "updateMatchingStatus"; id: string; status: MvpMatchingStatus }
  | { type: "saveEnrolment"; enrolment: MvpEnrolment }
  | { type: "updateEnrolmentStatus"; id: string; status: MvpEnrolmentStatus }
  | { type: "migrateWorkspaceSnapshot"; snapshot: MvpWorkspaceData };
