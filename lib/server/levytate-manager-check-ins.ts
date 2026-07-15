import type { LevyTateBetaSession } from "@/lib/levytate/config/beta-access";
import {
  managerActionOwnerLabels,
  managerCheckInActionSummaries,
  managerCheckInEligibleLifecycleStatuses,
  managerCheckInPurposeLabel,
  managerCheckInPurposeLabels,
  managerCheckInStorageEnvelope,
  managerConcernLabels,
  managerSupportAvailableLabels,
  managerSupportRequiredLabels,
  managerSupportRequiredSummary,
  managerWorkplaceApplicationLabel,
  managerWorkplaceApplicationLabels,
  parseManagerCheckInDetails,
  type ManagerCheckInAgreedAction,
  type ManagerCheckInConcern,
  type ManagerCheckInDetails,
  type ManagerCheckInInput,
} from "@/lib/levytate/mvp/manager-check-in";
import type { LearnerReview } from "@/lib/levytate/mvp/learner-lifecycle";
import {
  getManagerDirectReportContext,
  listManagerDirectReportApplications,
  type ManagerDirectReportContext,
} from "@/lib/server/levytate-manager-scope";
import { listManagerDirectReportLearnerLifecycleDetails } from "@/lib/server/levytate-learner-lifecycle";
import {
  getLevyTateSupabaseConfig,
  supabaseInsert,
  supabaseSelect,
} from "@/lib/server/levytate-supabase";

const reviewsTable = "levytate_learner_reviews";
const lifecycleEventsTable = "levytate_learner_lifecycle_events";

type ManagerReviewRow = {
  organisation_id: string;
  id: string;
  learner_record_id: string;
  review_type: "manager_check_in";
  review_date: string;
  next_review_date: string | null;
  reviewer_name: string;
  reviewer_user_id: string;
  provider_id: string;
  summary: string;
  actions: unknown;
  support_required: string;
  status: "completed" | "action_required";
  created_at: string;
  updated_at: string;
};

export class LevyTateManagerCheckInAccessError extends Error {
  constructor() {
    super("This employee is no longer within your direct-report scope.");
    this.name = "LevyTateManagerCheckInAccessError";
  }
}

export class LevyTateManagerCheckInValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LevyTateManagerCheckInValidationError";
  }
}

export class LevyTateManagerCheckInConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LevyTateManagerCheckInConflictError";
  }
}

