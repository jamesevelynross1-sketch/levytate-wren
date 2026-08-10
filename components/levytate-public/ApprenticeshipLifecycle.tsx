const lifecycle = [
  "Employee interest",
  "Application",
  "Manager approval",
  "Apprenticeship Lead approval",
  "Enrolment",
  "Active learner",
  "Reviews and actions",
  "Progress and readiness",
  "Completion",
] as const;

export function ApprenticeshipLifecycle() {
  return (
    <ol className="grid gap-2 sm:grid-cols-3" aria-label="Connected apprenticeship lifecycle">
      {lifecycle.map((step, index) => (
        <li key={step} className="group flex min-h-[5.5rem] items-center gap-4 rounded-[1.15rem] border border-white/10 bg-white/[0.055] p-4">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#c7f0e4] text-xs font-semibold text-[#102c3d]">{String(index + 1).padStart(2, "0")}</span>
          <span className="text-sm font-semibold leading-5 text-white/82">{step}</span>
        </li>
      ))}
    </ol>
  );
}
