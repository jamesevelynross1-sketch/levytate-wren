import { learnerBreakPolicy, learnerProgressReviewPolicy, learnerReviewTypeLabels, type LearnerReviewType } from "@/lib/levytate/mvp/learner-lifecycle";
import type { LearnerEnrolmentReadinessCheck, LearnerRecordDetail } from "@/lib/levytate/mvp/learner-record-view";
import {
  buildOperationalActionSourceKey,
  type OperationalActionSourceType,
  type OperationalActionStatus,
  type PersistentOperationalActionType,
} from "@/lib/levytate/mvp/operational-actions";

export type OperationalPriorityLevel = "Critical" | "High" | "Medium" | "Low" | "Informational";
export type OperationalOwnerType = "Employee" | "Line Manager" | "Apprenticeship Lead" | "HR" | "Provider" | "Shared";
export type OperationalQueueType = "urgent" | "ready_to_enrol" | "reviews" | "progress" | "breaks" | "pre_enrolment";
export type OperationalDueStatus = "Overdue" | "Due today" | "Due soon" | "No due date";
export type OperationalActionType = "open_learner" | "complete_pre_enrolment" | "complete_enrolment" | "record_review" | "add_progress" | "manage_break" | "return_learner";

export const operationsPolicy = {
  reviewApproachingDays: 14,
  enrolmentReadyHighPriorityAfterDays: 5,
  progressUpdateOverdueDays: learnerProgressReviewPolicy.progressUpdateOverdueDays,
  materiallyOverdueBreakReturnDays: 14,
  recentActivityDays: 30,
  approachingAssessmentDays: 60,
} as const;

export const operationalQueueLabels: Record<OperationalQueueType, string> = {
  urgent: "Needs attention now",
  ready_to_enrol: "Ready to enrol",
  reviews: "Reviews and check-ins",
  progress: "Progress exceptions",
  breaks: "Breaks in Learning",
  pre_enrolment: "Pre-enrolment blockers",
};

export const operationalPriorityRanks: Record<OperationalPriorityLevel, number> = {
  Critical: 0,
  High: 1,
  Medium: 2,
  Low: 3,
  Informational: 4,
};

export type OperationalItem = {
  id: string;
  queueType: OperationalQueueType;
  learnerRecordId: string;
  learnerName: string;
  programmeName: string;
  providerName: string;
  department: string;
  site: string;
  lifecycleStatus: string;
  priorityLevel: OperationalPriorityLevel;
  priorityRank: number;
  reason: string;
  dueDate: string;
  dueStatus: OperationalDueStatus;
  daysOverdue: number | null;
  timingLabel: string;
  ownerType: OperationalOwnerType;
  actionType: OperationalActionType;
  actionLabel: string;
  actionUrl: string;
  secondaryActionUrl: string;
  reviewType?: string;
  latestReviewDate?: string;
  targetProgress?: number;
  actualProgress?: number;
  variance?: number;
  supportAction?: string;
  breakStartDate?: string;
  expectedReturnDate?: string;
  daysOnBreak?: number;
  readinessSummary?: string;
  sourceType: OperationalActionSourceType;
  sourceCondition: string;
  sourceKey: string;
  persistentActionType: PersistentOperationalActionType;
  persistentActionId?: string;
  persistentActionStatus?: OperationalActionStatus;
  persistentDetectedAt?: string;
  persistentAcknowledgedAt?: string;
  persistentDueDate?: string;
  persistentOwnerUserId?: string;
  persistentOwnerDisplayName?: string;
};

export type OperationalActivity = {
  id: string;
  learnerRecordId: string;
  learnerName: string;
  eventDate: string;
  actorName: string;
  action: string;
  actionUrl: string;
};

export type OperationsSummary = {
  needsAttentionNow: number;
  readyToEnrol: number;
  reviewsOverdue: number;
  behindTarget: number;
  activeBreaks: number;
  approachingAssessmentCompletion: number;
};

export type OperationsFilterOptions = {
  priorities: string[];
  queues: Array<{ value: OperationalQueueType; label: string }>;
  learners: string[];
  programmes: string[];
  providers: string[];
  sites: string[];
  departments: string[];
  owners: string[];
  actionTypes: string[];
};

