import type { StockSignal } from "@/lib/stocks/types";

export function ProviderStatusBadge({ signal }: { signal: Pick<StockSignal, "providerStatus" | "dataSource" | "apiError"> }) {
  const tone = {
    finnhub: "border-emerald-400/40 bg-emerald-400/15 text-emerald-100",
    alpha_vantage: "border-amber-300/45 bg-amber-300/15 text-amber-100",
    cache: "border-orange-300/45 bg-orange-300/15 text-orange-100",
    mock: "border-red-400/45 bg-red-400/15 text-red-100",
    api_error: "border-red-300/50 bg-red-300/15 text-red-100",
  }[signal.dataSource];

  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${tone}`}>
        {signal.providerStatus}
      </span>
      {signal.apiError ? (
        <span className="inline-flex items-center rounded-full border border-red-300/50 bg-red-300/15 px-2.5 py-1 text-xs font-semibold text-red-100">
          ⚠ API Error
        </span>
      ) : null}
    </span>
  );
}

export function SourceSummary({ signals }: { signals: Array<Pick<StockSignal, "dataSource" | "apiError">> }) {
  const hasMock = signals.some((signal) => signal.dataSource === "mock");
  const hasCache = signals.some((signal) => signal.dataSource === "cache");
  const hasErrors = signals.some((signal) => signal.apiError);
  const hasLive = signals.some((signal) => signal.dataSource === "finnhub" || signal.dataSource === "alpha_vantage");

  if (hasMock) {
    return (
      <div className="rounded-lg border border-red-400/35 bg-red-500/10 px-4 py-3 text-sm font-medium text-red-100">
        Using mock market data — prices are NOT live.
      </div>
    );
  }

  if (hasCache) {
    return (
      <div className="rounded-lg border border-orange-300/35 bg-orange-300/10 px-4 py-3 text-sm font-medium text-orange-100">
        Using cached last successful market snapshot. Live provider refresh failed or is temporarily unavailable.
      </div>
    );
  }

  if (hasErrors) {
    return (
      <div className="rounded-lg border border-red-300/35 bg-red-300/10 px-4 py-3 text-sm font-medium text-red-100">
        API error detected. Check provider logs before relying on this scan.
      </div>
    );
  }

  if (hasLive) {
    return (
      <div className="rounded-lg border border-emerald-300/30 bg-emerald-300/10 px-4 py-3 text-sm font-medium text-emerald-100">
        Live market data active.
      </div>
    );
  }

  return null;
}
