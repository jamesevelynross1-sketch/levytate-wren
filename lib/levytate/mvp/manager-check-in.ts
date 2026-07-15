import type { LearnerLifecycleStatus, LearnerReviewStatus } from "@/lib/levytate/mvp/learner-lifecycle";

export const managerCheckInEligibleLifecycleStatuses = [
  "pre_enrolment",
  "enrolled",
  "break_in_learning",
  "assessment_preparation",
  "in_assessment",
] as const satisfies readonly LearnerLifecycleStatus[];

export const managerCheckInPurposeLabels = {
  routine_progress: "Routine progress discussion",
  application_support: "Application support",
  behind_target_support: "Behind-target support",
  workplace_application: "Workplace application",
  break_in_learning_support: "Break in Learning support",
  return_to_learning: "Return-to-learning discussion",
  assessment_readiness: "Assessment readiness",
  other: "Other",
} as const;

export const managerWorkplaceApplicationLabels = {
  applying_effectively: "Applying learning effectively",
  some_application: "Some workplace application",
  opportunity_required: "Workplace opportunity required",
  not_yet_applicable: "Not yet applicable",
  further_discussion: "Needs further discussion",
} as const;

export const managerSupportAvailableLabels = {
  protected_learning_time: "Protected learning time",
  workplace_project: "Workplace project or task",
  coaching_or_mentoring: "Coaching or mentoring",
  systems_or_data: "Access to systems or data",
  shadowing_or_observation: "Shadowing or observation",
  manager_feedback: "Manager feedback",
  team_support: "Team support",
  other: "Other",
} as const;

export const managerConcernLabels = {
  no_current_concern: "No current concern",
  workload_or_capacity: "Workload or capacity",
  workplace_opportunity: "Lack of workplace opportunity",
  progress_concern: "Progress concern",
  attendance_or_engagement: "Attendance or engagement concern",
  provider_support: "Provider support required",
  role_relevance: "Role relevance concern",
  break_or_return_support: "Break or return support",
  other: "Other",
} as const;

export const managerSupportRequiredLabels = {
  no_additional_support: "No additional support",
  monitor_progress: "Monitor progress",
  line_manager_support: "Line Manager support",
  apprenticeship_lead_support: "Apprenticeship Lead support",
  provider_support: "Provider support",
  workplace_opportunity_required: "Workplace opportunity required",
  escalation_recommended: "Escalation recommended",
  other: "Other",
} as const;

export const managerActionOwnerLabels = {
  employee: "Employee",
  line_manager: "Line Manager",
  apprenticeship_lead: "Apprenticeship Lead",
  provider: "Provider",
  shared: "Shared",
} as const;

export type ManagerCheckInPurpose = keyof typeof managerCheckInPurposeLabels;
export type ManagerWorkplaceApplication = keyof typeof managerWorkplaceApplicationLabels;
export type ManagerSupportAvailable = keyof typeof managerSupportAvailableLabels;
export type ManagerConcern = keyof typeof managerConcernLabels;
export type ManagerSupportRequired = keyof typeof managerSupportRequiredLabels;
export type ManagerActionOwner = keyof typeof managerActionOwnerLabels;
export type ManagerCheckInStatus = Extract<LearnerReviewStatus, "completed" | "action_required">;

export type ManagerCheckInConcern = {
  type: ManagerConcern;
  detail: string;
};

export type ManagerCheckInAgreedAction = {
  description: string;
  responsibleParty: ManagerActionOwner;
  targetDate: string;
};

export type ManagerCheckInDetails = {
  schemaVersion: 1;
  discussionPurpose: ManagerCheckInPurpose;
  discussionPurposeDetail: string;
  workplaceApplication: ManagerWorkplaceApplication;
  learningApplied: string;
  workplaceOpportunityAvailable: string;
  workplaceOpportunityNeeded: string;
  workplaceApplicationNote: string;
  supportAvailable: ManagerSupportAvailable[];
  supportAvailableOtherDetail: string;
  concerns: ManagerCheckInConcern[];
  agreedActions: ManagerCheckInAgreedAction[];
  supportRequired: ManagerSupportRequired[];
  supportRequiredDetail: string;
  actionRequiredReason: string;
  note: string;
};

export type ManagerCheckInInput = Omit<ManagerCheckInDetails, "schemaVersion"> & {
  idempotencyKey: string;
  expectedActivityVersion?: string;
  checkInDate: string;
  nextCheckInDate: string;
  status: ManagerCheckInStatus;
};

type ManagerCheckInStorageEnvelope = {
  schema: "levytate_manager_check_in_v1";
  details: ManagerCheckInDetails;
};

export function managerCheckInStorageEnvelope(details: ManagerCheckInDetails): ManagerCheckInStorageEnvelope {
  return { schema: "levytate_manager_check_in_v1", details };
}

export function parseManagerCheckInDetails(value: unknown): ManagerCheckInDetails | null {
  if (!isObject(value) || value.schema !== "levytate_manager_check_in_v1" || !isObject(value.details)) return null;
  const details = value.details;
  if (details.schemaVersion !== 1) return null;
  if (!hasKey(managerCheckInPurposeLabels, details.discussionPurpose)) return null;
  if (!hasKey(managerWorkplaceApplicationLabels, details.workplaceApplication)) return null;
  if (!Array.isArray(details.supportAvailable) || !details.supportAvailable.every((item) => hasKey(managerSupportAvailableLabels, item))) return null;
  if (!Array.isArray(details.supportRequired) || !details.supportRequired.every((item) => hasKey(managerSupportRequiredLabels, item))) return null;
  if (!Array.isArray(details.concerns) || !details.concerns.every(isConcern)) return null;
  if (!Array.isArray(details.agreedActions) || !details.agreedActions.every(isAgreedAction)) return null;
  return details as ManagerCheckInDetails;
}

export function managerCheckInActionSummaries(details: ManagerCheckInDetails) {
  return details.agreedActions.map((action) => {
    const owner = managerActionOwnerLabels[action.responsibleParty];
    return `${action.description} (${owner}${action.targetDate ? `, by ${action.targetDate}` : ""})`;
  });
}

export function managerCheckInHasOutstandingSupport(details: ManagerCheckInDetails | null, status: LearnerReviewStatus) {
  if (status === "action_required") return true;
  if (!details) return false;
  return details.supportRequired.some((item) => item !== "no_additional_support")
    || details.concerns.some((item) => item.type !== "no_current_concern")
    || details.workplaceApplication === "opportunity_required";
}

export function managerCheckInPurposeLabel(value: ManagerCheckInPurpose) {
  return managerCheckInPurposeLabels[value];
}

export function managerWorkplaceApplicationLabel(value: ManagerWorkplaceApplication) {
  return managerWorkplaceApplicationLabels[value];
}

export function managerSupportRequiredSummary(values: ManagerSupportRequired[]) {
  return values.map((value) => managerSupportRequiredLabels[value]).join(", ");
}

function isConcern(value: unknown): value is ManagerCheckInConcern {
  return isObject(value) && hasKey(managerConcernLabels, value.type) && typeof value.detail === "string";
}

function isAgreedAction(value: unknown): value is ManagerCheckInAgreedAction {
  return isObject(value)
    && typeof value.description === "string"
    && hasKey(managerActionOwnerLabels, value.responsibleParty)
    && typeof value.targetDate === "string";
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hasKey<T extends Record<string, unknown>>(record: T, value: unknown): value is keyof T {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(record, value);
}
