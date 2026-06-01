const principles = [
  {
    title: "Employer-first lens",
    copy: "Advice starts with workforce priorities, role requirements and the decisions leaders need to make.",
  },
  {
    title: "Provider-neutral judgement",
    copy: "Options are compared on fit, quality, delivery model and commercial practicality.",
  },
  {
    title: "Funding clarity",
    copy: "Levy, co-investment and funded pathways are translated into usable choices for employers.",
  },
];

export function TrustBand() {
  return (
    <section className="container-px mx-auto max-w-7xl py-14">
      <div className="border-y border-ink/10 py-10">
        <div className="grid gap-9 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
          <div>
            <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.22em] text-teal">
              Advisory principles
            </p>
            <h2 className="display-heading max-w-xl text-3xl leading-tight text-ink text-balance md:text-4xl">
              Independent advice for better apprenticeship decisions.
            </h2>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {principles.map((principle) => (
              <article key={principle.title}>
                <h3 className="text-base font-semibold leading-snug text-ink">
                  {principle.title}
                </h3>
                <p className="mt-3 text-sm leading-7 text-ink/64">
                  {principle.copy}
                </p>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
