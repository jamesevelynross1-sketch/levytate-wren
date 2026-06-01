import { NextResponse } from "next/server";
import { getDebugLiveQuote } from "@/lib/stocks/market-data";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const symbol = (url.searchParams.get("symbol") ?? "NVDA").trim().toUpperCase();

  try {
    const result = await getDebugLiveQuote(symbol);
    return NextResponse.json(result);
  } catch (error) {
    console.error("[STOCK DATA] Debug live quote failed", {
      symbol,
      error: error instanceof Error ? error.message : "Unknown debug quote error",
    });
    return NextResponse.json(
      {
        symbol,
        provider: "Mock",
        price: null,
        change: null,
        percentChange: null,
        rawResponse: {
          error: error instanceof Error ? error.message : "Unknown debug quote error",
        },
        envDetected: false,
      },
      { status: 200 },
    );
  }
}
