import { NextResponse } from "next/server";
import { dispatchExploreNotifications } from "@/lib/server/levytate-explore";

/**
 * Runs on the Vercel schedule only after production release.
 * There is no unprotected public dispatch and no exposed contact data.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ message: "Notification worker not configured." }, { status: 503 });
  }
  if (request.headers.get("authorization") !== "Bearer " + secret) {
    return NextResponse.json({ message: "Unauthorised." }, { status: 401 });
  }
  try {
    const summary = await dispatchExploreNotifications({ limit: 20 });
    return NextResponse.json(summary, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ message: "Notification dispatch unavailable." }, { status: 503 });
  }
}
