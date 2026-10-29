import { NextResponse } from "next/server";
import { levytateBetaSessionCookie, levytateBetaSessionMaxAge, readLevyTateBetaSession } from "@/lib/levytate/config/beta-access";
import { levyTateAppHomePath, levyTateEmployerSignInPath, requestHostname } from "@/lib/levytate/hosts";
import { levytateAuthCookieMaxAge, levytateSupabaseAccessCookie, levytateSupabaseRefreshCookie, verifyEmployerMagicLink, LevyTateAuthError } from "@/lib/server/levytate-auth";
import { setLevyTateAuthCookies } from "@/lib/server/levytate-auth-cookies";
import { checkCallbackAttemptLimit, recordInvalidCallback } from "@/lib/server/levytate-auth-rate-limit";
import { AuthenticationDependencyError } from "@/lib/server/levytate-auth-provider-request";
import { getCoreEarlyAccessPolicy } from "@/lib/levytate/core-early-access-policy";
import { normaliseMvpUserRole } from "@/lib/levytate/mvp/rbac";
import { getTermsGateState } from "@/lib/server/levytate-early-access-terms";
import { applicationRequestUrl } from "@/lib/server/levytate-request-origin";

export async function GET(request: Request) {
  let url: URL;
  try { url = applicationRequestUrl(request); }
  catch { return NextResponse.json({ message: "Unrecognised application host." }, { status: 403 }); }
  try {
    const rateLimit = await checkCallbackAttemptLimit(request);
    if (!rateLimit.allowed) return failed(url, request, "rate-limited");
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
    setLevyTateAuthCookies(response, request.headers.get("host"), [
      { name: levytateBetaSessionCookie, value: result.sessionToken, maxAge: levytateBetaSessionMaxAge },
      { name: levytateSupabaseAccessCookie, value: result.access_token, maxAge: Math.min(result.expires_in ?? 3600, levytateAuthCookieMaxAge) },
      { name: levytateSupabaseRefreshCookie, value: result.refresh_token, maxAge: levytateAuthCookieMaxAge },
    ]);
    return response;
  } catch (error) {
    if (error instanceof LevyTateAuthError && error.code !== "configuration") {
      if (error.code === "invalid_link") {
        try { if (!(await recordInvalidCallback(request)).allowed) return failed(url, request, "rate-limited"); }
        catch { return failed(url, request, "unavailable"); }
      }
      return failed(url, request, "invalid-link");
    }
    return failed(url, request, error instanceof AuthenticationDependencyError && error.status === 429 ? "rate-limited" : "unavailable");
  }
}
function failed(url: URL, request: Request, reason: string) {
  const path = levyTateEmployerSignInPath(requestHostname(request.headers.get("host") || url.host));
  const response = NextResponse.redirect(new URL(`${path}?auth=${reason}`, url.origin));
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  return response;
}
