const trustPoints = [
  "Independent advice",
  "Provider-neutral guidance",
  "Funding clarity",
  "Employer-led planning",
];

export function TrustBandLocal() {
  return (
    <section className="container-px mx-auto max-w-7xl py-10">
      <div className="grid gap-3 rounded-2xl border border-ink/10 bg-white/32 p-4 shadow-soft md:grid-cols-4">
        {trustPoints.map((point) => (
          <div key={point} className="rounded-xl bg-cream/70 px-4 py-4 text-sm font-semibold text-ink/72">
            {point}
          </div>
        ))}
      </div>
    </section>
  );
}
