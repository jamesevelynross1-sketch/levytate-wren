import { getWatchlist } from "@/lib/stocks/market-data";

export default function WatchlistPage() {
  const watchlist = getWatchlist();

  return (
    <section className="rounded-lg border border-white/10 bg-white/[0.035] p-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white">Watchlist Manager</h2>
          <p className="mt-2 text-sm text-slate-400">First version ships with a server-managed default watchlist. Persisted add/remove actions are ready for the Supabase watchlist table.</p>
        </div>
        <button className="rounded-md border border-emerald-300/30 bg-emerald-300/10 px-4 py-2 text-sm font-semibold text-emerald-100">Add ticker</button>
      </div>
      <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {watchlist.map((item) => (
          <div key={item.ticker} className="rounded-lg border border-white/10 bg-black/15 p-4">
            <div className="flex items-center justify-between">
              <p className="text-lg font-semibold text-white">{item.ticker}</p>
              <span className="rounded-full border border-white/10 px-2 py-1 text-xs text-slate-400">{item.exchange}</span>
            </div>
            <p className="mt-2 text-sm text-slate-300">{item.name}</p>
            <p className="mt-1 text-xs text-slate-500">{item.sector}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
