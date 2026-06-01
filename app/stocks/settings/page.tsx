const envRows = [
  ["Finnhub", "FINNHUB_API_KEY", "Quotes, company news and market data"],
  ["Alpha Vantage", "ALPHA_VANTAGE_API_KEY", "Technical history, indicators and sentiment support"],
  ["Polygon.io", "POLYGON_API_KEY", "Optional later market data provider"],
  ["Supabase URL", "NEXT_PUBLIC_SUPABASE_URL", "Database REST endpoint"],
  ["Supabase service role", "SUPABASE_SERVICE_ROLE_KEY", "Server-side persistence for cron refreshes"],
  ["Cron secret", "CRON_SECRET", "Protects daily scan endpoint"],
] as const;

export default function SettingsPage() {
  return (
    <section className="rounded-lg border border-white/10 bg-white/[0.035] p-5">
      <h2 className="text-xl font-semibold text-white">Settings and API Keys</h2>
      <p className="mt-2 text-sm text-slate-400">Keys are read from Vercel environment variables and used only in server-side route handlers or server modules. They are never exposed to the browser.</p>
      <div className="mt-6 grid gap-3">
        {envRows.map(([provider, key, use]) => (
          <div key={key} className="grid gap-3 rounded-lg border border-white/10 bg-black/15 p-4 md:grid-cols-[180px_240px_1fr]">
            <p className="font-semibold text-white">{provider}</p>
            <code className="text-sm text-emerald-200">{key}</code>
            <p className="text-sm text-slate-400">{use}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
