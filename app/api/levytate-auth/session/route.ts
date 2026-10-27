import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { levytateBetaSessionCookie, levytateBetaSessionMaxAge } from "@/lib/levytate/config/beta-access";
import { levytateAuthCookieOptions } from "@/lib/levytate/hosts";
import { levytateAuthCookieMaxAge, levytateSupabaseAccessCookie, levytateSupabaseRefreshCookie, refreshEmployerAuth } from "@/lib/server/levytate-auth";
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
    refreshed.cookies.set(levytateBetaSessionCookie, result.sessionToken, options(request, levytateBetaSessionMaxAge));
    refreshed.cookies.set(levytateSupabaseAccessCookie, result.access_token, options(request, Math.min(result.expires_in ?? 3600, levytateAuthCookieMaxAge)));
    refreshed.cookies.set(levytateSupabaseRefreshCookie, result.refresh_token, options(request, levytateAuthCookieMaxAge));
    return refreshed;
  } catch {
    return response({ ok: false, message: "Your session has ended. Sign in again to continue." }, 401);
  }
}
function options(request: Request, maxAge: number) { return levytateAuthCookieOptions(maxAge, request.headers.get("host")); }
function response(body: unknown, status = 200) { return NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store, max-age=0" } }); }
