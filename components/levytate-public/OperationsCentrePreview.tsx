import { LevyTateLogo } from "@/components/levytate-demo/PlatformShell";

const summaryItems = [
  { label: "Needs attention", value: "4", context: "2 due today", tone: "bg-[#d65b70]" },
  { label: "Ready to enrol", value: "2", context: "Details complete", tone: "bg-[#159b8f]" },
  { label: "Reviews due", value: "3", context: "Next 14 days", tone: "bg-[#c79b35]" },
  { label: "Active learners", value: "18", context: "Across 7 programmes", tone: "bg-[#567f9d]" },
] as const;

const actionRows = [
  {
    learner: "Jordan Ellis",
    programme: "Operations Departmental Manager",
    action: "Manager review due",
    owner: "Line Manager",
    status: "Due today",
    tone: "bg-[#fff1f3] text-[#a53b4f]",
  },
  {
    learner: "Maya Patel",
    programme: "Data Technician",
    action: "Enrolment details ready",
    owner: "Apprenticeship Lead",
    status: "Ready",
    tone: "bg-[#eaf7f2] text-[#0b6f63]",
  },
  {
    learner: "Sam Carter",
    programme: "Improvement Practitioner",
    action: "Progress review approaching",
    owner: "Provider",
    status: "Due soon",
    tone: "bg-[#fbf4df] text-[#725d20]",
  },
] as const;

const primaryNavigation = ["Operations Centre", "Applications", "Learners", "Providers"];
const administrationNavigation = ["People", "Programmes", "Settings"];

