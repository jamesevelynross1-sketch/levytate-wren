import type { LevyTateBetaSession } from "@/lib/levytate/config/beta-access";
import {
  managerActionPrimaryAction,
  type ManagerOperationalActionDetail,
  type ManagerOperationalActionFilter,
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
): Promise<ManagerOperationalActionsResponse> {
  const result = await listManagerDirectReportOperationalActions(session);
  const details = new Map(result.details.map((detail) => [detail.learnerRecordId, detail]));
  const all = result.actions.flatMap((action) => {
    const detail = details.get(action.learnerRecordId);
    return detail ? [toListItem(action, detail)] : [];
  });
  const actions = all.filter((action) => filter === "all"
    || filter === "overdue" && action.overdue
    || action.status === filter);
  return {
    source: "supabase",
    generatedAt: new Date().toISOString(),
    summary: {
      open: all.filter((action) => action.status === "open").length,
      acknowledged: all.filter((action) => action.status === "acknowledged").length,
      inProgress: all.filter((action) => action.status === "in_progress").length,
      overdue: all.filter((action) => action.overdue).length,
    },
    actions: actions.sort(compareManagerActions),
  };
}

export async function getManagerAction(session: LevyTateBetaSession, actionId: string): Promise<ManagerOperationalActionDetail> {
  const result = await getManagerDirectReportOperationalAction(session, actionId);
  const item = toListItem(result.action, result.detail);
  return {
    ...item,
    employee: {
      name: result.detail.learner.name,
      jobTitle: result.detail.learner.jobTitle,
      department: result.detail.learner.department,
      site: result.detail.learner.site,
    },
    programme: {
      name: result.detail.programme.programmeName,
      providerName: result.detail.programme.providerName,
    },
    ownerLabel: result.action.ownerType === "Shared" ? "Shared manager support" : "Line Manager",
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

function toListItem(action: PersistentOperationalAction, detail: Awaited<ReturnType<typeof getManagerDirectReportOperationalAction>>["detail"]): ManagerOperationalActionListItem {
  const timing = managerTiming(action.dueDate);
  return {
    actionId: action.id,
    title: action.title,
    employeeName: detail.learner.name,
    programmeName: detail.programme.programmeName,
    priority: action.priority,
    status: action.status,
    statusLabel: operationalActionStatusLabels[action.status],
    dueDate: action.dueDate,
    timingLabel: timing.label,
    overdue: timing.overdue,
    reason: action.description,
    primaryAction: managerActionPrimaryAction(action.status),
    sourceUrl: managerSourceUrl(action),
    version: action.version,
  };
}

function nextManagerStep(action: PersistentOperationalAction) {
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
