import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { levytateBetaSessionCookie, levytateBetaSessionMaxAge, readLevyTateBetaSession } from "@/lib/levytate/config/beta-access";
import { levytateAuthCookieMaxAge, levytateSupabaseAccessCookie, levytateSupabaseRefreshCookie, refreshEmployerAuth } from "@/lib/server/levytate-auth";
import { setLevyTateAuthCookies } from "@/lib/server/levytate-auth-cookies";
import { checkSessionRefreshLimit, LevyTateRateLimitStoreError } from "@/lib/server/levytate-auth-rate-limit";
import { assertBrowserOrigin, ClientRequestError } from "@/lib/server/levytate-request-boundary";

export async function POST(request: Request) {
  try {
    assertBrowserOrigin(request);
    const rateLimit = await checkSessionRefreshLimit(request);
    if (!rateLimit.allowed) return response({ ok: false, message: "Please wait before refreshing your session again." }, 429);
    const store = await cookies();
    const refresh = store.get(levytateSupabaseRefreshCookie)?.value;
    const session = await readLevyTateBetaSession(store.get(levytateBetaSessionCookie)?.value);
    if (!refresh || !session) throw new Error("missing");
    const result = await refreshEmployerAuth(refresh, session);
    const refreshed = response({ ok: true, identity: { email: result.membership.email, organisationId: result.membership.organisation_id } });
    setLevyTateAuthCookies(refreshed, request.headers.get("host"), [
      { name: levytateBetaSessionCookie, value: result.sessionToken, maxAge: levytateBetaSessionMaxAge },
      { name: levytateSupabaseAccessCookie, value: result.access_token, maxAge: Math.min(result.expires_in ?? 3600, levytateAuthCookieMaxAge) },
      { name: levytateSupabaseRefreshCookie, value: result.refresh_token, maxAge: levytateAuthCookieMaxAge },
    ]);
    return refreshed;
  } catch (error) {
    if (error instanceof ClientRequestError) return response({ ok: false, message: error.message }, error.status);
    if (error instanceof LevyTateRateLimitStoreError) return response({ ok: false, message: "Secure sign-in is temporarily unavailable. Please try again shortly." }, 503);
    return response({ ok: false, message: "Your session has ended. Sign in again to continue." }, 401);
  }
}
function response(body: unknown, status = 200) { return NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store, max-age=0" } }); }
