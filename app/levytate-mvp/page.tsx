import Link from "next/link";
import { LevyTateLogo, PlatformTopBar } from "@/components/levytate-demo/PlatformShell";
import { mvpProviderCatalogue, mvpApplications, mvpDepartments, mvpEmployees, mvpEmployers, mvpRoles, mvpSites } from "@/lib/levytate/data/mvp";

const setupItems = [
  ["Employers", mvpEmployers.length, "Add the client organisation before creating workforce records."],
  ["Sites", mvpSites.length, "Create workplace locations or regional operating units."],
  ["Departments", mvpDepartments.length, "Define the internal structure used for reporting and approvals."],
  ["Employees", mvpEmployees.length, "Import or add employees once an employer is configured."],
  ["Roles", mvpRoles.length, "Create role records before mapping apprenticeship pathways."],
  ["Applications", mvpApplications.length, "Applications start empty for a new client workspace."],
];

export default function LevyTateMvpPage() {
  const programmeCount = mvpProviderCatalogue.reduce((sum, provider) => sum + provider.programmes.length, 0);

  return (
    <main className="min-h-screen bg-[#f5f7f6] text-[#102c3d]">
      <PlatformTopBar tenantName="LevyTate MVP" tenantSubtitle="Clean workspace" controlsOnly>
        <div className="flex w-full items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <LevyTateLogo className="[--levytate-logo-size:2.35rem]" />
            <div className="hidden h-8 w-px bg-[#102c3d]/10 sm:block" />
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#0b6f63]">Production foundation</p>
              <p className="text-sm font-semibold text-[#102c3d]">No employer demo data loaded</p>
            </div>
          </div>
          <Link href="/levytate-mvp/providers" className="rounded-full bg-[#102c3d] px-4 py-2.5 text-xs font-semibold text-white shadow-[0_10px_22px_rgba(16,44,61,0.12)]">Open providers</Link>
        </div>
      </PlatformTopBar>

      <div className="mx-auto grid w-full max-w-[1320px] gap-5 px-5 py-6 sm:px-7 lg:px-8">
        <section className="rounded-[1rem] border border-[#102c3d]/[0.065] bg-white p-5 shadow-[0_10px_28px_rgba(16,44,61,0.045)]">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#c95568]">MVP starting state</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.03em] text-[#102c3d]">Start a real client workspace</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[#102c3d]/58">The MVP starts without Portakabin, Wren or other employer records. LevyTate admins can add an employer, sites, departments, employees, roles, pathway mappings, applications and provider matching requests from a clean state.</p>
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          {setupItems.map(([label, value, copy]) => (
            <article key={String(label)} className="rounded-[1rem] border border-[#102c3d]/[0.065] bg-white p-4 shadow-[0_10px_28px_rgba(16,44,61,0.045)]">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#102c3d]/38">{label}</p>
              <p className="mt-2 text-3xl font-semibold tracking-[-0.03em] text-[#102c3d]">{value}</p>
              <p className="mt-2 text-sm leading-6 text-[#102c3d]/58">{copy}</p>
            </article>
          ))}
        </section>

        <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="rounded-[1rem] border border-[#102c3d]/[0.065] bg-white p-5 shadow-[0_10px_28px_rgba(16,44,61,0.045)]">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#c95568]">Provider catalogue</p>
            <h2 className="mt-1 text-xl font-semibold text-[#102c3d]">Seeded LevyTate provider asset</h2>
            <p className="mt-2 text-sm leading-6 text-[#102c3d]/58">The MVP includes a provider catalogue for LevyTate-led matching from day one. Provider and programme records are editable and carry verification status.</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <Metric label="Providers" value={String(mvpProviderCatalogue.length)} />
              <Metric label="Programmes" value={String(programmeCount)} />
              <Metric label="Needs verification" value={String(mvpProviderCatalogue.filter((provider) => provider.verificationStatus === "needs_verification").length)} />
            </div>
          </div>
          <div className="rounded-[1rem] border border-[#102c3d]/[0.065] bg-[#102c3d] p-5 text-white shadow-[0_18px_48px_rgba(16,44,61,0.14)]">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8edfd4]">Provider matching</p>
            <h2 className="mt-1 text-xl font-semibold">LevyTate-led, not marketplace-led</h2>
            <p className="mt-2 text-sm leading-6 text-white/68">Employers submit needs. LevyTate uses programme, sector, region, delivery model and provider status to prepare a controlled shortlist.</p>
            <Link href="/levytate-mvp/providers" className="mt-5 inline-flex rounded-full bg-white px-4 py-2.5 text-xs font-semibold text-[#102c3d]">Manage catalogue</Link>
          </div>
        </section>
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-[#f8fbfa] px-3 py-2.5"><p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#102c3d]/36">{label}</p><p className="mt-1 text-2xl font-semibold text-[#102c3d]">{value}</p></div>;
}