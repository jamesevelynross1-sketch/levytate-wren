const roles = [
  {
    role: "Employee",
    headline: "A clear apprenticeship journey.",
    copy: "Employees can apply, understand what happens next and follow their apprenticeship journey without chasing HR or L&D.",
    modules: ["Home", "My Application", "My Apprenticeship"],
    eyebrow: "My application",
    title: "Application submitted",
    detail: "Your manager is reviewing your application.",
    status: "Awaiting manager review",
    tone: "coral",
  },
  {
    role: "Line Manager",
    headline: "Make decisions and support your team.",
    copy: "Managers see only the people and actions relevant to them, making approval and learner support easier to manage.",
    modules: ["Home", "Approvals", "My Team"],
    eyebrow: "Approvals",
    title: "Application ready to review",
    detail: "Review the employee case and record your decision.",
    status: "Decision required",
    tone: "yellow",
  },
  {
    role: "Apprenticeship Lead",
    headline: "Run the programme from one Operations Centre.",
    copy: "Give apprenticeship teams one place to manage applications, learners, providers and operational work across the organisation.",
    modules: ["Operations Centre", "Applications", "Learners", "Providers"],
    eyebrow: "Learner operations",
    title: "Review approaching",
    detail: "The owner and next action are visible in one place.",
    status: "Due soon",
    tone: "mint",
  },
] as const;

const statusTone = {
  coral: "bg-[#fff0f2] text-[#b13b51]",
  yellow: "bg-[#fff8dc] text-[#755e00]",
  mint: "bg-[#eaf7f2] text-[#0b6f63]",
} as const;

export function RoleExperienceShowcase() {
  return (
    <div className="grid gap-5 lg:grid-cols-3">
      {roles.map((role, index) => (
        <article key={role.role} className="flex min-w-0 flex-col overflow-hidden rounded-[1.6rem] border border-[#102c3d]/[0.08] bg-white shadow-[0_18px_55px_rgba(16,44,61,0.06)]">
          <div className="p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[#c95568]">{role.role}</p>
              <span className="text-xs font-semibold text-[#102c3d]/30">0{index + 1}</span>
            </div>
            <h3 className="mt-4 text-2xl font-semibold leading-[1.15] tracking-[-0.025em]">{role.headline}</h3>
            <p className="mt-3 text-sm leading-6 text-[#102c3d]/60">{role.copy}</p>
          </div>

          <div className="mt-auto bg-[#102c3d] p-3 text-white sm:p-4">
            <div className="flex gap-1.5 overflow-hidden pb-3" aria-label={`${role.role} primary modules`}>
              {role.modules.map((module, moduleIndex) => (
                <span key={module} className={moduleIndex === 0 ? "whitespace-nowrap rounded-lg bg-white/12 px-2.5 py-2 text-[10px] font-semibold text-white" : "whitespace-nowrap rounded-lg px-2.5 py-2 text-[10px] font-semibold text-white/45"}>{module}</span>
              ))}
            </div>
            <div className="rounded-[1.05rem] bg-white p-4 text-[#102c3d]">
              <div className="flex items-start justify-between gap-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-[#102c3d]/40">{role.eyebrow}</p>
                <span className={`rounded-full px-2.5 py-1 text-[9px] font-semibold ${statusTone[role.tone]}`}>{role.status}</span>
              </div>
              <p className="mt-4 text-sm font-semibold">{role.title}</p>
              <p className="mt-1.5 text-xs leading-5 text-[#102c3d]/52">{role.detail}</p>
              <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-[#edf2f0]">
                <div className="h-full w-[62%] rounded-full bg-[#159b8f]" />
              </div>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
