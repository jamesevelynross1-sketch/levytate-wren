import type {
  CareerLevel,
  DeliveryPreference,
  FundingRoute,
  ProviderCatalogueRecord,
  ProviderProgramme,
  RequestStatus,
} from "@/lib/levytate/domain";
import { mvpProviderCatalogue, mvpProviderProgrammes } from "@/lib/levytate/data/mvp";

export type MvpRecordStatus = "Active" | "Archived";

export type MvpWorkspaceProfile = {
  employerName: string;
  workspaceName: string;
  primaryContact: string;
  contactEmail: string;
  defaultSite: string;
  sites: string[];
  departments: string[];
};

export type MvpEmployee = {
  id: string;
  employeeNumber: string;
  name: string;
  email: string;
  roleId: string;
  managerId: string;
  department: string;
  site: string;
  platformRole: "Employee" | "Line Manager" | "Department Head" | "Apprenticeship Lead";
  status: MvpRecordStatus;
  startDate: string;
  createdAt: string;
  updatedAt: string;
};

export type MvpPathwayMapping = {
  id: string;
  apprenticeshipStandardId: string;
  recommendationType: "Primary" | "Alternative";
  priority: number;
  businessRationale: string;
  fundingRoute: FundingRoute;
  deliveryPreference: DeliveryPreference;
};

export type MvpRole = {
  id: string;
  title: string;
  department: string;
  businessArea: string;
  careerLevel: CareerLevel;
  skillsTags: string[];
  progression: string[];
  pathwayMappings: MvpPathwayMapping[];
  status: MvpRecordStatus;
  createdAt: string;
  updatedAt: string;
};

export type MvpApplication = {
  id: string;
  employeeId: string;
  apprenticeshipStandardId: string;
  status: RequestStatus;
  reason: string;
  careerGoal: string;
  managerNote: string;
  submittedAt: string;
  updatedAt: string;
};

export type MvpMatchingStatus = "Submitted" | "Under Review" | "Provider Shortlist Being Prepared" | "Shortlist Ready";

export type MvpMatchingRequest = {
  id: string;
  roleNeed: string;
  apprenticeshipStandardId: string;
  learnerCount: number;
  sites: string[];
  deliveryPreference: string;
  fundingPosition: string;
  urgency: string;
  notes: string;
  status: MvpMatchingStatus;
  shortlistProviderIds: string[];
  createdAt: string;
  updatedAt: string;
};

export type MvpEnrolmentStatus = "Ready for provider" | "Submitted to provider" | "Enrolment in progress" | "Live learner" | "Completed" | "Cancelled";

export type MvpEnrolment = {
  id: string;
  applicationId: string;
  employeeId: string;
  providerId: string;
  apprenticeshipStandardId: string;
  status: MvpEnrolmentStatus;
  startDate: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type MvpWorkspaceData = {
  version: 2;
  profile: MvpWorkspaceProfile;
  employees: MvpEmployee[];
  roles: MvpRole[];
  applications: MvpApplication[];
  providers: ProviderCatalogueRecord[];
  providerProgrammes: ProviderProgramme[];
  matchingRequests: MvpMatchingRequest[];
  enrolments: MvpEnrolment[];
};

export const mvpWorkspaceStorageKey = "levytate:mvp:workspace:v2";
export const legacyMvpWorkspaceStorageKey = "levytate:mvp:workspace:v1";

export function createEmptyMvpWorkspace(): MvpWorkspaceData {
  return {
    version: 2,
    profile: {
      employerName: "",
      workspaceName: "LevyTate beta workspace",
      primaryContact: "",
      contactEmail: "hello@levytate.co.uk",
      defaultSite: "",
      sites: [],
      departments: [],
    },
    employees: [],
    roles: [],
    applications: [],
    providers: structuredClone(mvpProviderCatalogue),
    providerProgrammes: structuredClone(mvpProviderProgrammes),
    matchingRequests: [],
    enrolments: [],
  };
}

export function createMvpId(prefix: string) {
  const id = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}-${id}`;
}

export function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function nowIso() {
  return new Date().toISOString();
}

export function splitMvpList(value: string) {
  return [...new Set(value.split(",").map((item) => item.trim()).filter(Boolean))];
}

export function activeApplicationStatuses(): RequestStatus[] {
  return [
    "Draft",
    "Submitted to Line Manager",
    "Awaiting Manager Review",
    "Approved by Line Manager",
    "Submitted to Apprenticeship Lead",
    "Awaiting Final Approval",
    "Approved for Enrolment",
  ];
}