import { createHash } from "node:crypto";

import type { LevyTateBetaSession } from "@/lib/levytate/config/beta-access";
import { getApprenticeshipStandard } from "@/lib/levytate/domain";
import { deriveEmployeeOperationalSummary } from "@/lib/levytate/mvp/employee-operational-summary";
import { managerCheckInEligibleLifecycleStatuses } from "@/lib/levytate/mvp/manager-check-in";
import type {
  LevyTateAiRequest,
  LevyTateAiResponse,
  LevyTateCopilotResultColumn,
  LevyTateCopilotResultRow,
  LevyTateCopilotResultType,
  LevyTateOperationalCopilotContext,
  LevyTateOperationalCopilotFilters,
  LevyTateOperationalCopilotIntent,
} from "@/lib/levytate/ai/types";
import type { LearnerRecordDetail } from "@/lib/levytate/mvp/learner-record-view";
import type { LearnerReviewType } from "@/lib/levytate/mvp/learner-lifecycle";
import { buildOrganisationOperationalItems } from "@/lib/levytate/mvp/operations-centre";
import { normaliseMvpUserRole } from "@/lib/levytate/mvp/rbac";
import { activeApplicationStatuses } from "@/lib/levytate/mvp/workspace";
import { isOperationsCentreContext, resolveContextualCopilotIntent } from "@/lib/levytate/contextual-copilot-intent";
import {
  listOrganisationLearnerLifecycleDetails,
  listManagerDirectReportLearnerLifecycleDetails,
  getLearnerLifecycleServerContext,
  type LearnerLifecycleServerContext,
} from "@/lib/server/levytate-learner-lifecycle";
import { recordCopilotQueryAudit } from "@/lib/server/levytate-copilot-audit";
import {
  getManagerDirectReportContext,
  listManagerDirectReportApplications,
  type ManagerDirectReport,
  type ManagerDirectReportApplication,
  type ManagerDirectReportContext,
} from "@/lib/server/levytate-manager-scope";
import { deriveManagerOperationalContext } from "@/lib/server/levytate-manager-learner-detail";
import { listManagerActions } from "@/lib/server/levytate-manager-actions";
import { getOrganisationOperationsSummary } from "@/lib/server/levytate-operations";
import { getWorkspaceBootstrapForSession } from "@/lib/server/levytate-workspace";

const resultLimit = 25;
const operationalRoles = new Set(["Line Manager", "Apprenticeship Lead", "Employer Admin"]);
const managerOnlyIntents = new Set<LevyTateOperationalCopilotIntent>([
  "applications_awaiting_review", "applications_returned", "applications_approved", "application_status",
  "manager_check_ins", "employee_review_status", "employee_support", "team_summary",
]);
const monthNumbers: Record<string, number> = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
};

type ClassifiedQuery = {
  intent: LevyTateOperationalCopilotIntent;
  filters: LevyTateOperationalCopilotFilters;
  direct: boolean;
  contextResultKeys?: string[];
};

type ToolPayload = {
  type: LevyTateCopilotResultType;
  title: string;
  rows: LevyTateCopilotResultRow[];
  columns: LevyTateCopilotResultColumn[];
  totalCount?: number;
  interpretation?: string;
  emptyMessage: string;
  viewAllUrl?: string;
  assistantMessage?: string;
  followUpQuestion?: string | null;
  quickReplies?: string[];
  toolName?: string;
};

export async function routeOperationalCopilotQuery(
  session: LevyTateBetaSession,
  request: LevyTateAiRequest,
): Promise<LevyTateAiResponse | null> {
  const startedAt = performance.now();
  const classificationStarted = performance.now();
  const classification = classifyOperationalCopilotQuery(request.userMessage, request.operationalContext, request.currentSection);
  const intentClassificationMs = elapsed(classificationStarted);
  if (!classification) return null;

  let role: ReturnType<typeof normaliseMvpUserRole>;
  let serverContext: LearnerLifecycleServerContext;
  try {
    serverContext = await getLearnerLifecycleServerContext(session);
    role = normaliseMvpUserRole(serverContext.user.role);
  } catch (error) {
    console.error("LevyTate operational Copilot scope resolution failed", { intent: classification.intent, error });
    return responseForPayload(
      request,
      classification,
      {
        type: "data_unavailable",
        title: isOperationsCentreContext(request.currentSection) ? "Learner operations unavailable" : "Programme data unavailable",
        columns: [],
        rows: [],
        emptyMessage: isOperationsCentreContext(request.currentSection)
          ? "I couldn't read the current learner-operation data. Try opening Operations Centre again."
          : "I couldn't retrieve the programme data just now. Please try again.",
      },
      { intentClassificationMs, dataRetrievalMs: 0, startedAt },
    );
  }
  if (role === "Employee" && /\b(?:my|current)\s+(?:programme|program|pathway)\b/i.test(request.userMessage)) return null;
  if (managerOnlyIntents.has(classification.intent) && role !== "Line Manager") return null;
  const employeeProgrammeIntent = role === "Employee"
    && (classification.intent === "programme_directory" || classification.intent === "organisation_programmes");
  if (!operationalRoles.has(role) && !employeeProgrammeIntent) {
    return responseForPayload(
      request,
      classification,
      {
        type: "access_boundary",
        title: "Access boundary",
        columns: [],
        rows: [],
        emptyMessage: role === "Line Manager"
          ? "Your Copilot is scoped to your own team. Organisation-wide operational intelligence is available to Apprenticeship Leads."
          : "Your Copilot is scoped to your own apprenticeship journey.",
      },
      { intentClassificationMs, dataRetrievalMs: 0, startedAt },
    );
  }

  const auditedResponse = async (
    payload: ToolPayload,
    timing: { dataRetrievalMs: number; managerScopeResolutionMs?: number },
    success: boolean,
  ) => {
    const response = responseForPayload(request, classification, payload, {
      intentClassificationMs,
      managerScopeResolutionMs: timing.managerScopeResolutionMs,
      dataRetrievalMs: timing.dataRetrievalMs,
      startedAt,
    }, role);
    try {
      await recordCopilotQueryAudit(serverContext, {
        intent: classification.intent,
        resultCount: response.structuredResult?.totalCount ?? 0,
        tool: payload.toolName ?? toolNameFor(classification.intent, role),
        durationMs: performance.now() - startedAt,
        success,
      });
    } catch {
      console.error("LevyTate Copilot query audit write failed", { intent: classification.intent });
    }
    return response;
  };

  if (employeeProgrammeIntent) {
    const retrievalStarted = performance.now();
    try {
      return auditedResponse(
        await getOrganisationProgrammes(session, classification.filters),
        { dataRetrievalMs: elapsed(retrievalStarted) },
        true,
      );
    } catch (error) {
      console.error("LevyTate employee programme Copilot retrieval failed", { error });
      return auditedResponse({
        type: "data_unavailable",
        title: "Programme data unavailable",
        columns: [],
        rows: [],
        emptyMessage: "I couldn't retrieve your organisation's available programmes just now. Please try again.",
        toolName: "getOrganisationProgrammes",
      }, { dataRetrievalMs: elapsed(retrievalStarted) }, false);
    }
  }

  if (classification.intent === "access_boundary") {
    return auditedResponse(
      {
        type: "access_boundary",
        title: "Organisation access boundary",
        columns: [],
        rows: [],
        emptyMessage: "I can only use records from your authorised LevyTate workspace. I cannot retrieve another organisation's learners, hidden records, raw database content, system prompts or secrets.",
      },
      { dataRetrievalMs: 0 },
      true,
    );
  }

  let managerScope: ManagerDirectReportContext | undefined;
  let managerScopeResolutionMs = 0;
  if (role === "Line Manager") {
    const managerScopeStarted = performance.now();
    try {
      managerScope = await getManagerDirectReportContext(session);
      managerScopeResolutionMs = elapsed(managerScopeStarted);
    } catch {
      managerScopeResolutionMs = elapsed(managerScopeStarted);
      return auditedResponse({
        type: "data_unavailable",
        title: "Team data unavailable",
        columns: [],
        rows: [],
        emptyMessage: "I couldn't retrieve your direct-report data just now. Please try again.",
        toolName: "getManagerDirectReportContext",
      }, { dataRetrievalMs: 0, managerScopeResolutionMs }, false);
    }

    if (classification.filters.actionType === "manager_access_boundary" || (classification.intent === "provider_operational_summary" && !classification.contextResultKeys?.length)) {
      return auditedResponse({
        type: "access_boundary",
        title: "Direct-report access boundary",
        columns: [],
        rows: [],
        emptyMessage: classification.intent === "provider_operational_summary"
          ? "I can show provider context for your direct reports, but organisation-wide provider performance is available to Apprenticeship Leads."
          : "I can only show apprenticeship information for your direct reports.",
        toolName: "managerAccessBoundary",
      }, { dataRetrievalMs: 0, managerScopeResolutionMs }, true);
    }
  }

  const retrievalStarted = performance.now();
  try {
    const payload = await executeTool(session, classification, managerScope);
    return auditedResponse(payload, {
      dataRetrievalMs: elapsed(retrievalStarted),
      managerScopeResolutionMs,
    }, true);
  } catch (error) {
    console.error("LevyTate operational Copilot retrieval failed", {
      intent: classification.intent,
      role,
      error,
    });
    return auditedResponse(
      {
        type: "data_unavailable",
        title: role === "Line Manager" ? "Team data unavailable" : isOperationsCentreContext(request.currentSection) ? "Learner operations unavailable" : "Programme data unavailable",
        columns: [],
        rows: [],
        emptyMessage: role === "Line Manager"
          ? "I couldn't retrieve your direct-report data just now. Please try again."
          : isOperationsCentreContext(request.currentSection)
            ? "I couldn't read the current learner-operation data. Try opening Operations Centre again."
            : "I couldn't retrieve the programme data just now. Please try again.",
        toolName: toolNameFor(classification.intent, role),
      },
      { dataRetrievalMs: elapsed(retrievalStarted), managerScopeResolutionMs },
      false,
    );
  }
}

