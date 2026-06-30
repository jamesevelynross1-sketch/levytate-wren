"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { ProviderCatalogueRecord, ProviderProgramme, RequestStatus } from "@/lib/levytate/domain";
import { resolveApprenticeshipStandardId } from "@/lib/levytate/domain";
import type { LevyTateWorkspaceBootstrap, LevyTateWorkspaceMeta, LevyTateWorkspaceMutation } from "@/lib/levytate/mvp/api";
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
  meta: LevyTateWorkspaceMeta | null;
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

type WorkspaceResponse = {
  ok?: boolean;
  workspace?: LevyTateWorkspaceBootstrap;
  message?: string;
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

function readLocalWorkspace() {
  if (typeof window === "undefined") return createEmptyMvpWorkspace();
  return parseStoredWorkspace(
    window.localStorage.getItem(mvpWorkspaceStorageKey),
    window.localStorage.getItem(previousMvpWorkspaceStorageKey),
    window.localStorage.getItem(legacyMvpWorkspaceStorageKey),
    window.localStorage.getItem(oldestMvpWorkspaceStorageKey),
  );
}

function persistLocalWorkspace(data: MvpWorkspaceData) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(mvpWorkspaceStorageKey, JSON.stringify(data));
}

function isWorkspaceEmpty(data: MvpWorkspaceData) {
  return !data.profile.employerName
    && data.employees.length === 0
    && data.employeeDevelopmentProfiles.length === 0
    && data.roles.length === 0
    && data.applications.length === 0
    && data.providerRelationships.length === 0
    && data.matchingRequests.length === 0
    && data.enrolments.length === 0;
}

function appendWarning(meta: LevyTateWorkspaceMeta | null, message: string) {
  if (!meta) return meta;
  if (meta.warnings.includes(message)) return meta;
  return { ...meta, warnings: [...meta.warnings, message] };
}

function applyMutationLocally(current: MvpWorkspaceData, mutation: LevyTateWorkspaceMutation): MvpWorkspaceData {
  switch (mutation.type) {
    case "saveProfile":
      return { ...current, profile: mutation.profile };
    case "saveEmployee":
      return { ...current, employees: upsert(current.employees, mutation.employee, "id") };
    case "archiveEmployee":
      return {
        ...current,
        employees: current.employees.map((employee) => employee.id === mutation.id ? { ...employee, status: employee.status === "Archived" ? "Active" : "Archived", updatedAt: nowIso() } : employee),
      };
    case "saveEmployeeDevelopmentProfile":
      return {
        ...current,
        employeeDevelopmentProfiles: upsert(current.employeeDevelopmentProfiles, mutation.profile, "employeeId"),
      };
    case "saveRole":
      return { ...current, roles: upsert(current.roles, mutation.role, "id") };
    case "archiveRole":
      return {
        ...current,
        roles: current.roles.map((role) => role.id === mutation.id ? { ...role, status: role.status === "Archived" ? "Active" : "Archived", updatedAt: nowIso() } : role),
      };
    case "saveApplication":
      return {
        ...current,
        applications: upsert(current.applications, normaliseApplication(mutation.application), "id"),
      };
    case "updateApplicationStatus":
      return {
        ...current,
        applications: current.applications.map((application) => application.id === mutation.id ? normaliseApplication({
          ...application,
          status: mutation.status,
          currentOwner: applicationOwnerForStatus(mutation.status),
          managerNote: mutation.note ?? application.managerNote,
          updatedAt: nowIso(),
          history: [...application.history, buildApplicationHistoryEntry(mutation.status, mutation.note ?? `Status updated to ${mutation.status}.`)],
        }) : application),
      };
    case "saveProvider":
      return { ...current, providers: upsert(current.providers, mutation.provider, "providerId") };
    case "archiveProvider":
      return {
        ...current,
        providers: current.providers.map((provider) => provider.providerId === mutation.id ? { ...provider, status: provider.status === "Archived" ? "Active" : "Archived" } : provider),
      };
    case "saveProviderProgramme":
      return { ...current, providerProgrammes: upsert(current.providerProgrammes, mutation.programme, "id") };
    case "archiveProviderProgramme":
      return {
        ...current,
        providerProgrammes: current.providerProgrammes.map((programme) => programme.id === mutation.id ? { ...programme, recordStatus: programme.recordStatus === "Archived" ? "Active" : "Archived", updatedAt: nowIso() } : programme),
      };
    case "removeProviderProgramme":
      return { ...current, providerProgrammes: current.providerProgrammes.filter((programme) => programme.id !== mutation.id) };
    case "saveProviderRelationship":
      return { ...current, providerRelationships: upsert(current.providerRelationships, mutation.relationship, "id") };
    case "saveMatchingRequest":
      return { ...current, matchingRequests: upsert(current.matchingRequests, mutation.request, "id") };
    case "updateMatchingStatus":
      return {
        ...current,
        matchingRequests: current.matchingRequests.map((request) => request.id === mutation.id ? { ...request, status: mutation.status, updatedAt: nowIso() } : request),
      };
    case "saveEnrolment":
      return { ...current, enrolments: upsert(current.enrolments, mutation.enrolment, "id") };
    case "updateEnrolmentStatus":
      return {
        ...current,
        enrolments: current.enrolments.map((enrolment) => enrolment.id === mutation.id ? { ...enrolment, status: mutation.status, updatedAt: nowIso() } : enrolment),
      };
    case "migrateWorkspaceSnapshot":
      return mutation.snapshot;
    default:
      return current;
  }
}

