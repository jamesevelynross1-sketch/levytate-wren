import { NextRequest, NextResponse } from "next/server";
import { levytateBetaSessionCookie } from "@/lib/levytate/config/beta-access";

const levytateHosts = new Set(["levytate.co.uk", "www.levytate.co.uk"]);

function isLevyTateHost(request: NextRequest) {
  const host = request.headers.get("host")?.split(":")[0]?.toLowerCase() ?? "";
  return levytateHosts.has(host);
}

export function middleware(request: NextRequest) {
  if (!isLevyTateHost(request)) {
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;

  if (pathname === "/") {
    return NextResponse.rewrite(new URL("/levytate", request.url));
  }

  if (pathname === "/login") {
    if (request.cookies.has(levytateBetaSessionCookie)) {
      return NextResponse.redirect(new URL("/app", request.url));
    }
    return NextResponse.rewrite(new URL("/levytate/login", request.url));
  }

  if (pathname === "/app" || pathname.startsWith("/app/")) {
    if (!request.cookies.has(levytateBetaSessionCookie)) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    return NextResponse.rewrite(new URL(`/levytate${pathname}`, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|brand|fonts|api).*)"],
};
