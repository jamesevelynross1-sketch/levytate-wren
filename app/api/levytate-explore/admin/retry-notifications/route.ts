import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { levytateBetaSessionCookie } from "@/lib/levytate/config/beta-access";
import { readAuthorisedLevyTateBetaSession } from "@/lib/server/levytate-authorised-session";
import { dispatchExploreNotifications } from "@/lib/server/levytate-explore";

const headers = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" };

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const session = await readAuthorisedLevyTateBetaSession(
    cookieStore.get(levytateBetaSessionCookie)?.value,
  );
  if (!session) return NextResponse.json({ message: "Unauthorised." }, { status: 401, headers });
  if (session.accessLevel !== "beta_admin") {
    return NextResponse.json({ message: "Forbidden." }, { status: 403, headers });
  }
  if (request.headers.get("origin") !== new URL(request.url).origin) {
    return NextResponse.json({ message: "Invalid origin." }, { status: 403, headers });
  }

  try {
    const result = await dispatchExploreNotifications({ limit: 10 });
    return NextResponse.json({ ok: true, ...result }, { headers });
  } catch {
    return NextResponse.json({ message: "The retry service is unavailable. Queued messages remain in the outbox." }, { status: 503, headers });
  }
}