export async function recordManagerDirectReportCheckIn(
  session: LevyTateBetaSession,
  employeeId: string,
  rawInput: ManagerCheckInInput,
) {
  const scope = await authorisedScope(session, employeeId);
  const details = await listManagerDirectReportLearnerLifecycleDetails(session, scope);
  const learner = details.find((item) => item.learner.id === employeeId);
  if (!learner) {
    throw new LevyTateManagerCheckInValidationError("A learner record is required before a manager check-in can be recorded.");
  }
  if (!managerCheckInEligibleLifecycleStatuses.includes(learner.lifecycleStatus as (typeof managerCheckInEligibleLifecycleStatuses)[number])) {
    throw new LevyTateManagerCheckInValidationError("A new manager check-in cannot be recorded for this learner's current journey state.");
  }

  const idempotencyKey = validateIdempotencyKey(rawInput?.idempotencyKey);
  const reviewId = `learner-review-${learner.learnerRecordId}-${idempotencyKey}`;
  const existing = await selectReview(scope.organisation.id, reviewId);
  if (existing) {
    await ensureLifecycleEvent(scope, employeeId, existing);
    await synchroniseManagerConditions(session, employeeId, learner.learnerRecordId);
    return { created: false, record: reviewFromRow(existing), learnerRecordId: learner.learnerRecordId };
  }

  if (rawInput.expectedActivityVersion && rawInput.expectedActivityVersion !== learner.activityVersion) {
    throw new LevyTateManagerCheckInConflictError("This learner record has changed since you opened it. Refresh the record before saving again.");
  }

  const applications = await listManagerDirectReportApplications(session, scope);
  const application = applications.find((item) => item.employee.id === employeeId && item.id === learner.programme.applicationReference)
    ?? applications.find((item) => item.employee.id === employeeId);
  const journeyDates = [
    application?.submittedAt.slice(0, 10) ?? "",
    learner.expectedStartDate,
    learner.actualStartDate,
  ].filter(Boolean).sort();
  const input = validateInput(rawInput, journeyDates[0] ?? "");
  const timestamp = new Date().toISOString();
  const detailsPayload: ManagerCheckInDetails = {
    schemaVersion: 1,
    discussionPurpose: input.discussionPurpose,
    discussionPurposeDetail: input.discussionPurposeDetail,
    workplaceApplication: input.workplaceApplication,
    learningApplied: input.learningApplied,
    workplaceOpportunityAvailable: input.workplaceOpportunityAvailable,
    workplaceOpportunityNeeded: input.workplaceOpportunityNeeded,
    workplaceApplicationNote: input.workplaceApplicationNote,
    supportAvailable: input.supportAvailable,
    supportAvailableOtherDetail: input.supportAvailableOtherDetail,
    concerns: input.concerns,
    agreedActions: input.agreedActions,
    supportRequired: input.supportRequired,
    supportRequiredDetail: input.supportRequiredDetail,
    actionRequiredReason: input.actionRequiredReason,
    note: input.note,
  };
  const row: ManagerReviewRow = {
    organisation_id: scope.organisation.id,
    id: reviewId,
    learner_record_id: learner.learnerRecordId,
    review_type: "manager_check_in",
    review_date: input.checkInDate,
    next_review_date: input.nextCheckInDate || null,
    reviewer_name: scope.manager.name,
    reviewer_user_id: scope.user.id,
    provider_id: "",
    summary: buildSummary(detailsPayload),
    actions: managerCheckInStorageEnvelope(detailsPayload),
    support_required: managerSupportRequiredSummary(detailsPayload.supportRequired),
    status: input.status,
    created_at: timestamp,
    updated_at: timestamp,
  };

  const inserted = await supabaseInsert<ManagerReviewRow>(requireConfig(), reviewsTable, [row], {
    query: "on_conflict=organisation_id,id",
    prefer: "resolution=ignore-duplicates,return=representation",
  });
  const persisted = inserted[0] ?? await selectReview(scope.organisation.id, reviewId);
  if (!persisted) throw new Error("Manager check-in persistence did not return a record.");

  await ensureLifecycleEvent(scope, employeeId, persisted);
  await synchroniseManagerConditions(session, employeeId, learner.learnerRecordId);
  return { created: Boolean(inserted[0]), record: reviewFromRow(persisted), learnerRecordId: learner.learnerRecordId };
}

async function authorisedScope(session: LevyTateBetaSession, employeeId: string) {
  try {
    const scope = await getManagerDirectReportContext(session);
    if (!scope.directReports.some((employee) => employee.id === employeeId)) throw new LevyTateManagerCheckInAccessError();
    return scope;
  } catch (error) {
    if (error instanceof LevyTateManagerCheckInAccessError) throw error;
    throw new LevyTateManagerCheckInAccessError();
  }
}

