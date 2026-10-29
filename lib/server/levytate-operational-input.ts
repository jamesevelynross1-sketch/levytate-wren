import { z } from "zod";
import { ClientRequestError } from "@/lib/server/levytate-request-boundary";
import {
  managerActionOwnerLabels, managerCheckInPurposeLabels, managerConcernLabels,
  managerSupportAvailableLabels, managerSupportRequiredLabels, managerWorkplaceApplicationLabels,
} from "@/lib/levytate/mvp/manager-check-in";
import { guidanceCategories, guidanceItemReviewStatuses, guidanceReviewStatuses, guidanceSourceStatuses } from "@/lib/levytate/guidance/source-registry";

const id = z.string().trim().min(1).max(200);
const note = z.string().max(4000);
const version = z.number().int().nonnegative().max(2147483647);
const dateText = z.string().max(10);
const commandKey = z.string().regex(/^[A-Za-z0-9:_-]{8,128}$/);
const calendarDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const parsed = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(parsed) && new Date(parsed).toISOString().slice(0, 10) === value;
});
const optionalDate = z.union([calendarDate, z.literal("")]).optional();
export const learnerEnrolmentInput = z.strictObject({
  idempotencyKey: commandKey, expectedActivityVersion: id,
  initialProgress: z.strictObject({ updateDate: calendarDate, targetProgressPercentage: z.number().min(0).max(100), actualProgressPercentage: z.number().min(0).max(100), summary: note.trim().min(1) }),
  firstReviewDate: calendarDate, firstReviewerName: z.string().trim().min(1).max(200),
});
export const employeeDeclarationInput = z.strictObject({
  idempotencyKey: commandKey, expectedUpdatedAt: id, confirmed: z.literal(true), expectedEnglandWorkingHoursPercentage: z.number().min(50).max(100),
});
export const learnerOutcomeInput = z.strictObject({
  outcome: z.enum(["withdrawal", "achievement", "completion_without_achievement"]), idempotencyKey: commandKey, expectedActivityVersion: id,
  effectiveDate: calendarDate, notes: note.trim().min(1), reasonCategory: z.string().max(200).optional(), initiatedBy: z.string().max(200).optional(),
  providerNotified: z.boolean().optional(), providerNotifiedDate: optionalDate, employeeNotified: z.boolean().optional(), employeeNotifiedDate: optionalDate,
  grade: z.string().max(200).optional(), gradeType: z.string().max(200).optional(), certificateReceived: z.boolean().optional(), certificateReceivedDate: optionalDate,
});
const enumKeys = <T extends Record<string, string>>(labels: T) => z.enum(Object.keys(labels) as [Extract<keyof T, string>, ...Extract<keyof T, string>[]]);
export function parseAction<T>(schema: z.ZodType<T>, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) throw new ClientRequestError("The action contains invalid or unsupported fields. Check your input and try again.", 400);
  return result.data;
}

