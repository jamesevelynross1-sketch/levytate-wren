import type { RequestStatus } from "@/lib/levytate/domain";
import type { MvpApplicationHistoryEntry, MvpApplicationOwner } from "@/lib/levytate/mvp/workspace";

export const managerReviewableApplicationStatuses = ["Submitted to Line Manager", "Awaiting Manager Review"] as const satisfies readonly RequestStatus[];

export type ApplicationReviewOccurrence = {
  sourceKey: string;
  sourceCondition: string;
  submittedVersion: number;
  occurrenceId: string;
  submittedAt: string;
};

type ReviewableApplication = {
  id: string;
  status: RequestStatus;
  currentOwner: MvpApplicationOwner;
  submittedAt: string;
  updatedAt: string;
  history: MvpApplicationHistoryEntry[];
};

export function isManagerReviewableApplication(application: Pick<ReviewableApplication, "status" | "currentOwner">) {
  return managerReviewableApplicationStatuses.includes(application.status as typeof managerReviewableApplicationStatuses[number])
    && application.currentOwner === "Line Manager";
}

export function getApplicationReviewOccurrence(application: ReviewableApplication): ApplicationReviewOccurrence | null {
  if (!isManagerReviewableApplication(application)) return null;
  const history = [...application.history].sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  const reviewStarts = history.filter((entry, index) => isManagerReviewStatus(entry.status) && (index === 0 || !isManagerReviewStatus(history[index - 1].status)));
  const currentStart = reviewStarts.at(-1);
  const fallback = application.submittedAt || application.updatedAt;
  const occurrenceId = currentStart?.id || fallback;
  return {
    sourceKey: `${application.id}:manager-review:${occurrenceId}`,
    sourceCondition: "manager_review_required",
    submittedVersion: Math.max(1, reviewStarts.length || 1),
    occurrenceId,
    submittedAt: currentStart?.createdAt || fallback,
  };
}

function isManagerReviewStatus(status: RequestStatus) {
  return managerReviewableApplicationStatuses.includes(status as typeof managerReviewableApplicationStatuses[number]);
}
