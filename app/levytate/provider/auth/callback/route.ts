import { NextResponse } from "next/server";
import { levytateAuthCookieOptions } from "@/lib/levytate/hosts";
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

    setCookie(response, request, levytateProviderSessionCookie, result.sessionToken, levytateProviderAuthCookieMaxAge);
    setCookie(response, request, levytateProviderSupabaseAccessCookie, result.accessToken, Math.min(result.expiresIn ?? 3600, levytateProviderAuthCookieMaxAge));
    setCookie(response, request, levytateProviderSupabaseRefreshCookie, result.refreshToken, levytateProviderAuthCookieMaxAge);
    response.headers.set("Cache-Control", "private, no-store, max-age=0");
    return response;
  } catch {
    return failed(url);
  }
}

function setCookie(response: NextResponse, request: Request, name: string, value: string, maxAge: number) {
  response.cookies.set(name, value, levytateAuthCookieOptions(maxAge, request.headers.get("host")));
}

function failed(url: URL) {
  const response = NextResponse.redirect(
    new URL("/levytate/provider/login?auth=invalid-link", url.origin),
  );
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  return response;
}
