import { NextResponse } from "next/server";
import { getDebugHistory } from "@/lib/stocks/market-data";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const symbol = (url.searchParams.get("symbol") ?? "NVDA").trim().toUpperCase();

  try {
    return NextResponse.json(await getDebugHistory(symbol));
  } catch (error) {
    console.error("[STOCK DATA] Debug history failed", {
      symbol,
      error: error instanceof Error ? error.message : "Unknown history error",
    });
    return NextResponse.json(
      {
        symbol,
        provider: "Finnhub",
        candlesReturned: 0,
        latestClose: null,
        close5D: null,
        close20D: null,
        oneDayPercent: null,
        fiveDayPercent: null,
        twentyDayPercent: null,
        latestVolume: null,
        average20DVolume: null,
        volumeRatio: null,
      },
      { status: 200 },
    );
  }
}