export type OperationsResponse = {
  source: "supabase";
  generatedAt: string;
  summary: OperationsSummary;
  queues: Record<OperationalQueueType, OperationalItem[]>;
  recentActivity: OperationalActivity[];
  filterOptions: OperationsFilterOptions;
  totalAttentionItems: number;
};

type PriorityReason =
  | "eligibility_not_eligible"
  | "hr_declined"
  | "probation_not_passed"
  | "break_materially_overdue"
  | "lifecycle_inconsistent"
  | "significantly_behind"
  | "provider_review_overdue"
  | "support_intervention"
  | "single_enrolment_blocker"
  | "slightly_behind"
  | "check_in_overdue"
  | "progress_overdue"
  | "break_approaching"
  | "review_approaching"
  | "guides_outstanding"
  | "ready_to_enrol"
  | "routine";

export function deriveOperationalPriority(reason: PriorityReason, daysOverdue = 0): OperationalPriorityLevel {
  if (["eligibility_not_eligible", "hr_declined", "probation_not_passed", "lifecycle_inconsistent"].includes(reason)) return "Critical";
  if (reason === "break_materially_overdue") return daysOverdue > operationsPolicy.materiallyOverdueBreakReturnDays ? "Critical" : "High";
  if (["significantly_behind", "provider_review_overdue", "support_intervention", "single_enrolment_blocker"].includes(reason)) return "High";
  if (["slightly_behind", "check_in_overdue", "progress_overdue", "break_approaching"].includes(reason)) return "Medium";
  if (["review_approaching", "guides_outstanding"].includes(reason)) return "Low";
  return reason === "ready_to_enrol" ? "Medium" : "Informational";
}

export function deriveOperationalOwner(reason: PriorityReason, reviewType?: LearnerReviewType): OperationalOwnerType {
  if (reason === "eligibility_not_eligible") return "Employee";
  if (reason === "hr_declined") return "HR";
  if (reviewType === "provider_review" || reason === "provider_review_overdue") return "Shared";
  if (reviewType === "manager_check_in") return "Line Manager";
  if (reviewType === "l_and_d_check_in") return "Apprenticeship Lead";
  if (reason === "support_intervention") return "Shared";
  return "Apprenticeship Lead";
}

export function buildOrganisationOperationalItems(details: LearnerRecordDetail[], now = new Date()): {
  summary: OperationsSummary;
  items: OperationalItem[];
  recentActivity: OperationalActivity[];
} {
  const derivedItems = details.flatMap((detail) => buildLearnerOperationalItems(detail, now));
  const urgentByLearner = new Map<string, OperationalItem>();
  derivedItems.filter((item) => item.queueType === "urgent").sort(compareOperationalItems).forEach((item) => {
    if (!urgentByLearner.has(item.learnerRecordId)) urgentByLearner.set(item.learnerRecordId, item);
  });
  const items = [...derivedItems.filter((item) => item.queueType !== "urgent"), ...urgentByLearner.values()];
  const recentActivity = details
    .flatMap((detail) => buildRecentActivity(detail, now))
    .sort((left, right) => right.eventDate.localeCompare(left.eventDate))
    .slice(0, 12);
  const unique = (queue: OperationalQueueType, predicate?: (item: OperationalItem) => boolean) => new Set(items.filter((item) => item.queueType === queue && (!predicate || predicate(item))).map((item) => item.learnerRecordId)).size;
  return {
    summary: {
      needsAttentionNow: unique("urgent"),
      readyToEnrol: unique("ready_to_enrol"),
      reviewsOverdue: unique("reviews", (item) => item.dueStatus === "Overdue"),
      behindTarget: unique("progress", (item) => item.variance !== undefined && item.variance < 0),
      activeBreaks: details.filter((detail) => Boolean(detail.activeBreak)).length,
      approachingAssessmentCompletion: details.filter((detail) => isApproachingAssessmentOrCompletion(detail, now)).length,
    },
    items: items.sort(compareOperationalItems),
    recentActivity,
  };
}

