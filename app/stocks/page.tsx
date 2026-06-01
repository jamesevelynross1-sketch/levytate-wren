import Link from "next/link";
import { MetricCard } from "@/components/stocks/MetricCard";
import { ProviderStatusBadge, SourceSummary } from "@/components/stocks/ProviderStatusBadge";
import { SignalTable } from "@/components/stocks/SignalTable";
import { getStockSignals, validateMarketDataEnv } from "@/lib/stocks/market-data";

export const dynamic = "force-dynamic";

export default async function StocksDashboardPage() {
  const env = validateMarketDataEnv();
  const signals = await getStockSignals();
  const top = signals[0];
  const buys = signals.filter((stock) => stock.signal === "Strong Buy" || stock.signal === "Buy").length;
  const riskFlags = signals.filter((stock) => stock.riskControls.doNotBuyWarning).length;
  const dataMode = getDataModeLabel(signals);

  return (
    <div className="space-y-6">
      {!env.envDetected ? <LiveDataSetupCard /> : null}
      <SourceSummary signals={signals} />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Top opportunity" value={top ? `${top.ticker} ${top.opportunityScore}` : "No data"} detail={top ? `${top.signal} with ${formatVolumeRatio(top.volumeVsAverage)} volume confirmation` : "Add stocks to begin scanning."} tone="positive" />
        <MetricCard label="Buy candidates" value={String(buys)} detail="Strong Buy and Buy signals passing model threshold." tone="positive" />
        <MetricCard label="Risk flags" value={String(riskFlags)} detail="Extreme volatility or negative news warnings." tone={riskFlags ? "danger" : "neutral"} />
        <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4 shadow-[0_18px_48px_rgba(0,0,0,0.18)]">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Provider status</p>
          <div className="mt-3">{top ? <ProviderStatusBadge signal={top} /> : null}</div>
          <p className="mt-3 text-2xl font-semibold text-slate-100">{dataMode}</p>
          <p className="mt-2 text-sm text-slate-400">Displayed prices trace to the provider badge on each row.</p>
        </div>
      </div>

      <section className="rounded-lg border border-white/10 bg-white/[0.035] p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-white">Daily Performance Table</h2>
            <p className="mt-2 text-sm text-slate-400">Weighted opportunity score: momentum 25%, volume 15%, sentiment 20%, market trend 15%, relative strength 15%, volatility control 10%.</p>
          </div>
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Updated {new Date().toLocaleString("en-GB")}</p>
        </div>
        <div className="mt-5">
          <SignalTable signals={signals} />
        </div>
      </section>
    </div>
  );
}

function LiveDataSetupCard() {
  return (
    <section className="rounded-lg border border-amber-300/35 bg-amber-300/10 p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-200">Live data setup</p>
      <h2 className="mt-3 text-xl font-semibold text-white">Live data not connected</h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-amber-50/85">
        Add FINNHUB_API_KEY or ALPHA_VANTAGE_API_KEY to .env.local, then restart the dev server.
      </p>
      <Link
        href="/stocks/settings"
        className="mt-4 inline-flex rounded-md border border-amber-200/40 bg-amber-200/10 px-4 py-2 text-sm font-semibold text-amber-50 transition hover:bg-amber-200/20"
      >
        Live data requires API keys
      </Link>
    </section>
  );
}

function getDataModeLabel(signals: Awaited<ReturnType<typeof getStockSignals>>) {
  if (signals.some((stock) => stock.dataSource === "mock")) return "Mock Data";
  if (signals.some((stock) => stock.dataSource === "cache")) return "Cached Snapshot";
  if (signals.every((stock) => stock.dataSource === "finnhub")) return "Finnhub";
  if (signals.every((stock) => stock.dataSource === "alpha_vantage")) return "Alpha Vantage";
  return "Mixed Live";
}

function formatVolumeRatio(value: number | null) {
  return value === null ? "N/A" : `${value.toFixed(2)}x`;
}
