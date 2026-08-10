const lifecycle = [
  { label: "Employee interest" },
  { label: "Application" },
  { label: "Approval", detail: "Manager → Apprenticeship Lead" },
  { label: "Enrolment" },
  { label: "Active learner" },
  { label: "Reviews & actions" },
  { label: "Progress & readiness" },
  { label: "Completion" },
] as const;

export function ApprenticeshipLifecycle() {
  return (
    <ol className="relative grid gap-0 pl-2 sm:grid-cols-2 sm:gap-y-8 sm:pl-0 lg:grid-cols-4 xl:grid-cols-8" aria-label="Connected apprenticeship lifecycle">
      <span className="absolute bottom-5 left-[21px] top-5 w-px bg-white/16 sm:hidden" aria-hidden="true" />
      <span className="absolute left-[6.25%] right-[6.25%] top-[19px] hidden h-px bg-white/16 xl:block" aria-hidden="true" />
      {lifecycle.map((step, index) => (
        <li key={step.label} className="relative grid min-h-[76px] grid-cols-[40px_minmax(0,1fr)] items-start gap-4 py-3 sm:min-h-0 sm:grid-cols-[40px_minmax(0,1fr)] sm:px-3 sm:py-0 xl:block xl:px-2 xl:text-center">
          <span className="relative z-10 grid h-10 w-10 place-items-center rounded-full border border-white/20 bg-[#102c3d] text-[11px] font-semibold text-[#c7f0e4] xl:mx-auto">
            {String(index + 1).padStart(2, "0")}
          </span>
          <span className="pt-1 xl:mt-4 xl:block xl:pt-0">
            <span className="block text-[13px] font-semibold leading-5 text-white/84">{step.label}</span>
            {"detail" in step ? <span className="mt-1 block text-[10px] leading-4 text-white/38">{step.detail}</span> : null}
          </span>
        </li>
      ))}
    </ol>
  );
}
