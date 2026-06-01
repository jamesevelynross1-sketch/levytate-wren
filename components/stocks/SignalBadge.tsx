import type { Signal } from "@/lib/stocks/types";

const signalStyles: Record<Signal, string> = {
  "Strong Buy": "border-emerald-400/40 bg-emerald-400/15 text-emerald-200",
  Buy: "border-green-400/35 bg-green-400/12 text-green-200",
  Watch: "border-amber-400/40 bg-amber-400/15 text-amber-200",
  Avoid: "border-orange-400/40 bg-orange-400/15 text-orange-200",
  Sell: "border-red-400/45 bg-red-500/15 text-red-200",
};

export function SignalBadge({ signal }: { signal: Signal }) {
  return (
    <span className={`inline-flex min-w-20 justify-center rounded-full border px-2.5 py-1 text-xs font-semibold ${signalStyles[signal]}`}>
      {signal}
    </span>
  );
}
