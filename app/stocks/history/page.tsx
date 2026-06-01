import { SignalBadge } from "@/components/stocks/SignalBadge";
import { getStockSignals } from "@/lib/stocks/market-data";

export const dynamic = "force-dynamic";

export default async function HistoryPage() {
  const signals = await getStockSignals();

  return (
    <section className="rounded-lg border border-white/10 bg-white/[0.035] p-5">
      <h2 className="text-xl font-semibold text-white">Signal History</h2>
      <p className="mt-2 text-sm text-slate-400">Daily scans are stored in Supabase `signal_scores`. Mock history below reflects the latest scan payload until live persistence is connected.</p>
      <div className="mt-6 overflow-x-auto">
        <table className="min-w-[760px] w-full text-left text-sm">
          <thead className="border-b border-white/10 text-xs uppercase tracking-[0.16em] text-slate-500">
            <tr>
              <th className="py-3 pr-4">Date</th>
              <th className="py-3 pr-4">Ticker</th>
              <th className="py-3 pr-4">Score</th>
              <th className="py-3 pr-4">Signal</th>
              <th className="py-3 pr-4">Drivers</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {signals.map((stock) => (
              <tr key={stock.ticker}>
                <td className="py-4 pr-4 text-slate-400">{new Date(stock.lastUpdated).toLocaleDateString("en-GB")}</td>
                <td className="py-4 pr-4 font-semibold text-white">{stock.ticker}</td>
                <td className="py-4 pr-4 text-white">{stock.opportunityScore}</td>
                <td className="py-4 pr-4"><SignalBadge signal={stock.signal} /></td>
                <td className="py-4 pr-4 text-slate-400">Trend {stock.trendScore}, sentiment {stock.sentimentScore}, volume {formatVolumeRatio(stock.volumeVsAverage)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function formatVolumeRatio(value: number | null) {
  return value === null ? "N/A" : `${value.toFixed(2)}x`;
}
