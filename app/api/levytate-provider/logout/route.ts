import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  invalidateProviderAuthSession,
  levytateProviderSessionCookie,
  levytateProviderSupabaseAccessCookie,
  levytateProviderSupabaseRefreshCookie,
} from "@/lib/server/levytate-provider-auth";

export async function POST(request: Request) {
  if (!hasSameOrigin(request)) {
    return NextResponse.json({ message: "Forbidden." }, { status: 403, headers: { "Cache-Control": "private, no-store, max-age=0" } });
  }
  const cookieStore = await cookies();
  let fullyInvalidated = true;
  try {
    fullyInvalidated = await invalidateProviderAuthSession(
      cookieStore.get(levytateProviderSupabaseAccessCookie)?.value,
      cookieStore.get(levytateProviderSupabaseRefreshCookie)?.value,
    );
  } catch {
    fullyInvalidated = false;
  }
  const response = NextResponse.redirect(
    new URL(`/levytate/provider/login${fullyInvalidated ? "" : "?logout=local-only"}`, request.url),
    303,
  );
  for (const name of [levytateProviderSessionCookie, levytateProviderSupabaseAccessCookie, levytateProviderSupabaseRefreshCookie]) {
    response.cookies.set(name, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 0 });
  }
  response.headers.set("Clear-Site-Data", '"cache", "storage"');
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  return response;
}

function hasSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return origin === new URL(request.url).origin;
}
