import { NextResponse } from "next/server";
import { getLiveQuoteForValidation, validateMarketDataEnv } from "@/lib/stocks/market-data";

export const dynamic = "force-dynamic";

const defaultSymbols = ["NVDA", "MSFT", "AMD", "PLTR", "COIN", "AAPL"];

export async function GET(request: Request) {
  const url = new URL(request.url);
  const symbols = (url.searchParams.get("symbols") ?? defaultSymbols.join(","))
    .split(",")
    .map((symbol) => symbol.trim().toUpperCase())
    .filter(Boolean);

  const rows = await Promise.all(
    symbols.map(async (ticker) => {
      const quote = await getLiveQuoteForValidation(ticker);
      return {
        ticker,
        currentPrice: quote?.price ?? null,
        providerUsed: quote?.source === "cache" ? "Cached Snapshot" : quote?.provider ?? "Mock Data",
        source: quote?.source ?? "mock",
        apiError: quote?.apiError ?? null,
      };
    }),
  );

  return NextResponse.json({
    environment: validateMarketDataEnv(),
    rows,
  });
}