export const managerStartInput = z.strictObject({ expectedVersion: version, note: note.optional() });
export const managerAcknowledgeInput = z.strictObject({ expectedVersion: version });
export const managerCheckInInput = z.strictObject({
  idempotencyKey: id, expectedActivityVersion: z.string().max(200).optional(), checkInDate: dateText, nextCheckInDate: dateText,
  status: z.enum(["completed", "action_required"]), discussionPurpose: enumKeys(managerCheckInPurposeLabels),
  discussionPurposeDetail: note, workplaceApplication: enumKeys(managerWorkplaceApplicationLabels), learningApplied: note,
  workplaceOpportunityAvailable: note, workplaceOpportunityNeeded: note, workplaceApplicationNote: note,
  supportAvailable: z.array(enumKeys(managerSupportAvailableLabels)).max(20), supportAvailableOtherDetail: note,
  concerns: z.array(z.strictObject({ type: enumKeys(managerConcernLabels), detail: note })).max(20),
  agreedActions: z.array(z.strictObject({ description: note, responsibleParty: enumKeys(managerActionOwnerLabels), targetDate: dateText })).max(20),
  supportRequired: z.array(enumKeys(managerSupportRequiredLabels)).max(20), supportRequiredDetail: note, actionRequiredReason: note, note,
});
export const operationalActionInput = z.discriminatedUnion("command", [
  z.strictObject({ command: z.literal("acknowledge"), expectedVersion: version }),
  z.strictObject({ command: z.literal("start"), expectedVersion: version }),
  z.strictObject({ command: z.literal("complete"), expectedVersion: version, completionNote: note.optional(), resolvedOutsideLevyTate: z.boolean().optional() }),
  z.strictObject({ command: z.literal("dismiss"), expectedVersion: version, dismissalReason: note, dismissalKind: z.enum(["not_applicable", "duplicate_administrative_warning", "managed_outside_levytate", "incorrect_source_data", "no_action_required", "other"]) }),
  z.strictObject({ command: z.literal("assign"), expectedVersion: version, ownerType: z.enum(["Employee", "Line Manager", "Apprenticeship Lead", "HR", "Provider", "Shared"]), ownerUserId: z.string().max(200).optional(), ownerDisplayName: z.string().max(200).optional() }),
  z.strictObject({ command: z.literal("due_date"), expectedVersion: version, dueDate: dateText, dueDateReason: note.optional() }),
  z.strictObject({ command: z.literal("cancel"), expectedVersion: version, cancellationReason: note, cancellationKind: z.enum(["duplicate_legacy_action", "invalidly_generated", "superseded_administrative_action"]) }),
]);
export const intelligenceActionInput = z.discriminatedUnion("action", [
  z.strictObject({ action: z.literal("analyse") }),
  z.strictObject({ action: z.enum(["acknowledge", "accept"]), signalId: id }),
  z.strictObject({ action: z.literal("dismiss"), signalId: id, reason: z.enum(["Already resolved", "Incorrect interpretation", "No action required", "Planned intervention already exists", "Other"]) }),
]);
export const autopilotActionInput = z.discriminatedUnion("action", [
  z.strictObject({ action: z.literal("refresh") }),
  z.strictObject({ action: z.literal("dismiss"), signalId: id, reason: note }),
  z.strictObject({ action: z.literal("create_action"), signalId: id, title: z.string().max(300), ownerType: z.string().max(80), dueDate: dateText, communicationDraft: note }),
]);
export const guidanceSourcePatch = z.strictObject({ id, patch: z.strictObject({
  reviewStatus: z.enum(guidanceReviewStatuses).optional(), sourceStatus: z.enum(guidanceSourceStatuses).optional(),
  copilotApproved: z.boolean().optional(), notes: note.optional(), lastChangeSummary: note.optional(), monitoringNotes: note.optional(),
}) });
export const guidanceItemPatch = z.strictObject({ id, patch: z.strictObject({ reviewStatus: z.enum(guidanceItemReviewStatuses).optional(), copilotApproved: z.boolean().optional() }) });
export const guidanceItemSave = z.strictObject({ sourceIds: z.array(id).max(100), item: z.strictObject({
  id, title: z.string().trim().min(1).max(300), summary: note, guidanceCategory: z.enum(guidanceCategories),
  reviewStatus: z.enum(guidanceItemReviewStatuses), copilotApproved: z.boolean(), createdAt: z.string().max(40), updatedAt: z.string().max(40),
  body: z.strictObject({ plainEnglishExplanation: note, whyItMatters: note, employerAction: note, practicalChecklist: z.array(note).max(100),
    commonMistake: note, applicableFundingYear: z.string().max(50), effectiveDate: dateText, applicableStartDateFrom: dateText,
    applicableStartDateTo: dateText, lastReviewedDate: dateText, reviewer: z.string().max(200), status: z.enum(guidanceItemReviewStatuses),
  }),
}) });
export const prospectActionInput = z.discriminatedUnion("operation", [
  z.strictObject({ operation: z.literal("complete_guidance") }),
  z.strictObject({ operation: z.enum(["activate", "revoke", "reactivate", "update_expiry", "reset_guidance"]), accessId: id,
    confirmation: z.string().max(500).optional(), accessStartAt: z.string().max(40).optional(), accessExpiresAt: z.string().max(40).nullable().optional(),
    internalOwnerName: z.string().max(200).optional(), reason: note.optional(), version: version.optional(),
  }),
]);
