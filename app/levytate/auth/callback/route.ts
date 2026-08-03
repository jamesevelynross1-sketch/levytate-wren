import { NextResponse } from "next/server";
import { levytateBetaSessionCookie, levytateBetaSessionMaxAge } from "@/lib/levytate/config/beta-access";
import { levytateAuthCookieMaxAge, levytateSupabaseAccessCookie, levytateSupabaseRefreshCookie, verifyEmployerMagicLink } from "@/lib/server/levytate-auth";
import { checkCallbackAttemptLimit } from "@/lib/server/levytate-auth-rate-limit";
import { getCoreEarlyAccessPolicy } from "@/lib/levytate/core-early-access-policy";
import { normaliseMvpUserRole } from "@/lib/levytate/mvp/rbac";

export async function GET(request: Request) {
  const url = new URL(request.url);
  try {
    const rateLimit = await checkCallbackAttemptLimit(request);
    if (!rateLimit.allowed) return failed(url, "invalid-link");
    const result = await verifyEmployerMagicLink(url.searchParams.get("token_hash") ?? "", url.searchParams.get("type") ?? "email");
    const role = normaliseMvpUserRole(result.membership.role);
    const first = getCoreEarlyAccessPolicy(role).modules.find((module) => module.availability === "enabled")?.moduleKey;
    const destination = new URL("/levytate/app", url.origin);
    if (first) destination.searchParams.set("module", first);
    const response = NextResponse.redirect(destination);
    setCookie(response, levytateBetaSessionCookie, result.sessionToken, levytateBetaSessionMaxAge);
    setCookie(response, levytateSupabaseAccessCookie, result.access_token, Math.min(result.expires_in ?? 3600, levytateAuthCookieMaxAge));
    setCookie(response, levytateSupabaseRefreshCookie, result.refresh_token, levytateAuthCookieMaxAge);
    return response;
  } catch {
    return failed(url, "invalid-link");
  }
}

function setCookie(response: NextResponse, name: string, value: string, maxAge: number) {
  response.cookies.set(name, value, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge });
}
function failed(url: URL, reason: string) {
  return NextResponse.redirect(new URL(`/levytate/login?auth=${reason}`, url.origin));
}
