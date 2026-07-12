import type { OperationalOwnerType, OperationalPriorityLevel } from "@/lib/levytate/mvp/operations-centre";

export const operationalActionSourceTypes = [
  "lifecycle_rule",
  "application_workflow",
  "pre_enrolment_readiness",
  "progress_exception",
  "review_due",
  "break_in_learning",
  "operational_communication",
  "manual_system_correction",
] as const;

export type OperationalActionSourceType = typeof operationalActionSourceTypes[number];

export const persistentOperationalActionTypes = [
  "complete_employee_declaration",
  "verify_england_working_hours",
  "confirm_probation",
  "obtain_hr_approval",
  "confirm_programme",
  "confirm_provider",
  "complete_pre_enrolment",
  "complete_enrolment",
  "record_provider_review",
  "record_l_and_d_check_in",
  "record_manager_check_in",
  "add_progress_update",
  "address_progress_exception",
  "manage_break_in_learning",
  "confirm_return_date",
  "return_learner",
  "record_post_return_review",
  "send_guides",
  "resolve_lifecycle_inconsistency",
] as const;

export type PersistentOperationalActionType = typeof persistentOperationalActionTypes[number];

export const operationalActionStatuses = ["open", "acknowledged", "in_progress", "completed", "dismissed", "cancelled"] as const;
export type OperationalActionStatus = typeof operationalActionStatuses[number];
export type OperationalActionTerminalStatus = Extract<OperationalActionStatus, "completed" | "dismissed" | "cancelled">;
export type OperationalActionCompletionMethod = "source_condition_resolved" | "user_completed" | "dismissed" | "system_cancelled";

export const nonTerminalOperationalActionStatuses: OperationalActionStatus[] = ["open", "acknowledged", "in_progress"];
export const terminalOperationalActionStatuses: OperationalActionTerminalStatus[] = ["completed", "dismissed", "cancelled"];

export const operationalActionEventTypes = [
  "detected",
  "priority_changed",
  "owner_changed",
  "due_date_changed",
  "acknowledged",
  "started",
  "completed",
  "dismissed",
  "cancelled",
  "regenerated",
] as const;

export type OperationalActionEventType = typeof operationalActionEventTypes[number];

export type OperationalActionMetadata = {
  sourceCondition?: string;
  priorActionId?: string;
  conditionClearedAt?: string;
  dismissalSuppressesUntilConditionClears?: boolean;
  [key: string]: unknown;
};

export type PersistentOperationalAction = {
  organisationId: string;
  id: string;
  learnerRecordId: string;
  applicationId: string;
  employeeId: string;
  sourceType: OperationalActionSourceType;
  sourceKey: string;
  actionType: PersistentOperationalActionType;
  title: string;
  description: string;
  priority: OperationalPriorityLevel;
  priorityRank: number;
  status: OperationalActionStatus;
  ownerType: OperationalOwnerType;
  ownerUserId: string;
  ownerDisplayName: string;
  dueDate: string;
  detectedAt: string;
  acknowledgedAt: string;
  acknowledgedBy: string;
  startedAt: string;
  startedBy: string;
  completedAt: string;
  completedBy: string;
  completionMethod: OperationalActionCompletionMethod | "";
  completionNote: string;
  dismissedAt: string;
  dismissedBy: string;
  dismissalReason: string;
  sourceUrl: string;
  metadata: OperationalActionMetadata;
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type OperationalActionEvent = {
  organisationId: string;
  id: string;
  operationalActionId: string;
  eventType: OperationalActionEventType;
  previousStatus: OperationalActionStatus | "";
  newStatus: OperationalActionStatus | "";
  actorUserId: string;
  actorName: string;
  eventDate: string;
  summary: string;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export const operationalActionStatusLabels: Record<OperationalActionStatus, string> = {
  open: "Open",
  acknowledged: "Acknowledged",
  in_progress: "In progress",
  completed: "Completed",
  dismissed: "Dismissed",
  cancelled: "Cancelled",
};

export const operationalActionTransitionMatrix: Record<OperationalActionStatus, OperationalActionStatus[]> = {
  open: ["acknowledged", "in_progress", "completed", "dismissed", "cancelled"],
  acknowledged: ["in_progress", "completed", "dismissed", "cancelled"],
  in_progress: ["completed", "dismissed", "cancelled"],
  completed: [],
  dismissed: [],
  cancelled: [],
};

export function isOperationalActionTerminal(status: OperationalActionStatus) {
  return terminalOperationalActionStatuses.includes(status as OperationalActionTerminalStatus);
}

export function canTransitionOperationalAction(from: OperationalActionStatus, to: OperationalActionStatus) {
  return operationalActionTransitionMatrix[from].includes(to);
}

export function buildOperationalActionSourceKey(learnerRecordId: string, sourceCondition: string) {
  return `${learnerRecordId}:${sourceCondition}`;
}

export function isCriticalOperationalBlocker(sourceCondition: string, priority: OperationalPriorityLevel) {
  if (priority !== "Critical") return false;
  return [
    "eligibility_not_eligible",
    "hr_declined",
    "probation_not_passed",
    "lifecycle_inconsistent",
  ].some((condition) => sourceCondition.includes(condition));
}
