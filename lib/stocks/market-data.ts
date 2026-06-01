import { defaultWatchlist, getMockNews, getMockSignals } from "./mock-data";
import { classifyNews, getSignal, scoreWeights } from "./scoring";
import type { MarketDataSource, NewsItem, StockSignal, WatchlistItem } from "./types";

const QUOTE_CACHE_TTL_MS = 60_000;

type FinnhubQuote = {
  c?: number;
  d?: number;
  dp?: number;
  h?: number;
  l?: number;
  o?: number;
  pc?: number;
};

type FinnhubCandleResponse = {
  c?: number[];
  h?: number[];
  l?: number[];
  o?: number[];
  s?: string;
  t?: number[];
  v?: number[];
};

type FinnhubNews = {
  id?: number;
  datetime?: number;
  headline?: string;
  summary?: string;
  source?: string;
  url?: string;
};

type AlphaGlobalQuote = {
  "05. price"?: string;
  "09. change"?: string;
  "10. change percent"?: string;
  "06. volume"?: string;
  "08. previous close"?: string;
};

type AlphaTimeSeries = Record<string, { "4. close"?: string; "5. volume"?: string }>;

type ProviderName = "Finnhub" | "Alpha Vantage";

type QuoteResult = {
  ticker: string;
  price: number;
  change: number;
  changePct: number;
  dayHigh: number | null;
  dayLow: number | null;
  open: number | null;
  previousClose: number;
  volume: number;
  provider: ProviderName;
  source: Exclude<MarketDataSource, "mock" | "api_error">;
  fetchedAt: string;
  apiError: string | null;
};

type CachedQuote = QuoteResult & {
  cachedAtMs: number;
};

type ProviderError = {
  provider: ProviderName;
  message: string;
};

type DebugLiveQuote = {
  symbol: string;
  provider: ProviderName | "Mock";
  price: number | null;
  change: number | null;
  percentChange: number | null;
  rawResponse: unknown;
  envDetected: boolean;
};

type DebugHistory = {
  symbol: string;
  provider: "Finnhub";
  candlesReturned: number;
  latestClose: number | null;
  close5D: number | null;
  close20D: number | null;
  oneDayPercent: number | null;
  fiveDayPercent: number | null;
  twentyDayPercent: number | null;
  latestVolume: number | null;
  average20DVolume: number | null;
  volumeRatio: number | null;
};

type DailyCandle = {
  date: string;
  close: number;
  volume: number | null;
  timestamp: number;
};

type HistoryMetrics = {
  candlesReturned: number;
  latestClose: number | null;
  close5D: number | null;
  close20D: number | null;
  oneDayPercent: number | null;
  fiveDayPercent: number | null;
  twentyDayPercent: number | null;
  latestVolume: number | null;
  average20DVolume: number | null;
  volumeRatio: number | null;
};

const globalQuoteCache = globalThis as typeof globalThis & {
  __mprStockQuoteCache?: Map<string, CachedQuote>;
};

function quoteCache() {
  if (!globalQuoteCache.__mprStockQuoteCache) {
    globalQuoteCache.__mprStockQuoteCache = new Map<string, CachedQuote>();
  }

  return globalQuoteCache.__mprStockQuoteCache;
}

export function validateMarketDataEnv() {
  const hasFinnhub = isUsableProviderKey(process.env.FINNHUB_API_KEY, "your_finnhub_key_here");
  const hasAlphaVantage = isUsableProviderKey(process.env.ALPHA_VANTAGE_API_KEY, "your_alpha_vantage_key_here");

  if (hasFinnhub) {
    console.log("[STOCK DATA] FINNHUB KEY DETECTED");
  }

  if (hasAlphaVantage) {
    console.log("[STOCK DATA] ALPHA VANTAGE KEY DETECTED");
  }

  return {
    hasFinnhub,
    hasAlphaVantage,
    envDetected: hasFinnhub || hasAlphaVantage,
    missing: [
      hasFinnhub ? null : "FINNHUB_API_KEY",
      hasAlphaVantage ? null : "ALPHA_VANTAGE_API_KEY",
    ].filter(Boolean) as string[],
  };
}

