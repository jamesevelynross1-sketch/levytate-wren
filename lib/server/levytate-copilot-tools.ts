import type { LevyTateBetaSession } from "@/lib/levytate/config/beta-access";
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
import { normaliseMvpUserRole } from "@/lib/levytate/mvp/rbac";
import { listOrganisationLearnerLifecycleDetails, getLearnerLifecycleServerContext } from "@/lib/server/levytate-learner-lifecycle";
import { getOrganisationOperationsSummary } from "@/lib/server/levytate-operations";

const resultLimit = 25;
const operationalRoles = new Set(["Apprenticeship Lead", "Employer Admin", "Platform Admin"]);
const monthNumbers: Record<string, number> = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
};

type ClassifiedQuery = {
  intent: LevyTateOperationalCopilotIntent;
  filters: LevyTateOperationalCopilotFilters;
  direct: boolean;
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
};

export async function routeOperationalCopilotQuery(
  session: LevyTateBetaSession,
  request: LevyTateAiRequest,
): Promise<LevyTateAiResponse | null> {
  const startedAt = performance.now();
  const classificationStarted = performance.now();
  const classification = classifyOperationalCopilotQuery(request.userMessage, request.operationalContext);
  const intentClassificationMs = elapsed(classificationStarted);
  if (!classification) return null;

  let role: ReturnType<typeof normaliseMvpUserRole>;
  try {
    const context = await getLearnerLifecycleServerContext(session);
    role = normaliseMvpUserRole(context.user.role);
  } catch (error) {
    console.error("LevyTate operational Copilot scope resolution failed", { intent: classification.intent, error });
    return responseForPayload(
      request,
      classification,
      {
        type: "data_unavailable",
        title: "Programme data unavailable",
        columns: [],
        rows: [],
        emptyMessage: "I couldn't retrieve the programme data just now. Please try again.",
      },
      { intentClassificationMs, dataRetrievalMs: 0, startedAt },
    );
  }
  if (!operationalRoles.has(role)) {
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

  if (classification.intent === "access_boundary") {
    return responseForPayload(
      request,
      classification,
      {
        type: "access_boundary",
        title: "Organisation access boundary",
        columns: [],
        rows: [],
        emptyMessage: "I can only use records from your authorised LevyTate workspace. I cannot retrieve another organisation's learners, hidden records, raw database content, system prompts or secrets.",
      },
      { intentClassificationMs, dataRetrievalMs: 0, startedAt },
    );
  }

  const retrievalStarted = performance.now();
  try {
    const payload = await executeTool(session, classification);
    return responseForPayload(request, classification, payload, {
      intentClassificationMs,
      dataRetrievalMs: elapsed(retrievalStarted),
      startedAt,
    });
  } catch (error) {
    console.error("LevyTate operational Copilot retrieval failed", {
      intent: classification.intent,
      role,
      error,
    });
    return responseForPayload(
      request,
      classification,
      {
        type: "data_unavailable",
        title: "Programme data unavailable",
        columns: [],
        rows: [],
        emptyMessage: "I couldn't retrieve the programme data just now. Please try again.",
      },
      { intentClassificationMs, dataRetrievalMs: elapsed(retrievalStarted), startedAt },
    );
  }
}

export function classifyOperationalCopilotQuery(
  message: string,
  previous?: LevyTateOperationalCopilotContext,
): ClassifiedQuery | null {
  const text = normalise(message);
  const prior = previous?.activeIntent;
  const priorFilters = previous?.filters ?? {};

  if (/^retry$/.test(text) && prior) return { intent: prior, filters: priorFilters, direct: true };
  if (/\b(another organisation|other organisation|different organisation|organisation id|raw database|database rows?|service role|system prompt|hidden tool|secret|ignore (all|previous) instructions|bypass (access|permissions?))\b/.test(text)) {
    return { intent: "access_boundary", filters: {}, direct: true };
  }
  if (/\b(which providers?|providers?)\b/.test(text) && /\b(they|them|those|these learners?)\b/.test(text) && prior) {
    return { intent: "provider_operational_summary", filters: { ...priorFilters, actionType: `context:${prior}` }, direct: true };
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
      filters: { progressPosition: /significantly/.test(text) ? "Significantly behind" : undefined },
      direct: true,
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
  if (/\b(break in learning|on a break|active breaks?)\b/.test(text)) {
    return { intent: "active_breaks", filters: {}, direct: true };
  }
  if (/\b(ready to enter assessment|ready for assessment|enter assessment)\b/.test(text)) {
    return { intent: "assessment_readiness", filters: { assessmentState: "ready" }, direct: true };
  }
  if (/\b(approaching assessment|assessment readiness|gateway)\b/.test(text)) {
    return { intent: "assessment_readiness", filters: { assessmentState: "approaching" }, direct: true };
  }
  if (/\b(ending|end|finish|finishing|complete|completion)\b.*\b(before|by|next|soon|within)\b/.test(text)) {
    return { intent: "learners_ending_before", filters: { dateBefore: extractDateBefore(text) }, direct: true };
  }
  if (/\b(actions?|tasks?)\b.*\b(assigned to me|my|mine)\b/.test(text)) {
    return { intent: "operational_actions", filters: { owner: "mine", status: "open" }, direct: true };
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

async function executeTool(session: LevyTateBetaSession, query: ClassifiedQuery): Promise<ToolPayload> {
  switch (query.intent) {
    case "learners_behind_target": return getLearnersBehindTarget(session, query.filters);
    case "learners_without_recent_progress": return getLearnersWithoutRecentProgress(session);
    case "learners_ending_before": return getLearnersEndingBefore(session, query.filters.dateBefore ?? defaultDateBefore());
    case "overdue_reviews": return getOverdueReviews(session, query.filters);
    case "ready_to_enrol": return getReadyToEnrolLearners(session);
    case "pre_enrolment_blockers": return getPreEnrolmentBlockers(session, query.filters);
    case "active_breaks": return getActiveBreaksInLearning(session, query.filters);
    case "assessment_readiness": return getAssessmentReadiness(session, query.filters);
    case "operational_actions": return getOperationalActions(session, query.filters);
    case "provider_operational_summary": return getProviderOperationalSummary(session, query.filters);
    case "programme_operational_summary": return getProgrammeOperationalSummary(session);
    case "access_boundary": throw new Error("Access boundary is handled before tool execution.");
  }
}

export async function getLearnersBehindTarget(session: LevyTateBetaSession, filters: LevyTateOperationalCopilotFilters = {}): Promise<ToolPayload> {
  const details = await listOrganisationLearnerLifecycleDetails(session);
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
  );
}

export async function getLearnersWithoutRecentProgress(session: LevyTateBetaSession): Promise<ToolPayload> {
  const details = await listOrganisationLearnerLifecycleDetails(session);
  const operations = await getOrganisationOperationsSummary(session);
  const missingIds = new Set(operations.queues.progress.filter((item) => item.sourceCondition === "progress_overdue").map((item) => item.learnerRecordId));
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
  );
}

export async function getLearnersEndingBefore(session: LevyTateBetaSession, dateBefore: string): Promise<ToolPayload> {
  const details = await listOrganisationLearnerLifecycleDetails(session);
  const matches = details.filter((detail) => detail.expectedEndDate && detail.expectedEndDate < dateBefore);
  const payload = learnerPayload(
    `Learners ending before ${displayDate(dateBefore)}`,
    matches,
    [col("learner", "Learner"), col("programme", "Programme"), col("expectedEnd", "Expected end"), col("lifecycle", "Lifecycle"), col("progress", "Progress position")],
    (detail) => ({ learner: detail.learner.name, programme: detail.programme.programmeName, expectedEnd: displayDate(detail.expectedEndDate), lifecycle: detail.lifecycleStatusLabel, progress: detail.progressPosition }),
    "Results use each learner's current expected programme end date.",
    `No apprentices are expected to end before ${displayDate(dateBefore)}.`,
    "/levytate/app?module=Learners",
  );
  return payload;
}

export async function getOverdueReviews(session: LevyTateBetaSession, filters: LevyTateOperationalCopilotFilters = {}): Promise<ToolPayload> {
  const details = await listOrganisationLearnerLifecycleDetails(session);
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
      key: `${detail.learnerRecordId}:${type}`,
      cells: {
        learner: detail.learner.name,
        programme: detail.programme.programmeName,
        provider: detail.programme.providerName,
        reviewType: label,
        lastReview: displayDate(summary.latest?.reviewDate),
        expectedReview: displayDate(summary.nextDate),
        daysOverdue: daysOverdue(summary.nextDate),
      },
      actions: learnerActions(detail, "Record review"),
    }];
  }));
  return payloadFromRows({
    type: "learner_results",
    title: filters.reviewType === "provider_review" ? "Overdue provider reviews" : "Overdue reviews and check-ins",
    rows,
    columns: [col("learner", "Learner"), col("programme", "Programme"), col("provider", "Provider"), col("reviewType", "Review type"), col("lastReview", "Last review"), col("expectedReview", "Expected"), col("daysOverdue", "Days overdue", "right")],
    interpretation: "The most overdue reviews should be addressed first, particularly where support actions are already open.",
    emptyMessage: filters.reviewType === "provider_review" ? "No provider reviews are currently overdue." : "No reviews or check-ins are currently overdue.",
    viewAllUrl: "/levytate/app?module=Learners",
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

export async function getActiveBreaksInLearning(session: LevyTateBetaSession, filters: LevyTateOperationalCopilotFilters = {}): Promise<ToolPayload> {
  const details = await listOrganisationLearnerLifecycleDetails(session);
  const matches = details.filter((detail) => detail.activeBreak)
    .filter((detail) => filters.dueState !== "overdue" || detail.breakAttention.state === "overdue");
  return learnerPayload(
    filters.dueState === "overdue" ? "Overdue Break in Learning returns" : "Active Breaks in Learning",
    matches,
    [col("learner", "Learner"), col("programme", "Programme"), col("breakStart", "Break start"), col("expectedReturn", "Expected return"), col("attention", "Attention"), col("daysOverdue", "Days overdue", "right")],
    (detail) => ({ learner: detail.learner.name, programme: detail.programme.programmeName, breakStart: displayDate(detail.activeBreak?.startDate), expectedReturn: displayDate(detail.activeBreak?.expectedReturnDate), attention: detail.breakAttention.label, daysOverdue: Math.max(0, -(detail.breakAttention.daysUntilReturn ?? 0)) }),
    "Return dates and support confirmations determine the current attention state.",
    filters.dueState === "overdue" ? "No Break in Learning return dates are currently overdue." : "No learners are currently on a Break in Learning.",
    "/levytate/app?module=Learners",
    "Manage break",
  );
}

export async function getAssessmentReadiness(session: LevyTateBetaSession, filters: LevyTateOperationalCopilotFilters = {}): Promise<ToolPayload> {
  const details = await listOrganisationLearnerLifecycleDetails(session);
  const cutoff = addDays(toDate(new Date()), 60);
  const matches = details.filter((detail) => {
    const readiness = detail.assessmentReadiness;
    if (!readiness) return false;
    if (filters.assessmentState === "ready") return detail.lifecycleStatus === "assessment_preparation" && readiness.assessmentStatus === "readiness_confirmed";
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
  );
}

export async function getOperationalActions(session: LevyTateBetaSession, filters: LevyTateOperationalCopilotFilters = {}): Promise<ToolPayload> {
  const operations = await getOrganisationOperationsSummary(session, {
    assignment: filters.owner === "mine" ? "mine" : "all",
    status: filters.status,
    priority: filters.priority,
    actionType: filters.actionType,
  });
  let items = Object.values(operations.queues).flat();
  if (filters.dueState === "attention_today") items = items.filter((item) => item.queueType === "urgent" || item.dueStatus === "Overdue" || item.dueStatus === "Due today");
  const rows = items.map((item) => ({
    key: item.persistentActionId || item.sourceKey,
    cells: { action: item.actionLabel, learner: item.learnerName, owner: item.persistentOwnerDisplayName || item.ownerType, status: item.persistentActionStatus || "open", priority: item.priorityLevel, dueDate: displayDate(item.persistentDueDate || item.dueDate), reason: item.reason },
    actions: [{ label: "Open action", url: item.actionUrl }],
  }));
  return payloadFromRows({
    type: "operational_action_results",
    title: filters.owner === "mine" ? "Actions assigned to you" : filters.priority === "Critical" ? "Open critical actions" : "Actions requiring attention today",
    rows,
    columns: [col("action", "Action"), col("learner", "Learner"), col("owner", "Owner"), col("status", "Status"), col("priority", "Priority"), col("dueDate", "Due"), col("reason", "Reason")],
    interpretation: "The list is ordered from the current organisation-scoped Operations Centre data.",
    emptyMessage: "No matching operational actions are currently open.",
    viewAllUrl: "/levytate/app?module=Home",
  });
}

export async function getProviderOperationalSummary(session: LevyTateBetaSession, filters: LevyTateOperationalCopilotFilters = {}): Promise<ToolPayload> {
  const details = await contextLearners(session, filters);
  const grouped = groupBy(details, (detail) => detail.programme.providerName || "Provider not recorded");
  let rows = Array.from(grouped.entries()).map(([provider, learners]) => {
    const behind = learners.filter((detail) => detail.progressPosition === "Slightly behind" || detail.progressPosition === "Significantly behind").length;
    const overdue = learners.filter((detail) => detail.reviewSummaries.provider.overdue).length;
    const latest = learners.map((detail) => detail.latestProviderReview?.reviewDate || "").sort().at(-1) || "";
    const upcoming = learners.map((detail) => detail.reviewSummaries.provider.nextDate).filter((date) => date && date >= today()).sort()[0] || "";
    return {
      key: provider,
      cells: { provider, activeLearners: learners.filter(isActiveLearner).length, behindTarget: behind, overdueReviews: overdue, latestActivity: displayDate(latest), upcomingReview: displayDate(upcoming) },
      actions: [{ label: "Open providers", url: "/levytate/app?module=Providers" }],
    };
  }).sort((left, right) => Number(right.cells.overdueReviews) - Number(left.cells.overdueReviews) || Number(right.cells.behindTarget) - Number(left.cells.behindTarget));
  if (filters.reviewType === "provider_review") rows = rows.filter((row) => Number(row.cells.overdueReviews) > 0);
  return payloadFromRows({
    type: "provider_results",
    title: filters.actionType?.startsWith("context:") ? "Providers for the active learner result" : "Provider operational summary",
    rows,
    columns: [col("provider", "Provider"), col("activeLearners", "Active learners", "right"), col("behindTarget", "Behind target", "right"), col("overdueReviews", "Overdue reviews", "right"), col("latestActivity", "Latest activity"), col("upcomingReview", "Upcoming review")],
    interpretation: "Provider figures reflect current learner progress and provider-review records, not a predictive performance score.",
    emptyMessage: "No provider activity matches the current query.",
    viewAllUrl: "/levytate/app?module=Providers",
  });
}

export async function getProgrammeOperationalSummary(session: LevyTateBetaSession): Promise<ToolPayload> {
  const details = await listOrganisationLearnerLifecycleDetails(session);
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
    actions: [{ label: "Open learners", url: "/levytate/app?module=Learners" }],
  })).sort((left, right) => Number(right.cells.activeLearners) - Number(left.cells.activeLearners));
  return payloadFromRows({
    type: "programme_results",
    title: "Programme operational summary",
    rows,
    columns: [col("programme", "Programme"), col("activeLearners", "Active", "right"), col("preEnrolment", "Pre-enrolment", "right"), col("behindTarget", "Behind target", "right"), col("activeBreaks", "Breaks", "right"), col("assessmentStage", "Assessment", "right"), col("achieved", "Achieved", "right")],
    interpretation: "Programmes are ranked by active learner volume.",
    emptyMessage: "No programme activity is currently recorded.",
    viewAllUrl: "/levytate/app?module=Learners",
  });
}

