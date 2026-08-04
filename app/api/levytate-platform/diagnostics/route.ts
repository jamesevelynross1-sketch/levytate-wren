import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { levytateBetaSessionCookie } from "@/lib/levytate/config/beta-access";
import { hasMvpPermission } from "@/lib/levytate/mvp/rbac";
import { readAuthorisedLevyTateBetaSession } from "@/lib/server/levytate-authorised-session";
import { getPlatformDiagnostics, hasCurrentPlatformDiagnosticBinding, logDiagnosticDenied } from "@/lib/server/levytate-service-health";

const headers = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" };
export async function GET() {
  const cookieStore = await cookies();
  const session = await readAuthorisedLevyTateBetaSession(cookieStore.get(levytateBetaSessionCookie)?.value);
  if (!session) { logDiagnosticDenied(); return NextResponse.json({ message: "Unauthorised." }, { status: 401, headers }); }
  if (
    session.accessLevel !== "beta_admin"
    || !hasMvpPermission("Platform Admin", "diagnostics:read")
    || !(await hasCurrentPlatformDiagnosticBinding(session))
  ) {
    logDiagnosticDenied();
    return NextResponse.json({ message: "Forbidden." }, { status: 403, headers });
  }
  return NextResponse.json(await getPlatformDiagnostics(), { headers });
}
