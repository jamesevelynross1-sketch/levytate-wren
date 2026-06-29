"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { ProviderCatalogueRecord, ProviderProgramme, RequestStatus } from "@/lib/levytate/domain";
import {
  createEmptyMvpWorkspace,
  mvpWorkspaceStorageKey,
  nowIso,
  type MvpApplication,
  type MvpEmployee,
  type MvpEnrolment,
  type MvpEnrolmentStatus,
  type MvpMatchingRequest,
  type MvpMatchingStatus,
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
  saveRole: (role: MvpRole) => void;
  archiveRole: (id: string) => void;
  saveApplication: (application: MvpApplication) => void;
  updateApplicationStatus: (id: string, status: RequestStatus) => void;
  saveProvider: (provider: ProviderCatalogueRecord) => void;
  archiveProvider: (id: string) => void;
  saveProviderProgramme: (providerId: string, programme: ProviderProgramme) => void;
  saveMatchingRequest: (request: MvpMatchingRequest) => void;
  updateMatchingStatus: (id: string, status: MvpMatchingStatus) => void;
  saveEnrolment: (enrolment: MvpEnrolment) => void;
  updateEnrolmentStatus: (id: string, status: MvpEnrolmentStatus) => void;
};

const MvpWorkspaceContext = createContext<MvpWorkspaceStore | null>(null);

function parseStoredWorkspace(raw: string | null) {
  if (!raw) return createEmptyMvpWorkspace();
  try {
    const parsed = JSON.parse(raw) as Partial<MvpWorkspaceData>;
    const empty = createEmptyMvpWorkspace();
    if (parsed.version !== 1) return empty;
    return {
      ...empty,
      ...parsed,
      profile: { ...empty.profile, ...(parsed.profile ?? {}) },
      employees: Array.isArray(parsed.employees) ? parsed.employees : [],
      roles: Array.isArray(parsed.roles) ? parsed.roles : [],
      applications: Array.isArray(parsed.applications) ? parsed.applications : [],
      providers: Array.isArray(parsed.providers) ? parsed.providers : empty.providers,
      matchingRequests: Array.isArray(parsed.matchingRequests) ? parsed.matchingRequests : [],
      enrolments: Array.isArray(parsed.enrolments) ? parsed.enrolments : [],
    } satisfies MvpWorkspaceData;
  } catch {
    return createEmptyMvpWorkspace();
  }
}

function upsert<T>(items: T[], item: T, key: keyof T) {
  return items.some((current) => current[key] === item[key])
    ? items.map((current) => current[key] === item[key] ? item : current)
    : [item, ...items];
}

export function MvpWorkspaceProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<MvpWorkspaceData>(createEmptyMvpWorkspace);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setData(parseStoredWorkspace(window.localStorage.getItem(mvpWorkspaceStorageKey)));
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
    saveRole: (role) => setData((current) => ({ ...current, roles: upsert(current.roles, role, "id") })),
    archiveRole: (id) => setData((current) => ({
      ...current,
      roles: current.roles.map((role) => role.id === id ? { ...role, status: role.status === "Archived" ? "Active" : "Archived", updatedAt: nowIso() } : role),
    })),
    saveApplication: (application) => setData((current) => ({ ...current, applications: upsert(current.applications, application, "id") })),
    updateApplicationStatus: (id, status) => setData((current) => ({
      ...current,
      applications: current.applications.map((application) => application.id === id ? { ...application, status, updatedAt: nowIso() } : application),
    })),
    saveProvider: (provider) => setData((current) => ({ ...current, providers: upsert(current.providers, provider, "providerId") })),
    archiveProvider: (id) => setData((current) => ({
      ...current,
      providers: current.providers.map((provider) => provider.providerId === id ? { ...provider, status: provider.status === "Archived" ? "Active" : "Archived" } : provider),
    })),
    saveProviderProgramme: (providerId, programme) => setData((current) => ({
      ...current,
      providers: current.providers.map((provider) => {
        if (provider.providerId !== providerId) return provider;
        return { ...provider, programmes: upsert(provider.programmes, programme, "programmeId") };
      }),
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