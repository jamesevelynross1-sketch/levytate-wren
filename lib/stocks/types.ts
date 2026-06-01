export type Signal = "Strong Buy" | "Buy" | "Watch" | "Avoid" | "Sell";

export type RiskTolerance = "cautious" | "balanced" | "aggressive";

export type Sentiment = "positive" | "neutral" | "negative";

export type MarketDataSource =
  | "finnhub"
  | "alpha_vantage"
  | "cache"
  | "mock"
  | "api_error";

export type CatalystType =
  | "earnings"
  | "analyst"
  | "product"
  | "legal"
  | "regulatory"
  | "crypto"
  | "ai"
  | "macro";

export type WatchlistItem = {
  ticker: string;
  name: string;
  sector: string;
  exchange: string;
  addedAt: string;
};

export type NewsItem = {
  id: string;
  ticker: string;
  headline: string;
  summary: string;
  source: string;
  url: string;
  publishedAt: string;
  sentiment: Sentiment;
  catalysts: CatalystType[];
};

export type ScoreBreakdown = {
  priceMomentum: number;
  volumeConfirmation: number;
  newsSentiment: number;
  marketTrendAlignment: number;
  relativeStrength: number;
  riskVolatilityControl: number;
};

export type RiskControls = {
  suggestedPositionSizePct: number;
  stopLoss: number;
  takeProfitLow: number;
  takeProfitHigh: number;
  riskRewardRatio: number;
  maxPortfolioExposureWarning: string | null;
  doNotBuyWarning: string | null;
};

export type StockSignal = {
  ticker: string;
  name: string;
  sector: string;
  currentPrice: number;
  dailyChangePct: number;
  fiveDayChangePct: number | null;
  twentyDayChangePct: number | null;
  volume: number;
  averageVolume: number;
  volumeVsAverage: number | null;
  volatilityScore: number;
  trendScore: number;
  sentimentScore: number;
  newsCatalystScore: number;
  opportunityScore: number;
  signal: Signal;
  relativeStrengthVsSpy: number;
  relativeStrengthVsQqq: number;
  scoreBreakdown: ScoreBreakdown;
  riskControls: RiskControls;
  news: NewsItem[];
  lastUpdated: string;
  dataMode: "live" | "cached" | "mock" | "api_error";
  dataSource: MarketDataSource;
  providerLabel: string;
  providerStatus: string;
  apiError: string | null;
};

export type PortfolioHolding = {
  ticker: string;
  shares: number;
  averageCost: number;
  marketValue: number;
  unrealisedPnlPct: number;
};

export type PortfolioSettings = {
  startingCapital: number;
  riskTolerance: RiskTolerance;
  maxPctPerTrade: number;
  maxOpenPositions: number;
};

export type PortfolioRecommendation = {
  topCandidates: Array<{
    ticker: string;
    signal: Signal;
    suggestedAllocationPct: number;
    reason: string;
  }>;
  holdingActions: Array<{
    ticker: string;
    action: "Sell" | "Trim" | "Hold" | "Add";
    reason: string;
  }>;
  cashPercentage: number;
};
