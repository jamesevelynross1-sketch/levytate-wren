"use client";

import { useMemo, useState } from "react";
import { LevyTateLogo } from "@/components/levytate-demo/PlatformShell";
import { mvpApplications, mvpEmployees, mvpEmployers, mvpProviderCatalogue, mvpRoles } from "@/lib/levytate/data/mvp";
import { filterProviderCatalogue, fundingLabel, shortlistProvidersForNeed } from "@/lib/levytate/domain";
import type { ProviderCatalogueFilters } from "@/lib/levytate/domain";

const modules = ["Dashboard", "Employees", "Roles", "Applications", "Providers", "Provider Matching", "Enrolments", "Settings"] as const;
type ModuleName = (typeof modules)[number];

const emptyCounts = [
  { label: "Employers", value: mvpEmployers.length, note: "Create the first beta employer workspace." },
  { label: "Employees", value: mvpEmployees.length, note: "No employee records are preloaded." },
  { label: "Roles", value: mvpRoles.length, note: "Role library starts empty for each employer." },
  { label: "Applications", value: mvpApplications.length, note: "Application workflow starts from a clean state." },
];

const defaultFilters: ProviderCatalogueFilters = {
  search: "",
  sector: "All",
  programme: "All",
  deliveryModel: "All",
  region: "All",
  status: "Active",
};