export function groupOperationalQueues(items: OperationalItem[]): Record<OperationalQueueType, OperationalItem[]> {
  return {
    urgent: items.filter((item) => item.queueType === "urgent"),
    ready_to_enrol: items.filter((item) => item.queueType === "ready_to_enrol"),
    reviews: items.filter((item) => item.queueType === "reviews"),
    progress: items.filter((item) => item.queueType === "progress"),
    breaks: items.filter((item) => item.queueType === "breaks"),
    pre_enrolment: items.filter((item) => item.queueType === "pre_enrolment"),
  };
}

function buildLearnerOperationalItems(detail: LearnerRecordDetail, now: Date): OperationalItem[] {
  const items: OperationalItem[] = [];
  const eligibility = detail.eligibilityDeclaration?.verificationStatus;
  const probation = detail.preEnrolmentChecks?.probationStatus;
  const hr = detail.preEnrolmentChecks?.hrApprovalStatus;

  if (eligibility === "not_eligible") items.push(baseItem(detail, "urgent", "eligibility_not_eligible", "Eligibility is marked not eligible.", "complete_pre_enrolment"));
  if (hr === "declined") items.push(baseItem(detail, "urgent", "hr_declined", "HR approval has been declined.", "complete_pre_enrolment"));
  if (probation === "not_passed") items.push(baseItem(detail, "urgent", "probation_not_passed", "Probation has not been passed.", "complete_pre_enrolment"));
  if (detail.lifecycleStatus === "break_in_learning" && !detail.activeBreak) items.push(baseItem(detail, "urgent", "lifecycle_inconsistent", "Break status has no active break record.", "open_learner"));
  if (detail.progressPosition === "Significantly behind") items.push(progressItem(detail, "urgent", "significantly_behind", now));
  if (learnerProgressReviewPolicy.reviewEligibleStatuses.includes(detail.lifecycleStatus) && hasIntervention(detail)) {
    items.push(baseItem(detail, "urgent", "support_intervention", supportReason(detail), "record_review"));
  }

  if (detail.lifecycleStatus === "pre_enrolment") {
    if (detail.enrolmentReadiness.readyForEnrolment) {
      const ready = baseItem(detail, "ready_to_enrol", "ready_to_enrol", "All mandatory enrolment checks are complete.", "complete_enrolment", detail.actualStartDate || detail.expectedStartDate, now);
      const readyDays = daysBetween(parseDate(detail.updatedAt), startOfDay(now));
      if (readyDays > operationsPolicy.enrolmentReadyHighPriorityAfterDays) {
        ready.priorityLevel = "High";
        ready.priorityRank = operationalPriorityRanks.High;
      }
      ready.readinessSummary = `${detail.enrolmentReadiness.completedChecks.length} mandatory checks complete`;
      items.push(ready);
    } else {
      detail.enrolmentReadiness.blockingChecks.forEach((check) => items.push(blockerItem(detail, check, now)));
      if (detail.enrolmentReadiness.blockingChecks.length === 1) {
        const check = detail.enrolmentReadiness.blockingChecks[0];
        const urgent = baseItem(detail, "urgent", "single_enrolment_blocker", check.message, "complete_pre_enrolment", "", now);
        applyBlockerSource(urgent, check.id);
        items.push(urgent);
      }
      if (!detail.preEnrolmentChecks?.guidesSent) {
        items.push(baseItem(detail, "pre_enrolment", "guides_outstanding", "Learner and manager guides have not been sent.", "complete_pre_enrolment", "", now));
      }
    }
  }

  if (learnerProgressReviewPolicy.reviewEligibleStatuses.includes(detail.lifecycleStatus)) {
    (["provider", "lAndD", "manager"] as const).forEach((key) => {
      const reviewType: LearnerReviewType = key === "provider" ? "provider_review" : key === "lAndD" ? "l_and_d_check_in" : "manager_check_in";
      const review = detail.reviewSummaries[key];
      const dueDate = review.nextDate;
      const timing = operationalDueTiming(dueDate, now);
      const actionRequired = review.latest?.status === "action_required";
      if (timing.daysUntil !== null && timing.daysUntil <= operationsPolicy.reviewApproachingDays || actionRequired) {
        const reasonCode: PriorityReason = actionRequired ? "support_intervention" : timing.daysOverdue > 0 ? (reviewType === "provider_review" ? "provider_review_overdue" : "check_in_overdue") : "review_approaching";
        const item = baseItem(
          detail,
          "reviews",
          reasonCode,
          actionRequired ? `${learnerReviewTypeLabels[reviewType]} requires action.` : `${learnerReviewTypeLabels[reviewType]} ${timing.label.toLowerCase()}.`,
          "record_review",
          dueDate,
          now,
          reviewType,
        );
        item.latestReviewDate = review.latest?.reviewDate ?? "";
        items.push(item);
        if (reviewType === "provider_review" && timing.daysOverdue > 0) {
          items.push(baseItem(detail, "urgent", "provider_review_overdue", `Provider review is ${timing.daysOverdue} days overdue.`, "record_review", dueDate, now, reviewType));
        }
      }
    });
  }

  if (learnerProgressReviewPolicy.progressEligibleStatuses.includes(detail.lifecycleStatus)) {
    const latestDate = detail.latestProgress?.updateDate ?? "";
    const daysSince = latestDate ? daysBetween(parseDate(latestDate), startOfDay(now)) : null;
    if (detail.progressPosition === "Significantly behind" || detail.progressPosition === "Slightly behind") {
      items.push(progressItem(detail, "progress", detail.progressPosition === "Significantly behind" ? "significantly_behind" : "slightly_behind", now));
    } else if (daysSince === null || daysSince > operationsPolicy.progressUpdateOverdueDays) {
      items.push(progressItem(detail, "progress", "progress_overdue", now));
    }
  }

  const activeBreak = detail.activeBreak;
  if (activeBreak) {
    const due = operationalDueTiming(activeBreak.expectedReturnDate, now);
    const materiallyOverdue = due.daysOverdue > operationsPolicy.materiallyOverdueBreakReturnDays;
    const reasonCode: PriorityReason = due.daysOverdue > 0 ? "break_materially_overdue" : due.daysUntil !== null && due.daysUntil <= learnerBreakPolicy.returnDateApproachingDays ? "break_approaching" : "routine";
    const action: OperationalActionType = due.daysOverdue > 0 ? "return_learner" : "manage_break";
    const item = baseItem(detail, "breaks", reasonCode, breakReason(detail), action, activeBreak.expectedReturnDate, now);
    item.breakStartDate = activeBreak.startDate;
    item.expectedReturnDate = activeBreak.expectedReturnDate;
    item.daysOnBreak = detail.breakAttention.daysOnBreak;
    items.push(item);
    if (materiallyOverdue) items.push(baseItem(detail, "urgent", "break_materially_overdue", `Return from break is ${due.daysOverdue} days overdue.`, "return_learner", activeBreak.expectedReturnDate, now));
  } else if (detail.latestBreak?.status === "returned" && postReturnReviewRequired(detail, now)) {
    const dueDate = addDays(detail.latestBreak.actualReturnDate, learnerBreakPolicy.postReturnReviewDays);
    const item = baseItem(detail, "breaks", "check_in_overdue", "Post-return review is required.", "record_review", dueDate, now, "l_and_d_check_in");
    item.sourceType = "break_in_learning";
    item.sourceCondition = "post_return_review_required";
    item.sourceKey = buildOperationalActionSourceKey(item.learnerRecordId, item.sourceCondition);
    item.persistentActionType = "record_post_return_review";
    item.breakStartDate = detail.latestBreak.startDate;
    item.expectedReturnDate = detail.latestBreak.actualReturnDate;
    item.daysOnBreak = daysBetween(parseDate(detail.latestBreak.startDate), parseDate(detail.latestBreak.actualReturnDate));
    items.push(item);
  }

  return deduplicate(items);
}

