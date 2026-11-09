import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { levytateBetaSessionCookie } from "@/lib/levytate/config/beta-access";
import { readAuthorisedLevyTateBetaSession } from "@/lib/server/levytate-authorised-session";
import type { ManagerOperationalActionFilter, ManagerOperationalActionKindFilter } from "@/lib/levytate/mvp/manager-operational-actions";
import { listManagerActions } from "@/lib/server/levytate-manager-actions";
import { LevyTateManagerScopeError } from "@/lib/server/levytate-manager-scope";
import { logLevyTateServerError } from "@/lib/server/levytate-safe-api-error";
import { assertExpectedWorkspace, ClientRequestError } from "@/lib/server/levytate-request-boundary";

const filters: ManagerOperationalActionFilter[] = ["all", "open", "acknowledged", "in_progress", "overdue"];
const kinds: ManagerOperationalActionKindFilter[] = ["all", "application_review", "manager_support"];
const headers = { "Cache-Control": "private, no-store, max-age=0" };

export async function GET(request: Request) {
  try {
    const cookieStore = await cookies();
    const session = await readAuthorisedLevyTateBetaSession(cookieStore.get(levytateBetaSessionCookie)?.value);
    if (!session) return NextResponse.json({ message: "Unauthorised." }, { status: 401, headers });
    await assertExpectedWorkspace(request, session.email);
    const requested = new URL(request.url).searchParams.get("status") ?? "all";
    const filter = filters.includes(requested as ManagerOperationalActionFilter) ? requested as ManagerOperationalActionFilter : "all";
    const requestedKind = new URL(request.url).searchParams.get("kind") ?? "all";
    const kind = kinds.includes(requestedKind as ManagerOperationalActionKindFilter) ? requestedKind as ManagerOperationalActionKindFilter : "all";
    return NextResponse.json(await listManagerActions(session, filter, kind), { headers });
  } catch (error) {
    if (error instanceof ClientRequestError) return NextResponse.json({ message: error.message }, { status: error.status, headers });
    if (error instanceof LevyTateManagerScopeError) {
      return NextResponse.json({ message: "Line Manager access is required." }, { status: 403, headers });
    }
    logLevyTateServerError("manager-actions", error);
    return NextResponse.json({ error: "manager_actions_failed", message: "Your actions are temporarily unavailable. Please try again." }, { status: 503, headers });
  }
}
