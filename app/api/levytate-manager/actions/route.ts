import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { levytateBetaSessionCookie } from "@/lib/levytate/config/beta-access";
import { readAuthorisedLevyTateBetaSession } from "@/lib/server/levytate-authorised-session";
import type { ManagerOperationalActionFilter, ManagerOperationalActionKindFilter } from "@/lib/levytate/mvp/manager-operational-actions";
import { listManagerActions } from "@/lib/server/levytate-manager-actions";
import { LevyTateManagerScopeError } from "@/lib/server/levytate-manager-scope";
import { logLevyTateServerError } from "@/lib/server/levytate-safe-api-error";

const filters: ManagerOperationalActionFilter[] = ["all", "open", "acknowledged", "in_progress", "overdue"];
const kinds: ManagerOperationalActionKindFilter[] = ["all", "application_review", "manager_support"];

export async function GET(request: Request) {
  const cookieStore = await cookies();
  const session = await readAuthorisedLevyTateBetaSession(cookieStore.get(levytateBetaSessionCookie)?.value);
  if (!session) return NextResponse.json({ message: "Unauthorised." }, { status: 401 });
  const requested = new URL(request.url).searchParams.get("status") ?? "all";
  const filter = filters.includes(requested as ManagerOperationalActionFilter) ? requested as ManagerOperationalActionFilter : "all";
  const requestedKind = new URL(request.url).searchParams.get("kind") ?? "all";
  const kind = kinds.includes(requestedKind as ManagerOperationalActionKindFilter) ? requestedKind as ManagerOperationalActionKindFilter : "all";
  try {
    return NextResponse.json(await listManagerActions(session, filter, kind), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof LevyTateManagerScopeError) {
      return NextResponse.json({ message: "Line Manager access is required." }, { status: 403 });
    }
    logLevyTateServerError("manager-actions", error);
    return NextResponse.json({ error: "manager_actions_failed", message: "Your actions could not be loaded. Please try again." }, { status: 500 });
  }
}