function baseItem(
  detail: LearnerRecordDetail,
  queueType: OperationalQueueType,
  reasonCode: PriorityReason,
  reason: string,
  actionType: OperationalActionType,
  dueDate = "",
  now = new Date(),
  reviewType?: LearnerReviewType,
): OperationalItem {
  const timing = operationalDueTiming(dueDate, now);
  const priorityLevel = deriveOperationalPriority(reasonCode, timing.daysOverdue);
  const sourceCondition = sourceConditionFor(reasonCode, reviewType);
  return {
    id: `${queueType}:${detail.learnerRecordId}:${reasonCode}:${reviewType ?? "general"}`,
    queueType,
    learnerRecordId: detail.learnerRecordId,
    learnerName: detail.learner.name,
    programmeName: detail.programme.programmeName,
    providerName: detail.programme.providerName,
    department: detail.learner.department,
    site: detail.learner.site,
    lifecycleStatus: detail.lifecycleStatusLabel,
    priorityLevel,
    priorityRank: operationalPriorityRanks[priorityLevel],
    reason,
    dueDate,
    dueStatus: timing.status,
    daysOverdue: timing.daysOverdue || null,
    timingLabel: timing.label,
    ownerType: deriveOperationalOwner(reasonCode, reviewType),
    actionType,
    actionLabel: actionLabel(actionType),
    actionUrl: `/levytate/app?module=Learners&learner=${encodeURIComponent(detail.learnerRecordId)}&action=${actionType}`,
    secondaryActionUrl: `/levytate/app?module=Learners&learner=${encodeURIComponent(detail.learnerRecordId)}`,
    reviewType: reviewType ? learnerReviewTypeLabels[reviewType] : undefined,
    sourceType: sourceTypeFor(reasonCode, reviewType),
    sourceCondition,
    sourceKey: buildOperationalActionSourceKey(detail.learnerRecordId, sourceCondition),
    persistentActionType: persistentActionTypeFor(reasonCode, reviewType),
  };
}

