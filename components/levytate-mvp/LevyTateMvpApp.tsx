"use client";

import type { LucideIcon } from "lucide-react";
import dynamic from "next/dynamic";
import {
  BellRing,
  BookOpenCheck,
  Building2,
  ChartNoAxesCombined,
  ChevronRight,
  CircleHelp,
  ClipboardCheck,
  ClipboardList,
  GraduationCap,
  Handshake,
  HeartHandshake,
  Hourglass,
  LayoutDashboard,
  Landmark,
  LogOut,
  Menu,
  Network,
  Newspaper,
  Settings,
  Sparkles,
  Store,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { LevyTateLogo } from "@/components/levytate-demo/PlatformShell";
import { ApplicationsModule } from "@/components/levytate-mvp/ApplicationsModule";
import { AskLevyTateAiWorkspace } from "@/components/levytate-mvp/AskLevyTateAiWorkspace";
import { DashboardModule, LineManagerHomeModule, SettingsModule } from "@/components/levytate-mvp/DashboardSettingsModules";
import { DemoModeIndicator, DemoPerspectiveMenu, useDemoPerspectiveSwitcher } from "@/components/levytate-mvp/DemoPerspectiveSwitcher";
import { ApplicationWorkflowSettings } from "@/components/levytate-mvp/ApplicationWorkflowSettings";
import { EarlyAccessModule } from "@/components/levytate-mvp/EarlyAccessModule";
import { EmployeeApplicationModule, EmployeeHomeModule, EmployeeProgrammeModule } from "@/components/levytate-mvp/EmployeeExperienceModule";
import { EmployeesModule } from "@/components/levytate-mvp/EmployeesModule";
import { EmployerInsightsModule } from "@/components/levytate-mvp/EmployerInsightsModule";
import { MyProgrammesModule, MyProvidersModule } from "@/components/levytate-mvp/EmployerPortfolioModules";
import { GuidanceCentreModule } from "@/components/levytate-mvp/GuidanceCentreModule";
import { LearnersModule } from "@/components/levytate-mvp/LearnersModule";
import { LevyFinanceModule } from "@/components/levytate-mvp/LevyFinanceModule";
import { ManagerDirectReportDetail } from "@/components/levytate-mvp/ManagerDirectReportDetail";
import { OperationsCentreModule } from "@/components/levytate-mvp/OperationsCentreModule";
import { PlatformAdminSupportContextModule, PlatformAdminWorkspacesModule } from "@/components/levytate-mvp/PlatformAdminModules";
import { LevyTateStandardsProvider } from "@/components/levytate-mvp/LevyTateStandardsProvider";
import { MvpWorkspaceProvider, useMvpWorkspace } from "@/components/levytate-mvp/MvpWorkspaceStore";
import { MvpLoadingState } from "@/components/levytate-mvp/MvpUi";
import { ProviderMatchingModule } from "@/components/levytate-mvp/ProviderMatchingModule";
import { ProspectGettingStarted } from "@/components/levytate-mvp/ProspectGettingStarted";
import { PersistentCopilot } from "@/components/levytate-mvp/PersistentCopilot";
import { ProspectAccessAdminModule } from "@/components/levytate-mvp/ProspectAccessAdminModule";
import { ProviderIntelligenceModule } from "@/components/levytate-mvp/ProviderIntelligenceModule";
import { ProvidersModule } from "@/components/levytate-mvp/ProvidersModule";
import { ReportsModule } from "@/components/levytate-mvp/ReportsModule";
import { RolesModule } from "@/components/levytate-mvp/RolesModule";
import { LevyTateDesktopAppPanel } from "@/components/levytate-pwa/LevyTatePwa";
import type { LevyTateWorkspaceBootstrap } from "@/lib/levytate/mvp/api";
import { getCoreEarlyAccessPolicy, resolveCoreEarlyAccessRouteAccess } from "@/lib/levytate/core-early-access-policy";
import { findRelease2NavigationArea, getRelease2Navigation, type Release2NavigationArea } from "@/lib/levytate/release-2-navigation";
import type { ManagerDirectReportLearnerDetail } from "@/lib/levytate/mvp/manager-learner-detail";
import type { OperationalActionType } from "@/lib/levytate/mvp/operations-centre";
import { hasMvpPermission, permissionsForMvpRole, type MvpPermission } from "@/lib/levytate/mvp/rbac";
import { buildNotifications } from "@/lib/levytate/mvp/workspace-insights";
import type { LevyTateCopilotContext, LevyTateCopilotEntityType } from "@/lib/levytate/copilot-context";

const EmployerRequestsContainer = dynamic(
  () => import("@/components/levytate-mvp/EmployerRequestsContainer").then((module) => module.EmployerRequestsContainer),
  { loading: () => <MvpLoadingState label="Loading Requests…" /> },
);

const LearningTimeModule = dynamic(
  () => import("@/components/levytate-mvp/LearningTimeModule").then((module) => module.LearningTimeModule),
  { loading: () => <MvpLoadingState label="Loading Learning Time…" /> },
);

const AssessmentsModule = dynamic(
  () => import("@/components/levytate-mvp/AssessmentsModule").then((module) => module.AssessmentsModule),
  { loading: () => <MvpLoadingState label="Loading Assessments…" /> },
);

const PastoralSupportModule = dynamic(
  () => import("@/components/levytate-mvp/PastoralSupportModule").then((module) => module.PastoralSupportModule),
  { loading: () => <MvpLoadingState label="Opening My Support…" /> },
);

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
  { name: "Learning Time", icon: Hourglass },
  { name: "My Support", icon: HeartHandshake },
  { name: "Learner Support", icon: HeartHandshake },
  { name: "Assessments", icon: ClipboardList },
  { name: "Providers", icon: Building2 },
  { name: "My Providers", icon: Network },
  { name: "My Programmes", icon: GraduationCap },
  { name: "Requests", icon: Handshake },
  { name: "Marketplace", icon: Store },
  { name: "Insights", icon: ChartNoAxesCombined },
  { name: "Workforce Development", icon: Users },
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
type SettingsView = "Workspace" | "Workflows" | "Desktop App" | "Early Access";

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
  "Learning Time": "learningTime:read",
  "My Support": "workspace:read",
  "Learner Support": "workspace:read",
  Assessments: "assessments:read",
  Providers: "providers:read",
  "My Providers": "providerRelationships:read",
  "My Programmes": "providerRelationships:read",
  Requests: "serviceRequests:read",
  Marketplace: "providers:read",
  Insights: "reports:read",
  "Workforce Development": "reports:read",
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
  Workflows: "applicationWorkflows:manage",
  "Desktop App": "settings:read",
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
  "Learning Time": "Plan, prepare and review off-the-job learning activity with clear candidate, employer and provider evidence states.",
  "My Support": "Talk through apprenticeship difficulties privately and choose whether to request support from an approved person.",
  "Learner Support": "Respond to employee-approved support requests addressed or explicitly assigned to you.",
  Assessments: "Run private and employer-led workforce assessments, interpret evidence and agree practical development action.",
  Providers: "Explore factual apprenticeship programme and provider information in one clear directory.",
  "My Providers": "Manage the providers your organisation works with and review their current activity.",
  "My Programmes": "Manage the programmes your organisation has published for employees.",
  Requests: "Create one approved brief, compare provider proposals and hand over only the option your organisation confirms.",
  Marketplace: "Explore the global factual provider and programme catalogue.",
  Insights: "A concise employer operating brief showing current position, priorities and authoritative evidence coverage.",
  "Workforce Development": "Privacy-safe campaign evidence showing capability patterns, workplace barriers and proportionate next actions.",
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
  const [peopleEmployeeId, setPeopleEmployeeId] = useState<string | null>(null);
  const [copilotEntity, setCopilotEntity] = useState<{ type: LevyTateCopilotEntityType; id: string; label: string } | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const demoPerspective = useDemoPerspectiveSwitcher();
  const deepLinkHandled = useRef(false);
  const mobileMenuButtonRef = useRef<HTMLButtonElement>(null);
  const mobileDrawerRef = useRef<HTMLElement>(null);
  const accountButtonRef = useRef<HTMLButtonElement>(null);
  const accountMenuRef = useRef<HTMLDivElement>(null);

  const notifications = useMemo(() => buildNotifications(data), [data]);
  const permissions = meta?.permissions ?? permissionsForMvpRole(meta?.userRole);
  const can = (permission: MvpPermission) => hasMvpPermission(permissions, permission);
  const earlyAccessPolicy = meta?.coreEarlyAccess ?? getCoreEarlyAccessPolicy(meta?.userRole ?? "Employee");
  const availableModules = earlyAccessPolicy.modules
    .filter((status) => status.availability === "enabled" || status.availability === "secondary")
    .map((status) => modules.find((module) => module.name === status.moduleKey))
    .filter((module): module is (typeof modules)[number] => Boolean(module))
    .filter((module) => can(modulePermissions[module.name]));
  const release2Navigation = getRelease2Navigation(meta?.userRole ?? "Employee", availableModules.map((module) => module.name));
  const primaryNavigation = release2Navigation.filter((area) => area.priority === "primary");
  const secondaryNavigation = release2Navigation.filter((area) => area.priority === "secondary");
  const activeArea = findRelease2NavigationArea(release2Navigation, activeModule);
  const peopleItems = (["Employees", "Roles"] as PeopleView[]).filter((item) => can(peopleViewPermissions[item]));
  const providerItems = (["Programmes", "Relationships"] as ProviderView[]).filter((item) => can(providerViewPermissions[item]));
  const settingsItems = (["Workspace", "Workflows", "Desktop App", "Early Access"] as SettingsView[]).filter((item) => can(settingsViewPermissions[item]) && (item !== "Workflows" || meta?.applicationWorkflowsEnabled === true));
  const moduleBadges = useMemo<Partial<Record<ModuleName, number>>>(() => ({
    Home: notifications.length,
    Applications: notifications.filter((item) => item.module === "Applications" || item.module === "Enrolments").length,
    Approvals: notifications.filter((item) => item.module === "Applications").length,
    People: notifications.filter((item) => item.module === "Enrolments").length,
    "My Providers": notifications.filter((item) => item.module === "Provider Relationships").length,
  }), [notifications]);

  useEffect(() => {
    if (availableModules.some((module) => module.name === activeModule)) return;
    setActiveModule(availableModules[0]?.name ?? "Home");
  }, [activeModule, availableModules]);

  useEffect(() => {
    if (!hydrated) return;
    function syncFromLocation() {
      const searchParams = new URLSearchParams(window.location.search);
      const requested = searchParams.get("module") as ModuleName | null;
      if (requested) {
        const access = resolveCoreEarlyAccessRouteAccess(meta?.userRole ?? "Employee", requested, earlyAccessPolicy);
        const resolved = access.module as ModuleName;
        setActiveModule(resolved);
        setManagerReviewApplicationId(
          access.permitted && (resolved === "Approvals" || resolved === "Applications")
            ? searchParams.get("application")
            : null,
        );
        setPeopleEmployeeId(access.permitted && resolved === "People" ? searchParams.get("employee") : null);
        if (!access.permitted) window.history.replaceState(null, "", access.safeRedirect);
      } else {
        setActiveModule("Home");
        setManagerReviewApplicationId(null);
        setPeopleEmployeeId(null);
      }
    }
    if (!deepLinkHandled.current) {
      syncFromLocation();
      deepLinkHandled.current = true;
    }
    window.addEventListener("popstate", syncFromLocation);
    return () => window.removeEventListener("popstate", syncFromLocation);
  }, [availableModules, earlyAccessPolicy, hydrated, meta?.userRole]);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const drawer = mobileDrawerRef.current;
    const trigger = mobileMenuButtonRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusable = () => drawer ? Array.from(drawer.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled]), [tabindex]:not([tabindex="-1"])')) : [];
    focusable()[0]?.focus();
    function onKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setMobileMenuOpen(false);
        return;
      }
      if (event.key !== "Tab") return;
      const elements = focusable();
      if (!elements.length) return;
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      trigger?.focus();
    };
  }, [mobileMenuOpen]);

  useEffect(() => {
    if (!accountMenuOpen) return;
    function closeOnOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (accountMenuRef.current?.contains(target) || accountButtonRef.current?.contains(target)) return;
      setAccountMenuOpen(false);
    }
    function closeOnEscape(event: globalThis.KeyboardEvent) {
      if (event.key !== "Escape") return;
      setAccountMenuOpen(false);
      accountButtonRef.current?.focus();
    }
    document.addEventListener("mousedown", closeOnOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [accountMenuOpen]);

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

  function openModule(module: ModuleName, options: { replace?: boolean } = {}) {
    if (!availableModules.some((item) => item.name === module)) return;
    setManagerDirectReportDetail(null);
    setManagerReviewApplicationId(null);
    setPeopleEmployeeId(null);
    setCopilotEntity(null);
    window.history[options.replace ? "replaceState" : "pushState"](null, "", module === "Home" ? "/levytate/app" : `/levytate/app?module=${encodeURIComponent(module)}`);
    setActiveModule(module);
    setMobileMenuOpen(false);
    setAccountMenuOpen(false);
  }

  function openArea(area: Release2NavigationArea) {
    if (area.modules.includes(activeModule)) {
      setMobileMenuOpen(false);
      return;
    }
    const destination = area.modules[0] as ModuleName;
    openModule(destination);
  }

  function openRequest(context: { programmeId?: string; providerId?: string }) {
    if (!availableModules.some((item) => item.name === "Requests")) return;
    setManagerDirectReportDetail(null);
    setManagerReviewApplicationId(null);
    setCopilotEntity(null);
    setActiveModule("Requests");
    const params = new URLSearchParams({ module: "Requests" });
    if (context.programmeId) params.set("programme", context.programmeId);
    if (context.providerId) params.set("provider", context.providerId);
    window.history.pushState(null, "", `/levytate/app?${params.toString()}`);
  }

  function moduleLabel(module: ModuleName) {
    return earlyAccessPolicy.modules.find((entry) => entry.moduleKey === module)?.label ?? module;
  }

  function openApplicationReview(applicationId: string) {
    if (meta?.userRole !== "Line Manager" || !availableModules.some((item) => item.name === "Approvals")) return;
    setManagerDirectReportDetail(null);
    setManagerReviewApplicationId(applicationId);
    setActiveModule("Approvals");
    window.history.pushState(null, "", `/levytate/app?module=Approvals&application=${encodeURIComponent(applicationId)}`);
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
    if (target.startsWith("Applications:")) {
      const applicationId = target.slice("Applications:".length);
      const destinationModule = meta?.userRole === "Line Manager" ? "Approvals" : "Applications";
      if (!availableModules.some((item) => item.name === destinationModule)) return;
      setManagerReviewApplicationId(applicationId);
      setActiveModule(destinationModule);
      window.history.pushState(null, "", `/levytate/app?module=${destinationModule}&application=${encodeURIComponent(applicationId)}`);
      return;
    }
    if (target.startsWith("Employees:")) {
      const employeeId = target.slice("Employees:".length);
      if (!peopleItems.includes("Employees") || !availableModules.some((item) => item.name === "People")) return;
      setPeopleView("Employees");
      setPeopleEmployeeId(employeeId);
      setActiveModule("People");
      window.history.pushState(null, "", `/levytate/app?module=People&employee=${encodeURIComponent(employeeId)}`);
      return;
    }
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
      openModule("Insights");
      return;
    }
    openModule("Home");
  }

  const workspaceName = data.profile.employerName || "LevyTate beta employer";
  const workspaceLabel = data.profile.workspaceName || "Standalone employer workspace";
  const storageStatus = meta?.storageMode === "supabase" ? "Connected" : "Limited mode";
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
    <main data-testid="levytate-app-shell" className="levytate-workspace min-h-screen w-full min-w-0 bg-[#f7f6f2] text-[#102c3d]">
      <header className="sticky top-0 z-40 border-b border-[#102c3d]/[0.08] bg-white/[0.96] backdrop-blur-xl">
        <div className="mx-auto flex h-[4.5rem] max-w-[1580px] items-center justify-between gap-3 px-4 sm:px-6 lg:px-7">
          <div className="flex min-w-0 items-center gap-3">
            <button ref={mobileMenuButtonRef} type="button" onClick={() => setMobileMenuOpen(true)} aria-expanded={mobileMenuOpen} aria-controls="levytate-mobile-navigation" aria-label="Open navigation" className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-[#102c3d]/[0.09] bg-white text-[#102c3d] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#159b8f]/20 lg:hidden">
              <Menu size={19} aria-hidden="true" />
            </button>
            <LevyTateLogo className="shrink-0 [--levytate-logo-size:2.05rem] sm:[--levytate-logo-size:2.25rem]" />
            <div className="hidden h-8 w-px bg-[#102c3d]/[0.09] sm:block" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-[#102c3d]">{workspaceName}</p>
              <p className="hidden truncate text-[11px] text-[#102c3d]/55 sm:block">{workspaceLabel}</p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            {availableModules.some((module) => module.name === "Copilot") ? <button type="button" onClick={() => openModule("Copilot")} className="hidden h-10 items-center gap-2 rounded-xl px-3 text-xs font-semibold text-[#102c3d]/65 transition hover:bg-[#f3f7f4] hover:text-[#102c3d] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#159b8f]/20 sm:inline-flex"><Sparkles size={15} aria-hidden="true" />Copilot</button> : null}
            {notifications.length > 0 && availableModules.some((module) => module.name === "Home") ? <button type="button" onClick={() => openModule("Home")} aria-label={`${notifications.length} items need attention`} className="relative grid h-10 w-10 place-items-center rounded-xl text-[#102c3d]/60 transition hover:bg-[#f3f7f4] hover:text-[#102c3d] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#159b8f]/20"><BellRing size={17} aria-hidden="true" /><span className="absolute right-1 top-1 min-w-4 rounded-full bg-[#c95568] px-1 text-center text-[9px] font-bold leading-4 text-white">{notifications.length}</span></button> : null}
            {meta?.prospectAccess?.status === "active" && meta.userRole === "Apprenticeship Lead" ? <ProspectGettingStarted access={meta.prospectAccess} onNavigate={navigateTo} /> : null}
            {demoPerspective.state ? <DemoModeIndicator state={demoPerspective.state} /> : null}
            <div className="relative">
              <button ref={accountButtonRef} type="button" onClick={() => setAccountMenuOpen((open) => !open)} aria-expanded={accountMenuOpen} aria-haspopup="menu" aria-label="Open account menu" className="flex h-11 items-center gap-2 rounded-xl border border-[#102c3d]/[0.09] bg-white px-2.5 text-left shadow-[0_7px_20px_rgba(16,44,61,0.05)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#159b8f]/20 sm:px-3">
                <span className="grid h-7 w-7 place-items-center rounded-lg bg-[#102c3d] text-white"><UserRound size={14} aria-hidden="true" /></span>
                <span className="hidden max-w-36 sm:block"><span data-testid="current-role" className="block truncate text-xs font-semibold text-[#102c3d]">{meta?.userRole ?? "Workspace user"}</span><span className="block text-[10px] text-[#102c3d]/45">{storageStatus}</span></span>
              </button>
              {accountMenuOpen ? <div ref={accountMenuRef} role="menu" className="absolute right-0 top-[calc(100%+0.55rem)] z-50 w-80 max-w-[calc(100vw-2rem)] rounded-2xl border border-[#102c3d]/[0.09] bg-white p-3 shadow-[0_24px_70px_rgba(16,44,61,0.17)]">
                <div className="rounded-xl bg-[#f4f8f5] px-3 py-3"><p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-[#0b6f63]">Signed in as</p><p className="mt-1 text-sm font-semibold">{meta?.userRole ?? "Workspace user"}</p><p className="mt-1 text-xs text-[#102c3d]/52">{workspaceName} · {storageStatus}</p></div>
                <DemoPerspectiveMenu controller={demoPerspective} />
                {availableModules.some((module) => module.name === "Knowledge") ? <button role="menuitem" type="button" onClick={() => openModule("Knowledge")} className="mt-2 flex min-h-10 w-full items-center gap-2 rounded-lg px-3 text-left text-xs font-semibold text-[#102c3d]/65 hover:bg-[#f4f8f5]"><CircleHelp size={15} aria-hidden="true" />Help and guidance</button> : null}
                <form action="/api/levytate-beta-logout" method="post"><button role="menuitem" type="submit" className="flex min-h-10 w-full items-center gap-2 rounded-lg px-3 text-left text-xs font-semibold text-[#b13b51] hover:bg-[#fff2f3]"><LogOut size={15} aria-hidden="true" />Sign out</button></form>
              </div> : null}
            </div>
          </div>
        </div>
      </header>

      {mobileMenuOpen ? <div className="fixed inset-0 z-50 lg:hidden"><button type="button" onClick={() => setMobileMenuOpen(false)} aria-label="Close navigation" className="absolute inset-0 bg-[#102c3d]/40 backdrop-blur-sm" /><aside ref={mobileDrawerRef} id="levytate-mobile-navigation" role="dialog" aria-modal="true" aria-labelledby="levytate-mobile-navigation-title" className="absolute inset-y-0 left-0 flex w-[min(88vw,22rem)] flex-col overflow-hidden bg-white shadow-[24px_0_80px_rgba(16,44,61,0.24)]">
        <div className="flex h-[4.5rem] items-center justify-between border-b border-[#102c3d]/[0.08] px-4"><div><p id="levytate-mobile-navigation-title" className="text-sm font-semibold">{workspaceName}</p><p className="text-xs text-[#102c3d]/50">Navigation</p></div><button type="button" onClick={() => setMobileMenuOpen(false)} aria-label="Close navigation" className="grid h-11 w-11 place-items-center rounded-xl text-[#102c3d]/60 hover:bg-[#f4f8f5] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#159b8f]/20"><X size={19} aria-hidden="true" /></button></div>
        <nav aria-label="Mobile workspace navigation" className="min-h-0 flex-1 overflow-y-auto px-3 py-4"><p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#102c3d]/40">Your workspace</p><div className="grid gap-1">{primaryNavigation.map((area) => <MobileNavigationArea key={area.key} area={area} activeModule={activeModule} moduleLabel={moduleLabel} onOpenArea={openArea} onOpenModule={openModule} />)}</div>{secondaryNavigation.length ? <div className="mt-5 border-t border-[#102c3d]/[0.07] pt-4"><p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#102c3d]/40">Tools & support</p><div className="grid gap-1">{secondaryNavigation.map((area) => <MobileNavigationArea key={area.key} area={area} activeModule={activeModule} moduleLabel={moduleLabel} onOpenArea={openArea} onOpenModule={openModule} />)}</div></div> : null}</nav>
        <div className="border-t border-[#102c3d]/[0.08] p-4"><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-semibold">{meta?.userRole ?? "Workspace user"}</p><p className="mt-0.5 text-[11px] text-[#102c3d]/50">{storageStatus}</p></div><form action="/api/levytate-beta-logout" method="post"><button type="submit" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#b13b51]/15 px-3 text-xs font-semibold text-[#b13b51]"><LogOut size={14} aria-hidden="true" />Sign out</button></form></div></div>
      </aside></div> : null}

      <div className="grid min-h-[calc(100vh-4.5rem)] w-full min-w-0 grid-cols-[minmax(0,1fr)] lg:grid-cols-[232px_minmax(0,1fr)]">
        <aside data-testid="levytate-sidebar" className="hidden min-w-0 border-r border-[#102c3d]/[0.07] bg-white lg:sticky lg:top-[4.5rem] lg:flex lg:h-[calc(100vh-4.5rem)] lg:flex-col">
          <nav className="flex min-h-0 flex-1 flex-col px-3 py-5" aria-label="Workspace areas">
            <div className="px-3 pb-3"><p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#102c3d]/38">Workspace</p><p className="mt-1 text-xs leading-5 text-[#102c3d]/55">Choose an area, then work in context.</p></div>
            <div className="min-h-0 flex-1 space-y-1 overflow-y-auto">{primaryNavigation.map((area) => {
              const Icon = navigationAreaIcon(area);
              const active = activeArea?.key === area.key;
              const badge = area.modules.reduce((total, module) => total + (moduleBadges[module as ModuleName] ?? 0), 0);
              return <button key={area.key} type="button" onClick={() => openArea(area)} aria-current={active ? "page" : undefined} className={`group flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-left transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#159b8f]/20 ${active ? "bg-[#eaf5f1] text-[#102c3d] shadow-[inset_3px_0_0_#159b8f]" : "text-[#102c3d]/62 hover:bg-[#f5f8f5] hover:text-[#102c3d]"}`}><span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${active ? "bg-white text-[#087c73]" : "bg-[#f5f8f5] text-[#102c3d]/45 group-hover:bg-white"}`}><Icon size={16} strokeWidth={1.8} aria-hidden="true" /></span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{area.label}</span></span>{badge ? <span className="min-w-5 rounded-full bg-white px-1.5 text-center text-[10px] font-bold leading-5 text-[#0b6f63] ring-1 ring-[#159b8f]/15">{badge}</span> : null}</button>;
            })}</div>
            {secondaryNavigation.length ? <div className="mt-4 border-t border-[#102c3d]/[0.07] pt-3"><p className="px-3 pb-2 text-[9px] font-semibold uppercase tracking-[0.13em] text-[#102c3d]/35">Tools & support</p><div className="grid gap-0.5">{secondaryNavigation.map((area) => { const Icon = navigationAreaIcon(area); const active = activeArea?.key === area.key; return <button key={area.key} type="button" onClick={() => openArea(area)} aria-current={active ? "page" : undefined} className={`flex min-h-10 items-center gap-3 rounded-lg px-3 text-left text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#159b8f]/20 ${active ? "bg-[#f1f7f4] text-[#087c73]" : "text-[#102c3d]/54 hover:bg-[#f5f8f5] hover:text-[#102c3d]"}`}><Icon size={15} aria-hidden="true" />{area.label}</button>; })}</div></div> : null}
          </nav>
        </aside>

        <section className="w-full min-w-0 max-w-full">
          <div className="mx-auto w-full min-w-0 max-w-[1580px] px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
            <header className="mb-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#0b6f63]">{activeArea?.label ?? "Protected workspace"}</p><h1 className="mt-1 text-[1.7rem] font-semibold tracking-[-0.035em] text-[#102c3d] sm:text-[2rem]">{moduleLabel(activeModule)}</h1><p className="mt-1.5 max-w-3xl text-sm leading-6 text-[#102c3d]/60">{moduleCopy[activeModule]}</p></div></div>
              {activeArea && activeArea.modules.length > 1 ? <nav aria-label={`${activeArea.label} views`} className="mt-4 flex max-w-full gap-1 overflow-x-auto rounded-xl border border-[#102c3d]/[0.07] bg-white p-1.5 shadow-[0_8px_24px_rgba(16,44,61,0.035)]">{activeArea.modules.map((module) => <button key={module} type="button" onClick={() => openModule(module as ModuleName)} aria-current={activeModule === module ? "page" : undefined} className={`min-h-10 shrink-0 rounded-lg px-3.5 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#159b8f]/20 ${activeModule === module ? "bg-[#102c3d] text-white shadow-[0_6px_14px_rgba(16,44,61,0.14)]" : "text-[#102c3d]/58 hover:bg-[#f3f7f4] hover:text-[#102c3d]"}`}>{moduleLabel(module as ModuleName)}</button>)}</nav> : null}
            </header>

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
            {activeModule === "My Application" ? <EmployeeApplicationModule onNavigate={navigateTo} /> : null}
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
            {activeModule === "Learning Time" ? <LearningTimeModule /> : null}
            {activeModule === "My Support" || activeModule === "Learner Support" ? <PastoralSupportModule /> : null}
            {activeModule === "Assessments" ? <AssessmentsModule /> : null}
            {activeModule === "People" ? (
              <ModuleStackNav items={peopleItems} active={peopleView} onSelect={(item) => setPeopleView(item as PeopleView)}>
                {peopleView === "Employees" ? <EmployeesModule initialEmployeeId={peopleEmployeeId} onStartDiscovery={(employeeId) => { setAiEmployeeId(employeeId); openModule("Copilot"); }} /> : null}
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
            {activeModule === "My Providers" ? <MyProvidersModule onOpenMarketplace={() => openModule("Marketplace")} onRequest={meta?.requestsEnabled ? (providerId) => openRequest({ providerId }) : undefined} /> : null}
            {activeModule === "My Programmes" ? <MyProgrammesModule onOpenMarketplace={() => openModule("Marketplace")} onRequest={meta?.requestsEnabled ? (programmeId, providerId) => openRequest({ programmeId, providerId }) : undefined} /> : null}
            {activeModule === "Requests" ? <EmployerRequestsContainer onOpenMarketplace={() => openModule("Marketplace")} onOpenMyProviders={() => openModule("My Providers")} onOpenMyProgrammes={() => openModule("My Programmes")} /> : null}
            {activeModule === "Marketplace" ? <ProvidersModule onRequest={openRequest} /> : null}
            {activeModule === "Insights" ? <EmployerInsightsModule view="overview" /> : null}
            {activeModule === "Workforce Development" ? <EmployerInsightsModule view="workforce" /> : null}
            {activeModule === "Finance" ? <LevyFinanceModule organisationId={meta?.organisationId ?? "local-demo"} demoMode={meta?.storageMode !== "supabase"} /> : null}
            {activeModule === "Programmes" ? <ProvidersModule /> : null}
            {activeModule === "Reports" ? <ReportsModule /> : null}
            {activeModule === "Support" ? <PlatformAdminSupportContextModule /> : null}
            {activeModule === "Settings" ? (
              <ModuleStackNav items={settingsItems} active={settingsView} onSelect={(item) => setSettingsView(item as SettingsView)}>
                {settingsView === "Workspace" ? <SettingsModule /> : null}
                {settingsView === "Workflows" ? <ApplicationWorkflowSettings /> : null}
                {settingsView === "Desktop App" ? <LevyTateDesktopAppPanel /> : null}
                {settingsView === "Early Access" ? <div className="grid gap-5"><ProspectAccessAdminModule /><EarlyAccessModule /></div> : null}
              </ModuleStackNav>
            ) : null}
          </div>
          <nav aria-label="Trust and support" className="mx-auto mt-4 flex max-w-[1540px] flex-wrap gap-x-5 gap-y-1 border-t border-[#102c3d]/[0.06] px-4 pb-5 pt-3 text-xs font-semibold text-[#102c3d]/[0.48] sm:px-6 lg:px-8">
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
      <div className="flex max-w-full gap-1 overflow-x-auto rounded-xl border border-[#102c3d]/[0.07] bg-white p-1.5 shadow-[0_8px_24px_rgba(16,44,61,0.035)]" role="tablist">
        {items.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => onSelect(item)}
            role="tab"
            aria-selected={active === item}
            className={`min-h-10 shrink-0 rounded-lg px-4 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#159b8f]/20 ${active === item ? "bg-[#102c3d] text-white shadow-[0_6px_14px_rgba(16,44,61,0.14)]" : "text-[#102c3d]/[0.58] hover:bg-[#f4f8f5] hover:text-[#102c3d]"}`}
          >
            {item}
          </button>
        ))}
      </div>
      {children}
    </div>
  );
}

function MobileNavigationArea({ area, activeModule, moduleLabel, onOpenArea, onOpenModule }: {
  area: Release2NavigationArea;
  activeModule: ModuleName;
  moduleLabel: (module: ModuleName) => string;
  onOpenArea: (area: Release2NavigationArea) => void;
  onOpenModule: (module: ModuleName) => void;
}) {
  const active = area.modules.includes(activeModule);
  const Icon = navigationAreaIcon(area);
  return <div>
    <button type="button" onClick={() => onOpenArea(area)} aria-current={active ? "page" : undefined} className={`flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-left transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#159b8f]/20 ${active ? "bg-[#eaf5f1] text-[#102c3d]" : "text-[#102c3d]/65 hover:bg-[#f4f8f5]"}`}>
      <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${active ? "bg-white text-[#087c73]" : "bg-[#f4f8f5] text-[#102c3d]/45"}`}><Icon size={16} aria-hidden="true" /></span>
      <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{area.label}</span><span className="mt-0.5 block truncate text-[11px] font-medium text-[#102c3d]/45">{area.description}</span></span>
      <ChevronRight size={15} className="text-[#102c3d]/35" aria-hidden="true" />
    </button>
    {active && area.modules.length > 1 ? <div className="ml-11 mt-1 grid gap-0.5 border-l border-[#159b8f]/20 pl-3">{area.modules.map((module) => <button key={module} type="button" onClick={() => onOpenModule(module as ModuleName)} aria-current={activeModule === module ? "page" : undefined} className={`min-h-10 rounded-lg px-3 text-left text-xs font-semibold focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#159b8f]/20 ${activeModule === module ? "bg-[#102c3d] text-white" : "text-[#102c3d]/55 hover:bg-[#f4f8f5] hover:text-[#102c3d]"}`}>{moduleLabel(module as ModuleName)}</button>)}</div> : null}
  </div>;
}

function navigationAreaIcon(area: Release2NavigationArea): LucideIcon {
  if (area.key === "home" || area.key === "workspaces") return LayoutDashboard;
  if (area.key === "people" || area.key === "team") return Users;
  if (area.key === "applications" || area.key === "approvals" || area.key === "application") return ClipboardCheck;
  if (area.key === "assessments" || area.key === "development") return ClipboardList;
  if (area.key === "support") return HeartHandshake;
  if (area.key === "programmes") return GraduationCap;
  if (area.key === "catalogue") return Building2;
  if (area.key === "insights") return ChartNoAxesCombined;
  if (area.key === "copilot") return Sparkles;
  if (area.key === "guidance") return CircleHelp;
  if (area.key === "settings" || area.key === "access") return Settings;
  return BellRing;
}
