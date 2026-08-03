import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { levytateBetaSessionCookie, levytateBetaSessionMaxAge } from "@/lib/levytate/config/beta-access";
import { levytateAuthCookieMaxAge, levytateSupabaseAccessCookie, levytateSupabaseRefreshCookie, refreshEmployerAuth } from "@/lib/server/levytate-auth";

export async function POST() {
  try {
    const store = await cookies();
    const refresh = store.get(levytateSupabaseRefreshCookie)?.value;
    if (!refresh) throw new Error("missing");
    const result = await refreshEmployerAuth(refresh);
    const response = NextResponse.json({ ok: true });
    response.cookies.set(levytateBetaSessionCookie, result.sessionToken, options(levytateBetaSessionMaxAge));
    response.cookies.set(levytateSupabaseAccessCookie, result.access_token, options(Math.min(result.expires_in ?? 3600, levytateAuthCookieMaxAge)));
    response.cookies.set(levytateSupabaseRefreshCookie, result.refresh_token, options(levytateAuthCookieMaxAge));
    return response;
  } catch {
    return NextResponse.json({ ok: false, message: "Your session has ended. Sign in again to continue." }, { status: 401 });
  }
}
function options(maxAge: number) { return { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/", maxAge }; }