function blockerItem(detail: LearnerRecordDetail, check: LearnerEnrolmentReadinessCheck, now: Date) {
  const owner = blockerOwner(check.id);
  const item = baseItem(detail, "pre_enrolment", "routine", blockerReason(check), "complete_pre_enrolment", "", now);
  item.id = `pre_enrolment:${detail.learnerRecordId}:blocker:${check.id}`;
  item.ownerType = owner;
  item.priorityLevel = detail.enrolmentReadiness.blockingChecks.length === 1 ? "High" : check.status === "Needs review" ? "High" : "Medium";
  item.priorityRank = operationalPriorityRanks[item.priorityLevel];
  applyBlockerSource(item, check.id);
  return item;
}

function progressItem(detail: LearnerRecordDetail, queue: "urgent" | "progress", reasonCode: PriorityReason, now: Date) {
  const latest = detail.latestProgress;
  const dueDate = latest?.updateDate ? addDays(latest.updateDate, operationsPolicy.progressUpdateOverdueDays) : "";
  const reason = reasonCode === "progress_overdue"
    ? latest ? "Progress update is overdue." : "No progress update has been recorded for this active learner."
    : `${detail.progressPosition}: ${Math.abs(latest?.variancePercentage ?? 0)} percentage points behind target.`;
  const item = baseItem(detail, queue, reasonCode, reason, reasonCode === "support_intervention" ? "record_review" : "add_progress", dueDate, now);
  item.targetProgress = latest?.targetProgressPercentage;
  item.actualProgress = latest?.actualProgressPercentage;
  item.variance = latest?.variancePercentage;
  item.supportAction = latest?.supportAction ?? "";
  return item;
}

function buildRecentActivity(detail: LearnerRecordDetail, now: Date): OperationalActivity[] {
  const cutoff = addDays(toDateString(now), -operationsPolicy.recentActivityDays);
  const supported = new Set([
    "enrolled", "enrolment_completed", "progress_updated", "provider_review_recorded", "l_and_d_check_in_recorded",
    "manager_check_in_recorded", "break_started", "returned_from_break", "eligibility_employer_verified", "hr_approved", "guides_sent",
  ]);
  return detail.lifecycleTimeline
    .filter((event) => supported.has(event.eventType) && event.eventDate.slice(0, 10) >= cutoff)
    .map((event) => ({
      id: event.id,
      learnerRecordId: detail.learnerRecordId,
      learnerName: detail.learner.name,
      eventDate: event.eventDate,
      actorName: event.actorName || "Workspace user",
      action: event.summary,
      actionUrl: `/levytate/app?module=Learners&learner=${encodeURIComponent(detail.learnerRecordId)}`,
    }));
}

function isApproachingAssessmentOrCompletion(detail: LearnerRecordDetail, now: Date) {
  if (detail.lifecycleStatus === "assessment_preparation" || detail.lifecycleStatus === "in_assessment") return true;
  if (!detail.expectedEndDate || !learnerProgressReviewPolicy.progressEligibleStatuses.includes(detail.lifecycleStatus)) return false;
  const days = daysBetween(startOfDay(now), parseDate(detail.expectedEndDate));
  return days >= 0 && days <= operationsPolicy.approachingAssessmentDays;
}

