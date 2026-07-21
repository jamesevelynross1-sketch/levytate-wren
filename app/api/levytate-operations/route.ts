import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { levytateBetaSessionCookie } from "@/lib/levytate/config/beta-access";
import { readAuthorisedLevyTateBetaSession } from "@/lib/server/levytate-authorised-session";
import { LevyTateLearnerLifecycleError, LevyTateLearnerLifecyclePermissionError } from "@/lib/server/levytate-learner-lifecycle";
import { getOrganisationOperationsSummary, type OperationsQuery } from "@/lib/server/levytate-operations";
import { logLevyTateServerError, operationalActionsRefreshError } from "@/lib/server/levytate-safe-api-error";

async function getSession() {
  const cookieStore = await cookies();
  return readAuthorisedLevyTateBetaSession(cookieStore.get(levytateBetaSessionCookie)?.value);
}

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: "Unauthorised." }, { status: 401 });

  const url = new URL(request.url);
  const query: OperationsQuery = {
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

  try {
    const operations = await getOrganisationOperationsSummary(session, query, {
      synchronise: url.searchParams.get("synchronise") === "true",
    });
    return NextResponse.json({ ok: true, ...operations });
  } catch (error) {
    const status = error instanceof LevyTateLearnerLifecyclePermissionError
      ? 403
      : error instanceof LevyTateLearnerLifecycleError
        ? 404
        : 500;
    if (status === 500) {
      logLevyTateServerError("operations-summary", error);
      return NextResponse.json(operationalActionsRefreshError, { status });
    }
    const message = status === 403
      ? "You do not have access to organisation operations."
      : "Operations data was not found.";
    return NextResponse.json({ message }, { status });
  }
}

function value(url: URL, key: string) {
  return url.searchParams.get(key)?.trim() || undefined;
}

function assignmentValue(url: URL) {
  const value = url.searchParams.get("assignment")?.trim();
  return value === "mine" || value === "unassigned" || value === "shared" || value === "all" ? value : undefined;
}