export async function getStockSignals(tickers = defaultWatchlist.map((item) => item.ticker)) {
  const requestedTickers = tickers.filter((ticker) => ticker !== "SPY" && ticker !== "QQQ");
  const market = await getMarketReference();
  const rows = await Promise.all(
    requestedTickers.map(async (ticker) => {
      try {
        return await buildProviderSignal(ticker, market);
      } catch (error) {
        console.error("Stock signal build failed, using emergency mock row.", {
          ticker,
          error: error instanceof Error ? error.message : "Unknown stock data error",
        });
        console.log("[DATA SOURCE] Mock", ticker);
        return getMockSignals().find((stock) => stock.ticker === ticker) ?? null;
      }
    }),
  );

  return rows
    .filter((row): row is StockSignal => Boolean(row))
    .sort((a, b) => b.opportunityScore - a.opportunityScore);
}

export async function getSignalByTicker(ticker: string) {
  const rows = await getStockSignals([...defaultWatchlist.map((item) => item.ticker), ticker.toUpperCase()]);
  return rows.find((row) => row.ticker === ticker.toUpperCase()) ?? null;
}

export function getWatchlist(): WatchlistItem[] {
  return defaultWatchlist.filter((item) => item.ticker !== "SPY" && item.ticker !== "QQQ");
}

export async function getLiveQuoteForValidation(ticker: string) {
  return getQuote(ticker.toUpperCase(), { bypassFreshCache: true });
}

export async function getDebugLiveQuote(symbol: string): Promise<DebugLiveQuote> {
  const ticker = symbol.toUpperCase();
  const env = validateMarketDataEnv();
  console.log("[STOCK DATA] Fetching live quote for", ticker);

  if (env.hasFinnhub) {
    try {
      const rawResponse = await fetchProviderJson<FinnhubQuote>(
        "Finnhub",
        `https://finnhub.io/api/v1/quote?symbol=${ticker}&token=${process.env.FINNHUB_API_KEY}`,
      );
      const price = round(rawResponse.c);
      if (price) {
        console.log("[STOCK DATA] Provider used: Finnhub");
        return {
          symbol: ticker,
          provider: "Finnhub",
          price,
          change: round(rawResponse.d),
          percentChange: round(rawResponse.dp),
          rawResponse,
          envDetected: true,
        };
      }
      console.error("[STOCK DATA] Finnhub debug response had no usable price", {
        symbol: ticker,
        rawResponse,
      });
    } catch (error) {
      console.error("[STOCK DATA] Finnhub debug request failed", {
        symbol: ticker,
        error: getErrorMessage(error),
      });
    }
  }

  if (env.hasAlphaVantage) {
    try {
      const rawResponse = await fetchProviderJson<{ "Global Quote"?: AlphaGlobalQuote; Note?: string; "Error Message"?: string; Information?: string }>(
        "Alpha Vantage",
        `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${ticker}&apikey=${process.env.ALPHA_VANTAGE_API_KEY}`,
      );
      const quote = rawResponse["Global Quote"] ?? {};
      const price = round(quote["05. price"]);
      if (price) {
        console.log("[STOCK DATA] Provider used: Alpha Vantage");
        return {
          symbol: ticker,
          provider: "Alpha Vantage",
          price,
          change: round(quote["09. change"]),
          percentChange: round(String(quote["10. change percent"] ?? "").replace("%", "")),
          rawResponse,
          envDetected: true,
        };
      }
      console.error("[STOCK DATA] Alpha Vantage debug response had no usable price", {
        symbol: ticker,
        rawResponse,
      });
    } catch (error) {
      console.error("[STOCK DATA] Alpha Vantage debug request failed", {
        symbol: ticker,
        error: getErrorMessage(error),
      });
    }
  }

  console.log("[STOCK DATA] Provider used: Mock");
  return {
    symbol: ticker,
    provider: "Mock",
    price: null,
    change: null,
    percentChange: null,
    rawResponse: null,
    envDetected: env.envDetected,
  };
}

