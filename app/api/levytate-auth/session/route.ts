import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { levytateBetaSessionCookie, levytateBetaSessionMaxAge } from "@/lib/levytate/config/beta-access";
import { levytateAuthCookieMaxAge, levytateSupabaseAccessCookie, levytateSupabaseRefreshCookie, refreshEmployerAuth } from "@/lib/server/levytate-auth";
import { setLevyTateAuthCookies } from "@/lib/server/levytate-auth-cookies";
import { checkSessionRefreshLimit, LevyTateRateLimitStoreError } from "@/lib/server/levytate-auth-rate-limit";

export async function POST(request: Request) {
  try {
    try {
      const rateLimit = await checkSessionRefreshLimit(request);
      if (!rateLimit.allowed) return response({ ok: false, message: "Please wait before refreshing your session again." }, 429);
    } catch (error) {
      if (!(error instanceof LevyTateRateLimitStoreError)) throw error;
      // A valid refresh token is still verified by Supabase during a limiter outage.
    }
    const store = await cookies();
    const refresh = store.get(levytateSupabaseRefreshCookie)?.value;
    if (!refresh) throw new Error("missing");
    const result = await refreshEmployerAuth(refresh);
    const refreshed = response({ ok: true });
    setLevyTateAuthCookies(refreshed, request.headers.get("host"), [
      { name: levytateBetaSessionCookie, value: result.sessionToken, maxAge: levytateBetaSessionMaxAge },
      { name: levytateSupabaseAccessCookie, value: result.access_token, maxAge: Math.min(result.expires_in ?? 3600, levytateAuthCookieMaxAge) },
      { name: levytateSupabaseRefreshCookie, value: result.refresh_token, maxAge: levytateAuthCookieMaxAge },
    ]);
    return refreshed;
  } catch {
    return response({ ok: false, message: "Your session has ended. Sign in again to continue." }, 401);
  }
}
function response(body: unknown, status = 200) { return NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store, max-age=0" } }); }
