import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { applicationRequestOrigin } from "@/lib/server/levytate-request-origin";
import { expireLevyTateAuthCookies } from "@/lib/server/levytate-auth-cookies";
import { assertBrowserOrigin } from "@/lib/server/levytate-request-boundary";
import {
  invalidateProviderAuthSession,
  levytateProviderSessionCookie,
  levytateProviderSupabaseAccessCookie,
  levytateProviderSupabaseRefreshCookie,
} from "@/lib/server/levytate-provider-auth";

export async function POST(request: Request) {
  try { assertBrowserOrigin(request); } catch {
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
    new URL(`/levytate/provider/login${fullyInvalidated ? "" : "?logout=local-only"}`, applicationRequestOrigin(request)),
    303,
  );
  expireLevyTateAuthCookies(response, request.headers.get("host"), [
    levytateProviderSessionCookie,
    levytateProviderSupabaseAccessCookie,
    levytateProviderSupabaseRefreshCookie,
  ]);
  response.headers.set("Clear-Site-Data", '"cache", "storage"');
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  return response;
}
