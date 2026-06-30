"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { ProviderCatalogueRecord, ProviderProgramme, RequestStatus } from "@/lib/levytate/domain";
import { resolveApprenticeshipStandardId } from "@/lib/levytate/domain";
import {
  applicationOwnerForStatus,
  buildApplicationHistoryEntry,
  createEmptyMvpWorkspace,
  legacyMvpWorkspaceStorageKey,
  mvpWorkspaceStorageKey,
  normaliseApplication,
  nowIso,
  oldestMvpWorkspaceStorageKey,
  previousMvpWorkspaceStorageKey,
  type MvpApplication,
  type MvpEmployee,
  type MvpEmployeeDevelopmentProfile,
  type MvpEnrolment,
  type MvpEnrolmentStatus,
  type MvpMatchingRequest,
  type MvpMatchingStatus,
  type MvpPathwayMapping,
  type MvpProviderRelationship,
  type MvpRole,
  type MvpWorkspaceData,
  type MvpWorkspaceProfile,
} from "@/lib/levytate/mvp/workspace";

type MvpWorkspaceStore = {
  data: MvpWorkspaceData;
  hydrated: boolean;
  saveProfile: (profile: MvpWorkspaceProfile) => void;
  saveEmployee: (employee: MvpEmployee) => void;
  archiveEmployee: (id: string) => void;
  saveEmployeeDevelopmentProfile: (profile: MvpEmployeeDevelopmentProfile) => void;
  saveRole: (role: MvpRole) => void;
  archiveRole: (id: string) => void;
  saveApplication: (application: MvpApplication) => void;
  updateApplicationStatus: (id: string, status: RequestStatus, note?: string) => void;
  saveProvider: (provider: ProviderCatalogueRecord) => void;
  archiveProvider: (id: string) => void;
  saveProviderProgramme: (programme: ProviderProgramme) => void;
  archiveProviderProgramme: (id: string) => void;
  removeProviderProgramme: (id: string) => void;
  saveProviderRelationship: (relationship: MvpProviderRelationship) => void;
  saveMatchingRequest: (request: MvpMatchingRequest) => void;
  updateMatchingStatus: (id: string, status: MvpMatchingStatus) => void;
  saveEnrolment: (enrolment: MvpEnrolment) => void;
  updateEnrolmentStatus: (id: string, status: MvpEnrolmentStatus) => void;
};

type LegacyProgramme = {
  programmeId?: string;
  apprenticeshipStandardId?: string;
  programmeName?: string;
  standardName?: string;
  deliveryMode?: string;
  regions?: string[];
  sourceUrl?: string;
  notes?: string;
  verificationStatus?: string;
  fundingStatus?: string;
};

type LegacyProvider = ProviderCatalogueRecord & { programmes?: LegacyProgramme[] };
type LegacyMapping = Partial<MvpPathwayMapping> & { pathwayTitle?: string };
type LegacyRole = Omit<MvpRole, "pathwayMappings"> & { pathwayMappings?: LegacyMapping[] };
type LegacyApplication = Partial<MvpApplication> & { apprenticeshipStandardId?: string; pathwayTitle?: string; note?: string; decisionNotes?: string; submittedDate?: string };
type LegacyMatchingRequest = Omit<MvpMatchingRequest, "apprenticeshipStandardId"> & { apprenticeshipStandardId?: string; programme?: string };
type LegacyEnrolment = Omit<MvpEnrolment, "apprenticeshipStandardId"> & { apprenticeshipStandardId?: string; programme?: string };
type LegacyWorkspace = Partial<Omit<MvpWorkspaceData, "version" | "roles" | "applications" | "matchingRequests" | "enrolments" | "providers">> & {
  version?: number;
  providers?: LegacyProvider[];
  roles?: LegacyRole[];
  applications?: LegacyApplication[];
  matchingRequests?: LegacyMatchingRequest[];
  enrolments?: LegacyEnrolment[];
};

const MvpWorkspaceContext = createContext<MvpWorkspaceStore | null>(null);

function upsert<T>(items: T[], item: T, key: keyof T) {
  return items.some((current) => current[key] === item[key])
    ? items.map((current) => current[key] === item[key] ? item : current)
    : [item, ...items];
}