export function LevyTateMvpApp() {
  const [activeModule, setActiveModule] = useState<ModuleName>("Dashboard");
  const [providerSearch, setProviderSearch] = useState("");

  async function logout() {
    await fetch("/api/levytate-beta-logout", { method: "POST" });
    window.location.href = "/login";
  }

  return (
    <main className="min-h-screen bg-[#f5f8f6] text-[#102c3d]">
      <div className="grid min-h-screen lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="hidden border-r border-[#102c3d]/[0.08] bg-white px-4 py-5 lg:flex lg:h-screen lg:flex-col">
          <LevyTateLogo className="[--levytate-logo-size:2.65rem]" />
          <div className="mt-6 rounded-2xl border border-[#102c3d]/[0.06] bg-[#f6fbf8] px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#0b6f63]">Beta workspace</p>
            <p className="mt-1 text-sm font-semibold text-[#102c3d]">No employer selected</p>
          </div>
          <nav className="mt-6 grid gap-1.5">
            {modules.map((item) => {
              const active = activeModule === item;
              return (
                <button key={item} onClick={() => setActiveModule(item)} className={`flex items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm font-semibold transition ${active ? "bg-[#edf7f3] text-[#102c3d] shadow-[inset_3px_0_0_#159b8f]" : "text-[#102c3d]/58 hover:bg-[#f8fbfa] hover:text-[#102c3d]"}`}>
                  <span className={`grid h-8 w-8 place-items-center rounded-xl text-[10px] ${active ? "bg-white text-[#159b8f]" : "bg-[#f6fbf8] text-[#102c3d]/46"}`}>{initials(item)}</span>
                  <span>{item}</span>
                </button>
              );
            })}
          </nav>
          <div className="mt-auto rounded-2xl bg-[#102c3d] px-4 py-4 text-white">
            <p className="text-xs font-semibold">LevyTate MVP</p>
            <p className="mt-1 text-xs leading-5 text-white/64">Clean beta product shell. Demo data is kept separate.</p>
          </div>
        </aside>

        <section className="min-w-0">
          <header className="sticky top-0 z-30 border-b border-[#102c3d]/[0.08] bg-white/92 backdrop-blur-xl">
            <div className="mx-auto grid max-w-[1500px] gap-3 px-4 py-3 sm:px-6 xl:grid-cols-[minmax(280px,1fr)_auto_auto_auto] xl:items-center">
              <label className="flex h-11 min-w-0 items-center gap-3 rounded-full border border-[#102c3d]/[0.08] bg-[#f8fbfa] px-4 focus-within:border-[#159b8f] focus-within:bg-white focus-within:ring-4 focus-within:ring-[#159b8f]/10">
                <span className="text-sm text-[#102c3d]/36">Search</span>
                <input className="min-w-0 flex-1 bg-transparent text-sm font-medium text-[#102c3d] outline-none" placeholder="Search employees, roles, applications or providers" />
              </label>
              <div className="rounded-full bg-[#f8fbfa] px-4 py-2 text-xs font-semibold text-[#102c3d]/62 ring-1 ring-[#102c3d]/[0.08]">Employer workspace: Not set</div>
              <div className="rounded-full bg-[#edf7f3] px-4 py-2 text-xs font-semibold text-[#0b6f63] ring-1 ring-[#159b8f]/[0.12]">Beta user</div>
              <button onClick={logout} className="rounded-full bg-[#102c3d] px-4 py-2 text-xs font-semibold text-white shadow-[0_10px_22px_rgba(16,44,61,0.12)]">Logout</button>
            </div>
          </header>

          <div className="mx-auto max-w-[1500px] px-4 py-5 sm:px-6 lg:px-8">
            <ModuleHeader activeModule={activeModule} />
            {activeModule === "Dashboard" ? <DashboardModule /> : null}
            {activeModule === "Employees" ? <EmptyModule title="Employees" copy="Create employee records, assign managers, departments, sites and application status once a beta employer is onboarded." /> : null}
            {activeModule === "Roles" ? <EmptyModule title="Roles" copy="Build the role library and pathway mappings that will power recommendations and Ask LevyTate AI." /> : null}
            {activeModule === "Applications" ? <EmptyModule title="Applications" copy="Track applications through employee submission, line manager review and apprenticeship lead approval." /> : null}
            {activeModule === "Providers" ? <ProvidersModule search={providerSearch} setSearch={setProviderSearch} /> : null}
            {activeModule === "Provider Matching" ? <ProviderMatchingModule /> : null}
            {activeModule === "Enrolments" ? <EmptyModule title="Enrolments" copy="Approved applications will move here when they are ready for provider submission and enrolment tracking." /> : null}
            {activeModule === "Settings" ? <SettingsModule /> : null}
          </div>
        </section>
      </div>
    </main>
  );
}

function ModuleHeader({ activeModule }: { activeModule: ModuleName }) {
  return (
    <section className="mb-5 rounded-[1.25rem] border border-[#102c3d]/[0.07] bg-white p-5 shadow-[0_18px_46px_rgba(16,44,61,0.045)]">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#c95568]">LevyTate MVP</p>
      <h1 className="mt-1 text-3xl font-semibold tracking-[-0.035em] text-[#102c3d]">{activeModule}</h1>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-[#102c3d]/58">Standalone beta product environment. No MPR Consulting layout, no Portakabin branding and no preloaded employer records.</p>
    </section>
  );
}

function DashboardModule() {
  return (
    <div className="grid gap-5">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {emptyCounts.map((item) => <Metric key={item.label} {...item} />)}
      </section>
      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <Panel title="Clean onboarding state" eyebrow="MVP setup">
          <div className="grid gap-3 sm:grid-cols-2">
            {["Create employer", "Add sites", "Invite employees", "Build role library", "Map pathways", "Configure providers"].map((item) => <ChecklistItem key={item}>{item}</ChecklistItem>)}
          </div>
        </Panel>
        <Panel title="Provider catalogue" eyebrow="Seeded asset">
          <p className="text-sm leading-6 text-[#102c3d]/60">The MVP starts clean for employer data, but includes the LevyTate provider catalogue as a platform asset.</p>
          <p className="mt-4 text-3xl font-semibold tracking-[-0.035em]">{mvpProviderCatalogue.length}</p>
          <p className="mt-1 text-xs font-semibold uppercase tracking-[0.14em] text-[#102c3d]/42">Seeded providers</p>
        </Panel>
      </section>
    </div>
  );
}

function ProvidersModule({ search, setSearch }: { search: string; setSearch: (value: string) => void }) {
  const filters = useMemo<ProviderCatalogueFilters>(() => ({ ...defaultFilters, search }), [search]);
  const providers = useMemo(() => filterProviderCatalogue(mvpProviderCatalogue, filters), [filters]);

  return (
    <Panel title="Provider catalogue" eyebrow="LevyTate-led matching">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-3xl text-sm leading-6 text-[#102c3d]/60">Search and review verified or verification-needed providers. Employers do not browse this as a public marketplace.</p>
        <input value={search} onChange={(event) => setSearch(event.target.value)} className="h-11 rounded-full border border-[#102c3d]/[0.08] bg-[#f8fbfa] px-4 text-sm outline-none focus:border-[#159b8f] focus:ring-4 focus:ring-[#159b8f]/10" placeholder="Search catalogue" />
      </div>
      <div className="overflow-hidden rounded-2xl border border-[#102c3d]/[0.06]">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-[#f8fbfa] text-[10px] uppercase tracking-[0.14em] text-[#102c3d]/42"><tr><th className="px-4 py-3">Provider</th><th className="px-4 py-3">Programmes</th><th className="px-4 py-3">Sectors</th><th className="px-4 py-3">Status</th></tr></thead>
          <tbody className="divide-y divide-[#102c3d]/[0.055]">
            {providers.map((provider) => <tr key={provider.providerId}><td className="px-4 py-3 font-semibold">{provider.providerName}</td><td className="px-4 py-3 text-[#102c3d]/62">{provider.programmes.length}</td><td className="px-4 py-3 text-[#102c3d]/62">{provider.sectors.slice(0, 3).join(", ")}</td><td className="px-4 py-3"><Badge>{provider.verificationStatus.replace("_", " ")}</Badge></td></tr>)}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

function ProviderMatchingModule() {
  const shortlist = shortlistProvidersForNeed(mvpProviderCatalogue, { query: "data digital apprenticeships remote" }).slice(0, 5);
  return (
    <Panel title="Provider Matching" eyebrow="Controlled shortlist">
      <div className="grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
        <div className="rounded-2xl bg-[#f8fbfa] p-4 ring-1 ring-[#102c3d]/[0.055]">
          <p className="text-sm leading-6 text-[#102c3d]/60">Provider matching requests will be created by employer users and reviewed by the LevyTate team. This workspace is intentionally clean until a beta employer is onboarded.</p>
        </div>
        <div className="grid gap-3">
          {shortlist.map((item) => <div key={item.provider.providerId} className="rounded-2xl bg-white px-4 py-3 ring-1 ring-[#102c3d]/[0.07]"><p className="font-semibold">{item.provider.providerName}</p><p className="mt-1 text-xs text-[#102c3d]/54">Fit score {item.score}% | {item.reasons.join(", ")}</p><p className="mt-2 text-xs text-[#102c3d]/48">{item.provider.programmes[0] ? fundingLabel(item.provider.programmes[0]) : "Funding position to verify"}</p></div>)}
        </div>
      </div>
    </Panel>
  );
}

function EmptyModule({ title, copy }: { title: string; copy: string }) {
  return (
    <Panel title={title} eyebrow="Clean state">
      <div className="rounded-2xl bg-[#f8fbfa] p-6 text-center ring-1 ring-[#102c3d]/[0.055]">
        <p className="text-lg font-semibold text-[#102c3d]">No records yet</p>
        <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-[#102c3d]/60">{copy}</p>
        <button className="mt-5 rounded-full bg-[#102c3d] px-5 py-2.5 text-xs font-semibold text-white">Add first record</button>
      </div>
    </Panel>
  );
}

function SettingsModule() {
  return (
    <Panel title="Settings" eyebrow="Beta setup">
      <div className="grid gap-4 md:grid-cols-2">
        <Setting label="Authentication" value="Temporary beta access cookie. Ready to replace with real auth." />
        <Setting label="Data mode" value="Clean MVP records with seeded provider catalogue only." />
        <Setting label="Workspace" value="Employer workspace is created by the beta user." />
        <Setting label="Domain" value="Designed for levytate.co.uk." />
      </div>
    </Panel>
  );
}

function Panel({ eyebrow, title, children }: { eyebrow: string; title: string; children: React.ReactNode }) {
  return <section className="rounded-[1.25rem] border border-[#102c3d]/[0.07] bg-white p-5 shadow-[0_18px_46px_rgba(16,44,61,0.045)]"><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#c95568]">{eyebrow}</p><h2 className="mt-1 text-xl font-semibold tracking-[-0.02em]">{title}</h2><div className="mt-4">{children}</div></section>;
}
function Metric({ label, value, note }: { label: string; value: number; note: string }) { return <article className="rounded-[1.25rem] border border-[#102c3d]/[0.07] bg-white p-4 shadow-[0_18px_46px_rgba(16,44,61,0.045)]"><p className="text-xs font-semibold text-[#102c3d]/48">{label}</p><p className="mt-2 text-3xl font-semibold tracking-[-0.04em]">{value}</p><p className="mt-2 text-xs leading-5 text-[#102c3d]/54">{note}</p></article>; }
function ChecklistItem({ children }: { children: React.ReactNode }) { return <div className="flex items-center gap-3 rounded-2xl bg-[#f8fbfa] px-4 py-3 text-sm font-semibold ring-1 ring-[#102c3d]/[0.055]"><span className="h-2.5 w-2.5 rounded-full bg-[#159b8f]" />{children}</div>; }
function Badge({ children }: { children: React.ReactNode }) { return <span className="inline-flex rounded-full bg-[#edf7f3] px-3 py-1.5 text-xs font-semibold text-[#0b6f63] ring-1 ring-[#159b8f]/[0.12]">{children}</span>; }
function Setting({ label, value }: { label: string; value: string }) { return <div className="rounded-2xl bg-[#f8fbfa] p-4 ring-1 ring-[#102c3d]/[0.055]"><p className="text-xs font-semibold uppercase tracking-[0.13em] text-[#102c3d]/42">{label}</p><p className="mt-2 text-sm leading-6 text-[#102c3d]/62">{value}</p></div>; }
function initials(item: string) { return item.split(" ").map((word) => word[0]).join("").slice(0, 2); }