function validateInput(input: ManagerCheckInInput, journeyStartDate: string): ManagerCheckInInput {
  if (!input || typeof input !== "object") throw new LevyTateManagerCheckInValidationError("Enter the manager check-in details.");
  if (!hasKey(managerCheckInPurposeLabels, input.discussionPurpose)) invalid("discussion purpose");
  if (!hasKey(managerWorkplaceApplicationLabels, input.workplaceApplication)) invalid("workplace application state");
  if (input.status !== "completed" && input.status !== "action_required") invalid("check-in status");

  const checkInDate = validDate(input.checkInDate, "Check-in date");
  const maximum = new Date();
  maximum.setUTCHours(0, 0, 0, 0);
  maximum.setUTCDate(maximum.getUTCDate() + 7);
  if (new Date(`${checkInDate}T00:00:00Z`).getTime() > maximum.getTime()) {
    throw new LevyTateManagerCheckInValidationError("Check-in date cannot be more than 7 days in the future.");
  }
  if (journeyStartDate && checkInDate < journeyStartDate) {
    throw new LevyTateManagerCheckInValidationError("Check-in date cannot be before the apprenticeship journey began.");
  }
  const nextCheckInDate = cleanText(input.nextCheckInDate, 10);
  if (nextCheckInDate) {
    validDate(nextCheckInDate, "Next check-in date");
    if (nextCheckInDate <= checkInDate) throw new LevyTateManagerCheckInValidationError("Next check-in date must be after the check-in date.");
    const maximumPlanningDate = new Date(`${checkInDate}T00:00:00Z`);
    maximumPlanningDate.setUTCFullYear(maximumPlanningDate.getUTCFullYear() + 3);
    if (new Date(`${nextCheckInDate}T00:00:00Z`) > maximumPlanningDate) throw new LevyTateManagerCheckInValidationError("Next check-in date is implausibly far in the future.");
  }

  const discussionPurposeDetail = cleanText(input.discussionPurposeDetail, 600);
  if (input.discussionPurpose === "other" && !discussionPurposeDetail) required("Explain the other discussion purpose");
  const supportAvailable = enumArray(input.supportAvailable, managerSupportAvailableLabels, "support available");
  if (!supportAvailable.length) required("Select the support available");
  const supportAvailableOtherDetail = cleanText(input.supportAvailableOtherDetail, 600);
  if (supportAvailable.includes("other") && !supportAvailableOtherDetail) required("Explain the other support available");

  const concerns = validateConcerns(input.concerns);
  const agreedActions = validateActions(input.agreedActions, checkInDate);
  const supportRequired = enumArray(input.supportRequired, managerSupportRequiredLabels, "support required");
  if (!supportRequired.length) required("Select the support required");
  if (supportRequired.includes("no_additional_support") && supportRequired.length > 1) {
    throw new LevyTateManagerCheckInValidationError("No additional support cannot be combined with another support requirement.");
  }
  const supportRequiredDetail = cleanText(input.supportRequiredDetail, 800);
  if ((supportRequired.includes("escalation_recommended") || supportRequired.includes("other")) && !supportRequiredDetail) {
    required("Explain the escalation or other support required");
  }

  const learningApplied = cleanText(input.learningApplied, 1000);
  const workplaceOpportunityAvailable = cleanText(input.workplaceOpportunityAvailable, 1000);
  const workplaceOpportunityNeeded = cleanText(input.workplaceOpportunityNeeded, 1000);
  const workplaceApplicationNote = cleanText(input.workplaceApplicationNote, 1000);
  if (!learningApplied && !workplaceOpportunityAvailable && !workplaceOpportunityNeeded && !workplaceApplicationNote) {
    required("Record how learning is being applied or the workplace opportunity discussed");
  }

  const actionRequiredReason = cleanText(input.actionRequiredReason, 800);
  if (input.status === "action_required") {
    const substantiveSupport = supportRequired.some((item) => item !== "no_additional_support");
    if (!agreedActions.length && !substantiveSupport) required("Add an agreed action or a support requirement when action is required");
    if (!actionRequiredReason) required("Explain why action is required");
  }

  return {
    ...input,
    idempotencyKey: validateIdempotencyKey(input.idempotencyKey),
    checkInDate,
    nextCheckInDate,
    discussionPurposeDetail,
    learningApplied,
    workplaceOpportunityAvailable,
    workplaceOpportunityNeeded,
    workplaceApplicationNote,
    supportAvailable,
    supportAvailableOtherDetail,
    concerns,
    agreedActions,
    supportRequired,
    supportRequiredDetail,
    actionRequiredReason,
    note: cleanText(input.note, 600),
  };
}

function validateConcerns(value: unknown): ManagerCheckInConcern[] {
  if (!Array.isArray(value) || !value.length) required("Select the current concern position");
  const concerns = value.map((item) => {
    if (!item || typeof item !== "object") invalid("concern");
    const candidate = item as Partial<ManagerCheckInConcern>;
    if (!hasKey(managerConcernLabels, candidate.type)) invalid("concern");
    const detail = cleanText(candidate.detail, 600);
    if (candidate.type !== "no_current_concern" && !detail) required(`Explain the ${managerConcernLabels[candidate.type].toLowerCase()}`);
    return { type: candidate.type, detail };
  });
  const types = new Set(concerns.map((item) => item.type));
  if (types.size !== concerns.length) throw new LevyTateManagerCheckInValidationError("Remove duplicate concerns.");
  if (types.has("no_current_concern") && types.size > 1) throw new LevyTateManagerCheckInValidationError("No current concern cannot be combined with another concern.");
  return concerns;
}

function validateActions(value: unknown, checkInDate: string): ManagerCheckInAgreedAction[] {
  if (!Array.isArray(value)) invalid("agreed actions");
  if (value.length > 8) throw new LevyTateManagerCheckInValidationError("Record no more than 8 agreed actions in one check-in.");
  return value.map((item) => {
    if (!item || typeof item !== "object") invalid("agreed action");
    const candidate = item as Partial<ManagerCheckInAgreedAction>;
    const description = cleanText(candidate.description, 500);
    if (!description) required("Enter the agreed action");
    if (!hasKey(managerActionOwnerLabels, candidate.responsibleParty)) invalid("responsible party");
    const targetDate = cleanText(candidate.targetDate, 10);
    if (targetDate) {
      validDate(targetDate, "Action target date");
      if (targetDate < checkInDate) throw new LevyTateManagerCheckInValidationError("An action target date cannot be before the check-in date.");
    }
    return { description, responsibleParty: candidate.responsibleParty, targetDate };
  });
}