function migrateLegacyWorkspace(parsed: LegacyWorkspace): MvpWorkspaceData {
  const empty = createEmptyMvpWorkspace();
  const legacyProviders = Array.isArray(parsed.providers) ? parsed.providers : [];
  const providerProgrammes = legacyProviders.flatMap((provider) =>
    (provider.programmes ?? []).flatMap((programme) => {
      const apprenticeshipStandardId = programme.apprenticeshipStandardId ?? resolveApprenticeshipStandardId(programme.standardName ?? programme.programmeName ?? "");
      if (!apprenticeshipStandardId) return [];
      const historical = programme.fundingStatus === "defunded_for_new_starts";
      return [{
        id: programme.programmeId ?? `${provider.providerId}-${apprenticeshipStandardId.toLowerCase()}`,
        providerId: provider.providerId,
        apprenticeshipStandardId,
        deliveryMode: programme.deliveryMode ?? "Provider confirmation required",
        regions: programme.regions ?? provider.regions ?? ["England"],
        status: historical ? "Defunded / unavailable for new starts" as const : "Needs verification" as const,
        verificationStatus: programme.verificationStatus === "verified" ? "Verified from provider website" as const : "Needs manual verification" as const,
        sourceUrl: programme.sourceUrl ?? provider.website,
        notes: programme.notes ?? "Migrated from the previous provider catalogue.",
        recordStatus: "Active" as const,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      }];
    }),
  );

  const roles = (parsed.roles ?? []).map((role) => ({
    ...role,
    pathwayMappings: (role.pathwayMappings ?? []).flatMap((mapping) => {
      const apprenticeshipStandardId = mapping.apprenticeshipStandardId ?? resolveApprenticeshipStandardId(mapping.pathwayTitle ?? "");
      return apprenticeshipStandardId ? [{ ...mapping, apprenticeshipStandardId } as MvpPathwayMapping] : [];
    }),
  })) as MvpRole[];

  const employees = Array.isArray(parsed.employees)
    ? parsed.employees.map((employee) => ({
        ...employee,
        jobTitle: employee.jobTitle ?? roles.find((role) => role.id === employee.roleId)?.title ?? "",
      }))
    : [];

  const applications = (parsed.applications ?? []).flatMap((application) => {
    const apprenticeshipStandardId = application.apprenticeshipStandardId ?? resolveApprenticeshipStandardId(application.pathwayTitle ?? "");
    if (!apprenticeshipStandardId || !application.id || !application.employeeId) return [];
    return [normaliseApplication({
      id: application.id,
      employeeId: application.employeeId,
      apprenticeshipStandardId,
      status: application.status ?? "Draft",
      currentOwner: application.currentOwner ?? applicationOwnerForStatus(application.status ?? "Draft"),
      reason: application.reason ?? application.note ?? "",
      careerGoal: application.careerGoal ?? "",
      supportRequired: application.supportRequired ?? "",
      managerNote: application.managerNote ?? application.decisionNotes ?? "",
      submittedAt: application.submittedAt ?? application.submittedDate ?? nowIso(),
      updatedAt: application.updatedAt ?? nowIso(),
      history: Array.isArray(application.history) ? application.history : [],
    })];
  });

  const matchingRequests = (parsed.matchingRequests ?? []).flatMap((request) => {
    const apprenticeshipStandardId = request.apprenticeshipStandardId ?? resolveApprenticeshipStandardId(request.programme ?? "");
    return apprenticeshipStandardId ? [{ ...request, apprenticeshipStandardId } as MvpMatchingRequest] : [];
  });

  const enrolments = (parsed.enrolments ?? []).flatMap((enrolment) => {
    const apprenticeshipStandardId = enrolment.apprenticeshipStandardId ?? resolveApprenticeshipStandardId(enrolment.programme ?? "");
    return apprenticeshipStandardId ? [{ ...enrolment, apprenticeshipStandardId } as MvpEnrolment] : [];
  });

  return {
    ...empty,
    profile: {
      ...empty.profile,
      ...(parsed.profile ?? {}),
      priorities: Array.isArray(parsed.profile?.priorities) ? parsed.profile.priorities : [],
    },
    employees,
    employeeDevelopmentProfiles: Array.isArray(parsed.employeeDevelopmentProfiles) ? parsed.employeeDevelopmentProfiles : [],
    roles,
    applications,
    providers: legacyProviders.length
      ? legacyProviders.map((provider) => {
          const migrated = { ...provider };
          delete migrated.programmes;
          return migrated;
        })
      : empty.providers,
    providerProgrammes: providerProgrammes.length ? providerProgrammes : empty.providerProgrammes,
    providerRelationships: Array.isArray(parsed.providerRelationships) ? parsed.providerRelationships : [],
    matchingRequests,
    enrolments,
  };
}

function parseStoredWorkspace(raw: string | null, previousRaw: string | null, legacyRaw: string | null, oldestRaw: string | null) {
  const source = raw ?? previousRaw ?? legacyRaw ?? oldestRaw;
  if (!source) return createEmptyMvpWorkspace();
  try {
    const parsed = JSON.parse(source) as LegacyWorkspace;
    if (parsed.version !== 4) return migrateLegacyWorkspace(parsed);
    const current = parsed as unknown as Partial<MvpWorkspaceData>;
    const empty = createEmptyMvpWorkspace();
    return {
      ...empty,
      ...current,
      version: 4,
      profile: {
        ...empty.profile,
        ...(current.profile ?? {}),
        priorities: Array.isArray(current.profile?.priorities) ? current.profile.priorities : [],
      },
      employees: Array.isArray(current.employees) ? current.employees : [],
      employeeDevelopmentProfiles: Array.isArray(current.employeeDevelopmentProfiles) ? current.employeeDevelopmentProfiles : [],
      roles: Array.isArray(current.roles) ? current.roles : [],
      applications: Array.isArray(current.applications) ? current.applications.map(normaliseApplication) : [],
      providers: Array.isArray(current.providers) ? current.providers : empty.providers,
      providerProgrammes: Array.isArray(current.providerProgrammes) ? current.providerProgrammes : empty.providerProgrammes,
      providerRelationships: Array.isArray(current.providerRelationships) ? current.providerRelationships : [],
      matchingRequests: Array.isArray(current.matchingRequests) ? current.matchingRequests : [],
      enrolments: Array.isArray(current.enrolments) ? current.enrolments : [],
    } satisfies MvpWorkspaceData;
  } catch {
    return createEmptyMvpWorkspace();
  }
}

