import { z } from "zod";

// These are provider-reported submissions, never direct learner mutations or
// unreviewed changes to the official Skills England/provider catalogue.
export type ProviderDeliveryUpdateKind = "learner_progress" | "programme_note";
export type ProviderDeliveryReviewStatus = "pending" | "accepted" | "rejected";

const isoDate = z.string().regex(/^20\d{2}-(0[1-9]|1[0-2])-([0-2]\d|3[01])$/).refine((value) => {
  const time = Date.parse(value + "T00:00:00Z");
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value;
}, "Enter a real calendar date.");

export const providerDeliverySubmitSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("learner_progress"),
    organisationId: z.string().uuid(),
    targetId: z.string().min(1).max(200),
    idempotencyKey: z.string().uuid(),
    payload: z.object({
      reportDate: isoDate,
      actualProgressPercentage: z.number().int().min(0).max(100),
      summary: z.string().trim().min(1).max(1200),
      nextReviewDate: isoDate.optional(),
    }).strict().refine((value) => !value.nextReviewDate || value.nextReviewDate >= value.reportDate,
      "Next review date cannot precede the update."),
  }).strict(),
  z.object({
    kind: z.literal("programme_note"),
    organisationId: z.string().uuid(),
    targetId: z.string().min(1).max(200),
    idempotencyKey: z.string().uuid(),
    payload: z.object({
      reportDate: isoDate,
      deliveryNote: z.string().trim().min(1).max(1200),
      capacityStatus: z.enum(["available", "limited", "unavailable", "unknown"]),
    }).strict(),
  }).strict(),
]);

export const employerDeliveryActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("grant"), providerId: z.string().trim().min(1).max(160), enabled: z.boolean() }).strict(),
  z.object({ action: z.literal("review"), updateId: z.string().uuid(), decision: z.enum(["accepted", "rejected"]) }).strict(),
]);

export type ProviderDeliverySubmission = z.infer<typeof providerDeliverySubmitSchema>;
export type EmployerDeliveryAction = z.infer<typeof employerDeliveryActionSchema>;

export type ProviderDeliveryUpdateView = {
  id: string;
  organisationId: string;
  providerId: string;
  kind: ProviderDeliveryUpdateKind;
  targetId: string;
  reportDate: string;
  payload: ProviderDeliverySubmission["payload"];
  status: ProviderDeliveryReviewStatus;
  submittedAt: string;
  reviewedAt: string | null;
};

export type ProviderDeliveryEmployer = {
  id: string;
  name: string;
  programmes: { id: string; name: string }[];
  learners: { id: string; name: string; status: string; programmeName: string }[];
  updates: ProviderDeliveryUpdateView[];
};

export type ProviderDeliveryWorkspace = {
  provider: { id: string; name: string; memberRole: string };
  employers: ProviderDeliveryEmployer[];
};

export type EmployerDeliveryWorkspace = {
  grants: { providerId: string; providerName: string; enabled: boolean }[];
  updates: ProviderDeliveryUpdateView[];
};
