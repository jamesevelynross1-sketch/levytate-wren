const summaryItems = [
  { label: "Needs attention", value: "4", tone: "coral" },
  { label: "Ready to enrol", value: "2", tone: "mint" },
  { label: "Reviews due", value: "3", tone: "yellow" },
  { label: "Active learners", value: "18", tone: "blue" },
] as const;

const actionRows = [
  {
    learner: "Jordan Ellis",
    programme: "Operations Departmental Manager",
    action: "Manager review due",
    owner: "Line Manager",
    status: "Due today",
    tone: "coral",
  },
  {
    learner: "Maya Patel",
    programme: "Data Technician",
    action: "Enrolment details ready",
    owner: "Apprenticeship Lead",
    status: "Ready",
    tone: "mint",
  },
  {
    learner: "Sam Carter",
    programme: "Improvement Practitioner",
    action: "Progress review approaching",
    owner: "Provider",
    status: "Due soon",
    tone: "yellow",
  },
] as const;

const toneClasses = {
  coral: "bg-[#fff0f2] text-[#b13b51] ring-[#e77487]/20",
  mint: "bg-[#eaf7f2] text-[#0b6f63] ring-[#159b8f]/20",
  yellow: "bg-[#fff8dc] text-[#755e00] ring-[#d6b83f]/25",
  blue: "bg-[#edf4fb] text-[#285f86] ring-[#5a8faf]/20",
} as const;

export function OperationsCentrePreview({ detailed = false }: { detailed?: boolean }) {
  return (
    <div className="min-w-0 overflow-hidden rounded-[1.6rem] border border-white/10 bg-[#0c2637] text-white shadow-[0_34px_100px_rgba(5,24,35,0.28)]">
      <div className="flex min-h-[3.7rem] items-center justify-between gap-4 border-b border-white/10 px-4 sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-[#ff8090] text-xs font-black text-[#102c3d]">LT</div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">Operations Centre</p>
            <p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-[#c7f0e4]/70">Illustrative workspace</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden rounded-full bg-white/[0.07] px-3 py-1.5 text-[10px] font-semibold text-white/65 sm:inline">Apprenticeship Lead</span>
          <span className="h-8 w-8 rounded-full bg-[#c7f0e4] ring-2 ring-white/10" aria-hidden="true" />
        </div>
      </div>

      <div className={detailed ? "grid min-w-0 lg:grid-cols-[12rem_minmax(0,1fr)]" : "min-w-0"}>
        {detailed ? (
          <aside className="hidden border-r border-white/10 bg-[#091f2e] p-4 lg:block" aria-label="Example platform navigation">
            <p className="px-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/35">Primary</p>
            <div className="mt-3 grid gap-1 text-xs font-semibold">
              {[
                "Operations Centre",
                "Applications",
                "Learners",
                "Providers",
              ].map((item, index) => (
                <div key={item} className={index === 0 ? "rounded-xl bg-white/10 px-3 py-2.5 text-white" : "rounded-xl px-3 py-2.5 text-white/52"}>{item}</div>
              ))}
            </div>
            <p className="mt-6 px-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/35">Administration</p>
            <div className="mt-3 grid gap-1 text-xs font-semibold text-white/52">
              {['People', 'Programmes', 'Settings'].map((item) => <div key={item} className="rounded-xl px-3 py-2.5">{item}</div>)}
            </div>
          </aside>
        ) : null}

        <div className="min-w-0 bg-[#f6f9f8] p-3 text-[#102c3d] sm:p-4">
          <div className="flex flex-col gap-3 rounded-[1.1rem] bg-white p-4 ring-1 ring-[#102c3d]/[0.07] sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#c95568]">Daily learner operations</p>
              <h3 className="mt-1.5 text-lg font-semibold tracking-[-0.02em] sm:text-xl">What needs attention today</h3>
            </div>
            <span className="w-fit rounded-full bg-[#edf7f3] px-3 py-2 text-[10px] font-semibold text-[#0b6f63]">Example view</span>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {summaryItems.map((item) => (
              <div key={item.label} className="min-w-0 rounded-[1rem] bg-white p-3 ring-1 ring-[#102c3d]/[0.06]">
                <div className="flex items-center justify-between gap-2">
                  <span className={`h-2 w-2 shrink-0 rounded-full ring-4 ${toneClasses[item.tone]}`} />
                  <span className="text-xl font-semibold tracking-[-0.03em]">{item.value}</span>
                </div>
                <p className="mt-3 text-[10px] font-semibold leading-4 text-[#102c3d]/55 sm:text-[11px]">{item.label}</p>
              </div>
            ))}
          </div>

          <div className="mt-3 overflow-hidden rounded-[1.1rem] bg-white ring-1 ring-[#102c3d]/[0.07]">
            <div className="flex items-center justify-between gap-3 border-b border-[#102c3d]/[0.06] px-4 py-3">
              <div>
                <p className="text-xs font-semibold">Priority actions</p>
                <p className="mt-0.5 text-[10px] text-[#102c3d]/45">Ownership stays connected to the source workflow</p>
              </div>
              <span className="rounded-lg bg-[#f3f7f5] px-2.5 py-1.5 text-[10px] font-semibold text-[#102c3d]/55">All actions</span>
            </div>
            <div>
              {actionRows.slice(0, detailed ? 3 : 2).map((row) => (
                <div key={row.learner} className="grid gap-3 border-b border-[#102c3d]/[0.055] px-4 py-3 last:border-b-0 sm:grid-cols-[minmax(0,1.2fr)_minmax(7rem,0.65fr)_auto] sm:items-center">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold">{row.learner}</p>
                    <p className="mt-1 truncate text-[10px] text-[#102c3d]/48">{row.programme}</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold text-[#102c3d]/72">{row.action}</p>
                    <p className="mt-1 text-[10px] text-[#102c3d]/42">Owner: {row.owner}</p>
                  </div>
                  <span className={`w-fit rounded-full px-2.5 py-1.5 text-[10px] font-semibold ring-1 ${toneClasses[row.tone]}`}>{row.status}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
