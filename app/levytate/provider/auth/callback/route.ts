import { NextResponse } from "next/server";
import { setLevyTateAuthCookies } from "@/lib/server/levytate-auth-cookies";
import {
  completeLevyTateProviderMagicLinkCallback,
  levytateProviderAuthCookieMaxAge,
  levytateProviderSessionCookie,
  levytateProviderSupabaseAccessCookie,
  levytateProviderSupabaseRefreshCookie,
} from "@/lib/server/levytate-provider-auth";

export async function GET(request: Request) {
  const url = new URL(request.url);

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
  } catch {
    return failed(url);
  }
}

function failed(url: URL) {
  const response = NextResponse.redirect(
    new URL("/levytate/provider/login?auth=invalid-link", url.origin),
  );
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  return response;
}
