import { NextRequest, NextResponse } from "next/server";
import { levytateBetaSessionCookie, readLevyTateBetaSession } from "@/lib/levytate/config/beta-access";

const levytateHosts = new Set(["levytate.co.uk", "www.levytate.co.uk"]);
const publicTrustPaths = new Set(["/privacy", "/early-access-terms", "/data-processing", "/support", "/account-help", "/data-rights"]);
const legacyDemoPathPrefixes = ["/portakabin-apprenticeship-hub", "/future-talent-portal", "/levytate-mvp", "/levytate/ground-control"];

function isLevyTateHost(request: NextRequest) {
  const host = request.headers.get("host")?.split(":")[0]?.toLowerCase() ?? "";
  return levytateHosts.has(host);
}

function clearInvalidBetaSession(response: NextResponse) {
  response.cookies.delete(levytateBetaSessionCookie);
  return response;
}

export async function middleware(request: NextRequest) {
  if (!isLevyTateHost(request)) {
    if (request.nextUrl.pathname === "/levytate" || request.nextUrl.pathname.startsWith("/levytate/")) {
      const requestHeaders = new Headers(request.headers);
      requestHeaders.set("x-levytate-route", "1");
      return NextResponse.next({ request: { headers: requestHeaders } });
    }
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;

  if (legacyDemoPathPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
    return new NextResponse("Not Found", { status: 404 });
  }

  if (pathname === "/") {
    return NextResponse.rewrite(new URL("/levytate", request.url));
  }

  if (pathname === "/early-access") {
    return NextResponse.rewrite(new URL("/levytate/early-access", request.url));
  }

  if (publicTrustPaths.has(pathname)) {
    return NextResponse.rewrite(new URL(`/levytate${pathname}`, request.url));
  }

  if (pathname === "/login") {
    const session = await readLevyTateBetaSession(request.cookies.get(levytateBetaSessionCookie)?.value);
    if (session) {
      return NextResponse.redirect(new URL("/app", request.url));
    }
    return clearInvalidBetaSession(NextResponse.rewrite(new URL("/levytate/login", request.url)));
  }

  if (pathname === "/app" || pathname.startsWith("/app/")) {
    const session = await readLevyTateBetaSession(request.cookies.get(levytateBetaSessionCookie)?.value);
    if (!session) {
      return clearInvalidBetaSession(NextResponse.redirect(new URL("/login", request.url)));
    }
    return NextResponse.rewrite(new URL(`/levytate${pathname}`, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|brand|fonts|api).*)"],
};
