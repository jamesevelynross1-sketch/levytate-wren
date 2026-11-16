import { beforeEach, describe, expect, it, vi } from "vitest";

const boundary = vi.hoisted(() => ({ context: vi.fn(), select: vi.fn(), fetch: vi.fn() }));
vi.mock("@/lib/server/levytate-learner-lifecycle", () => ({ getLearnerLifecycleServerContext: boundary.context }));
vi.mock("@/lib/server/levytate-supabase", () => ({
  getLevyTateSupabaseConfig: () => null, supabaseSelect: boundary.select, supabaseFetchJson: boundary.fetch,
}));
import { applyPastoralMutationForSession } from "@/lib/server/levytate-pastoral";
import { pastoralCaseMutationSchema } from "@/lib/server/levytate-pastoral-input";
import { pastoralLocalDateToInstant } from "@/lib/levytate/pastoral/dates";
import type { LevyTateBetaSession } from "@/lib/levytate/config/beta-access";

const id = "ad000000-0000-4000-8000-000000000001";
const recipientId = "ad000000-0000-4000-8000-000000000002";
const key = "synthetic-input-only";
const payload = { topic: "Learning time", whatIWantYouToUnderstand: "Synthetic concern", howItIsAffectingMe: "", supportIWant: "Agree a time to talk", preferredContactMethod: "in_platform", sharingRestrictions: "" };
const cases = [
  { action: "submit_support_request", recipientId, topicCategory: "workload_pressure", urgencyRoute: "standard", idempotencyKey: key, payload },
  { action: "transition_support_request", requestId: id, transition: "acknowledge", expectedLockVersion: 0, idempotencyKey: key, note: "" },
  { action: "record_follow_up", requestId: id, agreedFollowUpAt: "2026-11-09T13:30:00+01:00", expectedLockVersion: 0, idempotencyKey: key },
  { action: "create_support_action", requestId: id, responsibleRecipientId: recipientId, dueAt: null, summary: "Agree protected learning time", idempotencyKey: key },
  { action: "transition_support_action", supportActionId: id, transition: "complete", expectedLockVersion: 0, idempotencyKey: key, note: "Synthetic progress" },
  { action: "record_employee_outcome", requestId: id, outcome: "helped", expectedLockVersion: 0, idempotencyKey: key },
] satisfies Array<Record<string, unknown>>;
const session = {} as LevyTateBetaSession;
beforeEach(() => vi.clearAllMocks());

async function rejectedBeforeContext(input: unknown) {
  await expect(applyPastoralMutationForSession(session, input)).rejects.toMatchObject({ status: 422 });
  expect(boundary.context).not.toHaveBeenCalled();
  expect(boundary.select).not.toHaveBeenCalled();
  expect(boundary.fetch).not.toHaveBeenCalled();
}

