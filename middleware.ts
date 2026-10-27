import { NextRequest, NextResponse } from "next/server";
import { levytateBetaSessionCookie, readLevyTateBetaSession } from "@/lib/levytate/config/beta-access";
import {
  getLevyTatePlatformOrigin,
  getLevyTateWebsiteOrigin,
  isLevyTateMarketingHost,
  isLevyTatePlatformEntryPath,
  isLevyTatePlatformHost,
  isLevyTatePublicPagePath,
  levytateAuthCookieOptions,
  requestHostname,
} from "@/lib/levytate/hosts";
import {
  isAllowedLevyTateMcpStagingRequest,
  isLevyTateMcpStagingOnly,
  levyTateMcpStagingNotFound,
} from "@/lib/server/levytate-mcp-staging";

const legacyDemoPathPrefixes = ["/portakabin-apprenticeship-hub", "/future-talent-portal", "/levytate-mvp", "/levytate/ground-control"];
const marketingTrustPaths = new Set(["/privacy", "/early-access-terms", "/data-processing", "/support", "/account-help", "/data-rights"]);

function clearInvalidBetaSession(response: NextResponse, request: NextRequest) {
  response.cookies.set(levytateBetaSessionCookie, "", {
    ...levytateAuthCookieOptions(0, request.headers.get("host")),
    expires: new Date(0),
  });
  return response;
}

function redirectToOrigin(request: NextRequest, origin: string, status: number) {
  const destination = new URL(`${request.nextUrl.pathname}${request.nextUrl.search}`, origin);
  return NextResponse.redirect(destination, status);
}

function rewriteLevyTate(request: NextRequest, pathname: string) {
  return NextResponse.rewrite(new URL(pathname, request.url));
}

async function handlePlatformHost(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (legacyDemoPathPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
    return new NextResponse("Not Found", { status: 404 });
  }

  if (isLevyTatePublicPagePath(pathname)) {
    return redirectToOrigin(request, getLevyTateWebsiteOrigin(), 301);
  }

  if (pathname === "/") {
    const session = await readLevyTateBetaSession(request.cookies.get(levytateBetaSessionCookie)?.value);
    if (session) return NextResponse.redirect(new URL("/app", request.url));
    return clearInvalidBetaSession(NextResponse.redirect(new URL("/login", request.url)), request);
  }

  if (pathname === "/login") {
    const session = await readLevyTateBetaSession(request.cookies.get(levytateBetaSessionCookie)?.value);
    if (session) return NextResponse.redirect(new URL("/app", request.url));
    return clearInvalidBetaSession(rewriteLevyTate(request, "/levytate/login"), request);
  }

  if (pathname === "/app" || pathname.startsWith("/app/")) {
    const session = await readLevyTateBetaSession(request.cookies.get(levytateBetaSessionCookie)?.value);
    if (!session) return clearInvalidBetaSession(NextResponse.redirect(new URL("/login", request.url)), request);
    return rewriteLevyTate(request, `/levytate${pathname}`);
  }

  return NextResponse.next();
}

function handleMarketingHost(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (legacyDemoPathPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
    return new NextResponse("Not Found", { status: 404 });
  }

  if (isLevyTatePlatformEntryPath(pathname)) {
    return redirectToOrigin(request, getLevyTatePlatformOrigin(), 307);
  }

  if (pathname === "/") return rewriteLevyTate(request, "/levytate");
  if (pathname === "/early-access") return rewriteLevyTate(request, "/levytate/early-access");
  if (marketingTrustPaths.has(pathname)) return rewriteLevyTate(request, `/levytate${pathname}`);

  return NextResponse.next();
}

export async function middleware(request: NextRequest) {
  if (isLevyTateMcpStagingOnly()) {
    return isAllowedLevyTateMcpStagingRequest(request.nextUrl.pathname, request.method)
      ? NextResponse.next()
      : levyTateMcpStagingNotFound();
  }

  const host = requestHostname(request.headers.get("host")) || request.nextUrl.hostname.toLowerCase();

  if (isLevyTatePlatformHost(host)) return handlePlatformHost(request);
  if (isLevyTateMarketingHost(host)) return handleMarketingHost(request);

  if (request.nextUrl.pathname === "/levytate" || request.nextUrl.pathname.startsWith("/levytate/")) {
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-levytate-route", "1");
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/:path*"],
};
