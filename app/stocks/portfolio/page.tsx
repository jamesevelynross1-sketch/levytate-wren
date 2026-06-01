import { MetricCard } from "@/components/stocks/MetricCard";
import { mockHoldings } from "@/lib/stocks/mock-data";
import { getStockSignals } from "@/lib/stocks/market-data";
import { buildPortfolioRecommendation } from "@/lib/stocks/scoring";

export const dynamic = "force-dynamic";

export default async function PortfolioPage() {
  const signals = await getStockSignals();
  const settings = {
    startingCapital: 25000,
    riskTolerance: "balanced" as const,
    maxPctPerTrade: 8,
    maxOpenPositions: 6,
  };
  const recommendation = buildPortfolioRecommendation(signals, mockHoldings, settings);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Starting capital" value={`$${settings.startingCapital.toLocaleString()}`} detail="Editable through user settings in the persisted version." />
        <MetricCard label="Risk tolerance" value="Balanced" detail={`${settings.maxPctPerTrade}% max per trade, ${settings.maxOpenPositions} open positions.`} />
        <MetricCard label="Recommended cash" value={`${recommendation.cashPercentage}%`} detail="Residual after top candidate allocations." tone="warning" />
        <MetricCard label="Open holdings" value={String(mockHoldings.length)} detail="Sell, trim and hold checks are signal-driven." />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-lg border border-white/10 bg-white/[0.035] p-5">
          <h2 className="text-xl font-semibold text-white">Top 5 Candidates to Consider</h2>
          <div className="mt-5 space-y-3">
            {recommendation.topCandidates.map((candidate) => (
              <div key={candidate.ticker} className="rounded-lg border border-white/10 bg-black/15 p-4">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-white">{candidate.ticker} · {candidate.signal}</p>
                  <p className="text-emerald-300">{candidate.suggestedAllocationPct}%</p>
                </div>
                <p className="mt-2 text-sm text-slate-400">{candidate.reason}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-white/10 bg-white/[0.035] p-5">
          <h2 className="text-xl font-semibold text-white">Current Holdings</h2>
          <div className="mt-5 space-y-3">
            {recommendation.holdingActions.map((holding) => (
              <div key={holding.ticker} className="rounded-lg border border-white/10 bg-black/15 p-4">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-white">{holding.ticker}</p>
                  <p className={holding.action === "Sell" ? "text-red-300" : holding.action === "Trim" ? "text-amber-300" : "text-emerald-300"}>{holding.action}</p>
                </div>
                <p className="mt-2 text-sm text-slate-400">{holding.reason}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