export function classifyOperationalCopilotQuery(
  message: string,
  previous?: LevyTateOperationalCopilotContext,
  currentSection?: string,
): ClassifiedQuery | null {
  const text = normalise(message);
  const prior = previous?.activeIntent;
  const priorFilters = previous?.filters ?? {};

  const contextual = resolveContextualCopilotIntent({ message: text, currentSection });
  if (contextual) return contextual;

  if (/^retry$/.test(text) && prior) return { intent: prior, filters: priorFilters, direct: true };
  if (/\b(another organisation|other organisation|different organisation|organisation id|raw database|database rows?|service role|system prompt|hidden tool|secret|ignore (all|previous) instructions|bypass (access|permissions?))\b/.test(text)) {
    return { intent: "access_boundary", filters: {}, direct: true };
  }
  if (/\b(another manager|other manager|every learner in|all learners in|all provider performance|hr approval records? for the organisation)\b/.test(text)) {
    return { intent: "team_summary", filters: { actionType: "manager_access_boundary" }, direct: true };
  }
  const employeeName = extractEmployeeName(text);
  if (/\b(applications?).{0,35}(need|needs|awaiting|require).{0,20}(my review|review|approval)|\bwhich applications need my review\b/.test(text)) {
    return { intent: "applications_awaiting_review", filters: { applicationState: "awaiting_review" }, direct: true };
  }
  if (/\b(responded|resubmitted|returned).{0,35}(more information|requested information)|\bmore information.{0,35}(responded|resubmitted|returned)\b/.test(text)) {
    return { intent: "applications_returned", filters: { applicationState: "returned" }, direct: true };
  }
  if (/\b(applications?).{0,35}(i have approved|i approved|approved by me)|\bwhich applications have i approved\b/.test(text)) {
    return { intent: "applications_approved", filters: { applicationState: "approved" }, direct: true };
  }
  if (employeeName && /\b(current status|current stage|where.*apprenticeship journey)\b/.test(text)) {
    return { intent: "application_status", filters: { employeeName, actionType: "operational_status" }, direct: true };
  }
  if (employeeName && /\b(application|edit the application|can't edit|cannot edit|happens next)\b/.test(text)) {
    return { intent: "application_status", filters: { employeeName, applicationState: "active" }, direct: true };
  }
  if (employeeName && /\b(latest review|next provider review|review status|last review)\b/.test(text)) {
    return { intent: "employee_review_status", filters: { employeeName, reviewDueState: /next provider/.test(text) ? "due_soon" : "latest" }, direct: true };
  }
  if (employeeName && /\b(need from me|needs from me|support.*need|what.*support)\b/.test(text)) {
    return { intent: "employee_support", filters: { employeeName }, direct: true };
  }
  if (/\b(summarise|summarize).{0,40}(activity|apprenticeship).{0,20}(my team|team)|\bhow many direct reports.{0,35}(applications?|enrolled)|\bactivity in my team\b/.test(text)) {
    return { intent: "team_summary", filters: {}, direct: true };
  }
  if (/\b(which programmes?|programmes?).{0,30}(represented|in my team|team)\b/.test(text)) {
    return { intent: "programme_operational_summary", filters: { actionType: "team_programmes" }, direct: true };
  }
  if (/\b(manager check.?ins?|check.?ins?).{0,30}(need|needed|due|overdue|soon)|\bwho needs a manager check.?in\b/.test(text)) {
    return {
      intent: "manager_check_ins",
      filters: {
        reviewType: "manager_check_in",
        reviewDueState: /due soon|approaching/.test(text) ? "due_soon" : /overdue|late/.test(text) ? "overdue" : undefined,
        actionType: prior ? `context:${prior}` : undefined,
      },
      direct: true,
      contextResultKeys: previous?.resultKeys,
    };
  }
  if (/\b(which providers?|providers?)\b/.test(text) && /\b(they|them|those|these learners?)\b/.test(text) && prior) {
    return { intent: "provider_operational_summary", filters: { ...priorFilters, actionType: `context:${prior}` }, direct: true, contextResultKeys: previous?.resultKeys };
  }
  const providerLearnerCount = text.match(/\bhow many\s+([a-z0-9&.' -]+?)\s+learners?\b/);
  if (providerLearnerCount) {
    return { intent: "provider_operational_summary", filters: { provider: providerLearnerCount[1].trim() }, direct: true };
  }
  if (/\b(which|what|show|list)\b.*\b(providers?)\b.*\b(we use|our|my providers?)\b|\b(my|our) providers?\b/.test(text)) {
    return { intent: "organisation_providers", filters: {}, direct: true };
  }
  if (/\bprogrammes\b.*\b(available to|published for)\b.*\b(our )?employees?\b|\b(my|our) programmes\b/.test(text)) {
    return { intent: "organisation_programmes", filters: {}, direct: true };
  }
  if (/\b(programmes?|providers?)\b/.test(text)
    && /\b(show|which|find|browse|available|offer|offers|level|nationally|national|remote|online|blended|classroom|workplace)\b/.test(text)
    && !/\b(team|direct reports?|represented|activity|active learners?|performance|reviews?|issues?)\b/.test(text)) {
    const level = text.match(/\blevel\s*(\d+)\b/)?.[1];
    const deliveryModel = text.match(/\b(remote|online|blended|classroom|workplace(?: learning)?)\b/)?.[1];
    const namedProvider = text.match(/\b(?:does|do)\s+([a-z0-9&.' -]+?)\s+(?:offer|provide)\b/)?.[1]?.trim();
    const query = /\bdata analyst\b/.test(text) ? "data analyst" : /\bai\b|artificial intelligence/.test(text) ? "ai" : namedProvider;
    return { intent: "programme_directory", filters: { query, level, deliveryModel, region: /\bnational|nationally\b/.test(text) ? "national" : undefined }, direct: true };
  }
  if (/\b(only|just)\b.*\bsignificantly behind\b|\bsignificantly behind\b/.test(text) && prior === "learners_behind_target") {
    return { intent: "learners_behind_target", filters: { ...priorFilters, progressPosition: "Significantly behind" }, direct: true };
  }
  if (/\b(no recent progress|without (a )?recent progress|progress update.{0,20}(overdue|missing)|no progress update)\b/.test(text)) {
    return { intent: "learners_without_recent_progress", filters: {}, direct: true };
  }
  if (/\b(behind schedule|behind target|behind their target|progress behind|significantly behind)\b/.test(text)) {
    return {
      intent: "learners_behind_target",
      filters: { progressPosition: /significantly/.test(text) ? "Significantly behind" : undefined, employeeName },
      direct: true,
      contextResultKeys: prior === "learners_behind_target" ? previous?.resultKeys : undefined,
    };
  }
  if (/\b(provider reviews?|l&d check.?ins?|manager check.?ins?|reviews?)\b.*\b(overdue|late)\b|\b(overdue|late)\b.*\b(provider reviews?|reviews?)\b|\bproviders?\b.*\b(overdue|late)\b.*\breviews?\b/.test(text)) {
    const reviewType = /provider/.test(text) ? "provider_review" : /l&d|learning and development/.test(text) ? "l_and_d_check_in" : /manager/.test(text) ? "manager_check_in" : undefined;
    if (/which providers|provider performance|provider issues/.test(text)) {
      return { intent: "provider_operational_summary", filters: { reviewType }, direct: true };
    }
    return { intent: "overdue_reviews", filters: { reviewType }, direct: true };
  }
  if (/\b(ready to enrol|ready for enrolment|ready to be enrolled)\b/.test(text)) {
    return { intent: "ready_to_enrol", filters: {}, direct: true };
  }
  if (/\b(waiting for hr|hr approval|pre.?enrolment blocker|enrolment blocker)\b/.test(text)) {
    return { intent: "pre_enrolment_blockers", filters: { blocker: /hr/.test(text) ? "HR approval" : undefined }, direct: true };
  }
  if (/\b(overdue return|return date.{0,20}overdue|overdue.{0,20}return)\b/.test(text)) {
    return { intent: "active_breaks", filters: { dueState: "overdue" }, direct: true };
  }
  if (/\b(return|returning).{0,25}(soon|due soon|next)\b/.test(text)) {
    return { intent: "active_breaks", filters: { dueState: "due_soon" }, direct: true };
  }
  if (/\b(break in learning|on a break|active breaks?)\b/.test(text)) {
    return { intent: "active_breaks", filters: {}, direct: true };
  }
  if (/\b(ready to enter assessment|ready for assessment|enter assessment)\b/.test(text)) {
    return { intent: "assessment_readiness", filters: { assessmentState: "ready" }, direct: true };
  }
  if (/\b(approaching assessment|assessment readiness|gateway)\b/.test(text)) {
    return { intent: "assessment_readiness", filters: { assessmentState: "approaching" }, direct: true };
  }
  if (/\b(assessment preparation|in assessment preparation)\b/.test(text)) {
    return { intent: "assessment_readiness", filters: { assessmentState: "preparation" }, direct: true };
  }
  if (/\b(already in assessment|currently in assessment|who is in assessment)\b/.test(text)) {
    return { intent: "assessment_readiness", filters: { assessmentState: "in_assessment" }, direct: true };
  }
  if (/\b(readiness checks?).{0,25}(involve me|need me|line manager)\b/.test(text)) {
    return { intent: "assessment_readiness", filters: { assessmentState: "all", actionType: "line_manager_readiness" }, direct: true };
  }
  if (/\b(summarise|summarize|show).{0,20}(recent )?(operational )?activity\b/.test(text)) {
    return { intent: "operational_actions", filters: { dueState: "recent_activity" }, direct: true };
  }
  if (/\b(show|list)?\s*(all )?(open|outstanding)\s+(operational )?(actions?|tasks?)\b/.test(text)) {
    return { intent: "operational_actions", filters: { status: "open" }, direct: true };
  }
  if (/\b(ending|end|finish|finishing|complete|completion)\b.*\b(before|by|next|soon|within)\b/.test(text)) {
    return { intent: "learners_ending_before", filters: { dateBefore: extractDateBefore(text) }, direct: true };
  }
  if (/\b(actions?|tasks?)\b.*\b(assigned to me|my|mine)\b/.test(text)) {
    return { intent: "operational_actions", filters: { owner: "mine", status: "open" }, direct: true };
  }
  if (/\b(actions?|tasks?)\b.*\b(overdue|late)\b|\b(overdue|late)\b.*\b(actions?|tasks?)\b/.test(text)) {
    return { intent: "operational_actions", filters: { owner: "mine", status: "open", dueState: "overdue" }, direct: true };
  }
  if (/\bsupport actions?.{0,25}(my team|team|direct reports?)\b/.test(text)) {
    return { intent: "operational_actions", filters: { status: "open", actionType: "team_support" }, direct: true };
  }
  if (/\bcritical\b.*\b(actions?|tasks?)\b|\b(actions?|tasks?)\b.*\bcritical\b/.test(text)) {
    return { intent: "operational_actions", filters: { priority: "Critical", status: "open" }, direct: true };
  }
  if (/\b(what|which).{0,25}(needs?|requires?).{0,20}attention( today)?\b|\battention today\b/.test(text)) {
    return { intent: "operational_actions", filters: { dueState: "attention_today", status: "open" }, direct: true };
  }
  if (/\b(programmes?).{0,30}(most active learners|active learners|summary|activity)\b/.test(text)) {
    return { intent: "programme_operational_summary", filters: {}, direct: true };
  }
  if (/\b(provider performance|provider issues|providers?).{0,30}(summary|issues|activity|performance)\b/.test(text)) {
    return { intent: "provider_operational_summary", filters: {}, direct: true };
  }
  return null;
}

async function executeTool(
  session: LevyTateBetaSession,
  query: ClassifiedQuery,
  managerScope?: ManagerDirectReportContext,
): Promise<ToolPayload> {
  if (managerScope) return executeManagerTool(session, query, managerScope);
  switch (query.intent) {
    case "learners_needing_attention": return getLearnersNeedingAttention(session);
    case "highest_risk_actions": return getHighestRiskActions(session);
    case "applications_awaiting_review":
    case "applications_returned":
    case "applications_approved":
    case "application_status":
    case "manager_check_ins":
    case "employee_review_status":
    case "employee_support":
    case "team_summary":
      throw new Error("Manager tools require a verified manager scope.");
    case "learners_behind_target": return getLearnersBehindTarget(session, query.filters);
    case "learners_without_recent_progress": return getLearnersWithoutRecentProgress(session);
    case "learners_ending_before": return getLearnersEndingBefore(session, query.filters.dateBefore ?? defaultDateBefore());
    case "overdue_reviews": return getOverdueReviews(session, query.filters);
    case "ready_to_enrol": return getReadyToEnrolLearners(session);
    case "pre_enrolment_blockers": return getPreEnrolmentBlockers(session, query.filters);
    case "active_breaks": return getActiveBreaksInLearning(session, query.filters);
    case "assessment_readiness": return getAssessmentReadiness(session, query.filters);
    case "operational_actions": return getOperationalActions(session, query.filters);
    case "provider_operational_summary": return getProviderOperationalSummary(session, query.filters, query.contextResultKeys);
    case "programme_operational_summary": return getProgrammeOperationalSummary(session);
    case "organisation_providers": return getOrganisationProviders(session);
    case "organisation_programmes": return getOrganisationProgrammes(session);
    case "programme_directory": return getProgrammeDirectory(session, query.filters);
    case "access_boundary": throw new Error("Access boundary is handled before tool execution.");
  }
}

async function executeManagerTool(
  session: LevyTateBetaSession,
  query: ClassifiedQuery,
  scope: ManagerDirectReportContext,
): Promise<ToolPayload> {
  switch (query.intent) {
    case "learners_needing_attention":
    case "highest_risk_actions":
      return managerAccessBoundary("Organisation-wide Operations Centre intelligence is available to Apprenticeship Leads.");
    case "applications_awaiting_review": return getManagerApplications(session, scope, "awaiting_review", query.filters.employeeName);
    case "applications_returned": return getManagerApplications(session, scope, "returned", query.filters.employeeName);
    case "applications_approved": return getManagerApplications(session, scope, "approved", query.filters.employeeName);
    case "application_status": return query.filters.actionType === "operational_status"
      ? getManagerEmployeeOperationalStatus(session, query.filters, scope)
      : getManagerApplications(session, scope, "active", query.filters.employeeName);
    case "learners_behind_target": return getLearnersBehindTarget(session, query.filters, scope, query.contextResultKeys);
    case "learners_without_recent_progress": return getLearnersWithoutRecentProgress(session, scope);
    case "learners_ending_before": return getLearnersEndingBefore(session, query.filters.dateBefore ?? defaultDateBefore(), scope);
    case "overdue_reviews": return getOverdueReviews(session, query.filters, scope);
    case "manager_check_ins": return getManagerCheckIns(session, query.filters, scope, query.contextResultKeys);
    case "employee_review_status": return getManagerEmployeeReviewStatus(session, query.filters, scope);
    case "employee_support": return getManagerEmployeeSupport(session, query.filters, scope);
    case "active_breaks": return getActiveBreaksInLearning(session, query.filters, scope);
    case "assessment_readiness": return getAssessmentReadiness(session, query.filters, scope);
    case "operational_actions": return getManagerOperationalActions(session, query.filters, scope);
    case "provider_operational_summary": return getProviderOperationalSummary(session, query.filters, query.contextResultKeys, scope);
    case "organisation_providers":
    case "organisation_programmes":
      return managerAccessBoundary("Employer catalogue administration is available to Apprenticeship Leads. I can show provider and programme context for your direct reports.");
    case "programme_operational_summary": return getProgrammeOperationalSummary(session, scope);
    case "programme_directory": return getProgrammeDirectory(session, query.filters);
    case "team_summary": return getManagerTeamSummary(session, scope);
    case "ready_to_enrol":
    case "pre_enrolment_blockers":
      return managerAccessBoundary("This enrolment workflow is managed by the Apprenticeship Lead.");
    case "access_boundary": return managerAccessBoundary("I can only show apprenticeship information for your direct reports.");
  }
}

export async function getLearnersBehindTarget(
  session: LevyTateBetaSession,
  filters: LevyTateOperationalCopilotFilters = {},
  managerScope?: ManagerDirectReportContext,
  contextResultKeys?: string[],
): Promise<ToolPayload> {
  const scoped = await managerDetailsForQuery(session, managerScope, filters.employeeName, contextResultKeys);
  if (scoped.payload) return scoped.payload;
  const details = scoped.details;
  const matches = details.filter((detail) =>
    (detail.progressPosition === "Slightly behind" || detail.progressPosition === "Significantly behind")
    && (!filters.progressPosition || detail.progressPosition === filters.progressPosition)
  );
  const significant = matches.filter((detail) => detail.progressPosition === "Significantly behind").length;
  return learnerPayload(
    filters.progressPosition ? "Learners significantly behind target" : "Learners behind target",
    matches,
    [
      col("learner", "Learner"), col("programme", "Programme"), col("target", "Target", "right"),
      col("actual", "Actual", "right"), col("variance", "Variance", "right"), col("latestUpdate", "Latest update"), col("supportAction", "Support action"),
    ],
    (detail) => ({
      learner: detail.learner.name,
      programme: detail.programme.programmeName,
      target: percent(detail.latestProgress?.targetProgressPercentage),
      actual: percent(detail.latestProgress?.actualProgressPercentage),
      variance: points(detail.latestProgress?.variancePercentage),
      latestUpdate: displayDate(detail.latestProgress?.updateDate),
      supportAction: detail.latestProgress?.supportAction || "No support action recorded",
    }),
    filters.progressPosition
      ? `All ${matches.length} matching learner${plural(matches.length)} are significantly behind target.`
      : significant ? `${significant} ${significant === 1 ? "is" : "are"} significantly behind and should be prioritised.` : "No learner in this result is significantly behind.",
    filters.progressPosition ? "No learners are currently significantly behind target." : "No learners are currently behind target.",
    "/levytate/app?module=Learners",
    "Add progress update",
    managerScope,
  );
}

export async function getLearnersWithoutRecentProgress(session: LevyTateBetaSession, managerScope?: ManagerDirectReportContext): Promise<ToolPayload> {
  const details = managerScope
    ? await listManagerDirectReportLearnerLifecycleDetails(session, managerScope)
    : await listOrganisationLearnerLifecycleDetails(session);
  const missingIds = managerScope
    ? new Set(buildOrganisationOperationalItems(details).items.filter((item) => item.sourceCondition === "progress_overdue").map((item) => item.learnerRecordId))
    : new Set((await getOrganisationOperationsSummary(session)).queues.progress.filter((item) => item.sourceCondition === "progress_overdue").map((item) => item.learnerRecordId));
  const matches = details.filter((detail) => missingIds.has(detail.learnerRecordId));
  return learnerPayload(
    "Learners without a recent progress update",
    matches,
    [col("learner", "Learner"), col("programme", "Programme"), col("latestUpdate", "Latest update"), col("status", "Status"), col("nextAction", "Next action")],
    (detail) => ({ learner: detail.learner.name, programme: detail.programme.programmeName, latestUpdate: displayDate(detail.latestProgress?.updateDate), status: detail.latestProgress ? "Progress update overdue" : "No progress recorded", nextAction: "Add progress update" }),
    "These learners have no progress update within the current LevyTate progress-monitoring window.",
    "Every active learner has a recent progress update.",
    "/levytate/app?module=Learners",
    "Add progress update",
    managerScope,
  );
}

export async function getLearnersEndingBefore(session: LevyTateBetaSession, dateBefore: string, managerScope?: ManagerDirectReportContext): Promise<ToolPayload> {
  const details = managerScope
    ? await listManagerDirectReportLearnerLifecycleDetails(session, managerScope)
    : await listOrganisationLearnerLifecycleDetails(session);
  const matches = details.filter((detail) => detail.expectedEndDate && detail.expectedEndDate < dateBefore);
  const payload = learnerPayload(
    `Learners ending before ${displayDate(dateBefore)}`,
    matches,
    [col("learner", "Learner"), col("programme", "Programme"), col("expectedEnd", "Expected end"), col("lifecycle", "Lifecycle"), col("progress", "Progress position")],
    (detail) => ({ learner: detail.learner.name, programme: detail.programme.programmeName, expectedEnd: displayDate(detail.expectedEndDate), lifecycle: detail.lifecycleStatusLabel, progress: detail.progressPosition }),
    "Results use each learner's current expected programme end date.",
    `No apprentices are expected to end before ${displayDate(dateBefore)}.`,
    "/levytate/app?module=Learners",
    undefined,
    managerScope,
  );
  return payload;
}

export async function getOverdueReviews(session: LevyTateBetaSession, filters: LevyTateOperationalCopilotFilters = {}, managerScope?: ManagerDirectReportContext): Promise<ToolPayload> {
  const details = managerScope
    ? await listManagerDirectReportLearnerLifecycleDetails(session, managerScope)
    : await listOrganisationLearnerLifecycleDetails(session);
  const reviewTypes: Array<{ key: "provider" | "lAndD" | "manager"; type: LearnerReviewType; label: string }> = [
    { key: "provider", type: "provider_review", label: "Provider review" },
    { key: "lAndD", type: "l_and_d_check_in", label: "L&D check-in" },
    { key: "manager", type: "manager_check_in", label: "Manager check-in" },
  ];
  const rows = details.flatMap((detail) => reviewTypes.flatMap(({ key, type, label }) => {
    if (filters.reviewType && filters.reviewType !== type) return [];
    const summary = detail.reviewSummaries[key];
    if (!summary.overdue) return [];
    return [{
      key: managerScope
        ? authorisedManagerResultKey(managerScope, "review", `${detail.learnerRecordId}:${type}`)
        : `${detail.learnerRecordId}:${type}`,
      cells: {
        learner: detail.learner.name,
        programme: detail.programme.programmeName,
        provider: detail.programme.providerName,
        reviewType: label,
        lastReview: displayDate(summary.latest?.reviewDate),
        expectedReview: displayDate(summary.nextDate),
        daysOverdue: daysOverdue(summary.nextDate),
      },
      actions: learnerActions(detail, "Record review", managerScope),
    }];
  }));
  return payloadFromRows({
    type: "learner_results",
    title: filters.reviewType === "provider_review" ? "Overdue provider reviews" : "Overdue reviews and check-ins",
    rows,
    columns: [col("learner", "Learner"), col("programme", "Programme"), col("provider", "Provider"), col("reviewType", "Review type"), col("lastReview", "Last review"), col("expectedReview", "Expected"), col("daysOverdue", "Days overdue", "right")],
    interpretation: "The most overdue reviews should be addressed first, particularly where support actions are already open.",
    emptyMessage: filters.reviewType === "provider_review" ? "No provider reviews are currently overdue." : "No reviews or check-ins are currently overdue.",
    viewAllUrl: managerScope ? "/levytate/app?module=My%20Team" : "/levytate/app?module=Learners",
    toolName: managerScope ? "getManagerOverdueReviews" : "getOverdueReviews",
  });
}

export async function getReadyToEnrolLearners(session: LevyTateBetaSession): Promise<ToolPayload> {
  const operations = await getOrganisationOperationsSummary(session);
  const items = operations.queues.ready_to_enrol;
  return operationalLearnerPayload(
    "Learners ready to enrol",
    items,
    [col("learner", "Learner"), col("programme", "Programme"), col("provider", "Provider"), col("readiness", "Readiness"), col("detected", "Detected")],
    (item) => ({ learner: item.learnerName, programme: item.programmeName, provider: item.providerName, readiness: item.readinessSummary || item.reason, detected: displayDate(item.persistentDetectedAt) }),
    "All mandatory pre-enrolment checks are complete for these learners.",
    "No learners are currently ready to enrol.",
  );
}

export async function getPreEnrolmentBlockers(session: LevyTateBetaSession, filters: LevyTateOperationalCopilotFilters = {}): Promise<ToolPayload> {
  const operations = await getOrganisationOperationsSummary(session);
  const items = [...operations.queues.pre_enrolment, ...operations.queues.urgent]
    .filter((item, index, all) => item.sourceType === "pre_enrolment_readiness" && all.findIndex((candidate) => candidate.sourceKey === item.sourceKey) === index)
    .filter((item) => !filters.blocker || item.reason.toLowerCase().includes(filters.blocker.toLowerCase()));
  return operationalLearnerPayload(
    filters.blocker ? `${filters.blocker} blockers` : "Pre-enrolment blockers",
    items,
    [col("learner", "Learner"), col("blocker", "Blocker"), col("owner", "Owner"), col("age", "Age"), col("nextAction", "Next action")],
    (item) => ({ learner: item.learnerName, blocker: item.reason, owner: item.ownerType, age: ageLabel(item.persistentDetectedAt), nextAction: item.actionLabel }),
    "These outstanding checks are preventing enrolment from progressing.",
    filters.blocker ? `No learners are currently waiting for ${filters.blocker}.` : "No pre-enrolment blockers are currently open.",
  );
}

export async function getActiveBreaksInLearning(session: LevyTateBetaSession, filters: LevyTateOperationalCopilotFilters = {}, managerScope?: ManagerDirectReportContext): Promise<ToolPayload> {
  const details = managerScope
    ? await listManagerDirectReportLearnerLifecycleDetails(session, managerScope)
    : await listOrganisationLearnerLifecycleDetails(session);
  const matches = details.filter((detail) => detail.activeBreak)
    .filter((detail) => filters.dueState !== "overdue" || detail.breakAttention.state === "overdue")
    .filter((detail) => filters.dueState !== "due_soon" || detail.breakAttention.state === "approaching");
  return learnerPayload(
    filters.dueState === "overdue" ? "Overdue Break in Learning returns" : "Active Breaks in Learning",
    matches,
    [col("learner", "Learner"), col("programme", "Programme"), col("breakStart", "Break start"), col("expectedReturn", "Expected return"), col("attention", "Attention"), col("daysOverdue", "Days overdue", "right")],
    (detail) => ({ learner: detail.learner.name, programme: detail.programme.programmeName, breakStart: displayDate(detail.activeBreak?.startDate), expectedReturn: displayDate(detail.activeBreak?.expectedReturnDate), attention: detail.breakAttention.label, daysOverdue: Math.max(0, -(detail.breakAttention.daysUntilReturn ?? 0)) }),
    "Return dates and support confirmations determine the current attention state.",
    filters.dueState === "overdue" ? "No Break in Learning return dates are currently overdue." : "No learners are currently on a Break in Learning.",
    "/levytate/app?module=Learners",
    "Manage break",
    managerScope,
  );
}

export async function getAssessmentReadiness(session: LevyTateBetaSession, filters: LevyTateOperationalCopilotFilters = {}, managerScope?: ManagerDirectReportContext): Promise<ToolPayload> {
  const details = managerScope
    ? await listManagerDirectReportLearnerLifecycleDetails(session, managerScope)
    : await listOrganisationLearnerLifecycleDetails(session);
  const cutoff = addDays(toDate(new Date()), 60);
  const matches = details.filter((detail) => {
    const readiness = detail.assessmentReadiness;
    if (!readiness) return false;
    if (filters.assessmentState === "ready") return detail.lifecycleStatus === "assessment_preparation" && readiness.assessmentStatus === "readiness_confirmed";
    if (filters.assessmentState === "preparation") return detail.lifecycleStatus === "assessment_preparation";
    if (filters.assessmentState === "in_assessment") return detail.lifecycleStatus === "in_assessment";
    if (filters.actionType === "line_manager_readiness") return ["awaiting_confirmation", "more_information_required", "not_confirmed"].includes(readiness.confirmations.line_manager.status);
    if (filters.assessmentState === "approaching") {
      const date = readiness.expectedAssessmentReadinessDate || readiness.gatewayDate;
      return Boolean(date && date <= cutoff && readiness.assessmentStatus !== "in_assessment");
    }
    return true;
  });
  return learnerPayload(
    filters.assessmentState === "ready" ? "Learners ready to enter assessment" : "Learners approaching assessment",
    matches,
    [col("learner", "Learner"), col("programme", "Programme"), col("readinessDate", "Readiness date"), col("gatewayDate", "Gateway date"), col("status", "Status"), col("outstanding", "Outstanding checks")],
    (detail) => ({ learner: detail.learner.name, programme: detail.programme.programmeName, readinessDate: displayDate(detail.assessmentReadiness?.expectedAssessmentReadinessDate), gatewayDate: displayDate(detail.assessmentReadiness?.gatewayDate), status: assessmentStatus(detail), outstanding: detail.assessmentReadinessResult.outstandingChecks.map((check) => check.label).slice(0, 3).join(", ") || "None" }),
    filters.assessmentState === "ready" ? "Readiness is confirmed and these learners can move into assessment." : "These learners have an assessment-readiness or gateway date within the next 60 days.",
    filters.assessmentState === "ready" ? "No learners are currently ready to enter assessment." : "No learners are approaching assessment within the next 60 days.",
    "/levytate/app?module=Learners",
    "Manage assessment",
    managerScope,
  );
}

export async function getOperationalActions(session: LevyTateBetaSession, filters: LevyTateOperationalCopilotFilters = {}): Promise<ToolPayload> {
  const operations = await getOrganisationOperationsSummary(session, {
    assignment: filters.owner === "mine" ? "mine" : "all",
    status: filters.status,
    priority: filters.priority,
    actionType: filters.actionType,
  });
  if (filters.dueState === "recent_activity") {
    return payloadFromRows({
      type: "operational_action_results",
      title: "Recent apprenticeship activity",
      rows: operations.recentActivity.map((item) => ({
        key: item.id,
        cells: { activity: item.action, learner: item.learnerName, actor: item.actorName, date: displayDate(item.eventDate) },
        actions: [{ label: "Open learner", url: item.actionUrl }],
      })),
      columns: [col("activity", "Activity"), col("learner", "Learner"), col("actor", "Recorded by"), col("date", "Date")],
      interpretation: "This activity is drawn from the current organisation's learner lifecycle timeline.",
      emptyMessage: "No recent apprenticeship activity is currently recorded.",
      viewAllUrl: "/levytate/app?module=Home",
      toolName: "getOrganisationRecentActivity",
    });
  }
  let items = Object.values(operations.queues).flat();
  if (filters.dueState === "attention_today") items = items.filter((item) => item.queueType === "urgent" || item.dueStatus === "Overdue" || item.dueStatus === "Due today");
  const rows = [...new Map(items.map((item) => {
    const key = item.persistentActionId || item.sourceKey;
    return [key, {
      key,
      cells: { action: item.actionLabel, learner: item.learnerName, owner: item.persistentOwnerDisplayName || item.ownerType, status: item.persistentActionStatus || "open", priority: item.priorityLevel, dueDate: displayDate(item.persistentDueDate || item.dueDate), reason: item.reason },
      actions: [{ label: "Open action", url: item.actionUrl }],
    }];
  })).values()];
  return payloadFromRows({
    type: "operational_action_results",
    title: filters.owner === "mine" ? "Actions assigned to you" : filters.priority === "Critical" ? "Open critical actions" : filters.dueState === "attention_today" ? "Actions requiring attention today" : "Open operational actions",
    rows,
    columns: [col("action", "Action"), col("learner", "Learner"), col("owner", "Owner"), col("status", "Status"), col("priority", "Priority"), col("dueDate", "Due"), col("reason", "Reason")],
    interpretation: "The list is ordered from the current organisation-scoped Operations Centre data.",
    emptyMessage: "No matching operational actions are currently open.",
    viewAllUrl: "/levytate/app?module=Home",
  });
}

export async function getLearnersNeedingAttention(session: LevyTateBetaSession): Promise<ToolPayload> {
  const operations = await getOrganisationOperationsSummary(session, { queue: "urgent", status: "open" });
  const urgent = operations.queues.urgent;
  const byLearner = new Map(urgent.map((item) => [item.learnerRecordId, item]));
  const learners = [...byLearner.values()];
  const rows = learners.slice(0, 5).map((item) => ({
    key: item.learnerRecordId,
    cells: {
      learner: item.learnerName,
      reason: item.reason,
      owner: item.persistentOwnerDisplayName || item.ownerType,
      priority: item.priorityLevel,
    },
    actions: [{ label: "Open learner", url: item.actionUrl }],
  }));
  return payloadFromRows({
    type: "learner_results",
    title: "Learners needing attention",
    rows,
    totalCount: learners.length,
    columns: [col("learner", "Learner"), col("reason", "Reason"), col("owner", "Owner"), col("priority", "Priority")],
    interpretation: "These learners are the current unique records in the Operations Centre Needs attention now queue.",
    emptyMessage: "No learners currently meet the “needs attention” criteria.",
    viewAllUrl: "/levytate/app?module=Home",
    toolName: "getOperationsCentreLearnersNeedingAttention",
  });
}

export async function getHighestRiskActions(session: LevyTateBetaSession): Promise<ToolPayload> {
  const operations = await getOrganisationOperationsSummary(session, { status: "open" });
  const items = Object.values(operations.queues).flat()
    .sort((left, right) => left.priorityRank - right.priorityRank || (right.daysOverdue ?? -1) - (left.daysOverdue ?? -1));
  const rows = items.slice(0, 5).map((item) => ({
    key: item.persistentActionId || item.sourceKey,
    cells: {
      action: item.actionLabel,
      learner: item.learnerName,
      reason: item.reason,
      owner: item.persistentOwnerDisplayName || item.ownerType,
      priority: item.priorityLevel,
    },
    actions: [{ label: "View action", url: item.actionUrl }],
  }));
  return payloadFromRows({
    type: "operational_action_results",
    title: "Highest-risk actions",
    rows,
    totalCount: items.length,
    columns: [col("action", "Action"), col("learner", "Learner"), col("reason", "Reason"), col("owner", "Owner"), col("priority", "Priority")],
    interpretation: "Ranked using the same priority and overdue timing used by Operations Centre.",
    emptyMessage: "No operational actions currently require attention.",
    viewAllUrl: "/levytate/app?module=Home",
    toolName: "getOperationsCentreHighestRiskActions",
  });
}

export async function getProviderOperationalSummary(session: LevyTateBetaSession, filters: LevyTateOperationalCopilotFilters = {}, contextResultKeys?: string[], managerScope?: ManagerDirectReportContext): Promise<ToolPayload> {
  const details = await contextLearners(session, filters, contextResultKeys, managerScope);
  const grouped = groupBy(details, (detail) => detail.programme.providerName || "Provider not recorded");
  let rows = Array.from(grouped.entries()).map(([provider, learners]) => {
    const behind = learners.filter((detail) => detail.progressPosition === "Slightly behind" || detail.progressPosition === "Significantly behind").length;
    const overdue = learners.filter((detail) => detail.reviewSummaries.provider.overdue).length;
    const latest = learners.map((detail) => detail.latestProviderReview?.reviewDate || "").sort().at(-1) || "";
    const upcoming = learners.map((detail) => detail.reviewSummaries.provider.nextDate).filter((date) => date && date >= today()).sort()[0] || "";
    return {
      key: provider,
      cells: { provider, activeLearners: learners.filter(isActiveLearner).length, behindTarget: behind, overdueReviews: overdue, latestActivity: displayDate(latest), upcomingReview: displayDate(upcoming) },
      actions: managerScope ? [{ label: "Open team view", url: "/levytate/app?module=My%20Team" }] : [{ label: "Open My Providers", url: "/levytate/app?module=My%20Providers" }],
    };
  }).sort((left, right) => Number(right.cells.overdueReviews) - Number(left.cells.overdueReviews) || Number(right.cells.behindTarget) - Number(left.cells.behindTarget));
  if (filters.provider) rows = rows.filter((row) => String(row.cells.provider).toLowerCase() === filters.provider!.toLowerCase());
  if (filters.reviewType === "provider_review") rows = rows.filter((row) => Number(row.cells.overdueReviews) > 0);
  return payloadFromRows({
    type: "provider_results",
    title: filters.actionType?.startsWith("context:") ? "Providers for the active learner result" : "Provider operational summary",
    rows,
    columns: [col("provider", "Provider"), col("activeLearners", "Active learners", "right"), col("behindTarget", "Behind target", "right"), col("overdueReviews", "Overdue reviews", "right"), col("latestActivity", "Latest activity"), col("upcomingReview", "Upcoming review")],
    interpretation: "Provider figures reflect current learner progress and provider-review records, not a predictive performance score.",
    emptyMessage: "No provider activity matches the current query.",
    viewAllUrl: managerScope ? "/levytate/app?module=My%20Team" : "/levytate/app?module=My%20Providers",
    toolName: managerScope ? "getManagerDirectReportProviderContext" : "getProviderOperationalSummary",
  });
}

export async function getProgrammeOperationalSummary(session: LevyTateBetaSession, managerScope?: ManagerDirectReportContext): Promise<ToolPayload> {
  const details = managerScope
    ? await listManagerDirectReportLearnerLifecycleDetails(session, managerScope)
    : await listOrganisationLearnerLifecycleDetails(session);
  const grouped = groupBy(details, (detail) => detail.programme.programmeName || "Programme not recorded");
  const rows = Array.from(grouped.entries()).map(([programme, learners]) => ({
    key: programme,
    cells: {
      programme,
      activeLearners: learners.filter(isActiveLearner).length,
      preEnrolment: learners.filter((detail) => detail.lifecycleStatus === "pre_enrolment").length,
      behindTarget: learners.filter((detail) => detail.progressPosition === "Slightly behind" || detail.progressPosition === "Significantly behind").length,
      activeBreaks: learners.filter((detail) => Boolean(detail.activeBreak)).length,
      assessmentStage: learners.filter((detail) => detail.lifecycleStatus === "assessment_preparation" || detail.lifecycleStatus === "in_assessment").length,
      achieved: learners.filter((detail) => detail.lifecycleStatus === "achieved").length,
    },
    actions: [{ label: managerScope ? "Open team view" : "Open learners", url: managerScope ? "/levytate/app?module=My%20Team" : "/levytate/app?module=Learners" }],
  })).sort((left, right) => Number(right.cells.activeLearners) - Number(left.cells.activeLearners));
  return payloadFromRows({
    type: "programme_results",
    title: managerScope ? "Programmes represented in your team" : "Programme operational summary",
    rows,
    columns: [col("programme", "Programme"), col("activeLearners", "Active", "right"), col("preEnrolment", "Pre-enrolment", "right"), col("behindTarget", "Behind target", "right"), col("activeBreaks", "Breaks", "right"), col("assessmentStage", "Assessment", "right"), col("achieved", "Achieved", "right")],
    interpretation: managerScope ? "Programme activity includes only your current direct reports." : "Programmes are ranked by active learner volume.",
    emptyMessage: managerScope ? "No direct reports currently have learner programme activity." : "No programme activity is currently recorded.",
    viewAllUrl: managerScope ? "/levytate/app?module=My%20Team" : "/levytate/app?module=Learners",
    toolName: managerScope ? "getManagerTeamProgrammeSummary" : "getProgrammeOperationalSummary",
  });
}

export async function getProgrammeDirectory(
  session: LevyTateBetaSession,
  filters: LevyTateOperationalCopilotFilters = {},
): Promise<ToolPayload> {
  const { data } = await getWorkspaceBootstrapForSession(session);
  const query = filters.query?.toLowerCase();
  const programmes = data.providerProgrammes
    .filter((programme) => programme.recordStatus === "Active" && programme.status === "Active")
    .map((programme) => {
      const provider = data.providers.find((candidate) => candidate.providerId === programme.providerId && candidate.status === "Active");
      if (!provider) return null;
      const standard = getApprenticeshipStandard(programme.linkedStandardId || programme.linkedStandardIds[0]);
      const level = programme.level ?? standard?.level ?? null;
      const delivery = [...new Set([...programme.deliveryModels, ...provider.deliveryModels])];
      const locations = [...new Set([...programme.commercialProfile.locations, ...programme.regions, ...provider.regions])];
      const national = provider.providerType === "National provider" || locations.includes("England");
      const index = [programme.programmeName, provider.providerName, standard?.title, standard?.referenceCode, programme.shortDescription, programme.fullDescription, programme.targetJobRoles, programme.targetIndustries, programme.skillsDeveloped, programme.technologiesCovered, delivery, locations].flat().join(" ").toLowerCase();
      return { programme, provider, standard, level, delivery, locations, national, index };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .filter((item) => !query || (query === "ai" ? /\b(ai|artificial intelligence)\b/.test(item.index) : item.index.includes(query)))
    .filter((item) => !filters.provider || item.provider.providerName.toLowerCase() === filters.provider.toLowerCase())
    .filter((item) => !filters.level || String(item.level) === filters.level)
    .filter((item) => !filters.deliveryModel || item.delivery.some((value) => value.toLowerCase().includes(filters.deliveryModel!.toLowerCase())))
    .filter((item) => filters.region !== "national" || item.national)
    .sort((left, right) => left.programme.programmeName.localeCompare(right.programme.programmeName) || left.provider.providerName.localeCompare(right.provider.providerName));

  return payloadFromRows({
    type: "programme_results",
    title: "Programmes matching your selected filters",
    rows: programmes.map((item) => ({
      key: item.programme.id,
      cells: {
        programme: item.programme.programmeName,
        provider: item.provider.providerName,
        level: item.level ? `Level ${item.level}` : "Being reviewed",
        delivery: item.delivery.join(", ") || "Being reviewed",
        location: item.national ? "National delivery" : item.locations.join(", ") || "Being reviewed",
        standard: item.standard?.title || item.programme.linkedStandardName || "Being reviewed",
      },
      actions: [
        { label: "View programme", url: `/levytate/app?module=Marketplace&programme=${encodeURIComponent(item.programme.id)}` },
        { label: "View provider", url: `/levytate/app?module=Marketplace&provider=${encodeURIComponent(item.provider.providerId)}` },
      ],
    })),
    columns: [col("programme", "Programme"), col("provider", "Provider"), col("level", "Level"), col("delivery", "Delivery"), col("location", "Location"), col("standard", "Standard")],
    interpretation: "Results use factual active programme and provider catalogue fields in alphabetical order.",
    emptyMessage: "No programmes match the selected filters.",
    viewAllUrl: "/levytate/app?module=Marketplace",
    toolName: "getProgrammeDirectory",
  });
}

export async function getOrganisationProviders(session: LevyTateBetaSession): Promise<ToolPayload> {
  const { data } = await getWorkspaceBootstrapForSession(session);
  const selectedProviderIds = new Set(
    data.organisationProviders.filter((selection) => selection.status === "Active").map((selection) => selection.providerId),
  );
  const activeProgrammeSelections = data.organisationProgrammes.filter((selection) => selection.status === "Active");
  const rows = data.providers
    .filter((provider) => selectedProviderIds.has(provider.providerId))
    .sort((left, right) => left.providerName.localeCompare(right.providerName))
    .map((provider) => ({
      key: provider.providerId,
      cells: {
        provider: provider.providerName,
        programmes: activeProgrammeSelections.filter((selection) => selection.providerId === provider.providerId).length,
        learners: data.learnerRecords.filter((learner) => learner.providerId === provider.providerId && learner.recordStatus === "Active").length,
        relationship: "Active",
      },
      actions: [{ label: "Open My Providers", url: "/levytate/app?module=My%20Providers" }],
    }));

  return payloadFromRows({
    type: "provider_results",
    title: "My Providers",
    rows,
    columns: [col("provider", "Provider"), col("programmes", "Active programmes", "right"), col("learners", "Learners", "right"), col("relationship", "Relationship")],
    interpretation: "These are the active provider relationships selected by your organisation, not the global Marketplace.",
    emptyMessage: "Your organisation has not added any providers yet.",
    viewAllUrl: "/levytate/app?module=My%20Providers",
    toolName: "getOrganisationProviders",
  });
}

export async function getOrganisationProgrammes(
  session: LevyTateBetaSession,
  filters: LevyTateOperationalCopilotFilters = {},
): Promise<ToolPayload> {
  const { data } = await getWorkspaceBootstrapForSession(session);
  const activeSelections = new Map(
    data.organisationProgrammes.filter((selection) => selection.status === "Active").map((selection) => [selection.programmeId, selection]),
  );
  const rows = data.providerProgrammes
    .filter((programme) => activeSelections.has(programme.id))
    .filter((programme) => !filters.level || String(programme.level) === filters.level)
    .filter((programme) => !filters.provider || data.providers.some((provider) => provider.providerId === programme.providerId && provider.providerName.toLowerCase() === filters.provider!.toLowerCase()))
    .filter((programme) => !filters.query || [programme.programmeName, programme.linkedStandardName, ...programme.targetJobRoles, ...programme.skillsDeveloped]
      .join(" ")
      .toLowerCase()
      .includes(filters.query.toLowerCase()))
    .sort((left, right) => left.programmeName.localeCompare(right.programmeName))
    .map((programme) => {
      const provider = data.providers.find((candidate) => candidate.providerId === programme.providerId);
      const standard = getApprenticeshipStandard(programme.linkedStandardId || programme.linkedStandardIds[0]);
      return {
        key: programme.id,
        cells: {
          programme: programme.programmeName,
          provider: provider?.providerName ?? "Provider unavailable",
          level: programme.level ? `Level ${programme.level}` : standard?.level ? `Level ${standard.level}` : "Being reviewed",
          employees: "Available",
        },
        actions: [{ label: "Open My Programmes", url: "/levytate/app?module=My%20Programmes" }],
      };
    });

  return payloadFromRows({
    type: "programme_results",
    title: "Programmes available to employees",
    rows,
    columns: [col("programme", "Programme"), col("provider", "Provider"), col("level", "Level"), col("employees", "Employee access")],
    interpretation: "These are active My Programmes selected by your organisation. The wider Marketplace is not included.",
    emptyMessage: "Your organisation has not published any apprenticeship programmes yet.",
    viewAllUrl: "/levytate/app?module=My%20Programmes",
    toolName: "getOrganisationProgrammes",
  });
}

async function getManagerApplications(
  session: LevyTateBetaSession,
  scope: ManagerDirectReportContext,
  state: "awaiting_review" | "returned" | "approved" | "active",
  employeeName?: string,
): Promise<ToolPayload> {
  const employeeResolution = resolveManagerEmployee(scope, employeeName);
  if (employeeResolution.payload) return employeeResolution.payload;
  const applications = await listManagerDirectReportApplications(session, scope);
  const matches = applications
    .filter((application) => !employeeResolution.employee || application.employee.id === employeeResolution.employee.id)
    .filter((application) => managerApplicationMatches(application, state));
  const rows = matches.map((application) => ({
    key: authorisedManagerResultKey(scope, "application", application.id),
    cells: {
      employee: application.employee.name,
      programme: standardTitle(application.apprenticeshipStandardId),
      status: application.status,
      submittedDate: displayDate(application.submittedAt),
      currentOwner: application.currentOwner,
      actionRequired: managerApplicationAction(application),
    },
    actions: [
      { label: state === "awaiting_review" || state === "returned" ? "Review application" : "View application", url: "/levytate/app?module=Approvals" },
      { label: `Open ${firstName(application.employee.name)}'s record`, url: managerEmployeeUrl(application.employee.id) },
    ],
  }));
  const named = employeeResolution.employee?.name;
  const title = state === "awaiting_review" ? "Applications awaiting your review"
    : state === "returned" ? "Applications returned after more information"
      : state === "approved" ? "Applications approved by you"
        : named ? `${named}'s current application` : "Current direct-report applications";
  const emptyMessage = state === "awaiting_review" ? "No applications from your direct reports currently need your review."
    : state === "returned" ? "No direct reports have resubmitted an application after a request for more information."
      : state === "approved" ? "No direct-report applications are currently recorded as approved by you."
        : named ? `${named} does not currently have an active apprenticeship application.` : "No direct reports currently have an active apprenticeship application.";

  return payloadFromRows({
    type: "application_results",
    title,
    rows,
    columns: [col("employee", "Employee"), col("programme", "Programme"), col("status", "Status"), col("submittedDate", "Submitted"), col("currentOwner", "Current owner"), col("actionRequired", "Action required")],
    interpretation: state === "awaiting_review"
      ? "Review each application and decide whether to approve, request more information or decline."
      : named ? applicationInterpretation(matches[0]) : "Only applications belonging to your current direct reports are included.",
    emptyMessage,
    viewAllUrl: "/levytate/app?module=Approvals",
    assistantMessage: named && matches[0] ? applicationDirectAnswer(matches[0]) : undefined,
    quickReplies: rows.length ? ["What needs my attention today?"] : ["Summarise apprenticeship activity in my team"],
    toolName: state === "awaiting_review" ? "getManagerApplicationsAwaitingReview" : state === "returned" ? "getManagerReturnedApplications" : state === "approved" ? "getManagerApprovedApplications" : "getManagerApplicationStatus",
  });
}

async function getManagerCheckIns(
  session: LevyTateBetaSession,
  filters: LevyTateOperationalCopilotFilters,
  scope: ManagerDirectReportContext,
  contextResultKeys?: string[],
): Promise<ToolPayload> {
  const details = await listManagerDirectReportLearnerLifecycleDetails(session, scope);
  const authorisedKeys = contextResultKeys?.length ? new Set(contextResultKeys) : null;
  const cutoff = addDays(today(), 14);
  const matches = details.filter((detail) => {
    const key = authorisedManagerResultKey(scope, "learner", detail.learnerRecordId);
    if (authorisedKeys && !authorisedKeys.has(key)) return false;
    const review = detail.reviewSummaries.manager;
    if (filters.reviewDueState === "overdue") return review.overdue;
    if (filters.reviewDueState === "due_soon") return Boolean(review.nextDate && review.nextDate >= today() && review.nextDate <= cutoff);
    return review.overdue || review.latest?.status === "action_required" || Boolean(review.nextDate && review.nextDate <= cutoff);
  });
  return learnerPayload(
    filters.reviewDueState === "overdue" ? "Overdue manager check-ins" : filters.reviewDueState === "due_soon" ? "Manager check-ins due soon" : "Direct reports needing a manager check-in",
    matches,
    [col("learner", "Learner"), col("programme", "Programme"), col("lastCheckIn", "Last check-in"), col("nextCheckIn", "Next due"), col("status", "Status"), col("managerAction", "Manager action")],
    (detail) => ({
      learner: detail.learner.name,
      programme: detail.programme.programmeName,
      lastCheckIn: displayDate(detail.reviewSummaries.manager.latest?.reviewDate),
      nextCheckIn: displayDate(detail.reviewSummaries.manager.nextDate),
      status: detail.reviewSummaries.manager.overdue ? "Overdue" : detail.reviewSummaries.manager.latest?.status === "action_required" ? "Action required" : "Due soon",
      managerAction: "Discuss workplace support and record a manager check-in where appropriate.",
    }),
    "These results use the manager check-in schedule and action status recorded for your direct reports.",
    filters.reviewDueState === "overdue" ? "No manager check-ins are overdue." : "No direct reports currently need a manager check-in.",
    "/levytate/app?module=My%20Team",
    "Record manager check-in",
    scope,
  );
}

async function getManagerEmployeeOperationalStatus(session: LevyTateBetaSession, filters: LevyTateOperationalCopilotFilters, scope: ManagerDirectReportContext): Promise<ToolPayload> {
  const resolution = resolveManagerEmployee(scope, filters.employeeName);
  if (resolution.payload) return resolution.payload;
  const employee = resolution.employee;
  if (!employee) return managerAccessBoundary("Choose one of your direct reports to view their current apprenticeship status.");

  const [applications, details] = await Promise.all([
    listManagerDirectReportApplications(session, scope),
    listManagerDirectReportLearnerLifecycleDetails(session, scope),
  ]);
  const employeeApplications = applications.filter((item) => item.employee.id === employee.id);
  const application = employeeApplications.find((item) => activeApplicationStatuses().includes(item.status)) ?? employeeApplications[0] ?? null;
  const learner = details.find((item) => item.learner.id === employee.id) ?? null;
  const { managerSupport } = deriveManagerOperationalContext(application, learner);
  const applicationProgramme = application ? standardTitle(application.apprenticeshipStandardId) : "";
  const summary = deriveEmployeeOperationalSummary({
    employeeId: employee.id,
    learner: learner ? {
      lifecycleStatus: learner.lifecycleStatus,
      programme: learner.programme.programmeName,
      progressPosition: learner.progressPosition,
      managerSupportSummary: managerSupport.title,
      managerSupportState: managerSupport.state,
      nextAction: managerSupport.nextAction,
      expectedEndDate: learner.expectedEndDate,
    } : null,
    application: application ? {
      status: application.status,
      programme: applicationProgramme,
      nextAction: managerSupport.nextAction,
    } : null,
    development: { status: "No active apprenticeship journey" },
  });

  return payloadFromRows({
    type: "learner_results",
    title: `${employee.name}'s current apprenticeship status`,
    rows: [{
      key: authorisedManagerResultKey(scope, "employee", employee.id),
      cells: {
        learner: employee.name,
        currentStage: summary.primaryStatus,
        progress: summary.progressPosition,
        programme: summary.programme,
        managerSupport: summary.managerSupportSummary,
        applicationOutcome: summary.applicationOutcome,
      },
      actions: learner ? managerLearnerActions(learner) : [{ label: `Open ${firstName(employee.name)}'s record`, url: managerEmployeeUrl(employee.id) }],
    }],
    columns: [col("learner", "Learner"), col("currentStage", "Current stage"), col("progress", "Progress"), col("programme", "Programme"), col("managerSupport", "Manager support"), col("applicationOutcome", "Application outcome")],
    interpretation: learner ? "Current learner lifecycle state takes priority. The application outcome is retained as historical context." : "No learner lifecycle record exists, so the current application state is shown.",
    emptyMessage: "No apprenticeship journey is recorded for this direct report.",
    viewAllUrl: "/levytate/app?module=My%20Team",
    toolName: "getManagerEmployeeOperationalStatus",
  });
}

async function getManagerEmployeeReviewStatus(session: LevyTateBetaSession, filters: LevyTateOperationalCopilotFilters, scope: ManagerDirectReportContext): Promise<ToolPayload> {

  const scoped = await managerDetailsForQuery(session, scope, filters.employeeName);
  if (scoped.payload) return scoped.payload;
  const detail = scoped.details[0];
  if (!detail) return payloadFromRows({ type: "learner_results", title: "Review status", rows: [], columns: [], emptyMessage: "No learner review record is available for this direct report.", toolName: "getManagerEmployeeReviewStatus" });
  const latest = [...detail.reviewHistory].sort((left, right) => right.reviewDate.localeCompare(left.reviewDate))[0];
  return learnerPayload(
    `${detail.learner.name}'s review status`,
    [detail],
    [col("learner", "Learner"), col("latestReview", "Latest review"), col("reviewType", "Review type"), col("nextProviderReview", "Next provider review"), col("managerCheckIn", "Manager check-in"), col("action", "Action")],
    () => ({
      learner: detail.learner.name,
      latestReview: displayDate(latest?.reviewDate),
      reviewType: latest ? reviewTypeLabel(latest.reviewType) : "Not recorded",
      nextProviderReview: displayDate(detail.reviewSummaries.provider.nextDate),
      managerCheckIn: detail.reviewSummaries.manager.overdue ? "Overdue" : displayDate(detail.reviewSummaries.manager.nextDate),
      action: detail.reviewSummaries.manager.overdue ? "Arrange and record a manager check-in." : "No immediate manager review action is recorded.",
    }),
    "Review dates come from the live learner review record.",
    `No review history is recorded for ${detail.learner.name}.`,
    "/levytate/app?module=My%20Team",
    undefined,
    scope,
  );
}

async function getManagerEmployeeSupport(session: LevyTateBetaSession, filters: LevyTateOperationalCopilotFilters, scope: ManagerDirectReportContext): Promise<ToolPayload> {
  const scoped = await managerDetailsForQuery(session, scope, filters.employeeName);
  if (scoped.payload) return scoped.payload;
  const detail = scoped.details[0];
  if (!detail) return payloadFromRows({ type: "learner_results", title: "Support needed", rows: [], columns: [], emptyMessage: "No active learner record is available for this direct report.", toolName: "getManagerEmployeeSupport" });
  const { managerSupport } = deriveManagerOperationalContext(null, detail);
  const summary = deriveEmployeeOperationalSummary({
    employeeId: detail.learner.id,
    learner: {
      lifecycleStatus: detail.lifecycleStatus,
      programme: detail.programme.programmeName,
      progressPosition: detail.progressPosition,
      managerSupportSummary: managerSupport.title,
      managerSupportState: managerSupport.state,
      nextAction: managerSupport.nextAction,
      expectedEndDate: detail.expectedEndDate,
    },
  });
  return learnerPayload(
    `Support needed for ${detail.learner.name}`,
    [detail],
    [col("learner", "Learner"), col("programme", "Programme"), col("progress", "Progress"), col("support", "Recorded support"), col("managerAction", "What you can do")],
    () => ({ learner: detail.learner.name, programme: summary.programme, progress: summary.progressPosition, support: summary.managerSupportSummary, managerAction: summary.nextAction }),
    "This answer uses the learner's latest progress, review and attention records.",
    `No support information is recorded for ${detail.learner.name}.`,
    "/levytate/app?module=My%20Team",
    "Record manager check-in",
    scope,
  );
}

async function getManagerOperationalActions(session: LevyTateBetaSession, filters: LevyTateOperationalCopilotFilters, scope: ManagerDirectReportContext): Promise<ToolPayload> {
  const response = await listManagerActions(session, filters.dueState === "overdue" ? "overdue" : "all");
  let items = response.actions;
  if (filters.actionType === "team_support") items = items.filter((item) => /check-in|support|progress/i.test(`${item.title} ${item.reason}`));
  if (filters.dueState === "attention_today") items = items.filter((item) => item.overdue || item.timingLabel === "Due today");
  const rows = items.map((item) => ({
    key: authorisedManagerResultKey(scope, "action", item.actionId),
    cells: { action: item.title, learner: item.employeeName, priority: item.priority, status: item.statusLabel, owner: "Line Manager", dueDate: displayDate(item.dueDate), managerAction: item.status === "in_progress" ? "Continue in the source workflow." : item.primaryAction },
    actions: [{ label: "Open manager action", url: `/levytate/app?module=Home&managerAction=${encodeURIComponent(item.actionId)}` }],
  }));
  return payloadFromRows({
    type: "operational_action_results",
    title: filters.dueState === "overdue" ? "Overdue actions for your direct reports" : filters.actionType === "team_support" ? "Support actions for your team" : "Actions requiring your attention",
    rows,
    columns: [col("action", "Action"), col("learner", "Learner"), col("priority", "Priority"), col("status", "Status"), col("owner", "Owner"), col("dueDate", "Due"), col("managerAction", "What you can do")],
    interpretation: "Only manager-owned or direct-report support actions are included. Lifecycle-controlled changes remain with the authorised operational owner.",
    emptyMessage: filters.dueState === "overdue" ? "No manager-relevant actions are currently overdue." : "No manager-relevant actions currently require attention.",
    viewAllUrl: "/levytate/app?module=My%20Team",
    toolName: "getManagerOperationalActions",
  });
}

async function getManagerTeamSummary(session: LevyTateBetaSession, scope: ManagerDirectReportContext): Promise<ToolPayload> {
  const [applications, details] = await Promise.all([
    listManagerDirectReportApplications(session, scope),
    listManagerDirectReportLearnerLifecycleDetails(session, scope),
  ]);
  const activeApplications = applications.filter((application) => activeApplicationStatuses().includes(application.status));
  const activeLearners = details.filter(isActiveLearner);
  const programmes = Array.from(new Set(activeLearners.map((detail) => detail.programme.programmeName).filter(Boolean)));
  const metrics = [
    ["Direct reports", scope.directReports.length, "Current active employees who report directly to you."],
    ["Active applications", activeApplications.length, "Direct-report applications currently moving through the workflow."],
    ["Active learners", activeLearners.length, "Direct reports currently enrolled, on break or in assessment."],
    ["Breaks in Learning", details.filter((detail) => Boolean(detail.activeBreak)).length, "Direct reports currently on an active Break in Learning."],
    ["Assessment stage", details.filter((detail) => detail.lifecycleStatus === "assessment_preparation" || detail.lifecycleStatus === "in_assessment").length, "Direct reports preparing for or already in assessment."],
    ["Programmes represented", programmes.length, programmes.join(", ") || "No active learner programmes recorded."],
  ] as const;
  return payloadFromRows({
    type: "summary_metrics",
    title: "Apprenticeship activity in your team",
    rows: metrics.map(([metric, value, meaning]) => ({ key: authorisedManagerResultKey(scope, "summary", metric), cells: { metric, value, meaning }, actions: [{ label: "Open team view", url: "/levytate/app?module=My%20Team" }] })),
    columns: [col("metric", "Measure"), col("value", "Current", "right"), col("meaning", "What it means")],
    interpretation: "This summary is limited to employees who currently report directly to you.",
    emptyMessage: "No direct-report apprenticeship activity is currently recorded.",
    assistantMessage: `Your team has ${activeApplications.length} active application${plural(activeApplications.length)}, ${activeLearners.length} active learner${plural(activeLearners.length)} and ${programmes.length} programme${plural(programmes.length)} represented.`,
    quickReplies: ["Which applications need my review?", "Show me learners behind target"],
    viewAllUrl: "/levytate/app?module=My%20Team",
    toolName: "getManagerTeamSummary",
  });
}

async function managerDetailsForQuery(
  session: LevyTateBetaSession,
  scope: ManagerDirectReportContext | undefined,
  employeeName?: string,
  contextResultKeys?: string[],
): Promise<{ details: LearnerRecordDetail[]; payload?: undefined } | { details: []; payload: ToolPayload }> {
  if (!scope) return { details: await listOrganisationLearnerLifecycleDetails(session) };
  const resolution = resolveManagerEmployee(scope, employeeName);
  if (resolution.payload) return { details: [], payload: resolution.payload };
  let details = await listManagerDirectReportLearnerLifecycleDetails(session, scope);
  if (resolution.employee) details = details.filter((detail) => detail.learner.id === resolution.employee?.id);
  if (contextResultKeys?.length) {
    const keys = new Set(contextResultKeys);
    details = details.filter((detail) => keys.has(authorisedManagerResultKey(scope, "learner", detail.learnerRecordId)));
  }
  return { details };
}

function resolveManagerEmployee(scope: ManagerDirectReportContext, query?: string): { employee?: ManagerDirectReport; payload?: ToolPayload } {
  if (!query?.trim()) return {};
  const value = normalise(query).replace(/'s$/, "");
  const matches = scope.directReports.filter((employee) => {
    const name = normalise(employee.name);
    return name === value || name.startsWith(`${value} `) || name.split(" ")[0] === value;
  });
  if (matches.length === 1) return { employee: matches[0] };
  if (matches.length > 1) {
    return { payload: payloadFromRows({
      type: "clarification_required",
      title: "Which direct report do you mean?",
      rows: matches.map((employee) => ({ key: authorisedManagerResultKey(scope, "employee", employee.id), cells: { employee: employee.name, role: employee.jobTitle } })),
      columns: [col("employee", "Employee"), col("role", "Role")],
      emptyMessage: "Please choose the direct report you mean.",
      assistantMessage: `I found ${matches.length} direct reports with a similar name. Which one do you mean?`,
      toolName: "resolveManagerDirectReport",
    }) };
  }
  return { payload: managerAccessBoundary("I can only show apprenticeship information for your direct reports.") };
}

function managerAccessBoundary(message: string): ToolPayload {
  return { type: "access_boundary", title: "Direct-report access boundary", rows: [], columns: [], emptyMessage: message, toolName: "managerAccessBoundary" };
}

function managerApplicationMatches(application: ManagerDirectReportApplication, state: "awaiting_review" | "returned" | "approved" | "active") {
  if (state === "awaiting_review") return ["Submitted to Line Manager", "Awaiting Manager Review"].includes(application.status);
  if (state === "returned") return ["Submitted to Line Manager", "Awaiting Manager Review"].includes(application.status) && application.history.some((entry) => entry.status === "More information requested");
  if (state === "approved") return application.status === "Approved by Line Manager" || application.history.some((entry) => entry.status === "Approved by Line Manager");
  return activeApplicationStatuses().includes(application.status);
}

function managerApplicationAction(application: ManagerDirectReportApplication) {
  if (["Submitted to Line Manager", "Awaiting Manager Review"].includes(application.status)) return "Review and decide whether to approve, request more information or decline.";
  if (application.status === "More information requested") return "Waiting for the employee to provide more information.";
  if (["Approved by Line Manager", "Submitted to Apprenticeship Lead", "Awaiting Final Approval"].includes(application.status)) return "The Apprenticeship Lead owns the next review.";
  if (application.status === "Approved for Enrolment") return "No manager decision is currently required.";
  return "Review the recorded application outcome.";
}

function applicationInterpretation(application?: ManagerDirectReportApplication) {
  return application ? managerApplicationAction(application) : "Only applications belonging to your current direct reports are included.";
}

function applicationDirectAnswer(application: ManagerDirectReportApplication) {
  const next = managerApplicationAction(application);
  return `${application.employee.name}'s ${standardTitle(application.apprenticeshipStandardId)} application is ${application.status}. ${next}`;
}

function standardTitle(standardId: string) {
  return getApprenticeshipStandard(standardId)?.title ?? standardId;
}

function reviewTypeLabel(type: LearnerReviewType) {
  return type === "provider_review" ? "Provider review" : type === "l_and_d_check_in" ? "L&D check-in" : type === "manager_check_in" ? "Manager check-in" : "Review";
}

function authorisedManagerResultKey(scope: ManagerDirectReportContext, kind: string, value: string) {
  return createHash("sha256").update(`${scope.organisation.id}:${scope.user.id}:${kind}:${value}`).digest("hex").slice(0, 24);
}

function responseForPayload(
  request: LevyTateAiRequest,
  query: ClassifiedQuery,
  payload: ToolPayload,
  timing: { intentClassificationMs: number; managerScopeResolutionMs?: number; dataRetrievalMs: number; startedAt: number },
  role?: ReturnType<typeof normaliseMvpUserRole>,
): LevyTateAiResponse {
  const responseStarted = performance.now();
  const evaluatedAt = new Date().toISOString();
  const visibleRows = payload.rows.slice(0, resultLimit);
  const totalCount = payload.totalCount ?? payload.rows.length;
  const empty = totalCount === 0;
  const assistantMessage = payload.assistantMessage ?? (payload.type === "access_boundary" || payload.type === "data_unavailable"
    ? payload.emptyMessage
    : empty
      ? payload.emptyMessage
      : directAnswer(query.intent, totalCount, query.filters, role));
  const structuredType = empty && payload.type !== "access_boundary" && payload.type !== "data_unavailable" ? "no_results" : payload.type;
  const responsePreparationMs = elapsed(responseStarted);
  const operationalContext: LevyTateOperationalCopilotContext = {
    activeIntent: query.intent,
    filters: query.filters,
    resultKeys: visibleRows.map((row) => row.key),
    evaluatedAt,
  };
  return {
    source: "deterministic",
    executionMode: "deterministic",
    assistantMessage,
    followUpQuestion: payload.followUpQuestion ?? followUpFor(query.intent, query.filters, empty),
    quickReplies: payload.type === "data_unavailable" ? ["Retry"] : payload.quickReplies ?? quickRepliesFor(query.intent, query.filters, empty),
    shouldShowPathways: false,
    shouldShowActions: false,
    recommendedActions: [],
    suggestedActions: [],
    recommendedPathways: [],
    applicationPrefill: null,
    providerMatchDraft: null,
    nextStep: payload.viewAllUrl ? "Open the relevant LevyTate workspace for the underlying record." : null,
    safetyNotes: [
      query.intent === "programme_directory"
        ? "Programme results use active factual provider catalogue fields and alphabetical ordering."
        : role === "Line Manager"
        ? "Operational data was retrieved through manager-scoped direct-report server contracts."
        : "Operational data was retrieved through organisation-scoped LevyTate server contracts.",
      "Deterministic operational routing was used; no model generated or reordered the records.",
    ],
    applicationWarning: null,
    managerMessageDraft: null,
    operationalContext,
    structuredResult: {
      type: structuredType,
      title: payload.title,
      columns: payload.columns,
      rows: visibleRows,
      totalCount,
      truncated: totalCount > visibleRows.length,
      interpretation: empty ? undefined : payload.interpretation,
      emptyMessage: payload.emptyMessage,
      viewAllUrl: payload.viewAllUrl,
      dataSource: "supabase",
      dataLabel: "Live LevyTate data",
      evaluatedAt,
      timings: {
        intentClassificationMs: round(timing.intentClassificationMs),
        managerScopeResolutionMs: timing.managerScopeResolutionMs === undefined ? undefined : round(timing.managerScopeResolutionMs),
        dataRetrievalMs: round(timing.dataRetrievalMs),
        responsePreparationMs: round(responsePreparationMs),
        totalMs: round(performance.now() - timing.startedAt),
      },
    },
  };
}

function learnerPayload(
  title: string,
  details: LearnerRecordDetail[],
  columns: LevyTateCopilotResultColumn[],
  cells: (detail: LearnerRecordDetail) => Record<string, string | number | null>,
  interpretation: string,
  emptyMessage: string,
  viewAllUrl: string,
  secondaryAction?: string,
  managerScope?: ManagerDirectReportContext,
): ToolPayload {
  return payloadFromRows({
    type: "learner_results",
    title,
    rows: details.map((detail) => ({
      key: managerScope ? authorisedManagerResultKey(managerScope, "learner", detail.learnerRecordId) : detail.learnerRecordId,
      cells: cells(detail),
      actions: learnerActions(detail, secondaryAction, managerScope),
    })),
    columns,
    interpretation,
    emptyMessage,
    viewAllUrl: managerScope ? "/levytate/app?module=My%20Team" : viewAllUrl,
    toolName: managerScope ? "getManagerDirectReportLearners" : undefined,
  });
}

function operationalLearnerPayload(
  title: string,
  items: Awaited<ReturnType<typeof getOrganisationOperationsSummary>>["queues"]["progress"],
  columns: LevyTateCopilotResultColumn[],
  cells: (item: Awaited<ReturnType<typeof getOrganisationOperationsSummary>>["queues"]["progress"][number]) => Record<string, string | number | null>,
  interpretation: string,
  emptyMessage: string,
): ToolPayload {
  return payloadFromRows({
    type: "learner_results",
    title,
    rows: items.map((item) => ({ key: item.sourceKey, cells: cells(item), actions: [{ label: item.actionLabel, url: item.actionUrl }, { label: "Open learner", url: item.secondaryActionUrl }] })),
    columns,
    interpretation,
    emptyMessage,
    viewAllUrl: "/levytate/app?module=Learners",
  });
}

function payloadFromRows(payload: ToolPayload): ToolPayload {
  return { ...payload, totalCount: payload.rows.length };
}

async function contextLearners(session: LevyTateBetaSession, filters: LevyTateOperationalCopilotFilters, contextResultKeys?: string[], managerScope?: ManagerDirectReportContext) {
  const details = managerScope
    ? await listManagerDirectReportLearnerLifecycleDetails(session, managerScope)
    : await listOrganisationLearnerLifecycleDetails(session);
  if (!filters.actionType?.startsWith("context:")) return details;
  const prior = filters.actionType.slice("context:".length);
  const scopedKeys = contextResultKeys?.length
    ? new Set(contextResultKeys)
    : null;
  const authorised = (detail: LearnerRecordDetail) => !scopedKeys || scopedKeys.has(
    managerScope ? authorisedManagerResultKey(managerScope, "learner", detail.learnerRecordId) : detail.learnerRecordId,
  );
  if (prior === "learners_behind_target") {
    return details.filter((detail) =>
      (detail.progressPosition === "Slightly behind" || detail.progressPosition === "Significantly behind")
      && (!filters.progressPosition || detail.progressPosition === filters.progressPosition)
      && authorised(detail)
    );
  }
  if (prior === "overdue_reviews") return details.filter((detail) => {
    if (!detail.reviewSummaries.provider.overdue) return false;
    if (!scopedKeys) return true;
    return managerScope
      ? scopedKeys.has(authorisedManagerResultKey(managerScope, "review", `${detail.learnerRecordId}:provider_review`))
      : scopedKeys.has(`${detail.learnerRecordId}:provider_review`);
  });
  return scopedKeys ? details.filter(authorised) : details;
}

function directAnswer(intent: LevyTateOperationalCopilotIntent, count: number, filters: LevyTateOperationalCopilotFilters, role?: ReturnType<typeof normaliseMvpUserRole>) {
  const singular = count === 1;
  const learnerSubject = role === "Line Manager" ? `of your direct reports ${singular ? "is" : "are"}` : `learner${singular ? " is" : "s are"}`;
  if (intent === "learners_needing_attention") return `${count} learner${singular ? "" : "s"} currently need attention.`;
  if (intent === "highest_risk_actions") return `${count} open action${singular ? " is" : "s are"} ranked by current operational risk.`;
  if (intent === "applications_awaiting_review") return `${count} application${singular ? "" : "s"} from your direct reports ${singular ? "needs" : "need"} your review.`;
  if (intent === "applications_returned") return `${count} direct-report application${singular ? " has" : "s have"} been returned after more information was requested.`;
  if (intent === "applications_approved") return `${count} direct-report application${singular ? " has" : "s have"} been approved by you.`;
  if (intent === "learners_behind_target") return `${count} ${learnerSubject} currently ${filters.progressPosition === "Significantly behind" ? "significantly " : ""}behind target.`;
  if (intent === "learners_without_recent_progress") return `${count} learner${singular ? " has" : "s have"} no recent progress update.`;
  if (intent === "learners_ending_before") return `${count} apprentice${singular ? " is" : "s are"} expected to end before the selected date.`;
  if (intent === "overdue_reviews") return `${count} review${singular ? " is" : "s are"} currently overdue.`;
  if (intent === "manager_check_ins") return `${count} manager check-in${singular ? " requires" : "s require"} your attention.`;
  if (intent === "ready_to_enrol") return `${count} learner${singular ? " is" : "s are"} ready to enrol.`;
  if (intent === "pre_enrolment_blockers") return `${count} pre-enrolment blocker${singular ? " is" : "s are"} currently open.`;
  if (intent === "active_breaks") return `${count} learner${singular ? " is" : "s are"} ${filters.dueState === "overdue" ? "past the expected Break in Learning return date" : "currently on a Break in Learning"}.`;
  if (intent === "assessment_readiness") return `${count} learner${singular ? " is" : "s are"} ${filters.assessmentState === "ready" ? "ready to enter assessment" : "approaching assessment"}.`;
  if (intent === "operational_actions") return `${count} operational action${singular ? " requires" : "s require"} attention.`;
  if (intent === "provider_operational_summary") return `${count} provider${singular ? " is" : "s are"} represented in the current result.`;
  if (intent === "programme_operational_summary") return `${count} programme${singular ? " has" : "s have"} current learner activity.`;
  if (intent === "programme_directory") return `${count} active programme${singular ? " matches" : "s match"} your selected filters.`;
  return "This request is outside your authorised workspace boundary.";
}

function followUpFor(intent: LevyTateOperationalCopilotIntent, filters: LevyTateOperationalCopilotFilters, empty: boolean) {
  if (intent === "learners_behind_target" && !filters.progressPosition && !empty) return "Would you like me to show only the significantly behind learners?";
  if (intent === "provider_operational_summary" && !empty) return "Would you like to open a provider record or review the affected learners?";
  if (intent === "learners_ending_before" && !empty) return "Would you like me to narrow this by programme or provider?";
  if (intent === "applications_awaiting_review" && !empty) return "Would you like to see what else needs your attention today?";
  return null;
}

function quickRepliesFor(intent: LevyTateOperationalCopilotIntent, filters: LevyTateOperationalCopilotFilters, empty: boolean) {
  if (empty) {
    if (intent === "learners_behind_target" && filters.progressPosition) return ["Show all learners behind target"];
    return [];
  }
  if (intent === "learners_behind_target" && !filters.progressPosition) return ["Only show significantly behind learners", "Which providers are they with?"];
  if (intent === "overdue_reviews") return ["Which providers have overdue reviews?"];
  if (intent === "manager_check_ins") return ["Show me learners behind target"];
  return [];
}

function learnerActions(detail: LearnerRecordDetail, secondaryLabel?: string, managerScope?: ManagerDirectReportContext) {
  if (managerScope) return managerLearnerActions(detail, secondaryLabel);
  const url = `/levytate/app?module=Learners&learner=${encodeURIComponent(detail.learnerRecordId)}`;
  const action = secondaryLabel === "Add progress update" ? "add_progress" : secondaryLabel === "Manage break" ? "manage_break" : secondaryLabel === "Manage assessment" ? "manage_assessment" : "record_review";
  return [{ label: "Open learner", url }, ...(secondaryLabel ? [{ label: secondaryLabel, url: `${url}&action=${action}` }] : [])];
}

function managerLearnerActions(detail: LearnerRecordDetail, secondaryLabel?: string) {
  const url = managerEmployeeUrl(detail.learner.id);
  const actions = [{
    label: `Open ${firstName(detail.learner.name)}'s record`,
    url,
  }];
  if (secondaryLabel === "Record manager check-in" && managerCheckInEligibleLifecycleStatuses.includes(detail.lifecycleStatus as (typeof managerCheckInEligibleLifecycleStatuses)[number])) {
    actions.push({ label: secondaryLabel, url: `${url}?action=manager-check-in` });
  }
  return actions;
}

function managerEmployeeUrl(employeeId: string) {
  return `/levytate/app/my-team/${encodeURIComponent(employeeId)}`;
}

function firstName(name: string) {
  return name.trim().split(/\s+/)[0] || "learner";
}

function assessmentStatus(detail: LearnerRecordDetail) {
  const status = detail.assessmentReadiness?.assessmentStatus;
  return status ? status.replace(/_/g, " ").replace(/^./, (value) => value.toUpperCase()) : "Not recorded";
}

function isActiveLearner(detail: LearnerRecordDetail) {
  return ["enrolled", "break_in_learning", "assessment_preparation", "in_assessment"].includes(detail.lifecycleStatus);
}

function col(key: string, label: string, align: "left" | "right" = "left"): LevyTateCopilotResultColumn {
  return { key, label, align };
}

function groupBy<T>(items: T[], key: (item: T) => string) {
  const result = new Map<string, T[]>();
  items.forEach((item) => result.set(key(item), [...(result.get(key(item)) ?? []), item]));
  return result;
}

function extractEmployeeName(text: string) {
  const possessive = text.match(/\b([a-z][a-z'-]+(?:\s+[a-z][a-z'-]+)?)'s\b/);
  if (possessive) {
    const parts = possessive[1].split(" ");
    const leadingContextWords = new Set(["about", "can", "does", "for", "is", "on", "through", "was", "with"]);
    return parts.length > 1 && leadingContextWords.has(parts[0])
      ? parts.slice(1).join(" ")
      : possessive[1];
  }
  const direct = text.match(/\b(?:is|does|can|can't|cannot|was)\s+([a-z][a-z'-]+)\s+(?:behind|need|needs|edit|current|latest|application)/);
  return direct?.[1];
}

function toolNameFor(intent: LevyTateOperationalCopilotIntent, role: ReturnType<typeof normaliseMvpUserRole>) {
  const prefix = role === "Line Manager" ? "manager" : "organisation";
  return `${prefix}:${intent}`.slice(0, 120);
}

function normalise(value: string) {
  value = value.replace(/[\u2018\u2019]/g, "'");
  return value.trim().toLowerCase().replace(/[’']/g, "'").replace(/\s+/g, " ");
}

function extractDateBefore(text: string) {
  const iso = text.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
  if (iso) return iso[0];
  const monthYear = text.match(new RegExp(`\\b(${Object.keys(monthNumbers).join("|")})\\s+(20\\d{2})\\b`));
  if (monthYear) return `${monthYear[2]}-${String(monthNumbers[monthYear[1]]).padStart(2, "0")}-01`;
  const days = Number(text.match(/\bnext\s+(30|60|90)\s+days?\b/)?.[1] ?? 90);
  return addDays(toDate(new Date()), days);
}

function defaultDateBefore() {
  return addDays(toDate(new Date()), 90);
}

function displayDate(value: string | undefined | null) {
  if (!value) return "Not recorded";
  const date = new Date(`${value.slice(0, 10)}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return "Not recorded";
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(date);
}

function today() {
  return toDate(new Date());
}

function toDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function addDays(value: string, days: number) {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return toDate(date);
}

function daysOverdue(value: string) {
  if (!value) return 0;
  return Math.max(0, Math.floor((new Date(`${today()}T12:00:00Z`).getTime() - new Date(`${value}T12:00:00Z`).getTime()) / 86_400_000));
}

function ageLabel(value: string | undefined) {
  if (!value) return "Not recorded";
  const days = daysOverdue(value.slice(0, 10));
  if (days === 0) return "Today";
  return `${days} day${plural(days)}`;
}

function percent(value: number | undefined) {
  return value === undefined ? "Not recorded" : `${value}%`;
}

function points(value: number | undefined) {
  return value === undefined ? "Not recorded" : `${value > 0 ? "+" : ""}${value} pts`;
}

function plural(value: number) {
  return value === 1 ? "" : "s";
}

function elapsed(started: number) {
  return performance.now() - started;
}

function round(value: number) {
  return Math.round(value * 10) / 10;
}
