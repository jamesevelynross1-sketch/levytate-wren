import type { NewsItem, StockSignal } from "./types";
import { normaliseSupabaseUrl, readRuntimeEnv } from "@/lib/server/levytate-supabase";

export async function persistDailyScan(signals: StockSignal[]) {
  const config = getSupabaseConfig();
  if (!config) {
    return { persisted: false, reason: "Supabase environment variables are not configured." };
  }

  const scannedAt = new Date().toISOString();
  await Promise.all([
    upsertRows(config, "stock_snapshots", signals.map((signal) => ({
      ticker: signal.ticker,
      snapshot_date: scannedAt.slice(0, 10),
      current_price: signal.currentPrice,
      daily_change_pct: signal.dailyChangePct,
      five_day_change_pct: signal.fiveDayChangePct,
      twenty_day_change_pct: signal.twentyDayChangePct,
      volume: signal.volume,
      average_volume: signal.averageVolume,
      volume_vs_average: signal.volumeVsAverage,
      volatility_score: signal.volatilityScore,
      trend_score: signal.trendScore,
      data_mode: signal.dataMode,
    }))),
    upsertRows(config, "signal_scores", signals.map((signal) => ({
      ticker: signal.ticker,
      scored_at: scannedAt,
      opportunity_score: signal.opportunityScore,
      signal: signal.signal,
      score_breakdown: signal.scoreBreakdown,
      risk_controls: signal.riskControls,
      sentiment_score: signal.sentimentScore,
      news_catalyst_score: signal.newsCatalystScore,
    }))),
    upsertRows(config, "news_items", signals.flatMap((signal) => signal.news.map((item) => mapNews(item)))),
  ]);

  return { persisted: true, reason: null };
}

function mapNews(item: NewsItem) {
  return {
    external_id: item.id,
    ticker: item.ticker,
    headline: item.headline,
    summary: item.summary,
    source: item.source,
    url: item.url,
    published_at: item.publishedAt,
    sentiment: item.sentiment,
    catalysts: item.catalysts,
  };
}

function getSupabaseConfig() {
  const url = normaliseSupabaseUrl(readRuntimeEnv("NEXT_PUBLIC_SUPABASE_URL"));
  const key = readRuntimeEnv("SUPABASE_SERVICE_ROLE_KEY");
  return url && key ? { url, key } : null;
}

async function upsertRows(config: { url: string; key: string }, table: string, rows: unknown[]) {
  if (rows.length === 0) return;
  const response = await fetch(`${config.url}/rest/v1/${table}`, {
    method: "POST",
    headers: {
      apikey: config.key,
      Authorization: `Bearer ${config.key}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify(rows),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Supabase ${table} upsert failed: ${detail}`);
  }
}