export async function getDebugHistory(symbol: string): Promise<DebugHistory> {
  const ticker = symbol.toUpperCase();
  const candles = await getFinnhubDailyCandles(ticker);
  const metrics = getHistoryMetrics(candles);

  return {
    symbol: ticker,
    provider: "Finnhub",
    candlesReturned: metrics.candlesReturned,
    latestClose: metrics.latestClose,
    close5D: metrics.close5D,
    close20D: metrics.close20D,
    oneDayPercent: metrics.oneDayPercent,
    fiveDayPercent: metrics.fiveDayPercent,
    twentyDayPercent: metrics.twentyDayPercent,
    latestVolume: metrics.latestVolume,
    average20DVolume: metrics.average20DVolume,
    volumeRatio: metrics.volumeRatio,
  };
}

async function buildProviderSignal(ticker: string, market: { spy: number; qqq: number }): Promise<StockSignal> {
  const mockRow = getMockSignals().find((stock) => stock.ticker === ticker);
  const quote = await getQuote(ticker);

  if (!quote && mockRow) {
    console.log("[DATA SOURCE] Mock", ticker);
    console.log("[STOCK DATA] Provider used: Mock");
    return {
      ...mockRow,
      lastUpdated: new Date().toISOString(),
      apiError: "Live providers and cached snapshots were unavailable.",
    };
  }

  if (!quote) {
    throw new Error(`No live, cached or mock data available for ${ticker}.`);
  }

  const item = defaultWatchlist.find((entry) => entry.ticker === ticker) ?? {
    ticker,
    name: ticker,
    sector: "Watchlist",
    exchange: "US",
    addedAt: new Date().toISOString(),
  };
  const currentPrice = quote.price;
  const history = await getDailyHistory(ticker);
  const previousClose = quote.previousClose || history[1]?.close || currentPrice;
  const dailyChangePct = quote.changePct || pct(currentPrice, previousClose);
  const historyMetrics = getHistoryMetrics(history, currentPrice, dailyChangePct);
  const news = await getNews(ticker);
  const fiveDayChangePct = historyMetrics.fiveDayPercent;
  const twentyDayChangePct = historyMetrics.twentyDayPercent;
  const volume = quote.volume || historyMetrics.latestVolume || 0;
  const averageVolume = historyMetrics.average20DVolume ?? 0;
  const volumeVsAverage = historyMetrics.volumeRatio;
  const dailyMoves = history.slice(0, 20).map((day, index) => (history[index + 1] ? Math.abs(pct(day.close, history[index + 1].close)) : 0));
  const realisedVol = avg(dailyMoves) || Math.abs(dailyChangePct);
  const volatilityScore = clamp(Math.round(realisedVol * 18));
  const momentum5 = fiveDayChangePct ?? 0;
  const momentum20 = twentyDayChangePct ?? 0;
  const trendScore = clamp(Math.round(50 + momentum5 * 3 + momentum20 * 1.5));
  const sentimentScore = getNewsSentimentScore(news);
  const newsCatalystScore = clamp(40 + news.flatMap((item) => item.catalysts).length * 10 + (sentimentScore - 50) * 0.4);
  const relativeStrengthVsSpy = Number((momentum5 - market.spy).toFixed(1));
  const relativeStrengthVsQqq = Number((momentum5 - market.qqq).toFixed(1));
  const scoreBreakdown = {
    priceMomentum: fiveDayChangePct === null || twentyDayChangePct === null
      ? 50
      : clamp(Math.round(50 + fiveDayChangePct * 3 + twentyDayChangePct * 1.8)),
    volumeConfirmation: volumeVsAverage === null ? 50 : clamp(Math.round(volumeVsAverage * 52)),
    newsSentiment: sentimentScore,
    marketTrendAlignment: trendScore,
    relativeStrength: clamp(Math.round(50 + (relativeStrengthVsSpy + relativeStrengthVsQqq) * 2)),
    riskVolatilityControl: clamp(100 - volatilityScore),
  };
  const opportunityScore = Math.round(
    scoreBreakdown.priceMomentum * scoreWeights.priceMomentum +
      scoreBreakdown.volumeConfirmation * scoreWeights.volumeConfirmation +
      scoreBreakdown.newsSentiment * scoreWeights.newsSentiment +
      scoreBreakdown.marketTrendAlignment * scoreWeights.marketTrendAlignment +
      scoreBreakdown.relativeStrength * scoreWeights.relativeStrength +
      scoreBreakdown.riskVolatilityControl * scoreWeights.riskVolatilityControl,
  );
  const signal = getSignal(opportunityScore);
  const stopLossPct = Math.min(0.16, Math.max(0.05, volatilityScore / 900));
  const stopLoss = Number((currentPrice * (1 - stopLossPct)).toFixed(2));
  const takeProfitLow = Number((currentPrice * (1 + Math.max(0.08, volatilityScore / 700))).toFixed(2));
  const takeProfitHigh = Number((currentPrice * (1 + Math.max(0.14, volatilityScore / 500))).toFixed(2));

  return {
    ticker,
    name: item.name,
    sector: item.sector,
    currentPrice,
    dailyChangePct,
    fiveDayChangePct,
    twentyDayChangePct,
    volume,
    averageVolume,
    volumeVsAverage,
    volatilityScore,
    trendScore,
    sentimentScore,
    newsCatalystScore,
    opportunityScore,
    signal,
    relativeStrengthVsSpy,
    relativeStrengthVsQqq,
    scoreBreakdown,
    riskControls: {
      suggestedPositionSizePct: volatilityScore > 80 ? 2 : opportunityScore > 80 ? 8 : opportunityScore > 65 ? 5 : 3,
      stopLoss,
      takeProfitLow,
      takeProfitHigh,
      riskRewardRatio: Number(((takeProfitLow - currentPrice) / Math.max(0.01, currentPrice - stopLoss)).toFixed(2)),
      maxPortfolioExposureWarning: opportunityScore > 75 ? "Keep single-name exposure below your configured cap." : null,
      doNotBuyWarning: volatilityScore > 88 || sentimentScore < 35 ? "Do not buy: volatility or news risk is elevated." : null,
    },
    news,
    lastUpdated: quote.fetchedAt,
    dataMode: quote.source === "cache" ? "cached" : "live",
    dataSource: quote.source,
    providerLabel: quote.source === "cache" ? "Cached Snapshot" : quote.provider,
    providerStatus: quote.source === "cache" ? "Cached Snapshot" : quote.provider === "Finnhub" ? "LIVE Finnhub Quote + Candles" : "LIVE Alpha Vantage",
    apiError: quote.apiError,
  };
}