export function OperationsCentrePreview({ detailed = false }: { detailed?: boolean }) {
  return (
    <div className="min-w-0 overflow-hidden rounded-[22px] bg-[#0a2333] text-white shadow-[0_32px_90px_rgba(9,31,45,0.24)] ring-1 ring-white/10">
      <div className="flex min-h-[62px] items-center justify-between gap-5 border-b border-white/[0.08] px-5 sm:px-6">
        <div className="flex min-w-0 items-center gap-4 sm:gap-5">
          <div className="flex shrink-0 items-center py-3" aria-hidden="true">
            <LevyTateLogo className="[--levytate-logo-size:1.55rem] sm:[--levytate-logo-size:1.65rem]" />
          </div>
          <span className="h-6 w-px shrink-0 bg-white/10" aria-hidden="true" />
          <div className="min-w-0">
            <p className="truncate text-[13px] font-semibold text-white/92">Operations Centre</p>
            <p className="mt-0.5 text-[11px] text-white/42">Example employer workspace</p>
          </div>
        </div>
        <div className="hidden items-center gap-3 sm:flex">
          <span className="h-1.5 w-1.5 rounded-full bg-[#c7f0e4]" aria-hidden="true" />
          <span className="text-[11px] font-medium text-white/58">Apprenticeship Lead</span>
        </div>
      </div>

      <div className={detailed ? "grid min-w-0 lg:grid-cols-[184px_minmax(0,1fr)]" : "min-w-0"}>
        {detailed ? <ProductSidebar /> : null}

        <div className="min-w-0 bg-[#f4f7f6] text-[#102c3d]">
          <div className="border-b border-[#102c3d]/[0.07] bg-white px-5 py-5 sm:px-6 sm:py-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#9f4253]">Daily learner operations</p>
            <h3 className="mt-2 text-[20px] font-semibold leading-tight tracking-[-0.025em] sm:text-[23px]">What needs attention today</h3>
            <p className="mt-2 max-w-xl text-[12px] leading-5 text-[#102c3d]/52 sm:text-[13px]">Priority work across applications, enrolment and active learner support.</p>
          </div>

          <div className="grid grid-cols-2 border-b border-[#102c3d]/[0.07] bg-white sm:grid-cols-4">
            {summaryItems.map((item, index) => (
              <div key={item.label} className={`min-w-0 px-4 py-4 sm:px-5 sm:py-5 ${index % 2 === 0 ? "border-r" : ""} border-[#102c3d]/[0.07] sm:border-r sm:last:border-r-0 ${index < 2 ? "border-b sm:border-b-0" : ""}`}>
                <div className="flex items-center gap-2">
                  <span className={`h-1.5 w-1.5 rounded-full ${item.tone}`} aria-hidden="true" />
                  <p className="truncate text-[11px] font-medium text-[#102c3d]/50">{item.label}</p>
                </div>
                <p className="mt-2 text-[25px] font-semibold leading-none tracking-[-0.04em] sm:text-[28px]">{item.value}</p>
                <p className="mt-2 truncate text-[10px] text-[#102c3d]/40 sm:text-[11px]">{item.context}</p>
              </div>
            ))}
          </div>

          <div className="p-4 sm:p-5">
            <div className="overflow-hidden rounded-[14px] bg-white shadow-[0_1px_2px_rgba(16,44,61,0.03)] ring-1 ring-[#102c3d]/[0.07]">
              <div className="flex items-end justify-between gap-5 border-b border-[#102c3d]/[0.07] px-4 py-4 sm:px-5">
                <div>
                  <p className="text-[13px] font-semibold">Priority actions</p>
                  <p className="mt-1 text-[11px] text-[#102c3d]/44">Ordered by urgency and ownership</p>
                </div>
                <button type="button" className="text-[11px] font-semibold text-[#0b6f63]">View all</button>
              </div>

              <div className="hidden grid-cols-[1.05fr_1.15fr_1fr_.85fr_auto] gap-4 border-b border-[#102c3d]/[0.06] bg-[#fafcfb] px-5 py-2.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#102c3d]/35 md:grid">
                <span>Learner</span><span>Programme</span><span>Next action</span><span>Owner</span><span>Status</span>
              </div>

              <div>
                {actionRows.slice(0, detailed ? 3 : 2).map((row) => (
                  <div key={row.learner} className="grid gap-3 border-b border-[#102c3d]/[0.06] px-4 py-4 last:border-b-0 sm:px-5 md:grid-cols-[1.05fr_1.15fr_1fr_.85fr_auto] md:items-center md:gap-4">
                    <div className="min-w-0">
                      <p className="truncate text-[12px] font-semibold">{row.learner}</p>
                      <p className="mt-1 text-[10px] text-[#102c3d]/40 md:hidden">{row.programme}</p>
                    </div>
                    <p className="hidden truncate text-[11px] text-[#102c3d]/54 md:block">{row.programme}</p>
                    <p className="text-[11px] font-medium text-[#102c3d]/68">{row.action}</p>
                    <p className="text-[10px] text-[#102c3d]/42 sm:text-[11px]">{row.owner}</p>
                    <span className={`w-fit rounded-md px-2 py-1 text-[10px] font-semibold ${row.tone}`}>{row.status}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProductSidebar() {
  return (
    <aside className="hidden border-r border-white/[0.08] bg-[#081e2c] px-3 py-5 lg:block" aria-label="Example platform navigation">
      <p className="px-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/28">Workspace</p>
      <div className="mt-3">
        {primaryNavigation.map((item, index) => (
          <div key={item} className={`relative flex min-h-9 items-center px-3 text-[11px] font-medium ${index === 0 ? "bg-white/[0.07] text-white" : "text-white/46"}`}>
            {index === 0 ? <span className="absolute inset-y-0 left-0 w-0.5 bg-[#c7f0e4]" aria-hidden="true" /> : null}
            {item}
          </div>
        ))}
      </div>
      <p className="mt-7 px-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/28">Administration</p>
      <div className="mt-3">
        {administrationNavigation.map((item) => <div key={item} className="flex min-h-9 items-center px-3 text-[11px] font-medium text-white/46">{item}</div>)}
      </div>
    </aside>
  );
}
