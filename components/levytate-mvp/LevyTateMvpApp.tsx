"use client";

import type { LucideIcon } from "lucide-react";
import {
  BellRing,
  BriefcaseBusiness,
  Building2,
  ClipboardList,
  ClipboardPlus,
  FolderKanban,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Settings,
  Sparkles,
  UserRound,
  Users,
} from "lucide-react";
import { useMemo, useState } from "react";
import { LevyTateLogo } from "@/components/levytate-demo/PlatformShell";
import { ApplicationsModule } from "@/components/levytate-mvp/ApplicationsModule";
import { AskLevyTateAiWorkspace } from "@/components/levytate-mvp/AskLevyTateAiWorkspace";
import { DashboardModule, SettingsModule } from "@/components/levytate-mvp/DashboardSettingsModules";
import { EarlyAccessModule } from "@/components/levytate-mvp/EarlyAccessModule";
import { EmployeesModule } from "@/components/levytate-mvp/EmployeesModule";
import { EnrolmentsModule } from "@/components/levytate-mvp/EnrolmentsModule";
import { GuidanceCentreModule } from "@/components/levytate-mvp/GuidanceCentreModule";
import { LevyTateStandardsProvider } from "@/components/levytate-mvp/LevyTateStandardsProvider";
import { MvpWorkspaceProvider, useMvpWorkspace } from "@/components/levytate-mvp/MvpWorkspaceStore";
import { ProviderMatchingModule } from "@/components/levytate-mvp/ProviderMatchingModule";
import { ProvidersModule } from "@/components/levytate-mvp/ProvidersModule";
import { ReportsModule } from "@/components/levytate-mvp/ReportsModule";
import { RolesModule } from "@/components/levytate-mvp/RolesModule";
import type { LevyTateWorkspaceBootstrap } from "@/lib/levytate/mvp/api";
import { buildNotifications } from "@/lib/levytate/mvp/workspace-insights";

const modules = [
  { name: "Home", icon: LayoutDashboard, section: "Workspace" },
  { name: "Ask LevyTate AI", icon: Sparkles, section: "Workspace" },
  { name: "Guidance Centre", icon: BellRing, section: "Workspace" },
  { name: "Employees", icon: Users, section: "Records" },
  { name: "Roles", icon: BriefcaseBusiness, section: "Records" },
  { name: "Applications", icon: ClipboardList, section: "Workflow" },
  { name: "Enrolments", icon: GraduationCap, section: "Workflow" },
  { name: "Provider Partners", icon: Building2, section: "Partners" },
  { name: "Provider Relationships", icon: FolderKanban, section: "Partners" },
  { name: "Early Access", icon: ClipboardPlus, section: "Oversight" },
  { name: "Reports", icon: BellRing, section: "Oversight" },
  { name: "Settings", icon: Settings, section: "Oversight" },
] as const satisfies ReadonlyArray<{ name: string; icon: LucideIcon; section: string }>;

type ModuleName = (typeof modules)[number]["name"];

const moduleCopy: Record<ModuleName, string> = {
  Home: "Daily operating view for records, approvals, provider relationships and immediate next actions.",
  "Ask LevyTate AI": "Role-aware guidance grounded in live workspace data, recommendations and workflow rules.",
  "Guidance Centre": "Trusted advisory guidance covering funding, provider selection, employer readiness and future skills.",
  Employees: "Create and maintain the employee apprenticeship record, from manager assignment to discovery history.",
  Roles: "Own role-led pathway mappings from one controlled role library.",
  Applications: "Manage the employee to line manager to apprenticeship lead workflow without spreadsheets.",
  Enrolments: "Move final-approved applications into provider handoff, start dates and live learner tracking.",
  "Provider Partners": "Maintain the controlled provider catalogue and programme delivery records.",
  "Provider Relationships": "Set preferred partners by category and raise sourcing exceptions only when needed.",
  "Early Access": "Capture, qualify and progress employer beta demand inside LevyTate's first commercial workspace.",
  Reports: "Operational reporting generated from real workspace data instead of static demo metrics.",
  Settings: "Configure organisation, sites, departments and business priorities for the workspace.",
};

export function LevyTateMvpApp({ initialWorkspace }: { initialWorkspace?: LevyTateWorkspaceBootstrap | null }) {
  return <LevyTateStandardsProvider><MvpWorkspaceProvider initialWorkspace={initialWorkspace}><MvpAppShell /></MvpWorkspaceProvider></LevyTateStandardsProvider>;
}