async function getQuote(ticker: string, options: { bypassFreshCache?: boolean } = {}): Promise<QuoteResult | null> {
  const env = validateMarketDataEnv();
  if (env.missing.length > 0) {
    console.warn("Market data environment validation", {
      missing: env.missing,
      message: "Missing keys are skipped; fallback order is Finnhub, Alpha Vantage, cache, mock.",
    });
  }

  const cached = quoteCache().get(ticker);
  if (!options.bypassFreshCache && cached && Date.now() - cached.cachedAtMs <= QUOTE_CACHE_TTL_MS) {
    return {
      ...cached,
      source: cached.provider === "Finnhub" ? "finnhub" : "alpha_vantage",
      apiError: null,
    };
  }

  const errors: ProviderError[] = [];

  if (env.hasFinnhub) {
    try {
      console.log("[STOCK DATA] Fetching live quote for", ticker);
      const quote = await getFinnhubQuote(ticker);
      rememberQuote(ticker, quote);
      console.log("[DATA SOURCE] Finnhub", ticker);
      console.log("[STOCK DATA] Provider used: Finnhub");
      return quote;
    } catch (error) {
      errors.push({ provider: "Finnhub", message: getErrorMessage(error) });
    }
  }

  if (env.hasAlphaVantage) {
    try {
      console.log("[STOCK DATA] Fetching live quote for", ticker);
      const quote = await getAlphaVantageQuote(ticker);
      rememberQuote(ticker, quote);
      console.log("[DATA SOURCE] Alpha Vantage", ticker);
      console.log("[STOCK DATA] Provider used: Alpha Vantage");
      return quote;
    } catch (error) {
      errors.push({ provider: "Alpha Vantage", message: getErrorMessage(error) });
    }
  }

  if (cached) {
    console.log("[DATA SOURCE] Cache", ticker);
    console.log("[STOCK DATA] Provider used: Cache");
    return {
      ...cached,
      source: "cache",
      provider: cached.provider,
      fetchedAt: cached.fetchedAt,
      apiError: errors.map((error) => `${error.provider}: ${error.message}`).join("; ") || "Live providers unavailable; using last successful cached snapshot.",
    };
  }

  if (errors.length > 0) {
    console.warn("All live quote providers failed and no cache is available.", {
      ticker,
      errors,
    });
  }

  return null;
}

