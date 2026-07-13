import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { levytateBetaSessionCookie, readLevyTateBetaSession } from "@/lib/levytate/config/beta-access";
import { LevyTateLearnerLifecyclePermissionError } from "@/lib/server/levytate-learner-lifecycle";
import { getOperationalGovernanceSummary, type OperationalGovernanceQuery } from "@/lib/server/levytate-operational-governance";

export async function GET(request: Request) {
  const cookieStore = await cookies();
  const session = await readLevyTateBetaSession(cookieStore.get(levytateBetaSessionCookie)?.value);
  if (!session) return NextResponse.json({ message: "Unauthorised." }, { status: 401 });
  const url = new URL(request.url);
  const query: OperationalGovernanceQuery = {
    view: oneOf(url, "view", ["summary", "overdue", "unacknowledged", "stalled", "owners", "closed"]),
    status: value(url, "status"),
    priority: value(url, "priority"),
    owner: value(url, "owner"),
    actionType: value(url, "actionType"),
    sourceType: value(url, "sourceType"),
    learner: value(url, "learner"),
    programme: value(url, "programme"),
    provider: value(url, "provider"),
    ageingBand: value(url, "ageingBand"),
    overdue: oneOf(url, "overdue", ["overdue", "not_overdue"]),
    completionMethod: value(url, "completionMethod"),
    datePeriod: oneOf(url, "datePeriod", ["30", "90", "365", "custom"]),
    dateFrom: dateValue(url, "dateFrom"),
    dateTo: dateValue(url, "dateTo"),
    search: value(url, "search"),
    page: integerValue(url, "page"),
    pageSize: integerValue(url, "pageSize"),
  };
  try {
    return NextResponse.json({ ok: true, ...(await getOperationalGovernanceSummary(session, query)) });
  } catch (error) {
    const forbidden = error instanceof LevyTateLearnerLifecyclePermissionError;
    return NextResponse.json({
      message: forbidden ? "You do not have access to operational governance." : error instanceof Error ? error.message : "Operational governance is temporarily unavailable.",
    }, { status: forbidden ? 403 : 500 });
  }
}

function value(url: URL, key: string) {
  return url.searchParams.get(key)?.trim() || undefined;
}

function oneOf<T extends string>(url: URL, key: string, allowed: readonly T[]) {
  const candidate = value(url, key);
  return candidate && allowed.includes(candidate as T) ? candidate as T : undefined;
}

function dateValue(url: URL, key: string) {
  const candidate = value(url, key);
  return candidate && /^\d{4}-\d{2}-\d{2}$/.test(candidate) ? candidate : undefined;
}

function integerValue(url: URL, key: string) {
  const candidate = Number(value(url, key));
  return Number.isInteger(candidate) && candidate > 0 ? candidate : undefined;
}
