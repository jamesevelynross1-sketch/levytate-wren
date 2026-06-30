"use client";

import type { LucideIcon } from "lucide-react";
import { BriefcaseBusiness, Building2, ClipboardList, GitBranch, GraduationCap, LayoutDashboard, LogOut, Settings, Sparkles, UserRound, Users } from "lucide-react";
import { LevyTateLogo } from "@/components/levytate-demo/PlatformShell";
import { ApplicationsModule } from "@/components/levytate-mvp/ApplicationsModule";
import { AskLevyTateAiWorkspace } from "@/components/levytate-mvp/AskLevyTateAiWorkspace";
import { DashboardModule, SettingsModule } from "@/components/levytate-mvp/DashboardSettingsModules";
import { EmployeesModule } from "@/components/levytate-mvp/EmployeesModule";
import { EnrolmentsModule } from "@/components/levytate-mvp/EnrolmentsModule";
import { MvpWorkspaceProvider, useMvpWorkspace } from "@/components/levytate-mvp/MvpWorkspaceStore";
import { ProviderMatchingModule } from "@/components/levytate-mvp/ProviderMatchingModule";
import { ProvidersModule } from "@/components/levytate-mvp/ProvidersModule";
import { RolesModule } from "@/components/levytate-mvp/RolesModule";
import { useState } from "react";

const modules = [
  { name: "Ask LevyTate AI", icon: Sparkles },
  { name: "Dashboard", icon: LayoutDashboard },
  { name: "Employees", icon: Users },
  { name: "Roles", icon: BriefcaseBusiness },
  { name: "Applications", icon: ClipboardList },
  { name: "Providers", icon: Building2 },
  { name: "Provider Matching", icon: GitBranch },
  { name: "Enrolments", icon: GraduationCap },
  { name: "Settings", icon: Settings },
] as const satisfies ReadonlyArray<{ name: string; icon: LucideIcon }>;

type ModuleName = (typeof modules)[number]["name"];

const moduleCopy: Record<ModuleName, string> = {
  "Ask LevyTate AI": "Role-aware guidance grounded in LevyTate pathways, rules and workflow controls.",
  Dashboard: "Set up the workspace and move directly into the records that need attention.",
  Employees: "Create and maintain employee, role, manager, department and site assignments.",
  Roles: "Own role-led pathway mappings from one controlled role library.",
  Applications: "Manage the employee to manager to apprenticeship lead approval workflow.",
  Providers: "Maintain LevyTate's controlled provider and programme catalogue.",
  "Provider Matching": "Capture employer needs and prepare controlled provider shortlists.",
  Enrolments: "Move final-approved applications into provider and enrolment tracking.",
  Settings: "Configure the beta employer workspace and its operating context.",
};

export function LevyTateMvpApp() {
  return <MvpWorkspaceProvider><MvpAppShell /></MvpWorkspaceProvider>;
}