async function selectReview(organisationId: string, id: string) {
  const rows = await supabaseSelect<ManagerReviewRow>(requireConfig(), reviewsTable, new URLSearchParams({
    select: "*",
    organisation_id: `eq.${organisationId}`,
    id: `eq.${id}`,
    limit: "1",
  }));
  return rows[0] ?? null;
}

async function ensureLifecycleEvent(scope: ManagerDirectReportContext, employeeId: string, review: ManagerReviewRow) {
  const details = parseManagerCheckInDetails(review.actions);
  await supabaseInsert(requireConfig(), lifecycleEventsTable, [{
    organisation_id: scope.organisation.id,
    id: `learner-event-${review.id}`,
    learner_record_id: review.learner_record_id,
    event_type: "manager_check_in_recorded",
    previous_status: "",
    new_status: "",
    event_date: review.created_at,
    actor_user_id: scope.user.id,
    actor_name: scope.manager.name,
    source: "levytate_manager_check_in",
    summary: "Manager check-in recorded.",
    metadata: {
      reviewId: review.id,
      employeeId,
      managerEmployeeId: scope.manager.id,
      checkInDate: review.review_date,
      purpose: details?.discussionPurpose ?? "",
      status: review.status,
    },
    created_at: review.created_at,
  }], {
    query: "on_conflict=organisation_id,id",
    prefer: "resolution=ignore-duplicates,return=minimal",
  });
}

async function synchroniseManagerConditions(session: LevyTateBetaSession, employeeId: string, learnerRecordId: string) {
  const { resolveManagerCheckInActionsForDirectReport } = await import("@/lib/server/levytate-operational-actions");
  await resolveManagerCheckInActionsForDirectReport(session, employeeId, learnerRecordId);
}

function reviewFromRow(row: ManagerReviewRow): LearnerReview {
  const managerCheckIn = parseManagerCheckInDetails(row.actions);
  return {
    id: row.id,
    organisationId: row.organisation_id,
    learnerRecordId: row.learner_record_id,
    reviewType: row.review_type,
    reviewDate: row.review_date,
    nextReviewDate: row.next_review_date ?? "",
    reviewerName: row.reviewer_name,
    reviewerUserId: row.reviewer_user_id,
    providerId: row.provider_id,
    summary: row.summary,
    actions: managerCheckIn ? managerCheckInActionSummaries(managerCheckIn) : [],
    supportRequired: row.support_required,
    status: row.status,
    managerCheckIn,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function buildSummary(details: ManagerCheckInDetails) {
  const summary = `${managerCheckInPurposeLabel(details.discussionPurpose)}. ${managerWorkplaceApplicationLabel(details.workplaceApplication)}.`;
  return details.note ? `${summary} ${details.note}` : summary;
}

function enumArray<T extends Record<string, string>>(value: unknown, labels: T, label: string) {
  if (!Array.isArray(value)) invalid(label);
  const values = value.map((item) => {
    if (!hasKey(labels, item)) invalid(label);
    return item;
  });
  return Array.from(new Set(values));
}

function validateIdempotencyKey(value: unknown) {
  const key = typeof value === "string" ? value.trim() : "";
  if (!/^[a-zA-Z0-9_-]{8,80}$/.test(key)) throw new LevyTateManagerCheckInValidationError("Invalid submission key. Refresh the learner record and try again.");
  return key;
}

function validDate(value: unknown, label: string) {
  const date = typeof value === "string" ? value.trim() : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new LevyTateManagerCheckInValidationError(`${label} is not a valid date.`);
  const [year, month, day] = date.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) {
    throw new LevyTateManagerCheckInValidationError(`${label} is not a valid date.`);
  }
  return date;
}

function cleanText(value: unknown, maximumLength: number) {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim().slice(0, maximumLength);
}

function hasKey<T extends Record<string, unknown>>(record: T, value: unknown): value is keyof T {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(record, value);
}

function required(label: string): never {
  throw new LevyTateManagerCheckInValidationError(`${label} is required.`);
}

function invalid(label: string): never {
  throw new LevyTateManagerCheckInValidationError(`Invalid ${label}.`);
}

function requireConfig() {
  const config = getLevyTateSupabaseConfig();
  if (!config) throw new Error("LevyTate persistence is unavailable.");
  return config;
}
