import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { levytateBetaSessionCookie, readLevyTateBetaSession } from "@/lib/levytate/config/beta-access";
import { invalidateEmployerAuthSession, levytateSupabaseAccessCookie, levytateSupabaseRefreshCookie, recordEmployerLogoutEvent } from "@/lib/server/levytate-auth";

const authenticationCookies = [levytateBetaSessionCookie, levytateSupabaseAccessCookie, levytateSupabaseRefreshCookie] as const;

export async function POST(request: Request) {
  const store = await cookies();
  const session = await readLevyTateBetaSession(store.get(levytateBetaSessionCookie)?.value);
  let providerFailure = false;

  if (session) {
    await safelyAudit(session, "auth.logout_requested", "requested");
    if (session.authMode === "supabase_email") {
      try {
        const result = await invalidateEmployerAuthSession(
          store.get(levytateSupabaseAccessCookie)?.value,
          store.get(levytateSupabaseRefreshCookie)?.value,
        );
        providerFailure = result.attempted && !result.invalidated;
        await safelyAudit(session, providerFailure ? "auth.logout_provider_failed" : "auth.session_invalidated", providerFailure ? "provider_failure" : "current_session");
      } catch {
        providerFailure = true;
        await safelyAudit(session, "auth.logout_provider_failed", "provider_unavailable");
        console.error("LevyTate provider sign-out failed", { outcome: "local_logout_enforced" });
      }
    }
  }

  const destination = new URL("/levytate/login", request.url);
  if (providerFailure) destination.searchParams.set("logout", "local-only");
  const response = NextResponse.redirect(destination, 303);
  for (const name of authenticationCookies) expireCookie(response, name);
  response.headers.set("Clear-Site-Data", '"cache", "storage"');
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  if (session) {
    await safelyAudit(session, "auth.local_session_cleared", "completed");
    await safelyAudit(session, "auth.logout_completed", providerFailure ? "local_only" : "completed");
  }
  return response;
}

function expireCookie(response: NextResponse, name: string) {
  response.cookies.set(name, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    expires: new Date(0),
    maxAge: 0,
    path: "/",
  });
}

async function safelyAudit(session: NonNullable<Awaited<ReturnType<typeof readLevyTateBetaSession>>>, action: string, outcome: string) {
  try {
    await recordEmployerLogoutEvent(session, action, outcome);
  } catch {
    console.error("LevyTate logout audit unavailable", { action, outcome: "audit_unavailable" });
  }
}
