import type { ProviderCatalogueRecord, ProviderProgramme, RequestStatus } from "@/lib/levytate/domain";
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

export type MvpWorkspaceStorageMode = "supabase" | "local_fallback";

export type LevyTateWorkspaceMeta = {
  organisationId: string;
  organisationName: string;
  userEmail: string;
  userRole: "Platform Admin" | "Employer Admin" | "Apprenticeship Lead" | "Line Manager" | "Employee";
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