function responseForPayload(
  request: LevyTateAiRequest,
  query: ClassifiedQuery,
  payload: ToolPayload,
  timing: { intentClassificationMs: number; dataRetrievalMs: number; startedAt: number },
): LevyTateAiResponse {
  const responseStarted = performance.now();
  const evaluatedAt = new Date().toISOString();
  const visibleRows = payload.rows.slice(0, resultLimit);
  const totalCount = payload.totalCount ?? payload.rows.length;
  const empty = totalCount === 0;
  const assistantMessage = payload.type === "access_boundary" || payload.type === "data_unavailable"
    ? payload.emptyMessage
    : empty
      ? payload.emptyMessage
      : directAnswer(query.intent, totalCount, query.filters);
  const structuredType = empty && payload.type !== "access_boundary" && payload.type !== "data_unavailable" ? "no_results" : payload.type;
  const responsePreparationMs = elapsed(responseStarted);
  const operationalContext: LevyTateOperationalCopilotContext = {
    activeIntent: query.intent,
    filters: query.filters,
    evaluatedAt,
  };
  return {
    source: "mock",
    executionMode: "deterministic",
    assistantMessage,
    followUpQuestion: followUpFor(query.intent, query.filters, empty),
    quickReplies: payload.type === "data_unavailable" ? ["Retry"] : quickRepliesFor(query.intent, query.filters, empty),
    shouldShowPathways: false,
    shouldShowActions: false,
    recommendedActions: [],
    suggestedActions: [],
    recommendedPathways: [],
    applicationPrefill: null,
    providerMatchDraft: null,
    nextStep: payload.viewAllUrl ? "Open the relevant LevyTate workspace for the underlying record." : null,
    safetyNotes: [
      "Operational data was retrieved through organisation-scoped LevyTate server contracts.",
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
): ToolPayload {
  return payloadFromRows({
    type: "learner_results",
    title,
    rows: details.map((detail) => ({ key: detail.learnerRecordId, cells: cells(detail), actions: learnerActions(detail, secondaryAction) })),
    columns,
    interpretation,
    emptyMessage,
    viewAllUrl,
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

async function contextLearners(session: LevyTateBetaSession, filters: LevyTateOperationalCopilotFilters) {
  const details = await listOrganisationLearnerLifecycleDetails(session);
  if (!filters.actionType?.startsWith("context:")) return details;
  const prior = filters.actionType.slice("context:".length);
  if (prior === "learners_behind_target") {
    return details.filter((detail) =>
      (detail.progressPosition === "Slightly behind" || detail.progressPosition === "Significantly behind")
      && (!filters.progressPosition || detail.progressPosition === filters.progressPosition)
    );
  }
  if (prior === "overdue_reviews") return details.filter((detail) => detail.reviewSummaries.provider.overdue);
  return details;
}

function directAnswer(intent: LevyTateOperationalCopilotIntent, count: number, filters: LevyTateOperationalCopilotFilters) {
  const singular = count === 1;
  if (intent === "learners_behind_target") return `${count} learner${singular ? "" : "s"} ${singular ? "is" : "are"} currently ${filters.progressPosition === "Significantly behind" ? "significantly " : ""}behind target.`;
  if (intent === "learners_without_recent_progress") return `${count} learner${singular ? " has" : "s have"} no recent progress update.`;
  if (intent === "learners_ending_before") return `${count} apprentice${singular ? " is" : "s are"} expected to end before the selected date.`;
  if (intent === "overdue_reviews") return `${count} review${singular ? " is" : "s are"} currently overdue.`;
  if (intent === "ready_to_enrol") return `${count} learner${singular ? " is" : "s are"} ready to enrol.`;
  if (intent === "pre_enrolment_blockers") return `${count} pre-enrolment blocker${singular ? " is" : "s are"} currently open.`;
  if (intent === "active_breaks") return `${count} learner${singular ? " is" : "s are"} ${filters.dueState === "overdue" ? "past the expected Break in Learning return date" : "currently on a Break in Learning"}.`;
  if (intent === "assessment_readiness") return `${count} learner${singular ? " is" : "s are"} ${filters.assessmentState === "ready" ? "ready to enter assessment" : "approaching assessment"}.`;
  if (intent === "operational_actions") return `${count} operational action${singular ? " requires" : "s require"} attention.`;
  if (intent === "provider_operational_summary") return `${count} provider${singular ? " is" : "s are"} represented in the current result.`;
  if (intent === "programme_operational_summary") return `${count} programme${singular ? " has" : "s have"} current learner activity.`;
  return "This request is outside your authorised workspace boundary.";
}

function followUpFor(intent: LevyTateOperationalCopilotIntent, filters: LevyTateOperationalCopilotFilters, empty: boolean) {
  if (intent === "learners_behind_target" && !filters.progressPosition && !empty) return "Would you like me to show only the significantly behind learners?";
  if (intent === "provider_operational_summary" && !empty) return "Would you like to open a provider record or review the affected learners?";
  if (intent === "learners_ending_before" && !empty) return "Would you like me to narrow this by programme or provider?";
  return null;
}

function quickRepliesFor(intent: LevyTateOperationalCopilotIntent, filters: LevyTateOperationalCopilotFilters, empty: boolean) {
  if (empty) {
    if (intent === "learners_behind_target" && filters.progressPosition) return ["Show all learners behind target"];
    return [];
  }
  if (intent === "learners_behind_target" && !filters.progressPosition) return ["Only show significantly behind learners", "Which providers are they with?"];
  if (intent === "overdue_reviews") return ["Which providers have overdue reviews?"];
  return [];
}

function learnerActions(detail: LearnerRecordDetail, secondaryLabel?: string) {
  const url = `/levytate/app?module=Learners&learner=${encodeURIComponent(detail.learnerRecordId)}`;
  const action = secondaryLabel === "Add progress update" ? "add_progress" : secondaryLabel === "Manage break" ? "manage_break" : secondaryLabel === "Manage assessment" ? "manage_assessment" : "record_review";
  return [{ label: "Open learner", url }, ...(secondaryLabel ? [{ label: secondaryLabel, url: `${url}&action=${action}` }] : [])];
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

function normalise(value: string) {
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