function postReturnReviewRequired(detail: LearnerRecordDetail, now: Date) {
  const returned = detail.latestBreak?.actualReturnDate;
  if (!returned) return false;
  const reviewAfterReturn = detail.reviewHistory.some((review) => review.reviewDate >= returned && review.reviewType !== "provider_review");
  return !reviewAfterReturn && daysBetween(parseDate(returned), startOfDay(now)) >= 0;
}

function hasIntervention(detail: LearnerRecordDetail) {
  return detail.reviewHistory.some((review) => review.status === "action_required")
    || Boolean(detail.latestProgress?.supportAction && /escalat|intervention|required|recovery plan/i.test(detail.latestProgress.supportAction));
}

function supportReason(detail: LearnerRecordDetail) {
  const review = detail.reviewHistory.find((item) => item.status === "action_required");
  if (review) return `${learnerReviewTypeLabels[review.reviewType]} requires follow-up action.`;
  return detail.latestProgress?.supportAction || "Learner support action requires attention.";
}

function breakReason(detail: LearnerRecordDetail) {
  if (detail.breakAttention.state === "overdue") return `Return from break is ${Math.abs(detail.breakAttention.daysUntilReturn ?? 0)} days overdue.`;
  if (detail.breakAttention.state === "approaching") return `Expected return is in ${detail.breakAttention.daysUntilReturn} days.`;
  if (detail.breakAttention.state === "unknown") return "Expected return date is not confirmed.";
  if (detail.breakAttention.state === "confirmations") return "Return confirmations remain outstanding.";
  return "Active Break in Learning requires monitoring.";
}

function blockerReason(check: LearnerEnrolmentReadinessCheck) {
  const labels: Record<string, string> = {
    "employee-england-declaration": "Awaiting employee working-hours declaration.",
    "employer-eligibility-verification": check.status === "Needs review" ? "Eligibility requires employer review." : "Awaiting employer eligibility verification.",
    "probation-complete": "Awaiting probation confirmation.",
    "hr-approval-complete": "Awaiting HR approval.",
    "programme-confirmed": "Programme is not confirmed.",
    "provider-confirmed": "Provider is not confirmed.",
    "actual-start-date": "Actual start date is missing.",
    "expected-end-date": "Expected end date is missing.",
    "employment-route": "Employment route is not confirmed.",
  };
  return labels[check.id] ?? check.message;
}

function blockerOwner(checkId: string): OperationalOwnerType {
  if (checkId === "employee-england-declaration") return "Employee";
  if (checkId === "hr-approval-complete") return "HR";
  if (checkId === "probation-complete") return "Line Manager";
  return "Apprenticeship Lead";
}

function applyBlockerSource(item: OperationalItem, checkId: string) {
  item.sourceType = "pre_enrolment_readiness";
  item.sourceCondition = `pre_enrolment:${checkId}`;
  item.sourceKey = buildOperationalActionSourceKey(item.learnerRecordId, item.sourceCondition);
  item.persistentActionType = blockerActionType(checkId);
}

function blockerActionType(checkId: string): PersistentOperationalActionType {
  const actions: Record<string, PersistentOperationalActionType> = {
    "employee-england-declaration": "complete_employee_declaration",
    "employer-eligibility-verification": "verify_england_working_hours",
    "probation-complete": "confirm_probation",
    "hr-approval-complete": "obtain_hr_approval",
    "programme-confirmed": "confirm_programme",
    "provider-confirmed": "confirm_provider",
  };
  return actions[checkId] ?? "complete_pre_enrolment";
}

function sourceConditionFor(reason: PriorityReason, reviewType?: LearnerReviewType) {
  if (reason === "support_intervention" && reviewType) return `support_intervention:${reviewType}`;
  if (["provider_review_overdue", "check_in_overdue", "review_approaching"].includes(reason) && reviewType) return `review_due:${reviewType}`;
  if (reason === "break_materially_overdue") return "return_date_overdue";
  if (reason === "break_approaching" || reason === "routine") return "break_in_learning_active";
  if (reason === "significantly_behind" || reason === "slightly_behind") return "progress_behind_target";
  return reason;
}

