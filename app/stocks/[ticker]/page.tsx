import Link from "next/link";
import { notFound } from "next/navigation";
import { MetricCard } from "@/components/stocks/MetricCard";
import { ProviderStatusBadge, SourceSummary } from "@/components/stocks/ProviderStatusBadge";
import { SignalBadge } from "@/components/stocks/SignalBadge";
import { getSignalByTicker } from "@/lib/stocks/market-data";

export const dynamic = "force-dynamic";

export default async function StockDetailPage({ params }: { params: Promise<{ ticker: string }> }) {
  const { ticker } = await params;
  const stock = await getSignalByTicker(ticker);
  if (!stock) notFound();

  return (
    <div className="space-y-6">
      <SourceSummary signals={[stock]} />
      <Link href="/stocks" className="text-sm text-slate-400 transition hover:text-white">Back to overview</Link>
      <div className="flex flex-col gap-4 rounded-lg border border-white/10 bg-white/[0.035] p-5 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.18em] text-slate-500">{stock.sector}</p>
          <h2 className="mt-2 text-3xl font-semibold text-white">{stock.ticker} · {stock.name}</h2>
          <p className="mt-3 text-slate-400">Current price ${stock.currentPrice.toFixed(2)} with {formatPercent(stock.fiveDayChangePct)} 5-day momentum and {stock.relativeStrengthVsSpy.toFixed(1)}% relative strength versus SPY.</p>
        </div>
        <div className="flex items-center gap-3">
          <ProviderStatusBadge signal={stock} />
          <p className="text-4xl font-semibold text-white">{stock.opportunityScore}</p>
          <SignalBadge signal={stock.signal} />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Position size" value={`${stock.riskControls.suggestedPositionSizePct}%`} detail="Suggested maximum single trade allocation." tone="positive" />
        <MetricCard label="Stop loss" value={`$${stock.riskControls.stopLoss}`} detail="Modelled technical/risk stop." tone="danger" />
        <MetricCard label="Take profit" value={`$${stock.riskControls.takeProfitLow}-$${stock.riskControls.takeProfitHigh}`} detail={`${stock.riskControls.riskRewardRatio}:1 risk/reward to lower target.`} tone="positive" />
        <MetricCard label="Volatility" value={`${stock.volatilityScore}/100`} detail={stock.riskControls.doNotBuyWarning ?? "Within modelled risk control range."} tone={stock.riskControls.doNotBuyWarning ? "danger" : "neutral"} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
        <section className="rounded-lg border border-white/10 bg-white/[0.035] p-5">
          <h3 className="text-lg font-semibold text-white">Score Breakdown</h3>
          <div className="mt-5 space-y-4">
            {Object.entries(stock.scoreBreakdown).map(([label, value]) => (
              <div key={label}>
                <div className="mb-2 flex justify-between text-sm">
                  <span className="capitalize text-slate-300">{label.replace(/([A-Z])/g, " $1")}</span>
                  <span className="text-white">{value}/100</span>
                </div>
                <div className="h-2 rounded-full bg-white/10">
                  <div className="h-2 rounded-full bg-emerald-300" style={{ width: `${value}%` }} />
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-white/10 bg-white/[0.035] p-5">
          <h3 className="text-lg font-semibold text-white">Top News and Catalysts</h3>
          <div className="mt-5 space-y-4">
            {stock.news.slice(0, 3).map((item) => (
              <article key={item.id} className="rounded-lg border border-white/10 bg-black/15 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-white">{item.headline}</p>
                  <span className={item.sentiment === "positive" ? "text-emerald-300" : item.sentiment === "negative" ? "text-red-300" : "text-slate-400"}>{item.sentiment}</span>
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-400">{item.summary}</p>
                <p className="mt-3 text-xs uppercase tracking-[0.14em] text-slate-500">{item.catalysts.join(", ") || "market"}</p>
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function formatPercent(value: number | null) {
  return value === null ? "N/A" : `${value.toFixed(2)}%`;
}