function MvpAppShell() {
  const { data, hydrated } = useMvpWorkspace();
  const [activeModule, setActiveModule] = useState<ModuleName>("Ask LevyTate AI");
  const [aiEmployeeId, setAiEmployeeId] = useState<string | null>(null);

  async function logout() {
    await fetch("/api/levytate-beta-logout", { method: "POST" });
    window.location.href = "/login";
  }

  return (
    <main className="min-h-screen bg-[#f4f7f5] text-[#102c3d]">
      <div className="grid min-h-screen lg:grid-cols-[264px_minmax(0,1fr)]">
        <aside className="hidden border-r border-[#102c3d]/[0.08] bg-white px-4 py-5 lg:flex lg:h-screen lg:flex-col">
          <div className="px-2"><LevyTateLogo className="[--levytate-logo-size:2.55rem]" /></div>
          <div className="mt-6 rounded-xl border border-[#102c3d]/[0.07] bg-[#f7faf8] px-3.5 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#0b6f63]">Active workspace</p>
            <p className="mt-1 truncate text-sm font-semibold">{data.profile.employerName || "No employer selected"}</p>
            <p className="mt-0.5 truncate text-xs text-[#102c3d]/48">{data.profile.workspaceName}</p>
          </div>
          <nav className="mt-5 grid gap-1" aria-label="MVP navigation">
            {modules.map(({ name, icon: Icon }) => {
              const active = activeModule === name;
              return <button key={name} onClick={() => setActiveModule(name)} className={`group flex min-h-11 items-center gap-3 rounded-lg px-3 text-left text-sm font-semibold transition ${active ? "bg-[#eaf5f1] text-[#102c3d] shadow-[inset_3px_0_0_#159b8f]" : "text-[#102c3d]/58 hover:bg-[#f6f9f7] hover:text-[#102c3d]"}`}><Icon size={18} strokeWidth={active ? 2 : 1.7} className={`shrink-0 transition ${active ? "text-[#0b8e82]" : "text-[#102c3d]/42 group-hover:text-[#0b8e82]"}`} aria-hidden="true" /><span>{name}</span></button>;
            })}
          </nav>
          <div className="mt-auto border-t border-[#102c3d]/[0.07] pt-4">
            <div className="flex items-center gap-3 px-2"><div className="grid h-9 w-9 place-items-center rounded-full bg-[#102c3d] text-white"><UserRound size={17} strokeWidth={1.8} aria-hidden="true" /></div><div><p className="text-xs font-semibold">Beta administrator</p><p className="mt-0.5 text-[11px] text-[#102c3d]/44">Local workspace mode</p></div></div>
          </div>
        </aside>

        <section className="min-w-0">
          <header className="sticky top-0 z-30 border-b border-[#102c3d]/[0.08] bg-white/94 backdrop-blur-xl">
            <div className="mx-auto flex min-h-16 max-w-[1540px] items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
              <div className="flex min-w-0 items-center gap-3 lg:hidden"><LevyTateLogo className="[--levytate-logo-size:2rem]" /><select value={activeModule} onChange={(event) => setActiveModule(event.target.value as ModuleName)} className="h-10 min-w-0 max-w-[220px] rounded-lg border border-[#102c3d]/[0.09] bg-[#f8fbfa] px-3 text-sm font-semibold">{modules.map((module) => <option key={module.name}>{module.name}</option>)}</select></div>
              <div className="hidden min-w-0 lg:block"><p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#0b6f63]">LevyTate MVP</p><p className="truncate text-sm font-semibold">{data.profile.employerName || "Clean beta workspace"}</p></div>
              <div className="flex items-center gap-2"><span className="hidden rounded-full bg-[#edf7f3] px-3 py-2 text-xs font-semibold text-[#0b6f63] sm:inline-flex">{hydrated ? "Saved locally" : "Loading workspace"}</span><button onClick={logout} title="Logout" className="inline-flex h-10 items-center gap-2 rounded-full bg-[#102c3d] px-4 text-xs font-semibold text-white shadow-[0_8px_18px_rgba(16,44,61,0.12)]"><LogOut size={15} aria-hidden="true" /><span className="hidden sm:inline">Logout</span></button></div>
            </div>
          </header>

          <div className="mx-auto max-w-[1540px] px-4 py-5 sm:px-6 lg:px-8">
            <section className="mb-5 border-b border-[#102c3d]/[0.07] pb-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#c95568]">Protected workspace</p>
              <h1 className="mt-1 text-2xl font-semibold tracking-[-0.025em]">{activeModule}</h1>
              <p className="mt-1.5 max-w-3xl text-sm leading-6 text-[#102c3d]/56">{moduleCopy[activeModule]}</p>
            </section>
            {activeModule === "Ask LevyTate AI" ? <AskLevyTateAiWorkspace initialEmployeeId={aiEmployeeId} /> : null}
            {activeModule === "Dashboard" ? <DashboardModule onNavigate={(module) => setActiveModule(module as ModuleName)} /> : null}
            {activeModule === "Employees" ? <EmployeesModule onStartDiscovery={(employeeId) => { setAiEmployeeId(employeeId); setActiveModule("Ask LevyTate AI"); }} /> : null}
            {activeModule === "Roles" ? <RolesModule /> : null}
            {activeModule === "Applications" ? <ApplicationsModule /> : null}
            {activeModule === "Providers" ? <ProvidersModule /> : null}
            {activeModule === "Provider Matching" ? <ProviderMatchingModule /> : null}
            {activeModule === "Enrolments" ? <EnrolmentsModule /> : null}
            {activeModule === "Settings" ? <SettingsModule /> : null}
          </div>
        </section>
      </div>
    </main>
  );
}