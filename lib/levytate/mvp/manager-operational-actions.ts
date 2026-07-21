import type {
  OperationalActionEvent,
  OperationalActionStatus,
  PersistentOperationalAction,
  PersistentOperationalActionType,
} from "@/lib/levytate/mvp/operational-actions";
import type { OperationalItem } from "@/lib/levytate/mvp/operations-centre";

export const managerOwnedOperationalActionTypes = [
  "review_application",
  "confirm_probation",
  "record_manager_check_in",
  "obtain_manager_readiness_confirmation",
] as const satisfies readonly PersistentOperationalActionType[];

export type ManagerOperationalActionFilter = "all" | "open" | "acknowledged" | "in_progress" | "overdue";
export type ManagerOperationalActionKindFilter = "all" | "application_review" | "manager_support";

export type ManagerOperationalActionListItem = {
  actionId: string;
  title: string;
  employeeName: string;
  programmeName: string;
  priority: PersistentOperationalAction["priority"];
  status: OperationalActionStatus;
  statusLabel: string;
  dueDate: string;
  timingLabel: string;
  overdue: boolean;
  reason: string;
  kind: "application_review" | "manager_support";
  submittedDate: string;
  submittedVersion: number | null;
  primaryAction: "Acknowledge" | "Start work" | "Open source workflow" | "View history";
  sourceUrl: string;
  version: number;
};

export type ManagerOperationalActionHistoryItem = Pick<OperationalActionEvent, "eventType" | "actorName" | "eventDate" | "summary">;

export type ManagerOperationalActionDetail = ManagerOperationalActionListItem & {
  employee: { name: string; jobTitle: string; department: string; site: string };
  programme: { name: string; providerName: string };
  ownerLabel: string;
  detectedAt: string;
  nextStep: string;
  history: ManagerOperationalActionHistoryItem[];
};

export type ManagerOperationalActionsResponse = {
  source: "supabase";
  generatedAt: string;
  summary: { open: number; acknowledged: number; inProgress: number; overdue: number };
  actions: ManagerOperationalActionListItem[];
};

export function isManagerRelevantOperationalItem(item: OperationalItem) {
  if (item.ownerType === "Line Manager") {
    return managerOwnedOperationalActionTypes.includes(item.persistentActionType as typeof managerOwnedOperationalActionTypes[number]);
  }
  return item.ownerType === "Shared"
    && item.persistentActionType === "address_progress_exception"
    && item.sourceCondition === "support_intervention:manager_check_in";
}

export function isManagerRelevantPersistentAction(action: PersistentOperationalAction, managerUserId: string) {
  if (action.ownerType === "Line Manager") {
    if (action.actionType === "review_application") return action.ownerUserId === managerUserId;
    return managerOwnedOperationalActionTypes.includes(action.actionType as typeof managerOwnedOperationalActionTypes[number])
      && (!action.ownerUserId || action.ownerUserId === managerUserId);
  }
  return action.ownerType === "Shared"
    && !action.ownerUserId
    && action.actionType === "address_progress_exception"
    && action.metadata.sourceCondition === "support_intervention:manager_check_in";
}

export function managerActionPrimaryAction(status: OperationalActionStatus): ManagerOperationalActionListItem["primaryAction"] {
  if (status === "open") return "Acknowledge";
  if (status === "acknowledged") return "Start work";
  if (status === "in_progress") return "Open source workflow";
  return "View history";
}
