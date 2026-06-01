import type { NewsItem, PortfolioHolding, StockSignal, WatchlistItem } from "./types";

export const defaultWatchlist: WatchlistItem[] = [
  { ticker: "NVDA", name: "NVIDIA", sector: "Semiconductors", exchange: "NASDAQ", addedAt: "2026-05-20" },
  { ticker: "MSFT", name: "Microsoft", sector: "Software", exchange: "NASDAQ", addedAt: "2026-05-20" },
  { ticker: "AAPL", name: "Apple", sector: "Consumer Technology", exchange: "NASDAQ", addedAt: "2026-05-20" },
  { ticker: "TSLA", name: "Tesla", sector: "EVs and Energy", exchange: "NASDAQ", addedAt: "2026-05-20" },
  { ticker: "PLTR", name: "Palantir", sector: "AI Software", exchange: "NYSE", addedAt: "2026-05-20" },
  { ticker: "AMD", name: "Advanced Micro Devices", sector: "Semiconductors", exchange: "NASDAQ", addedAt: "2026-05-20" },
  { ticker: "COIN", name: "Coinbase", sector: "Crypto Infrastructure", exchange: "NASDAQ", addedAt: "2026-05-20" },
  { ticker: "SPY", name: "SPDR S&P 500 ETF", sector: "Benchmark", exchange: "NYSE Arca", addedAt: "2026-05-20" },
  { ticker: "QQQ", name: "Invesco QQQ Trust", sector: "Benchmark", exchange: "NASDAQ", addedAt: "2026-05-20" },
];

const newsByTicker: Record<string, NewsItem[]> = {
  NVDA: [
    mockNews("NVDA", "Data centre demand keeps AI chip supply tight", "Cloud providers continue to signal firm capex for accelerator clusters.", "positive", ["ai", "product"]),
    mockNews("NVDA", "Analysts lift AI infrastructure estimates", "Broker notes point to stronger networking and inference demand.", "positive", ["analyst", "ai"]),
    mockNews("NVDA", "Export controls remain a monitoring point", "Regulatory limits may affect some overseas chip shipments.", "neutral", ["regulatory"]),
  ],
  MSFT: [
    mockNews("MSFT", "Copilot monetisation continues to broaden", "Enterprise AI features are being bundled across more premium plans.", "positive", ["ai", "product"]),
    mockNews("MSFT", "Cloud margins stay in focus after earnings", "Investors are watching Azure growth and AI infrastructure costs.", "neutral", ["earnings", "ai"]),
    mockNews("MSFT", "Security product refresh targets enterprise retention", "New controls aim to improve account expansion in regulated sectors.", "positive", ["product"]),
  ],
  AAPL: [
    mockNews("AAPL", "Services revenue offsets muted hardware cycle", "Investors are weighing durable subscription growth against device replacement timing.", "neutral", ["earnings"]),
    mockNews("AAPL", "AI feature rollout watched by developers", "The next software cycle may determine whether upgrade demand accelerates.", "positive", ["ai", "product"]),
    mockNews("AAPL", "Regulatory scrutiny remains active", "App store and payments rules continue to create headline risk.", "negative", ["legal", "regulatory"]),
  ],
  TSLA: [
    mockNews("TSLA", "Delivery trends remain volatile", "Pricing, incentives and regional demand are still driving large estimate swings.", "negative", ["earnings"]),
    mockNews("TSLA", "Energy storage deployments gain attention", "Storage revenue is becoming a bigger part of the bull case.", "positive", ["product"]),
    mockNews("TSLA", "Autonomy event expectations rise", "Investors are watching product and regulatory milestones around autonomy.", "neutral", ["product", "regulatory"]),
  ],
  PLTR: [
    mockNews("PLTR", "Commercial AI platform adoption remains strong", "New enterprise wins support the growth narrative.", "positive", ["ai", "product"]),
    mockNews("PLTR", "Government contract timing creates lumpiness", "Deal timing can still make quarterly comparisons uneven.", "neutral", ["macro"]),
    mockNews("PLTR", "Analysts debate valuation after rally", "Recent share strength raises execution expectations.", "neutral", ["analyst"]),
  ],
  AMD: [
    mockNews("AMD", "AI accelerator pipeline expands", "Management commentary points to broader customer interest.", "positive", ["ai", "product"]),
    mockNews("AMD", "PC cycle recovery remains uneven", "Consumer and enterprise replacement demand is improving at different speeds.", "neutral", ["macro"]),
    mockNews("AMD", "Analysts watch gross margin path", "Mix shift toward data centre products could support profitability.", "positive", ["analyst"]),
  ],
  COIN: [
    mockNews("COIN", "Crypto volumes rise with renewed risk appetite", "Trading activity has improved alongside digital asset prices.", "positive", ["crypto"]),
    mockNews("COIN", "Regulatory cases remain a key risk", "Policy headlines can still move the stock sharply.", "negative", ["regulatory", "legal", "crypto"]),
    mockNews("COIN", "Institutional custody demand grows", "ETF and prime brokerage flows remain part of the long-term case.", "positive", ["crypto", "product"]),
  ],
};

export const mockHoldings: PortfolioHolding[] = [
  { ticker: "MSFT", shares: 12, averageCost: 398, marketValue: 5400, unrealisedPnlPct: 13.1 },
  { ticker: "NVDA", shares: 18, averageCost: 103, marketValue: 2360, unrealisedPnlPct: 26.4 },
  { ticker: "TSLA", shares: 10, averageCost: 221, marketValue: 1980, unrealisedPnlPct: -10.4 },
];

