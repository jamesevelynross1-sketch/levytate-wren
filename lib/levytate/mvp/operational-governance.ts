import type {
  OperationalActionCompletionMethod,
  OperationalActionStatus,
  PersistentOperationalAction,
} from "@/lib/levytate/mvp/operational-actions";
import type { OperationalPriorityLevel } from "@/lib/levytate/mvp/operations-centre";

export const operationalAgeingBands = ["New", "Current", "Ageing", "Significantly ageing", "Long outstanding"] as const;
export type OperationalAgeingBand = typeof operationalAgeingBands[number];

export const operationalGovernancePolicy = {
  acknowledgementDays: {
    Critical: 1,
    High: 1,
    Medium: 3,
    Low: 7,
    Informational: null,
  } satisfies Record<OperationalPriorityLevel, number | null>,
  stalledInProgressDays: 7,
  maximumOrganisationActions: 5000,
  defaultPageSize: 50,
  maximumPageSize: 50,
} as const;

export type OperationalActionTiming = {
  ageInDays: number;
  ageingBand: OperationalAgeingBand;
  daysOverdue: number;
  acknowledgementDuration: number | null;
  inProgressDuration: number | null;
  resolutionDuration: number | null;
  closedAt: string;
  closedBy: string;
  lastMeaningfulUpdate: string;
  daysWithoutMovement: number;
};

export function deriveActionAgeing(action: PersistentOperationalAction, now = new Date()): OperationalActionTiming {
  const detectedAt = validDate(action.detectedAt) ?? now;
  const closedAt = deriveClosedAt(action);
  const ageEnd = validDate(closedAt) ?? now;
  const ageInDays = elapsedDays(detectedAt, ageEnd);
  const dueDate = validDate(action.dueDate);
  const acknowledgedAt = validDate(action.acknowledgedAt);
  const startedAt = validDate(action.startedAt);
  const lastMeaningfulUpdate = validDate(action.updatedAt) ?? detectedAt;
  return {
    ageInDays,
    ageingBand: ageingBandFor(ageInDays),
    daysOverdue: dueDate && dueDate < startOfUtcDay(now) ? elapsedDays(dueDate, startOfUtcDay(now)) : 0,
    acknowledgementDuration: acknowledgedAt ? elapsedDays(detectedAt, acknowledgedAt) : null,
    inProgressDuration: startedAt ? elapsedDays(acknowledgedAt ?? detectedAt, startedAt) : null,
    resolutionDuration: closedAt ? elapsedDays(detectedAt, validDate(closedAt) ?? now) : null,
    closedAt,
    closedBy: deriveClosedBy(action),
    lastMeaningfulUpdate: lastMeaningfulUpdate.toISOString(),
    daysWithoutMovement: elapsedDays(lastMeaningfulUpdate, now),
  };
}

export function deriveAcknowledgementTiming(action: PersistentOperationalAction, now = new Date()) {
  const threshold = operationalGovernancePolicy.acknowledgementDays[action.priority];
  const age = elapsedDays(validDate(action.detectedAt) ?? now, now);
  return {
    thresholdDays: threshold,
    elapsedDays: age,
    awaitingAcknowledgement: action.status === "open" && threshold !== null && age > threshold,
  };
}

export function deriveResolutionTiming(action: PersistentOperationalAction, now = new Date()) {
  const timing = deriveActionAgeing(action, now);
  return {
    closedAt: timing.closedAt,
    closedBy: timing.closedBy,
    resolutionDuration: timing.resolutionDuration,
    outcomeSummary: operationalOutcomeSummary(action),
  };
}

export function deriveClosedAt(action: PersistentOperationalAction) {
  if (action.status === "dismissed") return action.dismissedAt;
  if (action.status === "cancelled") return action.metadata.cancellation?.cancelledAt || action.completedAt;
  if (action.status === "completed") return action.completedAt;
  return "";
}

export function deriveClosedBy(action: PersistentOperationalAction) {
  if (action.status === "dismissed") return action.dismissedBy;
  if (action.status === "cancelled") return action.metadata.cancellation?.cancelledBy || action.completedBy;
  if (action.status === "completed") return action.completedBy;
  return "";
}

export function operationalOutcomeSummary(action: PersistentOperationalAction) {
  if (!isTerminalStatus(action.status)) return "";
  if (action.status === "dismissed") {
    const reason = action.dismissalReason.trim();
    return reason ? `Dismissed as not applicable. ${reason}` : "Dismissed as not applicable. The underlying learner record was unchanged.";
  }
  if (action.status === "cancelled") {
    const reason = action.metadata.cancellation?.reason?.trim() || action.completionNote.trim();
    return reason ? `Cancelled following an administrative correction. ${reason}` : "Cancelled following an administrative correction.";
  }
  if (action.completionMethod === "source_condition_resolved") {
    return action.completionNote.trim() || "Completed automatically when the source learner condition was resolved.";
  }
  if (action.completionMethod === "user_completed") {
    return action.completionNote.trim() || "Completed manually with recorded evidence.";
  }
  return action.completionNote.trim() || "Completed.";
}

export function ageingBandFor(days: number): OperationalAgeingBand {
  if (days <= 2) return "New";
  if (days <= 7) return "Current";
  if (days <= 14) return "Ageing";
  if (days <= 30) return "Significantly ageing";
  return "Long outstanding";
}

export function medianDuration(values: Array<number | null>) {
  const sorted = values.filter((value): value is number => value !== null && Number.isFinite(value)).sort((left, right) => left - right);
  if (!sorted.length) return null;
  const midpoint = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[midpoint] : (sorted[midpoint - 1] + sorted[midpoint]) / 2;
}

export function isTerminalStatus(status: OperationalActionStatus) {
  return status === "completed" || status === "dismissed" || status === "cancelled";
}

export function completionMethodLabel(method: OperationalActionCompletionMethod | "") {
  const labels: Record<OperationalActionCompletionMethod | "", string> = {
    "": "Not recorded",
    source_condition_resolved: "Completed automatically",
    user_completed: "Completed manually",
    dismissed: "Dismissed",
    system_cancelled: "Cancelled",
  };
  return labels[method];
}

function elapsedDays(from: Date, to: Date) {
  return Math.max(0, Math.floor((to.getTime() - from.getTime()) / 86_400_000));
}

function startOfUtcDay(value: Date) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

function validDate(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}
