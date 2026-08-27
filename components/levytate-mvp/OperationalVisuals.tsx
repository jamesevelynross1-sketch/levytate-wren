import { Check, Circle } from "lucide-react";
import type { CSSProperties } from "react";

export type OperationalTone = "neutral" | "risk" | "watch" | "healthy" | "info";

const toneStyles: Record<OperationalTone, { dot: string; text: string; surface: string; line: string }> = {
  neutral: { dot: "bg-[#71808a]", text: "text-[#102c3d]", surface: "bg-[#f5f7f3]", line: "bg-[#cfd8d3]" },
  risk: { dot: "bg-[#c95568]", text: "text-[#a7354a]", surface: "bg-[#fff0f2]", line: "bg-[#c95568]" },
  watch: { dot: "bg-[#d6a62d]", text: "text-[#765b00]", surface: "bg-[#fff8df]", line: "bg-[#d6a62d]" },
  healthy: { dot: "bg-[#159b8f]", text: "text-[#0b6f63]", surface: "bg-[#e9f7f2]", line: "bg-[#159b8f]" },
  info: { dot: "bg-[#4f7b95]", text: "text-[#315d78]", surface: "bg-[#eef5fa]", line: "bg-[#4f7b95]" },
};

export function OperationalMetricRail({ items }: { items: Array<{ label: string; value: string | number; tone?: OperationalTone; onClick?: () => void }> }) {
  return (
    <section aria-label="Operational status" className="overflow-hidden border-y border-[#102c3d]/[0.09] bg-white">
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-[repeat(auto-fit,minmax(130px,1fr))]">
        {items.map((item) => {
          const content = <><span className={`h-2 w-2 shrink-0 rounded-full ${toneStyles[item.tone ?? "neutral"].dot}`} aria-hidden="true" /><span><strong className="block text-2xl font-semibold tabular-nums tracking-[-0.035em] text-[#102c3d]">{item.value}</strong><span className="mt-0.5 block text-xs font-semibold leading-4 text-[#102c3d]/[0.60]">{item.label}</span></span></>;
          const className = "flex min-h-20 items-center gap-3 border-b border-r border-[#102c3d]/[0.07] px-4 py-3 text-left last:border-r-0 sm:min-h-24 xl:border-b-0";
          return item.onClick ? <button key={item.label} type="button" onClick={item.onClick} className={`${className} transition hover:bg-[#f8fbfa] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#159b8f]`}>{content}</button> : <div key={item.label} className={className}>{content}</div>;
        })}
      </div>
    </section>
  );
}

export function StageTracker({ stages, currentIndex, tone = "info", exceptionalStatus }: { stages: string[]; currentIndex: number; tone?: OperationalTone; exceptionalStatus?: { label: string; tone: "risk" | "watch" } }) {
  return (
    <div aria-label={`Current stage: ${exceptionalStatus?.label ?? stages[currentIndex]}`}>
      {exceptionalStatus ? <div className={`mb-3 inline-flex min-h-8 items-center gap-2 rounded-full px-3 text-xs font-semibold ${toneStyles[exceptionalStatus.tone].surface} ${toneStyles[exceptionalStatus.tone].text}`}><span className={`h-2 w-2 rounded-full ${toneStyles[exceptionalStatus.tone].dot}`} aria-hidden="true" />{exceptionalStatus.label}</div> : null}
      <ol className="grid gap-2 sm:grid-cols-[repeat(var(--stage-count),minmax(0,1fr))]" style={{ "--stage-count": stages.length } as CSSProperties}>
        {stages.map((stage, index) => {
          const complete = index < currentIndex;
          const current = index === currentIndex;
          return <li key={stage} className="relative flex min-h-11 items-center gap-3 sm:block sm:min-h-16">
            <div className="relative flex h-full items-center sm:h-auto">
              <span className={`relative z-10 grid h-7 w-7 shrink-0 place-items-center rounded-full text-[10px] font-semibold ring-4 ring-white ${complete ? "bg-[#159b8f] text-white" : current ? `${toneStyles[tone].surface} ${toneStyles[tone].text} ring-2 ring-offset-2 ring-offset-white ${tone === "watch" ? "ring-[#d6a62d]" : tone === "risk" ? "ring-[#c95568]" : "ring-[#4f7b95]"}` : "bg-[#edf1ef] text-[#102c3d]/[0.38]"}`}>{complete ? <Check size={13} aria-hidden="true" /> : current ? <Circle size={8} fill="currentColor" aria-hidden="true" /> : index + 1}</span>
              {index < stages.length - 1 ? <span className={`absolute left-3.5 top-7 h-[calc(100%+0.5rem)] w-px sm:left-7 sm:top-3.5 sm:h-px sm:w-[calc(100%-1.75rem)] ${index < currentIndex ? "bg-[#159b8f]" : "bg-[#dce3df]"}`} aria-hidden="true" /> : null}
            </div>
            <span className={`text-xs font-semibold sm:mt-2 sm:block ${complete ? "text-[#0b6f63]" : current ? "text-[#102c3d]" : "text-[#102c3d]/[0.42]"}`}>{stage}</span>
          </li>;
        })}
      </ol>
    </div>
  );
}

export function ProgressTrack({ actual, target, label = "Progress" }: { actual: number; target: number; label?: string }) {
  const safeActual = Math.min(100, Math.max(0, actual));
  const safeTarget = Math.min(100, Math.max(0, target));
  const tone: OperationalTone = actual + 2 < target ? "risk" : actual < target ? "watch" : "healthy";
  return (
    <div role="img" aria-label={`${label}: ${actual}% actual, ${target}% target`}>
      <div className="flex items-end justify-between gap-3"><span className="text-xs font-semibold text-[#102c3d]/[0.55]">{label}</span><span className={`text-sm font-semibold tabular-nums ${toneStyles[tone].text}`}>{actual}% <span className="font-normal text-[#102c3d]/[0.42]">/ {target}% target</span></span></div>
      <div className="relative mt-2 h-2.5 rounded-full bg-[#e7eeea]">
        <span className={`absolute inset-y-0 left-0 rounded-full ${toneStyles[tone].line}`} style={{ width: `${safeActual}%` }} />
        <span className="absolute -top-1 h-4 w-0.5 bg-[#102c3d]" style={{ left: `${safeTarget}%` }} aria-hidden="true" />
      </div>
    </div>
  );
}

export function SemanticStatus({ label, tone }: { label: string; tone: OperationalTone }) {
  return <span className={`inline-flex items-center gap-2 text-xs font-semibold ${toneStyles[tone].text}`}><span className={`h-2 w-2 rounded-full ${toneStyles[tone].dot}`} aria-hidden="true" />{label}</span>;
}