async function getFinnhubQuote(ticker: string): Promise<QuoteResult> {
  const data = await fetchProviderJson<FinnhubQuote>(
    "Finnhub",
    `https://finnhub.io/api/v1/quote?symbol=${ticker}&token=${process.env.FINNHUB_API_KEY}`,
  );
  const price = round(data.c);
  const previousClose = round(data.pc);

  if (!price || !previousClose) {
    throw new Error(`Finnhub returned an unusable quote for ${ticker}: ${JSON.stringify(redactQuote(data))}`);
  }

  return {
    ticker,
    price,
    change: round(data.d),
    changePct: round(data.dp),
    dayHigh: nullableRound(data.h),
    dayLow: nullableRound(data.l),
    open: nullableRound(data.o),
    previousClose,
    volume: 0,
    provider: "Finnhub",
    source: "finnhub",
    fetchedAt: new Date().toISOString(),
    apiError: null,
  };
}

async function getAlphaVantageQuote(ticker: string): Promise<QuoteResult> {
  const data = await fetchProviderJson<{ "Global Quote"?: AlphaGlobalQuote; Note?: string; "Error Message"?: string; Information?: string }>(
    "Alpha Vantage",
    `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${ticker}&apikey=${process.env.ALPHA_VANTAGE_API_KEY}`,
  );

  if (data.Note || data["Error Message"] || data.Information) {
    throw new Error(data.Note ?? data["Error Message"] ?? data.Information);
  }

  const quote = data["Global Quote"] ?? {};
  const price = round(quote["05. price"]);
  const change = round(quote["09. change"]);
  const changePct = round(String(quote["10. change percent"] ?? "").replace("%", ""));

  if (!price) {
    throw new Error(`Alpha Vantage returned an unusable quote for ${ticker}: ${JSON.stringify(quote)}`);
  }

  return {
    ticker,
    price,
    change,
    changePct,
    dayHigh: null,
    dayLow: null,
    open: null,
    previousClose: price - change,
    volume: Number(quote["06. volume"] ?? 0),
    provider: "Alpha Vantage",
    source: "alpha_vantage",
    fetchedAt: new Date().toISOString(),
    apiError: null,
  };
}

