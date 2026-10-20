import type { LevyTateBetaSession } from "@/lib/levytate/config/beta-access";
import { buildEmployerIntelligence } from "@/lib/levytate/intelligence/build";
import type { EmployerIntelligenceResponse } from "@/lib/levytate/intelligence/types";
import { normaliseMvpUserRole } from "@/lib/levytate/mvp/rbac";
import { getAssessmentWorkspaceForSession } from "@/lib/server/levytate-assessments";
import { getOrganisationFinanceState } from "@/lib/server/levytate-finance";
import { getLearnerLifecycleServerContext, LevyTateLearnerLifecyclePermissionError } from "@/lib/server/levytate-learner-lifecycle";
import { getOrganisationOperationsSummary } from "@/lib/server/levytate-operations";
import { getWorkspaceBootstrapForSession } from "@/lib/server/levytate-workspace";

export class LevyTateEmployerIntelligenceError extends Error {
  constructor(message: string, readonly status = 500) {
    super(message);
    this.name = "LevyTateEmployerIntelligenceError";
  }
}

export async function getEmployerIntelligenceForSession(session: LevyTateBetaSession): Promise<EmployerIntelligenceResponse> {
  const context = await getLearnerLifecycleServerContext(session);
  const role = normaliseMvpUserRole(context.user.role);
  if (role !== "Apprenticeship Lead" && role !== "Employer Admin") {
    throw new LevyTateLearnerLifecyclePermissionError(`${role} cannot access organisation-wide employer intelligence.`);
  }

  const [workspaceResult, operationsResult, assessmentsResult, financeResult] = await Promise.allSettled([
    getWorkspaceBootstrapForSession(session),
    getOrganisationOperationsSummary(session),
    getAssessmentWorkspaceForSession(session),
    getOrganisationFinanceState(session),
  ]);
  if (workspaceResult.status === "rejected") {
    throw new LevyTateEmployerIntelligenceError("The authorised employer workspace could not be loaded.", 503);
  }

  return buildEmployerIntelligence({
    workspace: { ok: true, value: workspaceResult.value },
    operations: settledSource(operationsResult, "Operations Centre information is currently unavailable."),
    assessments: settledSource(assessmentsResult, "Workforce assessment information is currently unavailable."),
    finance: settledSource(financeResult, "Levy finance information is currently unavailable."),
  });
}

function settledSource<T>(result: PromiseSettledResult<T>, message: string): { ok: true; value: T } | { ok: false; message: string } {
  return result.status === "fulfilled" ? { ok: true, value: result.value } : { ok: false, message };
}
