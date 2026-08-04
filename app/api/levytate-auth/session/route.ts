import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { levytateBetaSessionCookie, levytateBetaSessionMaxAge } from "@/lib/levytate/config/beta-access";
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
    refreshed.cookies.set(levytateBetaSessionCookie, result.sessionToken, options(levytateBetaSessionMaxAge));
    refreshed.cookies.set(levytateSupabaseAccessCookie, result.access_token, options(Math.min(result.expires_in ?? 3600, levytateAuthCookieMaxAge)));
    refreshed.cookies.set(levytateSupabaseRefreshCookie, result.refresh_token, options(levytateAuthCookieMaxAge));
    return refreshed;
  } catch {
    return response({ ok: false, message: "Your session has ended. Sign in again to continue." }, 401);
  }
}
function options(maxAge: number) { return { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/", maxAge }; }
function response(body: unknown, status = 200) { return NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store, max-age=0" } }); }
