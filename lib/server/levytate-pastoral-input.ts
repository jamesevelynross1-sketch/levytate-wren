import { z } from "zod";
import { pastoralTopicCategories, type PastoralSupportMutation } from "@/lib/levytate/pastoral/domain";

// These contracts validate requests only. They do not grant access or enable My Support.
const recordId = z.uuid();
const requestKey = z.string().regex(/^[a-zA-Z0-9:_-]{8,128}$/);
const lockVersion = z.number().int().min(0).max(2147483647);
const note = z.string().max(2000).trim().optional();
const requiredText = (max: number) => z.string().max(max).trim().min(1);
const optionalText = (max: number) => z.string().max(max).trim();
const instant = z.iso.datetime({ offset: true }).max(40)
  .refine((value) => !value.startsWith("0000-") && Number.isFinite(Date.parse(value)))
  .transform((value) => new Date(value).toISOString());

type CaseMutation = Exclude<PastoralSupportMutation, { action: "set_history_preference" | "delete_conversation" }>;

export const pastoralCaseMutationSchema: z.ZodType<CaseMutation> = z.discriminatedUnion("action", [
  z.strictObject({
    action: z.literal("submit_support_request"),
    recipientId: recordId,
    topicCategory: z.enum(pastoralTopicCategories),
    urgencyRoute: z.enum(["standard", "prompt_human_support", "emergency_guidance"]),
    idempotencyKey: requestKey,
    payload: z.strictObject({
      topic: requiredText(180),
      whatIWantYouToUnderstand: requiredText(2500),
      howItIsAffectingMe: optionalText(1800),
      supportIWant: requiredText(1800),
      preferredContactMethod: z.enum(["in_platform", "email", "phone", "meeting", "provider_route"]),
      sharingRestrictions: optionalText(1000),
    }),
  }),
  z.strictObject({
    action: z.literal("transition_support_request"),
    requestId: recordId,
    transition: z.enum(["acknowledge", "start_support", "request_follow_up", "resolve", "reopen", "dispute"]),
    expectedLockVersion: lockVersion,
    idempotencyKey: requestKey,
    note,
  }),
  z.strictObject({
    action: z.literal("record_follow_up"),
    requestId: recordId,
    expectedLockVersion: lockVersion,
    agreedFollowUpAt: instant,
    idempotencyKey: requestKey,
    note,
  }),
  z.strictObject({
    action: z.literal("create_support_action"),
    requestId: recordId,
    responsibleRecipientId: recordId,
    dueAt: instant.nullable().optional(),
    summary: requiredText(1800),
    idempotencyKey: requestKey,
  }),
  z.strictObject({
    action: z.literal("transition_support_action"),
    supportActionId: recordId,
    transition: z.enum(["start", "progress", "complete", "cancel", "reassign"]),
    expectedLockVersion: lockVersion,
    idempotencyKey: requestKey,
    newResponsibleRecipientId: recordId.optional(),
    note,
  }).refine((value) => value.transition === "reassign" ? value.newResponsibleRecipientId !== undefined : value.newResponsibleRecipientId === undefined),
  z.strictObject({
    action: z.literal("record_employee_outcome"),
    requestId: recordId,
    outcome: z.enum(["helped", "further_support_requested"]),
    expectedLockVersion: lockVersion,
    idempotencyKey: requestKey,
    note,
  }),
]);
