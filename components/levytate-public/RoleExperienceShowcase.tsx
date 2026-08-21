const roles = [
  {
    number: "01",
    role: "Employee",
    headline: "A clear apprenticeship journey.",
    copy: "Apply, understand what happens next and follow the apprenticeship journey without chasing HR or L&D.",
    modules: ["Home", "My Application", "My Apprenticeship"],
    section: "My application",
    title: "Application submitted",
    detail: "Your manager is reviewing your application.",
    status: "Awaiting manager review",
    statusStyle: "bg-[#fff1f3] text-[#a53b4f]",
    accent: "bg-[#d65b70]",
  },
  {
    number: "02",
    role: "Line Manager",
    headline: "Make decisions and support your team.",
    copy: "See only the people and actions relevant to you, with the context needed for a clear decision.",
    modules: ["Home", "Approvals", "My Team"],
    section: "Approvals",
    title: "Application ready to review",
    detail: "Review the employee case and record your decision.",
    status: "Decision required",
    statusStyle: "bg-[#fbf4df] text-[#725d20]",
    accent: "bg-[#c79b35]",
  },
  {
    number: "03",
    role: "Apprenticeship Lead",
    headline: "Run the programme from one operating view.",
    copy: "Manage applications, learners, providers and operational work across the employer workspace.",
    modules: ["Operations Centre", "Applications", "Learners", "Providers"],
    section: "Learner operations",
    title: "Progress review approaching",
    detail: "The owner and next action are visible in one place.",
    status: "Due soon",
    statusStyle: "bg-[#eaf7f2] text-[#0b6f63]",
    accent: "bg-[#159b8f]",
  },
] as const;

export function RoleExperienceShowcase() {
  return (
    <div className="overflow-hidden rounded-[20px] bg-[#0a2333] shadow-[0_24px_70px_rgba(9,31,45,0.16)] ring-1 ring-[#102c3d]/[0.10]">
      <div className="grid border-b border-white/[0.08] px-5 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:px-7">
        <div>
          <p className="text-[12px] font-semibold text-white">Role-based workspace</p>
          <p className="mt-1 text-[11px] text-white/[0.64]">One programme, deliberately different views</p>
        </div>
        <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.13em] text-[#c7f0e4]/[0.70] sm:mt-0">Access follows responsibility</p>
      </div>

      <div className="divide-y divide-white/[0.08]">
        {roles.map((role) => (
          <article key={role.role} className="grid min-w-0 bg-[#0a2333] lg:grid-cols-[minmax(280px,.72fr)_minmax(0,1.28fr)]">
            <div className="relative px-5 py-7 sm:px-7 lg:py-8">
              <span className={`absolute inset-y-0 left-0 w-0.5 ${role.accent}`} aria-hidden="true" />
              <div className="flex items-baseline justify-between gap-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#ff9eaa]">{role.role}</p>
                <span className="text-[11px] font-medium text-white/[0.28]" aria-hidden="true">{role.number}</span>
              </div>
              <h3 className="mt-3 max-w-md text-[24px] font-semibold leading-[1.16] tracking-[-0.025em] text-white sm:text-[28px]">{role.headline}</h3>
              <p className="mt-3 max-w-lg text-[15px] leading-6 text-white/[0.72]">{role.copy}</p>
            </div>

            <div className="border-t border-white/[0.08] bg-[#f4f7f6] p-4 text-[#102c3d] sm:p-5 lg:border-l lg:border-t-0">
              <div className="overflow-hidden rounded-[14px] bg-white ring-1 ring-[#102c3d]/[0.07]">
                <div className="flex gap-5 overflow-x-auto border-b border-[#102c3d]/[0.07] px-4 sm:px-5" aria-label={`${role.role} primary modules`}>
                  {role.modules.map((module, index) => (
                    <span key={module} className={`relative shrink-0 py-3.5 text-[11px] font-semibold ${index === 0 ? "text-[#102c3d]" : "text-[#102c3d]/[0.66]"}`}>
                      {module}
                      {index === 0 ? <span className="absolute inset-x-0 bottom-0 h-0.5 bg-[#159b8f]" aria-hidden="true" /> : null}
                    </span>
                  ))}
                </div>
                <div className="grid gap-4 px-4 py-4 sm:grid-cols-[minmax(0,1fr)_144px] sm:items-center sm:px-5">
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#102c3d]/[0.66]">{role.section}</p>
                    <p className="mt-2 text-[13px] font-semibold">{role.title}</p>
                    <p className="mt-1 text-[11px] leading-5 text-[#102c3d]/[0.66]">{role.detail}</p>
                  </div>
                  <span className={`w-fit rounded-md px-2.5 py-1.5 text-[10px] font-semibold sm:justify-self-end ${role.statusStyle}`}>{role.status}</span>
                </div>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
