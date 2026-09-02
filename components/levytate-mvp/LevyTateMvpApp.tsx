"use client";

import type { LucideIcon } from "lucide-react";
import {
  BellRing,
  BookOpenCheck,
  Building2,
  ChartNoAxesCombined,
  ClipboardCheck,
  GraduationCap,
  LayoutDashboard,
  Landmark,
  LogOut,
  Network,
  Newspaper,
  Settings,
  Sparkles,
  Store,
  UserRound,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { LevyTateLogo } from "@/components/levytate-demo/PlatformShell";
import { ApplicationsModule } from "@/components/levytate-mvp/ApplicationsModule";
import { AskLevyTateAiWorkspace } from "@/components/levytate-mvp/AskLevyTateAiWorkspace";
import { DashboardModule, LineManagerHomeModule, SettingsModule } from "@/components/levytate-mvp/DashboardSettingsModules";
import { EarlyAccessModule } from "@/components/levytate-mvp/EarlyAccessModule";
import { EmployeeApplicationModule, EmployeeHomeModule, EmployeeProgrammeModule } from "@/components/levytate-mvp/EmployeeExperienceModule";
import { EmployeesModule } from "@/components/levytate-mvp/EmployeesModule";
import { MyProgrammesModule, MyProvidersModule } from "@/components/levytate-mvp/EmployerPortfolioModules";
import { GuidanceCentreModule } from "@/components/levytate-mvp/GuidanceCentreModule";
import { LearnersModule } from "@/components/levytate-mvp/LearnersModule";
import { LevyFinanceModule } from "@/components/levytate-mvp/LevyFinanceModule";
import { ManagerDirectReportDetail } from "@/components/levytate-mvp/ManagerDirectReportDetail";
import { OperationsCentreModule } from "@/components/levytate-mvp/OperationsCentreModule";
import { PlatformAdminSupportContextModule, PlatformAdminWorkspacesModule } from "@/components/levytate-mvp/PlatformAdminModules";
import { LevyTateStandardsProvider } from "@/components/levytate-mvp/LevyTateStandardsProvider";
import { MvpWorkspaceProvider, useMvpWorkspace } from "@/components/levytate-mvp/MvpWorkspaceStore";
import { ProviderMatchingModule } from "@/components/levytate-mvp/ProviderMatchingModule";
import { ProspectGettingStarted } from "@/components/levytate-mvp/ProspectGettingStarted";
import { PersistentCopilot } from "@/components/levytate-mvp/PersistentCopilot";
import { ProspectAccessAdminModule } from "@/components/levytate-mvp/ProspectAccessAdminModule";
import { ProviderIntelligenceModule } from "@/components/levytate-mvp/ProviderIntelligenceModule";
import { ProvidersModule } from "@/components/levytate-mvp/ProvidersModule";
import { ReportsModule } from "@/components/levytate-mvp/ReportsModule";
import { RolesModule } from "@/components/levytate-mvp/RolesModule";
import type { LevyTateWorkspaceBootstrap } from "@/lib/levytate/mvp/api";
import { getCoreEarlyAccessPolicy, resolveCoreEarlyAccessRouteAccess, type CoreEarlyAccessNavigationGroup } from "@/lib/levytate/core-early-access-policy";
import type { ManagerDirectReportLearnerDetail } from "@/lib/levytate/mvp/manager-learner-detail";
import type { OperationalActionType } from "@/lib/levytate/mvp/operations-centre";
import { hasMvpPermission, permissionsForMvpRole, type MvpPermission } from "@/lib/levytate/mvp/rbac";
import { buildNotifications } from "@/lib/levytate/mvp/workspace-insights";
import type { LevyTateCopilotContext, LevyTateCopilotEntityType } from "@/lib/levytate/copilot-context";

const modules = [
  { name: "Home", icon: LayoutDashboard },
  { name: "My Programme", icon: BookOpenCheck },
  { name: "My Application", icon: ClipboardCheck },
  { name: "My Team", icon: Users },
  { name: "Approvals", icon: ClipboardCheck },
  { name: "Operations", icon: BellRing },
  { name: "Intelligence", icon: Newspaper },
  { name: "Applications", icon: ClipboardCheck },
  { name: "People", icon: Users },
  { name: "Learners", icon: GraduationCap },
  { name: "Providers", icon: Building2 },
  { name: "My Providers", icon: Network },
  { name: "My Programmes", icon: GraduationCap },
  { name: "Marketplace", icon: Store },
  { name: "Finance", icon: Landmark },
  { name: "Programmes", icon: BookOpenCheck },
  { name: "Copilot", icon: Sparkles },
  { name: "Knowledge", icon: BellRing },
  { name: "Reports", icon: ChartNoAxesCombined },
  { name: "Settings", icon: Settings },
  { name: "Support", icon: BellRing },
] as const satisfies ReadonlyArray<{ name: string; icon: LucideIcon }>;

type ModuleName = (typeof modules)[number]["name"];
type PeopleView = "Employees" | "Roles";
type ProviderView = "Programmes" | "Relationships";
type SettingsView = "Workspace" | "Early Access";

const modulePermissions = {
  Home: "workspace:read",
  "My Programme": "workspace:read",
  "My Application": "applications:read",
  "My Team": "employees:read",
  Approvals: "applications:read",
  Operations: "operationalActions:read",
  Intelligence: "providers:read",
  Applications: "applications:read",
  People: "employees:read",
  Learners: "learnerLifecycle:read",
  Providers: "providers:read",
  "My Providers": "providerRelationships:read",
  "My Programmes": "providerRelationships:read",
  Marketplace: "providers:read",
  Finance: "finance:read",
  Programmes: "providers:read",
  Copilot: "copilot:use",
  Knowledge: "knowledge:read",
  Reports: "reports:read",
  Settings: "settings:read",
  Support: "workspace:read",
} as const satisfies Record<ModuleName, MvpPermission>;

const peopleViewPermissions = {
  Employees: "employees:read",
  Roles: "roles:read",
} as const satisfies Record<PeopleView, MvpPermission>;

const providerViewPermissions = {
  Programmes: "providers:read",
  Relationships: "providerRelationships:read",
} as const satisfies Record<ProviderView, MvpPermission>;

const settingsViewPermissions = {
  Workspace: "settings:read",
  "Early Access": "earlyAccess:manage",
} as const satisfies Record<SettingsView, MvpPermission>;

const moduleCopy: Record<ModuleName, string> = {
  Home: "A short daily briefing showing what needs attention now.",
  "My Programme": "Understand your recommended programme, why it fits and what support you can expect.",
  "My Application": "Start, save and track your current apprenticeship application.",
  "My Team": "Direct reports, development status and current application activity.",
  Approvals: "Review direct-report apprenticeship applications and record fair manager decisions.",
  Operations: "Prioritised learner operations showing what needs attention, why it matters and where to act next.",
  Intelligence: "A balanced editorial view of provider updates, programme changes and apprenticeship market themes.",
  Applications: "Organisation application flow, final approval work and learner handoff readiness.",
  People: "Employee and role records that shape workforce development decisions.",
  Learners: "Read-only lifecycle records covering eligibility, enrolment, progress, reviews and completion.",
  Providers: "Explore factual apprenticeship programme and provider information in one clear directory.",
  "My Providers": "Manage the providers your organisation works with and review their current activity.",
  "My Programmes": "Manage the programmes your organisation has published for employees.",
  Marketplace: "Explore the global factual provider and programme catalogue.",
  Finance: "Understand levy funding, apprenticeship spend, balances and expired funds from DAS transaction data.",
  Programmes: "Review the factual programme catalogue available to your organisation.",
  Copilot: "Use LevyTate Copilot to explain, find, guide and create work inside the platform.",
  Knowledge: "Clear, practical guidance to help you manage apprenticeships confidently.",
  Reports: "Board-ready workforce readiness, provider and participation insight.",
  Settings: "Workspace setup, business priorities and beta access controls.",
  Support: "Safe platform support and audit context without employer operational data.",
};

export function LevyTateMvpApp({ initialWorkspace, persistLocal = false, initialManagerDirectReportDetail = null }: {
  initialWorkspace?: LevyTateWorkspaceBootstrap | null;
  persistLocal?: boolean;
  initialManagerDirectReportDetail?: ManagerDirectReportLearnerDetail | null;
}) {
  return <LevyTateStandardsProvider><MvpWorkspaceProvider initialWorkspace={initialWorkspace} persistLocal={persistLocal}><MvpAppShell initialManagerDirectReportDetail={initialManagerDirectReportDetail} /></MvpWorkspaceProvider></LevyTateStandardsProvider>;
}

function MvpAppShell({ initialManagerDirectReportDetail }: { initialManagerDirectReportDetail: ManagerDirectReportLearnerDetail | null }) {
  const { data, meta, hydrated } = useMvpWorkspace();
  const [activeModule, setActiveModule] = useState<ModuleName>(initialManagerDirectReportDetail ? "My Team" : "Home");
  const [peopleView, setPeopleView] = useState<PeopleView>("Employees");
  const [providerView, setProviderView] = useState<ProviderView>("Programmes");
  const [settingsView, setSettingsView] = useState<SettingsView>("Workspace");
  const [aiEmployeeId, setAiEmployeeId] = useState<string | null>(null);
  const [learnerTarget, setLearnerTarget] = useState<{ learnerRecordId: string; actionType: OperationalActionType } | null>(null);
  const [managerDirectReportDetail, setManagerDirectReportDetail] = useState(initialManagerDirectReportDetail);
  const [managerReviewApplicationId, setManagerReviewApplicationId] = useState<string | null>(null);
  const [copilotEntity, setCopilotEntity] = useState<{ type: LevyTateCopilotEntityType; id: string; label: string } | null>(null);
  const deepLinkHandled = useRef(false);

  const notifications = useMemo(() => buildNotifications(data), [data]);
  const permissions = meta?.permissions ?? permissionsForMvpRole(meta?.userRole);
  const can = (permission: MvpPermission) => hasMvpPermission(permissions, permission);
  const earlyAccessPolicy = meta?.coreEarlyAccess ?? getCoreEarlyAccessPolicy(meta?.userRole ?? "Employee");
  const availableModules = earlyAccessPolicy.modules
    .filter((status) => status.availability === "enabled" || status.availability === "secondary")
    .map((status) => modules.find((module) => module.name === status.moduleKey))
    .filter((module): module is (typeof modules)[number] => Boolean(module))
    .filter((module) => can(modulePermissions[module.name]));
  const navigationGroups = (["operate", "manage", "discover", "support"] as const)
    .map((group) => ({
      group,
      modules: availableModules.filter((module) => earlyAccessPolicy.modules.find((entry) => entry.moduleKey === module.name)?.group === group),
    }))
    .filter((entry) => entry.modules.length);
  const peopleItems = (["Employees", "Roles"] as PeopleView[]).filter((item) => can(peopleViewPermissions[item]));
  const providerItems = (["Programmes", "Relationships"] as ProviderView[]).filter((item) => can(providerViewPermissions[item]));
  const settingsItems = (["Workspace", "Early Access"] as SettingsView[]).filter((item) => can(settingsViewPermissions[item]));
  const moduleBadges = useMemo(() => ({
    People: notifications.filter((item) => item.module === "Applications" || item.module === "Enrolments").length,
    Providers: notifications.filter((item) => item.module === "Provider Relationships").length,
    Reports: notifications.length,
  }), [notifications]);

  useEffect(() => {
    if (availableModules.some((module) => module.name === activeModule)) return;
    setActiveModule(availableModules[0]?.name ?? "Home");
  }, [activeModule, availableModules]);

  useEffect(() => {
    if (!hydrated || deepLinkHandled.current) return;
    const searchParams = new URLSearchParams(window.location.search);
    const requested = searchParams.get("module") as ModuleName | null;
    if (requested) {
      const access = resolveCoreEarlyAccessRouteAccess(meta?.userRole ?? "Employee", requested);
      const resolved = access.module as ModuleName;
      setActiveModule(resolved);
      setManagerReviewApplicationId(
        access.permitted && (resolved === "Approvals" || resolved === "Applications")
          ? searchParams.get("application")
          : null,
      );
      if (!access.permitted) window.history.replaceState(null, "", access.safeRedirect);
    }
    deepLinkHandled.current = true;
  }, [availableModules, hydrated, meta?.userRole]);

  useEffect(() => {
    if (peopleItems.includes(peopleView)) return;
    setPeopleView(peopleItems[0] ?? "Employees");
  }, [peopleItems, peopleView]);

  useEffect(() => {
    if (providerItems.includes(providerView)) return;
    setProviderView(providerItems[0] ?? "Programmes");
  }, [providerItems, providerView]);

  useEffect(() => {
    if (settingsItems.includes(settingsView)) return;
    setSettingsView(settingsItems[0] ?? "Workspace");
  }, [settingsItems, settingsView]);

  function openModule(module: ModuleName) {
    if (!availableModules.some((item) => item.name === module)) return;
    setManagerDirectReportDetail(null);
    setManagerReviewApplicationId(null);
    setCopilotEntity(null);
    window.history.replaceState(null, "", `/levytate/app?module=${encodeURIComponent(module)}`);
    setActiveModule(module);
  }

  function moduleLabel(module: ModuleName) {
    return earlyAccessPolicy.modules.find((entry) => entry.moduleKey === module)?.label ?? module;
  }

  function openApplicationReview(applicationId: string) {
    if (meta?.userRole !== "Line Manager" || !availableModules.some((item) => item.name === "Approvals")) return;
    setManagerDirectReportDetail(null);
    setManagerReviewApplicationId(applicationId);
    setActiveModule("Approvals");
    window.history.replaceState(null, "", `/levytate/app?module=Approvals&application=${encodeURIComponent(applicationId)}`);
  }

  const updateApplicationReviewSelection = useCallback((applicationId: string | null) => {
    setManagerReviewApplicationId(applicationId);
    const application = applicationId ? data.applications.find((item) => item.id === applicationId) : null;
    const employee = application ? data.employees.find((item) => item.id === application.employeeId) : null;
    const applicationModule = meta?.userRole === "Line Manager" ? "Approvals" : "Applications";
    setCopilotEntity(applicationId ? { type: "application", id: applicationId, label: `Application: ${employee?.name ?? "Selected record"}` } : null);
    window.history.replaceState(
      null,
      "",
      applicationId
        ? `/levytate/app?module=${applicationModule}&application=${encodeURIComponent(applicationId)}`
        : `/levytate/app?module=${applicationModule}`,
    );
  }, [data.applications, data.employees, meta?.userRole]);

  const updateLearnerCopilotSelection = useCallback((id: string | null, name?: string) => {
    setCopilotEntity(id ? { type: "learner", id, label: `Learner: ${name ?? "Selected record"}` } : null);
  }, []);

  function openDirectReport(employeeId: string) {
    window.location.assign(`/levytate/app/my-team/${encodeURIComponent(employeeId)}`);
  }

  function closeDirectReport() {
    setManagerDirectReportDetail(null);
    window.history.replaceState(null, "", "/levytate/app?module=My%20Team");
  }

  function navigateTo(target: string) {
    if (target === "Programmes & Providers" || target.startsWith("Programmes & Providers:")) {
      openModule("Marketplace");
      const [, kind, id] = target.split(":");
      if (kind && id) {
        window.history.replaceState(null, "", `/levytate/app?module=Marketplace&${encodeURIComponent(kind)}=${encodeURIComponent(id)}`);
        if (kind.toLowerCase().includes("provider")) {
          const provider = data.providers.find((item) => item.providerId === id);
          setCopilotEntity({ type: "provider", id, label: `Provider: ${provider?.providerName ?? "Selected record"}` });
        } else if (kind.toLowerCase().includes("programme")) {
          const programme = data.providerProgrammes.find((item) => item.id === id);
          setCopilotEntity({ type: "programme", id, label: `Programme: ${programme?.programmeName ?? "Selected record"}` });
        }
        window.dispatchEvent(new PopStateEvent("popstate"));
      }
      return;
    }
    if (target.startsWith("Guidance Centre:")) {
      const topic = target.slice("Guidance Centre:".length);
      openModule("Knowledge");
      window.history.replaceState(null, "", `/levytate/app?module=Knowledge&topic=${encodeURIComponent(topic)}`);
      window.dispatchEvent(new PopStateEvent("popstate"));
      return;
    }
    const exactModule = availableModules.find((module) => module.name === target);
    if (exactModule) {
      openModule(exactModule.name);
      return;
    }
    if (target === "My Programme" || target === "Programme") {
      openModule("My Programme");
      return;
    }
    if (target === "My Application" || target === "Application") {
      openModule("My Application");
      return;
    }
    if (target === "Ask LevyTate AI" || target === "LevyTate Copilot" || target === "AI" || target === "Copilot") {
      openModule("Copilot");
      return;
    }
    if (target === "Employees" || target === "Roles") {
      if (meta?.userRole === "Line Manager") {
        openModule("My Team");
        return;
      }
      if (!peopleItems.includes(target as PeopleView)) return;
      setPeopleView(target as PeopleView);
      openModule("People");
      return;
    }
    if (target === "Applications" || target === "Enrolments") {
      openModule(meta?.userRole === "Line Manager" ? "Approvals" : "Applications");
      return;
    }
    if (target === "Learners") {
      openModule("Learners");
      return;
    }
    if (target === "Provider Partners") {
      openModule("My Providers");
      return;
    }
    if (target === "Provider Relationships") {
      if (!providerItems.includes("Relationships")) return;
      setProviderView("Relationships");
      openModule("Providers");
      return;
    }
    if (target === "Guidance Centre" || target === "Knowledge") {
      openModule("Knowledge");
      return;
    }
    if (target === "Early Access") {
      if (!settingsItems.includes("Early Access")) return;
      setSettingsView("Early Access");
      openModule("Settings");
      return;
    }
    if (target === "Settings") {
      if (!settingsItems.includes("Workspace")) return;
      setSettingsView("Workspace");
      openModule("Settings");
      return;
    }
    if (target === "Reports") {
      openModule("Reports");
      return;
    }
    openModule("Home");
  }

  const workspaceName = data.profile.employerName || "LevyTate beta employer";
  const workspaceLabel = data.profile.workspaceName || "Standalone employer workspace";
  const storageStatus = meta?.storageMode === "supabase" ? "Workspace connected" : "Limited access mode";
  const copilotContext = useMemo<LevyTateCopilotContext>(() => {
    const operationalLabel = earlyAccessPolicy.modules.find((entry) => entry.moduleKey === activeModule)?.label ?? activeModule;
    return {
      module: activeModule,
      route: activeModule === "Home" ? "/levytate/app" : `/levytate/app?module=${encodeURIComponent(activeModule)}`,
      contextLabel: copilotEntity?.label ?? operationalLabel,
      entityType: copilotEntity?.type,
      entityId: copilotEntity?.id,
    };
  }, [activeModule, copilotEntity, earlyAccessPolicy.modules]);

  return (
    <main className="min-h-screen bg-[#f4f7f5] text-[#102c3d]">
      <header className="sticky top-0 z-40 border-b border-[#102c3d]/[0.08] bg-white/[0.94] backdrop-blur-xl">
        <div className="mx-auto flex min-h-20 max-w-[1540px] flex-wrap items-center justify-between gap-x-4 gap-y-3 px-4 py-3 sm:px-6 lg:px-8 lg:py-0">
          <div className="flex min-w-0 flex-1 items-center gap-3 lg:flex-none">
            <LevyTateLogo className="[--levytate-logo-size:2.2rem] lg:[--levytate-logo-size:2.45rem]" />
            <div className="hidden h-9 w-px bg-[#102c3d]/[0.08] lg:block" />
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#0b6f63]">Active workspace</p>
              <p className="truncate text-sm font-semibold text-[#102c3d]">{workspaceName}</p>
              <p className="hidden truncate text-xs text-[#102c3d]/[0.46] sm:block">{workspaceLabel}</p>
            </div>
          </div>

          <div className="flex w-full min-w-0 items-center gap-2 sm:gap-3 lg:w-auto">
            <div className="min-w-0 flex-1 lg:hidden">
              <select value={activeModule} onChange={(event) => openModule(event.target.value as ModuleName)} className="h-11 w-full rounded-xl border border-[#102c3d]/[0.09] bg-[#f8fbfa] px-3 text-sm font-semibold text-[#102c3d] shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
                {availableModules.map((module) => <option key={module.name} value={module.name}>{moduleLabel(module.name)}</option>)}
              </select>
            </div>
            <span className="hidden rounded-full border border-[#159b8f]/[0.10] bg-[#edf7f3] px-3.5 py-2 text-xs font-semibold text-[#0b6f63] sm:inline-flex">
              {hydrated ? `${notifications.length} alerts` : "Loading"}
            </span>
            {meta?.prospectAccess?.status === "active" && meta.userRole === "Apprenticeship Lead" ? <ProspectGettingStarted access={meta.prospectAccess} onNavigate={navigateTo} /> : null}
            <form action="/api/levytate-beta-logout" method="post">
              <button type="submit" title="Logout" className="inline-flex h-11 shrink-0 items-center gap-2 rounded-full bg-[#102c3d] px-4 text-xs font-semibold text-white shadow-[0_10px_22px_rgba(16,44,61,0.12)] transition hover:bg-[#17394d]">
                <LogOut size={15} aria-hidden="true" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </form>
          </div>
        </div>
      </header>

      <div className="grid min-h-[calc(100vh-5rem)] lg:grid-cols-[244px_minmax(0,1fr)]">
        <aside className="hidden border-r border-[#102c3d]/[0.08] bg-white lg:sticky lg:top-20 lg:flex lg:h-[calc(100vh-5rem)] lg:flex-col">
          <div className="flex min-h-0 flex-1 flex-col px-4 py-4">
            <div className="px-2 pb-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#102c3d]/[0.36]">Navigation</p>
              <p className="mt-1 text-sm font-semibold text-[#102c3d]">Decision areas</p>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto pr-1">
              <nav className="grid gap-4" aria-label="Core Early Access navigation">
                {navigationGroups.map(({ group, modules: groupModules }) => <div key={group} className="grid gap-1">
                  <p className="px-3 pb-1 pt-2 text-[9px] font-semibold uppercase tracking-[0.14em] text-[#102c3d]/[0.34]">{navigationGroupLabel(group)}</p>
                  {groupModules.map(({ name, icon: Icon }) => {
                    const active = activeModule === name;
                    const badge = moduleBadges[name as keyof typeof moduleBadges];
                    return (
                      <button key={name} onClick={() => openModule(name)} className={`group flex min-h-[44px] items-center justify-between gap-3 rounded-xl px-3 text-left text-sm font-semibold transition ${active ? "bg-[#eaf5f1] text-[#102c3d] shadow-[inset_3px_0_0_#159b8f,0_10px_18px_rgba(21,155,143,0.06)]" : "text-[#102c3d]/[0.58] hover:bg-[#f6f9f7] hover:text-[#102c3d]"}`}>
                        <span className="flex min-w-0 items-center gap-3"><span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg transition ${active ? "bg-white text-[#0b8e82] ring-1 ring-[#159b8f]/[0.12]" : "bg-[#f7faf8] text-[#102c3d]/[0.42] group-hover:bg-white group-hover:text-[#0b8e82] group-hover:ring-1 group-hover:ring-[#102c3d]/[0.06]"}`}><Icon size={16} strokeWidth={active ? 2 : 1.8} aria-hidden="true" /></span><span className="truncate">{moduleLabel(name)}</span></span>
                        {badge ? <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold text-[#0b6f63] ring-1 ring-[#159b8f]/[0.12]">{badge}</span> : null}
                      </button>
                    );
                  })}
                </div>)}
              </nav>
            </div>

            <div className="mt-4 border-t border-[#102c3d]/[0.07] pt-4">
              <div className="rounded-2xl border border-[#102c3d]/[0.07] bg-[#f8fbfa] p-4 shadow-[0_12px_26px_rgba(16,44,61,0.04)]">
                <div className="flex items-start gap-3">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#102c3d] text-white shadow-[0_8px_18px_rgba(16,44,61,0.12)]">
                    <UserRound size={17} strokeWidth={1.8} aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#0b6f63]">Current role</p>
                    <p className="mt-1 truncate text-sm font-semibold text-[#102c3d]">{meta?.userRole ?? "Workspace user"}</p>
                    <p className="mt-1 text-xs leading-5 text-[#102c3d]/[0.52]">People, providers and workspace setup.</p>
                  </div>
                </div>

                <div className="mt-4 rounded-2xl border border-[#102c3d]/[0.06] bg-white px-3.5 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#102c3d]/[0.34]">Status</p>
                      <p className="mt-1 truncate text-xs font-semibold text-[#102c3d]/[0.68]">{storageStatus}</p>
                    </div>
                    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[#edf7f3] px-2.5 py-1 text-[10px] font-semibold text-[#0b6f63]">
                      <span className="h-1.5 w-1.5 rounded-full bg-current" />
                      Live
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </aside>

        <section className="min-w-0">
          <div className="mx-auto max-w-[1540px] px-4 py-5 sm:px-6 lg:px-8">
            <section className="mb-5 border-b border-[#102c3d]/[0.07] pb-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#c95568]">Protected workspace</p>
              <h1 className="mt-1 text-2xl font-semibold tracking-[-0.025em]">{moduleLabel(activeModule)}</h1>
              <p className="mt-1.5 max-w-3xl text-sm leading-6 text-[#102c3d]/[0.56] max-sm:hidden">{moduleCopy[activeModule]}</p>
            </section>

            {activeModule === "Home" ? (
              meta?.userRole === "Employee"
                ? <EmployeeHomeModule onNavigate={(target) => navigateTo(target)} />
                : meta?.userRole === "Line Manager"
                  ? <LineManagerHomeModule onNavigate={(target) => navigateTo(target)} onOpenApplicationReview={openApplicationReview} />
                : meta?.userRole === "Platform Admin"
                  ? <PlatformAdminWorkspacesModule onNavigate={navigateTo} />
                  : <DashboardModule onNavigate={navigateTo} />
            ) : null}
            {activeModule === "My Programme" ? <EmployeeProgrammeModule onNavigate={(target) => navigateTo(target)} /> : null}
            {activeModule === "My Application" ? <EmployeeApplicationModule /> : null}
            {activeModule === "Copilot" ? <AskLevyTateAiWorkspace initialEmployeeId={aiEmployeeId} onNavigate={navigateTo} /> : null}
            {activeModule === "Knowledge" ? <GuidanceCentreModule /> : null}
            {activeModule === "My Team" ? (
              managerDirectReportDetail
                ? <ManagerDirectReportDetail detail={managerDirectReportDetail} onBack={closeDirectReport} />
                : <EmployeesModule onOpenDirectReport={openDirectReport} onStartDiscovery={(employeeId) => { setAiEmployeeId(employeeId); openModule("Copilot"); }} />
            ) : null}
            {activeModule === "Approvals" ? <ApplicationsModule onOpenDirectReport={openDirectReport} initialApplicationId={managerReviewApplicationId} onApplicationSelectionChange={updateApplicationReviewSelection} /> : null}
            {activeModule === "Operations" ? <OperationsCentreModule onOpenLearner={(target) => { setLearnerTarget(target); openModule("Learners"); }} onSignalContext={(signal) => setCopilotEntity(signal ? { type: "intelligence_signal", id: signal.id, label: `Signal: ${signal.title}` } : null)} /> : null}
            {activeModule === "Intelligence" ? <ProviderIntelligenceModule onOpenProvider={() => openModule("Marketplace")} /> : null}
            {activeModule === "Applications" ? <ApplicationsModule initialApplicationId={managerReviewApplicationId} onApplicationSelectionChange={updateApplicationReviewSelection} /> : null}
            {activeModule === "Learners" ? <LearnersModule initialLearnerRecordId={learnerTarget?.learnerRecordId} initialAction={learnerTarget?.actionType} onDeepLinkConsumed={() => setLearnerTarget(null)} onLearnerSelectionChange={updateLearnerCopilotSelection} /> : null}
            {activeModule === "People" ? (
              <ModuleStackNav items={peopleItems} active={peopleView} onSelect={(item) => setPeopleView(item as PeopleView)}>
                {peopleView === "Employees" ? <EmployeesModule onStartDiscovery={(employeeId) => { setAiEmployeeId(employeeId); openModule("Copilot"); }} /> : null}
                {peopleView === "Roles" ? <RolesModule /> : null}
              </ModuleStackNav>
            ) : null}
            {activeModule === "Providers" ? (
              meta?.userRole === "Platform Admin"
                ? <ModuleStackNav items={providerItems} active={providerView} onSelect={(item) => setProviderView(item as ProviderView)}>
                    {providerView === "Programmes" ? <ProvidersModule /> : null}
                    {providerView === "Relationships" ? <ProviderMatchingModule /> : null}
                  </ModuleStackNav>
                : <ProvidersModule />
            ) : null}
            {activeModule === "My Providers" ? <MyProvidersModule onOpenMarketplace={() => openModule("Marketplace")} /> : null}
            {activeModule === "My Programmes" ? <MyProgrammesModule onOpenMarketplace={() => openModule("Marketplace")} /> : null}
            {activeModule === "Marketplace" ? <ProvidersModule /> : null}
            {activeModule === "Finance" ? <LevyFinanceModule organisationId={meta?.organisationId ?? "local-demo"} demoMode={meta?.storageMode !== "supabase"} /> : null}
            {activeModule === "Programmes" ? <ProvidersModule /> : null}
            {activeModule === "Reports" ? <ReportsModule /> : null}
            {activeModule === "Support" ? <PlatformAdminSupportContextModule /> : null}
            {activeModule === "Settings" ? (
              <ModuleStackNav items={settingsItems} active={settingsView} onSelect={(item) => setSettingsView(item as SettingsView)}>
                {settingsView === "Workspace" ? <SettingsModule /> : null}
                {settingsView === "Early Access" ? <div className="grid gap-5"><ProspectAccessAdminModule /><EarlyAccessModule /></div> : null}
              </ModuleStackNav>
            ) : null}
          </div>
          <nav aria-label="Trust and support" className="mx-auto flex max-w-[1540px] flex-wrap gap-x-5 gap-y-2 px-4 pb-7 text-xs font-semibold text-[#102c3d]/[0.48] sm:px-6 lg:px-8">
            <a href="/levytate/privacy" className="min-h-11 content-center hover:text-[#087c73]">Privacy</a>
            <a href="/levytate/early-access-terms" className="min-h-11 content-center hover:text-[#087c73]">Terms</a>
            <a href="/levytate/support" className="min-h-11 content-center hover:text-[#087c73]">Support</a>
            <a href="/levytate/data-rights" className="min-h-11 content-center hover:text-[#087c73]">Data rights</a>
          </nav>
        </section>
      </div>
      {can("copilot:use") && meta?.userRole !== "Platform Admin" ? <PersistentCopilot context={copilotContext} initialEmployeeId={aiEmployeeId} onNavigate={navigateTo} /> : null}
    </main>
  );
}

function ModuleStackNav({
  items,
  active,
  onSelect,
  children,
}: {
  items: string[];
  active: string;
  onSelect: (item: string) => void;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap gap-2 rounded-2xl border border-[#102c3d]/[0.07] bg-white p-2 shadow-[0_12px_30px_rgba(16,44,61,0.035)]">
        {items.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => onSelect(item)}
            className={`rounded-full px-4 py-2 text-xs font-semibold transition ${active === item ? "bg-[#102c3d] text-white shadow-[0_8px_18px_rgba(16,44,61,0.12)]" : "text-[#102c3d]/[0.58] hover:bg-[#f6f9f7] hover:text-[#102c3d]"}`}
          >
            {item}
          </button>
        ))}
      </div>
      {children}
    </div>
  );
}

function navigationGroupLabel(group: CoreEarlyAccessNavigationGroup) {
  if (group === "operate") return "Operate";
  if (group === "manage") return "Manage";
  if (group === "discover") return "Discover";
  return "Support";
}