function MvpAppShell() {
  const { data, meta, hydrated } = useMvpWorkspace();
  const [activeModule, setActiveModule] = useState<ModuleName>("Home");
  const [aiEmployeeId, setAiEmployeeId] = useState<string | null>(null);

  const notifications = useMemo(() => buildNotifications(data), [data]);
  const moduleBadges = useMemo(() => ({
    Applications: notifications.filter((item) => item.module === "Applications").length,
    "Provider Relationships": notifications.filter((item) => item.module === "Provider Relationships").length,
    Enrolments: notifications.filter((item) => item.module === "Enrolments").length,
    Reports: notifications.length,
  }), [notifications]);

  const groupedModules = useMemo(() => {
    return modules.reduce<Record<string, Array<(typeof modules)[number]>>>((groups, module) => {
      groups[module.section] = groups[module.section] ?? [];
      groups[module.section].push(module);
      return groups;
    }, {});
  }, []);

  async function logout() {
    await fetch("/api/levytate-beta-logout", { method: "POST" });
    window.location.href = "/login";
  }

  const workspaceName = data.profile.employerName || "LevyTate beta employer";
  const workspaceLabel = data.profile.workspaceName || "Standalone employer workspace";
  const storageStatus = meta?.storageMode === "supabase" ? "Supabase-backed workspace" : "Local fallback workspace";

  return (
    <main className="min-h-screen bg-[#f4f7f5] text-[#102c3d]">
      <header className="sticky top-0 z-40 border-b border-[#102c3d]/[0.08] bg-white/94 backdrop-blur-xl">
        <div className="mx-auto flex min-h-20 max-w-[1540px] flex-wrap items-center justify-between gap-x-4 gap-y-3 px-4 py-3 sm:px-6 lg:px-8 lg:py-0">
          <div className="flex min-w-0 flex-1 items-center gap-3 lg:flex-none">
            <LevyTateLogo className="[--levytate-logo-size:2.2rem] lg:[--levytate-logo-size:2.45rem]" />
            <div className="hidden h-9 w-px bg-[#102c3d]/[0.08] lg:block" />
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#0b6f63]">Active workspace</p>
              <p className="truncate text-sm font-semibold text-[#102c3d]">{workspaceName}</p>
              <p className="hidden truncate text-xs text-[#102c3d]/46 sm:block">{workspaceLabel}</p>
            </div>
          </div>

          <div className="flex w-full min-w-0 items-center gap-2 sm:gap-3 lg:w-auto">
            <div className="min-w-0 flex-1 lg:hidden">
              <select value={activeModule} onChange={(event) => setActiveModule(event.target.value as ModuleName)} className="h-11 w-full rounded-xl border border-[#102c3d]/[0.09] bg-[#f8fbfa] px-3 text-sm font-semibold text-[#102c3d] shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
                {modules.map((module) => <option key={module.name}>{module.name}</option>)}
              </select>
            </div>
            <span className="hidden rounded-full border border-[#159b8f]/10 bg-[#edf7f3] px-3.5 py-2 text-xs font-semibold text-[#0b6f63] sm:inline-flex">
              {hydrated ? `${notifications.length} live alerts` : "Loading workspace"}
            </span>
            <button onClick={logout} title="Logout" className="inline-flex h-11 shrink-0 items-center gap-2 rounded-full bg-[#102c3d] px-4 text-xs font-semibold text-white shadow-[0_10px_22px_rgba(16,44,61,0.12)] transition hover:bg-[#17394d]">
              <LogOut size={15} aria-hidden="true" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </header>

      <div className="grid min-h-[calc(100vh-5rem)] lg:grid-cols-[276px_minmax(0,1fr)]">
        <aside className="hidden border-r border-[#102c3d]/[0.08] bg-white lg:sticky lg:top-20 lg:flex lg:h-[calc(100vh-5rem)] lg:flex-col">
          <div className="flex min-h-0 flex-1 flex-col px-4 py-4">
            <div className="flex items-center justify-between px-2 pb-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#102c3d]/36">Workspace navigation</p>
                <p className="mt-1 text-sm font-semibold text-[#102c3d]">LevyTate modules</p>
              </div>
              <span className="rounded-full border border-[#102c3d]/[0.07] bg-[#f8fbfa] px-2.5 py-1 text-[10px] font-semibold text-[#102c3d]/56">
                {modules.length}
              </span>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto pr-1">
              <nav className="space-y-3" aria-label="MVP navigation">
                {Object.entries(groupedModules).map(([section, items]) => (
                  <div key={section}>
                    <p className="px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#102c3d]/34">{section}</p>
                    <div className="mt-1.5 grid gap-1">
                      {items.map(({ name, icon: Icon }) => {
                        const active = activeModule === name;
                        const badge = moduleBadges[name as keyof typeof moduleBadges];
                        return (
                          <button key={name} onClick={() => setActiveModule(name)} className={`group flex min-h-[42px] items-center justify-between gap-3 rounded-xl px-3 text-left text-sm font-semibold transition ${active ? "bg-[#eaf5f1] text-[#102c3d] shadow-[inset_3px_0_0_#159b8f,0_10px_18px_rgba(21,155,143,0.06)]" : "text-[#102c3d]/58 hover:bg-[#f6f9f7] hover:text-[#102c3d]"}`}>
                            <span className="flex min-w-0 items-center gap-3">
                              <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg transition ${active ? "bg-white text-[#0b8e82] ring-1 ring-[#159b8f]/12" : "bg-[#f7faf8] text-[#102c3d]/42 group-hover:bg-white group-hover:text-[#0b8e82] group-hover:ring-1 group-hover:ring-[#102c3d]/[0.06]"}`}>
                                <Icon size={16} strokeWidth={active ? 2 : 1.8} aria-hidden="true" />
                              </span>
                              <span className="truncate">{name}</span>
                            </span>
                            {badge ? <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold text-[#0b6f63] ring-1 ring-[#159b8f]/12">{badge}</span> : null}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </nav>
            </div>

            <div className="mt-4 border-t border-[#102c3d]/[0.07] pt-4">
              <div className="rounded-2xl border border-[#102c3d]/[0.07] bg-[#f8fbfa] p-4 shadow-[0_12px_26px_rgba(16,44,61,0.04)]">
                <div className="flex items-start gap-3">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#102c3d] text-white shadow-[0_8px_18px_rgba(16,44,61,0.12)]">
                    <UserRound size={17} strokeWidth={1.8} aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#0b6f63]">Platform admin</p>
                    <p className="mt-1 truncate text-sm font-semibold text-[#102c3d]">{meta?.userRole ?? "Workspace user"}</p>
                    <p className="mt-1 text-xs leading-5 text-[#102c3d]/52">Managing provider relationships, workspace settings and beta operations.</p>
                  </div>
                </div>

                <div className="mt-4 rounded-2xl border border-[#102c3d]/[0.06] bg-white px-3.5 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#102c3d]/34">Workspace status</p>
                      <p className="mt-1 truncate text-xs font-semibold text-[#102c3d]/68">{storageStatus}</p>
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
              <h1 className="mt-1 text-2xl font-semibold tracking-[-0.025em]">{activeModule}</h1>
              <p className="mt-1.5 max-w-3xl text-sm leading-6 text-[#102c3d]/56">{moduleCopy[activeModule]}</p>
            </section>

            {activeModule === "Home" ? <DashboardModule onNavigate={(module) => setActiveModule(module as ModuleName)} /> : null}
            {activeModule === "Ask LevyTate AI" ? <AskLevyTateAiWorkspace initialEmployeeId={aiEmployeeId} /> : null}
            {activeModule === "Guidance Centre" ? <GuidanceCentreModule /> : null}
            {activeModule === "Employees" ? <EmployeesModule onStartDiscovery={(employeeId) => { setAiEmployeeId(employeeId); setActiveModule("Ask LevyTate AI"); }} /> : null}
            {activeModule === "Roles" ? <RolesModule /> : null}
            {activeModule === "Applications" ? <ApplicationsModule /> : null}
            {activeModule === "Enrolments" ? <EnrolmentsModule /> : null}
            {activeModule === "Provider Partners" ? <ProvidersModule /> : null}
            {activeModule === "Provider Relationships" ? <ProviderMatchingModule /> : null}
            {activeModule === "Early Access" ? <EarlyAccessModule /> : null}
            {activeModule === "Reports" ? <ReportsModule /> : null}
            {activeModule === "Settings" ? <SettingsModule /> : null}
          </div>
        </section>
      </div>
    </main>
  );
}