describe("My Support request validation (no database, workflow activation, or delivery)", () => {
  it.each(cases)("accepts the closed $action contract", (input) => {
    expect(pastoralCaseMutationSchema.safeParse(input).success).toBe(true);
  });
  it.each(cases)("rejects caller-supplied tenant/actor fields for $action before context", async (input) => {
    await rejectedBeforeContext({ ...input, organisationId: id, actorUserId: recipientId });
  });
  it.each(cases)("rejects coerced retry keys for $action before context", async (input) => {
    await rejectedBeforeContext({ ...input, idempotencyKey: 123456789 });
    await rejectedBeforeContext({ ...input, idempotencyKey: " " + key });
    await rejectedBeforeContext({ ...input, idempotencyKey: "x".repeat(129) });
  });
  it.each(cases)("rejects unknown properties rather than dropping them for $action", async (input) => {
    await rejectedBeforeContext({ ...input, transcript: "Private conversation must not enter a shared request" });
  });
  it.each(cases.flatMap((input) => Object.keys(input).filter((field) => field.endsWith("Id")).map((field) => ({ input, field }))))("rejects non-UUID $field", async ({ input, field }) => {
    await rejectedBeforeContext({ ...input, [field]: "-".repeat(36) });
    await rejectedBeforeContext({ ...input, [field]: [id] });
  });
  it.each(cases.filter((input) => "expectedLockVersion" in input))("rejects coerced, fractional or overflowing revision for $action", async (input) => {
    for (const revision of [null, false, "0", -1, 1.5, NaN, Infinity, 2147483648]) {
      await rejectedBeforeContext({ ...input, expectedLockVersion: revision });
    }
  });
  it.each(cases.filter((input) => "expectedLockVersion" in input))("rejects malformed and oversized notes for $action", async (input) => {
    await rejectedBeforeContext({ ...input, note: { private: "content" } });
    await rejectedBeforeContext({ ...input, note: "x".repeat(2001) });
  });
  it.each(["recipient", "employeeReportedFacts", "aiSuggestions", "transcript", "organisationId"])("rejects unreviewed nested payload field %s", async (field) => {
    await rejectedBeforeContext({ ...cases[0], payload: { ...payload, [field]: "not an approved shared field" } });
  });
  it.each([["topic", 180], ["whatIWantYouToUnderstand", 2500], ["howItIsAffectingMe", 1800], ["supportIWant", 1800], ["sharingRestrictions", 1000]] as const)("rejects malformed, absent or oversized %s rather than truncating", async (field, limit) => {
    for (const value of [undefined, 1, [], {}, "x".repeat(limit + 1)]) {
      await rejectedBeforeContext({ ...cases[0], payload: { ...payload, [field]: value } });
    }
  });
  it("rejects blank required fields, non-object payloads and invalid enums", async () => {
    for (const field of ["topic", "whatIWantYouToUnderstand", "supportIWant"]) {
      await rejectedBeforeContext({ ...cases[0], payload: { ...payload, [field]: "   " } });
    }
    for (const invalid of [null, [], "text"]) await rejectedBeforeContext({ ...cases[0], payload: invalid });
    for (const [index, field] of [[0, "topicCategory"], [0, "urgencyRoute"], [1, "transition"], [4, "transition"], [5, "outcome"]] as const) {
      await rejectedBeforeContext({ ...cases[index], [field]: "unsupported" });
    }
    await rejectedBeforeContext({ ...cases[0], payload: { ...payload, preferredContactMethod: "sms" } });
    await rejectedBeforeContext({ action: "unknown" });
  });
  it("rejects oversized or coerced action summaries", async () => {
    for (const summary of [null, {}, 7, "   ", "x".repeat(1801)]) await rejectedBeforeContext({ ...cases[3], summary });
  });
  it.each(["2026-02-30T12:00:00Z", "2026-11-09T12:00", "2026-11-09", "next Tuesday", "2026-11-09T12:00:00+25:00", "0000-01-01T12:00:00Z", 0, {}])("rejects ambiguous or invalid instant %j", async (instant) => {
    await rejectedBeforeContext({ ...cases[2], agreedFollowUpAt: instant });
    await rejectedBeforeContext({ ...cases[3], dueAt: instant });
  });
  it("normalises valid offsets and preserves bounded notes and empty optional text", () => {
    expect(pastoralCaseMutationSchema.parse(cases[2])).toMatchObject({ agreedFollowUpAt: "2026-11-09T12:30:00.000Z" });
    expect(pastoralCaseMutationSchema.parse({ ...cases[1], note: "x".repeat(2000) })).toMatchObject({ note: "x".repeat(2000) });
    expect(pastoralCaseMutationSchema.parse(cases[0])).toMatchObject({ payload: { sharingRestrictions: "", howItIsAffectingMe: "" } });
  });
  it("requires a recipient only for an explicit reassignment", async () => {
    expect(pastoralCaseMutationSchema.safeParse({ ...cases[4], transition: "reassign", newResponsibleRecipientId: recipientId }).success).toBe(true);
    await rejectedBeforeContext({ ...cases[4], transition: "reassign" });
    await rejectedBeforeContext({ ...cases[4], newResponsibleRecipientId: recipientId });
  });
  it("does not describe a schema-valid request as an authorised or completed workflow", async () => {
    boundary.context.mockRejectedValueOnce(new Error("Synthetic context remains unavailable"));
    await expect(applyPastoralMutationForSession(session, cases[0])).rejects.toThrow("Synthetic context remains unavailable");
    expect(boundary.fetch).not.toHaveBeenCalled();
  });
});

describe("native date inputs are converted in the browser timezone", () => {
  it("preserves selected local calendar components in an explicit instant", () => {
    const instant = pastoralLocalDateToInstant("2026-07-09T09:30");
    expect(instant).toMatch(/Z$/);
    const date = new Date(instant!);
    expect([date.getFullYear(), date.getMonth() + 1, date.getDate(), date.getHours(), date.getMinutes()]).toEqual([2026, 7, 9, 9, 30]);
    const due = new Date(pastoralLocalDateToInstant("2026-07-09")!);
    expect([due.getDate(), due.getHours(), due.getMinutes()]).toEqual([9, 0, 0]);
  });
  it.each(["2026-02-30", "2026-13-09", "2026-11-09T25:00", "2026-11-09T09:99", "09/11/2026", "2026-11-09T09:00Z", ""])("rejects invalid native input %s", (value) => {
    expect(pastoralLocalDateToInstant(value)).toBeNull();
  });
});