export function MvpWorkspaceProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<MvpWorkspaceData>(createEmptyMvpWorkspace);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setData(parseStoredWorkspace(
      window.localStorage.getItem(mvpWorkspaceStorageKey),
      window.localStorage.getItem(previousMvpWorkspaceStorageKey),
      window.localStorage.getItem(legacyMvpWorkspaceStorageKey),
      window.localStorage.getItem(oldestMvpWorkspaceStorageKey),
    ));
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(mvpWorkspaceStorageKey, JSON.stringify(data));
  }, [data, hydrated]);

  const value = useMemo<MvpWorkspaceStore>(() => ({
    data,
    hydrated,
    saveProfile: (profile) => setData((current) => ({ ...current, profile })),
    saveEmployee: (employee) => setData((current) => ({ ...current, employees: upsert(current.employees, employee, "id") })),
    archiveEmployee: (id) => setData((current) => ({
      ...current,
      employees: current.employees.map((employee) => employee.id === id ? { ...employee, status: employee.status === "Archived" ? "Active" : "Archived", updatedAt: nowIso() } : employee),
    })),
    saveEmployeeDevelopmentProfile: (profile) => setData((current) => ({
      ...current,
      employeeDevelopmentProfiles: upsert(current.employeeDevelopmentProfiles, profile, "employeeId"),
    })),
    saveRole: (role) => setData((current) => ({ ...current, roles: upsert(current.roles, role, "id") })),
    archiveRole: (id) => setData((current) => ({
      ...current,
      roles: current.roles.map((role) => role.id === id ? { ...role, status: role.status === "Archived" ? "Active" : "Archived", updatedAt: nowIso() } : role),
    })),
    saveApplication: (application) => setData((current) => ({
      ...current,
      applications: upsert(current.applications, normaliseApplication(application), "id"),
    })),
    updateApplicationStatus: (id, status, note) => setData((current) => ({
      ...current,
      applications: current.applications.map((application) => application.id === id ? normaliseApplication({
        ...application,
        status,
        currentOwner: applicationOwnerForStatus(status),
        managerNote: note ?? application.managerNote,
        updatedAt: nowIso(),
        history: [...application.history, buildApplicationHistoryEntry(status, note ?? `Status updated to ${status}.`)],
      }) : application),
    })),
    saveProvider: (provider) => setData((current) => ({ ...current, providers: upsert(current.providers, provider, "providerId") })),
    archiveProvider: (id) => setData((current) => ({
      ...current,
      providers: current.providers.map((provider) => provider.providerId === id ? { ...provider, status: provider.status === "Archived" ? "Active" : "Archived" } : provider),
    })),
    saveProviderProgramme: (programme) => setData((current) => ({
      ...current,
      providerProgrammes: upsert(current.providerProgrammes, programme, "id"),
    })),
    archiveProviderProgramme: (id) => setData((current) => ({
      ...current,
      providerProgrammes: current.providerProgrammes.map((programme) => programme.id === id ? { ...programme, recordStatus: programme.recordStatus === "Archived" ? "Active" : "Archived", updatedAt: nowIso() } : programme),
    })),
    removeProviderProgramme: (id) => setData((current) => ({
      ...current,
      providerProgrammes: current.providerProgrammes.filter((programme) => programme.id !== id),
    })),
    saveProviderRelationship: (relationship) => setData((current) => ({
      ...current,
      providerRelationships: upsert(current.providerRelationships, relationship, "id"),
    })),
    saveMatchingRequest: (request) => setData((current) => ({ ...current, matchingRequests: upsert(current.matchingRequests, request, "id") })),
    updateMatchingStatus: (id, status) => setData((current) => ({
      ...current,
      matchingRequests: current.matchingRequests.map((request) => request.id === id ? { ...request, status, updatedAt: nowIso() } : request),
    })),
    saveEnrolment: (enrolment) => setData((current) => ({ ...current, enrolments: upsert(current.enrolments, enrolment, "id") })),
    updateEnrolmentStatus: (id, status) => setData((current) => ({
      ...current,
      enrolments: current.enrolments.map((enrolment) => enrolment.id === id ? { ...enrolment, status, updatedAt: nowIso() } : enrolment),
    })),
  }), [data, hydrated]);

  return <MvpWorkspaceContext.Provider value={value}>{children}</MvpWorkspaceContext.Provider>;
}

export function useMvpWorkspace() {
  const context = useContext(MvpWorkspaceContext);
  if (!context) throw new Error("useMvpWorkspace must be used inside MvpWorkspaceProvider");
  return context;
}
