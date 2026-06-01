import type { NewsItem, PortfolioHolding, PortfolioRecommendation, PortfolioSettings, Signal, StockSignal } from "./types";

export const scoreWeights = {
  priceMomentum: 0.25,
  volumeConfirmation: 0.15,
  newsSentiment: 0.2,
  marketTrendAlignment: 0.15,
  relativeStrength: 0.15,
  riskVolatilityControl: 0.1,
} as const;

export function getSignal(score: number): Signal {
  if (score >= 82) return "Strong Buy";
  if (score >= 68) return "Buy";
  if (score >= 52) return "Watch";
  if (score >= 38) return "Avoid";
  return "Sell";
}

export function classifyNews(text: string): Pick<NewsItem, "sentiment" | "catalysts"> {
  const value = text.toLowerCase();
  const positive = ["upgrade", "beat", "growth", "launch", "approval", "partnership", "demand", "record", "expands"];
  const negative = ["lawsuit", "probe", "downgrade", "miss", "fraud", "recall", "ban", "cuts", "weak"];
  const score = positive.filter((word) => value.includes(word)).length - negative.filter((word) => value.includes(word)).length;

  return {
    sentiment: score > 0 ? "positive" : score < 0 ? "negative" : "neutral",
    catalysts: [
      value.includes("earnings") || value.includes("revenue") ? "earnings" : null,
      value.includes("upgrade") || value.includes("downgrade") || value.includes("analyst") ? "analyst" : null,
      value.includes("launch") || value.includes("product") ? "product" : null,
      value.includes("lawsuit") || value.includes("legal") ? "legal" : null,
      value.includes("regulatory") || value.includes("sec") || value.includes("ban") ? "regulatory" : null,
      value.includes("crypto") || value.includes("bitcoin") ? "crypto" : null,
      value.includes(" ai ") || value.includes("artificial intelligence") ? "ai" : null,
    ].filter(Boolean) as NewsItem["catalysts"],
  };
}

export function buildPortfolioRecommendation(
  signals: StockSignal[],
  holdings: PortfolioHolding[],
  settings: PortfolioSettings,
): PortfolioRecommendation {
  const toleranceMultiplier = settings.riskTolerance === "aggressive" ? 1.25 : settings.riskTolerance === "cautious" ? 0.7 : 1;
  const candidates = signals
    .filter((stock) => stock.signal === "Strong Buy" || stock.signal === "Buy")
    .filter((stock) => !stock.riskControls.doNotBuyWarning)
    .slice(0, 5)
    .map((stock) => ({
      ticker: stock.ticker,
      signal: stock.signal,
      suggestedAllocationPct: Math.min(
        settings.maxPctPerTrade,
        Math.max(2, Math.round(stock.riskControls.suggestedPositionSizePct * toleranceMultiplier)),
      ),
      reason: `${stock.opportunityScore}/100 score with ${stock.trendScore}/100 trend and ${stock.sentimentScore}/100 sentiment.`,
    }));

  const holdingActions = holdings.map((holding) => {
    const signal = signals.find((stock) => stock.ticker === holding.ticker);
    if (!signal) {
      return { ticker: holding.ticker, action: "Hold" as const, reason: "No current signal available in the watchlist." };
    }
    if (signal.signal === "Sell" || signal.riskControls.doNotBuyWarning) {
      return { ticker: holding.ticker, action: "Sell" as const, reason: signal.riskControls.doNotBuyWarning ?? "Signal score has deteriorated." };
    }
    if (signal.signal === "Avoid" || holding.unrealisedPnlPct > 25) {
      return { ticker: holding.ticker, action: "Trim" as const, reason: "Risk/reward has weakened or position has run ahead of the signal." };
    }
    if (signal.signal === "Strong Buy" && holding.unrealisedPnlPct > -8) {
      return { ticker: holding.ticker, action: "Add" as const, reason: "Signal remains strong and risk controls are within range." };
    }
    return { ticker: holding.ticker, action: "Hold" as const, reason: "Existing position is aligned with current risk settings." };
  });

  const plannedAllocation = candidates.reduce((sum, candidate) => sum + candidate.suggestedAllocationPct, 0);

  return {
    topCandidates: candidates,
    holdingActions,
    cashPercentage: Math.max(5, 100 - plannedAllocation),
  };
}