export function getMockNews(ticker: string) {
  return newsByTicker[ticker] ?? [
    mockNews(ticker, `${ticker} market update`, "Recent price action is being driven by broad market flows.", "neutral", ["macro"]),
    mockNews(ticker, `${ticker} sentiment check`, "No major catalyst was detected in fallback data.", "neutral", ["macro"]),
    mockNews(ticker, `${ticker} risk monitor`, "Use live API keys for current headlines and event classification.", "neutral", ["macro"]),
  ];
}

export function getMockSignals(): StockSignal[] {
  const rows = [
    ["NVDA", 132.24, 2.4, 8.8, 18.2, 1.42, 72, 84, 86, 88, 9.8, 7.4],
    ["PLTR", 125.6, 3.1, 11.4, 23.6, 1.71, 66, 88, 78, 83, 14.1, 10.7],
    ["AMD", 171.8, 1.7, 6.2, 12.9, 1.25, 58, 75, 76, 80, 6.4, 4.8],
    ["MSFT", 450.3, 0.8, 3.5, 7.2, 0.96, 34, 67, 74, 68, 2.6, 1.9],
    ["AAPL", 206.9, -0.4, 1.3, 4.1, 0.88, 31, 54, 48, 42, -1.2, -0.8],
    ["COIN", 248.4, 4.9, 15.8, 31.5, 1.86, 91, 82, 58, 73, 17.7, 13.2],
    ["TSLA", 198.2, -2.1, -6.4, 5.7, 1.33, 94, 22, 20, 35, -8.5, -6.1],
  ] as const;

  return rows.map(([ticker, price, daily, five, twenty, volumeRatio, volatility, trend, sentiment, catalyst, spy, qqq]) => {
    const item = defaultWatchlist.find((entry) => entry.ticker === ticker)!;
    const news = getMockNews(ticker);
    const riskPenalty = Math.max(0, 100 - volatility);
    const weighted =
      Math.max(0, Math.min(100, (five * 3 + twenty * 1.8 + 50))) * 0.25 +
      Math.min(100, volumeRatio * 52) * 0.15 +
      sentiment * 0.2 +
      trend * 0.15 +
      Math.max(0, Math.min(100, 50 + (spy + qqq) * 1.8)) * 0.15 +
      riskPenalty * 0.1;
    const opportunityScore = Math.round(weighted);
    const signal = opportunityScore >= 82 ? "Strong Buy" : opportunityScore >= 68 ? "Buy" : opportunityScore >= 52 ? "Watch" : opportunityScore >= 38 ? "Avoid" : "Sell";
    const stopLoss = Number((price * (1 - Math.min(0.16, Math.max(0.05, volatility / 900)))).toFixed(2));
    const takeProfitLow = Number((price * (1 + Math.max(0.08, volatility / 700))).toFixed(2));
    const takeProfitHigh = Number((price * (1 + Math.max(0.14, volatility / 500))).toFixed(2));

    return {
      ticker,
      name: item.name,
      sector: item.sector,
      currentPrice: price,
      dailyChangePct: daily,
      fiveDayChangePct: five,
      twentyDayChangePct: twenty,
      volume: Math.round(18_000_000 * volumeRatio),
      averageVolume: 18_000_000,
      volumeVsAverage: volumeRatio,
      volatilityScore: volatility,
      trendScore: trend,
      sentimentScore: sentiment,
      newsCatalystScore: catalyst,
      opportunityScore,
      signal,
      relativeStrengthVsSpy: spy,
      relativeStrengthVsQqq: qqq,
      scoreBreakdown: {
        priceMomentum: Math.round(Math.max(0, Math.min(100, (five * 3 + twenty * 1.8 + 50)))),
        volumeConfirmation: Math.round(Math.min(100, volumeRatio * 52)),
        newsSentiment: sentiment,
        marketTrendAlignment: trend,
        relativeStrength: Math.round(Math.max(0, Math.min(100, 50 + (spy + qqq) * 1.8))),
        riskVolatilityControl: riskPenalty,
      },
      riskControls: {
        suggestedPositionSizePct: volatility > 80 ? 2 : opportunityScore > 80 ? 8 : opportunityScore > 65 ? 5 : 3,
        stopLoss,
        takeProfitLow,
        takeProfitHigh,
        riskRewardRatio: Number(((takeProfitLow - price) / Math.max(0.01, price - stopLoss)).toFixed(2)),
        maxPortfolioExposureWarning: opportunityScore > 75 ? "Keep single-name exposure below your configured cap." : null,
        doNotBuyWarning: volatility > 88 || sentiment < 40 ? "Do not buy: volatility or news risk is elevated." : null,
      },
      news,
      lastUpdated: new Date().toISOString(),
      dataMode: "mock",
      dataSource: "mock",
      providerLabel: "Mock Data",
      providerStatus: "🔴 Mock Data",
      apiError: "Live providers and cached snapshots were unavailable.",
    } satisfies StockSignal;
  });
}

function mockNews(
  ticker: string,
  headline: string,
  summary: string,
  sentiment: NewsItem["sentiment"],
  catalysts: NewsItem["catalysts"],
): NewsItem {
  return {
    id: `${ticker}-${headline.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    ticker,
    headline,
    summary,
    source: "Mock research feed",
    url: "#",
    publishedAt: new Date().toISOString(),
    sentiment,
    catalysts,
  };
}
