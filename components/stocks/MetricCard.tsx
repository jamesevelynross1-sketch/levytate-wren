export function MetricCard({
  label,
  value,
  detail,
  tone = "neutral",
}: {
  label: string;
  value: string;
  detail: string;
  tone?: "positive" | "warning" | "danger" | "neutral";
}) {
  const toneClass = {
    positive: "text-emerald-200",
    warning: "text-amber-200",
    danger: "text-red-200",
    neutral: "text-slate-100",
  }[tone];

  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4 shadow-[0_18px_48px_rgba(0,0,0,0.18)]">
      <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className={`mt-3 text-2xl font-semibold ${toneClass}`}>{value}</p>
      <p className="mt-2 text-sm text-slate-400">{detail}</p>
    </div>
  );
}
