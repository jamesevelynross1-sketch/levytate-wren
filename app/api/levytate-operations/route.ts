import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { levytateBetaSessionCookie } from "@/lib/levytate/config/beta-access";
import { readAuthorisedLevyTateBetaSession } from "@/lib/server/levytate-authorised-session";
import { LevyTateLearnerLifecycleError, LevyTateLearnerLifecyclePermissionError } from "@/lib/server/levytate-learner-lifecycle";
import { getOrganisationOperationsSummary, type OperationsQuery } from "@/lib/server/levytate-operations";
import { logLevyTateServerError, operationalActionsRefreshError } from "@/lib/server/levytate-safe-api-error";
import { ClientRequestError, readAuthenticatedJson, requireActionKeys } from "@/lib/server/levytate-request-boundary";

const headers = { "Cache-Control": "private, no-store, max-age=0" };

async function getSession() {
  const cookieStore = await cookies();
  return readAuthorisedLevyTateBetaSession(cookieStore.get(levytateBetaSessionCookie)?.value);
}

export async function GET(request: Request) {
  return respond(request, false);
}

export async function POST(request: Request) {
  return respond(request, true);
}

async function respond(request: Request, synchronise: boolean) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ message: "Unauthorised." }, { status: 401, headers });
    const url = new URL(request.url);
    if (url.searchParams.has("synchronise")) {
      throw new ClientRequestError("Refresh operations using the authenticated POST action, not a query parameter.", 400);
    }
    if (synchronise) {
      const body = await readAuthenticatedJson(request, session.email, 1024);
      requireActionKeys(body, []);
    }
    const operations = await getOrganisationOperationsSummary(session, queryFor(url), { synchronise });
    return NextResponse.json({ ok: true, ...operations }, { headers });
  } catch (error) {
    if (error instanceof ClientRequestError) return NextResponse.json({ message: error.message }, { status: error.status, headers });
    const status = error instanceof LevyTateLearnerLifecyclePermissionError
      ? 403
      : error instanceof LevyTateLearnerLifecycleError
        ? 404
        : 503;
    if (status === 503) {
      logLevyTateServerError("operations-summary", error);
      return NextResponse.json(operationalActionsRefreshError, { status, headers });
    }
    const message = status === 403
      ? "You do not have access to organisation operations."
      : "Operations data was not found.";
    return NextResponse.json({ message }, { status, headers });
  }
}

function queryFor(url: URL): OperationsQuery {
  return {
    priority: value(url, "priority"),
    queue: value(url, "queue"),
    learner: value(url, "learner"),
    programme: value(url, "programme"),
    provider: value(url, "provider"),
    site: value(url, "site"),
    department: value(url, "department"),
    owner: value(url, "owner"),
    dueStatus: value(url, "dueStatus"),
    status: value(url, "status"),
    actionType: value(url, "actionType"),
    assignment: assignmentValue(url),
    search: value(url, "search"),
  };
}

function value(url: URL, key: string) {
  return url.searchParams.get(key)?.trim() || undefined;
}

function assignmentValue(url: URL) {
  const value = url.searchParams.get("assignment")?.trim();
  return value === "mine" || value === "unassigned" || value === "shared" || value === "all" ? value : undefined;
}