async function getDailyHistory(ticker: string): Promise<DailyCandle[]> {
  if (isUsableProviderKey(process.env.FINNHUB_API_KEY, "your_finnhub_key_here")) {
    try {
      return await getFinnhubDailyCandles(ticker);
    } catch (error) {
      console.warn("Finnhub candles unavailable; continuing with quote-only scoring.", {
        ticker,
        error: getErrorMessage(error),
      });
      return [];
    }
  }

  if (!isUsableProviderKey(process.env.ALPHA_VANTAGE_API_KEY, "your_alpha_vantage_key_here")) return [];

  try {
    const data = await fetchProviderJson<{ "Time Series (Daily)"?: AlphaTimeSeries; Note?: string; "Error Message"?: string; Information?: string }>(
      "Alpha Vantage",
      `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${ticker}&outputsize=compact&apikey=${process.env.ALPHA_VANTAGE_API_KEY}`,
    );

    if (data.Note || data["Error Message"] || data.Information) {
      throw new Error(data.Note ?? data["Error Message"] ?? data.Information);
    }

    return Object.entries(data["Time Series (Daily)"] ?? {})
      .map(([date, row]) => ({
        date,
        close: Number(row["4. close"] ?? 0),
        volume: Number(row["5. volume"] ?? 0) || null,
        timestamp: Math.floor(new Date(`${date}T00:00:00Z`).getTime() / 1000),
      }))
      .filter((row) => row.close > 0)
      .sort((a, b) => b.timestamp - a.timestamp);
  } catch (error) {
    console.warn("Alpha Vantage history unavailable; continuing with quote-only scoring.", {
      ticker,
      error: getErrorMessage(error),
    });
    return [];
  }
}

async function getFinnhubDailyCandles(ticker: string): Promise<DailyCandle[]> {
  const to = Math.floor(Date.now() / 1000);
  const from = to - 45 * 24 * 60 * 60;
  const data = await fetchProviderJson<FinnhubCandleResponse>(
    "Finnhub",
    `https://finnhub.io/api/v1/stock/candle?symbol=${ticker}&resolution=D&from=${from}&to=${to}&token=${process.env.FINNHUB_API_KEY}`,
  );

  if (data.s !== "ok" || !data.c?.length || !data.t?.length) {
    console.warn("Finnhub candles unavailable; continuing with quote-only scoring.", {
      ticker,
      status: data.s,
    });
    return [];
  }

  return data.c
    .map((close, index) => ({
      close: Number(close),
      date: new Date((data.t?.[index] ?? 0) * 1000).toISOString().slice(0, 10),
      timestamp: data.t?.[index] ?? 0,
      volume: Number(data.v?.[index] ?? 0) || null,
    }))
    .filter((row) => row.close > 0 && row.timestamp > 0)
    .sort((a, b) => b.timestamp - a.timestamp);
}

async function getNews(ticker: string): Promise<NewsItem[]> {
  if (!process.env.FINNHUB_API_KEY) return getMockNews(ticker);
  try {
    const to = new Date();
    const from = new Date(Date.now() - 1000 * 60 * 60 * 24 * 10);
    const data = await fetchProviderJson<FinnhubNews[]>(
      "Finnhub",
      `https://finnhub.io/api/v1/company-news?symbol=${ticker}&from=${dateOnly(from)}&to=${dateOnly(to)}&token=${process.env.FINNHUB_API_KEY}`,
      4_000,
    );
    const rows = data.slice(0, 3).map((item) => {
      const headline = item.headline ?? `${ticker} market update`;
      const summary = item.summary || "No summary provided by source.";
      const analysis = classifyNews(`${headline} ${summary}`);
      return {
        id: String(item.id ?? `${ticker}-${headline}`),
        ticker,
        headline,
        summary,
        source: item.source ?? "Finnhub",
        url: item.url ?? "#",
        publishedAt: item.datetime ? new Date(item.datetime * 1000).toISOString() : new Date().toISOString(),
        ...analysis,
      };
    });

    return rows.length > 0 ? rows : getMockNews(ticker);
  } catch (error) {
    console.warn("Finnhub news unavailable; using fallback catalyst copy.", {
      ticker,
      error: getErrorMessage(error),
    });
    return getMockNews(ticker);
  }
}