export function MvpWorkspaceProvider({ children, initialWorkspace }: { children: ReactNode; initialWorkspace?: LevyTateWorkspaceBootstrap | null }) {
  const [data, setData] = useState<MvpWorkspaceData>(initialWorkspace?.data ?? createEmptyMvpWorkspace());
  const [meta, setMeta] = useState<LevyTateWorkspaceMeta | null>(initialWorkspace?.meta ?? null);
  const [hydrated, setHydrated] = useState(Boolean(initialWorkspace));
  const mutationQueue = useRef(Promise.resolve());
  const attemptedMigration = useRef(false);

  useEffect(() => {
    if (initialWorkspace) {
      persistLocalWorkspace(initialWorkspace.data);
      return;
    }

    let cancelled = false;

    async function load() {
      try {
        const response = await fetch("/api/levytate-workspace", { cache: "no-store" });
        const payload = (await response.json()) as WorkspaceResponse;

        if (!cancelled && response.ok && payload.workspace) {
          setData(payload.workspace.data);
          setMeta(payload.workspace.meta);
          persistLocalWorkspace(payload.workspace.data);
        }

        if (!cancelled && (!response.ok || !payload.workspace)) {
          const local = readLocalWorkspace();
          setData(local);
          setMeta({
            organisationId: "local-fallback",
            organisationName: "LevyTate employer workspace",
            userEmail: "",
            userRole: "Employer Admin",
            storageMode: "local_fallback",
            warnings: [payload.message ?? "LevyTate workspace persistence is unavailable. Local fallback is active."],
          });
        }
      } catch {
        if (!cancelled) {
          const local = readLocalWorkspace();
          setData(local);
          setMeta({
            organisationId: "local-fallback",
            organisationName: "LevyTate employer workspace",
            userEmail: "",
            userRole: "Employer Admin",
            storageMode: "local_fallback",
            warnings: ["LevyTate workspace persistence is unavailable. Local fallback is active."],
          });
        }
      } finally {
        if (!cancelled) {
          setHydrated(true);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [initialWorkspace]);

  useEffect(() => {
    if (!hydrated) return;
    persistLocalWorkspace(data);
  }, [data, hydrated]);

  useEffect(() => {
    if (!hydrated || attemptedMigration.current || meta?.storageMode !== "supabase" || !isWorkspaceEmpty(data) || typeof window === "undefined") {
      return;
    }

    const local = readLocalWorkspace();
    if (isWorkspaceEmpty(local)) return;

    attemptedMigration.current = true;
    commitMutation({ type: "migrateWorkspaceSnapshot", snapshot: local }, true);
  }, [data, hydrated, meta, commitMutation]);

  function syncMutation(mutation: LevyTateWorkspaceMutation) {
    mutationQueue.current = mutationQueue.current
      .then(async () => {
        if (meta?.storageMode !== "supabase") return;

        try {
          const response = await fetch("/api/levytate-workspace", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(mutation),
          });

          const payload = (await response.json()) as WorkspaceResponse;
          if (!response.ok || !payload.workspace) {
            setMeta((current) => appendWarning(current, payload.message ?? "LevyTate could not confirm the latest save. The local workspace has been kept."));
            return;
          }

          setData(payload.workspace.data);
          setMeta(payload.workspace.meta);
          persistLocalWorkspace(payload.workspace.data);
        } catch {
          setMeta((current) => appendWarning(current, "LevyTate could not confirm the latest save. The local workspace has been kept."));
        }
      })
      .catch(() => undefined);
  }

  function commitMutation(mutation: LevyTateWorkspaceMutation, alreadyOptimistic = false) {
    if (!alreadyOptimistic) {
      setData((current) => {
        const next = applyMutationLocally(current, mutation);
        persistLocalWorkspace(next);
        return next;
      });
    }

    syncMutation(mutation);
  }

  const value = useMemo<MvpWorkspaceStore>(() => ({
    data,
    meta,
    hydrated,
    saveProfile: (profile) => commitMutation({ type: "saveProfile", profile }),
    saveEmployee: (employee) => commitMutation({ type: "saveEmployee", employee }),
    archiveEmployee: (id) => commitMutation({ type: "archiveEmployee", id }),
    saveEmployeeDevelopmentProfile: (profile) => commitMutation({ type: "saveEmployeeDevelopmentProfile", profile }),
    saveRole: (role) => commitMutation({ type: "saveRole", role }),
    archiveRole: (id) => commitMutation({ type: "archiveRole", id }),
    saveApplication: (application) => commitMutation({ type: "saveApplication", application }),
    updateApplicationStatus: (id, status, note) => commitMutation({ type: "updateApplicationStatus", id, status, note }),
    saveProvider: (provider) => commitMutation({ type: "saveProvider", provider }),
    archiveProvider: (id) => commitMutation({ type: "archiveProvider", id }),
    saveProviderProgramme: (programme) => commitMutation({ type: "saveProviderProgramme", programme }),
    archiveProviderProgramme: (id) => commitMutation({ type: "archiveProviderProgramme", id }),
    removeProviderProgramme: (id) => commitMutation({ type: "removeProviderProgramme", id }),
    saveProviderRelationship: (relationship) => commitMutation({ type: "saveProviderRelationship", relationship }),
    saveMatchingRequest: (request) => commitMutation({ type: "saveMatchingRequest", request }),
    updateMatchingStatus: (id, status) => commitMutation({ type: "updateMatchingStatus", id, status }),
    saveEnrolment: (enrolment) => commitMutation({ type: "saveEnrolment", enrolment }),
    updateEnrolmentStatus: (id, status) => commitMutation({ type: "updateEnrolmentStatus", id, status }),
  }), [data, hydrated, meta]);

  return <MvpWorkspaceContext.Provider value={value}>{children}</MvpWorkspaceContext.Provider>;
}

export function useMvpWorkspace() {
  const context = useContext(MvpWorkspaceContext);
  if (!context) throw new Error("useMvpWorkspace must be used inside MvpWorkspaceProvider");
  return context;
}





