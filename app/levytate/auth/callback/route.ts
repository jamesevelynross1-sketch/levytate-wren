import { NextResponse } from "next/server";
import { levytateBetaSessionCookie, levytateBetaSessionMaxAge, readLevyTateBetaSession } from "@/lib/levytate/config/beta-access";
import { levyTateAppHomePath, levyTateEmployerSignInPath, levytateAuthCookieOptions, requestHostname } from "@/lib/levytate/hosts";
import { levytateAuthCookieMaxAge, levytateSupabaseAccessCookie, levytateSupabaseRefreshCookie, verifyEmployerMagicLink } from "@/lib/server/levytate-auth";
import { checkCallbackAttemptLimit } from "@/lib/server/levytate-auth-rate-limit";
import { getCoreEarlyAccessPolicy } from "@/lib/levytate/core-early-access-policy";
import { normaliseMvpUserRole } from "@/lib/levytate/mvp/rbac";
import { getTermsGateState } from "@/lib/server/levytate-early-access-terms";

export async function GET(request: Request) {
  const url = new URL(request.url);
  try {
    const rateLimit = await checkCallbackAttemptLimit(request);
    if (!rateLimit.allowed) return failed(url, request, "invalid-link");
    const result = await verifyEmployerMagicLink(url.searchParams.get("token_hash") ?? "", url.searchParams.get("type") ?? "email");
    const role = normaliseMvpUserRole(result.membership.role);
    const first = getCoreEarlyAccessPolicy(role).modules.find((module) => module.availability === "enabled")?.moduleKey;
    const homePath = levyTateAppHomePath(requestHostname(request.headers.get("host") || url.host));
    const destination = new URL(homePath, url.origin);
    if (first) destination.searchParams.set("module", first);
    const session = await readLevyTateBetaSession(result.sessionToken);
    if (!session) return failed(url, request, "invalid-link");
    const termsGate = await getTermsGateState(session);
    if (!termsGate.bypass && !termsGate.accepted) destination.pathname = termsGate.authorisedAcceptor ? "/levytate/accept-terms" : homePath;
    const response = NextResponse.redirect(destination);
    setCookie(response, request, levytateBetaSessionCookie, result.sessionToken, levytateBetaSessionMaxAge);
    setCookie(response, request, levytateSupabaseAccessCookie, result.access_token, Math.min(result.expires_in ?? 3600, levytateAuthCookieMaxAge));
    setCookie(response, request, levytateSupabaseRefreshCookie, result.refresh_token, levytateAuthCookieMaxAge);
    return response;
  } catch {
    return failed(url, request, "invalid-link");
  }
}

function setCookie(response: NextResponse, request: Request, name: string, value: string, maxAge: number) {
  response.cookies.set(name, value, levytateAuthCookieOptions(maxAge, request.headers.get("host")));
}
function failed(url: URL, request: Request, reason: string) {
  const path = levyTateEmployerSignInPath(requestHostname(request.headers.get("host") || url.host));
  return NextResponse.redirect(new URL(`${path}?auth=${reason}`, url.origin));
}
