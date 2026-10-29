import { NextResponse } from "next/server";
import { applicationRequestUrl } from "@/lib/server/levytate-request-origin";
import { setLevyTateAuthCookies } from "@/lib/server/levytate-auth-cookies";
import { AuthenticationDependencyError } from "@/lib/server/levytate-auth-provider-request";
import {
  completeLevyTateProviderMagicLinkCallback,
  levytateProviderAuthCookieMaxAge,
  levytateProviderSessionCookie,
  levytateProviderSupabaseAccessCookie,
  levytateProviderSupabaseRefreshCookie,
  LevyTateProviderAuthError,
} from "@/lib/server/levytate-provider-auth";

export async function GET(request: Request) {
  let url: URL;
  try { url = applicationRequestUrl(request); }
  catch { return NextResponse.json({ message: "Unrecognised application host." }, { status: 403 }); }

  try {
    // This helper verifies the Supabase session, active provider membership,
    // provider binding and at least one capability-enabled invitation.
    const result = await completeLevyTateProviderMagicLinkCallback(request);
    const response = NextResponse.redirect(new URL("/levytate/provider", url.origin));

    setLevyTateAuthCookies(response, request.headers.get("host"), [
      { name: levytateProviderSessionCookie, value: result.sessionToken, maxAge: levytateProviderAuthCookieMaxAge },
      { name: levytateProviderSupabaseAccessCookie, value: result.accessToken, maxAge: Math.min(result.expiresIn ?? 3600, levytateProviderAuthCookieMaxAge) },
      { name: levytateProviderSupabaseRefreshCookie, value: result.refreshToken, maxAge: levytateProviderAuthCookieMaxAge },
    ]);
    response.headers.set("Cache-Control", "private, no-store, max-age=0");
    return response;
  } catch (error) {
    const status = error instanceof AuthenticationDependencyError || error instanceof LevyTateProviderAuthError ? error.status : 503;
    return failed(url, status === 429 ? "rate-limited" : status >= 500 ? "unavailable" : "invalid-link");
  }
}

function failed(url: URL, reason: string) {
  const response = NextResponse.redirect(
    new URL(`/levytate/provider/login?auth=${reason}`, url.origin),
  );
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  return response;
}
