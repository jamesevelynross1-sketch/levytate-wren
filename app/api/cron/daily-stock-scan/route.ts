import { NextResponse } from "next/server";
import { getStockSignals } from "@/lib/stocks/market-data";
import { persistDailyScan } from "@/lib/stocks/supabase";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const dryRun = url.searchParams.get("dryRun") === "1";
  const secret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  const querySecret = url.searchParams.get("secret");

  if (!secret || (authHeader !== `Bearer ${secret}` && querySecret !== secret)) {
    return NextResponse.json({ message: "Unauthorised." }, { status: 401 });
  }

  try {
    const signals = await getStockSignals();
    const persistence = dryRun
      ? { persisted: false, reason: "Dry run requested." }
      : await persistDailyScan(signals);

    return NextResponse.json({
      ok: true,
      dryRun,
      dataMode: signals.some((signal) => signal.dataMode === "live") ? "live" : "mock",
      scanned: signals.length,
      topSignals: signals.slice(0, 5).map((signal) => ({
        ticker: signal.ticker,
        score: signal.opportunityScore,
        signal: signal.signal,
      })),
      persistence,
    });
  } catch (error) {
    console.error("Daily stock scan failed", {
      error: error instanceof Error ? error.message : "Unknown stock scan error",
    });
    return NextResponse.json(
      { message: "Daily stock scan failed." },
      { status: 500 },
    );
  }
}
