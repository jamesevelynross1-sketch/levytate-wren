import { z } from "zod";
import type { LevyTateWorkspaceMutation } from "@/lib/levytate/mvp/api";
import { ClientRequestError, requireActionKeys } from "@/lib/server/levytate-request-boundary";

const identifier = z.string().trim().min(1).max(200);
const text = z.string().max(500);
const money = z.number().int().min(Number.MIN_SAFE_INTEGER).max(Number.MAX_SAFE_INTEGER);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const timestamp = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value;
});
const transaction = z.strictObject({
  transactionId: text,
  transactionDate: date,
  description: text.trim().min(1),
  category: z.enum(["levy_in", "apprenticeship_spend", "levy_expiry", "transfer_out", "transfer_in", "refund_or_adjustment", "other"]),
  amountPence: money,
  providerName: z.string().max(240).optional(),
  apprenticeName: z.string().max(240).optional(),
  programmeName: z.string().max(240).optional(),
  payeScheme: z.string().max(120).optional(),
  payrollMonth: z.string().max(120).optional(),
  reportedBalancePence: money.optional(),
  sourceRow: z.number().int().min(1).max(10001),
  fingerprint: z.string().max(128),
});
const financeAction = z.discriminatedUnion("action", [
  z.strictObject({ action: z.literal("balance"), amountPence: money.nonnegative() }),
  z.strictObject({
    action: z.literal("import"), fileName: z.string().trim().min(1).max(255),
    result: z.strictObject({
      transactions: z.array(transaction).min(1).max(10000),
      sourceRows: z.number().int().min(1).max(10000),
      dateRange: z.strictObject({ from: date, to: date }).refine((range) => range.from <= range.to).nullable(),
    }).refine((value) => value.sourceRows >= value.transactions.length),
  }),
]);

export function parseFinanceAction(body: Record<string, unknown>) {
  const result = financeAction.safeParse(body);
  if (!result.success) throw new ClientRequestError("A valid finance action is required. Check the file and values before retrying.", 400);
  return result.data;
}

const payloadFields = {
  saveProfile: "profile", saveEmployee: "employee", saveEmployeeDevelopmentProfile: "profile",
  saveRole: "role", saveApplication: "application", saveProvider: "provider", saveProviderProgramme: "programme",
  saveProviderRelationship: "relationship", saveOrganisationProvider: "selection", saveOrganisationProgramme: "selection",
  saveMatchingRequest: "request", saveEnrolment: "enrolment",
} as const;
const archiveActions = ["archiveEmployee", "archiveRole", "archiveProvider", "archiveProviderProgramme", "removeProviderProgramme"];
const statuses = {
  updateApplicationStatus: ["Draft", "Submitted to Line Manager", "Awaiting Manager Review", "More information requested", "Declined by Line Manager", "Approved by Line Manager", "Submitted to Apprenticeship Lead", "Awaiting Final Approval", "Declined by Apprenticeship Lead", "Approved for Enrolment", "Withdrawn", "Completed", "Cancelled"],
  updateMatchingStatus: ["Submitted", "Under Review", "Provider Shortlist Being Prepared", "Shortlist Ready"],
  updateEnrolmentStatus: ["Ready for provider", "Submitted to provider", "Enrolment in progress", "Live learner", "Completed", "Cancelled"],
} as const;

/** Validate the wire envelope; resource services remain responsible for typed fields,
 * tenancy, permissions, transitions and references. Never trust client owner/status.
 */
export function parseWorkspaceMutation(body: Record<string, unknown>): LevyTateWorkspaceMutation {
  const type = body.type;
  if (typeof type !== "string") invalidAction();
  if (Object.hasOwn(payloadFields, type)) {
    const field = payloadFields[type as keyof typeof payloadFields];
    requireActionKeys(body, type === "saveApplication" ? ["type", field, "expectedRevision", "idempotencyKey"] : ["type", field]);
    const payload = body[field];
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) invalidAction();
    validateBoundedValue(payload);
  } else if (archiveActions.includes(type)) {
    requireActionKeys(body, ["type", "id"]);
    if (!identifier.safeParse(body.id).success) invalidAction();
  } else if (Object.hasOwn(statuses, type)) {
    requireActionKeys(body, type === "updateApplicationStatus" ? ["type", "id", "status", "note", "expectedRevision", "idempotencyKey"] : ["type", "id", "status"]);
    if (!identifier.safeParse(body.id).success || typeof body.status !== "string" || !(statuses[type as keyof typeof statuses] as readonly string[]).includes(body.status)) invalidAction();
    if (body.note !== undefined && !z.string().max(2000).safeParse(body.note).success) invalidAction();
  } else invalidAction();
  if (body.expectedRevision !== undefined && !z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).safeParse(body.expectedRevision).success) invalidAction();
  if (body.idempotencyKey !== undefined && !z.string().regex(/^[A-Za-z0-9:_-]{8,128}$/).safeParse(body.idempotencyKey).success) invalidAction();
  return body as LevyTateWorkspaceMutation;
}

function validateBoundedValue(value: unknown, depth = 0): void {
  if (depth > 12) invalidAction();
  if (typeof value === "string") { if (value.length > 20000) invalidAction(); return; }
  if (value === null || typeof value === "boolean" || (typeof value === "number" && Number.isFinite(value))) return;
  if (Array.isArray(value)) { if (value.length > 1000) invalidAction(); value.forEach((item) => validateBoundedValue(item, depth + 1)); return; }
  if (value && typeof value === "object") {
    const entries = Object.entries(value);
    if (entries.length > 100 || entries.some(([key]) => ["__proto__", "prototype", "constructor"].includes(key))) invalidAction();
    entries.forEach(([, item]) => validateBoundedValue(item, depth + 1));
    return;
  }
  invalidAction();
}
function invalidAction(): never { throw new ClientRequestError("A valid workspace action is required.", 400); }