function sourceTypeFor(reason: PriorityReason, reviewType?: LearnerReviewType): OperationalActionSourceType {
  if (["eligibility_not_eligible", "hr_declined", "probation_not_passed", "single_enrolment_blocker", "ready_to_enrol"].includes(reason)) return "pre_enrolment_readiness";
  if (["significantly_behind", "slightly_behind", "progress_overdue", "support_intervention"].includes(reason)) return "progress_exception";
  if (["provider_review_overdue", "check_in_overdue", "review_approaching"].includes(reason) || reviewType) return "review_due";
  if (["break_materially_overdue", "break_approaching", "routine"].includes(reason)) return "break_in_learning";
  if (reason === "guides_outstanding") return "operational_communication";
  return "lifecycle_rule";
}

function persistentActionTypeFor(reason: PriorityReason, reviewType?: LearnerReviewType): PersistentOperationalActionType {
  if (reason === "eligibility_not_eligible") return "verify_england_working_hours";
  if (reason === "hr_declined") return "obtain_hr_approval";
  if (reason === "probation_not_passed") return "confirm_probation";
  if (reason === "lifecycle_inconsistent") return "resolve_lifecycle_inconsistency";
  if (reason === "ready_to_enrol") return "complete_enrolment";
  if (reason === "guides_outstanding") return "send_guides";
  if (["significantly_behind", "slightly_behind", "support_intervention"].includes(reason)) return "address_progress_exception";
  if (reason === "progress_overdue") return "add_progress_update";
  if (reason === "break_materially_overdue") return "return_learner";
  if (reason === "break_approaching" || reason === "routine") return "manage_break_in_learning";
  if (reviewType === "provider_review") return "record_provider_review";
  if (reviewType === "manager_check_in") return "record_manager_check_in";
  if (reviewType === "l_and_d_check_in") return "record_l_and_d_check_in";
  return "complete_pre_enrolment";
}

function actionLabel(action: OperationalActionType) {
  const labels: Record<OperationalActionType, string> = {
    open_learner: "Open learner",
    complete_pre_enrolment: "Complete pre-enrolment",
    complete_enrolment: "Complete enrolment",
    record_review: "Record review",
    add_progress: "Add progress update",
    manage_break: "Manage break",
    return_learner: "Return learner",
  };
  return labels[action];
}

export function operationalDueTiming(value: string, now = new Date()) {
  if (!value) return { status: "No due date" as const, daysUntil: null as number | null, daysOverdue: 0, label: "No due date" };
  const daysUntil = daysBetween(startOfDay(now), parseDate(value));
  if (daysUntil < 0) return { status: "Overdue" as const, daysUntil, daysOverdue: Math.abs(daysUntil), label: `${Math.abs(daysUntil)} days overdue` };
  if (daysUntil === 0) return { status: "Due today" as const, daysUntil, daysOverdue: 0, label: "Due today" };
  if (daysUntil <= operationsPolicy.reviewApproachingDays) return { status: "Due soon" as const, daysUntil, daysOverdue: 0, label: `Due in ${daysUntil} days` };
  return { status: "Due soon" as const, daysUntil, daysOverdue: 0, label: `Due ${formatDate(value)}` };
}

function compareOperationalItems(left: OperationalItem, right: OperationalItem) {
  return left.priorityRank - right.priorityRank
    || (right.daysOverdue ?? -1) - (left.daysOverdue ?? -1)
    || (left.variance ?? 0) - (right.variance ?? 0)
    || left.learnerName.localeCompare(right.learnerName);
}

function deduplicate(items: OperationalItem[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.queueType}:${item.learnerRecordId}:${item.reason}:${item.actionType}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function parseDate(value: string) {
  return new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
}

function startOfDay(value: Date) {
  return parseDate(value.toISOString().slice(0, 10));
}

function daysBetween(left: Date, right: Date) {
  return Math.floor((right.getTime() - left.getTime()) / 86_400_000);
}

function addDays(value: string, days: number) {
  const date = parseDate(value);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function toDateString(value: Date) {
  return value.toISOString().slice(0, 10);
}

function formatDate(value: string) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(parseDate(value));
}
