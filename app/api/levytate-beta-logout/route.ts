import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { applicationRequestOrigin } from "@/lib/server/levytate-request-origin";
import { levytateBetaSessionCookie, readLevyTateBetaSession } from "@/lib/levytate/config/beta-access";
import { levyTateEmployerSignInPath, requestHostname } from "@/lib/levytate/hosts";
import { invalidateEmployerAuthSession, levytateSupabaseAccessCookie, levytateSupabaseRefreshCookie, recordEmployerLogoutEvent } from "@/lib/server/levytate-auth";
import { expireLevyTateAuthCookies } from "@/lib/server/levytate-auth-cookies";
import { levytateDemoControllerCookie } from "@/lib/server/levytate-demo-role-switcher";
import { assertBrowserOrigin, ClientRequestError } from "@/lib/server/levytate-request-boundary";

const authenticationCookies = [levytateBetaSessionCookie, levytateSupabaseAccessCookie, levytateSupabaseRefreshCookie, levytateDemoControllerCookie] as const;

export async function POST(request: Request) {
  try { assertBrowserOrigin(request); }
  catch (error) { return NextResponse.json({ message: "This request did not originate from this application." }, { status: error instanceof ClientRequestError ? error.status : 403 }); }
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

  const destination = new URL(levyTateEmployerSignInPath(requestHostname(request.headers.get("host") || new URL(request.url).host)), applicationRequestOrigin(request));
  if (providerFailure) destination.searchParams.set("logout", "local-only");
  const response = NextResponse.redirect(destination, 303);
  expireLevyTateAuthCookies(response, request.headers.get("host"), authenticationCookies);
  response.headers.set("Clear-Site-Data", '"cache", "storage"');
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  if (session) {
    await safelyAudit(session, "auth.local_session_cleared", "completed");
    await safelyAudit(session, "auth.logout_completed", providerFailure ? "local_only" : "completed");
  }
  return response;
}

async function safelyAudit(session: NonNullable<Awaited<ReturnType<typeof readLevyTateBetaSession>>>, action: string, outcome: string) {
  try {
    await recordEmployerLogoutEvent(session, action, outcome);
  } catch {
    console.error("LevyTate logout audit unavailable", { action, outcome: "audit_unavailable" });
  }
}
