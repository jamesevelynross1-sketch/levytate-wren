"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { ProviderCatalogueRecord, ProviderProgramme, RequestStatus } from "@/lib/levytate/domain";
import type { LevyTateWorkspaceBootstrap, LevyTateWorkspaceMeta, LevyTateWorkspaceMutation } from "@/lib/levytate/mvp/api";
import { hasMvpPermission, mvpMutationPermission, permissionsForMvpRole, type MvpPermission } from "@/lib/levytate/mvp/rbac";
import {
  activeApplicationStatuses,
  applicationOwnerForStatus,
  buildApplicationHistoryEntry,
  createEmptyMvpWorkspace,
  normaliseApplication,
  normaliseMatchingRequest,
  normaliseProviderProgramme,
  normaliseProviderRelationship,
  nowIso,
  persistLocalWorkspace,
  readLocalWorkspace,
  type MvpApplication,
  type MvpEmployee,
  type MvpEmployeeDevelopmentProfile,
  type MvpEnrolment,
  type MvpEnrolmentStatus,
  type MvpMatchingRequest,
  type MvpMatchingStatus,
  type MvpProviderRelationship,
  type MvpRole,
  type MvpWorkspaceData,
  type MvpWorkspaceProfile,
} from "@/lib/levytate/mvp/workspace";

type MvpWorkspaceStore = {
  data: MvpWorkspaceData;
  meta: LevyTateWorkspaceMeta | null;
  hydrated: boolean;
  can: (permission: MvpPermission) => boolean;
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
      return { ...current, providerProgrammes: upsert(current.providerProgrammes, normaliseProviderProgramme(mutation.programme), "id") };
    case "archiveProviderProgramme":
      return {
        ...current,
        providerProgrammes: current.providerProgrammes.map((programme) => programme.id === mutation.id ? { ...programme, recordStatus: programme.recordStatus === "Archived" ? "Active" : "Archived", updatedAt: nowIso() } : programme),
      };
    case "removeProviderProgramme":
      return { ...current, providerProgrammes: current.providerProgrammes.filter((programme) => programme.id !== mutation.id) };
    case "saveProviderRelationship":
      return { ...current, providerRelationships: upsert(current.providerRelationships, normaliseProviderRelationship(mutation.relationship), "id") };
    case "saveMatchingRequest":
      return { ...current, matchingRequests: upsert(current.matchingRequests, normaliseMatchingRequest(mutation.request), "id") };
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

export function MvpWorkspaceProvider({ children, initialWorkspace, persistLocal = true }: { children: ReactNode; initialWorkspace?: LevyTateWorkspaceBootstrap | null; persistLocal?: boolean }) {
  const [data, setData] = useState<MvpWorkspaceData>(initialWorkspace?.data ?? createEmptyMvpWorkspace());
  const [meta, setMeta] = useState<LevyTateWorkspaceMeta | null>(initialWorkspace?.meta ?? null);
  const [hydrated, setHydrated] = useState(Boolean(initialWorkspace));
  const mutationQueue = useRef(Promise.resolve());
  const attemptedMigration = useRef(false);

  useEffect(() => {
    if (initialWorkspace) {
      if (persistLocal) persistLocalWorkspace(initialWorkspace.data);
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
            permissions: permissionsForMvpRole("Employer Admin"),
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
            permissions: permissionsForMvpRole("Employer Admin"),
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
  }, [initialWorkspace, persistLocal]);

  useEffect(() => {
    if (!hydrated || !persistLocal) return;
    persistLocalWorkspace(data);
  }, [data, hydrated, persistLocal]);


  const syncMutation = useCallback((mutation: LevyTateWorkspaceMutation) => {
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
  }, [meta?.storageMode]);

  const commitMutation = useCallback((mutation: LevyTateWorkspaceMutation, alreadyOptimistic = false) => {
    const permission = mvpMutationPermission[mutation.type];
    const permissions = meta?.permissions ?? permissionsForMvpRole(meta?.userRole);

    if (!hasMvpPermission(permissions, permission)) {
      setMeta((current) => appendWarning(current, `Your role cannot perform ${mutation.type}.`));
      return;
    }

    if (mutation.type === "saveApplication") {
      const activeStatuses = activeApplicationStatuses();
      const anotherActiveApplication = data.applications.some((application) =>
        application.employeeId === mutation.application.employeeId &&
        application.id !== mutation.application.id &&
        activeStatuses.includes(application.status) &&
        activeStatuses.includes(mutation.application.status)
      );

      if (anotherActiveApplication) {
        setMeta((current) => appendWarning(current, "This employee already has an active apprenticeship application."));
        return;
      }

      if (meta?.userRole === "Employee") {
        const existing = data.applications.find((application) => application.id === mutation.application.id);
        const employeeSaveStatuses: RequestStatus[] = ["Draft", "Submitted to Line Manager", "Awaiting Manager Review"];
        const employeeEditableStatuses: RequestStatus[] = ["Draft", "More information requested"];

        if (!employeeSaveStatuses.includes(mutation.application.status)) {
          setMeta((current) => appendWarning(current, "Employees can save drafts or submit applications to their line manager only."));
          return;
        }

        if (existing && !employeeEditableStatuses.includes(existing.status)) {
          setMeta((current) => appendWarning(current, "Submitted applications cannot be edited unless more information has been requested."));
          return;
        }
      }
    }

    if (!alreadyOptimistic) {
      setData((current) => {
        const next = applyMutationLocally(current, mutation);
        persistLocalWorkspace(next);
        return next;
      });
    }

    syncMutation(mutation);
  }, [data.applications, syncMutation, meta]);

  useEffect(() => {
    if (!hydrated || attemptedMigration.current || meta?.storageMode !== "supabase" || !isWorkspaceEmpty(data) || typeof window === "undefined") {
      return;
    }

    const local = readLocalWorkspace();
    if (isWorkspaceEmpty(local)) return;

    attemptedMigration.current = true;
    commitMutation({ type: "migrateWorkspaceSnapshot", snapshot: local }, true);
  }, [data, hydrated, meta, commitMutation]);

  const value = useMemo<MvpWorkspaceStore>(() => ({
    data,
    meta,
    hydrated,
    can: (permission) => hasMvpPermission(meta?.permissions ?? permissionsForMvpRole(meta?.userRole), permission),
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
  }), [data, hydrated, meta, commitMutation]);

  return <MvpWorkspaceContext.Provider value={value}>{children}</MvpWorkspaceContext.Provider>;
}

export function useMvpWorkspace() {
  const context = useContext(MvpWorkspaceContext);
  if (!context) throw new Error("useMvpWorkspace must be used inside MvpWorkspaceProvider");
  return context;
}