async function getMarketReference() {
  const [spy, qqq] = await Promise.all([getDailyHistory("SPY"), getDailyHistory("QQQ")]);
  return {
    spy: spy[5] ? pct(spy[0].close, spy[5].close) : 0,
    qqq: qqq[5] ? pct(qqq[0].close, qqq[5].close) : 0,
  };
}

async function fetchProviderJson<T>(
  provider: ProviderName,
  url: string,
  timeoutMs = 10_000,
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  const response = await fetch(url, {
    cache: "no-store",
    signal: controller.signal,
  }).finally(() => clearTimeout(timeout));

  if (!response.ok) {
    const body = await safeResponseText(response);
    console.error(`${provider} API response failed`, {
      status: response.status,
      body,
    });
    throw new Error(`${provider} request failed with ${response.status}`);
  }
  const payload = (await response.json()) as T;
  return payload;
}

function rememberQuote(ticker: string, quote: QuoteResult) {
  quoteCache().set(ticker, {
    ...quote,
    cachedAtMs: Date.now(),
  });
}

function pct(current: number, previous: number) {
  if (!previous) return 0;
  return Number((((current - previous) / previous) * 100).toFixed(2));
}

function avg(values: number[]) {
  const filtered = values.filter(Number.isFinite);
  return filtered.length ? filtered.reduce((sum, value) => sum + value, 0) / filtered.length : 0;
}

function getHistoryMetrics(
  history: DailyCandle[],
  latestPrice = history[0]?.close ?? null,
  oneDayPercent: number | null = null,
): HistoryMetrics {
  const latestClose = history[0]?.close ?? null;
  const close5D = history.length >= 6 ? history[5].close : null;
  const close20D = history.length >= 21 ? history[20].close : null;
  const latestVolume = history[0]?.volume ?? null;
  const last20Volumes = history
    .slice(0, 20)
    .map((day) => day.volume)
    .filter((volume): volume is number => typeof volume === "number" && Number.isFinite(volume) && volume > 0);
  const average20DVolume = last20Volumes.length >= 20 ? avg(last20Volumes) : null;

  return {
    candlesReturned: history.length,
    latestClose,
    close5D,
    close20D,
    oneDayPercent: oneDayPercent ?? (latestClose && history[1]?.close ? pct(latestClose, history[1].close) : null),
    fiveDayPercent: latestPrice && close5D ? pct(latestPrice, close5D) : null,
    twentyDayPercent: latestPrice && close20D ? pct(latestPrice, close20D) : null,
    latestVolume,
    average20DVolume: average20DVolume ? Math.round(average20DVolume) : null,
    volumeRatio: latestVolume && average20DVolume ? Number((latestVolume / average20DVolume).toFixed(2)) : null,
  };
}

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function round(value: unknown) {
  const number = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(number) ? Number(number.toFixed(2)) : 0;
}

function nullableRound(value: unknown) {
  const rounded = round(value);
  return rounded || null;
}

function dateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}

function getNewsSentimentScore(news: NewsItem[]) {
  if (news.length === 0) return 50;
  const score = news.reduce((sum, item) => {
    if (item.sentiment === "positive") return sum + 80;
    if (item.sentiment === "negative") return sum + 25;
    return sum + 55;
  }, 0);
  return Math.round(score / news.length);
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown provider error";
}

async function safeResponseText(response: Response) {
  try {
    return await response.text();
  } catch {
    return "Response body unavailable.";
  }
}

function redactQuote(data: FinnhubQuote) {
  return {
    c: data.c,
    d: data.d,
    dp: data.dp,
    h: data.h,
    l: data.l,
    o: data.o,
    pc: data.pc,
  };
}

function isUsableProviderKey(value: string | undefined, placeholder: string) {
  const normalised = value?.trim();
  return Boolean(normalised && normalised !== placeholder);
}
