import type { LevyTateBetaSession } from "@/lib/levytate/config/beta-access";
import { getApprenticeshipStandard } from "@/lib/levytate/domain";
import {
  managerActionPrimaryAction,
  type ManagerOperationalActionDetail,
  type ManagerOperationalActionFilter,
  type ManagerOperationalActionKindFilter,
  type ManagerOperationalActionListItem,
  type ManagerOperationalActionsResponse,
} from "@/lib/levytate/mvp/manager-operational-actions";
import { operationalActionStatusLabels, type PersistentOperationalAction } from "@/lib/levytate/mvp/operational-actions";
import {
  acknowledgeManagerDirectReportOperationalAction,
  getManagerDirectReportOperationalAction,
  listManagerDirectReportOperationalActions,
  startManagerDirectReportOperationalAction,
} from "@/lib/server/levytate-operational-actions";

export async function listManagerActions(
  session: LevyTateBetaSession,
  filter: ManagerOperationalActionFilter = "all",
  kind: ManagerOperationalActionKindFilter = "all",
): Promise<ManagerOperationalActionsResponse> {
  const result = await listManagerDirectReportOperationalActions(session);
  const details = new Map(result.details.map((detail) => [detail.learnerRecordId, detail]));
  const applications = new Map(result.applicationSources.map((source) => [source.application.id, source.application]));
  const all = result.actions.flatMap((action) => {
    if (action.actionType === "review_application") {
      const application = applications.get(action.applicationId);
      return application ? [toListItem(action, { kind: "application_review", application })] : [];
    }
    const detail = details.get(action.learnerRecordId);
    return detail ? [toListItem(action, { kind: "learner", detail })] : [];
  });
  const kindScoped = all.filter((action) => kind === "all" || action.kind === kind);
  const actions = kindScoped.filter((action) => filter === "all"
    || filter === "overdue" && action.overdue
    || action.status === filter);
  return {
    source: "supabase",
    generatedAt: new Date().toISOString(),
    summary: {
      open: kindScoped.filter((action) => action.status === "open").length,
      acknowledged: kindScoped.filter((action) => action.status === "acknowledged").length,
      inProgress: kindScoped.filter((action) => action.status === "in_progress").length,
      overdue: kindScoped.filter((action) => action.overdue).length,
    },
    actions: actions.sort(compareManagerActions),
  };
}

export async function getManagerAction(session: LevyTateBetaSession, actionId: string): Promise<ManagerOperationalActionDetail> {
  const result = await getManagerDirectReportOperationalAction(session, actionId);
  const item = toListItem(result.action, result.source);
  const employee = result.source.kind === "application_review" ? result.source.application.employee : result.source.detail.learner;
  const programme = result.source.kind === "application_review"
    ? getApprenticeshipStandard(result.source.application.apprenticeshipStandardId)?.title ?? result.source.application.apprenticeshipStandardId
    : result.source.detail.programme.programmeName;
  return {
    ...item,
    employee: {
      name: employee.name,
      jobTitle: employee.jobTitle,
      department: employee.department,
      site: employee.site,
    },
    programme: {
      name: programme,
      providerName: result.source.kind === "application_review" ? "Confirmed after approval" : result.source.detail.programme.providerName,
    },
    ownerLabel: result.action.actionType === "review_application" ? result.action.ownerDisplayName : result.action.ownerType === "Shared" ? "Shared manager support" : "Line Manager",
    detectedAt: result.action.detectedAt,
    nextStep: nextManagerStep(result.action),
    history: result.history.map(({ eventType, actorName, eventDate, summary }) => ({ eventType, actorName, eventDate, summary })),
  };
}

export async function acknowledgeManagerAction(session: LevyTateBetaSession, actionId: string, expectedVersion: number) {
  await acknowledgeManagerDirectReportOperationalAction(session, actionId, expectedVersion);
  return getManagerAction(session, actionId);
}

export async function startManagerAction(session: LevyTateBetaSession, actionId: string, expectedVersion: number, note = "") {
  await startManagerDirectReportOperationalAction(session, actionId, expectedVersion, note);
  return getManagerAction(session, actionId);
}

type ManagerActionSource = Awaited<ReturnType<typeof getManagerDirectReportOperationalAction>>["source"];

function toListItem(action: PersistentOperationalAction, source: ManagerActionSource): ManagerOperationalActionListItem {
  const timing = managerTiming(action.dueDate);
  const application = source.kind === "application_review" ? source.application : null;
  const employeeName = application?.employee.name ?? (source.kind === "learner" ? source.detail.learner.name : "");
  const programmeName = application
    ? getApprenticeshipStandard(application.apprenticeshipStandardId)?.title ?? application.apprenticeshipStandardId
    : source.kind === "learner" ? source.detail.programme.programmeName : "";
  return {
    actionId: action.id,
    title: action.title,
    employeeName,
    programmeName,
    priority: action.priority,
    status: action.status,
    statusLabel: operationalActionStatusLabels[action.status],
    dueDate: action.dueDate,
    timingLabel: timing.label,
    overdue: timing.overdue,
    reason: action.description,
    kind: action.actionType === "review_application" ? "application_review" : "manager_support",
    submittedDate: application ? String(action.metadata.submittedAt || application.submittedAt) : "",
    submittedVersion: action.actionType === "review_application" ? Number(action.metadata.submittedVersion || 1) : null,
    primaryAction: managerActionPrimaryAction(action.status),
    sourceUrl: managerSourceUrl(action),
    version: action.version,
  };
}

function nextManagerStep(action: PersistentOperationalAction) {
  if (action.actionType === "review_application") {
    if (action.status === "open") return "Acknowledge the review, then open the existing Approvals workflow when you are ready to decide.";
    if (action.status === "acknowledged") return "Start work, then review the submitted application in Approvals.";
    if (action.status === "in_progress") return "Complete the decision in Approvals; LevyTate will close this action automatically.";
    return "Review the history; the application decision closed this occurrence.";
  }
  if (action.status === "open") return "Acknowledge that this action is in your current direct-report workload.";
  if (action.status === "acknowledged") return "Start work, then continue in the authorised source workflow.";
  if (action.status === "in_progress") return "Continue the work in the linked direct-report workflow.";
  return "Review the history; the source workflow has closed this occurrence.";
}

function managerTiming(value: string) {
  if (!value) return { label: "No due date", overdue: false };
  const due = new Date(`${value.slice(0, 10)}T12:00:00Z`).getTime();
  const today = new Date();
  const current = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), 12);
  const days = Math.round((due - current) / 86_400_000);
  if (days < 0) return { label: `${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} overdue`, overdue: true };
  if (days === 0) return { label: "Due today", overdue: false };
  return { label: `Due in ${days} day${days === 1 ? "" : "s"}`, overdue: false };
}

function managerSourceUrl(action: PersistentOperationalAction) {
  if (action.actionType === "review_application") return action.sourceUrl;
  const base = `/levytate/app/my-team/${encodeURIComponent(action.employeeId)}`;
  return action.actionType === "record_manager_check_in" ? `${base}?action=manager-check-in` : base;
}

function compareManagerActions(left: ManagerOperationalActionListItem, right: ManagerOperationalActionListItem) {
  return Number(right.overdue) - Number(left.overdue)
    || priorityRank(left.priority) - priorityRank(right.priority)
    || (left.dueDate || "9999-12-31").localeCompare(right.dueDate || "9999-12-31")
    || left.employeeName.localeCompare(right.employeeName);
}

function priorityRank(priority: ManagerOperationalActionListItem["priority"]) {
  return { Critical: 0, High: 1, Medium: 2, Low: 3, Informational: 4 }[priority];
}
